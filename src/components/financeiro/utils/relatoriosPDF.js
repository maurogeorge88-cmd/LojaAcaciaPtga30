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

  doc.setFontSize(18);
  doc.text('Relatório Financeiro da Loja', 14, 20);
  
  doc.setFontSize(12);
  const mesNome = filtros.mes > 0 ? meses[filtros.mes - 1] : 'Todos os meses';
  doc.text(`Período: ${mesNome}/${filtros.ano}`, 14, 30);
  
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
 * Gera relatório PDF resumido por categorias hierárquicas (FECHAMENTO MENSAL)
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

  // === PRÉ-PROCESSAMENTO: AGRUPAR MENSALIDADES ===
  const lancamentosAgrupados = [];
  const totais = {
    'Mensalidade': { valor: 0, categoria_id: null, data_pagamento: null, tipo: 'receita', nome_exibir: 'Mensalidade e Peculio - Irmao' },
    'Agape': { valor: 0, categoria_id: null, data_pagamento: null, tipo: 'receita', nome_exibir: 'Agape' },
    'Peculio': { valor: 0, categoria_id: null, data_pagamento: null, tipo: 'receita', nome_exibir: 'Peculio Irmao' }
  };
  
  lancamentos.filter(l => 
    l.status === 'pago' && 
    l.tipo_pagamento !== 'compensacao'
  ).forEach(lanc => {
    const descricao = lanc.descricao || '';
    const categoria = lanc.categorias_financeiras?.nome || '';
    
    // Agrupar apenas lançamentos com DESCRIÇÃO específica
    if (descricao === 'Mensalidade e Peculio - Irmao') {
      totais['Mensalidade'].valor += parseFloat(lanc.valor);
      totais['Mensalidade'].categoria_id = lanc.categoria_id;
      totais['Mensalidade'].data_pagamento = lanc.data_pagamento;
    }
    // ÁGAPE (categoria Agape, mas SEM iniciação na descrição)
    else if ((categoria === 'Agape' || categoria.toLowerCase() === 'ágape') && 
             !descricao.toLowerCase().includes('iniciação') &&
             !descricao.toLowerCase().includes('iniciacao')) {
      totais['Agape'].valor += parseFloat(lanc.valor);
      totais['Agape'].categoria_id = lanc.categoria_id;
      totais['Agape'].data_pagamento = lanc.data_pagamento;
    }
    // PECÚLIO IRMAO (categoria Peculio Irmao)
    else if (categoria === 'Peculio Irmao' || 
             categoria.toLowerCase() === 'pecúlio irmao' || 
             categoria.toLowerCase() === 'peculio irmao') {
      totais['Peculio'].valor += parseFloat(lanc.valor);
      totais['Peculio'].categoria_id = lanc.categoria_id;
      totais['Peculio'].data_pagamento = lanc.data_pagamento;
    }
    // Lançamentos normais (incluindo Mensalidades individuais e Iniciações)
    else {
      lancamentosAgrupados.push(lanc);
    }
  });
  
  // Adicionar linhas agrupadas
  Object.keys(totais).forEach(chave => {
    if (totais[chave].valor > 0) {
      lancamentosAgrupados.push({
        id: `agrupado_${chave}`,
        categoria_id: totais[chave].categoria_id,
        categorias_financeiras: { tipo: 'receita', nome: 'Mensalidade/Agape/Peculio' },
        descricao: totais[chave].nome_exibir,
        valor: totais[chave].valor,
        data_pagamento: totais[chave].data_pagamento,
        status: 'pago',
        origem_tipo: 'Loja',
        irmaos: { nome: 'Irmãos - Acacia' },
        observacoes: chave === 'Mensalidade' ? '' : `Total agrupado de ${totais[chave].nome_exibir}`
      });
    }
  });

  // Usar lancamentosAgrupados ao invés de lancamentos originais


  // Função para organizar hierarquia agrupada
  const organizarHierarquiaAgrupada = (tipo) => {
    const catsPrincipais = categorias.filter(c => 
      c.tipo === tipo && 
      (c.nivel === 1 || !c.categoria_pai_id) &&
      c.ativo === true
    );

    return catsPrincipais.map(principal => {
      const subcats = categorias.filter(c => c.categoria_pai_id === principal.id && c.ativo === true);
      
      const lancsDiretos = lancamentosAgrupados.filter(l => 
        l.categoria_id === principal.id &&
        l.categorias_financeiras?.tipo === tipo &&
        l.status === 'pago' &&
        l.tipo_pagamento !== 'compensacao'
      );
      
      const subcatsComLancs = subcats.map(sub => {
        const lancsSubcat = lancamentosAgrupados.filter(l => 
          l.categoria_id === sub.id &&
          l.categorias_financeiras?.tipo === tipo &&
          l.status === 'pago' &&
          l.tipo_pagamento !== 'compensacao'
        );
        
        return {
          categoria: sub,
          lancamentos: lancsSubcat,
          subtotal: lancsSubcat.reduce((sum, l) => sum + parseFloat(l.valor), 0)
        };
      }).filter(sc => sc.lancamentos.length > 0);

      const subtotalDireto = lancsDiretos.reduce((sum, l) => sum + parseFloat(l.valor), 0);
      const subtotalSubs = subcatsComLancs.reduce((sum, sc) => sum + sc.subtotal, 0);

      return {
        principal,
        lancamentosDiretos: lancsDiretos,
        subcategorias: subcatsComLancs,
        subtotalTotal: subtotalDireto + subtotalSubs
      };
    }).filter(cp => cp.subtotalTotal > 0);
  };

  // === DESPESAS ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text('Despesa', 105, yPos, { align: 'center' });
  yPos += 8;

  const despesasHierarquia = organizarHierarquiaAgrupada('despesa');
  let totalDespesas = 0;

  despesasHierarquia.forEach(catPrincipal => {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    // Nome da Categoria Principal
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(catPrincipal.principal.nome, 14, yPos);
    yPos += 6;

    // Cabeçalho da tabela
    doc.setFontSize(8);
    doc.text('DataPgto', 22, yPos);
    doc.text('Interessado', 42, yPos);
    doc.text('Descrição', 82, yPos);
    doc.text('Obs', 142, yPos);
    doc.text('Despesa', 200, yPos, { align: 'right' });
    yPos += 4;

    doc.setFont('helvetica', 'normal');

    // Lançamentos diretos
    catPrincipal.lancamentosDiretos.forEach(l => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(formatarDataBR(l.data_pagamento || l.data_vencimento), 22, yPos);
      doc.text(l.irmaos?.nome || 'Loja', 42, yPos);
      doc.text(l.descricao || '', 82, yPos);
      doc.text(l.observacoes || '', 142, yPos);
      doc.text(l.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 200, yPos, { align: 'right' });
      yPos += 4;
    });

    // Subcategorias
    catPrincipal.subcategorias.forEach(subcat => {
      subcat.lancamentos.forEach(l => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(formatarDataBR(l.data_pagamento || l.data_vencimento), 22, yPos);
        doc.text(l.irmaos?.nome || 'Loja', 42, yPos);
        doc.text(l.descricao || '', 82, yPos);
        doc.text(l.observacoes || '', 142, yPos);
        doc.text(l.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 200, yPos, { align: 'right' });
        yPos += 4;
      });
    });

    // Subtotal da categoria
    doc.setFont('helvetica', 'bold');
    doc.text('Sub Total Despesa', 150, yPos, { align: 'right' });
    doc.text(catPrincipal.subtotalTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 200, yPos, { align: 'right' });
    yPos += 8;

    totalDespesas += catPrincipal.subtotalTotal;
  });

  // === CRÉDITO A IRMÃOS (COMPENSAÇÕES) ===
  const lancamentosCompensacao = lancamentosAgrupados.filter(l => 
    l.categorias_financeiras?.tipo === 'despesa' && 
    l.tipo_pagamento === 'compensacao' && 
    l.status === 'pago'
  );

  if (lancamentosCompensacao.length > 0) {
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text('Crédito à Irmãos', 14, yPos);
    yPos += 6;

    // Cabeçalho
    doc.setFontSize(8);
    doc.text('DataPgto', 22, yPos);
    doc.text('Interessado', 42, yPos);
    doc.text('Descrição', 82, yPos);
    doc.text('Obs', 142, yPos);
    doc.text('Despesa', 200, yPos, { align: 'right' });
    yPos += 4;

    doc.setFont('helvetica', 'normal');

    lancamentosCompensacao.forEach(l => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(formatarDataBR(l.data_pagamento || l.data_vencimento), 22, yPos);
      doc.text(l.irmaos?.nome || 'N/A', 42, yPos);
      doc.text(l.descricao || '', 82, yPos);
      doc.text(l.observacoes || '', 142, yPos);
      doc.text(l.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 200, yPos, { align: 'right' });
      yPos += 4;
    });

    const totalCompensacoes = lancamentosCompensacao.reduce((sum, l) => sum + parseFloat(l.valor), 0);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Sub Total Despesa', 150, yPos, { align: 'right' });
    doc.text(totalCompensacoes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 200, yPos, { align: 'right' });
    yPos += 12;
  }

  // === RECEITAS ===
  if (yPos > 230) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text('Receita', 105, yPos, { align: 'center' });
  yPos += 8;

  const receitasHierarquia = organizarHierarquiaAgrupada('receita');
  let totalReceitas = 0;

  receitasHierarquia.forEach(catPrincipal => {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    // Nome da Categoria Principal
    doc.setFontSize(10);
    // Nome da Categoria Principal
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(catPrincipal.principal.nome, 14, yPos);
    yPos += 6;

    // Cabeçalho da tabela
    doc.setFontSize(8);
    doc.text('DataPgto', 22, yPos);
    doc.text('Interessado', 42, yPos);
    doc.text('Descrição', 82, yPos);
    doc.text('Obs', 142, yPos);
    doc.text('Receita', 200, yPos, { align: 'right' });
    yPos += 4;

    doc.setFont('helvetica', 'normal');

    // Lançamentos diretos
    catPrincipal.lancamentosDiretos.forEach(l => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(formatarDataBR(l.data_pagamento || l.data_vencimento), 22, yPos);
      doc.text(l.irmaos?.nome || 'Loja', 42, yPos);
      doc.text(l.descricao || '', 82, yPos);
      doc.text(l.observacoes || '', 142, yPos);
      doc.text(l.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 200, yPos, { align: 'right' });
      yPos += 4;
    });

    // Subcategorias
    catPrincipal.subcategorias.forEach(subcat => {
      subcat.lancamentos.forEach(l => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(formatarDataBR(l.data_pagamento || l.data_vencimento), 22, yPos);
        doc.text(l.irmaos?.nome || 'Irmãos - Acacia', 42, yPos);
        doc.text(l.descricao || '', 82, yPos);
        doc.text(l.observacoes || '', 142, yPos);
        doc.text(l.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 200, yPos, { align: 'right' });
        yPos += 4;
      });
    });


    // Subcategorias
    catPrincipal.subcategorias.forEach(subcat => {
      subcat.lancamentos.forEach(l => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(formatarDataBR(l.data_pagamento || l.data_vencimento), 22, yPos);
        doc.text(l.irmaos?.nome || 'Irmãos - Acacia', 42, yPos);
        doc.text(l.descricao || '', 82, yPos);
        doc.text(l.observacoes || '', 142, yPos);
        doc.text(l.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 200, yPos, { align: 'right' });
        yPos += 4;
      });
    });

    // Subtotal da categoria
    doc.setFont('helvetica', 'bold');
    doc.text('Sub Total Receita', 150, yPos, { align: 'right' });
    doc.text(catPrincipal.subtotalTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 200, yPos, { align: 'right' });
    yPos += 8;

    totalReceitas += catPrincipal.subtotalTotal;
  });

  // === TOTAIS FINAIS ===
  if (yPos > 220) {
    doc.addPage();
    yPos = 20;
  }

  const totalCompensacoes = lancamentosCompensacao.reduce((sum, l) => sum + parseFloat(l.valor), 0);
  const saldoTotal = totalReceitas - totalDespesas;

  yPos += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Total Geral de Receita e Despesa', 105, yPos, { align: 'center' });
  yPos += 8;

  doc.setFontSize(10);
  
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
  
  doc.setTextColor(0, 0, 0);

  // Rodapé com data e paginação
  const totalPages = doc.internal.getNumberOfPages();
  const dataAtual = new Date().toLocaleDateString('pt-BR', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(dataAtual, 14, 287);
    doc.text(`Página ${i} de ${totalPages}`, 200, 287, { align: 'right' });
  }

  doc.save(`Rel_Fechamento_-_${filtros.mes}_${filtros.ano}.pdf`);
};
