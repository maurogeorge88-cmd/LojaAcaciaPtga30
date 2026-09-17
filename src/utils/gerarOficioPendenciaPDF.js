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

// ── Lê o HTML produzido pelo editor (contentEditable) e devolve uma lista
// de "blocos" (parágrafos), cada um como uma lista de "runs" de texto com
// negrito/itálico reais (tags <b>/<strong>/<i>/<em>) — e se o bloco inteiro
// está dentro de um <blockquote> (recuo manual aplicado pelo botão "→|"). ──
const interpretarHtmlOficio = (html) => {
  const container = document.createElement('div');
  container.innerHTML = html;

  const elementosBloco = Array.from(container.querySelectorAll(':scope > p, :scope > div'));
  const blocosDom = elementosBloco.length > 0 ? elementosBloco : [container];

  return blocosDom.map(el => {
    const dentroDeBlockquote = !!el.closest('blockquote') || el.tagName === 'BLOCKQUOTE'
      || Array.from(el.querySelectorAll('blockquote')).length > 0;

    const runs = [];
    const percorrer = (node, b, i) => {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.textContent) runs.push({ t: node.textContent, b, i });
      } else if (node.nodeName === 'BR') {
        runs.push({ t: '\n', b, i });
      } else {
        const novoB = b || ['B', 'STRONG'].includes(node.nodeName);
        const novoI = i || ['I', 'EM'].includes(node.nodeName);
        node.childNodes?.forEach(child => percorrer(child, novoB, novoI));
      }
    };
    el.childNodes.forEach(child => percorrer(child, false, false));

    return { runs, recuoManual: dentroDeBlockquote };
  }).filter(b => b.runs.some(r => r.t.trim().length > 0));
};

/**
 * Gera o Ofício de Pendência Financeira de um irmão — mesmo padrão de
 * cabeçalho/assinatura da Certidão Financeira, com o papel timbrado
 * (fundo) atrás do texto e o corpo já editado pelo usuário no editor.
 *
 * @param {Object} irmao      { nomeIrmao, cim }
 * @param {string} htmlOficio HTML do editor (contentEditable) — negrito/
 *                            itálico reais via <b>/<i>, recuo manual via <blockquote>
 * @param {Object} dadosLoja  { cidade, estado }
 * @param {Object} assinantes { tesoureiro, veneravelMestre }
 */
