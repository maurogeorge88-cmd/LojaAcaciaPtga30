import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { calcularIdade, formatarData } from './formatters';

// Mesmo esquema de cores já usado na tela do Quadro de Irmãos.
const CORES_GRAU = {
  'Aprendiz':      [59, 130, 246],   // azul
  'Companheiro':   [16, 185, 129],   // verde
  'Mestre':        [139, 92, 246],   // roxo
  'Nao iniciado':  [148, 163, 184],  // cinza
};

const corSituacao = (situacao) => {
  const sit = (situacao || 'regular').toLowerCase();
  return sit === 'regular' ? [16, 185, 129] : [59, 130, 246]; // verde=regular, azul=qualquer outra
};

const obterGrau = (irmao) => {
  if (irmao.data_exaltacao) return 'Mestre';
  if (irmao.data_elevacao) return 'Companheiro';
  if (irmao.data_iniciacao) return 'Aprendiz';
  return 'Nao iniciado';
};

const calcularTempoMaconaria = (dataIniciacao) => {
  if (!dataIniciacao) return '-';
  const inicio = new Date(dataIniciacao + 'T00:00:00');
  const hoje = new Date();
  let anos = hoje.getFullYear() - inicio.getFullYear();
  let meses = hoje.getMonth() - inicio.getMonth();
  if (meses < 0) { anos--; meses = 12 + meses; }
  return `${anos}a ${meses}m`;
};

const LABELS_ORDENACAO = {
  nome: 'Nome (A-Z)',
  cim: 'CIM',
  idade: 'Idade (Crescente)',
  tempo: 'Tempo de Maçonaria (Decrescente)',
};

/**
 * Gera o PDF do Quadro de Irmãos na mesma ordem/filtro que está na tela —
 * recebe a lista já filtrada por grau e já ordenada (irmaosOrdenados),
 * exatamente como o componente QuadroIrmaos.jsx monta pra exibição.
 *
 * @param {Array}  irmaosOrdenados  lista já filtrada+ordenada (o que está na tela)
 * @param {Object} dadosLoja        { nome, endereco, logo_url }
 * @param {string} grauSelecionado  'todos' | 'Mestre' | 'Companheiro' | 'Aprendiz' | 'Nao iniciado'
 * @param {string} ordenacao        'nome' | 'cim' | 'idade' | 'tempo'
 */
export const gerarQuadroIrmaosPDF = (irmaosOrdenados, dadosLoja, grauSelecionado, ordenacao) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, M = 15;
  let y = 10;

  const txt = (text, x, yy, opts = {}) => doc.text(String(text), x, yy, opts);
  const linhaDupla = (yy) => {
    doc.setDrawColor(80); doc.setLineWidth(0.5); doc.line(M, yy, W - M, yy);
    doc.setLineWidth(0.2); doc.line(M, yy + 1, W - M, yy + 1);
  };

  // ── Cabeçalho ──────────────────────────────────────────────────────────
  const nomeLoja = dadosLoja?.nome || 'ARLS Acácia de Paranatinga nº 30';
  if (dadosLoja?.logo_url) {
    try { doc.addImage(dadosLoja.logo_url, 'PNG', (W - 24) / 2, y, 24, 24); y += 29; }
    catch (e) { y += 2; }
  }
  doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(30);
  txt(nomeLoja, W / 2, y, { align: 'center' }); y += 6;
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(80);
  txt(dadosLoja?.endereco || 'Avenida Brasil, 2.300, Centro — Paranatinga/MT', W / 2, y, { align: 'center' }); y += 5;
  linhaDupla(y); y += 7;

  doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(20);
  txt('QUADRO DE IRMÃOS', W / 2, y, { align: 'center' }); y += 6;

  doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
  const filtroLabel = grauSelecionado === 'todos' ? 'Todos os Graus' : grauSelecionado;
  txt(`Grau: ${filtroLabel}   •   Ordenado por: ${LABELS_ORDENACAO[ordenacao] || ordenacao}   •   Total: ${irmaosOrdenados.length}`, W / 2, y, { align: 'center' }); y += 4;
  doc.setFontSize(7.5);
  txt(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, W / 2, y, { align: 'center' }); y += 4;
  doc.setTextColor(0);

  // ── Tabela ────────────────────────────────────────────────────────────
  const linhas = irmaosOrdenados.map(irmao => {
    const grau = obterGrau(irmao);
    return [
      irmao.cim || '—',
      irmao.nome || '—',
      grau,
      irmao.data_nascimento ? calcularIdade(irmao.data_nascimento) : '—',
      irmao.data_iniciacao ? formatarData(irmao.data_iniciacao) : '—',
      calcularTempoMaconaria(irmao.data_iniciacao),
      irmao.situacao || 'regular',
    ];
  });

  doc.autoTable({
    startY: y,
    margin: { left: M, right: M },
    head: [['CIM', 'Nome', 'Grau', 'Idade', 'Iniciação', 'Tempo', 'Situação']],
    body: linhas,
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 1.8, valign: 'middle', overflow: 'ellipsize' },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    columnStyles: {
      0: { cellWidth: 14 },
      1: { cellWidth: 62, fontStyle: 'bold' },
      2: { cellWidth: 24, halign: 'center' },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 22, halign: 'center' },
      5: { cellWidth: 18, halign: 'center' },
      6: { cellWidth: 22, halign: 'center' },
    },
    didParseCell: (data) => {
      // Badge colorido de Grau (coluna 2) e Situação (coluna 6) — pinta o
      // texto na cor certa, igual aos chips coloridos da tela.
      if (data.section === 'body' && data.column.index === 2) {
        const [r, g, b] = CORES_GRAU[data.cell.raw] || [100, 100, 100];
        data.cell.styles.textColor = [r, g, b];
        data.cell.styles.fontStyle = 'bold';
      }
      if (data.section === 'body' && data.column.index === 6) {
        const [r, g, b] = corSituacao(data.cell.raw);
        data.cell.styles.textColor = [r, g, b];
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

  const sufixoFiltro = grauSelecionado === 'todos' ? 'Todos' : grauSelecionado.replace(/\s+/g, '_');
  const sufixoOrdem = ordenacao;
  doc.save(`Quadro_Irmaos_${sufixoFiltro}_${sufixoOrdem}_${new Date().toISOString().split('T')[0]}.pdf`);
};
