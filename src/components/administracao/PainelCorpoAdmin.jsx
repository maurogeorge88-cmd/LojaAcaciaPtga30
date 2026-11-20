/**
 * PAINEL DA ADMINISTRAÇÃO — gestões e matriz irmão × cargo (VM até Chanceler)
 * Usa apenas os dados de corpo_administrativo já carregados (sem SQL).
 */
import React, { useMemo, useState } from 'react';
import { normalizarCargo, CARGOS_PRINCIPAIS } from './cargosAdmin';

const COLUNAS = [
  { key: 'veneravel mestre',   label: 'Venerável Mestre', curto: 'VM' },
  { key: 'primeiro vigilante', label: '1º Vigilante',     curto: '1º Vig' },
  { key: 'segundo vigilante',  label: '2º Vigilante',     curto: '2º Vig' },
  { key: 'orador',             label: 'Orador',           curto: 'Orador' },
  { key: 'secretario',         label: 'Secretário',       curto: 'Secret.' },
  { key: 'tesoureiro',         label: 'Tesoureiro',       curto: 'Tesour.' },
  { key: 'chanceler',          label: 'Chanceler',        curto: 'Chanc.' },
];

const GOLD = '217,119,6';

export const PainelCorpoAdmin = ({ corpoAdmin = [], irmaos = [] }) => {
  const [busca, setBusca] = useState('');
  const [soVM, setSoVM] = useState(false);
  const [ordem, setOrdem] = useState({ key: 'total', dir: 'desc' });
  const [detalhe, setDetalhe] = useState(null);

  const dados = useMemo(() => {
    const porIrmao = {};
    const anos = new Set();
    const anosPorCargo = {};
    corpoAdmin.forEach(ca => {
      if (ca.ano_exercicio) anos.add(String(ca.ano_exercicio));
      const cargo = normalizarCargo(ca.cargo);
      if (!CARGOS_PRINCIPAIS.includes(cargo)) return;
      if (!ca.irmao_id) return;
      const nome = ca.irmao?.nome || irmaos.find(i => i.id === ca.irmao_id)?.nome;
      if (!nome) return;
      const foto = ca.irmao?.foto_url || irmaos.find(i => i.id === ca.irmao_id)?.foto_url;
      if (!porIrmao[ca.irmao_id]) porIrmao[ca.irmao_id] = { id: ca.irmao_id, nome, foto, cargos: {}, anos: {}, total: 0 };
      const r = porIrmao[ca.irmao_id];
      r.cargos[cargo] = (r.cargos[cargo] || 0) + 1;
      (r.anos[cargo] = r.anos[cargo] || []).push(String(ca.ano_exercicio));
      r.total += 1;
      if (cargo === 'veneravel mestre') (anosPorCargo.vm = anosPorCargo.vm || []).push(String(ca.ano_exercicio));
    });
    const lista = Object.values(porIrmao);
    const anoAtual = [...anos].sort().pop();
    const vmAtual = corpoAdmin.find(ca => String(ca.ano_exercicio) === anoAtual && normalizarCargo(ca.cargo) === 'veneravel mestre');
    return {
      lista,
      totalGestoes: anos.size,
      irmaosDistintos: lista.length,
      jaForamVM: lista.filter(r => r.cargos['veneravel mestre']).length,
      anoAtual,
      vmAtual: vmAtual ? (vmAtual.irmao?.nome || irmaos.find(i => i.id === vmAtual.irmao_id)?.nome) : null,
      max: Math.max(1, ...lista.flatMap(r => Object.values(r.cargos))),
    };
  }, [corpoAdmin, irmaos]);

  const linhas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let l = dados.lista.filter(r => (!q || r.nome.toLowerCase().includes(q)) && (!soVM || r.cargos['veneravel mestre']));
    const { key, dir } = ordem;
    l = [...l].sort((a, b) => {
      const va = key === 'nome' ? a.nome : key === 'total' ? a.total : (a.cargos[key] || 0);
      const vb = key === 'nome' ? b.nome : key === 'total' ? b.total : (b.cargos[key] || 0);
      const c = key === 'nome' ? va.localeCompare(vb) : va - vb;
      return (dir === 'asc' ? c : -c) || b.total - a.total || a.nome.localeCompare(b.nome);
    });
    return l;
  }, [dados, busca, soVM, ordem]);

  const ordenar = (key) => setOrdem(o => o.key === key ? { key, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'nome' ? 'asc' : 'desc' });
  const seta = (key) => ordem.key === key ? (ordem.dir === 'asc' ? ' ▲' : ' ▼') : '';

  const kpi = (icone, valor, rotulo, sub) => (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: `rgba(${GOLD},0.14)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>{icone}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.1, wordBreak: 'break-word' }}>{valor}</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>{rotulo}</div>
        {sub && <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{sub}</div>}
      </div>
    </div>
  );

  const th = { padding: '0.6rem 0.5rem', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)', cursor: 'pointer', userSelect: 'none', textAlign: 'center', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--color-surface)', borderBottom: '2px solid var(--color-border)' };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {kpi('📜', dados.totalGestoes, 'Gestões registradas', dados.anoAtual ? `até ${dados.anoAtual}` : null)}
        {kpi('👥', dados.irmaosDistintos, 'Irmãos com cargo principal', 'VM até Chanceler')}
        {kpi('👑', dados.jaForamVM, 'Irmãos que já foram VM')}
        {kpi('🎖️', dados.vmAtual ? `Ir∴ ${dados.vmAtual}` : '—', 'Veneralato mais recente', dados.anoAtual)}
      </div>

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ padding: '0.85rem 1rem', background: 'var(--color-accent)', color: '#fff', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, flex: 1, minWidth: 200 }}>📊 Irmão × Cargo — quantas vezes</h3>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar irmão..."
            style={{ padding: '0.4rem 0.7rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: '0.85rem', outline: 'none' }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', cursor: 'pointer', fontWeight: 600 }}>
            <input type="checkbox" checked={soVM} onChange={e => setSoVM(e.target.checked)} /> Só quem já foi VM
          </label>
        </div>

        <div style={{ overflowX: 'auto', maxHeight: '70vh' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left', paddingLeft: '1rem' }} onClick={() => ordenar('nome')}>Irmão{seta('nome')}</th>
                {COLUNAS.map(c => (
                  <th key={c.key} style={th} title={c.label} onClick={() => ordenar(c.key)}>{c.curto}{seta(c.key)}</th>
                ))}
                <th style={th} onClick={() => ordenar('total')}>Total{seta('total')}</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.5rem 1rem', minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                      {r.foto
                        ? <img src={r.foto} alt={r.nome} style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-border)', flexShrink: 0 }} />
                        : <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--color-surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>👤</div>}
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)' }}>{r.nome}</span>
                    </div>
                  </td>
                  {COLUNAS.map(c => {
                    const n = r.cargos[c.key] || 0;
                    const alpha = n ? Math.min(0.9, 0.18 + 0.72 * (n / dados.max)) : 0;
                    return (
                      <td key={c.key} style={{ padding: '0.3rem', textAlign: 'center' }}>
                        {n ? (
                          <button onClick={() => setDetalhe({ nome: r.nome, cargo: c.label, anos: [...r.anos[c.key]].sort() })}
                            title="Ver anos"
                            style={{ width: 38, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem', background: `rgba(${GOLD},${alpha})`, color: alpha > 0.55 ? '#fff' : 'var(--color-text)' }}>{n}</button>
                        ) : <span style={{ color: 'var(--color-text-muted)', opacity: 0.4 }}>·</span>}
                      </td>
                    );
                  })}
                  <td style={{ padding: '0.3rem', textAlign: 'center', fontWeight: 800, color: 'var(--color-accent)', fontSize: '0.95rem' }}>{r.total}</td>
                </tr>
              ))}
              {linhas.length === 0 && (
                <tr><td colSpan={COLUNAS.length + 2} style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Nenhum irmão encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detalhe && (
        <div onClick={() => setDetalhe(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem', maxWidth: 360, width: '100%', border: '1px solid var(--color-border)' }}>
            <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--color-text)' }}>Ir∴ {detalhe.nome}</h4>
            <p style={{ margin: '0.15rem 0 0.75rem', fontSize: '0.82rem', color: 'var(--color-accent)', fontWeight: 700 }}>{detalhe.cargo} — {detalhe.anos.length}x</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {detalhe.anos.map((a, i) => (
                <span key={i} style={{ padding: '0.25rem 0.65rem', borderRadius: 999, background: `rgba(${GOLD},0.16)`, color: 'var(--color-text)', fontWeight: 700, fontSize: '0.85rem' }}>{a}</span>
              ))}
            </div>
            <button onClick={() => setDetalhe(null)} style={{ marginTop: '1rem', width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text)', fontWeight: 600, cursor: 'pointer' }}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
};
