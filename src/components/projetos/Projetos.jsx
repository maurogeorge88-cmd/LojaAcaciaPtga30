import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function Projetos({ showSuccess, showError, permissoes }) {
  const [projetos, setProjetos] = useState([]);
  const [custos, setCustos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [projetoEditando, setProjetoEditando] = useState(null);
  const [projetoSelecionado, setProjetoSelecionado] = useState(null);
  const [mostrarCustos, setMostrarCustos] = useState(false);
  const [custoForm, setCustoForm] = useState({});

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
    valor_arrecadado: 0,
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

  const salvarProjeto = async (e) => {
    e.preventDefault();

    if (projetoEditando) {
      const { error } = await supabase
        .from('projetos')
        .update(projetoForm)
        .eq('id', projetoEditando.id);

      if (error) {
        showError('Erro ao atualizar projeto');
      } else {
        showSuccess('Projeto atualizado com sucesso!');
        limparFormulario();
        carregarProjetos();
      }
    } else {
      const { error } = await supabase
        .from('projetos')
        .insert([projetoForm]);

      if (error) {
        showError('Erro ao criar projeto');
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
      valor_arrecadado: 0,
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

    const { error } = await supabase
      .from('custos_projeto')
      .insert([{ ...custoForm, projeto_id: projetoSelecionado.id }]);

    if (error) {
      showError('Erro ao adicionar custo');
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

  const calcularTotalCustos = (projeto) => {
    const custosDoProjeto = custos.filter(c => c.projeto_id === projeto.id);
    return custosDoProjeto.reduce((total, c) => total + (parseFloat(c.valor) || 0), 0);
  };

  const calcularSaldo = (projeto, totalCustos) => {
    return (parseFloat(projeto.valor_arrecadado) || 0) - totalCustos;
  };

  const calcularPercentual = (projeto, totalCustos) => {
    const valorPrevisto = parseFloat(projeto.valor_previsto) || 0;
    if (valorPrevisto === 0) return 0;
    return Math.min(100, (totalCustos / valorPrevisto) * 100);
  };

  const getTipoInfo = (tipo) => {
    return tiposProjeto.find(t => t.value === tipo) || tiposProjeto[0];
  };

  const getPrazoInfo = (prazo) => {
    return prazosProjeto.find(p => p.value === prazo) || prazosProjeto[0];
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">Carregando projetos...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white rounded-lg p-6 shadow-lg mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-2">📊 Gestão de Projetos</h2>
            <p className="opacity-90">Controle financeiro e acompanhamento de projetos</p>
          </div>
          {permissoes?.pode_editar_projetos && (
            <button
              onClick={() => {
                if (!mostrarFormulario) {
                  limparFormulario();
                  setMostrarFormulario(true);
                  setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
                } else {
                  limparFormulario();
                }
              }}
              className="px-6 py-3 bg-white text-blue-700 rounded-lg hover:bg-blue-50 transition font-semibold"
            >
              {mostrarFormulario ? '✖️ Cancelar' : '➕ Novo Projeto'}
            </button>
          )}
        </div>
      </div>

      {/* Formulário */}
      {mostrarFormulario && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border-2 border-blue-200">
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            {projetoEditando ? '✏️ Editar Projeto' : '➕ Novo Projeto'}
          </h3>

          <form onSubmit={salvarProjeto} className="space-y-6">
            {/* Dados Gerais */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-bold text-gray-700 mb-3">📋 Dados Gerais</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome do Projeto *
                  </label>
                  <input
                    type="text"
                    required
                    value={projetoForm.nome}
                    onChange={(e) => setProjetoForm({ ...projetoForm, nome: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Reforma do Templo"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição *
                  </label>
                  <textarea
                    required
                    rows="3"
                    value={projetoForm.descricao}
                    onChange={(e) => setProjetoForm({ ...projetoForm, descricao: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    placeholder="Descreva os objetivos e escopo do projeto"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo do Projeto *
                  </label>
                  <select
                    required
                    value={projetoForm.tipo}
                    onChange={(e) => setProjetoForm({ ...projetoForm, tipo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  >
                    {tiposProjeto.map(tipo => (
                      <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prazo *
                  </label>
                  <select
                    required
                    value={projetoForm.prazo}
                    onChange={(e) => setProjetoForm({ ...projetoForm, prazo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  >
                    {prazosProjeto.map(prazo => (
                      <option key={prazo.value} value={prazo.value}>{prazo.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data de Início *
                  </label>
                  <input
                    type="date"
                    required
                    value={projetoForm.data_inicio}
                    onChange={(e) => setProjetoForm({ ...projetoForm, data_inicio: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Prevista de Término *
                  </label>
                  <input
                    type="date"
                    required
                    value={projetoForm.data_prevista_termino}
                    onChange={(e) => setProjetoForm({ ...projetoForm, data_prevista_termino: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Responsável *
                  </label>
                  <input
                    type="text"
                    required
                    value={projetoForm.responsavel}
                    onChange={(e) => setProjetoForm({ ...projetoForm, responsavel: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    placeholder="Nome do responsável"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={projetoForm.status}
                    onChange={(e) => setProjetoForm({ ...projetoForm, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="em_andamento">🔄 Em Andamento</option>
                    <option value="finalizado">✅ Finalizado</option>
                  </select>
                </div>

                {projetoForm.status === 'finalizado' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data de Finalização
                    </label>
                    <input
                      type="date"
                      value={projetoForm.data_finalizacao}
                      onChange={(e) => setProjetoForm({ ...projetoForm, data_finalizacao: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Observações
                  </label>
                  <textarea
                    rows="2"
                    value={projetoForm.observacoes}
                    onChange={(e) => setProjetoForm({ ...projetoForm, observacoes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    placeholder="Informações adicionais sobre o projeto"
                  />
                </div>
              </div>
            </div>

            {/* Controle Financeiro */}
            <div className="bg-green-50 rounded-lg p-4">
              <h4 className="font-bold text-gray-700 mb-3">💰 Controle Financeiro</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor Total Previsto *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={projetoForm.valor_previsto}
                    onChange={(e) => setProjetoForm({ ...projetoForm, valor_previsto: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor Já Arrecadado
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={projetoForm.valor_arrecadado}
                    onChange={(e) => setProjetoForm({ ...projetoForm, valor_arrecadado: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fonte dos Recursos
                  </label>
                  <input
                    type="text"
                    value={projetoForm.fonte_recursos}
                    onChange={(e) => setProjetoForm({ ...projetoForm, fonte_recursos: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Doações, Eventos, Caixa da Loja"
                  />
                </div>
              </div>
            </div>

            {/* Botões */}
            <div className="flex gap-3">
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
              >
                {projetoEditando ? '💾 Salvar Alterações' : '➕ Cadastrar Projeto'}
              </button>
              <button
                type="button"
                onClick={limparFormulario}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition font-medium"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de Projetos */}
      <div className="grid grid-cols-1 gap-6">
        {projetos.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            <p className="text-lg">📋 Nenhum projeto cadastrado</p>
            <p className="text-sm mt-2">Clique em "Novo Projeto" para começar</p>
          </div>
        ) : (
          projetos.map(projeto => {
            const tipoInfo = getTipoInfo(projeto.tipo);
            const prazoInfo = getPrazoInfo(projeto.prazo);
            const totalCustos = calcularTotalCustos(projeto);
            const saldo = calcularSaldo(projeto, totalCustos);
            const percentual = calcularPercentual(projeto, totalCustos);

            return (
              <div key={projeto.id} className="bg-white rounded-lg shadow-lg overflow-hidden border-l-4 border-blue-500">
                {/* Header do Card */}
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 border-b">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xl font-bold text-gray-800">{projeto.nome}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${tipoInfo.cor}`}>
                          {tipoInfo.label}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          projeto.status === 'finalizado' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {projeto.status === 'finalizado' ? '✅ Finalizado' : '🔄 Em Andamento'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{projeto.descricao}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                        <span>{prazoInfo.label}</span>
                        <span>👤 {projeto.responsavel}</span>
                        <span>📅 Início: {new Date(projeto.data_inicio).toLocaleDateString('pt-BR')}</span>
                        <span>🎯 Término: {new Date(projeto.data_prevista_termino).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>

                    {permissoes?.pode_editar_projetos && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => editarProjeto(projeto)}
                          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                        >
                          ✏️ Editar
                        </button>
                        <button
                          onClick={() => excluirProjeto(projeto.id)}
                          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                        >
                          🗑️ Excluir
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Indicadores Financeiros */}
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs text-gray-600 mb-1">💠 Valor Previsto</p>
                      <p className="text-lg font-bold text-blue-700">
                        R$ {parseFloat(projeto.valor_previsto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3">
                      <p className="text-xs text-gray-600 mb-1">💰 Arrecadado</p>
                      <p className="text-lg font-bold text-green-700">
                        R$ {parseFloat(projeto.valor_arrecadado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-3">
                      <p className="text-xs text-gray-600 mb-1">📊 Total Custos</p>
                      <p className="text-lg font-bold text-orange-700">
                        R$ {totalCustos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className={`${saldo >= 0 ? 'bg-green-50' : 'bg-red-50'} rounded-lg p-3`}>
                      <p className="text-xs text-gray-600 mb-1">💵 Saldo</p>
                      <p className={`text-lg font-bold ${saldo >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        R$ {saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  {/* Barra de Progresso */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-gray-700">Progresso Financeiro</span>
                      <span className="text-sm font-bold text-blue-600">{percentual.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
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

                  {/* Botão Ver Custos */}
                  <button
                    onClick={() => {
                      setProjetoSelecionado(projeto);
                      carregarCustos(projeto.id);
                      setMostrarCustos(true);
                    }}
                    className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
                  >
                    📋 Ver Custos Detalhados
                  </button>
                </div>
              </div>
            );
          })
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
              {permissoes?.pode_editar_projetos && projetoSelecionado.status === 'em_andamento' && (
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
                          {permissoes?.pode_editar_projetos && <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Ações</th>}
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
                            {permissoes?.pode_editar_projetos && (
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
                          <td colSpan={permissoes?.pode_editar_projetos ? 3 : 2}></td>
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
