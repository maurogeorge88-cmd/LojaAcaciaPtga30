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
  const podeEditar = permissoes?.pode_gerenciar_usuarios || 
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
      <div className="rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>>
        {/* Header */}
        <div className="bg-blue-900 text-white p-6 rounded-t-xl sticky top-0 z-10">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold" style={{color:"var(--color-text)"}}>📋 Atividades da Comissão</h2>
              <p className="text-blue-200 text-sm mt-1" style={{color:"var(--color-text-muted)"}}>{comissao.nome}</p>
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
            <div className="rounded-lg p-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
              <h3 className="text-lg font-bold mb-4" style={{color:"var(--color-text)"}}>
                {modoEdicao ? '✏️ Editar Atividade' : '➕ Nova Atividade'}
              </h3>

              <form onSubmit={handleSalvar} className="space-y-4">
                {/* Linha 1: Tipo, Título, Data */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Tipo *</label>
                    <select
                      value={atividadeForm.tipo}
                      onChange={(e) => setAtividadeForm({ ...atividadeForm, tipo: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
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
                    <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Título *</label>
                    <input
                      type="text"
                      value={atividadeForm.titulo}
                      onChange={(e) => setAtividadeForm({ ...atividadeForm, titulo: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
                      placeholder="Ex: Reunião de Planejamento"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Data *</label>
                    <input
                      type="date"
                      value={atividadeForm.data_atividade}
                      onChange={(e) => setAtividadeForm({ ...atividadeForm, data_atividade: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
                      required
                    />
                  </div>
                </div>

                {/* Linha 2: Local, Participantes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Local</label>
                    <input
                      type="text"
                      value={atividadeForm.local}
                      onChange={(e) => setAtividadeForm({ ...atividadeForm, local: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
                      placeholder="Ex: Templo, Sala de Reuniões"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Participantes</label>
                    <input
                      type="text"
                      value={atividadeForm.participantes}
                      onChange={(e) => setAtividadeForm({ ...atividadeForm, participantes: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
                      placeholder="Ex: 5 membros presentes"
                    />
                  </div>
                </div>

                {/* Linha 3: Deliberações */}
                <div>
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Deliberações / Decisões *</label>
                  <textarea
                    value={atividadeForm.deliberacoes}
                    onChange={(e) => setAtividadeForm({ ...atividadeForm, deliberacoes: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
                    rows="4"
                    placeholder="Descreva o que foi deliberado, decidido ou realizado..."
                    required
                  />
                </div>

                {/* Linha 4: Observações */}
                <div>
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Observações</label>
                  <textarea
                    value={atividadeForm.observacoes}
                    onChange={(e) => setAtividadeForm({ ...atividadeForm, observacoes: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
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
                      className="px-4 py-2 rounded-lg transition" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition disabled:opacity-50"
                  >
                    {loading ? 'Salvando...' : (modoEdicao ? '💾 Atualizar' : '➕ Cadastrar')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* LISTA DE ATIVIDADES */}
          <div className="rounded-lg" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <div className="px-6 py-3 -b-2" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}>
              <h3 className="text-lg font-bold" style={{color:"var(--color-text)"}}>
                📚 Histórico de Atividades ({atividades.length})
              </h3>
            </div>

            <div className="p-6">
              {atividades.length > 0 ? (
                <div className="space-y-4">
                  {atividades.map((atividade) => (
                    <div
                      key={atividade.id}
                      className="rounded-lg p-4 hover:border-blue-300 transition" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}
                    >
                      {/* Header da Atividade */}
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-2xl">{obterIconeTipo(atividade.tipo)}</span>
                            <h4 className="text-lg font-bold">{atividade.titulo}</h4>
                          </div>
                          <div className="flex flex-wrap gap-4 text-sm">
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
                      <div className="rounded p-3 mb-2" style={{background:"var(--color-accent-bg)",border:"1px solid var(--color-border)"}}>
                        <p className="text-xs font-bold mb-1" style={{color:"var(--color-accent)"}}>📝 Deliberações:</p>
                        <p className="text-sm whitespace-pre-wrap" style={{color:"var(--color-text)"}}>{atividade.deliberacoes}</p>
                      </div>

                      {/* Observações */}
                      {atividade.observacoes && (
                        <div className="rounded p-3" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}>
                          <p className="text-xs font-bold mb-1" style={{color:"var(--color-text-muted)"}}>💬 Observações:</p>
                          <p className="text-sm whitespace-pre-wrap" style={{color:"var(--color-text)"}}>{atividade.observacoes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-lg mb-2">📭 Nenhuma atividade registrada</p>
                  <p className="text-sm">Cadastre a primeira atividade desta comissão!</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 rounded-b-xl flex justify-end sticky bottom-0">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg font-semibold" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default AtividadesComissao;
