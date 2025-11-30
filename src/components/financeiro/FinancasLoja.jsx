import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function FinancasLoja({ showSuccess, showError, userEmail }) {
  const [categorias, setCategorias] = useState([]);
  const [irmaos, setIrmaos] = useState([]);
  const [lancamentos, setLancamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [mostrarModalIrmaos, setMostrarModalIrmaos] = useState(false);
  const [editando, setEditando] = useState(null);
  const [viewMode, setViewMode] = useState('lancamentos'); // 'lancamentos' ou 'inadimplentes'
  
  const [filtros, setFiltros] = useState({
    mes: new Date().getMonth() + 1,
    ano: new Date().getFullYear(),
    tipo: '', // 'receita' ou 'despesa'
    categoria: '',
    quitado: '' // 'sim', 'nao', ''
  });

  const [formLancamento, setFormLancamento] = useState({
    tipo: 'receita',
    categoria_id: '',
    descricao: '',
    valor: '',
    data_lancamento: new Date().toISOString().split('T')[0],
    data_vencimento: new Date().toISOString().split('T')[0],
    tipo_pagamento: 'dinheiro',
    data_pagamento: '',
    quitado: false,
    comprovante_url: '',
    observacoes: ''
  });

  // Para lançamento em lote de irmãos
  const [lancamentoIrmaos, setLancamentoIrmaos] = useState({
    categoria_id: '',
    descricao: '',
    valor: '',
    data_lancamento: new Date().toISOString().split('T')[0],
    data_vencimento: new Date().toISOString().split('T')[0],
    tipo_pagamento: 'dinheiro',
    irmaos_selecionados: []
  });

  const tiposPagamento = [
    { value: 'dinheiro', label: '💵 Dinheiro' },
    { value: 'pix', label: '📱 PIX' },
    { value: 'transferencia', label: '🏦 Transferência' },
    { value: 'boleto', label: '📄 Boleto' },
    { value: 'cartao', label: '💳 Cartão' },
    { value: 'cheque', label: '📝 Cheque' }
  ];

  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  useEffect(() => {
    carregarDados();
  }, [filtros.mes, filtros.ano]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      // Carregar categorias
      const { data: catData, error: catError } = await supabase
        .from('categorias_financeiras')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (catError) throw catError;
      setCategorias(catData || []);

      // Carregar irmãos ativos
      const { data: irmaoData, error: irmaoError } = await supabase
        .from('irmaos')
        .select('id, nome')
        .eq('situacao', 'Ativo')
        .order('nome');

      if (irmaoError) throw irmaoError;
      setIrmaos(irmaoData || []);

      // Carregar lançamentos
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
      const { mes, ano } = filtros;
      const primeiroDia = `${ano}-${mes.toString().padStart(2, '0')}-01`;
      const ultimoDia = new Date(ano, mes, 0).getDate();
      const ultimoDiaFormatado = `${ano}-${mes.toString().padStart(2, '0')}-${ultimoDia}`;

      let query = supabase
        .from('lancamentos_loja')
        .select(`
          *,
          categorias_financeiras(nome, tipo)
        `)
        .gte('data_lancamento', primeiroDia)
        .lte('data_lancamento', ultimoDiaFormatado)
        .order('data_lancamento', { ascending: false });

      if (filtros.tipo) {
        const categoriasDoTipo = categorias
          .filter(c => c.tipo === filtros.tipo)
          .map(c => c.id);
        if (categoriasDoTipo.length > 0) {
          query = query.in('categoria_id', categoriasDoTipo);
        }
      }

      if (filtros.categoria) {
        query = query.eq('categoria_id', parseInt(filtros.categoria));
      }

      if (filtros.quitado === 'sim') {
        query = query.eq('status', 'quitado');
      } else if (filtros.quitado === 'nao') {
        query = query.eq('status', 'pendente');
      }

      const { data, error } = await query;

      if (error) throw error;
      setLancamentos(data || []);
    } catch (error) {
      console.error('Erro ao carregar lançamentos:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const dadosLancamento = {
        categoria_id: parseInt(formLancamento.categoria_id),
        descricao: formLancamento.descricao,
        valor: parseFloat(formLancamento.valor),
        data_lancamento: formLancamento.data_lancamento,
        data_vencimento: formLancamento.data_vencimento,
        tipo_pagamento: formLancamento.tipo_pagamento,
        data_pagamento: formLancamento.data_pagamento || null,
        status: formLancamento.quitado ? 'quitado' : 'pendente',
        comprovante_url: formLancamento.comprovante_url || null,
        observacoes: formLancamento.observacoes || null
      };

      if (editando) {
        // Atualizar
        const { error } = await supabase
          .from('lancamentos_loja')
          .update(dadosLancamento)
          .eq('id', editando);

        if (error) throw error;
        showSuccess('Lançamento atualizado com sucesso!');
      } else {
        // Criar
        const { error } = await supabase
          .from('lancamentos_loja')
          .insert(dadosLancamento);

        if (error) throw error;
        showSuccess('Lançamento criado com sucesso!');
      }

      limparFormulario();
      await carregarLancamentos();

    } catch (error) {
      console.error('Erro ao salvar lançamento:', error);
      showError('Erro ao salvar lançamento: ' + error.message);
    }
  };

  const handleLancamentoIrmaos = async (e) => {
    e.preventDefault();

    if (lancamentoIrmaos.irmaos_selecionados.length === 0) {
      showError('Selecione pelo menos um irmão!');
      return;
    }

    try {
      const lancamentosParaCriar = lancamentoIrmaos.irmaos_selecionados.map(irmaoId => {
        const irmao = irmaos.find(i => i.id === irmaoId);
        return {
          categoria_id: parseInt(lancamentoIrmaos.categoria_id),
          descricao: `${lancamentoIrmaos.descricao} - ${irmao.nome}`,
          valor: parseFloat(lancamentoIrmaos.valor),
          data_lancamento: lancamentoIrmaos.data_lancamento,
          data_vencimento: lancamentoIrmaos.data_vencimento,
          tipo_pagamento: lancamentoIrmaos.tipo_pagamento,
          data_pagamento: null, // Pendente - sem data de pagamento
          status: 'pendente', // Sempre começa PENDENTE
          observacoes: `Receita de mensalidade/contribuição - ${irmao.nome}`
        };
      });

      const { error } = await supabase
        .from('lancamentos_loja')
        .insert(lancamentosParaCriar);

      if (error) throw error;

      showSuccess(`${lancamentosParaCriar.length} lançamentos criados com sucesso!`);
      setMostrarModalIrmaos(false);
      limparLancamentoIrmaos();
      await carregarLancamentos();

    } catch (error) {
      console.error('Erro ao criar lançamentos:', error);
      showError('Erro ao criar lançamentos: ' + error.message);
    }
  };

  const toggleIrmaoSelecionado = (irmaoId) => {
    const irmaos = lancamentoIrmaos.irmaos_selecionados;
    if (irmaos.includes(irmaoId)) {
      setLancamentoIrmaos({
        ...lancamentoIrmaos,
        irmaos_selecionados: irmaos.filter(id => id !== irmaoId)
      });
    } else {
      setLancamentoIrmaos({
        ...lancamentoIrmaos,
        irmaos_selecionados: [...irmaos, irmaoId]
      });
    }
  };

  const selecionarTodosIrmaos = () => {
    setLancamentoIrmaos({
      ...lancamentoIrmaos,
      irmaos_selecionados: irmaos.map(i => i.id)
    });
  };

  const limparSelecaoIrmaos = () => {
    setLancamentoIrmaos({
      ...lancamentoIrmaos,
      irmaos_selecionados: []
    });
  };

  const editarLancamento = (lanc) => {
    setFormLancamento({
      tipo: lanc.categorias_financeiras?.tipo || 'receita',
      categoria_id: lanc.categoria_id?.toString() || '',
      descricao: lanc.descricao || '',
      valor: lanc.valor?.toString() || '',
      data_lancamento: lanc.data_lancamento || '',
      data_vencimento: lanc.data_vencimento || '',
      tipo_pagamento: lanc.tipo_pagamento || 'dinheiro',
      data_pagamento: lanc.data_pagamento || '',
      quitado: lanc.status === 'quitado',
      comprovante_url: lanc.comprovante_url || '',
      observacoes: lanc.observacoes || ''
    });
    setEditando(lanc.id);
    setMostrarFormulario(true);
  };

  const excluirLancamento = async (id) => {
    if (!confirm('Confirma a exclusão deste lançamento?')) return;

    try {
      const { error } = await supabase
        .from('lancamentos_loja')
        .delete()
        .eq('id', id);

      if (error) throw error;

      showSuccess('Lançamento excluído com sucesso!');
      await carregarLancamentos();

    } catch (error) {
      console.error('Erro ao excluir lançamento:', error);
      showError('Erro ao excluir lançamento: ' + error.message);
    }
  };

  const toggleQuitado = async (id, statusAtual) => {
    try {
      const novoStatus = statusAtual === 'quitado' ? 'pendente' : 'quitado';
      const dataPagamento = novoStatus === 'quitado' ? new Date().toISOString().split('T')[0] : null;

      const { error } = await supabase
        .from('lancamentos_loja')
        .update({ 
          status: novoStatus,
          data_pagamento: dataPagamento
        })
        .eq('id', id);

      if (error) throw error;

      showSuccess(novoStatus === 'quitado' ? 'Marcado como quitado!' : 'Marcado como pendente!');
      await carregarLancamentos();

    } catch (error) {
      console.error('Erro ao alterar status:', error);
      showError('Erro ao alterar status: ' + error.message);
    }
  };

  const limparFormulario = () => {
    setFormLancamento({
      tipo: 'receita',
      categoria_id: '',
      descricao: '',
      valor: '',
      data_lancamento: new Date().toISOString().split('T')[0],
      data_vencimento: new Date().toISOString().split('T')[0],
      tipo_pagamento: 'dinheiro',
      data_pagamento: '',
      quitado: false,
      comprovante_url: '',
      observacoes: ''
    });
    setEditando(null);
    setMostrarFormulario(false);
  };

  const limparLancamentoIrmaos = () => {
    setLancamentoIrmaos({
      categoria_id: '',
      descricao: '',
      valor: '',
      data_lancamento: new Date().toISOString().split('T')[0],
      data_vencimento: new Date().toISOString().split('T')[0],
      tipo_pagamento: 'dinheiro',
      irmaos_selecionados: []
    });
  };

  const gerarRelatorioPDF = () => {
    const doc = new jsPDF();
    
    // Título
    doc.setFontSize(16);
    doc.text('Relatório Financeiro - Loja', 14, 15);
    doc.setFontSize(10);
    doc.text(`Período: ${meses[filtros.mes - 1]}/${filtros.ano}`, 14, 22);
    
    // Resumo
    const saldos = calcularSaldos();
    doc.setFontSize(11);
    doc.text(`Receitas: R$ ${saldos.receitas.toFixed(2)}`, 14, 32);
    doc.text(`Despesas: R$ ${saldos.despesas.toFixed(2)}`, 14, 38);
    doc.text(`Saldo: R$ ${saldos.saldo.toFixed(2)}`, 14, 44);

    // Tabela de lançamentos
    const dadosTabela = lancamentos.map(lanc => [
      new Date(lanc.data_lancamento).toLocaleDateString('pt-BR'),
      new Date(lanc.data_vencimento).toLocaleDateString('pt-BR'),
      lanc.categorias_financeiras?.tipo === 'receita' ? 'Receita' : 'Despesa',
      lanc.categorias_financeiras?.nome || '',
      lanc.descricao,
      `R$ ${parseFloat(lanc.valor).toFixed(2)}`,
      lanc.status === 'quitado' ? 'Quitado' : 'Pendente'
    ]);

    doc.autoTable({
      startY: 50,
      head: [['Data Lanç.', 'Vencimento', 'Tipo', 'Categoria', 'Descrição', 'Valor', 'Status']],
      body: dadosTabela,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 8 }
    });

    doc.save(`financeiro-loja-${filtros.mes}-${filtros.ano}.pdf`);
    showSuccess('Relatório gerado com sucesso!');
  };

  const calcularSaldos = () => {
    const receitas = lancamentos
      .filter(l => l.categorias_financeiras?.tipo === 'receita')
      .reduce((sum, l) => sum + parseFloat(l.valor), 0);

    const despesas = lancamentos
      .filter(l => l.categorias_financeiras?.tipo === 'despesa')
      .reduce((sum, l) => sum + parseFloat(l.valor), 0);

    const receitasQuitadas = lancamentos
      .filter(l => l.categorias_financeiras?.tipo === 'receita' && l.status === 'quitado')
      .reduce((sum, l) => sum + parseFloat(l.valor), 0);

    const despesasQuitadas = lancamentos
      .filter(l => l.categorias_financeiras?.tipo === 'despesa' && l.status === 'quitado')
      .reduce((sum, l) => sum + parseFloat(l.valor), 0);

    const saldo = receitas - despesas;
    const saldoQuitado = receitasQuitadas - despesasQuitadas;

    return { receitas, despesas, saldo, receitasQuitadas, despesasQuitadas, saldoQuitado };
  };

  const saldos = calcularSaldos();
  const categoriasDoTipo = categorias.filter(c => c.tipo === formLancamento.tipo);
  const categoriasReceita = categorias.filter(c => c.tipo === 'receita');

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
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">🏦 Finanças da Loja</h2>
        <p className="text-blue-100">Controle de receitas e despesas</p>
      </div>

      {/* FILTROS */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mês</label>
            <select
              value={filtros.mes}
              onChange={(e) => setFiltros({ ...filtros, mes: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
              value={filtros.ano}
              onChange={(e) => setFiltros({ ...filtros, ano: parseInt(e.target.value) })}
              min="2020"
              max="2050"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              value={filtros.tipo}
              onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value, categoria: '' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              <option value="receita">Receitas</option>
              <option value="despesa">Despesas</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
            <select
              value={filtros.categoria}
              onChange={(e) => setFiltros({ ...filtros, categoria: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas</option>
              {categorias
                .filter(c => !filtros.tipo || c.tipo === filtros.tipo)
                .map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.nome}</option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quitado</label>
            <select
              value={filtros.quitado}
              onChange={(e) => setFiltros({ ...filtros, quitado: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              <option value="sim">Quitados</option>
              <option value="nao">Pendentes</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setMostrarFormulario(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            ➕ Novo Lançamento
          </button>
          <button
            onClick={() => setMostrarModalIrmaos(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
          >
            👥 Lançar Pagamentos de Irmãos
          </button>
          <button
            onClick={gerarRelatorioPDF}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
          >
            📄 Gerar Relatório PDF
          </button>
          <button
            onClick={() => setViewMode(viewMode === 'inadimplentes' ? 'lancamentos' : 'inadimplentes')}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
          >
            {viewMode === 'inadimplentes' ? '📋 Ver Todos' : '⚠️ Ver Inadimplentes'}
          </button>
          <button
            onClick={() => setFiltros({ mes: new Date().getMonth() + 1, ano: new Date().getFullYear(), tipo: '', categoria: '', quitado: '' })}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            🔄 Limpar Filtros
          </button>
        </div>
      </div>

      {/* CARDS DE RESUMO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Receitas (Total)</p>
              <p className="text-2xl font-bold text-green-600">R$ {saldos.receitas.toFixed(2)}</p>
              <p className="text-xs text-gray-500">Quitadas: R$ {saldos.receitasQuitadas.toFixed(2)}</p>
            </div>
            <div className="text-4xl">📈</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Despesas (Total)</p>
              <p className="text-2xl font-bold text-red-600">R$ {saldos.despesas.toFixed(2)}</p>
              <p className="text-xs text-gray-500">Quitadas: R$ {saldos.despesasQuitadas.toFixed(2)}</p>
            </div>
            <div className="text-4xl">📉</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Saldo (Total)</p>
              <p className={`text-2xl font-bold ${saldos.saldo >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                R$ {saldos.saldo.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500">Quitado: R$ {saldos.saldoQuitado.toFixed(2)}</p>
            </div>
            <div className="text-4xl">💰</div>
          </div>
        </div>
      </div>

      {/* FORMULÁRIO INDIVIDUAL */}
      {mostrarFormulario && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            {editando ? '✏️ Editar Lançamento' : '➕ Novo Lançamento'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                <select
                  value={formLancamento.tipo}
                  onChange={(e) => setFormLancamento({ ...formLancamento, tipo: e.target.value, categoria_id: '' })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="receita">📈 Receita</option>
                  <option value="despesa">📉 Despesa</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria *</label>
                <select
                  value={formLancamento.categoria_id}
                  onChange={(e) => setFormLancamento({ ...formLancamento, categoria_id: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione</option>
                  {categoriasDoTipo.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formLancamento.valor}
                  onChange={(e) => setFormLancamento({ ...formLancamento, valor: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Lançamento *</label>
                <input
                  type="date"
                  value={formLancamento.data_lancamento}
                  onChange={(e) => setFormLancamento({ ...formLancamento, data_lancamento: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Vencimento *</label>
                <input
                  type="date"
                  value={formLancamento.data_vencimento}
                  onChange={(e) => setFormLancamento({ ...formLancamento, data_vencimento: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo Pagamento *</label>
                <select
                  value={formLancamento.tipo_pagamento}
                  onChange={(e) => setFormLancamento({ ...formLancamento, tipo_pagamento: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {tiposPagamento.map(tipo => (
                    <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Pagamento</label>
                <input
                  type="date"
                  value={formLancamento.data_pagamento}
                  onChange={(e) => setFormLancamento({ ...formLancamento, data_pagamento: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center pt-6">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formLancamento.quitado}
                    onChange={(e) => setFormLancamento({ ...formLancamento, quitado: e.target.checked })}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-700">Quitado</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição *</label>
              <input
                type="text"
                value={formLancamento.descricao}
                onChange={(e) => setFormLancamento({ ...formLancamento, descricao: e.target.value })}
                required
                maxLength="200"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: Pagamento de aluguel"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
              <textarea
                value={formLancamento.observacoes}
                onChange={(e) => setFormLancamento({ ...formLancamento, observacoes: e.target.value })}
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Informações adicionais (opcional)"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                {editando ? '💾 Salvar Alterações' : '➕ Criar Lançamento'}
              </button>
              <button
                type="button"
                onClick={limparFormulario}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL LANÇAMENTO IRMÃOS */}
      {mostrarModalIrmaos && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full p-6 my-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              👥 Lançar Pagamentos de Irmãos
            </h3>

            <form onSubmit={handleLancamentoIrmaos} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoria (Receita) *</label>
                  <select
                    value={lancamentoIrmaos.categoria_id}
                    onChange={(e) => setLancamentoIrmaos({ ...lancamentoIrmaos, categoria_id: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Selecione</option>
                    {categoriasReceita.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor por Irmão *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={lancamentoIrmaos.valor}
                    onChange={(e) => setLancamentoIrmaos({ ...lancamentoIrmaos, valor: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data Lançamento *</label>
                  <input
                    type="date"
                    value={lancamentoIrmaos.data_lancamento}
                    onChange={(e) => setLancamentoIrmaos({ ...lancamentoIrmaos, data_lancamento: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data Vencimento *</label>
                  <input
                    type="date"
                    value={lancamentoIrmaos.data_vencimento}
                    onChange={(e) => setLancamentoIrmaos({ ...lancamentoIrmaos, data_vencimento: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo Pagamento *</label>
                  <select
                    value={lancamentoIrmaos.tipo_pagamento}
                    onChange={(e) => setLancamentoIrmaos({ ...lancamentoIrmaos, tipo_pagamento: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  >
                    {tiposPagamento.map(tipo => (
                      <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição Base *</label>
                <input
                  type="text"
                  value={lancamentoIrmaos.descricao}
                  onChange={(e) => setLancamentoIrmaos({ ...lancamentoIrmaos, descricao: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="Ex: Mensalidade"
                />
                <p className="text-xs text-gray-500 mt-1">O nome do irmão será adicionado automaticamente</p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Selecione os Irmãos * ({lancamentoIrmaos.irmaos_selecionados.length} selecionados)
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selecionarTodosIrmaos}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      ✅ Selecionar Todos
                    </button>
                    <button
                      type="button"
                      onClick={limparSelecaoIrmaos}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      ❌ Limpar Seleção
                    </button>
                  </div>
                </div>
                <div className="border border-gray-300 rounded-lg p-4 max-h-60 overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {irmaos.map(irmao => (
                      <label key={irmao.id} className="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={lancamentoIrmaos.irmaos_selecionados.includes(irmao.id)}
                          onChange={() => toggleIrmaoSelecionado(irmao.id)}
                          className="w-4 h-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">{irmao.nome}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Total a lançar:</strong> R$ {(parseFloat(lancamentoIrmaos.valor || 0) * lancamentoIrmaos.irmaos_selecionados.length).toFixed(2)}
                  {' '}({lancamentoIrmaos.irmaos_selecionados.length} irmãos × R$ {parseFloat(lancamentoIrmaos.valor || 0).toFixed(2)})
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                >
                  ✅ Criar Lançamentos
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMostrarModalIrmaos(false);
                    limparLancamentoIrmaos();
                  }}
                  className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW INADIMPLENTES */}
      {viewMode === 'inadimplentes' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold text-red-600 mb-4">⚠️ Irmãos Inadimplentes</h3>
          <p className="text-sm text-gray-600 mb-4">Receitas pendentes de pagamento</p>
          
          {lancamentos.filter(l => l.categorias_financeiras?.tipo === 'receita' && l.status === 'pendente').length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              ✅ Nenhum irmão inadimplente neste período!
            </div>
          ) : (
            <div className="space-y-3">
              {lancamentos
                .filter(l => l.categorias_financeiras?.tipo === 'receita' && l.status === 'pendente')
                .map((lanc) => (
                  <div key={lanc.id} className="border border-red-200 rounded-lg p-4 bg-red-50">
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{lanc.descricao}</p>
                        <div className="text-sm text-gray-600 mt-1">
                          <span>Vencimento: {new Date(lanc.data_vencimento).toLocaleDateString('pt-BR')}</span>
                          {' • '}
                          <span>Categoria: {lanc.categorias_financeiras?.nome}</span>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-lg font-bold text-red-600">R$ {parseFloat(lanc.valor).toFixed(2)}</p>
                        <button
                          onClick={() => toggleQuitado(lanc.id, lanc.status)}
                          className="mt-2 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                        >
                          ✅ Marcar como Quitado
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* LISTA DE LANÇAMENTOS */}
      {viewMode === 'lancamentos' && (
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Lançamentos de {meses[filtros.mes - 1]}/{filtros.ano}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data Lanç.</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vencimento</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pagamento</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {lancamentos.map((lanc) => (
                <tr key={lanc.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(lanc.data_lancamento).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(lanc.data_vencimento).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      lanc.categorias_financeiras?.tipo === 'receita'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {lanc.categorias_financeiras?.tipo === 'receita' ? '📈 Receita' : '📉 Despesa'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {lanc.categorias_financeiras?.nome}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {lanc.descricao}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <span className={lanc.categorias_financeiras?.tipo === 'receita' ? 'text-green-600' : 'text-red-600'}>
                      R$ {parseFloat(lanc.valor).toFixed(2)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {lanc.data_pagamento ? new Date(lanc.data_pagamento).toLocaleDateString('pt-BR') : '-'}
                    <br />
                    <span className="text-xs text-gray-500">{lanc.tipo_pagamento}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => toggleQuitado(lanc.id, lanc.status)}
                      className={`px-2 py-1 text-xs font-medium rounded-full cursor-pointer ${
                        lanc.status === 'quitado'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {lanc.status === 'quitado' ? '✅ Quitado' : '⏳ Pendente'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => editarLancamento(lanc)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => excluirLancamento(lanc.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {lancamentos.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              Nenhum lançamento encontrado
            </div>
          )}
        </div>
      )}
    </div>
  );
}
