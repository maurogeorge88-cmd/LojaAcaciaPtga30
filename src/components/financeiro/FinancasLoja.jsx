import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function FinancasLoja({ showSuccess, showError, userEmail }) {
  const [categorias, setCategorias] = useState([]);
  const [lancamentos, setLancamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('dashboard'); // 'dashboard', 'lancamentos', 'extrato'
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editando, setEditando] = useState(null);
  const [filtros, setFiltros] = useState({
    mes: new Date().getMonth() + 1,
    ano: new Date().getFullYear(),
    tipo: '', // 'receita' ou 'despesa'
    categoria: ''
  });

  const [formLancamento, setFormLancamento] = useState({
    tipo: 'receita',
    categoria_id: '',
    descricao: '',
    valor: '',
    data_lancamento: new Date().toISOString().split('T')[0],
    tipo_pagamento: 'dinheiro',
    comprovante_url: '',
    observacoes: ''
  });

  const formasPagamento = [
    { value: 'dinheiro', label: '💵 Dinheiro' },
    { value: 'pix', label: '📱 PIX' },
    { value: 'cartao', label: '💳 Cartão' },
    { value: 'transferencia', label: '🏦 Transferência' },
    { value: 'cheque', label: '📝 Cheque' },
    { value: 'boleto', label: '📄 Boleto' }
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
        // Filtrar por tipo via categoria
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
      if (editando) {
        // Atualizar
        const { error } = await supabase
          .from('lancamentos_loja')
          .update({
            categoria_id: parseInt(formLancamento.categoria_id),
            descricao: formLancamento.descricao,
            valor: parseFloat(formLancamento.valor),
            data_lancamento: formLancamento.data_lancamento,
            data_vencimento: formLancamento.data_lancamento, // Mesma data do lançamento
            tipo_pagamento: formLancamento.tipo_pagamento,
            comprovante_url: formLancamento.comprovante_url || null,
            observacoes: formLancamento.observacoes || null
          })
          .eq('id', editando);

        if (error) throw error;
        showSuccess('Lançamento atualizado com sucesso!');
      } else {
        // Criar
        const { error } = await supabase
          .from('lancamentos_loja')
          .insert({
            categoria_id: parseInt(formLancamento.categoria_id),
            descricao: formLancamento.descricao,
            valor: parseFloat(formLancamento.valor),
            data_lancamento: formLancamento.data_lancamento,
            data_vencimento: formLancamento.data_lancamento, // Mesma data do lançamento
            tipo_pagamento: formLancamento.tipo_pagamento,
            comprovante_url: formLancamento.comprovante_url || null,
            observacoes: formLancamento.observacoes || null
          });

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

  const editarLancamento = (lanc) => {
    setFormLancamento({
      tipo: lanc.categorias_financeiras?.tipo || 'receita',
      categoria_id: lanc.categoria_id?.toString() || '',
      descricao: lanc.descricao || '',
      valor: lanc.valor?.toString() || '',
      data_lancamento: lanc.data_lancamento || '',
      tipo_pagamento: lanc.tipo_pagamento || 'dinheiro',
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

  const limparFormulario = () => {
    setFormLancamento({
      tipo: 'receita',
      categoria_id: '',
      descricao: '',
      valor: '',
      data_lancamento: new Date().toISOString().split('T')[0],
      tipo_pagamento: 'dinheiro',
      comprovante_url: '',
      observacoes: ''
    });
    setEditando(null);
    setMostrarFormulario(false);
  };

  const calcularSaldos = () => {
    const receitas = lancamentos
      .filter(l => l.categorias_financeiras?.tipo === 'receita')
      .reduce((sum, l) => sum + parseFloat(l.valor), 0);

    const despesas = lancamentos
      .filter(l => l.categorias_financeiras?.tipo === 'despesa')
      .reduce((sum, l) => sum + parseFloat(l.valor), 0);

    const saldo = receitas - despesas;

    return { receitas, despesas, saldo };
  };

  const saldos = calcularSaldos();

  const categoriasDoTipo = categorias.filter(c => c.tipo === formLancamento.tipo);

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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setMostrarFormulario(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            ➕ Novo Lançamento
          </button>
          <button
            onClick={() => setFiltros({ mes: new Date().getMonth() + 1, ano: new Date().getFullYear(), tipo: '', categoria: '' })}
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
              <p className="text-sm text-gray-600">Receitas</p>
              <p className="text-2xl font-bold text-green-600">R$ {saldos.receitas.toFixed(2)}</p>
            </div>
            <div className="text-4xl">📈</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Despesas</p>
              <p className="text-2xl font-bold text-red-600">R$ {saldos.despesas.toFixed(2)}</p>
            </div>
            <div className="text-4xl">📉</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Saldo</p>
              <p className={`text-2xl font-bold ${saldos.saldo >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                R$ {saldos.saldo.toFixed(2)}
              </p>
            </div>
            <div className="text-4xl">💰</div>
          </div>
        </div>
      </div>

      {/* FORMULÁRIO */}
      {mostrarFormulario && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            {editando ? '✏️ Editar Lançamento' : '➕ Novo Lançamento'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
                <input
                  type="date"
                  value={formLancamento.data_lancamento}
                  onChange={(e) => setFormLancamento({ ...formLancamento, data_lancamento: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Forma de Pagamento *</label>
                <select
                  value={formLancamento.tipo_pagamento}
                  onChange={(e) => setFormLancamento({ ...formLancamento, tipo_pagamento: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {formasPagamento.map(forma => (
                    <option key={forma.value} value={forma.value}>{forma.label}</option>
                  ))}
                </select>
              </div>
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

      {/* LISTA DE LANÇAMENTOS */}
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {lancamentos.map((lanc) => (
                <tr key={lanc.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(lanc.data_lancamento).toLocaleDateString('pt-BR')}
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => editarLancamento(lanc)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => excluirLancamento(lanc.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      🗑️ Excluir
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
      </div>
    </div>
  );
}
