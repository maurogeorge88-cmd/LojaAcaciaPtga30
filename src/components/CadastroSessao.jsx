import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const CadastroSessao = ({ onSuccess, onClose }) => {
  const [dataSessao, setDataSessao] = useState('');
  const [grauSessao, setGrauSessao] = useState(1);
  const [tipoSessao, setTipoSessao] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [graus, setGraus] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });

  useEffect(() => {
    carregarGraus();
  }, []);

  const carregarGraus = async () => {
    try {
      const { data, error } = await supabase
        .from('graus_sessao')
        .select('*')
        .order('grau_minimo_requerido');

      if (error) throw error;
      setGraus(data || []);
      
      // Definir primeiro grau como padrão
      if (data && data.length > 0) {
        setGrauSessao(data[0].id);
      }
    } catch (error) {
      console.error('Erro ao carregar graus:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!dataSessao) {
      setMensagem({ tipo: 'erro', texto: 'Por favor, informe a data da sessão' });
      return;
    }

    setLoading(true);
    setMensagem({ tipo: '', texto: '' });

    try {
      console.log('📝 Cadastrando sessão...', { dataSessao, grauSessao, tipoSessao, observacoes });

      // IMPORTANTE: Remover .single() para evitar erro "Cannot coerce to single JSON object"
      const { data, error } = await supabase
        .from('sessoes_presenca')
        .insert([{
          data_sessao: dataSessao,
          grau_sessao_id: grauSessao,
          tipo_sessao: tipoSessao || null,
          observacoes: observacoes || null
        }])
        .select(); // SEM .single()

      if (error) {
        console.error('❌ Erro ao cadastrar sessão:', error);
        throw error;
      }

      console.log('✅ Sessão cadastrada:', data);

      setMensagem({ 
        tipo: 'sucesso', 
        texto: 'Sessão cadastrada com sucesso!' 
      });

      // Limpar formulário
      setDataSessao('');
      setGrauSessao(graus[0]?.id || 1);
      setTipoSessao('');
      setObservacoes('');

      // Chamar callback de sucesso
      if (onSuccess) {
        setTimeout(() => onSuccess(), 1000);
      }

    } catch (error) {
      console.error('💥 Erro ao cadastrar sessão:', error);
      setMensagem({ 
        tipo: 'erro', 
        texto: error.message || 'Erro ao cadastrar sessão. Tente novamente.' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">📋 Cadastrar Nova Sessão</h2>

      {mensagem.texto && (
        <div className={`mb-4 p-4 rounded ${
          mensagem.tipo === 'sucesso' 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          {mensagem.texto}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Data da Sessão */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Data da Sessão *
          </label>
          <input
            type="date"
            value={dataSessao}
            onChange={(e) => setDataSessao(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {/* Grau da Sessão */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Grau da Sessão *
          </label>
          <select
            value={grauSessao}
            onChange={(e) => setGrauSessao(parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          >
            {graus.map(grau => (
              <option key={grau.id} value={grau.id}>
                {grau.nome}
              </option>
            ))}
          </select>
        </div>

        {/* Tipo de Sessão */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tipo de Sessão
          </label>
          <select
            value={tipoSessao}
            onChange={(e) => setTipoSessao(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Selecione o tipo</option>
            <option value="Ordinária">Ordinária</option>
            <option value="Extraordinária">Extraordinária</option>
            <option value="Magna">Magna</option>
            <option value="Branca">Branca</option>
            <option value="Fúnebre">Fúnebre</option>
            <option value="Instalação">Instalação</option>
            <option value="Especial">Especial</option>
          </select>
        </div>

        {/* Observação */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Observações
          </label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={3}
            placeholder="Digite observações sobre a sessão (opcional)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Botões */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Cadastrando...' : '✅ Cadastrar Sessão'}
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 font-medium"
            >
              ❌ Cancelar
            </button>
          )}
        </div>
      </form>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>💡 Dica:</strong> Após cadastrar a sessão, você poderá lançar as presenças dos irmãos na tela "Sessões Realizadas".
        </p>
      </div>
    </div>
  );
};

export default CadastroSessao;
