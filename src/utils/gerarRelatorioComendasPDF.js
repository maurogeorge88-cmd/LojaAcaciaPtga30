import jsPDF from 'jspdf';

// A Helvetica padrão do jsPDF não tem "∴" nem emojis — "Ir∴" vira "Ir." e
// emojis somem, senão o texto sai corrompido no PDF.
const limpar = (str) => (str || '')
  .replace(/∴/g, '.')
  .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
  .replace(/[\u2600-\u27BF]/gu, '')
  .replace(/[\uFE00-\uFE0F]/gu, '')
  .replace(/\s{2,}/g, ' ')
  .trim();

const AZUL   = [59, 130, 246];   // faixa de título do quadro (mesmo azul de destaque da tela)
const AMBAR  = [217, 119, 6];    // nome do irmão elegível (âmbar, legível no papel)
const BARRA  = [245, 158, 11];   // faixa lateral âmbar
const CINZA  = [100, 116, 139];
const AZUL_P = [96, 165, 250];   // faixa lateral "em progresso"

/**
 * Relatório de Comendas — um quadro por comenda ativa, igual à aba
 * "Elegíveis" da tela: título com contagem, linha do critério e a lista
 * de irmãos elegíveis (nome em âmbar, CIM embaixo).
 *
 * @param {Array}  comendas  [{ nome, origem, descricao_criterio, tipo_criterio,
 *                              elegiveis: [{ nome, cim, detalhe }], progresso?: [{ nome, cim, detalhe }] }]
 * @param {Object} dadosLoja registro de dados_loja (nome_loja, endereco, logo_url)
 */
export const gerarRelatorioComendasPDF = (comendas, dadosLoja) => {
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

  const totalElegiveis = comendas.reduce((s, c) => s + c.elegiveis.length, 0);
  doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(20);
  txt('COMENDAS — IRMÃOS ELEGÍVEIS', W / 2, y, { align: 'center' }); y += 5.5;
  doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(110);
  txt(`${comendas.length} comenda(s) ativa(s)   •   ${totalElegiveis} elegível(is) no total   •   Emitido em ${new Date().toLocaleDateString('pt-BR')}`, W / 2, y, { align: 'center' });
  y += 8;
  doc.setTextColor(0);

  // ── Peças do quadro ─────────────────────────────────────────────────────
  const desenharTitulo = (comenda, continuacao = false) => {
    doc.setFillColor(...AZUL);
    doc.roundedRect(M, y, LARG, 9, 2, 2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(255);
    const prefixo = comenda.origem ? `[${comenda.origem.toUpperCase()}]  ` : '';
    txt(prefixo + limpar(comenda.nome) + (continuacao ? '  (continuação)' : ''), M + 4, y + 6);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(235, 243, 255);
    const nProg = (comenda.progresso || []).length;
    txt(`${comenda.elegiveis.length} elegível(is)${nProg ? `  •  ${nProg} em progresso` : ''}`, W - M - 4, y + 6, { align: 'right' });
    doc.setTextColor(0);
    y += 9;
  };

  comendas.forEach((comenda) => {
    const criterio = limpar(comenda.descricao_criterio);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    const linhasCriterio = criterio ? doc.splitTextToSize(criterio, LARG - 8) : [];
    const alturaCriterio = linhasCriterio.length > 0 ? linhasCriterio.length * 3.8 + 4 : 0;

    // Título + critério + a primeira linha ficam juntos; senão vai tudo pra página seguinte
    if (y + 9 + alturaCriterio + 12 > LIMITE_Y) { doc.addPage(); y = 15; }

    desenharTitulo(comenda);

    if (alturaCriterio > 0) {
      doc.setFillColor(241, 245, 249);
      doc.rect(M, y, LARG, alturaCriterio, 'F');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...CINZA);
      linhasCriterio.forEach((ln, i) => txt(ln, M + 4, y + 5 + i * 3.8));
      doc.setTextColor(0);
      y += alturaCriterio;
    }

    const inicioCorpo = y;
    const bordaCorpo = () => {
      doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.3);
    };
    bordaCorpo();

    if (comenda.tipo_criterio === 'manual') {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...CINZA);
      txt('Critério manual — sem apuração automática.', W / 2, y + 7, { align: 'center' });
      doc.setTextColor(0);
      doc.rect(M, inicioCorpo, LARG, 11);
      y += 11 + 6;
      return;
    }

    const linhas = [
      ...comenda.elegiveis.map(e => ({ ...e, prog: false })),
      ...(comenda.progresso || []).map(p => ({ ...p, prog: true })),
    ];

    if (linhas.length === 0) {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...CINZA);
      txt('Nenhum irmão elegível no momento.', W / 2, y + 7, { align: 'center' });
      doc.setTextColor(0);
      doc.rect(M, inicioCorpo, LARG, 11);
      y += 11 + 6;
      return;
    }

    let inicioTrecho = inicioCorpo;
    linhas.forEach((irmao, idx) => {
      const ALT = 11;
      if (y + ALT > LIMITE_Y) {
        // fecha a borda do trecho desta página e continua na próxima
        doc.setDrawColor(203, 213, 225); doc.rect(M, inicioTrecho, LARG, y - inicioTrecho);
        doc.addPage(); y = 15;
        desenharTitulo(comenda, true);
        inicioTrecho = y;
      }
      if (idx % 2 === 1) { doc.setFillColor(248, 250, 252); doc.rect(M, y, LARG, ALT, 'F'); }
      doc.setFillColor(...(irmao.prog ? AZUL_P : BARRA));
      doc.rect(M, y, 1.4, ALT, 'F');

      doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      if (irmao.prog) doc.setTextColor(51, 65, 85); else doc.setTextColor(...AMBAR);
      txt(limpar(irmao.nome), M + 5, y + 4.8);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...CINZA);
      txt(`CIM: ${irmao.cim || '—'}`, M + 5, y + 8.6);
      if (irmao.detalhe) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
        if (irmao.prog) doc.setTextColor(37, 99, 235); else doc.setTextColor(...AMBAR);
        txt(limpar(irmao.detalhe), W - M - 3, y + 6.6, { align: 'right' });
      }
      doc.setTextColor(0);
      y += ALT;
    });
    doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.3);
    doc.rect(M, inicioTrecho, LARG, y - inicioTrecho);
    y += 7;
  });

  // ── Rodapé em todas as páginas ──────────────────────────────────────────
  const totalPaginas = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(150);
    txt('SysMaçom-MG - Desenvolvedor: Mauro George', M, 290);
    txt(`Página ${p} de ${totalPaginas}`, W / 2, 290, { align: 'center' });
    txt(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, W - M, 290, { align: 'right' });
  }

  doc.save(`Comendas_Elegiveis_${new Date().toISOString().split('T')[0]}.pdf`);
};
