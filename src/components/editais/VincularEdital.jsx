import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { TIPOS_EDITAL, formatarNumeroEdital } from '../../utils/editais';
import { formatarData } from '../../utils/formatters';

// Painel de busca: escolhe um edital já cadastrado (sem vínculo com nenhuma
// eleição/posse) para vincular à situação aberta, em vez de emitir outro.
export default function VincularEdital({ tipo, onEscolher, onFechar, ocupado = false }) {
  const [lista, setLista] = useState(null);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await supabase.from('editais').select('*').is('origem_id', null)
        .order('ano', { ascending: false }).order('numero', { ascending: false });
      if (vivo) setLista(data || []);
    })();
    return () => { vivo = false; };
  }, []);

  const t = busca.trim().toLowerCase();
  const itens = (lista || [])
    .filter(e => !t || formatarNumeroEdital(e.numero, e.ano).includes(t) || (e.descricao || '').toLowerCase().includes(t) || (TIPOS_EDITAL[e.tipo] || '').toLowerCase().includes(t))
    .sort((a, b) => (b.tipo === tipo) - (a.tipo === tipo)); // do mesmo tipo primeiro

  return (
    <div style={{ flexBasis: '100%', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', padding: '0.6rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
        <input type="text" autoFocus placeholder="🔍 Buscar por número, tipo ou descrição..." value={busca} onChange={e => setBusca(e.target.value)}
          style={{ flex: 1, padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', fontSize: '0.82rem', outline: 'none' }} />
        <button type="button" onClick={onFechar}
          style={{ padding: '0.4rem 0.7rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', fontSize: '0.78rem', cursor: 'pointer' }}>Fechar</button>
      </div>
      <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        {lista === null && <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Carregando…</span>}
        {lista !== null && itens.length === 0 && (
          <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Nenhum edital livre encontrado (editais já vinculados a outra situação não aparecem).</span>
        )}
        {itens.map(e => (
          <div key={e.id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-2)' }}>
            <strong style={{ fontSize: '0.82rem', color: 'var(--color-accent)', minWidth: '58px' }}>{formatarNumeroEdital(e.numero, e.ano)}</strong>
            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', minWidth: '78px' }}>{e.data_edital ? formatarData(e.data_edital) : '—'}</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: e.tipo === tipo ? '#10b981' : 'var(--color-text-muted)', minWidth: '110px' }}>{TIPOS_EDITAL[e.tipo] || e.tipo}</span>
            <span style={{ flex: 1, fontSize: '0.78rem', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.descricao}>{e.descricao}</span>
            <button type="button" disabled={ocupado} onClick={() => onEscolher(e)}
              style={{ padding: '0.3rem 0.7rem', borderRadius: 'var(--radius-md)', border: '1px solid #10b981', background: 'rgba(16,185,129,0.12)', color: '#10b981', fontWeight: 700, fontSize: '0.75rem', cursor: ocupado ? 'not-allowed' : 'pointer' }}>🔗 Vincular</button>
          </div>
        ))}
      </div>
    </div>
  );
}
