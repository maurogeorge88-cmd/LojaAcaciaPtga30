import { formatarMoeda } from './formatadores';

const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];
const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const getJsPDF = async () => {
  if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
  const module = await import('jspdf');
  return module.default;
};

const labelPeriodo = (periodo) =>
  periodo.ano === 0 ? 'Histórico Completo' :
  periodo.mes > 0 ? `${MESES[periodo.mes - 1]} ${periodo.ano}` :
  `Ano ${periodo.ano}`;

/**
 * Gera PDF do Relatório Financeiro — Situação Financeira da Loja
 */
export const gerarPDFRelatorioFinanceiro = async ({
  supabase,
  periodoA,
  dadosA,
  saldoAntA,
  caixaFisicoHistorico,
  caixaDetalhes,
  gruposReceitas,
  gruposDespesas,
  dadosMensais,
  showError,
  showSuccess,
}) => {
  try {
    showSuccess?.('Gerando PDF...');

    const jsPDF = await getJsPDF();
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // ─── Dados da Loja ────────────────────────────────────────────────────
    let dadosLoja = null;
    try {
      const { data } = await supabase.from('dados_loja').select('*').single();
      dadosLoja = data;
    } catch {}

    const nomeLoja = `${dadosLoja?.nome_loja || 'ARLS Acácia de Paranatinga'} Nº ${dadosLoja?.numero_loja || '30'}`;
    const W = 210; // largura A4
    const margin = 14;
    const colRight = W - margin;
    let y = 10;

    // ─── Cores ────────────────────────────────────────────────────────────
    const COR_ACCENT  = [79, 70, 229];   // indigo
    const COR_VERDE   = [16, 185, 129];
    const COR_VERM    = [239, 68, 68];
    const COR_AZUL    = [59, 130, 246];
    const COR_CINZA   = [107, 114, 128];
    const COR_FUNDO   = [248, 250, 252];
    const COR_FUNDO2  = [241, 245, 249];

    // ─── Helpers ─────────────────────────────────────────────────────────
    const txt = (text, x, yy, opts = {}) => {
      doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
      doc.setFontSize(opts.size || 9);
      doc.setTextColor(...(opts.color || [30, 30, 30]));
      // Sanitizar texto: remover/substituir caracteres problemáticos para jsPDF
      const toAscii = (s) => String(s)
        .replace(/ç/g, 'c').replace(/Ç/g, 'C')
        .replace(/ã/g, 'a').replace(/Ã/g, 'A')
        .replace(/õ/g, 'o').replace(/Õ/g, 'O')
        .replace(/é|ê|è/g, 'e').replace(/É|Ê|È/g, 'E')
        .replace(/á|â|à/g, 'a').replace(/Á|Â|À/g, 'A')
        .replace(/ó|ô|ò/g, 'o').replace(/Ó|Ô|Ò/g, 'O')
        .replace(/ú|û|ù/g, 'u').replace(/Ú|Û|Ù/g, 'U')
        .replace(/í|î|ì/g, 'i').replace(/Í|Î|Ì/g, 'I')
        .replace(/ü/g, 'u').replace(/Ü/g, 'U')
        .replace(/ñ/g, 'n').replace(/Ñ/g, 'N')
        .replace(/%/g, 'pct')
        .replace(/[^
