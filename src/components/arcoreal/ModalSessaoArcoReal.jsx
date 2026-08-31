import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

const CLASSIFICACOES = ['Econômica', 'Especial', 'Magna', 'Extraordinária'];

const inp = {
  width: '100%', padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-lg)',
  background: 'var(--color-surface-2)', color: 'var(--color-text)',
  border: '1px solid var(--color-border)', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box',
};
const lbl = {
  fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem', display: 'block',
};

// Modal de criar/editar sessão — usado pelo DashboardPresencaArcoReal.
// sessaoEditando = null → modo criação. sessaoEditando = objeto → modo edição.
export default function ModalSessaoArcoReal({ sessaoEditando, onFechar, onSalvo, showSuccess, showError }) {
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });
  const [form, setForm] = useState({ dataSessao: '', classificacao: '', observacoes: '' });

  useEffect(() => {
    if (sessaoEditando) {
      setForm({
        dataSessao: sessaoEditando.data_sessao,
        classificacao: sessaoEditando.classificacao || '',
        observacoes: sessaoEditando.observacoes || '',
      });
    } else {
      setForm({ dataSessao: '', classificacao: '', observacoes: '' });
    }
    setMensagem({ tipo: '', texto: '' });
  }, [sessaoEditando]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.dataSessao) { setMensagem({ tipo: 'erro', texto: 'Informe a data da sessão.' }); return; }
    setSalvando(true);
    try {
      const payload = {
        data_sessao: form.dataSessao,
        classificacao: form.classificacao || null,
        observacoes: form.observacoes || null,
      };
      if (sessaoEditando) {
        const { error } = await supabase.from('arco_real_sessoes').update(payload).eq('id', sessaoEditando.id).select();
        if (error) throw error;
      } else {
        const { error } = await supabase.from('arco_real_sessoes').insert([payload]);
        if (error) throw error;
      }
      showSuccess?.(sessaoEditando ? 'Sessão atualizada!' : 'Sessão cadastrada!');
      onSalvo?.();
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: err.message || 'Erro ao salvar sessão.' });
      showError?.('Erro ao salvar sessão.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div onClick={onFechar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.1rem 1.4rem', background: 'linear-gradient(135deg,#1e3a5f,#2d6a9f)' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: '#fff' }}>
              {sessaoEditando ? 'Editar Sessão' : 'Nova Sessão'}
            </h3>
            <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(255,255,255,0.75)' }}>Arco Real</p>
          </div>
          <button onClick={onFechar} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.3rem', cursor: 'pointer', padding: '0.2rem 0.5rem', lineHeight: 1 }}>✕</button>
        </div>

        {/* Corpo */}
        <form onSubmit={handleSubmit} style={{ padding: '1.4rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {mensagem.texto && (
            <div style={{ padding: '0.65rem 0.9rem', borderRadius: 'var(--radius-lg)', fontSize: '0.82rem', fontWeight: '600', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
              ❌ {mensagem.texto}
            </div>
          )}
          <div>
            <label style={lbl}>Data da Sessão *</label>
            <input type="date" required value={form.dataSessao} onChange={e => setForm(f => ({ ...f, dataSessao: e.target.value }))} style={inp} />
          </div>
          <div>
            <label style={lbl}>Classificação</label>
            <select value={form.classificacao} onChange={e => setForm(f => ({ ...f, classificacao: e.target.value }))} style={inp}>
              <option value="">Sem classificação</option>
              {CLASSIFICACOES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Observações</label>
            <textarea rows={3} placeholder="Observações opcionais..." value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} style={{ ...inp, resize: 'vertical', minHeight: '80px' }} />
          </div>
          <div style={{ display: 'flex', gap: '0.65rem', paddingTop: '0.25rem' }}>
            <button type="button" onClick={onFechar} style={{ flex: 1, height: '40px', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}>
              Cancelar
            </button>
            <button type="submit" disabled={salvando} style={{ flex: 2, height: '40px', background: salvando ? 'var(--color-surface-3)' : 'linear-gradient(135deg,#1e3a5f,#2d6a9f)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: '700', fontSize: '0.85rem', cursor: salvando ? 'not-allowed' : 'pointer' }}>
              {salvando ? 'Salvando...' : sessaoEditando ? '✏️ Atualizar Sessão' : '✅ Cadastrar Sessão'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
