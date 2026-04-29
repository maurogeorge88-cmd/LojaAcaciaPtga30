import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

const TIPOS = {
  reuniao:  { label: 'Reunião',  icone: '👥' },
  trabalho: { label: 'Trabalho', icone: '🔨' },
  evento:   { label: 'Evento',   icone: '🎉' },
  visita:   { label: 'Visita',   icone: '🚶' },
  outro:    { label: 'Outro',    icone: '📋' },
};

const FORM_VAZIO = {
  tipo: 'reuniao',
  titulo: '',
  data_atividade: new Date().toISOString().split('T')[0],
  local: '',
  participantes: '',
  deliberacoes: '',
  observacoes: '',
};

const AtividadesComissao = ({ comissao, onClose, showSuccess, showError, permissoes }) => {
  const [atividades, setAtividades]         = useState([]);
  const [loading, setLoading]               = useState(false);
  const [modoEdicao, setModoEdicao]         = useState(false);
  const [atividadeEditando, setAtividadeEditando] = useState(null);
  const [form, setForm]                     = useState(FORM_VAZIO);

  const podeEditar = permissoes?.pode_gerenciar_usuarios ||
                     permissoes?.pode_editar_comissoes ||
                     comissao?.permissoesExpandidas?.eh_membro || false;

  useEffect(() => { carregarAtividades(); }, [comissao.id]);

  const carregarAtividades = async () => {
    try {
      const { data, error } = await supabase
        .from('atividades_comissoes')
        .select('*')
        .eq('comissao_id', comissao.id)
        .order('data_atividade', { ascending: false });
      if (error) throw error;
      setAtividades(data || []);
    } catch (e) {
      showError('Erro ao carregar atividades: ' + e.message);
    }
  };

  const limpar = () => {
    setForm(FORM_VAZIO);
    setModoEdicao(false);
    setAtividadeEditando(null);
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const dados = { comissao_id: comissao.id, ...form };
      if (modoEdicao) {
        const { error } = await supabase.from('atividades_comissoes').update(dados).eq('id', atividadeEditando.id);
        if (error) throw error;
        showSuccess('✅ Atividade atualizada!');
      } else {
        const { error } = await supabase.from('atividades_comissoes').insert([dados]);
        if (error) throw error;
        showSuccess('✅ Atividade cadastrada!');
      }
      carregarAtividades();
      limpar();
    } catch (e) {
      showError('Erro ao salvar: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditar = (a) => {
    setModoEdicao(true);
    setAtividadeEditando(a);
    setForm({ tipo: a.tipo, titulo: a.titulo, data_atividade: a.data_atividade, local: a.local || '', participantes: a.participantes || '', deliberacoes: a.deliberacoes || '', observacoes: a.observacoes || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExcluir = async (a) => {
    if (!window.confirm('Excluir esta atividade?')) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('atividades_comissoes').delete().eq('id', a.id);
      if (error) throw error;
      showSuccess('✅ Excluída!');
      carregarAtividades();
    } catch (e) {
      showError('Erro: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const fmtData = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '';

  const sInput = {
    background: 'var(--color-surface-2)',
    color: 'var(--color-text)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    width: '100%',
    outline: 'none',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem', overflowY: 'auto' }}>
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-xl)', width: '100%', maxWidth: '56rem', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid var(--color-border)' }}>

        {/* Header */}
        <div style={{ background: 'var(--color-accent)', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
          <div>
            <h2 style={{ color: '#fff', fontWeight: '800', fontSize: '1.25rem', margin: 0 }}>📋 Atividades da Comissão</h2>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>{comissao.nome}</p>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '50%', width: '2.25rem', height: '2.25rem', fontSize: '1.25rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1 }}>

          {/* Formulário */}
          {podeEditar && (
            <div style={{ background: 'var(--color-surface-2)', borderRadius: 'var(--radius-xl)', padding: '1.25rem', border: '1px solid var(--color-border)' }}>
              <h3 style={{ fontWeight: '700', color: 'var(--color-text)', fontSize: '1rem', margin: '0 0 1rem' }}>
                {modoEdicao ? '✏️ Editar Atividade' : '➕ Nova Atividade'}
              </h3>
              <form onSubmit={handleSalvar} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

                {/* Tipo, Título, Data */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Tipo *</label>
                    <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} style={sInput} required>
                      {Object.entries(TIPOS).map(([k, v]) => (
                        <option key={k} value={k}>{v.icone} {v.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Título *</label>
                    <input type="text" value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Reunião de Planejamento" style={sInput} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Data *</label>
                    <input type="date" value={form.data_atividade} onChange={e => setForm({ ...form, data_atividade: e.target.value })} style={sInput} required />
                  </div>
                </div>

                {/* Local, Participantes */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Local</label>
                    <input type="text" value={form.local} onChange={e => setForm({ ...form, local: e.target.value })} placeholder="Ex: Templo, Sala de Reuniões" style={sInput} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Participantes</label>
                    <input type="text" value={form.participantes} onChange={e => setForm({ ...form, participantes: e.target.value })} placeholder="Ex: 5 membros presentes" style={sInput} />
                  </div>
                </div>

                {/* Deliberações */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Deliberações / Decisões *</label>
                  <textarea value={form.deliberacoes} onChange={e => setForm({ ...form, deliberacoes: e.target.value })} rows={4} placeholder="Descreva o que foi deliberado, decidido ou realizado..." style={{ ...sInput, resize: 'vertical', fontFamily: 'inherit' }} required />
                </div>

                {/* Observações */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Observações</label>
                  <textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} rows={2} placeholder="Observações adicionais..." style={{ ...sInput, resize: 'vertical', fontFamily: 'inherit' }} />
                </div>

                {/* Botões */}
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  {modoEdicao && (
                    <button type="button" onClick={limpar} style={{ padding: '0.5rem 1.25rem', background: 'var(--color-surface-3)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontWeight: '600', cursor: 'pointer' }}>
                      Cancelar
                    </button>
                  )}
                  <button type="submit" disabled={loading} style={{ padding: '0.5rem 1.5rem', background: loading ? 'var(--color-surface-3)' : 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer' }}>
                    {loading ? 'Salvando...' : modoEdicao ? '💾 Atualizar' : '➕ Cadastrar'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Lista de atividades */}
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
            <div style={{ background: 'var(--color-surface-2)', padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--color-border)' }}>
              <h3 style={{ fontWeight: '700', color: 'var(--color-text)', margin: 0, fontSize: '0.95rem' }}>
                📚 Histórico de Atividades ({atividades.length})
              </h3>
            </div>
            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {atividades.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--color-text-muted)' }}>
                  <p style={{ fontSize: '1.25rem', margin: '0 0 0.5rem' }}>📭 Nenhuma atividade registrada</p>
                  <p style={{ fontSize: '0.875rem', margin: 0 }}>Cadastre a primeira atividade desta comissão!</p>
                </div>
              ) : atividades.map(a => (
                <div key={a.id} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1rem', background: 'var(--color-surface-2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                        <span style={{ fontSize: '1.25rem' }}>{TIPOS[a.tipo]?.icone || '📋'}</span>
                        <h4 style={{ fontWeight: '700', color: 'var(--color-text)', margin: 0, fontSize: '1rem' }}>{a.titulo}</h4>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                        <span>📅 {fmtData(a.data_atividade)}</span>
                        <span>🏷️ {TIPOS[a.tipo]?.label || a.tipo}</span>
                        {a.local && <span>📍 {a.local}</span>}
                        {a.participantes && <span>👥 {a.participantes}</span>}
                      </div>
                    </div>
                    {podeEditar && (
                      <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                        <button onClick={() => handleEditar(a)} style={{ padding: '0.3rem 0.6rem', background: 'var(--color-accent-bg)', color: 'var(--color-accent)', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.85rem' }}>✏️</button>
                        <button onClick={() => handleExcluir(a)} style={{ padding: '0.3rem 0.6rem', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.85rem' }}>🗑️</button>
                      </div>
                    )}
                  </div>
                  <div style={{ background: 'var(--color-accent-bg)', borderRadius: 'var(--radius-md)', padding: '0.75rem', marginBottom: a.observacoes ? '0.5rem' : 0 }}>
                    <p style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-accent)', marginBottom: '0.35rem' }}>📝 Deliberações:</p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-text)', margin: 0, whiteSpace: 'pre-wrap' }}>{a.deliberacoes}</p>
                  </div>
                  {a.observacoes && (
                    <div style={{ background: 'var(--color-surface-3)', borderRadius: 'var(--radius-md)', padding: '0.75rem' }}>
                      <p style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', marginBottom: '0.35rem' }}>💬 Observações:</p>
                      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0, whiteSpace: 'pre-wrap' }}>{a.observacoes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ background: 'var(--color-surface-2)', padding: '1rem 1.5rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '0.5rem 1.5rem', background: 'var(--color-surface-3)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontWeight: '600', cursor: 'pointer' }}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default AtividadesComissao;
