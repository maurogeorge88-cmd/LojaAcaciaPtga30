import jsPDF from 'jspdf';

// A Helvetica padrão do jsPDF não tem "∴" nem emojis — saem corrompidos.
const limpar = (str) => (str || '')
  .replace(/∴/g, '.')
  .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
  .replace(/[\u2600-\u27BF]/gu, '')
  .replace(/[\uFE00-\uFE0F]/gu, '')
  .replace(/\s{2,}/g, ' ')
  .trim();

const fmtR = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtD = (d) => d ? new Date(String(d).substring(0, 10) + 'T00:00:00').toLocaleDateString('pt-BR') : '';

const NAVY   = [30, 58, 95];
const AZUL   = [59, 130, 246];
const AMBAR  = [217, 119, 6];
const VERDE  = [22, 163, 74];
const VERM   = [220, 38, 38];
const CINZA  = [100, 116, 139];

const corStatus = (status) => {
  if (status === 'concluido') return VERDE;
  if (status === 'cancelado') return VERM;
  if (status === 'em_andamento') return AZUL;
  return CINZA;
};

/**
 * Resumo de Projetos e Campanhas — pra enviar aos irmãos.
 *
 * @param {Array}  projetos  [{ nome, descricao, tipo, tipoLabel, status, statusLabel, ano,
 *                              data_inicio, data_prevista_termino, responsavel,
 *                              valorPrevisto, totalReceitas, totalCustos, saldo, pct }]
 *                           (já filtrados pelo exercício escolhido)
 * @param {Object} dadosLoja registro de dados_loja (nome_loja, endereco, logo_url)
 * @param {string} filtroAno 'todos' ou o ano (ex.: '2026')
 */
