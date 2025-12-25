import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function CadastroSessao({ onSessaoCriada }) {
  const [loading, setLoading] = useState(false);
  const [grausSessao, setGrausSessao] = useState([]);
  const [classificacoes, setClassificacoes] = useState([]);
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });
  
  const [formData, setFormData] = useState({
    data_sessao: '',
    grau_sessao_id: '',
    classificacao_id: '',
    observacoes: ''
  });

  // Carregar graus de sessão e classificações ao montar o componente
  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
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
        texto: 'Erro ao carregar opções. Tente novamente.' 
      });
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
    setLoading(true);
    setMensagem({ tipo: '', texto: '' });

    try {
      // Validações
      if (!formData.data_sessao) {
        throw new Error('Data da sessão é obrigatória');
      }
      if (!formData.grau_sessao_id) {
        throw new Error('Tipo de sessão é obrigatório');
      }

      // Buscar ID do usuário logado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Buscar ID do irmão através do email
      const { data: usuario, error: erroUsuario } = await supabase
        .from('usuarios')
        .select('email')
        .eq('auth_user_id', user.id)
        .single();

      if (erroUsuario) throw erroUsuario;

      const { data: irmao, error: erroIrmao } = await supabase
        .from('irmaos')
        .select('id')
        .eq('email', usuario.email)
        .single();

      if (erroIrmao) throw erroIrmao;

      // Inserir a sessão
      const { data: sessao, error: erroSessao } = await supabase
        .from('sessoes_presenca')
        .insert([{
          data_sessao: formData.data_sessao,
          grau_sessao_id: parseInt(formData.grau_sessao_id),
          classificacao_id: formData.classificacao_id ? parseInt(formData.classificacao_id) : null,
          observacoes: formData.observacoes || null,
          registrado_por: irmao.id
        }])
        .select()
        .single();

      if (erroSessao) throw erroSessao;

      setMensagem({ 
        tipo: 'sucesso', 
        texto: 'Sessão cadastrada com sucesso! Redirecionando...' 
      });

      // Limpar formulário
      setFormData({
        data_sessao: '',
        grau_sessao_id: '',
        classificacao_id: '',
        observacoes: ''
      });

      // Redirecionar para registro de presença após 1.5 segundos
      setTimeout(() => {
        if (onSessaoCriada) {
          onSessaoCriada(sessao.id);
        }
      }, 1500);

    } catch (error) {
      console.error('Erro ao cadastrar sessão:', error);
      setMensagem({ 
        tipo: 'erro', 
        texto: error.message || 'Erro ao cadastrar sessão. Tente novamente.' 
      });
    } finally {
      setLoading(false);
    }
  };

  const grauSelecionado = grausSessao.find(g => g.id === parseInt(formData.grau_sessao_id));
  const exibirClassificacao = grauSelecionado && grauSelecionado.nome !== 'Sessão Administrativa';

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">
          Cadastrar Nova Sessão
        </h2>

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

          {/* Botões */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 py-3 px-4 rounded-md text-white font-medium ${
                loading 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700'
              } transition-colors`}
            >
              {loading ? 'Cadastrando...' : 'Cadastrar Sessão'}
            </button>
            
            <button
              type="button"
              onClick={() => window.history.back()}
              className="flex-1 py-3 px-4 border border-gray-300 rounded-md text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>

        {/* Informação adicional */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            <strong>Próximo passo:</strong> Após cadastrar a sessão, você será redirecionado automaticamente para a tela de registro de presença dos irmãos.
          </p>
        </div>
      </div>
    </div>
  );
}
