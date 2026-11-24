/**
 * Lista de recursos recebidos, com filtros e acesso ao detalhe.
 */
import React, { useState, useMemo } from 'react';
import ModalRecurso from './ModalRecurso';
import { inp, card, btn, moeda, dataBR, resumoDoRecurso, idsDoRamo } from './comum';

export default function ListaRecursos({ dados, podeEditar, onAbrir, onChange, showSuccess, showError }) {
  const { entes, recursos, saldos, equipamentos, nfs } = dados;
  const [filtroEnte, setFiltroEnte] = useState('todos');
  const [filtroSit, setFiltroSit] = useState('todos');
  const [busca, setBusca] = useState('');
  const [modal, setModal] = useState(false);

  const nomeEnte = (id) => (entes || []).find(e => e.id === id)?.caminho || '—';

  const lista = useMemo(() => {
    const ramo = filtroEnte === 'todos' ? null : idsDoRamo(entes, filtroEnte);
    const q = busca.trim().toLowerCase();
    return (recursos || [])
      .filter(r => !ramo || ramo.has(String(r.origem_id)))
      .filter(r => filtroSit === 'todos' || r.situacao === filtroSit)
      .filter(r => !q || [r.titulo, r.numero_processo, r.documento_ref, r.finalidade].some(t => String(t || '').toLowerCase().includes(q)));
  }, [recursos, entes, filtroEnte, filtroSit, busca]);

  const tot = lista.reduce((t, r) => { const x = resumoDoRecurso(r, saldos); return { rec: t.rec + x.recebido, ap: t.ap + x.aplicado, sal: t.sal + x.saldo }; }, { rec: 0, ap: 0, sal: 0 });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>💰 Recursos recebidos</h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Cada recurso recebido de um ente e o que foi feito com ele.</p>
          </div>
          {podeEditar && <button onClick={() => setModal(true)} style={btn('16,185,129')} disabled={(entes || []).length === 0}>➕ Novo recurso</button>}
        </div>
        {(entes || []).length === 0 && <p style={{ margin: 0, fontSize: '0.8rem', color: '#f59e0b' }}>Cadastre primeiro um ente na aba “Entes”.</p>}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Buscar por título, processo, finalidade..." style={inp({ flex: '1 1 14rem', width: 'auto' })} />
          <select value={filtroEnte} onChange={e => setFiltroEnte(e.target.value)} style={inp({ width: 'auto' })}>
            <option value="todos">Todos os entes</option>
            {(entes || []).map(o => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
          </select>
          <select value={filtroSit} onChange={e => setFiltroSit(e.target.value)} style={inp({ width: 'auto' })}>
            <option value="todos">Todas as situações</option>
            <option value="aberto">Abertos</option>
            <option value="encerrado">Encerrados</option>
          </select>
        </div>
        <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
          {lista.length} recurso(s) • recebido <strong style={{ color: 'var(--color-text)' }}>{moeda(tot.rec)}</strong> • aplicado <strong style={{ color: 'var(--color-text)' }}>{moeda(tot.ap)}</strong> • saldo <strong style={{ color: 'var(--color-text)' }}>{moeda(tot.sal)}</strong>
        </div>
      </div>

      {lista.length === 0 && <div style={{ ...card, textAlign: 'center', color: 'var(--color-text-muted)' }}>Nenhum recurso encontrado.</div>}

      {lista.map(r => {
        const x = resumoDoRecurso(r, saldos);
        const cor = x.saldo < -0.005 ? '#ef4444' : (x.saldo > 0.005 ? '#f59e0b' : '#10b981');
        return (
          <div key={r.id} onClick={() => onAbrir(r.id)} style={{ ...card, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.4rem', borderLeft: `4px solid ${cor}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
              <strong style={{ color: 'var(--color-text)' }}>{r.titulo}</strong>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{r.situacao === 'encerrado' ? 'Encerrado' : 'Aberto'}{r.liberado_ente ? ' • 🏛️ liberado ao ente' : ''}</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              🏛️ {nomeEnte(r.origem_id)}{r.data_recebimento ? ` • ${dataBR(r.data_recebimento)}` : ''}{r.numero_processo ? ` • processo ${r.numero_processo}` : ''}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 1.4rem', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Recebido: <strong style={{ color: 'var(--color-text)' }}>{moeda(x.recebido)}</strong></span>
              <span style={{ color: 'var(--color-text-muted)' }}>Comodato: <strong style={{ color: 'var(--color-text)' }}>{moeda(x.comodato)}</strong></span>
              <span style={{ color: 'var(--color-text-muted)' }}>Outras: <strong style={{ color: 'var(--color-text)' }}>{moeda(x.outras)}</strong></span>
              <span style={{ color: 'var(--color-text-muted)' }}>Saldo: <strong style={{ color: cor }}>{moeda(x.saldo)}</strong></span>
            </div>
          </div>
        );
      })}

      {modal && (
        <ModalRecurso entes={entes} nfs={nfs} equipamentos={equipamentos}
          onClose={() => setModal(false)}
          onSaved={(id) => { setModal(false); onChange(); onAbrir(id); }}
          showSuccess={showSuccess} showError={showError} />
      )}
    </div>
  );
}
