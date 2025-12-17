import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { formatarDataBR } from './formatadores';

/**
 * Gera relatório PDF detalhado com todos os lançamentos
 */
export const gerarRelatorioPDF = ({
  lancamentos,
  categorias,
  filtros,
  resumo,
  saldoAnterior,
  meses
}) => {
  const doc = new jsPDF();

  // Título
  doc.setFontSize(18);
  doc.text('Relatório Financeiro da Loja', 14, 20);
  
  // Período
  doc.setFontSize(12);
  const mesNome = filtros.mes > 0 ? meses[filtros.mes - 1] : 'Todos os meses';
  doc.text(`Período: ${mesNome}/${filtros.ano}`, 14, 30);
  
  // Resumo
  doc.setFontSize(14);
  doc.text('Resumo', 14, 40);
  doc.setFontSize(10);
  doc.text(`Saldo Anterior: R$ ${saldoAnterior.toFixed(2)}`, 14, 48);
  doc.text(`Receitas Pagas: R$ ${resumo.receitas.toFixed(2)}`, 14, 54);
  doc.text(`Despesas Pagas: R$ ${resumo.despesas.toFixed(2)}`, 14, 60);
  doc.text(`Saldo do Período: R$ ${resumo.saldoPeriodo.toFixed(2)}`, 14, 66);
  doc.text(`Saldo Total: R$ ${resumo.saldoTotal.toFixed(2)}`, 14, 72);
  doc.text(`Receitas Pendentes: R$ ${resumo.receitasPendentes.toFixed(2)}`, 14, 78);
  doc.text(`Despesas Pendentes: R$ ${resumo.despesasPendentes.toFixed(2)}`, 14, 84);

  // Tabela de lançamentos
  const dadosTabela = lancamentos.map(l => [
    formatarDataBR(l.data_pagamento),
    l.categorias_financeiras?.tipo === 'receita' ? 'Receita' : 'Despesa',
    l.categorias_financeiras?.nome,
    l.descricao,
    `R$ ${parseFloat(l.valor).toFixed(2)}`,
    l.status === 'pago' ? 'Pago' : 'Pendente'
  ]);

  doc.autoTable({
    head: [['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor', 'Status']],
    body: dadosTabela,
    startY: 92,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [41, 128, 185] }
  });

  doc.save(`relatorio-financeiro-${filtros.mes}-${filtros.ano}.pdf`);
};

/**
 * Gera relatório PDF resumido por categorias hierárquicas
 */
