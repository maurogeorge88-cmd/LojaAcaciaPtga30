import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { formatarDataBR, formatarMoeda, corrigirTimezone } from './utils/formatadores';
import { gerarRelatorioPDF, gerarRelatorioResumido } from './utils/relatoriosPDF';
import AnaliseCategoriasModal from './AnaliseCategoriasModal';
import { 
  verificarVencido,
  filtrarIrmaosPorStatus,
  obterBadgeStatus,
  validarFormLancamento,
  calcularDiasAtraso
} from './utils/helpers';
import ModalLancamento from './components/ModalLancamento';
import ModalResumoIrmaos from './components/ModalResumoIrmaos';
import FinancasLojaTV from './FinancasLojaTV';

// 💰 COMPONENTE: Finanças da Loja
// Gerenciamento financeiro com regime de competência
// Lançamentos pagos: filtrados por data_pagamento | Pendentes: filtrados por data_vencimento

// ⚙️ Configuração de status permitidos
const STATUS_PERMITIDOS = ['Regular', 'Licenciado'];
const STATUS_BLOQUEADOS = ['Irregular', 'Suspenso', 'Desligado', 'Excluído', 'Falecido', 'Ex-Ofício'];

export default function FinancasLoja({ showSuccess, showError, userEmail, userData }) {
  // 🕐 FUNÇÃO PARA CORRIGIR TIMEZONE
  const [categorias, setCategorias] = useState([]);
  const [irmaos, setIrmaos] = useState([]);
  const [lancamentos, setLancamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalLancamentoAberto, setModalLancamentoAberto] = useState(false);
  const [tipoLancamento, setTipoLancamento] = useState('receita');
  const [mostrarModalIrmaos, setMostrarModalIrmaos] = useState(false);
  const [mostrarModalQuitacao, setMostrarModalQuitacao] = useState(false);
  const [mostrarModalQuitacaoLote, setMostrarModalQuitacaoLote] = useState(false);
  const [modalResumoAberto, setModalResumoAberto] = useState(false);
  const [resumoIrmaos, setResumoIrmaos] = useState([]);
  const [editando, setEditando] = useState(null);
  const [viewMode, setViewMode] = useState('lancamentos');
  const [saldoAnterior, setSaldoAnterior] = useState(0);
  const [caixaFisicoTotal, setCaixaFisicoTotal] = useState(0);
  const [troncoTotalGlobal, setTroncoTotalGlobal] = useState({ banco: 0, especie: 0, total: 0 });
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [anosDisponiveis, setAnosDisponiveis] = useState([]);
  const [showValues, setShowValues] = useState(false); // Ocultar valores por padrão
  
  const [filtros, setFiltros] = useState({
    mes: new Date().getMonth() + 1, // Mês atual (1-12)
    ano: new Date().getFullYear(), // Ano atual
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

  // Estados para Compensação
  const [modalCompensacaoAberto, setModalCompensacaoAberto] = useState(false);
  const [irmaoCompensacao, setIrmaoCompensacao] = useState(null);
  const [debitosIrmao, setDebitosIrmao] = useState([]);
  const [creditosIrmao, setCreditosIrmao] = useState([]);

  const [modalSangriaAberto, setModalSangriaAberto] = useState(false);
  const [limiteRegistros, setLimiteRegistros] = useState(20); // Limite de registros exibidos
  const [modalSangriaTroncoAberto, setModalSangriaTroncoAberto] = useState(false);
  const [modalAnaliseAberto, setModalAnaliseAberto] = useState(false);
  const [modalDespesasPendentesAberto, setModalDespesasPendentesAberto] = useState(false);
  const [telaTV, setTelaTV] = useState(false);
  const [modalReceitasPagasAberto, setModalReceitasPagasAberto] = useState(false);
  const [detalhesReceitasPagas, setDetalhesReceitasPagas] = useState({ conta: 0, dinheiro: 0 });
  const [menuLancamentosAberto, setMenuLancamentosAberto] = useState(false);
  const [menuRelatoriosAberto, setMenuRelatoriosAberto] = useState(false);

  // Controle de fechamento de mês
  const [mesesFechados, setMesesFechados] = useState([]);
  const [fechandoMes, setFechandoMes] = useState(false);
  const [formSangria, setFormSangria] = useState({
    valor: '',
    data: new Date().toISOString().split('T')[0],
    observacao: ''
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
    status: 'pendente', // CORRIGIDO: usar 'pendente' ou 'pago'
    comprovante_url: '',
    observacoes: '',
    origem_tipo: 'Loja', 
    origem_irmao_id: '' 
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
    { value: 'cheque', label: '📝 Cheque' },
    { value: 'compensacao', label: '🔄 Compensação' }
  ];

  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const formatarPeriodo = () => {
    const { mes, ano } = filtros;
    if (mes === 0 && ano === 0) return 'Período Total';
    if (mes === 0) return `${ano}`;
    return `${mes.toString().padStart(2, '0')}/${ano}`;
  };

  useEffect(() => {
    carregarDados();
    calcularSaldoAnterior();
    calcularCaixaFisicoTotal();
    calcularTroncoTotal();
    buscarTotalRegistros();
    carregarMesesFechados();
  }, [filtros.mes, filtros.ano]);

  // Fechar menus dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.relative')) {
        setMenuLancamentosAberto(false);
        setMenuRelatoriosAberto(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Recarregar lançamentos quando mudar filtros
  useEffect(() => {
    if (categorias.length > 0) {
      recarregarDados();
    }
  }, [filtros.tipo, filtros.categoria, filtros.status, filtros.origem_tipo, filtros.origem_irmao_id]); 

  const buscarAnosDisponiveis = async () => {
    try {
      const { data, error } = await supabase
        .from('lancamentos_loja')
        .select('data_pagamento, data_vencimento, status');

      if (error) throw error;

      const anosSet = new Set();
      
      data.forEach(lanc => {
        const dataRef = lanc.status === 'pago' ? lanc.data_pagamento : lanc.data_vencimento;
        if (dataRef) {
          const ano = new Date(dataRef + 'T00:00:00').getFullYear();
          anosSet.add(ano);
        }
      });

      const anosOrdenados = Array.from(anosSet).sort((a, b) => b - a);
      setAnosDisponiveis(anosOrdenados);
    } catch (error) {
      console.error('Erro ao buscar anos:', error);
    }
  };

  const abrirDetalhesReceitasPagas = async () => {
    try {
      const { mes, ano } = filtros;
      
      const { data, error } = await supabase
        .from('lancamentos_loja')
        .select('*, categorias_financeiras(tipo, nome)');

      if (error) throw error;

      // Filtrar receitas pagas do período
      const receitasPagas = data.filter(lanc => {
        if (lanc.categorias_financeiras?.tipo !== 'receita' || 
            lanc.status !== 'pago' ||
            lanc.tipo_pagamento === 'compensacao') return false;
        
        const dataPag = lanc.data_pagamento;
        if (!dataPag) return false;
        
        const d = new Date(dataPag + 'T12:00:00');
        if (mes > 0 && ano > 0) {
          return d.getMonth() === mes - 1 && d.getFullYear() === ano;
        } else if (ano > 0) {
          return d.getFullYear() === ano;
        }
        return true;
      });
      
      const conta = receitasPagas
        .filter(l => ['pix', 'transferencia', 'debito', 'credito', 'cheque'].includes(l.tipo_pagamento))
        .reduce((sum, l) => sum + parseFloat(l.valor || 0), 0);
        
      const dinheiro = receitasPagas
        .filter(l => l.tipo_pagamento === 'dinheiro')
        .reduce((sum, l) => sum + parseFloat(l.valor || 0), 0);
      
      setDetalhesReceitasPagas({ conta, dinheiro });
      setModalReceitasPagasAberto(true);
    } catch (error) {
      console.error('Erro ao buscar detalhes de receitas:', error);
      showError('Erro ao buscar detalhes de receitas');
    }
  };

  const carregarDados = async () => {
    setLoading(true);
    try {
      console.log('🔄 Iniciando carregamento de dados...');
      
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
      const irmaosDisponiveis = filtrarIrmaosPorStatus(
        todosIrmaos || [], 
        STATUS_PERMITIDOS, 
        STATUS_BLOQUEADOS
      );
      
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

      await buscarAnosDisponiveis();
      await recarregarDados();

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
        .limit(500); // ⚡ PERFORMANCE: Limita a 500 registros

      // - PAGOS: Filtrar por data_pagamento (quando foi efetivamente pago)
      // - PENDENTES: Filtrar por data_vencimento (quando deve ser pago)
      // - data_lancamento: NÃO É USADA para controle, apenas referência
      
      if (mes > 0 && ano > 0) {
        const primeiroDia = `${ano}-${mes.toString().padStart(2, '0')}-01`;
        const ultimoDia = new Date(ano, mes, 0).getDate();
        const ultimoDiaFormatado = `${ano}-${mes.toString().padStart(2, '0')}-${ultimoDia}`;
        
        // 1. Status PAGO e data_pagamento no período, OU
        // 2. Status PENDENTE e data_vencimento no período
        query = query.or(
          `and(status.eq.pago,data_pagamento.gte.${primeiroDia},data_pagamento.lte.${ultimoDiaFormatado}),` +
          `and(status.eq.pendente,data_vencimento.gte.${primeiroDia},data_vencimento.lte.${ultimoDiaFormatado})`
        );
        
      } else if (ano > 0) {
        query = query.or(
          `and(status.eq.pago,data_pagamento.gte.${ano}-01-01,data_pagamento.lte.${ano}-12-31),` +
          `and(status.eq.pendente,data_vencimento.gte.${ano}-01-01,data_vencimento.lte.${ano}-12-31)`
        );
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
      // IMPORTANTE: 'vencido' não existe no banco, é calculado dinamicamente!
      // Se filtrar por 'vencido', buscar 'pendente' e filtrar depois
      if (status) {
        if (status === 'vencido') {
          query = query.eq('status', 'pendente');
        } else {
          query = query.eq('status', status);
        }
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

      // RECALCULAR valores considerando pagamentos parciais
      const lancamentosProcessados = await Promise.all((data || []).map(async (lanc) => {
        // Ignorar os próprios registros de pagamento parcial
        if (lanc.eh_pagamento_parcial) {
          return lanc;
        }

        const { data: pagamentosParcias, error: errPag } = await supabase
          .from('lancamentos_loja')
          .select('valor, tipo_pagamento')
          .eq('lancamento_principal_id', lanc.id)
          .eq('eh_pagamento_parcial', true);

        if (!errPag && pagamentosParcias && pagamentosParcias.length > 0) {
          // Separar compensações e pagamentos reais
          const pagamentosReais = pagamentosParcias.filter(p => p.tipo_pagamento !== 'compensacao');
          const compensacoes = pagamentosParcias.filter(p => p.tipo_pagamento === 'compensacao');
          
          const totalPago = pagamentosReais.reduce((sum, p) => sum + parseFloat(p.valor), 0);
          const totalCompensado = compensacoes.reduce((sum, p) => sum + parseFloat(p.valor), 0);
          
          // Valor original = apenas valor atual + compensações (pagamentos JÁ foram descontados do banco!)
          const valorOriginalCalculado = parseFloat(lanc.valor) + totalPago + totalCompensado;
          
          return {
            ...lanc,
            valor_original: valorOriginalCalculado,
            total_pago_parcial: totalPago,
            tem_pagamento_parcial: totalPago > 0 || totalCompensado > 0
          };
        }

        return lanc;
      }));

      // Se o filtro é 'vencido', filtrar apenas os que estão realmente vencidos
      let lancamentosFiltrados = lancamentosProcessados;
      if (status === 'vencido') {
        lancamentosFiltrados = lancamentosProcessados.filter(lanc => verificarVencido(lanc));
      }

      lancamentosFiltrados.sort((a, b) => {
        const dataA = a.status === 'pago' ? a.data_pagamento : a.data_vencimento;
        const dataB = b.status === 'pago' ? b.data_pagamento : b.data_vencimento;
        return new Date(dataB) - new Date(dataA); // Mais recente primeiro
      });

      setLancamentos(lancamentosFiltrados);
    } catch (error) {
      console.error('Erro ao carregar lançamentos:', error);
    }
  };

  // ============================================================
  // CONTROLE DE FECHAMENTO DE MÊS
  // ============================================================
  const carregarMesesFechados = async () => {
    const { data } = await supabase.from('meses_fechados').select('*');
    setMesesFechados(data || []);
  };

  const mesFechadoAtual = () => {
    if (!filtros.mes || !filtros.ano) return false;
    return mesesFechados.some(m => m.mes === filtros.mes && m.ano === filtros.ano);
  };

  const fecharMes = async () => {
    if (!filtros.mes || !filtros.ano) {
      showError('Selecione um mês e ano para fechar.');
      return;
    }
    const nomeMes = meses[filtros.mes - 1];
    if (!window.confirm(`Fechar ${nomeMes}/${filtros.ano}? Novos lançamentos neste mês serão bloqueados.`)) return;

    setFechandoMes(true);
    try {
      // Primeiro tenta deletar se já existir, depois insere
      await supabase.from('meses_fechados').delete().eq('ano', filtros.ano).eq('mes', filtros.mes);
      
      const { error } = await supabase.from('meses_fechados').insert({
        ano: filtros.ano,
        mes: filtros.mes,
        fechado_em: new Date().toISOString(),
        fechado_por: userData?.email || userEmail || 'sistema'
      });

      if (error) throw error;
      await carregarMesesFechados();
      showSuccess(`✅ ${nomeMes}/${filtros.ano} fechado com sucesso!`);
    } catch (error) {
      showError('Erro ao fechar mês: ' + error.message);
    } finally {
      setFechandoMes(false);
    }
  };

  const reabrirMes = async () => {
    if (!filtros.mes || !filtros.ano) return;
    const nomeMes = meses[filtros.mes - 1];
    if (!window.confirm(`Reabrir ${nomeMes}/${filtros.ano}? Lançamentos voltarão a ser permitidos.`)) return;

    setFechandoMes(true);
    try {
      const { error } = await supabase.from('meses_fechados')
        .delete()
        .eq('ano', filtros.ano)
        .eq('mes', filtros.mes);

      if (error) throw error;
      await carregarMesesFechados();
      showSuccess(`🔓 ${nomeMes}/${filtros.ano} reaberto com sucesso!`);
    } catch (error) {
      showError('Erro ao reabrir mês: ' + error.message);
    } finally {
      setFechandoMes(false);
    }
  };

  // Verifica se a data de um lançamento pertence a um mês fechado
  const verificarMesBloqueado = (dataLancamento) => {
    if (!dataLancamento) return false;
    const data = new Date(dataLancamento + 'T00:00:00');
    const mes = data.getMonth() + 1;
    const ano = data.getFullYear();
    return mesesFechados.some(m => m.mes === mes && m.ano === ano);
  };

  const handleSubmit = async (dados) => {
    // Se receber um evento, prevenir default (mantém compatibilidade)
    if (dados && dados.preventDefault) {
      dados.preventDefault();
      // Neste caso, usar formLancamento ao invés de dados
      dados = formLancamento;
    }

    // Verificar se o mês está fechado
    const dataRef = dados.data_pagamento || dados.data_lancamento || dados.data_vencimento;
    if (dataRef && verificarMesBloqueado(dataRef)) {
      const data = new Date(dataRef + 'T00:00:00');
      const nomeMes = meses[data.getMonth()];
      const ano = data.getFullYear();
      showError(`🔒 ${nomeMes}/${ano} está fechado. Reabra o mês para lançar.`);
      return;
    }

    try {
      const dadosLancamento = {
        tipo: dados.tipo,
        categoria_id: parseInt(dados.categoria_id),
        descricao: dados.descricao,
        valor: parseFloat(dados.valor),
        data_lancamento: dados.data_lancamento,
        data_vencimento: dados.data_vencimento,
        tipo_pagamento: dados.tipo_pagamento,
        data_pagamento: dados.data_pagamento || null,
        status: dados.status,
        comprovante_url: dados.comprovante_url || null,
        observacoes: dados.observacoes || null,
        origem_tipo: dados.origem_tipo || 'Loja', 
        origem_irmao_id: dados.origem_irmao_id ? parseInt(dados.origem_irmao_id) : null 
      };

      if (editando) {
        const { error } = await supabase
          .from('lancamentos_loja')
          .update(dadosLancamento)
          .eq('id', editando);

        if (error) throw error;
        
        // Registrar log de edição
        if (userData?.id) {
          try {
            await supabase.from('logs_acesso').insert([{
              usuario_id: userData.id,
              acao: 'editar',
              detalhes: `Editou lançamento financeiro: ${dados.descricao} - R$ ${parseFloat(dados.valor).toFixed(2)}`,
              ip: 'Browser',
              user_agent: navigator.userAgent
            }]);
          } catch (logError) {
            console.error('Erro ao registrar log:', logError);
          }
        }
        
        showSuccess(`${dados.tipo === 'receita' ? 'Receita' : 'Despesa'} atualizada com sucesso!`);
      } else {
        const { error } = await supabase
          .from('lancamentos_loja')
          .insert(dadosLancamento);

        if (error) throw error;
        showSuccess(`${dados.tipo === 'receita' ? 'Receita' : 'Despesa'} criada com sucesso!`);
      }

      limparFormulario();
      await recarregarDados();

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
          origem_tipo: 'Irmao', 
          origem_irmao_id: irmaoId 
        };
      });

      const { error } = await supabase
        .from('lancamentos_loja')
        .insert(lancamentosParaInserir);

      if (error) throw error;

      showSuccess(`${lancamentosParaInserir.length} lançamentos criados com sucesso!`);
      setMostrarModalIrmaos(false);
      limparLancamentoIrmaos();
      await recarregarDados();

    } catch (error) {
      console.error('Erro ao criar lançamentos:', error);
      showError('Erro ao criar lançamentos: ' + error.message);
    }
  };

  // NOVA FUNÇÃO: Quitação individual rápida
  const abrirModalQuitacao = async (lancamento) => {
    try {
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
      await recarregarDados();

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
      await recarregarDados();

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
      await recarregarDados();

    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      showError('Erro ao atualizar status: ' + error.message);
    }
  };

  const editarLancamento = (lancamento) => {
    const dataRef = lancamento.data_pagamento || lancamento.data_lancamento || lancamento.data_vencimento;
    if (dataRef && verificarMesBloqueado(dataRef)) {
      const data = new Date(dataRef + 'T00:00:00');
      showError(`🔒 ${meses[data.getMonth()]}/${data.getFullYear()} está fechado. Reabra o mês para editar.`);
      return;
    }
    setTipoLancamento(lancamento.tipo); // Define o tipo para o modal
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
      origem_tipo: lancamento.origem_tipo || 'Loja', 
      origem_irmao_id: lancamento.origem_irmao_id || '' 
    });
    setEditando(lancamento.id);
    setModalLancamentoAberto(true);
  };

  const recarregarDados = async () => {
    await carregarLancamentos();
    calcularCaixaFisicoTotal();
    calcularTroncoTotal();
  };

  const excluirLancamento = async (id) => {
    const lancamento = lancamentos.find(l => l.id === id);
    const dataRef = lancamento?.data_pagamento || lancamento?.data_lancamento || lancamento?.data_vencimento;
    if (dataRef && verificarMesBloqueado(dataRef)) {
      const data = new Date(dataRef + 'T00:00:00');
      showError(`🔒 ${meses[data.getMonth()]}/${data.getFullYear()} está fechado. Reabra o mês para excluir.`);
      return;
    }
    if (!window.confirm('Deseja realmente excluir este lançamento?')) return;

    try {
      const { error } = await supabase
        .from('lancamentos_loja')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Registrar log de exclusão
      if (userData?.id) {
        try {
          const lancamento = lancamentos.find(l => l.id === id);
          const descricao = lancamento?.descricao || 'Lançamento';
          const valor = lancamento?.valor || 0;
          
          await supabase.from('logs_acesso').insert([{
            usuario_id: userData.id,
            acao: 'excluir',
            detalhes: `Excluiu lançamento financeiro: ${descricao} - R$ ${valor.toFixed(2)}`,
            ip: 'Browser',
            user_agent: navigator.userAgent
          }]);
        } catch (logError) {
          console.error('Erro ao registrar log:', logError);
        }
      }

      showSuccess('Lançamento excluído com sucesso!');
      await recarregarDados();
      calcularCaixaFisicoTotal();
      calcularTroncoTotal();

    } catch (error) {
      console.error('Erro ao excluir lançamento:', error);
      showError('Erro ao excluir lançamento: ' + error.message);
    }
  };

  const abrirModalPagamentoParcial = async (lancamento) => {
    try {
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
      origem_tipo: 'Loja', 
      origem_irmao_id: '' 
    });
    setEditando(null);
    setModalLancamentoAberto(false);
  };

  const abrirModalLancamento = (tipo) => {
    setTipoLancamento(tipo);
    setFormLancamento({
      tipo: tipo,
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
      origem_tipo: 'Loja',
      origem_irmao_id: ''
    });
    setEditando(null);
    setModalLancamentoAberto(true);
  };

  // Função para abrir modal de compensação
  const abrirModalCompensacao = async (irmaoId) => {
    try {
      const irmao = irmaos.find(i => i.id === irmaoId);
      if (!irmao) {
        showError('Irmão não encontrado');
        return;
      }

      const { data: lancamentosIrmao, error: errorLanc } = await supabase
        .from('lancamentos_loja')
        .select('*, categorias_financeiras(nome, tipo)')
        .eq('origem_irmao_id', irmaoId)
        .eq('status', 'pendente')
        .order('data_vencimento', { ascending: true });

      if (errorLanc) throw errorLanc;

      if (!lancamentosIrmao || lancamentosIrmao.length === 0) {
        showError('Não há lançamentos pendentes para compensar');
        return;
      }

      // Separar débitos (receitas - irmão deve) e créditos (despesas - loja deve)
      const debitos = lancamentosIrmao.filter(l => l.categorias_financeiras?.tipo === 'receita');
      const creditos = lancamentosIrmao.filter(l => l.categorias_financeiras?.tipo === 'despesa');

      if (debitos.length === 0 || creditos.length === 0) {
        showError('É necessário ter débitos E créditos pendentes para compensar');
        return;
      }

      setIrmaoCompensacao(irmao);
      setDebitosIrmao(debitos);
      setCreditosIrmao(creditos);
      setModalCompensacaoAberto(true);

    } catch (error) {
      console.error('Erro ao carregar compensação:', error);
      showError('Erro ao carregar dados de compensação: ' + error.message);
    }
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

  // 🌳 HELPER: RENDERIZAR CATEGORIAS HIERÁRQUICAS
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

  const fazerSangria = async () => {
    try {
      const { valor, data, observacao } = formSangria;
      if (!valor || parseFloat(valor) <= 0) {
        showError('Informe um valor válido');
        return;
      }
      const valorSangria = parseFloat(valor);
      const resumoAtual = calcularResumo();
      if (valorSangria > resumoAtual.caixaFisico) {
        showError(`Valor maior que o disponível`);
        return;
      }
      setLoading(true);
      const categoriaSangria = categorias.find(c => c.nome.toLowerCase().includes('sangria') && c.tipo === 'despesa');
      if (!categoriaSangria) {
        showError('Categoria Sangria não encontrada. Execute o SQL primeiro!');
        setLoading(false);
        return;
      }
      const categoriaDeposito = categorias.find(c => c.nome.toLowerCase().includes('depósito') && c.tipo === 'receita');
      if (!categoriaDeposito) {
        showError('Categoria Depósito não encontrada. Execute o SQL primeiro!');
        setLoading(false);
        return;
      }
      const { error: errorSangria } = await supabase.from('lancamentos_loja').insert([{
        tipo: 'despesa',
        categoria_id: categoriaSangria.id,
        descricao: `🔻 Sangria${observacao ? ` - ${observacao}` : ''}`,
        valor: valorSangria,
        data_lancamento: data,
        data_vencimento: data,
        data_pagamento: data,
        tipo_pagamento: 'dinheiro',
        status: 'pago',
        eh_transferencia_interna: true,
        origem_tipo: 'Loja',
        origem_irmao_id: null,
        comprovante_url: null,
        observacoes: `Sangria. ${observacao || ''}`
      }]);
      if (errorSangria) throw errorSangria;
      const { error: errorDeposito } = await supabase.from('lancamentos_loja').insert([{
        tipo: 'receita',
        categoria_id: categoriaDeposito.id,
        descricao: `🔺 Depósito${observacao ? ` - ${observacao}` : ''}`,
        valor: valorSangria,
        data_lancamento: data,
        data_vencimento: data,
        data_pagamento: data,
        tipo_pagamento: 'transferencia',
        status: 'pago',
        eh_transferencia_interna: true,
        origem_tipo: 'Loja',
        origem_irmao_id: null,
        comprovante_url: null,
        observacoes: `Depósito. ${observacao || ''}`
      }]);
      if (errorDeposito) throw errorDeposito;
      showSuccess(`✅ Sangria de ${formatarMoeda(valorSangria)} realizada!`);
      setFormSangria({ valor: '', data: new Date().toISOString().split('T')[0], observacao: '' });
      setModalSangriaAberto(false);
      recarregarDados();
      calcularCaixaFisicoTotal();
      calcularTroncoTotal();
    } catch (error) {
      console.error('Erro:', error);
      showError('Erro ao fazer sangria: ' + (error.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const fazerSangriaTronco = async () => {
    try {
      const { valor, data, observacao } = formSangria;
      if (!valor || parseFloat(valor) <= 0) {
        showError('Informe um valor válido');
        return;
      }
      
      const valorSangria = parseFloat(valor);
      
      if (valorSangria > troncoTotalGlobal.especie) {
        showError(`Valor maior que o disponível no Tronco (Espécie): ${formatarMoeda(troncoTotalGlobal.especie)}`);
        return;
      }
      
      setLoading(true);
      
      // Buscar categoria Tronco Saída (despesa)
      const categoriaTroncoSaida = categorias.find(c => 
        c.nome.toLowerCase().includes('tronco') && 
        c.nome.toLowerCase().includes('saida')
      );
      
      // Buscar categoria Tronco de Solidariedade (receita)
      const categoriaTroncoReceita = categorias.find(c => 
        c.nome.toLowerCase().includes('tronco') && 
        c.nome.toLowerCase().includes('solidariedade')
      );
      
      if (!categoriaTroncoSaida || !categoriaTroncoReceita) {
        showError('Categorias "Tronco Saída" e "Tronco de Solidariedade" não encontradas!');
        setLoading(false);
        return;
      }
      
      // 1. Despesa (saída de dinheiro do Tronco)
      const { error: errorSaida } = await supabase.from('lancamentos_loja').insert([{
        tipo: 'despesa',
        categoria_id: categoriaTroncoSaida.id,
        descricao: `🔻 Sangria Tronco${observacao ? ` - ${observacao}` : ''}`,
        valor: valorSangria,
        data_lancamento: data,
        data_vencimento: data,
        data_pagamento: data,
        tipo_pagamento: 'dinheiro',
        status: 'pago',
        eh_transferencia_interna: true,
        origem_tipo: 'Loja',
        origem_irmao_id: null,
        comprovante_url: null,
        observacoes: `Sangria Tronco - Espécie → Banco. ${observacao || ''}`
      }]);
      
      if (errorSaida) throw errorSaida;
      
      // 2. Receita (entrada no banco do Tronco)
      const { error: errorEntrada } = await supabase.from('lancamentos_loja').insert([{
        tipo: 'receita',
        categoria_id: categoriaTroncoReceita.id,
        descricao: `🔺 Depósito Tronco${observacao ? ` - ${observacao}` : ''}`,
        valor: valorSangria,
        data_lancamento: data,
        data_vencimento: data,
        data_pagamento: data,
        tipo_pagamento: 'transferencia',
        status: 'pago',
        eh_transferencia_interna: true,
        origem_tipo: 'Loja',
        origem_irmao_id: null,
        comprovante_url: null,
        observacoes: `Depósito Tronco - Espécie → Banco. ${observacao || ''}`
      }]);
      
      if (errorEntrada) throw errorEntrada;
      
      showSuccess(`✅ Sangria Tronco de ${formatarMoeda(valorSangria)} realizada!`);
      setFormSangria({ valor: '', data: new Date().toISOString().split('T')[0], observacao: '' });
      setModalSangriaTroncoAberto(false);
      recarregarDados();
      calcularTroncoTotal();
      
    } catch (error) {
      console.error('Erro:', error);
      showError('Erro ao fazer sangria do Tronco: ' + (error.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const calcularResumo = () => {
    const receitasBancarias = lancamentos
      .filter(l => {
        const isTroncoDeposito = l.categorias_financeiras?.nome?.toLowerCase().includes('tronco') && 
                                 l.eh_transferencia_interna === true && 
                                 l.categorias_financeiras?.tipo === 'receita';
        
        // DEPÓSITO TRONCO: conta como receita bancária
        if (isTroncoDeposito) return true;
        
        // Demais receitas bancárias normais
        return l.categorias_financeiras?.tipo === 'receita' && 
          l.status === 'pago' &&
          l.tipo_pagamento !== 'compensacao' &&
          l.tipo_pagamento !== 'dinheiro' &&
          !l.eh_transferencia_interna;
      })
      .reduce((sum, l) => sum + parseFloat(l.valor), 0);

    const receitasDinheiro = lancamentos
      .filter(l => 
        l.categorias_financeiras?.tipo === 'receita' && 
        l.status === 'pago' &&
        l.tipo_pagamento === 'dinheiro' &&
        !l.eh_transferencia_interna &&
        !l.categorias_financeiras?.nome?.toLowerCase().includes('tronco') // TRONCO DINHEIRO NÃO ENTRA (não conta no caixa físico)
      )
      .reduce((sum, l) => sum + parseFloat(l.valor), 0);

    const sangrias = lancamentos
      .filter(l => l.categorias_financeiras?.tipo === 'despesa' && l.status === 'pago' && l.eh_transferencia_interna === true)
      .reduce((sum, l) => sum + parseFloat(l.valor), 0);

    const depositos = lancamentos
      .filter(l => 
        l.categorias_financeiras?.tipo === 'receita' && 
        l.status === 'pago' && 
        l.eh_transferencia_interna === true &&
        !l.categorias_financeiras?.nome?.toLowerCase().includes('tronco') // Depósitos Tronco já estão em receitasBancarias
      )
      .reduce((sum, l) => sum + parseFloat(l.valor), 0);

    const receitas = receitasBancarias + receitasDinheiro;

    const despesas = lancamentos
      .filter(l => {
        const isTronco = l.categorias_financeiras?.nome?.toLowerCase().includes('tronco');
        const isDinheiro = l.tipo_pagamento === 'dinheiro';
        
        // TRONCO DINHEIRO (incluindo sangrias): NÃO conta nas despesas da loja
        if (isTronco && isDinheiro) return false;
        
        // Demais despesas normais (TRONCO PIX/TRANSFERÊNCIA entra aqui)
        return l.categorias_financeiras?.tipo === 'despesa' && 
          l.status === 'pago' &&
          l.tipo_pagamento !== 'compensacao' &&
          !l.eh_transferencia_interna;
      })
      .reduce((sum, l) => sum + parseFloat(l.valor), 0);

    const receitasPendentes = lancamentos
      .filter(l => l.categorias_financeiras?.tipo === 'receita' && l.status === 'pendente' && !l.eh_transferencia_interna)
      .reduce((sum, l) => sum + parseFloat(l.valor), 0);

    const despesasPendentes = lancamentos
      .filter(l => l.categorias_financeiras?.tipo === 'despesa' && l.status === 'pendente' && !l.eh_transferencia_interna)
      .reduce((sum, l) => sum + parseFloat(l.valor), 0);
    
    const saldoPeriodo = receitas - despesas;
    
    const saldoBancario = saldoAnterior + receitasBancarias + depositos - despesas;
    
    const caixaFisico = caixaFisicoTotal;
    
    const saldoTotal = saldoBancario + caixaFisico;

    // CÁLCULO TRONCO DE SOLIDARIEDADE
    const troncoReceitasBanco = lancamentos
      .filter(l =>
        l.categorias_financeiras?.nome?.toLowerCase().includes('tronco') &&
        l.categorias_financeiras?.tipo === 'receita' &&
        l.status === 'pago' &&
        l.tipo_pagamento !== 'dinheiro'
      )
      .reduce((sum, l) => sum + parseFloat(l.valor), 0);

    const troncoReceitasEspecie = lancamentos
      .filter(l =>
        l.categorias_financeiras?.nome?.toLowerCase().includes('tronco') &&
        l.categorias_financeiras?.tipo === 'receita' &&
        l.status === 'pago' &&
        l.tipo_pagamento === 'dinheiro'
      )
      .reduce((sum, l) => sum + parseFloat(l.valor), 0);

    const troncoDespesasBanco = lancamentos
      .filter(l =>
        l.categorias_financeiras?.nome?.toLowerCase().includes('tronco') &&
        l.categorias_financeiras?.tipo === 'despesa' &&
        l.status === 'pago' &&
        l.tipo_pagamento !== 'dinheiro' &&
        !l.eh_transferencia_interna
      )
      .reduce((sum, l) => sum + parseFloat(l.valor), 0);

    const troncoDespesasEspecie = lancamentos
      .filter(l =>
        l.categorias_financeiras?.nome?.toLowerCase().includes('tronco') &&
        l.categorias_financeiras?.tipo === 'despesa' &&
        l.status === 'pago' &&
        l.tipo_pagamento === 'dinheiro' &&
        !l.eh_transferencia_interna
      )
      .reduce((sum, l) => sum + parseFloat(l.valor), 0);

    const troncoSangriasBanco = lancamentos
      .filter(l =>
        l.categorias_financeiras?.nome?.toLowerCase().includes('tronco') &&
        l.eh_transferencia_interna === true &&
        l.categorias_financeiras?.tipo === 'receita'
      )
      .reduce((sum, l) => sum + parseFloat(l.valor), 0);

    const troncoSangriasEspecie = lancamentos
      .filter(l =>
        l.categorias_financeiras?.nome?.toLowerCase().includes('tronco') &&
        l.eh_transferencia_interna === true &&
        l.categorias_financeiras?.tipo === 'despesa'
      )
      .reduce((sum, l) => sum + parseFloat(l.valor), 0);

    const troncoBanco = troncoReceitasBanco - troncoDespesasBanco + troncoSangriasBanco;
    const troncoEspecie = troncoReceitasEspecie - troncoDespesasEspecie - troncoSangriasEspecie;
    const troncoTotal = troncoBanco + troncoEspecie;

    return {
      receitas,            
      receitasBancarias,     
      receitasDinheiro,
      sangrias,
      depositos,
      despesas,            
      saldoPeriodo,
      saldoBancario,         
      caixaFisico,           
      saldoTotal,
      receitasPendentes,
      despesasPendentes,
      troncoBanco,
      troncoEspecie,
      troncoTotal
    };
  };

  // Calcular saldo anterior (todos os lançamentos pagos antes do período selecionado)
  const calcularSaldoAnterior = async () => {
    try {
      const { mes, ano } = filtros;

      if (mes === 0 && ano === 0) {
        setSaldoAnterior(0);
        return;
      }

      let dataLimite;
      if (mes > 0 && ano > 0) {
        dataLimite = `${ano}-${mes.toString().padStart(2, '0')}-01`;
      } else if (ano > 0) {
        dataLimite = `${ano}-01-01`;
      }

      const { data, error } = await supabase
        .from('lancamentos_loja')
        .select('*, categorias_financeiras(tipo)')
        .eq('status', 'pago')
        .lt('data_pagamento', dataLimite)  

      if (error) throw error;

      const receitasBancariasAnt = (data || [])
        .filter(l => 
          l.categorias_financeiras?.tipo === 'receita' &&
          l.tipo_pagamento !== 'compensacao' &&
          l.tipo_pagamento !== 'dinheiro' &&
          !l.eh_transferencia_interna
        )
        .reduce((sum, l) => sum + parseFloat(l.valor), 0);

      const depositosAnt = (data || [])
        .filter(l => 
          l.categorias_financeiras?.tipo === 'receita' &&
          l.eh_transferencia_interna === true
        )
        .reduce((sum, l) => sum + parseFloat(l.valor), 0);

      const despesasAnteriores = (data || [])
        .filter(l => 
          l.categorias_financeiras?.tipo === 'despesa' &&
          l.tipo_pagamento !== 'compensacao' &&
          !l.eh_transferencia_interna
        )
        .reduce((sum, l) => sum + parseFloat(l.valor), 0);

      const saldo = receitasBancariasAnt + depositosAnt - despesasAnteriores;
      setSaldoAnterior(saldo);

    } catch (error) {
      console.error('Erro ao calcular saldo anterior:', error);
      setSaldoAnterior(0);
    }
  };

  const calcularCaixaFisicoTotal = async () => {
    try {
      const { data, error } = await supabase
        .from('lancamentos_loja')
        .select('*, categorias_financeiras(tipo, nome)')
        .eq('status', 'pago');

      if (error) throw error;

      const dinheiroRecebido = (data || [])
        .filter(l => 
          l.categorias_financeiras?.tipo === 'receita' &&
          l.tipo_pagamento === 'dinheiro' &&
          !l.eh_transferencia_interna &&
          !l.categorias_financeiras?.nome?.toLowerCase().includes('tronco') // EXCLUIR TRONCO
        )
        .reduce((sum, l) => sum + parseFloat(l.valor), 0);

      const sangriasFeitas = (data || [])
        .filter(l => 
          l.eh_transferencia_interna === true && 
          l.categorias_financeiras?.tipo === 'despesa' &&
          !l.categorias_financeiras?.nome?.toLowerCase().includes('tronco') // EXCLUIR TRONCO
        )
        .reduce((sum, l) => sum + parseFloat(l.valor), 0);

      setCaixaFisicoTotal(dinheiroRecebido - sangriasFeitas);

    } catch (error) {
      console.error('Erro ao calcular caixa físico:', error);
      setCaixaFisicoTotal(0);
    }
  };

  const calcularTroncoTotal = async () => {
    try {
      const { data, error } = await supabase
        .from('lancamentos_loja')
        .select('*, categorias_financeiras(tipo, nome)')
        .eq('status', 'pago');

      if (error) throw error;

      // Receitas Banco (já inclui sangrias/depósitos porque são receitas em transferência)
      const receitasBanco = (data || [])
        .filter(l =>
          l.categorias_financeiras?.nome?.toLowerCase().includes('tronco') &&
          l.categorias_financeiras?.tipo === 'receita' &&
          l.tipo_pagamento !== 'dinheiro'
        )
        .reduce((sum, l) => sum + parseFloat(l.valor), 0);

      // Receitas Espécie (não inclui sangrias - só receitas normais em dinheiro)
      const receitasEspecie = (data || [])
        .filter(l =>
          l.categorias_financeiras?.nome?.toLowerCase().includes('tronco') &&
          l.categorias_financeiras?.tipo === 'receita' &&
          l.tipo_pagamento === 'dinheiro' &&
          !l.eh_transferencia_interna
        )
        .reduce((sum, l) => sum + parseFloat(l.valor), 0);

      // Despesas Banco
      const despesasBanco = (data || [])
        .filter(l =>
          l.categorias_financeiras?.nome?.toLowerCase().includes('tronco') &&
          l.categorias_financeiras?.tipo === 'despesa' &&
          l.tipo_pagamento !== 'dinheiro' &&
          !l.eh_transferencia_interna
        )
        .reduce((sum, l) => sum + parseFloat(l.valor), 0);

      // Despesas Espécie (INCLUI sangrias em dinheiro - são despesas que diminuem espécie)
      const despesasEspecie = (data || [])
        .filter(l =>
          l.categorias_financeiras?.nome?.toLowerCase().includes('tronco') &&
          l.categorias_financeiras?.tipo === 'despesa' &&
          l.tipo_pagamento === 'dinheiro'
          // NÃO excluir transferências internas - sangrias devem diminuir espécie
        )
        .reduce((sum, l) => sum + parseFloat(l.valor), 0);

      const banco = receitasBanco - despesasBanco;
      const especie = receitasEspecie - despesasEspecie;
      const total = banco + especie;

      setTroncoTotalGlobal({ banco, especie, total });

    } catch (error) {
      console.error('Erro ao calcular Tronco total:', error);
      setTroncoTotalGlobal({ banco: 0, especie: 0, total: 0 });
    }
  };

  const buscarTotalRegistros = async () => {
    try {
      const { count, error } = await supabase
        .from('lancamentos_loja')
        .select('*', { count: 'exact', head: true })

      if (error) throw error;
      setTotalRegistros(count || 0);
    } catch (error) {
      console.error('Erro ao buscar total de registros:', error);
      setTotalRegistros(0);
    }
  };

  const gerarPDF = async () => {
    try {
      const resumo = calcularResumo();
      await gerarRelatorioPDF({
        lancamentos,
        categorias,
        filtros,
        resumo,
        saldoAnterior,
        meses
      });
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      showError('Erro ao gerar relatório: ' + error.message);
    }
  };

  const gerarPDFResumido = async () => {
    try {
      await gerarRelatorioResumido({
        lancamentos,
        categorias,
        filtros,
        meses,
        supabase
      });
    } catch (error) {
      console.error('Erro ao gerar PDF resumido:', error);
      showError('Erro ao gerar relatório: ' + error.message);
    }
  };

  // 💰 RESUMO FINANCEIRO DOS IRMÃOS
  const calcularResumoIrmaos = () => {
    // Agrupar lançamentos por irmão
    const resumoPorIrmao = {};
    
    irmaos.forEach(irmao => {
      resumoPorIrmao[irmao.id] = {
        nomeIrmao: irmao.nome,
        cim: irmao.cim,
        totalDespesas: 0,        // Total que o irmão deve (independente de pago)
        totalReceitas: 0,        // Total que a loja deve ao irmão (independente de pago)
        despesasPendentes: 0,    // O que o irmão ainda deve (não pago)
        receitasPendentes: 0,    // O que a loja ainda deve ao irmão (não pago)
        saldo: 0                 // Resultado final
      };
    });
    
    // Percorrer TODOS os lançamentos (sem filtro de data)
    lancamentos.forEach(lanc => {
      if (lanc.origem_irmao_id && resumoPorIrmao[lanc.origem_irmao_id]) {
        const valor = parseFloat(lanc.valor) || 0;
        
        if (lanc.categorias_financeiras?.tipo === 'despesa') {
          // DESPESA = Irmão deve para a Loja
          resumoPorIrmao[lanc.origem_irmao_id].totalDespesas += valor;
          
          // Se não está pago, está pendente
          if (lanc.status === 'pendente') {
            resumoPorIrmao[lanc.origem_irmao_id].despesasPendentes += valor;
          }
          
        } else if (lanc.categorias_financeiras?.tipo === 'receita') {
          // RECEITA = Loja deve para o Irmão (crédito do irmão)
          resumoPorIrmao[lanc.origem_irmao_id].totalReceitas += valor;
          
          // Se não está pago, está pendente
          if (lanc.status === 'pendente') {
            resumoPorIrmao[lanc.origem_irmao_id].receitasPendentes += valor;
          }
        }
      }
    });
    
    // Calcular saldo final: despesasPendentes - receitasPendentes
    // Positivo = Irmão deve para a Loja (vermelho)
    // Zero = Está em dia (verde)
    // Negativo = Loja deve para o Irmão (azul)
    Object.values(resumoPorIrmao).forEach(irmao => {
      irmao.saldo = irmao.despesasPendentes - irmao.receitasPendentes;
    });
    
    // Converter para array e filtrar apenas irmãos com movimentação
    const resumoArray = Object.values(resumoPorIrmao).filter(
      irmao => irmao.totalDespesas > 0 || irmao.totalReceitas > 0
    );
    
    setResumoIrmaos(resumoArray);
    setModalResumoAberto(true);
  };

  // 📊 RELATÓRIO INDIVIDUAL DE IRMÃO
  const gerarRelatorioIndividual = async (irmaoId) => {
    try {
      showSuccess('Gerando relatório individual...');
      
      // Buscar dados da loja
      const { data: dadosLoja } = await supabase
        .from('dados_loja')
        .select('*')
        .single();
      
      const { data: irmaoData, error: irmaoError } = await supabase
        .from('irmaos')
        .select('nome, cpf, cim, data_iniciacao, data_elevacao, data_exaltacao')
        .eq('id', irmaoId)
        .single();

      if (irmaoError) throw irmaoError;

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

      // BUSCAR ÚLTIMAS 5 SESSÕES COM PRESENÇA DO IRMÃO
      const { data: ultimasSessoesTemp } = await supabase
        .from('sessoes_presenca')
        .select('id, data_sessao, grau_sessao_id, graus_sessao:grau_sessao_id(nome)')
        .lte('data_sessao', new Date().toISOString().split('T')[0]) // Não incluir sessões futuras
        .order('data_sessao', { ascending: false })
        .limit(5);
      
      // Inverter para ordem crescente (da mais antiga para a mais recente)
      const ultimasSessoes = ultimasSessoesTemp?.reverse() || [];

      const { data: presencas } = await supabase
        .from('registros_presenca')
        .select('*')
        .eq('membro_id', irmaoId)
        .in('sessao_id', ultimasSessoes?.map(s => s.id) || []);

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

      // Importar jsPDF dinamicamente
      const jsPDFModule = await import('jspdf');
      const jsPDF = jsPDFModule.default;
      const doc = new jsPDF();
      let yPos = 10;

      // ========================================
      // LOGO
      // ========================================
      if (dadosLoja?.logo_url) {
        try {
          doc.addImage(dadosLoja.logo_url, 'PNG', 90, yPos, 30, 30);
          yPos += 38; // Aumentado para 38
        } catch (e) {
          console.log('Logo não disponível');
        }
      }
      
      // Cabeçalho
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      const nomeLoja = `${dadosLoja?.nome_loja || 'ARLS ACACIA DE PARANATINGA'} Nº ${dadosLoja?.numero_loja || '30'}`;
      doc.text(nomeLoja, 105, yPos, { align: 'center' });
      yPos += 6;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      if (dadosLoja?.grande_loja) {
        doc.text('Jurisdicionada a', 105, yPos, { align: 'center' });
        yPos += 5;
        doc.setFont('helvetica', 'bold');
        doc.text(dadosLoja.grande_loja, 105, yPos, { align: 'center' });
        yPos += 10;
      } else {
        doc.text('Jurisdicionada a', 105, yPos, { align: 'center' });
        yPos += 5;
        doc.setFont('helvetica', 'bold');
        doc.text('Grande Loja Maçônica do Estado de Mato Grosso', 105, yPos, { align: 'center' });
        yPos += 10;
      }

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Relatório de Despesas Pendentes', 105, yPos, { align: 'center' });
      yPos += 12;

      // Dados do Irmão em um box
      doc.setFillColor(240, 240, 240);
      doc.rect(15, yPos, 180, 18, 'F');
      yPos += 5;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Nome', 20, yPos);
      doc.setFont('helvetica', 'bold');
      doc.text(irmaoData.nome, 40, yPos);
      yPos += 5;

      doc.setFont('helvetica', 'normal');
      doc.text('CPF', 20, yPos);
      doc.setFont('helvetica', 'bold');
      doc.text(irmaoData.cpf || 'Não informado', 40, yPos);
      yPos += 5;

      doc.setFont('helvetica', 'normal');
      doc.text('CIM', 20, yPos);
      doc.setFont('helvetica', 'bold');
      doc.text(irmaoData.cim || 'Não informado', 40, yPos);
      yPos += 12;

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
        yPos += 10; // 3mm de espaço após o mês

        // Cabeçalho das colunas com faixa azul clara
        doc.setFillColor(200, 230, 245); // Azul mais claro (tom sobre tom)
        doc.rect(15, yPos, 180, 6, 'F');
        doc.setFontSize(9); // Aumentado de 8 para 9
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.text('DtLanc', 17, yPos + 4);
        doc.text('Descrição', 40, yPos + 4);
        doc.text('Despesa', 120, yPos + 4, { align: 'right' });
        doc.text('Crédito', 150, yPos + 4, { align: 'right' });
        doc.text('Saldo', 190, yPos + 4, { align: 'right' });
        yPos += 11; // 5mm de espaço total após o cabeçalho (2mm anterior + 3mm adicional)

        // Lançamentos
        let subtotalDespesa = 0;  // O que o irmão DEVE
        let subtotalCredito = 0;  // O que o irmão TEM A RECEBER
        doc.setFontSize(9); // Aumentado de 8 para 9
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

          doc.setTextColor(0, 0, 0);
          doc.text(dataLanc, 15, yPos);
          doc.text(descricao, 40, yPos);
          
          // Despesa em VERMELHO
          if (valorDespesa > 0) {
            doc.setTextColor(255, 0, 0);
            doc.text(`R$ ${valorDespesa.toFixed(2)}`, 120, yPos, { align: 'right' });
            doc.setTextColor(0, 0, 0);
          }
          
          // Crédito em AZUL
          if (valorCredito > 0) {
            doc.setTextColor(0, 100, 255);
            doc.text(`R$ ${valorCredito.toFixed(2)}`, 150, yPos, { align: 'right' });
            doc.setTextColor(0, 0, 0);
          }
          
          // Saldo parcial em VERMELHO
          const saldoParcial = subtotalDespesa - subtotalCredito;
          doc.setTextColor(255, 0, 0);
          doc.text(`R$ ${Math.abs(saldoParcial).toFixed(2)}`, 190, yPos, { align: 'right' });
          doc.setTextColor(0, 0, 0);
          
          yPos += 5;
        });

        // Linha preta separadora ANTES do subtotal
        yPos += 1;
        doc.setDrawColor(0, 0, 0); // Preto
        doc.setLineWidth(0.5);
        doc.line(15, yPos, 195, yPos);
        yPos += 4;

        // Subtotal do mês - alinhado com coluna Crédito
        const saldoMes = subtotalDespesa - subtotalCredito;
        doc.setFontSize(11); // Aumentado para 11 (2 a mais que 9 dos lançamentos)
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Sub Total', 150, yPos, { align: 'right' });
        doc.setTextColor(255, 0, 0);
        doc.text(`R$ ${Math.abs(saldoMes).toFixed(2)}`, 190, yPos, { align: 'right' });
        doc.setTextColor(0, 0, 0);
        
        totalGeralDespesa += subtotalDespesa;
        totalGeralCredito += subtotalCredito;
        yPos += 10;
      });

      // Total Final
      if (yPos > 220) {
        doc.addPage();
        yPos = 20;
      }

      // Dados Bancários (sem fundo cinza) - deslocado mais para esquerda
      yPos += 5;

      doc.setFontSize(10); // Aumentado de 9 para 10
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Dados Bancários', 45, yPos, { align: 'center' }); // Mudado de 57.5 para 45
      yPos += 5;

      doc.setFontSize(9); // Aumentado de 8 para 9
      doc.setTextColor(0, 100, 180);
      doc.setFont('helvetica', 'bold');
      doc.text('Cooperativa de Crédito Sicredi', 45, yPos, { align: 'center' });
      yPos += 4;

      doc.setTextColor(0, 0, 0); // Preto
      doc.setFont('helvetica', 'normal');
      doc.text('Ag.: 0802 - C.C.: 86.913-9', 45, yPos, { align: 'center' });
      yPos += 4;
      doc.text('PIX.: 03.250.704/0001-00', 45, yPos, { align: 'center' });
      yPos += 4;
      doc.setFontSize(8); // Aumentado de 7 para 8
      doc.text('CNPJ: 03.250.704/0001-00', 45, yPos, { align: 'center' });
      yPos += 4;
      doc.text('Fav.: ARLSACACIA PARANATINGA 30', 45, yPos, { align: 'center' });

      // Total (lado direito)
      yPos -= 21;
      const saldoFinal = totalGeralDespesa - totalGeralCredito;
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Total Despesa', 140, yPos, { align: 'right' });
      doc.setTextColor(255, 0, 0);
      doc.text(`R$ ${totalGeralDespesa.toFixed(2)}`, 190, yPos, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      yPos += 7;

      doc.text('Total Crédito', 140, yPos, { align: 'right' });
      doc.setTextColor(0, 100, 255);
      doc.text(`R$ ${totalGeralCredito.toFixed(2)}`, 190, yPos, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      yPos += 7;

      doc.text('Saldo', 140, yPos, { align: 'right' });
      doc.setTextColor(255, 0, 0);
      doc.text(`R$ ${Math.abs(saldoFinal).toFixed(2)}`, 190, yPos, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      
      yPos += 35; // Espaço de 2cm (~20mm = 35 pontos)
      
      // Mensagem da Tesouraria
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0); // Preto
      doc.text('Tesouraria - Acácia de Paranatinga nº 30', 105, yPos, { align: 'center' });
      yPos += 7;
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(0, 0, 0); // Preto
      
      // Quebrar o texto em múltiplas linhas
      const mensagem = '"Irmãos, o cumprimento de nossas obrigações financeiras é um ato de honra';
      const mensagem2 = 'e compromisso com a nossa Loja, bem como com os ideais que nos unem."';
      
      doc.text(mensagem, 105, yPos, { align: 'center', maxWidth: 170 });
      yPos += 5;
      doc.text(mensagem2, 105, yPos, { align: 'center', maxWidth: 170 });
      yPos += 15;

      // ========================================
      // PRESENÇA (ÚLTIMAS 5 SESSÕES) - FORMATO MATRIZ
      // ========================================
      if (ultimasSessoes && ultimasSessoes.length > 0) {
        if (yPos > 200) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Presença nas Últimas 5 Sessões:', 15, yPos);
        yPos += 6;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`${irmaoData.nome} - CIM: ${irmaoData.cim || 'N/A'}`, 15, yPos);
        yPos += 8;

        // Título do quadro
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Quadro de Situações das 05 Últimas Sessões', 15, yPos);
        yPos += 6;

        // Preparar dados da tabela vertical
        const tableData = [];
        
        ultimasSessoes.forEach(sessao => {
          // Data completa - corrigir timezone
          const dataSessao = new Date(sessao.data_sessao + 'T12:00:00');
          const dataFormatada = dataSessao.toLocaleDateString('pt-BR');
          
          // Determinar grau da sessão - incluindo administrativa
          let grauSessao = sessao.grau_sessao_id || 1;
          const grauOriginal = sessao.grau_sessao_id || 1;
          
          // Sessão Administrativa (grau 4) deve ser tratada como Aprendiz (grau 1)
          if (grauSessao === 4) grauSessao = 1;
          
          const grauNome = grauOriginal === 4 ? 'Administrativa' :
                          grauSessao === 3 ? 'Mestre' : 
                          grauSessao === 2 ? 'Companheiro' : 'Aprendiz';
          
          // Calcular grau do irmão na data
          let grauIrmao = 0;
          if (irmaoData.data_exaltacao && dataSessao >= new Date(irmaoData.data_exaltacao + 'T12:00:00')) {
            grauIrmao = 3;
          } else if (irmaoData.data_elevacao && dataSessao >= new Date(irmaoData.data_elevacao + 'T12:00:00')) {
            grauIrmao = 2;
          } else if (irmaoData.data_iniciacao && dataSessao >= new Date(irmaoData.data_iniciacao + 'T12:00:00')) {
            grauIrmao = 1;
          }
          
          // Determinar status - usar letras ao invés de símbolos
          let status = 'N/A';
          if (grauSessao > grauIrmao) {
            status = '-';
          } else {
            const registro = presencas?.find(p => p.sessao_id === sessao.id);
            if (registro) {
              if (registro.presente) {
                status = 'S Presente';
              } else if (registro.justificativa) {
                status = 'J Justificado';
              } else {
                status = 'X Ausente';
              }
            } else {
              status = 'X Ausente';
            }
          }
          
          tableData.push([dataFormatada, grauNome, status]);
        });

        await import('jspdf-autotable');
        
        doc.autoTable({
          startY: yPos,
          head: [['Data', 'Grau', 'Status']],
          body: tableData,
          headStyles: { 
            fillColor: [33, 150, 243],
            textColor: [255, 255, 255],
            fontSize: 10,
            fontStyle: 'bold',
            halign: 'center'
          },
          bodyStyles: { 
            fontSize: 10,
            halign: 'center'
          },
          columnStyles: {
            0: { cellWidth: 30, halign: 'center' },
            1: { cellWidth: 35, halign: 'center', fontStyle: 'bold' },
            2: { cellWidth: 45, halign: 'left', fontStyle: 'bold' }
          },
          alternateRowStyles: {
            fillColor: [245, 245, 245]
          },
          margin: { left: 15, right: 15 }
        });

        yPos = doc.lastAutoTable.finalY + 4;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(80, 80, 80);
        doc.text('S = Presente | X = Ausente | J = Justificado | - = Não elegível', 15, yPos);
        yPos += 10;

        // ========================================
        // ESTATÍSTICAS DE PRESENÇA
        // ========================================
        
        // Determinar grau do irmão em cada sessão (baseado nas datas)
        const obterGrauNaData = (dataSessao) => {
          const data = new Date(dataSessao + 'T12:00:00');
          let grau = 0;
          if (irmaoData.data_exaltacao && data >= new Date(irmaoData.data_exaltacao + 'T12:00:00')) grau = 3;
          else if (irmaoData.data_elevacao && data >= new Date(irmaoData.data_elevacao + 'T12:00:00')) grau = 2;
          else if (irmaoData.data_iniciacao && data >= new Date(irmaoData.data_iniciacao + 'T12:00:00')) grau = 1;
          
          return grau;
        };

        // Calcular estatísticas das últimas 5 sessões (apenas sessões elegíveis)
        let totalSessoes5 = 0;
        let presencas5 = 0;
        let ausencias5 = 0;
        let justificadas5 = 0;

        ultimasSessoes.forEach(sessao => {
          let grauSessao = sessao.grau_sessao_id || 1;
          
          // Sessão Administrativa (grau 4) deve ser tratada como Aprendiz (grau 1)
          if (grauSessao === 4) grauSessao = 1;
          
          const grauIrmao = obterGrauNaData(sessao.data_sessao);
          
          // Só contar se irmão tinha grau suficiente
          if (grauIrmao >= grauSessao) {
            totalSessoes5++;
            const registro = presencas?.find(p => p.sessao_id === sessao.id);
            if (registro) {
              if (registro.presente) {
                presencas5++;
              } else if (registro.justificativa) {
                justificadas5++;
              } else {
                ausencias5++;
              }
            } else {
              // Sem registro = ausência
              ausencias5++;
            }
          }
        });

        const taxa5 = totalSessoes5 > 0 ? ((presencas5 / totalSessoes5) * 100).toFixed(1) : '0.0';

        // Buscar estatísticas anuais com paginação
        const anoAtual = new Date().getFullYear();
        
        let sessoesAno = [];
        let inicio = 0;
        const tamanhoPagina = 1000;
        let continuar = true;

        while (continuar) {
          const { data: lote } = await supabase
            .from('sessoes_presenca')
            .select('id, data_sessao, grau_sessao_id')
            .gte('data_sessao', `${anoAtual}-01-01`)
            .lte('data_sessao', `${anoAtual}-12-31`)
            .lte('data_sessao', new Date().toISOString().split('T')[0]) // Não incluir sessões futuras
            .order('data_sessao', { ascending: true })
            .range(inicio, inicio + tamanhoPagina - 1);

          if (lote && lote.length > 0) {
            sessoesAno = [...sessoesAno, ...lote];
            inicio += tamanhoPagina;
            
            if (lote.length < tamanhoPagina) {
              continuar = false;
            }
          } else {
            continuar = false;
          }
        }

        console.log('📊 Sessões do ano BUSCADAS:', sessoesAno?.length);
        console.log('📅 Primeira sessão:', sessoesAno?.[0]);
        console.log('📅 Última sessão:', sessoesAno?.[sessoesAno.length - 1]);

        const { data: registrosAno } = await supabase
          .from('registros_presenca')
          .select('*')
          .eq('membro_id', irmaoId)
          .in('sessao_id', sessoesAno?.map(s => s.id) || []);

        let totalSessoesAnoGeral = sessoesAno?.length || 0;
        let totalSessoesElegiveis = 0;
        let presencasContadasAno = 0;
        let ausenciasAno = 0;
        let justificadasAno = 0;

        console.log('📊 Total sessões ano:', totalSessoesAnoGeral);
        console.log('👤 Irmão:', irmaoData.nome);
        console.log('📅 Datas grau:', {
          iniciacao: irmaoData.data_iniciacao,
          elevacao: irmaoData.data_elevacao,
          exaltacao: irmaoData.data_exaltacao
        });

        sessoesAno?.forEach(sessao => {
          let grauSessao = sessao.grau_sessao_id || 1;
          
          // Sessão Administrativa (grau 4) deve ser tratada como Aprendiz (grau 1)
          if (grauSessao === 4) grauSessao = 1;
          
          const grauIrmao = obterGrauNaData(sessao.data_sessao);
          
          const elegivel = grauIrmao >= grauSessao;
          
          if (elegivel) {
            console.log('✅ Elegível:', sessao.data_sessao, 'Grau sessão:', grauSessao, 'Grau irmão:', grauIrmao);
          } else {
            console.log('❌ NÃO elegível:', sessao.data_sessao, 'Grau sessão:', grauSessao, 'Grau irmão:', grauIrmao);
          }
          
          // Só contar se irmão tinha grau suficiente
          if (elegivel) {
            totalSessoesElegiveis++;
            const reg = registrosAno?.find(r => r.sessao_id === sessao.id);
            if (reg) {
              if (reg.presente) {
                presencasContadasAno++;
              } else if (reg.justificativa) {
                justificadasAno++;
              } else {
                ausenciasAno++;
              }
            } else {
              // Sem registro = ausência
              ausenciasAno++;
            }
          }
        });

        console.log('🎯 RESULTADO:', {
          totalGeral: totalSessoesAnoGeral,
          elegiveis: totalSessoesElegiveis,
          presencas: presencasContadasAno,
          ausencias: ausenciasAno
        });

        const taxaAno = totalSessoesElegiveis > 0 ? ((presencasContadasAno / totalSessoesElegiveis) * 100).toFixed(1) : '0.0';

        // Desenhar quadro de estatísticas no formato de grade
        if (yPos > 200) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Grade de Presença - Últimas 5 Sessões:', 15, yPos);
        yPos += 7;

        // Montar cabeçalho da grade com datas e graus
        const headers = [{ title: 'Grau', dataKey: 'grau' }];
        
        ultimasSessoes.forEach((sessao, index) => {
          const dataSessao = new Date(sessao.data_sessao + 'T12:00:00');
          const dataFormatada = dataSessao.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          let grauOriginal = sessao.grau_sessao_id || 1;
          const grauTexto = grauOriginal === 4 ? 'ADM' :
                           grauOriginal === 1 ? 'A' : 
                           grauOriginal === 2 ? 'C' : 'M';
          headers.push({
            title: `${dataFormatada}\n${grauTexto}`,
            dataKey: `sessao_${index}`
          });
        });
        
        headers.push({ title: 'Total', dataKey: 'total' });
        headers.push({ title: '%', dataKey: 'percentual' });

        // Montar linha do irmão
        const row = {
          grau: irmaoData.data_exaltacao ? (irmaoData.mestre_instalado ? 'M.I' : 'M') :
                irmaoData.data_elevacao ? 'C' : 'A'
        };

        let presencasGrade = 0;
        let sessoesElegiveisGrade = 0;

        ultimasSessoes.forEach((sessao, index) => {
          let grauSessao = sessao.grau_sessao_id || 1;
          if (grauSessao === 4) grauSessao = 1;
          
          const grauIrmao = obterGrauNaData(sessao.data_sessao);
          
          if (grauIrmao >= grauSessao) {
            sessoesElegiveisGrade++;
            const registro = presencas?.find(p => p.sessao_id === sessao.id);
            if (registro) {
              if (registro.presente) {
                presencasGrade++;
                row[`sessao_${index}`] = 'P';
              } else if (registro.justificativa) {
                row[`sessao_${index}`] = 'J';
              } else {
                row[`sessao_${index}`] = 'F';
              }
            } else {
              row[`sessao_${index}`] = 'F';
            }
          } else {
            row[`sessao_${index}`] = '-';
          }
        });

        row.total = `${presencasGrade}/${sessoesElegiveisGrade}`;
        row.percentual = sessoesElegiveisGrade > 0 
          ? `${Math.round((presencasGrade / sessoesElegiveisGrade) * 100)}%` 
          : '0%';

        doc.autoTable({
          startY: yPos,
          head: [headers],
          body: [[row.grau, row.sessao_0, row.sessao_1, row.sessao_2, row.sessao_3, row.sessao_4, row.total, row.percentual]],
          headStyles: {
            fillColor: [33, 150, 243],
            textColor: [255, 255, 255],
            fontSize: 8,
            fontStyle: 'bold',
            halign: 'center',
            cellPadding: 2
          },
          bodyStyles: {
            fontSize: 10,
            halign: 'center',
            cellPadding: 3
          },
          columnStyles: {
            0: { cellWidth: 15, fontStyle: 'bold' },
            1: { cellWidth: 20 },
            2: { cellWidth: 20 },
            3: { cellWidth: 20 },
            4: { cellWidth: 20 },
            5: { cellWidth: 20 },
            6: { cellWidth: 25, fontStyle: 'bold' },
            7: { cellWidth: 20, fontStyle: 'bold' }
          },
          didParseCell: function(data) {
            if (data.section === 'body' && data.column.index > 0 && data.column.index < 6) {
              const cellValue = data.cell.text[0];
              if (cellValue === 'P') {
                data.cell.styles.textColor = [0, 128, 0];
                data.cell.styles.fontStyle = 'bold';
              } else if (cellValue === 'F') {
                data.cell.styles.textColor = [255, 0, 0];
                data.cell.styles.fontStyle = 'bold';
              } else if (cellValue === 'J') {
                data.cell.styles.textColor = [255, 165, 0];
                data.cell.styles.fontStyle = 'bold';
              }
            }
          },
          margin: { left: 15, right: 15 }
        });
      }

      // Salvar com novo padrão de nome
      const mesAtual = new Date().getMonth() + 1;
      const anoAtual = new Date().getFullYear();
      const nomeCompleto = irmaoData.nome.trim();
      const primeirosDoisNomes = nomeCompleto.split(' ').slice(0, 2).join('_');
      
      doc.save(`Rel_Financas_${primeirosDoisNomes}_${mesAtual}_${anoAtual}.pdf`);
      showSuccess('Relatório gerado com sucesso!');

    } catch (error) {
      console.error('Erro:', error);
      showError('Erro ao gerar relatório: ' + error.message);
    }
  };

  const gerarRelatorioDeTodos = async () => {
    try {
      showSuccess('Gerando relatórios de todos os inadimplentes...');
      
      const lancamentosPendentes = lancamentos.filter(
        l => l.status === 'pendente' && l.origem_tipo === 'Irmao'
      );

      if (lancamentosPendentes.length === 0) {
        showError('Nenhum irmão com pendências financeiras!');
        return;
      }

      // Agrupar por irmão
      const irmaosComPendencias = {};
      lancamentosPendentes.forEach(lanc => {
        const irmaoId = lanc.origem_irmao_id;
        if (!irmaosComPendencias[irmaoId]) {
          irmaosComPendencias[irmaoId] = true;
        }
      });

      const irmaoIds = Object.keys(irmaosComPendencias);
      
      if (irmaoIds.length === 0) {
        showError('Nenhum irmão identificado com pendências!');
        return;
      }

      showSuccess(`Gerando ${irmaoIds.length} relatórios... Por favor, aguarde.`);

      // Gerar PDF para cada irmão
      let sucessos = 0;
      let erros = 0;

      for (const irmaoId of irmaoIds) {
        try {
          await gerarRelatorioIndividual(parseInt(irmaoId));
          sucessos++;
          // Pequeno delay entre PDFs para não sobrecarregar
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`Erro ao gerar PDF do irmão ${irmaoId}:`, error);
          erros++;
        }
      }

      if (erros === 0) {
        showSuccess(`✅ ${sucessos} relatórios gerados com sucesso!`);
      } else {
        showError(`⚠️ ${sucessos} relatórios gerados com sucesso. ${erros} com erro.`);
      }

    } catch (error) {
      console.error('Erro geral:', error);
      showError('Erro ao gerar relatórios em lote: ' + error.message);
    }
  };

  const resumo = calcularResumo();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Carregando dados financeiros...</div>
      </div>
    );
  }

  // Renderizar Tela TV em tela cheia
  if (telaTV) {
    return (
      <FinancasLojaTV 
        filtros={filtros}
        onClose={() => setTelaTV(false)}
      />
    );
  }

  return (
    <div className="space-y-6 px-3 py-3">
      {/* CABEÇALHO COM BOTÕES - TODOS EM UMA LINHA */}
      <div className="flex gap-2 items-center flex-nowrap mt-3">
        {/* Botões de visualização */}
        <button
          onClick={() => setViewMode('lancamentos')}
          className={`px-3 h-[55px] rounded-lg font-medium whitespace-nowrap text-sm ${
            viewMode === 'lancamentos'
              ? 'bg-primary-600 text-white'
              : '  '
          }`}
        >
          📊 Lançam.
        </button>
        <button
          onClick={() => setViewMode('inadimplentes')}
          className={`px-3 h-[55px] rounded-lg font-medium whitespace-nowrap text-sm ${
            viewMode === 'inadimplentes'
              ? 'bg-red-600 text-white'
              : '  '
          }`}
        >
          ⚠️ Inadimp.
        </button>
        
        {/* Espaçador menor */}
        <div className="w-8"></div>
        
        {/* Botão Fechar/Reabrir Mês - só aparece se mês e ano estiver selecionado */}
        {filtros.mes > 0 && filtros.ano > 0 && (
          mesFechadoAtual() ? (
            <button
              onClick={reabrirMes}
              disabled={fechandoMes}
              className="w-28 h-[55px] px-3 text-sm bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-medium transition-colors flex flex-col items-center justify-center leading-tight whitespace-nowrap"
              title={`Reabrir ${meses[filtros.mes - 1]}/${filtros.ano}`}
            >
              <span>🔓 Reabrir</span>
              <span>Mês</span>
            </button>
          ) : (
            <button
              onClick={fecharMes}
              disabled={fechandoMes}
              className="w-28 h-[55px] px-3 text-sm bg-gray-600 text-white rounded-lg font-medium transition-colors flex flex-col items-center justify-center leading-tight whitespace-nowrap" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
              title={`Fechar ${meses[filtros.mes - 1]}/${filtros.ano}`}
            >
              <span>🔒 Fechar</span>
              <span>Mês</span>
            </button>
          )
        )}

        {/* Botões de ação - com dropdowns */}
        
        {/* Menu Lançamentos */}
        <div className="relative">
          <button
            onClick={() => setMenuLancamentosAberto(!menuLancamentosAberto)}
            className="w-28 h-[55px] px-3 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition-colors flex flex-col items-center justify-center leading-tight whitespace-nowrap"
          >
            <span>📝 Lançam.</span>
            <span className="text-xs">▼</span>
          </button>
          
          {menuLancamentosAberto && (
            <div className="absolute top-full left-0 mt-1 rounded-lg z-50 min-w-[150px]" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)",boxShadow:"var(--shadow-xl)"}}>
              <button
                onClick={() => {
                  abrirModalLancamento('receita');
                  setMenuLancamentosAberto(false);
                }}
                className="w-full px-4 py-3 text-left text-sm font-medium border-b"
              >
                💵 Nova Receita
              </button>
              <button
                onClick={() => {
                  abrirModalLancamento('despesa');
                  setMenuLancamentosAberto(false);
                }}
                className="w-full px-4 py-3 text-left text-sm font-medium border-b"
              >
                💳 Nova Despesa
              </button>
              <button
                onClick={() => {
                  setLancamentoParcelar(null);
                  setModalParcelamentoAberto(true);
                  setMenuLancamentosAberto(false);
                }}
                className="w-full px-4 py-3 text-left text-sm font-medium border-b"
              >
                🔀 Parcelar
              </button>
              <button
                onClick={() => {
                  setMostrarModalIrmaos(true);
                  setMenuLancamentosAberto(false);
                }}
                className="w-full px-4 py-3 text-left hover: text-sm font-medium"
              >
                👥 Lanç. em Lote
              </button>
            </div>
          )}
        </div>

        {/* Menu Relatórios */}
        <div className="relative">
          <button
            onClick={() => setMenuRelatoriosAberto(!menuRelatoriosAberto)}
            className="w-28 h-[55px] px-3 text-sm bg-gray-600 text-white rounded-lg font-medium transition-colors flex flex-col items-center justify-center leading-tight whitespace-nowrap"
          >
            <span>📄 Relatórios</span>
            <span className="text-xs">▼</span>
          </button>
          
          {menuRelatoriosAberto && (
            <div className="absolute top-full left-0 mt-1 rounded-lg z-50 min-w-[150px]" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)",boxShadow:"var(--shadow-xl)"}}>
              <button
                onClick={() => {
                  gerarPDF();
                  setMenuRelatoriosAberto(false);
                }}
                className="w-full px-4 py-3 text-left hover: text-sm font-medium border-b"
              >
                📊 Relatório Detalhado
              </button>
              <button
                onClick={() => {
                  gerarPDFResumido();
                  setMenuRelatoriosAberto(false);
                }}
                className="w-full px-4 py-3 text-left hover: text-sm font-medium"
              >
                📋 Fechamento Mensal
              </button>
            </div>
          )}
        </div>

        <button
          onClick={calcularResumoIrmaos}
          className="w-28 h-[55px] px-3 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium flex flex-col items-center justify-center leading-tight whitespace-nowrap"
        >
          <span>💰 Resumo</span>
          <span>dos Irmãos</span>
        </button>
        <button
          onClick={() => setModalAnaliseAberto(true)}
          className="w-28 h-[55px] px-3 text-sm text-white rounded-lg hover: font-medium flex flex-col items-center justify-center leading-tight whitespace-nowrap"
        >
          <span>📊 Análise</span>
          <span>Categorias</span>
        </button>
        
        {/* Botão Apresentação TV */}
        <button
          onClick={() => setTelaTV(true)}
          className="w-28 h-[55px] px-3 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium flex flex-col items-center justify-center leading-tight whitespace-nowrap"
        >
          <span>📺 Tela</span>
          <span>para TV</span>
        </button>
        
        {/* Botão Ocultar/Mostrar Valores */}
        <button
          onClick={() => setShowValues(!showValues)}
          className="w-28 h-[55px] px-3 text-sm bg-gray-700 text-white rounded-lg font-medium flex flex-col items-center justify-center leading-tight whitespace-nowrap"
        >
          <span className="text-xl">{showValues ? '🙈' : '👁️'}</span>
          <span className="text-xs">{showValues ? 'Ocultar' : 'Mostrar'}</span>
        </button>
        
        {/* Badge de Total de Registros - ÚLTIMA POSIÇÃO */}
        <div className="border rounded-lg px-4 h-[55px] flex flex-col justify-center min-w-[100px] whitespace-nowrap" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}>
          <p className="text-[9px] text-blue-600 font-medium leading-tight">Total de Registros</p>
          <p className="text-lg font-bold text-blue-700 leading-tight">{totalRegistros}</p>
        </div>
      </div>

      {/* RESUMO FINANCEIRO - LAYOUT COM TRONCO AO LADO */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* COLUNA ESQUERDA: Cards principais (3/4 da largura) */}
        <div className="lg:col-span-3 space-y-3 flex flex-col justify-between">
          {/* LINHA 1: Resumo Geral */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
            <div className="border rounded-lg p-3 flex flex-col justify-center" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
              <p className="text-xs text-purple-600 font-medium">💰 Saldo Anterior</p>
              <p className={`text-lg font-bold ${saldoAnterior >= 0 ? 'text-purple-700' : 'text-red-700'}`}>
                {showValues ? formatarMoeda(saldoAnterior) : '••••••'}
              </p>
              <p className="text-[10px] mt-0.5">
                {filtros.mes > 0 && filtros.ano > 0 
                  ? `Antes de ${meses[filtros.mes - 1]}/${filtros.ano}`
                  : filtros.ano > 0 
                  ? `Antes de ${filtros.ano}`
                  : 'Período base'}
              </p>
            </div>
            
            <div 
              className="rounded-lg p-3 relative flex flex-col justify-center cursor-pointer transition" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}
              onDoubleClick={abrirDetalhesReceitasPagas}
              title="Clique duplo para ver detalhes"
             style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
              <p className="text-xs text-green-600 font-medium">📈 Receitas Pagas 🖱️</p>
              <p className="text-lg font-bold text-green-700">{showValues ? formatarMoeda(resumo.receitas) : '••••••'}</p>
              <p className="text-[10px] mt-0.5">Total recebido</p>
              <span className="absolute bottom-1 right-2 text-[9px] font-medium">{formatarPeriodo()}</span>
            </div>
            
            <div className="border rounded-lg p-3 relative flex flex-col justify-center" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
              <p className="text-xs text-red-600 font-medium">📉 Despesas Pagas</p>
              <p className="text-lg font-bold text-red-700">{showValues ? formatarMoeda(resumo.despesas) : '••••••'}</p>
              <p className="text-[10px] mt-0.5">Total pago</p>
              <span className="absolute bottom-1 right-2 text-[9px] font-medium">{formatarPeriodo()}</span>
            </div>
            
            <div className="border rounded-lg p-3 relative flex flex-col justify-center" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
              <p className="text-xs text-cyan-600 font-medium">📊 Saldo do Período</p>
              <p className={`text-lg font-bold ${resumo.saldoPeriodo >= 0 ? 'text-cyan-700' : 'text-red-700'}`}>
                {showValues ? formatarMoeda(resumo.saldoPeriodo) : '••••••'}
              </p>
              <p className="text-[10px] mt-0.5">Receitas - Despesas</p>
              <span className="absolute bottom-1 right-2 text-[9px] font-medium">{formatarPeriodo()}</span>
            </div>
          </div>

          {/* LINHA 2: Detalhamento */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 flex-1">
          <div className="border-2 rounded-lg p-3" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <p className="text-xs text-sky-600 font-medium">🏦 Saldo Bancário</p>
            <p className={`text-lg font-bold ${resumo.saldoBancario >= 0 ? 'text-sky-700' : 'text-red-700'}`}>
              {showValues ? formatarMoeda(resumo.saldoBancario) : '••••••'}
            </p>
            <p className="text-[10px] mt-0.5">
              PIX, Transf., Cartão
            </p>
          </div>

          <div className="border-2 border-emerald-300 rounded-lg p-3" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <p className="text-xs text-emerald-600 font-medium">💵 Caixa Físico</p>
            <p className="text-lg font-bold text-emerald-700">
              {showValues ? formatarMoeda(resumo.caixaFisico) : '••••••'}
            </p>
            <p className="text-[10px] mt-0.5 mb-2">
              Dinheiro não depositado
            </p>
            {resumo.caixaFisico > 0 && (
              <button
                onClick={() => setModalSangriaAberto(true)}
                className="w-full px-2 py-1 bg-emerald-600 text-white text-[10px] rounded hover:bg-emerald-700 font-medium"
              >
                💰 Fazer Sangria
              </button>
            )}
          </div>

          <div className="border-2 rounded-lg p-3 col-span-2 md:col-span-1" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <p className="text-xs text-blue-600 font-medium">💎 Saldo Total</p>
            <p className={`text-lg font-bold ${resumo.saldoTotal >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
              {showValues ? formatarMoeda(resumo.saldoTotal) : "••••••"}
            </p>
            <p className="text-[10px] mt-0.5">
              Bancário + Caixa
            </p>
          </div>

          <div className="border border-yellow-200 rounded-lg p-3 relative" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <p className="text-xs text-yellow-600 font-medium">⏳ A Receber</p>
            <p className="text-lg font-bold text-yellow-700">{showValues ? formatarMoeda(resumo.receitasPendentes) : "••••••"}</p>
            <p className="text-[10px] mt-0.5">Pendentes</p>
            <span className="absolute bottom-1 right-2 text-[9px] font-medium">{formatarPeriodo()}</span>
          </div>
          
          <div 
            className="rounded-lg p-3 relative cursor-pointer transition" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}
            onDoubleClick={() => setModalDespesasPendentesAberto(true)}
            title="Clique duplo para ver detalhes"
          >
            <p className="text-xs font-medium">⏰ A Pagar 🖱️</p>
            <p className="text-lg font-bold">{showValues ? formatarMoeda(resumo.despesasPendentes) : "••••••"}</p>
            <p className="text-[10px] mt-0.5">Pendentes</p>
            <span className="absolute bottom-1 right-2 text-[9px] font-medium">{formatarPeriodo()}</span>
          </div>
        </div>
      </div>

      {/* COLUNA DIREITA: Tronco de Solidariedade (1/4 da largura) */}
      <div className="lg:col-span-1">
        <div className="bg-gradient-to-br border-2 rounded-lg p-4 h-full flex flex-col" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
          {/* Cabeçalho */}
          <div className="flex items-center gap-3 mb-4 pb-3 border-b">
            <span className="text-3xl">💰</span>
            <div className="flex-1 text-center">
              <p className="text-sm font-bold leading-tight">Tronco de Solidariedade</p>
              <p className="text-xs mt-0.5">Saldo acumulado</p>
              <p className={`text-2xl font-bold mt-1 ${troncoTotalGlobal.total >= 0 ? '' : 'text-red-700'}`}>
                {showValues ? formatarMoeda(troncoTotalGlobal.total) : '••••••'}
              </p>
            </div>
          </div>

          <div className="space-y-3 flex-1 flex flex-col justify-center">
            {/* Card Banco */}
            <div className="/70 rounded-lg p-3 border" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-2">
                  <span className="text-xl">🏦</span>
                  <div>
                    <p className="text-sm font-semibold">Banco</p>
                    <p className="text-[10px] leading-tight">PIX, Transf., Cartão</p>
                  </div>
                </div>
                <p className={`text-xl font-bold ${troncoTotalGlobal.banco >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                  {showValues ? formatarMoeda(troncoTotalGlobal.banco) : '••••••'}
                </p>
              </div>
            </div>

            {/* Card Espécie */}
            <div className="/70 rounded-lg p-3 border" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-start gap-2">
                  <span className="text-xl">💵</span>
                  <div>
                    <p className="text-sm font-semibold">Espécie</p>
                    <p className="text-[10px] leading-tight">Dinheiro físico</p>
                  </div>
                </div>
                <p className={`text-xl font-bold ${troncoTotalGlobal.especie >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {showValues ? formatarMoeda(troncoTotalGlobal.especie) : '••••••'}
                </p>
              </div>
              {troncoTotalGlobal.especie > 0 && (
                <button
                  onClick={() => setModalSangriaTroncoAberto(true)}
                  className="w-full px-2 py-1.5 text-white text-[11px] rounded hover: font-semibold transition-colors"
                >
                  🔥 Fazer Sangria
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

      {/* BANNER MÊS FECHADO */}
      {mesFechadoAtual() && (
        <div className="border-l-4 border-yellow-500 rounded-lg p-4 flex items-center justify-between" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔒</span>
            <div>
              <p className="font-semibold text-yellow-800">
                {meses[filtros.mes - 1]}/{filtros.ano} está fechado
              </p>
              <p className="text-sm text-yellow-700">
                Novos lançamentos neste mês estão bloqueados.
                {mesesFechados.find(m => m.mes === filtros.mes && m.ano === filtros.ano)?.fechado_por && (
                  <span> Fechado por: {mesesFechados.find(m => m.mes === filtros.mes && m.ano === filtros.ano).fechado_por}</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={reabrirMes}
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm font-medium"
          >
            🔓 Reabrir Mês
          </button>
        </div>
      )}

      {/* FILTROS */}
      <div className="rounded-lg shadow p-4" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {/* Filtro Mês */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Mês</label>
            <select
              value={filtros.mes}
              onChange={(e) => setFiltros({ ...filtros, mes: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
            >
              <option value={0}>Todos</option>
              {meses.map((mes, idx) => (
                <option key={idx} value={idx + 1}>{mes}</option>
              ))}
            </select>
            {/* Navegação mês */}
            {filtros.mes > 0 && (
              <div className="flex gap-1 mt-1">
                <button
                  onClick={() => {
                    if (filtros.mes === 1) {
                      setFiltros({ ...filtros, mes: 12, ano: filtros.ano > 0 ? filtros.ano - 1 : filtros.ano });
                    } else {
                      setFiltros({ ...filtros, mes: filtros.mes - 1 });
                    }
                  }}
                  className="flex-1 py-1 hover: rounded text-sm font-bold transition-colors"
                  title="Mês anterior"
                >‹</button>
                <button
                  onClick={() => {
                    if (filtros.mes === 12) {
                      setFiltros({ ...filtros, mes: 1, ano: filtros.ano > 0 ? filtros.ano + 1 : filtros.ano });
                    } else {
                      setFiltros({ ...filtros, mes: filtros.mes + 1 });
                    }
                  }}
                  className="flex-1 py-1 hover: rounded text-sm font-bold transition-colors"
                  title="Próximo mês"
                >›</button>
              </div>
            )}
          </div>

          {/* Filtro Ano */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Ano</label>
            <select
              value={filtros.ano}
              onChange={(e) => setFiltros({ ...filtros, ano: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
            >
              <option value={0}>Todos</option>
              {anosDisponiveis.map(ano => (
                <option key={ano} value={ano}>{ano}</option>
              ))}
            </select>
            {/* Navegação ano */}
            {filtros.ano > 0 && (
              <div className="flex gap-1 mt-1">
                <button
                  onClick={() => setFiltros({ ...filtros, ano: filtros.ano - 1 })}
                  className="flex-1 py-1 hover: rounded text-sm font-bold transition-colors"
                  title="Ano anterior"
                >‹</button>
                <button
                  onClick={() => setFiltros({ ...filtros, ano: filtros.ano + 1 })}
                  className="flex-1 py-1 hover: rounded text-sm font-bold transition-colors"
                  title="Próximo ano"
                >›</button>
              </div>
            )}
          </div>

          {/* Filtro Tipo */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Tipo</label>
            <select
              value={filtros.tipo}
              onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
            >
              <option value="">Todos</option>
              <option value="receita">Receitas</option>
              <option value="despesa">Despesas</option>
            </select>
          </div>

          {/* Filtro Categoria */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Categoria</label>
            <select
              value={filtros.categoria}
              onChange={(e) => setFiltros({ ...filtros, categoria: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
            >
              <option value="">Todas</option>
              {categorias.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.nome}</option>
              ))}
            </select>
          </div>

          {/* Filtro Status */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Status</label>
            <select
              value={filtros.status}
              onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
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
            <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Origem</label>
            <select
              value={filtros.origem_tipo}
              onChange={(e) => {
                setFiltros({ ...filtros, origem_tipo: e.target.value, origem_irmao_id: '' });
              }}
              className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
            >
              <option value="">Todas</option>
              <option value="Loja">🏛️ Loja</option>
              <option value="Irmao">👤 Irmãos</option>
            </select>
          </div>

          {/* Filtro por Irmão (só aparece se origem = Irmão) */}
          {filtros.origem_tipo === 'Irmao' && (
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Irmão</label>
              <select
                value={filtros.origem_irmao_id}
                onChange={(e) => setFiltros({ ...filtros, origem_irmao_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
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
      {/* MODAL DE LANÇAMENTO */}
      <ModalLancamento
        aberto={modalLancamentoAberto}
        onFechar={() => {
          setModalLancamentoAberto(false);
          limparFormulario();
        }}
        onSalvar={handleSubmit}
        tipo={tipoLancamento}
        formData={formLancamento}
        setFormData={setFormLancamento}
        categorias={categorias}
        irmaos={irmaos}
        editando={editando}
      />


      {/* MODAL LANÇAMENTO EM LOTE */}
      {mostrarModalIrmaos && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <div className="sticky top-0 border-b px-6 py-4">
              <h3 className="text-xl font-bold" style={{color:"var(--color-text)"}}>👥 Lançamento em Lote para Irmãos</h3>
            </div>
            
            <form onSubmit={handleLancamentoIrmaos} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                    Categoria (Receita) *
                  </label>
                  <select
                    value={lancamentoIrmaos.categoria_id}
                    onChange={(e) => setLancamentoIrmaos({ ...lancamentoIrmaos, categoria_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                    required
                  >
                    <option value="">Selecione...</option>
                    {renderizarOpcoesCategoria('receita')}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <div className="border rounded-lg p-4" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
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
                        className="w-5 h-5 text-blue-600 rounded"
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
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                    Valor por Irmão (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={lancamentoIrmaos.valor}
                    onChange={(e) => setLancamentoIrmaos({ ...lancamentoIrmaos, valor: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                    Descrição Base *
                  </label>
                  <input
                    type="text"
                    value={lancamentoIrmaos.descricao}
                    onChange={(e) => setLancamentoIrmaos({ ...lancamentoIrmaos, descricao: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                    placeholder="Ex: Mensalidade - Janeiro/2024"
                    required
                  />
                  <p className="text-xs mt-1">
                    O nome do irmão será adicionado automaticamente no final
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                    Data Lançamento *
                  </label>
                  <input
                    type="date"
                    value={lancamentoIrmaos.data_lancamento}
                    onChange={(e) => setLancamentoIrmaos({ ...lancamentoIrmaos, data_lancamento: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                    Data Vencimento *
                  </label>
                  <input
                    type="date"
                    value={lancamentoIrmaos.data_vencimento}
                    onChange={(e) => setLancamentoIrmaos({ ...lancamentoIrmaos, data_vencimento: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                    Tipo de Pagamento
                  </label>
                  <select
                    value={lancamentoIrmaos.tipo_pagamento}
                    onChange={(e) => setLancamentoIrmaos({ ...lancamentoIrmaos, tipo_pagamento: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                  >
                    {tiposPagamento.map(tipo => (
                      <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium" style={{color:"var(--color-text-muted)"}}>
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
                <div className="border rounded-lg p-4 max-h-60 overflow-y-auto" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                  {irmaos.length === 0 ? (
                    <div className="text-center py-8">
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
                        <label key={irmao.id} className="flex items-center cursor-pointer hover: p-2 rounded">
                          <input
                            type="checkbox"
                            checked={lancamentoIrmaos.irmaos_selecionados.includes(irmao.id)}
                            onChange={() => toggleIrmaoSelecionado(irmao.id)}
                            className="w-4 h-4 text-green-600 focus:ring-green-500 rounded"
                          />
                          <span className="ml-2 text-sm">
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

              <div className="border rounded-lg p-4" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
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
                  className="px-6 py-2 bg-gray-300 rounded-lg"
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
          <div className="rounded-lg max-w-md w-full">
            <div className="bg-green-600 text-white px-6 py-4 rounded-t-lg">
              <h3 className="text-xl font-bold" style={{color:"var(--color-text)"}}>💰 Quitar Lançamento</h3>
            </div>
            
            <form onSubmit={handleQuitacao} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Data de Pagamento *
                </label>
                <input
                  type="date"
                  value={quitacaoForm.data_pagamento}
                  onChange={(e) => setQuitacaoForm({ ...quitacaoForm, data_pagamento: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-green-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Tipo de Pagamento *
                </label>
                <select
                  value={quitacaoForm.tipo_pagamento}
                  onChange={(e) => setQuitacaoForm({ ...quitacaoForm, tipo_pagamento: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-green-500"
                >
                  {tiposPagamento.map(tipo => (
                    <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Observações
                </label>
                <textarea
                  value={quitacaoForm.observacoes}
                  onChange={(e) => setQuitacaoForm({ ...quitacaoForm, observacoes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-green-500"
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
                  className="px-6 py-2 bg-gray-300 rounded-lg"
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
          <div className="rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <div className="bg-green-600 text-white px-6 py-4 rounded-t-lg">
              <h3 className="text-xl font-bold" style={{color:"var(--color-text)"}}>💰 Quitação em Lote</h3>
              <p className="text-sm text-green-100 mt-1">
                {quitacaoLote.lancamentos_selecionados.length} lançamentos selecionados
              </p>
            </div>
            
            <form onSubmit={handleQuitacaoLote} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                    Data de Pagamento *
                  </label>
                  <input
                    type="date"
                    value={quitacaoLote.data_pagamento}
                    onChange={(e) => setQuitacaoLote({ ...quitacaoLote, data_pagamento: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-green-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                    Tipo de Pagamento *
                  </label>
                  <select
                    value={quitacaoLote.tipo_pagamento}
                    onChange={(e) => setQuitacaoLote({ ...quitacaoLote, tipo_pagamento: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-green-500"
                  >
                    {tiposPagamento.map(tipo => (
                      <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium" style={{color:"var(--color-text-muted)"}}>
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
                <div className="border rounded-lg p-4 max-h-96 overflow-y-auto" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                  <div className="space-y-2">
                    {lancamentos
                      .filter(l => l.status === 'pendente')
                      .map(lanc => (
                        <label 
                          key={lanc.id} 
                          className="flex items-start cursor-pointer hover: p-3 rounded border"
                        >
                          <input
                            type="checkbox"
                            checked={quitacaoLote.lancamentos_selecionados.includes(lanc.id)}
                            onChange={() => toggleLancamentoParaQuitacao(lanc.id)}
                            className="mt-1 w-4 h-4 text-green-600 focus:ring-green-500 rounded"
                          />
                          <div className="ml-3 flex-1">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium">{lanc.descricao}</p>
                                <p className="text-sm">
                                  {lanc.categorias_financeiras?.nome} • 
                                  Venc: {formatarDataBR(lanc.data_vencimento)}
                                </p>
                              </div>
                              <p className="text-lg font-bold text-green-600">
                                {formatarMoeda(parseFloat(lanc.valor))}
                              </p>
                            </div>
                          </div>
                        </label>
                      ))}
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                <p className="text-sm text-green-800">
                  <strong>Total a quitar:</strong> {formatarMoeda(
                    lancamentos
                      .filter(l => quitacaoLote.lancamentos_selecionados.includes(l.id))
                      .reduce((sum, l) => sum + parseFloat(l.valor), 0)
                  )}
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
                  className="px-6 py-2 bg-gray-300 rounded-lg"
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
        <div className="rounded-lg shadow p-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-xl font-bold text-red-600" style={{color:"var(--color-text)"}}>⚠️ Irmãos com Pendências Financeiras</h3>
              <p className="text-sm">Receitas pendentes (irmão deve) e Despesas pendentes (loja deve)</p>
            </div>
            {lancamentos.filter(l => l.status === 'pendente' && l.origem_tipo === 'Irmao').length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => gerarRelatorioDeTodos()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
                >
                  📄 Gerar PDFs de Todos
                </button>
                <button
                  onClick={() => setMostrarModalQuitacaoLote(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                >
                  💰 Quitar em Lote
                </button>
              </div>
            )}
          </div>
          
          {lancamentos.filter(l => l.status === 'pendente' && l.origem_tipo === 'Irmao').length === 0 ? (
            <div className="text-center py-12">
              ✅ Nenhuma pendência financeira com irmãos neste período!
            </div>
          ) : (
            <div className="space-y-4">
              {(() => {
                // Agrupar lançamentos por irmão (incluindo receitas E despesas)
                const lancamentosPorIrmao = lancamentos
                  .filter(l => l.status === 'pendente' && l.origem_tipo === 'Irmao')
                  .reduce((acc, lanc) => {
                    const irmaoId = lanc.origem_irmao_id || 'sem_irmao';
                    const irmaoNome = lanc.irmaos?.nome || lanc.descricao || 'Não identificado';
                    
                    if (!acc[irmaoId]) {
                      acc[irmaoId] = {
                        irmaoId,
                        irmaoNome,
                        lancamentos: []
                      };
                    }
                    
                    acc[irmaoId].lancamentos.push(lanc);
                    return acc;
                  }, {});

                // Converter para array e ordenar por nome
                const irmaosComLancamentos = Object.values(lancamentosPorIrmao)
                  .sort((a, b) => a.irmaoNome.localeCompare(b.irmaoNome));

                return irmaosComLancamentos.map((irmaoData) => {
                  // Calcular totais separados
                  const receitas = irmaoData.lancamentos.filter(l => l.categorias_financeiras?.tipo === 'receita');
                  const despesas = irmaoData.lancamentos.filter(l => l.categorias_financeiras?.tipo === 'despesa');
                  
                  const totalReceitas = receitas.reduce((sum, l) => sum + parseFloat(l.valor || 0), 0);
                  const totalDespesas = despesas.reduce((sum, l) => sum + parseFloat(l.valor || 0), 0);
                  const saldoLiquido = totalReceitas - totalDespesas;
                  
                  const quantidadeLancamentos = irmaoData.lancamentos.length;
                  
                  // Definir cor do cabeçalho baseado no saldo
                  const corCabecalho = saldoLiquido > 0 ? 'bg-red-400' : saldoLiquido < 0 ? 'bg-blue-400' : 'bg-gray-500';

                  return (
                    <div key={irmaoData.irmaoId} className="border-2 rounded-lg overflow-hidden" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                      {/* CABEÇALHO DO IRMÃO */}
                      <div className={`${corCabecalho} text-white p-4`}>
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                            <h4 className="text-xl font-bold flex items-center gap-2" style={{color:"var(--color-text)"}}>
                              👤 {irmaoData.irmaoNome}
                            </h4>
                            <p className="text-white text-opacity-90 text-sm mt-1">
                              {quantidadeLancamentos} {quantidadeLancamentos === 1 ? 'lançamento pendente' : 'lançamentos pendentes'}
                            </p>
                            {/* Botão Compensar - aparece se houver débitos E créditos */}
                            {totalReceitas > 0 && totalDespesas > 0 && (
                              <button
                                onClick={() => abrirModalCompensacao(irmaoData.irmaoId)}
                                className="mt-2 px-3 py-1 bg-opacity-20 hover:bg-opacity-30 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
                              >
                                🔄 Compensar Valores
                              </button>
                            )}
                          </div>
                          <div className="text-right">
                            {totalReceitas > 0 && (
                              <div className="mb-1">
                                <p className="text-xs text-white text-opacity-80">Irmão deve:</p>
                                <p className="text-xl font-bold">{formatarMoeda(totalReceitas)}</p>
                              </div>
                            )}
                            {totalDespesas > 0 && (
                              <div className="mb-1">
                                <p className="text-xs text-white text-opacity-80">Loja deve:</p>
                                <p className="text-xl font-bold">{formatarMoeda(totalDespesas)}</p>
                              </div>
                            )}
                            {totalReceitas > 0 && totalDespesas > 0 && (
                              <div className="mt-2 pt-2 border-t border-white border-opacity-30">
                                <p className="text-xs text-white text-opacity-80">Saldo:</p>
                                <p className="text-2xl font-bold">
                                  {formatarMoeda(Math.abs(saldoLiquido))}
                                </p>
                                <p className="text-xs">
                                  {saldoLiquido > 0 ? '(Irmão deve)' : saldoLiquido < 0 ? '(Loja deve)' : '(Quitado)'}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* LISTA DE LANÇAMENTOS DO IRMÃO */}
                      <div>
                        {irmaoData.lancamentos.map((lanc, index) => {
                          const ehReceita = lanc.categorias_financeiras?.tipo === 'receita';
                          
                          return (
                            <div key={lanc.id} className="p-4 hover: transition-colors">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  {/* Badges de Categoria */}
                                  <div className="flex gap-2 mb-2">
                                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                      ehReceita ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                      {ehReceita ? '📈 Receita' : '📉 Despesa'}
                                    </span>
                                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                                      {lanc.categorias_financeiras?.nome}
                                    </span>
                                    {lanc.eh_parcelado && (
                                      <span className="text-xs px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full font-medium">
                                        📋 Parcela {lanc.parcela_numero}/{lanc.parcela_total}
                                      </span>
                                    )}
                                    {lanc.eh_mensalidade && (
                                      <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded-full font-medium">
                                        📅 Mensalidade
                                      </span>
                                    )}
                                  </div>
                                  
                                  {/* Descrição */}
                                  <p className="font-medium mb-1">{lanc.descricao}</p>
                                  
                                  {/* Informações detalhadas - DATAS NA MESMA LINHA */}
                                  <div className="text-sm">
                                    <p className="mb-1">
                                      <span className="font-medium">Lançamento:</span> {formatarDataBR(lanc.data_pagamento)}
                                      <span className="mx-2">•</span>
                                      <span className={`font-medium ${ehReceita ? 'text-red-600' : 'text-blue-600'}`}>
                                        ⏰ Vencimento:
                                      </span> {formatarDataBR(lanc.data_vencimento)}
                                    </p>
                                    {lanc.observacoes && (
                                      <p className="italic">
                                        💬 {lanc.observacoes}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="text-right ml-4">
                                  <p className={`text-2xl font-bold mb-3 ${
                                    ehReceita ? 'text-red-600' : 'text-blue-600'
                                  }`}>
                                    {formatarMoeda(parseFloat(lanc.valor))}
                                  </p>
                                  <button
                                    onClick={() => abrirModalQuitacao(lanc)}
                                    className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 font-medium transition-colors"
                                  >
                                    💰 Quitar
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* RODAPÉ COM AÇÕES GERAIS DO IRMÃO */}
                      <div className="p-4 border-t">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => gerarRelatorioIndividual(irmaoData.irmaoId)}
                            className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 font-medium transition-colors"
                          >
                            📄 Gerar PDF Individual
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      )}

      {/* LISTA DE LANÇAMENTOS */}
      {viewMode === 'lancamentos' && (
        <div className="rounded-lg shadow" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
          <div className="px-6 py-4 border-b flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-semibold" style={{color:"var(--color-text)"}}>
                Lançamentos de {meses[filtros.mes - 1]}/{filtros.ano}
              </h3>
              <div className="flex items-center gap-2">
                <label className="text-sm" style={{color:"var(--color-text-muted)"}}>Mostrar:</label>
                <select
                  value={limiteRegistros}
                  onChange={(e) => setLimiteRegistros(Number(e.target.value))}
                  className="px-3 py-1 border rounded-lg text-sm"
                >
                  <option value={20}>20</option>
                  <option value={30}>30</option>
                  <option value={40}>40</option>
                  <option value={50}>50</option>
                  <option value={9999}>Todos</option>
                </select>
                <span className="text-sm">registros</span>
              </div>
            </div>
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
            <table className="min-w-full">
              <thead style={{background:"var(--color-surface-2)"}}>
                <tr>
                  <th className="px-2 py-3 text-left text-xs font-medium uppercase w-24" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Competência</th>
                  <th className="px-2 py-3 text-left text-xs font-medium uppercase w-24" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Lançamento</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Categoria</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Descrição</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Origem</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase w-28" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Valor</th>
                  <th className="px-2 py-3 text-left text-xs font-medium uppercase w-20" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Pgto</th>
                  <th className="px-2 py-3 text-left text-xs font-medium uppercase w-24" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase w-44" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {lancamentos.slice(0, limiteRegistros).map((lanc) => (
                  <tr key={lanc.id} style={{borderBottom:"1px solid var(--color-border)"}}>
                    {/* COMPETÊNCIA: Mostra data relevante (pagamento se pago, vencimento se pendente) */}
                    <td className="px-2 py-3 whitespace-nowrap text-sm w-24" style={{color:"var(--color-text)"}}>
                      <div className={lanc.status === 'pago' ? 'text-green-700 font-medium' : ''}>
                        {formatarDataBR(lanc.status === 'pago' ? lanc.data_pagamento : lanc.data_vencimento)}
                      </div>
                      <div className="text-xs">
                        {lanc.status === 'pago' ? '💰 Pgto' : '📅 Venc'}
                      </div>
                    </td>
                    {/* DATA DE LANÇAMENTO: Apenas referência */}
                    <td className="px-2 py-3 whitespace-nowrap text-xs w-24" style={{color:"var(--color-text)"}}>
                      {formatarDataBR(lanc.data_lancamento)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{color:"var(--color-text)"}}>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        lanc.categorias_financeiras?.tipo === 'receita'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {lanc.categorias_financeiras?.tipo === 'receita' ? '📈 Receita' : '📉 Despesa'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm" style={{color:"var(--color-text)"}}>
                      {lanc.categorias_financeiras?.nome}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{color:"var(--color-text)"}}>
                      {lanc.descricao}
                    </td>
                    {/* NOVA COLUNA: Origem */}
                    <td className="px-4 py-3 whitespace-nowrap text-sm" style={{color:"var(--color-text)"}}>
                      {lanc.origem_tipo === 'Loja' ? (
                        <div className="flex items-center gap-1">
                          <span className="text-blue-600">🏛️</span>
                          <span className="font-medium">Loja</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="text-purple-600">👤</span>
                          <span className="font-medium">
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
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium w-28" style={{color:"var(--color-text)"}}>
                      <div>
                        <span className={lanc.categorias_financeiras?.tipo === 'receita' ? 'text-green-600' : 'text-red-600'}>
                          {formatarMoeda(parseFloat(lanc.valor))}
                        </span>
                        {lanc.tem_pagamento_parcial && (
                          <div className="text-xs mt-1">
                            <div>Original: {formatarMoeda(lanc.valor_original)}</div>
                            <div className="text-green-600">Pago: {formatarMoeda(lanc.total_pago_parcial)}</div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-xs w-20" style={{color:"var(--color-text)"}}>
                      {lanc.tipo_pagamento}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap w-24" style={{color:"var(--color-text)"}}>
                      {(() => {
                        const badge = obterBadgeStatus(lanc);
                        return (
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${badge.cor}`}>
                            {badge.icone} {badge.texto}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-sm w-44" style={{color:"var(--color-text)"}}>
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
                              // Verificar se tem pagamentos parciais
                              const temFilhos = lancamentos.some(l => 
                                l.lancamento_principal_id === lanc.id && l.eh_pagamento_parcial
                              );
                              
                              if (temFilhos) {
                                showError('Este lançamento tem pagamentos parciais. Use "💰" para pagamento parcial.');
                                return;
                              }
                              
                              setLancamentoParcelar(lanc);
                              setModalParcelamentoAberto(true);
                            }}
                            disabled={lancamentos.some(l => l.lancamento_principal_id === lanc.id && l.eh_pagamento_parcial)}
                            className={`text-lg ${
                              lancamentos.some(l => l.lancamento_principal_id === lanc.id && l.eh_pagamento_parcial)
                                ? ' cursor-not-allowed'
                                : 'text-indigo-600 hover:text-indigo-900'
                            }`}
                            title={
                              lancamentos.some(l => l.lancamento_principal_id === lanc.id && l.eh_pagamento_parcial)
                                ? 'Lançamento com pagamento parcial - use 💰'
                                : 'Parcelar este lançamento'
                            }
                          >
                            🔀
                          </button>
                        )}
                        
                        {/* Botão Pagamento Parcial */}
                        {lanc.status === 'pendente' && !lanc.eh_parcelado && !lanc.eh_pagamento_parcial && (
                          <button
                            onClick={() => abrirModalPagamentoParcial(lanc)}
                            className="hover: text-lg"
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
                          disabled={verificarMesBloqueado(lanc.data_pagamento || lanc.data_lancamento || lanc.data_vencimento)}
                          className={`text-lg ${verificarMesBloqueado(lanc.data_pagamento || lanc.data_lancamento || lanc.data_vencimento) ? 'text-gray-300 cursor-not-allowed' : 'text-blue-600 hover:text-blue-900'}`}
                          title={verificarMesBloqueado(lanc.data_pagamento || lanc.data_lancamento || lanc.data_vencimento) ? 'Mês fechado' : 'Editar'}
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => excluirLancamento(lanc.id)}
                          disabled={verificarMesBloqueado(lanc.data_pagamento || lanc.data_lancamento || lanc.data_vencimento)}
                          className={`text-lg ${verificarMesBloqueado(lanc.data_pagamento || lanc.data_lancamento || lanc.data_vencimento) ? 'text-gray-300 cursor-not-allowed' : 'text-red-600 hover:text-red-900'}`}
                          title={verificarMesBloqueado(lanc.data_pagamento || lanc.data_lancamento || lanc.data_vencimento) ? 'Mês fechado' : 'Excluir'}
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
              <div className="text-center py-12">
                Nenhum lançamento encontrado
              </div>
            )}
            {lancamentos.length > limiteRegistros && (
              <div className="text-center py-4 text-sm border-t">
                Exibindo {limiteRegistros} de {lancamentos.length} registros
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

      {/* Modal Despesas Pendentes */}
      {/* MODAL DETALHES RECEITAS PAGAS */}
      {modalReceitasPagasAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-lg max-w-2xl w-full">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-4 rounded-t-lg">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-bold" style={{color:"var(--color-text)"}}>💵 Receitas Pagas - Detalhamento</h3>
                  <p className="text-sm text-green-100">Distribuição por forma de pagamento</p>
                </div>
                <button
                  onClick={() => setModalReceitasPagasAberto(false)}
                  className="text-white hover:opacity-80 text-4xl leading-none"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Corpo */}
            <div className="p-6 space-y-4">
              <div className="p-6 rounded-xl border-2" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                <p className="text-xl mb-2">🏦 Recebido em Conta</p>
                <p className="text-4xl font-bold text-blue-600">{formatarMoeda(detalhesReceitasPagas.conta)}</p>
                <p className="text-sm mt-1">PIX, Transferência, Cartão</p>
              </div>
              
              <div className="p-6 rounded-xl border-2" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                <p className="text-xl mb-2">💵 Recebido em Dinheiro</p>
                <p className="text-4xl font-bold text-green-600">{formatarMoeda(detalhesReceitasPagas.dinheiro)}</p>
                <p className="text-sm mt-1">Dinheiro físico</p>
              </div>
              
              <div className="p-6 rounded-xl border-2" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                <p className="text-xl mb-2">💰 Total Recebido</p>
                <p className="text-4xl font-bold text-purple-600">
                  {formatarMoeda(detalhesReceitasPagas.conta + detalhesReceitasPagas.dinheiro)}
                </p>
                <p className="text-sm mt-1">Soma de todas as receitas pagas</p>
              </div>

              <button
                onClick={() => setModalReceitasPagasAberto(false)}
                className="w-full bg-gray-600 text-white py-3 rounded-lg text-lg font-bold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DESPESAS PENDENTES */}
      {modalDespesasPendentesAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="rounded-lg max-w-6xl w-full my-8 max-h-[90vh] overflow-hidden flex flex-col" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white px-6 py-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-bold" style={{color:"var(--color-text)"}}>⏰ Despesas Pendentes</h3>
                  <p className="text-sm">Valores a pagar e a compensar</p>
                </div>
                <button
                  onClick={() => setModalDespesasPendentesAberto(false)}
                  className="text-white hover:opacity-80 text-4xl leading-none"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Corpo */}
            <div className="p-6 overflow-y-auto flex-1">
              {/* Resumo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="border-2 border-orange-300 rounded-lg p-4" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                  <p className="text-sm font-medium mb-1">⏰ Total a Pagar</p>
                  <p className="text-3xl font-bold">{showValues ? formatarMoeda(resumo.despesasPendentes) : "••••••"}</p>
                  <p className="text-xs mt-1">Despesas pendentes do período</p>
                </div>
                
                <div className="border-2 rounded-lg p-4" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                  <p className="text-sm text-purple-600 font-medium mb-1">🔄 A Compensar</p>
                  <p className="text-3xl font-bold text-purple-700">
                    {formatarMoeda(
                      lancamentos
                        .filter(l => l.categorias_financeiras?.tipo === 'despesa' && l.status === 'pendente' && l.origem_tipo === 'Irmao')
                        .reduce((sum, l) => sum + parseFloat(l.valor || 0), 0)
                    )}
                  </p>
                  <p className="text-xs mt-1">Débitos de irmãos pendentes</p>
                </div>
              </div>

              {/* Tabela de Despesas */}
              <div className="border-2 rounded-lg overflow-hidden" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b-2" style={{background:"var(--color-surface-2)"}}>
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-bold" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Data Venc.</th>
                        <th className="px-4 py-3 text-left text-sm font-bold" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Descrição</th>
                        <th className="px-4 py-3 text-left text-sm font-bold" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Categoria</th>
                        <th className="px-4 py-3 text-left text-sm font-bold" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Origem</th>
                        <th className="px-4 py-3 text-right text-sm font-bold" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Valor</th>
                        <th className="px-4 py-3 text-center text-sm font-bold" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lancamentos
                        .filter(l => l.categorias_financeiras?.tipo === 'despesa' && l.status === 'pendente')
                        .sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento))
                        .map((lanc, index) => {
                          const vencido = verificarVencido(lanc.data_vencimento);
                          const diasAtraso = calcularDiasAtraso(lanc.data_vencimento);
                          
                          return (
                            <tr key={lanc.id} style={{borderBottom:"1px solid var(--color-border)"}}className={index % 2 === 0 ? '' : ''}>
                              <td className="px-4 py-3 text-sm" style={{color:"var(--color-text)"}}>
                                {formatarDataBR(lanc.data_vencimento)}
                                {vencido && (
                                  <span className="block text-xs text-red-600 font-medium">
                                    {diasAtraso} dia{diasAtraso !== 1 ? 's' : ''} atraso
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm" style={{color:"var(--color-text)"}}>
                                <p className="font-medium">{lanc.descricao}</p>
                                {lanc.observacoes && (
                                  <p className="text-xs mt-0.5">{lanc.observacoes}</p>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm" style={{color:"var(--color-text)"}}>
                                <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                                  {lanc.categorias_financeiras?.nome}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm" style={{color:"var(--color-text)"}}>
                                {lanc.origem_tipo === 'Irmao' ? (
                                  <div>
                                    <p className="font-medium text-purple-700">
                                      {irmaos.find(i => i.id === lanc.origem_irmao_id)?.nome || 'Irmão'}
                                    </p>
                                    <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-800 rounded">
                                      A Compensar
                                    </span>
                                  </div>
                                ) : (
                                  <span className="px-2 py-1 rounded text-xs font-medium">
                                    Loja
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right" style={{color:"var(--color-text)"}}>
                                <p className="text-lg font-bold text-red-600">
                                  {formatarMoeda(lanc.valor)}
                                </p>
                              </td>
                              <td className="px-4 py-3 text-center" style={{color:"var(--color-text)"}}>
                                {vencido ? (
                                  <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-bold">
                                    ⚠️ VENCIDO
                                  </span>
                                ) : (
                                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-bold">
                                    ⏳ PENDENTE
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                    <tfoot className="border-t-2">
                      <tr>
                        <td colSpan="4" className="px-4 py-3 text-right font-bold" style={{color:"var(--color-text)"}}>
                          TOTAL PENDENTE:
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-red-700 text-xl" style={{color:"var(--color-text)"}}>
                          {showValues ? formatarMoeda(resumo.despesasPendentes) : "••••••"}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Informações */}
              <div className="mt-6 border-l-4 p-4 rounded">
                <div className="flex">
                  <span className="text-2xl mr-3">💡</span>
                  <div>
                    <p className="font-semibold text-blue-800 mb-1">Informações</p>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• <strong>Despesas da Loja:</strong> Valores que a loja deve pagar a fornecedores/terceiros</li>
                      <li>• <strong>A Compensar:</strong> Débitos de irmãos que podem ser compensados com créditos</li>
                      <li>• Para realizar compensação, acesse o módulo de Créditos e Débitos</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t px-6 py-4">
              <button
                onClick={() => setModalDespesasPendentesAberto(false)}
                className="w-full px-6 py-3 bg-gray-600 text-white rounded-lg font-bold transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Sangria */}
      {modalSangriaAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl max-w-md w-full p-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold" style={{color:"var(--color-text)"}}>💰 Sangria</h3>
              <button onClick={() => { setModalSangriaAberto(false); setFormSangria({ valor: '', data: new Date().toISOString().split('T')[0], observacao: '' }); }} className="hover: text-2xl font-bold">×</button>
            </div>
            <div className="border-2 border-emerald-300 rounded-lg p-4 mb-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
              <p className="text-sm text-emerald-700 font-semibold mb-1">💵 Disponível</p>
              <p className="text-3xl font-bold text-emerald-800">{formatarMoeda(resumo.caixaFisico)}</p>
            </div>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium mb-2" style={{color:"var(--color-text-muted)"}}>Valor *</label><input type="number" step="0.01" value={formSangria.valor} onChange={(e) => setFormSangria({ ...formSangria, valor: e.target.value })} className="w-full px-4 py-2 border rounded-lg" placeholder="0.00" /></div>
              <div><label className="block text-sm font-medium mb-2" style={{color:"var(--color-text-muted)"}}>Data *</label><input type="date" value={formSangria.data} onChange={(e) => setFormSangria({ ...formSangria, data: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
              <div><label className="block text-sm font-medium mb-2" style={{color:"var(--color-text-muted)"}}>Obs</label><textarea value={formSangria.observacao} onChange={(e) => setFormSangria({ ...formSangria, observacao: e.target.value })} className="w-full px-4 py-2 border rounded-lg" rows="2" /></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setModalSangriaAberto(false); setFormSangria({ valor: '', data: new Date().toISOString().split('T')[0], observacao: '' }); }} className="flex-1 px-4 py-3 rounded-lg font-medium">Cancelar</button>
              <button onClick={fazerSangria} disabled={!formSangria.valor || parseFloat(formSangria.valor) <= 0} className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg font-medium disabled:opacity-50">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Sangria Tronco */}
      {modalSangriaTroncoAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl max-w-md w-full p-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold" style={{color:"var(--color-text)"}}>💰 Sangria - Tronco</h3>
              <button 
                onClick={() => { 
                  setModalSangriaTroncoAberto(false); 
                  setFormSangria({ valor: '', data: new Date().toISOString().split('T')[0], observacao: '' }); 
                }} 
                className="hover: text-2xl font-bold"
              >
                ×
              </button>
            </div>
            
            <div className="border-2 rounded-lg p-4 mb-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
              <p className="text-sm font-semibold mb-1">💵 Espécie Disponível</p>
              <p className="text-3xl font-bold">{formatarMoeda(troncoTotalGlobal.especie)}</p>
              <p className="text-xs mt-2">Será transferido para conta bancária</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{color:"var(--color-text-muted)"}}>Valor *</label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={formSangria.valor} 
                  onChange={(e) => setFormSangria({ ...formSangria, valor: e.target.value })} 
                  className="w-full px-4 py-2 border rounded-lg" 
                  placeholder="0.00"
                  max={troncoTotalGlobal.especie}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2" style={{color:"var(--color-text-muted)"}}>Data *</label>
                <input 
                  type="date" 
                  value={formSangria.data} 
                  onChange={(e) => setFormSangria({ ...formSangria, data: e.target.value })} 
                  className="w-full px-4 py-2 border rounded-lg" 
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2" style={{color:"var(--color-text-muted)"}}>Observação</label>
                <textarea 
                  value={formSangria.observacao} 
                  onChange={(e) => setFormSangria({ ...formSangria, observacao: e.target.value })} 
                  className="w-full px-4 py-2 border rounded-lg" 
                  rows="2"
                  placeholder="Ex: Depósito em conta - Tronco"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => { 
                  setModalSangriaTroncoAberto(false); 
                  setFormSangria({ valor: '', data: new Date().toISOString().split('T')[0], observacao: '' }); 
                }} 
                className="flex-1 px-4 py-3 rounded-lg font-medium transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => fazerSangriaTronco()} 
                disabled={!formSangria.valor || parseFloat(formSangria.valor) <= 0 || parseFloat(formSangria.valor) > troncoTotalGlobal.especie} 
                className="flex-1 px-4 py-3 text-white rounded-lg font-medium disabled:opacity-50 hover: transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Compensação */}
      {modalCompensacaoAberto && (
        <ModalCompensacao
          irmao={irmaoCompensacao}
          debitos={debitosIrmao}
          creditos={creditosIrmao}
          onClose={() => {
            setModalCompensacaoAberto(false);
            setIrmaoCompensacao(null);
            setDebitosIrmao([]);
            setCreditosIrmao([]);
          }}
          onSuccess={carregarLancamentos}
          showSuccess={showSuccess}
          showError={showError}
        />
      )}

      {/* COMPONENTE MODAL DE ANÁLISE POR CATEGORIA */}
      <AnaliseCategoriasModal 
        isOpen={modalAnaliseAberto}
        onClose={() => setModalAnaliseAberto(false)}
        showError={showError}
      />

      {/* MODAL RESUMO FINANCEIRO DOS IRMÃOS */}
      <ModalResumoIrmaos
        isOpen={modalResumoAberto}
        onClose={() => setModalResumoAberto(false)}
        resumoIrmaos={resumoIrmaos}
      />
    </div>
  );
}

// COMPONENTE: GERENCIAR CATEGORIAS
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
    <div className="space-y-6" style={{background:"var(--color-bg)",minHeight:"100vh",overflowX:"hidden"}}>
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold" style={{color:"var(--color-text)"}}>🏷️ Gerenciar Categorias</h2>
        <button
          onClick={() => setMostrarFormulario(!mostrarFormulario)}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
        >
          {mostrarFormulario ? '❌ Cancelar' : '➕ Nova Categoria'}
        </button>
      </div>

      {mostrarFormulario && (
        <div className="rounded-lg shadow p-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
          <h3 className="text-lg font-semibold mb-4" style={{color:"var(--color-text)"}}>
            {editando ? '✏️ Editar Categoria' : '➕ Nova Categoria'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Nome *</label>
                <input
                  type="text"
                  value={formCategoria.nome}
                  onChange={(e) => setFormCategoria({ ...formCategoria, nome: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Tipo *</label>
                <select
                  value={formCategoria.tipo}
                  onChange={(e) => setFormCategoria({ ...formCategoria, tipo: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                >
                  <option value="receita">💰 Receita</option>
                  <option value="despesa">💸 Despesa</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Descrição</label>
                <input
                  type="text"
                  value={formCategoria.descricao}
                  onChange={(e) => setFormCategoria({ ...formCategoria, descricao: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
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
              <button type="submit" className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                {editando ? '✅ Salvar' : '➕ Criar'}
              </button>
              <button type="button" onClick={limparFormulario} className="px-6 py-2 bg-gray-300 rounded-lg">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* RECEITAS */}
        <div className="rounded-lg shadow p-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
          <h3 className="text-lg font-semibold text-green-700 mb-4" style={{color:"var(--color-text)"}}>
            💰 Receitas ({categoriasReceita.length})
          </h3>
          <div className="space-y-2">
            {categoriasReceita.map(cat => (
              <div key={cat.id} className={`p-3 rounded-lg border ${cat.ativo !== false ? ' ' : '  opacity-60'}`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{cat.nome}</h4>
                      {cat.ativo === false && <span className="text-xs px-2 py-1 rounded">Inativa</span>}
                    </div>
                    {cat.descricao && <p className="text-sm mt-1">{cat.descricao}</p>}
                  </div>
                  <div className="flex gap-1 ml-2">
                    <button onClick={() => editarCategoria(cat)} className="p-1 text-blue-600 hover:bg-blue-100 rounded" title="Editar">✏️</button>
                    <button onClick={() => toggleAtivo(cat.id, cat.ativo !== false)} className="p-1 text-yellow-600 hover:bg-yellow-100 rounded" title={cat.ativo !== false ? 'Desativar' : 'Ativar'}>{cat.ativo !== false ? '👁️' : '👁️‍🗨️'}</button>
                    <button onClick={() => excluirCategoria(cat.id)} className="p-1 text-red-600 hover:bg-red-100 rounded" title="Excluir">🗑️</button>
                  </div>
                </div>
              </div>
            ))}
            {categoriasReceita.length === 0 && <p className="text-sm">Nenhuma categoria</p>}
          </div>
        </div>

        {/* DESPESAS */}
        <div className="rounded-lg shadow p-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
          <h3 className="text-lg font-semibold text-red-700 mb-4" style={{color:"var(--color-text)"}}>
            💸 Despesas ({categoriasDespesa.length})
          </h3>
          <div className="space-y-2">
            {categoriasDespesa.map(cat => (
              <div key={cat.id} className={`p-3 rounded-lg border ${cat.ativo !== false ? ' ' : '  opacity-60'}`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{cat.nome}</h4>
                      {cat.ativo === false && <span className="text-xs px-2 py-1 rounded">Inativa</span>}
                    </div>
                    {cat.descricao && <p className="text-sm mt-1">{cat.descricao}</p>}
                  </div>
                  <div className="flex gap-1 ml-2">
                    <button onClick={() => editarCategoria(cat)} className="p-1 text-blue-600 hover:bg-blue-100 rounded" title="Editar">✏️</button>
                    <button onClick={() => toggleAtivo(cat.id, cat.ativo !== false)} className="p-1 text-yellow-600 hover:bg-yellow-100 rounded" title={cat.ativo !== false ? 'Desativar' : 'Ativar'}>{cat.ativo !== false ? '👁️' : '👁️‍🗨️'}</button>
                    <button onClick={() => excluirCategoria(cat.id)} className="p-1 text-red-600 hover:bg-red-100 rounded" title="Excluir">🗑️</button>
                  </div>
                </div>
              </div>
            ))}
            {categoriasDespesa.length === 0 && <p className="text-sm">Nenhuma categoria</p>}
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-4" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <p className="text-sm text-blue-800">
          💡 <strong>Dica:</strong> Categorias inativas não aparecem nos formulários, mas lançamentos antigos continuam visíveis.
        </p>
      </div>
    </div>
  );
}

// COMPONENTE: MODAL DE PARCELAMENTO
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

      const grupoParcelamento = gerarUUID();
      const valorParcela = valorTotal / numParcelas;
      
      // Se estiver parcelando um lançamento existente
      if (lancamentoExistente) {
        // Verificar se é lançamento principal com pagamentos parciais
        const { data: pagamentos, error: checkError } = await supabase
          .from('lancamentos_loja')
          .select('id')
          .eq('lancamento_principal_id', lancamentoExistente.id)
          .eq('eh_pagamento_parcial', true);

        if (checkError) throw checkError;

        if (pagamentos && pagamentos.length > 0) {
          showError('Este lançamento tem pagamentos parciais. Parcele o remanescente!');
          return;
        }

        // Transformar o lançamento existente na PRIMEIRA parcela
        const dataPrimeiraParcela = new Date(formParcelamento.data_primeira_parcela);
        
        const { error: updateError } = await supabase
          .from('lancamentos_loja')
          .update({
            descricao: `${formParcelamento.descricao} (1/${numParcelas})`,
            valor: valorParcela,
            data_vencimento: dataPrimeiraParcela.toISOString().split('T')[0],
            status: 'pendente',
            eh_parcelado: true,
            parcela_numero: 1,
            parcela_total: numParcelas,
            grupo_parcelamento: grupoParcelamento,
            observacoes: 'Parcelado'
          })
          .eq('id', lancamentoExistente.id);
        
        if (updateError) throw updateError;

        const parcelasRestantes = [];
        for (let i = 1; i < numParcelas; i++) {
          const dataParcela = new Date(formParcelamento.data_primeira_parcela);
          dataParcela.setMonth(dataParcela.getMonth() + i);
          
          parcelasRestantes.push({
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

        if (parcelasRestantes.length > 0) {
          const { error } = await supabase.from('lancamentos_loja').insert(parcelasRestantes);
          if (error) throw error;
        }

        showSuccess(`✅ Lançamento parcelado em ${numParcelas}x!`);
      } else {
        // Parcelamento NOVO (sem lançamento existente) - cria todas
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

        const { error } = await supabase.from('lancamentos_loja').insert(parcelas);
        if (error) throw error;
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
      <div className="rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <div 
          className="text-white px-6 py-4 rounded-t-lg"
          style={{ background:'var(--color-accent)' }}
        >
          <h3 className="text-xl font-bold" style={{color:"var(--color-text)"}}>
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
            <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Tipo *</label>
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

          {/* Linha 1: Categoria e Descrição */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Categoria *</label>
              <select required value={formParcelamento.categoria_id}
                onChange={(e) => setFormParcelamento({ ...formParcelamento, categoria_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}>
                <option value="">Selecione...</option>
                {renderizarOpcoesCategoria(formParcelamento.tipo)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Descrição *</label>
              <input type="text" required value={formParcelamento.descricao}
                onChange={(e) => setFormParcelamento({ ...formParcelamento, descricao: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}} placeholder="Ex: Reforma do templo" />
            </div>
          </div>
          <p className="text-xs -mt-2">Será adicionado (1/5), (2/5), etc.</p>

          {/* Linha 2: Origem */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Origem</label>
              <select value={formParcelamento.origem_tipo}
                onChange={(e) => setFormParcelamento({ ...formParcelamento, origem_tipo: e.target.value, origem_irmao_id: '' })}
                className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}>
                <option value="Loja">🏛️ Loja</option>
                <option value="Irmao">👤 Irmão</option>
              </select>
            </div>
            {formParcelamento.origem_tipo === 'Irmao' && (
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Irmão</label>
                <select value={formParcelamento.origem_irmao_id}
                  onChange={(e) => setFormParcelamento({ ...formParcelamento, origem_irmao_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}>
                  <option value="">Selecione...</option>
                  {irmaos.map(irmao => (
                    <option key={irmao.id} value={irmao.id}>{irmao.nome}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Linha 3: Valor Total, Nº Parcelas e Data Vencimento */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Valor Total *</label>
              <input type="number" required step="0.01" min="0.01" value={formParcelamento.valor_total}
                onChange={(e) => setFormParcelamento({ ...formParcelamento, valor_total: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Nº Parcelas *</label>
              <input type="number" required min="2" max="24" value={formParcelamento.num_parcelas}
                onChange={(e) => setFormParcelamento({ ...formParcelamento, num_parcelas: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Vencimento 1ª Parcela *</label>
              <input type="date" required value={formParcelamento.data_primeira_parcela}
                onChange={(e) => setFormParcelamento({ ...formParcelamento, data_primeira_parcela: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}} />
            </div>
          </div>
          <p className="text-xs -mt-2">As demais vencerão mensalmente</p>

          {formParcelamento.valor_total && formParcelamento.num_parcelas && (
            <div className="bg-indigo-50 border border-indigo-200 rounded p-3">
              <p className="text-sm font-medium">
                💡 Cada parcela: R$ {((parseFloat(formParcelamento.valor_total) || 0) / (parseInt(formParcelamento.num_parcelas) || 1)).toFixed(2)}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Forma de Pagamento</label>
            <select value={formParcelamento.tipo_pagamento}
              onChange={(e) => setFormParcelamento({ ...formParcelamento, tipo_pagamento: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}>
              {tiposPagamento.map(tp => (
                <option key={tp.value} value={tp.value}>{tp.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Observações</label>
            <textarea value={formParcelamento.observacoes}
              onChange={(e) => setFormParcelamento({ ...formParcelamento, observacoes: e.target.value })}
              rows="2" className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}} />
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <button type="submit" 
              className="flex-1 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">
              🔢 Criar Parcelamento
            </button>
            <button type="button" onClick={onClose}
              className="px-6 py-2 bg-gray-300 rounded-lg font-medium">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// COMPONENTE: MODAL DE PAGAMENTO PARCIAL
function ModalPagamentoParcial({ lancamento, pagamentosExistentes, onClose, onSuccess, showSuccess, showError }) {
  const [valorPagar, setValorPagar] = useState('');
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().split('T')[0]);

  // LÓGICA CORRETA DE CÁLCULO
  // 1. Buscar o PRIMEIRO valor do lançamento (antes de qualquer alteração)
  // 2. Calcular quanto foi compensado
  // 3. Calcular quanto foi pago (pagamentos parciais reais)
  // 4. Valor Restante = Original - Compensado - Pago
  // 5. Valor no banco = Valor Restante (sempre atualizado)
  
  // Separar pagamentos reais e compensações
  const pagamentosReais = pagamentosExistentes.filter(pag => pag.tipo_pagamento !== 'compensacao');
  const compensacoes = pagamentosExistentes.filter(pag => pag.tipo_pagamento === 'compensacao');
  
  const totalPago = pagamentosReais.reduce((sum, pag) => sum + parseFloat(pag.valor), 0);
  const totalCompensado = compensacoes.reduce((sum, pag) => sum + parseFloat(pag.valor), 0);
  
  // VALOR ORIGINAL: Tentar pegar das observações primeiro, senão calcular
  let valorOriginal;
  
  // Tentar extrair das observações: "[Valor original: R$ 200.00 |" (formato com ponto decimal)
  const matchObservacoes = lancamento.observacoes?.match(/Valor original: R\$ ([\d.]+)/);
  if (matchObservacoes) {
    // Valor está salvo como "200.00" (formato padrão toFixed)
    valorOriginal = parseFloat(matchObservacoes[1]);
  } else if (totalCompensado > 0 || totalPago > 0) {
    // Se já tem compensação ou pagamento, calcular valor original
    valorOriginal = parseFloat(lancamento.valor) + totalPago + totalCompensado;
  } else {
    // Primeiro pagamento/compensação - valor do banco É o original
    valorOriginal = parseFloat(lancamento.valor);
  }
  
  // VALOR RESTANTE = simplesmente o valor no banco (já está correto)
  const valorRestante = parseFloat(lancamento.valor);

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

      // Calcular novo valor restante
      const novoRestante = valorRestante - valorAPagar;
      const novoTotalPago = totalPago + valorAPagar;

      if (novoRestante <= 0.01) {  // <= 0.01 para evitar problemas de arredondamento
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
        // PAGAMENTO PARCIAL: Criar registro separado E atualizar valor original
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
          observacoes: `Pagamento parcial de R$ ${valorAPagar.toFixed(2)} do lançamento "${lancamento.descricao}" (Valor original: R$ ${valorOriginal.toFixed(2)})`,
          eh_pagamento_parcial: true,
          lancamento_principal_id: lancamento.id
        };

        const { error: errorInsert } = await supabase
          .from('lancamentos_loja')
          .insert(novoPagamento);

        if (errorInsert) throw errorInsert;

        // ATUALIZAR o valor do lançamento original para refletir apenas o saldo restante
        const { error: errorUpdate } = await supabase
          .from('lancamentos_loja')
          .update({
            valor: novoRestante,
            observacoes: `${lancamento.observacoes || ''}\n[Valor original: R$ ${valorOriginal.toFixed(2)} | Já pago: R$ ${novoTotalPago.toFixed(2)}]`.trim()
          })
          .eq('id', lancamento.id);

        if (errorUpdate) throw errorUpdate;

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
      <div className="rounded-lg max-w-2xl w-full my-8">
        <div className="text-white px-6 py-4 rounded-t-lg">
          <h3 className="text-xl font-bold" style={{color:"var(--color-text)"}}>💰 Pagamento Parcial</h3>
          <p className="text-sm">Cada pagamento gera um registro que entra no balanço mensal</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Informações do Lançamento */}
          <div className="rounded-lg p-4 space-y-2" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <div className="flex justify-between">
              <span className="font-medium">Descrição:</span>
              <span className="text-right">{lancamento.descricao}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="font-medium">Valor Original:</span>
              <span className="font-bold text-lg">R$ {valorOriginal.toFixed(2)}</span>
            </div>
            {totalCompensado > 0 && (
              <div className="flex justify-between">
                <span className="font-medium text-purple-600">🔄 Compensado:</span>
                <span className="font-bold text-purple-600">R$ {totalCompensado.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="font-medium text-green-600">✅ Pago:</span>
              <span className="font-bold text-green-600">R$ {totalPago.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="font-medium text-red-600 text-lg">Valor Restante:</span>
              <span className="font-bold text-red-600 text-lg">R$ {valorRestante.toFixed(2)}</span>
            </div>
          </div>

          {/* Histórico de Compensações */}
          {compensacoes.length > 0 && (
            <div className="rounded-lg p-4" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
              <h4 className="font-medium mb-2 text-purple-800">🔄 Compensações Realizadas:</h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {compensacoes.map((comp, idx) => (
                  <div key={comp.id} className="flex justify-between text-sm">
                    <span>#{idx + 1} - {new Date(comp.data_pagamento + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                    <span className="font-medium text-purple-700">R$ {parseFloat(comp.valor).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Histórico de Pagamentos */}
          {pagamentosReais.length > 0 && (
            <div className="rounded-lg p-4" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
              <h4 className="font-medium mb-2">📋 Pagamentos Anteriores:</h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {pagamentosReais.map((pag, idx) => (
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
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Valor a Pagar *</label>
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
              <p className="text-xs mt-1">Máximo: R$ {valorRestante.toFixed(2)}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Data do Pagamento *</label>
              <input 
                type="date" 
                required
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}} 
              />
              <p className="text-xs mt-1">Entra no balanço desta data</p>
            </div>
          </div>

          {/* Prévia */}
          {valorPagar && parseFloat(valorPagar) > 0 && (
            <div className="border rounded p-4 space-y-2">
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
              <div className="mt-2 p-2 rounded text-sm">
                💡 Será criado um novo registro que entra no balanço de <strong>{new Date(dataPagamento + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</strong>
              </div>
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-3 pt-4 border-t">
            <button type="submit" 
              className="flex-1 px-6 py-2 text-white rounded-lg hover: font-medium">
              💰 Registrar Pagamento
            </button>
            <button type="button" onClick={onClose}
              className="px-6 py-2 bg-gray-300 rounded-lg font-medium">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 🔄 MODAL DE COMPENSAÇÃO
function ModalCompensacao({ irmao, debitos, creditos, onClose, onSuccess, showSuccess, showError }) {
  const [debitosSelecionados, setDebitosSelecionados] = useState([]);
  const [creditosSelecionados, setCreditosSelecionados] = useState([]);

  // Calcular totais
  const totalDebitos = debitosSelecionados.reduce((sum, id) => {
    const debito = debitos.find(d => d.id === id);
    return sum + (debito ? parseFloat(debito.valor) : 0);
  }, 0);

  const totalCreditos = creditosSelecionados.reduce((sum, id) => {
    const credito = creditos.find(c => c.id === id);
    return sum + (credito ? parseFloat(credito.valor) : 0);
  }, 0);

  const valorCompensar = Math.min(totalDebitos, totalCreditos);
  const saldoFinal = totalDebitos - totalCreditos;

  const toggleDebito = (id) => {
    setDebitosSelecionados(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleCredito = (id) => {
    setCreditosSelecionados(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleCompensar = async (e) => {
    e.preventDefault();
    
    if (debitosSelecionados.length === 0 || creditosSelecionados.length === 0) {
      showError('Selecione pelo menos um débito e um crédito para compensar');
      return;
    }
    
    if (valorCompensar === 0) {
      showError('Não há valor a compensar');
      return;
    }
    
    try {
      const dataCompensacao = new Date().toISOString().split('T')[0];
      
      // Processar débitos selecionados (receitas - irmão deve)
      for (const debitoId of debitosSelecionados) {
        const debito = debitos.find(d => d.id === debitoId);
        if (!debito) continue;
        
        const valorDebito = parseFloat(debito.valor);
        const proporcao = valorDebito / totalDebitos;
        const valorACompensar = Math.min(valorDebito, valorCompensar * proporcao);
        
        if (valorACompensar >= valorDebito - 0.01) {
          // Quitar completamente o débito
          const { error } = await supabase
            .from('lancamentos_loja')
            .update({
              status: 'pago',
              data_pagamento: dataCompensacao,
              tipo_pagamento: 'compensacao'
            })
            .eq('id', debitoId);
            
          if (error) throw error;
        } else {
          // Compensação parcial do débito
          
          const { error: errorInsert } = await supabase
            .from('lancamentos_loja')
            .insert({
              tipo: 'receita', // Débito é sempre receita
              categoria_id: debito.categoria_id,
              descricao: `💰 Compensação: ${debito.descricao}`,
              valor: valorACompensar,
              data_lancamento: dataCompensacao,
              data_vencimento: dataCompensacao,
              data_pagamento: dataCompensacao,
              tipo_pagamento: 'compensacao',
              status: 'pago',
              origem_tipo: debito.origem_tipo,
              origem_irmao_id: debito.origem_irmao_id,
              eh_pagamento_parcial: true,
              lancamento_principal_id: debitoId
            });
            
          if (errorInsert) throw errorInsert;
          
          // ATUALIZAR o valor do lançamento original para refletir a compensação
          const novoValor = valorDebito - valorACompensar;
          
          // Preparar observações com valor original (se ainda não tiver)
          let novasObservacoes = debito.observacoes || '';
          if (!novasObservacoes.includes('Valor original:')) {
            // Primeira alteração - guardar valor original
            novasObservacoes = `[Valor original: R$ ${valorDebito.toFixed(2)}]\n${novasObservacoes}`.trim();
          }
          novasObservacoes += `\n[Compensação de ${formatarMoeda(valorACompensar)} em ${new Date(dataCompensacao + 'T00:00:00').toLocaleDateString('pt-BR')}]`;
          
          const { error: errorUpdate } = await supabase
            .from('lancamentos_loja')
            .update({
              valor: novoValor,
              observacoes: novasObservacoes.trim()
            })
            .eq('id', debitoId);
            
          if (errorUpdate) throw errorUpdate;
        }
      }
      
      // Processar créditos selecionados (despesas - loja deve)
      for (const creditoId of creditosSelecionados) {
        const credito = creditos.find(c => c.id === creditoId);
        if (!credito) continue;
        
        const valorCredito = parseFloat(credito.valor);
        const proporcao = valorCredito / totalCreditos;
        const valorACompensar = Math.min(valorCredito, valorCompensar * proporcao);
        
        if (valorACompensar >= valorCredito - 0.01) {
          // Quitar completamente o crédito
          const { error } = await supabase
            .from('lancamentos_loja')
            .update({
              status: 'pago',
              data_pagamento: dataCompensacao,
              tipo_pagamento: 'compensacao'
            })
            .eq('id', creditoId);
            
          if (error) throw error;
        } else {
          // Compensação parcial do crédito
          
          const { error: errorInsert } = await supabase
            .from('lancamentos_loja')
            .insert({
              tipo: 'despesa', // Crédito é sempre despesa
              categoria_id: credito.categoria_id,
              descricao: `💰 Compensação: ${credito.descricao}`,
              valor: valorACompensar,
              data_lancamento: dataCompensacao,
              data_vencimento: dataCompensacao,
              data_pagamento: dataCompensacao,
              tipo_pagamento: 'compensacao',
              status: 'pago',
              origem_tipo: credito.origem_tipo,
              origem_irmao_id: credito.origem_irmao_id,
              eh_pagamento_parcial: true,
              lancamento_principal_id: creditoId
            });
            
          if (errorInsert) throw errorInsert;
          
          // ATUALIZAR o valor do lançamento original para refletir a compensação
          const novoValor = valorCredito - valorACompensar;
          
          // Preparar observações com valor original (se ainda não tiver)
          let novasObservacoes = credito.observacoes || '';
          if (!novasObservacoes.includes('Valor original:')) {
            // Primeira alteração - guardar valor original
            novasObservacoes = `[Valor original: R$ ${valorCredito.toFixed(2)}]\n${novasObservacoes}`.trim();
          }
          novasObservacoes += `\n[Compensação de ${formatarMoeda(valorACompensar)} em ${new Date(dataCompensacao + 'T00:00:00').toLocaleDateString('pt-BR')}]`;
          
          const { error: errorUpdate } = await supabase
            .from('lancamentos_loja')
            .update({
              valor: novoValor,
              observacoes: novasObservacoes.trim()
            })
            .eq('id', creditoId);
            
          if (errorUpdate) throw errorUpdate;
        }
      }
      
      showSuccess(`✅ Compensação realizada! Valor compensado: ${formatarMoeda(valorCompensar)}`);
      onClose();
      onSuccess();
      
    } catch (error) {
      console.error('Erro ao compensar:', error);
      showError('Erro ao realizar compensação: ' + error.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="rounded-lg max-w-4xl w-full my-8">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-4 rounded-t-lg">
          <h3 className="text-xl font-bold" style={{color:"var(--color-text)"}}>🔄 Compensação de Valores</h3>
          <p className="text-sm text-purple-100">Irmão: {irmao?.nome}</p>
        </div>
        <form onSubmit={handleCompensar} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* DÉBITOS */}
            <div>
              <h4 className="font-bold text-red-700 mb-3" style={{color:"var(--color-text)"}}>📤 Débitos (Ele deve)</h4>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {debitos.length > 0 ? debitos.map(d => (
                  <div key={d.id} onClick={() => toggleDebito(d.id)}
                    className={`p-3 border-2 rounded-lg cursor-pointer ${debitosSelecionados.includes(d.id) ? ' ' : ''}`}>
                    <div className="flex justify-between">
                      <div><p className="font-medium text-sm">{d.descricao}</p><p className="text-xs">Venc: {formatarDataBR(d.data_vencimento)}</p></div>
                      <p className="font-bold text-red-600">{formatarMoeda(d.valor)}</p>
                    </div>
                  </div>
                )) : <p className="text-center py-4">Sem débitos</p>}
              </div>
              <div className="mt-3 p-3 rounded-lg"><p className="text-sm">Total:</p><p className="text-xl font-bold text-red-700">{formatarMoeda(totalDebitos)}</p></div>
            </div>
            {/* CRÉDITOS */}
            <div>
              <h4 className="font-bold text-green-700 mb-3" style={{color:"var(--color-text)"}}>📥 Créditos (Loja deve)</h4>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {creditos.length > 0 ? creditos.map(c => (
                  <div key={c.id} onClick={() => toggleCredito(c.id)}
                    className={`p-3 border-2 rounded-lg cursor-pointer ${creditosSelecionados.includes(c.id) ? ' ' : ''}`}>
                    <div className="flex justify-between">
                      <div><p className="font-medium text-sm">{c.descricao}</p><p className="text-xs">Venc: {formatarDataBR(c.data_vencimento)}</p></div>
                      <p className="font-bold text-green-600">{formatarMoeda(c.valor)}</p>
                    </div>
                  </div>
                )) : <p className="text-center py-4">Sem créditos</p>}
              </div>
              <div className="mt-3 p-3 rounded-lg"><p className="text-sm">Total:</p><p className="text-xl font-bold text-green-700">{formatarMoeda(totalCreditos)}</p></div>
            </div>
          </div>
          {/* RESUMO */}
          {(debitosSelecionados.length > 0 || creditosSelecionados.length > 0) && (
            <div className="border-2 rounded-lg p-4" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
              <h4 className="font-bold mb-3" style={{color:"var(--color-text)"}}>📊 Resumo</h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div><p className="text-sm">Compensar</p><p className="text-2xl font-bold text-purple-700">{formatarMoeda(valorCompensar)}</p></div>
                <div><p className="text-sm">Saldo Final</p><p className={`text-2xl font-bold ${saldoFinal > 0 ? 'text-red-700' : 'text-green-700'}`}>{formatarMoeda(Math.abs(saldoFinal))}</p></div>
                <div><p className="text-sm">Status</p><p className="text-lg font-bold">{saldoFinal === 0 ? '✅ Quitado' : '⚖️ Compensado'}</p></div>
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-4 border-t">
            <button type="submit" disabled={debitosSelecionados.length === 0 || creditosSelecionados.length === 0}
              className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-bold disabled:opacity-50">
              🔄 Compensar
            </button>
            <button type="button" onClick={onClose} className="px-6 py-3 bg-gray-300 rounded-lg">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
