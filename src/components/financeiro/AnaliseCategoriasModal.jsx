import React, { useState, useEffect } from 'react';
import { supabase } from '../../App';

const AnaliseCategoriasModal = ({ isOpen, onClose, showError }) => {
  const [lancamentosCompletos, setLancamentosCompletos] = useState([]);
  const [anosDisponiveis, setAnosDisponiveis] = useState([]);
  const [filtroAnalise, setFiltroAnalise] = useState({
    mes: 0,
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
        .order('data_vencimento', { ascending: false });

      if (error) throw error;
      
      // Debug: ver lançamentos 01/01/2026
      const lanc0101 = data?.filter(l => 
        (l.data_pagamento?.includes('2026-01-01') || l.data_vencimento?.includes('2026-01-01'))
      );
      console.log('Lançamentos 01/01/2026:');
      lanc0101?.forEach(l => {
        console.log({
          id: l.id,
          descricao: l.descricao,
          status: l.status,
          tipo_pagamento: l.tipo_pagamento,
          categoria: l.categorias_financeiras?.nome,
          tipo: l.categorias_financeiras?.tipo,
          valor: l.valor
        });
      });
      
      setLancamentosCompletos(data || []);
      
      // Extrair anos únicos
      const anosUnicos = [...new Set(
        (data || [])
          .map(l => {
            const data = l.data_pagamento || l.data_vencimento;
            if (!data) return null;
            const ano = new Date(data).getFullYear();
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
                      const data = new Date(dataRef);
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
                      const data = new Date(dataRef);
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
                      const data = new Date(dataRef);
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
                      const data = new Date(dataRef);
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
                      const data = new Date(dataRef);
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
                      const data = new Date(dataRef);
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
      </div>
    </div>
  );
};

export default AnaliseCategoriasModal;