export const gerarOficioPendenciaPDF = async (irmao, htmlOficio, dadosLoja, assinantes = {}) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, H = 297;
  // Margens assimétricas — 3cm à esquerda (espaço de encadernação/arquivo),
  // 2cm à direita.
  const M_ESQ = 30, M_DIR = 20;
  const larguraUtil = W - M_ESQ - M_DIR;
  const alturaLinha = 5.6;
  // A imagem de fundo já traz cabeçalho (topo) e rodapé (base) prontos —
  // o texto precisa ficar dentro dessa janela, sem sobrepor nenhum dos dois.
  const yTopoUtil = 58;
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
  const estiloFonte = (b, i) => b && i ? 'bolditalic' : b ? 'bold' : i ? 'italic' : 'normal';

  // ── Um parágrafo por vez — quebra pela largura útil e justifica todas
  // as linhas menos a última (convenção de textos formais/jurídicos). Cada
  // palavra carrega seu próprio estilo (negrito/itálico/normal), já vindo
  // pronto do HTML do editor — sem nenhuma marcação de texto envolvida.
  // opts.indentPrimeiraLinha: recuo (mm) só na 1ª linha (parágrafo normal).
  // opts.indentBloco: recuo (mm) em TODAS as linhas (citação/lista/manual). ─
  const desenharParagrafo = (runs, tamanhoFonte = 11, opts = {}) => {
    const { indentPrimeiraLinha = 0, indentBloco = 0 } = opts;
    doc.setFontSize(tamanhoFonte);
    const espacoLargura = doc.getTextWidth(' ');

    const palavras = [];
    runs.forEach(run => {
      sanitizeTexto(run.t).split(/\s+/).filter(Boolean).forEach(p => {
        palavras.push({ texto: p, b: run.b, i: run.i });
      });
    });
    if (palavras.length === 0) return;

    const larguraLinha = (idx) => larguraUtil - indentBloco - (idx === 0 ? indentPrimeiraLinha : 0);

    const linhas = [];
    let linhaAtual = [];
    let larguraAtual = 0;
    palavras.forEach(w => {
      doc.setFont('helvetica', estiloFonte(w.b, w.i));
      const larguraPalavra = doc.getTextWidth(w.texto);
      const espacoExtra = linhaAtual.length > 0 ? espacoLargura : 0;
      const maxAtual = larguraLinha(linhas.length);
      if (larguraAtual + espacoExtra + larguraPalavra > maxAtual && linhaAtual.length > 0) {
        linhas.push(linhaAtual);
        linhaAtual = [];
        larguraAtual = 0;
      }
      if (linhaAtual.length > 0) larguraAtual += espacoLargura;
      linhaAtual.push(w);
      larguraAtual += larguraPalavra;
    });
    if (linhaAtual.length > 0) linhas.push(linhaAtual);

    linhas.forEach((linha, idxLinha) => {
      novaPaginaSeNecessario(alturaLinha);
      const ehUltima = idxLinha === linhas.length - 1;
      const recuoLinha = indentBloco + (idxLinha === 0 ? indentPrimeiraLinha : 0);
      const larguraMaxLinha = larguraUtil - recuoLinha;
      const larguraPalavras = linha.reduce((s, w) => {
        doc.setFont('helvetica', estiloFonte(w.b, w.i));
        return s + doc.getTextWidth(w.texto);
      }, 0);
      const gaps = linha.length - 1;
      const espacoUsado = (!ehUltima && gaps > 0)
        ? (larguraMaxLinha - larguraPalavras) / gaps
        : espacoLargura;

      let x = M_ESQ + recuoLinha;
      linha.forEach((w, i) => {
        doc.setFont('helvetica', estiloFonte(w.b, w.i));
        txt(w.texto, x, y);
        x += doc.getTextWidth(w.texto) + (i < linha.length - 1 ? espacoUsado : 0);
      });
      y += alturaLinha;
    });
  };

  const INDENT_PRIMEIRA_LINHA = 15; // 1,5cm — parágrafos normais (padrão)
  const INDENT_BLOCO = 25;          // 2,5cm — citações do RGO, listas numeradas e recuo manual (botão "→|")

  // ── Título ───────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  txt('OFÍCIO DE ADVERTÊNCIA — PENDÊNCIA FINANCEIRA', M_ESQ + larguraUtil / 2, y, { align: 'center' });
  y += 14;

  // ── Corpo — cada <p>/<div> do editor vira 1 (ou mais) parágrafo(s).
  // O tipo de recuo é decidido assim:
  //   • bloco dentro de <blockquote> (botão "→| Recuar 2,5cm")  → recuo de bloco manual
  //   • texto começa com " (aspas)                              → citação do RGO, recuo de bloco
  //   • linha inteira "1. ", "2. "…                              → item de lista, recuo de bloco
  //   • qualquer outro texto                                     → parágrafo normal, recuo só na 1ª linha
  const blocos = interpretarHtmlOficio(htmlOficio);
  blocos.forEach(({ runs, recuoManual }) => {
    const textoPlano = runs.map(r => r.t).join('').replace(/\n+/g, ' ').trim();
    if (!textoPlano) return;

    const ehCitacao = textoPlano.startsWith('"') || textoPlano.startsWith('“');
    const ehItemLista = /^\d+[.)]\s/.test(textoPlano);
    const usaRecuoDeBloco = recuoManual || ehCitacao || ehItemLista;
    const temQuebraInterna = runs.some(r => r.t.includes('\n'));

    if (!temQuebraInterna) {
      novaPaginaSeNecessario(alturaLinha * 2);
      desenharParagrafo(runs, 11, usaRecuoDeBloco ? { indentBloco: INDENT_BLOCO } : { indentPrimeiraLinha: INDENT_PRIMEIRA_LINHA });
      y += usaRecuoDeBloco && ehItemLista ? 1.5 : 5;
      return;
    }

    // Bloco com quebras de linha internas (<br>, Shift+Enter) — cada linha
    // vira seu próprio parágrafo. Comum em listas numeradas digitadas assim.
    let runsDaLinha = [];
    const linhasRuns = [];
    runs.forEach(r => {
      if (r.t.includes('\n')) {
        const partes = r.t.split('\n');
        partes.forEach((parte, idx) => {
          if (parte) runsDaLinha.push({ ...r, t: parte });
          if (idx < partes.length - 1) { linhasRuns.push(runsDaLinha); runsDaLinha = []; }
        });
      } else {
        runsDaLinha.push(r);
      }
    });
    if (runsDaLinha.length > 0) linhasRuns.push(runsDaLinha);

    linhasRuns.forEach(runsLinha => {
      const textoLinha = runsLinha.map(r => r.t).join('').trim();
      if (!textoLinha) return;
      novaPaginaSeNecessario(alturaLinha * 2);
      const ehLinhaLista = /^\d+[.)]\s/.test(textoLinha);
      desenharParagrafo(runsLinha, 11, (recuoManual || ehLinhaLista) ? { indentBloco: INDENT_BLOCO } : { indentPrimeiraLinha: INDENT_PRIMEIRA_LINHA });
      y += 1.5;
    });
    y += 4;
  });

  // ── Local e data ──────────────────────────────────────────────────────────
  const hoje = new Date();
  const cidade = dadosLoja?.cidade || 'Paranatinga';
  const estado = dadosLoja?.estado || 'MT';
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  novaPaginaSeNecessario(30);
  y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  txt(`${cidade}/${estado}, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}.`, M_ESQ, y);
  y += 26;

  // ── Assinaturas — Tesoureiro e Venerável Mestre, mesmo padrão da Certidão ──
  novaPaginaSeNecessario(60);
  const assinatura = (nome, cargo, yy) => {
    if (nome) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      txt(sanitizeTexto(nome), M_ESQ, yy - 2);
    }
    doc.setDrawColor(0); doc.setLineWidth(0.3);
    doc.line(M_ESQ, yy, M_ESQ + 80, yy);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90);
    txt(cargo, M_ESQ, yy + 5);
    doc.setTextColor(0);
  };
  assinatura(assinantes.tesoureiro, 'Tesoureiro', y);
  y += 26;
  assinatura(assinantes.veneravelMestre, 'Venerável Mestre', y);

  doc.save(`Oficio_Pendencia_${(irmao.nomeIrmao || 'irmao').replace(/\s+/g, '_')}_${hoje.toISOString().split('T')[0]}.pdf`);
};
