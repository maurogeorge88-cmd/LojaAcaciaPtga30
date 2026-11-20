import jsPDF from 'jspdf';
import 'jspdf-autotable';

// ════════════════════════════════════════════════════════════════════════
// Painel da Administração — PDF (paisagem)
// Cabeçalho padrão da Loja (logo + dados), resumo e matriz irmão × cargo.
// ════════════════════════════════════════════════════════════════════════

const AZUL = [30, 58, 138];
const DOURADO = [201, 168, 76];
const CINZA = [100, 116, 139];
const TEXTO = [30, 41, 59];
const OURO_CELULA = [217, 119, 6];

const fmtData = (d) => (d ? String(d).substring(0, 10).split('-').reverse().join('/') : '');

// "AUG∴ E RESP∴ LOJA SIMB∴ NOME" com o ∴ desenhado (fonte padrão não tem o símbolo)
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

const COLUNAS = [
  ['veneravel mestre', 'Venerável\nMestre'],
  ['primeiro vigilante', '1º\nVigilante'],
  ['segundo vigilante', '2º\nVigilante'],
  ['orador', 'Orador'],
  ['secretario', 'Secretário'],
  ['tesoureiro', 'Tesoureiro'],
  ['chanceler', 'Chanceler'],
];

/**
 * @param {Object} p
 * @param {Array}  p.linhas    [{ nome, cargos:{chave:n}, total }]
 * @param {Object} p.resumo    { totalGestoes, irmaosDistintos, jaForamVM, anoAtual, vmAtual }
 * @param {Object} p.dadosLoja registro de dados_loja
 * @param {string} p.logo      data URL (png/jpeg) da logo, opcional
 * @param {string} p.filtro    texto descrevendo filtros aplicados, opcional
 */
