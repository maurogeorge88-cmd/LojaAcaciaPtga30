import {
  Paragraph, TextRun, ImageRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, VerticalAlign,
} from 'docx';
import { LOGO_LOJA_B64 } from './logoLoja';

// ════════════════════════════════════════════════════════════════════════
// Cabeçalho da Loja para atas (Word)
// Com logo: tabela invisível — logo à esquerda, texto centralizado à direita
// (o texto nunca sobrepõe o logo). Sem logo: só o texto, centralizado.
// ════════════════════════════════════════════════════════════════════════

const b64ToBuffer = (b64) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
const fmt = (d) => (d ? String(d).substring(0, 10).split('-').reverse().join('/') : '');

export const cabecalhoLojaDocx = ({ dadosLoja = {}, comLogo = true, larguraUtil = 9000, after = 360 }) => {
  const linhas = [
    `A∴R∴L∴S∴ ACÁCIA DE PARANATINGA Nº ${dadosLoja.numero_loja || '30'}`,
    `Fundada em ${dadosLoja.data_fundacao ? fmt(dadosLoja.data_fundacao) : '20/12/1997'}`,
    'Jurisdicionada à',
    'Grande Loja Maçônica do Estado de Mato Grosso',
  ];
  const paragrafos = (ultimoAfter) => linhas.map((t, i) => new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: i === linhas.length - 1 ? ultimoAfter : 60, line: 276 },
    children: [new TextRun({ text: t, bold: true, font: 'Times New Roman', size: 26 })],
  }));

  if (!comLogo) return [...paragrafos(after)];

  const semBorda = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const bordas = { top: semBorda, bottom: semBorda, left: semBorda, right: semBorda };
  const COL_LOGO = 2200; // ≈ 3,9 cm (logo de 3,5 cm + folga)
  return [
    new Table({
      width: { size: larguraUtil, type: WidthType.DXA },
      columnWidths: [COL_LOGO, larguraUtil - COL_LOGO],
      borders: { top: semBorda, bottom: semBorda, left: semBorda, right: semBorda, insideHorizontal: semBorda, insideVertical: semBorda },
      rows: [new TableRow({ children: [
        new TableCell({ borders: bordas, width: { size: COL_LOGO, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, children: [
          new Paragraph({ alignment: AlignmentType.LEFT, children: [
            new ImageRun({ type: 'jpg', data: b64ToBuffer(LOGO_LOJA_B64), transformation: { width: 132, height: 132 } }),
          ] }),
        ] }),
        new TableCell({ borders: bordas, width: { size: larguraUtil - COL_LOGO, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
          children: paragrafos(0) }),
      ] })],
    }),
    new Paragraph({ spacing: { before: 0, after }, children: [new TextRun({ text: '' })] }),
  ];
};
