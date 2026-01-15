import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function Projetos({ showSuccess, showError, permissoes }) {
  const [projetos, setProjetos] = useState([]);
  const [custos, setCustos] = useState([]);
  const [receitas, setReceitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [projetoEditando, setProjetoEditando] = useState(null);
  const [projetoSelecionado, setProjetoSelecionado] = useState(null);
  const [mostrarCustos, setMostrarCustos] = useState(false);
  const [mostrarReceitas, setMostrarReceitas] = useState(false);
  const [custoForm, setCustoForm] = useState({});
  const [receitaForm, setReceitaForm] = useState({});

  const [projetoForm, setProjetoForm] = useState({
    nome: '',
    descricao: '',
    tipo: 'social',
    prazo: 'curto',
    data_inicio: '',
    data_prevista_termino: '',
    data_finalizacao: '',
    responsavel: '',
    observacoes: '',
    valor_previsto: 0,
    fonte_recursos: '',
    status: 'em_andamento'
  });

  const tiposProjeto = [
    { value: 'social', label: '🤝 Social', cor: 'bg-blue-100 text-blue-800' },
    { value: 'administrativo', label: '📋 Administrativo', cor: 'bg-purple-100 text-purple-800' },
    { value: 'beneficente', label: '❤️ Beneficente', cor: 'bg-red-100 text-red-800' },
    { value: 'patrimonial', label: '🏛️ Patrimonial', cor: 'bg-green-100 text-green-800' },
    { value: 'outro', label: '📌 Outro', cor: 'bg-gray-100 text-gray-800' }
  ];

  const prazosProjeto = [
    { value: 'curto', label: '⚡ Curto Prazo (até 6 meses)' },
    { value: 'medio', label: '📅 Médio Prazo (6-12 meses)' },
    { value: 'longo', label: '🎯 Longo Prazo (+ de 1 ano)' }
  ];

  const categoriasCusto = [
    'Material', 'Serviço', 'Equipamento', 'Transporte', 
    'Alimentação', 'Divulgação', 'Outro'
  ];

  const formasPagamento = [
    'Dinheiro', 'PIX', 'Transferência', 'Cartão', 'Cheque', 'Boleto'
  ];

  const origensReceita = [
    'Caixa da Loja', 'Doação', 'Evento', 'Rifa', 'Bazar', 
    'Contribuição Especial', 'Patrocínio', 'Outro'
  ];

  useEffect(() => {
    carregarProjetos();
  }, []);

  const carregarProjetos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('projetos')
      .select('*')
      .order('data_inicio', { ascending: false });

    if (error) {
      showError('Erro ao carregar projetos');
    } else {
      setProjetos(data || []);
    }
    setLoading(false);
  };

  const carregarCustos = async (projetoId) => {
    const { data, error } = await supabase
      .from('custos_projeto')
      .select('*')
      .eq('projeto_id', projetoId)
      .order('data_custo', { ascending: false });

    if (!error) {
      setCustos(data || []);
    }
  };

  const carregarReceitas = async (projetoId) => {
    const { data, error } = await supabase
      .from('receitas_projeto')
      .select('*')
      .eq('projeto_id', projetoId)
      .order('data_receita', { ascending: false });

    if (!error) {
      setReceitas(data || []);
    }
  };

  const salvarProjeto = async (e) => {
    e.preventDefault();

    // Converter valores numéricos e datas vazias antes de salvar
    const dadosParaSalvar = {
      ...projetoForm,
      valor_previsto: parseFloat(projetoForm.valor_previsto) || 0,
      data_prevista_termino: projetoForm.data_prevista_termino || null,
      data_finalizacao: projetoForm.data_finalizacao || null
    };

    if (projetoEditando) {
      const { error } = await supabase
        .from('projetos')
        .update(dadosParaSalvar)
        .eq('id', projetoEditando.id);

      if (error) {
        console.error('Erro ao atualizar:', error);
        showError('Erro ao atualizar projeto: ' + error.message);
      } else {
        showSuccess('Projeto atualizado com sucesso!');
        limparFormulario();
        carregarProjetos();
      }
    } else {
      const { error } = await supabase
        .from('projetos')
        .insert([dadosParaSalvar]);

      if (error) {
        console.error('Erro ao criar:', error);
        showError('Erro ao criar projeto: ' + error.message);
      } else {
        showSuccess('Projeto cadastrado com sucesso!');
        limparFormulario();
        carregarProjetos();
      }
    }
  };

  const limparFormulario = () => {
    setProjetoForm({
      nome: '',
      descricao: '',
      tipo: 'social',
      prazo: 'curto',
      data_inicio: '',
      data_prevista_termino: '',
      data_finalizacao: '',
      responsavel: '',
      observacoes: '',
      valor_previsto: 0,
      fonte_recursos: '',
      status: 'em_andamento'
    });
    setProjetoEditando(null);
    setMostrarFormulario(false);
  };

  const editarProjeto = (projeto) => {
    setProjetoForm(projeto);
    setProjetoEditando(projeto);
    setMostrarFormulario(true);
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
  };

  const excluirProjeto = async (id) => {
    if (!confirm('Deseja excluir este projeto? Todos os custos associados também serão excluídos.')) return;

    const { error } = await supabase
      .from('projetos')
      .delete()
      .eq('id', id);

    if (error) {
      showError('Erro ao excluir projeto');
    } else {
      showSuccess('Projeto excluído com sucesso!');
      carregarProjetos();
    }
  };

  const adicionarCusto = async (e) => {
    e.preventDefault();

    // Converter valor numérico antes de salvar
    const dadosCusto = {
      ...custoForm,
      projeto_id: projetoSelecionado.id,
      valor: parseFloat(custoForm.valor) || 0
    };

    const { error } = await supabase
      .from('custos_projeto')
      .insert([dadosCusto]);

    if (error) {
      console.error('Erro ao adicionar custo:', error);
      showError('Erro ao adicionar custo: ' + error.message);
    } else {
      showSuccess('Custo adicionado com sucesso!');
      setCustoForm({});
      carregarCustos(projetoSelecionado.id);
      carregarProjetos();
    }
  };

  const excluirCusto = async (id) => {
    if (!confirm('Deseja excluir este custo?')) return;

    const { error } = await supabase
      .from('custos_projeto')
      .delete()
      .eq('id', id);

    if (error) {
      showError('Erro ao excluir custo');
    } else {
      showSuccess('Custo excluído com sucesso!');
      carregarCustos(projetoSelecionado.id);
      carregarProjetos();
    }
  };

  const adicionarReceita = async (e) => {
    e.preventDefault();

    // Converter valor numérico antes de salvar
    const dadosReceita = {
      ...receitaForm,
      projeto_id: projetoSelecionado.id,
      valor: parseFloat(receitaForm.valor) || 0
    };

    const { error } = await supabase
      .from('receitas_projeto')
      .insert([dadosReceita]);

    if (error) {
      console.error('Erro ao adicionar receita:', error);
      showError('Erro ao adicionar receita: ' + error.message);
    } else {
      showSuccess('Receita adicionada com sucesso!');
      setReceitaForm({});
      carregarReceitas(projetoSelecionado.id);
      carregarProjetos();
    }
  };

  const excluirReceita = async (id) => {
    if (!confirm('Deseja excluir esta receita?')) return;

    const { error } = await supabase
      .from('receitas_projeto')
      .delete()
      .eq('id', id);

    if (error) {
      showError('Erro ao excluir receita');
    } else {
      showSuccess('Receita excluída com sucesso!');
      carregarReceitas(projetoSelecionado.id);
      carregarProjetos();
    }
  };

  const calcularTotalCustos = (projeto) => {
    const custosDoProjeto = custos.filter(c => c.projeto_id === projeto.id);
    return custosDoProjeto.reduce((total, c) => total + (parseFloat(c.valor) || 0), 0);
  };

  const calcularTotalReceitas = (projeto) => {
    const receitasDoProjeto = receitas.filter(r => r.projeto_id === projeto.id);
    return receitasDoProjeto.reduce((total, r) => total + (parseFloat(r.valor) || 0), 0);
  };

  const calcularSaldo = (projeto, totalCustos, totalReceitas) => {
    return totalReceitas - totalCustos;
  };

  const calcularPercentual = (projeto, totalCustos) => {
    const valorPrevisto = parseFloat(projeto.valor_previsto) || 0;
    if (valorPrevisto === 0) return 0;
    return (totalCustos / valorPrevisto) * 100;
  };

  const statusLabels = {
    em_andamento: { label: '🔄 Em Andamento', cor: 'bg-blue-100 text-blue-800' },
    concluido: { label: '✅ Concluído', cor: 'bg-green-100 text-green-800' },
    suspenso: { label: '⏸️ Suspenso', cor: 'bg-yellow-100 text-yellow-800' },
    cancelado: { label: '❌ Cancelado', cor: 'bg-red-100 text-red-800' }
  };

  if (loading) {
    return <div className="text-center py-12">⏳ Carregando projetos...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">🎯 Projetos da Loja</h2>
          <p className="text-gray-600 mt-1">Gerencie os projetos e seus custos</p>
        </div>
        {permissoes?.canEdit && (
          <button
            onClick={() => setMostrarFormulario(!mostrarFormulario)}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition font-bold"
          >
            {mostrarFormulario ? '❌ Cancelar' : '➕ Novo Projeto'}
          </button>
        )}
      </div>

      {/* Formulário */}
      {mostrarFormulario && (
        <form onSubmit={salvarProjeto} className="bg-white rounded-xl shadow-lg p-6 mb-6 border-2 border-indigo-200">
          <h3 className="text-xl font-bold text-gray-800 mb-4">
            {projetoEditando ? '✏️ Editando Projeto' : '➕ Novo Projeto'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nome */}
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1">Nome do Projeto *</label>
              <input
                type="text"
                required
                value={projetoForm.nome}
                onChange={(e) => setProjetoForm({ ...projetoForm, nome: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="Ex: Campanha de Doação de Alimentos"
              />
            </div>

            {/* Descrição */}
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1">Descrição</label>
              <textarea
                value={projetoForm.descricao}
                onChange={(e) => setProjetoForm({ ...projetoForm, descricao: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                rows="3"
                placeholder="Descreva o objetivo e escopo do projeto..."
              />
            </div>

            {/* Tipo */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Tipo *</label>
              <select
                required
                value={projetoForm.tipo}
                onChange={(e) => setProjetoForm({ ...projetoForm, tipo: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                {tiposProjeto.map(tipo => (
                  <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                ))}
              </select>
            </div>

            {/* Prazo */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Prazo *</label>
              <select
                required
                value={projetoForm.prazo}
                onChange={(e) => setProjetoForm({ ...projetoForm, prazo: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                {prazosProjeto.map(prazo => (
                  <option key={prazo.value} value={prazo.value}>{prazo.label}</option>
                ))}
              </select>
            </div>

            {/* Data Início */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Data Início *</label>
              <input
                type="date"
                required
                value={projetoForm.data_inicio}
                onChange={(e) => setProjetoForm({ ...projetoForm, data_inicio: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Data Prevista Término */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Data Prevista Término</label>
              <input
                type="date"
                value={projetoForm.data_prevista_termino}
                onChange={(e) => setProjetoForm({ ...projetoForm, data_prevista_termino: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Data Finalização */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Data Finalização</label>
              <input
                type="date"
                value={projetoForm.data_finalizacao}
                onChange={(e) => setProjetoForm({ ...projetoForm, data_finalizacao: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Status *</label>
              <select
                required
                value={projetoForm.status}
                onChange={(e) => setProjetoForm({ ...projetoForm, status: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="em_andamento">🔄 Em Andamento</option>
                <option value="concluido">✅ Concluído</option>
                <option value="suspenso">⏸️ Suspenso</option>
                <option value="cancelado">❌ Cancelado</option>
              </select>
            </div>

            {/* Responsável */}
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1">Responsável</label>
              <input
                type="text"
                value={projetoForm.responsavel}
                onChange={(e) => setProjetoForm({ ...projetoForm, responsavel: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="Nome do irmão responsável pelo projeto"
              />
            </div>

            {/* Valor Previsto */}
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1">Valor Previsto (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={projetoForm.valor_previsto}
                onChange={(e) => setProjetoForm({ ...projetoForm, valor_previsto: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="0.00"
              />
            </div>

            {/* Fonte de Recursos */}
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1">Fonte de Recursos</label>
              <input
                type="text"
                value={projetoForm.fonte_recursos}
                onChange={(e) => setProjetoForm({ ...projetoForm, fonte_recursos: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="Ex: Caixa da Loja, Doações, Eventos"
              />
            </div>

            {/* Observações */}
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1">Observações</label>
              <textarea
                value={projetoForm.observacoes}
                onChange={(e) => setProjetoForm({ ...projetoForm, observacoes: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                rows="2"
                placeholder="Informações adicionais relevantes..."
              />
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3 mt-6">
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:shadow-lg transition font-bold"
            >
              💾 {projetoEditando ? 'Atualizar Projeto' : 'Cadastrar Projeto'}
            </button>
            <button
              type="button"
              onClick={limparFormulario}
              className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-bold"
            >
              ❌ Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Lista de Projetos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {projetos.length === 0 ? (
          <div className="col-span-2 text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-500 text-lg">📋 Nenhum projeto cadastrado</p>
            {permissoes?.canEdit && (
              <button
                onClick={() => setMostrarFormulario(true)}
                className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
              >
                ➕ Cadastrar Primeiro Projeto
              </button>
            )}
          </div>
        ) : (
          projetos.map((projeto) => {
            const tipoInfo = tiposProjeto.find(t => t.value === projeto.tipo);
            const statusInfo = statusLabels[projeto.status];
            const totalCustos = calcularTotalCustos(projeto);
            const totalReceitas = calcularTotalReceitas(projeto);
            const saldo = calcularSaldo(projeto, totalCustos, totalReceitas);
            const percentual = calcularPercentual(projeto, totalCustos);

            return (
              <div key={projeto.id} className="bg-white rounded-xl shadow-lg border-2 border-gray-200 p-6 hover:shadow-xl transition">
                {/* Header do Card */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-800 mb-2">{projeto.nome}</h3>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${tipoInfo?.cor || 'bg-gray-100 text-gray-800'}`}>
                        {tipoInfo?.label || projeto.tipo}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusInfo?.cor || 'bg-gray-100 text-gray-800'}`}>
                        {statusInfo?.label || projeto.status}
                      </span>
                    </div>
                  </div>
                  
                  {permissoes?.canEdit && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => editarProjeto(projeto)}
                        className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition text-sm"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => excluirProjeto(projeto.id)}
                        className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition text-sm"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>

                {/* Descrição */}
                {projeto.descricao && (
                  <p className="text-gray-600 text-sm mb-4">{projeto.descricao}</p>
                )}

                {/* Informações do Projeto */}
                <div className="space-y-2 mb-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">📅 Início:</span>
                    <span className="font-semibold">{new Date(projeto.data_inicio).toLocaleDateString('pt-BR')}</span>
                  </div>
                  {projeto.data_prevista_termino && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">🎯 Prev. Término:</span>
                      <span className="font-semibold">{new Date(projeto.data_prevista_termino).toLocaleDateString('pt-BR')}</span>
                    </div>
                  )}
                  {projeto.data_finalizacao && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">✅ Finalizado:</span>
                      <span className="font-semibold">{new Date(projeto.data_finalizacao).toLocaleDateString('pt-BR')}</span>
                    </div>
                  )}
                  {projeto.responsavel && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">👤 Responsável:</span>
                      <span className="font-semibold">{projeto.responsavel}</span>
                    </div>
                  )}
                </div>

                {/* Financeiro */}
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 font-semibold">💰 Valor Previsto:</span>
                    <span className="text-lg font-bold text-blue-600">
                      R$ {parseFloat(projeto.valor_previsto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 font-semibold">💵 Receitas:</span>
                    <span className="text-lg font-bold text-green-600">
                      R$ {totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 font-semibold">💸 Custos:</span>
                    <span className="text-lg font-bold text-red-600">
                      R$ {totalCustos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t-2 border-gray-300">
                    <span className="text-gray-700 font-bold">💳 Saldo:</span>
                    <span className={`text-xl font-bold ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      R$ {saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Barra de Progresso */}
                  <div>
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Execução do Orçamento</span>
                      <span className="font-bold">{percentual.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-3 rounded-full transition-all ${
                          percentual > 100 ? 'bg-red-500' : percentual > 75 ? 'bg-yellow-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${Math.min(100, percentual)}%` }}
                      />
                    </div>
                    {percentual > 100 && (
                      <p className="text-xs text-red-600 mt-1">⚠️ Custos ultrapassaram o valor previsto!</p>
                    )}
                  </div>

                  {/* Botões de Gerenciamento */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setProjetoSelecionado(projeto);
                        carregarReceitas(projeto.id);
                        setMostrarReceitas(true);
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium text-sm"
                    >
                      💵 Receitas
                    </button>
                    <button
                      onClick={() => {
                        setProjetoSelecionado(projeto);
                        carregarCustos(projeto.id);
                        setMostrarCustos(true);
                      }}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium text-sm"
                    >
                      💸 Custos
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal de Receitas */}
      {mostrarReceitas && projetoSelecionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header do Modal */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6 sticky top-0">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-bold">💵 Receitas do Projeto</h3>
                  <p className="text-sm opacity-90 mt-1">{projetoSelecionado.nome}</p>
                </div>
                <button
                  onClick={() => {
                    setMostrarReceitas(false);
                    setProjetoSelecionado(null);
                    setReceitas([]);
                  }}
                  className="text-white hover:opacity-80 text-4xl leading-none"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Formulário de Nova Receita */}
              {permissoes?.canEdit && projetoSelecionado.status === 'em_andamento' && (
                <form onSubmit={adicionarReceita} className="bg-gray-50 rounded-lg p-4 mb-6">
                  <h4 className="font-bold text-gray-700 mb-3">➕ Adicionar Receita</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      type="date"
                      required
                      value={receitaForm.data_receita || ''}
                      onChange={(e) => setReceitaForm({ ...receitaForm, data_receita: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Descrição"
                      value={receitaForm.descricao || ''}
                      onChange={(e) => setReceitaForm({ ...receitaForm, descricao: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                    />
                    <select
                      required
                      value={receitaForm.origem || ''}
                      onChange={(e) => setReceitaForm({ ...receitaForm, origem: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Origem</option>
                      {origensReceita.map(origem => (
                        <option key={origem} value={origem}>{origem}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="Valor"
                      value={receitaForm.valor || ''}
                      onChange={(e) => setReceitaForm({ ...receitaForm, valor: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                    />
                    <select
                      required
                      value={receitaForm.forma_pagamento || ''}
                      onChange={(e) => setReceitaForm({ ...receitaForm, forma_pagamento: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Forma Pagamento</option>
                      {formasPagamento.map(forma => (
                        <option key={forma} value={forma}>{forma}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Responsável"
                      value={receitaForm.responsavel || ''}
                      onChange={(e) => setReceitaForm({ ...receitaForm, responsavel: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                    />
                    <input
                      type="text"
                      placeholder="Observação"
                      value={receitaForm.observacao || ''}
                      onChange={(e) => setReceitaForm({ ...receitaForm, observacao: e.target.value })}
                      className="md:col-span-2 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                    >
                      ➕ Adicionar
                    </button>
                  </div>
                </form>
              )}

              {/* Tabela de Receitas */}
              {receitas.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <p>📋 Nenhuma receita registrada para este projeto</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-100 border-b-2 border-gray-300">
                          <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Data</th>
                          <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Descrição</th>
                          <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Origem</th>
                          <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">Valor</th>
                          <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Pagamento</th>
                          <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Responsável</th>
                          {permissoes?.canEdit && <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Ações</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {receitas.map((receita, i) => (
                          <tr key={receita.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-3 text-sm">
                              {new Date(receita.data_receita).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="px-4 py-3 text-sm">{receita.descricao}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                                {receita.origem}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-bold text-green-600">
                              R$ {parseFloat(receita.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-sm">{receita.forma_pagamento}</td>
                            <td className="px-4 py-3 text-sm">{receita.responsavel}</td>
                            {permissoes?.canEdit && (
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => excluirReceita(receita.id)}
                                  className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs"
                                >
                                  🗑️
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-200 border-t-2 border-gray-400">
                          <td colSpan="3" className="px-4 py-3 text-right font-bold text-gray-800">
                            TOTAL:
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-green-700 text-lg">
                            R$ {receitas.reduce((sum, r) => sum + parseFloat(r.valor), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td colSpan={permissoes?.canEdit ? 3 : 2}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
        )}
      </div>

      {/* Modal de Custos */}
      {mostrarCustos && projetoSelecionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header do Modal */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 sticky top-0">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-bold">💰 Custos do Projeto</h3>
                  <p className="text-sm opacity-90 mt-1">{projetoSelecionado.nome}</p>
                </div>
                <button
                  onClick={() => {
                    setMostrarCustos(false);
                    setProjetoSelecionado(null);
                    setCustos([]);
                  }}
                  className="text-white hover:opacity-80 text-4xl leading-none"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Formulário de Novo Custo */}
              {permissoes?.canEdit && projetoSelecionado.status === 'em_andamento' && (
                <form onSubmit={adicionarCusto} className="bg-gray-50 rounded-lg p-4 mb-6">
                  <h4 className="font-bold text-gray-700 mb-3">➕ Adicionar Custo</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      type="date"
                      required
                      value={custoForm.data_custo || ''}
                      onChange={(e) => setCustoForm({ ...custoForm, data_custo: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Descrição"
                      value={custoForm.descricao || ''}
                      onChange={(e) => setCustoForm({ ...custoForm, descricao: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                    />
                    <select
                      required
                      value={custoForm.categoria || ''}
                      onChange={(e) => setCustoForm({ ...custoForm, categoria: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Categoria</option>
                      {categoriasCusto.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="Valor"
                      value={custoForm.valor || ''}
                      onChange={(e) => setCustoForm({ ...custoForm, valor: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                    />
                    <select
                      required
                      value={custoForm.forma_pagamento || ''}
                      onChange={(e) => setCustoForm({ ...custoForm, forma_pagamento: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Forma Pagamento</option>
                      {formasPagamento.map(forma => (
                        <option key={forma} value={forma}>{forma}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Responsável"
                      value={custoForm.responsavel || ''}
                      onChange={(e) => setCustoForm({ ...custoForm, responsavel: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                    />
                    <input
                      type="text"
                      placeholder="Observação"
                      value={custoForm.observacao || ''}
                      onChange={(e) => setCustoForm({ ...custoForm, observacao: e.target.value })}
                      className="md:col-span-2 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
                    >
                      ➕ Adicionar
                    </button>
                  </div>
                </form>
              )}

              {/* Tabela de Custos */}
              {custos.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <p>📋 Nenhum custo registrado para este projeto</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-100 border-b-2 border-gray-300">
                          <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Data</th>
                          <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Descrição</th>
                          <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Categoria</th>
                          <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">Valor</th>
                          <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Pagamento</th>
                          <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Responsável</th>
                          {permissoes?.canEdit && <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Ações</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {custos.map((custo, i) => (
                          <tr key={custo.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-3 text-sm">
                              {new Date(custo.data_custo).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="px-4 py-3 text-sm">{custo.descricao}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                                {custo.categoria}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-bold text-red-600">
                              R$ {parseFloat(custo.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-sm">{custo.forma_pagamento}</td>
                            <td className="px-4 py-3 text-sm">{custo.responsavel}</td>
                            {permissoes?.canEdit && (
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => excluirCusto(custo.id)}
                                  className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs"
                                >
                                  🗑️
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-200 border-t-2 border-gray-400">
                          <td colSpan="3" className="px-4 py-3 text-right font-bold text-gray-800">
                            TOTAL:
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-red-700 text-lg">
                            R$ {custos.reduce((sum, c) => sum + parseFloat(c.valor), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td colSpan={permissoes?.canEdit ? 3 : 2}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
