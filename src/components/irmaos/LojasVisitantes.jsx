import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';

// ════════════════════════════════════════════════════════════════════════
// LOJAS VISITANTES — cadastro único das Lojas que nos visitam.
// O banco recusa nome repetido (compara sem acento, pontuação ou prefixo),
// então a mesma Loja não entra duas vezes com grafias diferentes.
// ════════════════════════════════════════════════════════════════════════

export const nomeCompletoLoja = (l) =>
  l ? `${l.prefixo || 'ARLS'} ${l.nome}${l.oriente ? ` – Oriente de ${l.oriente}` : ''}` : '';

const VAZIO = { prefixo: 'ARLS', nome: '', oriente: '', ativa: true };
const lab = { fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' };
const inp = { width: '100%', padding: '0.55rem 0.8rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' };

export default function LojasVisitantes({ showSuccess, showError, permissoes }) {
  const [lojas, setLojas] = useState([]);
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState(VAZIO);
  const [editando, setEditando] = useState(null);
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const podeEditar = permissoes?.pode_editar_presenca !== false;

  const carregar = async () => {
    const { data, error } = await supabase.from('lojas_visitantes').select('*').order('nome');
    if (error) { showError?.('Erro ao carregar as Lojas: ' + error.message); return; }
    setLojas(data || []);
  };
  useEffect(() => { carregar(); }, []);

  const abrirNova = () => { setForm(VAZIO); setEditando(null); setModal(true); };
  const abrirEdicao = (l) => { setForm({ prefixo: l.prefixo || 'ARLS', nome: l.nome, oriente: l.oriente, ativa: l.ativa }); setEditando(l); setModal(true); };

  const salvar = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { prefixo: (form.prefixo || 'ARLS').trim(), nome: form.nome.trim(), oriente: form.oriente.trim(), ativa: form.ativa };
      const { data, error } = editando
        ? await supabase.from('lojas_visitantes').update(payload).eq('id', editando.id).select()
        : await supabase.from('lojas_visitantes').insert([payload]).select();
      if (error) throw error;
      if (!data?.length) throw new Error('o banco não permitiu a gravação (sem permissão).');
      showSuccess?.(editando ? 'Loja atualizada!' : 'Loja cadastrada!');
      setModal(false);
      carregar();
    } catch (err) {
      const dup = err?.code === '23505' || /duplicate|unique/i.test(err?.message || '');
      showError?.(dup ? 'Esta Loja já está cadastrada (mesmo nome e oriente).' : 'Erro ao salvar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const alternarAtiva = async (l) => {
    const { error } = await supabase.from('lojas_visitantes').update({ ativa: !l.ativa }).eq('id', l.id);
    if (error) { showError?.('Erro: ' + error.message); return; }
    carregar();
  };

  const t = busca.trim().toLowerCase();
  const filtradas = lojas.filter(l => !t || `${l.nome} ${l.oriente}`.toLowerCase().includes(t));

  return (
    <div style={{ padding: '0.5rem', maxWidth: '1000px', margin: '0 auto' }}>

      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.9rem' }}>
        <input type="text" placeholder="🔍 Buscar Loja ou oriente..." value={busca} onChange={e => setBusca(e.target.value)}
          style={{ ...inp, flex: 1, minWidth: '220px', width: 'auto' }} />
        {podeEditar && (
          <button type="button" onClick={abrirNova}
            style={{ padding: '0.55rem 1rem', borderRadius: 'var(--radius-lg)', border: 'none', background: 'var(--color-accent)', color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
            ➕ Nova Loja
          </button>
        )}
      </div>

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ padding: '0.6rem 1rem', background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)' }}>
          {filtradas.length} Loja(s) cadastrada(s)
        </div>
        {filtradas.length === 0 && (
          <p style={{ padding: '1rem', margin: 0, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            Nenhuma Loja encontrada.
          </p>
        )}
        {filtradas.map((l, i) => (
          <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1rem', borderTop: i ? '1px solid var(--color-border)' : 'none', opacity: l.ativa ? 1 : 0.55 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)' }}>{nomeCompletoLoja(l)}</p>
              {!l.ativa && <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Inativa</span>}
            </div>
            {podeEditar && (<>
              <button type="button" onClick={() => abrirEdicao(l)} title="Editar"
                style={{ padding: '0.3rem 0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-accent)', background: 'transparent', color: 'var(--color-accent)', cursor: 'pointer' }}>✏️</button>
              <button type="button" onClick={() => alternarAtiva(l)} title={l.ativa ? 'Desativar' : 'Reativar'}
                style={{ padding: '0.3rem 0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                {l.ativa ? '🚫' : '↩️'}
              </button>
            </>)}
          </div>
        ))}
      </div>

      {modal && (
        <div onClick={() => setModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <form onClick={e => e.stopPropagation()} onSubmit={salvar}
            style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)', width: '100%', maxWidth: '520px', padding: '1.25rem' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)' }}>
              {editando ? 'Editar Loja' : 'Nova Loja'}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <label style={lab}>Prefixo</label>
                <input type="text" value={form.prefixo} onChange={e => setForm({ ...form, prefixo: e.target.value })} style={inp} />
              </div>
              <div>
                <label style={lab}>Nome da Loja *</label>
                <input type="text" required placeholder="Ex.: Acácia de Paranatinga nº 30"
                  value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} style={inp} />
              </div>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={lab}>Oriente (cidade) *</label>
              <input type="text" required placeholder="Ex.: Paranatinga-MT"
                value={form.oriente} onChange={e => setForm({ ...form, oriente: e.target.value })} style={inp} />
            </div>
            <p style={{ margin: '0 0 1rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Ficará assim: <strong>{nomeCompletoLoja({ ...form, nome: form.nome || '[nome]', oriente: form.oriente })}</strong>
            </p>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button type="button" onClick={() => setModal(false)}
                style={{ flex: 1, height: '38px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text)', fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
              <button type="submit" disabled={loading}
                style={{ flex: 2, height: '38px', borderRadius: 'var(--radius-lg)', border: 'none', background: loading ? 'var(--color-surface-3)' : 'var(--color-accent)', color: '#fff', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
                {loading ? 'Salvando...' : editando ? 'Atualizar' : 'Cadastrar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
