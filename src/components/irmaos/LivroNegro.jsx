import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { ehLiderancaLoja } from '../../config/permissoes';

const FORM_VAZIO = { nome: '', cim: '', loja: '', oriente: '', data_registro: '', observacoes: '' };
const tabelaAusente = (e) => /does not exist|schema cache|42P01|PGRST205/i.test(`${e?.code || ''} ${e?.message || ''}`);
const fmtD = (d) => (d ? String(d).substring(0, 10).split('-').reverse().join('/') : '—');
const sInp = { background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem', fontSize: '0.85rem', width: '100%', outline: 'none' };
const sLabel = { display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' };

// Cadastro do Livro Negro (irmãos expulsos). O quadro do Dashboard mostra nome e CIM a todos;
// aqui só a liderança (Admin, Venerável, Secretário e Orador) cadastra, edita e remove.
export default function LivroNegro({ userData, showSuccess, showError }) {
  const pode = ehLiderancaLoja(userData);
  const [lista, setLista] = useState([]);
  const [busca, setBusca] = useState('');
  const [semTabela, setSemTabela] = useState(false);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [editandoId, setEditandoId] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    const { data, error } = await supabase.from('livro_negro').select('*').order('nome');
    if (error) { if (tabelaAusente(error)) setSemTabela(true); else showError('Erro ao carregar: ' + error.message); return; }
    setSemTabela(false);
    setLista(data || []);
  };
  useEffect(() => { carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!pode) {
    return (
      <div className="p-10 text-center" style={{ color: 'var(--color-text-muted)' }}>
        <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔒</p>
        <p>Acesso restrito a Administrador, Venerável, Secretário e Orador.</p>
      </div>
    );
  }

  const abrir = (it = null) => {
    setEditandoId(it?.id || null);
    setForm(it ? { nome: it.nome || '', cim: it.cim || '', loja: it.loja || '', oriente: it.oriente || '', data_registro: it.data_registro || '', observacoes: it.observacoes || '' } : FORM_VAZIO);
    setModal(true);
  };

  const salvar = async () => {
    if (!form.nome.trim()) { showError('Informe o nome.'); return; }
    setSalvando(true);
    try {
      const payload = {
        nome: form.nome.trim(), cim: form.cim.trim() || null, loja: form.loja.trim() || null, oriente: form.oriente.trim() || null,
        data_registro: form.data_registro || null, observacoes: form.observacoes.trim() || null,
      };
      const q = editandoId
        ? supabase.from('livro_negro').update(payload).eq('id', editandoId).select()
        : supabase.from('livro_negro').insert({ ...payload, created_by: userData?.email || null }).select();
      const { data, error } = await q;
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('sem permissão para gravar.');
      showSuccess(editandoId ? '✅ Registro atualizado.' : '✅ Registro incluído.');
      setModal(false);
      carregar();
    } catch (e) {
      showError('Erro ao salvar: ' + e.message);
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (it) => {
    if (!window.confirm(`Remover "${it.nome}" do Livro Negro?`)) return;
    const { data, error } = await supabase.from('livro_negro').delete().eq('id', it.id).select();
    if (error || !data || data.length === 0) { showError('Erro ao remover' + (error ? ': ' + error.message : ' (sem permissão).')); return; }
    showSuccess('Registro removido.');
    carregar();
  };

  const t = busca.trim().toLowerCase();
  const visiveis = lista.filter(i => !t || [i.nome, i.cim, i.loja, i.oriente].some(v => String(v || '').toLowerCase().includes(t)));

  return (
    <div className="p-6" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>⬛ Livro Negro</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: '0.2rem 0 0' }}>Os registros aparecem no quadro do Dashboard (nome e CIM) para conhecimento de todos os irmãos.</p>
        </div>
        <button onClick={() => abrir()} style={{ padding: '0.55rem 1.2rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, cursor: 'pointer' }}>➕ Novo registro</button>
      </div>

      {semTabela && (
        <div style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 'var(--radius-md)', padding: '0.6rem 0.85rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#b45309' }}>
          ⚠️ Tabela ainda não criada. Rode o SQL <strong>livro_negro.sql</strong> no Supabase.
        </div>
      )}

      <input style={{ ...sInp, marginBottom: '0.75rem' }} placeholder="🔍 Buscar por nome, CIM, Loja ou Oriente..." value={busca} onChange={e => setBusca(e.target.value)} />

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
        {visiveis.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '1.5rem', margin: 0 }}>Nenhum registro.</p>
        ) : visiveis.map((it, i) => (
          <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', padding: '0.7rem 1rem', borderTop: i > 0 ? '1px solid var(--color-border)' : 'none', background: i % 2 ? 'var(--color-surface-2)' : 'transparent' }}>
            <div style={{ flex: '1 1 220px', minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 700, color: 'var(--color-text)', fontSize: '0.9rem' }}>{it.nome}</p>
              <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>{it.cim ? `CIM ${it.cim}` : 'CIM não informado'} · registrado em {fmtD(it.data_registro)}</p>
            </div>
            <div style={{ flex: '1 1 200px', fontSize: '0.82rem', color: 'var(--color-text)' }}>{it.loja || '—'}<br /><span style={{ color: 'var(--color-text-muted)', fontSize: '0.74rem' }}>{it.oriente || '—'}</span></div>
            <button onClick={() => abrir(it)} style={{ padding: '0.25rem 0.6rem', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.75rem' }}>✏️ Editar</button>
            <button onClick={() => excluir(it)} style={{ padding: '0.25rem 0.6rem', border: '1px solid rgba(239,68,68,0.4)', background: 'transparent', color: '#ef4444', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.75rem' }}>🗑️</button>
          </div>
        ))}
      </div>

      {modal && (
        <div onClick={() => setModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.5rem', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)' }}>{editandoId ? '✏️ Editar registro' : '➕ Novo registro'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ gridColumn: '1 / -1' }}><label style={sLabel}>Nome *</label><input style={sInp} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
              <div><label style={sLabel}>CIM</label><input style={sInp} value={form.cim} onChange={e => setForm(f => ({ ...f, cim: e.target.value }))} /></div>
              <div><label style={sLabel}>Data do registro</label><input type="date" style={sInp} value={form.data_registro} onChange={e => setForm(f => ({ ...f, data_registro: e.target.value }))} /></div>
              <div><label style={sLabel}>Loja</label><input style={sInp} value={form.loja} onChange={e => setForm(f => ({ ...f, loja: e.target.value }))} /></div>
              <div><label style={sLabel}>Oriente</label><input style={sInp} value={form.oriente} onChange={e => setForm(f => ({ ...f, oriente: e.target.value }))} /></div>
              <div style={{ gridColumn: '1 / -1' }}><label style={sLabel}>Observações (opcional)</label><textarea rows={3} style={{ ...sInp, fontFamily: 'inherit', resize: 'vertical' }} value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.2rem' }}>
              <button onClick={() => setModal(false)} style={{ padding: '0.5rem 1.1rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando} style={{ padding: '0.5rem 1.2rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, cursor: salvando ? 'not-allowed' : 'pointer' }}>{salvando ? '⏳ Salvando...' : '💾 Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
