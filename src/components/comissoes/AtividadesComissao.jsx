import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

/**
 * ATIVIDADES DE COMISSÕES
 * Registra reuniões, deliberações e atividades realizadas pelas comissões
 */

const AtividadesComissao = ({ comissao, onClose, showSuccess, showError, permissoes }) => {
  const [atividades, setAtividades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [atividadeEditando, setAtividadeEditando] = useState(null);

  // Verificar permissões: admin, pode_editar_comissoes OU é membro da comissão
  const podeEditar = permissoes?.eh_administrador || 
                     permissoes?.pode_editar_comissoes || 
                     comissao?.permissoesExpandidas?.eh_membro || 
                     false;

  const [atividadeForm, setAtividadeForm] = useState({
    tipo: 'reuniao',
    titulo: '',
    data_atividade: new Date().toISOString().split('T')[0],
    local: '',
    participantes: '',
    deliberacoes: '',
    observacoes: ''
  });

  useEffect(() => {
    carregarAtividades();
  }, [comissao.id]);

  const carregarAtividades = async () => {
    try {
      const { data, error } = await supabase
        .from('atividades_comissoes')
        .select('*')
        .eq('comissao_id', comissao.id)
        .order('data_atividade', { ascending: false });

      if (error) throw error;
      setAtividades(data || []);
    } catch (error) {
      console.error('Erro ao carregar atividades:', error);
      showError('Erro ao carregar atividades: ' + error.message);
    }
  };

  const limparFormulario = () => {
    setAtividadeForm({
      tipo: 'reuniao',
      titulo: '',
      data_atividade: new Date().toISOString().split('T')[0],
      local: '',
      participantes: '',
      deliberacoes: '',
      observacoes: ''
    });
    setModoEdicao(false);
    setAtividadeEditando(null);
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dados = {
        comissao_id: comissao.id,
        ...atividadeForm
      };

      if (modoEdicao) {
        const { error } = await supabase
          .from('atividades_comissoes')
          .update(dados)
          .eq('id', atividadeEditando.id);

        if (error) throw error;
        showSuccess('✅ Atividade atualizada com sucesso!');
      } else {
        const { error } = await supabase
          .from('atividades_comissoes')
          .insert([dados]);

        if (error) throw error;
        showSuccess('✅ Atividade cadastrada com sucesso!');
      }

      carregarAtividades();
      limparFormulario();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      showError('Erro ao salvar atividade: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditar = (atividade) => {
    setModoEdicao(true);
    setAtividadeEditando(atividade);
    setAtividadeForm({
      tipo: atividade.tipo,
      titulo: atividade.titulo,
      data_atividade: atividade.data_atividade,
      local: atividade.local || '',
      participantes: atividade.participantes || '',
      deliberacoes: atividade.deliberacoes || '',
      observacoes: atividade.observacoes || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExcluir = async (atividade) => {
    if (typeof window !== 'undefined' && !window.confirm('❗ Tem certeza que deseja excluir esta atividade?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('atividades_comissoes')
        .delete()
        .eq('id', atividade.id);

      if (error) throw error;

      showSuccess('✅ Atividade excluída com sucesso!');
      carregarAtividades();
    } catch (error) {
      console.error('Erro ao excluir:', error);
      showError('Erro ao excluir atividade: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatarData = (data) => {
    if (!data) return '';
    return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
  };

  const obterIconeTipo = (tipo) => {
    const icones = {
      reuniao: '👥',
      trabalho: '🔨',
      evento: '🎉',
      visita: '🚶',
      outro: '📋'
    };
    return icones[tipo] || '📋';
  };

  const obterNomeTipo = (tipo) => {
    const nomes = {
      reuniao: 'Reunião',
      trabalho: 'Trabalho',
      evento: 'Evento',
      visita: 'Visita',
      outro: 'Outro'
    };
    return nomes[tipo] || tipo;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-blue-900 text-white p-6 rounded-t-xl sticky top-0 z-10">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">📋 Atividades da Comissão</h2>
              <p className="text-blue-200 text-sm mt-1">{comissao.nome}</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-red-300 text-3xl font-bold"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* FORMULÁRIO */}
          {podeEditar && (
            <div className="bg-gray-50 rounded-lg p-6 border-2 border-gray-200">
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                {modoEdicao ? '✏️ Editar Atividade' : '➕ Nova Atividade'}
              </h3>

              <form onSubmit={handleSalvar} className="space-y-4">
                {/* Linha 1: Tipo, Título, Data */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                    <select
                      value={atividadeForm.tipo}
                      onChange={(e) => setAtividadeForm({ ...atividadeForm, tipo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    >
                      <option value="reuniao">👥 Reunião</option>
                      <option value="trabalho">🔨 Trabalho</option>
                      <option value="evento">🎉 Evento</option>
                      <option value="visita">🚶 Visita</option>
                      <option value="outro">📋 Outro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
                    <input
                      type="text"
                      value={atividadeForm.titulo}
                      onChange={(e) => setAtividadeForm({ ...atividadeForm, titulo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Ex: Reunião de Planejamento"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
                    <input
                      type="date"
                      value={atividadeForm.data_atividade}
                      onChange={(e) => setAtividadeForm({ ...atividadeForm, data_atividade: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    />
                  </div>
                </div>

                {/* Linha 2: Local, Participantes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Local</label>
                    <input
                      type="text"
                      value={atividadeForm.local}
                      onChange={(e) => setAtividadeForm({ ...atividadeForm, local: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Ex: Templo, Sala de Reuniões"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Participantes</label>
                    <input
                      type="text"
                      value={atividadeForm.participantes}
                      onChange={(e) => setAtividadeForm({ ...atividadeForm, participantes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Ex: 5 membros presentes"
                    />
                  </div>
                </div>

                {/* Linha 3: Deliberações */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deliberações / Decisões *</label>
                  <textarea
                    value={atividadeForm.deliberacoes}
                    onChange={(e) => setAtividadeForm({ ...atividadeForm, deliberacoes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    rows="4"
                    placeholder="Descreva o que foi deliberado, decidido ou realizado..."
                    required
                  />
                </div>

                {/* Linha 4: Observações */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                  <textarea
                    value={atividadeForm.observacoes}
                    onChange={(e) => setAtividadeForm({ ...atividadeForm, observacoes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    rows="2"
                    placeholder="Observações adicionais..."
                  />
                </div>

                {/* Botões */}
                <div className="flex gap-3 justify-end">
                  {modoEdicao && (
                    <button
                      type="button"
                      onClick={limparFormulario}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition"
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
                  >
                    {loading ? 'Salvando...' : (modoEdicao ? '💾 Atualizar' : '➕ Cadastrar')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* LISTA DE ATIVIDADES */}
          <div className="bg-white rounded-lg border-2 border-gray-200">
            <div className="bg-gray-50 px-6 py-3 border-b-2 border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">
                📚 Histórico de Atividades ({atividades.length})
              </h3>
            </div>

            <div className="p-6">
              {atividades.length > 0 ? (
                <div className="space-y-4">
                  {atividades.map((atividade) => (
                    <div
                      key={atividade.id}
                      className="border-2 border-gray-200 rounded-lg p-4 hover:border-blue-300 transition"
                    >
                      {/* Header da Atividade */}
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-2xl">{obterIconeTipo(atividade.tipo)}</span>
                            <h4 className="text-lg font-bold text-gray-800">{atividade.titulo}</h4>
                          </div>
                          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                            <span>📅 {formatarData(atividade.data_atividade)}</span>
                            <span>🏷️ {obterNomeTipo(atividade.tipo)}</span>
                            {atividade.local && <span>📍 {atividade.local}</span>}
                            {atividade.participantes && <span>👥 {atividade.participantes}</span>}
                          </div>
                        </div>

                        {podeEditar && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditar(atividade)}
                              className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleExcluir(atividade)}
                              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                            >
                              🗑️
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Deliberações */}
                      <div className="bg-blue-50 rounded p-3 mb-2">
                        <p className="text-xs font-bold text-blue-900 mb-1">📝 Deliberações:</p>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{atividade.deliberacoes}</p>
                      </div>

                      {/* Observações */}
                      {atividade.observacoes && (
                        <div className="bg-gray-50 rounded p-3">
                          <p className="text-xs font-bold text-gray-700 mb-1">💬 Observações:</p>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">{atividade.observacoes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-lg mb-2">📭 Nenhuma atividade registrada</p>
                  <p className="text-sm">Cadastre a primeira atividade desta comissão!</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-xl flex justify-end sticky bottom-0">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-semibold"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default AtividadesComissao;
