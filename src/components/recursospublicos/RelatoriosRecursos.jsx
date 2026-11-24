/**
 * Relatórios: prestação de contas em PDF por ente e por recurso.
 */
import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { inp, lbl, card, btn, dataBR, urlParaDataUrl, idsDoRamo } from './comum';
import { montarDadosPrestacao, gerarPrestacaoContasRecursosPDF } from '../../utils/gerarPrestacaoContasRecursosPDF';

export default function RelatoriosRecursos({ dados, showError }) {
  const { entes, recursos } = dados;
  const [ente, setEnte] = useState('todos');
  const [recurso, setRecurso] = useState('todos');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [gerando, setGerando] = useState(false);

  const ramo = ente === 'todos' ? null : idsDoRamo(entes, ente);
  const recursosDoEnte = (recursos || []).filter(r => !ramo || ramo.has(String(r.origem_id)));

  const gerar = async () => {
    setGerando(true);
    try {
      let sel = recursosDoEnte;
      if (recurso !== 'todos') sel = sel.filter(r => String(r.id) === String(recurso));
      if (de) sel = sel.filter(r => r.data_recebimento && r.data_recebimento >= de);
      if (ate) sel = sel.filter(r => r.data_recebimento && r.data_recebimento <= ate);
      const { data: loja } = await supabase.from('dados_loja').select('*').limit(1).maybeSingle();
      let logo = null;
      if (loja?.logo_url) { try { logo = await urlParaDataUrl(loja.logo_url); } catch (e) { /* sem logo */ } }
      const filtro = [
        ente !== 'todos' && `Ente: ${(entes || []).find(o => String(o.id) === String(ente))?.caminho}`,
        recurso !== 'todos' && `Recurso: ${(recursos || []).find(r => String(r.id) === String(recurso))?.titulo}`,
        de && `Recebidos a partir de ${dataBR(de)}`, ate && `Até ${dataBR(ate)}`,
      ].filter(Boolean).join(' • ');
      const lista = montarDadosPrestacao({ ...dados, recursos: sel });
      gerarPrestacaoContasRecursosPDF({ dados: lista, dadosLoja: loja || {}, logo, filtro });
    } catch (err) {
      showError('Erro ao gerar relatório: ' + err.message);
    } finally { setGerando(false); }
  };

  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '44rem' }}>
      <div>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>📄 Prestação de contas</h2>
        <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>PDF com os recursos recebidos, tudo que foi aplicado (comodato, doações, obras...) e o saldo.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem' }}>
        <div>
          <label style={lbl}>Ente</label>
          <select value={ente} onChange={e => { setEnte(e.target.value); setRecurso('todos'); }} style={inp()}>
            <option value="todos">Todos os entes</option>
            {(entes || []).map(o => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Recurso</label>
          <select value={recurso} onChange={e => setRecurso(e.target.value)} style={inp()}>
            <option value="todos">Todos os recursos</option>
            {recursosDoEnte.map(r => <option key={r.id} value={r.id}>{r.titulo}</option>)}
          </select>
        </div>
        <div><label style={lbl}>Recebidos a partir de</label><input type="date" value={de} onChange={e => setDe(e.target.value)} style={inp()} /></div>
        <div><label style={lbl}>Até</label><input type="date" value={ate} onChange={e => setAte(e.target.value)} style={inp()} /></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={gerar} disabled={gerando} style={btn('16,185,129')}>{gerando ? 'Gerando...' : '📄 Gerar PDF'}</button>
      </div>
    </div>
  );
}
