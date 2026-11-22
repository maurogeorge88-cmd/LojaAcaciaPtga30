import jsPDF from 'jspdf';
import 'jspdf-autotable';

// ════════════════════════════════════════════════════════════════════════
// Relatório de Empréstimos (Comodato) — cabeçalho padrão da Loja.
// Cada registro recebe um nº de ordem; registro com vários equipamentos
// mescla nº, beneficiário, CPF e datas do empréstimo nas linhas dos itens.
// ════════════════════════════════════════════════════════════════════════

const AZUL = [30, 58, 138];
const DOURADO = [201, 168, 76];
const CINZA = [100, 116, 139];
const TEXTO = [30, 41, 59];

const fmtData = (d) => (d ? new Date(String(d).substring(0, 10) + 'T00:00:00').toLocaleDateString('pt-BR') : '—');

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
 * @param {Array}  p.ativos / p.devolvidos / p.outrosAnos  empréstimos (com beneficiarios e itens[].equipamentos)
 * @param {string} p.labelPeriodo  ex.: "Ano 2026"
 * @param {number} p.ano
 */
export const gerarRelatorioEmprestimosPDF = ({ ativos = [], devolvidos = [], outrosAnos = [], labelPeriodo = '', ano, nomeArquivo, dadosLoja = {}, logo = null }) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 12;
  const nomeLoja = `ACÁCIA DE PARANATINGA Nº ${dadosLoja?.numero_loja || '30'}`;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);

  const vencidoEmp = (e) => e.status === 'ativo' && !!e.data_devolucao_prevista && new Date(e.data_devolucao_prevista + 'T00:00:00') < hoje;

  // ── Cabeçalho ──
  let y = 7;
  if (logo) {
    try { doc.addImage(logo, logo.includes('image/png') ? 'PNG' : 'JPEG', M, y, 24, 24); } catch (e) { /* sem logo */ }
  }
  linhaLoja(doc, nomeLoja, y + 7, W);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...TEXTO);
  doc.text(`Fundada em ${dadosLoja?.data_fundacao ? fmtData(dadosLoja.data_fundacao) : '20/12/1997'}`, W / 2, y + 12, { align: 'center' });
  doc.setFontSize(8.5); doc.setTextColor(...CINZA);
  doc.text('Sob os auspícios da Sereníssima Grande Loja Maçônica do Estado de Mato Grosso', W / 2, y + 16.5, { align: 'center' });
  const end = [dadosLoja?.endereco, [dadosLoja?.cidade || 'Paranatinga', dadosLoja?.estado || 'MT'].join('/')].filter(Boolean).join(' — ');
  doc.text(end, W / 2, y + 21, { align: 'center' });
  y += 26;
  doc.setDrawColor(...DOURADO); doc.setLineWidth(0.8); doc.line(M, y, W - M, y);
  doc.setLineWidth(0.2); doc.line(M, y + 1.2, W - M, y + 1.2);

  // ── Título ──
  y += 8;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...AZUL);
  doc.text('RELATÓRIO DE EMPRÉSTIMOS — COMODATO', W / 2, y, { align: 'center' });
  y += 5.5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...CINZA);
  doc.text(labelPeriodo, W / 2, y, { align: 'center' });

  // ── Cartões ──
  const periodo = [...ativos, ...devolvidos];
  const nVencidos = ativos.filter(vencidoEmp).length;
  const totalItens = periodo.reduce((s, e) => s + (e.itens?.length || 0), 0);
  const cards = [
    [periodo.length, 'Registros de empréstimo', false],
    [ativos.length, 'Ativos', false],
    [devolvidos.length, 'Devolvidos', false],
    [nVencidos, 'Vencidos', nVencidos > 0],
    [totalItens, 'Equipamentos emprestados', false],
  ];
  y += 5;
  const gap = 4, cw = (W - 2 * M - gap * 4) / 5;
  cards.forEach(([v, l, crit], i) => {
    const x = M + i * (cw + gap);
    doc.setFillColor(...(crit ? [254, 242, 242] : [248, 244, 232])); doc.setDrawColor(...(crit ? [239, 68, 68] : DOURADO)); doc.setLineWidth(0.3);
    doc.roundedRect(x, y, cw, 15, 2, 2, 'FD');
    doc.setFillColor(...(crit ? [239, 68, 68] : DOURADO)); doc.rect(x, y + 2, 1.2, 11, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...(crit ? [185, 28, 28] : AZUL));
    doc.text(String(v), x + cw / 2, y + 8, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...CINZA);
    doc.text(l.toUpperCase(), x + cw / 2, y + 12.5, { align: 'center' });
  });
  y += 20;

  // ── Tabelas ──
  const HEAD = [['Nº', 'Beneficiário', 'CPF', 'Equipamento', 'Patrimônio', 'Dt. Empréstimo', 'Prev. Devolução', 'Dt. Devolução', 'Situação']];
  const colStyles = {
    0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
    1: { cellWidth: 58, halign: 'left', fontStyle: 'bold' },
    2: { cellWidth: 30, halign: 'center' },
    3: { cellWidth: 40, halign: 'left' },
    4: { cellWidth: 26, halign: 'center' },
    5: { cellWidth: 28, halign: 'center' },
    6: { cellWidth: 30, halign: 'center' },
    7: { cellWidth: 26, halign: 'center' },
    8: { cellWidth: 23, halign: 'center' },
  };


  const montar = (lista) => {
    const body = []; const meta = [];
    lista.forEach((emp, idx) => {
      const itens = emp.itens?.length ? emp.itens : [null];
      const n = itens.length;
      const venc = vencidoEmp(emp);
      itens.forEach((it, k) => {
        const tipo = it?.equipamentos?.tipos_equipamentos?.nome || '—';
        const patr = it?.equipamentos?.numero_patrimonio || '—';
        const itemVenc = venc && it && it.status !== 'devolvido';
        const sit = it?.status === 'devolvido' ? 'Devolvido' : (itemVenc ? 'Vencido' : 'Ativo');
        const linha = [];
        if (k === 0) {
          linha.push({ content: String(idx + 1).padStart(2, '0'), rowSpan: n });
          linha.push({ content: emp.beneficiarios?.nome || '—', rowSpan: n });
          linha.push({ content: emp.beneficiarios?.cpf || '—', rowSpan: n });
        }
        linha.push(tipo, patr);
        if (k === 0) {
          linha.push({ content: fmtData(emp.data_emprestimo), rowSpan: n });
          linha.push({ content: fmtData(emp.data_devolucao_prevista), rowSpan: n });
        }
        linha.push(it?.data_devolucao_real ? fmtData(it.data_devolucao_real) : '—', sit);
        body.push(linha);
        meta.push({ grupo: idx, k, venc, itemVenc, sit });
      });
    });
    return { body, meta };
  };

  const secao = (titulo, cor, corClara, lista, vazio) => {
    if (y + 30 > H - 18) { doc.addPage(); y = 14; }
    doc.setFillColor(...cor); doc.roundedRect(M, y, W - 2 * M, 7.5, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(255, 255, 255);
    doc.text(titulo, M + 3, y + 5.1);
    y += 10;
    if (lista.length === 0) {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...CINZA);
      doc.text(vazio, M + 2, y + 3); y += 12; return;
    }
    const { body, meta } = montar(lista);
    doc.autoTable({
      startY: y, head: HEAD, body,
      margin: { left: M, right: M, bottom: 18 },
      theme: 'grid',
      rowPageBreak: 'avoid',
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2, lineColor: [226, 232, 240], lineWidth: 0.15, textColor: TEXTO, valign: 'middle' },
      headStyles: { fillColor: cor, textColor: 255, fontStyle: 'bold', halign: 'center' },
      columnStyles: colStyles,
      didParseCell: (d) => {
        if (d.section !== 'body') return;
        const m = meta[d.row.index]; if (!m) return;
        if (m.grupo % 2 === 1) d.cell.styles.fillColor = corClara;
        if (m.venc && d.cell.raw !== undefined) {
          // registro vencido: destaca nº/beneficiário e itens ainda não devolvidos
          if (m.itemVenc) { d.cell.styles.textColor = [185, 28, 28]; d.cell.styles.fontStyle = 'bold'; }
        }
        const colSit = d.table.columns.length - 1;
        if (d.column.index === colSit) {
          if (m.sit === 'Vencido') { d.cell.styles.textColor = [185, 28, 28]; d.cell.styles.fontStyle = 'bold'; }
          else if (m.sit === 'Devolvido') d.cell.styles.textColor = [22, 101, 52];
          else d.cell.styles.textColor = AZUL;
        }
      },
    });
    y = doc.lastAutoTable.finalY + 8;
  };

  secao(`EMPRÉSTIMOS ATIVOS — ${ativos.length} registro(s)   |   Vencidos: ${nVencidos}`, AZUL, [244, 247, 252], ativos, 'Nenhum empréstimo ativo.');
  secao(`EMPRÉSTIMOS DEVOLVIDOS — ${devolvidos.length} registro(s)`, [21, 128, 61], [240, 253, 244], devolvidos, 'Nenhum empréstimo devolvido.');
  if (outrosAnos.length > 0) {
    const vOut = outrosAnos.filter(vencidoEmp).length;
    secao(`ATIVOS DE ANOS ANTERIORES A ${ano} — ${outrosAnos.length} registro(s)   |   Vencidos: ${vOut}`, [120, 53, 15], [255, 247, 237], outrosAnos, '');
  }

  // ── Rodapé ──
  const emitido = new Date().toLocaleDateString('pt-BR');
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(...DOURADO); doc.setLineWidth(0.3);
    doc.line(M, H - 13, W - M, H - 13);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...CINZA);
    doc.text('SysMaçom-MG - Desenvolvedor: Mauro George', M, H - 8);
    doc.text(`Loja ${nomeLoja} — emitido em ${emitido}`, W / 2 + 18, H - 8, { align: 'center' });
    doc.text(`${p} de ${total}`, W - M, H - 8, { align: 'right' });
  }

  doc.save(nomeArquivo || 'Relatorio_Emprestimos.pdf');
};
