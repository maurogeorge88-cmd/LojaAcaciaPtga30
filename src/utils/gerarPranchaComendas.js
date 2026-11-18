import {
  Document, Packer, Paragraph, TextRun, AlignmentType, Footer, PageNumber,
  Table, TableRow, TableCell, WidthType, BorderStyle,
} from 'docx';
import jsPDF from 'jspdf';
import { supabase } from '../supabaseClient';
import { cabecalhoLojaDocx } from './cabecalhoLoja';
import { LOGO_LOJA_B64 } from './logoLoja';

// ════════════════════════════════════════════════════════════════════════
// PRANCHA — Resposta à GLEMT: indicação de irmãos para as Comendas
// Número e data da prancha vêm de Expedientes → Pranchas (pranchas_expedidas).
// Dados da prancha recebida (nº, Oriente, data, Grande Chanceler do Selo) são digitados.
// Assinam o Venerável Mestre e o Secretário.
// ════════════════════════════════════════════════════════════════════════

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dataBR = (d) => (d ? String(d).substring(0, 10).split('-').reverse().join('/') : '');
const dataExtenso = (d) => {
  const s = String(d || '').substring(0, 10);
  if (!s) return '';
  const [a, m, di] = s.split('-').map(Number);
  return `${String(di).padStart(2, '0')} de ${MESES[m - 1]} de ${a}`;
};

export const TITULO_PADRAO_COMENDAS = 'INDICAÇÃO DE IRMÃOS PARA AS COMENDAS DA GLEMT';

// {relacao_comendas} é substituído pela lista de irmãos por comenda
export const CORPO_PADRAO_COMENDAS =
  'Em atenção à Prancha nº {glemt_numero}, expedida no Oriente de {glemt_oriente}, '
  + 'aos {glemt_data_extenso}, que trata da atualização cadastral individual e das informações para entrega de '
  + 'comendas na Assembleia Geral, a A∴R∴L∴S∴ {nome_loja} vem, respeitosamente, informar a relação dos obreiros '
  + 'desta Oficina que preenchem as condições para as comendas abaixo e que ainda não as receberam:\n'
  + '{relacao_comendas}\n'
  + 'A relação acima foi apurada a partir dos registros desta Oficina, que permanece à disposição para '
  + 'esclarecimentos e eventuais conferências.\n'
  + 'Na certeza do atendimento, renovamos os protestos de elevada estima e fraterno apreço.\n'
  + 'Fraternalmente,';

export const interp = (texto, V) =>
  Object.entries(V).reduce((t, [k, v]) => t.replaceAll(`{${k}}`, v ?? ''), String(texto || ''));

// Venerável Mestre e Secretário do corpo administrativo mais recente
export const buscarAssinantes = async () => {
  const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const { data: corpo } = await supabase.from('corpo_administrativo')
    .select('cargo, ano_exercicio, irmao_id').order('ano_exercicio', { ascending: false });
  const lista = corpo || [];
  const ven = lista.find(c => norm(c.cargo).includes('veneravel'));
  const sec = lista.find(c => norm(c.cargo) === 'secretario') || lista.find(c => norm(c.cargo).includes('secretario') && !norm(c.cargo).includes('adjunto'));
  const ids = [ven?.irmao_id, sec?.irmao_id].filter(Boolean);
  const { data: irmaos } = ids.length ? await supabase.from('irmaos').select('id, nome').in('id', ids) : { data: [] };
  const nome = (id) => (irmaos || []).find(i => String(i.id) === String(id))?.nome || '';
  return { veneravel: nome(ven?.irmao_id), secretario: nome(sec?.irmao_id) };
};

// Variáveis do texto
const variaveis = (r, dadosLoja) => ({
  glemt_numero: r.glemt_numero || '[nº]',
  glemt_oriente: r.glemt_oriente || '[Oriente]',
  glemt_data: dataBR(r.glemt_data),
  glemt_data_extenso: dataExtenso(r.glemt_data) || '[data]',
  grande_chanceler: r.grande_chanceler || '[Grande Chanceler do Selo]',
  prancha_numero: r.prancha_numero || '',
  nome_loja: `ACÁCIA DE PARANATINGA Nº ${dadosLoja?.numero_loja || '30'}`,
  nome_loja_normal: `Acácia de Paranatinga nº ${dadosLoja?.numero_loja || '30'}`,
});

