import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

const fmtR   = (v) => 'R$ ' + Math.abs(Number(v || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const fmtD   = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const hojeISO = () => { const h = new Date(); return h.getFullYear() + '-' + String(h.getMonth()+1).padStart(2,'0') + '-' + String(h.getDate()).padStart(2,'0'); };
const MESES  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export default function ArcoReal({ isOpen, onClose, showSuccess, showError, modoPagina = false }) {
  const agora = new Date();
  const [lancs, setLancs]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [salvando, setSalvando]             = useState(false);
  const [editandoId, setEditandoId]         = useState(null);
  const [confirmExcluir, setConfirmExcluir] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [anosDisponiveis, setAnosDisponiveis] = useState([agora.getFullYear()]);
  const [totaisGerais, setTotaisGerais] = useState({ saldoAnterior: 0, recebidoGeral: 0, despesaGeral: 0, saldoGeral: 0, pendReceitaGeral: 0, pendDespesaGeral: 0 });
  const [form, setForm]                     = useState({
    tipo: 'receita', descricao: '', valor: '',
    data_vencimento: hojeISO(), status: 'pago', observacoes: '', categoria_id: ''
  });

  // Filtros — mesmo padrão da tela do Finanças da Loja
  const [filtros, setFiltros] = useState({
    mes: 0,                     // 0 = Todos
    ano: agora.getFullYear(),   // sempre um ano específico (nunca "todos")
    tipo: '',                   // '' | 'receita' | 'despesa'
    categoria: '',              // nome da subcategoria
    status: '',                 // '' | 'pago' | 'pendente'
    origem: '',                 // '' | 'manual' | 'loja'
  });

  useEffect(() => { if (isOpen) { carregar(); carregarCategorias(); carregarTotaisGerais(); } }, [isOpen, filtros.mes, filtros.ano, filtros.tipo, filtros.categoria, filtros.status, filtros.origem]);
  useEffect(() => { if (isOpen) carregarAnosDisponiveis(); }, [isOpen]);

  const carregarAnosDisponiveis = async () => {
    try {
      const { data } = await supabase
        .from('arco_real_lancamentos')
        .select('data_vencimento, data_pagamento');
      const anos = new Set();
      (data || []).forEach(l => {
        if (l.data_pagamento) anos.add(parseInt(l.data_pagamento.substring(0, 4), 10));
        if (l.data_vencimento) anos.add(parseInt(l.data_vencimento.substring(0, 4), 10));
      });
      anos.add(agora.getFullYear()); // sempre inclui o ano atual, mesmo sem lançamentos ainda
      setAnosDisponiveis([...anos].sort((a, b) => b - a));
    } catch (e) { setAnosDisponiveis([agora.getFullYear()]); }
  };

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

      const ano = filtros.ano;
      if (filtros.mes && filtros.mes !== 0) {
        const ini = `${ano}-${String(filtros.mes).padStart(2,'0')}-01`;
        const fim = `${ano}-${String(filtros.mes).padStart(2,'0')}-${new Date(ano, filtros.mes, 0).getDate()}`;
        q = q.or(`and(data_pagamento.gte.${ini},data_pagamento.lte.${fim}),and(data_pagamento.is.null,data_vencimento.gte.${ini},data_vencimento.lte.${fim})`);
      } else {
        q = q.or(`and(data_pagamento.gte.${ano}-01-01,data_pagamento.lte.${ano}-12-31),and(data_pagamento.is.null,data_vencimento.gte.${ano}-01-01,data_vencimento.lte.${ano}-12-31)`);
      }

      if (filtros.tipo)   q = q.eq('tipo', filtros.tipo);
      if (filtros.status) q = q.eq('status', filtros.status);
      if (filtros.origem) q = q.eq('origem', filtros.origem);

      const { data, error } = await q;
      if (error) throw error;

      let lista = data || [];
      if (filtros.categoria) {
        lista = lista.filter(l => (subcategoria(l) || 'Sem subcategoria') === filtros.categoria);
      }
      setLancs(lista);
    } catch(e) {
      showError('Erro ao carregar: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Totais gerais (Saldos Atuais / Pendências) ───────────────────────────
  // Saldo Anterior: tudo antes do início do período (mês/ano) selecionado.
  // Saldos Atuais / Pendências: total corrente (sem limite de data), mas
  // respeitando os filtros de Tipo, Categoria e Origem — igual à tabela.
  const carregarTotaisGerais = async () => {
    try {
      const { data, error } = await supabase
        .from('arco_real_lancamentos')
        .select(`
          tipo, valor, status, data_pagamento, data_vencimento, origem,
          categoria_manual:categoria_id(nome),
          lancamento_origem:lancamento_loja_id(categoria_id, categorias_financeiras(nome))
        `);
      if (error) throw error;
      let todos = data || [];

      if (filtros.tipo)   todos = todos.filter(l => l.tipo === filtros.tipo);
      if (filtros.origem) todos = todos.filter(l => l.origem === filtros.origem);
      if (filtros.categoria) {
        todos = todos.filter(l => (subcategoria(l) || 'Sem subcategoria') === filtros.categoria);
      }

      const ano = filtros.ano;
      const dataLimite = filtros.mes && filtros.mes !== 0
        ? `${ano}-${String(filtros.mes).padStart(2,'0')}-01`
        : `${ano}-01-01`;

      const dataEfetiva = (l) => l.data_pagamento || l.data_vencimento;

      const antesDoPeriodo = todos.filter(l => dataEfetiva(l) && dataEfetiva(l) < dataLimite);
      const saldoAnterior = antesDoPeriodo
        .filter(l => l.tipo === 'receita' ? l.status === 'pago' : true)
        .reduce((s, l) => s + (l.tipo === 'receita' ? Number(l.valor||0) : -Number(l.valor||0)), 0);

      const recebidoGeral = todos.filter(l => l.tipo === 'receita' && l.status === 'pago').reduce((s,l)=>s+Number(l.valor||0),0);
      const despesaGeral  = todos.filter(l => l.tipo === 'despesa').reduce((s,l)=>s+Number(l.valor||0),0);
      const pendReceitaGeral = todos.filter(l => l.tipo === 'receita' && l.status === 'pendente').reduce((s,l)=>s+Number(l.valor||0),0);
      const pendDespesaGeral = todos.filter(l => l.tipo === 'despesa' && l.status === 'pendente').reduce((s,l)=>s+Number(l.valor||0),0);

      setTotaisGerais({
        saldoAnterior,
        recebidoGeral,
        despesaGeral,
        saldoGeral: recebidoGeral - despesaGeral,
        pendReceitaGeral,
        pendDespesaGeral,
      });
    } catch (e) {
      console.error('Erro ao carregar totais gerais do Arco Real:', e.message);
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
  const lancsFiltrados = lancs; // filtragem já acontece toda em carregar()

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
      const labelFiltro = (filtros.mes && filtros.mes !== 0 ? MESES[filtros.mes-1] + '/' : 'Ano ') + filtros.ano;
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

  // Página cheia (dentro da área do Arco Real) ou modal (aberto de dentro
  // do Finanças da Loja) — no modo página não existe "moldura" de card
  // nenhuma, tudo fica direto na tela, igual ao Finanças da Loja.
  const wrapperStyle = modoPagina
    ? {}
    : { position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:'1rem' };

  const cardStyle = modoPagina
    ? { background:'transparent' }
    : { background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-xl)',width:'100%',maxWidth:'1200px',maxHeight:'92vh',overflow:'hidden',display:'flex',flexDirection:'column',boxShadow:'0 24px 64px rgba(0,0,0,0.4)' };

  return (
    <div style={wrapperStyle}>
      <div style={cardStyle}>

        {/* Header */}
        <div style={{ background:'linear-gradient(135deg,#1e3a5f,#2d6a9f)',padding:'1.25rem 1.5rem',display:'flex',justifyContent:'space-between',alignItems:'center',borderRadius: modoPagina ? 'var(--radius-xl)' : 0, marginBottom: modoPagina ? '1rem' : 0 }}>
          <div>
            <h2 style={{ color:'#fff',fontWeight:'800',fontSize:'1.2rem',margin:0 }}>🔺 Arco Real — Controle Financeiro</h2>
            <p style={{ color:'rgba(255,255,255,0.75)',margin:'0.2rem 0 0',fontSize:'0.82rem' }}>{lancs.length} registro(s) no período</p>
          </div>
          {!modoPagina && (
            <button onClick={onClose} style={{ background:'rgba(255,255,255,0.15)',border:'none',color:'#fff',borderRadius:'50%',width:'2.25rem',height:'2.25rem',fontSize:'1.3rem',fontWeight:'700',cursor:'pointer' }}>×</button>
          )}
        </div>

        <div style={{ flex:1,overflowY: modoPagina ? 'visible' : 'auto',padding:'1.25rem',display:'flex',flexDirection:'column',gap:'1rem' }}>

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
              {/* LINHA 1: Saldo Anterior | Receitas · Despesas · Saldo */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 3fr', gap:'0.5rem' }}>

              {/* Saldo Anterior */}
              <div style={{ background:'var(--color-surface-2)', border:'1px solid rgba(30,58,95,0.4)', borderRadius:'var(--radius-lg)', padding:'0.6rem 0.75rem', borderTop:'3px solid #1e3a5f' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.5rem' }}>
                    <div style={{ width:'3px', height:'10px', background:'#1e3a5f', borderRadius:'2px' }} />
                    <span style={{ fontSize:'0.62rem', fontWeight:'700', color:'#3b82f6', textTransform:'uppercase', letterSpacing:'0.07em' }}>Saldo Anterior</span>
                  </div>
                  <div style={{ background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-md)', padding:'0.85rem' }}>
                    <p style={{ margin:'0 0 0.25rem', fontSize:'0.72rem', fontWeight:'700', color:'var(--color-text-muted)', textTransform:'uppercase' }}>Saldo Anterior</p>
                    <p style={{ margin:0, fontSize:'1.5rem', fontWeight:'800', color: totaisGerais.saldoAnterior >= 0 ? '#3b82f6' : '#dc2626' }}>{fmtR(totaisGerais.saldoAnterior)}</p>
                  </div>
              </div>

              {/* Receitas · Despesas · Saldo (do período filtrado) */}
              <div style={{ background:'var(--color-surface-2)', border:'1px solid rgba(45,106,159,0.4)', borderRadius:'var(--radius-lg)', padding:'0.6rem 0.75rem', borderTop:'3px solid #2d6a9f' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.5rem' }}>
                  <div style={{ width:'3px', height:'10px', background:'#2d6a9f', borderRadius:'2px' }} />
                  <span style={{ fontSize:'0.62rem', fontWeight:'700', color:'#60a5fa', textTransform:'uppercase', letterSpacing:'0.07em' }}>Receitas · Despesas · Saldo</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label:'Recebido (Pago)',  val:totRec,  sub:recPagas.length+' lançamento(s)', cor:'#16a34a' },
                    { label:'Despesas Arco Real', val:totDesp, sub:despesas.length+' lançamento(s)', cor:'#dc2626' },
                    { label: 'Saldo do Período', val:saldo, sub: saldo>0?'Positivo':saldo<0?'Negativo':'Zerado', cor: saldo>0?'#2563eb':saldo<0?'#dc2626':'#16a34a' },
                  ].map((c,i) => (
                    <div key={i} style={{ background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-md)', padding:'0.85rem' }}>
                      <p style={{ margin:'0 0 0.25rem', fontSize:'0.72rem', fontWeight:'700', color:'var(--color-text-muted)', textTransform:'uppercase' }}>{c.label}</p>
                      <p style={{ margin:'0 0 0.25rem', fontSize:'1.3rem', fontWeight:'800', color:c.cor }}>{fmtR(c.val)}</p>
                      <p style={{ margin:0, fontSize:'0.68rem', color:'var(--color-text-muted)' }}>{c.sub}</p>
                    </div>
                  ))}
                </div>
              </div>
              </div>{/* fim linha 1 */}

              {/* LINHA 2: Saldos Atuais | Pendências */}
              <div style={{ display:'grid', gridTemplateColumns:'3fr 2fr', gap:'0.5rem' }}>

              {/* Saldos Atuais (sempre o total corrente, não filtrado por período) */}
              <div style={{ background:'var(--color-surface-2)', border:'1px solid rgba(59,130,246,0.4)', borderRadius:'var(--radius-lg)', padding:'0.6rem 0.75rem', borderTop:'3px solid #3b82f6' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.5rem' }}>
                  <div style={{ width:'3px', height:'10px', background:'#3b82f6', borderRadius:'2px' }} />
                  <span style={{ fontSize:'0.62rem', fontWeight:'700', color:'#3b82f6', textTransform:'uppercase', letterSpacing:'0.07em' }}>Saldos Atuais</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label:'Recebido (Total)', val:totaisGerais.recebidoGeral, cor:'#16a34a' },
                    { label:'Repassado (Total)', val:totaisGerais.despesaGeral, cor:'#dc2626' },
                    { label:'Saldo Total', val:totaisGerais.saldoGeral, cor: totaisGerais.saldoGeral>0?'#3b82f6':totaisGerais.saldoGeral<0?'#dc2626':'#16a34a' },
                  ].map((c,i) => (
                    <div key={i} style={{ background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-md)', padding:'0.85rem' }}>
                      <p style={{ margin:'0 0 0.25rem', fontSize:'0.72rem', fontWeight:'700', color:'var(--color-text-muted)', textTransform:'uppercase' }}>{c.label}</p>
                      <p style={{ margin:0, fontSize:'1.3rem', fontWeight:'800', color:c.cor }}>{fmtR(c.val)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pendências (sempre o total corrente) */}
              <div style={{ background:'var(--color-surface-2)', border:'1px solid rgba(14,165,233,0.4)', borderRadius:'var(--radius-lg)', padding:'0.6rem 0.75rem', borderTop:'3px solid #0ea5e9' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.5rem' }}>
                  <div style={{ width:'3px', height:'10px', background:'#0ea5e9', borderRadius:'2px' }} />
                  <span style={{ fontSize:'0.62rem', fontWeight:'700', color:'#0ea5e9', textTransform:'uppercase', letterSpacing:'0.07em' }}>Pendências</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div style={{ background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-md)', padding:'0.85rem' }}>
                    <p style={{ margin:'0 0 0.25rem', fontSize:'0.72rem', fontWeight:'700', color:'var(--color-text-muted)', textTransform:'uppercase' }}>A Receber</p>
                    <p style={{ margin:0, fontSize:'1.3rem', fontWeight:'800', color:'#d97706' }}>{fmtR(totaisGerais.pendReceitaGeral)}</p>
                  </div>
                  <div style={{ background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-md)', padding:'0.85rem' }}>
                    <p style={{ margin:'0 0 0.25rem', fontSize:'0.72rem', fontWeight:'700', color:'var(--color-text-muted)', textTransform:'uppercase' }}>A Pagar</p>
                    <p style={{ margin:0, fontSize:'1.3rem', fontWeight:'800', color:'#d97706' }}>{fmtR(totaisGerais.pendDespesaGeral)}</p>
                  </div>
                </div>
              </div>
              </div>{/* fim linha 2 */}

              {/* Filtros — mesmo padrão do Finanças da Loja (abaixo dos quadros) */}
              <div style={{ background:'var(--color-surface-2)',padding:'0.85rem 1rem',borderRadius:'var(--radius-lg)',border:'1px solid var(--color-border)' }}>
                <div style={{ display:'flex',gap:'1rem',alignItems:'flex-end',flexWrap:'wrap' }}>
                  <div>
                    <label style={{ display:'block',fontSize:'0.7rem',fontWeight:'700',color:'var(--color-text-muted)',marginBottom:'0.25rem' }}>Mês</label>
                    <select value={filtros.mes} onChange={e=>setFiltros(f=>({...f,mes:parseInt(e.target.value)}))} style={{...sInp,width:'auto'}}>
                      <option value={0}>Todos</option>
                      {MESES.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display:'block',fontSize:'0.7rem',fontWeight:'700',color:'var(--color-text-muted)',marginBottom:'0.25rem' }}>Ano</label>
                    <select value={filtros.ano} onChange={e=>setFiltros(f=>({...f,ano:parseInt(e.target.value)}))} style={{...sInp,width:'auto'}}>
                      {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display:'block',fontSize:'0.7rem',fontWeight:'700',color:'var(--color-text-muted)',marginBottom:'0.25rem' }}>Tipo</label>
                    <select value={filtros.tipo} onChange={e=>setFiltros(f=>({...f,tipo:e.target.value}))} style={{...sInp,width:'auto'}}>
                      <option value="">Todos</option>
                      <option value="receita">Receita</option>
                      <option value="despesa">Despesa</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display:'block',fontSize:'0.7rem',fontWeight:'700',color:'var(--color-text-muted)',marginBottom:'0.25rem' }}>Categoria</label>
                    <select value={filtros.categoria} onChange={e=>setFiltros(f=>({...f,categoria:e.target.value}))} style={{...sInp,width:'auto',minWidth:'180px'}}>
                      <option value="">Todas</option>
                      {categorias.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                      <option value="Sem subcategoria">Sem subcategoria</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display:'block',fontSize:'0.7rem',fontWeight:'700',color:'var(--color-text-muted)',marginBottom:'0.25rem' }}>Status</label>
                    <select value={filtros.status} onChange={e=>setFiltros(f=>({...f,status:e.target.value}))} style={{...sInp,width:'auto'}}>
                      <option value="">Todos</option>
                      <option value="pago">Pago</option>
                      <option value="pendente">Pendente</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display:'block',fontSize:'0.7rem',fontWeight:'700',color:'var(--color-text-muted)',marginBottom:'0.25rem' }}>Origem</label>
                    <select value={filtros.origem} onChange={e=>setFiltros(f=>({...f,origem:e.target.value}))} style={{...sInp,width:'auto'}}>
                      <option value="">Todas</option>
                      <option value="manual">Manual</option>
                      <option value="loja">Loja</option>
                    </select>
                  </div>
                  <div style={{ marginLeft:'auto',display:'flex',gap:'0.5rem' }}>
                    <button onClick={() => setShowForm(v=>!v)}
                      style={{ padding:'0.45rem 0.9rem',borderRadius:'var(--radius-md)',border:'1px solid var(--color-border)',fontWeight:'600',fontSize:'0.82rem',cursor:'pointer',background:showForm?'#16a34a':'var(--color-surface)',color:showForm?'#fff':'var(--color-text)' }}>
                      {showForm ? '✕ Cancelar' : '+ Novo Lançamento'}
                    </button>
                    <button onClick={gerarPDF}
                      style={{ padding:'0.45rem 0.9rem',borderRadius:'var(--radius-md)',border:'none',fontWeight:'700',fontSize:'0.82rem',cursor:'pointer',background:'#1e3a5f',color:'#fff' }}>
                      📄 PDF
                    </button>
                  </div>
                </div>
              </div>

              {/* Resumo por Subcategoria */}
              {todasSubcategorias.length > 0 && (
                <div style={{ display:'flex',flexDirection:'column',gap:'0.75rem' }}>
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

              {/* Lançamentos — tabela única, mesmo padrão da Loja */}
              {lancsFiltrados.length > 0 && (
                <div style={{ background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-xl)',overflow:'hidden' }}>
                  <div style={{ padding:'0.6rem 1rem',borderBottom:'1px solid var(--color-border)',display:'flex',justifyContent:'space-between',alignItems:'center',background:'var(--color-surface-2)' }}>
                    <span style={{ fontWeight:'700',color:'var(--color-text)',fontSize:'0.9rem' }}>📋 Lançamentos ({lancsFiltrados.length})</span>
                  </div>
                  <div style={{ display:'grid',gridTemplateColumns:'85px minmax(180px,1.4fr) 140px 75px 75px 100px 140px',gap:'0.6rem',padding:'0.5rem 1rem',borderBottom:'1px solid var(--color-border)',background:'var(--color-surface-2)',fontSize:'0.68rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase' }}>
                    <span>Data</span><span>Descrição</span><span>Categoria</span><span>Origem</span><span>Tipo</span><span style={{textAlign:'right'}}>Valor</span><span style={{textAlign:'center'}}>Status / Ações</span>
                  </div>
                  {lancsFiltrados.map((l,i) => (
                    <div key={l.id} style={{ display:'grid',gridTemplateColumns:'85px minmax(180px,1.4fr) 140px 75px 75px 100px 140px',gap:'0.6rem',padding:'0.45rem 1rem',borderBottom:'1px solid var(--color-border)',background:i%2===0?'var(--color-surface)':'var(--color-surface-2)',fontSize:'0.8rem',alignItems:'center' }}>
                      <span style={{ color:'var(--color-text-muted)' }}>{fmtD(l.data_pagamento || l.data_vencimento)}</span>
                      <span style={{ color:'var(--color-text)',fontWeight:'600',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }} title={l.descricao}>{l.descricao}</span>
                      <span style={{ fontSize:'0.72rem',color:'var(--color-text-muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }} title={subcategoria(l) || 'Sem subcategoria'}>
                        {subcategoria(l) || '—'}
                      </span>
                      <span style={{ fontSize:'0.68rem',padding:'0.15rem 0.4rem',borderRadius:'999px',textAlign:'center',fontWeight:'600',
                        background:l.origem==='manual'?'rgba(99,102,241,0.12)':'rgba(100,116,139,0.12)',
                        color:l.origem==='manual'?'#6366f1':'#64748b' }}>
                        {l.origem==='manual'?'Manual':'Loja'}
                      </span>
                      <span style={{ fontSize:'0.68rem',fontWeight:'700',color:l.tipo==='receita'?'#16a34a':'#dc2626' }}>
                        {l.tipo==='receita'?'Receita':'Despesa'}
                      </span>
                      <span style={{ fontWeight:'700',color:l.tipo==='receita'?'#16a34a':'#dc2626',textAlign:'right',whiteSpace:'nowrap' }}>{fmtR(l.valor)}</span>
                      <div style={{ display:'flex',gap:'0.35rem',justifyContent:'flex-end',alignItems:'center',flexWrap:'nowrap' }}>
                        <span style={{ fontSize:'0.65rem',color:l.status==='pago'?'#16a34a':'#d97706',fontWeight:'600',whiteSpace:'nowrap' }}>
                          {l.status==='pago'?'✓ Pago':'⏳ Pend.'}
                        </span>
                        <button onClick={() => abrirEditar(l)} title="Editar"
                          style={{ padding:'0.15rem 0.35rem',background:'var(--color-accent-bg)',color:'var(--color-accent)',border:'1px solid var(--color-accent)',borderRadius:'4px',cursor:'pointer',fontSize:'0.65rem',fontWeight:700,flexShrink:0 }}>
                          ✏️
                        </button>
                        <button onClick={() => setConfirmExcluir(l)} title="Excluir"
                          style={{ padding:'0.15rem 0.35rem',background:'rgba(239,68,68,0.12)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'4px',cursor:'pointer',fontSize:'0.65rem',fontWeight:700,flexShrink:0 }}>
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {lancsFiltrados.length === 0 && (
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
