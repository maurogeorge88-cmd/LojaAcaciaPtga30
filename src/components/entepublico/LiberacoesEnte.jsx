import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { montarArvore } from '../recursospublicos/comum';

// Botão pequeno: mostra quais recursos/entes estão liberados para acesso de ente público.
export default function LiberacoesEnte() {
  const [aberto, setAberto] = useState(false);
  const [lista, setLista] = useState(null);

  const abrir = async () => {
    setAberto(true);
    const [r, e, o] = await Promise.all([
      supabase.from('comodato_recursos').select('id, numero_nf, data_nf, origem_id, liberado_ente').eq('liberado_ente', true),
      supabase.from('equipamentos').select('id, recurso_id, liberado_ente').eq('liberado_ente', true),
      supabase.from('comodato_origens_recurso').select('id, nome, parent_id'),
    ]);
    let od = o.data;
    if (o.error) od = (await supabase.from('comodato_origens_recurso').select('id, nome')).data;
    const orig = {}; montarArvore(od || []).forEach(x => { orig[x.id] = x.caminho; });
    const porEnte = {};
    (r.data || []).forEach(x => {
      const n = orig[x.origem_id] || 'Sem entidade';
      (porEnte[n] = porEnte[n] || { nfs: [], eq: 0 }).nfs.push(x);
    });
    (e.data || []).forEach(q => {
      const rec = (r.data || []).find(x => x.id === q.recurso_id);
      if (rec) porEnte[orig[rec.origem_id] || 'Sem entidade'].eq += 1;
    });
    setLista(porEnte);
  };

  return (
    <>
      <button type="button" onClick={abrir} title="Ver recursos liberados para entes públicos"
        style={{ fontSize: '0.72rem', padding: '0.15rem 0.55rem', borderRadius: 999, border: '1px solid rgba(16,185,129,0.6)', background: 'rgba(16,185,129,0.12)', color: '#10b981', fontWeight: 700, cursor: 'pointer' }}>
        🏛️ Liberações
      </button>
      {aberto && (
        <div onClick={() => setAberto(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', maxWidth: '30rem', width: '100%', maxHeight: '80vh', overflowY: 'auto', padding: '1rem 1.2rem' }}>
            <h3 style={{ margin: '0 0 0.6rem', fontSize: '1rem', color: 'var(--color-text)' }}>🏛️ Recursos liberados para ente público</h3>
            {!lista ? <p style={{ color: 'var(--color-text-muted)' }}>Carregando...</p>
              : Object.keys(lista).length === 0 ? <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Nenhum recurso liberado no momento.</p>
              : Object.entries(lista).map(([nome, v]) => (
                <div key={nome} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem', marginBottom: '0.45rem' }}>
                  <div style={{ fontWeight: 700, color: 'var(--color-text)' }}>{nome}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>NF: {v.nfs.map(x => x.numero_nf).join(', ')} • {v.eq} equipamento(s) liberado(s)</div>
                </div>
              ))}
            <button onClick={() => setAberto(false)} style={{ marginTop: '0.4rem', padding: '0.4rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text)', cursor: 'pointer' }}>Fechar</button>
          </div>
        </div>
      )}
    </>
  );
}