// itens: [{ comenda, nome, cim, detalhe }] → agrupado por comenda, na ordem recebida
const agrupar = (itens) => {
  const grupos = [];
  (itens || []).forEach(it => {
    let g = grupos.find(x => x.comenda === it.comenda);
    if (!g) { g = { comenda: it.comenda, irmaos: [] }; grupos.push(g); }
    g.irmaos.push(it);
  });
  return grupos;
};
const textoIrmao = (it) => `${it.nome}${it.cim ? ` – CIM nº ${it.cim}` : ''}${it.detalhe ? ` (${it.detalhe})` : ''}`;

// cabeçalho/margens iguais ao da prancha de instalação (modelo cadastrado, se existir)
const modeloCabecalho = async () => {
  try {
    const { data } = await supabase.from('modelos_documentos')
      .select('cabecalho_texto, mostrar_logo, logo_tamanho').eq('tipo', 'prancha_instalacao').maybeSingle();
    return data || {};
  } catch (e) { return {}; }
};

const nomeArquivo = (r, ext) => `Prancha_${String(r.prancha_numero || '').replace('/', '-')}_Comendas_GLEMT.${ext}`;

// ── WORD ────────────────────────────────────────────────────────────────
export const gerarPranchaComendasDocx = async ({ registro: r, dadosLoja = {}, assinantes = {} }) => {
  const F = { font: 'Times New Roman', size: 24 };
  const ar = (t, o = {}) => new TextRun({ text: String(t ?? ''), ...F, bold: !!o.bold });
  const par = (runs, o = {}) => new Paragraph({
    children: runs, alignment: o.align || AlignmentType.JUSTIFIED,
    spacing: { before: o.before ?? 0, after: o.after ?? 200, line: 276 },
    indent: o.firstLine ? { firstLine: 709 } : (o.left ? { left: o.left } : undefined),
    keepNext: !!o.keepNext,
  });

  const V = variaveis(r, dadosLoja);
  const mod = await modeloCabecalho();
  const grupos = agrupar(r.itens);
  const runsNegrito = (linha) => String(linha).split(/(\*[^*]+\*)/).filter(Boolean)
    .map(t => (t.startsWith('*') && t.endsWith('*') ? ar(t.slice(1, -1), { bold: true }) : ar(t)));

  const relacao = () => grupos.flatMap(g => [
    par([ar(g.comenda, { bold: true })], { align: AlignmentType.LEFT, before: 120, after: 80, keepNext: true }),
    ...g.irmaos.map((it, i) => par([ar(`${i + 1}. ${textoIrmao(it)}`)], { align: AlignmentType.LEFT, after: 40, left: 360 })),
  ]);

  const corpo = [];
  const linhas = interp(r.texto || CORPO_PADRAO_COMENDAS, V).split('\n').filter(l => l.trim() !== '');
  linhas.forEach(l => {
    if (l.trim() === '{relacao_comendas}') {
      if (grupos.length === 0) corpo.push(par([ar('Nenhum irmão a indicar no momento.')], { align: AlignmentType.LEFT }));
      else corpo.push(...relacao());
      corpo.push(par([ar('')], { after: 60 }));
    } else if (/^fraternalmente,?$/i.test(l.trim())) {
      corpo.push(par([ar(l.trim())], { align: AlignmentType.LEFT, before: 120, after: 200, keepNext: true }));
    } else {
      corpo.push(par(runsNegrito(l), { firstLine: true }));
    }
  });

  const semBorda = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const bordas = { top: semBorda, bottom: semBorda, left: semBorda, right: semBorda };
  const bloco = (nome, cargo) => new TableCell({
    borders: bordas, width: { size: 4800, type: WidthType.DXA },
    children: [
      par([ar('________________________________')], { align: AlignmentType.CENTER, after: 0, before: 480, keepNext: true }),
      par([ar(`Ir∴ ${String(nome || '').toUpperCase()}`, { bold: true })], { align: AlignmentType.CENTER, after: 0, keepNext: true }),
      par([ar(cargo)], { align: AlignmentType.CENTER, after: 0 }),
    ],
  });
  const assinaturas = new Table({
    width: { size: 9600, type: WidthType.DXA }, columnWidths: [4800, 4800],
    borders: { top: semBorda, bottom: semBorda, left: semBorda, right: semBorda, insideHorizontal: semBorda, insideVertical: semBorda },
    rows: [new TableRow({ cantSplit: true, children: [bloco(assinantes.veneravel, 'Venerável Mestre'), bloco(assinantes.secretario, 'Secretário')] })],
  });

  const doc = new Document({
    styles: { default: { document: { run: F } } },
    sections: [{
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [
        new TextRun({ children: [PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES], font: 'Times New Roman', size: 20 }),
      ] })] }) },
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } },
      children: [
        ...cabecalhoLojaDocx({ dadosLoja, comLogo: mod.mostrar_logo !== false, larguraUtil: 9600, after: 240, texto: mod.cabecalho_texto, logoCm: mod.logo_tamanho }),
        par([ar(`Prancha nº ${r.prancha_numero || ''}`, { bold: true })], { align: AlignmentType.LEFT, before: 120, after: 60 }),
        par([ar(`${dadosLoja.cidade || 'Paranatinga'} – ${dadosLoja.estado || 'MT'}, ${dataExtenso(r.prancha_data)}.`)], { align: AlignmentType.LEFT, after: 240 }),
        par([ar(`Ao Grande Chanceler do Selo, Ir∴ ${V.grande_chanceler}`, { bold: true })], { align: AlignmentType.LEFT, after: 0 }),
        par([ar('Grande Loja Maçônica do Estado de Mato Grosso – GLEMT', { bold: true })], { align: AlignmentType.LEFT, after: 240 }),
        par([ar(`Assunto: ${r.assunto || `Resposta à Prancha nº ${V.glemt_numero} – Informações para entrega de Comendas`}`, { bold: true })], { align: AlignmentType.LEFT, after: 240 }),
        par([ar(TITULO_PADRAO_COMENDAS, { bold: true })], { align: AlignmentType.CENTER, after: 240 }),
        ...corpo,
        assinaturas,
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nomeArquivo(r, 'docx'); a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

// ── PDF ─────────────────────────────────────────────────────────────────
export const gerarPranchaComendasPDF = async ({ registro: r, dadosLoja = {}, assinantes = {} }) => {
  const AZUL = [30, 58, 138]; const DOURADO = [201, 168, 76]; const TEXTO = [30, 41, 59];
  const pdfTexto = (t) => String(t ?? '').replace(/∴/g, '.·.');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 18;
  const larg = W - 2 * M;
  const V = variaveis(r, dadosLoja);
  const grupos = agrupar(r.itens);
  let y = 12;

  const cabecalho = () => {
    y = 12;
    try { doc.addImage(`data:image/jpeg;base64,${LOGO_LOJA_B64}`, 'JPEG', M, y, 30, 30); } catch (e) { /* sem logo */ }
    const xt = M + 34 + (W - M - (M + 34)) / 2;
    doc.setFont('times', 'bold'); doc.setFontSize(12); doc.setTextColor(...AZUL);
    doc.text(`A.·.R.·.L.·.S.·. ACÁCIA DE PARANATINGA Nº ${dadosLoja.numero_loja || '30'}`, xt, y + 8, { align: 'center' });
    doc.setFont('times', 'normal'); doc.setFontSize(10); doc.setTextColor(...TEXTO);
    doc.text(`Fundada em ${dataBR(dadosLoja.data_fundacao) || '20/12/1997'}`, xt, y + 14, { align: 'center' });
    doc.text('Jurisdicionada à', xt, y + 19, { align: 'center' });
    doc.text('Grande Loja Maçônica do Estado de Mato Grosso', xt, y + 24, { align: 'center' });
    y += 36;
    doc.setDrawColor(...DOURADO); doc.setLineWidth(0.6); doc.line(M, y, W - M, y);
    y += 8;
  };
  const novaPagina = () => { doc.addPage(); y = 20; doc.setFont('times', 'normal'); doc.setFontSize(11.5); doc.setTextColor(...TEXTO); };
  const garantir = (h) => { if (y + h > H - 22) novaPagina(); };

  cabecalho();
  doc.setFont('times', 'bold'); doc.setFontSize(11); doc.setTextColor(...TEXTO);
  doc.text(`Prancha nº ${r.prancha_numero || ''}`, M, y); y += 6;
  doc.setFont('times', 'normal');
  doc.text(pdfTexto(`${dadosLoja.cidade || 'Paranatinga'} – ${dadosLoja.estado || 'MT'}, ${dataExtenso(r.prancha_data)}.`), M, y); y += 10;
  doc.setFont('times', 'bold');
  doc.text(pdfTexto(`Ao Grande Chanceler do Selo, Ir∴ ${V.grande_chanceler}`), M, y); y += 6;
  doc.text('Grande Loja Maçônica do Estado de Mato Grosso – GLEMT', M, y); y += 10;
  const assunto = doc.splitTextToSize(pdfTexto(`Assunto: ${r.assunto || `Resposta à Prancha nº ${V.glemt_numero} – Informações para entrega de Comendas`}`), larg);
  assunto.forEach(l => { doc.text(l, M, y); y += 5.6; });
  y += 5;
  doc.setFontSize(12.5); doc.setTextColor(...AZUL);
  doc.text(pdfTexto(TITULO_PADRAO_COMENDAS), W / 2, y, { align: 'center' }); y += 11;
  doc.setFontSize(11.5); doc.setTextColor(...TEXTO);

  const paragrafo = (texto, recuo = true) => {
    const ls = doc.splitTextToSize(pdfTexto(String(texto).replace(/\*/g, '')), larg - (recuo ? 12 : 0));
    ls.forEach((linha, i) => {
      garantir(6);
      const ultima = i === ls.length - 1;
      doc.setFont('times', 'normal');
      doc.text(linha, M + (recuo && i === 0 ? 12 : 0), y, !ultima ? { maxWidth: larg - (recuo && i === 0 ? 12 : 0), align: 'justify' } : undefined);
      y += 5.6;
    });
    y += 3;
  };

  const linhas = interp(r.texto || CORPO_PADRAO_COMENDAS, V).split('\n').filter(l => l.trim() !== '');
  linhas.forEach(l => {
    if (l.trim() === '{relacao_comendas}') {
      if (grupos.length === 0) { paragrafo('Nenhum irmão a indicar no momento.', false); return; }
      grupos.forEach(g => {
        garantir(18);
        doc.setFont('times', 'bold'); doc.text(pdfTexto(g.comenda), M, y); y += 6;
        doc.setFont('times', 'normal');
        g.irmaos.forEach((it, i) => {
          const ls = doc.splitTextToSize(pdfTexto(`${i + 1}. ${textoIrmao(it)}`), larg - 8);
          ls.forEach((linha, k) => { garantir(6); doc.text(linha, M + 6 + (k > 0 ? 5 : 0), y); y += 5.4; });
        });
        y += 3;
      });
      y += 2;
    } else if (/^fraternalmente,?$/i.test(l.trim())) {
      garantir(50);
      doc.setFont('times', 'normal'); doc.text(pdfTexto(l.trim()), M, y); y += 8;
    } else {
      paragrafo(l);
    }
  });

  garantir(36);
  y += 14;
  const assina = (cx, nome, cargo) => {
    doc.setDrawColor(...TEXTO); doc.setLineWidth(0.3);
    doc.line(cx - 40, y, cx + 40, y);
    doc.setFont('times', 'bold'); doc.setFontSize(10.5);
    doc.text(pdfTexto(`Ir∴ ${String(nome || '').toUpperCase()}`), cx, y + 5, { align: 'center' });
    doc.setFont('times', 'normal');
    doc.text(cargo, cx, y + 10, { align: 'center' });
  };
  assina(M + larg * 0.25, assinantes.veneravel, 'Venerável Mestre');
  assina(M + larg * 0.75, assinantes.secretario, 'Secretário');

  doc.save(nomeArquivo(r, 'pdf'));
};
