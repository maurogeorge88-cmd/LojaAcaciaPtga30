/**
 * 📄 GERADOR DE PDF - RELATÓRIO FINANCEIRO SIMPLES
 * Gera PDF organizado com situação financeira mensal e anual
 */

export const gerarRelatorioFinanceiroPDF = async ({
  dadosGrafico,
  lancamentosCompletos,
  filtroAnalise,
  parseData,
  supabase
}) => {
  try {
    // Obter jsPDF
    const getJsPDF = async () => {
      if (window.jspdf && window.jspdf.jsPDF) {
        return window.jspdf.jsPDF;
      }
      const module = await import('jspdf');
      return module.default;
    };

    const jsPDF = await getJsPDF();
    const doc = new jsPDF();

    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                   'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    // Buscar dados da loja
    let dadosLoja = null;
    try {
      const { data } = await supabase.from('dados_loja').select('*').single();
      dadosLoja = data;
    } catch (e) {
      console.log('Dados da loja não encontrados');
    }

    let yPos = 15;

    // ========================================
    // CABEÇALHO
    // ========================================
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    const nomeLoja = dadosLoja?.nome_loja || 'Loja Maçônica';
    const numeroLoja = dadosLoja?.numero_loja ? ` nº ${dadosLoja.numero_loja}` : '';
    doc.text(`${nomeLoja}${numeroLoja}`, 105, yPos, { align: 'center' });
    yPos += 8;

    doc.setFontSize(14);
    doc.text('Relatório Financeiro', 105, yPos, { align: 'center' });
    yPos += 10;

    // Período
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const periodoTexto = filtroAnalise.mes > 0 
      ? `Período: ${meses[filtroAnalise.mes - 1]} de ${filtroAnalise.ano}`
      : `Período: Ano ${filtroAnalise.ano} (Janeiro a Dezembro)`;
    doc.text(periodoTexto, 105, yPos, { align: 'center' });
    yPos += 12;

    // Linha separadora
    doc.setDrawColor(200, 200, 200);
    doc.line(10, yPos, 200, yPos);
    yPos += 10;

    // ========================================
    // RESUMO GERAL
    // ========================================
    const totalReceitas = dadosGrafico.reduce((sum, item) => sum + item.receitas, 0);
    const totalDespesas = dadosGrafico.reduce((sum, item) => sum + item.despesas, 0);
    const saldoFinal = totalReceitas - totalDespesas;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMO GERAL', 10, yPos);
    yPos += 8;

    // Box do resumo
    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(250, 250, 250);
    doc.rect(10, yPos, 190, 30, 'FD');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    // Receitas
    doc.setTextColor(34, 139, 34); // Verde
    doc.text('Total de Receitas:', 15, yPos + 7);
    doc.setFont('helvetica', 'bold');
    doc.text(`R$ ${totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 65, yPos + 7);
    
    // Despesas
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(220, 38, 38); // Vermelho
    doc.text('Total de Despesas:', 15, yPos + 15);
    doc.setFont('helvetica', 'bold');
    doc.text(`R$ ${totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 65, yPos + 15);
    
    // Saldo
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 102, 204); // Azul
    doc.text('Saldo do Período:', 15, yPos + 23);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(saldoFinal >= 0 ? 34 : 220, saldoFinal >= 0 ? 139 : 38, saldoFinal >= 0 ? 34 : 38);
    doc.text(`R$ ${saldoFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 65, yPos + 23);

    yPos += 35;
    doc.setTextColor(0, 0, 0);

    // ========================================
    // DETALHAMENTO MENSAL (se for ano inteiro)
    // ========================================
    if (filtroAnalise.mes === 0 && dadosGrafico.length > 1) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('MOVIMENTAÇÃO MENSAL', 10, yPos);
      yPos += 8;

      // Cabeçalho da tabela
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(230, 230, 230);
      doc.rect(10, yPos, 190, 8, 'F');
      
      doc.text('Mês', 15, yPos + 5);
      doc.text('Receitas', 70, yPos + 5, { align: 'right' });
      doc.text('Despesas', 115, yPos + 5, { align: 'right' });
      doc.text('Saldo', 155, yPos + 5, { align: 'right' });
      doc.text('Gráfico', 175, yPos + 5);
      
      yPos += 10;
      doc.setFont('helvetica', 'normal');

      // Encontrar valor máximo para as barras
      const maxValor = Math.max(...dadosGrafico.map(d => Math.max(d.receitas, d.despesas)));

      // Linhas da tabela
      dadosGrafico.forEach((dado, index) => {
        // Verificar se precisa de nova página
        if (yPos > 260) {
          doc.addPage();
          yPos = 20;
          
          // Repetir cabeçalho
          doc.setFont('helvetica', 'bold');
          doc.setFillColor(230, 230, 230);
          doc.rect(10, yPos, 190, 8, 'F');
          doc.text('Mês', 15, yPos + 5);
          doc.text('Receitas', 70, yPos + 5, { align: 'right' });
          doc.text('Despesas', 115, yPos + 5, { align: 'right' });
          doc.text('Saldo', 155, yPos + 5, { align: 'right' });
          doc.text('Gráfico', 175, yPos + 5);
          yPos += 10;
          doc.setFont('helvetica', 'normal');
        }

        // Fundo alternado
        if (index % 2 === 0) {
          doc.setFillColor(248, 248, 248);
          doc.rect(10, yPos - 2, 190, 10, 'F');
        }

        // Mês
        doc.setTextColor(0, 0, 0);
        doc.text(dado.mes, 15, yPos + 4);
        
        // Receitas
        doc.setTextColor(34, 139, 34);
        doc.text(`R$ ${dado.receitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 70, yPos + 4, { align: 'right' });
        
        // Despesas
        doc.setTextColor(220, 38, 38);
        doc.text(`R$ ${dado.despesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 115, yPos + 4, { align: 'right' });
        
        // Saldo
        const saldo = dado.receitas - dado.despesas;
        doc.setTextColor(saldo >= 0 ? 34 : 220, saldo >= 0 ? 139 : 38, saldo >= 0 ? 34 : 38);
        doc.text(`R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 155, yPos + 4, { align: 'right' });
        
        // Mini barras verticais (gráfico simplificado)
        const alturaMaxBarra = 6;
        const larguraBarra = 3;
        const espaco = 0.5;
        
        // Barra Receitas (verde)
        const alturaReceitas = maxValor > 0 ? (dado.receitas / maxValor) * alturaMaxBarra : 0;
        doc.setFillColor(34, 139, 34);
        doc.rect(165, yPos + 6 - alturaReceitas, larguraBarra, alturaReceitas, 'F');
        
        // Barra Despesas (vermelho)
        const alturaDespesas = maxValor > 0 ? (dado.despesas / maxValor) * alturaMaxBarra : 0;
        doc.setFillColor(220, 38, 38);
        doc.rect(165 + larguraBarra + espaco, yPos + 6 - alturaDespesas, larguraBarra, alturaDespesas, 'F');
        
        yPos += 10;
      });

      doc.setTextColor(0, 0, 0);
      yPos += 5;

      // Legenda das barras
      doc.setFontSize(7);
      doc.setFillColor(34, 139, 34);
      doc.rect(160, yPos, 3, 3, 'F');
      doc.text('Receita', 165, yPos + 2);
      
      doc.setFillColor(220, 38, 38);
      doc.rect(182, yPos, 3, 3, 'F');
      doc.text('Despesa', 187, yPos + 2);
      
      yPos += 8;
    }

    // ========================================
    // TOP 5 CATEGORIAS (se tiver espaço, senão nova página)
    // ========================================
    if (yPos > 220) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('PRINCIPAIS CATEGORIAS', 10, yPos);
    yPos += 10;

    // RECEITAS
    const receitasPorCategoria = lancamentosCompletos
      .filter(l => {
        if (l.categorias_financeiras?.tipo !== 'receita' || l.status !== 'pago') return false;
        const isTronco = l.categorias_financeiras?.nome?.toLowerCase().includes('tronco');
        if (isTronco && l.tipo_pagamento === 'dinheiro') return false;
        if (l.tipo_pagamento === 'compensacao') return false;
        const dataRef = l.data_pagamento || l.data_vencimento;
        if (!dataRef) return false;
        const data = parseData(dataRef);
        if (data.getFullYear() !== filtroAnalise.ano) return false;
        if (filtroAnalise.mes > 0 && data.getMonth() + 1 !== filtroAnalise.mes) return false;
        return true;
      })
      .reduce((acc, l) => {
        const cat = l.categorias_financeiras?.nome || 'Sem categoria';
        acc[cat] = (acc[cat] || 0) + parseFloat(l.valor);
        return acc;
      }, {});

    const topReceitas = Object.entries(receitasPorCategoria)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(34, 139, 34);
    doc.text('Receitas:', 10, yPos);
    yPos += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    topReceitas.forEach(([categoria, valor], index) => {
      const percentual = totalReceitas > 0 ? (valor / totalReceitas) * 100 : 0;
      
      // Nome e valor
      doc.text(`${index + 1}. ${categoria}`, 12, yPos);
      doc.text(`R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${percentual.toFixed(1)}%)`, 200, yPos, { align: 'right' });
      
      yPos += 5;
    });

    yPos += 5;

    // DESPESAS
    const despesasPorCategoria = lancamentosCompletos
      .filter(l => {
        if (l.categorias_financeiras?.tipo !== 'despesa' || l.status !== 'pago') return false;
        const isTronco = l.categorias_financeiras?.nome?.toLowerCase().includes('tronco');
        if (isTronco && l.tipo_pagamento === 'dinheiro') return false;
        const isDespesaPagaPeloIrmao = l.categorias_financeiras?.nome?.toLowerCase().includes('despesas pagas pelo irmão') ||
                                      l.categorias_financeiras?.nome?.toLowerCase().includes('despesa paga pelo irmão');
        if (isDespesaPagaPeloIrmao) return false;
        const dataRef = l.data_pagamento || l.data_vencimento;
        if (!dataRef) return false;
        const data = parseData(dataRef);
        if (data.getFullYear() !== filtroAnalise.ano) return false;
        if (filtroAnalise.mes > 0 && data.getMonth() + 1 !== filtroAnalise.mes) return false;
        return true;
      })
      .reduce((acc, l) => {
        const cat = l.categorias_financeiras?.nome || 'Sem categoria';
        acc[cat] = (acc[cat] || 0) + parseFloat(l.valor);
        return acc;
      }, {});

    const topDespesas = Object.entries(despesasPorCategoria)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text('Despesas:', 10, yPos);
    yPos += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    topDespesas.forEach(([categoria, valor], index) => {
      const percentual = totalDespesas > 0 ? (valor / totalDespesas) * 100 : 0;
      
      // Nome e valor
      doc.text(`${index + 1}. ${categoria}`, 12, yPos);
      doc.text(`R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${percentual.toFixed(1)}%)`, 200, yPos, { align: 'right' });
      
      yPos += 5;
    });

    // ========================================
    // RODAPÉ
    // ========================================
    const dataGeracao = new Date().toLocaleDateString('pt-BR', { 
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    doc.setTextColor(128, 128, 128);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text(`Gerado em: ${dataGeracao}`, 10, 285);
    doc.text(`Página ${doc.internal.getNumberOfPages()}`, 200, 285, { align: 'right' });

    // Salvar PDF
    const nomeArquivo = filtroAnalise.mes > 0
      ? `Relatorio_${meses[filtroAnalise.mes - 1]}_${filtroAnalise.ano}.pdf`
      : `Relatorio_Anual_${filtroAnalise.ano}.pdf`;
    
    doc.save(nomeArquivo);

    return { success: true, nomeArquivo };
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    return { success: false, error: error.message };
  }
};

// Função auxiliar para preparar o WhatsApp
export const compartilharViaWhatsApp = (mensagem) => {
  const mensagemFormatada = encodeURIComponent(mensagem);
  const url = `https://wa.me/?text=${mensagemFormatada}`;
  window.open(url, '_blank');
};
