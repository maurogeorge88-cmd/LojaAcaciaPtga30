import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// ========================================
// IMPORTAR COMPONENTES REFATORADOS
// ========================================
import { Dashboard } from './components/Dashboard';
import { CorpoAdmin } from './components/administracao/CorpoAdmin';
import { Usuarios } from './components/administracao/Usuarios';
import CadastrarIrmao from './components/irmaos/CadastrarIrmao';
import VisualizarIrmaos from './components/irmaos/VisualizarIrmaos';
import QuadroIrmaos from './components/irmaos/QuadroIrmaos';

// Balaustres
import CadastrarBalaustre from './components/balaustres/CadastrarBalaustre';
import VisualizarBalaustres from './components/balaustres/VisualizarBalaustres';
import ListaPresenca from './components/balaustres/ListaPresenca';

// Pranchas
import CadastrarPrancha from './components/pranchas/CadastrarPrancha';
import VisualizarPranchas from './components/pranchas/VisualizarPranchas';
import ProtocoloPranchas from './components/pranchas/ProtocoloPranchas';

// ========================================
// CONFIGURAÇÃO SUPABASE
// ========================================
const supabaseUrl = 'https://ypnvzjctyfdrkkrhskzs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwbnZ6amN0eWZkcmtrcmhza3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NTgxMzcsImV4cCI6MjA3OTMzNDEzN30.J5Jj7wudOhIAxy35DDBIWtr9yr9Lq3ABBRI9ZJ5z2pc';
export const supabase = createClient(supabaseUrl, supabaseKey);

const LOGO_URL = 'https://ypnvzjctyfdrkkrhskzs.supabase.co/storage/v1/object/public/LogoAcacia/LogoAcaciaPtga30.png';
const NOME_LOJA = 'A∴R∴L∴S∴ Acácia de Paranatinga nº 30';

// Função para tratar datas vazias
const tratarData = (data) => {
  if (!data || data === '' || data === 'undefined' || data === 'null') {
    return null;
  }
  return data;
};

// ========================================
// FUNÇÕES AUXILIARES
// ========================================
const calcularTempoMaconaria = (dataIniciacao) => {
  if (!dataIniciacao) return '';
  const inicio = new Date(dataIniciacao + 'T00:00:00');
  const hoje = new Date();
  let anos = hoje.getFullYear() - inicio.getFullYear();
  let meses = hoje.getMonth() - inicio.getMonth();
  if (meses < 0) { anos--; meses = 12 + meses; }
  return `${anos} ano(s) e ${meses} mês(es)`;
};

const calcularIdade = (dataNascimento) => {
  if (!dataNascimento) return '';
  const nascimento = new Date(dataNascimento + 'T00:00:00');
  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const m = hoje.getMonth() - nascimento.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }
  return `${idade} anos`;
};

const formatarData = (data) => {
  if (!data) return '-';
  const date = new Date(data + 'T00:00:00');
  return date.toLocaleDateString('pt-BR');
};

