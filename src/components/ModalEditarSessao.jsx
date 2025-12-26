import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function ModalEditarSessao({ sessaoId, onFechar, onSalvo }) {
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [grausSessao, setGrausSessao] = useState([]);
  const [classificacoes, setClassificacoes] = useState([]);
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });
  
  const [formData, setFormData] = useState({
    data_sessao: '',
    grau_sessao_id: '',
    classificacao_id: '',
    observacoes: ''
  });

  useEffect(() => {
    if (sessaoId) {
      carregarDados();
    }
  }, [sessaoId]);

  const carregarDados = async () => {
    try {
      setLoading(true);

      // Buscar dados da sessão
      const { data: sessao, error: erroSessao } = await supabase
        .from('sessoes_presenca')
        .select('*')
        .eq('id', sessaoId)
        .single();

      if (erroSessao) throw erroSessao;

      setFormData({
        data_sessao: sessao.data_sessao,
        grau_sessao_id: sessao.grau_sessao_id,
        classificacao_id: sessao.classificacao_id || '',
        observacoes: sessao.observacoes || ''
      });

      // Buscar graus de sessão
      const { data: graus, error: erroGraus } = await supabase
        .from('graus_sessao')
        .select('*')
        .eq('ativo', true)
        .order('ordem_exibicao');

      if (erroGraus) throw erroGraus;
      setGrausSessao(graus || []);

      // Buscar classificações
      const { data: classif, error: erroClassif } = await supabase
        .from('classificacoes_sessao')
        .select('*')
        .eq('ativo', true)
        .order('ordem_exibicao');

      if (erroClassif) throw erroClassif;
      setClassificacoes(classif || []);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setMensagem({ 
        tipo: 'erro', 
        texto: 'Erro ao carregar dados da sessão.' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSalvando(true);
    setMensagem({ tipo: '', texto: '' });

    try {
      // Validações
      if (!formData.data_sessao) {
        throw new Error('Data da sessão é obrigatória');
      }
      if (!formData.grau_sessao_id) {
        throw new Error('Tipo de sessão é obrigatório');
      }

      // Atualizar a sessão
      const { error } = await supabase
        .from('sessoes_presenca')
        .update({
          data_sessao: formData.data_sessao,
          grau_sessao_id: parseInt(formData.grau_sessao_id),
          classificacao_id: formData.classificacao_id ? parseInt(formData.classificacao_id) : null,
          observacoes: formData.observacoes || null
        })
        .eq('id', sessaoId);

      if (error) throw error;

      setMensagem({ 
        tipo: 'sucesso', 
        texto: 'Sessão atualizada com sucesso!' 
      });

      setTimeout(() => {
        if (onSalvo) onSalvo();
        onFechar();
      }, 1500);

    } catch (error) {
      console.error('Erro ao atualizar sessão:', error);
      setMensagem({ 
        tipo: 'erro', 
        texto: error.message || 'Erro ao atualizar sessão. Tente novamente.' 
      });
    } finally {
      setSalvando(false);
    }
  };

  const grauSelecionado = grausSessao.find(g => g.id === parseInt(formData.grau_sessao_id));
  const exibirClassificacao = grauSelecionado && grauSelecionado.nome !== 'Sessão Administrativa';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Cabeçalho */}
        <div className="bg-blue-600 text-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Editar Sessão</h2>
            <button
              onClick={onFechar}
              className="text-white hover:bg-blue-700 rounded-full p-2 transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Carregando dados...</p>
              </div>
            </div>
          ) : (
            <>
              {mensagem.texto && (
                <div className={`mb-4 p-4 rounded ${
                  mensagem.tipo === 'sucesso' 
                    ? 'bg-green-100 text-green-800 border border-green-300' 
                    : 'bg-red-100 text-red-800 border border-red-300'
                }`}>
                  {mensagem.texto}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Data da Sessão */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data da Sessão *
                  </label>
                  <input
                    type="date"
                    name="data_sessao"
                    value={formData.data_sessao}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Tipo de Sessão */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Sessão *
                  </label>
                  <select
                    name="grau_sessao_id"
                    value={formData.grau_sessao_id}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione o tipo</option>
                    {grausSessao.map(grau => (
                      <option key={grau.id} value={grau.id}>
                        {grau.nome}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Classificação (apenas se não for Administrativa) */}
                {exibirClassificacao && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Classificação
                    </label>
                    <select
                      name="classificacao_id"
                      value={formData.classificacao_id}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Selecione a classificação (opcional)</option>
                      {classificacoes.map(classif => (
                        <option key={classif.id} value={classif.id}>
                          {classif.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Observações */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observações
                  </label>
                  <textarea
                    name="observacoes"
                    value={formData.observacoes}
                    onChange={handleChange}
                    rows="4"
                    placeholder="Observações gerais sobre a sessão (opcional)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </form>
            </>
          )}
        </div>

        {/* Rodapé */}
        {!loading && (
          <div className="bg-gray-50 px-6 py-4 border-t flex justify-end gap-4">
            <button
              onClick={onFechar}
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={salvando}
              className={`px-6 py-2 rounded-md text-white transition ${
                salvando
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {salvando ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
