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
import ArcoReal from './ArcoReal';
import ModalRenegociacao from './ModalRenegociacao';
import {
  gerarRelatorioMovimentacao,
  gerarRelatorioIndividual,
  gerarRelatorioDeTodos
} from './utils/pdfFinancas';
import ModalParcelamento from './ModalParcelamento';
import ModalPagamentoParcial from './ModalPagamentoParcial';
import ModalCompensacao from './ModalCompensacao';
import ModalQuitacao from './ModalQuitacao';
import ModalQuitacaoLote from './ModalQuitacaoLote';
import FinancasLojaTV from './FinancasLojaTV';

// 💰 COMPONENTE: Finanças da Loja
// Gerenciamento financeiro com regime de competência
// Lançamentos pagos: filtrados por data_pagamento | Pendentes: filtrados por data_vencimento

// ⚙️ Configuração de status permitidos
const STATUS_PERMITIDOS = ['regular', 'Regular', 'licenciado', 'Licenciado'];
const STATUS_BLOQUEADOS = ['irregular', 'Irregular', 'suspenso', 'Suspenso', 'desligado', 'Desligado', 'excluído', 'Excluído', 'falecido', 'Falecido', 'ex-ofício', 'Ex-Ofício'];

export default function FinancasLoja({ showSuccess, showError, userEmail, userData }) {
  // 🕐 FUNÇÃO PARA CORRIGIR TIMEZONE
  const [categorias, setCategorias] = useState([]);
  const [irmaos, setIrmaos] = useState([]);
  const [lancamentos, setLancamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalLancamentoAberto, setModalLancamentoAberto] = useState(false);
  const [eventosComemorativos, setEventosComemorativos] = useState([]);
  const [projetosAtivos, setProjetosAtivos] = useState([]);
  const [irmaoEditando, setIrmaoEditando]       = useState(null); // irmão extra para edição (ex: desligado)
  const [tipoLancamento, setTipoLancamento] = useState('receita');
  const [mostrarModalIrmaos, setMostrarModalIrmaos] = useState(false);
  const [mostrarModalQuitacao, setMostrarModalQuitacao] = useState(false);
  const [mostrarModalQuitacaoLote, setMostrarModalQuitacaoLote] = useState(false);
  const [quitacaoForm, setQuitacaoForm] = useState({
    lancamento_id: null,
    data_pagamento: new Date().toISOString().split('T')[0],
    tipo_pagamento: 'dinheiro',
    observacoes: ''
  });
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
  const [modalMovAberto, setModalMovAberto]     = useState(false);
  const [modalArcoRealAberto, setModalArcoRealAberto]   = useState(false);
  const [modalRenegocAberto, setModalRenegocAberto]     = useState(false);
  const [inclPresenca, setInclPresenca]     = useState(false); // padrão: sem presença
  const [movForm, setMovForm] = useState({ irmaoId: '', dataInicio: '', dataFim: '' });

  // Controle de fechamento de mês
  const [mesesFechados, setMesesFechados] = useState([]);
  const [fechandoMes, setFechandoMes] = useState(false);
  const [formSangria, setFormSangria] = useState({
    valor: '',
    data: new Date().toISOString().split('T')[0],
    observacao: '',
    finalidade: 'deposito',   // 'deposito' | 'despesa'
    categoria_despesa_id: '',
    descricao_despesa: ''
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
    evento_comemorativo_id: null,
    projeto_id: null,
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
  const tiposPagamento = [
    { value: 'dinheiro', label: '💵 Dinheiro' },
    { value: 'pix', label: '📱 PIX' },
    { value: 'transferencia', label: '🏦 Transferência' },
    { value: 'deposito', label: '🏧 Depósito' },
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
    carregarEventosComemorativos();
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
        .filter(l =>
          l.tipo_pagamento !== 'dinheiro' &&
          l.tipo_pagamento !== 'compensacao' &&
          !l.eh_transferencia_interna
        )
        .reduce((sum, l) => sum + parseFloat(l.valor || 0), 0);
        
      const dinheiro = receitasPagas
        .filter(l =>
          l.tipo_pagamento === 'dinheiro' &&
          !l.eh_transferencia_interna
        )
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

  const carregarEventosComemorativos = async () => {
    const { data } = await supabase.from('eventos_comemorativos_fin').select('id, nome, ano, status').order('ano', { ascending: false }).order('nome');
    setEventosComemorativos(data || []);

    const { data: projData } = await supabase
      .from('projetos')
      .select('id, nome, status')
      .eq('status', 'em_andamento')
      .order('nome');
    setProjetosAtivos(projData || []);
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
        `);

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

      // Paginação automática — buscar todos sem limite
      let allData = [];
      let pageStart = 0;
      const pageSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data: pageData, error: pageError } = await query.range(pageStart, pageStart + pageSize - 1);
        if (pageError) throw pageError;
        if (!pageData || pageData.length === 0) break;
        allData = [...allData, ...pageData];
        hasMore = pageData.length === pageSize;
        pageStart += pageSize;
      }
      const data = allData;
      const error = null;

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
        // Ordenar por data (mais recente primeiro), depois por nome do irmão
        const dataCmp = new Date(dataB) - new Date(dataA);
        if (dataCmp !== 0) return dataCmp;
        const nomeA = (a.irmaos?.nome || '').toLowerCase();
        const nomeB = (b.irmaos?.nome || '').toLowerCase();
        return nomeA.localeCompare(nomeB);
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

    // Renovar sessão para evitar JWT expired
    await supabase.auth.refreshSession();

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
        origem_irmao_id: dados.origem_irmao_id ? parseInt(dados.origem_irmao_id) : null,
        evento_comemorativo_id: dados.evento_comemorativo_id || null,
        projeto_id: dados.projeto_id ? parseInt(dados.projeto_id) : null,
      };

      // Buscar projeto anterior ANTES de qualquer operação
      let projetoAnterior = null;
      if (editando) {
        const { data: lancAnterior } = await supabase
          .from('lancamentos_loja')
          .select('projeto_id')
          .eq('id', editando)
          .single();
        projetoAnterior = lancAnterior?.projeto_id || null;
      }

      if (editando) {
        const { error } = await supabase
          .from('lancamentos_loja')
          .update(dadosLancamento)
          .eq('id', editando);

        if (error) throw error;

        // Gerenciar vínculo com projeto
        if (projetoAnterior || dados.projeto_id) {
          if (projetoAnterior) {
            // Remover registros anteriores do Finanças Loja para este projeto
            await supabase.from('receitas_projeto')
              .delete()
              .eq('projeto_id', projetoAnterior)
              .eq('origem', 'Finanças Loja')
              .eq('data_receita', dadosLancamento.data_lancamento);
            await supabase.from('custos_projeto')
              .delete()
              .eq('projeto_id', projetoAnterior)
              .eq('categoria', 'Finanças Loja')
              .eq('data_custo', dadosLancamento.data_lancamento);
          }
          if (dados.projeto_id) {
            const irmaoNome = dados.origem_irmao_id
              ? (irmaos?.find(i => i.id === parseInt(dados.origem_irmao_id))?.nome || '')
              : '';
            if (dados.tipo === 'receita') {
              await supabase.from('receitas_projeto').insert([{
                projeto_id: parseInt(dados.projeto_id),
                data_receita: dados.data_lancamento,
                descricao: dados.descricao,
                valor: parseFloat(dados.valor),
                origem: 'Finanças Loja',
                forma_pagamento: dados.tipo_pagamento || '',
                responsavel: irmaoNome,
              }]);
            } else {
              await supabase.from('custos_projeto').insert([{
                projeto_id: parseInt(dados.projeto_id),
                data_custo: dados.data_lancamento,
                descricao: dados.descricao,
                valor: parseFloat(dados.valor),
                categoria: 'Finanças Loja',
                forma_pagamento: dados.tipo_pagamento || '',
                responsavel: dados.origem_irmao_id
                  ? (irmaos?.find(i => i.id === parseInt(dados.origem_irmao_id))?.nome || '')
                  : '',
              }]);
            }
          }
        }
        
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
        const { data: novoLanc, error } = await supabase
          .from('lancamentos_loja')
          .insert(dadosLancamento)
          .select('id')
          .single();

        if (error) throw error;

        // Criar vínculo com projeto (novo lançamento)
        if (dados.projeto_id && novoLanc?.id) {
          const irmaoNome = dados.origem_irmao_id
            ? (irmaos?.find(i => i.id === parseInt(dados.origem_irmao_id))?.nome || '')
            : '';
          if (dados.tipo === 'receita') {
            await supabase.from('receitas_projeto').insert([{
              projeto_id: parseInt(dados.projeto_id),
              data_receita: dados.data_lancamento,
              descricao: dados.descricao,
              valor: parseFloat(dados.valor),
              origem: 'Finanças Loja',
              forma_pagamento: dados.tipo_pagamento || '',
              responsavel: irmaoNome,
            }]);
          } else {
            await supabase.from('custos_projeto').insert([{
              projeto_id: parseInt(dados.projeto_id),
              data_custo: dados.data_lancamento,
              descricao: dados.descricao,
              valor: parseFloat(dados.valor),
              categoria: 'Finanças Loja',
              forma_pagamento: dados.tipo_pagamento || '',
              responsavel: dados.origem_irmao_id
                ? (irmaos?.find(i => i.id === parseInt(dados.origem_irmao_id))?.nome || '')
                : '',
            }]);
          }
        }

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
    console.log('editarLancamento chamado:', lancamento.id, 'origem_irmao_id:', lancamento.origem_irmao_id);
    const dataRef = lancamento.data_pagamento || lancamento.data_lancamento || lancamento.data_vencimento;
    const bloqueado = dataRef && verificarMesBloqueado(dataRef);
    console.log('dataRef:', dataRef, 'bloqueado:', bloqueado);
    // Verificar se irmão é inativo — se sim, ignorar bloqueio de mês para permitir gestão da dívida
    const irmaoInativo = lancamento.origem_irmao_id &&
      !irmaos.find(i => String(i.id) === String(lancamento.origem_irmao_id));
    if (bloqueado && !irmaoInativo) {
      const data = new Date(dataRef + 'T00:00:00');
      showError(`🔒 ${meses[data.getMonth()]}/${data.getFullYear()} está fechado. Reabra o mês para editar.`);
      return;
    }
    // Se irmão não está na lista ativa (ex: desligado), usa dados já carregados no lançamento
    const irmaoNaLista = irmaos.find(i => String(i.id) === String(lancamento.origem_irmao_id));
    console.log('irmao na lista:', irmaoNaLista, 'origem_irmao_id:', lancamento.origem_irmao_id, 'irmaos.length:', irmaos.length);
    if (lancamento.origem_irmao_id && !irmaoNaLista) {
      const extra = {
        id: lancamento.origem_irmao_id,
        nome: lancamento.irmaos?.nome || 'Irmão ' + lancamento.origem_irmao_id,
        situacao: 'desligado',
        periodicidade_pagamento: null
      };
      console.log('setIrmaoEditando:', extra);
      setIrmaoEditando(extra);
    } else {
      setIrmaoEditando(null);
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
      origem_irmao_id: lancamento.origem_irmao_id || '',
      evento_comemorativo_id: lancamento.evento_comemorativo_id || null
    });
    setEditando(lancamento.id);
    setTimeout(() => setModalLancamentoAberto(true), 0); // garante que irmaoEditando já está no state
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
      // Se lançamento tem projeto vinculado, remover de receitas/custos_projeto
      const lancToDelete = lancamentos.find(l => l.id === id);
      if (lancToDelete?.projeto_id) {
        const dataRef = lancToDelete.data_pagamento || lancToDelete.data_lancamento;
        if (lancToDelete.tipo === 'receita') {
          await supabase.from('receitas_projeto')
            .delete()
            .eq('projeto_id', lancToDelete.projeto_id)
            .eq('origem', 'Finanças Loja')
            .eq('data_receita', dataRef)
            .eq('descricao', lancToDelete.descricao);
        } else {
          await supabase.from('custos_projeto')
            .delete()
            .eq('projeto_id', lancToDelete.projeto_id)
            .eq('categoria', 'Finanças Loja')
            .eq('data_custo', dataRef)
            .eq('descricao', lancToDelete.descricao);
        }
      }

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
      origem_irmao_id: '',
      evento_comemorativo_id: null
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
      origem_irmao_id: '',
      evento_comemorativo_id: null
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
      const { valor, data, observacao, finalidade, categoria_despesa_id, descricao_despesa } = formSangria;
      if (!valor || parseFloat(valor) <= 0) {
        showError('Informe um valor válido');
        return;
      }
      const valorSangria = parseFloat(valor);
      const resumoAtual = calcularResumo();
      if (valorSangria > resumoAtual.caixaFisico) {
        showError('Valor maior que o disponível');
        return;
      }
      setLoading(true);
      const formReset = { valor: '', data: new Date().toISOString().split('T')[0], observacao: '', finalidade: 'deposito', categoria_despesa_id: '', descricao_despesa: '' };

      if (finalidade === 'despesa') {
        // ── Saída por despesa paga em dinheiro — SEM depósito ──────────────
        if (!categoria_despesa_id) { showError('Selecione a categoria da despesa.'); setLoading(false); return; }
        if (!descricao_despesa?.trim()) { showError('Informe a descrição da despesa.'); setLoading(false); return; }
        const { error: errDesp } = await supabase.from('lancamentos_loja').insert([{
          tipo: 'despesa',
          categoria_id: parseInt(categoria_despesa_id),
          descricao: descricao_despesa.trim(),
          valor: valorSangria,
          data_lancamento: data,
          data_vencimento: data,
          data_pagamento: data,
          tipo_pagamento: 'dinheiro',
          status: 'pago',
          eh_transferencia_interna: false,
          origem_tipo: 'Loja',
          origem_irmao_id: null,
          observacoes: observacao || ''
        }]);
        if (errDesp) throw errDesp;
        showSuccess('✅ Saída de dinheiro registrada!');
        setFormSangria(formReset);
        setModalSangriaAberto(false);
        recarregarDados();
        calcularCaixaFisicoTotal();
        return;
      }

      // ── Sangria para depósito bancário ─────────────────────────────────
      const categoriaSangria = categorias.find(c => c.nome.toLowerCase().includes('sangria') && c.tipo === 'despesa');
      if (!categoriaSangria) { showError('Categoria Sangria não encontrada.'); setLoading(false); return; }
      const categoriaDeposito = categorias.find(c => c.nome.toLowerCase().includes('depósito') && c.tipo === 'receita');
      if (!categoriaDeposito) { showError('Categoria Depósito não encontrada.'); setLoading(false); return; }

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
      setFormSangria(formReset);
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

    // Despesas bancárias (pix, transferência, cartão) — saem do saldo bancário
    const despesasBancarias = lancamentos
      .filter(l => {
        const isTronco = l.categorias_financeiras?.nome?.toLowerCase().includes('tronco');
        const isDinheiro = l.tipo_pagamento === 'dinheiro';
        if (isTronco && isDinheiro) return false;
        return l.categorias_financeiras?.tipo === 'despesa' &&
          l.status === 'pago' &&
          l.tipo_pagamento !== 'compensacao' &&
          l.tipo_pagamento !== 'dinheiro' &&
          !l.eh_transferencia_interna;
      })
      .reduce((sum, l) => sum + parseFloat(l.valor), 0);

    // Despesas em dinheiro — saem do caixa físico, NÃO do banco
    const despesasDinheiroResumo = lancamentos
      .filter(l => {
        const isTronco = l.categorias_financeiras?.nome?.toLowerCase().includes('tronco');
        return l.categorias_financeiras?.tipo === 'despesa' &&
          l.status === 'pago' &&
          l.tipo_pagamento === 'dinheiro' &&
          l.eh_transferencia_interna === false &&
          !isTronco;
      })
      .reduce((sum, l) => sum + parseFloat(l.valor), 0);

    const despesas = despesasBancarias + despesasDinheiroResumo;

    const receitasPendentes = lancamentos
      .filter(l => l.categorias_financeiras?.tipo === 'receita' && l.status === 'pendente' && !l.eh_transferencia_interna)
      .reduce((sum, l) => sum + parseFloat(l.valor), 0);

    const despesasPendentes = lancamentos
      .filter(l => l.categorias_financeiras?.tipo === 'despesa' && l.status === 'pendente' && !l.eh_transferencia_interna)
      .reduce((sum, l) => sum + parseFloat(l.valor), 0);
    
    const saldoPeriodo = receitas - despesas;
    
    const saldoBancario = saldoAnterior + receitasBancarias + depositos - despesasBancarias;
    
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
          l.tipo_pagamento !== 'dinheiro' &&
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

      // Sangrias de depósito (transferência interna)
      const sangriasFeitas = (data || [])
        .filter(l => 
          l.eh_transferencia_interna === true && 
          l.categorias_financeiras?.tipo === 'despesa' &&
          !l.categorias_financeiras?.nome?.toLowerCase().includes('tronco')
        )
        .reduce((sum, l) => sum + parseFloat(l.valor), 0);

      // Despesas pagas em dinheiro (saídas diretas do caixa físico)
      const despesasDinheiro = (data || [])
        .filter(l =>
          l.categorias_financeiras?.tipo === 'despesa' &&
          l.tipo_pagamento === 'dinheiro' &&
          l.eh_transferencia_interna === false &&
          !l.categorias_financeiras?.nome?.toLowerCase().includes('tronco')
        )
        .reduce((sum, l) => sum + parseFloat(l.valor), 0);

      setCaixaFisicoTotal(dinheiroRecebido - sangriasFeitas - despesasDinheiro);

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

  // PDF — wrappers que passam estado para utils/pdfFinancas.js
  const gerarRelatorioMovimentacaoWrapper = async () => {
    setModalMovAberto(false);
    await gerarRelatorioMovimentacao({ movForm, irmaos, supabase, showSuccess, showError });
  };

  const gerarRelatorioIndividualWrapper = async (irmaoId, comPresenca = false) => {
    await gerarRelatorioIndividual(irmaoId, comPresenca, { meses, supabase, showSuccess, showError });
  };

  const gerarRelatorioDeTodosWrapper = async () => {
    await gerarRelatorioDeTodos({ lancamentos, inclPresenca, showSuccess, showError, meses, supabase });
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
    <div className="space-y-6 px-3 py-3" style={{background:"var(--color-bg)",minHeight:"100vh",overflowX:"hidden"}}>
      {/* CABEÇALHO COM BOTÕES - TODOS EM UMA LINHA */}
      <div className="flex gap-2 items-center flex-nowrap mt-3">
        {/* Botões de visualização */}
        <button
          onClick={() => setViewMode('lancamentos')}
          style={{padding:'0 0.75rem',height:'55px',borderRadius:'var(--radius-lg)',fontWeight:'600',whiteSpace:'nowrap',fontSize:'0.875rem',cursor:'pointer',border:'none',background:viewMode==='lancamentos'?'var(--color-accent)':'var(--color-surface-2)',color:viewMode==='lancamentos'?'#fff':'var(--color-text)'}}
        >
          📊 Lançam.
        </button>
        <button
          onClick={() => setViewMode('inadimplentes')}
          style={{padding:'0 0.75rem',height:'55px',borderRadius:'var(--radius-lg)',fontWeight:'600',whiteSpace:'nowrap',fontSize:'0.875rem',cursor:'pointer',border:'none',background:viewMode==='inadimplentes'?'#dc2626':'var(--color-surface-2)',color:viewMode==='inadimplentes'?'#fff':'var(--color-text)'}}
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
              style={{width:"7rem",height:"55px",padding:"0 0.75rem",background:"#f59e0b",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",fontWeight:"700",fontSize:"0.82rem",cursor:"pointer",display:"flex",flexDirection:"row",alignItems:"center",justifyContent:"center",gap:"0.3rem",whiteSpace:"nowrap"}}
              title={`Reabrir ${meses[filtros.mes - 1]}/${filtros.ano}`}
            >
              🔓 Reabrir Mês
            </button>
          ) : (
            <button
              onClick={fecharMes}
              disabled={fechandoMes}
              style={{width:"7rem",height:"55px",padding:"0 0.75rem",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-lg)",fontWeight:"700",fontSize:"0.82rem",cursor:"pointer",display:"flex",flexDirection:"row",alignItems:"center",justifyContent:"center",gap:"0.3rem",whiteSpace:"nowrap"}}
              title={`Fechar ${meses[filtros.mes - 1]}/${filtros.ano}`}
            >
              🔒 Fechar Mês
            </button>
          )
        )}

        {/* Botões de ação - com dropdowns */}
        
        {/* Menu Lançamentos */}
        <div className="relative">
          <button
            onClick={() => setMenuLancamentosAberto(!menuLancamentosAberto)}
            style={{width:"7rem",height:"55px",padding:"0 0.75rem",background:"#8b5cf6",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",fontWeight:"600",fontSize:"0.875rem",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",lineHeight:"1.3",whiteSpace:"nowrap"}}
          >
            📝 Lançam. ▼
          </button>
          
          {menuLancamentosAberto && (
            <div className="absolute top-full left-0 mt-1 rounded-lg z-50 min-w-[150px]" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)",boxShadow:"var(--shadow-xl)"}}>
              <button
                onClick={() => {
                  abrirModalLancamento('receita');
                  setMenuLancamentosAberto(false);
                }}
                style={{width:"100%",padding:"0.65rem 1rem",textAlign:"left",fontSize:"0.85rem",fontWeight:"600",background:"transparent",color:"var(--color-text)",border:"none",borderBottom:"1px solid var(--color-border)",cursor:"pointer",display:"flex",alignItems:"center",gap:"0.5rem",whiteSpace:"nowrap"}}
              >
                💵 Nova Receita
              </button>
              <button
                onClick={() => {
                  abrirModalLancamento('despesa');
                  setMenuLancamentosAberto(false);
                }}
                style={{width:"100%",padding:"0.65rem 1rem",textAlign:"left",fontSize:"0.85rem",fontWeight:"600",background:"transparent",color:"var(--color-text)",border:"none",borderBottom:"1px solid var(--color-border)",cursor:"pointer",display:"flex",alignItems:"center",gap:"0.5rem",whiteSpace:"nowrap"}}
              >
                💳 Nova Despesa
              </button>
              <button
                onClick={() => {
                  setLancamentoParcelar(null);
                  setModalParcelamentoAberto(true);
                  setMenuLancamentosAberto(false);
                }}
                style={{width:"100%",padding:"0.65rem 1rem",textAlign:"left",fontSize:"0.85rem",fontWeight:"600",background:"transparent",color:"var(--color-text)",border:"none",borderBottom:"1px solid var(--color-border)",cursor:"pointer",display:"flex",alignItems:"center",gap:"0.5rem",whiteSpace:"nowrap"}}
              >
                🔀 Parcelar
              </button>
              <button
                onClick={() => {
                  setMostrarModalIrmaos(true);
                  setMenuLancamentosAberto(false);
                }}
                style={{width:"100%",padding:"0.65rem 1rem",textAlign:"left",fontSize:"0.85rem",fontWeight:"600",background:"transparent",color:"var(--color-text)",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:"0.5rem",whiteSpace:"nowrap"}}
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
            style={{width:"7rem",height:"55px",padding:"0 0.75rem",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-lg)",fontWeight:"600",fontSize:"0.875rem",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",lineHeight:"1.3",whiteSpace:"nowrap"}}
          >
            📄 Relatórios ▼
          </button>
          
          {menuRelatoriosAberto && (
            <div className="absolute top-full left-0 mt-1 rounded-lg z-50 min-w-[150px]" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)",boxShadow:"var(--shadow-xl)"}}>
              <button
                onClick={() => {
                  gerarPDF();
                  setMenuRelatoriosAberto(false);
                }}
                style={{width:"100%",padding:"0.65rem 1rem",textAlign:"left",fontSize:"0.85rem",fontWeight:"600",background:"transparent",color:"var(--color-text)",border:"none",borderBottom:"1px solid var(--color-border)",cursor:"pointer",display:"flex",alignItems:"center",gap:"0.5rem",whiteSpace:"nowrap"}}
              >
                📊 Relatório Detalhado
              </button>
              <button
                onClick={() => {
                  gerarPDFResumido();
                  setMenuRelatoriosAberto(false);
                }}
                style={{width:"100%",padding:"0.65rem 1rem",textAlign:"left",fontSize:"0.85rem",fontWeight:"600",background:"transparent",color:"var(--color-text)",border:"none",borderBottom:"1px solid var(--color-border)",cursor:"pointer",display:"flex",alignItems:"center",gap:"0.5rem",whiteSpace:"nowrap"}}
              >
                📋 Fechamento Mensal
              </button>
              <button
                onClick={() => {
                  setMenuRelatoriosAberto(false);
                  setModalMovAberto(true);
                }}
                style={{width:"100%",padding:"0.65rem 1rem",textAlign:"left",fontSize:"0.85rem",fontWeight:"600",background:"transparent",color:"var(--color-text)",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:"0.5rem",whiteSpace:"nowrap"}}
              >
                📂 Movimentação do Irmão
              </button>
              <div style={{borderTop:"1px solid var(--color-border)",margin:"0.25rem 0"}} />
              <button
                onClick={() => {
                  setMenuRelatoriosAberto(false);
                  setModalArcoRealAberto(true);
                }}
                style={{width:"100%",padding:"0.65rem 1rem",textAlign:"left",fontSize:"0.85rem",fontWeight:"600",background:"transparent",color:"#2d6a9f",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:"0.5rem",whiteSpace:"nowrap"}}
              >
                🔺 Arco Real
              </button>
            </div>
          )}
        </div>

        <button
          onClick={calcularResumoIrmaos}
          style={{width:"7rem",height:"55px",padding:"0 0.75rem",background:"#10b981",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",fontWeight:"600",fontSize:"0.875rem",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",lineHeight:"1.3",whiteSpace:"nowrap"}}
        >
          <span>💰 Resumo</span>
          <span>dos Irmãos</span>
        </button>
        <button
          onClick={() => setModalAnaliseAberto(true)}
          className="w-28 h-[55px] px-3 text-sm text-white rounded-lg font-medium flex flex-col items-center justify-center leading-tight whitespace-nowrap" style={{background:"var(--color-accent)"}}
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
          className="w-28 h-[55px] px-3 text-sm rounded-lg font-medium flex flex-col items-center justify-center leading-tight whitespace-nowrap" style={{background:"var(--color-surface-3)",color:"var(--color-text)"}}
        >
          <span className="text-xl">{showValues ? '🙈' : '👁️'}</span>
          <span className="text-xs">{showValues ? 'Ocultar' : 'Mostrar'}</span>
        </button>
        
        {/* Badge de Total de Registros - ÚLTIMA POSIÇÃO */}
        <div className="border rounded-lg px-4 h-[55px] flex flex-col justify-center min-w-[100px] whitespace-nowrap" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}>
          <p style={{fontSize:"0.6rem",color:"var(--color-text-muted)",fontWeight:"600",lineHeight:"1.2"}}>Total de Registros</p>
          <p style={{fontSize:"1.1rem",fontWeight:"700",color:"var(--color-accent)",lineHeight:"1.2"}}>{totalRegistros}</p>
        </div>
      </div>

      {/* RESUMO FINANCEIRO - LAYOUT COM TRONCO AO LADO */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* COLUNA ESQUERDA: Cards principais (3/4 da largura) */}
        <div className="lg:col-span-3 space-y-3 flex flex-col justify-between">
          {/* LINHA 1: Resumo Geral */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
            <div className="border rounded-lg p-3 flex flex-col justify-center" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
              <p style={{fontSize:"0.7rem",color:"#8b5cf6",fontWeight:"600"}}>💰 Saldo Anterior</p>
              <p style={{fontSize:"1.1rem",fontWeight:"800",color:saldoAnterior>=0?"#8b5cf6":"#ef4444"}}>
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
              className="rounded-lg p-3 relative flex flex-col justify-center cursor-pointer transition"
              onDoubleClick={abrirDetalhesReceitasPagas}
              title="Clique duplo para ver detalhes"
              style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
              <p style={{fontSize:"0.7rem",color:"#10b981",fontWeight:"600"}}>📈 Receitas Pagas 🖱️</p>
              <p style={{fontSize:"1.1rem",fontWeight:"800",color:"#10b981"}}>{showValues ? formatarMoeda(resumo.receitas) : '••••••'}</p>
              <p className="text-[10px] mt-0.5">Total recebido</p>
              <span className="absolute bottom-1 right-2 text-[9px] font-medium">{formatarPeriodo()}</span>
            </div>
            
            <div className="border rounded-lg p-3 relative flex flex-col justify-center" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
              <p style={{fontSize:"0.7rem",color:"#ef4444",fontWeight:"600"}}>📉 Despesas Pagas</p>
              <p style={{fontSize:"1.1rem",fontWeight:"800",color:"#ef4444"}}>{showValues ? formatarMoeda(resumo.despesas) : '••••••'}</p>
              <p className="text-[10px] mt-0.5">Total pago</p>
              <span className="absolute bottom-1 right-2 text-[9px] font-medium">{formatarPeriodo()}</span>
            </div>
            
            <div className="border rounded-lg p-3 relative flex flex-col justify-center" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
              <p style={{fontSize:"0.7rem",color:"#06b6d4",fontWeight:"600"}}>📊 Saldo do Período</p>
              <p style={{fontSize:"1.1rem",fontWeight:"800",color:resumo.saldoPeriodo>=0?"#06b6d4":"#ef4444"}}>
                {showValues ? formatarMoeda(resumo.saldoPeriodo) : '••••••'}
              </p>
              <p className="text-[10px] mt-0.5">Receitas - Despesas</p>
              <span className="absolute bottom-1 right-2 text-[9px] font-medium">{formatarPeriodo()}</span>
            </div>
          </div>

          {/* LINHA 2: Detalhamento */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 flex-1">
          <div className="border-2 rounded-lg p-3" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <p style={{fontSize:"0.7rem",color:"#0ea5e9",fontWeight:"600"}}>🏦 Saldo Bancário</p>
            <p style={{fontSize:"1.1rem",fontWeight:"800",color:resumo.saldoBancario>=0?"#0ea5e9":"#ef4444"}}>
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
                style={{width:"100%",padding:"0.2rem 0.5rem",background:"#10b981",color:"#fff",border:"none",borderRadius:"var(--radius-sm)",fontSize:"0.65rem",fontWeight:"600",cursor:"pointer"}}
              >
                💰 Fazer Sangria
              </button>
            )}
          </div>

          <div className="border-2 rounded-lg p-3 col-span-2 md:col-span-1" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <p style={{fontSize:"0.7rem",color:"var(--color-accent)",fontWeight:"600"}}>💎 Saldo Total</p>
            <p style={{fontSize:"1.1rem",fontWeight:"800",color:resumo.saldoTotal>=0?"var(--color-accent)":"#ef4444"}}>
              {showValues ? formatarMoeda(resumo.saldoTotal) : "••••••"}
            </p>
            <p className="text-[10px] mt-0.5">
              Bancário + Caixa
            </p>
          </div>

          <div className="border border-yellow-200 rounded-lg p-3 relative" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <p style={{fontSize:"0.7rem",color:"#f59e0b",fontWeight:"600"}}>⏳ A Receber</p>
            <p style={{fontSize:"1.1rem",fontWeight:"800",color:"#f59e0b"}}>{showValues ? formatarMoeda(resumo.receitasPendentes) : "••••••"}</p>
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
              <p style={{fontSize:"1.5rem",fontWeight:"800",color:troncoTotalGlobal.total>=0?"var(--color-text)":"#ef4444",marginTop:"0.25rem"}}>
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
                <p style={{fontSize:"1.25rem",fontWeight:"800",color:troncoTotalGlobal.banco>=0?"var(--color-accent)":"#ef4444"}}>
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
                <p style={{fontSize:"1.25rem",fontWeight:"800",color:troncoTotalGlobal.especie>=0?"#10b981":"#ef4444"}}>
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
              <p style={{fontWeight:"600",color:"var(--color-text)"}}>
                {meses[filtros.mes - 1]}/{filtros.ano} está fechado
              </p>
              <p style={{fontSize:"0.85rem",color:"var(--color-text-muted)"}}>
                Novos lançamentos neste mês estão bloqueados.
                {mesesFechados.find(m => m.mes === filtros.mes && m.ano === filtros.ano)?.fechado_por && (
                  <span> Fechado por: {mesesFechados.find(m => m.mes === filtros.mes && m.ano === filtros.ano).fechado_por}</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={reabrirMes}
            className="px-4 py-2 text-white rounded-lg hover: text-sm font-medium"
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
            <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
              {filtros.mes > 0 && (
                <button
                  onClick={() => {
                    if (filtros.mes === 1) {
                      setFiltros({ ...filtros, mes: 12, ano: filtros.ano > 0 ? filtros.ano - 1 : filtros.ano });
                    } else {
                      setFiltros({ ...filtros, mes: filtros.mes - 1 });
                    }
                  }}
                  style={{padding:'6px 8px',borderRadius:'6px',border:'1px solid var(--color-border)',background:'var(--color-surface-2)',color:'var(--color-text)',fontWeight:'700',cursor:'pointer',flexShrink:0}}
                  title="Mês anterior"
                >‹</button>
              )}
            <select
              value={filtros.mes}
              onChange={(e) => setFiltros({ ...filtros, mes: parseInt(e.target.value) })}
              className="px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",flex:1}}
            >
              <option value={0}>Todos</option>
              {meses.map((mes, idx) => (
                <option key={idx} value={idx + 1}>{mes}</option>
              ))}
            </select>
              {filtros.mes > 0 && (
                <button
                  onClick={() => {
                    if (filtros.mes === 12) {
                      setFiltros({ ...filtros, mes: 1, ano: filtros.ano > 0 ? filtros.ano + 1 : filtros.ano });
                    } else {
                      setFiltros({ ...filtros, mes: filtros.mes + 1 });
                    }
                  }}
                  style={{padding:'6px 8px',borderRadius:'6px',border:'1px solid var(--color-border)',background:'var(--color-surface-2)',color:'var(--color-text)',fontWeight:'700',cursor:'pointer',flexShrink:0}}
                  title="Próximo mês"
                >›</button>
              )}
            </div>

          </div>

          {/* Filtro Ano */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Ano</label>
            <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
              {filtros.ano > 0 && (
                <button
                  onClick={() => setFiltros({ ...filtros, ano: filtros.ano - 1 })}
                  style={{padding:'6px 8px',borderRadius:'6px',border:'1px solid var(--color-border)',background:'var(--color-surface-2)',color:'var(--color-text)',fontWeight:'700',cursor:'pointer',flexShrink:0}}
                  title="Ano anterior"
                >‹</button>
              )}
              <select
                value={filtros.ano}
                onChange={(e) => setFiltros({ ...filtros, ano: parseInt(e.target.value) })}
                className="px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",flex:1}}
              >
                <option value={0}>Todos</option>
                {anosDisponiveis.map(ano => (
                  <option key={ano} value={ano}>{ano}</option>
                ))}
              </select>
              {filtros.ano > 0 && (
                <button
                  onClick={() => setFiltros({ ...filtros, ano: filtros.ano + 1 })}
                  style={{padding:'6px 8px',borderRadius:'6px',border:'1px solid var(--color-border)',background:'var(--color-surface-2)',color:'var(--color-text)',fontWeight:'700',cursor:'pointer',flexShrink:0}}
                  title="Próximo ano"
                >›</button>
              )}
            </div>
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
        irmaos={irmaoEditando ? [...irmaos, irmaoEditando] : irmaos}
        editando={editando}
        eventosComemorativos={eventosComemorativos}
        projetos={projetosAtivos}
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
                        style={{width:"1.1rem",height:"1.1rem",accentColor:"var(--color-accent)"}}
                      />
                      <div className="ml-3">
                        <span style={{fontSize:"0.875rem",fontWeight:"600",color:"var(--color-text)"}}>
                          📅 Este lançamento é uma MENSALIDADE?
                        </span>
                        <p style={{fontSize:"0.72rem",color:"var(--color-text-muted)",marginTop:"0.25rem"}}>
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
                      <span style={{color:"var(--color-accent)"}}>
                        {' '}de {irmaos.filter(i => i.periodicidade_pagamento === 'Mensal' || !i.periodicidade_pagamento).length} mensais
                      </span>
                    )})
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selecionarTodosIrmaos}
                      style={{fontSize:"0.875rem",color:"var(--color-accent)",background:"none",border:"none",cursor:"pointer",fontWeight:"600"}}
                    >
                      ✅ Selecionar Todos
                    </button>
                    <button
                      type="button"
                      onClick={limparSelecaoIrmaos}
                      style={{fontSize:"0.875rem",color:"#ef4444",background:"none",border:"none",cursor:"pointer",fontWeight:"600"}}
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
                            style={{width:"1rem",height:"1rem",accentColor:"#10b981"}}
                          />
                          <span className="ml-2 text-sm">
                            {irmao.nome}
                            {irmao.periodicidade_pagamento && irmao.periodicidade_pagamento !== 'Mensal' && (
                              <span style={{marginLeft:"0.25rem",fontSize:"0.72rem",color:"var(--color-accent)"}}>
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
                <p style={{fontSize:"0.875rem",color:"var(--color-text)"}}>
                  <strong>Total a lançar:</strong> R$ {(parseFloat(lancamentoIrmaos.valor || 0) * lancamentoIrmaos.irmaos_selecionados.length).toFixed(2)}
                  {' '}({lancamentoIrmaos.irmaos_selecionados.length} irmãos × R$ {parseFloat(lancamentoIrmaos.valor || 0).toFixed(2)})
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="px-6 py-2 text-white rounded-lg hover: font-medium"
                >
                  ✅ Criar Lançamentos
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMostrarModalIrmaos(false);
                    limparLancamentoIrmaos();
                  }}
                  style={{padding:"0.5rem 1.5rem",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"600"}}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL QUITAÇÃO INDIVIDUAL */}
      <ModalQuitacao
        isOpen={mostrarModalQuitacao}
        quitacaoForm={quitacaoForm}
        setQuitacaoForm={setQuitacaoForm}
        onClose={() => setMostrarModalQuitacao(false)}
        onSuccess={recarregarDados}
        showSuccess={showSuccess}
        showError={showError}
      />

      {/* MODAL QUITAÇÃO EM LOTE */}
      <ModalQuitacaoLote
        isOpen={mostrarModalQuitacaoLote}
        onClose={() => setMostrarModalQuitacaoLote(false)}
        lancamentos={lancamentos}
        onSuccess={recarregarDados}
        showSuccess={showSuccess}
        showError={showError}
      />

      {/* VIEW INADIMPLENTES */}
      {viewMode === 'inadimplentes' && (
        <div className="rounded-lg shadow p-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 style={{fontSize:"1.25rem",fontWeight:"700",color:"var(--color-text)"}}>⚠️ Irmãos com Pendências Financeiras</h3>
              <p style={{fontSize:"0.875rem",color:"var(--color-text-muted)"}}>Receitas pendentes (irmão deve) e Despesas pendentes (loja deve)</p>
            </div>
            {lancamentos.filter(l => l.status === 'pendente' && l.origem_tipo === 'Irmao').length > 0 && (
              <div style={{display:'flex',gap:'0.5rem',alignItems:'center',flexWrap:'wrap'}}>
                <button
                  onClick={() => gerarRelatorioDeTodosWrapper()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
                >
                  📄 Gerar PDFs de Todos
                </button>
                <label style={{display:'flex',alignItems:'center',gap:'0.4rem',fontSize:'0.82rem',color:'var(--color-text)',cursor:'pointer',padding:'0.4rem 0.75rem',background:'var(--color-surface-2)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)'}}>
                  <input type="checkbox" checked={inclPresenca} onChange={e=>setInclPresenca(e.target.checked)} style={{accentColor:'var(--color-accent)',width:'14px',height:'14px'}} />
                  Incluir presença
                </label>
                <button
                  onClick={() => setMostrarModalQuitacaoLote(true)}
                  className="px-4 py-2 text-white rounded-lg hover: font-medium"
                >
                  💰 Quitar em Lote
                </button>
                <button
                  onClick={() => setModalRenegocAberto(true)}
                  style={{padding:'0.5rem 1rem',background:'#7c3aed',color:'#fff',border:'none',borderRadius:'var(--radius-md)',fontWeight:'700',fontSize:'0.85rem',cursor:'pointer'}}
                >
                  🔄 Renegociar Dívida
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
                  const corCabecalho = saldoLiquido > 0 ? '' : saldoLiquido < 0 ? '' : 'bg-gray-500';

                  return (
                    <div key={irmaoData.irmaoId} style={{borderRadius:'var(--radius-xl)',overflow:'hidden',border:'1px solid var(--color-border)',background:'var(--color-surface)',marginBottom:'0.5rem'}}>
                      
                      {/* CABEÇALHO DO IRMÃO */}
                      <div style={{
                        background: saldoLiquido > 0 ? 'rgba(239,68,68,0.85)' : saldoLiquido < 0 ? 'rgba(59,130,246,0.85)' : 'var(--color-surface-2)',
                        padding:'1rem 1.25rem',
                        display:'flex', justifyContent:'space-between', alignItems:'center', gap:'1rem'
                      }}>
                        <div style={{flex:1}}>
                          <h4 style={{fontSize:'1.1rem',fontWeight:'700',color:'#fff',margin:0,display:'flex',alignItems:'center',gap:'0.5rem'}}>
                            👤 {irmaoData.irmaoNome}
                          </h4>
                          <p style={{color:'rgba(255,255,255,0.85)',fontSize:'0.8rem',margin:'0.2rem 0 0'}}>
                            {quantidadeLancamentos} {quantidadeLancamentos === 1 ? 'lançamento pendente' : 'lançamentos pendentes'}
                          </p>
                          {totalReceitas > 0 && totalDespesas > 0 && (
                            <button onClick={() => abrirModalCompensacao(irmaoData.irmaoId)}
                              style={{marginTop:'0.5rem',padding:'0.2rem 0.75rem',background:'rgba(255,255,255,0.2)',color:'#fff',border:'1px solid rgba(255,255,255,0.4)',borderRadius:'var(--radius-md)',fontSize:'0.78rem',fontWeight:'600',cursor:'pointer'}}>
                              🔄 Compensar Valores
                            </button>
                          )}
                        </div>
                        <div style={{textAlign:'right'}}>
                          {totalReceitas > 0 && (
                            <div style={{marginBottom:'0.25rem'}}>
                              <p style={{fontSize:'0.7rem',color:'rgba(255,255,255,0.8)',margin:0}}>Irmão deve:</p>
                              <p style={{fontSize:'1.3rem',fontWeight:'800',color:'#fff',margin:0}}>{formatarMoeda(totalReceitas)}</p>
                            </div>
                          )}
                          {totalDespesas > 0 && (
                            <div style={{marginBottom:'0.25rem'}}>
                              <p style={{fontSize:'0.7rem',color:'rgba(255,255,255,0.8)',margin:0}}>Loja deve:</p>
                              <p style={{fontSize:'1.3rem',fontWeight:'800',color:'#fff',margin:0}}>{formatarMoeda(totalDespesas)}</p>
                            </div>
                          )}
                          {totalReceitas > 0 && totalDespesas > 0 && (
                            <div style={{marginTop:'0.5rem',paddingTop:'0.5rem',borderTop:'1px solid rgba(255,255,255,0.3)'}}>
                              <p style={{fontSize:'0.7rem',color:'rgba(255,255,255,0.8)',margin:0}}>Saldo líquido:</p>
                              <p style={{fontSize:'1.5rem',fontWeight:'800',color:'#fff',margin:0}}>{formatarMoeda(Math.abs(saldoLiquido))}</p>
                              <p style={{fontSize:'0.7rem',color:'rgba(255,255,255,0.8)',margin:0}}>
                                {saldoLiquido > 0 ? '(Irmão deve)' : saldoLiquido < 0 ? '(Loja deve)' : '(Quitado)'}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* GRID DE LANÇAMENTOS */}
                      <div style={{padding:'0.75rem',display:'flex',flexDirection:'column',gap:'0.5rem'}}>
                        {irmaoData.lancamentos.map((lanc, index) => {
                          const ehReceita = lanc.categorias_financeiras?.tipo === 'receita';
                          const corBorda = ehReceita ? '#ef4444' : '#3b82f6';
                          const bgCard = index % 2 === 0 ? 'var(--color-surface-2)' : 'var(--color-surface)';
                          
                          return (
                            <div key={lanc.id} style={{
                              borderRadius:'var(--radius-lg)',
                              borderLeft:`4px solid ${corBorda}`,
                              background: bgCard,
                              border:`1px solid var(--color-border)`,
                              borderLeftColor: corBorda,
                              padding:'0.75rem 1rem',
                              display:'flex', justifyContent:'space-between', alignItems:'center', gap:'1rem'
                            }}>
                              {/* Info do lançamento */}
                              <div style={{flex:1,minWidth:0}}>
                                {/* Badges */}
                                <div style={{display:'flex',gap:'0.35rem',flexWrap:'wrap',marginBottom:'0.4rem'}}>
                                  <span style={{fontSize:'0.7rem',padding:'0.15rem 0.5rem',borderRadius:'999px',fontWeight:'700',
                                    background: ehReceita ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)',
                                    color: ehReceita ? '#ef4444' : '#3b82f6',
                                    border: `1px solid ${ehReceita ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.3)'}`}}>
                                    {ehReceita ? '📈 Receita' : '📉 Despesa'}
                                  </span>
                                  {lanc.categorias_financeiras?.nome && (
                                    <span style={{fontSize:'0.7rem',padding:'0.15rem 0.5rem',borderRadius:'999px',fontWeight:'600',
                                      background:'var(--color-accent-bg)',color:'var(--color-accent)',border:'1px solid var(--color-accent)'}}>
                                      {lanc.categorias_financeiras.nome}
                                    </span>
                                  )}
                                  {lanc.eh_parcelado && (
                                    <span style={{fontSize:'0.7rem',padding:'0.15rem 0.5rem',borderRadius:'999px',fontWeight:'600',
                                      background:'rgba(139,92,246,0.15)',color:'#8b5cf6',border:'1px solid rgba(139,92,246,0.3)'}}>
                                      📋 Parcela {lanc.parcela_numero}/{lanc.parcela_total}
                                    </span>
                                  )}
                                  {lanc.eh_mensalidade && (
                                    <span style={{fontSize:'0.7rem',padding:'0.15rem 0.5rem',borderRadius:'999px',fontWeight:'600',
                                      background:'rgba(245,158,11,0.15)',color:'#f59e0b',border:'1px solid rgba(245,158,11,0.3)'}}>
                                      📅 Mensalidade
                                    </span>
                                  )}
                                </div>
                                {/* Descrição */}
                                <p style={{fontWeight:'600',color:'var(--color-text)',margin:'0 0 0.3rem',fontSize:'0.875rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:'0.3rem'}}>
                                  <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lanc.descricao}</span>
                                  {lanc.evento_comemorativo_id && (
                                    <span title="Vinculado a Evento Comemorativo" style={{flexShrink:0,fontSize:'0.6rem',background:'rgba(201,168,76,0.15)',color:'#c9a84c',border:'1px solid rgba(201,168,76,0.35)',borderRadius:'999px',padding:'0 0.3rem',lineHeight:'1.5',fontWeight:700}}>🎉</span>
                                  )}
                                  {lanc.projeto_id && (
                                    <span title="Vinculado a Projeto" style={{flexShrink:0,fontSize:'0.6rem',background:'rgba(99,102,241,0.15)',color:'#6366f1',border:'1px solid rgba(99,102,241,0.35)',borderRadius:'999px',padding:'0 0.3rem',lineHeight:'1.5',fontWeight:700}}>🏗️</span>
                                  )}
                                </p>
                                {/* Datas */}
                                <p style={{fontSize:'0.75rem',color:'var(--color-text-muted)',margin:0}}>
                                  📅 {formatarDataBR(lanc.data_pagamento)}
                                  <span style={{margin:'0 0.4rem'}}>•</span>
                                  <span style={{color: ehReceita ? '#ef4444' : '#3b82f6', fontWeight:'600'}}>
                                    ⏰ Vence: {formatarDataBR(lanc.data_vencimento)}
                                  </span>
                                </p>
                              </div>
                              {/* Valor + botão */}
                              <div style={{textAlign:'right',flexShrink:0}}>
                                <p style={{fontSize:'1.25rem',fontWeight:'800',color: ehReceita ? '#ef4444' : '#3b82f6',margin:'0 0 0.4rem'}}>
                                  {formatarMoeda(parseFloat(lanc.valor))}
                                </p>
                                <div style={{display:'flex',gap:'0.35rem',flexWrap:'wrap',justifyContent:'flex-end'}}>
                                  <button onClick={() => abrirModalQuitacao(lanc)}
                                    style={{padding:'0.35rem 0.7rem',background:'rgba(16,185,129,0.15)',color:'#10b981',
                                      border:'1px solid rgba(16,185,129,0.4)',borderRadius:'var(--radius-md)',
                                      fontSize:'0.8rem',fontWeight:'700',cursor:'pointer'}}>
                                    💰 Quitar
                                  </button>
                                  <button onClick={() => editarLancamento(lanc)}
                                    style={{padding:'0.35rem 0.7rem',background:'rgba(99,102,241,0.15)',color:'#6366f1',
                                      border:'1px solid rgba(99,102,241,0.4)',borderRadius:'var(--radius-md)',
                                      fontSize:'0.8rem',fontWeight:'700',cursor:'pointer'}}>
                                    ✏️
                                  </button>
                                  <button onClick={() => {
                                      if (window.confirm('Excluir este lançamento permanentemente?')) excluirLancamento(lanc.id);
                                    }}
                                    style={{padding:'0.35rem 0.7rem',background:'rgba(239,68,68,0.15)',color:'#ef4444',
                                      border:'1px solid rgba(239,68,68,0.4)',borderRadius:'var(--radius-md)',
                                      fontSize:'0.8rem',fontWeight:'700',cursor:'pointer'}}>
                                    🗑
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* RODAPÉ */}
                      <div style={{padding:'0.75rem 1rem',borderTop:'1px solid var(--color-border)',display:'flex',justifyContent:'flex-end'}}>
                        <button onClick={() => gerarRelatorioIndividualWrapper(irmaoData.irmaoId, inclPresenca)}
                          style={{padding:'0.4rem 1rem',background:'var(--color-accent)',color:'#fff',
                            border:'none',borderRadius:'var(--radius-md)',fontSize:'0.82rem',fontWeight:'600',cursor:'pointer'}}>
                          📄 Gerar PDF Individual
                        </button>
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
                  className="px-3 py-1 border rounded-lg text-sm" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                >
                  <option value={20}>20</option>
                  <option value={30}>30</option>
                  <option value={40}>40</option>
                  <option value={50}>50</option>
                  <option value={9999}>Todos</option>
                </select>
                <span className="text-sm" style={{color:"var(--color-text-muted)"}}>registros</span>
              </div>
            </div>
            {lancamentos.filter(l => l.status === 'pendente').length > 0 && (
              <button
                onClick={() => setMostrarModalQuitacaoLote(true)}
                className="px-4 py-2 text-white rounded-lg hover: font-medium text-sm"
              >
                💰 Quitar em Lote
              </button>
            )}
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:'0.4rem',padding:'0.75rem'}}>
                {/* Cabeçalho das colunas */}
                <div style={{
                  display:'grid',
                  gridTemplateColumns:'90px 90px 80px 0.4fr 0.7fr 0.5fr 90px 80px 100px',
                  gap:'0.5rem',
                  padding:'0.3rem 0.9rem 0.3rem 1.3rem',
                  borderBottom:'2px solid var(--color-border)',
                  marginBottom:'0.25rem',
                }}>
                  <div style={{fontSize:'0.68rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.04em'}}>Competência</div>
                  <div style={{fontSize:'0.68rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.04em'}}>Lançamento</div>
                  <div style={{fontSize:'0.68rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.04em'}}>Tipo</div>
                  <div style={{fontSize:'0.68rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.04em'}}>Categoria</div>
                  <div style={{fontSize:'0.68rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.04em'}}>Descrição</div>
                  <div style={{fontSize:'0.68rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.04em'}}>Irmão</div>
                  <div style={{fontSize:'0.68rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.04em',textAlign:'right'}}>Valor</div>
                  <div style={{fontSize:'0.68rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.04em',textAlign:'center'}}>Status</div>
                  <div style={{fontSize:'0.68rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.04em',textAlign:'right'}}>Ações</div>
                </div>
                {lancamentos.slice(0, limiteRegistros).map((lanc, idx) => {
                  const ehReceita = lanc.categorias_financeiras?.tipo === 'receita';
                  const corBorda  = ehReceita ? '#10b981' : '#ef4444';
                  const badge     = obterBadgeStatus(lanc);
                  const nomeIrmao = (() => {
                    const n = lanc.irmaos?.nome || '';
                    const p = n.split(' ');
                    return p.length > 2 ? `${p[0]} ${p[1]}` : n;
                  })();
                  return (
                  <div key={lanc.id} style={{
                    borderRadius:'var(--radius-lg)',
                    borderLeft:`4px solid ${corBorda}`,
                    background: idx%2===0 ? 'var(--color-surface-2)' : 'var(--color-surface)',
                    border:'1px solid var(--color-border)',
                    borderLeftColor: corBorda,
                    padding:'0.6rem 0.9rem',
                    display:'grid',
                    gridTemplateColumns:'90px 90px 80px 0.4fr 0.7fr 0.5fr 90px 80px 100px',
                    alignItems:'center',
                    gap:'0.5rem',
                    minWidth:0,
                  }}>
                    {/* Competência */}
                    <div style={{minWidth:0}}>
                      <div style={{fontSize:'0.8rem',fontWeight:'600',color:lanc.status==='pago'?'#10b981':'var(--color-text)',whiteSpace:'nowrap'}}>
                        {formatarDataBR(lanc.status==='pago'?lanc.data_pagamento:lanc.data_vencimento)}
                      </div>
                      <div style={{fontSize:'0.68rem',color:'var(--color-text-muted)'}}>
                        {lanc.status==='pago'?'💰 Pgto':'📅 Venc'}
                      </div>
                    </div>
                    {/* Lançamento */}
                    <div style={{fontSize:'0.72rem',color:'var(--color-text-muted)',whiteSpace:'nowrap'}}>
                      {formatarDataBR(lanc.data_lancamento)}
                    </div>
                    {/* Tipo */}
                    <span style={{padding:'0.15rem 0.5rem',borderRadius:'999px',fontSize:'0.7rem',fontWeight:'700',
                      background:ehReceita?'rgba(16,185,129,0.15)':'rgba(239,68,68,0.15)',
                      color:ehReceita?'#10b981':'#ef4444',
                      border:`1px solid ${ehReceita?'rgba(16,185,129,0.3)':'rgba(239,68,68,0.3)'}`,
                      whiteSpace:'nowrap'}}>
                      {ehReceita?'📈 Receita':'📉 Despesa'}
                    </span>
                    {/* Categoria */}
                    <div style={{fontSize:'0.82rem',color:'var(--color-text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {lanc.categorias_financeiras?.nome}
                    </div>
                    {/* Descrição */}
                    <div style={{fontSize:'0.82rem',color:'var(--color-text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:'0.3rem'}}>
                      <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lanc.descricao}</span>
                      {lanc.evento_comemorativo_id && (
                        <span title="Vinculado a Evento Comemorativo" style={{flexShrink:0,fontSize:'0.65rem',background:'rgba(201,168,76,0.15)',color:'#c9a84c',border:'1px solid rgba(201,168,76,0.35)',borderRadius:'999px',padding:'0 0.35rem',lineHeight:'1.4',fontWeight:700}}>🎉</span>
                      )}
                      {lanc.projeto_id && (
                        <span title="Vinculado a Projeto" style={{flexShrink:0,fontSize:'0.65rem',background:'rgba(99,102,241,0.15)',color:'#6366f1',border:'1px solid rgba(99,102,241,0.35)',borderRadius:'999px',padding:'0 0.35rem',lineHeight:'1.4',fontWeight:700}}>🏗️</span>
                      )}
                    </div>
                    {/* Origem */}
                    <div style={{display:'flex',alignItems:'center',gap:'0.25rem',fontSize:'0.82rem',color:'var(--color-text)',overflow:'hidden',minWidth:0}}>
                      {lanc.origem_tipo==='Loja'
                        ? <><span style={{color:'var(--color-accent)'}}>🏛️</span><span>Loja</span></>
                        : <><span style={{color:'#8b5cf6',flexShrink:0}}>👤</span><span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{(nomeIrmao||'').split(' ').slice(0,2).join(' ')}</span></>}
                    </div>
                    {/* Valor */}
                    <div style={{textAlign:'right',minWidth:'80px'}}>
                      <div style={{fontSize:'0.9rem',fontWeight:'700',color:ehReceita?'#10b981':'#ef4444',whiteSpace:'nowrap'}}>
                        {formatarMoeda(parseFloat(lanc.valor))}
                      </div>
                      {lanc.tipo_pagamento && <div style={{fontSize:'0.68rem',color:'var(--color-text-muted)'}}>{lanc.tipo_pagamento}</div>}
                      {lanc.tem_pagamento_parcial && (
                        <div style={{fontSize:'0.68rem',color:'#10b981'}}>Pago: {formatarMoeda(lanc.total_pago_parcial)}</div>
                      )}
                    </div>
                    {/* Status + Parcela empilhados */}
                    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'0.2rem'}}>
                      <span style={{fontSize:'0.62rem',color:'var(--color-text-muted)',fontWeight:'600',whiteSpace:'nowrap'}}>
                        {badge.icone} {badge.texto}
                      </span>
                      {lanc.eh_parcelado && (
                        <span style={{fontSize:'0.62rem',padding:'0.1rem 0.4rem',borderRadius:'999px',fontWeight:'700',background:'rgba(99,102,241,0.15)',color:'#6366f1',border:'1px solid rgba(99,102,241,0.3)',whiteSpace:'nowrap'}}>
                          {lanc.parcela_numero}/{lanc.parcela_total}
                        </span>
                      )}
                    </div>
                    {/* Ações — ícones menores e compactos */}
                    <div style={{display:'flex',gap:'0.2rem',alignItems:'center',justifyContent:'flex-end'}}>
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
                            style={{fontSize:'0.85rem'}} className={`${
                              lancamentos.some(l => l.lancamento_principal_id === lanc.id && l.eh_pagamento_parcial)
                                ? ' cursor-not-allowed'
                                : 'color-indigo-placeholder'
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
                            style={{fontSize:'0.85rem',background:'none',border:'none',cursor:'pointer'}}
                            title="Fazer pagamento parcial"
                          >
                            💰
                          </button>
                        )}
                        
                        {/* Botão Quitar Total (apenas se não tiver pagamento parcial) */}
                        {lanc.status === 'pendente' && !lanc.eh_pagamento_parcial && (
                          <button
                            onClick={() => abrirModalQuitacao(lanc)}
                            style={{color:"#10b981",background:"none",border:"none",cursor:"pointer",fontSize:"0.85rem"}}
                            title="Quitar"
                          >
                            ✅
                          </button>
                        )}
                        
                        <button
                          onClick={() => editarLancamento(lanc)}
                          disabled={verificarMesBloqueado(lanc.data_pagamento || lanc.data_lancamento || lanc.data_vencimento)}
                          style={{color:verificarMesBloqueado(lanc.data_pagamento||lanc.data_lancamento||lanc.data_vencimento)?'var(--color-text-muted)':"var(--color-accent)",background:"none",border:"none",cursor:verificarMesBloqueado(lanc.data_pagamento||lanc.data_lancamento||lanc.data_vencimento)?"not-allowed":"pointer",fontSize:"0.85rem"}}
                          title={verificarMesBloqueado(lanc.data_pagamento || lanc.data_lancamento || lanc.data_vencimento) ? 'Mês fechado' : 'Editar'}
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => excluirLancamento(lanc.id)}
                          disabled={verificarMesBloqueado(lanc.data_pagamento || lanc.data_lancamento || lanc.data_vencimento)}
                          style={{color:verificarMesBloqueado(lanc.data_pagamento||lanc.data_lancamento||lanc.data_vencimento)?'var(--color-text-muted)':"#ef4444",background:"none",border:"none",cursor:verificarMesBloqueado(lanc.data_pagamento||lanc.data_lancamento||lanc.data_vencimento)?"not-allowed":"pointer",fontSize:"0.85rem"}}
                          title={verificarMesBloqueado(lanc.data_pagamento || lanc.data_lancamento || lanc.data_vencimento) ? 'Mês fechado' : 'Excluir'}
                        >
                          🗑️
                        </button>
                    </div>
                  </div>
                  );
                })}
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
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{background:"rgba(0,0,0,0.7)"}}>
          <div className="rounded-lg max-w-2xl w-full" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            {/* Header */}
            <div className="px-6 py-4 rounded-t-lg" style={{background:"var(--color-surface-2)",borderBottom:"1px solid var(--color-border)"}}>
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-bold" style={{color:"var(--color-text)"}}>💵 Receitas Pagas - Detalhamento</h3>
                  <p style={{fontSize:"0.875rem",color:"var(--color-text-muted)"}}>Distribuição por forma de pagamento</p>
                </div>
                <button
                  onClick={() => setModalReceitasPagasAberto(false)}
                  style={{background:"none",border:"none",cursor:"pointer",color:"var(--color-text-muted)",fontSize:"1.75rem",lineHeight:1}}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Corpo */}
            <div className="p-6 space-y-4">
              <div className="p-6 rounded-xl" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}>
                <p style={{fontSize:"1.1rem",marginBottom:"0.5rem",color:"var(--color-text)"}}>🏦 Recebido em Conta</p>
                <p style={{fontSize:"2.25rem",fontWeight:"800",color:"var(--color-accent)"}}>{formatarMoeda(detalhesReceitasPagas.conta)}</p>
                <p style={{fontSize:"0.875rem",marginTop:"0.25rem",color:"var(--color-text-muted)"}}>PIX, Transferência, Depósito, Cartão</p>
              </div>

              <div className="p-6 rounded-xl" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}>
                <p style={{fontSize:"1.1rem",marginBottom:"0.5rem",color:"var(--color-text)"}}>💵 Recebido em Dinheiro</p>
                <p style={{fontSize:"2.25rem",fontWeight:"800",color:"#10b981"}}>{formatarMoeda(detalhesReceitasPagas.dinheiro)}</p>
                <p style={{fontSize:"0.875rem",marginTop:"0.25rem",color:"var(--color-text-muted)"}}>Dinheiro físico</p>
              </div>

              <div className="p-6 rounded-xl" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}>
                <p style={{fontSize:"1.1rem",marginBottom:"0.5rem",color:"var(--color-text)"}}>💰 Total Recebido</p>
                <p style={{fontSize:"2.25rem",fontWeight:"800",color:"#8b5cf6"}}>
                  {formatarMoeda(detalhesReceitasPagas.conta + detalhesReceitasPagas.dinheiro)}
                </p>
                <p style={{fontSize:"0.875rem",marginTop:"0.25rem",color:"var(--color-text-muted)"}}>Soma de todas as receitas pagas</p>
              </div>

              <button
                onClick={() => setModalReceitasPagasAberto(false)}
                style={{width:"100%",padding:"0.75rem",borderRadius:"var(--radius-md)",fontWeight:"600",fontSize:"1rem",background:"var(--color-surface-2)",border:"1px solid var(--color-border)",color:"var(--color-text-muted)",cursor:"pointer"}}
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
            <div className="text-white px-6 py-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-bold" style={{color:"var(--color-text)"}}>⏰ Despesas Pendentes</h3>
                  <p style={{fontSize:"0.875rem",color:"var(--color-text-muted)"}}>Valores a pagar e a compensar</p>
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
                  <p style={{fontSize:"0.875rem",color:"#8b5cf6",fontWeight:"600",marginBottom:"0.25rem"}}>🔄 A Compensar</p>
                  <p style={{fontSize:"1.875rem",fontWeight:"800",color:"#8b5cf6"}}>
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
                                  <span style={{display:"block",fontSize:"0.7rem",color:"#ef4444",fontWeight:"600"}}>
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
                                <span style={{padding:"0.15rem 0.5rem",borderRadius:"var(--radius-sm)",color:"#ef4444",fontSize:"0.7rem",fontWeight:"600",background:"rgba(239,68,68,0.1)"}}>
                                  {lanc.categorias_financeiras?.nome}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm" style={{color:"var(--color-text)"}}>
                                {lanc.origem_tipo === 'Irmao' ? (
                                  <div>
                                    <p style={{fontWeight:"600",color:"#8b5cf6"}}>
                                      {irmaos.find(i => i.id === lanc.origem_irmao_id)?.nome || 'Irmão'}
                                    </p>
                                    <span style={{fontSize:"0.7rem",padding:"0.15rem 0.5rem",color:"#8b5cf6",borderRadius:"var(--radius-sm)",background:"rgba(139,92,246,0.1)"}}>
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
                                <p style={{fontSize:"1.1rem",fontWeight:"800",color:"#ef4444"}}>
                                  {formatarMoeda(lanc.valor)}
                                </p>
                              </td>
                              <td className="px-4 py-3 text-center" style={{color:"var(--color-text)"}}>
                                {vencido ? (
                                  <span style={{padding:"0.15rem 0.5rem",borderRadius:"var(--radius-sm)",color:"#ef4444",fontSize:"0.7rem",fontWeight:"700",background:"rgba(239,68,68,0.1)"}}>
                                    ⚠️ VENCIDO
                                  </span>
                                ) : (
                                  <span style={{padding:"0.15rem 0.5rem",borderRadius:"var(--radius-sm)",color:"#f59e0b",fontSize:"0.7rem",fontWeight:"700",background:"rgba(245,158,11,0.1)"}}>
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
                        <td style={{padding:"0.75rem 1rem",textAlign:"right",fontWeight:"800",fontSize:"1.25rem",color:"var(--color-text)"}}>
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
                    <p style={{fontWeight:"700",color:"var(--color-text)",marginBottom:"0.25rem"}}>Informações</p>
                    <ul style={{fontSize:"0.875rem",color:"var(--color-text-muted)"}}>
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
              <button onClick={() => { setModalSangriaAberto(false); setFormSangria({ valor: '', data: new Date().toISOString().split('T')[0], observacao: '', finalidade: 'deposito', categoria_despesa_id: '', descricao_despesa: '' }); }} className="hover: text-2xl font-bold">×</button>
            </div>
            <div className="border-2 border-emerald-300 rounded-lg p-4 mb-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
              <p className="text-sm text-emerald-700 font-semibold mb-1">💵 Disponível</p>
              <p className="text-3xl font-bold text-emerald-800">{formatarMoeda(resumo.caixaFisico)}</p>
            </div>
            <div className="space-y-4">

              {/* Finalidade */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{color:"var(--color-text-muted)"}}>Finalidade *</label>
                <div style={{display:'flex',gap:'0.5rem'}}>
                  {[['deposito','🏦 Depósito Bancário'],['despesa','💸 Despesa em Dinheiro']].map(([v,l]) => (
                    <button key={v} onClick={() => setFormSangria({...formSangria, finalidade: v})}
                      style={{flex:1,padding:'0.5rem',borderRadius:'var(--radius-md)',border:'1px solid',fontWeight:'600',fontSize:'0.82rem',cursor:'pointer',
                        background: formSangria.finalidade === v ? 'var(--color-accent)' : 'var(--color-surface-2)',
                        color: formSangria.finalidade === v ? '#fff' : 'var(--color-text)',
                        borderColor: formSangria.finalidade === v ? 'var(--color-accent)' : 'var(--color-border)'}}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div><label className="block text-sm font-medium mb-2" style={{color:"var(--color-text-muted)"}}>Valor *</label><input type="number" step="0.01" value={formSangria.valor} onChange={(e) => setFormSangria({ ...formSangria, valor: e.target.value })} style={{width:'100%',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',padding:'0.5rem 0.75rem',fontSize:'0.875rem'}} placeholder="0.00" /></div>
              <div><label className="block text-sm font-medium mb-2" style={{color:"var(--color-text-muted)"}}>Data *</label><input type="date" value={formSangria.data} onChange={(e) => setFormSangria({ ...formSangria, data: e.target.value })} style={{width:'100%',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',padding:'0.5rem 0.75rem',fontSize:'0.875rem'}} /></div>

              {/* Campos específicos de despesa */}
              {formSangria.finalidade === 'despesa' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{color:"var(--color-text-muted)"}}>Categoria da Despesa *</label>
                    <select value={formSangria.categoria_despesa_id} onChange={e => setFormSangria({...formSangria, categoria_despesa_id: e.target.value})}
                      style={{width:'100%',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',padding:'0.5rem 0.75rem',fontSize:'0.875rem'}}>
                      <option value="">-- Selecionar categoria --</option>
                      {categorias.filter(c => c.tipo === 'despesa').map(c => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{color:"var(--color-text-muted)"}}>Descrição *</label>
                    <input type="text" value={formSangria.descricao_despesa} onChange={e => setFormSangria({...formSangria, descricao_despesa: e.target.value})}
                      style={{width:'100%',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',padding:'0.5rem 0.75rem',fontSize:'0.875rem'}} placeholder="Ex: Compra de material de escritório" />
                  </div>
                </>
              )}

              <div><label className="block text-sm font-medium mb-2" style={{color:"var(--color-text-muted)"}}>Obs</label><textarea value={formSangria.observacao} onChange={(e) => setFormSangria({ ...formSangria, observacao: e.target.value })} style={{width:'100%',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',padding:'0.5rem 0.75rem',fontSize:'0.875rem'}} rows="2" /></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setModalSangriaAberto(false); setFormSangria({ valor: '', data: new Date().toISOString().split('T')[0], observacao: '', finalidade: 'deposito', categoria_despesa_id: '', descricao_despesa: '' }); }} className="flex-1 px-4 py-3 rounded-lg font-medium">Cancelar</button>
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

      {/* Modal Renegociação */}
      <ModalRenegociacao
        isOpen={modalRenegocAberto}
        onClose={() => setModalRenegocAberto(false)}
        irmaos={irmaos}
        showSuccess={showSuccess}
        showError={showError}
        onConcluido={() => carregarLancamentos()}
      />

      {/* Modal Arco Real */}
      <ArcoReal
        isOpen={modalArcoRealAberto}
        onClose={() => setModalArcoRealAberto(false)}
        showSuccess={showSuccess}
        showError={showError}
      />

      {/* Modal Relatório Movimentação do Irmão */}
      {modalMovAberto && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:'1rem'}}>
          <div style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-xl)',width:'100%',maxWidth:'480px',overflow:'hidden',boxShadow:'0 24px 64px rgba(0,0,0,0.3)'}}>
            <div style={{background:'var(--color-accent)',padding:'1rem 1.5rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <h3 style={{color:'#fff',fontWeight:'800',margin:0,fontSize:'1.05rem'}}>📂 Movimentação do Irmão</h3>
              <button onClick={()=>setModalMovAberto(false)} style={{background:'rgba(255,255,255,0.15)',border:'none',color:'#fff',borderRadius:'50%',width:'2rem',height:'2rem',cursor:'pointer',fontWeight:'700',fontSize:'1.1rem'}}>×</button>
            </div>
            <div style={{padding:'1.25rem',display:'flex',flexDirection:'column',gap:'0.75rem'}}>
              <div>
                <label style={{display:'block',fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',marginBottom:'0.3rem'}}>Irmão *</label>
                <select value={movForm.irmaoId} onChange={e=>setMovForm(f=>({...f,irmaoId:e.target.value}))}
                  style={{background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',padding:'0.5rem 0.75rem',fontSize:'0.875rem',width:'100%'}}>
                  <option value="">-- Selecionar irmão --</option>
                  {irmaos.filter(i=>i.situacao==='regular'||i.situacao==='licenciado').sort((a,b)=>a.nome.localeCompare(b.nome)).map(i=>(
                    <option key={i.id} value={i.id}>{i.nome}</option>
                  ))}
                </select>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
                <div>
                  <label style={{display:'block',fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',marginBottom:'0.3rem'}}>Data Início *</label>
                  <input type="date" value={movForm.dataInicio} onChange={e=>setMovForm(f=>({...f,dataInicio:e.target.value}))}
                    style={{background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',padding:'0.5rem 0.75rem',fontSize:'0.875rem',width:'100%'}} />
                </div>
                <div>
                  <label style={{display:'block',fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',marginBottom:'0.3rem'}}>Data Fim *</label>
                  <input type="date" value={movForm.dataFim} onChange={e=>setMovForm(f=>({...f,dataFim:e.target.value}))}
                    style={{background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',padding:'0.5rem 0.75rem',fontSize:'0.875rem',width:'100%'}} />
                </div>
              </div>
            </div>
            <div style={{padding:'1rem 1.25rem',borderTop:'1px solid var(--color-border)',display:'flex',gap:'0.5rem'}}>
              <button onClick={()=>setModalMovAberto(false)}
                style={{flex:1,padding:'0.6rem',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-lg)',fontWeight:'600',cursor:'pointer'}}>
                Cancelar
              </button>
              <button onClick={gerarRelatorioMovimentacaoWrapper}
                style={{flex:2,padding:'0.6rem',background:'var(--color-accent)',color:'#fff',border:'none',borderRadius:'var(--radius-lg)',fontWeight:'700',cursor:'pointer'}}>
                📂 Gerar Relatório
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
