import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { fmtData, tempoTexto } from './arcoRealMembros';

const COR_SITUACAO = {
  regular: [16, 185, 129], licenciado: [99, 102, 241], desligado: [100, 116, 139],
  excluido: [239, 68, 68], falecido: [139, 92, 246],
};
const ROTULO_SITUACAO = { regular: 'Regular', licenciado: 'Licenciado', desligado: 'Desligado', excluido: 'Excluído', falecido: 'Falecido' };

const LABELS_ORDENACAO = {
  nome: 'Nome (A-Z)', cargo: 'Cargo', idade: 'Idade', exaltacao: 'Data de Exaltação',
  tempo: 'Tempo de Arco Real', situacao: 'Situação',
};

const hojeLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * PDF do Quadro de Membros do Arco Real — mesma ordem/filtro da tela.
 * @param {Array}  membros   lista já filtrada e ordenada (itens com _idade, _meses, _sit)
 * @param {string} logoBase64 data URL da logo (ou null)
 * @param {Object} extra     { ordenacao, direcao, situacaoLabel }
 */
export const gerarQuadroMembrosArcoRealPDF = (membros, logoBase64, extra = {}) => {
  const { ordenacao = 'nome', direcao = 'asc', situacaoLabel = '' } = extra;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, M = 15;
  let y = 10;
  const txt = (t, x, yy, o = {}) => doc.text(String(t), x, yy, o);

  if (logoBase64) {
    try { doc.addImage(logoBase64, 'PNG', (W - 24) / 2, y, 24, 24); y += 29; } catch { y += 2; }
  }
  doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(30);
  txt('Capítulo Guardiões da Aliança Nº 04', W / 2, y, { align: 'center' }); y += 5;
  doc.setDrawColor(80); doc.setLineWidth(0.5); doc.line(M, y, W - M, y);
  doc.setLineWidth(0.2); doc.line(M, y + 1, W - M, y + 1); y += 7;

  doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(20);
  txt('QUADRO DE MEMBROS', W / 2, y, { align: 'center' }); y += 6;

  doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
  const partes = [];
  if (situacaoLabel) partes.push(`Situação: ${situacaoLabel}`);
  partes.push(`Ordenado por: ${LABELS_ORDENACAO[ordenacao] || ordenacao} (${direcao === 'desc' ? 'decrescente' : 'crescente'})`, `Total: ${membros.length}`);
  txt(partes.join('   •   '), W / 2, y, { align: 'center', maxWidth: W - 2 * M }); y += 4;
  doc.setFontSize(7.5);
  txt(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, W / 2, y, { align: 'center' }); y += 4;
  doc.setTextColor(0);

  const linhas = membros.map((m, i) => [
    i + 1,
    m.nome || '—',
    m.cargo || '—',
    m._idade != null ? m._idade : '—',
    m.data_exaltacao ? fmtData(m.data_exaltacao) : '—',
    m._meses != null ? tempoTexto(m._meses).replace(' anos', 'a').replace(' ano', 'a').replace(' meses', 'm').replace(' mês', 'm').replace(' e ', ' ') : '—',
    ROTULO_SITUACAO[m._sit] || m._sit,
  ]);

  doc.autoTable({
    startY: y,
    margin: { left: M, right: M },
    head: [['Nº', 'Nome', 'Cargo', 'Idade', 'Exaltação', 'Tempo de A.R.', 'Situação']],
    body: linhas,
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 1.8, valign: 'middle', overflow: 'ellipsize' },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    columnStyles: {
      0: { cellWidth: 9, halign: 'center' },
      1: { cellWidth: 56, fontStyle: 'bold' },
      2: { cellWidth: 28 },
      3: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 23, halign: 'center' },
      5: { cellWidth: 26, halign: 'center' },
      6: { cellWidth: 24, halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 6) {
        const chave = Object.keys(ROTULO_SITUACAO).find(k => ROTULO_SITUACAO[k] === data.cell.raw);
        data.cell.styles.textColor = COR_SITUACAO[chave] || [100, 116, 139];
        data.cell.styles.fontStyle = 'bold';
      }
    },
    didDrawPage: () => {
      const pg = doc.internal.getNumberOfPages();
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(150);
      txt('SysMaçom-MG - Desenvolvedor: Mauro George', M, 290);
      txt(`Página ${pg}`, W / 2, 290, { align: 'center' });
      txt(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, W - M, 290, { align: 'right' });
      doc.setTextColor(0);
    },
  });

  doc.save(`Quadro_Membros_Arco_Real_${ordenacao}_${hojeLocal()}.pdf`);
};
