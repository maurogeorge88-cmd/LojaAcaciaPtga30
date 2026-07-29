import jsPDF from 'jspdf';
import 'jspdf-autotable';

const sanitizeTexto = (str) => (str || '')
  .replace(/∴/g, '')
  .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
  .replace(/[\u2600-\u27BF]/gu, '')
  .replace(/[\uFE00-\uFE0F]/gu, '')
  .replace(/\s{2,}/g, ' ')
  .trim();

const obterGrauAtualLabel = (irmao) => {
  if (!irmao) return '—';
  if (irmao.mestre_instalado) return 'Mestre Instalado';
  if (irmao.data_exaltacao)   return 'Mestre';
  if (irmao.data_elevacao)    return 'Companheiro';
  if (irmao.data_iniciacao)   return 'Aprendiz';
  return '—';
};

const fmtData = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

/**
 * Gera o relatório de instruções recebidas e trabalhos apresentados de um
 * irmão, por grau — usado principalmente para transferência entre Lojas.
 *
 * @param {Object} irmao        registro do irmão (nome, cim, data_iniciacao, data_elevacao, data_exaltacao, mestre_instalado)
 * @param {Array}  registros    linhas de instrucoes_trabalhos_irmao
 * @param {Object} dadosLoja    { nome, endereco, logo_url, cidade, estado }
 * @param {Object} assinantes   { veneravelMestre, orador, secretario }
 * @param {Array|null} presencaMensal  [{ label, elegiveis, presentes, percentual }] — se informado, gera a 2ª página com o quadro de presenças
 */
