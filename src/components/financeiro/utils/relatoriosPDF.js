import 'jspdf-autotable';
import { formatarDataBR } from './formatadores';

// Função auxiliar para obter jsPDF
const getJsPDF = async () => {
  // Tentar primeiro o import global
  if (window.jspdf && window.jspdf.jsPDF) {
    return window.jspdf.jsPDF;
  }
  
  // Fallback: importar dinamicamente
  try {
    const module = await import('jspdf');
    return module.default;
  } catch (error) {
    console.error('Erro ao carregar jsPDF:', error);
    throw new Error('jsPDF não pôde ser carregado');
  }
};

/**
 * Gera relatório PDF detalhado com todos os lançamentos
 */
export const gerarRelatorioPDF = async ({
  lancamentos,
  categorias,
  filtros,
  resumo,
  saldoAnterior,
  meses
}) => {
  const jsPDF = await getJsPDF();
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
 * Gera relatório PDF resumido por categorias hierárquicas (CÓDIGO ORIGINAL)
 */
export const gerarRelatorioResumido = async ({
  lancamentos,
  categorias,
  filtros,
  meses
}) => {
  const jsPDF = await getJsPDF();
  const doc = new jsPDF();
  
  // Logo/Cabeçalho
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Acácia de Paranatinga nº 30', 105, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Avenida Brasil, Paranatinga-MT', 105, 26, { align: 'center' });
  doc.text('Paranatinga-MT', 105, 31, { align: 'center' });
  
  // Período
  doc.setFillColor(173, 216, 230);
  doc.rect(10, 36, 90, 8, 'F');
  doc.rect(100, 36, 100, 8, 'F');
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(filtros.ano.toString(), 59, 41, { align: 'center' });
  const mesNome = filtros.mes > 0 ? meses[filtros.mes - 1] : 'Todos os meses';
  doc.text(mesNome, 150, 41, { align: 'center' });

  let yPos = 52;

  // ORGANIZAR POR HIERARQUIA
  const organizarHierarquia = (tipo) => {
    const catsPrincipais = categorias.filter(c => 
      c.tipo === tipo && 
      (c.nivel === 1 || !c.categoria_pai_id)
    );

    return catsPrincipais.map(principal => {
      const subcats = categorias.filter(c => c.categoria_pai_id === principal.id);
      
      const lancsDiretos = lancamentos.filter(l => 
        l.categoria_id === principal.id &&
        l.categorias_financeiras?.tipo === tipo &&
        l.status === 'pago' &&
        l.tipo_pagamento !== 'compensacao'  
      );
      
      const subcatsComLancs = subcats.map(sub => {
        const lancsSubcat = lancamentos.filter(l => 
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

  // DESPESAS HIERÁRQUICAS
  const despesasHierarquia = organizarHierarquia('despesa');
  const totalDespesas = despesasHierarquia.reduce((sum, cp) => sum + cp.subtotalTotal, 0);
  
  const totalCompensacoes = lancamentos
    .filter(l => 
      l.status === 'pago' && 
      l.tipo_pagamento === 'compensacao' &&
      l.categorias_financeiras?.tipo === 'despesa'
    )
    .reduce((sum, l) => sum + parseFloat(l.valor), 0);

  // Título Despesas
  doc.setFillColor(154, 205, 50);
  doc.rect(10, yPos, 190, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Despesa', 105, yPos + 5.5, { align: 'center' });
  
  yPos += 12;
  doc.setTextColor(0, 0, 0);

  // Para cada categoria principal
  despesasHierarquia.forEach(catPrincipal => {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFillColor(173, 216, 230);
    doc.rect(10, yPos, 190, 6, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(catPrincipal.principal.nome, 12, yPos + 4);
    yPos += 8;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('DataPgto', 10, yPos);
    doc.text('Interessado', 32, yPos);
    doc.text('Descrição', 70, yPos);
    doc.text('Obs', 110, yPos);
    doc.text('Despesa', 190, yPos, { align: 'right' });
    yPos += 4;

    doc.setFont('helvetica', 'normal');
    catPrincipal.lancamentosDiretos.forEach(lanc => {
      if (yPos > 275) {
        doc.addPage();
        yPos = 20;
      }

      const dataLanc = formatarDataBR(lanc.data_pagamento);
      const interessado = lanc.origem_tipo === 'Loja' ? 
        (lanc.descricao.substring(0, 22)) : 
        (lanc.irmaos?.nome?.split(' ').slice(0, 2).join(' ') || 'Irmão');
      const descricao = lanc.categorias_financeiras?.nome?.substring(0, 20) || '';
      const obs = (lanc.observacoes || '').substring(0, 30);
      const valor = parseFloat(lanc.valor);

      doc.text(dataLanc, 10, yPos);
      doc.text(interessado.substring(0, 22), 32, yPos);
      doc.text(descricao, 70, yPos);
      doc.text(obs, 110, yPos);
      doc.text(`R$${valor.toFixed(2)}`, 190, yPos, { align: 'right' });
      
      yPos += 4;
    });

    catPrincipal.subcategorias.forEach(subcat => {
      subcat.lancamentos.forEach(lanc => {
        if (yPos > 275) {
          doc.addPage();
          yPos = 20;
        }

        const dataLanc = formatarDataBR(lanc.data_pagamento);
        const interessado = lanc.origem_tipo === 'Loja' ? 
          (lanc.descricao.substring(0, 22)) : 
          (lanc.irmaos?.nome?.split(' ').slice(0, 2).join(' ') || 'Irmão');
        const descricao = lanc.categorias_financeiras?.nome?.substring(0, 20) || '';
        const obs = (lanc.observacoes || '').substring(0, 30);
        const valor = parseFloat(lanc.valor);

        doc.text(dataLanc, 10, yPos);
        doc.text(interessado.substring(0, 22), 32, yPos);
        doc.text(descricao, 70, yPos);
        doc.text(obs, 110, yPos);
        doc.text(`R$${valor.toFixed(2)}`, 190, yPos, { align: 'right' });
        
        yPos += 4;
      });
    });

    yPos += 2;
    doc.setFont('helvetica', 'bold');
    doc.text('Sub Total Despesa', 150, yPos, { align: 'right' });
    doc.text(`R$ ${catPrincipal.subtotalTotal.toFixed(2)}`, 190, yPos, { align: 'right' });
    
    yPos += 8;
  });

  // CRÉDITO À IRMÃOS
  const compensacoes = lancamentos.filter(l => 
    l.status === 'pago' && 
    l.tipo_pagamento === 'compensacao' &&
    l.categorias_financeiras?.tipo === 'despesa'
  );
  
  if (compensacoes.length > 0) {
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFillColor(173, 216, 230);
    doc.rect(10, yPos, 190, 6, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Crédito à Irmãos', 12, yPos + 4);
    yPos += 8;

    doc.setFontSize(8);
    doc.text('DataPgto', 10, yPos);
    doc.text('Interessado', 32, yPos);
    doc.text('Descrição', 70, yPos);
    doc.text('Obs', 125, yPos);
    doc.text('Despesa', 190, yPos, { align: 'right' });
    yPos += 4;

    doc.setFont('helvetica', 'normal');
    compensacoes.forEach(lanc => {
      if (yPos > 275) {
        doc.addPage();
        yPos = 20;
      }

      doc.text(formatarDataBR(lanc.data_pagamento), 10, yPos);
      doc.text(lanc.irmaos?.nome?.split(' ').slice(0, 2).join(' ') || 'Irmão', 32, yPos);
      doc.text(lanc.categorias_financeiras?.nome?.substring(0, 20) || '', 70, yPos);
      doc.text((lanc.observacoes || '').substring(0, 45), 125, yPos);
      doc.text(`R$${parseFloat(lanc.valor).toFixed(2)}`, 190, yPos, { align: 'right' });
      yPos += 4;
    });

    yPos += 2;
    doc.setFont('helvetica', 'bold');
    doc.text('Sub Total Despesa', 150, yPos, { align: 'right' });
    doc.text(`R$ ${totalCompensacoes.toFixed(2)}`, 190, yPos, { align: 'right' });
    yPos += 8;
  }

  // AGRUPAR ÁGAPE E PECÚLIO
  const lancamentosAgrupados = [];
  const totais = {
    'Mensalidade': { valor: 0, categoria_id: null, data_pagamento: null, tipo: 'receita', nome_exibir: 'Mensalidade' },
    'Agape': { valor: 0, categoria_id: null, data_pagamento: null, tipo: 'receita', nome_exibir: 'Agape' },
    'Peculio': { valor: 0, categoria_id: null, data_pagamento: null, tipo: 'receita', nome_exibir: 'Peculio Irmao' }
  };
  
  lancamentos.filter(l => 
    l.status === 'pago' && 
    l.tipo_pagamento !== 'compensacao'
  ).forEach(lanc => {
    const descricao = lanc.descricao || '';
    const categoria = lanc.categorias_financeiras?.nome || '';
    
    if (descricao === 'Mensalidade e Peculio - Irmao') {
      totais['Mensalidade'].valor += parseFloat(lanc.valor);
      totais['Mensalidade'].categoria_id = lanc.categoria_id;
      totais['Mensalidade'].data_pagamento = lanc.data_pagamento;
    }
    else if (categoria === 'Agape' || categoria.toLowerCase() === 'ágape') {
      totais['Agape'].valor += parseFloat(lanc.valor);
      totais['Agape'].categoria_id = lanc.categoria_id;
      totais['Agape'].data_pagamento = lanc.data_pagamento;
    }
    else if (categoria === 'Peculio Irmao' || categoria.toLowerCase() === 'pecúlio irmao' || categoria.toLowerCase() === 'peculio irmao') {
      totais['Peculio'].valor += parseFloat(lanc.valor);
      totais['Peculio'].categoria_id = lanc.categoria_id;
      totais['Peculio'].data_pagamento = lanc.data_pagamento;
    }
    else {
      lancamentosAgrupados.push(lanc);
    }
  });
  
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
        observacoes: `Total agrupado de ${totais[chave].nome_exibir}`
      });
    }
  });
  
  const organizarHierarquiaAgrupada = (tipo) => {
    const catsPrincipais = categorias.filter(c => 
      c.tipo === tipo && 
      (c.nivel === 1 || !c.categoria_pai_id)
    );

    return catsPrincipais.map(principal => {
      const subcats = categorias.filter(c => c.categoria_pai_id === principal.id);
      
      const lancsDiretos = lancamentosAgrupados.filter(l => 
        l.categoria_id === principal.id &&
        l.categorias_financeiras?.tipo === tipo &&
        l.status === 'pago'
      );
      
      const subcatsComLancs = subcats.map(sub => {
        const lancsSubcat = lancamentosAgrupados.filter(l => 
          l.categoria_id === sub.id &&
          l.categorias_financeiras?.tipo === tipo &&
          l.status === 'pago'
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

  // RECEITAS HIERÁRQUICAS
  const receitasHierarquia = organizarHierarquiaAgrupada('receita');
  const totalReceitas = receitasHierarquia.reduce((sum, cp) => sum + cp.subtotalTotal, 0);

  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFillColor(33, 150, 243);
  doc.rect(10, yPos, 190, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Receita', 105, yPos + 5.5, { align: 'center' });
  
  yPos += 12;
  doc.setTextColor(0, 0, 0);

  receitasHierarquia.forEach(catPrincipal => {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFillColor(173, 216, 230);
    doc.rect(10, yPos, 190, 6, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(catPrincipal.principal.nome, 12, yPos + 4);
    yPos += 8;

    const subcatMensalidade = catPrincipal.subcategorias.find(s => s.categoria.nome === 'Mensalidade');
    
    if (subcatMensalidade && subcatMensalidade.lancamentos.length > 0) {
      const dataLanc = formatarDataBR(subcatMensalidade.lancamentos[subcatMensalidade.lancamentos.length - 1].data_lancamento);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('DataPgto', 10, yPos);
      doc.text('Interessado', 32, yPos);
      doc.text('Descrição', 70, yPos);
      doc.text('Obs', 110, yPos);
      doc.text('Receita', 190, yPos, { align: 'right' });
      yPos += 4;

      doc.setFont('helvetica', 'normal');
      doc.text(dataLanc, 10, yPos);
      doc.text('Irmãos - Acacia', 32, yPos);
      doc.text('Mensalidade e Peculio - Irmao', 80, yPos);
      doc.text('', 110, yPos);
      doc.text(`R$${subcatMensalidade.subtotal.toFixed(2)}`, 190, yPos, { align: 'right' });
      yPos += 4;
      
      catPrincipal.subcategorias = catPrincipal.subcategorias.filter(s => s.categoria.nome !== 'Mensalidade');
    } else if (catPrincipal.lancamentosDiretos.length > 0 || catPrincipal.subcategorias.length > 0) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('DataPgto', 10, yPos);
      doc.text('Interessado', 32, yPos);
      doc.text('Descrição', 70, yPos);
      doc.text('Obs', 110, yPos);
      doc.text('Receita', 190, yPos, { align: 'right' });
      yPos += 4;
    }

    doc.setFont('helvetica', 'normal');
    catPrincipal.lancamentosDiretos.forEach(lanc => {
      if (yPos > 275) {
        doc.addPage();
        yPos = 20;
      }

      const dataLanc = formatarDataBR(lanc.data_pagamento);
      const interessado = 'Irmãos - Acacia';
      let descricao = lanc.descricao?.substring(0, 20) || '';
      if (descricao === 'Mensalidade e Peculio - Irmao') {
        descricao = 'Mensalidade';
      }
      const obs = (lanc.observacoes || '').substring(0, 30);
      const valor = parseFloat(lanc.valor);

      doc.text(dataLanc, 10, yPos);
      doc.text(interessado.substring(0, 22), 32, yPos);
      doc.text(descricao, 70, yPos);
      doc.text(obs, 110, yPos);
      doc.text(`R$${valor.toFixed(2)}`, 190, yPos, { align: 'right' });
      
      yPos += 4;
    });

    catPrincipal.subcategorias.forEach(subcat => {
      subcat.lancamentos.forEach(lanc => {
        if (yPos > 275) {
          doc.addPage();
          yPos = 20;
        }

        const dataLanc = formatarDataBR(lanc.data_pagamento);
        const interessado = 'Irmãos - Acacia';
        let descricao = lanc.descricao?.substring(0, 20) || '';
        if (descricao === 'Mensalidade e Peculio - Irmao') {
          descricao = 'Mensalidade';
        }
        const obs = (lanc.observacoes || '').substring(0, 30);
        const valor = parseFloat(lanc.valor);

        doc.text(dataLanc, 10, yPos);
        doc.text(interessado.substring(0, 22), 32, yPos);
        doc.text(descricao, 70, yPos);
        doc.text(obs, 110, yPos);
        doc.text(`R$${valor.toFixed(2)}`, 190, yPos, { align: 'right' });
        
        yPos += 4;
      });
    });

    yPos += 2;
    doc.setFont('helvetica', 'bold');
    doc.text('Sub Total Receita', 150, yPos, { align: 'right' });
    doc.text(`R$ ${catPrincipal.subtotalTotal.toFixed(2)}`, 190, yPos, { align: 'right' });
    
    yPos += 8;
  });

  // TOTAL GERAL
  const saldoTotal = totalReceitas - totalDespesas;

  if (yPos > 260) {
    doc.addPage();
    yPos = 20;
  }

  yPos += 4;
  doc.setFillColor(100, 100, 100);
  doc.rect(10, yPos, 190, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Total Geral de Receita e Despesa', 105, yPos + 5.5, { align: 'center' });
  
  yPos += 12;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  
  doc.setTextColor(0, 102, 204);
  doc.text('Total Receita', 150, yPos, { align: 'right' });
  doc.text(totalReceitas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 190, yPos, { align: 'right' });
  yPos += 5;
  
  doc.setTextColor(220, 38, 38);
  doc.text('Total Despesa', 150, yPos, { align: 'right' });
  doc.text(totalDespesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 190, yPos, { align: 'right' });
  yPos += 5;
  
  doc.setTextColor(0, 0, 0);
  doc.text('Valores Compensados (Inf)', 150, yPos, { align: 'right' });
  doc.text(totalCompensacoes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 190, yPos, { align: 'right' });
  yPos += 6;

  const corSaldo = saldoTotal >= 0 ? [0, 102, 204] : [220, 38, 38];
  doc.setTextColor(corSaldo[0], corSaldo[1], corSaldo[2]);
  doc.text('Saldo Total', 150, yPos, { align: 'right' });
  doc.text(saldoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 190, yPos, { align: 'right' });
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);

  const dataGeracao = new Date().toLocaleDateString('pt-BR', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  doc.setTextColor(128, 128, 128);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(dataGeracao, 10, 285);
  doc.text(`Página ${doc.internal.getNumberOfPages()} de ${doc.internal.getNumberOfPages()}`, 200, 285, { align: 'right' });

  doc.save(`Rel_Fechamento_-_${filtros.mes}_${filtros.ano}.pdf`);
};
