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
  const [salvando, setSalvando]             = useState(false);
  const [editandoId, setEditandoId]         = useState(null);
  const [confirmExcluir, setConfirmExcluir] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [filtroSubcategoria, setFiltroSubcategoria] = useState('');
  const [form, setForm]                     = useState({
    tipo: 'receita', descricao: '', valor: '',
    data_vencimento: hojeISO(), status: 'pago', observacoes: '', categoria_id: ''
  });

  useEffect(() => { if (isOpen) { carregar(); carregarCategorias(); } }, [isOpen, filtro, mes, ano]);

  const carregarCategorias = async () => {
    try {
      // 1. Encontrar a(s) categoria(s)-pai "Arco Real" (uma para receita, uma para despesa)
      const { data: pais } = await supabase
        .from('categorias_financeiras')
        .select('id')
        .ilike('nome', 'arco real')
        .is('categoria_pai_id', null);

      const idsPais = (pais || []).map(p => p.id);
      if (idsPais.length === 0) { setCategorias([]); return; }

      // 2. Buscar todas as subcategorias filhas dessas categorias-pai
      const { data } = await supabase
        .from('categorias_financeiras')
        .select('id, nome, tipo, categoria_pai_id')
        .in('categoria_pai_id', idsPais)
        .order('nome');
      setCategorias(data || []);
    } catch (e) { setCategorias([]); }
  };

  // ── Carregar lançamentos da tabela própria ─────────────────────────────────
  const carregar = async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('arco_real_lancamentos')
        .select(`
          *,
          categoria_manual:categoria_id(nome),
          lancamento_origem:lancamento_loja_id(categoria_id, categorias_financeiras(nome))
        `)
        .order('data_pagamento', { ascending: false });

      if (filtro === 'mes') {
        // Buscar mais amplo e filtrar no JS pela data efetiva
        const ini = `${ano}-${String(mes).padStart(2,'0')}-01`;
        const fim = `${ano}-${String(mes).padStart(2,'0')}-${new Date(ano, mes, 0).getDate()}`;
        q = q.or(`and(data_pagamento.gte.${ini},data_pagamento.lte.${fim}),and(data_pagamento.is.null,data_vencimento.gte.${ini},data_vencimento.lte.${fim})`);
      } else if (filtro === 'ano') {
        q = q.or(`and(data_pagamento.gte.${ano}-01-01,data_pagamento.lte.${ano}-12-31),and(data_pagamento.is.null,data_vencimento.gte.${ano}-01-01,data_vencimento.lte.${ano}-12-31)`);
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
        categoria_id:    form.categoria_id || null,
      }]);
      if (error) throw error;
      showSuccess('✅ Lançamento registrado!');
      setForm({ tipo:'receita', descricao:'', valor:'', data_vencimento: hojeISO(), status:'pago', observacoes:'', categoria_id:'' });
      setShowForm(false);
      carregar();
    } catch(e) {
      showError('Erro ao salvar: ' + e.message);
    } finally {
      setSalvando(false);
    }
  };

  // ── Excluir lançamento ────────────────────────────────────────────────────────
  const excluirLancamento = async (id) => {
    try {
      const { error } = await supabase.from('arco_real_lancamentos').delete().eq('id', id);
      if (error) throw error;
      setConfirmExcluir(null);
      showSuccess('🗑️ Lançamento excluído!');
      carregar();
    } catch(e) {
      showError('Erro ao excluir: ' + e.message);
    }
  };

  // ── Abrir edição ───────────────────────────────────────────────────────────
  const abrirEditar = (l) => {
    setEditandoId(l.id);
    setForm({
      tipo:            l.tipo,
      descricao:       l.descricao || '',
      valor:           String(l.valor || ''),
      data_vencimento: l.data_vencimento || hojeISO(),
      status:          l.status || 'pago',
      observacoes:     l.observacoes || '',
      categoria_id:    l.categoria_id || '',
    });
    setShowForm(true);
    // Scroll para o form
    setTimeout(() => document.getElementById('arco-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  // ── Salvar edição ──────────────────────────────────────────────────────────
  const salvarEdicao = async () => {
    if (!form.descricao.trim()) { showError('Informe a descrição.'); return; }
    if (!form.valor || parseFloat(form.valor) <= 0) { showError('Informe um valor válido.'); return; }
    if (!form.data_vencimento) { showError('Informe a data.'); return; }
    setSalvando(true);
    try {
      const { error } = await supabase.from('arco_real_lancamentos').update({
        tipo:            form.tipo,
        descricao:       form.descricao.trim(),
        valor:           parseFloat(form.valor),
        data_vencimento: form.data_vencimento,
        data_pagamento:  form.status === 'pago' ? form.data_vencimento : null,
        status:          form.status,
        observacoes:     form.observacoes.trim() || null,
        categoria_id:    form.categoria_id || null,
      }).eq('id', editandoId);
      if (error) throw error;
      showSuccess('✅ Lançamento atualizado!');
      setEditandoId(null);
      setShowForm(false);
      setForm({ tipo:'receita', descricao:'', valor:'', data_vencimento: hojeISO(), status:'pago', observacoes:'', categoria_id:'' });
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

  // ── Subcategoria (resolvida via join, sem depender do trigger) ─────────────
  const subcategoria = (l) => l.categoria_manual?.nome || l.lancamento_origem?.categorias_financeiras?.nome || null;

  const agruparPorSubcategoria = (lista) => {
    const grupos = {};
    lista.forEach(l => {
      const nome = subcategoria(l) || 'Sem subcategoria';
      if (!grupos[nome]) grupos[nome] = { nome, valor: 0, qtd: 0 };
      grupos[nome].valor += Number(l.valor || 0);
      grupos[nome].qtd += 1;
    });
    return Object.values(grupos).sort((a, b) => b.valor - a.valor);
  };

  const todasSubcategorias = [...new Set(lancs.map(l => subcategoria(l) || 'Sem subcategoria'))].sort();
  const lancsFiltrados = filtroSubcategoria
    ? lancs.filter(l => (subcategoria(l) || 'Sem subcategoria') === filtroSubcategoria)
    : lancs;

  const receitasPorSub = agruparPorSubcategoria(receitas.filter(l => lancsFiltrados.includes(l)));
  const despesasPorSub = agruparPorSubcategoria(despesas.filter(l => lancsFiltrados.includes(l)));

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

      const renderBanner = (titulo, corBanner) => {
        if (y > 260) { doc.addPage(); y = 15; }
        doc.setFillColor(corBanner[0], corBanner[1], corBanner[2]);
        doc.rect(15, y, 180, 8, 'F');
        doc.setTextColor(255,255,255); doc.setFontSize(12); doc.setFont('helvetica','bold');
        doc.text(titulo, 105, y+5.5, { align:'center' });
        doc.setTextColor(0);
        y += 12;
      };

      // Mesmo padrão visual do relatório da Loja: faixa por tipo (Receita/Despesa),
      // sub-faixa por subcategoria, itens, subtotal por subcategoria.
      const renderTipo = (tipo, lista, corBanner, corSubtotal) => {
        const grupos = agruparPorSubcategoria(lista);
        if (grupos.length === 0) return;

        renderBanner(tipo === 'receita' ? 'Receita' : 'Despesa', corBanner);

        grupos.forEach(grupo => {
          if (y > 250) { doc.addPage(); y = 15; }

          // Sub-faixa da subcategoria (mesmo azul claro usado na Loja)
          doc.setFillColor(173,216,230);
          doc.rect(15, y, 180, 6, 'F');
          doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(0);
          doc.text(grupo.nome, 17, y+4.2);
          y += 9;

          // Cabeçalho das colunas
          doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(60);
          doc.text('Data', 17, y); doc.text('Descrição', 43, y);
          doc.text('Origem', 140, y); doc.text('Status', 165, y);
          doc.text('Valor', 192, y, { align:'right' });
          y += 4;
          doc.setDrawColor(180); doc.setLineWidth(0.2); doc.line(15, y, 195, y); y += 3;

          doc.setFont('helvetica','normal');
          const itens = lista.filter(l => (subcategoria(l) || 'Sem subcategoria') === grupo.nome);
          itens.forEach(l => {
            if (y > 275) { doc.addPage(); y = 15; }
            doc.setTextColor(0);
            doc.text(fmtD(l.data_pagamento || l.data_vencimento), 17, y);
            doc.text((l.descricao||'').substring(0,42), 43, y);
            doc.setTextColor(l.origem==='manual'?99:100, l.origem==='manual'?102:100, l.origem==='manual'?241:100);
            doc.text(l.origem==='manual'?'Manual':'Loja', 140, y);
            doc.setTextColor(l.status==='pago'?22:217, l.status==='pago'?163:119, l.status==='pago'?74:6);
            doc.text(l.status==='pago'?'Pago':'Pend.', 165, y);
            doc.setTextColor(corSubtotal[0], corSubtotal[1], corSubtotal[2]);
            doc.text(fmtR(l.valor), 192, y, { align:'right' });
            doc.setTextColor(0);
            y += 5;
          });

          y += 1;
          doc.setDrawColor(0); doc.setLineWidth(0.4); doc.line(15, y, 195, y); y += 4.5;
          doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(0);
          doc.text('Sub Total ' + grupo.nome, 150, y, { align:'right' });
          doc.setTextColor(corSubtotal[0], corSubtotal[1], corSubtotal[2]);
          doc.text(fmtR(grupo.valor), 192, y, { align:'right' });
          doc.setTextColor(0);
          y += 9;
        });
      };

      const receitasParaPDF = lancsFiltrados.filter(l => l.tipo === 'receita');
      const despesasParaPDF = lancsFiltrados.filter(l => l.tipo === 'despesa');

      renderTipo('receita', receitasParaPDF, [33,150,243], [16,120,60]);
      renderTipo('despesa', despesasParaPDF, [154,205,50], [220,38,38]);

      // ── Resumo por Subcategoria (Receita/Despesa) ─────────────────────────
      if (y > 230) { doc.addPage(); y = 15; }
      doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(0);
      doc.text('Resumo por Subcategoria', 15, y); y += 6;

      const receitasPorSubPDF = agruparPorSubcategoria(receitasParaPDF);
      const despesasPorSubPDF = agruparPorSubcategoria(despesasParaPDF);

      if (receitasPorSubPDF.length > 0) {
        doc.setFillColor(33,150,243); doc.rect(15, y, 180, 6, 'F');
        doc.setTextColor(255,255,255); doc.setFontSize(9); doc.setFont('helvetica','bold');
        doc.text('Receitas', 17, y+4.2);
        y += 9;
        doc.setFontSize(8.5); doc.setTextColor(0);
        receitasPorSubPDF.forEach((g,i) => {
          if (y > 275) { doc.addPage(); y = 15; }
          doc.setFillColor(i%2===0?248:255,i%2===0?248:255,i%2===0?248:255); doc.rect(15,y-3.7,180,5,'F');
          doc.setFont('helvetica','normal'); doc.setTextColor(0);
          doc.text(g.nome + ' (' + g.qtd + ')', 17, y);
          doc.setFont('helvetica','bold'); doc.setTextColor(16,120,60);
          doc.text(fmtR(g.valor), 192, y, { align:'right' });
          doc.setTextColor(0);
          y += 5;
        });
        y += 3;
      }

      if (despesasPorSubPDF.length > 0) {
        if (y > 260) { doc.addPage(); y = 15; }
        doc.setFillColor(154,205,50); doc.rect(15, y, 180, 6, 'F');
        doc.setTextColor(255,255,255); doc.setFontSize(9); doc.setFont('helvetica','bold');
        doc.text('Despesas', 17, y+4.2);
        y += 9;
        doc.setFontSize(8.5); doc.setTextColor(0);
        despesasPorSubPDF.forEach((g,i) => {
          if (y > 275) { doc.addPage(); y = 15; }
          doc.setFillColor(i%2===0?248:255,i%2===0?248:255,i%2===0?248:255); doc.rect(15,y-3.7,180,5,'F');
          doc.setFont('helvetica','normal'); doc.setTextColor(0);
          doc.text(g.nome + ' (' + g.qtd + ')', 17, y);
          doc.setFont('helvetica','bold'); doc.setTextColor(220,38,38);
          doc.text(fmtR(g.valor), 192, y, { align:'right' });
          doc.setTextColor(0);
          y += 5;
        });
        y += 3;
      }

      // Saldo do período filtrado
      if (y > 265) { doc.addPage(); y = 15; }
      const saldoPeriodo = receitasParaPDF.reduce((s,l)=>s+Number(l.valor||0),0) - despesasParaPDF.reduce((s,l)=>s+Number(l.valor||0),0);
      doc.setDrawColor(0); doc.setLineWidth(0.4); doc.line(15, y, 195, y); y += 5;
      doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(0);
      doc.text('Saldo do Período', 150, y, { align:'right' });
      doc.setTextColor(saldoPeriodo>0?37:saldoPeriodo<0?220:16, saldoPeriodo>0?99:saldoPeriodo<0?38:120, saldoPeriodo>0?235:saldoPeriodo<0?38:60);
      doc.text(fmtR(saldoPeriodo), 192, y, { align:'right' });
      doc.setTextColor(0);
      y += 12;

      // ── Quadro Resumo (final) ──────────────────────────────────────────────
      if (y > 240) { doc.addPage(); y = 15; }
      doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(0);
      doc.text('Quadro Resumo', 15, y); y += 6;
      [
        { label:'Receitas Arco Real - Pg', val: totRec,  cor:[16,120,60] },
        { label:'Receitas Arco Real - Pend.', val: totPend, cor:[200,130,0] },
        { label:'Despesas Arco Real - Pg', val: totDesp, cor:[200,0,0] },
        { label: 'Saldo', val: saldo, cor: saldo>0?[37,99,235]:saldo<0?[220,38,38]:[16,120,60] },
      ].forEach((lr, i) => {
        const bg = i%2===0?[245,245,245]:[255,255,255]; doc.setFillColor(bg[0], bg[1], bg[2]);
        doc.rect(15, y, 180, 7, 'F');
        doc.setDrawColor(200); doc.setLineWidth(0.2); doc.rect(15, y, 180, 7, 'S');
        doc.setFont('helvetica','bold'); doc.setTextColor(60); doc.setFontSize(9);
        doc.text(lr.label, 20, y+4.5);
        doc.setTextColor(lr.cor[0], lr.cor[1], lr.cor[2]); doc.text(fmtR(lr.val), 192, y+4.5, { align:'right' });
        y += 7;
      });

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
    { titulo:'✅ Receitas — Pagas', lancs: lancsFiltrados.filter(l=>l.tipo==='receita'&&l.status==='pago'), cor:'#16a34a', tot: lancsFiltrados.filter(l=>l.tipo==='receita'&&l.status==='pago').reduce((s,l)=>s+Number(l.valor||0),0) },
    { titulo:'⏳ Receitas — Pendentes', lancs: lancsFiltrados.filter(l=>l.tipo==='receita'&&l.status==='pendente'), cor:'#d97706', tot: lancsFiltrados.filter(l=>l.tipo==='receita'&&l.status==='pendente').reduce((s,l)=>s+Number(l.valor||0),0) },
    { titulo:'🔺 Repasses — Pagos', lancs: lancsFiltrados.filter(l=>l.tipo==='despesa'&&l.status==='pago'), cor:'#dc2626', tot: lancsFiltrados.filter(l=>l.tipo==='despesa'&&l.status==='pago').reduce((s,l)=>s+Number(l.valor||0),0) },
    { titulo:'⏳ Repasses — Pendentes', lancs: lancsFiltrados.filter(l=>l.tipo==='despesa'&&l.status==='pendente'), cor:'#b45309', tot: lancsFiltrados.filter(l=>l.tipo==='despesa'&&l.status==='pendente').reduce((s,l)=>s+Number(l.valor||0),0) },
  ].filter(b => b.lancs.length > 0);

  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:'1rem' }}>
      <div style={{ background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-xl)',width:'100%',maxWidth:'1200px',maxHeight:'92vh',overflow:'hidden',display:'flex',flexDirection:'column',boxShadow:'0 24px 64px rgba(0,0,0,0.4)' }}>

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
            <div id="arco-form" style={{ background:'var(--color-surface-2)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-xl)',padding:'1rem',display:'flex',flexDirection:'column',gap:'0.75rem' }}>
              <p style={{ margin:0,fontWeight:'700',color:'var(--color-text)',fontSize:'0.9rem' }}>
                {editandoId ? '✏️ Editar Lançamento' : '+ Novo Lançamento Manual'}
              </p>

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
                <div style={{ gridColumn:'1 / -1' }}>
                  <label style={{ display:'block',fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',marginBottom:'0.25rem' }}>Subcategoria</label>
                  <select value={form.categoria_id} onChange={e=>setForm(f=>({...f,categoria_id:e.target.value}))} style={sInp}>
                    <option value="">— Sem subcategoria —</option>
                    {categorias.filter(c => c.tipo === form.tipo).map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display:'block',fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',marginBottom:'0.25rem' }}>Valor *</label>
                  <input type="number" step="0.01" value={form.valor} onChange={e=>setForm(f=>({...f,valor:e.target.value}))}
                    placeholder="0,00" style={sInp} />
                </div>
                <div>
                  <label style={{ display:'block',fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',marginBottom:'0.25rem' }}>Data de Pagamento *</label>
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

              <div style={{ display:'flex', gap:'0.5rem' }}>
                <button onClick={editandoId ? salvarEdicao : salvarLancamento} disabled={salvando}
                  style={{ flex:1,padding:'0.6rem',background:form.tipo==='receita'?'#16a34a':'#dc2626',color:'#fff',border:'none',borderRadius:'var(--radius-lg)',fontWeight:'700',cursor:salvando?'not-allowed':'pointer',opacity:salvando?0.7:1 }}>
                  {salvando ? 'Salvando...' : editandoId ? '💾 Salvar Alterações' : '💾 Salvar Lançamento'}
                </button>
                {editandoId && (
                  <button onClick={() => { setEditandoId(null); setShowForm(false); setForm({ tipo:'receita', descricao:'', valor:'', data_vencimento: hojeISO(), status:'pago', observacoes:'', categoria_id:'' }); }}
                    style={{ padding:'0.6rem 1rem',background:'var(--color-surface)',color:'var(--color-text-muted)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-lg)',fontWeight:'600',cursor:'pointer' }}>
                    Cancelar
                  </button>
                )}
              </div>
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
                  { label:'Despesas Arco Real', val:totDesp, sub:despesas.length+' lançamento(s)', cor:'#dc2626',bg:'rgba(220,38,38,0.08)',  brd:'rgba(220,38,38,0.3)' },
                  { label: 'Saldo',
                    val:saldo,
                    sub: saldo>0?'Positivo':saldo<0?'Negativo':'Zerado',
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

              {/* Resumo por Subcategoria */}
              {todasSubcategorias.length > 0 && (
                <div style={{ display:'flex',flexDirection:'column',gap:'0.75rem' }}>
                  <div style={{ display:'flex',alignItems:'center',gap:'0.5rem' }}>
                    <span style={{ fontSize:'0.82rem',fontWeight:'700',color:'var(--color-text-muted)' }}>Filtrar por subcategoria:</span>
                    <select value={filtroSubcategoria} onChange={e => setFiltroSubcategoria(e.target.value)} style={{...sInp,width:'auto',minWidth:'220px'}}>
                      <option value="">Todas</option>
                      {todasSubcategorias.map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem' }}>
                    {/* Receitas por subcategoria */}
                    <div style={{ background:'var(--color-surface-2)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-lg)',overflow:'hidden' }}>
                      <div style={{ padding:'0.5rem 0.85rem',background:'rgba(22,163,74,0.12)',borderBottom:'1px solid var(--color-border)' }}>
                        <span style={{ fontWeight:'700',color:'#16a34a',fontSize:'0.82rem' }}>Receitas por Subcategoria</span>
                      </div>
                      {receitasPorSub.length > 0 ? receitasPorSub.map((g,i) => (
                        <div key={g.nome} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0.5rem 0.85rem',background:i%2===0?'var(--color-surface)':'var(--color-surface-2)',borderBottom:'1px solid var(--color-border)',fontSize:'0.8rem' }}>
                          <span style={{ color:'var(--color-text)' }}>{g.nome} <span style={{ color:'var(--color-text-muted)',fontSize:'0.72rem' }}>({g.qtd})</span></span>
                          <span style={{ fontWeight:'700',color:'#16a34a' }}>{fmtR(g.valor)}</span>
                        </div>
                      )) : <p style={{ padding:'0.75rem',color:'var(--color-text-muted)',fontSize:'0.8rem',margin:0 }}>Nenhuma receita.</p>}
                    </div>

                    {/* Despesas por subcategoria */}
                    <div style={{ background:'var(--color-surface-2)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-lg)',overflow:'hidden' }}>
                      <div style={{ padding:'0.5rem 0.85rem',background:'rgba(220,38,38,0.12)',borderBottom:'1px solid var(--color-border)' }}>
                        <span style={{ fontWeight:'700',color:'#dc2626',fontSize:'0.82rem' }}>Despesas por Subcategoria</span>
                      </div>
                      {despesasPorSub.length > 0 ? despesasPorSub.map((g,i) => (
                        <div key={g.nome} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0.5rem 0.85rem',background:i%2===0?'var(--color-surface)':'var(--color-surface-2)',borderBottom:'1px solid var(--color-border)',fontSize:'0.8rem' }}>
                          <span style={{ color:'var(--color-text)' }}>{g.nome} <span style={{ color:'var(--color-text-muted)',fontSize:'0.72rem' }}>({g.qtd})</span></span>
                          <span style={{ fontWeight:'700',color:'#dc2626' }}>{fmtR(g.valor)}</span>
                        </div>
                      )) : <p style={{ padding:'0.75rem',color:'var(--color-text-muted)',fontSize:'0.8rem',margin:0 }}>Nenhuma despesa.</p>}
                    </div>
                  </div>
                </div>
              )}

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
                        <div key={l.id} style={{ display:'grid',gridTemplateColumns:'90px 1fr 160px 60px 90px 60px auto',gap:'0.5rem',padding:'0.45rem 1rem',borderBottom:'1px solid var(--color-border)',background:i%2===0?'var(--color-surface)':'var(--color-surface-2)',fontSize:'0.8rem',alignItems:'center' }}>
                          <span style={{ color:'var(--color-text-muted)' }}>{fmtD(l.data_pagamento || l.data_vencimento)}</span>
                          <span style={{ color:'var(--color-text)',fontWeight:'600',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{l.descricao}</span>
                          <span style={{ fontSize:'0.72rem',color:'var(--color-text-muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }} title={subcategoria(l) || 'Sem subcategoria'}>
                            {subcategoria(l) || '—'}
                          </span>
                          <span style={{ fontSize:'0.68rem',padding:'0.15rem 0.4rem',borderRadius:'999px',textAlign:'center',fontWeight:'600',
                            background:l.origem==='manual'?'rgba(99,102,241,0.12)':'rgba(100,116,139,0.12)',
                            color:l.origem==='manual'?'#6366f1':'#64748b' }}>
                            {l.origem==='manual'?'Manual':'Loja'}
                          </span>
                          <span style={{ fontWeight:'700',color:bloco.cor,textAlign:'right' }}>{fmtR(l.valor)}</span>
                          <span style={{ fontSize:'0.68rem',color:l.status==='pago'?'#16a34a':'#d97706',textAlign:'center',fontWeight:'600' }}>
                            {l.status==='pago'?'✓ Pago':'⏳ Pend.'}
                          </span>
                          <div style={{ display:'flex',gap:'0.25rem',justifyContent:'flex-end' }}>
                            <button onClick={() => abrirEditar(l)} title="Editar"
                              style={{ padding:'0.2rem 0.4rem',background:'var(--color-accent-bg)',color:'var(--color-accent)',border:'1px solid var(--color-accent)',borderRadius:'4px',cursor:'pointer',fontSize:'0.68rem',fontWeight:700 }}>
                              ✏️
                            </button>
                            <button onClick={() => setConfirmExcluir(l)} title="Excluir"
                              style={{ padding:'0.2rem 0.4rem',background:'rgba(239,68,68,0.12)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'4px',cursor:'pointer',fontSize:'0.68rem',fontWeight:700 }}>
                              🗑️
                            </button>
                          </div>
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

        {/* Confirmar exclusão */}
        {confirmExcluir && (
          <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:10000,padding:'1rem' }}>
            <div style={{ background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-xl)',padding:'1.5rem',maxWidth:'400px',width:'100%' }}>
              <h3 style={{ fontSize:'1rem',fontWeight:700,color:'var(--color-text)',marginBottom:'0.5rem' }}>Excluir lançamento?</h3>
              <p style={{ fontSize:'0.875rem',color:'var(--color-text-muted)',marginBottom:'0.4rem' }}>
                <strong style={{ color:'var(--color-text)' }}>{confirmExcluir.descricao}</strong>
              </p>
              <p style={{ fontSize:'0.82rem',color:'var(--color-text-muted)',marginBottom:'1.25rem' }}>
                {fmtD(confirmExcluir.data_vencimento)} · {fmtR(confirmExcluir.valor)}
                {confirmExcluir.origem === 'loja' && (
                  <span style={{ display:'block',marginTop:'0.5rem',color:'#f59e0b',fontWeight:600 }}>
                    ⚠️ Este registro veio da Loja. Excluir aqui não afeta o lançamento original.
                  </span>
                )}
              </p>
              <div style={{ display:'flex',gap:'0.75rem',justifyContent:'flex-end' }}>
                <button onClick={() => setConfirmExcluir(null)}
                  style={{ padding:'0.55rem 1.1rem',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',background:'transparent',color:'var(--color-text-muted)',cursor:'pointer' }}>
                  Cancelar
                </button>
                <button onClick={() => excluirLancamento(confirmExcluir.id)}
                  style={{ padding:'0.55rem 1.25rem',borderRadius:'var(--radius-md)',background:'rgba(239,68,68,0.15)',border:'1px solid rgba(239,68,68,0.4)',color:'#ef4444',fontWeight:600,cursor:'pointer' }}>
                  Confirmar Exclusão
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding:'0.75rem 1.5rem',borderTop:'1px solid var(--color-border)',display:'flex',justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'0.5rem 1.5rem',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-lg)',fontWeight:'600',cursor:'pointer' }}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