export const gerarRelatorioInstrucoesTrabalhosPDF = (irmao, registros, dadosLoja, assinantes = {}, presencaMensal = null) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, M = 20;
  let y = 18;

  const txt = (text, x, yy, opts = {}) => doc.text(String(text), x, yy, opts);
  const larguraUtil = W - M * 2;

  const checkPage = (espaco = 20) => {
    if (y + espaco > 275) {
      doc.addPage();
      y = 18;
    }
  };

  // ── Desenha um parágrafo justificado (espaço distribuído entre as
  // palavras em todas as linhas, menos a última) — mesma técnica usada
  // na Certidão Financeira. ─────────────────────────────────────────────
  const desenharParagrafoJustificado = (textoBruto, tamanhoFonte = 10.5) => {
    doc.setFontSize(tamanhoFonte);
    doc.setFont('helvetica', 'normal');
    const espacoLargura = doc.getTextWidth(' ');

    const palavras = sanitizeTexto(textoBruto).split(' ').filter(p => p.length > 0);

    const linhas = [];
    let linhaAtual = [];
    let larguraAtual = 0;
    palavras.forEach(p => {
      const larguraPalavra = doc.getTextWidth(p);
      const espacoExtra = linhaAtual.length > 0 ? espacoLargura : 0;
      if (larguraAtual + espacoExtra + larguraPalavra > larguraUtil && linhaAtual.length > 0) {
        linhas.push(linhaAtual);
        linhaAtual = [];
        larguraAtual = 0;
      }
      if (linhaAtual.length > 0) larguraAtual += espacoLargura;
      linhaAtual.push(p);
      larguraAtual += larguraPalavra;
    });
    if (linhaAtual.length > 0) linhas.push(linhaAtual);

    linhas.forEach((linha, idxLinha) => {
      const ehUltima = idxLinha === linhas.length - 1;
      const larguraPalavras = linha.reduce((s, p) => s + doc.getTextWidth(p), 0);
      const gaps = linha.length - 1;
      const espacoUsado = (!ehUltima && gaps > 0) ? (larguraUtil - larguraPalavras) / gaps : espacoLargura;

      let x = M;
      linha.forEach((p, i) => {
        txt(p, x, y);
        x += doc.getTextWidth(p) + (i < linha.length - 1 ? espacoUsado : 0);
      });
      y += 5.6;
    });
  };

  // ── Cabeçalho da Loja (reutilizável — chamado de novo na 2ª página) ───────
  const desenharCabecalho = () => {
    y = 18;
    if (dadosLoja?.logo_url) {
      try {
        doc.addImage(dadosLoja.logo_url, 'PNG', (W - 24) / 2, y, 24, 24);
        y += 28;
      } catch (e) { y += 2; }
    }
    doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(20);
    txt(sanitizeTexto(dadosLoja?.nome) || 'ARLS Acacia de Paranatinga no 30', W / 2, y, { align: 'center' }); y += 5.5;
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(90);
    txt(sanitizeTexto(dadosLoja?.endereco) || 'Avenida Brasil, 2.300, Centro — Paranatinga/MT', W / 2, y, { align: 'center' }); y += 5.5;
    doc.setDrawColor(60); doc.setLineWidth(0.6); doc.line(M, y, W - M, y);
    doc.setLineWidth(0.2); doc.line(M, y + 1, W - M, y + 1);
    y += 10;
    doc.setTextColor(0);
  };
  desenharCabecalho();

  // ── Título ──────────────────────────────────────────────────────────────
  doc.setFontSize(13.5); doc.setFont('helvetica', 'bold');
  const tituloLinhas = doc.splitTextToSize('RELATÓRIO DE INSTRUÇÕES RECEBIDAS E TRABALHOS APRESENTADOS', larguraUtil - 20);
  tituloLinhas.forEach(l => { txt(l, W / 2, y, { align: 'center' }); y += 6; });
  y += 4;

  // ── Dados do irmão ──────────────────────────────────────────────────────
  doc.setFontSize(10.5); doc.setFont('helvetica', 'normal');
  doc.setFont('helvetica', 'bold'); txt('Irmão: ', M, y);
  doc.setFont('helvetica', 'normal'); txt(sanitizeTexto(irmao?.nome) || '—', M + 16, y);
  doc.setFont('helvetica', 'bold'); txt('CIM: ', M + 100, y);
  doc.setFont('helvetica', 'normal'); txt(irmao?.cim || '—', M + 114, y);
  y += 6;
  doc.setFont('helvetica', 'bold'); txt('Grau Atual: ', M, y);
  doc.setFont('helvetica', 'normal'); txt(obterGrauAtualLabel(irmao), M + 24, y);
  y += 9;

  // ── Tabela por grau ─────────────────────────────────────────────────────
  const GRAUS = ['Aprendiz', 'Companheiro', 'Mestre'];
  const corGrau = { Aprendiz: [59, 130, 246], Companheiro: [139, 92, 246], Mestre: [245, 158, 11] };

  GRAUS.forEach(grau => {
    const doGrau = (registros || []).filter(r => r.grau === grau)
      .sort((a, b) => a.data_instrucao.localeCompare(b.data_instrucao));
    if (doGrau.length === 0) return;

    checkPage(24);
    const [r, g, b] = corGrau[grau];
    doc.setFillColor(r, g, b);
    doc.rect(M, y - 5, larguraUtil, 7, 'F');
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
    txt(grau.toUpperCase(), M + 3, y);
    doc.setTextColor(0);
    y += 5;

    doc.autoTable({
      startY: y,
      head: [['Instrução', 'Data da Instrução', 'Apresentação da Peça', 'Observações']],
      body: doGrau.map(reg => [
        reg.numero_instrucao || '—',
        fmtData(reg.data_instrucao),
        reg.data_apresentacao ? fmtData(reg.data_apresentacao) : 'Pendente de apresentação',
        sanitizeTexto(reg.observacoes) || '—',
      ]),
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2.2 },
      headStyles: { fillColor: [230, 230, 230], textColor: 30, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 32 },
        2: { cellWidth: 42 },
        3: { cellWidth: larguraUtil - 106 },
      },
      margin: { left: M, right: M },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 2 && data.cell.raw === 'Pendente de apresentação') {
          data.cell.styles.textColor = [217, 119, 6];
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
    y = doc.lastAutoTable.finalY + 8;
  });

  if (!(registros || []).length) {
    doc.setFontSize(10.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(100);
    txt('Nenhuma instrução registrada até a presente data.', M, y);
    doc.setTextColor(0);
    y += 10;
  }

  // ── Parágrafo final ─────────────────────────────────────────────────────
  checkPage(24);
  y += 4;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
  desenharParagrafoJustificado(
    'O presente relatório é expedido a pedido do interessado, para fins de instrução de processo de transferência ou intercâmbio para outra Potência ou Loja, e tem por objetivo registrar, de forma fiel e cronológica, o histórico das instruções ministradas, dos trabalhos apresentados e das atividades desenvolvidas pelo Irmão nesta Augusta e Respeitável Loja Simbólica Acácia de Paranatinga nº 30, conforme os registros oficiais existentes até a presente data.'
  );

  y += 10;

  // ── Local e data ──────────────────────────────────────────────────────────
  const hoje = new Date();
  const cidade = dadosLoja?.cidade || 'Paranatinga';
  const estado = dadosLoja?.estado || 'MT';
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  doc.setFontSize(10.5);
  txt(`${cidade}/${estado}, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}.`, M, y);
  y += 22;

  // ── Assinaturas — Venerável Mestre, Orador, Secretário ──────────────────
  checkPage(60);
  const larguraAssinatura = 70;
  const assinatura = (nome, cargo, x, yy) => {
    if (nome) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(0);
      txt(sanitizeTexto(nome), x, yy - 2, { align: 'center' });
    }
    doc.setDrawColor(0); doc.setLineWidth(0.3);
    doc.line(x - larguraAssinatura / 2, yy, x + larguraAssinatura / 2, yy);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(90);
    txt(cargo, x, yy + 5, { align: 'center' });
    doc.setTextColor(0);
  };
  assinatura(assinantes.veneravelMestre, 'Venerável Mestre', W / 2, y);
  y += 24;
  assinatura(assinantes.orador, 'Orador', M + larguraAssinatura / 2 + 5, y);
  assinatura(assinantes.secretario, 'Secretário', W - M - larguraAssinatura / 2 - 5, y);

  // ── Página 2 — Quadro de Presenças (mesmo cabeçalho da primeira página) ──
  if (presencaMensal && presencaMensal.length > 0) {
    doc.addPage();
    desenharCabecalho();

    doc.setFontSize(13.5); doc.setFont('helvetica', 'bold');
    txt('QUADRO DE PRESENÇAS', W / 2, y, { align: 'center' }); y += 5;
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(90);
    const inicioLabel = presencaMensal[0].label;
    const fimLabel = presencaMensal[presencaMensal.length - 1].label;
    txt(`Período: ${inicioLabel} a ${fimLabel}`, W / 2, y, { align: 'center' });
    doc.setTextColor(0);
    y += 8;

    doc.autoTable({
      startY: y,
      head: [['Mês', 'Sessões Elegíveis', 'Presenças', '% Presença']],
      body: presencaMensal.map(m => [
        m.label,
        String(m.elegiveis),
        String(m.presentes),
        m.percentual === null ? '—' : `${m.percentual}%`,
      ]),
      theme: 'grid',
      styles: { fontSize: 9.5, cellPadding: 2.4, halign: 'center' },
      headStyles: { fillColor: [230, 230, 230], textColor: 30, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 40, halign: 'left' },
        1: { cellWidth: 45 },
        2: { cellWidth: 45 },
        3: { cellWidth: larguraUtil - 130 },
      },
      margin: { left: M, right: M },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3 && data.cell.raw !== '—') {
          const valor = parseInt(data.cell.raw, 10);
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = valor >= 70 ? [16, 129, 87] : valor >= 50 ? [180, 130, 6] : [190, 40, 40];
        }
      },
    });
    y = doc.lastAutoTable.finalY + 8;

    const totalEleg = presencaMensal.reduce((s, m) => s + m.elegiveis, 0);
    const totalPres = presencaMensal.reduce((s, m) => s + m.presentes, 0);
    const percGeral = totalEleg > 0 ? Math.round((totalPres / totalEleg) * 100) : null;
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    txt(`Total do período: ${totalPres}/${totalEleg} sessões (${percGeral === null ? '—' : percGeral + '%'})`, M, y);
  }

  // ── Rodapé ──────────────────────────────────────────────────────────────
  const totalPg = doc.getNumberOfPages();
  for (let p = 1; p <= totalPg; p++) {
    doc.setPage(p);
    doc.setFontSize(7); doc.setTextColor(150);
    txt('SysMaçom-MG - Desenvolvedor: Mauro George', M, 290);
    txt(`Página ${p} de ${totalPg}`, W / 2, 290, { align: 'center' });
    txt(`Emitido em ${hoje.toLocaleDateString('pt-BR')}`, W - M, 290, { align: 'right' });
  }

  doc.save(`Relatorio_Instrucoes_Trabalhos_${(irmao?.nome || 'irmao').replace(/\s+/g, '_')}_${hoje.toISOString().split('T')[0]}.pdf`);
};
