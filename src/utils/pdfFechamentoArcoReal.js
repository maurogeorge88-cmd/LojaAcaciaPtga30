import { supabase } from '../supabaseClient';

const MESES = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const fmt = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const labelPeriodo = (p) => {
  if (p.mes === -1) return `1º Semestre ${p.ano}`;
  if (p.mes === -2) return `2º Semestre ${p.ano}`;
  if (p.mes === 0) return `Ano ${p.ano}`;
  return `${MESES[p.mes - 1]} ${p.ano}`;
};

const rangeDoPeriodo = (mes, ano) => {
  if (mes === 0) return { inicio: `${ano}-01-01`, fim: `${ano}-12-31` };
  if (mes === -1) return { inicio: `${ano}-01-01`, fim: `${ano}-06-30` };
  if (mes === -2) return { inicio: `${ano}-07-01`, fim: `${ano}-12-31` };
  const ultimoDia = new Date(ano, mes, 0).getDate();
  return { inicio: `${ano}-${String(mes).padStart(2, '0')}-01`, fim: `${ano}-${String(mes).padStart(2, '0')}-${ultimoDia}` };
};

/**
 * Relatório de Fechamento do Arco Real — mesma estrutura de seções do
 * "Relatório Financeiro — Situação da Loja": Resumo Financeiro / Extrato
 * do Período / Receitas por Categoria / Despesas por Categoria / Resultado
 * por Mês / Pendências / Resumo Geral do Período + Compensações.
 *
 * A separação pago × pendente é o ponto central: os saldos (seções 1, 2,
 * 3, 4, 5, 8) usam SÓ lançamentos com status='pago'; pendências aparecem
 * exclusivamente na seção 6, nunca somadas ao saldo.
 */
