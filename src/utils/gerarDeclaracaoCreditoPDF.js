import jsPDF from 'jspdf';

const fmtR = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtData = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

const obterGrauLabel = (irmaoOuGrau) => {
  if (!irmaoOuGrau) return null;
  if (typeof irmaoOuGrau === 'string') return irmaoOuGrau;
  if (irmaoOuGrau.mestre_instalado) return 'Mestre Instalado';
  if (irmaoOuGrau.data_exaltacao)   return 'Mestre';
  if (irmaoOuGrau.data_elevacao)    return 'Companheiro';
  if (irmaoOuGrau.data_iniciacao)   return 'Aprendiz';
  return null;
};

// 11 dígitos viram 000.000.000-00; qualquer outra coisa é impressa como veio.
const formatarCpf = (cpf) => {
  const d = String(cpf || '').replace(/\D/g, '');
  return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : String(cpf || '').trim();
};

// A Helvetica padrão do jsPDF não tem "∴" nem emojis — saem corrompidos.
const sanitizeTexto = (str) => (str || '')
  .replace(/∴/g, '')
  .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
  .replace(/[\u2600-\u27BF]/gu, '')
  .replace(/[\uFE00-\uFE0F]/gu, '')
  .replace(/\s{2,}/g, ' ')
  .trim();

/**
 * Declaração de Crédito — a Loja reconhece o valor que deve ao irmão.
 * Serve para os dois casos: irmão com CIM (imprime CIM e grau, quando
 * houver) e pessoa ainda não iniciada (identificada só por nome e CPF).
 *
 * @param {Object} irmao      { nomeIrmao, cpf, cim, grau } — grau pode ser o objeto do irmão
 * @param {Array}  itens      [{ data_vencimento, descricao, valor }] — créditos pendentes
 * @param {Object} dadosLoja  { nome, endereco, logo_url, cidade, estado }
 * @param {Object} assinantes { tesoureiro, veneravelMestre }
 */
