import React from 'react';

// Quadros informativos: gênero e faixa etária por gênero (todos os beneficiários cadastrados)
const FAIXAS = [
  { rot: '0 a 20 anos', min: 0, max: 20 },
  { rot: '21 a 40 anos', min: 21, max: 40 },
  { rot: '41 a 60 anos', min: 41, max: 60 },
  { rot: '61 a 80 anos', min: 61, max: 80 },
  { rot: '81 anos ou mais', min: 81, max: 200 },
];
const COR_M = '#3b82f6';
const COR_F = '#ec4899';

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
const cab = { padding: '0.6rem 1rem', background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' };

export default function PerfilBeneficiarios({ beneficiarios = [] }) {
  const total = beneficiarios.length;
  const conta = (sx) => beneficiarios.filter(b => b.sexo === sx).length;
  const m = conta('M'), f = conta('F'), sem = total - m - f;
  const pct = (v) => (total ? Math.round((v / total) * 100) : 0);

  const linhas = FAIXAS.map(fx => {
    const nela = beneficiarios.filter(b => { const i = idadeDe(b.data_nascimento); return i !== null && i >= fx.min && i <= fx.max; });
    return { ...fx, m: nela.filter(b => b.sexo === 'M').length, f: nela.filter(b => b.sexo === 'F').length, s: nela.filter(b => b.sexo !== 'M' && b.sexo !== 'F').length };
  });
  const semData = beneficiarios.filter(b => idadeDe(b.data_nascimento) === null);
  const maxCel = Math.max(1, ...linhas.map(l => Math.max(l.m, l.f)));

  const Bloco = ({ rot, v, cor, icone }) => (
    <div style={{ flex: 1, minWidth: '9rem', border: `1px solid ${cor}66`, borderTop: `4px solid ${cor}`, borderRadius: 'var(--radius-lg)', padding: '0.8rem 1rem', textAlign: 'center' }}>
      <div style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{icone} {rot}</div>
      <div style={{ fontSize: '2.2rem', fontWeight: 800, color: cor, lineHeight: 1.1 }}>{v}</div>
      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{pct(v)}% do total</div>
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: '1rem' }}>
      {/* Quadro 1 — Gênero */}
      <div style={caixa}>
        <div style={cab}>Beneficiários por gênero</div>
        <div style={{ padding: '1rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '0.8rem' }}>
            <span style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--color-text)' }}>{total}</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}> beneficiários cadastrados</span>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Bloco rot="Masculino" v={m} cor={COR_M} icone="♂" />
            <Bloco rot="Feminino" v={f} cor={COR_F} icone="♀" />
          </div>
          <div style={{ display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden', background: 'var(--color-surface-2)', margin: '1rem 0 0.4rem' }}>
            <div style={{ width: `${pct(m)}%`, background: COR_M }} />
            <div style={{ width: `${pct(f)}%`, background: COR_F }} />
          </div>
          {sem > 0 && <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>{sem} sem gênero informado</div>}
        </div>
      </div>

      {/* Quadro 2 — Faixa etária por gênero */}
      <div style={caixa}>
        <div style={cab}>Faixa etária por gênero</div>
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
            <span><span style={{ color: COR_M }}>●</span> Masculino</span>
            <span><span style={{ color: COR_F }}>●</span> Feminino</span>
          </div>
          {linhas.map(l => (
            <div key={l.rot}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                <strong style={{ color: 'var(--color-text)' }}>{l.rot}</strong>
                <span style={{ color: 'var(--color-text-muted)' }}>{l.m + l.f + l.s} no total</span>
              </div>
              {[['M', l.m, COR_M], ['F', l.f, COR_F]].map(([k, v, cor]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.15rem' }}>
                  <div style={{ flex: 1, height: 10, background: 'var(--color-surface-2)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${(v / maxCel) * 100}%`, height: '100%', background: cor }} />
                  </div>
                  <span style={{ width: '1.8rem', textAlign: 'right', fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text)' }}>{v}</span>
                </div>
              ))}
            </div>
          ))}
          {semData.length > 0 && (
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)', paddingTop: '0.5rem' }}>
              {semData.length} sem data de nascimento (não entram nas faixas)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
