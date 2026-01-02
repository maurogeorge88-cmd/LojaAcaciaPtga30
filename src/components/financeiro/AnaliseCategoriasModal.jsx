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
        <button 
          onClick={onClose} 
          className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2"
        >
          <span>←</span>
          <span>Voltar ao Dashboard</span>
        </button>
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