export const gerarDeclaracaoCreditoPDF = (irmao, itens, dadosLoja, assinantes = {}) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, M = 25;
  const larguraUtil = W - M * 2;
  const alturaLinha = 6.2;
  let y = 20;

  const txt = (text, x, yy, opts = {}) => doc.text(String(text), x, yy, opts);
  const total = (itens || []).reduce((s, l) => s + Number(l.valor || 0), 0);

  const garantirEspaco = (altura) => {
    if (y + altura > 272) { doc.addPage(); y = 20; }
  };

  // Parágrafo com trechos normal/negrito, justificado (menos a última linha).
  // Pontuação que abre um trecho (", inscrito...") é COLADA na palavra
  // anterior — sem isso sairia "Fulano , inscrito". Uma "palavra" pode ter
  // vários segmentos de estilos diferentes (ex.: nome em negrito + vírgula normal).
  const desenharParagrafoJustificado = (partes, tamanhoFonte = 11.5) => {
    doc.setFontSize(tamanhoFonte);
    doc.setFont('helvetica', 'normal');
    const espacoLargura = doc.getTextWidth(' ');

    const palavras = [];
    let anteriorTerminaComEspaco = true;
    partes.forEach(parte => {
      const raw = parte.t || '';
      const comecaComEspaco = /^\s/.test(raw);
      sanitizeTexto(raw).split(' ').filter(Boolean).forEach((p, i) => {
        const colar = i === 0 && !comecaComEspaco && !anteriorTerminaComEspaco && palavras.length > 0;
        if (colar) palavras[palavras.length - 1].segs.push({ texto: p.replace(/~/g, ' '), b: parte.b });
        else palavras.push({ segs: [{ texto: p.replace(/~/g, ' '), b: parte.b }] });
      });
      anteriorTerminaComEspaco = /\s$/.test(raw);
    });

    const larguraPalavra = (w) => w.segs.reduce((s, sg) => {
      doc.setFont('helvetica', sg.b ? 'bold' : 'normal');
      return s + doc.getTextWidth(sg.texto);
    }, 0);

    const linhas = [];
    let linhaAtual = [];
    let larguraAtual = 0;
    palavras.forEach(w => {
      const lw = larguraPalavra(w);
      const espacoExtra = linhaAtual.length > 0 ? espacoLargura : 0;
      if (larguraAtual + espacoExtra + lw > larguraUtil && linhaAtual.length > 0) {
        linhas.push(linhaAtual);
        linhaAtual = [];
        larguraAtual = 0;
      }
      if (linhaAtual.length > 0) larguraAtual += espacoLargura;
      linhaAtual.push(w);
      larguraAtual += lw;
    });
    if (linhaAtual.length > 0) linhas.push(linhaAtual);

    linhas.forEach((linha, idxLinha) => {
      garantirEspaco(alturaLinha);
      const ehUltima = idxLinha === linhas.length - 1;
      const larguraPalavras = linha.reduce((s, w) => s + larguraPalavra(w), 0);
      const gaps = linha.length - 1;
      const espacoUsado = (!ehUltima && gaps > 0) ? (larguraUtil - larguraPalavras) / gaps : espacoLargura;

      let x = M;
      linha.forEach((w, i) => {
        w.segs.forEach(sg => {
          doc.setFont('helvetica', sg.b ? 'bold' : 'normal');
          txt(sg.texto, x, y);
          x += doc.getTextWidth(sg.texto);
        });
        if (i < linha.length - 1) x += espacoUsado;
      });
      y += alturaLinha;
    });
  };

  // ── Cabeçalho da Loja (mesmo padrão da certidão) ────────────────────────
  if (dadosLoja?.logo_url) {
    try {
      doc.addImage(dadosLoja.logo_url, 'PNG', (W - 26) / 2, y, 26, 26);
      y += 30;
    } catch (e) { y += 2; }
  }

  doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(20);
  txt(sanitizeTexto(dadosLoja?.nome) || 'ARLS Acacia de Paranatinga no 30', W / 2, y, { align: 'center' }); y += 6;
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(90);
  txt(sanitizeTexto(dadosLoja?.endereco) || 'Avenida Brasil, 2.300, Centro — Paranatinga/MT', W / 2, y, { align: 'center' }); y += 6;

  doc.setDrawColor(60); doc.setLineWidth(0.6); doc.line(M, y, W - M, y);
  doc.setLineWidth(0.2); doc.line(M, y + 1, W - M, y + 1);
  y += 14;
  doc.setTextColor(0);

  // ── Título ──────────────────────────────────────────────────────────────
  doc.setFontSize(15); doc.setFont('helvetica', 'bold');
  txt('DECLARAÇÃO DE CRÉDITO', W / 2, y, { align: 'center' });
  y += 16;

  // ── Identificação — muda conforme o que o cadastro tem ──────────────────
  // Com CIM: "o Irmão NOME, portador do CIM nº X, detentor do Grau Y".
  // Sem CIM (ainda não iniciado): "o Senhor NOME". CPF entra nos dois casos, se houver.
  const temCim = !!String(irmao.cim || '').trim();
  const grau = temCim ? obterGrauLabel(irmao.grau) : null;
  const cpf = formatarCpf(irmao.cpf);

  const identificacao = temCim
    ? [{ t: 'o Irmão ', b: false }, { t: irmao.nomeIrmao || '—', b: true },
       { t: ', portador do Cadastro de Identidade Maçônica – CIM nº ', b: false }, { t: String(irmao.cim).trim(), b: true }]
    : [{ t: 'o Senhor ', b: false }, { t: irmao.nomeIrmao || '—', b: true }];
  if (grau) identificacao.push({ t: ', detentor do Grau ', b: false }, { t: grau, b: true });
  if (cpf) identificacao.push({ t: ', inscrito no CPF nº ', b: false }, { t: cpf, b: true });

  desenharParagrafoJustificado([
    { t: 'Declaramos, para os devidos fins, que esta Augusta e Respeitável Loja Simbólica Acácia de Paranatinga nº 30 reconhece que ', b: false },
    ...identificacao,
    { t: ', possui ', b: false },
    { t: 'CRÉDITO', b: true },
    { t: ' junto à Tesouraria desta Loja, no valor total de ', b: false },
    { t: fmtR(total).replace(' ', '~'), b: true },
    { t: ', conforme os lançamentos relacionados a seguir.', b: false },
  ]);

  y += 6;

  // ── Tabela de lançamentos que compõem o crédito ─────────────────────────
  const xData = M, xDesc = M + 30, xValor = W - M;
  const larguraDesc = xValor - 32 - xDesc;
  const cabecalho = () => {
    garantirEspaco(10);
    doc.setFillColor(235, 235, 235);
    doc.rect(M, y - 4.5, larguraUtil, 7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(0);
    txt('Vencimento', xData + 2, y);
    txt('Descrição', xDesc, y);
    txt('Valor', xValor - 2, y, { align: 'right' });
    y += 6;
  };
  cabecalho();

  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  (itens || []).forEach(l => {
    const linhasDesc = doc.splitTextToSize(sanitizeTexto(l.descricao) || '—', larguraDesc);
    const alturaItem = Math.max(1, linhasDesc.length) * 4.6 + 2;
    if (y + alturaItem > 272) { doc.addPage(); y = 20; cabecalho(); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); }
    doc.setTextColor(0);
    txt(fmtData(l.data_vencimento), xData + 2, y);
    linhasDesc.forEach((ln, i) => txt(ln, xDesc, y + i * 4.6));
    txt(fmtR(l.valor), xValor - 2, y, { align: 'right' });
    y += alturaItem;
    doc.setDrawColor(215); doc.setLineWidth(0.15); doc.line(M, y - 3, W - M, y - 3);
  });

  garantirEspaco(12);
  y += 1;
  doc.setDrawColor(0); doc.setLineWidth(0.4); doc.line(M, y - 2, W - M, y - 2);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(0);
  txt('TOTAL DO CRÉDITO', xDesc, y + 4);
  txt(fmtR(total), xValor - 2, y + 4, { align: 'right' });
  y += 16;

  // ── Parágrafo final ─────────────────────────────────────────────────────
  // Reserva espaço pro parágrafo + data + assinaturas juntos: se não couberem
  // na página atual, tudo vai pra próxima (assinatura nunca fica sozinha).
  garantirEspaco(100);
  desenharParagrafoJustificado([
    { t: 'A presente declaração é expedida a pedido do interessado e destina-se aos fins que se fizerem necessários, produzindo seus efeitos na data de sua emissão.', b: false },
  ]);

  garantirEspaco(84);
  y += 10;

  const hoje = new Date();
  const cidade = dadosLoja?.cidade || 'Paranatinga';
  const estado = dadosLoja?.estado || 'MT';
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(0);
  txt(`${cidade}/${estado}, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}.`, M, y);
  y += 26;

  const assinatura = (nome, cargo, yy) => {
    if (nome) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(0);
      txt(sanitizeTexto(nome), M, yy - 2);
    }
    doc.setDrawColor(0); doc.setLineWidth(0.3);
    doc.line(M, yy, M + 80, yy);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90);
    txt(cargo, M, yy + 5);
    doc.setTextColor(0);
  };
  assinatura(assinantes.tesoureiro, 'Tesoureiro', y);
  y += 26;
  assinatura(assinantes.veneravelMestre, 'Venerável Mestre', y);

  // ── Rodapé em todas as páginas ──────────────────────────────────────────
  const totalPaginas = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(150);
    txt('SysMaçom-MG - Desenvolvedor: Mauro George', M, 285);
    txt(`Página ${p} de ${totalPaginas}`, W / 2, 285, { align: 'center' });
    txt(`Emitido em ${hoje.toLocaleDateString('pt-BR')} às ${hoje.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, W - M, 285, { align: 'right' });
  }

  doc.save(`Declaracao_Credito_${(irmao.nomeIrmao || 'irmao').replace(/\s+/g, '_')}_${hoje.toISOString().split('T')[0]}.pdf`);
};
