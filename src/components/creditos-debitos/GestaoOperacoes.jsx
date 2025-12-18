import React, { useState, useEffect } from 'react';
import { supabase } from '../../App';
import DetalhesOperacao from './DetalhesOperacao';

export default function GestaoOperacoes({ tipo, showSuccess, showError }) {
  const [operacoes, setOperacoes] = useState([]);
  const [entidades, setEntidades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState('ativo');
  const [busca, setBusca] = useState('');
  const [operacaoDetalhes, setOperacaoDetalhes] = useState(null);

  // Formulário
  const [formData, setFormData] = useState({
    entidade_id: '',
    valor_total: '',
    forma_pagamento: 'unico',
    meio_pagamento: 'pix',
    numero_parcelas: 1,
    data_lancamento: new Date().toISOString().split('T')[0],
    data_primeiro_vencimento: '',
    descricao: '',
    observacoes: ''
  });

  useEffect(() => {
    carregarDados();
  }, [tipo, filtroStatus]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      await Promise.all([
        carregarOperacoes(),
        carregarEntidades()
      ]);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      showError('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const carregarOperacoes = async () => {
    let query = supabase
      .from('operacoes_credito_debito')
      .select('*, entidades_financeiras(nome, tipo)')
      .eq('tipo_operacao', tipo)
      .order('data_lancamento', { ascending: false });

    if (filtroStatus !== 'todos') {
      query = query.eq('status', filtroStatus);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro:', error);
      return;
    }

    setOperacoes(data || []);
  };

  const carregarEntidades = async () => {
    const { data, error } = await supabase
      .from('entidades_financeiras')
      .select('*')
      .eq('ativo', true)
      .order('nome');

    if (!error) {
      setEntidades(data || []);
    }
  };

  const abrirModalNovo = () => {
    setFormData({
      entidade_id: '',
      valor_total: '',
      forma_pagamento: 'unico',
      meio_pagamento: 'pix',
      numero_parcelas: 1,
      data_lancamento: new Date().toISOString().split('T')[0],
      data_primeiro_vencimento: '',
      descricao: '',
      observacoes: ''
    });
    setModoEdicao(false);
    setModalAberto(true);
  };

  const abrirModalEdicao = (operacao) => {
    setFormData({
      id: operacao.id,
      entidade_id: operacao.entidade_id,
      valor_total: operacao.valor_total,
      forma_pagamento: operacao.forma_pagamento,
      meio_pagamento: operacao.meio_pagamento || 'pix',
      numero_parcelas: operacao.numero_parcelas,
      data_lancamento: operacao.data_lancamento,
      data_primeiro_vencimento: operacao.data_primeiro_vencimento || '',
      descricao: operacao.descricao || '',
      observacoes: operacao.observacoes || ''
    });
    setModoEdicao(true);
    setModalAberto(true);
  };

  const calcularValorParcela = () => {
    const valor = parseFloat(formData.valor_total) || 0;
    const parcelas = parseInt(formData.numero_parcelas) || 1;
    return (valor / parcelas).toFixed(2);
  };

  const gerarParcelas = async (operacaoId, valorTotal, numeroParcelas, dataVencimento) => {
    const valorParcela = parseFloat((valorTotal / numeroParcelas).toFixed(2));
    const parcelas = [];

    for (let i = 1; i <= numeroParcelas; i++) {
      const data = new Date(dataVencimento);
      data.setMonth(data.getMonth() + (i - 1));

      parcelas.push({
        operacao_id: operacaoId,
        numero_parcela: i,
        valor: valorParcela,
        data_vencimento: data.toISOString().split('T')[0],
        status: 'pendente'
      });
    }

    const { error } = await supabase
      .from('parcelas_operacoes')
      .insert(parcelas);

    if (error) throw error;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validações
      if (!formData.entidade_id) {
        showError('Selecione uma entidade');
        setLoading(false);
        return;
      }

      const valorTotal = parseFloat(formData.valor_total);
      if (!valorTotal || valorTotal <= 0) {
        showError('Valor deve ser maior que zero');
        setLoading(false);
        return;
      }

      if (formData.forma_pagamento === 'parcelado') {
        if (!formData.data_primeiro_vencimento) {
          showError('Data do primeiro vencimento é obrigatória para parcelamento');
          setLoading(false);
          return;
        }
        if (formData.numero_parcelas < 2) {
          showError('Número de parcelas deve ser maior que 1');
          setLoading(false);
          return;
        }
      }

      // Buscar nome da entidade
      const entidade = entidades.find(e => e.id === formData.entidade_id);

      const valorParcela = formData.forma_pagamento === 'parcelado' 
        ? parseFloat((valorTotal / formData.numero_parcelas).toFixed(2))
        : valorTotal;

      if (modoEdicao) {
        // Atualizar operação
        const { error } = await supabase
          .from('operacoes_credito_debito')
          .update({
            entidade_id: formData.entidade_id,
            entidade_nome: entidade?.nome,
            valor_total: valorTotal,
            forma_pagamento: formData.forma_pagamento,
            meio_pagamento: formData.meio_pagamento,
            numero_parcelas: formData.numero_parcelas,
            valor_parcela: valorParcela,
            data_lancamento: formData.data_lancamento,
            data_primeiro_vencimento: formData.data_primeiro_vencimento || null,
            descricao: formData.descricao.trim() || null,
            observacoes: formData.observacoes.trim() || null,
            saldo_devedor: valorTotal,
            updated_at: new Date().toISOString()
          })
          .eq('id', formData.id);

        if (error) throw error;
        showSuccess('Operação atualizada com sucesso!');
      } else {
        // Criar nova operação
        const { data: novaOperacao, error: errorOp } = await supabase
          .from('operacoes_credito_debito')
          .insert([{
            tipo_operacao: tipo,
            entidade_id: formData.entidade_id,
            entidade_nome: entidade?.nome,
            valor_total: valorTotal,
            forma_pagamento: formData.forma_pagamento,
            meio_pagamento: formData.meio_pagamento,
            numero_parcelas: formData.numero_parcelas,
            valor_parcela: valorParcela,
            data_lancamento: formData.data_lancamento,
            data_primeiro_vencimento: formData.data_primeiro_vencimento || null,
            descricao: formData.descricao.trim() || null,
            observacoes: formData.observacoes.trim() || null,
            status: 'ativo',
            valor_pago: 0,
            saldo_devedor: valorTotal
          }])
          .select()
          .single();

        if (errorOp) throw errorOp;

        // Gerar parcelas se for parcelado
        if (formData.forma_pagamento === 'parcelado') {
          await gerarParcelas(
            novaOperacao.id,
            valorTotal,
            formData.numero_parcelas,
            formData.data_primeiro_vencimento
          );
        } else if (formData.forma_pagamento === 'unico' && formData.data_primeiro_vencimento) {
          // Criar parcela única
          await supabase
            .from('parcelas_operacoes')
            .insert([{
              operacao_id: novaOperacao.id,
              numero_parcela: 1,
              valor: valorTotal,
              data_vencimento: formData.data_primeiro_vencimento,
              status: 'pendente'
            }]);
        }

        showSuccess(`${tipo === 'credito' ? 'Crédito' : 'Débito'} cadastrado com sucesso!`);
      }

      setModalAberto(false);
      carregarOperacoes();
    } catch (error) {
      console.error('Erro ao salvar operação:', error);
      showError('Erro ao salvar operação');
    } finally {
      setLoading(false);
    }
  };

  const cancelarOperacao = async (id, descricao) => {
    if (!window.confirm(`Deseja realmente cancelar esta operação?\n"${descricao}"`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('operacoes_credito_debito')
        .update({ 
          status: 'cancelado',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      // Cancelar todas as parcelas pendentes
      await supabase
        .from('parcelas_operacoes')
        .update({ status: 'cancelado' })
        .eq('operacao_id', id)
        .eq('status', 'pendente');

      showSuccess('Operação cancelada com sucesso!');
      carregarOperacoes();
    } catch (error) {
      console.error('Erro ao cancelar operação:', error);
      showError('Erro ao cancelar operação');
    }
  };

  // Filtrar operações
  const operacoesFiltradas = operacoes.filter(op => {
    const matchBusca = 
      op.entidade_nome?.toLowerCase().includes(busca.toLowerCase()) ||
      op.descricao?.toLowerCase().includes(busca.toLowerCase());
    return matchBusca;
  });

  const getTipoLabel = () => {
    return tipo === 'credito' ? 'Crédito (A Receber)' : 'Débito (A Pagar)';
  };

  const getTipoIcon = () => {
    return tipo === 'credito' ? '💵' : '💳';
  };

  const getTipoColor = () => {
    return tipo === 'credito' ? 'green' : 'red';
  };

  const getStatusBadge = (status) => {
    const badges = {
      'ativo': { color: 'bg-green-100 text-green-800', label: '✓ Ativo' },
      'quitado': { color: 'bg-blue-100 text-blue-800', label: '✓ Quitado' },
      'cancelado': { color: 'bg-gray-100 text-gray-800', label: '✗ Cancelado' }
    };
    return badges[status] || badges.ativo;
  };

  const getFormaPagamentoLabel = (forma) => {
    const formas = {
      'unico': 'Pagamento Único',
      'parcelado': 'Parcelado',
      'compensacao': 'Compensação'
    };
    return formas[forma] || forma;
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            {getTipoIcon()} {getTipoLabel()}
          </h2>
          <p className="text-gray-600 mt-1">
            {tipo === 'credito' 
              ? 'Valores a receber de terceiros'
              : 'Valores a pagar para terceiros'}
          </p>
        </div>
        <button
          onClick={abrirModalNovo}
          className={`bg-${getTipoColor()}-600 hover:bg-${getTipoColor()}-700 text-white px-6 py-3 rounded-lg font-semibold shadow-lg transition-all flex items-center gap-2`}
          style={{
            backgroundColor: tipo === 'credito' ? '#16a34a' : '#dc2626',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = tipo === 'credito' ? '#15803d' : '#b91c1c';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = tipo === 'credito' ? '#16a34a' : '#dc2626';
          }}
        >
          ➕ Nova Operação
        </button>
      </div>

      {/* FILTROS */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Busca */}
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              🔍 Buscar
            </label>
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Entidade ou descrição..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              📊 Status
            </label>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ativo">Ativos</option>
              <option value="quitado">Quitados</option>
              <option value="cancelado">Cancelados</option>
              <option value="todos">Todos</option>
            </select>
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          Mostrando <strong>{operacoesFiltradas.length}</strong> de <strong>{operacoes.length}</strong> operações
        </div>
      </div>

      {/* LISTA DE OPERAÇÕES */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Carregando...</p>
          </div>
        </div>
      ) : operacoesFiltradas.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <div className="text-6xl mb-4">{getTipoIcon()}</div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">
            {operacoes.length === 0 
              ? `Nenhum ${tipo === 'credito' ? 'crédito' : 'débito'} cadastrado`
              : 'Nenhuma operação encontrada'}
          </h3>
          <p className="text-gray-600 mb-6">
            {operacoes.length === 0 
              ? `Comece cadastrando seu primeiro ${tipo === 'credito' ? 'crédito' : 'débito'}`
              : 'Tente ajustar os filtros de busca'}
          </p>
          {operacoes.length === 0 && (
            <button
              onClick={abrirModalNovo}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
            >
              ➕ Cadastrar Primeira Operação
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {operacoesFiltradas.map(operacao => {
            const statusBadge = getStatusBadge(operacao.status);
            const percentualPago = operacao.valor_total > 0 
              ? ((operacao.valor_pago / operacao.valor_total) * 100).toFixed(1)
              : 0;

            return (
              <div key={operacao.id} className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all">
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    {/* Informações */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-xl font-bold text-gray-800">
                          {operacao.entidade_nome || 'Entidade não informada'}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadge.color}`}>
                          {statusBadge.label}
                        </span>
                        {operacao.forma_pagamento === 'parcelado' && (
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                            📅 {operacao.numero_parcelas}x
                          </span>
                        )}
                      </div>

                      {operacao.descricao && (
                        <p className="text-gray-700 mb-3">{operacao.descricao}</p>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500 block">Valor Total</span>
                          <span className={`font-bold text-lg ${tipo === 'credito' ? 'text-green-600' : 'text-red-600'}`}>
                            R$ {operacao.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div>
                          <span className="text-gray-500 block">Valor Pago</span>
                          <span className="font-semibold text-blue-600">
                            R$ {operacao.valor_pago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div>
                          <span className="text-gray-500 block">Saldo Devedor</span>
                          <span className="font-semibold text-orange-600">
                            R$ {operacao.saldo_devedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div>
                          <span className="text-gray-500 block">Progresso</span>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full transition-all"
                                style={{ width: `${percentualPago}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold">{percentualPago}%</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4 text-sm text-gray-600">
                        <div>
                          <span className="font-semibold">📅 Lançamento:</span> {new Date(operacao.data_lancamento).toLocaleDateString('pt-BR')}
                        </div>
                        <div>
                          <span className="font-semibold">💳 Forma:</span> {getFormaPagamentoLabel(operacao.forma_pagamento)}
                        </div>
                        <div>
                          <span className="font-semibold">💰 Meio:</span> {operacao.meio_pagamento || '-'}
                        </div>
                      </div>

                      {operacao.observacoes && (
                        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
                          <span className="font-semibold text-yellow-800">💡 Obs:</span>
                          <span className="text-yellow-700 ml-2">{operacao.observacoes}</span>
                        </div>
                      )}
                    </div>

                    {/* Ações */}
                    <div className="flex flex-col gap-2 ml-4">
                      <button
                        onClick={() => setOperacaoDetalhes(operacao.id)}
                        className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-lg font-semibold transition-all text-sm whitespace-nowrap"
                      >
                        👁️ Detalhes
                      </button>
                      
                      {operacao.status === 'ativo' && (
                        <>
                          <button
                            onClick={() => abrirModalEdicao(operacao)}
                            className="bg-yellow-100 hover:bg-yellow-200 text-yellow-700 px-4 py-2 rounded-lg font-semibold transition-all text-sm"
                          >
                            ✏️ Editar
                          </button>
                          <button
                            onClick={() => cancelarOperacao(operacao.id, operacao.descricao || operacao.entidade_nome)}
                            className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg font-semibold transition-all text-sm"
                          >
                            🗑️ Cancelar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE CADASTRO/EDIÇÃO */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div 
              className="p-6 text-white"
              style={{
                background: tipo === 'credito' 
                  ? 'linear-gradient(to right, #16a34a, #15803d)'
                  : 'linear-gradient(to right, #dc2626, #b91c1c)'
              }}
            >
              <h3 className="text-2xl font-bold">
                {modoEdicao ? '✏️ Editar' : '➕ Nova'} {tipo === 'credito' ? 'Crédito' : 'Débito'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Entidade */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Entidade <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.entidade_id}
                  onChange={(e) => setFormData({ ...formData, entidade_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Selecione uma entidade</option>
                  {entidades.map(ent => (
                    <option key={ent.id} value={ent.id}>
                      {ent.nome} ({ent.tipo})
                    </option>
                  ))}
                </select>
                {entidades.length === 0 && (
                  <p className="text-sm text-orange-600 mt-1">
                    ⚠️ Nenhuma entidade cadastrada. Cadastre uma entidade primeiro.
                  </p>
                )}
              </div>

              {/* Valor Total e Data */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Valor Total <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.valor_total}
                    onChange={(e) => setFormData({ ...formData, valor_total: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Data de Lançamento <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.data_lancamento}
                    onChange={(e) => setFormData({ ...formData, data_lancamento: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              {/* Forma e Meio de Pagamento */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Forma de Pagamento <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.forma_pagamento}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      forma_pagamento: e.target.value,
                      numero_parcelas: e.target.value === 'parcelado' ? 2 : 1
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="unico">Pagamento Único</option>
                    <option value="parcelado">Parcelado</option>
                    <option value="compensacao">Compensação</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Meio de Pagamento
                  </label>
                  <select
                    value={formData.meio_pagamento}
                    onChange={(e) => setFormData({ ...formData, meio_pagamento: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="pix">PIX</option>
                    <option value="transferencia">Transferência</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="cheque">Cheque</option>
                    <option value="boleto">Boleto</option>
                  </select>
                </div>
              </div>

              {/* Parcelamento */}
              {formData.forma_pagamento === 'parcelado' && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 space-y-4">
                  <h4 className="font-bold text-blue-900">📅 Parcelamento</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Número de Parcelas <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="2"
                        max="120"
                        value={formData.numero_parcelas}
                        onChange={(e) => setFormData({ ...formData, numero_parcelas: parseInt(e.target.value) })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Valor da Parcela
                      </label>
                      <input
                        type="text"
                        value={`R$ ${calcularValorParcela()}`}
                        disabled
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Data do Primeiro Vencimento <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.data_primeiro_vencimento}
                      onChange={(e) => setFormData({ ...formData, data_primeiro_vencimento: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      As demais parcelas serão geradas automaticamente a cada mês
                    </p>
                  </div>
                </div>
              )}

              {/* Vencimento Único */}
              {formData.forma_pagamento === 'unico' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Data de Vencimento
                  </label>
                  <input
                    type="date"
                    value={formData.data_primeiro_vencimento}
                    onChange={(e) => setFormData({ ...formData, data_primeiro_vencimento: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}

              {/* Descrição */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Descrição
                </label>
                <input
                  type="text"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Ex: Empréstimo para reforma da loja"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Observações */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Observações
                </label>
                <textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Informações adicionais..."
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Botões */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold transition-all"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 text-white px-6 py-3 rounded-lg font-semibold transition-all disabled:opacity-50"
                  disabled={loading}
                  style={{
                    backgroundColor: tipo === 'credito' ? '#16a34a' : '#dc2626'
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.backgroundColor = tipo === 'credito' ? '#15803d' : '#b91c1c';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = tipo === 'credito' ? '#16a34a' : '#dc2626';
                  }}
                >
                  {loading ? 'Salvando...' : (modoEdicao ? 'Atualizar' : 'Cadastrar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE DETALHES DA OPERAÇÃO */}
      {operacaoDetalhes && (
        <DetalhesOperacao
          operacaoId={operacaoDetalhes}
          onClose={() => {
            setOperacaoDetalhes(null);
            carregarOperacoes(); // Recarregar lista ao fechar
          }}
          onUpdate={() => carregarOperacoes()}
          showSuccess={showSuccess}
          showError={showError}
        />
      )}
    </div>
  );
}
