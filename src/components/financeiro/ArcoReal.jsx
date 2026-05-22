import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

const fmtR   = (v) => 'R$ ' + Math.abs(Number(v || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const fmtD   = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const hojeISO = () => { const h = new Date(); return h.getFullYear() + '-' + String(h.getMonth()+1).padStart(2,'0') + '-' + String(h.getDate()).padStart(2,'0'); };
const MESES  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export default function ArcoReal({ isOpen, onClose, showSuccess, showError }) {
  const agora = new Date();
  const [filtro, setFiltro]     = useState('mes');
  const [mes, setMes]           = useState(agora.getMonth() + 1);
  const [ano, setAno]           = useState(agora.getFullYear());
  const [lancs, setLancs]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [verLancs, setVerLancs] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm]         = useState({
    tipo: 'receita', descricao: '', valor: '',
    data_vencimento: hojeISO(), status: 'pago', observacoes: ''
  });

  useEffect(() => { if (isOpen) carregar(); }, [isOpen, filtro, mes, ano]);

  // ── Carregar lançamentos da tabela própria ─────────────────────────────────
  const carregar = async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('arco_real_lancamentos')
        .select('*')
        .order('data_vencimento', { ascending: false });

      if (filtro === 'mes') {
        const ini = `${ano}-${String(mes).padStart(2,'0')}-01`;
        const fim = `${ano}-${String(mes).padStart(2,'0')}-${new Date(ano, mes, 0).getDate()}`;
        q = q.gte('data_vencimento', ini).lte('data_vencimento', fim);
      } else if (filtro === 'ano') {
        q = q.gte('data_vencimento', `${ano}-01-01`).lte('data_vencimento', `${ano}-12-31`);
      }

      const { data, error } = await q;
      if (error) throw error;
      setLancs(data || []);
    } catch(e) {
      showError('Erro ao carregar: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Salvar lançamento manual na tabela própria ─────────────────────────────
  const salvarLancamento = async () => {
    if (!form.descricao.trim()) { showError('Informe a descrição.'); return; }
    if (!form.valor || parseFloat(form.valor) <= 0) { showError('Informe um valor válido.'); return; }
    if (!form.data_vencimento) { showError('Informe a data.'); return; }
    setSalvando(true);
    try {
      const { error } = await supabase.from('arco_real_lancamentos').insert([{
        tipo:            form.tipo,
        descricao:       form.descricao.trim(),
        valor:           parseFloat(form.valor),
        data_vencimento: form.data_vencimento,
        data_pagamento:  form.status === 'pago' ? form.data_vencimento : null,
        status:          form.status,
        observacoes:     form.observacoes.trim() || null,
        origem:          'manual',
        lancamento_loja_id: null,
      }]);
      if (error) throw error;
      showSuccess('✅ Lançamento registrado!');
      setForm({ tipo:'receita', descricao:'', valor:'', data_vencimento: hojeISO(), status:'pago', observacoes:'' });
      setShowForm(false);
      carregar();
    } catch(e) {
      showError('Erro ao salvar: ' + e.message);
    } finally {
      setSalvando(false);
    }
  };

  // ── Cálculos ───────────────────────────────────────────────────────────────
  const receitas = lancs.filter(l => l.tipo === 'receita');
  const despesas = lancs.filter(l => l.tipo === 'despesa');
  const recPagas = receitas.filter(l => l.status === 'pago');
  const recPend  = receitas.filter(l => l.status === 'pendente');
  const totRec   = recPagas.reduce((s, l) => s + Number(l.valor || 0), 0);
  const totPend  = recPend.reduce((s, l) => s + Number(l.valor || 0), 0);
  const totDesp  = despesas.reduce((s, l) => s + Number(l.valor || 0), 0);
  const saldo    = totRec - totDesp;

  // ── PDF ────────────────────────────────────────────────────────────────────
  const gerarPDF = async () => {
    try {
      showSuccess('Gerando PDF...');
      const { data: dadosLoja } = await supabase.from('dados_loja').select('*').single();
      const { default: jsPDF }  = await import('jspdf');
      const doc = new jsPDF();
      let y = 10;

      const rodape = () => {
        const tot = doc.getNumberOfPages();
        for (let p = 1; p <= tot; p++) {
          doc.setPage(p);
          doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(150);
          doc.text('SysMaçom-MG - Desenvolvedor: Mauro George', 15, 290);
          doc.text('Página ' + p + ' de ' + tot, 105, 290, { align:'center' });
          doc.text('Emitido em ' + new Date().toLocaleDateString('pt-BR'), 195, 290, { align:'right' });
          doc.setTextColor(0);
        }
      };

      if (dadosLoja?.logo_url) {
        try { doc.addImage(dadosLoja.logo_url, 'PNG', 88, y, 28, 28); y += 33; } catch {}
      }

      const nomeLoja = (dadosLoja?.nome_loja || 'ARLS Acácia de Paranatinga') + ' Nº ' + (dadosLoja?.numero_loja || '30');
      doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(0);
      doc.text(nomeLoja, 105, y, { align:'center' }); y += 6;
      doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(80);
      doc.text('Arco Real - Controle Financeiro', 105, y, { align:'center' }); y += 5;
      const labelFiltro = filtro === 'mes' ? MESES[mes-1] + '/' + ano : filtro === 'ano' ? 'Ano ' + ano : 'Todos os Períodos';
      doc.setFontSize(12); doc.setFont('helvetica','bold'); doc.setTextColor(0);
      doc.text('Extrato de Movimentação — ' + labelFiltro, 105, y, { align:'center' }); y += 10;

      // Tabela resumo
      [
        { label:'Recebido (Pago)',       val: totRec,  cor:[16,120,60] },
        { label:'Pendente (nao recebido)',val: totPend, cor:[200,130,0] },
        { label:'Repassado ao Arco Real', val: totDesp, cor:[200,0,0] },
        { label: saldo>0?'Saldo a Repassar':saldo<0?'Repassado a Mais':'Zerado',
          val: saldo, cor: saldo>0?[37,99,235]:saldo<0?[220,38,38]:[16,120,60] },
      ].forEach((lr, i) => {
        const bg = i%2===0?[245,245,245]:[255,255,255]; doc.setFillColor(bg[0], bg[1], bg[2]);
        doc.rect(15, y, 180, 7, 'F');
        doc.setDrawColor(200); doc.setLineWidth(0.2); doc.rect(15, y, 180, 7, 'S');
        doc.setFont('helvetica','bold'); doc.setTextColor(60); doc.setFontSize(9);
        doc.text(lr.label, 20, y+4.5);
        doc.setTextColor(lr.cor[0], lr.cor[1], lr.cor[2]); doc.text(fmtR(lr.val), 192, y+4.5, { align:'right' });
        y += 7;
      });
      y += 8;

      const renderBloco = (titulo, lista, corTit, corVal) => {
        if (!lista.length) return;
        if (y > 240) { doc.addPage(); y = 15; }
        doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(corTit[0], corTit[1], corTit[2]);
        doc.text(titulo, 15, y); y += 3;
        doc.setDrawColor(150); doc.setLineWidth(0.3); doc.line(15, y, 195, y); y += 4;
        doc.setFillColor(230,230,230); doc.rect(15, y, 180, 6, 'F');
        doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(0);
        doc.text('Data', 17, y+4); doc.text('Descrição', 43, y+4);
        doc.text('Origem', 140, y+4); doc.text('Valor', 192, y+4, { align:'right' });
        y += 11;
        let sub = 0;
        doc.setFontSize(8); doc.setFont('helvetica','normal');
        lista.forEach(l => {
          if (y > 275) { doc.addPage(); y = 15; }
          const val = Number(l.valor||0); sub += val;
          doc.setTextColor(0);
          doc.text(fmtD(l.data_vencimento), 17, y);
          doc.text((l.descricao||'').substring(0,50), 43, y);
          if (l.origem==='manual') doc.setTextColor(99,102,241); else doc.setTextColor(100,100,100);
          doc.text(l.origem==='manual'?'Manual':'Loja', 140, y);
          doc.setTextColor(corVal[0], corVal[1], corVal[2]); doc.text(fmtR(val), 192, y, { align:'right' });
          doc.setTextColor(0); y += 5;
        });
        y += 1;
        doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(15, y, 195, y); y += 5;
        doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(0);
        doc.text('Sub Total:', 140, y, { align:'right' });
        doc.setTextColor(corVal[0], corVal[1], corVal[2]); doc.text(fmtR(sub), 192, y, { align:'right' });
        y += 2; doc.setDrawColor(150); doc.setLineWidth(0.3); doc.line(15, y, 195, y); y += 12;
        doc.setTextColor(0);
      };

      renderBloco('Recebido (Pago)', recPagas, [16,120,60], [16,120,60]);
      renderBloco('Pendente (Nao Recebido)', recPend, [200,130,0], [200,130,0]);
      renderBloco('Repassado (Pago)', despesas.filter(l=>l.status==='pago'), [200,0,0], [200,0,0]);
      renderBloco('Repasse Pendente', despesas.filter(l=>l.status==='pendente'), [150,50,0], [150,50,0]);

      rodape();
      doc.save('ArcoReal_' + labelFiltro.replace(/\//g,'_').replace(/ /g,'_') + '.pdf');
      showSuccess('PDF gerado!');
    } catch(e) {
      showError('Erro ao gerar PDF: ' + e.message);
    }
  };

  if (!isOpen) return null;

  const sInp = { background:'var(--color-surface)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',padding:'0.45rem 0.75rem',fontSize:'0.875rem',width:'100%' };

  const blocos = [
    { titulo:'✅ Receitas — Pagas', lancs: recPagas, cor:'#16a34a', tot: totRec },
    { titulo:'⏳ Receitas — Pendentes', lancs: recPend, cor:'#d97706', tot: totPend },
    { titulo:'🔺 Repasses — Pagos', lancs: despesas.filter(l=>l.status==='pago'), cor:'#dc2626', tot: despesas.filter(l=>l.status==='pago').reduce((s,l)=>s+Number(l.valor||0),0) },
    { titulo:'⏳ Repasses — Pendentes', lancs: despesas.filter(l=>l.status==='pendente'), cor:'#b45309', tot: despesas.filter(l=>l.status==='pendente').reduce((s,l)=>s+Number(l.valor||0),0) },
  ].filter(b => b.lancs.length > 0);

  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:'1rem' }}>
      <div style={{ background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-xl)',width:'100%',maxWidth:'860px',maxHeight:'90vh',overflow:'hidden',display:'flex',flexDirection:'column',boxShadow:'0 24px 64px rgba(0,0,0,0.4)' }}>

        {/* Header */}
        <div style={{ background:'linear-gradient(135deg,#1e3a5f,#2d6a9f)',padding:'1.25rem 1.5rem',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
          <div>
            <h2 style={{ color:'#fff',fontWeight:'800',fontSize:'1.2rem',margin:0 }}>🔺 Arco Real — Controle Financeiro</h2>
            <p style={{ color:'rgba(255,255,255,0.75)',margin:'0.2rem 0 0',fontSize:'0.82rem' }}>{lancs.length} registro(s) no período</p>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.15)',border:'none',color:'#fff',borderRadius:'50%',width:'2.25rem',height:'2.25rem',fontSize:'1.3rem',fontWeight:'700',cursor:'pointer' }}>×</button>
        </div>

        <div style={{ flex:1,overflowY:'auto',padding:'1.25rem',display:'flex',flexDirection:'column',gap:'1rem' }}>

          {/* Filtros + ações */}
          <div style={{ display:'flex',gap:'0.5rem',alignItems:'center',flexWrap:'wrap',background:'var(--color-surface-2)',padding:'0.75rem 1rem',borderRadius:'var(--radius-lg)',border:'1px solid var(--color-border)' }}>
            {[['mes','Mês'],['ano','Ano'],['geral','Geral']].map(([v,l]) => (
              <button key={v} onClick={() => setFiltro(v)}
                style={{ padding:'0.35rem 0.9rem',borderRadius:'var(--radius-md)',border:'1px solid',fontWeight:'600',fontSize:'0.82rem',cursor:'pointer',background:filtro===v?'#2d6a9f':'var(--color-surface)',color:filtro===v?'#fff':'var(--color-text)',borderColor:filtro===v?'#2d6a9f':'var(--color-border)' }}>
                {l}
              </button>
            ))}
            {filtro !== 'geral' && <>
              {filtro === 'mes' && (
                <select value={mes} onChange={e=>setMes(parseInt(e.target.value))} style={{...sInp,width:'auto'}}>
                  {MESES.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
                </select>
              )}
              <select value={ano} onChange={e=>setAno(parseInt(e.target.value))} style={{...sInp,width:'auto'}}>
                {[2024,2025,2026,2027].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </>}
            <div style={{ marginLeft:'auto',display:'flex',gap:'0.5rem' }}>
              <button onClick={() => setShowForm(v=>!v)}
                style={{ padding:'0.35rem 0.9rem',borderRadius:'var(--radius-md)',border:'1px solid var(--color-border)',fontWeight:'600',fontSize:'0.82rem',cursor:'pointer',background:showForm?'#16a34a':'var(--color-surface-2)',color:showForm?'#fff':'var(--color-text)' }}>
                {showForm ? '✕ Cancelar' : '+ Novo Lançamento'}
              </button>
              <button onClick={() => setVerLancs(v=>!v)}
                style={{ padding:'0.35rem 0.9rem',borderRadius:'var(--radius-md)',border:'1px solid var(--color-border)',fontWeight:'600',fontSize:'0.82rem',cursor:'pointer',background:verLancs?'var(--color-accent-bg)':'var(--color-surface-2)',color:verLancs?'var(--color-accent)':'var(--color-text)' }}>
                {verLancs ? '📋 Ocultar' : '📋 Ver Lançamentos'}
              </button>
              <button onClick={gerarPDF}
                style={{ padding:'0.35rem 0.9rem',borderRadius:'var(--radius-md)',border:'none',fontWeight:'700',fontSize:'0.82rem',cursor:'pointer',background:'#1e3a5f',color:'#fff' }}>
                📄 PDF
              </button>
            </div>
          </div>

          {/* Formulário novo lançamento */}
          {showForm && (
            <div style={{ background:'var(--color-surface-2)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-xl)',padding:'1rem',display:'flex',flexDirection:'column',gap:'0.75rem' }}>
              <p style={{ margin:0,fontWeight:'700',color:'var(--color-text)',fontSize:'0.9rem' }}>+ Novo Lançamento Manual</p>

              {/* Tipo */}
              <div style={{ display:'flex',gap:'0.5rem' }}>
                {[['receita','✅ Receita (Entrada)'],['despesa','🔺 Repasse (Saída)']].map(([v,l]) => (
                  <button key={v} onClick={() => setForm(f=>({...f,tipo:v}))}
                    style={{ flex:1,padding:'0.45rem',borderRadius:'var(--radius-md)',border:'1px solid',fontWeight:'700',fontSize:'0.82rem',cursor:'pointer',
                      background:form.tipo===v?(v==='receita'?'#16a34a':'#dc2626'):'var(--color-surface)',
                      color:form.tipo===v?'#fff':'var(--color-text)',
                      borderColor:form.tipo===v?(v==='receita'?'#16a34a':'#dc2626'):'var(--color-border)' }}>
                    {l}
                  </button>
                ))}
              </div>

              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem' }}>
                <div style={{ gridColumn:'1 / -1' }}>
                  <label style={{ display:'block',fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',marginBottom:'0.25rem' }}>Descrição *</label>
                  <input value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))}
                    placeholder="Ex: Doação Acácia ao Arco Real" style={sInp} />
                </div>
                <div>
                  <label style={{ display:'block',fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',marginBottom:'0.25rem' }}>Valor *</label>
                  <input type="number" step="0.01" value={form.valor} onChange={e=>setForm(f=>({...f,valor:e.target.value}))}
                    placeholder="0,00" style={sInp} />
                </div>
                <div>
                  <label style={{ display:'block',fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',marginBottom:'0.25rem' }}>Data *</label>
                  <input type="date" value={form.data_vencimento} onChange={e=>setForm(f=>({...f,data_vencimento:e.target.value}))} style={sInp} />
                </div>
                <div style={{ gridColumn:'1 / -1' }}>
                  <label style={{ display:'block',fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',marginBottom:'0.25rem' }}>Status *</label>
                  <div style={{ display:'flex',gap:'0.5rem' }}>
                    {[['pago','✓ Pago/Realizado'],['pendente','⏳ Pendente']].map(([v,l]) => (
                      <button key={v} onClick={() => setForm(f=>({...f,status:v}))}
                        style={{ flex:1,padding:'0.4rem',borderRadius:'var(--radius-md)',border:'1px solid',fontWeight:'600',fontSize:'0.82rem',cursor:'pointer',
                          background:form.status===v?(v==='pago'?'#16a34a':'#d97706'):'var(--color-surface)',
                          color:form.status===v?'#fff':'var(--color-text)',
                          borderColor:form.status===v?(v==='pago'?'#16a34a':'#d97706'):'var(--color-border)' }}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ gridColumn:'1 / -1' }}>
                  <label style={{ display:'block',fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',marginBottom:'0.25rem' }}>Observações</label>
                  <input value={form.observacoes} onChange={e=>setForm(f=>({...f,observacoes:e.target.value}))}
                    placeholder="Opcional" style={sInp} />
                </div>
              </div>

              <button onClick={salvarLancamento} disabled={salvando}
                style={{ padding:'0.6rem',background:form.tipo==='receita'?'#16a34a':'#dc2626',color:'#fff',border:'none',borderRadius:'var(--radius-lg)',fontWeight:'700',cursor:salvando?'not-allowed':'pointer',opacity:salvando?0.7:1 }}>
                {salvando ? 'Salvando...' : '💾 Salvar Lançamento'}
              </button>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign:'center',padding:'2rem',color:'var(--color-text-muted)' }}>Carregando...</div>
          ) : (
            <>
              {/* Cards resumo */}
              <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'0.75rem' }}>
                {[
                  { label:'Recebido (Pago)',  val:totRec,  sub:recPagas.length+' lançamento(s)', cor:'#16a34a',bg:'rgba(22,163,74,0.08)', brd:'rgba(22,163,74,0.3)' },
                  { label:'Pendente',          val:totPend, sub:recPend.length+' lançamento(s)',  cor:'#d97706',bg:'rgba(217,119,6,0.08)',  brd:'rgba(217,119,6,0.3)' },
                  { label:'Repassado',         val:totDesp, sub:despesas.length+' lançamento(s)', cor:'#dc2626',bg:'rgba(220,38,38,0.08)',  brd:'rgba(220,38,38,0.3)' },
                  { label: saldo>0?'Saldo a Repassar':saldo<0?'Repassado a Mais':'Zerado',
                    val:saldo,
                    sub: saldo>0?'Loja deve ao Arco Real':saldo<0?'Loja repassou a mais':'Em dia',
                    cor: saldo>0?'#2563eb':saldo<0?'#dc2626':'#16a34a',
                    bg:  saldo>0?'rgba(37,99,235,0.08)':saldo<0?'rgba(220,38,38,0.08)':'rgba(22,163,74,0.08)',
                    brd: saldo>0?'rgba(37,99,235,0.3)':saldo<0?'rgba(220,38,38,0.3)':'rgba(22,163,74,0.3)' },
                ].map((c,i) => (
                  <div key={i} style={{ background:c.bg,border:'1px solid '+c.brd,borderLeft:'4px solid '+c.cor,borderRadius:'var(--radius-lg)',padding:'1rem' }}>
                    <p style={{ margin:'0 0 0.25rem',fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase' }}>{c.label}</p>
                    <p style={{ margin:'0 0 0.25rem',fontSize:'1.5rem',fontWeight:'800',color:c.cor }}>{fmtR(c.val)}</p>
                    <p style={{ margin:0,fontSize:'0.72rem',color:'var(--color-text-muted)' }}>{c.sub}</p>
                  </div>
                ))}
              </div>

              {/* Lançamentos expandidos */}
              {verLancs && blocos.length > 0 && (
                <div style={{ display:'flex',flexDirection:'column',gap:'0.75rem' }}>
                  {blocos.map((bloco,bi) => (
                    <div key={bi} style={{ background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-xl)',overflow:'hidden' }}>
                      <div style={{ padding:'0.6rem 1rem',borderBottom:'1px solid var(--color-border)',display:'flex',justifyContent:'space-between',alignItems:'center',background:'rgba(0,0,0,0.03)' }}>
                        <span style={{ fontWeight:'700',color:bloco.cor,fontSize:'0.9rem' }}>{bloco.titulo}</span>
                        <span style={{ fontWeight:'800',color:bloco.cor }}>{fmtR(bloco.tot)}</span>
                      </div>
                      {bloco.lancs.map((l,i) => (
                        <div key={l.id} style={{ display:'grid',gridTemplateColumns:'90px 1fr 70px 90px 70px',gap:'0.5rem',padding:'0.5rem 1rem',borderBottom:'1px solid var(--color-border)',background:i%2===0?'var(--color-surface)':'var(--color-surface-2)',fontSize:'0.8rem',alignItems:'center' }}>
                          <span style={{ color:'var(--color-text-muted)' }}>{fmtD(l.data_vencimento)}</span>
                          <span style={{ color:'var(--color-text)',fontWeight:'600' }}>{l.descricao}</span>
                          <span style={{ fontSize:'0.68rem',padding:'0.15rem 0.4rem',borderRadius:'999px',textAlign:'center',fontWeight:'600',
                            background:l.origem==='manual'?'rgba(99,102,241,0.12)':'rgba(100,116,139,0.12)',
                            color:l.origem==='manual'?'#6366f1':'#64748b' }}>
                            {l.origem==='manual'?'Manual':'Loja'}
                          </span>
                          <span style={{ fontWeight:'700',color:bloco.cor,textAlign:'right' }}>{fmtR(l.valor)}</span>
                          <span style={{ fontSize:'0.68rem',color:l.status==='pago'?'#16a34a':'#d97706',textAlign:'center',fontWeight:'600' }}>
                            {l.status==='pago'?'✓ Pago':'⏳ Pend.'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {verLancs && blocos.length === 0 && (
                <p style={{ textAlign:'center',color:'var(--color-text-muted)',padding:'1rem' }}>Nenhum lançamento no período.</p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:'0.75rem 1.5rem',borderTop:'1px solid var(--color-border)',display:'flex',justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'0.5rem 1.5rem',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-lg)',fontWeight:'600',cursor:'pointer' }}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
