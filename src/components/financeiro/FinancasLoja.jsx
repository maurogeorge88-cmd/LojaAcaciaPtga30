import React, { useState, useEffect } from 'react';
import { supabase } from '../../App';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// ========================================
// ⚙️ CONFIGURAÇÃO DE STATUS - LOJA ACÁCIA
// ========================================
// Status dos irmãos da A∴R∴L∴S∴ Acácia de Paranatinga nº 30

// Status que PODEM receber lançamentos financeiros
const STATUS_PERMITIDOS = [
  'Regular',      // Irmão em situação regular
  'Irregular',    // Irmão irregular (precisa regularizar)
  'Licenciado',   // Irmão licenciado (recebe lançamentos)
];

// Status que NÃO DEVEM receber lançamentos
const STATUS_BLOQUEADOS = [
  'Suspenso',     // Irmão suspenso
  'Desligado',    // Irmão desligado
  'Excluído',     // Irmão excluído
  'Falecido',     // Irmão falecido
  'Ex-Ofício',    // Ex-ofício
];

export default function FinancasLoja({ showSuccess, showError, userEmail }) {
  // ========================================
  // 🕐 FUNÇÃO PARA CORRIGIR TIMEZONE
  // ========================================
  const corrigirTimezone = (data) => {
    if (!data) return '';
    const d = new Date(data + 'T00:00:00'); // Força horário local
    return d.toISOString().split('T')[0];
  };

  const formatarDataBR = (data) => {
    if (!data) return '';
    const d = new Date(data + 'T00:00:00');
    return d.toLocaleDateString('pt-BR');
  };

  const [categorias, setCategorias] = useState([]);
  const [irmaos, setIrmaos] = useState([]);
  const [lancamentos, setLancamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [mostrarModalIrmaos, setMostrarModalIrmaos] = useState(false);
  const [mostrarModalQuitacao, setMostrarModalQuitacao] = useState(false);
  const [mostrarModalQuitacaoLote, setMostrarModalQuitacaoLote] = useState(false);
  const [editando, setEditando] = useState(null);
  const [viewMode, setViewMode] = useState('lancamentos'); // 'lancamentos', 'inadimplentes', 'categorias'
  
  const [filtros, setFiltros] = useState({
    mes: 0, // 0 = Todos
    ano: 0, // 0 = Todos
    tipo: '', // 'receita' ou 'despesa'
    categoria: '',
    status: '', // 'pago', 'pendente', 'vencido', 'cancelado'
    origem_tipo: '', // 'Loja' ou 'Irmao'
    origem_irmao_id: '' // ID do irmão
  });

  // Estado para Modal de Parcelamento
  const [modalParcelamentoAberto, setModalParcelamentoAberto] = useState(false);
  const [lancamentoParcelar, setLancamentoParcelar] = useState(null); // Lançamento para parcelar

  // Estados para Pagamento Parcial
  const [modalPagamentoParcialAberto, setModalPagamentoParcialAberto] = useState(false);
  const [lancamentoPagamentoParcial, setLancamentoPagamentoParcial] = useState(null);
  const [pagamentosDoLancamento, setPagamentosDoLancamento] = useState([]);

  const [formLancamento, setFormLancamento] = useState({
    tipo: 'receita',
    categoria_id: '',
    descricao: '',
    valor: '',
    data_lancamento: new Date().toISOString().split('T')[0],
    data_vencimento: new Date().toISOString().split('T')[0],
    tipo_pagamento: 'dinheiro',
    data_pagamento: '',
    status: 'pendente', // CORRIGIDO: usar 'pendente' ou 'pago'
    comprovante_url: '',
    observacoes: '',
    origem_tipo: 'Loja', // ← NOVO: 'Loja' ou 'Irmao'
    origem_irmao_id: '' // ← NOVO: ID do irmão se origem_tipo = 'Irmao'
  });

  // Para lançamento em lote de irmãos
  const [lancamentoIrmaos, setLancamentoIrmaos] = useState({
    categoria_id: '',
    descricao: '',
    valor: '',
    data_lancamento: new Date().toISOString().split('T')[0],
    data_vencimento: new Date().toISOString().split('T')[0],
    tipo_pagamento: 'dinheiro',
    irmaos_selecionados: [],
    eh_mensalidade: false  // NOVO: indica se é mensalidade
  });

  // Para quitação individual
  const [quitacaoForm, setQuitacaoForm] = useState({
    lancamento_id: null,
    data_pagamento: new Date().toISOString().split('T')[0],
    tipo_pagamento: 'dinheiro',
    observacoes: ''
  });

  // Para quitação em lote
  const [quitacaoLote, setQuitacaoLote] = useState({
    lancamentos_selecionados: [],
    data_pagamento: new Date().toISOString().split('T')[0],
    tipo_pagamento: 'dinheiro'
  });

  const tiposPagamento = [
    { value: 'dinheiro', label: '💵 Dinheiro' },
    { value: 'pix', label: '📱 PIX' },
    { value: 'transferencia', label: '🏦 Transferência' },
    { value: 'debito', label: '💳 Débito' },
    { value: 'credito', label: '💳 Crédito' },
    { value: 'cheque', label: '📝 Cheque' }
  ];

  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  useEffect(() => {
    carregarDados();
  }, [filtros.mes, filtros.ano]);

  // Recarregar lançamentos quando mudar filtros
  useEffect(() => {
    if (categorias.length > 0) {
      carregarLancamentos();
    }
  }, [filtros.tipo, filtros.categoria, filtros.status, filtros.origem_tipo, filtros.origem_irmao_id]); // ← ADICIONAR origem

  const carregarDados = async () => {
    setLoading(true);
    try {
      console.log('🔄 Iniciando carregamento de dados...');
      
      // Carregar categorias (com hierarquia)
      const { data: catData, error: catError } = await supabase
        .from('categorias_financeiras')
        .select('*')
        .eq('ativo', true)
        .order('tipo')
        .order('nivel')
        .order('ordem')
        .order('nome');

      if (catError) {
        console.error('❌ Erro ao carregar categorias:', catError);
        throw catError;
      }
      console.log('✅ Categorias carregadas:', catData?.length || 0);
      setCategorias(catData || []);

      // Carregar irmãos (com status permitidos)
      console.log('🔍 Buscando irmãos...');
      
      const { data: todosIrmaos, error: irmaoError } = await supabase
        .from('irmaos')
        .select('id, nome, situacao, periodicidade_pagamento')
        .order('nome');

      if (irmaoError) {
        console.error('❌ Erro ao carregar irmãos:', irmaoError);
        throw irmaoError;
      }
      
      console.log('📋 Total de irmãos cadastrados:', todosIrmaos?.length || 0);
      
      // Verificar quais status existem no banco
      const statusUnicos = [...new Set(todosIrmaos?.map(i => i.situacao) || [])];
      console.log('🏷️ Status encontrados no banco:', statusUnicos);
      
      // Contagem por status
      const contagemStatus = {};
      todosIrmaos?.forEach(i => {
        const status = i.situacao || 'SEM STATUS';
        contagemStatus[status] = (contagemStatus[status] || 0) + 1;
      });
      console.log('📊 Distribuição por status:', contagemStatus);
      console.log('⚙️ Status permitidos (configuração):', STATUS_PERMITIDOS);
      
      // Filtrar irmãos com status permitidos (case-insensitive)
      const irmaosDisponiveis = todosIrmaos?.filter(i => {
        const status = (i.situacao || '').trim();
        
        // Verifica se está na lista de permitidos
        const estaPermitido = STATUS_PERMITIDOS.some(sp => 
          sp.toLowerCase() === status.toLowerCase()
        );
        
        // Verifica se NÃO está na lista de bloqueados
        const estaBloqueado = STATUS_BLOQUEADOS.some(sb => 
          sb.toLowerCase() === status.toLowerCase()
        );
        
        return estaPermitido && !estaBloqueado;
      }) || [];
      
      console.log('✅ Irmãos disponíveis para lançamento:', irmaosDisponiveis.length);
      
      if (irmaosDisponiveis.length === 0) {
        console.warn('⚠️ NENHUM IRMÃO DISPONÍVEL PARA LANÇAMENTO!');
        console.warn('');
        console.warn('🔍 DIAGNÓSTICO:');
        console.warn('  • Status encontrados no banco:', statusUnicos);
        console.warn('  • Status permitidos no código:', STATUS_PERMITIDOS);
        console.warn('  • Status bloqueados:', STATUS_BLOQUEADOS);
        console.warn('');
        console.warn('💡 SOLUÇÃO:');
        console.warn('  1. Verifique se os status do banco correspondem aos permitidos');
        console.warn('  2. Ajuste STATUS_PERMITIDOS no início do arquivo FinancasLoja.jsx');
        console.warn('  3. Adicione os status do seu banco na configuração');
        console.warn('');
        console.warn('📋 Primeiros 5 irmãos:', todosIrmaos?.slice(0, 5));
      } else {
        console.log('📝 Exemplo de irmãos carregados:', irmaosDisponiveis.slice(0, 3));
      }
      
      setIrmaos(irmaosDisponiveis);

      // Carregar lançamentos
      await carregarLancamentos();

    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
      showError('Erro ao carregar dados: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const carregarLancamentos = async () => {
    try {
      const { mes, ano, tipo, categoria, status, origem_tipo, origem_irmao_id } = filtros;

      let query = supabase
        .from('lancamentos_loja')
        .select(`
          *,
          categorias_financeiras(nome, tipo),
          irmaos(nome)
        `)
        .order('data_lancamento', { ascending: false });

      // Filtro de MÊS e ANO (0 = Todos)
      if (mes > 0 && ano > 0) {
        const primeiroDia = `${ano}-${mes.toString().padStart(2, '0')}-01`;
        const ultimoDia = new Date(ano, mes, 0).getDate();
        const ultimoDiaFormatado = `${ano}-${mes.toString().padStart(2, '0')}-${ultimoDia}`;
        query = query.gte('data_lancamento', primeiroDia).lte('data_lancamento', ultimoDiaFormatado);
      } else if (ano > 0) {
        // Apenas ano selecionado
        query = query.gte('data_lancamento', `${ano}-01-01`).lte('data_lancamento', `${ano}-12-31`);
      }

      // Filtro de TIPO (receita/despesa)
      if (tipo) {
        const categoriasDoTipo = categorias
          .filter(c => c.tipo === tipo)
          .map(c => c.id);
        if (categoriasDoTipo.length > 0) {
          query = query.in('categoria_id', categoriasDoTipo);
        }
      }

      // Filtro de CATEGORIA específica
      if (categoria) {
        query = query.eq('categoria_id', parseInt(categoria));
      }

      // Filtro de STATUS
      if (status) {
        query = query.eq('status', status);
      }

      // Filtro de ORIGEM (Loja ou Irmão)
      if (origem_tipo) {
        query = query.eq('origem_tipo', origem_tipo);
      }

      // Filtro de IRMÃO específico
      if (origem_irmao_id) {
        query = query.eq('origem_irmao_id', parseInt(origem_irmao_id));
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
        tipo: formLancamento.tipo,
        categoria_id: parseInt(formLancamento.categoria_id),
        descricao: formLancamento.descricao,
        valor: parseFloat(formLancamento.valor),
        data_lancamento: formLancamento.data_lancamento,
        data_vencimento: formLancamento.data_vencimento,
        tipo_pagamento: formLancamento.tipo_pagamento,
        data_pagamento: formLancamento.data_pagamento || null,
        status: formLancamento.status, // CORRIGIDO: usar 'pendente' ou 'pago'
        comprovante_url: formLancamento.comprovante_url || null,
        observacoes: formLancamento.observacoes || null,
        origem_tipo: formLancamento.origem_tipo || 'Loja', // ← NOVO
        origem_irmao_id: formLancamento.origem_irmao_id ? parseInt(formLancamento.origem_irmao_id) : null // ← NOVO
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
      const lancamentosParaInserir = lancamentoIrmaos.irmaos_selecionados.map(irmaoId => {
        const irmao = irmaos.find(i => i.id === irmaoId);
        return {
          tipo: 'receita',
          categoria_id: parseInt(lancamentoIrmaos.categoria_id),
          descricao: lancamentoIrmaos.descricao, // ← REMOVER nome do irmão da descrição
          valor: parseFloat(lancamentoIrmaos.valor),
          data_lancamento: lancamentoIrmaos.data_lancamento,
          data_vencimento: lancamentoIrmaos.data_vencimento,
          tipo_pagamento: lancamentoIrmaos.tipo_pagamento,
          status: 'pendente',
          origem_tipo: 'Irmao', // ← NOVO: marcar como origem Irmão
          origem_irmao_id: irmaoId // ← NOVO: ID do irmão
        };
      });

      const { error } = await supabase
        .from('lancamentos_loja')
        .insert(lancamentosParaInserir);

      if (error) throw error;

      showSuccess(`${lancamentosParaInserir.length} lançamentos criados com sucesso!`);
      setMostrarModalIrmaos(false);
      limparLancamentoIrmaos();
      await carregarLancamentos();

    } catch (error) {
      console.error('Erro ao criar lançamentos:', error);
      showError('Erro ao criar lançamentos: ' + error.message);
    }
  };

  // NOVA FUNÇÃO: Quitação individual rápida
  const abrirModalQuitacao = async (lancamento) => {
    try {
      // Buscar pagamentos parciais deste lançamento
      const { data: pagamentos, error } = await supabase
        .from('lancamentos_loja')
        .select('*')
        .eq('lancamento_principal_id', lancamento.id)
        .eq('eh_pagamento_parcial', true);

      if (error) throw error;

      const totalPago = pagamentos ? pagamentos.reduce((sum, pag) => sum + parseFloat(pag.valor), 0) : 0;
      const valorRestante = lancamento.valor - totalPago;

      // Se tem pagamentos parciais, abrir modal de pagamento parcial ao invés de quitação
      if (pagamentos && pagamentos.length > 0) {
        setPagamentosDoLancamento(pagamentos);
        setLancamentoPagamentoParcial(lancamento);
        setModalPagamentoParcialAberto(true);
      } else {
        // Quitação normal
        setQuitacaoForm({
          lancamento_id: lancamento.id,
          data_pagamento: new Date().toISOString().split('T')[0],
          tipo_pagamento: lancamento.tipo_pagamento || 'dinheiro',
          observacoes: lancamento.observacoes || ''
        });
        setMostrarModalQuitacao(true);
      }
    } catch (error) {
      console.error('Erro:', error);
      showError('Erro ao abrir quitação: ' + error.message);
    }
  };

  const handleQuitacao = async (e) => {
    e.preventDefault();

    try {
      const { error } = await supabase
        .from('lancamentos_loja')
        .update({
          status: 'pago',
          data_pagamento: quitacaoForm.data_pagamento,
          tipo_pagamento: quitacaoForm.tipo_pagamento,
          observacoes: quitacaoForm.observacoes
        })
        .eq('id', quitacaoForm.lancamento_id);

      if (error) throw error;

      showSuccess('Lançamento quitado com sucesso!');
      setMostrarModalQuitacao(false);
      await carregarLancamentos();

    } catch (error) {
      console.error('Erro ao quitar lançamento:', error);
      showError('Erro ao quitar lançamento: ' + error.message);
    }
  };

  // NOVA FUNÇÃO: Quitação em lote
  const toggleLancamentoParaQuitacao = (lancamentoId) => {
    setQuitacaoLote(prev => ({
      ...prev,
      lancamentos_selecionados: prev.lancamentos_selecionados.includes(lancamentoId)
        ? prev.lancamentos_selecionados.filter(id => id !== lancamentoId)
        : [...prev.lancamentos_selecionados, lancamentoId]
    }));
  };

  const selecionarTodosParaQuitacao = () => {
    const lancamentosPendentes = lancamentos
      .filter(l => l.status === 'pendente')
      .map(l => l.id);
    setQuitacaoLote(prev => ({
      ...prev,
      lancamentos_selecionados: lancamentosPendentes
    }));
  };

  const limparSelecaoQuitacao = () => {
    setQuitacaoLote(prev => ({
      ...prev,
      lancamentos_selecionados: []
    }));
  };

  const handleQuitacaoLote = async (e) => {
    e.preventDefault();

    if (quitacaoLote.lancamentos_selecionados.length === 0) {
      showError('Selecione pelo menos um lançamento!');
      return;
    }

    try {
      const { error } = await supabase
        .from('lancamentos_loja')
        .update({
          status: 'pago',
          data_pagamento: quitacaoLote.data_pagamento,
          tipo_pagamento: quitacaoLote.tipo_pagamento
        })
        .in('id', quitacaoLote.lancamentos_selecionados);

      if (error) throw error;

      showSuccess(`${quitacaoLote.lancamentos_selecionados.length} lançamentos quitados com sucesso!`);
      setMostrarModalQuitacaoLote(false);
      setQuitacaoLote({
        lancamentos_selecionados: [],
        data_pagamento: new Date().toISOString().split('T')[0],
        tipo_pagamento: 'dinheiro'
      });
      await carregarLancamentos();

    } catch (error) {
      console.error('Erro ao quitar lançamentos:', error);
      showError('Erro ao quitar lançamentos: ' + error.message);
    }
  };

  const togglePago = async (id, statusAtual) => {
    try {
      const novoStatus = statusAtual === 'pago' ? 'pendente' : 'pago';
      const dataAtual = new Date().toISOString().split('T')[0];

      const { error } = await supabase
        .from('lancamentos_loja')
        .update({
          status: novoStatus,
          data_pagamento: novoStatus === 'pago' ? dataAtual : null
        })
        .eq('id', id);

      if (error) throw error;

      showSuccess(`Status atualizado para ${novoStatus === 'pago' ? 'PAGO' : 'PENDENTE'}!`);
      await carregarLancamentos();

    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      showError('Erro ao atualizar status: ' + error.message);
    }
  };

  const editarLancamento = (lancamento) => {
    setFormLancamento({
      tipo: lancamento.tipo,
      categoria_id: lancamento.categoria_id,
      descricao: lancamento.descricao,
      valor: lancamento.valor,
      data_lancamento: lancamento.data_lancamento,
      data_vencimento: lancamento.data_vencimento,
      tipo_pagamento: lancamento.tipo_pagamento,
      data_pagamento: lancamento.data_pagamento || '',
      status: lancamento.status,
      comprovante_url: lancamento.comprovante_url || '',
      observacoes: lancamento.observacoes || '',
      origem_tipo: lancamento.origem_tipo || 'Loja', // ← ADICIONAR
      origem_irmao_id: lancamento.origem_irmao_id || '' // ← ADICIONAR
    });
    setEditando(lancamento.id);
    setMostrarFormulario(true);
  };

  const excluirLancamento = async (id) => {
    if (!window.confirm('Deseja realmente excluir este lançamento?')) return;

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

  const abrirModalPagamentoParcial = async (lancamento) => {
    try {
      // Buscar todos os pagamentos parciais deste lançamento
      const { data: pagamentos, error } = await supabase
        .from('lancamentos_loja')
        .select('*')
        .eq('lancamento_principal_id', lancamento.id)
        .eq('eh_pagamento_parcial', true)
        .order('data_pagamento', { ascending: true });

      if (error) throw error;

      setPagamentosDoLancamento(pagamentos || []);
      setLancamentoPagamentoParcial(lancamento);
      setModalPagamentoParcialAberto(true);
    } catch (error) {
      console.error('Erro:', error);
      showError('Erro ao carregar pagamentos: ' + error.message);
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
      status: 'pendente',
      comprovante_url: '',
      observacoes: '',
      origem_tipo: 'Loja', // ← ADICIONAR
      origem_irmao_id: '' // ← ADICIONAR
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
      irmaos_selecionados: [],
      eh_mensalidade: false
    });
  };

  // ========================================
  // 🌳 HELPER: RENDERIZAR CATEGORIAS HIERÁRQUICAS
  // ========================================
  const renderizarOpcoesCategoria = (tipo) => {
    const categoriasFiltradas = categorias.filter(c => c.tipo === tipo);
    const principais = categoriasFiltradas.filter(c => c.nivel === 1 || !c.categoria_pai_id);
    
    const opcoes = [];
    
    principais.forEach(principal => {
      // Adicionar categoria principal
      opcoes.push(
        <option key={principal.id} value={principal.id}>
          {principal.nome}
        </option>
      );
      
      // Adicionar subcategorias
      const subcategorias = categoriasFiltradas.filter(c => c.categoria_pai_id === principal.id);
      subcategorias.forEach(sub => {
        opcoes.push(
          <option key={sub.id} value={sub.id}>
            &nbsp;&nbsp;&nbsp;&nbsp;└─ {sub.nome}
          </option>
        );
        
        // Adicionar sub-subcategorias (nível 3)
        const subSub = categoriasFiltradas.filter(c => c.categoria_pai_id === sub.id);
        subSub.forEach(ss => {
          opcoes.push(
            <option key={ss.id} value={ss.id}>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└─ {ss.nome}
            </option>
          );
        });
      });
    });
    
    return opcoes;
  };

  const toggleIrmaoSelecionado = (irmaoId) => {
    setLancamentoIrmaos(prev => ({
      ...prev,
      irmaos_selecionados: prev.irmaos_selecionados.includes(irmaoId)
        ? prev.irmaos_selecionados.filter(id => id !== irmaoId)
        : [...prev.irmaos_selecionados, irmaoId]
    }));
  };

  const selecionarTodosIrmaos = () => {
    // Filtrar irmãos baseado se é mensalidade ou não
    const irmaosDisponiveis = irmaos.filter(irmao => {
      if (lancamentoIrmaos.eh_mensalidade) {
        return irmao.periodicidade_pagamento === 'Mensal' || !irmao.periodicidade_pagamento;
      }
      return true;
    });
    
    setLancamentoIrmaos(prev => ({
      ...prev,
      irmaos_selecionados: irmaosDisponiveis.map(i => i.id)
    }));
  };

  const limparSelecaoIrmaos = () => {
    setLancamentoIrmaos(prev => ({
      ...prev,
      irmaos_selecionados: []
    }));
  };

  const calcularResumo = () => {
    const receitas = lancamentos
      .filter(l => l.categorias_financeiras?.tipo === 'receita' && l.status === 'pago')
      .reduce((sum, l) => sum + parseFloat(l.valor), 0);

    const despesas = lancamentos
      .filter(l => l.categorias_financeiras?.tipo === 'despesa' && l.status === 'pago')
      .reduce((sum, l) => sum + parseFloat(l.valor), 0);

    const receitasPendentes = lancamentos
      .filter(l => l.categorias_financeiras?.tipo === 'receita' && l.status === 'pendente')
      .reduce((sum, l) => sum + parseFloat(l.valor), 0);

    const despesasPendentes = lancamentos
      .filter(l => l.categorias_financeiras?.tipo === 'despesa' && l.status === 'pendente')
      .reduce((sum, l) => sum + parseFloat(l.valor), 0);

    return {
      receitas,
      despesas,
      saldo: receitas - despesas,
      receitasPendentes,
      despesasPendentes
    };
  };

  const gerarPDF = () => {
    const doc = new jsPDF();
    const resumo = calcularResumo();

    // Título
    doc.setFontSize(18);
    doc.text('Relatório Financeiro da Loja', 14, 20);
    
    // Período
    doc.setFontSize(12);
    const mesNome = filtros.mes > 0 ? meses[filtros.mes - 1] : 'Todos os meses';
    doc.text(`Período: ${mesNome}/${filtros.ano}`, 14, 30);
    
    // Resumo
    doc.setFontSize(14);
    doc.text('Resumo', 14, 40);
    doc.setFontSize(10);
    doc.text(`Receitas Pagas: R$ ${resumo.receitas.toFixed(2)}`, 14, 48);
    doc.text(`Despesas Pagas: R$ ${resumo.despesas.toFixed(2)}`, 14, 54);
    doc.text(`Saldo: R$ ${resumo.saldo.toFixed(2)}`, 14, 60);
    doc.text(`Receitas Pendentes: R$ ${resumo.receitasPendentes.toFixed(2)}`, 14, 66);
    doc.text(`Despesas Pendentes: R$ ${resumo.despesasPendentes.toFixed(2)}`, 14, 72);

    // Tabela de lançamentos
    const dadosTabela = lancamentos.map(l => [
      formatarDataBR(l.data_lancamento),
      l.categorias_financeiras?.tipo === 'receita' ? 'Receita' : 'Despesa',
      l.categorias_financeiras?.nome,
      l.descricao,
      `R$ ${parseFloat(l.valor).toFixed(2)}`,
      l.status === 'pago' ? 'Pago' : 'Pendente'
    ]);

    doc.autoTable({
      head: [['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor', 'Status']],
      body: dadosTabela,
      startY: 80,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] }
    });

    doc.save(`relatorio-financeiro-${filtros.mes}-${filtros.ano}.pdf`);
  };

  // ========================================
  // 📊 RELATÓRIO RESUMIDO POR CATEGORIA
  // ========================================
  const gerarPDFResumido = () => {
    const doc = new jsPDF();
    
    // Logo/Cabeçalho
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Acácia de Paranatinga nº 30', 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Avenida Brasil, Paranatinga-MT', 105, 26, { align: 'center' });
    doc.text('Paranatinga-MT', 105, 31, { align: 'center' });
    
    // Período
    doc.setFillColor(173, 216, 230);
    doc.rect(10, 36, 90, 8, 'F');
    doc.rect(100, 36, 100, 8, 'F');
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(filtros.ano.toString(), 59, 41, { align: 'center' });
    const mesNome = filtros.mes > 0 ? meses[filtros.mes - 1] : 'Todos os meses';
    doc.text(mesNome, 150, 41, { align: 'center' });

    let yPos = 52;

    // ========================================
    // ORGANIZAR POR HIERARQUIA
    // ========================================
    const organizarHierarquia = (tipo) => {
      // Pegar categorias principais (nível 1)
      const catsPrincipais = categorias.filter(c => 
        c.tipo === tipo && 
        (c.nivel === 1 || !c.categoria_pai_id)
      );

      // Para cada principal, buscar subcategorias e lançamentos
      return catsPrincipais.map(principal => {
        // Subcategorias desta principal
        const subcats = categorias.filter(c => c.categoria_pai_id === principal.id);
        
        // Lançamentos diretos na principal
        const lancsDiretos = lancamentos.filter(l => 
          l.categoria_id === principal.id &&
          l.categorias_financeiras?.tipo === tipo
        );
        
        // Subcategorias com lançamentos
        const subcatsComLancs = subcats.map(sub => {
          const lancsSubcat = lancamentos.filter(l => 
            l.categoria_id === sub.id &&
            l.categorias_financeiras?.tipo === tipo
          );
          return {
            categoria: sub,
            lancamentos: lancsSubcat,
            subtotal: lancsSubcat.reduce((sum, l) => sum + parseFloat(l.valor), 0)
          };
        }).filter(sc => sc.lancamentos.length > 0);

        const subtotalDireto = lancsDiretos.reduce((sum, l) => sum + parseFloat(l.valor), 0);
        const subtotalSubs = subcatsComLancs.reduce((sum, sc) => sum + sc.subtotal, 0);

        return {
          principal,
          lancamentosDiretos: lancsDiretos,
          subcategorias: subcatsComLancs,
          subtotalTotal: subtotalDireto + subtotalSubs
        };
      }).filter(cp => cp.subtotalTotal > 0); // Só mostrar se tiver valores
    };

    // ========================================
    // DESPESAS HIERÁRQUICAS
    // ========================================
    const despesasHierarquia = organizarHierarquia('despesa');
    const totalDespesas = despesasHierarquia.reduce((sum, cp) => sum + cp.subtotalTotal, 0);

    // Título Despesas
    doc.setFillColor(154, 205, 50);
    doc.rect(10, yPos, 190, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Despesa', 105, yPos + 5.5, { align: 'center' });
    
    yPos += 12;
    doc.setTextColor(0, 0, 0);

    // Para cada categoria principal
    despesasHierarquia.forEach(catPrincipal => {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      // Nome da Categoria Principal
      doc.setFillColor(173, 216, 230);
      doc.rect(10, yPos, 190, 6, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(catPrincipal.principal.nome, 12, yPos + 4);
      yPos += 8;

      // Cabeçalho da tabela
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('DataLanc', 10, yPos);
      doc.text('Interessado', 32, yPos);
      doc.text('Descrição', 80, yPos);
      doc.text('Obs', 140, yPos);
      doc.text('Despesa', 200, yPos, { align: 'right' });
      yPos += 4;

      // Lançamentos diretos na principal
      doc.setFont('helvetica', 'normal');
      catPrincipal.lancamentosDiretos.forEach(lanc => {
        if (yPos > 275) {
          doc.addPage();
          yPos = 20;
        }

        const dataLanc = formatarDataBR(lanc.data_lancamento);
        const interessado = lanc.origem_tipo === 'Loja' ? 
          (lanc.descricao.substring(0, 22)) : 
          (lanc.irmaos?.nome?.split(' ').slice(0, 2).join(' ') || 'Irmão');
        const descricao = lanc.categorias_financeiras?.nome?.substring(0, 28) || '';
        const obs = (lanc.observacoes || '').substring(0, 35);
        const valor = parseFloat(lanc.valor);

        doc.text(dataLanc, 10, yPos);
        doc.text(interessado.substring(0, 22), 32, yPos);
        doc.text(descricao, 80, yPos);
        doc.text(obs, 140, yPos);
        doc.text(`R$${valor.toFixed(2)}`, 200, yPos, { align: 'right' });
        
        yPos += 4;
      });

      // Subcategorias
      catPrincipal.subcategorias.forEach(subcat => {
        subcat.lancamentos.forEach(lanc => {
          if (yPos > 275) {
            doc.addPage();
            yPos = 20;
          }

          const dataLanc = formatarDataBR(lanc.data_lancamento);
          const interessado = lanc.origem_tipo === 'Loja' ? 
            (lanc.descricao.substring(0, 22)) : 
            (lanc.irmaos?.nome?.split(' ').slice(0, 2).join(' ') || 'Irmão');
          const descricao = lanc.categorias_financeiras?.nome?.substring(0, 28) || '';
          const obs = (lanc.observacoes || '').substring(0, 35);
          const valor = parseFloat(lanc.valor);

          doc.text(dataLanc, 10, yPos);
          doc.text(interessado.substring(0, 22), 32, yPos);
          doc.text(descricao, 80, yPos);
          doc.text(obs, 140, yPos);
          doc.text(`R$${valor.toFixed(2)}`, 200, yPos, { align: 'right' });
          
          yPos += 4;
        });
      });

      // Subtotal da categoria principal
      yPos += 2;
      doc.setFont('helvetica', 'bold');
      doc.text('Sub Total Despesa', 150, yPos, { align: 'right' });
      doc.text(`R$ ${catPrincipal.subtotalTotal.toFixed(2)}`, 200, yPos, { align: 'right' });
      
      yPos += 8;
    });

    // ========================================
    // RECEITAS HIERÁRQUICAS
    // ========================================
    const receitasHierarquia = organizarHierarquia('receita');
    const totalReceitas = receitasHierarquia.reduce((sum, cp) => sum + cp.subtotalTotal, 0);

    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    // Título Receitas
    doc.setFillColor(33, 150, 243);
    doc.rect(10, yPos, 190, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Receita', 105, yPos + 5.5, { align: 'center' });
    
    yPos += 12;
    doc.setTextColor(0, 0, 0);

    // Para cada categoria principal de receitas
    receitasHierarquia.forEach(catPrincipal => {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      // Nome da Categoria Principal
      doc.setFillColor(173, 216, 230);
      doc.rect(10, yPos, 190, 6, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(catPrincipal.principal.nome, 12, yPos + 4);
      yPos += 8;

      // AGRUPAR subcategoria "Mensalidade" em uma linha
      const subcatMensalidade = catPrincipal.subcategorias.find(s => s.categoria.nome === 'Mensalidade');
      
      if (subcatMensalidade && subcatMensalidade.lancamentos.length > 0) {
        const dataLanc = formatarDataBR(subcatMensalidade.lancamentos[subcatMensalidade.lancamentos.length - 1].data_lancamento);
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('DataLanc', 10, yPos);
        doc.text('Interessado', 32, yPos);
        doc.text('Descrição', 80, yPos);
        doc.text('Obs', 140, yPos);
        doc.text('Receita', 200, yPos, { align: 'right' });
        yPos += 4;

        doc.setFont('helvetica', 'normal');
        doc.text(dataLanc, 10, yPos);
        doc.text('Irmãos - Acacia Paranatinga nº 30', 32, yPos);
        doc.text('Mensalidade e Peculio - Irmao', 80, yPos);
        doc.text('', 140, yPos);
        doc.text(`R$${subcatMensalidade.subtotal.toFixed(2)}`, 200, yPos, { align: 'right' });
        yPos += 4;
        
        // Remover Mensalidade para não mostrar depois
        catPrincipal.subcategorias = catPrincipal.subcategorias.filter(s => s.categoria.nome !== 'Mensalidade');
      } else if (catPrincipal.lancamentosDiretos.length > 0 || catPrincipal.subcategorias.length > 0) {
        // Cabeçalho para outras categorias
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('DataLanc', 10, yPos);
        doc.text('Interessado', 32, yPos);
        doc.text('Descrição', 80, yPos);
        doc.text('Obs', 140, yPos);
        doc.text('Receita', 200, yPos, { align: 'right' });
        yPos += 4;
      }

      // Lançamentos diretos
      doc.setFont('helvetica', 'normal');
      catPrincipal.lancamentosDiretos.forEach(lanc => {
        if (yPos > 275) {
          doc.addPage();
          yPos = 20;
        }

        const dataLanc = formatarDataBR(lanc.data_lancamento);
        const interessado = 'Irmãos - Acacia Paranatinga nº 30';
        const descricao = lanc.categorias_financeiras?.nome?.substring(0, 28) || '';
        const obs = (lanc.observacoes || '').substring(0, 35);
        const valor = parseFloat(lanc.valor);

        doc.text(dataLanc, 10, yPos);
        doc.text(interessado.substring(0, 22), 32, yPos);
        doc.text(descricao, 80, yPos);
        doc.text(obs, 140, yPos);
        doc.text(`R$${valor.toFixed(2)}`, 200, yPos, { align: 'right' });
        
        yPos += 4;
      });

      // Outras subcategorias
      catPrincipal.subcategorias.forEach(subcat => {
        subcat.lancamentos.forEach(lanc => {
          if (yPos > 275) {
            doc.addPage();
            yPos = 20;
          }

          const dataLanc = formatarDataBR(lanc.data_lancamento);
          const interessado = 'Irmãos - Acacia Paranatinga nº 30';
          const descricao = lanc.categorias_financeiras?.nome?.substring(0, 28) || '';
          const obs = (lanc.observacoes || '').substring(0, 35);
          const valor = parseFloat(lanc.valor);

          doc.text(dataLanc, 10, yPos);
          doc.text(interessado.substring(0, 22), 32, yPos);
          doc.text(descricao, 80, yPos);
          doc.text(obs, 140, yPos);
          doc.text(`R$${valor.toFixed(2)}`, 200, yPos, { align: 'right' });
          
          yPos += 4;
        });
      });

      // Subtotal
      yPos += 2;
      doc.setFont('helvetica', 'bold');
      doc.text('Sub Total Receita', 150, yPos, { align: 'right' });
      doc.text(`R$ ${catPrincipal.subtotalTotal.toFixed(2)}`, 200, yPos, { align: 'right' });
      
      yPos += 8;
    });

    // ========================================
    // TOTAL GERAL
    // ========================================
    const saldoTotal = totalReceitas - totalDespesas;

    if (yPos > 260) {
      doc.addPage();
      yPos = 20;
    }

    yPos += 4;
    doc.setFillColor(100, 100, 100);
    doc.rect(10, yPos, 190, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Total Geral de Receita e Despesa', 105, yPos + 5.5, { align: 'center' });
    
    yPos += 12;
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(10);
    doc.text('Total Receita', 150, yPos, { align: 'right' });
    doc.text(`R$ ${totalReceitas.toFixed(2)}`, 200, yPos, { align: 'right' });
    yPos += 5;
    
    doc.text('Total Despesa', 150, yPos, { align: 'right' });
    doc.text(`R$ ${totalDespesas.toFixed(2)}`, 200, yPos, { align: 'right' });
    yPos += 6;

    const corSaldo = saldoTotal >= 0 ? [0, 0, 0] : [255, 0, 0];
    doc.setTextColor(corSaldo[0], corSaldo[1], corSaldo[2]);
    doc.text('Saldo Total', 150, yPos, { align: 'right' });
    doc.text(`${saldoTotal >= 0 ? '' : '-'}R$ ${Math.abs(saldoTotal).toFixed(2)}`, 200, yPos, { align: 'right' });

    // Rodapé
    const dataGeracao = new Date().toLocaleDateString('pt-BR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    doc.setTextColor(128, 128, 128);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(dataGeracao, 10, 285);
    doc.text(`Página ${doc.internal.getNumberOfPages()} de ${doc.internal.getNumberOfPages()}`, 200, 285, { align: 'right' });

    doc.save(`Rel_Fechamento_-_${filtros.mes}_${filtros.ano}.pdf`);
  };

  // ========================================
  // 📊 RELATÓRIO INDIVIDUAL DE IRMÃO
  // ========================================
  const gerarRelatorioIndividual = async (irmaoId) => {
    try {
      showSuccess('Gerando relatório individual...');
      
      // Buscar dados do irmão
      const { data: irmaoData, error: irmaoError } = await supabase
        .from('irmaos')
        .select('nome, cpf, cim')
        .eq('id', irmaoId)
        .single();

      if (irmaoError) throw irmaoError;

      // Buscar lançamentos PENDENTES
      const { data: lancsData, error: lancsError } = await supabase
        .from('lancamentos_loja')
        .select(`
          *,
          categorias_financeiras(nome, tipo)
        `)
        .eq('origem_irmao_id', irmaoId)
        .eq('status', 'pendente')
        .order('data_vencimento');

      if (lancsError) throw lancsError;

      if (!lancsData || lancsData.length === 0) {
        showError('Este irmão não possui lançamentos pendentes!');
        return;
      }

      // Organizar por mês/ano
      const lancsPorMes = {};
      lancsData.forEach(lanc => {
        const data = new Date(lanc.data_vencimento + 'T00:00:00');
        const mesAno = `${data.getMonth() + 1}/${data.getFullYear()}`;
        const mesNome = meses[data.getMonth()];
        
        if (!lancsPorMes[mesAno]) {
          lancsPorMes[mesAno] = {
            mesNome,
            mes: data.getMonth() + 1,
            ano: data.getFullYear(),
            lancamentos: []
          };
        }
        
        lancsPorMes[mesAno].lancamentos.push(lanc);
      });

      // Criar PDF
      const doc = new jsPDF();
      let yPos = 20;

      // Cabeçalho
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Relatório de Despesas Pendentes', 105, yPos, { align: 'center' });
      yPos += 6;

      doc.setFontSize(11);
      doc.text('Grande Loja do Estado de Mato Grosso - GLEMT', 105, yPos, { align: 'center' });
      yPos += 5;
      doc.text('A∴R∴L∴S∴ Acácia de Paranatinga nº 30', 105, yPos, { align: 'center' });
      yPos += 10;

      // Dados do Irmão
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Nome', 15, yPos);
      doc.setFont('helvetica', 'bold');
      doc.text(irmaoData.nome, 35, yPos);
      yPos += 5;

      doc.setFont('helvetica', 'normal');
      doc.text('CPF', 15, yPos);
      doc.setFont('helvetica', 'bold');
      doc.text(irmaoData.cpf || 'Não informado', 35, yPos);
      yPos += 5;

      doc.setFont('helvetica', 'normal');
      doc.text('CIM', 15, yPos);
      doc.setFont('helvetica', 'bold');
      doc.text(irmaoData.cim || 'Não informado', 35, yPos);
      yPos += 10;

      // Totalizadores
      let totalGeralDespesa = 0;
      let totalGeralCredito = 0;

      // Para cada mês
      const mesesOrdenados = Object.keys(lancsPorMes).sort((a, b) => {
        const [mesA, anoA] = a.split('/').map(Number);
        const [mesB, anoB] = b.split('/').map(Number);
        return anoA !== anoB ? anoA - anoB : mesA - mesB;
      });

      mesesOrdenados.forEach(mesAno => {
        const mesInfo = lancsPorMes[mesAno];
        
        if (yPos > 240) {
          doc.addPage();
          yPos = 20;
        }

        // Título do Mês
        doc.setFillColor(173, 216, 230);
        doc.rect(15, yPos, 180, 7, 'F');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(mesInfo.mesNome, 17, yPos + 5);
        yPos += 9;

        // Cabeçalho
        doc.setFontSize(8);
        doc.text('DtLanc', 15, yPos);
        doc.text('Descrição', 40, yPos);
        doc.text('Despesa', 120, yPos, { align: 'right' });
        doc.text('Crédito', 150, yPos, { align: 'right' });
        doc.text('Saldo', 190, yPos, { align: 'right' });
        yPos += 4;

        // Lançamentos
        let subtotalDespesa = 0;  // O que o irmão DEVE
        let subtotalCredito = 0;  // O que o irmão TEM A RECEBER
        doc.setFont('helvetica', 'normal');
        
        mesInfo.lancamentos.forEach(lanc => {
          if (yPos > 275) {
            doc.addPage();
            yPos = 20;
          }

          const dataLanc = formatarDataBR(lanc.data_vencimento);
          const descricao = lanc.descricao?.substring(0, 40) || '';
          const valor = parseFloat(lanc.valor);
          const tipo = lanc.categorias_financeiras?.tipo;

          let valorDespesa = 0;
          let valorCredito = 0;

          // LÓGICA CORRETA:
          // - Se é RECEITA (ex: mensalidade) → Irmão DEVE (coluna Despesa)
          // - Se é DESPESA (ex: irmão pagou água) → Irmão TEM CRÉDITO (coluna Crédito)
          if (tipo === 'receita') {
            valorDespesa = valor;
            subtotalDespesa += valor;
          } else if (tipo === 'despesa') {
            valorCredito = valor;
            subtotalCredito += valor;
          }

          doc.text(dataLanc, 15, yPos);
          doc.text(descricao, 40, yPos);
          doc.text(valorDespesa > 0 ? `R$ ${valorDespesa.toFixed(2)}` : '', 120, yPos, { align: 'right' });
          doc.text(valorCredito > 0 ? `R$ ${valorCredito.toFixed(2)}` : '', 150, yPos, { align: 'right' });
          
          // Saldo parcial (despesa - crédito até aqui)
          const saldoParcial = subtotalDespesa - subtotalCredito;
          doc.setTextColor(saldoParcial > 0 ? 255 : 0, 0, 0);
          doc.text(`R$ ${Math.abs(saldoParcial).toFixed(2)}`, 190, yPos, { align: 'right' });
          doc.setTextColor(0, 0, 0);
          
          yPos += 4;
        });

        // Subtotal do mês
        const saldoMes = subtotalDespesa - subtotalCredito;
        yPos += 2;
        doc.setFont('helvetica', 'bold');
        doc.text('Sub Total', 100, yPos, { align: 'right' });
        doc.setTextColor(255, 0, 0);
        doc.text(`R$ ${Math.abs(saldoMes).toFixed(2)}`, 190, yPos, { align: 'right' });
        doc.setTextColor(0, 0, 0);
        
        totalGeralDespesa += subtotalDespesa;
        totalGeralCredito += subtotalCredito;
        yPos += 8;
      });

      // Total Final
      if (yPos > 220) {
        doc.addPage();
        yPos = 20;
      }

      // Dados Bancários
      doc.setFillColor(240, 240, 240);
      doc.rect(15, yPos, 80, 30, 'F');
      yPos += 5;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Dados Bancários', 55, yPos, { align: 'center' });
      yPos += 5;

      doc.setFontSize(8);
      doc.setTextColor(0, 100, 180);
      doc.setFont('helvetica', 'bold');
      doc.text('Cooperativa de Crédito Sicredi', 55, yPos, { align: 'center' });
      yPos += 4;

      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.text('Ag.: 0802 - C.C.: 86.913-9', 55, yPos, { align: 'center' });
      yPos += 4;
      doc.text('PIX.: 03.250.704/0001-00', 55, yPos, { align: 'center' });

      // Total (lado direito)
      yPos -= 13;
      const saldoFinal = totalGeralDespesa - totalGeralCredito;
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Total Despesa', 145, yPos, { align: 'right' });
      doc.setTextColor(255, 0, 0);
      doc.text(`R$ ${totalGeralDespesa.toFixed(2)}`, 190, yPos, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      yPos += 5;

      doc.text('Total Crédito', 145, yPos, { align: 'right' });
      doc.setTextColor(0, 150, 0);
      doc.text(`R$ ${totalGeralCredito.toFixed(2)}`, 190, yPos, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      yPos += 5;

      doc.text('Saldo', 145, yPos, { align: 'right' });
      doc.setTextColor(saldoFinal > 0 ? 255 : 0, 0, 0);
      doc.text(`R$ ${Math.abs(saldoFinal).toFixed(2)}`, 190, yPos, { align: 'right' });
      doc.setTextColor(0, 0, 0);

      // Salvar
      doc.save(`Relatorio_${irmaoData.nome.replace(/\s/g, '_')}.pdf`);
      showSuccess('Relatório gerado com sucesso!');

    } catch (error) {
      console.error('Erro:', error);
      showError('Erro ao gerar relatório: ' + error.message);
    }
  };

  const resumo = calcularResumo();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Carregando dados financeiros...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* CABEÇALHO COM BOTÕES */}
      <div className="flex justify-between items-center">
        <div className="flex gap-3">
          <button
            onClick={() => setViewMode('lancamentos')}
            className={`px-4 py-2 rounded-lg font-medium ${
              viewMode === 'lancamentos'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            📊 Lançamentos
          </button>
          <button
            onClick={() => setViewMode('inadimplentes')}
            className={`px-4 py-2 rounded-lg font-medium ${
              viewMode === 'inadimplentes'
                ? 'bg-red-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            ⚠️ Inadimplentes
          </button>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setMostrarFormulario(!mostrarFormulario)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
          >
            {mostrarFormulario ? '❌ Cancelar' : '➕ Novo Lançamento'}
          </button>
          <button
            onClick={() => setMostrarModalIrmaos(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
          >
            👥 Lançamento em Lote
          </button>
          <button
            onClick={() => setModalParcelamentoAberto(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
          >
            🔢 Parcelar
          </button>
          <button
            onClick={gerarPDF}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
          >
            📄 Relatório Detalhado
          </button>
          <button
            onClick={gerarPDFResumido}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            📊 Fechamento Mensal
          </button>
        </div>
      </div>

      {/* RESUMO FINANCEIRO */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-600 font-medium">Receitas Pagas</p>
          <p className="text-2xl font-bold text-green-700">R$ {resumo.receitas.toFixed(2)}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-600 font-medium">Despesas Pagas</p>
          <p className="text-2xl font-bold text-red-700">R$ {resumo.despesas.toFixed(2)}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-600 font-medium">Saldo</p>
          <p className={`text-2xl font-bold ${resumo.saldo >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
            R$ {resumo.saldo.toFixed(2)}
          </p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-600 font-medium">Receitas Pendentes</p>
          <p className="text-2xl font-bold text-yellow-700">R$ {resumo.receitasPendentes.toFixed(2)}</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <p className="text-sm text-orange-600 font-medium">Despesas Pendentes</p>
          <p className="text-2xl font-bold text-orange-700">R$ {resumo.despesasPendentes.toFixed(2)}</p>
        </div>
      </div>

      {/* FILTROS */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {/* Filtro Mês */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mês</label>
            <select
              value={filtros.mes}
              onChange={(e) => setFiltros({ ...filtros, mes: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value={0}>Todos</option>
              {meses.map((mes, idx) => (
                <option key={idx} value={idx + 1}>{mes}</option>
              ))}
            </select>
          </div>

          {/* Filtro Ano */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ano</label>
            <select
              value={filtros.ano}
              onChange={(e) => setFiltros({ ...filtros, ano: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value={0}>Todos</option>
              {[2023, 2024, 2025, 2026, 2027, 2028].map(ano => (
                <option key={ano} value={ano}>{ano}</option>
              ))}
            </select>
          </div>

          {/* Filtro Tipo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              value={filtros.tipo}
              onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              <option value="receita">Receitas</option>
              <option value="despesa">Despesas</option>
            </select>
          </div>

          {/* Filtro Categoria */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
            <select
              value={filtros.categoria}
              onChange={(e) => setFiltros({ ...filtros, categoria: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas</option>
              {categorias.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.nome}</option>
              ))}
            </select>
          </div>

          {/* Filtro Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filtros.status}
              onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              <option value="pago">Pagos</option>
              <option value="pendente">Pendentes</option>
              <option value="vencido">Vencidos</option>
              <option value="cancelado">Cancelados</option>
            </select>
          </div>

          {/* Filtro Origem */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Origem</label>
            <select
              value={filtros.origem_tipo}
              onChange={(e) => {
                setFiltros({ ...filtros, origem_tipo: e.target.value, origem_irmao_id: '' });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas</option>
              <option value="Loja">🏛️ Loja</option>
              <option value="Irmao">👤 Irmãos</option>
            </select>
          </div>

          {/* Filtro por Irmão (só aparece se origem = Irmão) */}
          {filtros.origem_tipo === 'Irmao' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Irmão</label>
              <select
                value={filtros.origem_irmao_id}
                onChange={(e) => setFiltros({ ...filtros, origem_irmao_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                {irmaos.map(irmao => (
                  <option key={irmao.id} value={irmao.id}>{irmao.nome}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* FORMULÁRIO DE NOVO LANÇAMENTO */}
      {mostrarFormulario && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {editando ? '✏️ Editar Lançamento' : '➕ Novo Lançamento'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo *
                </label>
                <select
                  value={formLancamento.tipo}
                  onChange={(e) => setFormLancamento({ ...formLancamento, tipo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="receita">📈 Receita</option>
                  <option value="despesa">📉 Despesa</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoria *
                </label>
                <select
                  value={formLancamento.categoria_id}
                  onChange={(e) => setFormLancamento({ ...formLancamento, categoria_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Selecione...</option>
                  {renderizarOpcoesCategoria(formLancamento.tipo)}
                </select>
              </div>

              {/* NOVO: Campo Origem */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Origem *
                </label>
                <select
                  value={formLancamento.origem_tipo}
                  onChange={(e) => {
                    setFormLancamento({ 
                      ...formLancamento, 
                      origem_tipo: e.target.value,
                      origem_irmao_id: '' // Limpar irmão ao mudar tipo
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="Loja">🏛️ Loja</option>
                  <option value="Irmao">👤 Irmão</option>
                </select>
              </div>

              {/* NOVO: Campo Irmão (só aparece se origem = Irmão) */}
              {formLancamento.origem_tipo === 'Irmao' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Irmão *
                  </label>
                  <select
                    value={formLancamento.origem_irmao_id}
                    onChange={(e) => setFormLancamento({ ...formLancamento, origem_irmao_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Selecione...</option>
                    {irmaos.map(irmao => (
                      <option key={irmao.id} value={irmao.id}>{irmao.nome}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição *
                </label>
                <input
                  type="text"
                  value={formLancamento.descricao}
                  onChange={(e) => setFormLancamento({ ...formLancamento, descricao: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formLancamento.valor}
                  onChange={(e) => setFormLancamento({ ...formLancamento, valor: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data Lançamento *
                </label>
                <input
                  type="date"
                  value={formLancamento.data_lancamento}
                  onChange={(e) => setFormLancamento({ ...formLancamento, data_lancamento: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data Vencimento *
                </label>
                <input
                  type="date"
                  value={formLancamento.data_vencimento}
                  onChange={(e) => setFormLancamento({ ...formLancamento, data_vencimento: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Pagamento
                </label>
                <select
                  value={formLancamento.tipo_pagamento}
                  onChange={(e) => setFormLancamento({ ...formLancamento, tipo_pagamento: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {tiposPagamento.map(tipo => (
                    <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={formLancamento.status}
                  onChange={(e) => {
                    const novoStatus = e.target.value;
                    setFormLancamento({ 
                      ...formLancamento, 
                      status: novoStatus,
                      data_pagamento: novoStatus === 'pago' ? new Date().toISOString().split('T')[0] : ''
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="pendente">⏳ Pendente</option>
                  <option value="pago">✅ Pago</option>
                  <option value="vencido">⚠️ Vencido</option>
                  <option value="cancelado">❌ Cancelado</option>
                </select>
              </div>

              {formLancamento.status === 'pago' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Pagamento
                  </label>
                  <input
                    type="date"
                    value={formLancamento.data_pagamento}
                    onChange={(e) => setFormLancamento({ ...formLancamento, data_pagamento: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observações
                </label>
                <textarea
                  value={formLancamento.observacoes}
                  onChange={(e) => setFormLancamento({ ...formLancamento, observacoes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows="3"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                {editando ? '💾 Salvar Alterações' : '✅ Criar Lançamento'}
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

      {/* MODAL LANÇAMENTO EM LOTE */}
      {mostrarModalIrmaos && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
              <h3 className="text-xl font-bold text-gray-900">👥 Lançamento em Lote para Irmãos</h3>
            </div>
            
            <form onSubmit={handleLancamentoIrmaos} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoria (Receita) *
                  </label>
                  <select
                    value={lancamentoIrmaos.categoria_id}
                    onChange={(e) => setLancamentoIrmaos({ ...lancamentoIrmaos, categoria_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Selecione...</option>
                    {renderizarOpcoesCategoria('receita')}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={lancamentoIrmaos.eh_mensalidade}
                        onChange={(e) => {
                          setLancamentoIrmaos({ 
                            ...lancamentoIrmaos, 
                            eh_mensalidade: e.target.checked,
                            irmaos_selecionados: [] // Limpa seleção ao mudar tipo
                          });
                        }}
                        className="w-5 h-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <div className="ml-3">
                        <span className="text-sm font-medium text-blue-900">
                          📅 Este lançamento é uma MENSALIDADE?
                        </span>
                        <p className="text-xs text-blue-700 mt-1">
                          {lancamentoIrmaos.eh_mensalidade 
                            ? '✅ Mostrando apenas irmãos com pagamento MENSAL' 
                            : '📋 Mostrando TODOS os irmãos (para outras cobranças)'}
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor por Irmão (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={lancamentoIrmaos.valor}
                    onChange={(e) => setLancamentoIrmaos({ ...lancamentoIrmaos, valor: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição Base *
                  </label>
                  <input
                    type="text"
                    value={lancamentoIrmaos.descricao}
                    onChange={(e) => setLancamentoIrmaos({ ...lancamentoIrmaos, descricao: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Mensalidade - Janeiro/2024"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    O nome do irmão será adicionado automaticamente no final
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Lançamento *
                  </label>
                  <input
                    type="date"
                    value={lancamentoIrmaos.data_lancamento}
                    onChange={(e) => setLancamentoIrmaos({ ...lancamentoIrmaos, data_lancamento: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Vencimento *
                  </label>
                  <input
                    type="date"
                    value={lancamentoIrmaos.data_vencimento}
                    onChange={(e) => setLancamentoIrmaos({ ...lancamentoIrmaos, data_vencimento: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Pagamento
                  </label>
                  <select
                    value={lancamentoIrmaos.tipo_pagamento}
                    onChange={(e) => setLancamentoIrmaos({ ...lancamentoIrmaos, tipo_pagamento: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {tiposPagamento.map(tipo => (
                      <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Selecione os Irmãos * ({lancamentoIrmaos.irmaos_selecionados.length} selecionados
                    {lancamentoIrmaos.eh_mensalidade && (
                      <span className="text-blue-600">
                        {' '}de {irmaos.filter(i => i.periodicidade_pagamento === 'Mensal' || !i.periodicidade_pagamento).length} mensais
                      </span>
                    )})
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
                  {irmaos.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>⚠️ Nenhum irmão ativo encontrado</p>
                      <p className="text-xs mt-2">Verifique se existem irmãos com situação "Ativo" no cadastro</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {irmaos
                        .filter(irmao => {
                          // Se é mensalidade, mostra apenas quem paga mensalmente
                          if (lancamentoIrmaos.eh_mensalidade) {
                            return irmao.periodicidade_pagamento === 'Mensal' || 
                                   !irmao.periodicidade_pagamento; // Se null, considera mensal
                          }
                          // Se não é mensalidade, mostra todos
                          return true;
                        })
                        .map(irmao => (
                        <label key={irmao.id} className="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={lancamentoIrmaos.irmaos_selecionados.includes(irmao.id)}
                            onChange={() => toggleIrmaoSelecionado(irmao.id)}
                            className="w-4 h-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            {irmao.nome}
                            {irmao.periodicidade_pagamento && irmao.periodicidade_pagamento !== 'Mensal' && (
                              <span className="ml-1 text-xs text-blue-600">
                                ({irmao.periodicidade_pagamento})
                              </span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
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

      {/* MODAL QUITAÇÃO INDIVIDUAL */}
      {mostrarModalQuitacao && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="bg-green-600 text-white px-6 py-4 rounded-t-lg">
              <h3 className="text-xl font-bold">💰 Quitar Lançamento</h3>
            </div>
            
            <form onSubmit={handleQuitacao} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data de Pagamento *
                </label>
                <input
                  type="date"
                  value={quitacaoForm.data_pagamento}
                  onChange={(e) => setQuitacaoForm({ ...quitacaoForm, data_pagamento: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Pagamento *
                </label>
                <select
                  value={quitacaoForm.tipo_pagamento}
                  onChange={(e) => setQuitacaoForm({ ...quitacaoForm, tipo_pagamento: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  {tiposPagamento.map(tipo => (
                    <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observações
                </label>
                <textarea
                  value={quitacaoForm.observacoes}
                  onChange={(e) => setQuitacaoForm({ ...quitacaoForm, observacoes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  rows="3"
                  placeholder="Observações sobre o pagamento (opcional)"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                >
                  ✅ Confirmar Quitação
                </button>
                <button
                  type="button"
                  onClick={() => setMostrarModalQuitacao(false)}
                  className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL QUITAÇÃO EM LOTE */}
      {mostrarModalQuitacaoLote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-green-600 text-white px-6 py-4 rounded-t-lg">
              <h3 className="text-xl font-bold">💰 Quitação em Lote</h3>
              <p className="text-sm text-green-100 mt-1">
                {quitacaoLote.lancamentos_selecionados.length} lançamentos selecionados
              </p>
            </div>
            
            <form onSubmit={handleQuitacaoLote} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data de Pagamento *
                  </label>
                  <input
                    type="date"
                    value={quitacaoLote.data_pagamento}
                    onChange={(e) => setQuitacaoLote({ ...quitacaoLote, data_pagamento: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Pagamento *
                  </label>
                  <select
                    value={quitacaoLote.tipo_pagamento}
                    onChange={(e) => setQuitacaoLote({ ...quitacaoLote, tipo_pagamento: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  >
                    {tiposPagamento.map(tipo => (
                      <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Lançamentos Pendentes
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selecionarTodosParaQuitacao}
                      className="text-sm text-green-600 hover:text-green-800"
                    >
                      ✅ Selecionar Todos
                    </button>
                    <button
                      type="button"
                      onClick={limparSelecaoQuitacao}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      ❌ Limpar Seleção
                    </button>
                  </div>
                </div>
                <div className="border border-gray-300 rounded-lg p-4 max-h-96 overflow-y-auto">
                  <div className="space-y-2">
                    {lancamentos
                      .filter(l => l.status === 'pendente')
                      .map(lanc => (
                        <label 
                          key={lanc.id} 
                          className="flex items-start cursor-pointer hover:bg-gray-50 p-3 rounded border border-gray-200"
                        >
                          <input
                            type="checkbox"
                            checked={quitacaoLote.lancamentos_selecionados.includes(lanc.id)}
                            onChange={() => toggleLancamentoParaQuitacao(lanc.id)}
                            className="mt-1 w-4 h-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                          />
                          <div className="ml-3 flex-1">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium text-gray-900">{lanc.descricao}</p>
                                <p className="text-sm text-gray-600">
                                  {lanc.categorias_financeiras?.nome} • 
                                  Venc: {formatarDataBR(lanc.data_vencimento)}
                                </p>
                              </div>
                              <p className="text-lg font-bold text-green-600">
                                R$ {parseFloat(lanc.valor).toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </label>
                      ))}
                  </div>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">
                  <strong>Total a quitar:</strong> R$ {
                    lancamentos
                      .filter(l => quitacaoLote.lancamentos_selecionados.includes(l.id))
                      .reduce((sum, l) => sum + parseFloat(l.valor), 0)
                      .toFixed(2)
                  }
                  {' '}({quitacaoLote.lancamentos_selecionados.length} lançamentos)
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                  disabled={quitacaoLote.lancamentos_selecionados.length === 0}
                >
                  ✅ Quitar Selecionados
                </button>
                <button
                  type="button"
                  onClick={() => setMostrarModalQuitacaoLote(false)}
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
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-xl font-bold text-red-600">⚠️ Irmãos Inadimplentes</h3>
              <p className="text-sm text-gray-600">Receitas pendentes de pagamento</p>
            </div>
            {lancamentos.filter(l => l.categorias_financeiras?.tipo === 'receita' && l.status === 'pendente').length > 0 && (
              <button
                onClick={() => setMostrarModalQuitacaoLote(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                💰 Quitar em Lote
              </button>
            )}
          </div>
          
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
                        {/* Nome do Irmão */}
                        <p className="font-bold text-lg text-gray-900">
                          👤 {lanc.irmaos?.nome || lanc.descricao}
                        </p>
                        {/* Tipo e Categoria */}
                        <div className="flex gap-2 mt-2">
                          <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full font-medium">
                            📈 Receita
                          </span>
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                            {lanc.categorias_financeiras?.nome}
                          </span>
                        </div>
                        {/* Descrição e Vencimento */}
                        <div className="text-sm text-gray-600 mt-2">
                          <p className="font-medium">{lanc.descricao}</p>
                          <p className="mt-1">
                            <span className="text-red-600 font-medium">⏰ Vencimento:</span> {formatarDataBR(lanc.data_vencimento)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-2xl font-bold text-red-600">R$ {parseFloat(lanc.valor).toFixed(2)}</p>
                        <div className="flex gap-2 mt-2 justify-end">
                          <button
                            onClick={() => gerarRelatorioIndividual(lanc.origem_irmao_id)}
                            className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium"
                          >
                            📄 PDF
                          </button>
                          <button
                            onClick={() => abrirModalQuitacao(lanc)}
                            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 font-medium"
                          >
                            💰 Quitar
                          </button>
                        </div>
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
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">
              Lançamentos de {meses[filtros.mes - 1]}/{filtros.ano}
            </h3>
            {lancamentos.filter(l => l.status === 'pendente').length > 0 && (
              <button
                onClick={() => setMostrarModalQuitacaoLote(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"
              >
                💰 Quitar em Lote
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase w-24">Data Lanç.</th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase w-24">Vencimento</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Origem</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-28">Valor</th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase w-20">Pgto</th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase w-24">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-44">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {lancamentos.map((lanc) => (
                  <tr key={lanc.id} className="hover:bg-gray-50">
                    <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 w-24">
                      {formatarDataBR(lanc.data_lancamento)}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 w-24">
                      {formatarDataBR(lanc.data_vencimento)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        lanc.categorias_financeiras?.tipo === 'receita'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {lanc.categorias_financeiras?.tipo === 'receita' ? '📈 Receita' : '📉 Despesa'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {lanc.categorias_financeiras?.nome}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {lanc.descricao}
                    </td>
                    {/* NOVA COLUNA: Origem */}
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      {lanc.origem_tipo === 'Loja' ? (
                        <div className="flex items-center gap-1">
                          <span className="text-blue-600">🏛️</span>
                          <span className="text-gray-900 font-medium">Loja</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="text-purple-600">👤</span>
                          <span className="text-gray-900 font-medium">
                            {(() => {
                              const nomeCompleto = lanc.irmaos?.nome || 'Irmão';
                              const partes = nomeCompleto.split(' ');
                              return partes.length > 2 
                                ? `${partes[0]} ${partes[1]}`
                                : nomeCompleto;
                            })()}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium w-28">
                      <span className={lanc.categorias_financeiras?.tipo === 'receita' ? 'text-green-600' : 'text-red-600'}>
                        R$ {parseFloat(lanc.valor).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-900 w-20">
                      {lanc.tipo_pagamento}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap w-24">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        lanc.status === 'pago'
                          ? 'bg-green-100 text-green-800'
                          : lanc.status === 'vencido'
                          ? 'bg-red-100 text-red-800'
                          : lanc.status === 'cancelado'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {lanc.status === 'pago' && '✅ Pago'}
                        {lanc.status === 'pendente' && '⏳ Pendente'}
                        {lanc.status === 'vencido' && '⚠️ Vencido'}
                        {lanc.status === 'cancelado' && '❌ Cancelado'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm w-44">
                      <div className="flex gap-1 items-center flex-wrap max-w-[176px]">
                        {/* Badge de Parcela */}
                        {lanc.eh_parcelado && (
                          <span className="text-xs px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full font-medium">
                            {lanc.parcela_numero}/{lanc.parcela_total}
                          </span>
                        )}
                        
                        {/* Botão Parcelar */}
                        {lanc.status === 'pendente' && !lanc.eh_parcelado && !lanc.eh_pagamento_parcial && (
                          <button
                            onClick={() => {
                              setLancamentoParcelar(lanc);
                              setModalParcelamentoAberto(true);
                            }}
                            className="text-indigo-600 hover:text-indigo-900 text-lg"
                            title="Parcelar este lançamento"
                          >
                            🔀
                          </button>
                        )}
                        
                        {/* Botão Pagamento Parcial */}
                        {lanc.status === 'pendente' && !lanc.eh_parcelado && !lanc.eh_pagamento_parcial && (
                          <button
                            onClick={() => abrirModalPagamentoParcial(lanc)}
                            className="text-amber-600 hover:text-amber-900 text-lg"
                            title="Fazer pagamento parcial"
                          >
                            💰
                          </button>
                        )}
                        
                        {/* Botão Quitar Total (apenas se não tiver pagamento parcial) */}
                        {lanc.status === 'pendente' && !lanc.eh_pagamento_parcial && (
                          <button
                            onClick={() => abrirModalQuitacao(lanc)}
                            className="text-green-600 hover:text-green-900 text-lg"
                            title="Quitar"
                          >
                            ✅
                          </button>
                        )}
                        
                        <button
                          onClick={() => editarLancamento(lanc)}
                          className="text-blue-600 hover:text-blue-900 text-lg"
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => excluirLancamento(lanc.id)}
                          className="text-red-600 hover:text-red-900 text-lg"
                          title="Excluir"
                        >
                          🗑️
                        </button>
                      </div>
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
      )}

      {/* SEÇÃO: GERENCIAR CATEGORIAS */}
      {/* Modal de Parcelamento (componente separado) */}
      {modalParcelamentoAberto && (
        <ModalParcelamento
          categorias={categorias}
          irmaos={irmaos}
          lancamentoExistente={lancamentoParcelar}
          onClose={() => {
            setModalParcelamentoAberto(false);
            setLancamentoParcelar(null);
          }}
          onSuccess={carregarLancamentos}
          showSuccess={showSuccess}
          showError={showError}
        />
      )}

      {/* Modal de Pagamento Parcial */}
      {modalPagamentoParcialAberto && (
        <ModalPagamentoParcial
          lancamento={lancamentoPagamentoParcial}
          pagamentosExistentes={pagamentosDoLancamento}
          onClose={() => {
            setModalPagamentoParcialAberto(false);
            setLancamentoPagamentoParcial(null);
            setPagamentosDoLancamento([]);
          }}
          onSuccess={carregarLancamentos}
          showSuccess={showSuccess}
          showError={showError}
        />
      )}
    </div>
  );
}

// ============================================
// COMPONENTE: GERENCIAR CATEGORIAS
// ============================================
function GerenciarCategorias({ categorias, onUpdate, showSuccess, showError }) {
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editando, setEditando] = useState(null);
  const [formCategoria, setFormCategoria] = useState({
    nome: '',
    tipo: 'receita',
    descricao: '',
    ativo: true
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const dados = {
        nome: formCategoria.nome.trim(),
        tipo: formCategoria.tipo,
        descricao: formCategoria.descricao.trim() || null,
        ativo: formCategoria.ativo
      };

      if (editando) {
        const { error } = await supabase
          .from('categorias_financeiras')
          .update(dados)
          .eq('id', editando);

        if (error) throw error;
        showSuccess('Categoria atualizada!');
      } else {
        const { error } = await supabase
          .from('categorias_financeiras')
          .insert(dados);

        if (error) throw error;
        showSuccess('Categoria criada!');
      }

      limparFormulario();
      await onUpdate();

    } catch (error) {
      showError('Erro: ' + error.message);
    }
  };

  const editarCategoria = (categoria) => {
    setFormCategoria({
      nome: categoria.nome,
      tipo: categoria.tipo,
      descricao: categoria.descricao || '',
      ativo: categoria.ativo !== false
    });
    setEditando(categoria.id);
    setMostrarFormulario(true);
  };

  const toggleAtivo = async (id, ativoAtual) => {
    try {
      const { error } = await supabase
        .from('categorias_financeiras')
        .update({ ativo: !ativoAtual })
        .eq('id', id);

      if (error) throw error;
      showSuccess(`Categoria ${!ativoAtual ? 'ativada' : 'desativada'}!`);
      await onUpdate();
    } catch (error) {
      showError('Erro: ' + error.message);
    }
  };

  const excluirCategoria = async (id) => {
    if (!window.confirm('Deseja realmente excluir esta categoria?')) return;

    try {
      const { error } = await supabase
        .from('categorias_financeiras')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showSuccess('Categoria excluída!');
      await onUpdate();
    } catch (error) {
      showError('Erro: ' + error.message);
    }
  };

  const limparFormulario = () => {
    setFormCategoria({ nome: '', tipo: 'receita', descricao: '', ativo: true });
    setEditando(null);
    setMostrarFormulario(false);
  };

  const categoriasReceita = categorias.filter(c => c.tipo === 'receita');
  const categoriasDespesa = categorias.filter(c => c.tipo === 'despesa');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">🏷️ Gerenciar Categorias</h2>
        <button
          onClick={() => setMostrarFormulario(!mostrarFormulario)}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
        >
          {mostrarFormulario ? '❌ Cancelar' : '➕ Nova Categoria'}
        </button>
      </div>

      {mostrarFormulario && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">
            {editando ? '✏️ Editar Categoria' : '➕ Nova Categoria'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  type="text"
                  value={formCategoria.nome}
                  onChange={(e) => setFormCategoria({ ...formCategoria, nome: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                <select
                  value={formCategoria.tipo}
                  onChange={(e) => setFormCategoria({ ...formCategoria, tipo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="receita">💰 Receita</option>
                  <option value="despesa">💸 Despesa</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <input
                  type="text"
                  value={formCategoria.descricao}
                  onChange={(e) => setFormCategoria({ ...formCategoria, descricao: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formCategoria.ativo}
                    onChange={(e) => setFormCategoria({ ...formCategoria, ativo: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="ml-2 text-sm">Categoria ativa</span>
                </label>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                {editando ? '✅ Salvar' : '➕ Criar'}
              </button>
              <button type="button" onClick={limparFormulario} className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* RECEITAS */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-green-700 mb-4">
            💰 Receitas ({categoriasReceita.length})
          </h3>
          <div className="space-y-2">
            {categoriasReceita.map(cat => (
              <div key={cat.id} className={`p-3 rounded-lg border ${cat.ativo !== false ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{cat.nome}</h4>
                      {cat.ativo === false && <span className="text-xs px-2 py-1 bg-gray-200 rounded">Inativa</span>}
                    </div>
                    {cat.descricao && <p className="text-sm text-gray-600 mt-1">{cat.descricao}</p>}
                  </div>
                  <div className="flex gap-1 ml-2">
                    <button onClick={() => editarCategoria(cat)} className="p-1 text-blue-600 hover:bg-blue-100 rounded" title="Editar">✏️</button>
                    <button onClick={() => toggleAtivo(cat.id, cat.ativo !== false)} className="p-1 text-yellow-600 hover:bg-yellow-100 rounded" title={cat.ativo !== false ? 'Desativar' : 'Ativar'}>{cat.ativo !== false ? '👁️' : '👁️‍🗨️'}</button>
                    <button onClick={() => excluirCategoria(cat.id)} className="p-1 text-red-600 hover:bg-red-100 rounded" title="Excluir">🗑️</button>
                  </div>
                </div>
              </div>
            ))}
            {categoriasReceita.length === 0 && <p className="text-gray-500 text-sm">Nenhuma categoria</p>}
          </div>
        </div>

        {/* DESPESAS */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-red-700 mb-4">
            💸 Despesas ({categoriasDespesa.length})
          </h3>
          <div className="space-y-2">
            {categoriasDespesa.map(cat => (
              <div key={cat.id} className={`p-3 rounded-lg border ${cat.ativo !== false ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{cat.nome}</h4>
                      {cat.ativo === false && <span className="text-xs px-2 py-1 bg-gray-200 rounded">Inativa</span>}
                    </div>
                    {cat.descricao && <p className="text-sm text-gray-600 mt-1">{cat.descricao}</p>}
                  </div>
                  <div className="flex gap-1 ml-2">
                    <button onClick={() => editarCategoria(cat)} className="p-1 text-blue-600 hover:bg-blue-100 rounded" title="Editar">✏️</button>
                    <button onClick={() => toggleAtivo(cat.id, cat.ativo !== false)} className="p-1 text-yellow-600 hover:bg-yellow-100 rounded" title={cat.ativo !== false ? 'Desativar' : 'Ativar'}>{cat.ativo !== false ? '👁️' : '👁️‍🗨️'}</button>
                    <button onClick={() => excluirCategoria(cat.id)} className="p-1 text-red-600 hover:bg-red-100 rounded" title="Excluir">🗑️</button>
                  </div>
                </div>
              </div>
            ))}
            {categoriasDespesa.length === 0 && <p className="text-gray-500 text-sm">Nenhuma categoria</p>}
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          💡 <strong>Dica:</strong> Categorias inativas não aparecem nos formulários, mas lançamentos antigos continuam visíveis.
        </p>
      </div>
    </div>
  );
}

// ============================================
// COMPONENTE: MODAL DE PARCELAMENTO
// ============================================
function ModalParcelamento({ categorias, irmaos, lancamentoExistente, onClose, onSuccess, showSuccess, showError }) {
  const [formParcelamento, setFormParcelamento] = useState({
    tipo: lancamentoExistente?.tipo || 'despesa',
    categoria_id: lancamentoExistente?.categoria_id || '',
    descricao: lancamentoExistente?.descricao || '',
    valor_total: lancamentoExistente?.valor || '',
    num_parcelas: 2,
    data_primeira_parcela: new Date().toISOString().split('T')[0],
    tipo_pagamento: lancamentoExistente?.tipo_pagamento || 'dinheiro',
    origem_tipo: lancamentoExistente?.origem_tipo || 'Loja',
    origem_irmao_id: lancamentoExistente?.origem_irmao_id || '',
    observacoes: lancamentoExistente?.observacoes || ''
  });

  const tiposPagamento = [
    { value: 'dinheiro', label: '💵 Dinheiro' },
    { value: 'pix', label: '📱 PIX' },
    { value: 'transferencia', label: '🏦 Transferência' },
    { value: 'cartao_credito', label: '💳 Cartão Crédito' },
    { value: 'cartao_debito', label: '💳 Cartão Débito' },
    { value: 'boleto', label: '📄 Boleto' },
    { value: 'cheque', label: '📝 Cheque' }
  ];

  // Função para renderizar categorias hierárquicas
  const renderizarOpcoesCategoria = (tipo) => {
    const categoriasFiltradas = categorias.filter(c => c.tipo === tipo);
    const principais = categoriasFiltradas.filter(c => c.nivel === 1 || !c.categoria_pai_id);
    
    const opcoes = [];
    
    principais.forEach(principal => {
      opcoes.push(
        <option key={principal.id} value={principal.id}>
          {principal.nome}
        </option>
      );
      
      const subcategorias = categoriasFiltradas.filter(c => c.categoria_pai_id === principal.id);
      subcategorias.forEach(sub => {
        opcoes.push(
          <option key={sub.id} value={sub.id}>
            &nbsp;&nbsp;&nbsp;&nbsp;└─ {sub.nome}
          </option>
        );
        
        const subSub = categoriasFiltradas.filter(c => c.categoria_pai_id === sub.id);
        subSub.forEach(ss => {
          opcoes.push(
            <option key={ss.id} value={ss.id}>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└─ {ss.nome}
            </option>
          );
        });
      });
    });
    
    return opcoes;
  };

  const gerarUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const valorTotal = parseFloat(formParcelamento.valor_total);
      const numParcelas = parseInt(formParcelamento.num_parcelas);
      
      if (valorTotal <= 0 || numParcelas < 2) {
        showError('Valor deve ser positivo e mínimo 2 parcelas');
        return;
      }

      const valorParcela = valorTotal / numParcelas;
      const grupoParcelamento = gerarUUID();
      
      const parcelas = [];
      for (let i = 0; i < numParcelas; i++) {
        const dataParcela = new Date(formParcelamento.data_primeira_parcela);
        dataParcela.setMonth(dataParcela.getMonth() + i);
        
        parcelas.push({
          tipo: formParcelamento.tipo,
          categoria_id: parseInt(formParcelamento.categoria_id),
          descricao: `${formParcelamento.descricao} (${i + 1}/${numParcelas})`,
          valor: valorParcela,
          data_lancamento: new Date().toISOString().split('T')[0],
          data_vencimento: dataParcela.toISOString().split('T')[0],
          tipo_pagamento: formParcelamento.tipo_pagamento,
          status: 'pendente',
          origem_tipo: formParcelamento.origem_tipo,
          origem_irmao_id: formParcelamento.origem_irmao_id || null,
          observacoes: formParcelamento.observacoes,
          eh_parcelado: true,
          parcela_numero: i + 1,
          parcela_total: numParcelas,
          grupo_parcelamento: grupoParcelamento
        });
      }

      // Se estiver parcelando um lançamento existente, deletar o original
      if (lancamentoExistente) {
        const { error: deleteError } = await supabase
          .from('lancamentos_loja')
          .delete()
          .eq('id', lancamentoExistente.id);
        
        if (deleteError) throw deleteError;
      }

      const { error } = await supabase.from('lancamentos_loja').insert(parcelas);
      if (error) throw error;

      if (lancamentoExistente) {
        showSuccess(`✅ Lançamento parcelado em ${numParcelas}x e original excluído!`);
      } else {
        showSuccess(`✅ ${numParcelas} parcelas criadas com sucesso!`);
      }
      onClose();
      onSuccess();
    } catch (error) {
      console.error('Erro:', error);
      showError('Erro ao parcelar: ' + error.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="bg-indigo-600 text-white px-6 py-4 rounded-t-lg">
          <h3 className="text-xl font-bold">
            {lancamentoExistente ? '🔀 Parcelar Lançamento Existente' : '🔢 Parcelar Despesa/Receita'}
          </h3>
          <p className="text-sm text-indigo-100">
            {lancamentoExistente 
              ? 'Dividir este lançamento em parcelas (o original será excluído)' 
              : 'Dividir um valor em parcelas mensais'}
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Tipo *</label>
            <div className="flex gap-4">
              <label className="flex items-center cursor-pointer">
                <input type="radio" value="despesa" checked={formParcelamento.tipo === 'despesa'}
                  onChange={(e) => setFormParcelamento({ ...formParcelamento, tipo: e.target.value, categoria_id: '' })}
                  className="mr-2" />
                <span>💸 Despesa</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input type="radio" value="receita" checked={formParcelamento.tipo === 'receita'}
                  onChange={(e) => setFormParcelamento({ ...formParcelamento, tipo: e.target.value, categoria_id: '' })}
                  className="mr-2" />
                <span>💰 Receita</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Categoria *</label>
            <select required value={formParcelamento.categoria_id}
              onChange={(e) => setFormParcelamento({ ...formParcelamento, categoria_id: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg">
              <option value="">Selecione...</option>
              {renderizarOpcoesCategoria(formParcelamento.tipo)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Descrição *</label>
            <input type="text" required value={formParcelamento.descricao}
              onChange={(e) => setFormParcelamento({ ...formParcelamento, descricao: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg" placeholder="Ex: Reforma do templo" />
            <p className="text-xs text-gray-500 mt-1">Será adicionado (1/5), (2/5), etc.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Valor Total *</label>
              <input type="number" required step="0.01" min="0.01" value={formParcelamento.valor_total}
                onChange={(e) => setFormParcelamento({ ...formParcelamento, valor_total: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nº Parcelas *</label>
              <input type="number" required min="2" max="24" value={formParcelamento.num_parcelas}
                onChange={(e) => setFormParcelamento({ ...formParcelamento, num_parcelas: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg" />
            </div>
          </div>

          {formParcelamento.valor_total && formParcelamento.num_parcelas && (
            <div className="bg-indigo-50 border border-indigo-200 rounded p-3">
              <p className="text-sm font-medium">
                💡 Cada parcela: R$ {((parseFloat(formParcelamento.valor_total) || 0) / (parseInt(formParcelamento.num_parcelas) || 1)).toFixed(2)}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Vencimento 1ª Parcela *</label>
            <input type="date" required value={formParcelamento.data_primeira_parcela}
              onChange={(e) => setFormParcelamento({ ...formParcelamento, data_primeira_parcela: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg" />
            <p className="text-xs text-gray-500 mt-1">As demais vencerão mensalmente</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Forma de Pagamento</label>
            <select value={formParcelamento.tipo_pagamento}
              onChange={(e) => setFormParcelamento({ ...formParcelamento, tipo_pagamento: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg">
              {tiposPagamento.map(tp => (
                <option key={tp.value} value={tp.value}>{tp.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Origem</label>
              <select value={formParcelamento.origem_tipo}
                onChange={(e) => setFormParcelamento({ ...formParcelamento, origem_tipo: e.target.value, origem_irmao_id: '' })}
                className="w-full px-3 py-2 border rounded-lg">
                <option value="Loja">🏛️ Loja</option>
                <option value="Irmao">👤 Irmão</option>
              </select>
            </div>
            {formParcelamento.origem_tipo === 'Irmao' && (
              <div>
                <label className="block text-sm font-medium mb-1">Irmão</label>
                <select value={formParcelamento.origem_irmao_id}
                  onChange={(e) => setFormParcelamento({ ...formParcelamento, origem_irmao_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg">
                  <option value="">Selecione...</option>
                  {irmaos.map(irmao => (
                    <option key={irmao.id} value={irmao.id}>{irmao.nome}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Observações</label>
            <textarea value={formParcelamento.observacoes}
              onChange={(e) => setFormParcelamento({ ...formParcelamento, observacoes: e.target.value })}
              rows="2" className="w-full px-3 py-2 border rounded-lg" />
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <button type="submit" 
              className="flex-1 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">
              🔢 Criar Parcelamento
            </button>
            <button type="button" onClick={onClose}
              className="px-6 py-2 bg-gray-300 rounded-lg hover:bg-gray-400 font-medium">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// COMPONENTE: MODAL DE PAGAMENTO PARCIAL
// ============================================
function ModalPagamentoParcial({ lancamento, pagamentosExistentes, onClose, onSuccess, showSuccess, showError }) {
  const [valorPagar, setValorPagar] = useState('');
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().split('T')[0]);

  // Calcular totais
  const valorOriginal = lancamento.valor;
  const totalPago = pagamentosExistentes.reduce((sum, pag) => sum + parseFloat(pag.valor), 0);
  const valorRestante = valorOriginal - totalPago;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const valorAPagar = parseFloat(valorPagar);
      
      if (valorAPagar <= 0) {
        showError('Valor deve ser maior que zero');
        return;
      }

      if (valorAPagar > valorRestante) {
        showError(`Valor não pode ser maior que o restante (R$ ${valorRestante.toFixed(2)})`);
        return;
      }

      // Calcular se vai quitar tudo
      const novoTotalPago = totalPago + valorAPagar;
      const novoRestante = valorOriginal - novoTotalPago;

      if (novoRestante === 0) {
        // ÚLTIMO PAGAMENTO: Não criar registro separado, apenas atualizar o original
        const { error: errorUpdate } = await supabase
          .from('lancamentos_loja')
          .update({
            valor: valorAPagar, // Altera o valor para o restante
            status: 'pago',
            data_pagamento: dataPagamento,
            tipo_pagamento: lancamento.tipo_pagamento
          })
          .eq('id', lancamento.id);

        if (errorUpdate) throw errorUpdate;
        
        showSuccess('✅ Lançamento quitado completamente!');
      } else {
        // PAGAMENTO PARCIAL: Criar registro separado
        const novoPagamento = {
          tipo: lancamento.tipo,
          categoria_id: lancamento.categoria_id,
          descricao: `💰 Pagamento Parcial: ${lancamento.descricao}`,
          valor: valorAPagar,
          data_lancamento: dataPagamento,
          data_vencimento: dataPagamento,
          data_pagamento: dataPagamento,
          tipo_pagamento: lancamento.tipo_pagamento,
          status: 'pago',
          origem_tipo: lancamento.origem_tipo,
          origem_irmao_id: lancamento.origem_irmao_id,
          observacoes: `Pagamento parcial de R$ ${valorAPagar.toFixed(2)} do lançamento "${lancamento.descricao}" (R$ ${valorOriginal.toFixed(2)})`,
          eh_pagamento_parcial: true,
          lancamento_principal_id: lancamento.id
        };

        const { error: errorInsert } = await supabase
          .from('lancamentos_loja')
          .insert(novoPagamento);

        if (errorInsert) throw errorInsert;

        showSuccess(`✅ Pagamento de R$ ${valorAPagar.toFixed(2)} registrado! Resta: R$ ${novoRestante.toFixed(2)}`);
      }
      
      onClose();
      onSuccess();
    } catch (error) {
      console.error('Erro:', error);
      showError('Erro ao registrar pagamento: ' + error.message);
    }
  };

  const previewTotalPago = valorPagar ? (totalPago + parseFloat(valorPagar)).toFixed(2) : totalPago.toFixed(2);
  const previewRestante = valorPagar ? (valorRestante - parseFloat(valorPagar)).toFixed(2) : valorRestante.toFixed(2);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full my-8">
        <div className="bg-amber-600 text-white px-6 py-4 rounded-t-lg">
          <h3 className="text-xl font-bold">💰 Pagamento Parcial</h3>
          <p className="text-sm text-amber-100">Cada pagamento gera um registro que entra no balanço mensal</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Informações do Lançamento */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span className="font-medium">Descrição:</span>
              <span className="text-right">{lancamento.descricao}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="font-medium">Valor Original:</span>
              <span className="font-bold">R$ {valorOriginal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-green-600">Total Pago:</span>
              <span className="font-bold text-green-600">R$ {totalPago.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="font-medium text-red-600">Valor Restante:</span>
              <span className="font-bold text-red-600">R$ {valorRestante.toFixed(2)}</span>
            </div>
          </div>

          {/* Histórico de Pagamentos */}
          {pagamentosExistentes.length > 0 && (
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-medium mb-2">📋 Pagamentos Anteriores:</h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {pagamentosExistentes.map((pag, idx) => (
                  <div key={pag.id} className="flex justify-between text-sm">
                    <span>#{idx + 1} - {new Date(pag.data_pagamento + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                    <span className="font-medium">R$ {parseFloat(pag.valor).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Formulário de Novo Pagamento */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Valor a Pagar *</label>
              <input 
                type="number" 
                required 
                step="0.01" 
                min="0.01" 
                max={valorRestante}
                value={valorPagar}
                onChange={(e) => setValorPagar(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-lg font-bold" 
                placeholder="0.00"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">Máximo: R$ {valorRestante.toFixed(2)}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Data do Pagamento *</label>
              <input 
                type="date" 
                required
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg" 
              />
              <p className="text-xs text-gray-500 mt-1">Entra no balanço desta data</p>
            </div>
          </div>

          {/* Prévia */}
          {valorPagar && parseFloat(valorPagar) > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded p-4 space-y-2">
              <p className="text-sm font-medium text-blue-900">📊 Após este pagamento:</p>
              <div className="flex justify-between text-sm">
                <span className="text-green-700">Total Pago:</span>
                <span className="font-bold text-green-700">R$ {previewTotalPago}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-red-700">Restante:</span>
                <span className="font-bold text-red-700">R$ {previewRestante}</span>
              </div>
              {parseFloat(previewRestante) === 0 && (
                <div className="mt-2 p-2 bg-green-100 rounded text-green-800 text-sm font-medium text-center">
                  ✅ Este pagamento quitará o lançamento completamente!
                </div>
              )}
              <div className="mt-2 p-2 bg-amber-100 rounded text-amber-800 text-sm">
                💡 Será criado um novo registro que entra no balanço de <strong>{new Date(dataPagamento + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</strong>
              </div>
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-3 pt-4 border-t">
            <button type="submit" 
              className="flex-1 px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium">
              💰 Registrar Pagamento
            </button>
            <button type="button" onClick={onClose}
              className="px-6 py-2 bg-gray-300 rounded-lg hover:bg-gray-400 font-medium">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