export const gerarRelatorioProjetosPDF = (projetos, dadosLoja, filtroAno) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, M = 15, LARG = W - M * 2;
  const LIMITE_Y = 272;
  let y = 10;

  const txt = (t, x, yy, opts = {}) => doc.text(String(t), x, yy, opts);

  // ── Cabeçalho padrão da Loja ────────────────────────────────────────────
  const nomeLoja = limpar(dadosLoja?.nome_loja || dadosLoja?.nome) || 'ARLS Acácia de Paranatinga nº 30';
  if (dadosLoja?.logo_url) {
    try { doc.addImage(dadosLoja.logo_url, 'PNG', (W - 24) / 2, y, 24, 24); y += 29; }
    catch (e) { y += 2; }
  }
  doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(30);
  txt(nomeLoja, W / 2, y, { align: 'center' }); y += 6;
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(80);
  txt(limpar(dadosLoja?.endereco) || 'Avenida Brasil, 2.300, Centro — Paranatinga/MT', W / 2, y, { align: 'center' }); y += 5;
  doc.setDrawColor(80); doc.setLineWidth(0.5); doc.line(M, y, W - M, y);
  doc.setLineWidth(0.2); doc.line(M, y + 1, W - M, y + 1);
  y += 8;

  const rotuloAno = filtroAno === 'todos' ? 'Todos os Exercícios' : (filtroAno === 'Sem data' ? 'Sem data de início' : `Exercício ${filtroAno}`);
  doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(20);
  txt('PROJETOS E CAMPANHAS', W / 2, y, { align: 'center' }); y += 5.5;
  doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY);
  txt(rotuloAno.toUpperCase(), W / 2, y, { align: 'center' }); y += 4.5;
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(110);
  txt(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, W / 2, y, { align: 'center' }); y += 7;
  doc.setTextColor(0);

  // ── Quadros de resumo ───────────────────────────────────────────────────
  const qtdCampanhas = projetos.filter(p => p.tipo === 'campanha').length;
  const qtdProjetos = projetos.length - qtdCampanhas;
  const somaReceitas = projetos.reduce((s, p) => s + (p.totalReceitas || 0), 0);
  const somaCustos = projetos.reduce((s, p) => s + (p.totalCustos || 0), 0);

  const cards = [
    { label: 'PROJETOS', valor: String(qtdProjetos), cor: AZUL },
    { label: 'CAMPANHAS', valor: String(qtdCampanhas), cor: AMBAR },
    { label: 'RECEITAS / ARRECADADO', valor: fmtR(somaReceitas), cor: VERDE },
    { label: 'CUSTOS', valor: fmtR(somaCustos), cor: VERM },
  ];
  const GAP = 4, CW = (LARG - GAP * 3) / 4;
  cards.forEach((c, i) => {
    const x = M + i * (CW + GAP);
    doc.setFillColor(248, 250, 252); doc.roundedRect(x, y, CW, 17, 2, 2, 'F');
    doc.setDrawColor(...c.cor); doc.setLineWidth(0.5); doc.roundedRect(x, y, CW, 17, 2, 2, 'S');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...CINZA);
    txt(c.label, x + CW / 2, y + 5.5, { align: 'center' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(c.valor.length > 11 ? 9 : 12); doc.setTextColor(...c.cor);
    txt(c.valor, x + CW / 2, y + 12.5, { align: 'center' });
  });
  doc.setTextColor(0);
  y += 17 + 8;

  if (projetos.length === 0) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(10); doc.setTextColor(...CINZA);
    txt('Nenhum projeto ou campanha neste exercício.', W / 2, y + 6, { align: 'center' });
  }

  // ── Agrupa por exercício (faixa só quando há mais de um ano) ───────────
  const porAno = {};
  projetos.forEach(p => { (porAno[p.ano] = porAno[p.ano] || []).push(p); });
  const anos = Object.keys(porAno).sort((a, b) => {
    if (a === 'Sem data') return 1;
    if (b === 'Sem data') return -1;
    return b.localeCompare(a);
  });
  const mostrarFaixa = anos.length > 1;

  const desenharFaixaAno = (ano, lista) => {
    const camp = lista.filter(p => p.tipo === 'campanha').length;
    doc.setFillColor(...NAVY); doc.roundedRect(M, y, LARG, 9, 2, 2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(255);
    txt(ano === 'Sem data' ? 'SEM DATA DE INÍCIO' : `EXERCÍCIO ${ano}`, M + 4, y + 6.2);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(210, 225, 245);
    txt(`${lista.length - camp} projeto(s)  •  ${camp} campanha(s)`, W - M - 4, y + 6, { align: 'right' });
    doc.setTextColor(0);
    y += 9 + 4;
  };

  const desenharProjeto = (p) => {
    const ehCampanha = p.tipo === 'campanha';
    const corTipo = ehCampanha ? AMBAR : AZUL;

    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    const descLinhas = p.descricao ? doc.splitTextToSize(limpar(p.descricao), LARG - 12).slice(0, 4) : [];
    const altDesc = descLinhas.length > 0 ? descLinhas.length * 3.7 + 2 : 0;
    const altura = 16 + altDesc + 13 + 10 + 8;

    if (y + altura > LIMITE_Y) { doc.addPage(); y = 15; }
    const y0 = y;

    // caixa + faixa lateral (âmbar p/ campanha, azul p/ projeto)
    doc.setFillColor(255, 255, 255); doc.rect(M, y0, LARG, altura, 'F');
    doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.3); doc.rect(M, y0, LARG, altura, 'S');
    doc.setFillColor(...corTipo); doc.rect(M, y0, 1.8, altura, 'F');

    // nome
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(25);
    txt(limpar(p.nome), M + 6, y0 + 6.2);

    // tipo • status
    doc.setFontSize(7.5); doc.setTextColor(...corTipo);
    const tipoTxt = limpar(p.tipoLabel || p.tipo).toUpperCase();
    txt(tipoTxt, M + 6, y0 + 11);
    const wTipo = doc.getTextWidth(tipoTxt);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...CINZA);
    txt('  •  ', M + 6 + wTipo, y0 + 11);
    const wSep = doc.getTextWidth('  •  ');
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...corStatus(p.status));
    txt(limpar(p.statusLabel || p.status), M + 6 + wTipo + wSep, y0 + 11);

    // descrição
    let yy = y0 + 16;
    if (descLinhas.length > 0) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(70);
      descLinhas.forEach((ln, i) => txt(ln, M + 6, yy + i * 3.7 + 1));
      yy += altDesc;
    }

    // métricas
    const metricas = ehCampanha
      ? [
          { l: 'META DE ARRECADAÇÃO', v: fmtR(p.valorPrevisto), c: AMBAR },
          { l: 'ARRECADADO', v: fmtR(p.totalReceitas), c: VERDE },
          { l: 'PROGRESSO', v: `${(p.pct || 0).toFixed(1)}%`, c: p.pct >= 100 ? VERDE : AMBAR },
        ]
      : [
          { l: 'PREVISTO', v: fmtR(p.valorPrevisto), c: AZUL },
          { l: 'RECEITAS', v: fmtR(p.totalReceitas), c: VERDE },
          { l: 'CUSTOS', v: fmtR(p.totalCustos), c: VERM },
          { l: 'SALDO', v: fmtR(p.saldo), c: p.saldo >= 0 ? VERDE : VERM },
        ];
    const colW = (LARG - 12) / metricas.length;
    metricas.forEach((m, i) => {
      const x = M + 6 + i * colW;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...CINZA);
      txt(m.l, x, yy + 3);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...m.c);
      txt(m.v, x, yy + 8);
    });
    yy += 13;

    // barra de progresso
    const pct = Math.max(0, p.pct || 0);
    const rotuloBarra = ehCampanha ? 'Progresso da meta' : 'Execução do orçamento';
    const larguraBarra = LARG - 12;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...CINZA);
    txt(rotuloBarra, M + 6, yy + 1.5);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(60);
    txt(`${pct.toFixed(1)}%`, M + 6 + larguraBarra, yy + 1.5, { align: 'right' });
    doc.setFillColor(226, 232, 240); doc.roundedRect(M + 6, yy + 3, larguraBarra, 2.6, 1.2, 1.2, 'F');
    const corBarra = ehCampanha ? (pct >= 100 ? VERDE : AMBAR) : (pct > 100 ? VERM : pct > 75 ? AMBAR : AZUL);
    doc.setFillColor(...corBarra);
    const wPreench = larguraBarra * Math.min(100, pct) / 100;
    if (wPreench > 0.5) doc.roundedRect(M + 6, yy + 3, wPreench, 2.6, 1.2, 1.2, 'F');
    yy += 10;

    // rodapé do quadro: datas e responsável
    const partes = [];
    if (p.data_inicio) partes.push(`Início: ${fmtD(p.data_inicio)}`);
    if (p.data_prevista_termino) partes.push(`Previsão: ${fmtD(p.data_prevista_termino)}`);
    if (p.responsavel) partes.push(`Responsável: ${limpar(p.responsavel)}`);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...CINZA);
    txt(partes.join('   •   ') || ' ', M + 6, yy + 3);
    doc.setTextColor(0);

    y = y0 + altura + 5;
  };

  anos.forEach(ano => {
    const lista = porAno[ano];
    if (mostrarFaixa) {
      if (y + 9 + 4 + 50 > LIMITE_Y) { doc.addPage(); y = 15; }
      desenharFaixaAno(ano, lista);
    }
    lista.forEach(desenharProjeto);
    y += 3;
  });

  // ── Rodapé em todas as páginas ──────────────────────────────────────────
  const totalPaginas = doc.internal.getNumberOfPages();
  for (let pg = 1; pg <= totalPaginas; pg++) {
    doc.setPage(pg);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(150);
    txt('SysMaçom-MG - Desenvolvedor: Mauro George', M, 290);
    txt(`Página ${pg} de ${totalPaginas}`, W / 2, 290, { align: 'center' });
    txt(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, W - M, 290, { align: 'right' });
  }

  doc.save(`Projetos_Campanhas_${filtroAno === 'todos' ? 'Todos' : filtroAno.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
};
