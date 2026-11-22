import jsPDF from 'jspdf';
import 'jspdf-autotable';

// ════════════════════════════════════════════════════════════════════════
// Relatório de Recursos Aplicados — Comodato (equipamentos)
// Cabeçalho padrão da Loja; por entidade → por nota → equipamentos por tipo.
// ════════════════════════════════════════════════════════════════════════

const AZUL = [30, 58, 138];
const DOURADO = [201, 168, 76];
const CINZA = [100, 116, 139];
const TEXTO = [30, 41, 59];

const fmtData = (d) => (d ? String(d).substring(0, 10).split('-').reverse().join('/') : '—');
const fmtMoeda = (v) => (v == null || v === '' ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));

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

const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;

// agrupa equipamentos por tipo → [{ tipo, qtd, patrimonios[] }]
const agruparPorTipo = (itens) => {
  const m = {};
  itens.forEach(e => {
    const nome = e.tipos_equipamentos?.nome || 'Sem tipo';
    (m[nome] = m[nome] || []).push(e.numero_patrimonio + (e.status === 'descartado' ? ' (descartado)' : ''));
  });
  return Object.keys(m).sort((a, b) => a.localeCompare(b)).map(t => ({ tipo: t, qtd: m[t].length, patrimonios: m[t].sort() }));
};

const textoTipos = (grupos) => grupos.map(g => `${g.qtd} ${g.tipo}`).join(', ');

/**
 * @param {Object} p
 * @param {Array}  p.recursos [{ id, numero_nf, data_nf, fornecedor, valor_total, processo, origem:{nome}, itens:[equipamento] }]
 * @param {Object} p.dadosLoja
 * @param {string} p.logo      data URL
 * @param {string} p.filtro    descrição dos filtros
 */
