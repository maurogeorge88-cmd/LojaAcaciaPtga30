import jsPDF from 'jspdf';
import 'jspdf-autotable';

// ════════════════════════════════════════════════════════════════════════
// Relação de Irmãos Aptos a Votar — eleição da Loja
// Só os aptos; assinam Venerável Mestre, Chanceler e Tesoureiro.
// ════════════════════════════════════════════════════════════════════════

const AZUL = [30, 58, 138];
const DOURADO = [201, 168, 76];
const CINZA = [100, 116, 139];
const TEXTO = [30, 41, 59];

// tipo: 'aptos' (Tesouraria = "Quite") | 'inaptos' (Tesouraria = "Pendência" quando houver)
export const gerarAptosVotarPDF = ({ linhas, eleicao, dadosLoja = {}, logoB64, periodo, assinantes = {}, subtitulo = null, nomeArquivo = null, tipo = 'aptos' }) => {
  const inaptos = tipo === 'inaptos';
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 18;
  const fmt = (d) => (d ? String(d).substring(0, 10).split('-').reverse().join('/') : '');

  // Cabeçalho: logo à esquerda, dados da Loja à direita
  let y = 12;
  if (logoB64) {
    try { doc.addImage(`data:image/jpeg;base64,${logoB64}`, 'JPEG', M, y, 30, 30); } catch (e) { /* sem logo */ }
  }
  const xt = M + 34 + (W - M - (M + 34)) / 2;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...AZUL);
  doc.text(`A.R.L.S. ACÁCIA DE PARANATINGA Nº ${dadosLoja.numero_loja || '30'}`, xt, y + 8, { align: 'center' });
  doc.setFontSize(10); doc.setTextColor(...TEXTO);
  doc.text(`Fundada em ${dadosLoja.data_fundacao ? fmt(dadosLoja.data_fundacao) : '20/12/1997'}`, xt, y + 14, { align: 'center' });
  doc.text('Jurisdicionada à', xt, y + 19, { align: 'center' });
  doc.text('Grande Loja Maçônica do Estado de Mato Grosso', xt, y + 24, { align: 'center' });
  y += 36;
  doc.setDrawColor(...DOURADO); doc.setLineWidth(0.6); doc.line(M, y, W - M, y);

  // Título
  y += 9;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...AZUL);
  doc.text(inaptos ? 'RELAÇÃO DE IRMÃOS INAPTOS A VOTAR' : 'RELAÇÃO DE IRMÃOS APTOS A VOTAR', W / 2, y, { align: 'center' });
  y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...CINZA);
  doc.text(subtitulo || `Eleição da Gestão ${eleicao?.ano_exercicio || eleicao?.gestao || ''}${eleicao?.data_eleicao ? ` — sessão de ${fmt(eleicao.data_eleicao)}` : ''}`, W / 2, y, { align: 'center' });
  y += 5;
  doc.text('Critérios: estar em dia com a Tesouraria e ter pelo menos 50% de presença desde a última eleição.', W / 2, y, { align: 'center' });
  y += 6;

  doc.autoTable({
    startY: y,
    margin: { left: M, right: M, bottom: 16 },
    head: [['Nº', 'Irmão', 'CIM', 'Tesouraria', 'Presença']],
    // Nome completo; prerrogativa por idade identificada com a estrela (desenhada em amarelo)
    body: linhas.map((l, i) => [
      String(i + 1),
      `${l.nome || l.nomeCurto}${inaptos && l.licenca ? ' (Lic)' : ''}`,
      l.cim || '',
      inaptos ? (l.finOk === false ? 'Pendência' : 'Quite') : 'Quite',
      l.isento70 ? 'Dispensada' : `${l.pct}% (${l.presentes}/${l.total})`,
    ]),
    didDrawCell: (d) => {
      if (d.section === 'body' && d.column.index === 1 && linhas[d.row.index]?.isento70) {
        const tw = doc.getTextWidth(String(d.cell.raw || ''));
        const cx = d.cell.x + d.cell.padding('left') + tw + 3, cy = d.cell.y + d.cell.height / 2;
        const pts = [];
        for (let k = 0; k < 10; k++) { const r = k % 2 ? 0.9 : 2.1, a = -Math.PI / 2 + k * Math.PI / 5; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
        doc.setFillColor(250, 204, 21);
        doc.lines(pts.slice(1).map((p2, k) => [p2[0] - pts[k][0], p2[1] - pts[k][1]]), pts[0][0], pts[0][1], [1, 1], 'F', true);
      }
    },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: { top: 1.3, bottom: 1.3, left: 2, right: 2 }, textColor: TEXTO, lineColor: [226, 232, 240], lineWidth: 0.2 },
    headStyles: { fillColor: AZUL, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [241, 245, 249] },
    columnStyles: { 0: { cellWidth: 12, halign: 'center' }, 2: { cellWidth: 22, halign: 'center' }, 3: { cellWidth: 36 }, 4: { cellWidth: 30, halign: 'center' } },
  });
  y = doc.lastAutoTable.finalY + 6;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...TEXTO);
  doc.text(`Total de irmãos ${inaptos ? 'inaptos' : 'aptos'}: ${linhas.length}`, M, y);

  // Assinaturas: VM, Chanceler e Tesoureiro (lado a lado)
  // Assinaturas logo abaixo da tabela (página nova só se não couber)
  y += 24;
  if (y > H - 30) { doc.addPage(); y = 40; }
  const col = (W - 2 * M) / 3;
  [[assinantes.vm, 'Venerável Mestre'], [assinantes.chanceler, 'Chanceler'], [assinantes.tesoureiro, 'Tesoureiro']].forEach(([nome, cargo], i) => {
    const cx = M + col * i + col / 2;
    doc.setDrawColor(...TEXTO); doc.setLineWidth(0.3);
    doc.line(cx - col / 2 + 4, y, cx + col / 2 - 4, y);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...TEXTO);
    const linhasNome = doc.splitTextToSize(nome || `[${cargo}]`, col - 6);
    linhasNome.forEach((ln, k) => doc.text(ln, cx, y + 4.5 + k * 3.8, { align: 'center' }));
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...CINZA);
    doc.text(cargo, cx, y + 4.5 + linhasNome.length * 3.8 + 0.8, { align: 'center' });
  });

  // Rodapé
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...CINZA);
    doc.text(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, M, H - 9);
    doc.text(`${p} de ${total}`, W - M, H - 9, { align: 'right' });
  }
  doc.save(nomeArquivo || `${inaptos ? 'Inaptos' : 'Aptos'}_a_Votar_${String(eleicao?.ano_exercicio || eleicao?.gestao || '').replace('/', '-')}.pdf`);
};
