/**
 * MINHAS FINANÇAS
 * Permite irmão comum visualizar apenas suas próprias mensalidades
 * SOMENTE LEITURA - não pode editar ou excluir
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function MinhasFinancas({ userEmail }) {
  const [lancamentos, setLancamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todos'); // todos, pendentes, pagos
  const [anoFiltro, setAnoFiltro] = useState(new Date().getFullYear());

  // Estatísticas
  const [totalReceitas, setTotalReceitas] = useState(0); // O que o irmão DEVE
  const [totalDespesas, setTotalDespesas] = useState(0); // O que a loja DEVE (créditos)
  const [saldoLiquido, setSaldoLiquido] = useState(0);

  useEffect(() => {
    carregarMinhasFinancas();
  }, [userEmail, filtro, anoFiltro]);

  const carregarMinhasFinancas = async () => {
    try {
      setLoading(true);

      // Buscar ID do irmão pelo email
      const { data: irmao, error: irmaoError } = await supabase
        .from('irmaos')
        .select('id, nome')
        .eq('email', userEmail)
        .single();

      if (irmaoError) throw irmaoError;
      if (!irmao) {
        console.log('Irmão não encontrado');
        setLoading(false);
        return;
      }

      // PRIMEIRO: Buscar TODOS os lançamentos do ano para calcular totais corretos
      const { data: todosLancamentos, error: erroTodos } = await supabase
        .from('lancamentos_loja')
        .select(`
          *,
          categorias_financeiras (nome, tipo)
        `)
        .eq('origem_irmao_id', irmao.id)
        .eq('origem_tipo', 'Irmao')
        .gte('data_vencimento', `${anoFiltro}-01-01`)
        .lte('data_vencimento', `${anoFiltro}-12-31`)
        .limit(300); // ⚡ PERFORMANCE: Limita a 300 registros por ano

      if (erroTodos) throw erroTodos;

      // Calcular totais GERAIS (independente do filtro)
      const todasReceitas = (todosLancamentos || []).filter(l => 
        l.categorias_financeiras?.tipo === 'receita' && l.status === 'pendente'
      );
      const todasDespesas = (todosLancamentos || []).filter(l => 
        l.categorias_financeiras?.tipo === 'despesa' && l.status === 'pendente'
      );
      const receitasPagas = (todosLancamentos || []).filter(l => 
        l.categorias_financeiras?.tipo === 'receita' && l.status === 'pago'
      );
      const despesasPagas = (todosLancamentos || []).filter(l => 
        l.categorias_financeiras?.tipo === 'despesa' && l.status === 'pago'
      );

      const totalReceitasPendentes = todasReceitas.reduce((sum, l) => sum + parseFloat(l.valor || 0), 0);
      const totalDespesasPendentes = todasDespesas.reduce((sum, l) => sum + parseFloat(l.valor || 0), 0);
      const totalReceitasPagas = receitasPagas.reduce((sum, l) => sum + parseFloat(l.valor || 0), 0);
      const totalDespesasPagas = despesasPagas.reduce((sum, l) => sum + parseFloat(l.valor || 0), 0);

      // SALDO FINAL CORRETO:
      // Você deve (receitas pendentes) - Você já pagou (receitas pagas) + Loja deve (despesas pendentes) - Loja já pagou (despesas pagas)
      const saldoFinal = totalReceitasPendentes - totalDespesasPendentes;

      setTotalReceitas(totalReceitasPendentes);
      setTotalDespesas(totalDespesasPendentes);
      setSaldoLiquido(saldoFinal);

      // SEGUNDO: Buscar lançamentos FILTRADOS para exibição
      let query = supabase
        .from('lancamentos_loja')
        .select(`
          *,
          categorias_financeiras (nome, tipo)
        `)
        .eq('origem_irmao_id', irmao.id)
        .eq('origem_tipo', 'Irmao')
        .gte('data_vencimento', `${anoFiltro}-01-01`)
        .lte('data_vencimento', `${anoFiltro}-12-31`)
        .order('data_vencimento', { ascending: false });

      // Aplicar filtro de status
      if (filtro === 'pendentes') {
        query = query.eq('status', 'pendente');
      } else if (filtro === 'pagos') {
        query = query.eq('status', 'pago');
      }
      // Se filtro === 'todos', não aplica filtro de status

      const { data, error } = await query;

      if (error) throw error;

      setLancamentos(data || []);

    } catch (error) {
      console.error('Erro ao carregar finanças:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatarData = (data) => {
    if (!data) return '-';
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const formatarMoeda = (valor) => {
    return parseFloat(valor || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  const getStatusBadge = (lancamento) => {
    if (lancamento.data_pagamento) {
      return (
        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
          ✅ Pago
        </span>
      );
    }

    const hoje = new Date();
    const vencimento = new Date(lancamento.data_vencimento);
    
    if (vencimento < hoje) {
      return (
        <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
          ⚠️ Atrasado
        </span>
      );
    }

    return (
      <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
        ⏳ Pendente
      </span>
    );
  };

  const anosDisponiveis = () => {
    const anoAtual = new Date().getFullYear();
    const anos = [];
    const anoFinal = Math.max(anoAtual + 3, 2028);
    for (let i = anoFinal; i >= 2025; i--) {
      anos.push(i);
    }
    return anos;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg text-gray-600">Carregando suas finanças...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">💰 Minhas Finanças</h2>

      {/* Cards de resumo - NOVO LAYOUT */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-red-400 to-red-500 rounded-lg p-4 text-white shadow-lg">
          <p className="text-sm opacity-90">Você Deve</p>
          <p className="text-2xl font-bold mt-1">{formatarMoeda(totalReceitas)}</p>
        </div>

        <div className="bg-gradient-to-br from-blue-400 to-blue-500 rounded-lg p-4 text-white shadow-lg">
          <p className="text-sm opacity-90">Loja Deve (Créditos)</p>
          <p className="text-2xl font-bold mt-1">{formatarMoeda(totalDespesas)}</p>
        </div>

        <div className={`rounded-lg p-4 text-white shadow-lg ${
          saldoLiquido > 0 ? 'bg-gradient-to-br from-orange-400 to-orange-500' : 
          saldoLiquido < 0 ? 'bg-gradient-to-br from-green-400 to-green-500' : 
          'bg-gradient-to-br from-gray-400 to-gray-500'
        }`}>
          <p className="text-sm opacity-90">Saldo Final</p>
          <p className="text-2xl font-bold mt-1">{formatarMoeda(Math.abs(saldoLiquido))}</p>
          <p className="text-xs mt-1">
            {saldoLiquido > 0 ? '(Você deve)' : saldoLiquido < 0 ? '(Você tem crédito)' : '(Quitado)'}
          </p>
        </div>
      </div>

      {/* Filtros - COMPACTO */}
      <div className="bg-white rounded-lg shadow p-3 mb-4 flex flex-wrap gap-3 items-center">
        {/* Filtro de status */}
        <div className="flex gap-2">
          <button
            onClick={() => setFiltro('todos')}
            className={`px-3 py-1.5 text-sm rounded-lg transition ${
              filtro === 'todos'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFiltro('pendentes')}
            className={`px-3 py-1.5 text-sm rounded-lg transition ${
              filtro === 'pendentes'
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Pendentes
          </button>
          <button
            onClick={() => setFiltro('pagos')}
            className={`px-3 py-1.5 text-sm rounded-lg transition ${
              filtro === 'pagos'
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Pagos
          </button>
        </div>

        {/* Filtro de ano */}
        <select
          value={anoFiltro}
          onChange={(e) => setAnoFiltro(parseInt(e.target.value))}
          className="px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          {anosDisponiveis().map(ano => (
            <option key={ano} value={ano}>{ano}</option>
          ))}
        </select>
      </div>

      {/* Lista de lançamentos - LAYOUT INADIMPLENTES */}
      {lancamentos.length === 0 ? (
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg">
          <div className="flex items-center">
            <span className="text-3xl mr-3">ℹ️</span>
            <div>
              <p className="font-semibold text-blue-800">Nenhum lançamento encontrado</p>
              <p className="text-sm text-blue-600">Não há registros financeiros para o filtro selecionado.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white shadow-md">
          {/* LISTA DE LANÇAMENTOS */}
          <div className="divide-y divide-gray-200">
            {lancamentos.map((lanc) => {
              const ehReceita = lanc.categorias_financeiras?.tipo === 'receita';
              
              return (
                <div key={lanc.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      {/* Badges de Categoria */}
                      <div className="flex gap-2 mb-2 flex-wrap">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          ehReceita ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {ehReceita ? '📈 Você Deve' : '💰 Loja Deve'}
                        </span>
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-800 rounded-full">
                          {lanc.categorias_financeiras?.nome}
                        </span>
                        {lanc.eh_parcelado && (
                          <span className="text-xs px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full font-medium">
                            📋 Parcela {lanc.parcela_numero}/{lanc.parcela_total}
                          </span>
                        )}
                        {lanc.eh_mensalidade && (
                          <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded-full font-medium">
                            📅 Mensalidade
                          </span>
                        )}
                        {getStatusBadge(lanc)}
                      </div>
                      
                      {/* Descrição */}
                      <p className="font-medium text-gray-900 mb-2">{lanc.descricao}</p>
                      
                      {/* Informações - DATAS NA MESMA LINHA */}
                      <div className="text-sm text-gray-600">
                        <p>
                          <span className="font-medium">Vencimento:</span> {formatarData(lanc.data_vencimento)}
                          {lanc.data_pagamento && (
                            <>
                              <span className="mx-2">•</span>
                              <span className="font-medium text-green-600">Pago em:</span> {formatarData(lanc.data_pagamento)}
                            </>
                          )}
                          {lanc.tipo_pagamento && (
                            <>
                              <span className="mx-2">•</span>
                              <span className="font-medium">Forma:</span> {lanc.tipo_pagamento}
                            </>
                          )}
                        </p>
                        {lanc.observacoes && (
                          <p className="text-gray-500 italic mt-1">
                            💬 {lanc.observacoes}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right ml-4">
                      <p className={`text-2xl font-bold ${
                        ehReceita ? 'text-red-600' : 'text-blue-600'
                      }`}>
                        {formatarMoeda(lanc.valor)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Informações importantes - COMPACTO */}
      <div className="mt-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
        <div className="flex">
          <span className="text-2xl mr-3">💡</span>
          <div>
            <h4 className="font-semibold text-yellow-800 mb-1 text-sm">Informações Importantes</h4>
            <ul className="text-xs text-yellow-700 space-y-1">
              <li>• Para efetuar pagamentos, entre em contato com o Tesoureiro</li>
              <li>• Mantenha suas mensalidades em dia para regularidade</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
