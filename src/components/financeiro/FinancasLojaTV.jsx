import React, { useState, useEffect } from 'react';
import { supabase } from '../../App';
import { formatarMoeda, corrigirTimezone } from './utils/formatadores';

export default function FinancasLojaTV({ filtros, onClose }) {
  const [resumo, setResumo] = useState({
    saldoAnterior: 0,
    receitasPagas: 0,
    despesasPagas: 0,
    saldoPeriodo: 0,
    saldoBancario: 0,
    caixaFisico: 0,
    saldoTotal: 0,
    aReceber: 0,
    aPagar: 0,
    troncoSolidariedade: 0,
    banco: 0,
    especie: 0
  });
  const [modalReceitasAberto, setModalReceitasAberto] = useState(false);
  const [detalhesReceitas, setDetalhesReceitas] = useState({ conta: 0, dinheiro: 0 });
  const [loading, setLoading] = useState(true);
  const [agrupamento, setAgrupamento] = useState([]);

  useEffect(() => {
    carregarDados();
  }, [filtros]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      
      // Carregar saldo anterior
      const saldoAnt = await calcularSaldoAnterior();
      
      // Carregar lançamentos do período
      const lancamentos = await buscarLancamentos();
      
      // Calcular resumo
      const receitasPagas = lancamentos
        .filter(l => l.tipo === 'receita' && l.status === 'pago')
        .reduce((sum, l) => sum + parseFloat(l.valor), 0);
        
      const despesasPagas = lancamentos
        .filter(l => l.tipo === 'despesa' && l.status === 'pago')
        .reduce((sum, l) => sum + parseFloat(l.valor), 0);
        
      const aReceber = lancamentos
        .filter(l => l.tipo === 'receita' && l.status === 'pendente')
        .reduce((sum, l) => sum + parseFloat(l.valor), 0);
        
      const aPagar = lancamentos
        .filter(l => l.tipo === 'despesa' && l.status === 'pendente')
        .reduce((sum, l) => sum + parseFloat(l.valor), 0);
      
      // Calcular saldo bancário e caixa físico
      const saldoBancario = await calcularSaldoBancario();
      const caixaFisico = await calcularCaixaFisico();
      
      // Calcular tronco
      const tronco = await calcularTroncoTotal();
      
      // Calcular agrupamento
      const agrup = calcularAgrupamento(lancamentos);
      
      setResumo({
        saldoAnterior: saldoAnt,
        receitasPagas,
        despesasPagas,
        saldoPeriodo: receitasPagas - despesasPagas,
        saldoBancario,
        caixaFisico,
        saldoTotal: saldoBancario + caixaFisico,
        aReceber,
        aPagar,
        troncoSolidariedade: tronco.total,
        banco: tronco.banco,
        especie: tronco.especie
      });
      
      setAgrupamento(agrup);
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const calcularSaldoAnterior = async () => {
    try {
      const { mes, ano } = filtros;
      
      let query = supabase
        .from('lancamentos_loja')
        .select('tipo, valor, data_pagamento')
        .eq('status', 'pago');

      if (mes > 0 && ano > 0) {
        const dataInicio = new Date(1900, 0, 1).toISOString().split('T')[0];
        const dataFim = new Date(ano, mes - 1, 0).toISOString().split('T')[0];
        query = query.gte('data_pagamento', dataInicio).lte('data_pagamento', dataFim);
      } else if (ano > 0) {
        const dataInicio = new Date(1900, 0, 1).toISOString().split('T')[0];
        const dataFim = new Date(ano - 1, 11, 31).toISOString().split('T')[0];
        query = query.gte('data_pagamento', dataInicio).lte('data_pagamento', dataFim);
      }

      const { data, error } = await query;
      if (error) throw error;

      const receitas = data.filter(l => l.tipo === 'receita').reduce((sum, l) => sum + parseFloat(l.valor), 0);
      const despesas = data.filter(l => l.tipo === 'despesa').reduce((sum, l) => sum + parseFloat(l.valor), 0);

      return receitas - despesas;
    } catch (error) {
      console.error('Erro ao calcular saldo anterior:', error);
      return 0;
    }
  };

  const buscarLancamentos = async () => {
    try {
      const { mes, ano } = filtros;
      
      let query = supabase.from('lancamentos_loja').select('*');

      if (mes > 0 && ano > 0) {
        const dataInicio = new Date(ano, mes - 1, 1).toISOString().split('T')[0];
        const dataFim = new Date(ano, mes, 0).toISOString().split('T')[0];
        query = query.or(`and(status.eq.pago,data_pagamento.gte.${dataInicio},data_pagamento.lte.${dataFim}),and(status.eq.pendente,data_vencimento.gte.${dataInicio},data_vencimento.lte.${dataFim})`);
      } else if (ano > 0) {
        const dataInicio = new Date(ano, 0, 1).toISOString().split('T')[0];
        const dataFim = new Date(ano, 11, 31).toISOString().split('T')[0];
        query = query.or(`and(status.eq.pago,data_pagamento.gte.${dataInicio},data_pagamento.lte.${dataFim}),and(status.eq.pendente,data_vencimento.gte.${dataInicio},data_vencimento.lte.${dataFim})`);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar lançamentos:', error);
      return [];
    }
  };

  const calcularSaldoBancario = async () => {
    try {
      const { data, error } = await supabase
        .from('lancamentos_loja')
        .select('tipo, valor')
        .eq('status', 'pago')
        .in('tipo_pagamento', ['pix', 'transferencia', 'debito', 'credito', 'cheque']);

      if (error) throw error;

      const receitas = data.filter(l => l.tipo === 'receita').reduce((sum, l) => sum + parseFloat(l.valor), 0);
      const despesas = data.filter(l => l.tipo === 'despesa').reduce((sum, l) => sum + parseFloat(l.valor), 0);

      return receitas - despesas;
    } catch (error) {
      console.error('Erro ao calcular saldo bancário:', error);
      return 0;
    }
  };

  const calcularCaixaFisico = async () => {
    try {
      const { data, error } = await supabase
        .from('lancamentos_loja')
        .select('tipo, valor')
        .eq('status', 'pago')
        .eq('tipo_pagamento', 'dinheiro');

      if (error) throw error;

      const receitas = data.filter(l => l.tipo === 'receita').reduce((sum, l) => sum + parseFloat(l.valor), 0);
      const despesas = data.filter(l => l.tipo === 'despesa').reduce((sum, l) => sum + parseFloat(l.valor), 0);

      return receitas - despesas;
    } catch (error) {
      console.error('Erro ao calcular caixa físico:', error);
      return 0;
    }
  };

  const calcularTroncoTotal = async () => {
    try {
      const { data, error } = await supabase
        .from('lancamentos_loja')
        .select('*')
        .eq('status', 'pago')
        .ilike('descricao', '%tronco%');

      if (error) throw error;

      let banco = 0, especie = 0;

      data.forEach(lanc => {
        const valor = parseFloat(lanc.valor);
        if (lanc.tipo === 'receita') {
          if (['pix', 'transferencia', 'debito', 'credito', 'cheque'].includes(lanc.tipo_pagamento)) {
            banco += valor;
          } else if (lanc.tipo_pagamento === 'dinheiro') {
            especie += valor;
          }
        }
      });

      return { banco, especie, total: banco + especie };
    } catch (error) {
      console.error('Erro ao calcular tronco:', error);
      return { banco: 0, especie: 0, total: 0 };
    }
  };

  const calcularAgrupamento = (lancamentos) => {
    const agrup = {};
    
    lancamentos.forEach(lanc => {
      const data = lanc.status === 'pago' 
        ? corrigirTimezone(lanc.data_pagamento).toISOString().split('T')[0]
        : corrigirTimezone(lanc.data_vencimento).toISOString().split('T')[0];
      
      if (!agrup[data]) {
        agrup[data] = { receitas: 0, despesas: 0 };
      }
      
      if (lanc.tipo === 'receita') {
        agrup[data].receitas += parseFloat(lanc.valor);
      } else {
        agrup[data].despesas += parseFloat(lanc.valor);
      }
    });
    
    return Object.entries(agrup)
      .map(([data, valores]) => ({
        data,
        receitas: valores.receitas,
        despesas: valores.despesas,
        resultado: valores.receitas - valores.despesas
      }))
      .sort((a, b) => new Date(b.data) - new Date(a.data));
  };

  const abrirDetalhesReceitas = async () => {
    try {
      const lancamentos = await buscarLancamentos();
      const receitasPagas = lancamentos.filter(l => l.tipo === 'receita' && l.status === 'pago');
      
      const conta = receitasPagas
        .filter(l => ['pix', 'transferencia', 'debito', 'credito', 'cheque'].includes(l.tipo_pagamento))
        .reduce((sum, l) => sum + parseFloat(l.valor), 0);
        
      const dinheiro = receitasPagas
        .filter(l => l.tipo_pagamento === 'dinheiro')
        .reduce((sum, l) => sum + parseFloat(l.valor), 0);
      
      setDetalhesReceitas({ conta, dinheiro });
      setModalReceitasAberto(true);
    } catch (error) {
      console.error('Erro ao buscar detalhes:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-4xl">⏳ Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 p-8">
      {/* Botão Fechar */}
      <button
        onClick={onClose}
        className="fixed top-4 right-4 bg-red-600 text-white px-6 py-3 rounded-lg text-xl font-bold hover:bg-red-700 z-50"
      >
        ✕ Fechar
      </button>

      {/* Título */}
      <div className="text-center mb-8">
        <h1 className="text-6xl font-bold text-white mb-2">💰 Finanças da Loja</h1>
        <p className="text-3xl text-blue-200">
          {filtros.mes > 0 && filtros.ano > 0 
            ? `${['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][filtros.mes - 1]} / ${filtros.ano}`
            : filtros.ano > 0 ? `${filtros.ano}` : 'Período Total'}
        </p>
      </div>

      {/* Quadros Principais */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        {/* Saldo Anterior */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl p-6 shadow-2xl">
          <div className="text-white">
            <p className="text-2xl mb-2">💰 Saldo Anterior</p>
            <p className="text-4xl font-bold">{formatarMoeda(resumo.saldoAnterior)}</p>
            <p className="text-lg mt-2">Antes de {filtros.mes > 0 ? ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][filtros.mes - 1] : 'Jan'}/{filtros.ano}</p>
          </div>
        </div>

        {/* Receitas Pagas - COM DUPLO CLIQUE */}
        <div 
          onDoubleClick={abrirDetalhesReceitas}
          className="bg-gradient-to-br from-green-500 to-green-700 rounded-xl p-6 shadow-2xl cursor-pointer hover:scale-105 transition-transform"
        >
          <div className="text-white">
            <p className="text-2xl mb-2">💵 Receitas Pagas</p>
            <p className="text-4xl font-bold">{formatarMoeda(resumo.receitasPagas)}</p>
            <p className="text-lg mt-2">Total recebido</p>
          </div>
        </div>

        {/* Despesas Pagas */}
        <div className="bg-gradient-to-br from-red-500 to-red-700 rounded-xl p-6 shadow-2xl">
          <div className="text-white">
            <p className="text-2xl mb-2">💳 Despesas Pagas</p>
            <p className="text-4xl font-bold">{formatarMoeda(resumo.despesasPagas)}</p>
            <p className="text-lg mt-2">Total pago</p>
          </div>
        </div>

        {/* Saldo do Período */}
        <div className={`bg-gradient-to-br ${resumo.saldoPeriodo >= 0 ? 'from-blue-500 to-blue-700' : 'from-orange-500 to-orange-700'} rounded-xl p-6 shadow-2xl`}>
          <div className="text-white">
            <p className="text-2xl mb-2">💎 Saldo do Período</p>
            <p className="text-4xl font-bold">{formatarMoeda(resumo.saldoPeriodo)}</p>
            <p className="text-lg mt-2">Receitas - Despesas</p>
          </div>
        </div>
      </div>

      {/* Quadros Secundários */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        {/* Saldo Bancário */}
        <div className="bg-gradient-to-br from-cyan-500 to-cyan-700 rounded-xl p-6 shadow-2xl">
          <div className="text-white">
            <p className="text-2xl mb-2">🏦 Saldo Bancário</p>
            <p className="text-4xl font-bold">{formatarMoeda(resumo.saldoBancario)}</p>
            <p className="text-lg mt-2">PIX, Transf., Cartão</p>
          </div>
        </div>

        {/* Caixa Físico */}
        <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-xl p-6 shadow-2xl">
          <div className="text-white">
            <p className="text-2xl mb-2">💵 Caixa Físico</p>
            <p className="text-4xl font-bold">{formatarMoeda(resumo.caixaFisico)}</p>
            <p className="text-lg mt-2">Dinheiro não depositado</p>
          </div>
        </div>

        {/* Saldo Total */}
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl p-6 shadow-2xl">
          <div className="text-white">
            <p className="text-2xl mb-2">💰 Saldo Total</p>
            <p className="text-4xl font-bold">{formatarMoeda(resumo.saldoTotal)}</p>
            <p className="text-lg mt-2">Bancário + Caixa</p>
          </div>
        </div>
      </div>

      {/* Contas a Receber/Pagar */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-gradient-to-br from-yellow-500 to-yellow-700 rounded-xl p-6 shadow-2xl">
          <div className="text-white">
            <p className="text-2xl mb-2">💰 A Receber</p>
            <p className="text-4xl font-bold">{formatarMoeda(resumo.aReceber)}</p>
            <p className="text-lg mt-2">Pendentes</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-600 to-red-800 rounded-xl p-6 shadow-2xl">
          <div className="text-white">
            <p className="text-2xl mb-2">💳 A Pagar</p>
            <p className="text-4xl font-bold">{formatarMoeda(resumo.aPagar)}</p>
            <p className="text-lg mt-2">Pendentes</p>
          </div>
        </div>
      </div>

      {/* Tronco de Solidariedade */}
      <div className="bg-gradient-to-br from-amber-500 to-amber-700 rounded-xl p-6 shadow-2xl mb-8">
        <div className="text-white">
          <p className="text-3xl mb-3">🪙 Tronco de Solidariedade</p>
          <p className="text-xl mb-2">Saldo acumulado</p>
          <p className="text-5xl font-bold">{formatarMoeda(resumo.troncoSolidariedade)}</p>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-white bg-opacity-20 rounded-lg p-4">
              <p className="text-xl">🏦 Banco</p>
              <p className="text-3xl font-bold">{formatarMoeda(resumo.banco)}</p>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-4">
              <p className="text-xl">💵 Espécie</p>
              <p className="text-3xl font-bold">{formatarMoeda(resumo.especie)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela de Lançamentos Agrupados */}
      <div className="bg-white rounded-xl shadow-2xl p-6">
        <h2 className="text-3xl font-bold mb-4 text-gray-800">📊 Movimentação do Período</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xl">
            <thead>
              <tr className="bg-gray-200">
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3 text-right">Receitas</th>
                <th className="px-4 py-3 text-right">Despesas</th>
                <th className="px-4 py-3 text-right">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {agrupamento.map((item, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">{new Date(item.data + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3 text-right text-green-600 font-bold">{formatarMoeda(item.receitas)}</td>
                  <td className="px-4 py-3 text-right text-red-600 font-bold">{formatarMoeda(item.despesas)}</td>
                  <td className={`px-4 py-3 text-right font-bold ${item.resultado >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                    {formatarMoeda(item.resultado)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Detalhes de Receitas */}
      {modalReceitasAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-2xl shadow-2xl">
            <h3 className="text-4xl font-bold mb-6 text-gray-800">💵 Detalhamento de Receitas Pagas</h3>
            <div className="space-y-4">
              <div className="bg-blue-50 p-6 rounded-xl border-2 border-blue-200">
                <p className="text-2xl text-gray-700 mb-2">🏦 Recebido em Conta</p>
                <p className="text-5xl font-bold text-blue-600">{formatarMoeda(detalhesReceitas.conta)}</p>
              </div>
              <div className="bg-green-50 p-6 rounded-xl border-2 border-green-200">
                <p className="text-2xl text-gray-700 mb-2">💵 Recebido em Dinheiro</p>
                <p className="text-5xl font-bold text-green-600">{formatarMoeda(detalhesReceitas.dinheiro)}</p>
              </div>
              <div className="bg-purple-50 p-6 rounded-xl border-2 border-purple-200">
                <p className="text-2xl text-gray-700 mb-2">💰 Total Recebido</p>
                <p className="text-5xl font-bold text-purple-600">{formatarMoeda(detalhesReceitas.conta + detalhesReceitas.dinheiro)}</p>
              </div>
            </div>
            <button
              onClick={() => setModalReceitasAberto(false)}
              className="mt-6 w-full bg-gray-600 text-white py-4 rounded-xl text-2xl font-bold hover:bg-gray-700"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
