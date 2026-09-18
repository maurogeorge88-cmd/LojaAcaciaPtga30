import {
  Document, Packer, Paragraph, TextRun, Header,
  ImageRun, HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom,
  TextWrappingType, AlignmentType, BorderStyle, convertMillimetersToTwip,
} from 'docx';

// A∴R∴L∴S∴ etc. — o Word lida bem com esses símbolos (ao contrário do PDF,
// que usa uma fonte sem esse glifo), então aqui NÃO precisa sanitizar.

// ── Lê o HTML do editor (contentEditable) e devolve os mesmos "blocos"
// (parágrafos com runs de negrito/itálico + recuo manual) usados no PDF —
// mesma lógica, copiada aqui pra manter os dois geradores independentes. ──
const interpretarHtmlOficio = (html) => {
  const container = document.createElement('div');
  container.innerHTML = html;

  const extrairRuns = (el) => {
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
    return runs;
  };

  const blocosFinal = [];
  const processarElementoTopo = (el, forcarRecuo) => {
    if (el.tagName === 'BLOCKQUOTE') {
      const filhos = Array.from(el.querySelectorAll(':scope > p, :scope > div'));
      if (filhos.length > 0) filhos.forEach(f => processarElementoTopo(f, true));
      else blocosFinal.push({ runs: extrairRuns(el), recuoManual: true });
      return;
    }
    blocosFinal.push({ runs: extrairRuns(el), recuoManual: forcarRecuo });
  };

  const elementosTopo = Array.from(container.querySelectorAll(':scope > p, :scope > div, :scope > blockquote'));
  const listaTopo = elementosTopo.length > 0 ? elementosTopo : [container];
  listaTopo.forEach(el => processarElementoTopo(el, false));

  return blocosFinal.filter(b => b.runs.some(r => r.t.trim().length > 0));
};

const carregarImagemArrayBuffer = async (url) => {
  const res = await fetch(url);
  return await res.arrayBuffer();
};

const INDENT_PRIMEIRA_LINHA_MM = 15; // 1,5cm — parágrafos normais
const INDENT_BLOCO_MM = 25;          // 2,5cm — citações do RGO, listas numeradas e recuo manual

/**
 * Gera o Ofício de Pendência Financeira em .docx de verdade (não é o
 * truque de HTML disfarçado) — o timbre fica no cabeçalho do Word como
 * imagem flutuante "atrás do texto", que imprime sempre, em qualquer
 * configuração, ao contrário de fundo de página.
 *
 * @param {Object} irmao       { nomeIrmao }
 * @param {string} htmlOficio  HTML do editor — mesmo conteúdo usado no PDF
 * @param {Object} dadosLoja   { cidade, estado }
 * @param {Object} assinantes  { tesoureiro, veneravelMestre }
 * @param {Object} cabecalho   { prancha, irmaoPrefixo, irmaoNome, irmaoResto, destinatario2, destinatario3, assunto }
 */
export const gerarOficioPendenciaDocx = async (irmao, htmlOficio, dadosLoja, assinantes = {}, cabecalho = {}) => {
  const fundoBuffer = await carregarImagemArrayBuffer('/oficio-fundo.jpg');

  const mm = (v) => convertMillimetersToTwip(v);

  // ── Parágrafos do cabeçalho fixo (Prancha / destinatário / assunto) ─────
  const paragrafosCabecalho = [
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun(cabecalho.prancha || '')],
    }),
    new Paragraph({
      children: [
        new TextRun(cabecalho.irmaoPrefixo || ''),
        new TextRun({ text: cabecalho.irmaoNome || '', bold: true }),
        new TextRun(cabecalho.irmaoResto || ''),
      ],
    }),
    new Paragraph({ children: [new TextRun(cabecalho.destinatario2 || '')] }),
    new Paragraph({ children: [new TextRun(cabecalho.destinatario3 || '')] }),
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun(cabecalho.assunto || '')],
    }),
    new Paragraph({
      spacing: { after: 200 },
      indent: { firstLine: mm(INDENT_PRIMEIRA_LINHA_MM) },
      children: [new TextRun('Respeitável Irmão,')],
    }),
  ];

  // ── Corpo — mesma lógica de detecção do PDF: citação (") e lista
  // numerada ("1. ") ganham recuo de bloco (2,5cm) + itálico; recuo manual
  // (<blockquote> do botão "→|") só ganha o recuo, sem forçar itálico;
  // qualquer outro parágrafo é normal, com recuo de 1,5cm na 1ª linha. ────
  const blocos = interpretarHtmlOficio(htmlOficio);
  const paragrafosCorpo = blocos.map(({ runs, recuoManual }) => {
    const textoPlano = runs.map(r => r.t).join('').replace(/\n+/g, ' ').trim();
    const ehCitacao = textoPlano.startsWith('"') || textoPlano.startsWith('“');
    const ehItemLista = /^\d+[.)]\s/.test(textoPlano);
    const usaRecuoDeBloco = recuoManual || ehCitacao || ehItemLista;
    const forcarItalico = ehCitacao || ehItemLista;

    const textRuns = runs
      .filter(r => r.t.trim().length > 0 || r.t === ' ')
      .map(r => new TextRun({
        text: r.t.replace(/\n/g, ' '),
        bold: r.b,
        italics: r.i || forcarItalico,
      }));

    return new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: usaRecuoDeBloco && ehItemLista ? 40 : 160 },
      indent: usaRecuoDeBloco
        ? { left: mm(INDENT_BLOCO_MM) }
        : { firstLine: mm(INDENT_PRIMEIRA_LINHA_MM) },
      children: textRuns,
    });
  });

  // ── Fecho — data + assinaturas (Tesoureiro e Venerável Mestre) ──────────
  const hoje = new Date();
  const cidade = dadosLoja?.cidade || 'Paranatinga';
  const estado = dadosLoja?.estado || 'MT';
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

  const paragrafoAssinatura = (nome, cargo) => ([
    new Paragraph({
      spacing: { before: 400 },
      children: nome ? [new TextRun({ text: nome, bold: true })] : [new TextRun('')],
    }),
    new Paragraph({
      spacing: { after: 40 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 1 } },
      children: [new TextRun({ text: '                                        ' })],
    }),
    new Paragraph({
      children: [new TextRun({ text: cargo, size: 18, color: '555555' })],
    }),
  ]);

  const paragrafosFecho = [
    new Paragraph({
      spacing: { before: 300 },
      children: [new TextRun(`${cidade}/${estado}, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}.`)],
    }),
    ...paragrafoAssinatura(assinantes.tesoureiro, 'Tesoureiro'),
    ...paragrafoAssinatura(assinantes.veneravelMestre, 'Venerável Mestre'),
  ];

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            left: mm(30),
            right: mm(20),
            top: mm(66),
            bottom: mm(35),
          },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new ImageRun({
                  data: fundoBuffer,
                  transformation: { width: 794, height: 1123 }, // A4 a 96dpi
                  floating: {
                    horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 },
                    verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 },
                    wrap: { type: TextWrappingType.NONE },
                    behindDocument: true,
                  },
                }),
              ],
            }),
          ],
        }),
      },
      children: [...paragrafosCabecalho, ...paragrafosCorpo, ...paragrafosFecho],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Oficio_Pendencia_${(irmao.nomeIrmao || 'irmao').replace(/\s+/g, '_')}_${hoje.toISOString().split('T')[0]}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