export const gerarRelatorioResumido = ({
  lancamentos,
  categorias,
  filtros,
  meses
}) => {
  const doc = new jsPDF();
  
  // CABEÇALHO
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Acácia de Paranatinga nº 30', 105, 20, { align: 'center' });
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Avenida Brasil, Paranatinga-MT', 105, 26, { align: 'center' });
  doc.text('Paranatinga-MT', 105, 31, { align: 'center' });
  
  // TÍTULO DO RELATÓRIO
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(14, 36, 196, 36);
  doc.text(filtros.ano.toString(), 59, 41, { align: 'center' });
  const mesNome = filtros.mes > 0 ? meses[filtros.mes - 1] : 'Período Total';
  doc.text(mesNome, 150, 41, { align: 'center' });
  doc.line(14, 43, 196, 43);

  let yPos = 52;

  // Função auxiliar para organizar hierarquia

  // === DESPESAS ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text('DESPESAS', 14, yPos);
  yPos += 8;

  const lancamentosDespesas = lancamentos.filter(l => 
    l.categorias_financeiras?.tipo === 'despesa' && 
    l.status === 'pago' &&
    l.tipo_pagamento !== 'compensacao'
  );

  if (lancamentosDespesas.length > 0) {
    const dadosDespesas = lancamentosDespesas.map(l => [
      formatarDataBR(l.data_pagamento || l.data_vencimento),
      l.irmaos?.nome || 'Loja',
      l.descricao || '',
      l.observacoes || '',
      l.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    ]);

    doc.autoTable({
      head: [['DataPgto', 'Interessado', 'Descrição', 'Obs', 'Despesa']],
      body: dadosDespesas,
      startY: yPos,
      styles: { 
        fontSize: 8,
        cellPadding: 2,
        textColor: [0, 0, 0]
      },
      headStyles: { 
        fillColor: [100, 100, 100],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 40 },
        2: { cellWidth: 60 },
        3: { cellWidth: 40 },
        4: { cellWidth: 28, halign: 'right' }
      },
      margin: { left: 14, right: 14 }
    });

    yPos = doc.lastAutoTable.finalY + 5;
  }

  const totalDespesas = lancamentosDespesas.reduce((sum, l) => sum + parseFloat(l.valor), 0);

  // SUB TOTAL DESPESAS
  yPos += 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(220, 38, 38);
  doc.text('Sub Total Despesa', 150, yPos, { align: 'right' });
  doc.text(totalDespesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 200, yPos, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  yPos += 12;

  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }

  // === CRÉDITO A IRMÃOS (COMPENSAÇÕES) ===
  const lancamentosCompensacao = lancamentos.filter(l => 
    l.categorias_financeiras?.tipo === 'despesa' && 
    l.tipo_pagamento === 'compensacao' && 
    l.status === 'pago'
  );

  if (lancamentosCompensacao.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text('Crédito a Irmãos', 14, yPos);
    yPos += 8;

    // Criar tabela de compensações
    const dadosCompensacao = lancamentosCompensacao.map(l => [
      formatarDataBR(l.data_pagamento || l.data_vencimento),
      l.irmaos?.nome || 'N/A',
      l.descricao || '',
      l.observacoes || '',
      l.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    ]);

    doc.autoTable({
      head: [['DataPgto', 'Interessado', 'Descrição', 'Obs', 'Despesa']],
      body: dadosCompensacao,
      startY: yPos,
      styles: { 
        fontSize: 8,
        cellPadding: 2
      },
      headStyles: { 
        fillColor: [100, 100, 100],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 22 },  // DataPgto
        1: { cellWidth: 40 },  // Interessado
        2: { cellWidth: 60 },  // Descrição
        3: { cellWidth: 40 },  // Obs
        4: { cellWidth: 28, halign: 'right' }  // Despesa
      },
      margin: { left: 14, right: 14 },
      didDrawPage: (data) => {
        yPos = data.cursor.y;
      }
    });

    // Sub Total das Compensações
    yPos = doc.lastAutoTable.finalY + 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Sub Total Despesa', 150, yPos, { align: 'right' });
    doc.text(lancamentosCompensacao.reduce((sum, l) => sum + parseFloat(l.valor), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 200, yPos, { align: 'right' });
    yPos += 12;

    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
  }

  // === RECEITAS ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text('RECEITAS', 14, yPos);
  yPos += 8;

  const lancamentosReceitas = lancamentos.filter(l => 
    l.categorias_financeiras?.tipo === 'receita' && 
    l.status === 'pago' &&
    l.tipo_pagamento !== 'compensacao'
  );

  if (lancamentosReceitas.length > 0) {
    const dadosReceitas = lancamentosReceitas.map(l => [
      formatarDataBR(l.data_pagamento || l.data_vencimento),
      l.irmaos?.nome || 'Loja',
      l.descricao || '',
      l.observacoes || '',
      l.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    ]);

    doc.autoTable({
      head: [['DataPgto', 'Interessado', 'Descrição', 'Obs', 'Receita']],
      body: dadosReceitas,
      startY: yPos,
      styles: { 
        fontSize: 8,
        cellPadding: 2,
        textColor: [0, 0, 0]
      },
      headStyles: { 
        fillColor: [100, 100, 100],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 40 },
        2: { cellWidth: 60 },
        3: { cellWidth: 40 },
        4: { cellWidth: 28, halign: 'right' }
      },
      margin: { left: 14, right: 14 }
    });

    yPos = doc.lastAutoTable.finalY + 5;
  }

  const totalReceitas = lancamentosReceitas.reduce((sum, l) => sum + parseFloat(l.valor), 0);

  // SUB TOTAL RECEITAS
  yPos += 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 102, 204);
  doc.text('Sub Total Receita', 150, yPos, { align: 'right' });
  doc.text(totalReceitas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 200, yPos, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  yPos += 12;

  // === TOTAIS FINAIS ===
  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }

  // Calcular compensações (despesas pagas por compensação = créditos a irmãos)
  const totalCompensacoes = lancamentos
    .filter(l => 
      l.categorias_financeiras?.tipo === 'despesa' && 
      l.tipo_pagamento === 'compensacao' && 
      l.status === 'pago'
    )
    .reduce((sum, l) => sum + parseFloat(l.valor), 0);

  const saldoTotal = totalReceitas - totalDespesas;

  yPos += 12;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  
  // Total Receita - Azul
  doc.setTextColor(0, 102, 204);
  doc.text('Total Receita', 150, yPos, { align: 'right' });
  doc.text(totalReceitas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 200, yPos, { align: 'right' });
  yPos += 5;
  
  // Total Despesa - Vermelho
  doc.setTextColor(220, 38, 38);
  doc.text('Total Despesa', 150, yPos, { align: 'right' });
  doc.text(totalDespesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 200, yPos, { align: 'right' });
  yPos += 5;
  
  // Valores Compensados - Preto
  doc.setTextColor(0, 0, 0);
  doc.text('Valores Compensados (Inf)', 150, yPos, { align: 'right' });
  doc.text(totalCompensacoes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 200, yPos, { align: 'right' });
  yPos += 6;

  // Saldo Total - Azul se positivo, Vermelho se negativo
  const corSaldo = saldoTotal >= 0 ? [0, 102, 204] : [220, 38, 38];
  doc.setTextColor(corSaldo[0], corSaldo[1], corSaldo[2]);
  doc.text('Saldo Total', 150, yPos, { align: 'right' });
  doc.text(saldoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 200, yPos, { align: 'right' });
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);

  // Rodapé
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `Página ${i} de ${totalPages}`,
      105,
      287,
      { align: 'center' }
    );
  }

  doc.save(`fechamento-mensal-${filtros.mes}-${filtros.ano}.pdf`);
};
