import jsPDF from 'jspdf';

const fmtDt = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const MESES_NOME = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// Tenta achar "(n/m)" na descrição pra preencher a coluna Parcela nas
// Parcelas Futuras — Arco Real não tem campo próprio de parcela, o número
// vem embutido no texto (ex.: "Exaltação Arco Real (2/3)").
const extrairParcela = (descricao) => {
  const m = (descricao || '').match(/\((\d+)\s*\/\s*(\d+)\)/);
  return m ? `${m[1]}/${m[2]}` : '—';
};

/**
 * Relatório de Despesas Pendentes — versão Arco Real do gerarRelatorioIndividual
 * da Loja. Mesma estrutura de informação: Saldo Anterior (pendências de
 * meses antigos) / Despesa do último mês pendente / Parcelas Futuras
 * (informativo) / Receita (o que o Arco Real deve ao membro) / Dados
 * Bancários / Resumo Geral — só troca o cabeçalho pro do Capítulo e usa
 * arco_real_lancamentos em vez de lancamentos_loja.
 *
 * @param {Object} membro        { nome, cpf }
 * @param {Array}  lancamentosPendentes  lançamentos com status='pendente' do membro (já filtrados)
 * @param {string} logoUrl
 */
export const gerarRelatorioPendenciasArcoRealPDF = (membro, lancamentosPendentes, logoUrl) => {
  if (!lancamentosPendentes || lancamentosPendentes.length === 0) {
    throw new Error('Este membro não possui lançamentos pendentes!');
  }

  const doc = new jsPDF();
  let y = 10;

  const rodape = () => {
    const tot = doc.getNumberOfPages();
    for (let p = 1; p <= tot; p++) {
      doc.setPage(p);
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(150);
      doc.text('SysMaçom-MG - Desenvolvedor: Mauro George', 15, 290);
      doc.text('Página ' + p + ' de ' + tot, 105, 290, { align: 'center' });
      doc.text('Emitido em ' + new Date().toLocaleDateString('pt-BR'), 195, 290, { align: 'right' });
      doc.setTextColor(0);
    }
  };

  // ── CABEÇALHO ──────────────────────────────────────────────────────────
  if (logoUrl) {
    try { doc.addImage(logoUrl, 'PNG', 90, y, 30, 30); y += 38; } catch (e) { /* segue sem logo */ }
  }

  doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
  doc.text('Capítulo Guardiões da Aliança Nº 04', 105, y, { align: 'center' }); y += 6;
  doc.setFontSize(12); doc.setFont('helvetica', 'bold');
  doc.text('Relatório de Despesas Pendentes', 105, y, { align: 'center' }); y += 10;

  // Dados do membro — nome + CPF
  doc.setFillColor(240, 240, 240);
  doc.rect(15, y, 180, 12, 'F');
  y += 7;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal'); doc.setTextColor(80);
  doc.text('Nome:', 18, y);
  doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
  doc.text(membro.nome, 31, y);
  const xCpf = 31 + doc.getTextWidth(membro.nome) + 8;
  doc.setFont('helvetica', 'normal'); doc.setTextColor(80);
  doc.text('CPF: ' + (membro.cpf || '—'), xCpf, y);
  doc.setTextColor(0);
  y += 8;

  // ── Separar dados ──────────────────────────────────────────────────────
  const hojeDt = new Date();
  const primeiroMesSeguinte = new Date(hojeDt.getFullYear(), hojeDt.getMonth() + 1, 1);
  const corteStr = primeiroMesSeguinte.toISOString().split('T')[0];

  const parcelasFuturas = lancamentosPendentes.filter(l => l.tipo === 'receita' && l.data_vencimento >= corteStr);
  const pendentesAteCorte = lancamentosPendentes.filter(l => l.data_vencimento < corteStr);

  const todasDesp = pendentesAteCorte.filter(l => l.tipo === 'receita');
  const ultimoMes = todasDesp.length > 0 ? todasDesp.map(l => l.data_vencimento.substring(0, 7)).sort().pop() : null;

  const lancsAnteriores = ultimoMes ? todasDesp.filter(l => l.data_vencimento.substring(0, 7) < ultimoMes) : [];
  const lancsUltimoMes  = ultimoMes ? todasDesp.filter(l => l.data_vencimento.substring(0, 7) === ultimoMes) : todasDesp;
  const lancsReceita    = pendentesAteCorte.filter(l => l.tipo === 'despesa'); // Arco Real deve ao membro

  const somaAnterior = lancsAnteriores.reduce((s, l) => s + parseFloat(l.valor || 0), 0);
  const saldoAnterior = somaAnterior; // só débitos entram no "anterior" (mesma regra da Loja)

  const labelUltimoMes = ultimoMes
    ? `${MESES_NOME[parseInt(ultimoMes.substring(5, 7)) - 1]}/${ultimoMes.substring(0, 4)}`
    : 'Mês Atual';

  // ── Bloco genérico de lançamentos (usado pra Despesa e Receita) ─────────
  const renderBloco = (titulo, lancamentos, corTitulo, corValor) => {
    if (lancamentos.length === 0) return 0;
    if (y > 220) { doc.addPage(); y = 20; }

    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...corTitulo);
    doc.text(titulo, 15, y); y += 2;
    doc.setDrawColor(150); doc.setLineWidth(0.3); doc.line(15, y, 195, y); y += 4;

    doc.setFillColor(230, 230, 230); doc.rect(15, y, 180, 6, 'F');
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
    doc.text('DtVenc', 17, y + 4);
    doc.text('Descrição', 45, y + 4);
    doc.text('Valor', 190, y + 4, { align: 'right' });
    y += 11;

    let subtotal = 0;
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
    lancamentos.forEach(l => {
      if (y > 275) { doc.addPage(); y = 20; }
      const valor = parseFloat(l.valor || 0);
      subtotal += valor;
      doc.setTextColor(0);
      doc.text(fmtDt(l.data_vencimento), 17, y);
      doc.text((l.descricao || '').substring(0, 55), 45, y);
      doc.setTextColor(...corValor);
      doc.text('R$ ' + valor.toFixed(2), 190, y, { align: 'right' });
      doc.setTextColor(0);
      y += 5;
    });

    y += 1;
    doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(15, y, 195, y); y += 5;
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
    doc.text('Sub Total ' + titulo + ':', 130, y, { align: 'right' });
    doc.setTextColor(...corValor);
    doc.text('R$ ' + subtotal.toFixed(2), 190, y, { align: 'right' });
    doc.setTextColor(0);
    y += 2;
    doc.setDrawColor(150); doc.setLineWidth(0.3); doc.line(15, y, 195, y);
    y += 14;
    return subtotal;
  };

  // ── Saldo Anterior ────────────────────────────────────────────────────
  if (lancsAnteriores.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 40, 150);
    doc.text('Saldo Anterior - Pendências de meses anteriores', 15, y); y += 3;
    doc.setDrawColor(150); doc.setLineWidth(0.3); doc.line(15, y, 195, y); y += 4;

    doc.setFillColor(230, 225, 245); doc.rect(15, y, 180, 6, 'F');
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
    doc.text('DtVenc', 17, y + 4);
    doc.text('Descrição', 50, y + 4);
    doc.text('Tipo', 155, y + 4);
    doc.text('Valor', 192, y + 4, { align: 'right' });
    y += 11;

    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
    lancsAnteriores.forEach(l => {
      if (y > 275) { doc.addPage(); y = 20; }
      doc.setTextColor(0);
      doc.text(fmtDt(l.data_vencimento), 17, y);
      doc.text((l.descricao || '').substring(0, 50), 50, y);
      doc.setTextColor(200, 0, 0); doc.text('Deve', 155, y);
      doc.text('R$ ' + parseFloat(l.valor || 0).toFixed(2), 192, y, { align: 'right' });
      doc.setTextColor(0);
      y += 5;
    });

    y += 1;
    doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(15, y, 195, y); y += 5;
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
    doc.text('Saldo Anterior:', 140, y, { align: 'right' });
    doc.setTextColor(200, 0, 0);
    doc.text('Deve R$ ' + saldoAnterior.toFixed(2), 192, y, { align: 'right' });
    y += 2;
    doc.setDrawColor(150); doc.setLineWidth(0.3); doc.line(15, y, 195, y);
    y += 12; doc.setTextColor(0);
  }

  // ── Despesa do último mês pendente ──────────────────────────────────────
  let totalGeralDespesa = renderBloco('Despesa - ' + labelUltimoMes, lancsUltimoMes, [180, 0, 0], [200, 0, 0]);

  // ── Parcelas Futuras (informativo) ──────────────────────────────────────
  if (parcelasFuturas.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 100, 100);
    doc.text('Parcelas Futuras - Membro com o Arco Real  ', 15, y);
    const largTitulo = doc.getTextWidth('Parcelas Futuras - Membro com o Arco Real  ');
    doc.setTextColor(200, 100, 0);
    doc.text('[ INFORMATIVO ]', 15 + largTitulo, y);
    y += 3;
    doc.setDrawColor(150); doc.setLineWidth(0.3); doc.line(15, y, 195, y); y += 4;

    doc.setFillColor(245, 240, 225); doc.rect(15, y, 180, 6, 'F');
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
    doc.text('DtVenc', 17, y + 4);
    doc.text('Descrição', 50, y + 4);
    doc.text('Parcela', 155, y + 4);
    doc.text('Valor', 192, y + 4, { align: 'right' });
    y += 11;

    let totFuturas = 0;
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
    parcelasFuturas.forEach(l => {
      if (y > 275) { doc.addPage(); y = 20; }
      const valor = parseFloat(l.valor || 0);
      totFuturas += valor;
      doc.setTextColor(0);
      doc.text(fmtDt(l.data_vencimento), 17, y);
      doc.text((l.descricao || '').substring(0, 52), 50, y);
      doc.setTextColor(100, 100, 100); doc.text(extrairParcela(l.descricao), 155, y);
      doc.setTextColor(150, 80, 0); doc.text('R$ ' + valor.toFixed(2), 192, y, { align: 'right' });
      doc.setTextColor(0);
      y += 5;
    });

    y += 1;
    doc.setDrawColor(120); doc.setLineWidth(0.4); doc.line(15, y, 195, y); y += 5;
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 100, 100);
    doc.text('Total Parcelas Futuras', 140, y, { align: 'right' });
    doc.setTextColor(200, 100, 0);
    doc.text('[ INFORMATIVO ]', 141, y);
    doc.text('R$ ' + totFuturas.toFixed(2), 192, y, { align: 'right' });
    y += 2;
    doc.setDrawColor(150); doc.setLineWidth(0.3); doc.line(15, y, 195, y);
    y += 12; doc.setTextColor(0);
  }

  // ── Receita — o que o Arco Real deve ao membro ──────────────────────────
  let totalGeralCredito = renderBloco('Receita', lancsReceita, [0, 80, 180], [0, 80, 180]);

  // ── Dados Bancários + Resumo Geral ──────────────────────────────────────
  if (y > 230) { doc.addPage(); y = 20; }

  totalGeralDespesa += somaAnterior;
  const saldoFinal = totalGeralDespesa - totalGeralCredito;

  const yBanco = y;
  doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
  doc.text('Dados Bancários', 45, y, { align: 'center' }); y += 5;
  doc.setFontSize(9); doc.setTextColor(0, 100, 180); doc.setFont('helvetica', 'bold');
  doc.text('Cooperativa de Crédito Sicredi', 45, y, { align: 'center' }); y += 4;
  doc.setTextColor(0); doc.setFont('helvetica', 'normal');
  doc.text('Ag.: 0802 - C.C.: 86.913-9', 45, y, { align: 'center' }); y += 4;
  doc.text('PIX.: 03.250.704/0001-00', 45, y, { align: 'center' }); y += 4;
  doc.setFontSize(8);
  doc.text('CNPJ: 03.250.704/0001-00', 45, y, { align: 'center' }); y += 4;
  doc.text('Fav.: ARLS ACÁCIA PARANATINGA 30', 45, y, { align: 'center' });

  let yr = yBanco;
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
  doc.text('Resumo Geral:', 190, yr, { align: 'right' }); yr += 6;

  doc.setFontSize(10);
  doc.text('Despesa Total:', 155, yr, { align: 'right' });
  doc.setTextColor(200, 0, 0);
  doc.text('R$ ' + totalGeralDespesa.toFixed(2), 190, yr, { align: 'right' }); yr += 5;

  doc.setTextColor(0);
  doc.text('Receita Total:', 155, yr, { align: 'right' });
  doc.setTextColor(0, 80, 180);
  doc.text('R$ ' + totalGeralCredito.toFixed(2), 190, yr, { align: 'right' }); yr += 2;

  doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(115, yr, 195, yr); yr += 5;

  doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  if (saldoFinal > 0) {
    doc.setTextColor(200, 0, 0);
    doc.text('Valor a Pagar:', 155, yr, { align: 'right' });
    doc.text('R$ ' + saldoFinal.toFixed(2), 190, yr, { align: 'right' });
  } else if (saldoFinal < 0) {
    doc.setTextColor(0, 80, 180);
    doc.text('Valor a Receber:', 155, yr, { align: 'right' });
    doc.text('R$ ' + Math.abs(saldoFinal).toFixed(2), 190, yr, { align: 'right' });
  } else {
    doc.setTextColor(0, 150, 80);
    doc.text('Situação: Em Dia', 155, yr, { align: 'right' });
  }
  doc.setTextColor(0);
  y = Math.max(y, yr) + 15;

  rodape();
  const primeirosNomes = membro.nome.trim().split(' ').slice(0, 2).join('_');
  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();
  doc.save(`Rel_Financas_ArcoReal_${primeirosNomes}_${mesAtual}_${anoAtual}.pdf`);
};
