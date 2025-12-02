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
  const [totalPago, setTotalPago] = useState(0);
  const [totalPendente, setTotalPendente] = useState(0);
  const [totalAno, setTotalAno] = useState(0);

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

      // Buscar lançamentos financeiros do irmão
      let query = supabase
        .from('lancamentos_loja')
        .select(`
          *,
          categorias_financeiras (nome, tipo)
        `)
        .eq('origem_irmao_id', irmao.id)
        .gte('data_vencimento', `${anoFiltro}-01-01`)
        .lte('data_vencimento', `${anoFiltro}-12-31`)
        .order('data_vencimento', { ascending: false });

      // Aplicar filtro de status
      if (filtro === 'pendentes') {
        query = query.is('data_pagamento', null);
      } else if (filtro === 'pagos') {
        query = query.not('data_pagamento', 'is', null);
      }

      const { data, error } = await query;

      if (error) throw error;

      setLancamentos(data || []);

      // Calcular estatísticas
      const pagos = (data || []).filter(l => l.data_pagamento);
      const pendentes = (data || []).filter(l => !l.data_pagamento);

      setTotalPago(pagos.reduce((sum, l) => sum + parseFloat(l.valor || 0), 0));
      setTotalPendente(pendentes.reduce((sum, l) => sum + parseFloat(l.valor || 0), 0));
      setTotalAno((data || []).reduce((sum, l) => sum + parseFloat(l.valor || 0), 0));

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
    for (let i = anoAtual; i >= anoAtual - 5; i--) {
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

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Pago em {anoFiltro}</p>
              <p className="text-3xl font-bold mt-2">{formatarMoeda(totalPago)}</p>
            </div>
            <div className="text-5xl opacity-80">✅</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Pendente em {anoFiltro}</p>
              <p className="text-3xl font-bold mt-2">{formatarMoeda(totalPendente)}</p>
            </div>
            <div className="text-5xl opacity-80">⏳</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Total {anoFiltro}</p>
              <p className="text-3xl font-bold mt-2">{formatarMoeda(totalAno)}</p>
            </div>
            <div className="text-5xl opacity-80">📊</div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          {/* Filtro de status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <div className="flex gap-2">
              <button
                onClick={() => setFiltro('todos')}
                className={`px-4 py-2 rounded-lg transition ${
                  filtro === 'todos'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFiltro('pendentes')}
                className={`px-4 py-2 rounded-lg transition ${
                  filtro === 'pendentes'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Pendentes
              </button>
              <button
                onClick={() => setFiltro('pagos')}
                className={`px-4 py-2 rounded-lg transition ${
                  filtro === 'pagos'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Pagos
              </button>
            </div>
          </div>

          {/* Filtro de ano */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Ano</label>
            <select
              value={anoFiltro}
              onChange={(e) => setAnoFiltro(parseInt(e.target.value))}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {anosDisponiveis().map(ano => (
                <option key={ano} value={ano}>{ano}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Lista de lançamentos */}
      {lancamentos.length === 0 ? (
        <div className="bg-blue-50 border-l-4 border-blue-400 p-6 rounded-lg">
          <div className="flex items-center">
            <span className="text-4xl mr-4">ℹ️</span>
            <div>
              <p className="font-semibold text-blue-800">Nenhum lançamento encontrado</p>
              <p className="text-sm text-blue-600 mt-1">
                Não há registros financeiros para o filtro selecionado.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {lancamentos.map((lanc) => (
            <div
              key={lanc.id}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{lanc.descricao}</h3>
                  <p className="text-sm text-gray-600">
                    {lanc.categorias_financeiras?.nome || 'Sem categoria'}
                  </p>
                </div>
                {getStatusBadge(lanc)}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Vencimento</p>
                  <p className="font-semibold text-gray-900">
                    📅 {formatarData(lanc.data_vencimento)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-600 mb-1">Valor</p>
                  <p className="font-semibold text-gray-900 text-lg">
                    💵 {formatarMoeda(lanc.valor)}
                  </p>
                </div>

                {lanc.data_pagamento && (
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Data de Pagamento</p>
                    <p className="font-semibold text-green-600">
                      ✅ {formatarData(lanc.data_pagamento)}
                    </p>
                  </div>
                )}

                {lanc.metodo_pagamento && (
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Método</p>
                    <p className="font-semibold text-gray-900 capitalize">
                      {lanc.metodo_pagamento}
                    </p>
                  </div>
                )}
              </div>

              {lanc.observacoes && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-gray-600 mb-1">Observações</p>
                  <p className="text-sm text-gray-700">{lanc.observacoes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Informações importantes */}
      <div className="mt-8 bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-lg">
        <div className="flex">
          <span className="text-3xl mr-4">💡</span>
          <div>
            <h4 className="font-semibold text-yellow-800 mb-2">Informações Importantes</h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• Você pode visualizar apenas suas próprias finanças</li>
              <li>• Para efetuar pagamentos, entre em contato com o Tesoureiro</li>
              <li>• Mantenha suas mensalidades em dia para regularidade</li>
              <li>• Em caso de dúvidas, procure a administração da loja</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
