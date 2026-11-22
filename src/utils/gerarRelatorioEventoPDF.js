import jsPDF from 'jspdf';
import 'jspdf-autotable';

// ═══════════════════════════════════════════════════════════════════════
// Relatório de Evento Comemorativo (Ágape) — padrão visual da Loja
// Cabeçalho com logo, indicadores, despesas, rateio de irmãos/convidados.
// ═══════════════════════════════════════════════════════════════════════

const AZUL = [30, 58, 138];
const DOURADO = [201, 168, 76];
const CINZA = [100, 116, 139];
const TEXTO = [30, 41, 59];
const VERDE = [22, 163, 74];
const VERMELHO = [220, 38, 38];
const ROXO = [99, 102, 241];
const BORDA = [226, 232, 240];

const fmtData = (d) => (d ? String(d).substring(0, 10).split('-').reverse().join('/') : '—');

// remove emojis/símbolos que a fonte do PDF não desenha (mantém acentos do português)
const limpar = (t) => String(t || '').replace(/[^ -ÿ]/g, '').replace(/\s{2,}/g, ' ').trim();

const linhaLoja = (doc, nomeLoja, y, W) => {
  const partes = ['AUG', '∴', ' E RESP', '∴', ' LOJA SIMB', '∴', ` ${nomeLoja}`];
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
  const lt = 1.9;
  const total = partes.reduce((t, p) => t + (p === '∴' ? lt : doc.getTextWidth(p)), 0);
  let x = (W - total) / 2;
  doc.setTextColor(...AZUL); doc.setFillColor(...AZUL);
  partes.forEach(p => {
    if (p === '∴') {
      const r = 0.32;
      doc.circle(x + lt / 2, y - 2.6, r, 'F');
      doc.circle(x + 0.45, y - 0.55, r, 'F');
      doc.circle(x + lt - 0.45, y - 0.55, r, 'F');
      x += lt;
    } else { doc.text(p, x, y); x += doc.getTextWidth(p); }
  });
};

/**
 * @param {Object} p
 * @param {Object} p.evento            { nome, ano, data_evento }
 * @param {Object} p.dadosLoja
 * @param {string} p.logo              data URL
 * @param {Array}  p.cards             [{ rotulo, valor, sub, cor:[r,g,b] }]  (até 4)
 * @param {Array}  p.resumo            [[rotulo, valor, cor?]]  linhas do resumo financeiro
 * @param {Array}  p.despesas          [{ data, descricao, pago, valor }]
 * @param {string} p.totalDespesas
 * @param {Object} p.irmaos            { linhas:[[nome,cotas,valor,obs]], comObs, subtotal:[cotas,valor] }
 * @param {Object} p.externos          { linhas:[[nome,cotas,valor]], subtotal:[cotas,valor] }
 * @param {Object} p.custoLoja         { linhas:[[...6]], total }
 * @param {string} p.totalRateio
 * @param {Array}  p.notasCusteio      [string]
 * @param {string} p.nomeArquivo
 */
