import html2canvas from 'html2canvas';

/**
 * 📄 GERADOR DE PDF - RELATÓRIO FINANCEIRO MENSAL
 * Gera PDF completo com gráfico, categorias e resumos
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

    let yPos = 10;

    // ========================================
    // LOGO E CABEÇALHO
    // ========================================
    if (dadosLoja?.logo_url) {
      try {
        doc.addImage(dadosLoja.logo_url, 'PNG', 90, yPos, 30, 30);
        yPos += 37;
      } catch (e) {
        console.log('Logo não disponível');
      }
    }

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    const nomeLoja = `${dadosLoja?.nome_loja || 'Loja Maçônica'} nº ${dadosLoja?.numero_loja || ''}`;
    doc.text(nomeLoja, 105, yPos, { align: 'center' });
    yPos += 8;

    doc.setFontSize(14);
    doc.text('Relatório Financeiro Mensal', 105, yPos, { align: 'center' });
    yPos += 10;

    // Período
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const periodoTexto = filtroAnalise.mes > 0 
      ? `${meses[filtroAnalise.mes - 1]} / ${filtroAnalise.ano}`
      : `Ano Completo: ${filtroAnalise.ano}`;
    doc.text(`Período: ${periodoTexto}`, 105, yPos, { align: 'center' });
    yPos += 12;

    // ========================================
    // CARDS DE RESUMO
    // ========================================
    const totalReceitas = dadosGrafico.reduce((sum, item) => sum + item.receitas, 0);
    const totalDespesas = dadosGrafico.reduce((sum, item) => sum + item.despesas, 0);
    const totalLucro = totalReceitas - totalDespesas;

    doc.setFillColor(240, 240, 240);
    doc.rect(10, yPos, 190, 25, 'F');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(34, 197, 94); // Verde
    doc.text('Total Receitas', 35, yPos + 6, { align: 'center' });
    doc.setFontSize(14);
    doc.text(`R$ ${totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 35, yPos + 14, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(239, 68, 68); // Vermelho
    doc.text('Total Despesas', 105, yPos + 6, { align: 'center' });
    doc.setFontSize(14);
    doc.text(`R$ ${totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 105, yPos + 14, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(59, 130, 246); // Azul
    doc.text('Lucro do Período', 175, yPos + 6, { align: 'center' });
    doc.setFontSize(14);
    doc.setTextColor(totalLucro >= 0 ? 34 : 239, totalLucro >= 0 ? 197 : 68, totalLucro >= 0 ? 94 : 68);
    doc.text(`R$ ${totalLucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 175, yPos + 14, { align: 'center' });

    yPos += 30;
    doc.setTextColor(0, 0, 0);

    // ========================================
    // GRÁFICO DE BARRAS
    // ========================================
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('📊 Gráfico Financeiro Mensal', 10, yPos);
    yPos += 8;

    // Capturar o gráfico como imagem
    const graficoElement = document.querySelector('#grafico-financeiro-container');
    if (graficoElement) {
      try {
        const canvas = await html2canvas(graficoElement, {
          scale: 2,
          backgroundColor: '#ffffff',
          logging: false
        });
        const imgData = canvas.toDataURL('image/png');
        
        // Adicionar imagem do gráfico
        const imgWidth = 190;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        // Se o gráfico não couber na página, adicionar nova página
        if (yPos + imgHeight > 280) {
          doc.addPage();
          yPos = 20;
        }
        
        doc.addImage(imgData, 'PNG', 10, yPos, imgWidth, imgHeight);
        yPos += imgHeight + 10;
      } catch (error) {
        console.error('Erro ao capturar gráfico:', error);
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text('(Gráfico não disponível)', 105, yPos, { align: 'center' });
        yPos += 10;
      }
    }

    // ========================================
    // TOP 5 RECEITAS POR CATEGORIA
    // ========================================
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('💰 Top 5 Categorias de Receita', 10, yPos);
    yPos += 8;

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

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    topReceitas.forEach(([categoria, valor], index) => {
      const percentual = totalReceitas > 0 ? (valor / totalReceitas) * 100 : 0;
      
      // Barra de progresso
      doc.setFillColor(220, 252, 231);
      doc.rect(10, yPos, 190, 8, 'F');
      
      doc.setFillColor(34, 197, 94);
      doc.rect(10, yPos, (percentual / 100) * 190, 8, 'F');
      
      // Texto
      doc.setTextColor(0, 0, 0);
      doc.text(`${index + 1}. ${categoria}`, 12, yPos + 5);
      doc.text(`R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${percentual.toFixed(1)}%)`, 195, yPos + 5, { align: 'right' });
      
      yPos += 10;
    });

    yPos += 5;

    // ========================================
    // TOP 5 DESPESAS POR CATEGORIA
    // ========================================
    if (yPos > 220) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('💸 Top 5 Categorias de Despesa', 10, yPos);
    yPos += 8;

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

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    topDespesas.forEach(([categoria, valor], index) => {
      const percentual = totalDespesas > 0 ? (valor / totalDespesas) * 100 : 0;
      
      // Barra de progresso
      doc.setFillColor(254, 226, 226);
      doc.rect(10, yPos, 190, 8, 'F');
      
      doc.setFillColor(239, 68, 68);
      doc.rect(10, yPos, (percentual / 100) * 190, 8, 'F');
      
      // Texto
      doc.setTextColor(0, 0, 0);
      doc.text(`${index + 1}. ${categoria}`, 12, yPos + 5);
      doc.text(`R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${percentual.toFixed(1)}%)`, 195, yPos + 5, { align: 'right' });
      
      yPos += 10;
    });

    // ========================================
    // RODAPÉ
    // ========================================
    const dataGeracao = new Date().toLocaleDateString('pt-BR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    doc.setTextColor(128, 128, 128);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Gerado em: ${dataGeracao}`, 10, 285);
    doc.text(`Página ${doc.internal.getNumberOfPages()}`, 200, 285, { align: 'right' });

    // Salvar PDF
    const nomeArquivo = filtroAnalise.mes > 0
      ? `Relatorio_Financeiro_${meses[filtroAnalise.mes - 1]}_${filtroAnalise.ano}.pdf`
      : `Relatorio_Financeiro_${filtroAnalise.ano}.pdf`;
    
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
