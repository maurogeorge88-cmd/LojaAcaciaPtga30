import { useState } from 'react';

const inputStyle = { width: '100%', padding: '0.5rem 0.75rem', background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' };
const labelStyle = { display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.03em' };
const boxCard = { background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', overflow: 'hidden' };
const btn = { padding: '0.5rem 1rem', background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: '600', fontSize: '0.82rem' };

const Faixa = ({ children }) => (
  <div style={{ background: 'linear-gradient(135deg,#1e3a5f,#2d6a9f)', margin: '-1.25rem -1.25rem 0.85rem -1.25rem', padding: '0.55rem 1.25rem' }}>
    <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{children}</span>
  </div>
);

const FILHO_VAZIO = { nome: '', data_nascimento: '', sexo: 'M', tipo_vinculo: 'filho', vivo: true, data_obito: '' };
const fmt = (d) => (d ? d.split('-').reverse().join('/') : '');

// Formulário controlado: value = { temConjuge, conjuge, pais, filhos }
export default function FamiliaresArcoReal({ value, onChange, showError }) {
  const [filhoForm, setFilhoForm] = useState(FILHO_VAZIO);
  const [editIdx, setEditIdx] = useState(null);

  const set = (patch) => onChange({ ...value, ...patch });
  const setConj = (patch) => set({ conjuge: { ...value.conjuge, ...patch } });
  const setPais = (patch) => set({ pais: { ...value.pais, ...patch } });

  const salvarFilho = () => {
    if (!filhoForm.nome.trim()) { showError && showError('Preencha o nome do filho'); return; }
    const lista = [...value.filhos];
    if (editIdx !== null) lista[editIdx] = { ...filhoForm }; else lista.push({ ...filhoForm });
    set({ filhos: lista });
    setFilhoForm(FILHO_VAZIO); setEditIdx(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.3)', borderRadius: 'var(--radius-md)', padding: '0.6rem 0.85rem', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
        🎉 As datas de nascimento e casamento dos familiares são usadas para as felicitações.
      </div>

      {/* Cônjuge */}
      <div style={boxCard}>
        <Faixa>💍 Cônjuge</Faixa>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--color-text)', marginBottom: '0.75rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={value.temConjuge} onChange={e => set({ temConjuge: e.target.checked })} />
          Possui cônjuge
        </label>
        {value.temConjuge && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2"><label style={labelStyle}>Nome</label><input value={value.conjuge.nome} onChange={e => setConj({ nome: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>CPF</label><input value={value.conjuge.cpf} onChange={e => setConj({ cpf: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Profissão</label><input value={value.conjuge.profissao} onChange={e => setConj({ profissao: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Data de Nascimento</label><input type="date" value={value.conjuge.data_nascimento} onChange={e => setConj({ data_nascimento: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Data de Casamento</label><input type="date" value={value.conjuge.data_casamento} onChange={e => setConj({ data_casamento: e.target.value })} style={inputStyle} /></div>
            <div className="md:col-span-2"><label style={labelStyle}>E-mail</label><input type="email" value={value.conjuge.email} onChange={e => setConj({ email: e.target.value })} style={inputStyle} /></div>
          </div>
        )}
      </div>

      {/* Pais */}
      <div style={boxCard}>
        <Faixa>👨‍👩 Pais</Faixa>
        {[
          { k: 'pai', titulo: 'Pai', nome: 'nome_pai', vivo: 'pai_vivo', nasc: 'data_nascimento_pai', obito: 'data_obito_pai' },
          { k: 'mae', titulo: 'Mãe', nome: 'nome_mae', vivo: 'mae_viva', nasc: 'data_nascimento_mae', obito: 'data_obito_mae' },
        ].map(p => (
          <div key={p.k} className="grid grid-cols-1 md:grid-cols-4 gap-4" style={{ marginBottom: '0.85rem' }}>
            <div className="md:col-span-2"><label style={labelStyle}>{p.titulo}</label><input value={value.pais[p.nome]} onChange={e => setPais({ [p.nome]: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Nascimento</label><input type="date" value={value.pais[p.nasc]} onChange={e => setPais({ [p.nasc]: e.target.value })} style={inputStyle} /></div>
            <div>
              <label style={labelStyle}>Situação</label>
              <select value={value.pais[p.vivo] ? 'vivo' : 'falecido'} onChange={e => setPais({ [p.vivo]: e.target.value === 'vivo' })} style={inputStyle}>
                <option value="vivo">{p.k === 'mae' ? 'Viva' : 'Vivo'}</option>
                <option value="falecido">{p.k === 'mae' ? 'Falecida' : 'Falecido'}</option>
              </select>
              {!value.pais[p.vivo] && <input type="date" title="Data do óbito" value={value.pais[p.obito]} onChange={e => setPais({ [p.obito]: e.target.value })} style={{ ...inputStyle, marginTop: '0.4rem' }} />}
            </div>
          </div>
        ))}
      </div>

      {/* Filhos */}
      <div style={boxCard}>
        <Faixa>👶 Filhos</Faixa>
        {value.filhos.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
            {value.filhos.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}>
                  <strong>{f.nome}</strong>
                  <span style={{ color: 'var(--color-text-muted)' }}> · {f.sexo === 'F' ? 'Filha' : 'Filho'}{f.data_nascimento ? ` · ${fmt(f.data_nascimento)}` : ''}{f.vivo === false ? ' · falecido(a)' : ''}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button type="button" style={btn} onClick={() => { setFilhoForm({ ...f }); setEditIdx(i); }}>✏️</button>
                  <button type="button" style={btn} onClick={() => { set({ filhos: value.filhos.filter((_, j) => j !== i) }); if (editIdx === i) { setEditIdx(null); setFilhoForm(FILHO_VAZIO); } }}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2"><label style={labelStyle}>Nome</label><input value={filhoForm.nome} onChange={e => setFilhoForm(f => ({ ...f, nome: e.target.value }))} style={inputStyle} /></div>
          <div><label style={labelStyle}>Nascimento</label><input type="date" value={filhoForm.data_nascimento} onChange={e => setFilhoForm(f => ({ ...f, data_nascimento: e.target.value }))} style={inputStyle} /></div>
          <div>
            <label style={labelStyle}>Sexo</label>
            <select value={filhoForm.sexo} onChange={e => setFilhoForm(f => ({ ...f, sexo: e.target.value, tipo_vinculo: e.target.value === 'F' ? 'filha' : 'filho' }))} style={inputStyle}>
              <option value="M">Masculino</option><option value="F">Feminino</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Situação</label>
            <select value={filhoForm.vivo ? 'vivo' : 'falecido'} onChange={e => setFilhoForm(f => ({ ...f, vivo: e.target.value === 'vivo' }))} style={inputStyle}>
              <option value="vivo">Vivo(a)</option><option value="falecido">Falecido(a)</option>
            </select>
          </div>
          {!filhoForm.vivo && <div><label style={labelStyle}>Data do óbito</label><input type="date" value={filhoForm.data_obito} onChange={e => setFilhoForm(f => ({ ...f, data_obito: e.target.value }))} style={inputStyle} /></div>}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.85rem' }}>
          <button type="button" onClick={salvarFilho} style={{ ...btn, background: 'var(--color-accent)', color: '#fff', border: 'none' }}>{editIdx !== null ? '💾 Atualizar filho' : '➕ Adicionar filho'}</button>
          {editIdx !== null && <button type="button" style={btn} onClick={() => { setEditIdx(null); setFilhoForm(FILHO_VAZIO); }}>Cancelar</button>}
        </div>
      </div>
    </div>
  );
}
