import React, { useState, useEffect } from 'react';
import { supabase } from '../App';

export default function Sobre() {
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);
  const [editandoCampo, setEditandoCampo] = useState(null);
  const [valorTemp, setValorTemp] = useState('');
  const [usuarioLogado, setUsuarioLogado] = useState(null);

  useEffect(() => {
    carregarConfiguracoes();
    carregarUsuario();
  }, []);

  const carregarUsuario = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email === 'mauro_george@hotmail.com') {
        setUsuarioLogado({ tipo: 'administrador' });
      }
    } catch (error) {
      console.error('Erro ao carregar usuário:', error);
    }
  };

  const carregarConfiguracoes = async () => {
    try {
      const { data, error } = await supabase
        .from('config_sistema')
        .select('*')
        .order('categoria', { ascending: true });

      if (error) throw error;

      // Transformar array em objeto { chave: valor }
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

      // Atualizar estado local
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
    const eAdmin = usuarioLogado?.tipo === 'administrador';
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

  const eAdmin = usuarioLogado?.tipo === 'administrador';

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Aviso para Admin */}
      {eAdmin && (
        <div className="bg-blue-50 border-l-4 border-blue-600 p-4 mb-6 rounded">
          <p className="text-blue-800 font-medium">
            ✏️ <strong>Modo Admin:</strong> Passe o mouse sobre os textos para editar. 
            Clique no ✏️ para modificar.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-lg shadow-xl p-8 mb-6">
        <div className="flex items-center justify-center mb-4">
          <div className="text-6xl mr-4">🏛️</div>
          <div>
            <h1 className="text-4xl font-bold">
              <CampoEditavel chave="sistema_nome" valor={config.sistema_nome} />
            </h1>
            <p className="text-xl text-blue-100 mt-2">
              <CampoEditavel chave="sistema_loja" valor={config.sistema_loja} />
            </p>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        
        {/* Sobre o Sistema */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
            <span className="text-3xl mr-2">ℹ️</span>
            Sobre o Sistema
          </h2>
          <div className="space-y-3 text-gray-700">
            <p>
              <strong className="text-blue-600">Sistema:</strong> Gestão Administrativa e Financeira
            </p>
            <p>
              <strong className="text-blue-600">Finalidade:</strong>{' '}
              <CampoEditavel 
                chave="sistema_finalidade" 
                valor={config.sistema_finalidade}
                multiline={true}
              />
            </p>
            <p>
              <strong className="text-blue-600">Versão:</strong>{' '}
              <CampoEditavel chave="sistema_versao" valor={config.sistema_versao} />
            </p>
            <p>
              <strong className="text-blue-600">Data de Criação:</strong>{' '}
              <CampoEditavel 
                chave="sistema_data_criacao" 
                valor={new Date(config.sistema_data_criacao).toLocaleDateString('pt-BR')} 
              />
            </p>
            <p>
              <strong className="text-blue-600">Última Atualização:</strong>{' '}
              <CampoEditavel 
                chave="sistema_ultima_atualizacao" 
                valor={new Date(config.sistema_ultima_atualizacao).toLocaleDateString('pt-BR')} 
              />
            </p>
          </div>
        </div>

        {/* Desenvolvedor */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
            <span className="text-3xl mr-2">👨‍💻</span>
            Desenvolvedor
          </h2>
          <div className="space-y-3 text-gray-700">
            <p>
              <strong className="text-blue-600">Desenvolvido por:</strong>{' '}
              <CampoEditavel chave="dev_nome" valor={config.dev_nome} />
            </p>
            <p>
              <strong className="text-blue-600">Loja:</strong>{' '}
              <CampoEditavel chave="dev_loja" valor={config.dev_loja} />
            </p>
            <p>
              <strong className="text-blue-600">Localização:</strong>{' '}
              <CampoEditavel chave="dev_localizacao" valor={config.dev_localizacao} />
            </p>
            <p>
              <strong className="text-blue-600">Tecnologias:</strong>{' '}
              <CampoEditavel chave="dev_tecnologias" valor={config.dev_tecnologias} />
            </p>
            <p>
              <strong className="text-blue-600">Assistência:</strong>{' '}
              <CampoEditavel chave="dev_assistencia" valor={config.dev_assistencia} />
            </p>
          </div>
        </div>
      </div>

      {/* Funcionalidades */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
          <span className="text-3xl mr-2">⚙️</span>
          Funcionalidades Principais
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start space-x-3">
            <span className="text-2xl">👥</span>
            <div>
              <h3 className="font-semibold text-gray-800">Gestão de Irmãos</h3>
              <p className="text-sm text-gray-600">Cadastro completo com fotos, graus, cargos e familiares</p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <span className="text-2xl">💰</span>
            <div>
              <h3 className="font-semibold text-gray-800">Controle Financeiro</h3>
              <p className="text-sm text-gray-600">Receitas, despesas, mensalidades e pagamentos parcelados</p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <span className="text-2xl">📋</span>
            <div>
              <h3 className="font-semibold text-gray-800">Balaustres</h3>
              <p className="text-sm text-gray-600">Registro de sessões ordinárias, extraordinárias e de grau</p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <span className="text-2xl">📄</span>
            <div>
              <h3 className="font-semibold text-gray-800">Pranchas</h3>
              <p className="text-sm text-gray-600">Gestão de documentos e correspondências oficiais</p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <span className="text-2xl">📚</span>
            <div>
              <h3 className="font-semibold text-gray-800">Biblioteca</h3>
              <p className="text-sm text-gray-600">Controle de livros com acesso por grau maçônico</p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <span className="text-2xl">🎂</span>
            <div>
              <h3 className="font-semibold text-gray-800">Aniversariantes</h3>
              <p className="text-sm text-gray-600">Controle de aniversários de irmãos e familiares</p>
            </div>
          </div>
        </div>
      </div>

      {/* Direitos Autorais */}
      <div className="bg-gradient-to-r from-gray-100 to-gray-200 rounded-lg shadow-md p-6 border-l-4 border-blue-600">
        <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
          <span className="text-3xl mr-2">©️</span>
          Direitos Autorais
        </h2>
        <div className="space-y-3 text-gray-700">
          <p>
            <strong>
              © <CampoEditavel chave="copyright_ano" valor={config.copyright_ano} />{' '}
              <CampoEditavel chave="copyright_autor" valor={config.copyright_autor} />
            </strong>
          </p>
          <p>
            <CampoEditavel 
              chave="copyright_uso" 
              valor={config.copyright_uso}
              multiline={true}
            />
          </p>
          <p>
            <strong>Uso Restrito:</strong>{' '}
            <CampoEditavel 
              chave="copyright_restricao" 
              valor={config.copyright_restricao}
              multiline={true}
            />
          </p>
          <p>
            <strong>Código Fonte:</strong>{' '}
            <CampoEditavel chave="copyright_codigo" valor={config.copyright_codigo} />
          </p>
          <p className="text-sm text-gray-600 italic">
            Desenvolvido com dedicação para servir à Ordem Maçônica.
          </p>
        </div>
      </div>

      {/* Agradecimentos */}
      <div className="bg-white rounded-lg shadow-md p-6 mt-6 text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-3">🙏 Agradecimentos</h2>
        <p className="text-gray-700 mb-4">
          <CampoEditavel 
            chave="agradecimento_texto" 
            valor={config.agradecimento_texto}
            multiline={true}
          />
        </p>
        <div className="text-4xl text-blue-600 font-bold">
          🔺🔻🔺
        </div>
        <p className="text-xl text-gray-700 font-semibold mt-2">
          T∴F∴A∴
        </p>
      </div>
    </div>
  );
}
