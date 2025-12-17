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
  const organizarHierarquia = (tipo) => {
    const lancamentosTipo = lancamentos.filter(l => 
      l.categorias_financeiras?.tipo === tipo && 
      l.status === 'pago' &&
      l.tipo_pagamento !== 'compensacao'
    );

    const catsPrincipais = categorias.filter(c => 
      c.tipo === tipo && 
      c.nivel === 1 &&
      c.ativo === true
    );

    const estrutura = [];

    catsPrincipais.forEach(catPrinc => {
      const lancamentosDiretos = lancamentosTipo.filter(l => 
        l.categoria_id === catPrinc.id
      );

      const subcategorias = categorias.filter(c => 
        c.categoria_pai_id === catPrinc.id && 
        c.ativo === true
      );

      const totalSubcats = subcategorias.reduce((sum, sub) => {
        const lancsFilhos = lancamentosTipo.filter(l => l.categoria_id === sub.id);
        return sum + lancsFilhos.reduce((s, l) => s + parseFloat(l.valor), 0);
      }, 0);

      const totalCatPrinc = lancamentosDiretos.reduce((sum, l) => 
        sum + parseFloat(l.valor), 0
      ) + totalSubcats;

      if (totalCatPrinc > 0) {
        estrutura.push({
          categoria: catPrinc,
          total: totalCatPrinc,
          subcategorias: subcategorias.map(sub => {
            const lancsFilhos = lancamentosTipo.filter(l => l.categoria_id === sub.id);
            const totalSub = lancsFilhos.reduce((s, l) => s + parseFloat(l.valor), 0);
            return totalSub > 0 ? { categoria: sub, total: totalSub } : null;
          }).filter(Boolean)
        });
      }
    });

    return estrutura;
  };

  // === DESPESAS ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(220, 38, 38);
  doc.text('DESPESAS', 14, yPos);
  doc.setTextColor(0, 0, 0);
  yPos += 8;

  const estruturaDespesas = organizarHierarquia('despesa');
  let totalDespesas = 0;

  estruturaDespesas.forEach(item => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(item.categoria.nome, 14, yPos);
    doc.text(item.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 200, yPos, { align: 'right' });
    yPos += 5;

    if (item.subcategorias.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      item.subcategorias.forEach(sub => {
        doc.text(`  • ${sub.categoria.nome}`, 20, yPos);
        doc.text(sub.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 200, yPos, { align: 'right' });
        yPos += 4;
      });
    }

    totalDespesas += item.total;
    yPos += 2;

    if (yPos > 270) {
      doc.addPage();
      yPos = 20;
    }
  });

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

  // === RECEITAS ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(0, 102, 204);
  doc.text('RECEITAS', 14, yPos);
  doc.setTextColor(0, 0, 0);
  yPos += 8;

  const estruturaReceitas = organizarHierarquia('receita');
  let totalReceitas = 0;

  estruturaReceitas.forEach(item => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(item.categoria.nome, 14, yPos);
    doc.text(item.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 200, yPos, { align: 'right' });
    yPos += 5;

    if (item.subcategorias.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      item.subcategorias.forEach(sub => {
        doc.text(`  • ${sub.categoria.nome}`, 20, yPos);
        doc.text(sub.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 200, yPos, { align: 'right' });
        yPos += 4;
      });
    }

    totalReceitas += item.total;
    yPos += 2;

    if (yPos > 270) {
      doc.addPage();
      yPos = 20;
    }
  });

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

  // Calcular compensações
  const totalCompensacoes = lancamentos
    .filter(l => l.tipo_pagamento === 'compensacao' && l.status === 'pago')
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
