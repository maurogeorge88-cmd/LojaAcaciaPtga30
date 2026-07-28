import jsPDF from 'jspdf';

const fmtR = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const obterGrauLabel = (situacaoOuGrau) => {
  // Aceita tanto um objeto irmão (com data_exaltacao/data_elevacao) quanto
  // uma string de grau já pronta, pra ficar flexível com o que o chamador tiver.
  if (!situacaoOuGrau) return '—';
  if (typeof situacaoOuGrau === 'string') return situacaoOuGrau;
  if (situacaoOuGrau.mestre_instalado) return 'Mestre Instalado';
  if (situacaoOuGrau.data_exaltacao)   return 'Mestre';
  if (situacaoOuGrau.data_elevacao)    return 'Companheiro';
  if (situacaoOuGrau.data_iniciacao)   return 'Aprendiz';
  return '—';
};

// A fonte padrão (Helvetica) do jsPDF não tem o glifo "∴" (símbolo maçônico
// usado em "A∴R∴L∴S∴") — ele sai corrompido no PDF. Sanitiza removendo esse
// e outros símbolos que a fonte padrão não suporta, mantendo acentuação
// normal (que a Helvetica do jsPDF já suporta nativamente).
const sanitizeTexto = (str) => (str || '')
  .replace(/∴/g, '')
  .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
  .replace(/[\u2600-\u27BF]/gu, '')
  .replace(/[\uFE00-\uFE0F]/gu, '')
  .replace(/\s{2,}/g, ' ')
  .trim();

/**
 * Gera a Certidão Negativa (sem débito) ou Positiva (com débito) de um irmão,
 * decidido automaticamente pelo valor de `valorDevido`.
 *
 * @param {Object} irmao        { nomeIrmao, cim, grau (string) }
 * @param {number} valorDevido  soma de receitasPendentes (0 = negativa)
 * @param {Object} dadosLoja    { nome, endereco, logo_url, cidade, estado }
 * @param {Object} assinantes   { tesoureiro, veneravelMestre }
 */