export const gerarRelatorioEventoPDF = ({
  evento, dadosLoja = {}, logo = null, cards = [], resumo = [], despesas = [], totalDespesas = '',
  irmaos = null, externos = null, custoLoja = null, totalRateio = '', notasCusteio = [], nomeArquivo,
}) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const nomeLoja = `ACÁCIA DE PARANATINGA Nº ${dadosLoja?.numero_loja || '30'}`;

  // ── Cabeçalho padrão ──
  let y = 8;
  if (logo) {
    try { doc.addImage(logo, logo.includes('image/png') ? 'PNG' : 'JPEG', (W - 26) / 2, y, 26, 26); } catch (e) { /* sem logo */ }
  }
  y += 31;
  linhaLoja(doc, nomeLoja, y, W);
  y += 5.5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...TEXTO);
  doc.text(`Fundada em ${dadosLoja?.data_fundacao ? fmtData(dadosLoja.data_fundacao) : '20/12/1997'}`, W / 2, y, { align: 'center' });
  y += 4.5;
  doc.setFontSize(8.5); doc.setTextColor(...CINZA);
  doc.text('Sob os auspícios da Sereníssima Grande Loja Maçônica do Estado de Mato Grosso', W / 2, y, { align: 'center' });
  const end = [dadosLoja?.endereco, [dadosLoja?.cidade || 'Paranatinga', dadosLoja?.estado || 'MT'].join('/')].filter(Boolean).join(' — ');
  y += 4;
  doc.text(end, W / 2, y, { align: 'center' });
  y += 4;
  doc.setDrawColor(...DOURADO); doc.setLineWidth(0.8); doc.line(M, y, W - M, y);
  doc.setLineWidth(0.2); doc.line(M, y + 1.2, W - M, y + 1.2);

  // ── Título ──
  y += 8.5;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...AZUL);
  doc.text('RELATÓRIO FINANCEIRO DE EVENTO', W / 2, y, { align: 'center' });
  y += 5.5;
  doc.setFontSize(11); doc.setTextColor(...TEXTO);
  doc.text(`${limpar(evento.nome)} ${evento.ano || ''}`.trim(), W / 2, y, { align: 'center' });
  y += 4.8;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...CINZA);
  doc.text(`${evento.data_evento ? `Data do evento: ${fmtData(evento.data_evento)}   •   ` : ''}Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, W / 2, y, { align: 'center' });
  y += 7;

  const garantir = (h) => { if (y + h > H - 16) { doc.addPage(); y = 16; } };
  const secao = (titulo, cor = AZUL) => {
    garantir(30);
    doc.setFillColor(...cor); doc.rect(M, y, W - 2 * M, 6.5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(255, 255, 255);
    doc.text(titulo.toUpperCase(), M + 3, y + 4.5);
    y += 8.5;
  };
  const baseTabela = (cabecaCor) => ({
    margin: { left: M, right: M, bottom: 16 },
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 1.7, lineColor: BORDA, lineWidth: 0.15, textColor: TEXTO, overflow: 'linebreak' },
    headStyles: { fillColor: cabecaCor, textColor: 255, fontStyle: 'bold', halign: 'center' },
    footStyles: { fillColor: [241, 245, 249], textColor: TEXTO, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    showFoot: 'lastPage',
    rowPageBreak: 'avoid',
  });

  // ── Indicadores (cards) ──
  if (cards.length) {
    const gap = 3;
    const cw = (W - 2 * M - gap * (cards.length - 1)) / cards.length;
    const ch = 19;
    cards.forEach((c, i) => {
      const x = M + i * (cw + gap);
      doc.setFillColor(255, 255, 255); doc.setDrawColor(...BORDA); doc.setLineWidth(0.25);
      doc.roundedRect(x, y, cw, ch, 1.5, 1.5, 'FD');
      doc.setFillColor(...c.cor); doc.rect(x, y + 1, 1.3, ch - 2, 'F');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...CINZA);
      doc.text(c.rotulo.toUpperCase(), x + 4, y + 5);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.setTextColor(...c.cor);
      doc.text(c.valor, x + 4, y + 11.5);
      if (c.sub) { doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...CINZA); doc.text(c.sub, x + 4, y + 16, { maxWidth: cw - 6 }); }
    });
    y += ch + 6;
  }

  // ── Resumo financeiro ──
  if (resumo.length) {
    secao('Resumo financeiro');
    doc.autoTable({
      ...baseTabela(AZUL),
      startY: y,
      body: resumo.map(r => [r[0], r[1]]),
      showHead: false,
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70 }, 1: { halign: 'right' } },
      didParseCell: (d) => {
        const cor = resumo[d.row.index]?.[2];
        if (d.section === 'body' && d.column.index === 1 && cor) { d.cell.styles.textColor = cor; d.cell.styles.fontStyle = 'bold'; }
      },
    });
    y = doc.lastAutoTable.finalY + 7;
  }

  // ── Despesas ──
  if (despesas.length) {
    secao(`Despesas vinculadas (${despesas.length})`);
    doc.autoTable({
      ...baseTabela(AZUL),
      startY: y,
      head: [['Data', 'Descrição', 'Status', 'Valor']],
      body: despesas.map(d => [fmtData(d.data), limpar(d.descricao), d.pago ? 'Pago' : 'Pendente', d.valor]),
      foot: [['', '', 'Total', totalDespesas]],
      columnStyles: { 0: { cellWidth: 22, halign: 'center' }, 2: { cellWidth: 20, halign: 'center' }, 3: { cellWidth: 28, halign: 'right', fontStyle: 'bold' } },
      didParseCell: (d) => {
        if (d.section === 'body' && d.column.index === 2) {
          d.cell.styles.textColor = d.cell.raw === 'Pago' ? VERDE : [217, 119, 6];
          d.cell.styles.fontStyle = 'bold';
        }
        if (d.section === 'foot') d.cell.styles.halign = d.column.index >= 2 ? 'right' : 'left';
      },
    });
    y = doc.lastAutoTable.finalY + 7;
  }

  // ── Irmãos ──
  if (irmaos && irmaos.linhas.length) {
    secao(`Irmãos participantes (${irmaos.linhas.length})`);
    const comObs = irmaos.comObs;
    doc.autoTable({
      ...baseTabela(AZUL),
      startY: y,
      head: [comObs ? ['Irmão', 'Cotas', 'Valor a pagar', 'Observações'] : ['Irmão', 'Cotas', 'Valor a pagar']],
      body: irmaos.linhas,
      foot: [['Subtotal irmãos', irmaos.subtotal[0], irmaos.subtotal[1], ...(comObs ? [''] : [])]],
      columnStyles: comObs
        ? { 1: { cellWidth: 16, halign: 'center' }, 2: { cellWidth: 30, halign: 'right', fontStyle: 'bold' }, 3: { fontSize: 7.5, textColor: CINZA } }
        : { 1: { cellWidth: 20, halign: 'center' }, 2: { cellWidth: 36, halign: 'right', fontStyle: 'bold' } },
      didParseCell: (d) => {
        if (d.section === 'foot' && d.column.index === 1) d.cell.styles.halign = 'center';
        if (d.section === 'foot' && d.column.index === 2) d.cell.styles.halign = 'right';
      },
    });
    y = doc.lastAutoTable.finalY + 7;
  }

  // ── Convidados externos ──
  if (externos && externos.linhas.length) {
    secao(`Convidados externos (${externos.linhas.length})`, ROXO);
    doc.autoTable({
      ...baseTabela(ROXO),
      startY: y,
      head: [['Convidado', 'Cotas', 'Valor a pagar']],
      body: externos.linhas,
      foot: [['Subtotal externos', externos.subtotal[0], externos.subtotal[1]]],
      columnStyles: { 1: { cellWidth: 20, halign: 'center' }, 2: { cellWidth: 36, halign: 'right', fontStyle: 'bold' } },
      didParseCell: (d) => {
        if (d.section === 'foot' && d.column.index === 1) d.cell.styles.halign = 'center';
        if (d.section === 'foot' && d.column.index === 2) d.cell.styles.halign = 'right';
      },
    });
    y = doc.lastAutoTable.finalY + 7;
  }

  // ── Custo da Loja ──
  if (custoLoja && custoLoja.linhas.length) {
    secao('Custo da Loja Acácia — irmãos beneficiados', ROXO);
    doc.autoTable({
      ...baseTabela(ROXO),
      startY: y,
      head: [['Referente a', 'Custo família', 'Condição', 'Irmão paga', 'Custeadores', 'Loja paga']],
      body: custoLoja.linhas,
      foot: [['Subtotal', '', '', '', '', custoLoja.total]],
      styles: { fontSize: 8, cellPadding: 1.6, lineColor: BORDA, lineWidth: 0.15, textColor: TEXTO },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: (d) => { if (d.section === 'foot' && d.column.index === 5) d.cell.styles.halign = 'right'; },
    });
    y = doc.lastAutoTable.finalY + 7;
  }

  // ── Fechamento ──
  if (totalRateio) {
    const linhasNota = notasCusteio.map(t => doc.splitTextToSize(limpar(t), W - 2 * M - 8)).flat();
    const altura = 12 + linhasNota.length * 4.2;
    garantir(altura + 4);
    doc.setFillColor(248, 250, 252); doc.setDrawColor(...DOURADO); doc.setLineWidth(0.4);
    doc.roundedRect(M, y, W - 2 * M, altura, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...AZUL);
    doc.text('TOTAL DO RATEIO', M + 4, y + 7);
    doc.text(totalRateio, W - M - 4, y + 7, { align: 'right' });
    if (linhasNota.length) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...CINZA);
      linhasNota.forEach((t, i) => doc.text(t, M + 4, y + 12.5 + i * 4.2));
    }
    y += altura + 4;
  }

  // ── Rodapé em todas as páginas ──
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...DOURADO); doc.setLineWidth(0.3); doc.line(M, H - 11, W - M, H - 11);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...CINZA);
    doc.text('SysMaçom-MG - Desenvolvedor: Mauro George', M, H - 7);
    doc.text(`Página ${i} de ${total}`, W - M, H - 7, { align: 'right' });
  }

  doc.save(nomeArquivo || `Evento_${limpar(evento.nome).replace(/\s+/g, '_')}_${evento.ano}.pdf`);
};
