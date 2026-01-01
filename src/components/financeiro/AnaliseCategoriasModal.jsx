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
        .order('data_vencimento', { ascending: false });

      if (error) throw error;
      
      console.log('=== LANÇAMENTOS CARREGADOS ===');
      console.log('Total:', data?.length);
      
      // Debug: mostrar TODOS os lançamentos de 2026 (por qualquer data)
      const lanc2026 = data?.filter(l => {
        const dataPgto = l.data_pagamento ? new Date(l.data_pagamento).getFullYear() : null;
        const dataVenc = l.data_vencimento ? new Date(l.data_vencimento).getFullYear() : null;
        return dataPgto === 2026 || dataVenc === 2026;
      });
      console.log('Lançamentos 2026 (qualquer data):', lanc2026?.length);
      lanc2026?.forEach(l => {
        console.log({
          descricao: l.descricao,
          tipo: l.categorias_financeiras?.tipo,
          status: l.status,
          data_pagamento: l.data_pagamento,
          data_vencimento: l.data_vencimento,
          valor: l.valor
        });
      });
      
      setLancamentosCompletos(data || []);
      
      // Extrair anos únicos dos lançamentos com datas válidas
      const anosUnicos = [...new Set(
        (data || [])
          .map(l => {
            // Tentar data_pagamento primeiro, senão data_vencimento
            const data = l.data_pagamento || l.data_vencimento;
            if (!data) return null;
            const ano = new Date(data).getFullYear();
            return ano >= 2000 && ano <= 2100 ? ano : null;
          })
          .filter(ano => ano !== null)
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
      // Limpar dados anteriores
      setLancamentosCompletos([]);
      setAnosDisponiveis([]);
      // Recarregar
      carregarLancamentosCompletos();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
      {/* CABEÇALHO FIXO */}
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

          {/* SEÇÃO 2: TOTAIS ANUAIS (respondem ao filtro) */}
          <div className="border-t pt-6 space-y-4">
            <h4 className="text-lg font-bold text-gray-700">
              Totais do Período - {filtroAnalise.mes === 0 ? filtroAnalise.ano : `${meses[filtroAnalise.mes - 1]}/${filtroAnalise.ano}`}
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* RECEITAS TOTAL */}
              <div className="bg-green-50 border-2 border-green-300 rounded-lg p-3">
                <h5 className="text-sm font-bold text-green-700 mb-2">📈 Total de Receitas</h5>
                <div className="text-center py-3">
                  {(() => {
                    const receitasFiltradas = lancamentosCompletos
                      .filter(l => {
                        if (l.categorias_financeiras?.tipo !== 'receita' || l.status !== 'pago') return false;
                        
                        // Excluir Tronco em dinheiro
                        const isTronco = l.categorias_financeiras?.nome?.toLowerCase().includes('tronco');
                        const isDinheiro = l.tipo_pagamento === 'dinheiro';
                        if (isTronco && isDinheiro) return false;
                        
                        // Excluir compensações
                        if (l.tipo_pagamento === 'compensacao') return false;
                        
                        // Filtrar pelo período selecionado
                        const dataRef = l.data_pagamento || l.data_vencimento;
                        if (!dataRef) return false;
                        const data = new Date(dataRef);
                        const anoLanc = data.getFullYear();
                        const mesLanc = data.getMonth() + 1;
                        
                        // Debug
                        if (anoLanc === 2026) {
                          console.log('Receita 2026:', {
                            descricao: l.descricao,
                            valor: l.valor,
                            data: dataRef,
                            anoLanc,
                            mesLanc,
                            filtroAno: filtroAnalise.ano,
                            filtroMes: filtroAnalise.mes,
                            passa: anoLanc === filtroAnalise.ano && (filtroAnalise.mes === 0 || mesLanc === filtroAnalise.mes)
                          });
                        }
                        
                        if (anoLanc !== filtroAnalise.ano) return false;
                        if (filtroAnalise.mes > 0 && mesLanc !== filtroAnalise.mes) return false;
                        
                        return true;
                      });
                    
                    const totalReceitas = receitasFiltradas.reduce((sum, l) => sum + parseFloat(l.valor), 0);

                    return (
                      <>
                        <p className="text-2xl font-bold text-green-700 mb-1">{formatarMoeda(totalReceitas)}</p>
                        <p className="text-xs text-gray-500">({receitasFiltradas.length} lançamentos)</p>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                          <div 
                            className="bg-gradient-to-r from-green-500 to-green-700 h-3 rounded-full transition-all"
                            style={{ width: '100%' }}
                          ></div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* DESPESAS TOTAL */}
              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-3">
                <h5 className="text-sm font-bold text-red-700 mb-2">📉 Total de Despesas</h5>
                <div className="text-center py-3">
                  {(() => {
                    const despesasFiltradas = lancamentosCompletos
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
                        
                        // Filtrar pelo período selecionado
                        const dataRef = l.data_pagamento || l.data_vencimento;
                        if (!dataRef) return false;
                        const data = new Date(dataRef);
                        if (data.getFullYear() !== filtroAnalise.ano) return false;
                        if (filtroAnalise.mes > 0 && data.getMonth() + 1 !== filtroAnalise.mes) return false;
                        
                        return true;
                      });
                    
                    const totalDespesas = despesasFiltradas.reduce((sum, l) => sum + parseFloat(l.valor), 0);

                    return (
                      <>
                        <p className="text-2xl font-bold text-red-700 mb-1">{formatarMoeda(totalDespesas)}</p>
                        <p className="text-xs text-gray-500">({despesasFiltradas.length} lançamentos)</p>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                          <div 
                            className="bg-gradient-to-r from-red-500 to-red-700 h-2 rounded-full transition-all"
                            style={{ width: '100%' }}
                          ></div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* SALDO TOTAL */}
              <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-3">
                <h5 className="text-sm font-bold text-blue-700 mb-2">💎 Saldo do Período</h5>
                <div className="text-center py-3">
                  {(() => {
                    // Calcular receitas
                    const totalReceitas = lancamentosCompletos
                      .filter(l => {
                        if (l.categorias_financeiras?.tipo !== 'receita' || l.status !== 'pago') return false;
                        const isTronco = l.categorias_financeiras?.nome?.toLowerCase().includes('tronco');
                        const isDinheiro = l.tipo_pagamento === 'dinheiro';
                        if (isTronco && isDinheiro) return false;
                        if (l.tipo_pagamento === 'compensacao') return false;
                        const dataRef = l.data_pagamento || l.data_vencimento;
                        if (!dataRef) return false;
                        const data = new Date(dataRef);
                        if (data.getFullYear() !== filtroAnalise.ano) return false;
                        if (filtroAnalise.mes > 0 && data.getMonth() + 1 !== filtroAnalise.mes) return false;
                        return true;
                      })
                      .reduce((sum, l) => sum + parseFloat(l.valor), 0);

                    // Calcular despesas
                    const totalDespesas = lancamentosCompletos
                      .filter(l => {
                        if (l.categorias_financeiras?.tipo !== 'despesa' || l.status !== 'pago') return false;
                        const isTronco = l.categorias_financeiras?.nome?.toLowerCase().includes('tronco');
                        const isDinheiro = l.tipo_pagamento === 'dinheiro';
                        if (isTronco && isDinheiro) return false;
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
                            className={`h-2 rounded-full transition-all ${
                              isPositivo 
                                ? 'bg-gradient-to-r from-green-500 to-green-700' 
                                : 'bg-gradient-to-r from-red-500 to-red-700'
                            }`}
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