export const gerarPDFFechamentoArcoReal = async ({ tipoPeriodo, ano, mes, semestre, logoUrl, showSuccess, showError }) => {
  try {
    showSuccess?.('Gerando fechamento...');
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const mesFiltro = tipoPeriodo === 'mensal' ? mes : tipoPeriodo === 'semestral' ? (semestre === 1 ? -1 : -2) : 0;
    const periodo = { mes: mesFiltro, ano };
    const { inicio, fim } = rangeDoPeriodo(mesFiltro, ano);

    const W = 210, margin = 14, colRight = W - margin;
    let y = 10;

    const COR_ACCENT = [30, 58, 95];
    const COR_VERDE  = [16, 150, 89];
    const COR_VERM   = [220, 38, 38];
    const COR_AZUL   = [37, 99, 235];
    const COR_ROXO   = [124, 58, 237];
    const COR_CINZA  = [107, 114, 128];
    const COR_FUNDO  = [248, 250, 252];
    const COR_FUNDO2 = [241, 245, 249];

    const txt = (text, x, yy, opts = {}) => {
      doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
      doc.setFontSize(opts.size || 9);
      doc.setTextColor(...(opts.color || [30, 30, 30]));
      doc.text(String(text), x, yy, opts.align ? { align: opts.align } : {});
    };
    const linha = (yy, x1 = margin, x2 = colRight, cor = [220, 220, 230]) => {
      doc.setDrawColor(...cor); doc.setLineWidth(0.2); doc.line(x1, yy, x2, yy);
    };
    const rect = (x, yy, w, h, cor, raio = 0) => {
      doc.setFillColor(...cor); doc.roundedRect(x, yy, w, h, raio, raio, 'F');
    };
    const rodape = () => {
      const pg = doc.internal.getNumberOfPages();
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...COR_CINZA);
      doc.text(`Arco Real - Guardioes da Alianca No 04  ·  Fechamento  ·  Emitido em ${new Date().toLocaleDateString('pt-BR')}`, W / 2, 290, { align: 'center' });
      doc.text(`Pagina ${pg}`, colRight, 290, { align: 'right' });
    };
    const novaPageSeNecessario = (altura = 20) => {
      if (y + altura > 275) { doc.addPage(); y = 15; rodape(); }
    };
    const desenharQuadro = (titulo, linhasInfo, corDestaque, linhaFinal) => {
      const alturaLinha = 5.5, alturaTitulo = 7, alturaFinal = 8;
      const alturaTotal = alturaTitulo + linhasInfo.length * alturaLinha + alturaFinal;
      novaPageSeNecessario(alturaTotal + 4);
      rect(margin, y, colRight - margin, alturaTotal, COR_FUNDO, 2);
      doc.setDrawColor(...corDestaque); doc.setLineWidth(0.4);
      doc.rect(margin, y, colRight - margin, alturaTotal, 'S');
      let yy = y + 5;
      txt(titulo, margin + 3, yy, { bold: true, size: 8, color: corDestaque });
      yy += alturaTitulo - 2;
      linhasInfo.forEach(l => {
        txt(l.label, margin + 3, yy, { size: 8, color: [70, 70, 70] });
        txt((l.prefixo || '') + fmt(Math.abs(l.valor)), colRight - 3, yy, { size: 8, color: l.cor || [30, 30, 30], bold: !!l.bold, align: 'right' });
        yy += alturaLinha;
      });
      linha(yy - 3, margin + 3, colRight - 3, [215, 215, 220]);
      txt(linhaFinal.label, margin + 3, yy + 3.5, { bold: true, size: 9, color: corDestaque });
      txt(fmt(linhaFinal.valor), colRight - 3, yy + 3.5, { bold: true, size: 10, color: linhaFinal.valor >= 0 ? corDestaque : COR_VERM, align: 'right' });
      y += alturaTotal + 5;
    };
    const comMoldura = (corBorda, renderFn, alturaCabecalho = 9) => {
      const yIni = y;
      const paginaIni = doc.internal.getNumberOfPages();
      renderFn();
      const paginaFim = doc.internal.getNumberOfPages();
      if (paginaFim === paginaIni) {
        doc.setDrawColor(...corBorda); doc.setLineWidth(0.5);
        doc.rect(margin, yIni + alturaCabecalho, colRight - margin, (y + 2) - (yIni + alturaCabecalho), 'S');
      }
      y += 6;
    };

    // ── Buscar dados ────────────────────────────────────────────────────────
    const buscarPaginado = async (montarQuery) => {
      let todos = [], inicioP = 0; const TAM = 1000;
      while (true) {
        const { data, error } = await montarQuery().range(inicioP, inicioP + TAM - 1);
        if (error) throw error;
        todos = todos.concat(data || []);
        if (!data || data.length < TAM) break;
        inicioP += TAM;
      }
      return todos;
    };

    const selectComCategoria = 'id, tipo, valor, status, data_vencimento, data_pagamento, tipo_pagamento, categoria_manual:categoria_id(nome, tipo, categoria_pai_id)';

    // Lançamentos PAGOS do período selecionado
    const lancsPagos = await buscarPaginado(() =>
      supabase.from('arco_real_lancamentos').select(selectComCategoria)
        .eq('status', 'pago').neq('tipo_pagamento', 'compensacao')
        .gte('data_pagamento', inicio).lte('data_pagamento', fim)
    );

    // Saldo anterior (tudo pago antes do início do período)
    const lancsAnteriores = await buscarPaginado(() =>
      supabase.from('arco_real_lancamentos').select('tipo, valor, tipo_pagamento')
        .eq('status', 'pago').neq('tipo_pagamento', 'compensacao')
        .lt('data_pagamento', inicio)
    );
    const saldoAntBancario = lancsAnteriores.filter(l => l.tipo_pagamento !== 'dinheiro')
      .reduce((s, l) => s + (l.tipo === 'receita' ? 1 : -1) * Number(l.valor || 0), 0);
    const saldoAntFisico = lancsAnteriores.filter(l => l.tipo_pagamento === 'dinheiro')
      .reduce((s, l) => s + (l.tipo === 'receita' ? 1 : -1) * Number(l.valor || 0), 0);

    // Pendências (todas, independente do período — situação atual)
    const lancsPendentes = await buscarPaginado(() =>
      supabase.from('arco_real_lancamentos').select(selectComCategoria).eq('status', 'pendente')
    );

    // Compensações do período (abatimentos)
    const lancsCompensados = await buscarPaginado(() =>
      supabase.from('arco_real_lancamentos').select('tipo, valor')
        .eq('status', 'pago').eq('tipo_pagamento', 'compensacao')
        .gte('data_pagamento', inicio).lte('data_pagamento', fim)
    );

    // Resultado por mês (ano inteiro, sempre — mesmo padrão da Loja)
    const lancsAnoTodo = await buscarPaginado(() =>
      supabase.from('arco_real_lancamentos').select('tipo, valor, data_pagamento')
        .eq('status', 'pago').neq('tipo_pagamento', 'compensacao')
        .gte('data_pagamento', `${ano}-01-01`).lte('data_pagamento', `${ano}-12-31`)
    );

    // ── Cálculos do período ──────────────────────────────────────────────────
    const recBanco  = lancsPagos.filter(l => l.tipo === 'receita' && l.tipo_pagamento !== 'dinheiro').reduce((s, l) => s + Number(l.valor), 0);
    const recCaixa  = lancsPagos.filter(l => l.tipo === 'receita' && l.tipo_pagamento === 'dinheiro').reduce((s, l) => s + Number(l.valor), 0);
    const despBanco = lancsPagos.filter(l => l.tipo === 'despesa' && l.tipo_pagamento !== 'dinheiro').reduce((s, l) => s + Number(l.valor), 0);
    const despCaixa = lancsPagos.filter(l => l.tipo === 'despesa' && l.tipo_pagamento === 'dinheiro').reduce((s, l) => s + Number(l.valor), 0);

    const saldoBancario = saldoAntBancario + recBanco - despBanco;
    const saldoFisico   = saldoAntFisico + recCaixa - despCaixa;
    const saldoAtual    = saldoBancario + saldoFisico;

    // Agrupar por categoria pai → filha
    const agruparPorCategoria = (lista) => {
      const grupos = {};
      lista.forEach(l => {
        const nomeCat = l.categoria_manual?.nome || 'Sem categoria';
        const temPai = !!l.categoria_manual?.categoria_pai_id;
        const chave = temPai ? 'sub' : nomeCat; // se tem pai, nomeCat já é o nome da subcategoria
        // Sem a tabela de categorias-pai carregada, agrupamos por nome direto
        // (funciona bem quando a categoria não tem herança visível aqui).
        if (!grupos[nomeCat]) grupos[nomeCat] = { nome: nomeCat, valor: 0, qtd: 0 };
        grupos[nomeCat].valor += Number(l.valor || 0);
        grupos[nomeCat].qtd += 1;
      });
      return Object.values(grupos).sort((a, b) => b.valor - a.valor);
    };

    const gruposReceitas = agruparPorCategoria(lancsPagos.filter(l => l.tipo === 'receita'));
    const gruposDespesas = agruparPorCategoria(lancsPagos.filter(l => l.tipo === 'despesa'));

    // Resultado por mês
    const dadosMensais = [];
    for (let m = 1; m <= 12; m++) {
      const doMes = lancsAnoTodo.filter(l => l.data_pagamento && parseInt(l.data_pagamento.substring(5, 7)) === m);
      const rec = doMes.filter(l => l.tipo === 'receita').reduce((s, l) => s + Number(l.valor), 0);
      const desp = doMes.filter(l => l.tipo === 'despesa').reduce((s, l) => s + Number(l.valor), 0);
      dadosMensais.push({ mes: MESES[m - 1].substring(0, 3), rec, desp });
    }

    // Pendências
    const pendReceitas = lancsPendentes.filter(l => l.tipo === 'receita');
    const pendDespesas = lancsPendentes.filter(l => l.tipo === 'despesa');
    const totalRecPend  = pendReceitas.reduce((s, l) => s + Number(l.valor), 0);
    const totalDespPend = pendDespesas.reduce((s, l) => s + Number(l.valor), 0);
    const hoje = new Date().toISOString().split('T')[0];
    const recVenc  = pendReceitas.filter(l => l.data_vencimento < hoje).reduce((s, l) => s + Number(l.valor), 0);
    const despVenc = pendDespesas.filter(l => l.data_vencimento < hoje).reduce((s, l) => s + Number(l.valor), 0);
    const saldoProjetado = saldoAtual + totalRecPend - totalDespPend;

    const compRec  = lancsCompensados.filter(l => l.tipo === 'receita').reduce((s, l) => s + Number(l.valor), 0);
    const compDesp = lancsCompensados.filter(l => l.tipo === 'despesa').reduce((s, l) => s + Number(l.valor), 0);

    // ── CABEÇALHO ─────────────────────────────────────────────────────────
    rect(0, 0, W, 28, COR_ACCENT);
    if (logoUrl) { try { doc.addImage(logoUrl, 'PNG', margin, 2, 22, 22); } catch (e) {} }
    txt('Capitulo Guardioes da Alianca No 04', W / 2, 10, { bold: true, size: 13, color: [255, 255, 255], align: 'center' });
    txt('FECHAMENTO FINANCEIRO — ARCO REAL', W / 2, 16, { bold: true, size: 10, color: [200, 210, 255], align: 'center' });
    txt(`Periodo: ${labelPeriodo(periodo)}  ·  Emissao: ${new Date().toLocaleDateString('pt-BR')}`, W / 2, 22, { size: 8, color: [200, 210, 255], align: 'center' });
    y = 34;

    // ── 1. RESUMO FINANCEIRO ──────────────────────────────────────────────
    rect(margin, y, colRight - margin, 6, COR_ACCENT, 2);
    txt('1. RESUMO FINANCEIRO', margin + 3, y + 4.2, { bold: true, size: 9, color: [255, 255, 255] });
    y += 9;

    const padFrame = 3, gapBox = 3, boxH = 24;
    const larguraInterna = (colRight - margin) - padFrame * 2;
    novaPageSeNecessario(boxH + padFrame * 2 + 8);
    rect(margin, y, colRight - margin, boxH + padFrame * 2, COR_FUNDO, 2);
    doc.setDrawColor(...COR_ACCENT); doc.setLineWidth(0.5);
    doc.rect(margin, y, colRight - margin, boxH + padFrame * 2, 'S');
    const yLinha = y + padFrame;
    const xInterno = margin + padFrame;
    const linha1 = [
      { label: 'SALDO BANCARIO', valor: saldoBancario, cor: COR_AZUL },
      { label: 'SALDO FISICO', valor: saldoFisico, cor: [245, 158, 11] },
      { label: 'SALDO ATUAL', valor: saldoAtual, cor: saldoAtual >= 0 ? COR_VERDE : COR_VERM },
    ];
    const boxW1 = (larguraInterna - gapBox * 2) / 3;
    linha1.forEach((b, i) => {
      const bx = xInterno + i * (boxW1 + gapBox);
      rect(bx, yLinha, boxW1, boxH, COR_FUNDO, 2);
      doc.setDrawColor(...COR_ACCENT); doc.setLineWidth(0.5); doc.rect(bx, yLinha, boxW1, boxH, 'S');
      txt(b.label, bx + boxW1 / 2, yLinha + 8, { size: 7.5, color: COR_CINZA, align: 'center' });
      txt(fmt(b.valor), bx + boxW1 / 2, yLinha + 17, { bold: true, size: 11, color: b.cor, align: 'center' });
    });
    y += boxH + padFrame * 2 + 5;

    // ── 2. EXTRATO DO PERÍODO ─────────────────────────────────────────────
    novaPageSeNecessario(60);
    rect(margin, y, colRight - margin, 6, COR_ACCENT, 2);
    txt('2. EXTRATO DO PERIODO', margin + 3, y + 4.2, { bold: true, size: 9, color: [255, 255, 255] });
    y += 9;

    desenharQuadro('CONTA BANCARIA', [
      { label: 'Saldo Anterior', valor: saldoAntBancario, cor: [110, 110, 110] },
      { label: '+ Receitas Bancarias', valor: recBanco, cor: COR_VERDE },
      { label: '- Despesas Bancarias', valor: -despBanco, cor: COR_VERM },
      { label: 'Resultado do Periodo', valor: recBanco - despBanco, cor: (recBanco - despBanco) >= 0 ? COR_VERDE : COR_VERM, prefixo: (recBanco - despBanco) >= 0 ? '+' : '' },
    ], COR_AZUL, { label: '= Saldo Bancario', valor: saldoBancario });

    desenharQuadro('CAIXA FISICO (Dinheiro)', [
      { label: 'Saldo Anterior', valor: saldoAntFisico, cor: [110, 110, 110] },
      { label: '+ Receitas em Dinheiro', valor: recCaixa, cor: COR_VERDE },
      { label: '- Despesas em Dinheiro', valor: -despCaixa, cor: COR_VERM },
    ], [180, 120, 0], { label: '= Saldo Caixa Fisico', valor: saldoFisico });

    novaPageSeNecessario(13);
    rect(margin, y, colRight - margin, 9, COR_FUNDO, 2);
    doc.setDrawColor(...(saldoAtual >= 0 ? COR_VERDE : COR_VERM)); doc.setLineWidth(0.6);
    doc.rect(margin, y, colRight - margin, 9, 'S');
    txt('SALDO TOTAL (Banco + Fisico)', margin + 3, y + 5.5, { bold: true, size: 10 });
    txt(fmt(saldoAtual), colRight - 3, y + 5.5, { bold: true, size: 12, color: saldoAtual >= 0 ? COR_VERDE : COR_VERM, align: 'right' });
    y += 14;

    // ── 3. RECEITAS POR CATEGORIA ─────────────────────────────────────────
    if (gruposReceitas.length > 0) {
      novaPageSeNecessario(20);
      comMoldura(COR_ACCENT, () => {
        rect(margin, y, colRight - margin, 6, COR_ACCENT, 2);
        txt('3. RECEITAS POR CATEGORIA', margin + 3, y + 4.2, { bold: true, size: 9, color: [255, 255, 255] });
        const totalRec = recBanco + recCaixa;
        txt(fmt(totalRec), colRight - 3, y + 4.2, { bold: true, size: 9, color: [200, 255, 220], align: 'right' });
        y += 9;
        gruposReceitas.forEach(g => {
          novaPageSeNecessario(10);
          const pct = (recBanco + recCaixa) > 0 ? (g.valor / (recBanco + recCaixa) * 100).toFixed(1) : '0.0';
          rect(margin, y, colRight - margin, 6, COR_FUNDO2, 1);
          txt(`${g.nome} (${g.qtd})`, margin + 3, y + 4, { bold: true, size: 8.5 });
          txt(`${pct}%`, margin + 110, y + 4, { size: 7.5, color: COR_CINZA });
          txt(fmt(g.valor), colRight - 3, y + 4, { bold: true, size: 8.5, color: COR_VERDE, align: 'right' });
          const barW = 90;
          rect(margin + 3, y + 5, barW, 1.5, [220, 220, 220]);
          rect(margin + 3, y + 5, barW * parseFloat(pct) / 100, 1.5, COR_VERDE);
          y += 8;
        });
      });
    }

    // ── 4. DESPESAS POR CATEGORIA ─────────────────────────────────────────
    if (gruposDespesas.length > 0) {
      novaPageSeNecessario(20);
      comMoldura(COR_ACCENT, () => {
        rect(margin, y, colRight - margin, 6, COR_ACCENT, 2);
        txt('4. DESPESAS POR CATEGORIA', margin + 3, y + 4.2, { bold: true, size: 9, color: [255, 255, 255] });
        const totalDesp = despBanco + despCaixa;
        txt(fmt(totalDesp), colRight - 3, y + 4.2, { bold: true, size: 9, color: [255, 200, 200], align: 'right' });
        y += 9;
        gruposDespesas.forEach(g => {
          novaPageSeNecessario(10);
          const pct = (despBanco + despCaixa) > 0 ? (g.valor / (despBanco + despCaixa) * 100).toFixed(1) : '0.0';
          rect(margin, y, colRight - margin, 6, COR_FUNDO2, 1);
          txt(`${g.nome} (${g.qtd})`, margin + 3, y + 4, { bold: true, size: 8.5 });
          txt(`${pct}%`, margin + 110, y + 4, { size: 7.5, color: COR_CINZA });
          txt(fmt(g.valor), colRight - 3, y + 4, { bold: true, size: 8.5, color: COR_VERM, align: 'right' });
          const barW = 90;
          rect(margin + 3, y + 5, barW, 1.5, [220, 220, 220]);
          rect(margin + 3, y + 5, barW * parseFloat(pct) / 100, 1.5, COR_VERM);
          y += 8;
        });
      });
    }

    // ── 5. RESULTADO POR MÊS ──────────────────────────────────────────────
    const mesesComMov = dadosMensais.filter(m => m.rec + m.desp > 0);
    if (mesesComMov.length > 0) {
      novaPageSeNecessario(20);
      comMoldura(COR_ACCENT, () => {
        rect(margin, y, colRight - margin, 6, COR_ACCENT, 2);
        txt('5. RESULTADO POR MES', margin + 3, y + 4.2, { bold: true, size: 9, color: [255, 255, 255] });
        txt(`Ano ${ano}`, colRight - 3, y + 4.2, { size: 8, color: [200, 210, 255], align: 'right' });
        y += 9;
        rect(margin, y, colRight - margin, 6, COR_ACCENT, 1);
        txt('Mes', margin + 2, y + 4, { size: 7, bold: true, color: [255, 255, 255] });
        txt('Receitas', margin + 55, y + 4, { size: 7, bold: true, color: [255, 255, 255] });
        txt('Despesas', margin + 100, y + 4, { size: 7, bold: true, color: [255, 255, 255] });
        txt('Resultado', margin + 145, y + 4, { size: 7, bold: true, color: [255, 255, 255] });
        y += 7;
        mesesComMov.forEach((m, i) => {
          novaPageSeNecessario(6);
          if (i % 2 === 0) rect(margin, y - 1, colRight - margin, 5.5, COR_FUNDO);
          const res = m.rec - m.desp;
          txt(m.mes, margin + 2, y + 3.5, { size: 7.5, bold: true });
          txt(fmt(m.rec), margin + 55, y + 3.5, { size: 7, color: COR_VERDE });
          txt(fmt(m.desp), margin + 100, y + 3.5, { size: 7, color: COR_VERM });
          txt((res >= 0 ? '+' : '') + fmt(res), margin + 145, y + 3.5, { size: 7.5, bold: true, color: res >= 0 ? COR_VERDE : COR_VERM });
          y += 5.5;
        });
        y += 2;
      });
    }

    // ── 6. PENDÊNCIAS ─────────────────────────────────────────────────────
    if (pendReceitas.length > 0 || pendDespesas.length > 0) {
      novaPageSeNecessario(20);
      comMoldura(COR_ACCENT, () => {
        rect(margin, y, colRight - margin, 6, COR_ACCENT, 2);
        txt('6. PENDENCIAS (situacao atual, fora do periodo)', margin + 3, y + 4.2, { bold: true, size: 8.5, color: [255, 255, 255] });
        y += 9;
        const bw3 = (colRight - margin - 4) / 3;
        [
          { label: 'A Receber', valor: totalRecPend, venc: recVenc, cor: COR_VERDE },
          { label: 'A Pagar', valor: totalDespPend, venc: despVenc, cor: COR_VERM },
          { label: 'Saldo Projetado', valor: saldoProjetado, venc: null, cor: saldoProjetado >= 0 ? COR_ROXO : COR_VERM },
        ].forEach((b, i) => {
          const bx = margin + i * (bw3 + 2);
          rect(bx, y, bw3, 18, COR_FUNDO, 2);
          doc.setDrawColor(...b.cor); doc.setLineWidth(0.4); doc.rect(bx, y, bw3, 18, 'S');
          txt(b.label, bx + bw3 / 2, y + 5, { size: 7.5, color: COR_CINZA, align: 'center' });
          txt(fmt(b.valor), bx + bw3 / 2, y + 10.5, { bold: true, size: 9, color: b.cor, align: 'center' });
          if (b.venc !== null && b.venc > 0) txt(`Vencido: ${fmt(b.venc)}`, bx + bw3 / 2, y + 15, { size: 6.5, color: COR_VERM, align: 'center' });
        });
        y += 22;

        if (pendReceitas.length > 0) {
          novaPageSeNecessario(12);
          rect(margin, y, colRight - margin, 5, [209, 250, 229], 1);
          txt('A Receber por Categoria', margin + 2, y + 3.5, { bold: true, size: 8, color: [4, 120, 87] });
          y += 7;
          agruparPorCategoria(pendReceitas).forEach((g, i) => {
            novaPageSeNecessario(6);
            if (i % 2 === 0) rect(margin, y - 1, colRight - margin, 5.5, COR_FUNDO);
            txt(g.nome, margin + 3, y + 3, { size: 8 });
            txt(fmt(g.valor), colRight - 3, y + 3, { size: 8, color: COR_VERDE, bold: true, align: 'right' });
            y += 5.5;
          });
          y += 3;
        }
        if (pendDespesas.length > 0) {
          novaPageSeNecessario(12);
          rect(margin, y, colRight - margin, 5, [254, 226, 226], 1);
          txt('A Pagar por Categoria', margin + 2, y + 3.5, { bold: true, size: 8, color: [185, 28, 28] });
          y += 7;
          agruparPorCategoria(pendDespesas).forEach((g, i) => {
            novaPageSeNecessario(6);
            if (i % 2 === 0) rect(margin, y - 1, colRight - margin, 5.5, COR_FUNDO);
            txt(g.nome, margin + 3, y + 3, { size: 8 });
            txt(fmt(g.valor), colRight - 3, y + 3, { size: 8, color: COR_VERM, bold: true, align: 'right' });
            y += 5.5;
          });
        }
      });
    }

    // ── 7. RESUMO GERAL DO PERÍODO + COMPENSAÇÕES ─────────────────────────
    novaPageSeNecessario(50);
    rect(margin, y, colRight - margin, 6, COR_ACCENT, 2);
    txt('7. RESUMO GERAL DO PERIODO', margin + 3, y + 4.2, { bold: true, size: 9, color: [255, 255, 255] });
    txt(labelPeriodo(periodo), colRight - 3, y + 4.2, { size: 8, color: [200, 210, 255], align: 'right' });
    y += 9;

    const col2L = margin, col2R = margin + (colRight - margin) / 2 + 1, col2W = (colRight - margin) / 2 - 2;
    rect(col2L, y, col2W, 5.5, [209, 250, 229], 1);
    txt('ENTRADAS', col2L + col2W / 2, y + 3.8, { bold: true, size: 7.5, color: [4, 120, 87], align: 'center' });
    rect(col2R, y, col2W, 5.5, [254, 226, 226], 1);
    txt('SAIDAS', col2R + col2W / 2, y + 3.8, { bold: true, size: 7.5, color: [185, 28, 28], align: 'center' });
    y += 7;

    [{ label: 'Bancarias', e: recBanco, s: despBanco }, { label: 'Dinheiro', e: recCaixa, s: despCaixa }].forEach((l, i) => {
      if (i % 2 === 0) { rect(col2L, y - 1, col2W, 5.5, COR_FUNDO); rect(col2R, y - 1, col2W, 5.5, COR_FUNDO); }
      txt(l.label, col2L + 3, y + 3, { size: 7.5 });
      txt(fmt(l.e), col2L + col2W - 3, y + 3, { size: 7.5, color: COR_VERDE, bold: true, align: 'right' });
      txt(l.label, col2R + 3, y + 3, { size: 7.5 });
      txt(fmt(l.s), col2R + col2W - 3, y + 3, { size: 7.5, color: COR_VERM, bold: true, align: 'right' });
      y += 5.5;
    });
    linha(y, margin, colRight, [180, 180, 200]); y += 1;

    const totalEntradas = recBanco + recCaixa, totalSaidas = despBanco + despCaixa;
    rect(col2L, y, col2W, 7, [209, 250, 229], 1);
    txt('TOTAL ENTRADAS', col2L + 3, y + 5, { bold: true, size: 8, color: [4, 120, 87] });
    txt(fmt(totalEntradas), col2L + col2W - 3, y + 5, { bold: true, size: 9, color: COR_VERDE, align: 'right' });
    rect(col2R, y, col2W, 7, [254, 226, 226], 1);
    txt('TOTAL SAIDAS', col2R + 3, y + 5, { bold: true, size: 8, color: [185, 28, 28] });
    txt(fmt(totalSaidas), col2R + col2W - 3, y + 5, { bold: true, size: 9, color: COR_VERM, align: 'right' });
    y += 10;

    const resultadoPeriodo = totalEntradas - totalSaidas;
    const metW = (colRight - margin - 2) / 2;
    rect(col2L, y, metW, 9, resultadoPeriodo >= 0 ? [209, 250, 229] : [254, 226, 226], 2);
    doc.setDrawColor(...(resultadoPeriodo >= 0 ? COR_VERDE : COR_VERM)); doc.setLineWidth(0.5); doc.rect(col2L, y, metW, 9, 'S');
    txt('RESULTADO DO PERIODO', col2L + 3, y + 4, { size: 7, bold: true });
    txt((resultadoPeriodo >= 0 ? '+' : '') + fmt(resultadoPeriodo), col2L + metW - 3, y + 6.5, { bold: true, size: 9, color: resultadoPeriodo >= 0 ? COR_VERDE : COR_VERM, align: 'right' });
    rect(col2R, y, metW, 9, saldoAtual >= 0 ? [209, 250, 229] : [254, 226, 226], 2);
    doc.setDrawColor(...(saldoAtual >= 0 ? COR_VERDE : COR_VERM)); doc.setLineWidth(0.5); doc.rect(col2R, y, metW, 9, 'S');
    txt('SALDO TOTAL (Banco+Fisico)', col2R + 3, y + 4, { size: 7, bold: true });
    txt(fmt(saldoAtual), col2R + metW - 3, y + 6.5, { bold: true, size: 9.5, color: saldoAtual >= 0 ? COR_VERDE : COR_VERM, align: 'right' });
    y += 13;

    novaPageSeNecessario(30);
    rect(margin, y, colRight - margin, 5.5, [237, 233, 254], 1);
    txt('COMPENSACOES (ABATIMENTOS) DO PERIODO', margin + 3, y + 3.8, { bold: true, size: 8, color: [109, 40, 217] });
    y += 7;
    if (lancsCompensados.length === 0) {
      rect(margin, y, colRight - margin, 7, COR_FUNDO, 1);
      txt('Nenhum abatimento registrado no periodo', (margin + colRight) / 2, y + 4.8, { size: 8, color: COR_CINZA, align: 'center' });
      y += 10;
    } else {
      const cW = (colRight - margin - 3) / 2;
      rect(margin, y, cW, 18, [237, 233, 254], 2);
      doc.setDrawColor(...COR_ROXO); doc.setLineWidth(0.4); doc.rect(margin, y, cW, 18, 'S');
      txt('Debitos de membros abatidos', margin + cW / 2, y + 5.5, { size: 7, color: COR_CINZA, align: 'center' });
      txt(fmt(compRec), margin + cW / 2, y + 12, { bold: true, size: 10, color: COR_ROXO, align: 'center' });
      const cx2 = margin + cW + 3;
      rect(cx2, y, cW, 18, [237, 233, 254], 2);
      doc.setDrawColor(...COR_ROXO); doc.setLineWidth(0.4); doc.rect(cx2, y, cW, 18, 'S');
      txt('Reembolsos abatidos', cx2 + cW / 2, y + 5.5, { size: 7, color: COR_CINZA, align: 'center' });
      txt(fmt(compDesp), cx2 + cW / 2, y + 12, { bold: true, size: 10, color: COR_ROXO, align: 'center' });
      y += 22;
    }

    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) { doc.setPage(i); rodape(); }

    doc.save(`Fechamento_ArcoReal_${labelPeriodo(periodo).replace(/\//g, '_').replace(/ /g, '_')}.pdf`);
    showSuccess?.('Fechamento gerado!');
  } catch (err) {
    console.error('Erro ao gerar fechamento:', err);
    showError?.('Erro ao gerar fechamento: ' + err.message);
  }
};