export const gerarCertidaoFinanceiraPDF = (irmao, valorDevido, dadosLoja, assinantes = {}) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, M = 25;
  let y = 20;

  const txt = (text, x, yy, opts = {}) => doc.text(String(text), x, yy, opts);
  const negativa = !(valorDevido > 0);
  const larguraUtil = W - M * 2;
  const alturaLinha = 6.2;

  // ── Desenha um parágrafo composto de trechos (normal/negrito), quebrando
  // linha pela largura útil e JUSTIFICANDO todas as linhas menos a última
  // (mesma convenção de textos formais/jurídicos). ─────────────────────────
  const desenharParagrafoJustificado = (partes, tamanhoFonte = 11.5) => {
    doc.setFontSize(tamanhoFonte);
    doc.setFont('helvetica', 'normal');
    const espacoLargura = doc.getTextWidth(' ');

    // Quebra as partes em palavras (sem espaço embutido), preservando o
    // estilo (negrito/normal) de cada uma.
    const palavras = [];
    partes.forEach(parte => {
      sanitizeTexto(parte.t).split(' ').forEach(p => {
        if (p.length > 0) palavras.push({ texto: p, b: parte.b });
      });
    });

    // Agrupa as palavras em linhas, respeitando a largura útil da página
    const linhas = [];
    let linhaAtual = [];
    let larguraAtual = 0;
    palavras.forEach(w => {
      doc.setFont('helvetica', w.b ? 'bold' : 'normal');
      const larguraPalavra = doc.getTextWidth(w.texto);
      const espacoExtra = linhaAtual.length > 0 ? espacoLargura : 0;
      if (larguraAtual + espacoExtra + larguraPalavra > larguraUtil && linhaAtual.length > 0) {
        linhas.push(linhaAtual);
        linhaAtual = [];
        larguraAtual = 0;
      }
      if (linhaAtual.length > 0) larguraAtual += espacoLargura;
      linhaAtual.push(w);
      larguraAtual += larguraPalavra;
    });
    if (linhaAtual.length > 0) linhas.push(linhaAtual);

    // Desenha cada linha — justificada (espaço distribuído), exceto a última
    linhas.forEach((linha, idxLinha) => {
      const ehUltima = idxLinha === linhas.length - 1;
      const larguraPalavras = linha.reduce((s, w) => {
        doc.setFont('helvetica', w.b ? 'bold' : 'normal');
        return s + doc.getTextWidth(w.texto);
      }, 0);
      const gaps = linha.length - 1;
      const espacoUsado = (!ehUltima && gaps > 0)
        ? (larguraUtil - larguraPalavras) / gaps
        : espacoLargura;

      let x = M;
      linha.forEach((w, i) => {
        doc.setFont('helvetica', w.b ? 'bold' : 'normal');
        txt(w.texto, x, y);
        x += doc.getTextWidth(w.texto) + (i < linha.length - 1 ? espacoUsado : 0);
      });
      y += alturaLinha;
    });
  };

  // ── Cabeçalho da Loja (mesmo padrão dos demais relatórios) ─────────────────
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
  txt(negativa ? 'CERTIDÃO NEGATIVA DE DÉBITOS' : 'CERTIDÃO POSITIVA DE DÉBITOS', W / 2, y, { align: 'center' });
  y += 16;

  // ── Corpo do texto — mesma estrutura de frase nos dois casos, só troca o
  // trecho que fala da situação (regular / com débito). ─────────────────────
  const partesNegativa = [
    { t: 'Certificamos, para os devidos fins, que o Irmão ', b: false },
    { t: irmao.nomeIrmao || '—', b: true },
    { t: ', portador do Cadastro de Identidade Maçônica – CIM nº ', b: false },
    { t: irmao.cim || '—', b: true },
    { t: ', detentor do Grau ', b: false },
    { t: obterGrauLabel(irmao.grau), b: true },
    { t: ', encontra-se em ', b: false },
    { t: 'plena regularidade financeira', b: true },
    { t: ' perante a Tesouraria desta Augusta e Respeitável Loja Simbólica Acácia de Paranatinga nº 30, ', b: false },
    { t: 'inexistindo, até a presente data, quaisquer débitos, pendências financeiras ou obrigações pecuniárias em aberto em seu nome.', b: true },
  ];
  const partesPositiva = [
    { t: 'Certificamos, para os devidos fins, que o Irmão ', b: false },
    { t: irmao.nomeIrmao || '—', b: true },
    { t: ', portador do Cadastro de Identidade Maçônica – CIM nº ', b: false },
    { t: irmao.cim || '—', b: true },
    { t: ', detentor do Grau ', b: false },
    { t: obterGrauLabel(irmao.grau), b: true },
    { t: ', NÃO se encontra em ', b: false },
    { t: 'regularidade financeira', b: true },
    { t: ' perante a Tesouraria desta Augusta e Respeitável Loja Simbólica Acácia de Paranatinga nº 30, ', b: false },
    { t: `constando, até a presente data, débito(s) pendente(s) no valor total de ${fmtR(valorDevido)}.`, b: true },
  ];
  desenharParagrafoJustificado(negativa ? partesNegativa : partesPositiva);

  y += 8;

  // ── Parágrafo final ──────────────────────────────────────────────────────
  desenharParagrafoJustificado([
    { t: 'A presente certidão é expedida a pedido do interessado e destina-se aos fins que se fizerem necessários, produzindo seus efeitos na data de sua emissão.', b: false },
  ]);

  y += 14;

  // ── Local e data ──────────────────────────────────────────────────────────
  const hoje = new Date();
  const cidade = dadosLoja?.cidade || 'Paranatinga';
  const estado = dadosLoja?.estado || 'MT';
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(0);
  txt(`${cidade}/${estado}, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}.`, M, y);
  y += 26;

  // ── Assinaturas ─────────────────────────────────────────────────────────
  // Uma única linha por assinante: a linha desenhada + o cargo logo abaixo.
  // Se um nome for informado, ele aparece ACIMA da linha (como de praxe em
  // atos formais); se não for informado, fica só a linha em branco pra
  // assinatura manual — sem nenhum texto duplicado por baixo.
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

  // ── Rodapé ──────────────────────────────────────────────────────────────
  doc.setFontSize(7); doc.setTextColor(150);
  txt('SysMaçom-MG - Desenvolvedor: Mauro George', M, 285);
  txt(`Emitido em ${hoje.toLocaleDateString('pt-BR')} às ${hoje.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, W - M, 285, { align: 'right' });

  const tipoArquivo = negativa ? 'Negativa' : 'Positiva';
  doc.save(`Certidao_${tipoArquivo}_${(irmao.nomeIrmao || 'irmao').replace(/\s+/g, '_')}_${hoje.toISOString().split('T')[0]}.pdf`);
};
