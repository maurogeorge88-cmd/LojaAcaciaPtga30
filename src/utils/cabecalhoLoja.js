import {
  Paragraph, TextRun, ImageRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, VerticalAlign,
} from 'docx';
import { LOGO_LOJA_B64 } from './logoLoja';

// ════════════════════════════════════════════════════════════════════════
// Cabeçalho da Loja para atas e editais (Word)
// Com logo: tabela invisível — logo à esquerda, texto centralizado à direita
// (o texto nunca sobrepõe o logo). Sem logo: só o texto, centralizado.
// O texto e o tamanho do logo são configuráveis em Modelos de Documentos → Layout.
// ════════════════════════════════════════════════════════════════════════

const b64ToBuffer = (b64) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
const fmt = (d) => (d ? String(d).substring(0, 10).split('-').reverse().join('/') : '');

// Texto padrão do cabeçalho (cada linha = uma linha do documento)
export const CABECALHO_PADRAO = 'A∴R∴L∴S∴ ACÁCIA DE PARANATINGA Nº {numero_loja}\nFundada em {data_fundacao}\nJurisdicionada à\nGrande Loja Maçônica do Estado de Mato Grosso';

// Variáveis aceitas no texto do cabeçalho
export const linhasCabecalho = (texto, dadosLoja = {}) => {
  const vars = {
    numero_loja: String(dadosLoja.numero_loja || '30'),
    data_fundacao: dadosLoja.data_fundacao ? fmt(dadosLoja.data_fundacao) : '20/12/1997',
    nome_loja: `ACÁCIA DE PARANATINGA Nº ${dadosLoja.numero_loja || '30'}`,
    cidade: dadosLoja.cidade || 'Paranatinga',
    estado: dadosLoja.estado || 'MT',
  };
  const base = String(texto || '').trim() ? texto : CABECALHO_PADRAO;
  return Object.entries(vars).reduce((t, [k, v]) => t.replaceAll(`{${k}}`, v), base)
    .split('\n').map(l => l.replace(/\*/g, '').trimEnd()).filter(l => l.trim() !== '');
};

// cm → pixels (96 dpi): 3,5 cm ≈ 132 px
const cmParaPx = (cm) => Math.round((Number(cm) > 0 ? Number(cm) : 3.5) * 37.8);

export const cabecalhoLojaDocx = ({ dadosLoja = {}, comLogo = true, larguraUtil = 9000, after = 360, texto = null, logoCm = null }) => {
  const linhas = linhasCabecalho(texto, dadosLoja);
  const paragrafos = (ultimoAfter) => linhas.map((t, i) => new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: i === linhas.length - 1 ? ultimoAfter : 60, line: 276 },
    children: [new TextRun({ text: t, bold: true, font: 'Times New Roman', size: 26 })],
  }));

  if (!comLogo) return [...paragrafos(after)];

  const px = cmParaPx(logoCm);
  const semBorda = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const bordas = { top: semBorda, bottom: semBorda, left: semBorda, right: semBorda };
  const COL_LOGO = Math.round(px * 15) + 340; // px → twips (1 px = 15 twips) + folga
  return [
    new Table({
      width: { size: larguraUtil, type: WidthType.DXA },
      columnWidths: [COL_LOGO, larguraUtil - COL_LOGO],
      borders: { top: semBorda, bottom: semBorda, left: semBorda, right: semBorda, insideHorizontal: semBorda, insideVertical: semBorda },
      rows: [new TableRow({ children: [
        new TableCell({ borders: bordas, width: { size: COL_LOGO, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, children: [
          new Paragraph({ alignment: AlignmentType.LEFT, children: [
            new ImageRun({ type: 'jpg', data: b64ToBuffer(LOGO_LOJA_B64), transformation: { width: px, height: px } }),
          ] }),
        ] }),
        new TableCell({ borders: bordas, width: { size: larguraUtil - COL_LOGO, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
          children: paragrafos(0) }),
      ] })],
    }),
    new Paragraph({ spacing: { before: 0, after }, children: [new TextRun({ text: '' })] }),
  ];
};