export const gerarRelatorioRecursosComodatoPDF = ({ recursos = [], dadosLoja = {}, logo = null, filtro = '' }) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 16;
  const nomeLoja = `ACÁCIA DE PARANATINGA Nº ${dadosLoja?.numero_loja || '30'}`;

  // ── Cabeçalho ──
  let y = 8;
  if (logo) {
    try { doc.addImage(logo, logo.includes('image/png') ? 'PNG' : 'JPEG', (W - 28) / 2, y, 28, 28); } catch (e) { /* sem logo */ }
  }
  y += 33;
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
  y += 9;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...AZUL);
  doc.text('RELATÓRIO DE RECURSOS APLICADOS EM EQUIPAMENTOS', W / 2, y, { align: 'center' });
  y += 5.5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...CINZA);
  doc.text('Comodato de equipamentos — Filantropia', W / 2, y, { align: 'center' });
  if (filtro) { y += 4.5; doc.setFontSize(8); doc.text(filtro, W / 2, y, { align: 'center' }); }
  y += 7;

  // ── Agrupar por entidade ──
  const porEntidade = {};
  recursos.forEach(r => {
    const nome = r.origem?.nome || 'Origem não informada';
    (porEntidade[nome] = porEntidade[nome] || []).push(r);
  });
  const entidades = Object.keys(porEntidade).sort((a, b) => a.localeCompare(b));
  entidades.forEach(n => porEntidade[n].sort((a, b) => String(a.data_nf || '').localeCompare(String(b.data_nf || ''))));

  const totalEq = (rs) => rs.reduce((t, r) => t + r.itens.length, 0);
  const totalValor = (rs) => rs.reduce((t, r) => t + (Number(r.valor_total) || 0), 0);

  if (recursos.length === 0) {
    doc.setFontSize(10); doc.setTextColor(...CINZA);
    doc.text('Nenhum recurso encontrado para os filtros informados.', W / 2, y + 8, { align: 'center' });
  } else {
    // ── Resumo por entidade ──
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...AZUL);
    doc.text('RESUMO POR ENTIDADE', M, y);
    doc.autoTable({
      startY: y + 2,
      head: [['Entidade', 'Notas', 'Valor das notas', 'Equipamentos']],
      body: [
        ...entidades.map(n => [n, porEntidade[n].length, fmtMoeda(totalValor(porEntidade[n])), totalEq(porEntidade[n])]),
        ['TOTAL GERAL', recursos.length, fmtMoeda(totalValor(recursos)), totalEq(recursos)],
      ],
      margin: { left: M, right: M },
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 1.8, lineColor: [226, 232, 240], lineWidth: 0.15, textColor: TEXTO },
      headStyles: { fillColor: AZUL, textColor: 255, fontStyle: 'bold', halign: 'center' },
      columnStyles: { 1: { halign: 'center', cellWidth: 20 }, 2: { halign: 'right', cellWidth: 38 }, 3: { halign: 'center', cellWidth: 28 } },
      didParseCell: (d) => {
        if (d.section === 'body' && d.row.index === entidades.length) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.fillColor = [241, 245, 249]; }
      },
    });
    y = doc.lastAutoTable.finalY + 8;

    // ── Detalhe por entidade e nota ──
    const garantir = (h) => { if (y + h > H - 20) { doc.addPage(); y = 16; } };

    entidades.forEach(nomeEnt => {
      const rs = porEntidade[nomeEnt];
      garantir(65);
      doc.setFillColor(...AZUL); doc.rect(M, y, W - 2 * M, 7, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(255, 255, 255);
      doc.text(nomeEnt.toUpperCase(), M + 3, y + 4.9);
      doc.text(`${plural(rs.length, 'nota', 'notas')} • ${fmtMoeda(totalValor(rs))}`, W - M - 3, y + 4.9, { align: 'right' });
      y += 10;

      rs.forEach(r => {
        const grupos = agruparPorTipo(r.itens);
        garantir(34);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...TEXTO);
        doc.text(`NF nº ${r.numero_nf}  •  ${fmtData(r.data_nf)}  •  ${fmtMoeda(r.valor_total)}`, M, y);
        y += 4.5;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...CINZA);
        const sub = [r.fornecedor && `Fornecedor: ${r.fornecedor}`, r.processo && `Processo/Ofício: ${r.processo}`].filter(Boolean).join('   |   ');
        if (sub) { doc.text(sub, M, y); y += 4.2; }

        if (grupos.length === 0) {
          doc.setFont('helvetica', 'italic'); doc.text('Nenhum equipamento vinculado a esta nota até o momento.', M, y + 1);
          y += 8;
        } else {
          doc.autoTable({
            startY: y,
            head: [['Tipo de equipamento', 'Qtd', 'Patrimônios']],
            body: grupos.map(g => [g.tipo, g.qtd, g.patrimonios.join(', ')]),
            margin: { left: M, right: M, bottom: 20 },
            theme: 'grid',
            styles: { fontSize: 8.5, cellPadding: 1.6, lineColor: [226, 232, 240], lineWidth: 0.15, textColor: TEXTO, valign: 'top' },
            headStyles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold' },
            columnStyles: { 0: { cellWidth: 52, fontStyle: 'bold' }, 1: { cellWidth: 14, halign: 'center' } },
          });
          y = doc.lastAutoTable.finalY + 3;
          garantir(12);
          doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(...AZUL);
          const frase = `O recurso proveniente de ${nomeEnt}, na NF nº ${r.numero_nf}, foi aplicado na aquisição de ${plural(r.itens.length, 'equipamento', 'equipamentos')}: ${textoTipos(grupos)}.`;
          const linhas = doc.splitTextToSize(frase, W - 2 * M);
          doc.text(linhas, M, y + 1);
          y += linhas.length * 4 + 6;
        }
      });

      // fechamento da entidade
      const todos = rs.flatMap(r => r.itens);
      const gEnt = agruparPorTipo(todos);
      garantir(16);
      doc.setFillColor(248, 244, 232); doc.setDrawColor(...DOURADO); doc.setLineWidth(0.3);
      const fr = `Total ${nomeEnt}: ${fmtMoeda(totalValor(rs))} em ${plural(rs.length, 'nota', 'notas')}, aplicados em ${plural(todos.length, 'equipamento', 'equipamentos')}${gEnt.length ? ` — ${textoTipos(gEnt)}` : ''}.`;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
      const lf = doc.splitTextToSize(fr, W - 2 * M - 6);
      const hBox = lf.length * 4.2 + 4;
      doc.roundedRect(M, y, W - 2 * M, hBox, 1.5, 1.5, 'FD');
      doc.setTextColor(...AZUL);
      doc.text(lf, M + 3, y + 5);
      y += hBox + 9;
    });

    // ── Consolidado geral por tipo ──
    const gGeral = agruparPorTipo(recursos.flatMap(r => r.itens));
    if (gGeral.length) {
      garantir(30);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...AZUL);
      doc.text('CONSOLIDADO GERAL POR TIPO DE EQUIPAMENTO', M, y);
      doc.autoTable({
        startY: y + 2,
        head: [['Tipo de equipamento', 'Quantidade']],
        body: [...gGeral.map(g => [g.tipo, g.qtd]), ['TOTAL', totalEq(recursos)]],
        margin: { left: M, right: M, bottom: 20 },
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 1.8, lineColor: [226, 232, 240], lineWidth: 0.15, textColor: TEXTO },
        headStyles: { fillColor: AZUL, textColor: 255, fontStyle: 'bold' },
        columnStyles: { 1: { halign: 'center', cellWidth: 32 } },
        didParseCell: (d) => {
          if (d.section === 'body' && d.row.index === gGeral.length) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.fillColor = [241, 245, 249]; }
        },
      });
    }
  }

  // ── Rodapé ──
  const hoje = new Date().toLocaleDateString('pt-BR');
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(...DOURADO); doc.setLineWidth(0.3);
    doc.line(M, H - 14, W - M, H - 14);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...CINZA);
    doc.text('SysMaçom-MG - Desenvolvedor: Mauro George', M, H - 9);
    doc.text(`Loja ${nomeLoja} — emitido em ${hoje}`, W / 2 + 14, H - 9, { align: 'center' });
    doc.text(`${p} de ${total}`, W - M, H - 9, { align: 'right' });
  }

  doc.save('Relatorio_Recursos_Comodato.pdf');
};
