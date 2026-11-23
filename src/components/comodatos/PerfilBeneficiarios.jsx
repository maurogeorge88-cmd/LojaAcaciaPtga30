import React from 'react';

// Quadros informativos: gênero e faixa etária (um quadro por gênero) — todos os beneficiários cadastrados
const FAIXAS = [
  { rot: '0–20', min: 0, max: 20 },
  { rot: '21–30', min: 21, max: 30 },
  { rot: '31–40', min: 31, max: 40 },
  { rot: '41–50', min: 41, max: 50 },
  { rot: '51–60', min: 51, max: 60 },
  { rot: '61–69', min: 61, max: 69 },
  { rot: '70+', min: 70, max: 200 },
];
const COR_M = '#60a5fa';
const COR_F = '#f472b6';
const ALTURA = 96; // altura útil das colunas (px)

const idadeDe = (d) => {
  if (!d) return null;
  const n = new Date(String(d).substring(0, 10) + 'T00:00:00');
  if (isNaN(n)) return null;
  const h = new Date();
  let i = h.getFullYear() - n.getFullYear();
  const m = h.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && h.getDate() < n.getDate())) i--;
  return i >= 0 ? i : null;
};

const caixa = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' };
const cab = { padding: '0.45rem 1rem', background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)', fontSize: '0.76rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', display: 'flex', justifyContent: 'space-between', gap: '0.5rem' };

function Colunas({ dados, cor, max }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: ALTURA + 38, padding: '0.6rem 1rem 0.5rem', borderBottom: '1px dashed var(--color-border)' }}>
      {dados.map(d => (
        <div key={d.rot} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 2 }}>{d.v}</span>
          <div style={{ width: '100%', maxWidth: 44, height: d.v ? Math.max(4, (d.v / max) * ALTURA) : 2, background: cor, borderRadius: '4px 4px 0 0', opacity: d.v ? 1 : 0.3 }} />
          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 4, whiteSpace: 'nowrap' }}>{d.rot}</span>
        </div>
      ))}
    </div>
  );
}

export default function PerfilBeneficiarios({ beneficiarios = [] }) {
  const total = beneficiarios.length;
  const m = beneficiarios.filter(b => b.sexo === 'M');
  const f = beneficiarios.filter(b => b.sexo === 'F');
  const sem = total - m.length - f.length;
  const pct = (v) => (total ? Math.round((v / total) * 100) : 0);

  const serie = (lista) => FAIXAS.map(fx => ({
    rot: fx.rot,
    v: lista.filter(b => { const i = idadeDe(b.data_nascimento); return i !== null && i >= fx.min && i <= fx.max; }).length,
  }));
  const sm = serie(m), sf = serie(f);
  const max = Math.max(1, ...sm.map(x => x.v), ...sf.map(x => x.v));
  const semDataDe = (l) => l.filter(b => idadeDe(b.data_nascimento) === null).length;

  const Gen = ({ rot, v, cor }) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', padding: '0.35rem 1rem', borderLeft: `4px solid ${cor}` }}>
      <span style={{ fontSize: '1.6rem', fontWeight: 800, color: cor, lineHeight: 1 }}>{v}</span>
      <span style={{ fontSize: '0.8rem', color: 'var(--color-text)' }}>{rot} <span style={{ color: 'var(--color-text-muted)' }}>({pct(v)}%)</span></span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Gênero — faixa compacta */}
      <div style={{ ...caixa, padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
          <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1 }}>{total}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>beneficiários</span>
        </div>
        <Gen rot="Masculino" v={m.length} cor={COR_M} />
        <Gen rot="Feminino" v={f.length} cor={COR_F} />
        {sem > 0 && <span style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>{sem} sem gênero informado</span>}
        <div style={{ flex: 1, minWidth: '8rem', display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', background: 'var(--color-surface-2)' }}>
          <div style={{ width: `${pct(m.length)}%`, background: COR_M }} />
          <div style={{ width: `${pct(f.length)}%`, background: COR_F }} />
        </div>
      </div>

      {/* Faixa etária — um quadro por gênero */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: '0.75rem' }}>
        <div style={caixa}>
          <div style={cab}><span>♂ Faixa etária — Masculino</span><span>{m.length}</span></div>
          <Colunas dados={sm} cor={COR_M} max={max} />
          {semDataDe(m) > 0 && <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', padding: '0.3rem 1rem' }}>{semDataDe(m)} sem data de nascimento</div>}
        </div>
        <div style={caixa}>
          <div style={cab}><span>♀ Faixa etária — Feminino</span><span>{f.length}</span></div>
          <Colunas dados={sf} cor={COR_F} max={max} />
          {semDataDe(f) > 0 && <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', padding: '0.3rem 1rem' }}>{semDataDe(f)} sem data de nascimento</div>}
        </div>
      </div>
    </div>
  );
}
