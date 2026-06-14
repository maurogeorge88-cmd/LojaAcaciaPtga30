import { formatarMoeda } from './formatadores';

const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];
const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const getJsPDF = async () => {
  if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
  const module = await import('jspdf');
  return module.default;
};

const labelPeriodo = (periodo) => {
  if (periodo.ano === 0) return 'Historico Completo';
  if (periodo.mes === -1) return `1o Semestre ${periodo.ano}`;
  if (periodo.mes === -2) return `2o Semestre ${periodo.ano}`;
  if (periodo.mes > 0) return `${MESES[periodo.mes - 1]} ${periodo.ano}`;
  return `Ano ${periodo.ano}`;
};

/**
 * Gera PDF do Relatório Financeiro — Situação Financeira da Loja
 */
export const gerarPDFRelatorioFinanceiro = async ({
  supabase,
  periodoA,
  dadosA,
  saldoAntA,
  caixaFisicoHistorico,
  caixaDetalhes,
  gruposReceitas,
  gruposDespesas,
  dadosMensais,
  pendentes,
  showError,
  showSuccess,
  quadrosOpcionais = { q3: true, q6: true, q7: true },
}) => {
  try {
    showSuccess?.('Gerando PDF...');

    const jsPDF = await getJsPDF();
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // ─── Dados da Loja ────────────────────────────────────────────────────
    let dadosLoja = null;
    try {
      const { data } = await supabase.from('dados_loja').select('*').single();
      dadosLoja = data;
    } catch {}

    const nomeLoja = `${dadosLoja?.nome_loja || 'ARLS Acácia de Paranatinga'} Nº ${dadosLoja?.numero_loja || '30'}`;
    const W = 210; // largura A4
    const margin = 14;
    const colRight = W - margin;
    let y = 10;

    // ─── Cores ────────────────────────────────────────────────────────────
    const COR_ACCENT  = [79, 70, 229];   // indigo
    const COR_VERDE   = [16, 185, 129];
    const COR_VERM    = [239, 68, 68];
    const COR_AZUL    = [59, 130, 246];
    const COR_CINZA   = [107, 114, 128];
    const COR_FUNDO   = [248, 250, 252];
    const COR_FUNDO2  = [241, 245, 249];

    // ─── Helpers ─────────────────────────────────────────────────────────
    const txt = (text, x, yy, opts = {}) => {
      doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
      doc.setFontSize(opts.size || 9);
      doc.setTextColor(...(opts.color || [30, 30, 30]));
      // Sanitizar texto: remover/substituir caracteres problemáticos para jsPDF
      const toAscii = (s) => {
        const map = {
          '\u00e7':'c','\u00c7':'C','\u00e3':'a','\u00c3':'A',
          '\u00f5':'o','\u00d5':'O','\u00e9':'e','\u00ea':'e','\u00e8':'e',
          '\u00c9':'E','\u00ca':'E','\u00c8':'E','\u00e1':'a','\u00e2':'a',
          '\u00e0':'a','\u00c1':'A','\u00c2':'A','\u00c0':'A','\u00f3':'o',
          '\u00f4':'o','\u00f2':'o','\u00d3':'O','\u00d4':'O','\u00d2':'O',
          '\u00fa':'u','\u00fb':'u','\u00f9':'u','\u00da':'U','\u00db':'U',
          '\u00d9':'U','\u00ed':'i','\u00ee':'i','\u00ec':'i','\u00cd':'I',
          '\u00ce':'I','\u00cc':'I','\u00fc':'u','\u00dc':'U','\u00f1':'n',
          '\u00d1':'N','%':'pct','\u2514':'-','\u2518':'-',
        };
        return String(s).split('').map(c => map[c] !== undefined ? map[c] : c.charCodeAt(0) < 128 ? c : '').join('');
      };
      const safe = toAscii(text);
      doc.text(safe, x, yy, opts.align ? { align: opts.align } : {});
    };

    const linha = (yy, x1 = margin, x2 = colRight, cor = [220, 220, 230]) => {
      doc.setDrawColor(...cor);
      doc.setLineWidth(0.2);
      doc.line(x1, yy, x2, yy);
    };

    const rect = (x, yy, w, h, cor, raio = 0) => {
      doc.setFillColor(...cor);
      doc.roundedRect(x, yy, w, h, raio, raio, 'F');
    };

    const novaPageSeNecessario = (alturaNeeded = 20) => {
      if (y + alturaNeeded > 275) {
        doc.addPage();
        y = 15;
        rodape();
      }
    };

    const rodape = () => {
      const pg = doc.internal.getNumberOfPages();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...COR_CINZA);
      doc.text(`${nomeLoja}  ·  Relatório Financeiro  ·  Emitido em ${new Date().toLocaleDateString('pt-BR')}`, W / 2, 290, { align: 'center' });
      doc.text(`Página ${pg}`, colRight, 290, { align: 'right' });
    };

    // ─── CABEÇALHO ────────────────────────────────────────────────────────
    // Faixa azul topo
    rect(0, 0, W, 28, COR_ACCENT);

    // Logo se disponível
    if (dadosLoja?.logo_url) {
      try { doc.addImage(dadosLoja.logo_url, 'PNG', margin, 2, 22, 22); } catch {}
    }

    txt(nomeLoja, W / 2, 10, { bold: true, size: 13, color: [255, 255, 255], align: 'center' });
    txt('RELATÓRIO FINANCEIRO — SITUAÇÃO DA LOJA', W / 2, 16, { bold: true, size: 10, color: [200, 210, 255], align: 'center' });
    txt(`Período: ${labelPeriodo(periodoA)}  ·  Emissão: ${new Date().toLocaleDateString('pt-BR')}`, W / 2, 22, { size: 8, color: [200, 210, 255], align: 'center' });

    y = 34;

    // ─── 1. RESUMO FINANCEIRO ─────────────────────────────────────────────
    rect(margin, y, colRight - margin, 6, COR_ACCENT, 2);
    txt('1. RESUMO FINANCEIRO', margin + 3, y + 4.2, { bold: true, size: 9, color: [255, 255, 255] });
    y += 9;

    // Três caixas: Banco | Caixa | Total
    const boxW = (colRight - margin - 6) / 3;
    const boxes = [
      { label: 'SALDO BANCÁRIO', valor: dadosA.saldoBancario, cor: COR_AZUL },
      { label: 'CAIXA FÍSICO',   valor: caixaFisicoHistorico, cor: [245, 158, 11] },
      { label: 'SALDO TOTAL',    valor: dadosA.saldoBancario + caixaFisicoHistorico, cor: dadosA.saldoBancario + caixaFisicoHistorico >= 0 ? COR_VERDE : COR_VERM },
    ];

    boxes.forEach((b, i) => {
      const bx = margin + i * (boxW + 3);
      rect(bx, y, boxW, 16, COR_FUNDO, 2);
      doc.setDrawColor(...b.cor);
      doc.setLineWidth(0.5);
      doc.rect(bx, y, boxW, 16, 'S');
      txt(b.label, bx + boxW / 2, y + 5.5, { size: 7.5, color: COR_CINZA, align: 'center' });
      txt(formatarMoeda(b.valor), bx + boxW / 2, y + 11.5, { bold: true, size: 10, color: b.cor, align: 'center' });
    });
    y += 20;

    // ─── 2. EXTRATO DO PERÍODO ────────────────────────────────────────────
    novaPageSeNecessario(60);
    rect(margin, y, colRight - margin, 6, COR_ACCENT, 2);
    txt('2. EXTRATO DO PERÍODO', margin + 3, y + 4.2, { bold: true, size: 9, color: [255, 255, 255] });
    y += 9;

    // Conta Bancária
    rect(margin, y, colRight - margin, 5, [219, 234, 254], 1);
    txt('CONTA BANCÁRIA', margin + 2, y + 3.5, { bold: true, size: 8, color: COR_AZUL });
    y += 7;

    const linhasExtrato = [
      { label: 'Saldo Anterior', valor: saldoAntA.bancario, cor: COR_CINZA, negrito: false },
      { label: '+ Receitas Bancárias', valor: dadosA.recBanco, cor: COR_VERDE },
      dadosA.depositos > 0 ? { label: '+ Depósitos (sangrias)', valor: dadosA.depositos, cor: COR_VERDE } : null,
      { label: '− Despesas Bancárias', valor: -dadosA.despBanco, cor: COR_VERM },
    ].filter(Boolean);

    linhasExtrato.forEach((l, i) => {
      if (i % 2 === 0) rect(margin, y - 1, colRight - margin, 5.5, COR_FUNDO);
      txt(l.label, margin + 3, y + 3, { size: 8, color: l.negrito === false ? COR_CINZA : [30,30,30] });
      txt(formatarMoeda(Math.abs(l.valor)), colRight - 3, y + 3, { size: 8, color: l.cor, bold: true, align: 'right' });
      y += 5.5;
    });

    // Linha resultado do período (receitas - despesas)
    const resultadoPeriodo = dadosA.recBanco - dadosA.despBanco;
    const corResultado = resultadoPeriodo >= 0 ? COR_VERDE : COR_VERM;
    rect(margin, y - 1, colRight - margin, 5.5, COR_FUNDO);
    txt('Resultado do Período (Rec. − Desp.)', margin + 3, y + 3, { size: 8, color: [30,30,30] });
    txt((resultadoPeriodo >= 0 ? '+' : '') + formatarMoeda(resultadoPeriodo), colRight - 3, y + 3, { size: 8, color: corResultado, bold: true, align: 'right' });
    y += 5.5;

    linha(y, margin, colRight, COR_AZUL);
    y += 1;
    rect(margin, y, colRight - margin, 6.5, [219, 234, 254], 1);
    txt('= Saldo Bancário', margin + 3, y + 4.5, { bold: true, size: 9, color: COR_AZUL });
    txt(formatarMoeda(dadosA.saldoBancario), colRight - 3, y + 4.5, { bold: true, size: 10, color: dadosA.saldoBancario >= 0 ? COR_AZUL : COR_VERM, align: 'right' });
    y += 10;

    // Caixa Físico
    novaPageSeNecessario(30);
    rect(margin, y, colRight - margin, 5, [254, 243, 199], 1);
    txt('CAIXA FÍSICO (Histórico Completo)', margin + 2, y + 3.5, { bold: true, size: 8, color: [180, 120, 0] });
    y += 7;

    [
      { label: '+ Receitas em Dinheiro', valor: caixaDetalhes?.recDinheiro || 0, cor: COR_VERDE },
      caixaDetalhes?.sangrias > 0 ? { label: '− Sangrias Depositadas', valor: -(caixaDetalhes.sangrias), cor: [245, 158, 11] } : null,
      caixaDetalhes?.despDinheiro > 0 ? { label: '− Despesas em Dinheiro', valor: -(caixaDetalhes.despDinheiro), cor: COR_VERM } : null,
    ].filter(Boolean).forEach((l, i) => {
      if (i % 2 === 0) rect(margin, y - 1, colRight - margin, 5.5, COR_FUNDO);
      txt(l.label, margin + 3, y + 3, { size: 8 });
      txt(formatarMoeda(Math.abs(l.valor)), colRight - 3, y + 3, { size: 8, color: l.cor, bold: true, align: 'right' });
      y += 5.5;
    });

    linha(y, margin, colRight, [245, 158, 11]);
    y += 1;
    rect(margin, y, colRight - margin, 6.5, [254, 243, 199], 1);
    txt('= Saldo Caixa Físico', margin + 3, y + 4.5, { bold: true, size: 9, color: [180, 120, 0] });
    txt(formatarMoeda(caixaFisicoHistorico), colRight - 3, y + 4.5, { bold: true, size: 10, color: caixaFisicoHistorico >= 0 ? [180, 120, 0] : COR_VERM, align: 'right' });
    y += 10;

    // Saldo Total
    const saldoTotal = dadosA.saldoBancario + caixaFisicoHistorico;
    rect(margin, y, colRight - margin, 9, saldoTotal >= 0 ? [209, 250, 229] : [254, 226, 226], 2);
    doc.setDrawColor(...(saldoTotal >= 0 ? COR_VERDE : COR_VERM));
    doc.setLineWidth(0.6);
    doc.rect(margin, y, colRight - margin, 9, 'S');
    txt('SALDO TOTAL (Banco + Caixa)', margin + 3, y + 5.5, { bold: true, size: 10 });
    txt(formatarMoeda(saldoTotal), colRight - 3, y + 5.5, { bold: true, size: 12, color: saldoTotal >= 0 ? COR_VERDE : COR_VERM, align: 'right' });
    y += 14;

    // ─── 3. RESULTADO POR MÊS ─────────────────────────────────────────────
    if (quadrosOpcionais.q3 && periodoA.ano > 0 && dadosMensais?.length > 0) {
      const mesesComMov = dadosMensais.filter(m => m.recBanco + m.recCaixa + m.despBanco + m.despCaixa > 0);
      if (mesesComMov.length > 0) {
        novaPageSeNecessario(20);
        rect(margin, y, colRight - margin, 6, COR_ACCENT, 2);
        txt('3. RESULTADO POR MES', margin + 3, y + 4.2, { bold: true, size: 9, color: [255, 255, 255] });
        txt(`Ano ${periodoA.ano}`, colRight - 3, y + 4.2, { size: 8, color: [200, 210, 255], align: 'right' });
        y += 9;

        // Cabeçalho tabela
        rect(margin, y, colRight - margin, 6, [60, 55, 200], 1);
        const cM = { mes: margin + 2, rec: margin + 33, desp: margin + 76, res: margin + 122, bar: margin + 156 };
        txt('Mes',       cM.mes,  y + 4, { size: 7, bold: true, color: [255,255,255] });
        txt('Receitas',  cM.rec,  y + 4, { size: 7, bold: true, color: [255,255,255] });
        txt('Despesas',  cM.desp, y + 4, { size: 7, bold: true, color: [255,255,255] });
        txt('Resultado', cM.res,  y + 4, { size: 7, bold: true, color: [255,255,255] });
        y += 7;

        // Calcular max absoluto para escala das barras
        const maxAbsRes = Math.max(...mesesComMov.map(m => Math.abs((m.recBanco + m.recCaixa) - (m.despBanco + m.despCaixa))), 1);
        const barMaxW = 26;

        mesesComMov.forEach((m, i) => {
          novaPageSeNecessario(6);
          if (i % 2 === 0) rect(margin, y - 1, colRight - margin, 5.5, COR_FUNDO);
          const recTotal  = m.recBanco + m.recCaixa;
          const despTotal = m.despBanco + m.despCaixa;
          const res = recTotal - despTotal;
          const corRes = res >= 0 ? COR_VERDE : COR_VERM;
          const barW = Math.abs(res) / maxAbsRes * barMaxW;

          txt(m.mes,                             cM.mes,  y + 3.5, { size: 7.5, bold: true });
          txt(formatarMoeda(recTotal),            cM.rec,  y + 3.5, { size: 7,   color: COR_VERDE });
          txt(formatarMoeda(despTotal),           cM.desp, y + 3.5, { size: 7,   color: COR_VERM });
          txt((res >= 0 ? '+' : '') + formatarMoeda(res), cM.res, y + 3.5, { size: 7.5, bold: true, color: corRes });

          // Barra visual do resultado
          rect(cM.bar, y + 1.5, barMaxW, 2.5, [220, 220, 220]);
          if (barW > 0) rect(cM.bar, y + 1.5, barW, 2.5, corRes);
          y += 5.5;
        });

        // Linha total
        novaPageSeNecessario(10);
        linha(y, margin, colRight, COR_ACCENT);
        y += 1;
        rect(margin, y, colRight - margin, 7, [219, 234, 254], 1);
        const totalRecMes  = dadosMensais.reduce((s, m) => s + m.recBanco + m.recCaixa, 0);
        const totalDespMes = dadosMensais.reduce((s, m) => s + m.despBanco + m.despCaixa, 0);
        const totalResMes  = totalRecMes - totalDespMes;
        const corTotalRes  = totalResMes >= 0 ? COR_VERDE : COR_VERM;
        txt('TOTAL', cM.mes, y + 4.5, { bold: true, size: 8 });
        txt(formatarMoeda(totalRecMes),  cM.rec,  y + 4.5, { bold: true, size: 7.5, color: COR_VERDE });
        txt(formatarMoeda(totalDespMes), cM.desp, y + 4.5, { bold: true, size: 7.5, color: COR_VERM });
        txt((totalResMes >= 0 ? '+' : '') + formatarMoeda(totalResMes), cM.res, y + 4.5, { bold: true, size: 8, color: corTotalRes });
        y += 12;
      }
    }

    // ─── 4. RECEITAS POR CATEGORIA ────────────────────────────────────────
    novaPageSeNecessario(20);
    rect(margin, y, colRight - margin, 6, COR_ACCENT, 2);
    txt('4. RECEITAS POR CATEGORIA', margin + 3, y + 4.2, { bold: true, size: 9, color: [255, 255, 255] });
    const totalRec = dadosA.recBanco + dadosA.recCaixa;
    txt(formatarMoeda(totalRec), colRight - 3, y + 4.2, { bold: true, size: 9, color: [200, 255, 220], align: 'right' });
    y += 9;

    gruposReceitas.forEach(g => {
      novaPageSeNecessario(12);
      const pct = totalRec > 0 ? (g.valor / totalRec * 100).toFixed(1) : '0.0';

      rect(margin, y, colRight - margin, 6, COR_FUNDO2, 1);
      txt(g.nome, margin + 3, y + 4, { bold: true, size: 8.5 });
      txt(`${pct}%`, margin + 95, y + 4, { size: 7.5, color: COR_CINZA });
      txt(formatarMoeda(g.valor), colRight - 3, y + 4, { bold: true, size: 8.5, color: COR_VERDE, align: 'right' });

      // Barra de progresso
      const barW = 80;
      rect(margin + 3, y + 5, barW, 1.5, [220, 220, 220]);
      rect(margin + 3, y + 5, barW * parseFloat(pct) / 100, 1.5, COR_VERDE);
      y += 8;

      if (g.filhos?.length > 0) {
        g.filhos.sort((a, b) => b.valor - a.valor).forEach(f => {
          novaPageSeNecessario(6);
          const pctF = g.valor > 0 ? (f.valor / g.valor * 100).toFixed(1) : '0.0';
          txt(`  > ${f.nome}`, margin + 3, y + 3.5, { size: 7.5, color: COR_CINZA });
          txt(`${pctF}%`, margin + 95, y + 3.5, { size: 7, color: COR_CINZA });
          txt(formatarMoeda(f.valor), colRight - 3, y + 3.5, { size: 7.5, color: COR_VERDE, align: 'right' });
          y += 5;
        });
      }
      linha(y, margin, colRight);
      y += 2;
    });

    // ─── 4. DESPESAS POR CATEGORIA ────────────────────────────────────────
    novaPageSeNecessario(20);
    rect(margin, y, colRight - margin, 6, COR_ACCENT, 2);
    txt('5. DESPESAS POR CATEGORIA', margin + 3, y + 4.2, { bold: true, size: 9, color: [255, 255, 255] });
    const totalDesp = dadosA.despBanco + dadosA.despCaixa;
    txt(formatarMoeda(totalDesp), colRight - 3, y + 4.2, { bold: true, size: 9, color: [255, 200, 200], align: 'right' });
    y += 9;

    gruposDespesas.forEach(g => {
      novaPageSeNecessario(12);
      const pct = totalDesp > 0 ? (g.valor / totalDesp * 100).toFixed(1) : '0.0';

      rect(margin, y, colRight - margin, 6, COR_FUNDO2, 1);
      txt(g.nome, margin + 3, y + 4, { bold: true, size: 8.5 });
      txt(`${pct}%`, margin + 95, y + 4, { size: 7.5, color: COR_CINZA });
      txt(formatarMoeda(g.valor), colRight - 3, y + 4, { bold: true, size: 8.5, color: COR_VERM, align: 'right' });

      const barW = 80;
      rect(margin + 3, y + 5, barW, 1.5, [220, 220, 220]);
      rect(margin + 3, y + 5, barW * parseFloat(pct) / 100, 1.5, COR_VERM);
      y += 8;

      if (g.filhos?.length > 0) {
        g.filhos.sort((a, b) => b.valor - a.valor).forEach(f => {
          novaPageSeNecessario(6);
          const pctF = g.valor > 0 ? (f.valor / g.valor * 100).toFixed(1) : '0.0';
          txt(`  > ${f.nome}`, margin + 3, y + 3.5, { size: 7.5, color: COR_CINZA });
          txt(`${pctF}%`, margin + 95, y + 3.5, { size: 7, color: COR_CINZA });
          txt(formatarMoeda(f.valor), colRight - 3, y + 3.5, { size: 7.5, color: COR_VERM, align: 'right' });
          y += 5;
        });
      }
      linha(y, margin, colRight);
      y += 2;
    });

    // ─── 5. EVOLUÇÃO MENSAL ───────────────────────────────────────────────
    if (quadrosOpcionais.q6 && periodoA.ano > 0 && dadosMensais?.length > 0) {
      novaPageSeNecessario(20);
      rect(margin, y, colRight - margin, 6, COR_ACCENT, 2);
      txt('6. EVOLUÇÃO MENSAL', margin + 3, y + 4.2, { bold: true, size: 9, color: [255, 255, 255] });
      txt(`Ano ${periodoA.ano}`, colRight - 3, y + 4.2, { size: 8, color: [200, 210, 255], align: 'right' });
      y += 9;

      // Cabeçalho tabela
      const cols = { mes: 14, recB: 45, recC: 75, despB: 105, despC: 135, saldoB: 165 };
      rect(margin, y, colRight - margin, 6, [79, 70, 229], 1);
      [['Mês', cols.mes], ['Rec. Banco', cols.recB], ['Rec. Caixa', cols.recC],
       ['Desp. Banco', cols.despB], ['Desp. Caixa', cols.despC], ['Saldo Banco', cols.saldoB]
      ].forEach(([h, x]) => txt(h, x, y + 4, { size: 7, bold: true, color: [255,255,255] }));
      y += 7;

      const mesesComDados = dadosMensais.filter(m => m.recBanco + m.recCaixa + m.despBanco + m.despCaixa > 0 || m.mesJaOcorreu);
      mesesComDados.forEach((m, i) => {
        novaPageSeNecessario(6);
        if (i % 2 === 0) rect(margin, y - 1, colRight - margin, 5.5, COR_FUNDO);
        const temMov = m.recBanco + m.recCaixa + m.despBanco + m.despCaixa > 0;
        txt(m.mes, cols.mes, y + 3, { size: 7.5, bold: true });
        txt(temMov ? formatarMoeda(m.recBanco) : '—', cols.recB, y + 3, { size: 7, color: COR_VERDE });
        txt(temMov ? formatarMoeda(m.recCaixa) : '—', cols.recC, y + 3, { size: 7, color: COR_VERDE });
        txt(temMov ? formatarMoeda(m.despBanco) : '—', cols.despB, y + 3, { size: 7, color: COR_VERM });
        txt(temMov ? formatarMoeda(m.despCaixa) : '—', cols.despC, y + 3, { size: 7, color: COR_VERM });
        txt(m.saldoBancario !== null && m.mesJaOcorreu ? formatarMoeda(m.saldoBancario) : '—', cols.saldoB, y + 3, { size: 7, bold: true, color: m.saldoBancario >= 0 ? COR_AZUL : COR_VERM });
        y += 5.5;
      });

      // Linha total
      novaPageSeNecessario(10);
      linha(y, margin, colRight, COR_ACCENT);
      y += 1;
      rect(margin, y, colRight - margin, 7, [219, 234, 254], 1);
      txt('TOTAL', cols.mes, y + 5, { bold: true, size: 8 });
      txt(formatarMoeda(dadosMensais.reduce((s,m)=>s+m.recBanco,0)), cols.recB, y + 5, { bold: true, size: 7.5, color: COR_VERDE });
      txt(formatarMoeda(dadosMensais.reduce((s,m)=>s+m.recCaixa,0)), cols.recC, y + 5, { bold: true, size: 7.5, color: COR_VERDE });
      txt(formatarMoeda(dadosMensais.reduce((s,m)=>s+m.despBanco,0)), cols.despB, y + 5, { bold: true, size: 7.5, color: COR_VERM });
      txt(formatarMoeda(dadosMensais.reduce((s,m)=>s+m.despCaixa,0)), cols.despC, y + 5, { bold: true, size: 7.5, color: COR_VERM });
      txt(formatarMoeda(dadosA.saldoBancario), cols.saldoB, y + 5, { bold: true, size: 8, color: COR_AZUL });
      y += 10;
    }

    // ─── 6. PENDÊNCIAS ───────────────────────────────────────────────────────
    if (quadrosOpcionais.q7 && pendentes && (pendentes.receitas?.length > 0 || pendentes.despesas?.length > 0)) {
      novaPageSeNecessario(20);
      const totalRecPend  = (pendentes.receitas  || []).reduce((s,l) => s + parseFloat(l.valor), 0);
      const totalDespPend = (pendentes.despesas || []).reduce((s,l) => s + parseFloat(l.valor), 0);
      const hoje = new Date().toISOString().split('T')[0];
      const recVenc  = (pendentes.receitas  || []).filter(l => l.data_vencimento < hoje).reduce((s,l) => s + parseFloat(l.valor), 0);
      const despVenc = (pendentes.despesas || []).filter(l => l.data_vencimento < hoje).reduce((s,l) => s + parseFloat(l.valor), 0);
      const saldoProj = dadosA.saldoBancario + caixaFisicoHistorico + totalRecPend - totalDespPend;

      rect(margin, y, colRight - margin, 6, COR_ACCENT, 2);
      txt('7. PENDENCIAS', margin + 3, y + 4.2, { bold: true, size: 9, color: [255, 255, 255] });
      y += 9;

      // Cards resumo
      const bw3 = (colRight - margin - 4) / 3;
      [
        { label: 'A Receber', valor: totalRecPend, venc: recVenc, cor: COR_VERDE },
        { label: 'A Pagar',   valor: totalDespPend, venc: despVenc, cor: COR_VERM },
        { label: 'Saldo Projetado', valor: saldoProj, venc: null, cor: saldoProj >= 0 ? [139,92,246] : COR_VERM },
      ].forEach((b, i) => {
        const bx = margin + i * (bw3 + 2);
        rect(bx, y, bw3, 18, COR_FUNDO, 2);
        doc.setDrawColor(...b.cor); doc.setLineWidth(0.4); doc.rect(bx, y, bw3, 18, 'S');
        txt(b.label, bx + bw3/2, y + 5, { size: 7.5, color: COR_CINZA, align: 'center' });
        txt(formatarMoeda(b.valor), bx + bw3/2, y + 10.5, { bold: true, size: 9, color: b.cor, align: 'center' });
        if (b.venc !== null && b.venc > 0) txt(`Vencido: ${formatarMoeda(b.venc)}`, bx + bw3/2, y + 15, { size: 6.5, color: COR_VERM, align: 'center' });
      });
      y += 22;

      // Tabela receitas pendentes
      if (pendentes.receitas?.length > 0) {
        novaPageSeNecessario(15);
        rect(margin, y, colRight - margin, 5, [209, 250, 229], 1);
        txt('Receitas a Receber por Categoria', margin + 2, y + 3.5, { bold: true, size: 8, color: [4, 120, 87] });
        y += 7;

        const gruposRecPend = {};
        pendentes.receitas.forEach(l => {
          const k = l.cat_nome || 'Sem categoria';
          if (!gruposRecPend[k]) gruposRecPend[k] = { valor: 0, vencido: 0 };
          gruposRecPend[k].valor += parseFloat(l.valor);
          if (l.data_vencimento < hoje) gruposRecPend[k].vencido += parseFloat(l.valor);
        });

        Object.entries(gruposRecPend).sort((a,b) => b[1].valor - a[1].valor).forEach(([nome, g], i) => {
          novaPageSeNecessario(6);
          if (i % 2 === 0) rect(margin, y - 1, colRight - margin, 5.5, COR_FUNDO);
          txt(nome, margin + 3, y + 3, { size: 8 });
          if (g.vencido > 0) txt(`Vencido: ${formatarMoeda(g.vencido)}`, margin + 90, y + 3, { size: 7, color: COR_VERM });
          txt(formatarMoeda(g.valor), colRight - 3, y + 3, { size: 8, color: COR_VERDE, bold: true, align: 'right' });
          y += 5.5;
        });
        linha(y, margin, colRight, COR_VERDE);
        y += 1;
        txt('TOTAL A RECEBER:', margin + 3, y + 4, { bold: true, size: 8 });
        txt(formatarMoeda(totalRecPend), colRight - 3, y + 4, { bold: true, size: 9, color: COR_VERDE, align: 'right' });
        y += 8;
      }

      // Tabela despesas pendentes
      if (pendentes.despesas?.length > 0) {
        novaPageSeNecessario(15);
        rect(margin, y, colRight - margin, 5, [254, 226, 226], 1);
        txt('Despesas a Pagar por Categoria', margin + 2, y + 3.5, { bold: true, size: 8, color: [185, 28, 28] });
        y += 7;

        const gruposDespPend = {};
        pendentes.despesas.forEach(l => {
          const k = l.cat_nome || 'Sem categoria';
          if (!gruposDespPend[k]) gruposDespPend[k] = { valor: 0, vencido: 0 };
          gruposDespPend[k].valor += parseFloat(l.valor);
          if (l.data_vencimento < hoje) gruposDespPend[k].vencido += parseFloat(l.valor);
        });

        Object.entries(gruposDespPend).sort((a,b) => b[1].valor - a[1].valor).forEach(([nome, g], i) => {
          novaPageSeNecessario(6);
          if (i % 2 === 0) rect(margin, y - 1, colRight - margin, 5.5, COR_FUNDO);
          txt(nome, margin + 3, y + 3, { size: 8 });
          if (g.vencido > 0) txt(`Vencido: ${formatarMoeda(g.vencido)}`, margin + 90, y + 3, { size: 7, color: COR_VERM });
          txt(formatarMoeda(g.valor), colRight - 3, y + 3, { size: 8, color: COR_VERM, bold: true, align: 'right' });
          y += 5.5;
        });
        linha(y, margin, colRight, COR_VERM);
        y += 1;
        txt('TOTAL A PAGAR:', margin + 3, y + 4, { bold: true, size: 8 });
        txt(formatarMoeda(totalDespPend), colRight - 3, y + 4, { bold: true, size: 9, color: COR_VERM, align: 'right' });
        y += 8;
      }
    }

    // ─── 8. RESUMO GERAL DO PERÍODO + COMPENSAÇÕES ───────────────────────
    novaPageSeNecessario(70);

    // Buscar compensações do período
    let compensacoesRec = 0, compensacoesDesp = 0, nCompRec = 0, nCompDesp = 0;
    try {
      let qComp = supabase
        .from('lancamentos_loja')
        .select('valor, tipo, data_pagamento, categorias_financeiras(tipo)')
        .eq('tipo_pagamento', 'compensacao')
        .eq('status', 'pago');

      if (periodoA.ano > 0) {
        const anoStr = String(periodoA.ano);
        if (periodoA.mes > 0) {
          const mesStr = String(periodoA.mes).padStart(2, '0');
          qComp = qComp
            .gte('data_pagamento', `${anoStr}-${mesStr}-01`)
            .lte('data_pagamento', `${anoStr}-${mesStr}-31`);
        } else if (periodoA.mes === -1) {
          qComp = qComp.gte('data_pagamento', `${anoStr}-01-01`).lte('data_pagamento', `${anoStr}-06-30`);
        } else if (periodoA.mes === -2) {
          qComp = qComp.gte('data_pagamento', `${anoStr}-07-01`).lte('data_pagamento', `${anoStr}-12-31`);
        } else {
          qComp = qComp.gte('data_pagamento', `${anoStr}-01-01`).lte('data_pagamento', `${anoStr}-12-31`);
        }
      }

      const { data: compData } = await qComp;
      (compData || []).forEach(c => {
        const v = parseFloat(c.valor || 0);
        const catTipo = c.categorias_financeiras?.tipo;
        if (catTipo === 'receita') { compensacoesRec += v; nCompRec++; }
        if (catTipo === 'despesa') { compensacoesDesp += v; nCompDesp++; }
      });
    } catch {}

    const COR_ROXO = [139, 92, 246];

    rect(margin, y, colRight - margin, 6, COR_ACCENT, 2);
    txt('8. RESUMO GERAL DO PERIODO', margin + 3, y + 4.2, { bold: true, size: 9, color: [255, 255, 255] });
    txt(labelPeriodo(periodoA), colRight - 3, y + 4.2, { size: 8, color: [200, 210, 255], align: 'right' });
    y += 9;

    // Bloco receitas/despesas banco e caixa
    const col2L = margin;
    const col2R = margin + (colRight - margin) / 2 + 1;
    const col2W = (colRight - margin) / 2 - 2;

    // Cabeçalho das duas colunas
    rect(col2L, y, col2W, 5.5, [209, 250, 229], 1);
    txt('ENTRADAS', col2L + col2W / 2, y + 3.8, { bold: true, size: 7.5, color: [4, 120, 87], align: 'center' });
    rect(col2R, y, col2W, 5.5, [254, 226, 226], 1);
    txt('SAIDAS', col2R + col2W / 2, y + 3.8, { bold: true, size: 7.5, color: [185, 28, 28], align: 'center' });
    y += 7;

    const totalEntradas = dadosA.recBanco + dadosA.recCaixa;
    const totalSaidas   = dadosA.despBanco + dadosA.despCaixa;
    const saldoPeriodo  = totalEntradas - totalSaidas;

    // Linhas lado a lado
    const linhasResumo = [
      { label: 'Bancarias', entradas: dadosA.recBanco,  saidas: dadosA.despBanco },
      { label: 'Dinheiro',  entradas: dadosA.recCaixa,  saidas: dadosA.despCaixa },
    ];
    linhasResumo.forEach((l, i) => {
      if (i % 2 === 0) {
        rect(col2L, y - 1, col2W, 5.5, COR_FUNDO);
        rect(col2R, y - 1, col2W, 5.5, COR_FUNDO);
      }
      txt(l.label, col2L + 3,  y + 3, { size: 7.5 });
      txt(formatarMoeda(l.entradas), col2L + col2W - 3, y + 3, { size: 7.5, color: COR_VERDE, bold: true, align: 'right' });
      txt(l.label, col2R + 3, y + 3, { size: 7.5 });
      txt(formatarMoeda(l.saidas), col2R + col2W - 3, y + 3, { size: 7.5, color: COR_VERM, bold: true, align: 'right' });
      y += 5.5;
    });

    linha(y, margin, colRight, [180, 180, 200]);
    y += 1;

    // Totais entradas / saidas
    rect(col2L, y, col2W, 7, [209, 250, 229], 1);
    txt('TOTAL ENTRADAS', col2L + 3, y + 5, { bold: true, size: 8, color: [4, 120, 87] });
    txt(formatarMoeda(totalEntradas), col2L + col2W - 3, y + 5, { bold: true, size: 9, color: COR_VERDE, align: 'right' });
    rect(col2R, y, col2W, 7, [254, 226, 226], 1);
    txt('TOTAL SAIDAS', col2R + 3, y + 5, { bold: true, size: 8, color: [185, 28, 28] });
    txt(formatarMoeda(totalSaidas), col2R + col2W - 3, y + 5, { bold: true, size: 9, color: COR_VERM, align: 'right' });
    y += 10;

    // Saldo do período e saldo total — linha única larga
    const corSaldoPer  = saldoPeriodo  >= 0 ? COR_VERDE : COR_VERM;
    const corSaldoTot  = (dadosA.saldoBancario + caixaFisicoHistorico) >= 0 ? COR_VERDE : COR_VERM;
    const saldoTotal8  = dadosA.saldoBancario + caixaFisicoHistorico;
    const metW = (colRight - margin - 2) / 2;

    rect(col2L, y, metW, 9, saldoPeriodo >= 0 ? [209, 250, 229] : [254, 226, 226], 2);
    doc.setDrawColor(...corSaldoPer); doc.setLineWidth(0.5); doc.rect(col2L, y, metW, 9, 'S');
    txt('RESULTADO DO PERIODO', col2L + 3, y + 4, { size: 7, bold: true });
    txt((saldoPeriodo >= 0 ? '+' : '') + formatarMoeda(saldoPeriodo), col2L + metW - 3, y + 6.5, { bold: true, size: 9, color: corSaldoPer, align: 'right' });

    rect(col2R, y, metW, 9, saldoTotal8 >= 0 ? [209, 250, 229] : [254, 226, 226], 2);
    doc.setDrawColor(...corSaldoTot); doc.setLineWidth(0.5); doc.rect(col2R, y, metW, 9, 'S');
    txt('SALDO TOTAL (Banco+Caixa)', col2R + 3, y + 4, { size: 7, bold: true });
    txt(formatarMoeda(saldoTotal8), col2R + metW - 3, y + 6.5, { bold: true, size: 9.5, color: corSaldoTot, align: 'right' });
    y += 13;

    // ── Bloco Compensações ────────────────────────────────────────────────
    novaPageSeNecessario(35);
    rect(margin, y, colRight - margin, 5.5, [237, 233, 254], 1);
    txt('COMPENSACOES DO PERIODO', margin + 3, y + 3.8, { bold: true, size: 8, color: [109, 40, 217] });
    txt('(quitacoes sem movimentacao financeira real)', colRight - 3, y + 3.8, { size: 7, color: [109, 40, 217], align: 'right' });
    y += 7;

    if (nCompRec === 0 && nCompDesp === 0) {
      rect(margin, y, colRight - margin, 7, COR_FUNDO, 1);
      txt('Nenhuma compensacao registrada no periodo', (margin + colRight) / 2, y + 4.8, { size: 8, color: COR_CINZA, align: 'center' });
      y += 10;
    } else {
      // Dois cards lado a lado
      const cW = (colRight - margin - 3) / 2;
      // Card receitas compensadas (débitos de irmãos quitados)
      rect(margin, y, cW, 20, [237, 233, 254], 2);
      doc.setDrawColor(...COR_ROXO); doc.setLineWidth(0.4); doc.rect(margin, y, cW, 20, 'S');
      txt('Debitos de irmaos quitados', margin + cW / 2, y + 5.5, { size: 7, color: COR_CINZA, align: 'center' });
      txt(formatarMoeda(compensacoesRec), margin + cW / 2, y + 12, { bold: true, size: 10, color: COR_ROXO, align: 'center' });
      txt(`${nCompRec} lancamento(s)`, margin + cW / 2, y + 17, { size: 6.5, color: COR_CINZA, align: 'center' });

      // Card despesas compensadas (obrigações da loja quitadas)
      const cx2 = margin + cW + 3;
      rect(cx2, y, cW, 20, [237, 233, 254], 2);
      doc.setDrawColor(...COR_ROXO); doc.setLineWidth(0.4); doc.rect(cx2, y, cW, 20, 'S');
      txt('Obrigacoes da loja quitadas', cx2 + cW / 2, y + 5.5, { size: 7, color: COR_CINZA, align: 'center' });
      txt(formatarMoeda(compensacoesDesp), cx2 + cW / 2, y + 12, { bold: true, size: 10, color: COR_ROXO, align: 'center' });
      txt(`${nCompDesp} lancamento(s)`, cx2 + cW / 2, y + 17, { size: 6.5, color: COR_CINZA, align: 'center' });
      y += 24;

      // Linha explicativa
      rect(margin, y, colRight - margin, 8, COR_FUNDO, 1);
      txt('Obs: compensacoes sao acordos entre debitos de irmaos e obrigacoes da loja, sem transacao financeira real.', margin + 3, y + 3.2, { size: 6.5, color: COR_CINZA });
      txt('Os valores acima nao impactam saldo bancario nem caixa fisico.', margin + 3, y + 6.5, { size: 6.5, color: COR_CINZA });
      y += 11;
    }

    // ─── Rodapé em todas as páginas ───────────────────────────────────────
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      rodape();
    }

    // ─── Última página: rodapé do sistema ─────────────────────────────────
    doc.setPage(totalPages);
    const yFinal = 278;

    // Linha separadora
    doc.setDrawColor(200, 200, 210);
    doc.setLineWidth(0.3);
    doc.line(margin, yFinal, colRight, yFinal);

    // Texto do sistema — lado esquerdo
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(79, 70, 229); // cor accent
    doc.text('SysMacom-MG', margin, yFinal + 4);

    // Texto desenvolvedor — continuação
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 120);
    doc.text('  Sistema de Gestao para Lojas Maconicas', margin + 22, yFinal + 4);

    // Desenvolvedor — centro
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 140);
    doc.text('Desenvolvido por Mauro George', W / 2, yFinal + 4, { align: 'center' });

    // Data/hora — direita
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 140);
    const agora = new Date();
    const dataHora = `${agora.toLocaleDateString('pt-BR')} as ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    doc.text(`Emitido em ${dataHora}`, colRight, yFinal + 4, { align: 'right' });

    doc.setTextColor(0);

    // ─── Salvar ───────────────────────────────────────────────────────────
    const periodo = periodoA.ano === 0 ? 'historico' :
      periodoA.mes > 0 ? `${String(periodoA.mes).padStart(2,'0')}-${periodoA.ano}` : `${periodoA.ano}`;
    doc.save(`relatorio-financeiro-${periodo}.pdf`);
    showSuccess?.(' PDF gerado com sucesso!');

  } catch (err) {
    console.error('Erro ao gerar PDF:', err);
    showError?.('Erro ao gerar PDF: ' + err.message);
  }
};
