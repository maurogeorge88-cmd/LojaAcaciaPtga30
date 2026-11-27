import jsPDF from 'jspdf';

// ════════════════════════════════════════════════════════════════════════
// Gestões da Administração — PDF (paisagem), quadros 3 por linha.
// Cada quadro: ano + os 7 cargos principais, um abaixo do outro.
// ════════════════════════════════════════════════════════════════════════

const AZUL = [30, 58, 138];
const DOURADO = [201, 168, 76];
const CINZA = [100, 116, 139];
const TEXTO = [30, 41, 59];
const CREME = [248, 244, 232];

const fmtData = (d) => (d ? String(d).substring(0, 10).split('-').reverse().join('/') : '');

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

const cortar = (doc, txt, larg) => {
  let t = String(txt || '');
  if (doc.getTextWidth(t) <= larg) return t;
  while (t.length > 1 && doc.getTextWidth(t + '…') > larg) t = t.slice(0, -1);
  return t + '…';
};

/**
 * @param {Object} p
 * @param {Array}  p.gestoes   [{ ano, principais:[{label, nomes:[]}] }]
 * @param {Object} p.dadosLoja registro de dados_loja
 * @param {string} p.logo      data URL da logo, opcional
 * @param {string} p.filtro    texto do período (ex.: "5 últimas gestões")
 */
export const gerarGestoesPDF = ({ gestoes = [], dadosLoja = {}, logo = null, filtro = '' }) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const nomeLoja = `ACÁCIA DE PARANATINGA Nº ${dadosLoja?.numero_loja || '30'}`;

  // ── Cabeçalho (1ª página) ──
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

  y += 9;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...AZUL);
  doc.text('GESTÕES DA ADMINISTRAÇÃO', W / 2, y, { align: 'center' });
  if (filtro) {
    y += 5.5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...CINZA);
    doc.text(filtro, W / 2, y, { align: 'center' });
  }
  y += 7;

  // ── Quadros ──
  const COLS = 3, GAP = 5;
  const bw = (W - 2 * M - GAP * (COLS - 1)) / COLS;
  const HEAD = 9, ROW = 6, PAD = 2;
  const bh = HEAD + 7 * ROW + PAD;
  const limite = H - 16;
  let x0 = M, col = 0;

  gestoes.forEach((g) => {
    if (col === 0 && y + bh > limite) { doc.addPage(); y = 14; }
    const x = M + col * (bw + GAP);

    doc.setFillColor(255, 255, 255); doc.setDrawColor(...DOURADO); doc.setLineWidth(0.3);
    doc.roundedRect(x, y, bw, bh, 2, 2, 'FD');
    doc.setFillColor(...CREME);
    doc.roundedRect(x, y, bw, HEAD, 2, 2, 'F');
    doc.rect(x, y + HEAD - 2, bw, 2, 'F');
    doc.setFillColor(...DOURADO); doc.rect(x, y + HEAD - 0.6, bw, 0.6, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...AZUL);
    doc.text(`GESTÃO ${g.ano}`, x + bw / 2, y + 6.2, { align: 'center' });

    g.principais.forEach((p, i) => {
      const ry = y + HEAD + i * ROW;
      if (i > 0) { doc.setDrawColor(230, 225, 210); doc.setLineWidth(0.15); doc.line(x + 3, ry, x + bw - 3, ry); }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...CINZA);
      doc.text(p.label.toUpperCase(), x + 3, ry + 4);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...TEXTO);
      const nome = p.nomes.length ? p.nomes.join(' / ') : '—';
      doc.text(cortar(doc, nome, bw - 32 - 3), x + 32, ry + 4);
    });

    col++;
    if (col === COLS) { col = 0; y += bh + GAP; }
  });

  // ── Rodapé ──
  const n = doc.getNumberOfPages();
  const hoje = new Date().toLocaleDateString('pt-BR');
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...CINZA);
    doc.text(`Emitido em ${hoje}`, M, H - 8);
    doc.text(`Página ${i} de ${n}`, W - M, H - 8, { align: 'right' });
  }

  doc.save(`gestoes-administracao-${new Date().toISOString().slice(0, 10)}.pdf`);
};
