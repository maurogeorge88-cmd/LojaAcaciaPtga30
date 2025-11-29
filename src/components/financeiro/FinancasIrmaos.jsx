import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function FinancasIrmaos({ showSuccess, showError, userEmail }) {
  const [irmaos, setIrmaos] = useState([]);
  const [lancamentos, setLancamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('dashboard'); // 'dashboard', 'gerar', 'pagamentos', 'historico'
  const [mesAnoSelecionado, setMesAnoSelecionado] = useState({
    mes: new Date().getMonth() + 1,
    ano: new Date().getFullYear()
  });
  const [mostrarModalPagamento, setMostrarModalPagamento] = useState(false);
  const [lancamentoSelecionado, setLancamentoSelecionado] = useState(null);
  const [formPagamento, setFormPagamento] = useState({
    data_pagamento: new Date().toISOString().split('T')[0],
    tipo_pagamento: 'dinheiro',
    comprovante_url: '',
    observacoes: ''
  });

  const tiposPagamento = [
    { value: 'dinheiro', label: '💵 Dinheiro' },
    { value: 'pix', label: '📱 PIX' },
    { value: 'cartao', label: '💳 Cartão' },
    { value: 'transferencia', label: '🏦 Transferência' },
    { value: 'cheque', label: '📝 Cheque' }
  ];

  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  useEffect(() => {
    carregarDados();
  }, [mesAnoSelecionado]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      // Carregar irmãos ativos
      const { data: irmaoData, error: irmaoError } = await supabase
        .from('irmaos')
        .select('id, nome, situacao')
        .eq('situacao', 'Ativo')
        .order('nome');

      if (irmaoError) throw irmaoError;
      setIrmaos(irmaoData || []);

      // Carregar lançamentos do mês/ano
      await carregarLancamentos();

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      showError('Erro ao carregar dados: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const carregarLancamentos = async () => {
    try {
      const { mes, ano } = mesAnoSelecionado;
      const primeiroDia = `${ano}-${mes.toString().padStart(2, '0')}-01`;
      const ultimoDia = new Date(ano, mes, 0).getDate();
      const ultimoDiaFormatado = `${ano}-${mes.toString().padStart(2, '0')}-${ultimoDia}`;

      const { data, error } = await supabase
        .from('lancamentos_irmaos_individuais')
        .select(`
          *,
          lancamentos_irmaos!inner(
            referencia_mes_ano,
            data_vencimento
          ),
          irmaos(nome)
        `)
        .gte('lancamentos_irmaos.data_vencimento', primeiroDia)
        .lte('lancamentos_irmaos.data_vencimento', ultimoDiaFormatado)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLancamentos(data || []);
    } catch (error) {
      console.error('Erro ao carregar lançamentos:', error);
    }
  };

  const gerarMensalidades = async () => {
    try {
      const { mes, ano } = mesAnoSelecionado;
      const referenciaMesAno = `${mes.toString().padStart(2, '0')}/${ano}`;
      
      // Verificar se já existem mensalidades para este mês
      const { data: existentes, error: checkError } = await supabase
        .from('lancamentos_irmaos')
        .select('id')
        .eq('referencia_mes_ano', referenciaMesAno);

      if (checkError) throw checkError;

      if (existentes && existentes.length > 0) {
        showError('Mensalidades deste mês já foram geradas!');
        return;
      }

      // Buscar configurações de pagamento dos irmãos ativos
      const { data: configs, error: configError } = await supabase
        .from('configuracao_pagamento_irmaos')
        .select(`
          *,
          irmaos(id, nome, situacao)
        `)
        .eq('ativo', true)
        .eq('irmaos.situacao', 'Ativo');

      if (configError) throw configError;

      if (!configs || configs.length === 0) {
        showError('Nenhum irmão com configuração de pagamento ativa!');
        return;
      }

      // Data de vencimento: dia 10 do mês
      const dataVencimento = `${ano}-${mes.toString().padStart(2, '0')}-10`;

      // Criar lançamento principal
      const { data: lancamentoPrincipal, error: lancError } = await supabase
        .from('lancamentos_irmaos')
        .insert({
          referencia_mes_ano: referenciaMesAno,
          data_vencimento: dataVencimento,
          observacoes: `Mensalidades de ${meses[mes - 1]}/${ano}`
        })
        .select()
        .single();

      if (lancError) throw lancError;

      // Criar lançamentos individuais
      const lancamentosIndividuais = configs.map(config => ({
        lancamento_id: lancamentoPrincipal.id,
        irmao_id: config.irmao_id,
        valor: config.valor_mensalidade,
        status: 'pendente'
      }));

      const { error: indError } = await supabase
        .from('lancamentos_irmaos_individuais')
        .insert(lancamentosIndividuais);

      if (indError) throw indError;

      showSuccess(`${configs.length} mensalidades geradas com sucesso!`);
      await carregarLancamentos();
      setViewMode('dashboard');

    } catch (error) {
      console.error('Erro ao gerar mensalidades:', error);
      showError('Erro ao gerar mensalidades: ' + error.message);
    }
  };

  const abrirModalPagamento = (lancamento) => {
    setLancamentoSelecionado(lancamento);
    setFormPagamento({
      data_pagamento: new Date().toISOString().split('T')[0],
      tipo_pagamento: 'dinheiro',
      comprovante_url: '',
      observacoes: ''
    });
    setMostrarModalPagamento(true);
  };

  const registrarPagamento = async (e) => {
    e.preventDefault();
    
    try {
      const { error } = await supabase
        .from('lancamentos_irmaos_individuais')
        .update({
          status: 'pago',
          data_pagamento: formPagamento.data_pagamento,
          tipo_pagamento: formPagamento.tipo_pagamento,
          comprovante_url: formPagamento.comprovante_url || null,
          observacoes: formPagamento.observacoes || null
        })
        .eq('id', lancamentoSelecionado.id);

      if (error) throw error;

      showSuccess('Pagamento registrado com sucesso!');
      setMostrarModalPagamento(false);
      await carregarLancamentos();

    } catch (error) {
      console.error('Erro ao registrar pagamento:', error);
      showError('Erro ao registrar pagamento: ' + error.message);
    }
  };

  const calcularEstatisticas = () => {
    const total = lancamentos.length;
    const pagos = lancamentos.filter(l => l.status === 'pago').length;
    const pendentes = lancamentos.filter(l => l.status === 'pendente').length;
    const valorTotal = lancamentos.reduce((sum, l) => sum + (parseFloat(l.valor) || 0), 0);
    const valorPago = lancamentos
      .filter(l => l.status === 'pago')
      .reduce((sum, l) => sum + (parseFloat(l.valor) || 0), 0);
    const valorPendente = valorTotal - valorPago;

    return { total, pagos, pendentes, valorTotal, valorPago, valorPendente };
  };

  const stats = calcularEstatisticas();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-xl text-gray-600">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg shadow-lg p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">💰 Finanças dos Irmãos</h2>
        <p className="text-green-100">Controle de mensalidades e pagamentos</p>
      </div>

      {/* SELETOR MÊS/ANO */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mês</label>
            <select
              value={mesAnoSelecionado.mes}
              onChange={(e) => setMesAnoSelecionado({ ...mesAnoSelecionado, mes: parseInt(e.target.value) })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              {meses.map((mes, idx) => (
                <option key={idx} value={idx + 1}>{mes}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ano</label>
            <input
              type="number"
              value={mesAnoSelecionado.ano}
              onChange={(e) => setMesAnoSelecionado({ ...mesAnoSelecionado, ano: parseInt(e.target.value) })}
              min="2020"
              max="2050"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="flex-1"></div>
          <button
            onClick={() => setViewMode('gerar')}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            ➕ Gerar Mensalidades
          </button>
        </div>
      </div>

      {/* MENU */}
      <div className="bg-white rounded-lg shadow p-2">
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('dashboard')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'dashboard'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            📊 Dashboard
          </button>
          <button
            onClick={() => setViewMode('pagamentos')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'pagamentos'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            💳 Pagamentos
          </button>
          <button
            onClick={() => setViewMode('inadimplentes')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'inadimplentes'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            ⚠️ Inadimplentes
          </button>
        </div>
      </div>

      {/* DASHBOARD */}
      {viewMode === 'dashboard' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total de Mensalidades</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <div className="text-4xl">📋</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pagas</p>
                <p className="text-2xl font-bold text-green-600">{stats.pagos}</p>
                <p className="text-sm text-gray-500">R$ {stats.valorPago.toFixed(2)}</p>
              </div>
              <div className="text-4xl">✅</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pendentes</p>
                <p className="text-2xl font-bold text-red-600">{stats.pendentes}</p>
                <p className="text-sm text-gray-500">R$ {stats.valorPendente.toFixed(2)}</p>
              </div>
              <div className="text-4xl">⏳</div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO PARA GERAR */}
      {viewMode === 'gerar' && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            ➕ Gerar Mensalidades
          </h3>
          <p className="text-gray-700 mb-4">
            Confirma a geração das mensalidades de <strong>{meses[mesAnoSelecionado.mes - 1]}/{mesAnoSelecionado.ano}</strong>?
          </p>
          <p className="text-sm text-gray-600 mb-6">
            Serão geradas mensalidades para todos os irmãos ativos com configuração de pagamento.
          </p>
          <div className="flex gap-3">
            <button
              onClick={gerarMensalidades}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              ✅ Confirmar
            </button>
            <button
              onClick={() => setViewMode('dashboard')}
              className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* LISTA DE PAGAMENTOS */}
      {viewMode === 'pagamentos' && (
        <div className="bg-white rounded-lg shadow">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Irmão</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vencimento</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {lancamentos.map((lanc) => (
                  <tr key={lanc.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{lanc.irmaos?.nome}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">R$ {parseFloat(lanc.valor).toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(lanc.lancamentos_irmaos.data_vencimento).toLocaleDateString('pt-BR')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        lanc.status === 'pago'
                          ? 'bg-green-100 text-green-800'
                          : lanc.status === 'pendente'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {lanc.status === 'pago' ? '✅ Pago' : '⏳ Pendente'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {lanc.status === 'pendente' && (
                        <button
                          onClick={() => abrirModalPagamento(lanc)}
                          className="text-green-600 hover:text-green-900 font-medium"
                        >
                          💳 Registrar Pagamento
                        </button>
                      )}
                      {lanc.status === 'pago' && lanc.data_pagamento && (
                        <span className="text-gray-500 text-xs">
                          Pago em {new Date(lanc.data_pagamento).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* INADIMPLENTES */}
      {viewMode === 'inadimplentes' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold text-red-600 mb-4">⚠️ Inadimplentes</h3>
          <div className="space-y-3">
            {lancamentos.filter(l => l.status === 'pendente').map((lanc) => (
              <div key={lanc.id} className="border border-red-200 rounded-lg p-4 bg-red-50">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-900">{lanc.irmaos?.nome}</p>
                    <p className="text-sm text-gray-600">
                      Vencimento: {new Date(lanc.lancamentos_irmaos.data_vencimento).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-red-600">R$ {parseFloat(lanc.valor).toFixed(2)}</p>
                    <button
                      onClick={() => abrirModalPagamento(lanc)}
                      className="text-sm text-green-600 hover:text-green-800 font-medium"
                    >
                      💳 Registrar Pagamento
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {lancamentos.filter(l => l.status === 'pendente').length === 0 && (
              <p className="text-center text-gray-500 py-8">
                ✅ Nenhum inadimplente neste mês!
              </p>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE PAGAMENTO */}
      {mostrarModalPagamento && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              💳 Registrar Pagamento
            </h3>
            <p className="text-gray-700 mb-4">
              <strong>Irmão:</strong> {lancamentoSelecionado?.irmaos?.nome}<br />
              <strong>Valor:</strong> R$ {parseFloat(lancamentoSelecionado?.valor || 0).toFixed(2)}
            </p>

            <form onSubmit={registrarPagamento} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data do Pagamento *</label>
                <input
                  type="date"
                  value={formPagamento.data_pagamento}
                  onChange={(e) => setFormPagamento({ ...formPagamento, data_pagamento: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Pagamento *</label>
                <select
                  value={formPagamento.tipo_pagamento}
                  onChange={(e) => setFormPagamento({ ...formPagamento, tipo_pagamento: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  {tiposPagamento.map(tipo => (
                    <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea
                  value={formPagamento.observacoes}
                  onChange={(e) => setFormPagamento({ ...formPagamento, observacoes: e.target.value })}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="Observações sobre o pagamento (opcional)"
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                >
                  ✅ Confirmar Pagamento
                </button>
                <button
                  type="button"
                  onClick={() => setMostrarModalPagamento(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
