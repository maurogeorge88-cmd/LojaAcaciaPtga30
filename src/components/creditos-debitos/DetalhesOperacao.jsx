import React, { useState, useEffect } from 'react';
import { supabase } from '../../App';

export default function DetalhesOperacao({ operacaoId, onClose, onUpdate, showSuccess, showError }) {
  const [operacao, setOperacao] = useState(null);
  const [parcelas, setParcelas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalQuitacao, setModalQuitacao] = useState(false);
  const [parcelaAtual, setParcelaAtual] = useState(null);

  // Formulário de quitação
  const [formQuitacao, setFormQuitacao] = useState({
    valor_pago: '',
    data_pagamento: new Date().toISOString().split('T')[0],
    meio_pagamento: 'pix',
    observacoes: ''
  });

  useEffect(() => {
    carregarDados();
  }, [operacaoId]);

  useEffect(() => {
    // Atualizar dias de atraso quando carregar parcelas
    if (parcelas.length > 0) {
      atualizarDiasAtraso();
    }
  }, [parcelas]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      // Carregar operação
      const { data: opData, error: opError } = await supabase
        .from('operacoes_credito_debito')
        .select('*, entidades_financeiras(nome, tipo)')
        .eq('id', operacaoId)
        .single();

      if (opError) throw opError;
      setOperacao(opData);

      // Carregar parcelas
      const { data: parcData, error: parcError } = await supabase
        .from('parcelas_operacoes')
        .select('*')
        .eq('operacao_id', operacaoId)
        .order('numero_parcela');

      if (parcError) throw parcError;
      setParcelas(parcData || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      showError('Erro ao carregar detalhes');
    } finally {
      setLoading(false);
    }
  };

  const atualizarDiasAtraso = async () => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const parcelasAtualizadas = parcelas.map(parcela => {
      if (parcela.status === 'pendente') {
        const vencimento = new Date(parcela.data_vencimento);
        vencimento.setHours(0, 0, 0, 0);
        
        if (vencimento < hoje) {
          const diasAtraso = Math.floor((hoje - vencimento) / (1000 * 60 * 60 * 24));
          return { ...parcela, dias_atraso: diasAtraso, status: 'atrasado' };
        }
      }
      return parcela;
    });

    setParcelas(parcelasAtualizadas);
  };

  const abrirModalQuitacao = (parcela) => {
    setParcelaAtual(parcela);
    setFormQuitacao({
      valor_pago: parcela.valor.toFixed(2),
      data_pagamento: new Date().toISOString().split('T')[0],
      meio_pagamento: operacao?.meio_pagamento || 'pix',
      observacoes: ''
    });
    setModalQuitacao(true);
  };

  const quitarParcela = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const valorPago = parseFloat(formQuitacao.valor_pago);
      
      if (!valorPago || valorPago <= 0) {
        showError('Valor pago deve ser maior que zero');
        setLoading(false);
        return;
      }

      // Atualizar parcela
      const { error: errorParcela } = await supabase
        .from('parcelas_operacoes')
        .update({
          status: 'pago',
          valor_pago: valorPago,
          data_pagamento: formQuitacao.data_pagamento,
          meio_pagamento: formQuitacao.meio_pagamento,
          observacoes: formQuitacao.observacoes.trim() || null,
          dias_atraso: 0
        })
        .eq('id', parcelaAtual.id);

      if (errorParcela) throw errorParcela;

      // Recalcular totais da operação
      const { data: todasParcelas } = await supabase
        .from('parcelas_operacoes')
        .select('valor_pago')
        .eq('operacao_id', operacaoId);

      const totalPago = todasParcelas.reduce((sum, p) => sum + (p.valor_pago || 0), 0);
      const saldoDevedor = operacao.valor_total - totalPago;
      const novoStatus = saldoDevedor <= 0.01 ? 'quitado' : 'ativo';

      // Atualizar operação
      const { error: errorOp } = await supabase
        .from('operacoes_credito_debito')
        .update({
          valor_pago: totalPago,
          saldo_devedor: saldoDevedor,
          status: novoStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', operacaoId);

      if (errorOp) throw errorOp;

      showSuccess('Parcela quitada com sucesso!');
      setModalQuitacao(false);
      
      // FORÇAR RECARREGAMENTO IMEDIATO
      await carregarDados();
      
      // Notificar componente pai para atualizar lista
      if (onUpdate) {
        await onUpdate();
      }
    } catch (error) {
      console.error('Erro ao quitar parcela:', error);
      showError('Erro ao quitar parcela');
    } finally {
      setLoading(false);
    }
  };

  const estornarParcela = async (parcela) => {
    if (!window.confirm(`Deseja estornar o pagamento da parcela ${parcela.numero_parcela}?`)) {
      return;
    }

    setLoading(true);

    try {
      // Atualizar parcela
      const { error: errorParcela } = await supabase
        .from('parcelas_operacoes')
        .update({
          status: 'pendente',
          valor_pago: 0,
          data_pagamento: null,
          observacoes: `Estornado em ${new Date().toLocaleDateString('pt-BR')}. ${parcela.observacoes || ''}`
        })
        .eq('id', parcela.id);

      if (errorParcela) throw errorParcela;

      // Recalcular totais
      const { data: todasParcelas } = await supabase
        .from('parcelas_operacoes')
        .select('valor_pago')
        .eq('operacao_id', operacaoId);

      const totalPago = todasParcelas.reduce((sum, p) => sum + (p.valor_pago || 0), 0);
      const saldoDevedor = operacao.valor_total - totalPago;

      await supabase
        .from('operacoes_credito_debito')
        .update({
          valor_pago: totalPago,
          saldo_devedor: saldoDevedor,
          status: 'ativo',
          updated_at: new Date().toISOString()
        })
        .eq('id', operacaoId);

      showSuccess('Pagamento estornado com sucesso!');
      
      // FORÇAR RECARREGAMENTO IMEDIATO
      await carregarDados();
      
      // Notificar componente pai para atualizar lista
      if (onUpdate) {
        await onUpdate();
      }
    } catch (error) {
      console.error('Erro ao estornar parcela:', error);
      showError('Erro ao estornar parcela');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status, diasAtraso = 0) => {
    const badges = {
      'pendente': { color: 'bg-yellow-100 text-yellow-800 border-yellow-300', label: '⏳ Pendente', icon: '⏳' },
      'pago': { color: 'bg-green-100 text-green-800 border-green-300', label: '✓ Pago', icon: '✓' },
      'atrasado': { color: 'bg-red-100 text-red-800 border-red-300', label: `🚨 Atrasado (${diasAtraso}d)`, icon: '🚨' },
      'cancelado': { color: 'bg-gray-100 text-gray-800 border-gray-300', label: '✗ Cancelado', icon: '✗' }
    };
    return badges[status] || badges.pendente;
  };

  const getTipoIcon = () => {
    return operacao?.tipo_operacao === 'credito' ? '💵' : '💳';
  };

  const getTipoLabel = () => {
    return operacao?.tipo_operacao === 'credito' ? 'Crédito (A Receber)' : 'Débito (A Pagar)';
  };

  const getTipoColor = () => {
    return operacao?.tipo_operacao === 'credito' ? 'green' : 'red';
  };

  if (loading && !operacao) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando detalhes...</p>
        </div>
      </div>
    );
  }

  if (!operacao) {
    return null;
  }

  const percentualPago = operacao.valor_total > 0 
    ? ((operacao.valor_pago / operacao.valor_total) * 100).toFixed(1)
    : 0;

  const parcelasPagas = parcelas.filter(p => p.status === 'pago').length;
  const parcelasAtrasadas = parcelas.filter(p => p.status === 'atrasado').length;
  const parcelasPendentes = parcelas.filter(p => p.status === 'pendente').length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full my-8">
        {/* HEADER */}
        <div 
          className="p-6 text-white flex items-center justify-between"
          style={{
            background: operacao.tipo_operacao === 'credito' 
              ? 'linear-gradient(to right, #16a34a, #15803d)'
              : 'linear-gradient(to right, #dc2626, #b91c1c)'
          }}
        >
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              {getTipoIcon()} Detalhes da Operação
            </h2>
            <p className="text-green-100 mt-1">{getTipoLabel()}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-all"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* INFORMAÇÕES DA OPERAÇÃO */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="text-lg font-bold text-gray-800 mb-3">📋 Informações Gerais</h3>
            
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <span className="text-xs text-gray-600 block">Entidade</span>
                <span className="font-bold text-sm">{operacao.entidade_nome}</span>
              </div>
              <div>
                <span className="text-xs text-gray-600 block">Data de Lançamento</span>
                <span className="font-semibold text-sm">{new Date(operacao.data_lancamento).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>

            {operacao.descricao && (
              <div className="mb-3">
                <span className="text-xs text-gray-600 block">Descrição</span>
                <span className="font-semibold text-sm">{operacao.descricao}</span>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white rounded-lg p-3 border-2 border-gray-200">
                <span className="text-xs text-gray-600 block">Valor Total</span>
                <span className={`font-bold text-lg ${operacao.tipo_operacao === 'credito' ? 'text-green-600' : 'text-red-600'}`}>
                  R$ {operacao.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="bg-white rounded-lg p-3 border-2 border-blue-200">
                <span className="text-xs text-gray-600 block">Valor Pago</span>
                <span className="font-bold text-lg text-blue-600">
                  R$ {operacao.valor_pago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="bg-white rounded-lg p-3 border-2 border-orange-200">
                <span className="text-xs text-gray-600 block">Saldo Devedor</span>
                <span className="font-bold text-lg text-orange-600">
                  R$ {operacao.saldo_devedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="bg-white rounded-lg p-3 border-2 border-purple-200">
                <span className="text-xs text-gray-600 block">Progresso</span>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-purple-600 h-2 rounded-full transition-all"
                      style={{ width: `${percentualPago}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-purple-600">{percentualPago}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* RESUMO DAS PARCELAS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-blue-50 rounded-lg p-3 border-2 border-blue-200">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{parcelas.length}</div>
                <div className="text-xs text-blue-700 font-semibold">Total</div>
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-3 border-2 border-green-200">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{parcelasPagas}</div>
                <div className="text-xs text-green-700 font-semibold">✓ Pagas</div>
              </div>
            </div>

            <div className="bg-yellow-50 rounded-lg p-3 border-2 border-yellow-200">
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{parcelasPendentes}</div>
                <div className="text-xs text-yellow-700 font-semibold">⏳ Pendentes</div>
              </div>
            </div>

            <div className="bg-red-50 rounded-lg p-3 border-2 border-red-200">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{parcelasAtrasadas}</div>
                <div className="text-xs text-red-700 font-semibold">🚨 Atrasadas</div>
              </div>
            </div>
          </div>

          {/* LISTA DE PARCELAS */}
          <div>
            <h3 className="text-lg font-bold text-gray-800 mb-3">📅 Parcelas</h3>
            
            {parcelas.length === 0 ? (
              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <p className="text-gray-600">Nenhuma parcela cadastrada</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {parcelas.map(parcela => {
                  const statusBadge = getStatusBadge(parcela.status, parcela.dias_atraso);
                  
                  return (
                    <div 
                      key={parcela.id} 
                      className={`bg-white rounded-lg p-3 border-2 ${
                        statusBadge.color.includes('red') ? 'border-red-300' : 
                        statusBadge.color.includes('yellow') ? 'border-yellow-300' : 
                        statusBadge.color.includes('green') ? 'border-green-300' : 
                        'border-gray-300'
                      } hover:shadow-md transition-all`}
                    >
                      {/* Número e Status */}
                      <div className="text-center mb-2">
                        <div className="text-lg font-bold text-gray-700">
                          {parcela.numero_parcela}/{parcelas.length}
                        </div>
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold border ${statusBadge.color}`}>
                          {statusBadge.icon}
                        </span>
                      </div>

                      {/* Valor */}
                      <div className="text-center mb-2">
                        <div className="text-xs text-gray-600">Valor</div>
                        <div className="font-bold text-sm">
                          R$ {parcela.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      </div>

                      {/* Vencimento */}
                      <div className="text-center mb-2">
                        <div className="text-xs text-gray-600">Vencimento</div>
                        <div className="font-semibold text-xs">
                          {new Date(parcela.data_vencimento).toLocaleDateString('pt-BR')}
                        </div>
                      </div>

                      {/* Pagamento (se pago) */}
                      {parcela.status === 'pago' && (
                        <div className="text-center mb-2 bg-green-50 rounded p-1">
                          <div className="text-xs text-green-700">Pago em</div>
                          <div className="font-semibold text-xs text-green-800">
                            {new Date(parcela.data_pagamento).toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                      )}

                      {/* Dias de atraso */}
                      {parcela.status === 'atrasado' && parcela.dias_atraso > 0 && (
                        <div className="text-center mb-2 bg-red-50 rounded p-1">
                          <div className="text-xs font-bold text-red-700">
                            {parcela.dias_atraso} dias
                          </div>
                        </div>
                      )}

                      {/* Botão */}
                      <div className="text-center mt-2">
                        {parcela.status === 'pago' ? (
                          <button
                            onClick={() => estornarParcela(parcela)}
                            className="w-full bg-orange-100 hover:bg-orange-200 text-orange-700 px-2 py-1 rounded font-semibold transition-all text-xs"
                          >
                            ↶ Estornar
                          </button>
                        ) : parcela.status !== 'cancelado' && (
                          <button
                            onClick={() => abrirModalQuitacao(parcela)}
                            className="w-full bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1 rounded font-semibold transition-all text-xs"
                          >
                            💰 Quitar
                          </button>
                        )}
                      </div>

                      {/* Observações (se houver) */}
                      {parcela.observacoes && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <div className="text-xs text-gray-600 truncate" title={parcela.observacoes}>
                            {parcela.observacoes}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* BOTÃO FECHAR */}
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold transition-all"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DE QUITAÇÃO */}
      {modalQuitacao && parcelaAtual && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="bg-green-600 p-6 text-white rounded-t-xl">
              <h3 className="text-xl font-bold">💰 Quitar Parcela {parcelaAtual.numero_parcela}</h3>
            </div>

            <form onSubmit={quitarParcela} className="p-6 space-y-4">
              <div className="bg-blue-50 rounded-lg p-4 mb-4">
                <div className="text-sm text-blue-800">Valor da Parcela</div>
                <div className="text-2xl font-bold text-blue-900">
                  R$ {parcelaAtual.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Valor Pago <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formQuitacao.valor_pago}
                  onChange={(e) => setFormQuitacao({ ...formQuitacao, valor_pago: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Data do Pagamento <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formQuitacao.data_pagamento}
                  onChange={(e) => setFormQuitacao({ ...formQuitacao, data_pagamento: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Meio de Pagamento
                </label>
                <select
                  value={formQuitacao.meio_pagamento}
                  onChange={(e) => setFormQuitacao({ ...formQuitacao, meio_pagamento: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="pix">PIX</option>
                  <option value="transferencia">Transferência</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="cheque">Cheque</option>
                  <option value="boleto">Boleto</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Observações
                </label>
                <textarea
                  value={formQuitacao.observacoes}
                  onChange={(e) => setFormQuitacao({ ...formQuitacao, observacoes: e.target.value })}
                  placeholder="Informações adicionais sobre o pagamento..."
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setModalQuitacao(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold transition-all"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-all disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? 'Quitando...' : 'Confirmar Pagamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
