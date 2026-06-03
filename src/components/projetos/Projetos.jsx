import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function Projetos({ showSuccess, showError, permissoes }) {
  const [projetos, setProjetos] = useState([]);
  const [todosOsCustos, setTodosOsCustos] = useState([]);
  const [todasAsReceitas, setTodasAsReceitas] = useState([]);
  const [custosDoModal, setCustosDoModal] = useState([]);
  const [receitasDoModal, setReceitasDoModal] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [projetoEditando, setProjetoEditando] = useState(null);
  const [projetoSelecionado, setProjetoSelecionado] = useState(null);
  const [mostrarCustos, setMostrarCustos] = useState(false);
  const [mostrarReceitas, setMostrarReceitas] = useState(false);
  const [custoForm, setCustoForm] = useState({});
  const [receitaForm, setReceitaForm] = useState({});
  const [refreshKey, setRefreshKey] = useState(0);

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
    { value: 'social', label: '🤝 Social', style: {background:'rgba(59,130,246,0.15)',color:'#3b82f6',border:'1px solid rgba(59,130,246,0.3)'} },
    { value: 'administrativo', label: '📋 Administrativo', style: {background:'rgba(139,92,246,0.15)',color:'#8b5cf6',border:'1px solid rgba(139,92,246,0.3)'} },
    { value: 'beneficente', label: '❤️ Beneficente', style: {background:'rgba(239,68,68,0.15)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)'} },
    { value: 'patrimonial', label: '🏛️ Patrimonial', style: {background:'rgba(16,185,129,0.15)',color:'#10b981',border:'1px solid rgba(16,185,129,0.3)'} },
    { value: 'outro', label: '📌 Outro', cor: ' ' }
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
    
    // Carregar projetos
    const { data: projetosData, error: projetosError } = await supabase
      .from('projetos')
      .select('*')
      .order('data_inicio', { ascending: false });

    if (projetosError) {
      showError('Erro ao carregar projetos');
      setLoading(false);
      return;
    }

    // Carregar todos os custos
    const { data: custosData } = await supabase
      .from('custos_projeto')
      .select('*');

    // Carregar todas as receitas
    const { data: receitasData } = await supabase
      .from('receitas_projeto')
      .select('*');

    setProjetos(projetosData || []);
    setTodosOsCustos(custosData || []);
    setTodasAsReceitas(receitasData || []);
    setLoading(false);
  };

  const carregarCustos = async (projetoId) => {
    const { data, error } = await supabase
      .from('custos_projeto')
      .select('*')
      .eq('projeto_id', projetoId)
      .order('data_custo', { ascending: false });

    if (!error) {
      setCustosDoModal(data || []);
    }
  };

  const carregarReceitas = async (projetoId) => {
    const { data, error } = await supabase
      .from('receitas_projeto')
      .select('*')
      .eq('projeto_id', projetoId)
      .order('data_receita', { ascending: false });

    if (!error) {
      setReceitasDoModal(data || []);
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
      // Recarregar custos do modal
      await carregarCustos(projetoSelecionado.id);
      // Recarregar todos os dados para atualizar os cards
      await carregarProjetos();
      // Forçar re-render
      setRefreshKey(prev => prev + 1);
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
      // Recarregar custos do modal
      await carregarCustos(projetoSelecionado.id);
      // Recarregar todos os dados para atualizar os cards
      await carregarProjetos();
      // Forçar re-render
      setRefreshKey(prev => prev + 1);
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
      // Recarregar receitas do modal
      await carregarReceitas(projetoSelecionado.id);
      // Recarregar todos os dados para atualizar os cards
      await carregarProjetos();
      // Forçar re-render
      setRefreshKey(prev => prev + 1);
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
      // Recarregar receitas do modal
      await carregarReceitas(projetoSelecionado.id);
      // Recarregar todos os dados para atualizar os cards
      await carregarProjetos();
      // Forçar re-render
      setRefreshKey(prev => prev + 1);
    }
  };

  const calcularTotalCustos = (projeto) => {
    const custosDoProjeto = todosOsCustos.filter(c => c.projeto_id === projeto.id);
    return custosDoProjeto.reduce((total, c) => total + (parseFloat(c.valor) || 0), 0);
  };

  const calcularTotalReceitas = (projeto) => {
    const receitasDoProjeto = todasAsReceitas.filter(r => r.projeto_id === projeto.id);
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
    em_andamento: { label: '🔄 Em Andamento', style: {background:'rgba(59,130,246,0.15)',color:'#3b82f6',border:'1px solid rgba(59,130,246,0.3)'} },
    concluido:    { label: '✅ Concluído',    style: {background:'rgba(16,185,129,0.15)',color:'#10b981',border:'1px solid rgba(16,185,129,0.3)'} },
    suspenso:     { label: '⏸️ Suspenso',    style: {background:'rgba(245,158,11,0.15)',color:'#f59e0b',border:'1px solid rgba(245,158,11,0.3)'} },
    cancelado:    { label: '❌ Cancelado',   style: {background:'rgba(239,68,68,0.15)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)'} }
  };

  if (loading) {
    return <div style={{textAlign:"center",padding:"3rem",color:"var(--color-text-muted)"}}>⏳ Carregando projetos...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto -mx-3" style={{background:"var(--color-bg)",minHeight:"100vh",padding:"0.5rem",overflowX:"hidden"}}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6 px-3">
        <div>
          <h2 className="text-3xl font-bold" style={{color:"var(--color-text)"}}>🎯 Projetos da Loja</h2>
          <p className="mt-1" style={{color:"var(--color-text-muted)"}}>Gerencie os projetos e seus custos</p>
        </div>
        {permissoes?.canEdit && (
          <button
            onClick={() => setMostrarFormulario(!mostrarFormulario)}
            style={{padding:"0.6rem 1.5rem",background:"var(--color-accent)",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"700"}}
          >
            {mostrarFormulario ? '❌ Cancelar' : '➕ Novo Projeto'}
          </button>
        )}
      </div>

      {/* Formulário */}
      {mostrarFormulario && (
        <form onSubmit={salvarProjeto} className="rounded-xl p-6 mb-6 border-2 border-indigo-200 mx-3" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>>
          <h3 className="text-xl font-bold mb-4" style={{color:"var(--color-text)"}}>
            {projetoEditando ? '✏️ Editando Projeto' : '➕ Novo Projeto'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nome */}
            <div className="md:col-span-2">
              <label className="block text-sm font-bold mb-1" style={{color:"var(--color-text-muted)"}}>Nome do Projeto *</label>
              <input
                type="text"
                required
                value={projetoForm.nome}
                onChange={(e) => setProjetoForm({ ...projetoForm, nome: e.target.value })}
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
                placeholder="Ex: Campanha de Doação de Alimentos"
              />
            </div>

            {/* Descrição */}
            <div className="md:col-span-2">
              <label className="block text-sm font-bold mb-1" style={{color:"var(--color-text-muted)"}}>Descrição</label>
              <textarea
                value={projetoForm.descricao}
                onChange={(e) => setProjetoForm({ ...projetoForm, descricao: e.target.value })}
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
                rows="3"
                placeholder="Descreva o objetivo e escopo do projeto..."
              />
            </div>

            {/* Tipo */}
            <div>
              <label className="block text-sm font-bold mb-1" style={{color:"var(--color-text-muted)"}}>Tipo *</label>
              <select
                required
                value={projetoForm.tipo}
                onChange={(e) => setProjetoForm({ ...projetoForm, tipo: e.target.value })}
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
              >
                {tiposProjeto.map(tipo => (
                  <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                ))}
              </select>
            </div>

            {/* Prazo */}
            <div>
              <label className="block text-sm font-bold mb-1" style={{color:"var(--color-text-muted)"}}>Prazo *</label>
              <select
                required
                value={projetoForm.prazo}
                onChange={(e) => setProjetoForm({ ...projetoForm, prazo: e.target.value })}
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
              >
                {prazosProjeto.map(prazo => (
                  <option key={prazo.value} value={prazo.value}>{prazo.label}</option>
                ))}
              </select>
            </div>

            {/* Data Início */}
            <div>
              <label className="block text-sm font-bold mb-1" style={{color:"var(--color-text-muted)"}}>Data Início *</label>
              <input
                type="date"
                required
                value={projetoForm.data_inicio}
                onChange={(e) => setProjetoForm({ ...projetoForm, data_inicio: e.target.value })}
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
              />
            </div>

            {/* Data Prevista Término */}
            <div>
              <label className="block text-sm font-bold mb-1" style={{color:"var(--color-text-muted)"}}>Data Prevista Término</label>
              <input
                type="date"
                value={projetoForm.data_prevista_termino}
                onChange={(e) => setProjetoForm({ ...projetoForm, data_prevista_termino: e.target.value })}
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
              />
            </div>

            {/* Data Finalização */}
            <div>
              <label className="block text-sm font-bold mb-1" style={{color:"var(--color-text-muted)"}}>Data Finalização</label>
              <input
                type="date"
                value={projetoForm.data_finalizacao}
                onChange={(e) => setProjetoForm({ ...projetoForm, data_finalizacao: e.target.value })}
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-bold mb-1" style={{color:"var(--color-text-muted)"}}>Status *</label>
              <select
                required
                value={projetoForm.status}
                onChange={(e) => setProjetoForm({ ...projetoForm, status: e.target.value })}
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
              >
                <option value="em_andamento">🔄 Em Andamento</option>
                <option value="concluido">✅ Concluído</option>
                <option value="suspenso">⏸️ Suspenso</option>
                <option value="cancelado">❌ Cancelado</option>
              </select>
            </div>

            {/* Responsável */}
            <div className="md:col-span-2">
              <label className="block text-sm font-bold mb-1" style={{color:"var(--color-text-muted)"}}>Responsável</label>
              <input
                type="text"
                value={projetoForm.responsavel}
                onChange={(e) => setProjetoForm({ ...projetoForm, responsavel: e.target.value })}
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
                placeholder="Nome do irmão responsável pelo projeto"
              />
            </div>

            {/* Valor Previsto */}
            <div className="md:col-span-2">
              <label className="block text-sm font-bold mb-1" style={{color:"var(--color-text-muted)"}}>Valor Previsto (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={projetoForm.valor_previsto}
                onChange={(e) => setProjetoForm({ ...projetoForm, valor_previsto: e.target.value })}
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
                placeholder="0.00"
              />
            </div>

            {/* Fonte de Recursos */}
            <div className="md:col-span-2">
              <label className="block text-sm font-bold mb-1" style={{color:"var(--color-text-muted)"}}>Fonte de Recursos</label>
              <input
                type="text"
                value={projetoForm.fonte_recursos}
                onChange={(e) => setProjetoForm({ ...projetoForm, fonte_recursos: e.target.value })}
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
                placeholder="Ex: Caixa da Loja, Doações, Eventos"
              />
            </div>

            {/* Observações */}
            <div className="md:col-span-2">
              <label className="block text-sm font-bold mb-1" style={{color:"var(--color-text-muted)"}}>Observações</label>
              <textarea
                value={projetoForm.observacoes}
                onChange={(e) => setProjetoForm({ ...projetoForm, observacoes: e.target.value })}
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
                rows="2"
                placeholder="Informações adicionais relevantes..."
              />
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3 mt-6">
            <button
              type="submit"
              style={{flex:1,padding:"0.6rem 1.5rem",background:"#10b981",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"700"}}
            >
              💾 {projetoEditando ? 'Atualizar Projeto' : 'Cadastrar Projeto'}
            </button>
            <button
              type="button"
              onClick={limparFormulario}
              className="px-6 py-3 rounded-lg transition font-bold" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
            >
              ❌ Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Lista de Projetos */}
      <div key={refreshKey} className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-3">
        {projetos.length === 0 ? (
          <div className="col-span-2 text-center py-12 rounded-lg" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <p className="text-lg">📋 Nenhum projeto cadastrado</p>
            {permissoes?.canEdit && (
              <button
                onClick={() => setMostrarFormulario(true)}
                style={{marginTop:"1rem",padding:"0.5rem 1.5rem",background:"var(--color-accent)",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",cursor:"pointer"}}
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
              <div key={projeto.id} className="rounded-xl p-6 hover:shadow-xl transition" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                {/* Header do Card */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-2" style={{color:"var(--color-text)"}}>{projeto.nome}</h3>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <span style={{...tipoInfo?.style||{background:'var(--color-surface-2)',color:'var(--color-text-muted)',border:'1px solid var(--color-border)'},padding:'0.2rem 0.65rem',borderRadius:'999px',fontSize:'0.7rem',fontWeight:'700'}}>
                        {tipoInfo?.label || projeto.tipo}
                      </span>
                      <span style={{...statusInfo?.style||{background:'var(--color-surface-2)',color:'var(--color-text-muted)',border:'1px solid var(--color-border)'},padding:'0.2rem 0.65rem',borderRadius:'999px',fontSize:'0.7rem',fontWeight:'700'}}>
                        {statusInfo?.label || projeto.status}
                      </span>
                    </div>
                  </div>
                  
                  {permissoes?.canEdit && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => editarProjeto(projeto)}
                        style={{padding:"0.25rem 0.55rem",background:"var(--color-accent-bg)",color:"var(--color-accent)",border:"1px solid var(--color-accent)",borderRadius:"var(--radius-md)",fontSize:"0.82rem",cursor:"pointer"}}
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => excluirProjeto(projeto.id)}
                        style={{padding:"0.25rem 0.55rem",background:"rgba(239,68,68,0.15)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"var(--radius-md)",fontSize:"0.82rem",cursor:"pointer"}}
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>

                {/* Descrição */}
                {projeto.descricao && (
                  <p style={{fontSize:"0.85rem",color:"var(--color-text-muted)",marginBottom:"1rem"}}>{projeto.descricao}</p>
                )}

                {/* Informações do Projeto */}
                <div className="space-y-2 mb-4 text-sm">
                  <div className="flex justify-between">
                    <span>📅 Início:</span>
                    <span className="font-semibold">{new Date(projeto.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                  </div>
                  {projeto.data_prevista_termino && (
                    <div className="flex justify-between">
                      <span>🎯 Prev. Término:</span>
                      <span className="font-semibold">{new Date(projeto.data_prevista_termino + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                    </div>
                  )}
                  {projeto.data_finalizacao && (
                    <div className="flex justify-between">
                      <span>✅ Finalizado:</span>
                      <span className="font-semibold">{new Date(projeto.data_finalizacao + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                    </div>
                  )}
                  {projeto.responsavel && (
                    <div className="flex justify-between">
                      <span>👤 Responsável:</span>
                      <span className="font-semibold">{projeto.responsavel}</span>
                    </div>
                  )}
                </div>

                {/* Financeiro */}
                <div className="rounded-lg p-4 space-y-3" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">💰 Valor Previsto:</span>
                    <span style={{fontSize:"1.1rem",fontWeight:"800",color:"#3b82f6"}}>
                      R$ {parseFloat(projeto.valor_previsto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">💵 Receitas:</span>
                    <span style={{fontSize:"1.1rem",fontWeight:"800",color:"#10b981"}}>
                      R$ {totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">💸 Custos:</span>
                    <span style={{fontSize:"1.1rem",fontWeight:"800",color:"#ef4444"}}>
                      R$ {totalCustos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 -t-2" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}>
                    <span className="font-bold">💳 Saldo:</span>
                    <span style={{fontSize:"1.25rem",fontWeight:"800",color:saldo>=0?"#10b981":"#ef4444"}}>
                      R$ {saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Barra de Progresso */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>Execução do Orçamento</span>
                      <span className="font-bold">{percentual.toFixed(1)}%</span>
                    </div>
                    <div className="w-full rounded-full h-3 overflow-hidden" style={{background:"var(--color-surface-3)"}}>
                      <div
                        className={`h-3 rounded-full transition-all ${
                          percentual > 100 ? '#ef4444' : percentual > 75 ? '#f59e0b' : 'var(--color-accent)'
                        }`}
                        style={{ width: `${Math.min(100, percentual)}%` }}
                      />
                    </div>
                    {percentual > 100 && (
                      <p style={{fontSize:"0.72rem",color:"#ef4444",marginTop:"0.25rem"}}>⚠️ Custos ultrapassaram o valor previsto!</p>
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
                      style={{padding:"0.4rem 1rem",background:"#10b981",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"600",fontSize:"0.82rem"}}
                    >
                      💵 Receitas
                    </button>
                    <button
                      onClick={() => {
                        setProjetoSelecionado(projeto);
                        carregarCustos(projeto.id);
                        setMostrarCustos(true);
                      }}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium text-sm"
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
          <div className="rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>>
            {/* Header do Modal */}
            <div style={{background:"#10b981",padding:"1.25rem 1.5rem",position:"sticky",top:0,zIndex:10}}>
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-bold" style={{color:"var(--color-text)"}}>💵 Receitas do Projeto</h3>
                  <p className="text-sm opacity-90 mt-1" style={{color:"var(--color-text-muted)"}}>{projetoSelecionado.nome}</p>
                </div>
                <button
                  onClick={() => {
                    setMostrarReceitas(false);
                    setProjetoSelecionado(null);
                    setReceitasDoModal([]);
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
                <form onSubmit={adicionarReceita} className="rounded-lg p-4 mb-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>>
                  <h4 className="font-bold mb-3">➕ Adicionar Receita</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      type="date"
                      required
                      value={receitaForm.data_receita || ''}
                      onChange={(e) => setReceitaForm({ ...receitaForm, data_receita: e.target.value })}
                      className="px-3 py-2 rounded focus:ring-2 focus:ring-green-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
                    />
                    <input
                      type="text"
                      required
                      placeholder="Descrição"
                      value={receitaForm.descricao || ''}
                      onChange={(e) => setReceitaForm({ ...receitaForm, descricao: e.target.value })}
                      className="px-3 py-2 rounded focus:ring-2 focus:ring-green-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
                    />
                    <select
                      required
                      value={receitaForm.origem || ''}
                      onChange={(e) => setReceitaForm({ ...receitaForm, origem: e.target.value })}
                      className="px-3 py-2 rounded focus:ring-2 focus:ring-green-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
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
                      className="px-3 py-2 rounded focus:ring-2 focus:ring-green-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
                    />
                    <select
                      required
                      value={receitaForm.forma_pagamento || ''}
                      onChange={(e) => setReceitaForm({ ...receitaForm, forma_pagamento: e.target.value })}
                      className="px-3 py-2 rounded focus:ring-2 focus:ring-green-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
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
                      className="px-3 py-2 rounded focus:ring-2 focus:ring-green-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
                    />
                    <input
                      type="text"
                      placeholder="Observação"
                      value={receitaForm.observacao || ''}
                      onChange={(e) => setReceitaForm({ ...receitaForm, observacao: e.target.value })}
                      className="md:col-span-2 px-3 py-2 rounded focus:ring-2 focus:ring-green-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
                    />
                    <button
                      type="submit"
                      style={{padding:"0.45rem 1rem",background:"#10b981",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"600"}}
                    >
                      ➕ Adicionar
                    </button>
                  </div>
                </form>
              )}

              {/* Tabela de Receitas */}
              {receitasDoModal.length === 0 ? (
                <div className="text-center py-8">
                  <p>📋 Nenhuma receita registrada para este projeto</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead style={{background:"var(--color-surface-2)"}}>
                        <tr className="-b-2" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}>
                          <th className="px-4 py-3 text-left text-sm font-bold">Data</th>
                          <th className="px-4 py-3 text-left text-sm font-bold">Descrição</th>
                          <th className="px-4 py-3 text-left text-sm font-bold">Origem</th>
                          <th className="px-4 py-3 text-right text-sm font-bold">Valor</th>
                          <th className="px-4 py-3 text-left text-sm font-bold">Pagamento</th>
                          <th className="px-4 py-3 text-left text-sm font-bold">Responsável</th>
                          {permissoes?.canEdit && <th className="px-4 py-3 text-center text-sm font-bold">Ações</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {receitasDoModal.map((receita, i) => (
                          <tr key={receita.id} className={i % 2 === 0 ? '' : ''}>
                            <td className="px-4 py-3 text-sm" style={{color:"var(--color-text)"}}>
                              {new Date(receita.data_receita + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </td>
                            <td className="px-4 py-3 text-sm" style={{color:"var(--color-text)"}}>{receita.descricao}</td>
                            <td className="px-4 py-3 text-sm" style={{color:"var(--color-text)"}}>
                              <span style={{padding:"0.15rem 0.5rem",borderRadius:"var(--radius-sm)",fontSize:"0.7rem",background:"rgba(16,185,129,0.15)",color:"#10b981",border:"1px solid rgba(16,185,129,0.3)"}}>
                                {receita.origem}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-bold text-green-600" style={{color:"var(--color-text)"}}>
                              R$ {parseFloat(receita.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-sm" style={{color:"var(--color-text)"}}>{receita.forma_pagamento}</td>
                            <td className="px-4 py-3 text-sm" style={{color:"var(--color-text)"}}>{receita.responsavel}</td>
                            {permissoes?.canEdit && (
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => excluirReceita(receita.id)}
                                  style={{padding:"0.15rem 0.5rem",borderRadius:"var(--radius-sm)",fontSize:"0.7rem",background:"rgba(239,68,68,0.15)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.3)",cursor:"pointer"}}
                                >
                                  🗑️
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{borderTop:"2px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}>
                          <td colSpan="3" className="px-4 py-3 text-right font-bold">
                            TOTAL:
                          </td>
                          <td style={{padding:"0.75rem 1rem",textAlign:"right",fontWeight:"800",color:"#10b981",fontSize:"1.05rem"}}>
                            R$ {receitasDoModal.reduce((sum, r) => sum + parseFloat(r.valor), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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

      {/* Modal de Custos */}
      {mostrarCustos && projetoSelecionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>>
            {/* Header do Modal */}
            <div style={{background:"#8b5cf6",padding:"1.25rem 1.5rem",position:"sticky",top:0,zIndex:10}}>
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-bold" style={{color:"var(--color-text)"}}>💰 Custos do Projeto</h3>
                  <p className="text-sm opacity-90 mt-1" style={{color:"var(--color-text-muted)"}}>{projetoSelecionado.nome}</p>
                </div>
                <button
                  onClick={() => {
                    setMostrarCustos(false);
                    setProjetoSelecionado(null);
                    setCustosDoModal([]);
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
                <form onSubmit={adicionarCusto} className="rounded-lg p-4 mb-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>>
                  <h4 className="font-bold mb-3">➕ Adicionar Custo</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      type="date"
                      required
                      value={custoForm.data_custo || ''}
                      onChange={(e) => setCustoForm({ ...custoForm, data_custo: e.target.value })}
                      className="px-3 py-2 rounded focus:ring-2 focus:ring-indigo-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
                    />
                    <input
                      type="text"
                      required
                      placeholder="Descrição"
                      value={custoForm.descricao || ''}
                      onChange={(e) => setCustoForm({ ...custoForm, descricao: e.target.value })}
                      className="px-3 py-2 rounded focus:ring-2 focus:ring-indigo-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
                    />
                    <select
                      required
                      value={custoForm.categoria || ''}
                      onChange={(e) => setCustoForm({ ...custoForm, categoria: e.target.value })}
                      className="px-3 py-2 rounded focus:ring-2 focus:ring-indigo-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
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
                      className="px-3 py-2 rounded focus:ring-2 focus:ring-indigo-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
                    />
                    <select
                      required
                      value={custoForm.forma_pagamento || ''}
                      onChange={(e) => setCustoForm({ ...custoForm, forma_pagamento: e.target.value })}
                      className="px-3 py-2 rounded focus:ring-2 focus:ring-indigo-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
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
                      className="px-3 py-2 rounded focus:ring-2 focus:ring-indigo-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
                    />
                    <input
                      type="text"
                      placeholder="Observação"
                      value={custoForm.observacao || ''}
                      onChange={(e) => setCustoForm({ ...custoForm, observacao: e.target.value })}
                      className="md:col-span-2 px-3 py-2 rounded focus:ring-2 focus:ring-indigo-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium"
                    >
                      ➕ Adicionar
                    </button>
                  </div>
                </form>
              )}

              {/* Tabela de Custos */}
              {custosDoModal.length === 0 ? (
                <div className="text-center py-8">
                  <p>📋 Nenhum custo registrado para este projeto</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead style={{background:"var(--color-surface-2)"}}>
                        <tr className="-b-2" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}>
                          <th className="px-4 py-3 text-left text-sm font-bold">Data</th>
                          <th className="px-4 py-3 text-left text-sm font-bold">Descrição</th>
                          <th className="px-4 py-3 text-left text-sm font-bold">Categoria</th>
                          <th className="px-4 py-3 text-right text-sm font-bold">Valor</th>
                          <th className="px-4 py-3 text-left text-sm font-bold">Pagamento</th>
                          <th className="px-4 py-3 text-left text-sm font-bold">Responsável</th>
                          {permissoes?.canEdit && <th className="px-4 py-3 text-center text-sm font-bold">Ações</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {custosDoModal.map((custo, i) => (
                          <tr key={custo.id} className={i % 2 === 0 ? '' : ''}>
                            <td className="px-4 py-3 text-sm" style={{color:"var(--color-text)"}}>
                              {new Date(custo.data_custo + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </td>
                            <td className="px-4 py-3 text-sm" style={{color:"var(--color-text)"}}>{custo.descricao}</td>
                            <td className="px-4 py-3 text-sm" style={{color:"var(--color-text)"}}>
                              <span style={{padding:"0.15rem 0.5rem",borderRadius:"var(--radius-sm)",fontSize:"0.7rem",background:"rgba(59,130,246,0.15)",color:"#3b82f6",border:"1px solid rgba(59,130,246,0.3)"}}>
                                {custo.categoria}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-bold text-red-600" style={{color:"var(--color-text)"}}>
                              R$ {parseFloat(custo.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-sm" style={{color:"var(--color-text)"}}>{custo.forma_pagamento}</td>
                            <td className="px-4 py-3 text-sm" style={{color:"var(--color-text)"}}>{custo.responsavel}</td>
                            {permissoes?.canEdit && (
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => excluirCusto(custo.id)}
                                  style={{padding:"0.15rem 0.5rem",borderRadius:"var(--radius-sm)",fontSize:"0.7rem",background:"rgba(239,68,68,0.15)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.3)",cursor:"pointer"}}
                                >
                                  🗑️
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{borderTop:"2px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}>
                          <td colSpan="3" className="px-4 py-3 text-right font-bold">
                            TOTAL:
                          </td>
                          <td style={{padding:"0.75rem 1rem",textAlign:"right",fontWeight:"800",color:"#ef4444",fontSize:"1.05rem"}}>
                            R$ {custosDoModal.reduce((sum, c) => sum + parseFloat(c.valor), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