export const gerarPainelCargosPDF = ({ linhas = [], resumo = {}, dadosLoja = {}, logo = null, filtro = '' }) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const nomeLoja = `ACÁCIA DE PARANATINGA Nº ${dadosLoja?.numero_loja || '30'}`;

  // ── Cabeçalho ──
  let y = 8;
  if (logo) {
    try { doc.addImage(logo, logo.includes('image/png') ? 'PNG' : 'JPEG', M, y, 26, 26); } catch (e) { /* sem logo */ }
  }
  linhaLoja(doc, nomeLoja, y + 8, W);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...TEXTO);
  doc.text(`Fundada em ${dadosLoja?.data_fundacao ? fmtData(dadosLoja.data_fundacao) : '20/12/1997'}`, W / 2, y + 13.5, { align: 'center' });
  doc.setFontSize(8.5); doc.setTextColor(...CINZA);
  doc.text('Sob os auspícios da Sereníssima Grande Loja Maçônica do Estado de Mato Grosso', W / 2, y + 18.5, { align: 'center' });
  const end = [dadosLoja?.endereco, [dadosLoja?.cidade || 'Paranatinga', dadosLoja?.estado || 'MT'].join('/')].filter(Boolean).join(' — ');
  doc.text(end, W / 2, y + 23, { align: 'center' });
  y += 29;
  doc.setDrawColor(...DOURADO); doc.setLineWidth(0.8); doc.line(M, y, W - M, y);
  doc.setLineWidth(0.2); doc.line(M, y + 1.2, W - M, y + 1.2);

  // ── Título ──
  y += 9;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...AZUL);
  doc.text('PAINEL DA ADMINISTRAÇÃO — IRMÃO × CARGO', W / 2, y, { align: 'center' });
  y += 5.5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...CINZA);
  doc.text(`Quantas vezes cada irmão ocupou os cargos de Venerável Mestre a Chanceler${resumo.anoAtual ? ` (até ${resumo.anoAtual})` : ''}`, W / 2, y, { align: 'center' });
  if (filtro) { y += 4.5; doc.setFontSize(8); doc.text(filtro, W / 2, y, { align: 'center' }); }

  // ── Cartões-resumo ──
  y += 6;
  const cards = [
    [String(resumo.totalGestoes ?? '—'), 'Gestões registradas'],
    [String(resumo.irmaosDistintos ?? '—'), 'Irmãos com cargo principal'],
    [String(resumo.jaForamVM ?? '—'), 'Irmãos que já foram VM'],
    [resumo.vmAtual ? `Ir. ${resumo.vmAtual}` : '—', `Veneralato mais recente${resumo.anoAtual ? ` (${resumo.anoAtual})` : ''}`],
  ];
  const gap = 4;
  const cw = (W - 2 * M - gap * 3) / 4;
  cards.forEach(([v, l], i) => {
    const x = M + i * (cw + gap);
    doc.setFillColor(248, 244, 232); doc.setDrawColor(...DOURADO); doc.setLineWidth(0.3);
    doc.roundedRect(x, y, cw, 17, 2, 2, 'FD');
    doc.setFillColor(...DOURADO); doc.rect(x, y + 2, 1.2, 13, 'F');
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...AZUL);
    doc.setFontSize(v.length > 14 ? 10 : 16);
    doc.text(v.length > 34 ? v.slice(0, 33) + '…' : v, x + cw / 2, y + 8, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...CINZA);
    doc.text(l.toUpperCase(), x + cw / 2, y + 13.5, { align: 'center' });
  });
  y += 22;

  // ── Matriz ──
  const max = Math.max(1, ...linhas.flatMap(r => COLUNAS.map(([k]) => r.cargos?.[k] || 0)));
  const body = linhas.map((r, i) => [
    String(i + 1),
    r.nome,
    ...COLUNAS.map(([k]) => (r.cargos?.[k] || 0) || '·'),
    r.total,
  ]);
  const somas = COLUNAS.map(([k]) => linhas.reduce((t, r) => t + (r.cargos?.[k] || 0), 0));
  body.push(['', 'TOTAL', ...somas, linhas.reduce((t, r) => t + r.total, 0)]);

  const nCol = COLUNAS.length;
  doc.autoTable({
    startY: y,
    head: [['#', 'Irmão', ...COLUNAS.map(c => c[1]), 'Total']],
    body,
    margin: { left: M, right: M, bottom: 18 },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.6, lineColor: [226, 232, 240], lineWidth: 0.15, textColor: TEXTO, valign: 'middle' },
    headStyles: { fillColor: AZUL, textColor: 255, halign: 'center', fontStyle: 'bold', fontSize: 8, valign: 'middle' },
    columnStyles: { 0: { halign: 'center', cellWidth: 9, textColor: CINZA }, 1: { cellWidth: 'auto', halign: 'left' }, [nCol + 2]: { halign: 'center', fontStyle: 'bold', textColor: AZUL, cellWidth: 16 } },
    didParseCell: (d) => {
      const ultima = d.row.index === body.length - 1;
      if (d.section === 'head' && d.column.index === 1) d.cell.styles.halign = 'left';
      if (d.section !== 'body') return;
      if (ultima) {
        d.cell.styles.fillColor = [241, 245, 249]; d.cell.styles.fontStyle = 'bold';
        if (d.column.index >= 2) d.cell.styles.halign = 'center';
        return;
      }
      if (d.column.index >= 2 && d.column.index <= nCol + 1) {
        d.cell.styles.halign = 'center';
        const n = Number(d.cell.raw) || 0;
        if (n) {
          const a = Math.min(0.9, 0.18 + 0.72 * (n / max));
          const mix = (c) => Math.round(255 - (255 - c) * a);
          d.cell.styles.fillColor = [mix(OURO_CELULA[0]), mix(OURO_CELULA[1]), mix(OURO_CELULA[2])];
          d.cell.styles.fontStyle = 'bold';
          d.cell.styles.textColor = a > 0.55 ? 255 : TEXTO;
        } else {
          d.cell.styles.textColor = [180, 188, 200];
        }
      } else if (d.row.index % 2 === 1 && d.column.index <= 1) {
        d.cell.styles.fillColor = [250, 250, 252];
      }
    },
  });

  // ── Rodapé em todas as páginas ──
  const hoje = new Date().toLocaleDateString('pt-BR');
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(...DOURADO); doc.setLineWidth(0.3);
    doc.line(M, H - 13, W - M, H - 13);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...CINZA);
    doc.text(`Loja ${nomeLoja} — emitido em ${hoje}`, W / 2, H - 8, { align: 'center' });
    doc.text(`${p} de ${total}`, W - M, H - 8, { align: 'right' });
  }

  doc.save('Painel_Administracao_Cargos.pdf');
};