const formatarDataInput = (data) => {
  if (!data) return '';
  const date = new Date(data + 'T00:00:00');
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const obterDiaSemana = (data) => {
  if (!data) return '';
  const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const date = new Date(data + 'T00:00:00');
  return dias[date.getDay()];
};

// ========================================
// COMPONENTE PRINCIPAL
// ========================================
function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [permissoes, setPermissoes] = useState(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Estados de login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Estados de dados
  const [irmaos, setIrmaos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [balaustres, setBalaustres] = useState([]);
  const [balaustresFase4, setBalaustresFase4] = useState([]);
  const [pranchasFase4, setPranchasFase4] = useState([]);
  const [tiposSessao, setTiposSessao] = useState([]);
  const [cargosLoja, setCargosLoja] = useState([]);
  
  // Estados para Comissões
  const [comissoes, setComissoes] = useState([]);
  const [comissaoForm, setComissaoForm] = useState({
    nome: '',
    data_criacao: new Date().toISOString().split('T')[0],
    origem: 'interna',
    objetivo: '',
    data_inicio: new Date().toISOString().split('T')[0],
    data_fim: '',
    status: 'em_andamento',
    observacoes: ''
  });
  const [integrantesComissao, setIntegrantesComissao] = useState([]);
  const [modoEdicaoComissao, setModoEdicaoComissao] = useState(false);
  const [comissaoEditando, setComissaoEditando] = useState(null);
  const [mostrarDetalhesComissao, setMostrarDetalhesComissao] = useState(false);
  const [comissaoDetalhes, setComissaoDetalhes] = useState(null);

  // Estados para Biblioteca
  const [livros, setLivros] = useState([]);
  const [emprestimos, setEmprestimos] = useState([]);
  const [abaBiblioteca, setAbaBiblioteca] = useState('livros'); // livros | emprestimos | atrasados
  const [livroForm, setLivroForm] = useState({
    titulo: '',
    autor: '',
    editora: '',
    ano_publicacao: '',
    isbn: '',
    categoria: 'Ritualística',
    localizacao: '',
    quantidade_total: 1,
    quantidade_disponivel: 1,
    observacoes: ''
  });
  const [emprestimoForm, setEmprestimoForm] = useState({
    livro_id: '',
    irmao_id: '',
    data_emprestimo: new Date().toISOString().split('T')[0],
    data_devolucao_prevista: new Date(Date.now() + 15*24*60*60*1000).toISOString().split('T')[0],
    observacoes: ''
  });
  const [modoEdicaoLivro, setModoEdicaoLivro] = useState(false);
  const [livroEditando, setLivroEditando] = useState(null);
  const [modoEdicaoEmprestimo, setModoEdicaoEmprestimo] = useState(false);
  const [emprestimoEditando, setEmprestimoEditando] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [situacaoFilter, setSituacaoFilter] = useState('Regular,Licenciado');
  const [irmaoSelecionado, setIrmaoSelecionado] = useState(null);
  const [familiaresSelecionado, setFamiliaresSelecionado] = useState([]);
  const [mostrarDetalhes, setMostrarDetalhes] = useState(false);

  // Estados de edição
  const [modoEdicao, setModoEdicao] = useState(false);
  const [irmaoEditando, setIrmaoEditando] = useState(null);

  // Formulário de irmão
  const [irmaoForm, setIrmaoForm] = useState({
    cim: '', nome: '', cpf: '', rg: '', data_nascimento: '',
    estado_civil: '', profissao: '', formacao: '', situacao: 'Regular',
    naturalidade: '', endereco: '', cidade: '', celular: '',
    email: '', local_trabalho: '', cargo: '',
    data_iniciacao: '', data_elevacao: '', data_exaltacao: ''
  });

  // Lista de situações possíveis
  const situacoesPossiveis = [
    { valor: 'Regular', cor: 'bg-green-100 text-green-800 border-green-300' },
    { valor: 'Irregular', cor: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
    { valor: 'Licenciado', cor: 'bg-blue-100 text-blue-800 border-blue-300' },
    { valor: 'Suspenso', cor: 'bg-orange-100 text-orange-800 border-orange-300' },
    { valor: 'Desligado', cor: 'bg-gray-100 text-gray-800 border-gray-300' },
    { valor: 'Excluído', cor: 'bg-red-100 text-red-800 border-red-300' },
    { valor: 'Falecido', cor: 'bg-purple-100 text-purple-800 border-purple-300' },
    { valor: 'Ex-Ofício', cor: 'bg-indigo-100 text-indigo-800 border-indigo-300' }
  ];

  // Função para obter cor da situação
  const obterCorSituacao = (situacao) => {
    const sit = situacoesPossiveis.find(s => s.valor === situacao);
    return sit ? sit.cor : 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const [esposa, setEsposa] = useState({ nome: '', data_nascimento: '' });
  const [pai, setPai] = useState({ nome: '', data_nascimento: '', falecido: false, data_obito: '' });
  const [mae, setMae] = useState({ nome: '', data_nascimento: '', falecido: false, data_obito: '' });
  const [filhos, setFilhos] = useState([{ nome: '', data_nascimento: '', tipo: 'Filho', falecido: false, data_obito: '' }]);

  // Estados para Balaustre
  const [grauSelecionado, setGrauSelecionado] = useState('Aprendiz');
  const [balaustreForm, setBalaustreForm] = useState({
    grau_sessao: 'Aprendiz',
    numero_balaustre: '',
    data_sessao: '',
    dia_semana: '',
    tipo_sessao_id: '',
    ordem_dia: '',
    observacoes: ''
  });
  const [modoEdicaoBalaustre, setModoEdicaoBalaustre] = useState(false);
  const [balaustreEditando, setBalaustreEditando] = useState(null);

  // Estados para Usuários
  const [usuarioForm, setUsuarioForm] = useState({
    nome: '',
    email: '',
    senha: '',
    cargo: 'irmao',
    ativo: true
  });
  const [modoEdicaoUsuario, setModoEdicaoUsuario] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [permissoesDisponiveis, setPermissoesDisponiveis] = useState([]);

  // Estados para Pranchas Expedidas
  const [pranchas, setPranchas] = useState([]);
  const [pranchaForm, setPranchaForm] = useState({
    numero_prancha: '',
    data_prancha: '',
    assunto: '',
    destinatario: ''
  });
  const [searchPrancha, setSearchPrancha] = useState('');
  const [modoEdicaoPrancha, setModoEdicaoPrancha] = useState(false);
  const [pranchaEditando, setPranchaEditando] = useState(null);

  // Estados para Corpo Administrativo
  const [corpoAdmin, setCorpoAdmin] = useState([]);
  const [corpoAdminForm, setCorpoAdminForm] = useState({
    irmao_id: '',
    cargo: '',
    ano_exercicio: ''
  });
  const [anoFiltroAdmin, setAnoFiltroAdmin] = useState('');
  const [modoEdicaoCorpoAdmin, setModoEdicaoCorpoAdmin] = useState(false);
  const [corpoAdminEditando, setCorpoAdminEditando] = useState(null);

  // Lista fixa de cargos administrativos
  const cargosAdministrativos = [
    'Venerável Mestre',
    '1º Vigilante',
    '2º Vigilante',
    'Orador',
    'Secretário',
    'Tesoureiro',
    'Chanceler',
    'Mestre de Cerimônias',
    'Mestre de Harmonia',
    'Hospitaleiro',
    'Guarda do Templo',
    '1º Diácono',
    '2º Diácono',
    '1º Experto',
    '2º Experto',
    'Porta-Estandarte',
    'Porta-Espada',
    'Bibliotecário',
    'Orador Adjunto',
    'Secretário Adjunto',
    'Tesoureiro Adjunto'
  ];

  // ========================================
  // EFEITOS E CARREGAMENTOS
  // ========================================
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        loadUserData(session.user.email);
        loadIrmaos();
        loadBalaustresFase4();  // ← ADICIONAR
        loadPranchasFase4();    // ← ADICIONAR
        loadTiposSessao();
        loadCargosLoja();
        loadBalaustres();
        loadUsuarios();
        loadPermissoes();
        loadPranchas();
        loadCorpoAdmin();
        loadComissoes();
        loadLivros();
        loadEmprestimos();
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Atualizar dia da semana quando data mudar
  useEffect(() => {
    if (balaustreForm.data_sessao) {
      const diaSemana = obterDiaSemana(balaustreForm.data_sessao);
      setBalaustreForm(prev => ({ ...prev, dia_semana: diaSemana }));
    }
  }, [balaustreForm.data_sessao]);

  // Carregar próximo número quando grau mudar
  useEffect(() => {
    if (currentPage === 'balaustres' && !modoEdicaoBalaustre) {
      carregarProximoNumero(balaustreForm.grau_sessao);
    }
  }, [balaustreForm.grau_sessao, currentPage, modoEdicaoBalaustre]);

  // Filtrar balaustres por grau
  useEffect(() => {
    if (currentPage === 'balaustres') {
      loadBalaustres(grauSelecionado);
    }
  }, [grauSelecionado, currentPage]);

  // ========================================
  // FUNÇÕES HELPER PARA COMPONENTES
  // ========================================
  const showSuccess = (message) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const showError = (message) => {
    setError(message);
    setTimeout(() => setError(''), 5000);
  };

  // ========================================
  // FUNÇÕES DE CARREGAMENTO
  // ========================================
  const loadUserData = async (userEmail) => {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', userEmail)
      .single();

    if (data) {
      setUserData(data);
      setPermissoes({
        canEdit: ['administrador', 'secretario'].includes(data.cargo),
        canDelete: data.cargo === 'administrador',
        canManageUsers: data.cargo === 'administrador'
      });
    }
  };

  const loadIrmaos = async () => {
    const { data, error } = await supabase
      .from('irmaos')
      .select('*')
      .order('nome');

  const loadBalaustresFase4 = async () => {
  const { data, error } = await supabase
    .from('balaustres')
    .select('*')
    .order('data', { ascending: false });
  
  if (data) setBalaustresFase4(data);
  if (error) console.error('Erro ao carregar balaustres:', error);
};

const loadPranchasFase4 = async () => {
  const { data, error } = await supabase
    .from('pranchas_expedidas')
    .select('*')
    .order('data', { ascending: false });
  
  if (data) setPranchasFase4(data);
  if (error) console.error('Erro ao carregar pranchas:', error);
};
    
    
    if (data) {
      // Adicionar situacao padrão para registros que não tem
      const irmaosComSituacao = data.map(irmao => ({
        ...irmao,
        situacao: irmao.situacao || 'Regular'
      }));
      setIrmaos(irmaosComSituacao);
    }
    if (error) console.error('Erro ao carregar irmãos:', error);
  };

  const loadTiposSessao = async () => {
    try {
      console.log('🔍 Carregando tipos de sessão...');
      
      const { data, error } = await supabase
        .from('tipos_sessao')
        .select('*')
        .eq('ativo', true)
        .order('nome');
      
      console.log('📊 Tipos de sessão:', { data, error });
      
      if (error) {
        console.error('❌ Erro ao carregar tipos de sessão:', error);
        return;
      }
      
      if (data) {
        console.log('✅ Tipos de sessão carregados:', data.length, 'tipos');
        setTiposSessao(data);
      }
    } catch (err) {
      console.error('❌ Exceção ao carregar tipos de sessão:', err);
    }
  };

  const loadCargosLoja = async () => {
    const { data, error } = await supabase
      .from('cargos_loja')
      .select('*')
      .eq('ativo', true)
      .order('ordem');
    
    if (data) setCargosLoja(data);
    if (error) console.error('Erro ao carregar cargos:', error);
  };

  const loadUsuarios = async () => {
    try {
      console.log('🔍 Carregando usuários...');
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .order('nome');
      
      if (error) {
        console.error('❌ Erro ao carregar usuários:', error);
        return;
      }
      
      if (data) {
        console.log('✅ Usuários carregados:', data.length);
        setUsuarios(data);
      }
    } catch (err) {
      console.error('❌ Exceção ao carregar usuários:', err);
    }
  };

  const loadPermissoes = async () => {
    try {
      console.log('🔍 Carregando permissões...');
      const { data, error } = await supabase
        .from('permissoes')
        .select('*')
        .order('cargo');
      
      if (error) {
        console.error('❌ Erro ao carregar permissões:', error);
        return;
      }
      
      if (data) {
        console.log('✅ Permissões carregadas:', data.length);
        setPermissoesDisponiveis(data);
      }
    } catch (err) {
      console.error('❌ Exceção ao carregar permissões:', err);
    }
  };

  const loadPranchas = async () => {
    try {
      console.log('🔍 Carregando pranchas expedidas...');
      const { data, error } = await supabase
        .from('pranchas_expedidas')
        .select('*')
        .order('data_prancha', { ascending: false });
      
      if (error) {
        console.error('❌ Erro ao carregar pranchas:', error);
        return;
      }
      
      if (data) {
        console.log('✅ Pranchas carregadas:', data.length);
        setPranchas(data);
      }
    } catch (err) {
      console.error('❌ Exceção ao carregar pranchas:', err);
    }
  };

  const loadCorpoAdmin = async () => {
    try {
      console.log('🔍 Carregando corpo administrativo...');
      const { data, error } = await supabase
        .from('corpo_administrativo')
        .select('*')
        .order('ano_exercicio', { ascending: false });
      
      if (error) {
        console.error('❌ Erro ao carregar corpo admin:', error);
        return;
      }
      
      if (data) {
        // Buscar dados dos irmãos separadamente
        const irmaoIds = [...new Set(data.map(ca => ca.irmao_id))];
        const { data: irmaosData } = await supabase
          .from('irmaos')
          .select('id, nome, cim')
          .in('id', irmaoIds);
        
        // Fazer join manual
        const corpoComIrmaos = data.map(ca => ({
          ...ca,
          irmao: irmaosData?.find(i => i.id === ca.irmao_id)
        }));
        
        console.log('✅ Corpo administrativo carregado:', corpoComIrmaos.length);
        setCorpoAdmin(corpoComIrmaos);
      }
    } catch (err) {
      console.error('❌ Exceção ao carregar corpo admin:', err);
    }
  };

  const loadBalaustres = async (grau = null) => {
    try {
      console.log('🔍 Carregando balaustres para o grau:', grau || 'todos');
      
      // Buscar balaustres SEM o JOIN
      let query = supabase
        .from('balaustres')
        .select('*')
        .order('numero_balaustre', { ascending: false });

      if (grau) {
        query = query.eq('grau_sessao', grau);
      }

      const { data: balaustreData, error: balaustreError } = await query;
      
      if (balaustreError) {
        console.error('❌ Erro ao carregar balaustres:', balaustreError);
        setError('Erro ao carregar balaustres: ' + balaustreError.message);
        return;
      }
      
      console.log('📊 Balaustres encontrados:', balaustreData?.length || 0);
      
      if (!balaustreData || balaustreData.length === 0) {
        console.log('⚠️ Nenhum balaustre encontrado');
        setBalaustres([]);
        return;
      }

      // Buscar tipos de sessão separadamente
      const { data: tiposData, error: tiposError } = await supabase
        .from('tipos_sessao')
        .select('*');
      
      if (tiposError) {
        console.error('⚠️ Erro ao carregar tipos de sessão:', tiposError);
      }

      // Fazer o "join" manualmente
      const balaustreComTipos = balaustreData.map(bal => {
        const tipo = tiposData?.find(t => t.id === bal.tipo_sessao_id);
        return {
          ...bal,
          tipos_sessao: tipo ? { id: tipo.id, nome: tipo.nome } : null
        };
      });

      console.log('✅ Balaustres processados:', balaustreComTipos.length);
      setBalaustres(balaustreComTipos);
      
    } catch (err) {
      console.error('❌ Exceção ao carregar balaustres:', err);
      setError('Erro inesperado ao carregar balaustres');
      setBalaustres([]);
    }
  };

  const carregarProximoNumero = async (grau) => {
    try {
      console.log('🔢 Carregando próximo número para grau:', grau);
      
      const { data, error } = await supabase
        .rpc('get_proximo_numero_balaustre', { grau });
      
      console.log('📊 Próximo número:', { data, error });
      
      if (data !== null && data !== undefined) {
        console.log('✅ Próximo número definido:', data);
        setBalaustreForm(prev => ({ ...prev, numero_balaustre: data }));
      } else {
        console.log('⚠️ Próximo número não retornado, usando 1');
        setBalaustreForm(prev => ({ ...prev, numero_balaustre: 1 }));
      }
      
      if (error) {
        console.error('❌ Erro ao carregar próximo número:', error);
      }
    } catch (err) {
      console.error('❌ Exceção ao carregar próximo número:', err);
      setBalaustreForm(prev => ({ ...prev, numero_balaustre: 1 }));
    }
  };

  // ========================================
  // FUNÇÕES PARA COMISSÕES
  // ========================================
  const loadComissoes = async () => {
    try {
      console.log('🔄 Carregando comissões...');
      
      const { data, error } = await supabase
        .from('comissoes')
        .select(`
          *,
          comissoes_integrantes (
            id,
            funcao,
            ativo,
            irmao_id,
            irmaos (nome, cim)
          )
        `)
        .order('data_criacao', { ascending: false });

      if (error) {
        console.error('❌ Erro ao carregar comissões:', error);
        throw error;
      }
      
      console.log('✅ Comissões carregadas:', data?.length || 0);
      console.log('Dados:', data);
      
      setComissoes(data || []);
    } catch (error) {
      console.error('❌ Erro ao carregar comissões:', error);
      setComissoes([]);
    }
  };

  const salvarComissao = async () => {
    try {
      setLoading(true);

      // Validação
      if (!comissaoForm.nome || !comissaoForm.objetivo || !comissaoForm.data_inicio) {
        setError('Preencha todos os campos obrigatórios!');
        setTimeout(() => setError(''), 5000);
        setLoading(false);
        return;
      }

      let comissaoId;

      // Preparar dados sem campos vazios problemáticos
      const dadosComissao = {
        nome: comissaoForm.nome.trim(),
        data_criacao: comissaoForm.data_criacao,
        origem: comissaoForm.origem,
        objetivo: comissaoForm.objetivo.trim(),
        data_inicio: comissaoForm.data_inicio,
        status: comissaoForm.status
      };

      // Adicionar data_fim apenas se tiver valor
      if (comissaoForm.data_fim && comissaoForm.data_fim !== '') {
        dadosComissao.data_fim = comissaoForm.data_fim;
      }

      // Adicionar observacoes apenas se tiver valor
      if (comissaoForm.observacoes && comissaoForm.observacoes.trim() !== '') {
        dadosComissao.observacoes = comissaoForm.observacoes.trim();
      }

      if (modoEdicaoComissao && comissaoEditando) {
        // EDITAR COMISSÃO EXISTENTE
        console.log('Editando comissão ID:', comissaoEditando.id);
        console.log('Dados para atualizar:', dadosComissao);
        
        const { error: errorUpdate } = await supabase
          .from('comissoes')
          .update(dadosComissao)
          .eq('id', comissaoEditando.id);
        
        if (errorUpdate) {
          console.error('Erro ao atualizar:', errorUpdate);
          throw errorUpdate;
        }
        
        comissaoId = comissaoEditando.id;
        
        // Deletar integrantes antigos
        console.log('Deletando integrantes antigos...');
        const { error: errorDelete } = await supabase
          .from('comissoes_integrantes')
          .delete()
          .eq('comissao_id', comissaoId);
        
        if (errorDelete) {
          console.error('Erro ao deletar integrantes:', errorDelete);
          throw errorDelete;
        }
      } else {
        // CRIAR NOVA COMISSÃO
        console.log('Criando nova comissão');
        console.log('Dados:', dadosComissao);
        
        const { data, error: errorInsert } = await supabase
          .from('comissoes')
          .insert([dadosComissao])
          .select()
          .single();
        
        if (errorInsert) {
          console.error('Erro ao inserir:', errorInsert);
          throw errorInsert;
        }
        
        comissaoId = data.id;
        console.log('Comissão criada com ID:', comissaoId);
      }

      // INSERIR INTEGRANTES
      if (integrantesComissao.length > 0) {
        console.log('Inserindo', integrantesComissao.length, 'integrantes...');
        
        const integrantesParaInserir = integrantesComissao.map(int => ({
          comissao_id: comissaoId,
          irmao_id: int.irmao_id,
          funcao: int.funcao || 'Membro',
          ativo: true
        }));

        console.log('Integrantes a inserir:', integrantesParaInserir);

        const { error: errorIntegrantes } = await supabase
          .from('comissoes_integrantes')
          .insert(integrantesParaInserir);
        
        if (errorIntegrantes) {
          console.error('Erro ao inserir integrantes:', errorIntegrantes);
          throw errorIntegrantes;
        }
      }

      console.log('✅ Comissão salva com sucesso!');
      setSuccessMessage(modoEdicaoComissao ? '✅ Comissão atualizada com sucesso!' : '✅ Comissão cadastrada com sucesso!');
      setTimeout(() => setSuccessMessage(''), 3000);

      // Limpar formulário
      setComissaoForm({
        nome: '',
        data_criacao: new Date().toISOString().split('T')[0],
        origem: 'interna',
        objetivo: '',
        data_inicio: new Date().toISOString().split('T')[0],
        data_fim: '',
        status: 'em_andamento',
        observacoes: ''
      });
      setIntegrantesComissao([]);
      setModoEdicaoComissao(false);
      setComissaoEditando(null);
      
      // Recarregar lista
      loadComissoes();
      
    } catch (err) {
      console.error('❌ Erro ao salvar comissão:', err);
      setError('Erro ao salvar comissão: ' + (err.message || 'Erro desconhecido'));
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const deletarComissao = async (comissaoId) => {
    if (!window.confirm('Tem certeza que deseja deletar esta comissão?')) return;
    try {
      setLoading(true);
      const { error } = await supabase
        .from('comissoes')
        .delete()
        .eq('id', comissaoId);
      if (error) throw error;
      setSuccessMessage('Comissão deletada!');
      setTimeout(() => setSuccessMessage(''), 3000);
      loadComissoes();
    } catch (err) {
      console.error('Erro ao deletar:', err);
      setError('Erro ao deletar comissão');
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // FUNÇÕES PARA BIBLIOTECA
  // ========================================
  const loadLivros = async () => {
    try {
      const { data, error } = await supabase
        .from('biblioteca_livros')
        .select('*')
        .order('titulo');
      if (error) throw error;
      setLivros(data || []);
    } catch (error) {
      console.error('Erro ao carregar livros:', error);
      setLivros([]);
    }
  };

  const loadEmprestimos = async () => {
    try {
      const { data, error } = await supabase
        .from('biblioteca_emprestimos')
        .select(`
          *,
          biblioteca_livros (titulo, autor),
          irmaos (nome, cim)
        `)
        .eq('status', 'emprestado')
        .order('data_devolucao_prevista');
      if (error) throw error;
      setEmprestimos(data || []);
    } catch (error) {
      console.error('Erro ao carregar empréstimos:', error);
      setEmprestimos([]);
    }
  };

  const salvarLivro = async () => {
    try {
      setLoading(true);
      
      // Preparar dados sem campos vazios
      const dadosLivro = {
        titulo: livroForm.titulo.trim(),
        categoria: livroForm.categoria,
        quantidade_total: parseInt(livroForm.quantidade_total) || 1,
        quantidade_disponivel: modoEdicaoLivro 
          ? parseInt(livroForm.quantidade_disponivel) 
          : parseInt(livroForm.quantidade_total) || 1
      };
      
      // Adicionar campos opcionais apenas se tiverem valor
      if (livroForm.autor?.trim()) dadosLivro.autor = livroForm.autor.trim();
      if (livroForm.editora?.trim()) dadosLivro.editora = livroForm.editora.trim();
      if (livroForm.ano_publicacao) dadosLivro.ano_publicacao = parseInt(livroForm.ano_publicacao);
      if (livroForm.isbn?.trim()) dadosLivro.isbn = livroForm.isbn.trim();
      if (livroForm.localizacao?.trim()) dadosLivro.localizacao = livroForm.localizacao.trim();
      if (livroForm.observacoes?.trim()) dadosLivro.observacoes = livroForm.observacoes.trim();
      
      if (modoEdicaoLivro && livroEditando) {
        const { error } = await supabase
          .from('biblioteca_livros')
          .update(dadosLivro)
          .eq('id', livroEditando.id);
        if (error) throw error;
        setSuccessMessage('Livro atualizado!');
      } else {
        const { error } = await supabase
          .from('biblioteca_livros')
          .insert([dadosLivro]);
        if (error) throw error;
        setSuccessMessage('Livro cadastrado!');
      }
      setTimeout(() => setSuccessMessage(''), 3000);
      setLivroForm({
        titulo: '',
        autor: '',
        editora: '',
        ano_publicacao: '',
        isbn: '',
        categoria: 'Ritualística',
        localizacao: '',
        quantidade_total: 1,
        quantidade_disponivel: 1,
        observacoes: ''
      });
      setModoEdicaoLivro(false);
      setLivroEditando(null);
      loadLivros();
    } catch (err) {
      console.error('Erro ao salvar livro:', err);
      setError('Erro ao salvar livro: ' + err.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const deletarLivro = async (livroId) => {
    if (!window.confirm('Tem certeza que deseja deletar este livro?')) return;
    try {
      setLoading(true);
      const { error } = await supabase
        .from('biblioteca_livros')
        .delete()
        .eq('id', livroId);
      if (error) throw error;
      setSuccessMessage('Livro deletado!');
      setTimeout(() => setSuccessMessage(''), 3000);
      loadLivros();
    } catch (err) {
      console.error('Erro ao deletar:', err);
      setError('Erro ao deletar livro');
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const registrarEmprestimo = async () => {
    try {
      setLoading(true);
      
      if (modoEdicaoEmprestimo && emprestimoEditando) {
        // Atualizar empréstimo existente
        const { error } = await supabase
          .from('biblioteca_emprestimos')
          .update({
            data_devolucao_prevista: emprestimoForm.data_devolucao_prevista,
            observacoes: emprestimoForm.observacoes
          })
          .eq('id', emprestimoEditando.id);
        
        if (error) throw error;
        setSuccessMessage('Empréstimo atualizado!');
        setModoEdicaoEmprestimo(false);
        setEmprestimoEditando(null);
      } else {
        // Novo empréstimo
        const { data, error } = await supabase
          .rpc('registrar_emprestimo_livro', {
            p_livro_id: parseInt(emprestimoForm.livro_id),
            p_irmao_id: parseInt(emprestimoForm.irmao_id),
            p_data_devolucao_prevista: emprestimoForm.data_devolucao_prevista
          });
        if (error) throw error;
        setSuccessMessage('Empréstimo registrado!');
      }
      
      setTimeout(() => setSuccessMessage(''), 3000);
      setEmprestimoForm({
        livro_id: '',
        irmao_id: '',
        data_emprestimo: new Date().toISOString().split('T')[0],
        data_devolucao_prevista: new Date(Date.now() + 15*24*60*60*1000).toISOString().split('T')[0],
        observacoes: ''
      });
      loadEmprestimos();
      loadLivros();
    } catch (err) {
      console.error('Erro ao registrar empréstimo:', err);
      setError(err.message || 'Erro ao registrar empréstimo');
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const registrarDevolucao = async (emprestimoId) => {
    if (!window.confirm('Confirma a devolução deste livro?')) return;
    try {
      setLoading(true);
      const { error } = await supabase
        .rpc('registrar_devolucao_livro', {
          p_emprestimo_id: emprestimoId,
          p_data_devolucao: new Date().toISOString().split('T')[0]
        });
      if (error) throw error;
      setSuccessMessage('Devolução registrada!');
      setTimeout(() => setSuccessMessage(''), 3000);
      loadEmprestimos();
      loadLivros();
    } catch (err) {
      console.error('Erro ao registrar devolução:', err);
      setError('Erro ao registrar devolução');
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // FUNÇÕES DE AUTENTICAÇÃO
  // ========================================
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      const { data: userData } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', email)
        .single();

      if (!userData?.ativo) {
        await supabase.auth.signOut();
        throw new Error('Usuário inativo. Entre em contato com o administrador.');
      }

      setSession(data.session);
      loadUserData(email);
      loadIrmaos();
      loadTiposSessao();
      loadCargosLoja();
      loadBalaustres();
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUserData(null);
    setPermissoes(null);
    setCurrentPage('dashboard');
  };

  // ========================================
  // FUNÇÕES PARA IRMÃOS
  // ========================================
  const handleSubmitIrmao = async () => {
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      // Preparar dados do irmão com datas tratadas
      const dadosIrmao = {
        ...irmaoForm,
        data_nascimento: tratarData(irmaoForm.data_nascimento),
        data_iniciacao: tratarData(irmaoForm.data_iniciacao),
        data_elevacao: tratarData(irmaoForm.data_elevacao),
        data_exaltacao: tratarData(irmaoForm.data_exaltacao)
      };

      const { data: irmaoData, error: irmaoError } = await supabase
        .from('irmaos')
        .insert([dadosIrmao])
        .select()
        .single();

      if (irmaoError) throw irmaoError;

      console.log('✅ Irmão cadastrado:', irmaoData.id);

      // Salvar esposa na tabela esposas
      console.log('🔍 Verificando esposa para salvar:', esposa);
      if (esposa.nome && esposa.nome.trim() !== '') {
        console.log('💾 Salvando esposa:', esposa.nome);
        const { error: esposaError } = await supabase.from('esposas').insert([{
          irmao_id: irmaoData.id,
          nome: esposa.nome,
          data_nascimento: tratarData(esposa.data_nascimento)
        }]);
        if (esposaError) {
          console.error('❌ Erro ao salvar esposa:', esposaError);
          console.error('❌ Dados que tentei salvar:', { irmao_id: irmaoData.id, nome: esposa.nome });
        } else {
          console.log('✅ Esposa salva com sucesso:', esposa.nome);
        }
      } else {
        console.log('⚠️ Esposa sem nome, não salvando');
      }

      // Salvar pai na tabela pais
      console.log('🔍 Verificando pai para salvar:', pai);
      if (pai.nome && pai.nome.trim() !== '') {
        console.log('💾 Salvando pai:', pai.nome);
        const { error: paiError } = await supabase.from('pais').insert([{
          irmao_id: irmaoData.id,
          tipo: 'pai',
          nome: pai.nome,
          data_nascimento: tratarData(pai.data_nascimento),
          falecido: pai.falecido || false,
          data_obito: tratarData(pai.data_obito)
        }]);
        if (paiError) {
          console.error('❌ Erro ao salvar pai:', paiError);
          console.error('❌ Dados que tentei salvar:', { irmao_id: irmaoData.id, tipo: 'pai', nome: pai.nome });
        } else {
          console.log('✅ Pai salvo com sucesso:', pai.nome);
        }
      } else {
        console.log('⚠️ Pai sem nome, não salvando');
      }

      // Salvar mãe na tabela pais
      console.log('🔍 Verificando mãe para salvar:', mae);
      if (mae.nome && mae.nome.trim() !== '') {
        console.log('💾 Salvando mãe:', mae.nome);
        const { error: maeError } = await supabase.from('pais').insert([{
          irmao_id: irmaoData.id,
          tipo: 'mae',
          nome: mae.nome,
          data_nascimento: tratarData(mae.data_nascimento),
          falecido: mae.falecido || false,
          data_obito: tratarData(mae.data_obito)
        }]);
        if (maeError) {
          console.error('❌ Erro ao salvar mãe:', maeError);
          console.error('❌ Dados que tentei salvar:', { irmao_id: irmaoData.id, tipo: 'mae', nome: mae.nome });
        } else {
          console.log('✅ Mãe salva com sucesso:', mae.nome);
        }
      } else {
        console.log('⚠️ Mãe sem nome, não salvando');
      }

      // Salvar filhos na tabela filhos
      console.log('📋 Total de filhos a salvar:', filhos.length);
      console.log('📋 Dados dos filhos:', JSON.stringify(filhos, null, 2));
      
      for (let i = 0; i < filhos.length; i++) {
        const filho = filhos[i];
        console.log(`🔍 Verificando filho ${i + 1}:`, filho);
        
        if (filho.nome && filho.nome.trim() !== '') {
          console.log(`💾 Salvando filho ${i + 1}: ${filho.nome}`);
          
          const { error: filhoError } = await supabase.from('filhos').insert([{
            irmao_id: irmaoData.id,
            nome: filho.nome,
            data_nascimento: tratarData(filho.data_nascimento),
            falecido: filho.falecido || false,
            data_obito: tratarData(filho.data_obito)
          }]);
          
          if (filhoError) {
            console.error(`❌ Erro ao salvar filho ${i + 1}:`, filhoError);
          } else {
            console.log(`✅ Filho ${i + 1} salvo com sucesso: ${filho.nome}`);
          }
        } else {
          console.log(`⚠️ Filho ${i + 1} sem nome, pulando...`);
        }
      }

      setSuccessMessage('Irmão cadastrado com sucesso!');
      loadIrmaos();
      limparFormulario();
      
      setTimeout(() => {
        setSuccessMessage('');
        setCurrentPage('visualizar');
      }, 2000);

    } catch (error) {
      setError('Erro ao salvar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAtualizarIrmao = async () => {
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      // Preparar dados do irmão com datas tratadas
      const dadosIrmao = {
        ...irmaoForm,
        data_nascimento: tratarData(irmaoForm.data_nascimento),
        data_iniciacao: tratarData(irmaoForm.data_iniciacao),
        data_elevacao: tratarData(irmaoForm.data_elevacao),
        data_exaltacao: tratarData(irmaoForm.data_exaltacao)
      };

      const { error: irmaoError } = await supabase
        .from('irmaos')
        .update(dadosIrmao)
        .eq('id', irmaoEditando.id);

      if (irmaoError) throw irmaoError;

      console.log('✅ Irmão atualizado:', irmaoEditando.id);

      // Deletar dados antigos
      await supabase.from('esposas').delete().eq('irmao_id', irmaoEditando.id);
      await supabase.from('pais').delete().eq('irmao_id', irmaoEditando.id);
      await supabase.from('filhos').delete().eq('irmao_id', irmaoEditando.id);

      console.log('🗑️ Dados familiares antigos removidos');

      // Inserir novos dados
      console.log('🔍 Verificando esposa para atualizar:', esposa);
      if (esposa.nome && esposa.nome.trim() !== '') {
        console.log('💾 Atualizando esposa:', esposa.nome);
        const { error: esposaError } = await supabase.from('esposas').insert([{
          irmao_id: irmaoEditando.id,
          nome: esposa.nome,
          data_nascimento: tratarData(esposa.data_nascimento)
        }]);
        if (esposaError) {
          console.error('❌ Erro ao atualizar esposa:', esposaError);
          console.error('❌ Dados que tentei salvar:', { irmao_id: irmaoEditando.id, nome: esposa.nome });
        } else {
          console.log('✅ Esposa atualizada com sucesso:', esposa.nome);
        }
      } else {
        console.log('⚠️ Esposa sem nome na atualização, não salvando');
      }

      console.log('🔍 Verificando pai para atualizar:', pai);
      if (pai.nome && pai.nome.trim() !== '') {
        console.log('💾 Atualizando pai:', pai.nome);
        const { error: paiError } = await supabase.from('pais').insert([{
          irmao_id: irmaoEditando.id,
          tipo: 'pai',
          nome: pai.nome,
          data_nascimento: tratarData(pai.data_nascimento),
          falecido: pai.falecido || false,
          data_obito: tratarData(pai.data_obito)
        }]);
        if (paiError) {
          console.error('❌ Erro ao atualizar pai:', paiError);
          console.error('❌ Dados que tentei salvar:', { irmao_id: irmaoEditando.id, tipo: 'pai', nome: pai.nome });
        } else {
          console.log('✅ Pai atualizado com sucesso:', pai.nome);
        }
      } else {
        console.log('⚠️ Pai sem nome na atualização, não salvando');
      }

      console.log('🔍 Verificando mãe para atualizar:', mae);
      if (mae.nome && mae.nome.trim() !== '') {
        console.log('💾 Atualizando mãe:', mae.nome);
        const { error: maeError } = await supabase.from('pais').insert([{
          irmao_id: irmaoEditando.id,
          tipo: 'mae',
          nome: mae.nome,
          data_nascimento: tratarData(mae.data_nascimento),
          falecido: mae.falecido || false,
          data_obito: tratarData(mae.data_obito)
        }]);
        if (maeError) {
          console.error('❌ Erro ao atualizar mãe:', maeError);
          console.error('❌ Dados que tentei salvar:', { irmao_id: irmaoEditando.id, tipo: 'mae', nome: mae.nome });
        } else {
          console.log('✅ Mãe atualizada com sucesso:', mae.nome);
        }
      } else {
        console.log('⚠️ Mãe sem nome na atualização, não salvando');
      }

      console.log('📋 Atualizando filhos - Total:', filhos.length);
      console.log('📋 Dados dos filhos:', JSON.stringify(filhos, null, 2));
      
      for (let i = 0; i < filhos.length; i++) {
        const filho = filhos[i];
        console.log(`🔍 Verificando filho ${i + 1} para atualização:`, filho);
        
        if (filho.nome && filho.nome.trim() !== '') {
          console.log(`💾 Atualizando filho ${i + 1}: ${filho.nome}`);
          
          const { error: filhoError } = await supabase.from('filhos').insert([{
            irmao_id: irmaoEditando.id,
            nome: filho.nome,
            data_nascimento: tratarData(filho.data_nascimento),
            falecido: filho.falecido || false,
            data_obito: tratarData(filho.data_obito)
          }]);
          
          if (filhoError) {
            console.error(`❌ Erro ao atualizar filho ${i + 1}:`, filhoError);
          } else {
            console.log(`✅ Filho ${i + 1} atualizado: ${filho.nome}`);
          }
        } else {
          console.log(`⚠️ Filho ${i + 1} sem nome na atualização, pulando...`);
        }
      }
      console.log('✅ Processo de atualização de filhos concluído');

      setSuccessMessage('Cadastro atualizado com sucesso!');
      loadIrmaos();
      limparFormulario();
      
      setTimeout(() => {
        setSuccessMessage('');
        setCurrentPage('visualizar');
      }, 2000);

    } catch (error) {
      setError('Erro ao atualizar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditarIrmao = async (irmao) => {
    setModoEdicao(true);
    setIrmaoEditando(irmao);
    setIrmaoForm(irmao);

    console.log('🔍 Carregando dados familiares para edição...');

    // Carregar esposa
    const { data: esposaData } = await supabase
      .from('esposas')
      .select('*')
      .eq('irmao_id', irmao.id)
      .single();

    // Carregar pais
    const { data: paisData } = await supabase
      .from('pais')
      .select('*')
      .eq('irmao_id', irmao.id);

    // Carregar filhos
    const { data: filhosData } = await supabase
      .from('filhos')
      .select('*')
      .eq('irmao_id', irmao.id);

    // Preencher formulários
    if (esposaData) {
      setEsposa(esposaData);
      console.log('✅ Esposa carregada');
    }

    if (paisData && paisData.length > 0) {
      const paiData = paisData.find(p => p.tipo === 'pai');
      const maeData = paisData.find(p => p.tipo === 'mae');
      
      if (paiData) {
        setPai(paiData);
        console.log('✅ Pai carregado');
      }
      if (maeData) {
        setMae(maeData);
        console.log('✅ Mãe carregada');
      }
    }

    if (filhosData && filhosData.length > 0) {
      setFilhos(filhosData);
      console.log('✅ Filhos carregados:', filhosData.length);
    }

    setCurrentPage('cadastro');
  };

  const handleDeletarIrmao = async (irmao) => {
    // Confirmar exclusão
    const confirmar = window.confirm(
      `⚠️ ATENÇÃO!\n\nTem certeza que deseja excluir o irmão:\n${irmao.nome} (CIM: ${irmao.cim})?\n\n` +
      `Esta ação também irá excluir:\n` +
      `• Dados familiares (esposa, pais, filhos)\n` +
      `• Registros relacionados\n\n` +
      `ESTA AÇÃO NÃO PODE SER DESFEITA!`
    );

    if (!confirmar) {
      return;
    }

    // Segunda confirmação (segurança extra)
    const confirmarNovamente = window.confirm(
      `🚨 ÚLTIMA CONFIRMAÇÃO!\n\nDigite OK para confirmar a exclusão de:\n${irmao.nome}`
    );

    if (!confirmarNovamente) {
      return;
    }

    try {
      setLoading(true);
      console.log('🗑️ Deletando irmão:', irmao.nome);

      // Deletar familiares primeiro (por causa das foreign keys)
      
      // Deletar esposa
      const { error: esposaError } = await supabase
        .from('esposas')
        .delete()
        .eq('irmao_id', irmao.id);

      if (esposaError) {
        console.error('❌ Erro ao deletar esposa:', esposaError);
      }

      // Deletar pais
      const { error: paisError } = await supabase
        .from('pais')
        .delete()
        .eq('irmao_id', irmao.id);

      if (paisError) {
        console.error('❌ Erro ao deletar pais:', paisError);
      }

      // Deletar filhos
      const { error: filhosError } = await supabase
        .from('filhos')
        .delete()
        .eq('irmao_id', irmao.id);

      if (filhosError) {
        console.error('❌ Erro ao deletar filhos:', filhosError);
      }

      // Deletar corpo administrativo
      const { error: corpoError } = await supabase
        .from('corpo_administrativo')
        .delete()
        .eq('irmao_id', irmao.id);

      if (corpoError) {
        console.error('❌ Erro ao deletar corpo administrativo:', corpoError);
      }

      // Finalmente, deletar o irmão
      const { error: irmaoError } = await supabase
        .from('irmaos')
        .delete()
        .eq('id', irmao.id);

      if (irmaoError) {
        console.error('❌ Erro ao deletar irmão:', irmaoError);
        alert('❌ Erro ao deletar irmão. Verifique o console.');
        setLoading(false);
        return;
      }

      console.log('✅ Irmão deletado com sucesso!');
      alert('✅ Irmão deletado com sucesso!');

      // Recarregar lista de irmãos
      loadIrmaos();

    } catch (err) {
      console.error('❌ Erro inesperado ao deletar:', err);
      alert('❌ Erro ao deletar irmão: ' + err.message);
    } finally {
      setLoading(false);
    }
  };


  const handleVisualizarDetalhes = async (irmao) => {
    setIrmaoSelecionado(irmao);
    
    console.log('🔍 Carregando familiares do irmão:', irmao.nome);
    
    try {
      // Buscar esposa
      const { data: esposaData, error: esposaError } = await supabase
        .from('esposas')
        .select('*')
        .eq('irmao_id', irmao.id)
        .maybeSingle();

      // Buscar pais (pai e mãe)
      const { data: paisData, error: paisError } = await supabase
        .from('pais')
        .select('*')
        .eq('irmao_id', irmao.id);

      // Buscar filhos
      const { data: filhosData, error: filhosError } = await supabase
        .from('filhos')
        .select('*')
        .eq('irmao_id', irmao.id);

      // Montar array de familiares no formato esperado pelo modal
      const familiares = [];

      if (esposaData) {
        familiares.push({ ...esposaData, tipo: 'esposa' });
        console.log('✅ Esposa encontrada');
      }

      if (paisData) {
        paisData.forEach(p => {
          familiares.push(p);
        });
        console.log('✅ Pais encontrados:', paisData.length);
      }

      if (filhosData) {
        filhosData.forEach(f => {
          familiares.push({ ...f, tipo: f.tipo || 'filho' });
        });
        console.log('✅ Filhos encontrados:', filhosData.length);
      }

      console.log('📊 Total de familiares:', familiares.length);
      
      if (esposaError) console.error('❌ Erro ao carregar esposa:', esposaError);
      if (paisError) console.error('❌ Erro ao carregar pais:', paisError);
      if (filhosError) console.error('❌ Erro ao carregar filhos:', filhosError);
      
      setFamiliaresSelecionado(familiares);
      setMostrarDetalhes(true);
      
    } catch (err) {
      console.error('❌ Erro inesperado ao carregar familiares:', err);
      setFamiliaresSelecionado([]);
      setMostrarDetalhes(true);
    }
  };

  const fecharDetalhes = () => {
    setMostrarDetalhes(false);
    setIrmaoSelecionado(null);
    setFamiliaresSelecionado([]);
  };

  const limparFormulario = () => {
    setIrmaoForm({
      cim: '', nome: '', cpf: '', rg: '', data_nascimento: '',
      estado_civil: '', profissao: '', formacao: '', status: 'ativo',
      naturalidade: '', endereco: '', cidade: '', celular: '',
      email: '', local_trabalho: '', cargo: '',
      data_iniciacao: '', data_elevacao: '', data_exaltacao: ''
    });
    setEsposa({ nome: '', data_nascimento: '' });
    setPai({ nome: '', data_nascimento: '', falecido: false, data_obito: '' });
    setMae({ nome: '', data_nascimento: '', falecido: false, data_obito: '' });
    setFilhos([{ nome: '', data_nascimento: '', falecido: false, data_obito: '' }]);
    setModoEdicao(false);
    setIrmaoEditando(null);
  };

  const adicionarFilho = () => {
    const novosFilhos = [...filhos, { nome: '', data_nascimento: '', tipo: 'Filho', falecido: false, data_obito: '' }];
    console.log('➕ Adicionando filho. Total agora:', novosFilhos.length);
    setFilhos(novosFilhos);
  };

  const removerFilho = (index) => {
    const novosFilhos = filhos.filter((_, i) => i !== index);
    console.log('➖ Removendo filho. Total agora:', novosFilhos.length);
    setFilhos(novosFilhos);
  };

  const atualizarFilho = (index, field, value) => {
    const novosFilhos = [...filhos];
    novosFilhos[index][field] = value;
    console.log(`✏️ Atualizando filho ${index + 1} - ${field}:`, value);
    setFilhos(novosFilhos);
  };

  // ========================================
  // FUNÇÕES PARA BALAUSTRE
  // ========================================
  const handleSubmitBalaustre = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const { data, error } = await supabase
        .from('balaustres')
        .insert([{
          ...balaustreForm,
          created_by: session.user.id
        }])
        .select()
        .single();

      if (error) throw error;

      setSuccessMessage('Balaustre cadastrado com sucesso!');
      loadBalaustres(grauSelecionado);
      limparFormularioBalaustre();
      
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);

    } catch (error) {
      setError('Erro ao salvar balaustre: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAtualizarBalaustre = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const { error } = await supabase
        .from('balaustres')
        .update(balaustreForm)
        .eq('id', balaustreEditando.id);

      if (error) throw error;

      setSuccessMessage('Balaustre atualizado com sucesso!');
      loadBalaustres(grauSelecionado);
      limparFormularioBalaustre();
      
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);

    } catch (error) {
      setError('Erro ao atualizar balaustre: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditarBalaustre = (balaustre) => {
    setModoEdicaoBalaustre(true);
    setBalaustreEditando(balaustre);
    setBalaustreForm({
      grau_sessao: balaustre.grau_sessao,
      numero_balaustre: balaustre.numero_balaustre,
      data_sessao: balaustre.data_sessao,
      dia_semana: balaustre.dia_semana,
      tipo_sessao_id: balaustre.tipo_sessao_id,
      ordem_dia: balaustre.ordem_dia || '',
      observacoes: balaustre.observacoes || ''
    });
  };

  const handleExcluirBalaustre = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este balaustre?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('balaustres')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSuccessMessage('Balaustre excluído com sucesso!');
      loadBalaustres(grauSelecionado);
      
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);

    } catch (error) {
      setError('Erro ao excluir balaustre: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const limparFormularioBalaustre = () => {
    setBalaustreForm({
      grau_sessao: grauSelecionado,
      numero_balaustre: '',
      data_sessao: '',
      dia_semana: '',
      tipo_sessao_id: '',
      ordem_dia: '',
      observacoes: ''
    });
    setModoEdicaoBalaustre(false);
    setBalaustreEditando(null);
    carregarProximoNumero(grauSelecionado);
  };

  // ========================================
  // FUNÇÕES PARA USUÁRIOS
  // ========================================
  const handleSubmitUsuario = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      console.log('💾 Criando novo usuário:', usuarioForm.email);

      // Criar usuário no Auth usando signUp
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: usuarioForm.email,
        password: usuarioForm.senha,
        options: {
          data: {
            nome: usuarioForm.nome
          }
        }
      });

      if (authError) throw authError;

      // Inserir dados complementares na tabela usuarios
      const { error: dbError } = await supabase
        .from('usuarios')
        .insert([{
          email: usuarioForm.email,
          nome: usuarioForm.nome,
          cargo: usuarioForm.cargo,
          ativo: usuarioForm.ativo
        }]);

      if (dbError) throw dbError;

      setSuccessMessage('✅ Usuário criado com sucesso! Um email de confirmação foi enviado.');
      loadUsuarios();
      limparFormularioUsuario();

      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);

    } catch (error) {
      console.error('❌ Erro ao criar usuário:', error);
      setError('Erro ao criar usuário: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAtualizarUsuario = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      console.log('💾 Atualizando usuário:', usuarioEditando.email);

      const { error } = await supabase
        .from('usuarios')
        .update({
          nome: usuarioForm.nome,
          cargo: usuarioForm.cargo,
          ativo: usuarioForm.ativo
        })
        .eq('id', usuarioEditando.id);

      if (error) throw error;

      // Se tem nova senha, atualizar no Auth
      if (usuarioForm.senha) {
        await supabase.auth.admin.updateUserById(
          usuarioEditando.id,
          { password: usuarioForm.senha }
        );
      }

      setSuccessMessage('Usuário atualizado com sucesso!');
      loadUsuarios();
      limparFormularioUsuario();

      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);

    } catch (error) {
      console.error('❌ Erro ao atualizar usuário:', error);
      setError('Erro ao atualizar usuário: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditarUsuario = (usuario) => {
    setModoEdicaoUsuario(true);
    setUsuarioEditando(usuario);
    setUsuarioForm({
      nome: usuario.nome,
      email: usuario.email,
      senha: '', // Não carregar senha
      cargo: usuario.cargo,
      ativo: usuario.ativo
    });
  };

  const handleExcluirUsuario = async (usuario) => {
    if (!window.confirm(`Tem certeza que deseja excluir o usuário ${usuario.nome}?`)) return;

    setLoading(true);
    try {
      console.log('🗑️ Excluindo usuário:', usuario.email);

      // Excluir do banco
      const { error: dbError } = await supabase
        .from('usuarios')
        .delete()
        .eq('id', usuario.id);

      if (dbError) throw dbError;

      // Excluir do Auth (se necessário)
      // Note: pode requerer privilégios de admin
      
      setSuccessMessage('Usuário excluído com sucesso!');
      loadUsuarios();

      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);

    } catch (error) {
      console.error('❌ Erro ao excluir usuário:', error);
      setError('Erro ao excluir usuário: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const limparFormularioUsuario = () => {
    setUsuarioForm({
      nome: '',
      email: '',
      senha: '',
      cargo: 'irmao',
      ativo: true
    });
    setModoEdicaoUsuario(false);
    setUsuarioEditando(null);
  };

  const getPermissoesUsuario = (cargo) => {
    return permissoesDisponiveis.find(p => p.cargo === cargo);
  };

  // ========================================
  // FUNÇÕES PARA PRANCHAS EXPEDIDAS
  // ========================================
  const handleSubmitPrancha = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      console.log('💾 Salvando prancha expedida...');
      
      const dadosPrancha = {
        numero_prancha: pranchaForm.numero_prancha,
        data_prancha: tratarData(pranchaForm.data_prancha),
        assunto: pranchaForm.assunto,
        destinatario: pranchaForm.destinatario
      };

      const { error } = await supabase
        .from('pranchas_expedidas')
        .insert([dadosPrancha]);

      if (error) throw error;

      setSuccessMessage('✅ Prancha cadastrada com sucesso!');
      limparFormularioPrancha();
      loadPranchas();

      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('❌ Erro ao cadastrar prancha:', err);
      setError('Erro ao cadastrar prancha: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAtualizarPrancha = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      console.log('💾 Atualizando prancha expedida...');
      
      const dadosPrancha = {
        numero_prancha: pranchaForm.numero_prancha,
        data_prancha: tratarData(pranchaForm.data_prancha),
        assunto: pranchaForm.assunto,
        destinatario: pranchaForm.destinatario
      };

      const { error } = await supabase
        .from('pranchas_expedidas')
        .update(dadosPrancha)
        .eq('id', pranchaEditando.id);

      if (error) throw error;

      setSuccessMessage('✅ Prancha atualizada com sucesso!');
      limparFormularioPrancha();
      loadPranchas();

      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('❌ Erro ao atualizar prancha:', err);
      setError('Erro ao atualizar prancha: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditarPrancha = (prancha) => {
    setModoEdicaoPrancha(true);
    setPranchaEditando(prancha);
    setPranchaForm({
      numero_prancha: prancha.numero_prancha,
      data_prancha: prancha.data_prancha,
      assunto: prancha.assunto,
      destinatario: prancha.destinatario
    });
  };

  const limparFormularioPrancha = () => {
    setPranchaForm({ numero_prancha: '', data_prancha: '', assunto: '', destinatario: '' });
    setModoEdicaoPrancha(false);
    setPranchaEditando(null);
  };

  const handleExcluirPrancha = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir esta prancha?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('pranchas_expedidas')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSuccessMessage('✅ Prancha excluída!');
      loadPranchas();

      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('Erro ao excluir: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // FUNÇÕES PARA CORPO ADMINISTRATIVO
  // ========================================
  const handleSubmitCorpoAdmin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      console.log('💾 Salvando cargo administrativo...');

      const { error } = await supabase
        .from('corpo_administrativo')
        .insert([corpoAdminForm]);

      if (error) throw error;

      setSuccessMessage('✅ Cargo cadastrado com sucesso!');
      limparFormularioCorpoAdmin();
      loadCorpoAdmin();

      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('❌ Erro ao cadastrar cargo:', err);
      setError('Erro ao cadastrar cargo: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAtualizarCorpoAdmin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      console.log('💾 Atualizando cargo administrativo...');

      const { error } = await supabase
        .from('corpo_administrativo')
        .update(corpoAdminForm)
        .eq('id', corpoAdminEditando.id);

      if (error) throw error;

      setSuccessMessage('✅ Cargo atualizado com sucesso!');
      limparFormularioCorpoAdmin();
      loadCorpoAdmin();

      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('❌ Erro ao atualizar cargo:', err);
      setError('Erro ao atualizar cargo: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditarCorpoAdmin = (item) => {
    setModoEdicaoCorpoAdmin(true);
    setCorpoAdminEditando(item);
    setCorpoAdminForm({
      irmao_id: item.irmao_id,
      cargo: item.cargo,
      ano_exercicio: item.ano_exercicio
    });
  };

  const limparFormularioCorpoAdmin = () => {
    setCorpoAdminForm({ irmao_id: '', cargo: '', ano_exercicio: '' });
    setModoEdicaoCorpoAdmin(false);
    setCorpoAdminEditando(null);
  };

  const handleExcluirCorpoAdmin = async (id) => {
    if (!window.confirm('Tem certeza que deseja remover este cargo?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('corpo_administrativo')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSuccessMessage('✅ Cargo removido!');
      loadCorpoAdmin();

      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('Erro ao remover: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // FUNÇÃO PARA GERAR PDF
  // ========================================
  const gerarPDFIrmao = async (irmao) => {
    try {
      console.log('📄 Gerando PDF para:', irmao.nome);

      // Buscar dados familiares
      const { data: esposaData } = await supabase
        .from('esposas')
        .select('*')
        .eq('irmao_id', irmao.id)
        .single();

      const { data: paisData } = await supabase
        .from('pais')
        .select('*')
        .eq('irmao_id', irmao.id);

      const { data: filhosData } = await supabase
        .from('filhos')
        .select('*')
        .eq('irmao_id', irmao.id);

      const pai = paisData?.find(p => p.tipo === 'pai');
      const mae = paisData?.find(p => p.tipo === 'mae');

      // Criar conteúdo HTML para o PDF
      let htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Ficha - ${irmao.nome}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #1e40af; padding-bottom: 20px; }
    .header h1 { color: #1e40af; margin: 0; font-size: 24px; }
    .header h2 { color: #666; margin: 5px 0 0 0; font-size: 16px; }
    .section { margin: 25px 0; page-break-inside: avoid; }
    .section-title { background: #1e40af; color: white; padding: 10px; font-size: 16px; font-weight: bold; margin-bottom: 15px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
    .info-item { margin-bottom: 10px; }
    .info-label { font-weight: bold; color: #1e40af; display: block; margin-bottom: 3px; }
    .info-value { color: #333; display: block; padding-left: 10px; }
    .family-member { background: #f3f4f6; padding: 15px; margin: 10px 0; border-left: 4px solid #1e40af; }
    .footer { text-align: center; margin-top: 50px; padding-top: 20px; border-top: 1px solid #ccc; color: #666; font-size: 12px; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${NOME_LOJA}</h1>
    <h2>Ficha Cadastral de Irmão</h2>
  </div>

  <div class="section">
    <div class="section-title">📋 DADOS PESSOAIS</div>
    <div class="info-grid">
      <div class="info-item"><span class="info-label">Nome Completo:</span><span class="info-value">${irmao.nome || '-'}</span></div>
      <div class="info-item"><span class="info-label">CIM:</span><span class="info-value">${irmao.cim || '-'}</span></div>
      <div class="info-item"><span class="info-label">CPF:</span><span class="info-value">${irmao.cpf || '-'}</span></div>
      <div class="info-item"><span class="info-label">RG:</span><span class="info-value">${irmao.rg || '-'}</span></div>
      <div class="info-item"><span class="info-label">Data de Nascimento:</span><span class="info-value">${formatarData(irmao.data_nascimento)}</span></div>
      <div class="info-item"><span class="info-label">Naturalidade:</span><span class="info-value">${irmao.naturalidade || '-'}</span></div>
      <div class="info-item"><span class="info-label">Estado Civil:</span><span class="info-value">${irmao.estado_civil || '-'}</span></div>
      <div class="info-item"><span class="info-label">Profissão:</span><span class="info-value">${irmao.profissao || '-'}</span></div>
      <div class="info-item"><span class="info-label">Formação:</span><span class="info-value">${irmao.formacao || '-'}</span></div>
      <div class="info-item"><span class="info-label">Situação:</span><span class="info-value">${irmao.situacao || 'Regular'}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">📍 CONTATO</div>
    <div class="info-grid">
      <div class="info-item"><span class="info-label">Endereço:</span><span class="info-value">${irmao.endereco || '-'}</span></div>
      <div class="info-item"><span class="info-label">Cidade:</span><span class="info-value">${irmao.cidade || '-'}</span></div>
      <div class="info-item"><span class="info-label">Celular:</span><span class="info-value">${irmao.celular || '-'}</span></div>
      <div class="info-item"><span class="info-label">Email:</span><span class="info-value">${irmao.email || '-'}</span></div>
      <div class="info-item"><span class="info-label">Local de Trabalho:</span><span class="info-value">${irmao.local_trabalho || '-'}</span></div>
      <div class="info-item"><span class="info-label">Cargo:</span><span class="info-value">${irmao.cargo || '-'}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">🔺 DADOS MAÇÔNICOS</div>
    <div class="info-grid">
      <div class="info-item"><span class="info-label">Data de Iniciação:</span><span class="info-value">${formatarData(irmao.data_iniciacao)}</span></div>
      <div class="info-item"><span class="info-label">Data de Elevação:</span><span class="info-value">${formatarData(irmao.data_elevacao)}</span></div>
      <div class="info-item"><span class="info-label">Data de Exaltação:</span><span class="info-value">${formatarData(irmao.data_exaltacao)}</span></div>
      <div class="info-item"><span class="info-label">Grau Atual:</span><span class="info-value">${obterGrau(irmao)}</span></div>
    </div>
  </div>`;

      if (esposaData) {
        htmlContent += `<div class="section"><div class="section-title">💑 ESPOSA</div><div class="family-member">
<div class="info-item"><span class="info-label">Nome:</span><span class="info-value">${esposaData.nome || '-'}</span></div>
<div class="info-item"><span class="info-label">Data de Nascimento:</span><span class="info-value">${formatarData(esposaData.data_nascimento)}</span></div>
</div></div>`;
      }

      if (pai || mae) {
        htmlContent += `<div class="section"><div class="section-title">👨‍👩‍👦 PAIS</div>`;
        if (pai) {
          htmlContent += `<div class="family-member"><div class="info-item"><span class="info-label">Pai:</span><span class="info-value">${pai.nome || '-'}</span></div>
<div class="info-item"><span class="info-label">Data de Nascimento:</span><span class="info-value">${formatarData(pai.data_nascimento)}</span></div>
${pai.falecido ? `<div class="info-item"><span class="info-label">Status:</span><span class="info-value">🕊️ Falecido em ${formatarData(pai.data_obito)}</span></div>` : ''}</div>`;
        }
        if (mae) {
          htmlContent += `<div class="family-member"><div class="info-item"><span class="info-label">Mãe:</span><span class="info-value">${mae.nome || '-'}</span></div>
<div class="info-item"><span class="info-label">Data de Nascimento:</span><span class="info-value">${formatarData(mae.data_nascimento)}</span></div>
${mae.falecido ? `<div class="info-item"><span class="info-label">Status:</span><span class="info-value">🕊️ Falecida em ${formatarData(mae.data_obito)}</span></div>` : ''}</div>`;
        }
        htmlContent += `</div>`;
      }

      if (filhosData && filhosData.length > 0) {
        htmlContent += `<div class="section"><div class="section-title">👶 FILHOS</div>`;
        filhosData.forEach((filho, index) => {
          htmlContent += `<div class="family-member"><div class="info-item"><span class="info-label">Filho(a) ${index + 1}:</span><span class="info-value">${filho.nome || '-'}</span></div>
<div class="info-item"><span class="info-label">Data de Nascimento:</span><span class="info-value">${formatarData(filho.data_nascimento)}</span></div>
${filho.falecido ? `<div class="info-item"><span class="info-label">Status:</span><span class="info-value">🕊️ Falecido(a) em ${formatarData(filho.data_obito)}</span></div>` : ''}</div>`;
        });
        htmlContent += `</div>`;
      }

      htmlContent += `<div class="footer"><p>Documento gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p><p>${NOME_LOJA}</p></div></body></html>`;

      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Ficha_${irmao.nome.replace(/\s+/g, '_')}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setSuccessMessage('✅ Arquivo HTML gerado! Abra no navegador e use Ctrl+P para salvar em PDF.');
      setTimeout(() => setSuccessMessage(''), 5000);

    } catch (error) {
      console.error('❌ Erro ao gerar PDF:', error);
      setError('Erro ao gerar arquivo: ' + error.message);
    }
  };

  // ========================================
  // RENDERIZAÇÃO
  // ========================================
  if (loading && !session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-2xl">Carregando...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <img src={LOGO_URL} alt="Logo" className="w-32 h-32 mx-auto mb-4 rounded-full border-4 border-blue-600" />
            <h1 className="text-3xl font-bold text-blue-900 mb-2">{NOME_LOJA}</h1>
            <p className="text-gray-600">Gestão Maçônica</p>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition disabled:bg-gray-400"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Contagens por situação
  const irmaosRegulares = irmaos.filter(i => i.situacao === 'Regular');
  const irmaosIrregulares = irmaos.filter(i => i.situacao === 'Irregular');
  const irmaosLicenciados = irmaos.filter(i => i.situacao === 'Licenciado');
  const irmaosSuspensos = irmaos.filter(i => i.situacao === 'Suspenso');
  const irmaosDesligados = irmaos.filter(i => i.situacao === 'Desligado');
  const irmaosExcluidos = irmaos.filter(i => i.situacao === 'Excluído');
  const irmaosFalecidos = irmaos.filter(i => i.situacao === 'Falecido');
  const irmaosExOficio = irmaos.filter(i => i.situacao === 'Ex-Ofício');
  
  const totalIrmaos = irmaos.length;

  // Função para determinar o grau do irmão
  const obterGrau = (irmao) => {
    if (irmao.data_exaltacao) return 'Mestre';
    if (irmao.data_elevacao) return 'Companheiro';
    if (irmao.data_iniciacao) return 'Aprendiz';
    return 'Não Iniciado';
  };

  // Contagem por grau (apenas regulares)
  const irmaosAprendiz = irmaosRegulares.filter(i => obterGrau(i) === 'Aprendiz').length;
  const irmaosCompanheiro = irmaosRegulares.filter(i => obterGrau(i) === 'Companheiro').length;
  const irmaosMestre = irmaosRegulares.filter(i => obterGrau(i) === 'Mestre').length;


  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* SIDEBAR LATERAL FIXA */}
      <aside className="w-64 bg-gradient-to-b from-blue-900 to-indigo-900 text-white fixed h-screen shadow-2xl flex flex-col">
        {/* Logo e Título */}
        <div className="p-6 border-b border-blue-700 flex-shrink-0">
          <div className="flex flex-col items-center">
            <img src={LOGO_URL} alt="Logo" className="w-20 h-20 rounded-full border-4 border-white mb-3" />
            <h1 className="text-lg font-bold text-center leading-tight">{NOME_LOJA}</h1>
            <p className="text-xs text-blue-200 mt-1">Gestão e Controle</p>
          </div>
        </div>

        {/* Menu de Navegação */}
        <nav className="py-2 flex-1 overflow-y-auto">
          <button
            onClick={() => setCurrentPage('dashboard')}
            className={`w-full px-4 py-2 flex items-center gap-2 transition text-sm ${
              currentPage === 'dashboard'
                ? 'bg-blue-700 border-l-4 border-white'
                : 'hover:bg-blue-800'
            }`}
          >
            <span className="text-base">📊</span>
            <span className="font-semibold">Dashboard</span>
          </button>

          <button
            onClick={() => setCurrentPage('cadastro')}
            className={`w-full px-4 py-2 flex items-center gap-2 transition text-sm ${
              currentPage === 'cadastro'
                ? 'bg-blue-700 border-l-4 border-white'
                : 'hover:bg-blue-800'
            }`}
          >
            <span className="text-base">➕</span>
            <span className="font-semibold">Cadastrar Irmão</span>
          </button>

          <button
            onClick={() => setCurrentPage('visualizar')}
            className={`w-full px-4 py-2 flex items-center gap-2 transition text-sm ${
              currentPage === 'visualizar'
                ? 'bg-blue-700 border-l-4 border-white'
                : 'hover:bg-blue-800'
            }`}
          >
            <span className="text-base">👥</span>
            <span className="font-semibold">Visualizar Irmãos</span>
          </button>

          <button
            onClick={() => setCurrentPage('quadro')}
            className={`w-full px-4 py-2 flex items-center gap-2 transition text-sm ${
              currentPage === 'quadro'
                ? 'bg-blue-700 border-l-4 border-white'
                : 'hover:bg-blue-800'
            }`}
          >
            <span className="text-base">📋</span>
            <span className="font-semibold">Quadro de Irmãos</span>
          </button>

          {/* ========== BALAUSTRES ========== */}
          <div className="px-4 py-2 text-xs font-semibold text-blue-300 uppercase tracking-wide">
            Balaustres
          </div>

          <button
            onClick={() => setCurrentPage('cadastrar-balaustre')}
            className={`w-full px-4 py-2 flex items-center gap-2 transition text-sm ${
              currentPage === 'cadastrar-balaustre'
                ? 'bg-blue-700 border-l-4 border-white'
                : 'hover:bg-blue-800'
            }`}
          >
            <span className="text-base">📝</span>
            <span className="font-semibold">Cadastrar Balaustre</span>
          </button>

          <button
            onClick={() => setCurrentPage('visualizar-balaustres')}
            className={`w-full px-4 py-2 flex items-center gap-2 transition text-sm ${
              currentPage === 'visualizar-balaustres'
                ? 'bg-blue-700 border-l-4 border-white'
                : 'hover:bg-blue-800'
            }`}
          >
            <span className="text-base">📋</span>
            <span className="font-semibold">Visualizar Balaustres</span>
          </button>

          <button
            onClick={() => setCurrentPage('lista-presenca')}
            className={`w-full px-4 py-2 flex items-center gap-2 transition text-sm ${
              currentPage === 'lista-presenca'
                ? 'bg-blue-700 border-l-4 border-white'
                : 'hover:bg-blue-800'
            }`}
          >
            <span className="text-base">✅</span>
            <span className="font-semibold">Lista de Presença</span>
          </button>

          {/* ========== PRANCHAS ========== */}
          <div className="px-4 py-2 text-xs font-semibold text-blue-300 uppercase tracking-wide">
            Pranchas
          </div>

          <button
            onClick={() => setCurrentPage('cadastrar-prancha')}
            className={`w-full px-4 py-2 flex items-center gap-2 transition text-sm ${
              currentPage === 'cadastrar-prancha'
                ? 'bg-blue-700 border-l-4 border-white'
                : 'hover:bg-blue-800'
            }`}
          >
            <span className="text-base">📝</span>
            <span className="font-semibold">Cadastrar Prancha</span>
          </button>

          <button
            onClick={() => setCurrentPage('visualizar-pranchas')}
            className={`w-full px-4 py-2 flex items-center gap-2 transition text-sm ${
              currentPage === 'visualizar-pranchas'
                ? 'bg-blue-700 border-l-4 border-white'
                : 'hover:bg-blue-800'
            }`}
          >
            <span className="text-base">📄</span>
            <span className="font-semibold">Visualizar Pranchas</span>
          </button>

          <button
            onClick={() => setCurrentPage('protocolo-pranchas')}
            className={`w-full px-4 py-2 flex items-center gap-2 transition text-sm ${
              currentPage === 'protocolo-pranchas'
                ? 'bg-blue-700 border-l-4 border-white'
                : 'hover:bg-blue-800'
            }`}
          >
            <span className="text-base">📖</span>
            <span className="font-semibold">Livro de Protocolo</span>
          </button>

          <button
            onClick={() => setCurrentPage('balaustres')}
            className={`w-full px-4 py-2 flex items-center gap-2 transition text-sm ${
              currentPage === 'balaustres'
                ? 'bg-blue-700 border-l-4 border-white'
                : 'hover:bg-blue-800'
            }`}
          >
            <span className="text-base">📜</span>
            <span className="font-semibold">Balaustres</span>
          </button>

          <button
            onClick={() => setCurrentPage('pranchas')}
            className={`w-full px-4 py-2 flex items-center gap-2 transition text-sm ${
              currentPage === 'pranchas'
                ? 'bg-blue-700 border-l-4 border-white'
                : 'hover:bg-blue-800'
            }`}
          >
            <span className="text-base">📄</span>
            <span className="font-semibold">Pranchas</span>
          </button>

          <button
            onClick={() => setCurrentPage('comissoes')}
            className={`w-full px-4 py-2 flex items-center gap-2 transition text-sm ${
              currentPage === 'comissoes'
                ? 'bg-blue-700 border-l-4 border-white'
                : 'hover:bg-blue-800'
            }`}
          >
            <span className="text-base">📋</span>
            <span className="font-semibold">Comissões</span>
          </button>

          <button
            onClick={() => setCurrentPage('biblioteca')}
            className={`w-full px-4 py-2 flex items-center gap-2 transition text-sm ${
              currentPage === 'biblioteca'
                ? 'bg-blue-700 border-l-4 border-white'
                : 'hover:bg-blue-800'
            }`}
          >
            <span className="text-base">📚</span>
            <span className="font-semibold">Biblioteca</span>
          </button>

          {permissoes?.canManageUsers && (
            <button
              onClick={() => setCurrentPage('usuarios')}
              className={`w-full px-4 py-2 flex items-center gap-2 transition text-sm ${
                currentPage === 'usuarios'
                  ? 'bg-blue-700 border-l-4 border-white'
                  : 'hover:bg-blue-800'
              }`}
            >
              <span className="text-base">👤</span>
              <span className="font-semibold">Gerenciar Usuários</span>
            </button>
          )}

          <button
            onClick={() => setCurrentPage('corpo-admin')}
            className={`w-full px-4 py-2 flex items-center gap-2 transition text-sm ${
              currentPage === 'corpo-admin'
                ? 'bg-blue-700 border-l-4 border-white'
                : 'hover:bg-blue-800'
            }`}
          >
            <span className="text-base">👔</span>
            <span className="font-semibold">Administração</span>
          </button>
        </nav>

        {/* Botão Sair */}
        <div className="border-t border-blue-700 bg-blue-950 p-3 flex-shrink-0">
          <button
            onClick={handleLogout}
            className="w-full bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-semibold transition flex items-center justify-center gap-2 text-sm"
          >
            <span>🚪</span>
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 ml-64">
        {/* HEADER SUPERIOR */}
        <header className="bg-white shadow-md border-b-2 border-blue-200 sticky top-0 z-40">
          <div className="px-8 py-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">
                  {currentPage === 'dashboard' && '📊 Dashboard'}
                  {currentPage === 'cadastro' && '➕ Cadastro de Irmãos'}
                  {currentPage === 'visualizar' && '👥 Visualizar Irmãos'}
                  {currentPage === 'quadro' && '📋 Quadro de Irmãos'}
                  {currentPage === 'balaustres' && '📜 Balaustres'}
                  {currentPage === 'pranchas' && '📄 Pranchas Expedidas'}
                  {currentPage === 'corpo-admin' && '👔 Corpo Administrativo'}
                  {currentPage === 'comissoes' && '📋 Comissões'}
                  {currentPage === 'biblioteca' && '📚 Biblioteca'}
                  {currentPage === 'usuarios' && '👤 Gerenciar Usuários'}
                </h2>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-semibold text-sm text-gray-800">{userData?.nome}</p>
                  <p className="text-xs text-gray-600 capitalize">{userData?.cargo}</p>
                </div>
                <div className="text-sm text-gray-500">
                  {new Date().toLocaleDateString('pt-BR', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* MENSAGENS */}
        {error && (
          <div className="px-8 mt-4">
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg">
              {error}
            </div>
          </div>
        )}

        {successMessage && (
          <div className="px-8 mt-4">
            <div className="bg-green-50 border-l-4 border-green-500 text-green-700 p-4 rounded-lg">
              {successMessage}
            </div>
          </div>
        )}

        {/* CONTEÚDO DAS PÁGINAS */}
        <div className="px-8 py-6">
        {/* DASHBOARD */}
        {/* DASHBOARD */}
        {currentPage === 'dashboard' && (
          <Dashboard 
            irmaos={irmaos}
            balaustres={balaustres}
          />
        )}


        {/* CONTROLE DE BALAUSTRES */}
        {currentPage === 'balaustres' && (
          <div>
            {/* FORMULÁRIO DE BALAUSTRE */}
            <div className="bg-white rounded-xl shadow-md p-6 mb-6">
              <h3 className="text-xl font-bold text-blue-900 mb-4">
                {modoEdicaoBalaustre ? '✏️ Editar Balaustre' : '➕ Novo Balaustre'}
              </h3>

              <form onSubmit={modoEdicaoBalaustre ? handleAtualizarBalaustre : handleSubmitBalaustre}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Grau da Sessão */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Grau da Sessão *</label>
                    <select
                      value={balaustreForm.grau_sessao}
                      onChange={(e) => setBalaustreForm({ ...balaustreForm, grau_sessao: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    >
                      <option value="Aprendiz">Aprendiz</option>
                      <option value="Companheiro">Companheiro</option>
                      <option value="Mestre">Mestre</option>
                    </select>
                  </div>

                  {/* Número do Balaustre */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Número do Balaustre * 
                      <span className="text-xs text-gray-500 ml-2">(editável)</span>
                    </label>
                    <input
                      type="number"
                      value={balaustreForm.numero_balaustre}
                      onChange={(e) => setBalaustreForm({ ...balaustreForm, numero_balaustre: parseInt(e.target.value) || '' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                      min="1"
                      placeholder="Número automático (pode alterar)"
                    />
                  </div>

                  {/* Data da Sessão */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Data da Sessão *</label>
                    <input
                      type="date"
                      value={balaustreForm.data_sessao}
                      onChange={(e) => setBalaustreForm({ ...balaustreForm, data_sessao: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    />
                  </div>

                  {/* Dia da Semana */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Dia da Semana</label>
                    <input
                      type="text"
                      value={balaustreForm.dia_semana}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 outline-none"
                      readOnly
                    />
                  </div>

                  {/* Tipo de Sessão */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Sessão *</label>
                    <select
                      value={balaustreForm.tipo_sessao_id}
                      onChange={(e) => setBalaustreForm({ ...balaustreForm, tipo_sessao_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    >
                      <option value="">Selecione...</option>
                      {tiposSessao.map(tipo => (
                        <option key={tipo.id} value={tipo.id}>{tipo.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Ordem do Dia e Observações lado a lado */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                  {/* Ordem do Dia */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Ordem do Dia</label>
                    <textarea
                      value={balaustreForm.ordem_dia}
                      onChange={(e) => setBalaustreForm({ ...balaustreForm, ordem_dia: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      rows="4"
                      placeholder="Descreva a ordem do dia da sessão..."
                    />
                  </div>

                  {/* Observações */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
                    <textarea
                      value={balaustreForm.observacoes}
                      onChange={(e) => setBalaustreForm({ ...balaustreForm, observacoes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      rows="4"
                      placeholder="Observações adicionais..."
                    />
                  </div>
                </div>

                {/* Botões */}
                <div className="flex justify-end gap-4 mt-4">
                  {modoEdicaoBalaustre && (
                    <button
                      type="button"
                      onClick={limparFormularioBalaustre}
                      className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition"
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition disabled:bg-gray-400"
                  >
                    {loading ? 'Salvando...' : modoEdicaoBalaustre ? '💾 Atualizar' : '💾 Salvar Balaustre'}
                  </button>
                </div>
              </form>
            </div>

            {/* FILTRO POR GRAU */}
            <div className="bg-white rounded-xl shadow-md p-4 mb-6">
              <div className="flex gap-2 items-center">
                <span className="font-semibold text-gray-700">Filtrar por Grau:</span>
                <button
                  onClick={() => setGrauSelecionado('Aprendiz')}
                  className={`px-4 py-2 rounded-lg font-semibold transition ${
                    grauSelecionado === 'Aprendiz'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  Aprendiz
                </button>
                <button
                  onClick={() => setGrauSelecionado('Companheiro')}
                  className={`px-4 py-2 rounded-lg font-semibold transition ${
                    grauSelecionado === 'Companheiro'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  Companheiro
                </button>
                <button
                  onClick={() => setGrauSelecionado('Mestre')}
                  className={`px-4 py-2 rounded-lg font-semibold transition ${
                    grauSelecionado === 'Mestre'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  Mestre
                </button>
              </div>
            </div>

            {/* TABELA DE BALAUSTRES */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                <h3 className="text-xl font-bold">
                  Balaustres - Grau: {grauSelecionado}
                </h3>
                <p className="text-sm text-blue-100">Total: {balaustres.length} registros</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b-2 border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nº Balaustre
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Data da Sessão
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Dia da Semana
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tipo de Sessão
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ordem do Dia
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {balaustres.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                          Nenhum balaustre cadastrado para o grau {grauSelecionado}
                        </td>
                      </tr>
                    ) : (
                      balaustres.map((balaustre) => (
                        <tr key={balaustre.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="font-semibold text-blue-600">
                              {balaustre.numero_balaustre}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {formatarData(balaustre.data_sessao)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {balaustre.dia_semana}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                              {balaustre.tipos_sessao?.nome || 'N/A'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-600 max-w-md truncate">
                              {balaustre.ordem_dia || '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="flex justify-center gap-2">
                              {permissoes?.canEdit && (
                                <button
                                  onClick={() => handleEditarBalaustre(balaustre)}
                                  className="text-blue-600 hover:text-blue-800 font-semibold"
                                  title="Editar"
                                >
                                  ✏️
                                </button>
                              )}
                              {permissoes?.canDelete && (
                                <button
                                  onClick={() => handleExcluirBalaustre(balaustre.id)}
                                  className="text-red-600 hover:text-red-800 font-semibold"
                                  title="Excluir"
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* VISUALIZAR IRMÃOS */}
        {currentPage === 'visualizar' && (
          <VisualizarIrmaos
            irmaos={irmaos}
            onEdit={handleEditarIrmao}
            onUpdate={loadIrmaos}
            showSuccess={showSuccess}
            showError={showError}
            permissoes={permissoes}
          />
        )}
        {/* QUADRO DE IRMÃOS */}
        {currentPage === 'quadro' && (
          <QuadroIrmaos irmaos={irmaos} />
        )}
        {/* CADASTRO DE IRMÃOS */}
        {currentPage === 'cadastro' && (
          <CadastrarIrmao
            irmaos={irmaos}
            onUpdate={loadIrmaos}
            showSuccess={showSuccess}
            showError={showError}
          />
        )}

        {/* ==================== BALAUSTRES ==================== */}
        {currentPage === 'cadastrar-balaustre' && (
          <CadastrarBalaustre
            onUpdate={loadBalaustresFase4}
            showSuccess={showSuccess}
            showError={showError}
          />
        )}

        {currentPage === 'visualizar-balaustres' && (
          <VisualizarBalaustres balaustres={balaustresFase4} />
        )}

        {currentPage === 'lista-presenca' && (
          <ListaPresenca
            balaustres={balaustresFase4}
            irmaos={irmaos}
            showSuccess={showSuccess}
            showError={showError}
          />
        )}

        {/* ==================== PRANCHAS ==================== */}
        {currentPage === 'cadastrar-prancha' && (
          <CadastrarPrancha
            onUpdate={loadPranchasFase4}
            showSuccess={showSuccess}
            showError={showError}
          />
        )}

        {currentPage === 'visualizar-pranchas' && (
          <VisualizarPranchas pranchas={pranchasFase4} />
        )}

        {currentPage === 'protocolo-pranchas' && (
          <ProtocoloPranchas pranchas={pranchasFase4} />
        )}

        {/* GERENCIAMENTO DE USUÁRIOS */}
        {/* GERENCIAR USUÁRIOS */}
        {currentPage === 'usuarios' && permissoes?.canManageUsers && (
          <Usuarios
            usuarios={usuarios}
            userData={userData}
            onUpdate={loadUsuarios}
            showSuccess={showSuccess}
            showError={showError}
          />
        )}

        {/* PRANCHAS EXPEDIDAS */}
        {currentPage === 'pranchas' && (
          <div>
            {/* FORMULÁRIO DE CADASTRO */}
            <div className="bg-white rounded-xl shadow-md p-6 mb-6">
              <h3 className="text-xl font-bold text-blue-900 mb-4">
                {modoEdicaoPrancha ? '✏️ Editar Prancha' : '➕ Registrar Nova Prancha'}
              </h3>

              <form onSubmit={modoEdicaoPrancha ? handleAtualizarPrancha : handleSubmitPrancha}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Número da Prancha *</label>
                    <input
                      type="text"
                      value={pranchaForm.numero_prancha}
                      onChange={(e) => setPranchaForm({ ...pranchaForm, numero_prancha: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Ex: 001/2024"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Data da Prancha *</label>
                    <input
                      type="date"
                      value={pranchaForm.data_prancha}
                      onChange={(e) => setPranchaForm({ ...pranchaForm, data_prancha: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Destinatário *</label>
                    <input
                      type="text"
                      value={pranchaForm.destinatario}
                      onChange={(e) => setPranchaForm({ ...pranchaForm, destinatario: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Ex: Grande Oriente de Mato Grosso"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Assunto *</label>
                    <input
                      type="text"
                      value={pranchaForm.assunto}
                      onChange={(e) => setPranchaForm({ ...pranchaForm, assunto: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Ex: Solicitação de Regularização"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-4 mt-6">
                  {modoEdicaoPrancha && (
                    <button
                      type="button"
                      onClick={limparFormularioPrancha}
                      className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition"
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition disabled:bg-gray-400"
                  >
                    {loading ? 'Salvando...' : modoEdicaoPrancha ? '💾 Atualizar Prancha' : '💾 Registrar Prancha'}
                  </button>
                </div>
              </form>
            </div>

            {/* BUSCA */}
            <div className="bg-white rounded-xl shadow-md p-4 mb-6">
              <div className="flex gap-4">
                <input
                  type="text"
                  placeholder="🔍 Buscar por número, assunto ou destinatário..."
                  value={searchPrancha}
                  onChange={(e) => setSearchPrancha(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            {/* LISTA DE PRANCHAS */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                <h3 className="text-xl font-bold">Pranchas Registradas</h3>
                <p className="text-sm text-blue-100">
                  Total: {pranchas.filter(p => 
                    !searchPrancha || 
                    p.numero_prancha?.toLowerCase().includes(searchPrancha.toLowerCase()) ||
                    p.assunto?.toLowerCase().includes(searchPrancha.toLowerCase()) ||
                    p.destinatario?.toLowerCase().includes(searchPrancha.toLowerCase())
                  ).length} pranchas
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b-2 border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Número</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Destinatário</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assunto</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {pranchas
                      .filter(p => 
                        !searchPrancha || 
                        p.numero_prancha?.toLowerCase().includes(searchPrancha.toLowerCase()) ||
                        p.assunto?.toLowerCase().includes(searchPrancha.toLowerCase()) ||
                        p.destinatario?.toLowerCase().includes(searchPrancha.toLowerCase())
                      )
                      .map((prancha) => (
                        <tr key={prancha.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                            {prancha.numero_prancha}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {formatarData(prancha.data_prancha)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {prancha.destinatario}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {prancha.assunto}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex justify-center gap-2">
                              {permissoes?.canEdit && (
                                <>
                                  <button
                                    onClick={() => handleEditarPrancha(prancha)}
                                    className="text-blue-600 hover:text-blue-800 font-semibold"
                                    title="Editar"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    onClick={() => handleExcluirPrancha(prancha.id)}
                                    className="text-red-600 hover:text-red-800 font-semibold"
                                    title="Excluir"
                                  >
                                    🗑️
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    {pranchas.filter(p => 
                      !searchPrancha || 
                      p.numero_prancha?.toLowerCase().includes(searchPrancha.toLowerCase()) ||
                      p.assunto?.toLowerCase().includes(searchPrancha.toLowerCase()) ||
                      p.destinatario?.toLowerCase().includes(searchPrancha.toLowerCase())
                    ).length === 0 && (
                      <tr>
                        <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                          {searchPrancha ? 'Nenhuma prancha encontrada com esse filtro' : 'Nenhuma prancha registrada'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* CORPO ADMINISTRATIVO */}
        {currentPage === 'corpo-admin' && (
          <CorpoAdmin
            corpoAdmin={corpoAdmin}
            irmaos={irmaos}
            permissoes={permissoes}
            onUpdate={loadCorpoAdmin}
            showSuccess={showSuccess}
            showError={showError}
          />
        )}
        
        {/* ========================================
            PÁGINA: COMISSÕES
            ======================================== */}
        {currentPage === 'comissoes' && (
          <div>
            {/* FORMULÁRIO */}
            <div className="bg-white rounded-xl shadow-md p-6 mb-6">
              <h3 className="text-xl font-bold text-blue-900 mb-4">
                {modoEdicaoComissao ? '✏️ Editar Comissão' : '➕ Nova Comissão'}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome da Comissão *</label>
                  <input
                    type="text"
                    value={comissaoForm.nome}
                    onChange={(e) => setComissaoForm({ ...comissaoForm, nome: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Data de Criação *</label>
                  <input
                    type="date"
                    value={comissaoForm.data_criacao}
                    onChange={(e) => setComissaoForm({ ...comissaoForm, data_criacao: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Origem *</label>
                  <select
                    value={comissaoForm.origem}
                    onChange={(e) => setComissaoForm({ ...comissaoForm, origem: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="interna">Interna</option>
                    <option value="externa">Externa</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
                  <select
                    value={comissaoForm.status}
                    onChange={(e) => setComissaoForm({ ...comissaoForm, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="em_andamento">Em Andamento</option>
                    <option value="encerrada">Encerrada</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Data Início *</label>
                  <input
                    type="date"
                    value={comissaoForm.data_inicio}
                    onChange={(e) => setComissaoForm({ ...comissaoForm, data_inicio: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Data Fim</label>
                  <input
                    type="date"
                    value={comissaoForm.data_fim}
                    onChange={(e) => setComissaoForm({ ...comissaoForm, data_fim: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Objetivo *</label>
                  <textarea
                    value={comissaoForm.objetivo}
                    onChange={(e) => setComissaoForm({ ...comissaoForm, objetivo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows="2"
                    required
                  />
                </div>
              </div>

              {/* INTEGRANTES */}
              <div className="border-t pt-4 mt-4">
                <h4 className="font-bold text-gray-800 mb-3">👥 Integrantes</h4>
                
                <div className="flex gap-2 mb-3">
                  <select
                    id="select-irmao-comissao"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione um irmão</option>
                    {irmaos.map(irmao => (
                      <option key={irmao.id} value={irmao.id}>
                        {irmao.nome} - CIM {irmao.cim}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const select = document.getElementById('select-irmao-comissao');
                      const irmaoId = parseInt(select.value);
                      if (!irmaoId) return;
                      const irmao = irmaos.find(i => i.id === irmaoId);
                      if (integrantesComissao.some(i => i.irmao_id === irmaoId)) {
                        alert('Irmão já adicionado!');
                        return;
                      }
                      setIntegrantesComissao([...integrantesComissao, {
                        irmao_id: irmao.id,
                        irmao_nome: irmao.nome,
                        irmao_cim: irmao.cim,
                        funcao: 'Membro'
                      }]);
                      select.value = '';
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    ➕ Adicionar
                  </button>
                </div>

                {integrantesComissao.length > 0 && (
                  <div className="space-y-2">
                    {integrantesComissao.map((integrante, index) => (
                      <div key={index} className="flex items-center gap-2 bg-gray-50 p-2 rounded">
                        <span className="flex-1 text-sm">
                          {integrante.irmao_nome} (CIM: {integrante.irmao_cim})
                        </span>
                        <select
                          value={integrante.funcao}
                          onChange={(e) => {
                            const novos = [...integrantesComissao];
                            novos[index].funcao = e.target.value;
                            setIntegrantesComissao(novos);
                          }}
                          className="px-2 py-1 border rounded text-sm"
                        >
                          <option value="Coordenador">Coordenador</option>
                          <option value="Secretário">Secretário</option>
                          <option value="Membro">Membro</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => setIntegrantesComissao(integrantesComissao.filter((_, i) => i !== index))}
                          className="text-red-600 hover:text-red-800"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={salvarComissao}
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Salvando...' : (modoEdicaoComissao ? 'Atualizar' : 'Salvar')}
                </button>
                {modoEdicaoComissao && (
                  <button
                    type="button"
                    onClick={() => {
                      setModoEdicaoComissao(false);
                      setComissaoEditando(null);
                      setComissaoForm({
                        nome: '',
                        data_criacao: new Date().toISOString().split('T')[0],
                        origem: 'interna',
                        objetivo: '',
                        data_inicio: new Date().toISOString().split('T')[0],
                        data_fim: '',
                        status: 'em_andamento',
                        observacoes: ''
                      });
                      setIntegrantesComissao([]);
                    }}
                    className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>

            {/* LISTA DE COMISSÕES */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-xl font-bold text-blue-900 mb-4">📋 Comissões Cadastradas</h3>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b-2 border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Origem</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Período</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Integrantes</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {comissoes.map(comissao => (
                      <tr key={comissao.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{comissao.nome}</div>
                          <div className="text-sm text-gray-500">{comissao.objetivo}</div>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            comissao.origem === 'interna' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                          }`}>
                            {comissao.origem === 'interna' ? 'Interna' : 'Externa'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatarData(comissao.data_inicio)}
                          {comissao.data_fim && ` → ${formatarData(comissao.data_fim)}`}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            comissao.status === 'em_andamento' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {comissao.status === 'em_andamento' ? '🟢 Em Andamento' : '🔴 Encerrada'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {comissao.comissoes_integrantes?.filter(ci => ci.ativo).length || 0} irmãos
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => {
                                setComissaoDetalhes(comissao);
                                setMostrarDetalhesComissao(true);
                              }}
                              className="text-gray-600 hover:text-gray-800"
                              title="Ver Detalhes"
                            >
                              👁️
                            </button>
                            <button
                              onClick={() => {
                                setModoEdicaoComissao(true);
                                setComissaoEditando(comissao);
                                setComissaoForm({
                                  nome: comissao.nome,
                                  data_criacao: comissao.data_criacao,
                                  origem: comissao.origem,
                                  objetivo: comissao.objetivo,
                                  data_inicio: comissao.data_inicio,
                                  data_fim: comissao.data_fim || '',
                                  status: comissao.status,
                                  observacoes: comissao.observacoes || ''
                                });
                                const integrantes = comissao.comissoes_integrantes
                                  ?.filter(ci => ci.ativo)
                                  .map(ci => ({
                                    irmao_id: ci.irmao_id,
                                    irmao_nome: ci.irmaos?.nome || '',
                                    irmao_cim: ci.irmaos?.cim || '',
                                    funcao: ci.funcao || 'Membro'
                                  })) || [];
                                setIntegrantesComissao(integrantes);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="text-blue-600 hover:text-blue-800"
                              title="Editar"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => deletarComissao(comissao.id)}
                              className="text-red-600 hover:text-red-800"
                              title="Deletar"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {comissoes.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Nenhuma comissão cadastrada
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL DETALHES COMISSÃO */}
        {mostrarDetalhesComissao && comissaoDetalhes && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-blue-600 text-white p-6 rounded-t-xl flex justify-between items-center">
                <h3 className="text-2xl font-bold">📋 Detalhes da Comissão</h3>
                <button
                  onClick={() => {
                    setMostrarDetalhesComissao(false);
                    setComissaoDetalhes(null);
                  }}
                  className="text-white hover:text-gray-200 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-bold text-gray-600">Nome:</label>
                    <p className="text-gray-900 font-semibold">{comissaoDetalhes.nome}</p>
                  </div>
                  <div>
                    <label className="text-sm font-bold text-gray-600">Origem:</label>
                    <p>
                      <span className={`px-2 py-1 rounded text-sm ${
                        comissaoDetalhes.origem === 'interna' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {comissaoDetalhes.origem === 'interna' ? 'Interna' : 'Externa'}
                      </span>
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-bold text-gray-600">Objetivo:</label>
                  <p className="text-gray-900">{comissaoDetalhes.objetivo}</p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-bold text-gray-600">Data Criação:</label>
                    <p className="text-gray-900">{formatarData(comissaoDetalhes.data_criacao)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-bold text-gray-600">Data Início:</label>
                    <p className="text-gray-900">{formatarData(comissaoDetalhes.data_inicio)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-bold text-gray-600">Data Fim:</label>
                    <p className="text-gray-900">
                      {comissaoDetalhes.data_fim ? formatarData(comissaoDetalhes.data_fim) : 'Em andamento'}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-bold text-gray-600">Status:</label>
                  <p>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      comissaoDetalhes.status === 'em_andamento' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {comissaoDetalhes.status === 'em_andamento' ? '🟢 Em Andamento' : '🔴 Encerrada'}
                    </span>
                  </p>
                </div>

                <div>
                  <label className="text-sm font-bold text-gray-600 mb-2 block">👥 Integrantes:</label>
                  <div className="bg-gray-50 rounded-lg p-4">
                    {comissaoDetalhes.comissoes_integrantes?.filter(ci => ci.ativo).length > 0 ? (
                      <div className="space-y-2">
                        {comissaoDetalhes.comissoes_integrantes
                          .filter(ci => ci.ativo)
                          .map((integrante, index) => (
                            <div key={index} className="flex justify-between items-center bg-white p-3 rounded border">
                              <div>
                                <p className="font-semibold text-gray-900">{integrante.irmaos?.nome}</p>
                                <p className="text-sm text-gray-600">CIM: {integrante.irmaos?.cim}</p>
                              </div>
                              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                                {integrante.funcao || 'Membro'}
                              </span>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center">Nenhum integrante cadastrado</p>
                    )}
                  </div>
                </div>

                {comissaoDetalhes.observacoes && (
                  <div>
                    <label className="text-sm font-bold text-gray-600">Observações:</label>
                    <p className="text-gray-900 bg-gray-50 p-3 rounded">{comissaoDetalhes.observacoes}</p>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <button
                    onClick={() => {
                      setMostrarDetalhesComissao(false);
                      setModoEdicaoComissao(true);
                      setComissaoEditando(comissaoDetalhes);
                      setComissaoForm({
                        nome: comissaoDetalhes.nome,
                        data_criacao: comissaoDetalhes.data_criacao,
                        origem: comissaoDetalhes.origem,
                        objetivo: comissaoDetalhes.objetivo,
                        data_inicio: comissaoDetalhes.data_inicio,
                        data_fim: comissaoDetalhes.data_fim || '',
                        status: comissaoDetalhes.status,
                        observacoes: comissaoDetalhes.observacoes || ''
                      });
                      const integrantes = comissaoDetalhes.comissoes_integrantes
                        ?.filter(ci => ci.ativo)
                        .map(ci => ({
                          irmao_id: ci.irmao_id,
                          irmao_nome: ci.irmaos?.nome || '',
                          irmao_cim: ci.irmaos?.cim || '',
                          funcao: ci.funcao || 'Membro'
                        })) || [];
                      setIntegrantesComissao(integrantes);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    ✏️ Editar
                  </button>
                  <button
                    onClick={() => {
                      setMostrarDetalhesComissao(false);
                      setComissaoDetalhes(null);
                    }}
                    className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================
            PÁGINA: BIBLIOTECA
            ======================================== */}
        {currentPage === 'biblioteca' && (
          <div>
            {/* ABAS */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setAbaBiblioteca('livros')}
                className={`px-6 py-2 rounded-lg font-semibold ${
                  abaBiblioteca === 'livros' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                📚 Livros
              </button>
              <button
                onClick={() => setAbaBiblioteca('emprestimos')}
                className={`px-6 py-2 rounded-lg font-semibold ${
                  abaBiblioteca === 'emprestimos' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                📋 Empréstimos
              </button>
            </div>

            {/* ABA LIVROS */}
            {abaBiblioteca === 'livros' && (
              <div>
                {/* FORMULÁRIO LIVRO */}
                <div className="bg-white rounded-xl shadow-md p-6 mb-6">
                  <h3 className="text-xl font-bold text-blue-900 mb-4">
                    {modoEdicaoLivro ? '✏️ Editar Livro' : '➕ Novo Livro'}
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Título *</label>
                      <input
                        type="text"
                        value={livroForm.titulo}
                        onChange={(e) => setLivroForm({ ...livroForm, titulo: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Autor</label>
                      <input
                        type="text"
                        value={livroForm.autor}
                        onChange={(e) => setLivroForm({ ...livroForm, autor: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Categoria *</label>
                      <select
                        value={livroForm.categoria}
                        onChange={(e) => setLivroForm({ ...livroForm, categoria: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        <option value="Ritualística">Ritualística</option>
                        <option value="Filosofia">Filosofia</option>
                        <option value="História">História</option>
                        <option value="Simbolismo">Simbolismo</option>
                        <option value="Legislação">Legislação</option>
                        <option value="Geral">Geral</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Localização</label>
                      <input
                        type="text"
                        value={livroForm.localizacao}
                        onChange={(e) => setLivroForm({ ...livroForm, localizacao: e.target.value })}
                        placeholder="Ex: Estante A - Prateleira 2"
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Quantidade Total *</label>
                      <input
                        type="number"
                        value={livroForm.quantidade_total}
                        onChange={(e) => setLivroForm({ 
                          ...livroForm, 
                          quantidade_total: parseInt(e.target.value),
                          quantidade_disponivel: modoEdicaoLivro ? livroForm.quantidade_disponivel : parseInt(e.target.value)
                        })}
                        min="1"
                        className="w-full px-3 py-2 border rounded-lg"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button
                      type="button"
                      onClick={salvarLivro}
                      disabled={loading}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      {loading ? 'Salvando...' : (modoEdicaoLivro ? 'Atualizar' : 'Salvar')}
                    </button>
                    {modoEdicaoLivro && (
                      <button
                        type="button"
                        onClick={() => {
                          setModoEdicaoLivro(false);
                          setLivroEditando(null);
                          setLivroForm({
                            titulo: '', autor: '', editora: '', ano_publicacao: '', isbn: '',
                            categoria: 'Ritualística', localizacao: '', quantidade_total: 1,
                            quantidade_disponivel: 1, observacoes: ''
                          });
                        }}
                        className="px-6 py-2 bg-gray-500 text-white rounded-lg"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>

                {/* LISTA DE LIVROS */}
                <div className="bg-white rounded-xl shadow-md p-6">
                  <h3 className="text-xl font-bold text-blue-900 mb-4">📚 Acervo</h3>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b-2">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Título</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Autor</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Localização</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Disponível</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {livros.map(livro => (
                          <tr key={livro.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 font-medium text-gray-900">{livro.titulo}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">{livro.autor || '-'}</td>
                            <td className="px-6 py-4 text-sm">
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                                {livro.categoria}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">{livro.localizacao || '-'}</td>
                            <td className="px-6 py-4 text-center">
                              <span className={`font-bold ${livro.quantidade_disponivel > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {livro.quantidade_disponivel}/{livro.quantidade_total}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex justify-center gap-2">
                                <button
                                  onClick={() => {
                                    setModoEdicaoLivro(true);
                                    setLivroEditando(livro);
                                    setLivroForm(livro);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }}
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => deletarLivro(livro.id)}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {livros.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      Nenhum livro cadastrado
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ABA EMPRÉSTIMOS */}
            {abaBiblioteca === 'emprestimos' && (
              <div>
                {/* FORMULÁRIO EMPRÉSTIMO */}
                <div className="bg-white rounded-xl shadow-md p-6 mb-6">
                  <h3 className="text-xl font-bold text-blue-900 mb-4">
                    {modoEdicaoEmprestimo ? '✏️ Editar Empréstimo' : '📋 Novo Empréstimo'}
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Livro *</label>
                      <select
                        value={emprestimoForm.livro_id}
                        onChange={(e) => setEmprestimoForm({ ...emprestimoForm, livro_id: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-100"
                        required
                        disabled={modoEdicaoEmprestimo}
                      >
                        <option value="">Selecione um livro</option>
                        {livros.filter(l => l.quantidade_disponivel > 0 || l.id === emprestimoForm.livro_id).map(livro => (
                          <option key={livro.id} value={livro.id}>
                            {livro.titulo} {!modoEdicaoEmprestimo && `(${livro.quantidade_disponivel} disponível)`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Irmão *</label>
                      <select
                        value={emprestimoForm.irmao_id}
                        onChange={(e) => setEmprestimoForm({ ...emprestimoForm, irmao_id: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-100"
                        required
                        disabled={modoEdicaoEmprestimo}
                      >
                        <option value="">Selecione um irmão</option>
                        {irmaos.map(irmao => (
                          <option key={irmao.id} value={irmao.id}>
                            {irmao.nome} - CIM {irmao.cim}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Devolução Prevista *</label>
                      <input
                        type="date"
                        value={emprestimoForm.data_devolucao_prevista}
                        onChange={(e) => setEmprestimoForm({ ...emprestimoForm, data_devolucao_prevista: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button
                      type="button"
                      onClick={registrarEmprestimo}
                      disabled={loading}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      {loading 
                        ? (modoEdicaoEmprestimo ? 'Atualizando...' : 'Registrando...') 
                        : (modoEdicaoEmprestimo ? '✅ Atualizar' : '📖 Registrar Empréstimo')
                      }
                    </button>
                    {modoEdicaoEmprestimo && (
                      <button
                        type="button"
                        onClick={() => {
                          setModoEdicaoEmprestimo(false);
                          setEmprestimoEditando(null);
                          setEmprestimoForm({
                            livro_id: '',
                            irmao_id: '',
                            data_emprestimo: new Date().toISOString().split('T')[0],
                            data_devolucao_prevista: new Date(Date.now() + 15*24*60*60*1000).toISOString().split('T')[0],
                            observacoes: ''
                          });
                        }}
                        className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>

                {/* LISTA DE EMPRÉSTIMOS */}
                <div className="bg-white rounded-xl shadow-md p-6">
                  <h3 className="text-xl font-bold text-blue-900 mb-4">📋 Empréstimos Ativos</h3>
                  
                  <div className="space-y-3">
                    {emprestimos.map(emp => {
                      const hoje = new Date();
                      const vencimento = new Date(emp.data_devolucao_prevista + 'T00:00:00');
                      const atrasado = vencimento < hoje;
                      const diasAtraso = atrasado ? Math.floor((hoje - vencimento) / (1000*60*60*24)) : 0;

                      return (
                        <div key={emp.id} className={`p-4 rounded-lg border-2 ${atrasado ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-300'}`}>
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-bold text-gray-900">{emp.biblioteca_livros?.titulo}</div>
                              <div className="text-sm text-gray-600 mt-1">
                                <span className="font-medium">Irmão:</span> {emp.irmaos?.nome} (CIM: {emp.irmaos?.cim})
                              </div>
                              <div className="text-sm text-gray-600">
                                <span className="font-medium">Emprestado:</span> {formatarData(emp.data_emprestimo)}
                              </div>
                              <div className={`text-sm ${atrasado ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                                <span className="font-medium">Devolução:</span> {formatarData(emp.data_devolucao_prevista)}
                                {atrasado && ` (⚠️ ${diasAtraso} dias de atraso)`}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setModoEdicaoEmprestimo(true);
                                  setEmprestimoEditando(emp);
                                  setEmprestimoForm({
                                    livro_id: emp.livro_id,
                                    irmao_id: emp.irmao_id,
                                    data_emprestimo: emp.data_emprestimo,
                                    data_devolucao_prevista: emp.data_devolucao_prevista,
                                    observacoes: emp.observacoes || ''
                                  });
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm"
                              >
                                ✏️ Editar
                              </button>
                              <button
                                onClick={() => registrarDevolucao(emp.id)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                              >
                                ✅ Devolver
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {emprestimos.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      Nenhum empréstimo ativo
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
export default App;
