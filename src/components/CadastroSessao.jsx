import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const CadastroSessao = ({ onSuccess, onClose }) => {
  const [dataSessao, setDataSessao] = useState('');
  const [grauSessao, setGrauSessao] = useState(1);
  const [classificacaoSessaoId, setClassificacaoSessaoId] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [graus, setGraus] = useState([]);
  const [classificacoesSessao, setClassificacoesSessao] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });
  const [sessoes, setSessoes] = useState([]);
  const [editando, setEditando] = useState(null);

  useEffect(() => {
    carregarGraus();
    carregarClassificacoesSessao();
    carregarSessoes();
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

  const carregarClassificacoesSessao = async () => {
    try {
      const { data, error } = await supabase
        .from('classificacoes_sessao')
        .select('*')
        .order('nome');

      if (error) throw error;
      setClassificacoesSessao(data || []);
    } catch (error) {
      console.error('Erro ao carregar classificações de sessão:', error);
    }
  };

  const carregarSessoes = async () => {
    try {
      const { data, error } = await supabase
        .from('sessoes_presenca')
        .select('*, graus_sessao:grau_sessao_id(nome), classificacoes_sessao:classificacao_id(nome)')
        .order('data_sessao', { ascending: false })
        .limit(10);

      if (error) throw error;
      setSessoes(data || []);
    } catch (error) {
      console.error('Erro ao carregar sessões:', error);
    }
  };

  const editarSessao = (sessao) => {
    setDataSessao(sessao.data_sessao);
    setGrauSessao(sessao.grau_sessao_id);
    setClassificacaoSessaoId(sessao.classificacao_id || '');
    setObservacoes(sessao.observacoes || '');
    setEditando(sessao.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const excluirSessao = async (id) => {
    if (!confirm('Tem certeza que deseja excluir esta sessão?')) return;

    try {
      const { error } = await supabase
        .from('sessoes_presenca')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMensagem({ tipo: 'sucesso', texto: 'Sessão excluída com sucesso!' });
      carregarSessoes();
    } catch (error) {
      console.error('Erro ao excluir sessão:', error);
      setMensagem({ tipo: 'erro', texto: 'Erro ao excluir sessão' });
    }
  };

  const cancelarEdicao = () => {
    setDataSessao('');
    setGrauSessao(graus[0]?.id || 1);
    setClassificacaoSessaoId('');
    setObservacoes('');
    setEditando(null);
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
      console.log('📝 Salvando sessão...', { dataSessao, grauSessao, classificacaoSessaoId, observacoes });

      if (editando) {
        // Atualizar sessão existente
        const { error } = await supabase
          .from('sessoes_presenca')
          .update({
            data_sessao: dataSessao,
            grau_sessao_id: grauSessao,
            classificacao_id: classificacaoSessaoId || null,
            observacoes: observacoes || null
          })
          .eq('id', editando);

        if (error) throw error;
      } else {
        // Inserir nova sessão
        const { error } = await supabase
          .from('sessoes_presenca')
          .insert([{
            data_sessao: dataSessao,
            grau_sessao_id: grauSessao,
            classificacao_id: classificacaoSessaoId || null,
            observacoes: observacoes || null
          }]);

        if (error) throw error;
      }

      console.log('✅ Sessão salva');

      setMensagem({ 
        tipo: 'sucesso', 
        texto: editando ? 'Sessão atualizada com sucesso!' : 'Sessão cadastrada com sucesso!' 
      });

      // Limpar formulário
      setDataSessao('');
      setGrauSessao(graus[0]?.id || 1);
      setClassificacaoSessaoId('');
      setObservacoes('');
      setEditando(null);

      // Recarregar lista
      carregarSessoes();

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

        {/* Classificação da Sessão */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Classificação da Sessão
          </label>
          <select
            value={classificacaoSessaoId}
            onChange={(e) => setClassificacaoSessaoId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Selecione a classificação</option>
            {classificacoesSessao.map(classificacao => (
              <option key={classificacao.id} value={classificacao.id}>
                {classificacao.nome}
              </option>
            ))}
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
            {loading ? 'Salvando...' : editando ? '✏️ Atualizar Sessão' : '✅ Cadastrar Sessão'}
          </button>

          {editando && (
            <button
              type="button"
              onClick={cancelarEdicao}
              className="flex-1 bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 font-medium"
            >
              🔙 Cancelar Edição
            </button>
          )}

          {onClose && !editando && (
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

      {/* Lista de Sessões Cadastradas */}
      {sessoes.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-bold text-gray-800 mb-4">📋 Últimas Sessões Cadastradas</h3>
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-lg shadow">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Data</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Grau</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Classificação</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sessoes.map((sessao, idx) => (
                  <tr key={sessao.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 text-sm">
                      {new Date(sessao.data_sessao + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                        {sessao.graus_sessao?.nome}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${
                        sessao.classificacoes_sessao?.nome 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {sessao.classificacoes_sessao?.nome || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => editarSessao(sessao)}
                          className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                        >
                          ✏️ Editar
                        </button>
                        <button
                          onClick={() => excluirSessao(sessao.id)}
                          className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                        >
                          🗑️ Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>💡 Dica:</strong> Após cadastrar a sessão, você poderá lançar as presenças dos irmãos na tela "Sessões Realizadas".
        </p>
      </div>
    </div>
  );
};

export default CadastroSessao;
