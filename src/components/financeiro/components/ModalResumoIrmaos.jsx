import React, { useState } from 'react';
import RelatorioIrmaosPendencias from './RelatorioIrmaosPendencias';

const fmtR = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ModalResumoIrmaos({ isOpen, onClose, resumoIrmaos }) {
  const [filtroStatus, setFiltroStatus] = useState('todos');

  if (!isOpen) return null;

  // Devedor = tem despesas pendentes (irmão deve para a loja)
  const irmaosDevendo = resumoIrmaos.filter(i => (i.despesasPendentes || 0) > 0);
  const irmaosEmDia   = resumoIrmaos.filter(i => (i.despesasPendentes || 0) === 0);

  const irmaosExibir = filtroStatus === 'devendo' ? irmaosDevendo
    : filtroStatus === 'em-dia' ? irmaosEmDia
    : resumoIrmaos;

  // Mapeamento correto:
  // totalReceitas = loja deve ao irmão (tipo receita = crédito do irmão)
  // receitasPendentes = loja ainda deve (pendente)
  // totalDespesas = irmão deve à loja (tipo despesa)
  // despesasPendentes = irmão ainda deve (Valor Devido)
  const totLojaPg    = irmaosExibir.reduce((s, i) => s + ((i.totalReceitas || 0) - (i.receitasPendentes || 0)), 0); // loja já pagou ao irmão
  const totLojaDev   = irmaosExibir.reduce((s, i) => s + (i.receitasPendentes || 0), 0);                             // loja ainda deve ao irmão
  const totRecPagas  = irmaosExibir.reduce((s, i) => s + ((i.totalDespesas || 0) - (i.despesasPendentes || 0)), 0);  // irmão já pagou à loja
  const totValDevido = irmaosExibir.reduce((s, i) => s + (i.despesasPendentes || 0), 0);                             // irmão ainda deve à loja

  const sTh = { border: '1px solid var(--color-border)', padding: '0.6rem 0.75rem', fontWeight: '700', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', background: 'var(--color-surface-2)', textAlign: 'right' };
  const sTd = { border: '1px solid var(--color-border)', padding: '0.55rem 0.75rem', textAlign: 'right', fontSize: '0.85rem' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '1100px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        <div style={{ background: 'var(--color-accent)', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ color: '#fff', fontWeight: '800', fontSize: '1.25rem', margin: 0 }}>💰 Resumo Financeiro dos Irmãos</h2>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '50%', width: '2.25rem', height: '2.25rem', fontSize: '1.4rem', fontWeight: '700', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {[
              ['todos',   '📊 Todos (' + resumoIrmaos.length + ')',      filtroStatus === 'todos'   ? '#2563eb' : 'var(--color-surface-2)', filtroStatus === 'todos'   ? '#fff' : 'var(--color-text)'],
              ['devendo', '⚠️ Devendo (' + irmaosDevendo.length + ')',   filtroStatus === 'devendo' ? '#ea580c' : 'var(--color-surface-2)', filtroStatus === 'devendo' ? '#fff' : 'var(--color-text)'],
              ['em-dia',  '✅ Em Dia (' + irmaosEmDia.length + ')',      filtroStatus === 'em-dia'  ? '#16a34a' : 'var(--color-surface-2)', filtroStatus === 'em-dia'  ? '#fff' : 'var(--color-text)'],
            ].map(function(item) {
              return (
                <button key={item[0]} onClick={() => setFiltroStatus(item[0])}
                  style={{ padding: '0.45rem 1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', background: item[2], color: item[3] }}>
                  {item[1]}
                </button>
              );
            })}
            <div style={{ marginLeft: 'auto' }}>
              <RelatorioIrmaosPendencias resumoIrmaos={resumoIrmaos} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '0.85rem' }}>
              <p style={{ margin: '0 0 0.3rem', fontSize: '0.68rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Irmãos Exibindo</p>
              <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: '800', color: '#2563eb' }}>{irmaosExibir.length}</p>
            </div>
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '0.85rem' }}>
              <p style={{ margin: '0 0 0.3rem', fontSize: '0.68rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Rec. Pagas (Irmão→Loja)</p>
              <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: '#16a34a' }}>{fmtR(totRecPagas)}</p>
            </div>
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderLeft: '3px solid #ea580c', borderRadius: 'var(--radius-lg)', padding: '0.85rem' }}>
              <p style={{ margin: '0 0 0.3rem', fontSize: '0.68rem', fontWeight: '700', color: '#ea580c', textTransform: 'uppercase' }}>Valor Devido (Irmão→Loja)</p>
              <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: '#ea580c' }}>{fmtR(totValDevido)}</p>
            </div>
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderLeft: '3px solid #7c3aed', borderRadius: 'var(--radius-lg)', padding: '0.85rem' }}>
              <p style={{ margin: '0 0 0.3rem', fontSize: '0.68rem', fontWeight: '700', color: '#7c3aed', textTransform: 'uppercase' }}>Loja Deve (Pendente)</p>
              <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: '#7c3aed' }}>{fmtR(totLojaDev)}</p>
            </div>
          </div>

          {irmaosExibir.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
              <p style={{ fontSize: '2rem', margin: 0 }}>📭</p>
              <p style={{ marginTop: '0.5rem', fontWeight: '600' }}>Nenhum irmão encontrado</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...sTh, textAlign: 'left', width: '26%' }}>Irmão</th>
                    <th style={sTh}>
                      Desp. Pagas
                      <div style={{ fontSize: '0.62rem', fontWeight: '400', marginTop: '0.1rem' }}>Loja → Irmão (pago)</div>
                    </th>
                    <th style={{ ...sTh, color: '#7c3aed' }}>
                      Loja Deve
                      <div style={{ fontSize: '0.62rem', fontWeight: '400', marginTop: '0.1rem', color: 'var(--color-text-muted)' }}>Loja → Irmão (pendente)</div>
                    </th>
                    <th style={{ ...sTh, color: '#16a34a' }}>
                      Rec. Pagas
                      <div style={{ fontSize: '0.62rem', fontWeight: '400', marginTop: '0.1rem', color: 'var(--color-text-muted)' }}>Irmão → Loja (pago)</div>
                    </th>
                    <th style={{ ...sTh, color: '#ea580c' }}>
                      Valor Devido
                      <div style={{ fontSize: '0.62rem', fontWeight: '400', marginTop: '0.1rem', color: 'var(--color-text-muted)' }}>Irmão → Loja (pendente)</div>
                    </th>
                    <th style={{ ...sTh, textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {irmaosExibir.sort((a, b) => a.nomeIrmao.localeCompare(b.nomeIrmao)).map((irmao, idx) => {
                    const despPagas = (irmao.totalReceitas || 0) - (irmao.receitasPendentes || 0); // loja já pagou ao irmão
                    const lojaDeve  = irmao.receitasPendentes || 0;                                         // loja ainda deve ao irmão
                    const recPagas  = (irmao.totalDespesas || 0) - (irmao.despesasPendentes || 0);          // irmão já pagou à loja
                    const valDevido = irmao.despesasPendentes || 0;                                         // irmão ainda deve à loja
                    const devedor   = valDevido > 0;
                    return (
                      <tr key={idx} style={{ background: idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)' }}>
                        <td style={{ ...sTd, textAlign: 'left' }}>
                          <p style={{ margin: 0, fontWeight: '700', color: 'var(--color-text)', fontSize: '0.875rem' }}>{irmao.nomeIrmao}</p>
                          <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>CIM: {irmao.cim || 'N/A'}</p>
                        </td>
                        <td style={{ ...sTd, color: '#6b7280' }}>{fmtR(despPagas)}</td>
                        <td style={{ ...sTd, color: lojaDeve > 0 ? '#7c3aed' : 'var(--color-text-muted)', fontWeight: lojaDeve > 0 ? '700' : '400' }}>{fmtR(lojaDeve)}</td>
                        <td style={{ ...sTd, color: '#16a34a', fontWeight: '600' }}>{fmtR(recPagas)}</td>
                        <td style={{ ...sTd, color: valDevido > 0 ? '#ea580c' : '#16a34a', fontWeight: valDevido > 0 ? '800' : '600', fontSize: valDevido > 0 ? '0.95rem' : '0.85rem' }}>{fmtR(valDevido)}</td>
                        <td style={{ ...sTd, textAlign: 'center' }}>
                          <span style={{ padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: '700', background: devedor ? 'rgba(234,88,12,0.12)' : 'rgba(22,163,74,0.12)', color: devedor ? '#ea580c' : '#16a34a', border: '1px solid ' + (devedor ? 'rgba(234,88,12,0.3)' : 'rgba(22,163,74,0.3)') }}>
                            {devedor ? 'Devedor' : 'Em Dia'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--color-surface-2)', borderTop: '2px solid var(--color-border)' }}>
                    <td style={{ ...sTd, textAlign: 'left', fontWeight: '700', color: 'var(--color-text)' }}>TOTAL ({irmaosExibir.length} irmãos)</td>
                    <td style={{ ...sTd, color: '#6b7280', fontWeight: '700' }}>{fmtR(totLojaPg)}</td>
                    <td style={{ ...sTd, color: '#7c3aed', fontWeight: '800' }}>{fmtR(totLojaDev)}</td>
                    <td style={{ ...sTd, color: '#16a34a', fontWeight: '800' }}>{fmtR(totRecPagas)}</td>
                    <td style={{ ...sTd, color: '#ea580c', fontWeight: '800', fontSize: '0.95rem' }}>{fmtR(totValDevido)}</td>
                    <td style={sTd}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <div style={{ marginTop: '1rem', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '0.85rem 1rem' }}>
            <p style={{ margin: '0 0 0.4rem', fontWeight: '700', color: 'var(--color-text)', fontSize: '0.82rem' }}>ℹ️ Legenda:</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.2rem', fontSize: '0.73rem', color: 'var(--color-text-muted)' }}>
              <p style={{ margin: 0 }}>• <strong>Desp. Pagas:</strong> O que a Loja já pagou ao irmão</p>
              <p style={{ margin: 0 }}>• <strong style={{ color: '#7c3aed' }}>Loja Deve:</strong> O que a Loja ainda deve ao irmão</p>
              <p style={{ margin: 0 }}>• <strong style={{ color: '#16a34a' }}>Rec. Pagas:</strong> O que o irmão já pagou à Loja</p>
              <p style={{ margin: 0 }}>• <strong style={{ color: '#ea580c' }}>Valor Devido:</strong> O que o irmão ainda deve à Loja</p>
            </div>
          </div>

        </div>

        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 1.5rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontWeight: '600', cursor: 'pointer' }}>Fechar</button>
        </div>

      </div>
    </div>
  );
}
