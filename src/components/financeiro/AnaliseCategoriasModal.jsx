import React, { useState, useEffect } from 'react';
import { supabase } from '../../App';

const AnaliseCategoriasModal = ({ isOpen, onClose, showError }) => {
  const [lancamentosCompletos, setLancamentosCompletos] = useState([]);
  const [anosDisponiveis, setAnosDisponiveis] = useState([]);
  const [filtroAnalise, setFiltroAnalise] = useState({
    mes: new Date().getMonth() + 1,
    ano: new Date().getFullYear()
  });

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

  const carregarLancamentosCompletos = async () => {
    try {
      const { data, error } = await supabase
        .from('lancamentos_loja')
        .select('*, categorias_financeiras(id, nome, tipo)')
        .order('data_pagamento', { ascending: false });

      if (error) throw error;
      setLancamentosCompletos(data || []);
      
      // Extrair anos únicos dos lançamentos com datas válidas
      const anosUnicos = [...new Set(
        (data || [])
          .filter(l => l.data_pagamento) // Filtrar apenas com data
          .map(l => new Date(l.data_pagamento).getFullYear())
          .filter(ano => ano >= 2000 && ano <= 2100) // Filtrar anos válidos
      )];
      const anosOrdenados = anosUnicos.sort((a, b) => b - a); // Mais recente primeiro
      setAnosDisponiveis(anosOrdenados);
      
      // Selecionar ano mais recente
      if (anosOrdenados.length > 0) {
        setFiltroAnalise(prev => ({ ...prev, ano: anosOrdenados[0] }));
      }
    } catch (error) {
      console.error('Erro ao carregar lançamentos completos:', error);
      if (showError) showError('Erro ao carregar dados para análise');
    }
  };

  useEffect(() => {
    if (isOpen) {
      carregarLancamentosCompletos();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between z-10">
          <h3 className="text-2xl font-bold text-gray-800">📊 Análise por Categoria</h3>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-700 text-3xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* SEÇÃO 1: ANÁLISE POR CATEGORIA (com filtro mês/ano) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-bold text-gray-700">Detalhamento por Categoria</h4>
              
              {/* Filtros Mês/Ano */}
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

            {/* Grid com Receitas e Despesas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* RECEITAS POR CATEGORIA */}
              <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
                <h5 className="text-md font-bold text-green-700 mb-3 flex items-center gap-2">
                  <span>📈</span>
                  <span>Receitas por Categoria</span>
                </h5>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {(() => {
                    const receitasPorCategoria = lancamentosCompletos
                      .filter(l => {
                        if (l.categorias_financeiras?.tipo !== 'receita' || l.status !== 'pago') return false;
                        
                        // Excluir Tronco em dinheiro (não deve contar nas receitas)
                        const isTronco = l.categorias_financeiras?.nome?.toLowerCase().includes('tronco');
                        const isDinheiro = l.tipo_pagamento === 'dinheiro';
                        if (isTronco && isDinheiro) return false;
                        
                        // Excluir compensações (não houve entrada real de dinheiro)
                        if (l.tipo_pagamento === 'compensacao') return false;
                        
                        const data = new Date(l.data_pagamento);
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
                <h5 className="text-md font-bold text-red-700 mb-3 flex items-center gap-2">
                  <span>📉</span>
                  <span>Despesas por Categoria</span>
                </h5>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {(() => {
                    const despesasPorCategoria = lancamentosCompletos
                      .filter(l => {
                        if (l.categorias_financeiras?.tipo !== 'despesa' || l.status !== 'pago') return false;
                        
                        // Excluir Tronco em dinheiro (não deve contar nas despesas)
                        const isTronco = l.categorias_financeiras?.nome?.toLowerCase().includes('tronco');
                        const isDinheiro = l.tipo_pagamento === 'dinheiro';
                        if (isTronco && isDinheiro) return false;
                        
                        // Excluir "Despesas Pagas pelo Irmão" (são compensações, irmão já pagou)
                        const isDespesaPagaPeloIrmao = l.categorias_financeiras?.nome?.toLowerCase().includes('despesas pagas pelo irmão') ||
                                                      l.categorias_financeiras?.nome?.toLowerCase().includes('despesa paga pelo irmão');
                        if (isDespesaPagaPeloIrmao) return false;
                        
                        const data = new Date(l.data_pagamento);
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

          {/* SEÇÃO 2: TOTAL POR ANO (barras horizontais) */}
          <div className="border-t pt-6 space-y-4">
            <h4 className="text-lg font-bold text-gray-700">Comparativo Anual</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* RECEITAS POR ANO */}
              <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
                <h5 className="text-md font-bold text-green-700 mb-4">📈 Receitas por Ano</h5>
                <div className="space-y-3">
                  {(() => {
                    const receitasPorAno = lancamentosCompletos
                      .filter(l => {
                        if (l.categorias_financeiras?.tipo !== 'receita' || l.status !== 'pago') return false;
                        
                        // Excluir Tronco em dinheiro
                        const isTronco = l.categorias_financeiras?.nome?.toLowerCase().includes('tronco');
                        const isDinheiro = l.tipo_pagamento === 'dinheiro';
                        if (isTronco && isDinheiro) return false;
                        
                        // Excluir compensações
                        if (l.tipo_pagamento === 'compensacao') return false;
                        
                        return true;
                      })
                      .reduce((acc, l) => {
                        const ano = new Date(l.data_pagamento).getFullYear();
                        acc[ano] = (acc[ano] || 0) + parseFloat(l.valor);
                        return acc;
                      }, {});

                    const maxReceita = Math.max(...Object.values(receitasPorAno));

                    return Object.entries(receitasPorAno)
                      .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
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
                                {largura > 20 && <span className="text-xs text-white font-bold">{largura.toFixed(0)}%</span>}
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
                <h5 className="text-md font-bold text-red-700 mb-4">📉 Despesas por Ano</h5>
                <div className="space-y-3">
                  {(() => {
                    const despesasPorAno = lancamentosCompletos
                      .filter(l => {
                        if (l.categorias_financeiras?.tipo !== 'despesa' || l.status !== 'pago') return false;
                        
                        // Excluir Tronco em dinheiro
                        const isTronco = l.categorias_financeiras?.nome?.toLowerCase().includes('tronco');
                        const isDinheiro = l.tipo_pagamento === 'dinheiro';
                        if (isTronco && isDinheiro) return false;
                        
                        // Excluir Despesas Pagas pelo Irmão
                        const isDespesaPagaPeloIrmao = l.categorias_financeiras?.nome?.toLowerCase().includes('despesas pagas pelo irmão') ||
                                                      l.categorias_financeiras?.nome?.toLowerCase().includes('despesa paga pelo irmão');
                        if (isDespesaPagaPeloIrmao) return false;
                        
                        return true;
                      })
                      .reduce((acc, l) => {
                        const ano = new Date(l.data_pagamento).getFullYear();
                        acc[ano] = (acc[ano] || 0) + parseFloat(l.valor);
                        return acc;
                      }, {});

                    const maxDespesa = Math.max(...Object.values(despesasPorAno));

                    return Object.entries(despesasPorAno)
                      .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
                      .map(([ano, valor]) => {
                        const largura = maxDespesa > 0 ? (valor / maxDespesa) * 100 : 0;
                        return (
                          <div key={ano} className="space-y-1">
                            <div className="flex justify-between items-center text-sm">
                              <span className="font-semibold text-gray-700">{ano}</span>
                              <span className="font-bold text-red-700">{formatarMoeda(valor)}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-6 relative">
                              <div 
                                className="bg-gradient-to-r from-red-500 to-red-700 h-6 rounded-full flex items-center justify-end pr-2 transition-all"
                                style={{ width: `${largura}%` }}
                              >
                                {largura > 20 && <span className="text-xs text-white font-bold">{largura.toFixed(0)}%</span>}
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
                <h5 className="text-md font-bold text-blue-700 mb-4">💎 Saldo por Ano</h5>
                <div className="space-y-3">
                  {(() => {
                    // Calcular receitas por ano (excluindo Tronco dinheiro e compensações)
                    const receitasPorAno = lancamentosCompletos
                      .filter(l => {
                        if (l.categorias_financeiras?.tipo !== 'receita' || l.status !== 'pago') return false;
                        
                        // Excluir Tronco em dinheiro
                        const isTronco = l.categorias_financeiras?.nome?.toLowerCase().includes('tronco');
                        const isDinheiro = l.tipo_pagamento === 'dinheiro';
                        if (isTronco && isDinheiro) return false;
                        
                        // Excluir compensações
                        if (l.tipo_pagamento === 'compensacao') return false;
                        
                        return true;
                      })
                      .reduce((acc, l) => {
                        const ano = new Date(l.data_pagamento).getFullYear();
                        acc[ano] = (acc[ano] || 0) + parseFloat(l.valor);
                        return acc;
                      }, {});

                    // Calcular despesas por ano (excluindo Tronco dinheiro e Despesas Pagas pelo Irmão)
                    const despesasPorAno = lancamentosCompletos
                      .filter(l => {
                        if (l.categorias_financeiras?.tipo !== 'despesa' || l.status !== 'pago') return false;
                        
                        // Excluir Tronco em dinheiro
                        const isTronco = l.categorias_financeiras?.nome?.toLowerCase().includes('tronco');
                        const isDinheiro = l.tipo_pagamento === 'dinheiro';
                        if (isTronco && isDinheiro) return false;
                        
                        // Excluir Despesas Pagas pelo Irmão
                        const isDespesaPagaPeloIrmao = l.categorias_financeiras?.nome?.toLowerCase().includes('despesas pagas pelo irmão') ||
                                                      l.categorias_financeiras?.nome?.toLowerCase().includes('despesa paga pelo irmão');
                        if (isDespesaPagaPeloIrmao) return false;
                        
                        return true;
                      })
                      .reduce((acc, l) => {
                        const ano = new Date(l.data_pagamento).getFullYear();
                        acc[ano] = (acc[ano] || 0) + parseFloat(l.valor);
                        return acc;
                      }, {});

                    // Combinar anos e calcular saldo
                    const todosAnos = [...new Set([...Object.keys(receitasPorAno), ...Object.keys(despesasPorAno)])];
                    const saldosPorAno = todosAnos.reduce((acc, ano) => {
                      acc[ano] = (receitasPorAno[ano] || 0) - (despesasPorAno[ano] || 0);
                      return acc;
                    }, {});

                    const maxAbsoluto = Math.max(...Object.values(saldosPorAno).map(v => Math.abs(v)));

                    return Object.entries(saldosPorAno)
                      .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
                      .map(([ano, valor]) => {
                        const largura = maxAbsoluto > 0 ? (Math.abs(valor) / maxAbsoluto) * 100 : 0;
                        const isPositivo = valor >= 0;
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
                                {largura > 20 && <span className="text-xs text-white font-bold">{largura.toFixed(0)}%</span>}
                              </div>
                            </div>
                          </div>
                        );
                      });
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-50 border-t p-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnaliseCategoriasModal;
