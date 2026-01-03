import React, { useState, useEffect } from 'react';
import { supabase } from '../../App';

const AnaliseCategoriasModal = ({ isOpen, onClose, showError }) => {
  const [lancamentosCompletos, setLancamentosCompletos] = useState([]);
  const [anosDisponiveis, setAnosDisponiveis] = useState([]);
  const [filtroAnalise, setFiltroAnalise] = useState({
    mes: 0,
    ano: new Date().getFullYear()
  });
  const [tipoGrafico, setTipoGrafico] = useState('barras');
  const [dadosGrafico, setDadosGrafico] = useState([]);
  const [gerandoPDF, setGerandoPDF] = useState(false);

  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const formatarMoeda = (valor) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  // Corrigir problema de timezone ao parsear datas
  const parseData = (dataStr) => {
    if (!dataStr) return null;
    // Adicionar T00:00:00 força interpretação como hora local, não UTC
    return new Date(dataStr + 'T00:00:00');
  };

  const carregarLancamentosCompletos = async () => {
    try {
      const { data, error } = await supabase
        .from('lancamentos_loja')
        .select('*, categorias_financeiras(id, nome, tipo)')
        .order('data_vencimento', { ascending: false });

      if (error) throw error;
      
      // Debug: ver lançamentos 01/01/2026
      const lanc0101 = data?.filter(l => 
        (l.data_pagamento?.includes('2026-01-01') || l.data_vencimento?.includes('2026-01-01'))
      );
      console.log('Lançamentos 01/01/2026:');
      lanc0101?.forEach(l => {
        const dataRef = l.data_pagamento || l.data_vencimento;
        const dataObj = parseData(dataRef);
        console.log({
          id: l.id,
          descricao: l.descricao,
          data_pagamento: l.data_pagamento,
          data_vencimento: l.data_vencimento,
          dataRef,
          dataObj,
          ano_extraido: dataObj.getFullYear(),
          mes_extraido: dataObj.getMonth() + 1,
          status: l.status,
          tipo_pagamento: l.tipo_pagamento,
          categoria: l.categorias_financeiras?.nome,
          valor: l.valor
        });
      });
      
      setLancamentosCompletos(data || []);
      
      // Extrair anos únicos
      const anosUnicos = [...new Set(
        (data || [])
          .map(l => {
            const dataStr = l.data_pagamento || l.data_vencimento;
            if (!dataStr) return null;
            const ano = new Date(dataStr + 'T00:00:00').getFullYear();
            return ano >= 2000 && ano <= 2100 ? ano : null;
          })
          .filter(ano => ano !== null)
      )];
      const anosOrdenados = anosUnicos.sort((a, b) => b - a);
      setAnosDisponiveis(anosOrdenados);
      
      if (anosOrdenados.length > 0) {
        setFiltroAnalise(prev => ({ ...prev, ano: anosOrdenados[0] }));
      }
    } catch (error) {
      console.error('Erro ao carregar lançamentos:', error);
      if (showError) showError('Erro ao carregar dados');
    }
  };

  useEffect(() => {
    if (isOpen) {
      setLancamentosCompletos([]);
      setAnosDisponiveis([]);
      carregarLancamentosCompletos();
    }
  }, [isOpen]);

  // Processar dados do gráfico quando lançamentos ou filtros mudarem
  useEffect(() => {
    if (lancamentosCompletos.length > 0) {
      processarDadosGrafico();
    }
  }, [lancamentosCompletos, filtroAnalise]);

  const processarDadosGrafico = () => {
    const mesesAbrev = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    // Se filtro é mês específico, mostrar apenas esse mês
    if (filtroAnalise.mes > 0) {
      const lancamentosMes = lancamentosCompletos.filter(l => {
        if (l.status !== 'pago') return false;
        if (l.tipo_pagamento === 'compensacao') return false;
        
        // Excluir Tronco em dinheiro
        const isTronco = l.categorias_financeiras?.nome?.toLowerCase().includes('tronco');
        if (isTronco && l.tipo_pagamento === 'dinheiro') return false;
        
        // Excluir Despesas pagas pelo irmão
        if (l.categorias_financeiras?.tipo === 'despesa') {
          const isDespesaPagaPeloIrmao = l.categorias_financeiras?.nome?.toLowerCase().includes('despesas pagas pelo irmão') ||
                                        l.categorias_financeiras?.nome?.toLowerCase().includes('despesa paga pelo irmão');
          if (isDespesaPagaPeloIrmao) return false;
        }
        
        const dataRef = l.data_pagamento || l.data_vencimento;
        if (!dataRef) return false;
        const data = parseData(dataRef);
        return data.getFullYear() === filtroAnalise.ano && data.getMonth() + 1 === filtroAnalise.mes;
      });

      const receitas = lancamentosMes
        .filter(l => l.categorias_financeiras?.tipo === 'receita')
        .reduce((sum, l) => sum + parseFloat(l.valor), 0);
      
      const despesas = lancamentosMes
        .filter(l => l.categorias_financeiras?.tipo === 'despesa')
        .reduce((sum, l) => sum + parseFloat(l.valor), 0);

      setDadosGrafico([{
        mes: meses[filtroAnalise.mes - 1],
        receitas,
        despesas,
        lucro: receitas - despesas
      }]);
    } else {
      // Ano inteiro - agrupar por mês
      const dadosPorMes = {};
      mesesAbrev.forEach((mes, i) => {
        dadosPorMes[i + 1] = { mes, receitas: 0, despesas: 0 };
      });

      lancamentosCompletos.forEach(l => {
        if (l.status !== 'pago') return;
        if (l.tipo_pagamento === 'compensacao') return;
        
        // Excluir Tronco em dinheiro
        const isTronco = l.categorias_financeiras?.nome?.toLowerCase().includes('tronco');
        if (isTronco && l.tipo_pagamento === 'dinheiro') return;
        
        // Excluir Despesas pagas pelo irmão
        if (l.categorias_financeiras?.tipo === 'despesa') {
          const isDespesaPagaPeloIrmao = l.categorias_financeiras?.nome?.toLowerCase().includes('despesas pagas pelo irmão') ||
                                        l.categorias_financeiras?.nome?.toLowerCase().includes('despesa paga pelo irmão');
          if (isDespesaPagaPeloIrmao) return;
        }
        
        const dataRef = l.data_pagamento || l.data_vencimento;
        if (!dataRef) return;
        const data = parseData(dataRef);
        
        if (data.getFullYear() !== filtroAnalise.ano) return;
        
        const mes = data.getMonth() + 1;
        const valor = parseFloat(l.valor);
        
        if (l.categorias_financeiras?.tipo === 'receita') {
          dadosPorMes[mes].receitas += valor;
        } else if (l.categorias_financeiras?.tipo === 'despesa') {
          dadosPorMes[mes].despesas += valor;
        }
      });

      const dados = Object.values(dadosPorMes).map(d => ({
        ...d,
        lucro: d.receitas - d.despesas
      }));

      setDadosGrafico(dados);
    }
  };

  // Função para gerar PDF (versão inline simplificada)
  const gerarPDF = async () => {
    setGerandoPDF(true);
    try {
      // Buscar dados da loja
      let dadosLoja = null;
      try {
        const { data, error } = await supabase.from('dados_loja').select('*').single();
        if (!error && data) {
          dadosLoja = data;
        }
      } catch (e) {
        console.log('Dados da loja não encontrados:', e);
      }

      // Obter jsPDF
      const getJsPDF = async () => {
        if (window.jspdf && window.jspdf.jsPDF) {
          return window.jspdf.jsPDF;
        }
        const module = await import('jspdf');
        return module.default || module.jsPDF;
      };

      const jsPDF = await getJsPDF();
      const doc = new jsPDF();

      let yPos = 10; // Começando mais alto (era 15)

      // ========================================
      // LOGO (se existir)
      // ========================================
      if (dadosLoja?.logo_url) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          
          await new Promise((resolve, reject) => {
            img.onload = () => {
              try {
                doc.addImage(img, 'PNG', 85, yPos, 40, 40);
                resolve();
              } catch (e) {
                console.log('Erro ao adicionar logo:', e);
                resolve();
              }
            };
            img.onerror = () => {
              console.log('Erro ao carregar logo');
              resolve();
            };
            img.src = dadosLoja.logo_url;
            
            // Timeout de 3 segundos
            setTimeout(() => resolve(), 3000);
          });
          
          yPos += 50; // Aumentado espaço após logo para evitar sobreposição
        } catch (e) {
          console.log('Logo não disponível:', e);
        }
      }

      // ========================================
      // CABEÇALHO - NOME DA LOJA E CIDADE
      // ========================================
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      
      // Nome da Loja
      if (dadosLoja?.nome_loja) {
        const nomeLoja = dadosLoja.numero_loja 
          ? `${dadosLoja.nome_loja} nº ${dadosLoja.numero_loja}`
          : dadosLoja.nome_loja;
        doc.text(nomeLoja, 105, yPos, { align: 'center' });
        yPos += 7;
      }

      // Apenas Cidade (sem oriente/vale)
      if (dadosLoja?.cidade) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        const cidadeTexto = dadosLoja.estado 
          ? `${dadosLoja.cidade}/${dadosLoja.estado}`
          : dadosLoja.cidade;
        doc.text(cidadeTexto, 105, yPos, { align: 'center' });
        yPos += 5;
        doc.setTextColor(0, 0, 0);
      }

      yPos += 5;

      // Título do Relatório
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Relatório Financeiro', 105, yPos, { align: 'center' });
      yPos += 10;

      // Período
      const periodoTexto = filtroAnalise.mes > 0 
        ? `${meses[filtroAnalise.mes - 1]} de ${filtroAnalise.ano}`
        : `Ano ${filtroAnalise.ano}`;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Período: ${periodoTexto}`, 105, yPos, { align: 'center' });
      yPos += 3;

      // Linha separadora
      doc.setDrawColor(200, 200, 200);
      doc.line(10, yPos, 200, yPos);
      yPos += 10;

      // ========================================
      // RESUMO
      // ========================================
      const totalReceitas = dadosGrafico.reduce((sum, item) => sum + item.receitas, 0);
      const totalDespesas = dadosGrafico.reduce((sum, item) => sum + item.despesas, 0);
      const saldoFinal = totalReceitas - totalDespesas;

      doc.setFillColor(250, 250, 250);
      doc.rect(10, yPos, 190, 30, 'FD');

      doc.setFontSize(10);
      doc.setTextColor(34, 139, 34);
      doc.text('Receitas:', 15, yPos + 7);
      doc.setFont('helvetica', 'bold');
      doc.text(`R$ ${totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 65, yPos + 7);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(220, 38, 38);
      doc.text('Despesas:', 15, yPos + 15);
      doc.setFont('helvetica', 'bold');
      doc.text(`R$ ${totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 65, yPos + 15);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 102, 204);
      doc.text('Saldo:', 15, yPos + 23);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(saldoFinal >= 0 ? 34 : 220, saldoFinal >= 0 ? 139 : 38, saldoFinal >= 0 ? 34 : 38);
      doc.text(`R$ ${saldoFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 65, yPos + 23);

      yPos += 40;
      doc.setTextColor(0, 0, 0);

      // ========================================
      // CATEGORIAS (quando é mês específico)
      // ========================================
      if (filtroAnalise.mes > 0) {
        // Processar categorias de receitas
        const receitasPorCategoria = lancamentosCompletos
          .filter(l => {
            if (l.categorias_financeiras?.tipo !== 'receita' || l.status !== 'pago') return false;
            const isTronco = l.categorias_financeiras?.nome?.toLowerCase().includes('tronco');
            if (isTronco && l.tipo_pagamento === 'dinheiro') return false;
            if (l.tipo_pagamento === 'compensacao') return false;
            const dataRef = l.data_pagamento || l.data_vencimento;
            if (!dataRef) return false;
            const data = new Date(dataRef + 'T00:00:00');
            if (data.getFullYear() !== filtroAnalise.ano) return false;
            if (data.getMonth() + 1 !== filtroAnalise.mes) return false;
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

        // Processar categorias de despesas
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
            const data = new Date(dataRef + 'T00:00:00');
            if (data.getFullYear() !== filtroAnalise.ano) return false;
            if (data.getMonth() + 1 !== filtroAnalise.mes) return false;
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

        // Título
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('PRINCIPAIS CATEGORIAS', 10, yPos);
        yPos += 8;

        // Dois quadros lado a lado
        const larguraQuadro = 90;
        const alturaLinha = 6;

        // ===== QUADRO RECEITAS (esquerda) =====
        let xReceitas = 10;
        let yReceitas = yPos;

        // Cabeçalho Receitas
        doc.setFillColor(220, 252, 231); // Verde claro
        doc.rect(xReceitas, yReceitas, larguraQuadro, 8, 'F');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(34, 139, 34);
        doc.text('RECEITAS', xReceitas + 3, yReceitas + 5);
        yReceitas += 10;

        // Linhas de receitas
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        
        topReceitas.forEach(([categoria, valor], index) => {
          if (index % 2 === 0) {
            doc.setFillColor(248, 248, 248);
            doc.rect(xReceitas, yReceitas - 1, larguraQuadro, alturaLinha, 'F');
          }
          
          // Limitar tamanho do nome da categoria
          const nomeCategoria = categoria.length > 20 ? categoria.substring(0, 20) + '...' : categoria;
          doc.text(nomeCategoria, xReceitas + 2, yReceitas + 3);
          doc.text(`R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, xReceitas + larguraQuadro - 2, yReceitas + 3, { align: 'right' });
          
          yReceitas += alturaLinha;
        });

        // ===== QUADRO DESPESAS (direita) =====
        let xDespesas = 110;
        let yDespesas = yPos;

        // Cabeçalho Despesas
        doc.setFillColor(254, 226, 226); // Vermelho claro
        doc.rect(xDespesas, yDespesas, larguraQuadro, 8, 'F');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(220, 38, 38);
        doc.text('DESPESAS', xDespesas + 3, yDespesas + 5);
        yDespesas += 10;

        // Linhas de despesas
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        
        topDespesas.forEach(([categoria, valor], index) => {
          if (index % 2 === 0) {
            doc.setFillColor(248, 248, 248);
            doc.rect(xDespesas, yDespesas - 1, larguraQuadro, alturaLinha, 'F');
          }
          
          // Limitar tamanho do nome da categoria
          const nomeCategoria = categoria.length > 20 ? categoria.substring(0, 20) + '...' : categoria;
          doc.text(nomeCategoria, xDespesas + 2, yDespesas + 3);
          doc.text(`R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, xDespesas + larguraQuadro - 2, yDespesas + 3, { align: 'right' });
          
          yDespesas += alturaLinha;
        });

        // Atualizar yPos para o maior dos dois
        yPos = Math.max(yReceitas, yDespesas) + 5;
      }

      // ========================================
      // TABELA MENSAL (se ano inteiro)
      // ========================================
      if (filtroAnalise.mes === 0 && dadosGrafico.length > 1) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('MOVIMENTAÇÃO MENSAL', 10, yPos);
        yPos += 8;

        // Cabeçalho da tabela (SEM coluna Gráfico)
        doc.setFontSize(9);
        doc.setFillColor(230, 230, 230);
        doc.rect(10, yPos, 190, 8, 'F');
        doc.text('Mês', 15, yPos + 5);
        doc.text('Receitas', 80, yPos + 5, { align: 'right' });
        doc.text('Despesas', 135, yPos + 5, { align: 'right' });
        doc.text('Saldo', 190, yPos + 5, { align: 'right' });
        yPos += 10;

        doc.setFont('helvetica', 'normal');

        dadosGrafico.forEach((dado, index) => {
          if (yPos > 260) {
            doc.addPage();
            yPos = 20;
          }

          // Fundo alternado
          if (index % 2 === 0) {
            doc.setFillColor(248, 248, 248);
            doc.rect(10, yPos - 2, 190, 7, 'F'); // Altura reduzida de 10 para 7
          }

          doc.setTextColor(0, 0, 0);
          doc.text(dado.mes, 15, yPos + 3);
          doc.setTextColor(34, 139, 34);
          doc.text(`R$ ${dado.receitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 80, yPos + 3, { align: 'right' });
          doc.setTextColor(220, 38, 38);
          doc.text(`R$ ${dado.despesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 135, yPos + 3, { align: 'right' });
          
          const saldo = dado.receitas - dado.despesas;
          doc.setTextColor(saldo >= 0 ? 34 : 220, saldo >= 0 ? 139 : 38, saldo >= 0 ? 34 : 38);
          doc.text(`R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 190, yPos + 3, { align: 'right' });

          yPos += 7; // Reduzido de 10 para 7 (espaço entre linhas menor)
        });
      }

      // ========================================
      // RODAPÉ
      // ========================================
      const totalPages = doc.internal.getNumberOfPages();
      
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        
        // Linha superior do rodapé
        doc.setDrawColor(200, 200, 200);
        doc.line(10, 280, 200, 280);
        
        // Data de geração (esquerda)
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
        
        // Informações da loja (centro) - se existirem
        if (dadosLoja?.email || dadosLoja?.telefone) {
          const contatos = [];
          if (dadosLoja.telefone) contatos.push(`Tel: ${dadosLoja.telefone}`);
          if (dadosLoja.email) contatos.push(`Email: ${dadosLoja.email}`);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.text(contatos.join(' | '), 105, 285, { align: 'center' });
        }
        
        // Página (direita)
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(`Página ${i} de ${totalPages}`, 200, 285, { align: 'right' });
      }

      // Salvar
      const nomeArquivo = filtroAnalise.mes > 0
        ? `Relatorio_${meses[filtroAnalise.mes - 1]}_${filtroAnalise.ano}.pdf`
        : `Relatorio_Anual_${filtroAnalise.ano}.pdf`;
      
      doc.save(nomeArquivo);
      alert(`✅ Relatório gerado!\n\n${nomeArquivo}`);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert(`❌ Erro ao gerar PDF:\n${error.message}`);
    } finally {
      setGerandoPDF(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
      {/* CABEÇALHO */}
      <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg p-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <span className="text-4xl">📊</span>
          <div>
            <h3 className="text-2xl font-bold text-white">Análise por Categoria</h3>
            <p className="text-blue-100 text-sm">Visualização completa de receitas e despesas</p>
          </div>
        </div>
        
        {/* Botões do cabeçalho */}
        <div className="flex items-center gap-3">
          {/* Botão Gerar Relatório PDF */}
          <button
            onClick={gerarPDF}
            disabled={gerandoPDF}
            className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {gerandoPDF ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Gerando PDF...</span>
              </>
            ) : (
              <>
                <span>📄</span>
                <span>Baixar Relatório</span>
              </>
            )}
          </button>
          
          {/* Botão Voltar */}
          <button 
            onClick={onClose} 
            className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2"
          >
            <span>←</span>
            <span>Voltar ao Dashboard</span>
          </button>
        </div>
      </div>

      {/* CONTEÚDO */}
      <div className="container mx-auto p-6 pb-20 max-w-[1600px] space-y-8">
        {/* SEÇÃO 1: CATEGORIAS */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-bold text-gray-700">Detalhamento por Categoria</h4>
            
            <div className="flex gap-2 items-center">
              <label className="text-sm font-medium text-gray-600">Período:</label>
              <select
                value={filtroAnalise.mes}
                onChange={(e) => setFiltroAnalise({ ...filtroAnalise, mes: parseInt(e.target.value) })}
                className="px-4 py-2 border-2 border-gray-300 rounded-lg text-sm font-medium bg-white hover:border-blue-500 focus:border-blue-600 focus:ring-2 focus:ring-blue-200 transition-all"
              >
                <option value={0}>📅 Ano inteiro</option>
                {meses.map((mes, i) => (
                  <option key={i} value={i + 1}>{mes}</option>
                ))}
              </select>
              
              <select
                value={filtroAnalise.ano}
                onChange={(e) => setFiltroAnalise({ ...filtroAnalise, ano: parseInt(e.target.value) })}
                className="px-4 py-2 border-2 border-gray-300 rounded-lg text-sm font-medium bg-white hover:border-blue-500 focus:border-blue-600 focus:ring-2 focus:ring-blue-200 transition-all"
              >
                {anosDisponiveis.map(ano => (
                  <option key={ano} value={ano}>{ano}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Grid Receitas e Despesas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* RECEITAS POR CATEGORIA */}
            <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
              <h5 className="text-md font-bold text-green-700 mb-3">📈 Receitas por Categoria</h5>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {(() => {
                  const receitasPorCategoria = lancamentosCompletos
                    .filter(l => {
                      if (l.categorias_financeiras?.tipo !== 'receita' || l.status !== 'pago') return false;
                      
                      // Excluir APENAS Tronco em dinheiro (Tronco + dinheiro juntos)
                      const isTronco = l.categorias_financeiras?.nome?.toLowerCase().includes('tronco');
                      if (isTronco && l.tipo_pagamento === 'dinheiro') return false;
                      
                      // Excluir compensações
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

                  const total = Object.values(receitasPorCategoria).reduce((sum, v) => sum + v, 0);

                  return Object.entries(receitasPorCategoria)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, valor]) => {
                      const percentual = total > 0 ? (valor / total) * 100 : 0;
                      return (
                        <div key={cat} className="bg-white rounded-lg p-2 border border-green-200">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-green-700 min-w-[45px] text-center">
                              {percentual.toFixed(1)}%
                            </span>
                            <span className="text-sm font-semibold text-gray-700 flex-1">{cat}</span>
                            <span className="text-sm font-bold text-green-700">{formatarMoeda(valor)}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                            <div 
                              className="bg-green-600 h-1.5 rounded-full transition-all"
                              style={{ width: `${percentual}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    });
                })()}
              </div>
            </div>

            {/* DESPESAS POR CATEGORIA */}
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
              <h5 className="text-md font-bold text-red-700 mb-3">📉 Despesas por Categoria</h5>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {(() => {
                  const despesasPorCategoria = lancamentosCompletos
                    .filter(l => {
                      if (l.categorias_financeiras?.tipo !== 'despesa' || l.status !== 'pago') return false;
                      
                      // Excluir APENAS Tronco em dinheiro
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

                  const total = Object.values(despesasPorCategoria).reduce((sum, v) => sum + v, 0);

                  return Object.entries(despesasPorCategoria)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, valor]) => {
                      const percentual = total > 0 ? (valor / total) * 100 : 0;
                      return (
                        <div key={cat} className="bg-white rounded-lg p-2 border border-red-200">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-red-700 min-w-[45px] text-center">
                              {percentual.toFixed(1)}%
                            </span>
                            <span className="text-sm font-semibold text-gray-700 flex-1">{cat}</span>
                            <span className="text-sm font-bold text-red-700">{formatarMoeda(valor)}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                            <div 
                              className="bg-red-600 h-1.5 rounded-full transition-all"
                              style={{ width: `${percentual}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    });
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* SEÇÃO 2: TOTAIS */}
        <div className="border-t pt-6 space-y-4">
          <h4 className="text-lg font-bold text-gray-700">
            Totais do Período - {filtroAnalise.mes === 0 ? filtroAnalise.ano : `${meses[filtroAnalise.mes - 1]}/${filtroAnalise.ano}`}
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* TOTAL RECEITAS */}
            <div className="bg-green-50 border-2 border-green-300 rounded-lg p-3">
              <h5 className="text-sm font-bold text-green-700 mb-2">📈 Total de Receitas</h5>
              <div className="text-center py-3">
                {(() => {
                  const totalReceitas = lancamentosCompletos
                    .filter(l => {
                      if (l.categorias_financeiras?.tipo !== 'receita' || l.status !== 'pago') return false;
                      
                      // Excluir APENAS Tronco em dinheiro
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
                    .reduce((sum, l) => sum + parseFloat(l.valor), 0);

                  return (
                    <>
                      <p className="text-2xl font-bold text-green-700 mb-1">{formatarMoeda(totalReceitas)}</p>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div className="bg-gradient-to-r from-green-500 to-green-700 h-2 rounded-full" style={{ width: '100%' }}></div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* TOTAL DESPESAS */}
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-3">
              <h5 className="text-sm font-bold text-red-700 mb-2">📉 Total de Despesas</h5>
              <div className="text-center py-3">
                {(() => {
                  const totalDespesas = lancamentosCompletos
                    .filter(l => {
                      if (l.categorias_financeiras?.tipo !== 'despesa' || l.status !== 'pago') return false;
                      
                      // Excluir APENAS Tronco em dinheiro
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
                    .reduce((sum, l) => sum + parseFloat(l.valor), 0);

                  return (
                    <>
                      <p className="text-2xl font-bold text-red-700 mb-1">{formatarMoeda(totalDespesas)}</p>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div className="bg-gradient-to-r from-red-500 to-red-700 h-2 rounded-full" style={{ width: '100%' }}></div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* SALDO */}
            <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-3">
              <h5 className="text-sm font-bold text-blue-700 mb-2">💎 Saldo do Período</h5>
              <div className="text-center py-3">
                {(() => {
                  const totalReceitas = lancamentosCompletos
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
                    .reduce((sum, l) => sum + parseFloat(l.valor), 0);

                  const totalDespesas = lancamentosCompletos
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
                    .reduce((sum, l) => sum + parseFloat(l.valor), 0);

                  const saldo = totalReceitas - totalDespesas;
                  const isPositivo = saldo >= 0;

                  return (
                    <>
                      <p className={`text-2xl font-bold mb-1 ${isPositivo ? 'text-green-700' : 'text-red-700'}`}>
                        {formatarMoeda(saldo)}
                      </p>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div 
                          className={`h-2 rounded-full ${isPositivo ? 'bg-gradient-to-r from-green-500 to-green-700' : 'bg-gradient-to-r from-red-500 to-red-700'}`}
                          style={{ width: '100%' }}
                        ></div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* SEÇÃO 3: EVOLUÇÃO ANUAL */}
        <div className="border-t pt-6 space-y-4">
          <h4 className="text-lg font-bold text-gray-700">Evolução Anual</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* RECEITAS POR ANO */}
            <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
              <h5 className="text-md font-bold text-green-700 mb-3">📈 Receitas por Ano</h5>
              <div className="space-y-2">
                {(() => {
                  const receitasPorAno = lancamentosCompletos
                    .filter(l => {
                      if (l.categorias_financeiras?.tipo !== 'receita' || l.status !== 'pago') return false;
                      const isTronco = l.categorias_financeiras?.nome?.toLowerCase().includes('tronco');
                      if (isTronco && l.tipo_pagamento === 'dinheiro') return false;
                      if (l.tipo_pagamento === 'compensacao') return false;
                      return true;
                    })
                    .reduce((acc, l) => {
                      const dataRef = l.data_pagamento || l.data_vencimento;
                      if (!dataRef) return acc;
                      const ano = parseData(dataRef).getFullYear();
                      acc[ano] = (acc[ano] || 0) + parseFloat(l.valor);
                      return acc;
                    }, {});

                  // Calcular despesas para pegar todos os anos
                  const despesasPorAno = lancamentosCompletos
                    .filter(l => {
                      if (l.categorias_financeiras?.tipo !== 'despesa' || l.status !== 'pago') return false;
                      const isTronco = l.categorias_financeiras?.nome?.toLowerCase().includes('tronco');
                      if (isTronco && l.tipo_pagamento === 'dinheiro') return false;
                      const isDespesaPagaPeloIrmao = l.categorias_financeiras?.nome?.toLowerCase().includes('despesas pagas pelo irmão') ||
                                                    l.categorias_financeiras?.nome?.toLowerCase().includes('despesa paga pelo irmão');
                      if (isDespesaPagaPeloIrmao) return false;
                      return true;
                    })
                    .reduce((acc, l) => {
                      const dataRef = l.data_pagamento || l.data_vencimento;
                      if (!dataRef) return acc;
                      const ano = parseData(dataRef).getFullYear();
                      acc[ano] = true;
                      return acc;
                    }, {});

                  // Garantir que todos os anos de despesas também apareçam em receitas
                  const todosAnos = [...new Set([...Object.keys(receitasPorAno), ...Object.keys(despesasPorAno)])];
                  todosAnos.forEach(ano => {
                    if (!(ano in receitasPorAno)) {
                      receitasPorAno[ano] = 0;
                    }
                  });

                  const maxReceita = Math.max(...Object.values(receitasPorAno), 0);

                  return Object.entries(receitasPorAno)
                    .sort((a, b) => parseInt(b[0]) - parseInt(a[0])) // Mais recente primeiro
                    .map(([ano, valor]) => {
                      const largura = maxReceita > 0 ? (valor / maxReceita) * 100 : 0;
                      return (
                        <div key={ano} className="space-y-1">
                          <div className="flex justify-between items-center text-sm">
                            <span className="font-semibold text-gray-700">{ano}</span>
                            <span className="font-bold text-green-700">{formatarMoeda(valor)}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-6 relative">
                            <div 
                              className="bg-gradient-to-r from-green-500 to-green-700 h-6 rounded-full flex items-center justify-end pr-2 transition-all"
                              style={{ width: `${largura}%` }}
                            >
                              {largura > 15 && <span className="text-xs text-white font-bold">{largura.toFixed(0)}%</span>}
                            </div>
                          </div>
                        </div>
                      );
                    });
                })()}
              </div>
            </div>

            {/* DESPESAS POR ANO */}
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
              <h5 className="text-md font-bold text-red-700 mb-3">📉 Despesas por Ano (% da Receita)</h5>
              <div className="space-y-2">
                {(() => {
                  // Calcular receitas
                  const receitasPorAno = lancamentosCompletos
                    .filter(l => {
                      if (l.categorias_financeiras?.tipo !== 'receita' || l.status !== 'pago') return false;
                      const isTronco = l.categorias_financeiras?.nome?.toLowerCase().includes('tronco');
                      if (isTronco && l.tipo_pagamento === 'dinheiro') return false;
                      if (l.tipo_pagamento === 'compensacao') return false;
                      return true;
                    })
                    .reduce((acc, l) => {
                      const dataRef = l.data_pagamento || l.data_vencimento;
                      if (!dataRef) return acc;
                      const ano = parseData(dataRef).getFullYear();
                      acc[ano] = (acc[ano] || 0) + parseFloat(l.valor);
                      return acc;
                    }, {});

                  const despesasPorAno = lancamentosCompletos
                    .filter(l => {
                      if (l.categorias_financeiras?.tipo !== 'despesa' || l.status !== 'pago') return false;
                      const isTronco = l.categorias_financeiras?.nome?.toLowerCase().includes('tronco');
                      if (isTronco && l.tipo_pagamento === 'dinheiro') return false;
                      const isDespesaPagaPeloIrmao = l.categorias_financeiras?.nome?.toLowerCase().includes('despesas pagas pelo irmão') ||
                                                    l.categorias_financeiras?.nome?.toLowerCase().includes('despesa paga pelo irmão');
                      if (isDespesaPagaPeloIrmao) return false;
                      return true;
                    })
                    .reduce((acc, l) => {
                      const dataRef = l.data_pagamento || l.data_vencimento;
                      if (!dataRef) return acc;
                      const ano = parseData(dataRef).getFullYear();
                      acc[ano] = (acc[ano] || 0) + parseFloat(l.valor);
                      return acc;
                    }, {});

                  // Garantir que todos os anos apareçam
                  const todosAnos = [...new Set([...Object.keys(receitasPorAno), ...Object.keys(despesasPorAno)])];
                  todosAnos.forEach(ano => {
                    if (!(ano in despesasPorAno)) despesasPorAno[ano] = 0;
                    if (!(ano in receitasPorAno)) receitasPorAno[ano] = 0;
                  });

                  return Object.entries(despesasPorAno)
                    .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
                    .map(([ano, valorDespesa]) => {
                      const valorReceita = receitasPorAno[ano] || 0;
                      const percentual = valorReceita > 0 ? (valorDespesa / valorReceita) * 100 : 0;
                      
                      return (
                        <div key={ano} className="space-y-1">
                          <div className="flex justify-between items-center text-sm">
                            <span className="font-semibold text-gray-700">{ano}</span>
                            <span className="font-bold text-red-700">{formatarMoeda(valorDespesa)}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-6 relative">
                            <div 
                              className="bg-gradient-to-r from-red-500 to-red-700 h-6 rounded-full flex items-center justify-end pr-2 transition-all"
                              style={{ width: `${Math.min(percentual, 100)}%` }}
                            >
                              <span className="text-xs text-white font-bold">{percentual.toFixed(0)}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    });
                })()}
              </div>
            </div>

            {/* SALDO POR ANO */}
            <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
              <h5 className="text-md font-bold text-blue-700 mb-3">💎 Saldo por Ano (% da Receita)</h5>
              <div className="space-y-2">
                {(() => {
                  // Calcular receitas por ano
                  const receitasPorAno = lancamentosCompletos
                    .filter(l => {
                      if (l.categorias_financeiras?.tipo !== 'receita' || l.status !== 'pago') return false;
                      const isTronco = l.categorias_financeiras?.nome?.toLowerCase().includes('tronco');
                      if (isTronco && l.tipo_pagamento === 'dinheiro') return false;
                      if (l.tipo_pagamento === 'compensacao') return false;
                      return true;
                    })
                    .reduce((acc, l) => {
                      const dataRef = l.data_pagamento || l.data_vencimento;
                      if (!dataRef) return acc;
                      const ano = parseData(dataRef).getFullYear();
                      acc[ano] = (acc[ano] || 0) + parseFloat(l.valor);
                      return acc;
                    }, {});

                  // Calcular despesas por ano
                  const despesasPorAno = lancamentosCompletos
                    .filter(l => {
                      if (l.categorias_financeiras?.tipo !== 'despesa' || l.status !== 'pago') return false;
                      const isTronco = l.categorias_financeiras?.nome?.toLowerCase().includes('tronco');
                      if (isTronco && l.tipo_pagamento === 'dinheiro') return false;
                      const isDespesaPagaPeloIrmao = l.categorias_financeiras?.nome?.toLowerCase().includes('despesas pagas pelo irmão') ||
                                                    l.categorias_financeiras?.nome?.toLowerCase().includes('despesa paga pelo irmão');
                      if (isDespesaPagaPeloIrmao) return false;
                      return true;
                    })
                    .reduce((acc, l) => {
                      const dataRef = l.data_pagamento || l.data_vencimento;
                      if (!dataRef) return acc;
                      const ano = parseData(dataRef).getFullYear();
                      acc[ano] = (acc[ano] || 0) + parseFloat(l.valor);
                      return acc;
                    }, {});

                  // Combinar anos
                  const todosAnos = [...new Set([...Object.keys(receitasPorAno), ...Object.keys(despesasPorAno)])];
                  const saldosPorAno = {};
                  todosAnos.forEach(ano => {
                    const receita = receitasPorAno[ano] || 0;
                    const despesa = despesasPorAno[ano] || 0;
                    saldosPorAno[ano] = { valor: receita - despesa, receita };
                  });

                  return Object.entries(saldosPorAno)
                    .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
                    .map(([ano, { valor, receita }]) => {
                      const percentual = receita > 0 ? (valor / receita) * 100 : 0;
                      const isPositivo = valor >= 0;
                      const largura = Math.min(Math.abs(percentual), 100);
                      
                      return (
                        <div key={ano} className="space-y-1">
                          <div className="flex justify-between items-center text-sm">
                            <span className="font-semibold text-gray-700">{ano}</span>
                            <span className={`font-bold ${isPositivo ? 'text-green-700' : 'text-red-700'}`}>
                              {formatarMoeda(valor)}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-6 relative">
                            <div 
                              className={`h-6 rounded-full flex items-center justify-end pr-2 transition-all ${
                                isPositivo 
                                  ? 'bg-gradient-to-r from-green-500 to-green-700' 
                                  : 'bg-gradient-to-r from-red-500 to-red-700'
                              }`}
                              style={{ width: `${largura}%` }}
                            >
                              <span className="text-xs text-white font-bold">
                                {isPositivo ? '+' : ''}{percentual.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    });
                })()}
              </div>
            </div>
          </div>

          {/* SEÇÃO: GRÁFICO FINANCEIRO MENSAL - Barras Verticais */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-lg p-6 border-2 border-blue-200 mt-8">
            <div className="mb-4">
              <h5 className="text-lg font-bold text-gray-800 mb-1">📊 Gráfico Financeiro Mensal</h5>
              <p className="text-sm text-gray-600">Visualização de receitas e despesas por mês</p>
            </div>

            {dadosGrafico.length > 0 ? (
              <div className="bg-white rounded-lg p-6 shadow-inner">
                {/* Gráfico de Barras Verticais */}
                <div className="flex items-end justify-around gap-2 h-80 border-b-2 border-gray-300 pb-2">
                  {(() => {
                    const maxValor = Math.max(...dadosGrafico.flatMap(d => [d.receitas, d.despesas]));
                    
                    return dadosGrafico.map((dado, index) => (
                      <div key={index} className="flex flex-col items-center gap-2 flex-1">
                        {/* Barras */}
                        <div className="flex items-end gap-1 h-full w-full justify-center">
                          {/* Barra Despesas */}
                          <div className="flex flex-col items-center justify-end h-full" style={{ width: '40%' }}>
                            <div className="relative group">
                              <div 
                                className="bg-gradient-to-t from-red-600 to-red-400 rounded-t-lg transition-all duration-500 hover:opacity-80 shadow-lg"
                                style={{ 
                                  height: `${(dado.despesas / maxValor) * 280}px`,
                                  minHeight: dado.despesas > 0 ? '10px' : '0',
                                  width: '100%',
                                  minWidth: '20px'
                                }}
                              >
                                {/* Valor no topo */}
                                {dado.despesas > 0 && (
                                  <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                                    <span className="text-[9px] font-bold text-red-600 bg-white px-1 rounded shadow">
                                      {formatarMoeda(dado.despesas).replace('R$', '').trim()}
                                    </span>
                                  </div>
                                )}
                              </div>
                              {/* Tooltip */}
                              <div className="hidden group-hover:block absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-10">
                                <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                                  Despesas: {formatarMoeda(dado.despesas)}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Barra Receitas */}
                          <div className="flex flex-col items-center justify-end h-full" style={{ width: '40%' }}>
                            <div className="relative group">
                              <div 
                                className="bg-gradient-to-t from-green-600 to-green-400 rounded-t-lg transition-all duration-500 hover:opacity-80 shadow-lg"
                                style={{ 
                                  height: `${(dado.receitas / maxValor) * 280}px`,
                                  minHeight: dado.receitas > 0 ? '10px' : '0',
                                  width: '100%',
                                  minWidth: '20px'
                                }}
                              >
                                {/* Valor no topo */}
                                {dado.receitas > 0 && (
                                  <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                                    <span className="text-[9px] font-bold text-green-600 bg-white px-1 rounded shadow">
                                      {formatarMoeda(dado.receitas).replace('R$', '').trim()}
                                    </span>
                                  </div>
                                )}
                              </div>
                              {/* Tooltip */}
                              <div className="hidden group-hover:block absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-10">
                                <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                                  Receitas: {formatarMoeda(dado.receitas)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Label do mês */}
                        <div className="text-xs font-semibold text-gray-700 mt-2">{dado.mes}</div>
                      </div>
                    ));
                  })()}
                </div>

                {/* Legenda */}
                <div className="flex items-center justify-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gradient-to-t from-red-600 to-red-400 rounded"></div>
                    <span className="text-sm font-medium text-gray-700">Despesas</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gradient-to-t from-green-600 to-green-400 rounded"></div>
                    <span className="text-sm font-medium text-gray-700">Receitas</span>
                  </div>
                </div>

                {/* Cards de resumo compactos */}
                <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-200">
                  <div className="bg-green-50 rounded-lg p-3 border border-green-200 text-center">
                    <p className="text-[10px] text-green-600 font-semibold mb-1">Total Receitas</p>
                    <p className="text-base font-bold text-green-700">
                      {formatarMoeda(dadosGrafico.reduce((sum, item) => sum + item.receitas, 0))}
                    </p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 border border-red-200 text-center">
                    <p className="text-[10px] text-red-600 font-semibold mb-1">Total Despesas</p>
                    <p className="text-base font-bold text-red-700">
                      {formatarMoeda(dadosGrafico.reduce((sum, item) => sum + item.despesas, 0))}
                    </p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 text-center">
                    <p className="text-[10px] text-blue-600 font-semibold mb-1">Lucro Total</p>
                    <p className={`text-base font-bold ${
                      dadosGrafico.reduce((sum, item) => sum + item.lucro, 0) >= 0 ? 'text-blue-700' : 'text-red-700'
                    }`}>
                      {formatarMoeda(dadosGrafico.reduce((sum, item) => sum + item.lucro, 0))}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>⏳ Carregando dados do gráfico...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnaliseCategoriasModal;
