import jsPDF from 'jspdf';

// A fonte padrão (Helvetica) do jsPDF não tem o glifo "∴" (símbolo maçônico
// usado em "A∴R∴L∴S∴") — sai corrompido no PDF. Sanitiza removendo esse e
// outros símbolos que a fonte padrão não suporta, mantendo acentuação normal.
const sanitizeTexto = (str) => (str || '')
  .replace(/∴/g, '')
  .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
  .replace(/[\u2600-\u27BF]/gu, '')
  .replace(/[\uFE00-\uFE0F]/gu, '')
  .trim();

// Carrega a imagem de fundo (papel timbrado) como base64 — precisa disso
// pro jsPDF conseguir desenhar como fundo de página inteira.
const carregarImagemBase64 = async (url) => {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Gera o Ofício de Pendência Financeira de um irmão — mesmo padrão de
 * cabeçalho/assinatura da Certidão Financeira, com o papel timbrado
 * (fundo) atrás do texto e o corpo já editado pelo usuário no modal.
 *
 * @param {Object} irmao       { nomeIrmao, cim }
 * @param {string} textoOficio corpo do ofício, já revisado/editado pelo
 *                             usuário — parágrafos separados por linha em branco
 * @param {Object} dadosLoja   { cidade, estado }
 * @param {Object} assinantes  { tesoureiro, veneravelMestre }
 */
export const gerarOficioPendenciaPDF = async (irmao, textoOficio, dadosLoja, assinantes = {}) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, H = 297, M = 25;
  const larguraUtil = W - M * 2;
  const alturaLinha = 5.6;
  // A imagem de fundo já traz cabeçalho (topo) e rodapé (base) prontos —
  // o texto precisa ficar dentro dessa janela, sem sobrepor nenhum dos dois.
  const yTopoUtil = 46;
  const yBaseUtil = 258;

  let fundoBase64 = null;
  try {
    fundoBase64 = await carregarImagemBase64('/oficio-fundo.jpg');
  } catch (e) {
    console.error('Não foi possível carregar o papel timbrado do ofício:', e);
  }

  const desenharFundo = () => {
    if (fundoBase64) {
      try { doc.addImage(fundoBase64, 'JPEG', 0, 0, W, H); } catch (e) { /* segue sem fundo */ }
    }
  };

  let y = yTopoUtil;
  desenharFundo();

  const novaPaginaSeNecessario = (alturaNecessaria) => {
    if (y + alturaNecessaria > yBaseUtil) {
      doc.addPage();
      desenharFundo();
      y = yTopoUtil;
    }
  };

  const txt = (text, x, yy, opts = {}) => doc.text(String(text), x, yy, opts);

  // ── Um parágrafo por vez — quebra pela largura útil e justifica todas
  // as linhas menos a última (convenção de textos formais/jurídicos). ──────
  const desenharParagrafo = (paragrafo, tamanhoFonte = 11) => {
    doc.setFontSize(tamanhoFonte);
    doc.setFont('helvetica', 'normal');
    const espacoLargura = doc.getTextWidth(' ');
    const palavras = sanitizeTexto(paragrafo).split(/\s+/).filter(Boolean);

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
      novaPaginaSeNecessario(alturaLinha);
      const ehUltima = idxLinha === linhas.length - 1;
      const larguraPalavras = linha.reduce((s, p) => s + doc.getTextWidth(p), 0);
      const gaps = linha.length - 1;
      const espacoUsado = (!ehUltima && gaps > 0)
        ? (larguraUtil - larguraPalavras) / gaps
        : espacoLargura;

      let x = M;
      linha.forEach((p, i) => {
        txt(p, x, y);
        x += doc.getTextWidth(p) + (i < linha.length - 1 ? espacoUsado : 0);
      });
      y += alturaLinha;
    });
  };

  // ── Destinatário ────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  txt(`Ao Irmão ${sanitizeTexto(irmao.nomeIrmao) || '—'}`, M, y); y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  txt(`CIM nº ${irmao.cim || '—'}`, M, y); y += 12;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  txt('OFÍCIO DE ADVERTÊNCIA — PENDÊNCIA FINANCEIRA', W / 2, y, { align: 'center' });
  y += 12;

  // ── Corpo — cada bloco separado por linha em branco vira 1 parágrafo ────
  const paragrafos = (textoOficio || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  paragrafos.forEach(p => {
    novaPaginaSeNecessario(alturaLinha * 2);
    desenharParagrafo(p);
    y += 5;
  });

  // ── Local e data ──────────────────────────────────────────────────────────
  const hoje = new Date();
  const cidade = dadosLoja?.cidade || 'Paranatinga';
  const estado = dadosLoja?.estado || 'MT';
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  novaPaginaSeNecessario(30);
  y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  txt(`${cidade}/${estado}, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}.`, M, y);
  y += 26;

  // ── Assinaturas — Tesoureiro e Venerável Mestre, mesmo padrão da Certidão ──
  novaPaginaSeNecessario(60);
  const assinatura = (nome, cargo, yy) => {
    if (nome) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
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

  doc.save(`Oficio_Pendencia_${(irmao.nomeIrmao || 'irmao').replace(/\s+/g, '_')}_${hoje.toISOString().split('T')[0]}.pdf`);
};
