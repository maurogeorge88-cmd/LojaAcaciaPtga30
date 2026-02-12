import React, { useState, useEffect } from 'react';
import { supabase } from '../../App';
import { formatarMoeda } from './utils/formatadores';

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
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      
      const { mes, ano } = filtros;
      
      // Buscar TODOS os lançamentos COM categorias
      const { data: todosLancamentos, error } = await supabase
        .from('lancamentos_loja')
        .select('*, categorias_financeiras(tipo, nome)')
        .order('data_pagamento', { ascending: false });

      if (error) throw error;

      // Calcular saldo anterior (antes do período)
      const lancamentosAnteriores = todosLancamentos.filter(lanc => {
        if (lanc.status !== 'pago' || !lanc.data_pagamento) return false;
        const d = new Date(lanc.data_pagamento + 'T12:00:00');
        if (mes > 0 && ano > 0) {
          const limite = new Date(ano, mes - 1, 1);
          return d < limite;
        } else if (ano > 0) {
          const limite = new Date(ano, 0, 1);
          return d < limite;
        }
        return false;
      });

      const receitasBancariasAnt = lancamentosAnteriores
        .filter(l => 
          l.categorias_financeiras?.tipo === 'receita' &&
          l.tipo_pagamento !== 'compensacao' &&
          l.tipo_pagamento !== 'dinheiro' &&
          !l.eh_transferencia_interna
        )
        .reduce((sum, l) => sum + parseFloat(l.valor || 0), 0);

      const depositosAnt = lancamentosAnteriores
        .filter(l => 
          l.categorias_financeiras?.tipo === 'receita' &&
          l.eh_transferencia_interna === true
        )
        .reduce((sum, l) => sum + parseFloat(l.valor || 0), 0);

      const despesasAnteriores = lancamentosAnteriores
        .filter(l => 
          l.categorias_financeiras?.tipo === 'despesa' &&
          l.tipo_pagamento !== 'compensacao' &&
          !l.eh_transferencia_interna
        )
        .reduce((sum, l) => sum + parseFloat(l.valor || 0), 0);

      const saldoAnt = receitasBancariasAnt + depositosAnt - despesasAnteriores;
      const lancamentosPeriodo = todosLancamentos.filter(lanc => {
        if (mes > 0 && ano > 0) {
          const data = lanc.status === 'pago' ? lanc.data_pagamento : lanc.data_vencimento;
          if (!data) return false;
          const d = new Date(data + 'T12:00:00');
          return d.getMonth() === mes - 1 && d.getFullYear() === ano;
        } else if (ano > 0) {
          const data = lanc.status === 'pago' ? lanc.data_pagamento : lanc.data_vencimento;
          if (!data) return false;
          const d = new Date(data + 'T12:00:00');
          return d.getFullYear() === ano;
        }
        return true;
      });

      // Calcular resumo do período
      const receitasPagas = lancamentosPeriodo
        .filter(l => l.tipo === 'receita' && l.status === 'pago')
        .reduce((sum, l) => sum + parseFloat(l.valor || 0), 0);
        
      const despesasPagas = lancamentosPeriodo
        .filter(l => l.tipo === 'despesa' && l.status === 'pago')
        .reduce((sum, l) => sum + parseFloat(l.valor || 0), 0);
        
      const aReceber = lancamentosPeriodo
        .filter(l => l.tipo === 'receita' && l.status === 'pendente')
        .reduce((sum, l) => sum + parseFloat(l.valor || 0), 0);
        
      const aPagar = lancamentosPeriodo
        .filter(l => l.tipo === 'despesa' && l.status === 'pendente')
        .reduce((sum, l) => sum + parseFloat(l.valor || 0), 0);

      // Calcular saldo bancário (todos os lançamentos pagos)
      const todosPagos = todosLancamentos.filter(l => l.status === 'pago');
      
      const receitasBanco = todosPagos
        .filter(l => l.tipo === 'receita' && ['pix', 'transferencia', 'debito', 'credito', 'cheque'].includes(l.tipo_pagamento))
        .reduce((sum, l) => sum + parseFloat(l.valor || 0), 0);
      
      const despesasBanco = todosPagos
        .filter(l => l.tipo === 'despesa' && ['pix', 'transferencia', 'debito', 'credito', 'cheque'].includes(l.tipo_pagamento))
        .reduce((sum, l) => sum + parseFloat(l.valor || 0), 0);

      const saldoBancario = receitasBanco - despesasBanco;

      // Calcular caixa físico (EXCLUINDO TRONCO e transferências internas)
      const dinheiroRecebido = todosPagos
        .filter(l => 
          l.categorias_financeiras?.tipo === 'receita' &&
          l.tipo_pagamento === 'dinheiro' &&
          !l.eh_transferencia_interna &&
          !l.categorias_financeiras?.nome?.toLowerCase().includes('tronco')
        )
        .reduce((sum, l) => sum + parseFloat(l.valor || 0), 0);
      
      const sangriasFeitas = todosPagos
        .filter(l => 
          l.eh_transferencia_interna === true && 
          l.categorias_financeiras?.tipo === 'despesa' &&
          !l.categorias_financeiras?.nome?.toLowerCase().includes('tronco')
        )
        .reduce((sum, l) => sum + parseFloat(l.valor || 0), 0);

      const caixaFisico = dinheiroRecebido - sangriasFeitas;

      // Calcular tronco usando categorias
      const receitasBancoTronco = todosPagos
        .filter(l =>
          l.categorias_financeiras?.nome?.toLowerCase().includes('tronco') &&
          l.categorias_financeiras?.tipo === 'receita' &&
          l.tipo_pagamento !== 'dinheiro'
        )
        .reduce((sum, l) => sum + parseFloat(l.valor || 0), 0);

      const receitasEspecieTronco = todosPagos
        .filter(l =>
          l.categorias_financeiras?.nome?.toLowerCase().includes('tronco') &&
          l.categorias_financeiras?.tipo === 'receita' &&
          l.tipo_pagamento === 'dinheiro' &&
          !l.eh_transferencia_interna
        )
        .reduce((sum, l) => sum + parseFloat(l.valor || 0), 0);

      const despesasBancoTronco = todosPagos
        .filter(l =>
          l.categorias_financeiras?.nome?.toLowerCase().includes('tronco') &&
          l.categorias_financeiras?.tipo === 'despesa' &&
          l.tipo_pagamento !== 'dinheiro' &&
          !l.eh_transferencia_interna
        )
        .reduce((sum, l) => sum + parseFloat(l.valor || 0), 0);

      const despesasEspecieTronco = todosPagos
        .filter(l =>
          l.categorias_financeiras?.nome?.toLowerCase().includes('tronco') &&
          l.categorias_financeiras?.tipo === 'despesa' &&
          l.tipo_pagamento === 'dinheiro'
        )
        .reduce((sum, l) => sum + parseFloat(l.valor || 0), 0);

      const troncoBanco = receitasBancoTronco - despesasBancoTronco;
      const troncoEspecie = receitasEspecieTronco - despesasEspecieTronco;

      // Calcular agrupamento
      const agrup = {};
      lancamentosPeriodo.forEach(lanc => {
        const data = lanc.status === 'pago' ? lanc.data_pagamento : lanc.data_vencimento;
        if (!data) return;
        
        if (!agrup[data]) {
          agrup[data] = { receitas: 0, despesas: 0 };
        }
        
        const valor = parseFloat(lanc.valor || 0);
        if (lanc.tipo === 'receita') {
          agrup[data].receitas += valor;
        } else {
          agrup[data].despesas += valor;
        }
      });

      const agrupArray = Object.entries(agrup)
        .map(([data, valores]) => ({
          data,
          receitas: valores.receitas,
          despesas: valores.despesas,
          resultado: valores.receitas - valores.despesas
        }))
        .sort((a, b) => b.data.localeCompare(a.data));

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
        troncoSolidariedade: troncoBanco + troncoEspecie,
        banco: troncoBanco,
        especie: troncoEspecie
      });
      
      setAgrupamento(agrupArray);
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const abrirDetalhesReceitas = async () => {
    try {
      const { mes, ano } = filtros;
      
      const { data: todosLancamentos, error } = await supabase
        .from('lancamentos_loja')
        .select('*');

      if (error) throw error;

      const lancamentosPeriodo = todosLancamentos.filter(lanc => {
        if (lanc.tipo !== 'receita' || lanc.status !== 'pago') return false;
        
        const data = lanc.data_pagamento;
        if (!data) return false;
        
        const d = new Date(data + 'T12:00:00');
        if (mes > 0 && ano > 0) {
          return d.getMonth() === mes - 1 && d.getFullYear() === ano;
        } else if (ano > 0) {
          return d.getFullYear() === ano;
        }
        return true;
      });
      
      const conta = lancamentosPeriodo
        .filter(l => ['pix', 'transferencia', 'debito', 'credito', 'cheque'].includes(l.tipo_pagamento))
        .reduce((sum, l) => sum + parseFloat(l.valor || 0), 0);
        
      const dinheiro = lancamentosPeriodo
        .filter(l => l.tipo_pagamento === 'dinheiro')
        .reduce((sum, l) => sum + parseFloat(l.valor || 0), 0);
      
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

  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

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
            ? `${meses[filtros.mes - 1]} / ${filtros.ano}`
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
            <p className="text-lg mt-2">Antes de {filtros.mes > 0 ? meses[filtros.mes - 1].substring(0, 3) : 'Jan'}/{filtros.ano}</p>
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
