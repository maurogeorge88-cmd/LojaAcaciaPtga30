import React, { useState, useEffect } from 'react';
import { supabase } from '../App';

export default function Sobre() {
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [editandoCampo, setEditandoCampo] = useState(null);
  const [valorTemp, setValorTemp] = useState('');
  const [eAdmin, setEAdmin] = useState(false);

  useEffect(() => {
    carregarConfiguracoes();
    verificarAdmin();
  }, []);

  const verificarAdmin = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('📧 Email do Auth:', session?.user?.email);
      
      // Verificar diretamente se é o email do admin
      if (session?.user?.email === 'mauro_george@hotmail.com') {
        setEAdmin(true);
        console.log('✅ É ADMIN!');
      } else {
        console.log('❌ NÃO é admin');
      }
    } catch (error) {
      console.error('Erro:', error);
    }
  };

  const carregarConfiguracoes = async () => {
    try {
      const { data, error } = await supabase
        .from('config_sistema')
        .select('*')
        .order('categoria', { ascending: true });

      if (error) throw error;

      const configObj = {};
      data.forEach(item => {
        configObj[item.chave] = item.valor;
      });

      setConfig(configObj);
      setLoading(false);
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      setLoading(false);
    }
  };

  const iniciarEdicao = (chave, valorAtual) => {
    setEditandoCampo(chave);
    setValorTemp(valorAtual);
  };

  const cancelarEdicao = () => {
    setEditandoCampo(null);
    setValorTemp('');
  };

  const salvarEdicao = async (chave) => {
    try {
      const { error } = await supabase
        .from('config_sistema')
        .update({ valor: valorTemp })
        .eq('chave', chave);

      if (error) throw error;

      setConfig(prev => ({ ...prev, [chave]: valorTemp }));
      setEditandoCampo(null);
      setValorTemp('');
      alert('✅ Salvo com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('❌ Erro ao salvar!');
    }
  };

  const CampoEditavel = ({ chave, valor, multiline = false }) => {
    const estaEditando = editandoCampo === chave;

    if (!eAdmin) {
      return <span>{valor}</span>;
    }

    if (estaEditando) {
      return (
        <div className="flex flex-col gap-2">
          {multiline ? (
            <textarea
              value={valorTemp}
              onChange={(e) => setValorTemp(e.target.value)}
              className="border rounded px-2 py-1 w-full"
              rows={4}
            />
          ) : (
            <input
              type="text"
              value={valorTemp}
              onChange={(e) => setValorTemp(e.target.value)}
              className="border rounded px-2 py-1 w-full"
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={() => salvarEdicao(chave)}
              className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
            >
              ✅ Salvar
            </button>
            <button
              onClick={cancelarEdicao}
              className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700"
            >
              ❌ Cancelar
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="group relative inline-block">
        <span>{valor}</span>
        <button
          onClick={() => iniciarEdicao(chave, valor)}
          className="ml-2 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Editar"
        >
          ✏️
        </button>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      {eAdmin && (
        <div className="bg-blue-50 border-l-4 border-blue-600 p-4 mb-6 rounded">
          <p className="text-blue-800 font-semibold">
            🔵 Modo Admin: Passe o mouse sobre os textos para editar
          </p>
        </div>
      )}

      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-xl shadow-xl p-8 mb-6">
        <h1 className="text-4xl font-bold mb-2">
          <CampoEditavel chave="sistema_nome" valor={config.sistema_nome || 'Sistema'} />
        </h1>
        <p className="text-xl text-blue-100">
          <CampoEditavel chave="sistema_loja" valor={config.sistema_loja || ''} />
        </p>
      </div>

      <div className="grid gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">
            ℹ️ Sobre o Sistema
          </h2>
          <div className="space-y-3">
            <div>
              <span className="font-semibold text-gray-700">Finalidade:</span>
              <p className="text-gray-600 mt-1">
                <CampoEditavel chave="sistema_finalidade" valor={config.sistema_finalidade || ''} multiline={true} />
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-semibold text-gray-700">Versão:</span>
                <p className="text-gray-600">
                  <CampoEditavel chave="sistema_versao" valor={config.sistema_versao || ''} />
                </p>
              </div>
              <div>
                <span className="font-semibold text-gray-700">Data de Criação:</span>
                <p className="text-gray-600">
                  <CampoEditavel chave="sistema_data_criacao" valor={config.sistema_data_criacao || ''} />
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">
            👨‍💻 Desenvolvedor
          </h2>
          <div className="space-y-3">
            <div>
              <span className="font-semibold text-gray-700">Nome:</span>
              <p className="text-gray-600">
                <CampoEditavel chave="dev_nome" valor={config.dev_nome || ''} />
              </p>
            </div>
            <div>
              <span className="font-semibold text-gray-700">Loja:</span>
              <p className="text-gray-600">
                <CampoEditavel chave="dev_loja" valor={config.dev_loja || ''} />
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">
            © Direitos Autorais
          </h2>
          <p className="text-gray-600 text-sm">
            <CampoEditavel chave="copyright_ano" valor={config.copyright_ano || ''} /> - 
            <CampoEditavel chave="copyright_autor" valor={config.copyright_autor || ''} />
          </p>
        </div>
      </div>
    </div>
  );
}
