/**
 * Painel: visão por ente e alertas de pendência.
 */
import React, { useMemo } from 'react';
import { card, moeda, num, arred, resumoDoRecurso } from './comum';

const Cartao = ({ titulo, valor, cor, sub }) => (
  <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', borderTop: `4px solid ${cor}`, padding: '0.8rem 1.05rem' }}>
    <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{titulo}</div>
    <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.2, marginTop: '0.15rem' }}>{valor}</div>
    {sub && <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>{sub}</div>}
  </div>
);

export default function PainelRecursos({ dados, onAbrir }) {
  const { entes, recursos, saldos, nfs, equipamentos } = dados;

  const porEnte = useMemo(() => {
    const m = {};
    (recursos || []).forEach(r => {
      const x = resumoDoRecurso(r, saldos);
      const k = r.origem_id;
      m[k] = m[k] || { recursos: 0, recebido: 0, comodato: 0, outras: 0, saldo: 0 };
      m[k].recursos += 1; m[k].recebido += x.recebido; m[k].comodato += x.comodato; m[k].outras += x.outras; m[k].saldo += x.saldo;
    });
    return m;
  }, [recursos, saldos]);

  const geral = Object.values(porEnte).reduce((t, x) => ({ recebido: t.recebido + x.recebido, comodato: t.comodato + x.comodato, outras: t.outras + x.outras, saldo: t.saldo + x.saldo }), { recebido: 0, comodato: 0, outras: 0, saldo: 0 });

  // ── Alertas ──
  const alertas = useMemo(() => {
    const out = [];
    (recursos || []).forEach(r => {
      const x = resumoDoRecurso(r, saldos);
      if (x.saldo < -0.005) out.push({ nivel: 'erro', recurso: r.id, texto: `${r.titulo}: aplicado maior que o recebido (${moeda(x.saldo)}).` });
      else if (r.situacao !== 'encerrado' && x.saldo > 0.005) out.push({ nivel: 'aviso', recurso: r.id, texto: `${r.titulo}: ${moeda(x.saldo)} ainda sem destino.` });
    });
    const nfsDeRecurso = (nfs || []).filter(n => n.recurso_publico_id);
    nfsDeRecurso.forEach(n => {
      const eqs = (equipamentos || []).filter(e => e.recurso_id === n.id);
      if (!eqs.length) return;
      const soma = arred(eqs.reduce((t, e) => t + num(e.valor_aquisicao), 0));
      const sem = eqs.filter(e => e.valor_aquisicao == null || e.valor_aquisicao === '').length;
      if (sem > 0) out.push({ nivel: 'aviso', recurso: n.recurso_publico_id, texto: `NF ${n.numero_nf}: ${sem} equipamento(s) sem valor informado.` });
      else if (Math.abs(soma - num(n.valor_total)) > 0.01) out.push({ nivel: 'aviso', recurso: n.recurso_publico_id, texto: `NF ${n.numero_nf}: soma dos equipamentos (${moeda(soma)}) difere do valor da nota (${moeda(n.valor_total)}).` });
    });
    const nfsSemRecurso = (nfs || []).filter(n => !n.recurso_publico_id);
    if (nfsSemRecurso.length) out.push({ nivel: 'aviso', recurso: null, texto: `${nfsSemRecurso.length} nota(s) fiscal(is) antigas sem recurso vinculado: ${nfsSemRecurso.map(n => n.numero_nf).join(', ')}.` });
    return out;
  }, [recursos, saldos, nfs, equipamentos]);

  const nomeEnte = (id) => (entes || []).find(e => e.id === id)?.nome || '—';
  const idsComRecurso = Object.keys(porEnte).map(Number);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem' }}>
        <Cartao titulo="Recebido" valor={moeda(geral.recebido)} cor="#64748b" sub={`${(recursos || []).length} recurso(s)`} />
        <Cartao titulo="Em comodato" valor={moeda(geral.comodato)} cor="#3b82f6" sub="notas de equipamentos" />
        <Cartao titulo="Outras aplicações" valor={moeda(geral.outras)} cor="#8b5cf6" sub="doações, obras e outros" />
        <Cartao titulo="Saldo a aplicar" valor={moeda(geral.saldo)} cor={geral.saldo < -0.005 ? '#ef4444' : (geral.saldo > 0.005 ? '#f59e0b' : '#10b981')} sub="recebido − aplicado" />
      </div>

      <div style={card}>
        <p style={{ margin: '0 0 0.7rem', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Por ente</p>
        {idsComRecurso.length === 0 && <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>Nenhum recurso cadastrado ainda.</p>}
        <div style={{ overflowX: 'auto' }}>
          {idsComRecurso.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead><tr style={{ textAlign: 'right', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem' }}>Ente</th><th style={{ padding: '0.4rem 0.5rem' }}>Recursos</th><th style={{ padding: '0.4rem 0.5rem' }}>Recebido</th><th style={{ padding: '0.4rem 0.5rem' }}>Comodato</th><th style={{ padding: '0.4rem 0.5rem' }}>Outras</th><th style={{ padding: '0.4rem 0.5rem' }}>Saldo</th>
              </tr></thead>
              <tbody>
                {idsComRecurso.map(id => { const x = porEnte[id]; return (
                  <tr key={id} style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-text)', textAlign: 'right' }}>
                    <td style={{ textAlign: 'left', padding: '0.45rem 0.5rem', fontWeight: 600 }}>{nomeEnte(id)}</td>
                    <td style={{ padding: '0.45rem 0.5rem' }}>{x.recursos}</td>
                    <td style={{ padding: '0.45rem 0.5rem' }}>{moeda(x.recebido)}</td>
                    <td style={{ padding: '0.45rem 0.5rem' }}>{moeda(x.comodato)}</td>
                    <td style={{ padding: '0.45rem 0.5rem' }}>{moeda(x.outras)}</td>
                    <td style={{ padding: '0.45rem 0.5rem', fontWeight: 700 }}>{moeda(x.saldo)}</td>
                  </tr>); })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div style={card}>
        <p style={{ margin: '0 0 0.7rem', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Pendências ({alertas.length})</p>
        {alertas.length === 0 && <p style={{ margin: 0, fontSize: '0.88rem', color: '#10b981', fontWeight: 600 }}>✅ Nenhuma pendência.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {alertas.map((a, i) => (
            <div key={i} onClick={() => a.recurso && onAbrir(a.recurso)} style={{ fontSize: '0.84rem', padding: '0.45rem 0.7rem', borderRadius: 'var(--radius-lg)', cursor: a.recurso ? 'pointer' : 'default',
              background: a.nivel === 'erro' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', border: `1px solid ${a.nivel === 'erro' ? 'rgba(239,68,68,0.35)' : 'rgba(245,158,11,0.35)'}`, color: 'var(--color-text)' }}>
              {a.nivel === 'erro' ? '🛑' : '⚠️'} {a.texto}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
