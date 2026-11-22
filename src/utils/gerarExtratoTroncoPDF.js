import jsPDF from 'jspdf';
import 'jspdf-autotable';

// ═══════════════════════════════════════════════════════════════════════
// Extrato do Tronco de Solidariedade — padrão visual da Loja
// ═══════════════════════════════════════════════════════════════════════

const AZUL = [30, 58, 138];
const DOURADO = [201, 168, 76];
const CINZA = [100, 116, 139];
const TEXTO = [30, 41, 59];
const VERDE = [22, 163, 74];
const VERMELHO = [220, 38, 38];
const BORDA = [226, 232, 240];

const fmtData = (d) => (d ? String(d).substring(0, 10).split('-').reverse().join('/') : '—');
const brl = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
 * @param {Array}  p.linhas   [{ data_pagamento, descricao, tipo_pagamento, rec, v, eh_transferencia_interna, saldo }]
 * @param {string} p.periodo  texto do período
 * @param {string} p.filtroTexto  texto pesquisado (opcional)
 * @param {number|null} p.saldoAnterior
 * @param {Object} p.saldos   { banco, especie, total } atuais
 */
export const gerarExtratoTroncoPDF = ({ linhas = [], periodo = '', filtroTexto = '', saldoAnterior = null, saldos = {}, dadosLoja = {}, logo = null }) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const nomeLoja = `ACÁCIA DE PARANATINGA Nº ${dadosLoja?.numero_loja || '30'}`;

  let y = 8;
  if (logo) { try { doc.addImage(logo, logo.includes('image/png') ? 'PNG' : 'JPEG', (W - 26) / 2, y, 26, 26); } catch (e) { /* sem logo */ } }
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

  y += 8.5;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...AZUL);
  doc.text('EXTRATO DO TRONCO DE SOLIDARIEDADE', W / 2, y, { align: 'center' });
  y += 5.2;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...CINZA);
  doc.text(`Período: ${periodo}${filtroTexto ? `   •   Busca: "${limpar(filtroTexto)}"` : ''}`, W / 2, y, { align: 'center' });
  y += 4.2;
  doc.setFontSize(8);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, W / 2, y, { align: 'center' });
  y += 6;

  // ── Cards ──
  const entradas = linhas.filter(l => l.rec && !l.eh_transferencia_interna).reduce((t, l) => t + l.v, 0);
  const saidas = linhas.filter(l => !l.rec && !l.eh_transferencia_interna).reduce((t, l) => t + l.v, 0);
  const cards = [
    { r: 'Entradas', v: brl(entradas), c: VERDE },
    { r: 'Saídas', v: brl(saidas), c: VERMELHO },
    { r: 'Saldo banco (atual)', v: brl(saldos.banco), c: AZUL },
    { r: 'Saldo espécie (atual)', v: brl(saldos.especie), c: VERDE },
    { r: 'Saldo total (atual)', v: brl(saldos.total), c: TEXTO },
  ];
  const gap = 2.5;
  const cw = (W - 2 * M - gap * (cards.length - 1)) / cards.length;
  cards.forEach((c, i) => {
    const x = M + i * (cw + gap);
    doc.setFillColor(255, 255, 255); doc.setDrawColor(...BORDA); doc.setLineWidth(0.25);
    doc.roundedRect(x, y, cw, 15, 1.5, 1.5, 'FD');
    doc.setFillColor(...c.c); doc.rect(x, y + 1, 1.2, 13, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...CINZA);
    doc.text(c.r.toUpperCase(), x + 3.5, y + 5);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...c.c);
    doc.text(c.v, x + 3.5, y + 11);
  });
  y += 20;

  // ── Tabela ──
  const body = [];
  if (saldoAnterior !== null) body.push([{ content: 'Saldo anterior ao período', colSpan: 5, styles: { fontStyle: 'italic', textColor: CINZA } }, brl(saldoAnterior)]);
  linhas.forEach(l => body.push([
    fmtData(l.data_pagamento),
    limpar(l.descricao) + (l.eh_transferencia_interna ? '  (interna)' : ''),
    l.tipo_pagamento === 'dinheiro' ? 'Espécie' : 'Banco',
    l.rec ? brl(l.v) : '',
    !l.rec ? brl(l.v) : '',
    brl(l.saldo),
  ]));
  if (!linhas.length) body.push([{ content: 'Nenhuma movimentação no período.', colSpan: 6, styles: { halign: 'center', textColor: CINZA } }]);

  doc.autoTable({
    startY: y,
    head: [['Data', 'Descrição', 'Forma', 'Entrada', 'Saída', 'Saldo']],
    body,
    foot: [['', 'TOTAIS DO PERÍODO', '', brl(entradas), brl(saidas), '']],
    showFoot: 'lastPage',
    margin: { left: M, right: M, bottom: 18 },
    theme: 'grid',
    rowPageBreak: 'avoid',
    styles: { fontSize: 8, cellPadding: 1.6, lineColor: BORDA, lineWidth: 0.15, textColor: TEXTO, overflow: 'linebreak' },
    headStyles: { fillColor: AZUL, textColor: 255, fontStyle: 'bold', halign: 'center' },
    footStyles: { fillColor: [241, 245, 249], textColor: TEXTO, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' }, 2: { cellWidth: 16, halign: 'center' },
      3: { cellWidth: 25, halign: 'right', textColor: VERDE, fontStyle: 'bold' },
      4: { cellWidth: 25, halign: 'right', textColor: VERMELHO, fontStyle: 'bold' },
      5: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (d) => { if (d.section === 'foot' && d.column.index >= 3) d.cell.styles.halign = 'right'; },
  });
  y = doc.lastAutoTable.finalY + 4;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...CINZA);
  if (y > H - 22) { doc.addPage(); y = 16; }
  doc.text('Somente lançamentos pagos. "(interna)" = sangria/depósito entre espécie e banco, que não altera o saldo total. Saldo = acumulado do histórico do Tronco.', M, y, { maxWidth: W - 2 * M });

  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...DOURADO); doc.setLineWidth(0.3); doc.line(M, H - 11, W - M, H - 11);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...CINZA);
    doc.text('SysMaçom-MG - Desenvolvedor: Mauro George', M, H - 7);
    doc.text(`Página ${i} de ${total}`, W - M, H - 7, { align: 'right' });
  }
  doc.save(`Extrato_Tronco_${new Date().toISOString().slice(0, 10)}.pdf`);
};
