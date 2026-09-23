import jsPDF from 'jspdf';
import 'jspdf-autotable';

const fmtR = (v) => 'R$ ' + Math.abs(Number(v || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const fmtD = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

// Extrato financeiro individual do membro do Arco Real — mesma estrutura
// da aba "Meu Financeiro" da tela pessoal (cards de resumo + lista
// itemizada), em PDF, com o cabeçalho do Capítulo (não da Loja), pra
// poder ser enviado ao irmão.
export const gerarExtratoFinanceiroArcoRealPDF = (membro, lancamentos, logoUrl) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  const gerarConteudo = () => {
    // CABEÇALHO — mesmo padrão do relatório geral: fundo branco, brasão
    // grande centralizado, "Capítulo Guardiões da Aliança Nº 04" em negrito.
    let y = 10;

    if (logoUrl) {
      try { doc.addImage(logoUrl, 'PNG', W / 2 - 14, y, 28, 28); y += 33; } catch (e) { /* segue sem logo */ }
    }

    doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
    doc.text('Capítulo Guardiões da Aliança Nº 04', W / 2, y, { align: 'center' }); y += 6;
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(80);
    doc.text('Arco Real - Controle Financeiro', W / 2, y, { align: 'center' }); y += 5;
    doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
    doc.text('EXTRATO FINANCEIRO INDIVIDUAL', W / 2, y, { align: 'center' }); y += 10;

    doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(20);
    doc.text(membro.nome, 15, y);
    y += 6;
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(90);
    const dataGeracao = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    doc.text(`Emitido em: ${dataGeracao}`, 15, y);
    doc.setTextColor(0);
    y += 8;

    // CARDS DE RESUMO (mesma lógica da tela "Meu Financeiro")
    const pendentes = lancamentos.filter(l => l.status === 'pendente' && l.tipo_pagamento !== 'compensacao');
    const totalDevo = pendentes.filter(l => l.tipo === 'receita').reduce((s, l) => s + parseFloat(l.valor || 0), 0);
    const totalCredito = pendentes.filter(l => l.tipo === 'despesa').reduce((s, l) => s + parseFloat(l.valor || 0), 0);
    const totalPago = lancamentos.filter(l => l.status === 'pago' && l.tipo_pagamento !== 'compensacao').reduce((s, l) => s + parseFloat(l.valor || 0), 0);
    const saldo = totalDevo - totalCredito;

    const cards = [
      { label: 'Você Deve', valor: totalDevo, cor: [220, 38, 38] },
      { label: 'Arco Real Deve', valor: totalCredito, cor: [37, 99, 235] },
      { label: 'Total Pago', valor: totalPago, cor: [16, 150, 89] },
      { label: saldo > 0 ? 'Saldo Devedor' : saldo < 0 ? 'Saldo a Favor' : 'Quitado', valor: Math.abs(saldo), cor: saldo > 0 ? [220, 38, 38] : saldo < 0 ? [37, 99, 235] : [16, 150, 89] },
    ];
    const larguraCard = (W - 30 - 3 * 4) / 4;
    cards.forEach((c, i) => {
      const x = 15 + i * (larguraCard + 4);
      doc.setDrawColor(...c.cor);
      doc.setLineWidth(0.6);
      doc.line(x, y, x + larguraCard, y);
      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...c.cor);
      doc.text(fmtR(c.valor), x, y + 7);
      doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(90);
      doc.text(c.label, x, y + 12);
      doc.setTextColor(0);
    });
    y += 20;

    // TABELA ITEMIZADA
    const ordenados = [...lancamentos].sort((a, b) => (b.data_vencimento || '').localeCompare(a.data_vencimento || ''));
    const linhas = ordenados.map(l => [
      fmtD(l.data_pagamento || l.data_vencimento),
      l.descricao || '',
      l.categoria_nome || '—',
      l.tipo === 'receita' ? 'Receita' : 'Despesa',
      l.status === 'pago' ? (l.tipo_pagamento === 'compensacao' ? 'Abatido' : 'Pago') : 'Pendente',
      fmtR(l.valor),
    ]);

    doc.autoTable({
      startY: y,
      head: [['Data', 'Descrição', 'Categoria', 'Tipo', 'Status', 'Valor']],
      body: linhas,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 20 },
        3: { cellWidth: 18, halign: 'center' },
        4: { cellWidth: 20, halign: 'center' },
        5: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.column.index === 5 && data.section === 'body') {
          const tipo = linhas[data.row.index][3];
          data.cell.styles.textColor = tipo === 'Receita' ? [16, 150, 89] : [220, 38, 38];
        }
        if (data.column.index === 4 && data.section === 'body') {
          const status = data.cell.raw;
          data.cell.styles.textColor = status === 'Pago' ? [16, 150, 89] : status === 'Abatido' ? [124, 58, 237] : [217, 119, 6];
        }
      },
      didDrawPage: () => {
        const pageCount = doc.internal.getNumberOfPages();
        const currentPage = doc.internal.getCurrentPageInfo().pageNumber;
        doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(150);
        doc.text('SysMaçom-MG - Desenvolvedor: Mauro George', 15, H - 8);
        doc.text(`Página ${currentPage} de ${pageCount}`, W / 2, H - 8, { align: 'center' });
        doc.setTextColor(0);
      },
    });

    if (lancamentos.length === 0) {
      doc.setFontSize(10); doc.setTextColor(120);
      doc.text('Nenhum lançamento encontrado.', W / 2, y + 15, { align: 'center' });
    }

    doc.save(`Extrato_ArcoReal_${membro.nome.replace(/\s+/g, '_')}.pdf`);
  };

  gerarConteudo();
};
