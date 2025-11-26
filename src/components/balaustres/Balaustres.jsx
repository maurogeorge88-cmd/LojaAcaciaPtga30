import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { formatarData } from '../../utils/formatters';

const Balaustres = ({ 
  balaustres, 
  tiposSessao, 
  session,
  onUpdate, 
  showSuccess, 
  showError 
}) => {
  // Estados do formulário
  const [balaustreForm, setBalaustreForm] = useState({
    grau_sessao: 'Aprendiz',
    numero_balaustre: '',
    data_sessao: '',
    dia_semana: '',
    tipo_sessao_id: '',
    ordem_dia: '',
    observacoes: ''
  });

  // Estados de controle
  const [modoEdicao, setModoEdicao] = useState(false);
  const [balaustreEditando, setBalaustreEditando] = useState(null);
  const [loading, setLoading] = useState(false);
  const [grauSelecionado, setGrauSelecionado] = useState('Aprendiz');

  // Função para obter dia da semana
  const obterDiaSemana = (data) => {
    if (!data) return '';
    const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const date = new Date(data + 'T00:00:00');
    return dias[date.getDay()];
  };

  // Carregar próximo número de balaustre
  const carregarProximoNumero = async (grau) => {
    try {
      const { data, error } = await supabase
        .from('balaustres')
        .select('numero_balaustre')
        .eq('grau_sessao', grau)
        .order('numero_balaustre', { ascending: false })
        .limit(1);

      if (error) throw error;

      const proximoNumero = data && data.length > 0 ? data[0].numero_balaustre + 1 : 1;
      setBalaustreForm(prev => ({ ...prev, numero_balaustre: proximoNumero }));
    } catch (error) {
      console.error('Erro ao carregar próximo número:', error);
    }
  };

  // Atualizar dia da semana quando data mudar
  useEffect(() => {
    if (balaustreForm.data_sessao) {
      const diaSemana = obterDiaSemana(balaustreForm.data_sessao);
      setBalaustreForm(prev => ({ ...prev, dia_semana: diaSemana }));
    }
  }, [balaustreForm.data_sessao]);

  // Carregar próximo número quando grau mudar
  useEffect(() => {
    if (!modoEdicao) {
      carregarProximoNumero(balaustreForm.grau_sessao);
    }
  }, [balaustreForm.grau_sessao, modoEdicao]);

  // Carregar próximo número ao montar componente
  useEffect(() => {
    if (!modoEdicao) {
      carregarProximoNumero(grauSelecionado);
    }
  }, [grauSelecionado, modoEdicao]);

  // Limpar formulário
  const limparFormulario = () => {
    setBalaustreForm({
      grau_sessao: grauSelecionado,
      numero_balaustre: '',
      data_sessao: '',
      dia_semana: '',
      tipo_sessao_id: '',
      ordem_dia: '',
      observacoes: ''
    });
    setModoEdicao(false);
    setBalaustreEditando(null);
    carregarProximoNumero(grauSelecionado);
  };

  // Cadastrar balaustre
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('balaustres')
        .insert([{
          ...balaustreForm,
          created_by: session.user.id
        }])
        .select()
        .single();

      if (error) throw error;

      showSuccess('Balaustre cadastrado com sucesso!');
      onUpdate();
      limparFormulario();

    } catch (error) {
      showError('Erro ao salvar balaustre: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Atualizar balaustre
  const handleAtualizar = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('balaustres')
        .update(balaustreForm)
        .eq('id', balaustreEditando.id);

      if (error) throw error;

      showSuccess('Balaustre atualizado com sucesso!');
      onUpdate();
      limparFormulario();

    } catch (error) {
      showError('Erro ao atualizar balaustre: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Editar balaustre
  const handleEditar = (balaustre) => {
    setModoEdicao(true);
    setBalaustreEditando(balaustre);
    setBalaustreForm({
      grau_sessao: balaustre.grau_sessao,
      numero_balaustre: balaustre.numero_balaustre,
      data_sessao: balaustre.data_sessao,
      dia_semana: balaustre.dia_semana,
      tipo_sessao_id: balaustre.tipo_sessao_id,
      ordem_dia: balaustre.ordem_dia || '',
      observacoes: balaustre.observacoes || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Excluir balaustre
  const handleExcluir = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este balaustre?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('balaustres')
        .delete()
        .eq('id', id);

      if (error) throw error;

      showSuccess('Balaustre excluído com sucesso!');
      onUpdate();

    } catch (error) {
      showError('Erro ao excluir balaustre: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Obter nome do tipo de sessão
  const obterNomeTipoSessao = (tipoId) => {
    const tipo = tiposSessao.find(t => t.id === tipoId);
    return tipo ? tipo.nome : 'N/A';
  };

  // Filtrar balaustres por grau
  const balaustresFiltrados = balaustres.filter(b => b.grau_sessao === grauSelecionado);

  return (
    <div>
      {/* FORMULÁRIO */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <h3 className="text-xl font-bold text-blue-900 mb-4">
          {modoEdicao ? '✏️ Editar Balaustre' : '➕ Novo Balaustre'}
        </h3>

        <form onSubmit={modoEdicao ? handleAtualizar : handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Grau da Sessão */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Grau da Sessão *</label>
              <select
                value={balaustreForm.grau_sessao}
                onChange={(e) => setBalaustreForm({ ...balaustreForm, grau_sessao: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
              >
                <option value="Aprendiz">Aprendiz</option>
                <option value="Companheiro">Companheiro</option>
                <option value="Mestre">Mestre</option>
              </select>
            </div>

            {/* Número do Balaustre */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Número do Balaustre * 
                <span className="text-xs text-gray-500 ml-2">(editável)</span>
              </label>
              <input
                type="number"
                value={balaustreForm.numero_balaustre}
                onChange={(e) => setBalaustreForm({ ...balaustreForm, numero_balaustre: parseInt(e.target.value) || '' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
                min="1"
                placeholder="Número automático (pode alterar)"
              />
            </div>

            {/* Data da Sessão */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Data da Sessão *</label>
              <input
                type="date"
                value={balaustreForm.data_sessao}
                onChange={(e) => setBalaustreForm({ ...balaustreForm, data_sessao: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>

            {/* Dia da Semana */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Dia da Semana</label>
              <input
                type="text"
                value={balaustreForm.dia_semana}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 outline-none"
                readOnly
              />
            </div>

            {/* Tipo de Sessão */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Sessão *</label>
              <select
                value={balaustreForm.tipo_sessao_id}
                onChange={(e) => setBalaustreForm({ ...balaustreForm, tipo_sessao_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
              >
                <option value="">Selecione...</option>
                {tiposSessao.map(tipo => (
                  <option key={tipo.id} value={tipo.id}>{tipo.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Ordem do Dia e Observações */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Ordem do Dia</label>
              <textarea
                value={balaustreForm.ordem_dia}
                onChange={(e) => setBalaustreForm({ ...balaustreForm, ordem_dia: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                rows="4"
                placeholder="Descreva a ordem do dia da sessão..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
              <textarea
                value={balaustreForm.observacoes}
                onChange={(e) => setBalaustreForm({ ...balaustreForm, observacoes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                rows="4"
                placeholder="Observações adicionais..."
              />
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3 mt-6">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
            >
              {loading ? 'Salvando...' : (modoEdicao ? 'Atualizar Balaustre' : 'Cadastrar Balaustre')}
            </button>
            
            {modoEdicao && (
              <button
                type="button"
                onClick={limparFormulario}
                className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancelar Edição
              </button>
            )}
          </div>
        </form>
      </div>

      {/* FILTRO POR GRAU */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setGrauSelecionado('Aprendiz')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              grauSelecionado === 'Aprendiz'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Aprendiz ({balaustres.filter(b => b.grau_sessao === 'Aprendiz').length})
          </button>
          <button
            onClick={() => setGrauSelecionado('Companheiro')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              grauSelecionado === 'Companheiro'
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Companheiro ({balaustres.filter(b => b.grau_sessao === 'Companheiro').length})
          </button>
          <button
            onClick={() => setGrauSelecionado('Mestre')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              grauSelecionado === 'Mestre'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Mestre ({balaustres.filter(b => b.grau_sessao === 'Mestre').length})
          </button>
        </div>
      </div>

      {/* LISTAGEM */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-blue-900 text-white">
              <tr>
                <th className="px-4 py-3 text-left">Nº</th>
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3 text-left">Dia</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Ordem do Dia</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {balaustresFiltrados.length > 0 ? (
                balaustresFiltrados
                  .sort((a, b) => b.numero_balaustre - a.numero_balaustre)
                  .map((balaustre) => (
                    <tr key={balaustre.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold">{balaustre.numero_balaustre}</td>
                      <td className="px-4 py-3">{formatarData(balaustre.data_sessao)}</td>
                      <td className="px-4 py-3">{balaustre.dia_semana}</td>
                      <td className="px-4 py-3">{obterNomeTipoSessao(balaustre.tipo_sessao_id)}</td>
                      <td className="px-4 py-3">
                        <div className="max-w-xs truncate" title={balaustre.ordem_dia}>
                          {balaustre.ordem_dia || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => handleEditar(balaustre)}
                            className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors text-sm"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleExcluir(balaustre.id)}
                            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-sm"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
              ) : (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                    Nenhum balaustre cadastrado para o grau {grauSelecionado}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Balaustres;
