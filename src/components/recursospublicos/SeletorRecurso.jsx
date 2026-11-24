// Seletor de recurso de origem usado no cadastro de equipamento (individual e em lote)
import React from 'react';
import { dataBR } from './comum';

export const SeletorRecurso = ({ value, onChange, recursos, lbl: lblStyle, inpStyle }) => (
  <div>
    <label style={lblStyle}>🏛️ Recurso de ente público (NF) — opcional</label>
    <select value={value || ''} onChange={e => onChange(e.target.value)} style={inpStyle}>
      <option value="">— Compra própria / sem recurso —</option>
      {(recursos || []).map(r => (
        <option key={r.id} value={r.id}>
          {r.origem?.nome || '—'}{r.recurso_publico?.titulo ? ` — ${r.recurso_publico.titulo}` : ''} — NF {r.numero_nf}{r.data_nf ? ` (${dataBR(r.data_nf)})` : ''}
        </option>
      ))}
    </select>
    {value ? <p style={{ margin: '0.3rem 0 0', fontSize: '0.75rem', color: '#f59e0b' }}>O valor do equipamento é obrigatório quando ele vem de recurso de ente público.</p> : null}
  </div>
);

export default SeletorRecurso;
