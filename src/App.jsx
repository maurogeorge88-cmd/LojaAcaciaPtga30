import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// ========================================
// CONFIGURAÇÃO SUPABASE
// ========================================
const supabaseUrl = 'https://ypnvzjctyfdrkkrhskzs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwbnZ6amN0eWZkcmtrcmhza3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NTgxMzcsImV4cCI6MjA3OTMzNDEzN30.J5Jj7wudOhIAxy35DDBIWtr9yr9Lq3ABBRI9ZJ5z2pc';
const supabase = createClient(supabaseUrl, supabaseKey);

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
  const [tiposSessao, setTiposSessao] = useState([]);
  const [cargosLoja, setCargosLoja] = useState([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [situacaoFilter, setSituacaoFilter] = useState('Todos');
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
  const [filhos, setFilhos] = useState([{ nome: '', data_nascimento: '', falecido: false, data_obito: '' }]);

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
        loadTiposSessao();
        loadCargosLoja();
        loadBalaustres();
        loadUsuarios();
        loadPermissoes();
        loadPranchas();
        loadCorpoAdmin();
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
    
    if (data) setIrmaos(data);
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
          familiares.push({ ...f, tipo: 'filho' });
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
    const novosFilhos = [...filhos, { nome: '', data_nascimento: '', falecido: false, data_obito: '' }];
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
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <header className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <img src={LOGO_URL} alt="Logo" className="w-12 h-12 rounded-full border-2 border-white" />
              <div>
                <h1 className="text-2xl font-bold">{NOME_LOJA}</h1>
                <p className="text-sm text-blue-200">Gestão e Controle</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-semibold">{userData?.nome}</p>
                <p className="text-sm text-blue-200 capitalize">{userData?.cargo}</p>
              </div>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-semibold transition"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* NAVEGAÇÃO */}
      <nav className="bg-white shadow-md border-b-2 border-blue-200">
        <div className="container mx-auto px-4">
          <div className="flex gap-2 overflow-x-auto py-2">
            <button
              onClick={() => setCurrentPage('dashboard')}
              className={`px-6 py-3 rounded-lg font-semibold transition whitespace-nowrap ${
                currentPage === 'dashboard'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              📊 Dashboard
            </button>
            <button
              onClick={() => setCurrentPage('cadastro')}
              className={`px-6 py-3 rounded-lg font-semibold transition whitespace-nowrap ${
                currentPage === 'cadastro'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              ➕ Cadastro de Irmãos
            </button>
            <button
              onClick={() => setCurrentPage('visualizar')}
              className={`px-6 py-3 rounded-lg font-semibold transition whitespace-nowrap ${
                currentPage === 'visualizar'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              👥 Visualizar Irmãos
            </button>
            <button
              onClick={() => setCurrentPage('balaustres')}
              className={`px-6 py-3 rounded-lg font-semibold transition whitespace-nowrap ${
                currentPage === 'balaustres'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              📜 Balaustres
            </button>
            <button
              onClick={() => setCurrentPage('pranchas')}
              className={`px-6 py-3 rounded-lg font-semibold transition whitespace-nowrap ${
                currentPage === 'pranchas'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              📄 Pranchas
            </button>
            <button
              onClick={() => setCurrentPage('corpo-admin')}
              className={`px-6 py-3 rounded-lg font-semibold transition whitespace-nowrap ${
                currentPage === 'corpo-admin'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              👔 Administração
            </button>
            {permissoes?.canManageUsers && (
              <button
                onClick={() => setCurrentPage('usuarios')}
                className={`px-6 py-3 rounded-lg font-semibold transition whitespace-nowrap ${
                  currentPage === 'usuarios'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                👤 Gerenciar Usuários
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* MENSAGENS */}
      {error && (
        <div className="container mx-auto px-4 mt-4">
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg">
            {error}
          </div>
        </div>
      )}

      {successMessage && (
        <div className="container mx-auto px-4 mt-4">
          <div className="bg-green-50 border-l-4 border-green-500 text-green-700 p-4 rounded-lg">
            {successMessage}
          </div>
        </div>
      )}

      {/* CONTEÚDO PRINCIPAL */}
      <main className="container mx-auto px-4 py-8">
        {/* DASHBOARD */}
        {currentPage === 'dashboard' && (
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-6">📊 Dashboard</h2>
            
            {/* Cards de Graus */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-xl shadow-lg">
                <h3 className="text-lg font-semibold mb-3">Irmãos Regulares</h3>
                <p className="text-5xl font-bold mb-4">{irmaosRegulares.length}</p>
                <div className="border-t border-blue-400 pt-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>⬜ Aprendizes:</span>
                    <span className="font-bold">{irmaosAprendiz}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>🔷 Companheiros:</span>
                    <span className="font-bold">{irmaosCompanheiro}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>🔺 Mestres:</span>
                    <span className="font-bold">{irmaosMestre}</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-xl shadow-lg">
                <h3 className="text-lg font-semibold mb-2">Total Geral</h3>
                <p className="text-4xl font-bold mb-2">{totalIrmaos}</p>
                <p className="text-sm opacity-90">Todas as situações</p>
              </div>
              
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-xl shadow-lg">
                <h3 className="text-lg font-semibold mb-2">Balaustres</h3>
                <p className="text-4xl font-bold">{balaustres.length}</p>
                <p className="text-sm mt-2 opacity-90">Registrados</p>
              </div>
            </div>

            {/* Cards de Situações */}
            <div className="bg-white rounded-xl shadow-md p-6 mb-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">📋 Situação dos Irmãos</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-green-50 border-2 border-green-200 p-4 rounded-lg">
                  <div className="text-green-600 text-sm font-semibold mb-1">✅ Regulares</div>
                  <div className="text-3xl font-bold text-green-700">{irmaosRegulares.length}</div>
                </div>
                <div className="bg-yellow-50 border-2 border-yellow-200 p-4 rounded-lg">
                  <div className="text-yellow-600 text-sm font-semibold mb-1">⚠️ Irregulares</div>
                  <div className="text-3xl font-bold text-yellow-700">{irmaosIrregulares.length}</div>
                </div>
                <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-lg">
                  <div className="text-blue-600 text-sm font-semibold mb-1">🎫 Licenciados</div>
                  <div className="text-3xl font-bold text-blue-700">{irmaosLicenciados.length}</div>
                </div>
                <div className="bg-orange-50 border-2 border-orange-200 p-4 rounded-lg">
                  <div className="text-orange-600 text-sm font-semibold mb-1">🚫 Suspensos</div>
                  <div className="text-3xl font-bold text-orange-700">{irmaosSuspensos.length}</div>
                </div>
                <div className="bg-gray-50 border-2 border-gray-200 p-4 rounded-lg">
                  <div className="text-gray-600 text-sm font-semibold mb-1">↩️ Desligados</div>
                  <div className="text-3xl font-bold text-gray-700">{irmaosDesligados.length}</div>
                </div>
                <div className="bg-red-50 border-2 border-red-200 p-4 rounded-lg">
                  <div className="text-red-600 text-sm font-semibold mb-1">❌ Excluídos</div>
                  <div className="text-3xl font-bold text-red-700">{irmaosExcluidos.length}</div>
                </div>
                <div className="bg-purple-50 border-2 border-purple-200 p-4 rounded-lg">
                  <div className="text-purple-600 text-sm font-semibold mb-1">🕊️ Falecidos</div>
                  <div className="text-3xl font-bold text-purple-700">{irmaosFalecidos.length}</div>
                </div>
                <div className="bg-indigo-50 border-2 border-indigo-200 p-4 rounded-lg">
                  <div className="text-indigo-600 text-sm font-semibold mb-1">👔 Ex-Ofício</div>
                  <div className="text-3xl font-bold text-indigo-700">{irmaosExOficio.length}</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Bem-vindo ao Sistema</h3>
              <p className="text-gray-600">
                Utilize o menu de navegação para acessar as diferentes funcionalidades do sistema.
              </p>
            </div>
          </div>
        )}

        {/* CONTROLE DE BALAUSTRES */}
        {currentPage === 'balaustres' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-gray-800">📜 Controle de Balaustres</h2>
            </div>

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

                {/* Ordem do Dia */}
                <div className="mt-4">
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
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
                  <textarea
                    value={balaustreForm.observacoes}
                    onChange={(e) => setBalaustreForm({ ...balaustreForm, observacoes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    rows="3"
                    placeholder="Observações adicionais..."
                  />
                </div>

                {/* Botões */}
                <div className="flex justify-end gap-4 mt-6">
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
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-gray-800">👥 Quadro de Irmãos</h2>
            </div>

            {/* Filtros */}
            <div className="bg-white rounded-xl shadow-md p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="🔍 Buscar por nome ou CIM..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <select
                  value={situacaoFilter}
                  onChange={(e) => setSituacaoFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="Todos">Todas as Situações</option>
                  {situacoesPossiveis.map(sit => (
                    <option key={sit.valor} value={sit.valor}>{sit.valor}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tabela de Irmãos */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">CIM</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grau</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Situação</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {irmaos
                    .filter(irmao => {
                      const matchSearch = irmao.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        irmao.cim?.toString().includes(searchTerm);
                      const matchSituacao = situacaoFilter === 'Todos' || irmao.situacao === situacaoFilter;
                      return matchSearch && matchSituacao;
                    })
                    .sort((a, b) => a.nome.localeCompare(b.nome))
                    .map(irmao => (
                      <tr key={irmao.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{irmao.nome}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600">{irmao.cim}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                            {obterGrau(irmao) === 'Mestre' && '🔺'}
                            {obterGrau(irmao) === 'Companheiro' && '🔷'}
                            {obterGrau(irmao) === 'Aprendiz' && '⬜'}
                            {' '}{obterGrau(irmao)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border-2 ${obterCorSituacao(irmao.situacao)}`}>
                            {irmao.situacao}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex justify-center gap-2">
                            {permissoes?.canEdit && (
                              <button
                                onClick={() => handleEditarIrmao(irmao)}
                                className="text-blue-600 hover:text-blue-800 font-semibold"
                                title="Editar"
                              >
                                ✏️
                              </button>
                            )}
                            <button
                              onClick={() => handleVisualizarDetalhes(irmao)}
                              className="text-gray-600 hover:text-gray-800 font-semibold"
                              title="Detalhes"
                            >
                              👁️
                            </button>
                            <button
                              onClick={() => gerarPDFIrmao(irmao)}
                              className="text-green-600 hover:text-green-800 font-semibold"
                              title="Gerar PDF"
                            >
                              📄
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              
              {irmaos.filter(irmao => {
                const matchSearch = irmao.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  irmao.cim?.toString().includes(searchTerm);
                const matchSituacao = situacaoFilter === 'Todos' || irmao.situacao === situacaoFilter;
                return matchSearch && matchSituacao;
              }).length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  Nenhum irmão encontrado com os filtros selecionados
                </div>
              )}
            </div>
          </div>
        )}
        {/* CADASTRO DE IRMÃOS */}
        {currentPage === 'cadastro' && (
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-6">
              {modoEdicao ? '✏️ Editar Cadastro de Irmão' : '➕ Cadastro de Novo Irmão'}
            </h2>

            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="space-y-8">
                {/* Dados Pessoais */}
                <div>
                  <h3 className="text-xl font-bold text-blue-900 mb-4 pb-2 border-b-2 border-blue-200">
                    👤 Dados Pessoais
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">CIM *</label>
                      <input
                        type="text"
                        value={irmaoForm.cim}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, cim: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        required
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Nome Completo *</label>
                      <input
                        type="text"
                        value={irmaoForm.nome}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, nome: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">CPF</label>
                      <input
                        type="text"
                        value={irmaoForm.cpf}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, cpf: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">RG</label>
                      <input
                        type="text"
                        value={irmaoForm.rg}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, rg: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Data de Nascimento</label>
                      <input
                        type="date"
                        value={irmaoForm.data_nascimento}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, data_nascimento: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    {irmaoForm.data_nascimento && (
                      <div className="md:col-span-3 bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <p className="text-sm font-semibold text-blue-900">
                          🎂 Idade: {calcularIdade(irmaoForm.data_nascimento)}
                        </p>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Estado Civil</label>
                      <select
                        value={irmaoForm.estado_civil}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, estado_civil: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="">Selecione...</option>
                        <option value="solteiro">Solteiro</option>
                        <option value="casado">Casado</option>
                        <option value="divorciado">Divorciado</option>
                        <option value="viuvo">Viúvo</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Profissão</label>
                      <input
                        type="text"
                        value={irmaoForm.profissao}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, profissao: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Formação</label>
                      <input
                        type="text"
                        value={irmaoForm.formacao}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, formacao: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Situação *</label>
                      <select
                        value={irmaoForm.situacao}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, situacao: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        required
                      >
                        {situacoesPossiveis.map(sit => (
                          <option key={sit.valor} value={sit.valor}>{sit.valor}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Dados de Contato */}
                <div>
                  <h3 className="text-xl font-bold text-green-900 mb-4 pb-2 border-b-2 border-green-200">
                    📞 Dados de Contato
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                      <input
                        type="email"
                        value={irmaoForm.email}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Celular</label>
                      <input
                        type="text"
                        value={irmaoForm.celular}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, celular: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Naturalidade</label>
                      <input
                        type="text"
                        value={irmaoForm.naturalidade}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, naturalidade: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Endereço</label>
                      <input
                        type="text"
                        value={irmaoForm.endereco}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, endereco: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Cidade</label>
                      <input
                        type="text"
                        value={irmaoForm.cidade}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, cidade: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Dados Profissionais */}
                <div>
                  <h3 className="text-xl font-bold text-orange-900 mb-4 pb-2 border-b-2 border-orange-200">
                    💼 Dados Profissionais
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Local de Trabalho</label>
                      <input
                        type="text"
                        value={irmaoForm.local_trabalho}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, local_trabalho: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Cargo</label>
                      <input
                        type="text"
                        value={irmaoForm.cargo}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, cargo: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Dados Maçônicos */}
                <div>
                  <h3 className="text-xl font-bold text-purple-900 mb-4 pb-2 border-b-2 border-purple-200">
                    🔺 Dados Maçônicos
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Data de Iniciação</label>
                      <input
                        type="date"
                        value={irmaoForm.data_iniciacao}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, data_iniciacao: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Data de Elevação</label>
                      <input
                        type="date"
                        value={irmaoForm.data_elevacao}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, data_elevacao: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Data de Exaltação</label>
                      <input
                        type="date"
                        value={irmaoForm.data_exaltacao}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, data_exaltacao: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    {irmaoForm.data_iniciacao && (
                      <div className="md:col-span-3 bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <p className="text-sm font-semibold text-blue-900">
                          ⏱️ Tempo de Maçonaria: {calcularTempoMaconaria(irmaoForm.data_iniciacao)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dados da Esposa */}
                <div>
                  <h3 className="text-xl font-bold text-pink-900 mb-4 pb-2 border-b-2 border-pink-200">
                    💑 Dados da Esposa (Opcional)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Nome</label>
                      <input
                        type="text"
                        value={esposa.nome}
                        onChange={(e) => setEsposa({ ...esposa, nome: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Data de Nascimento</label>
                      <input
                        type="date"
                        value={esposa.data_nascimento}
                        onChange={(e) => setEsposa({ ...esposa, data_nascimento: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Dados dos Pais */}
                <div>
                  <h3 className="text-xl font-bold text-green-900 mb-4 pb-2 border-b-2 border-green-200">
                    👨‍👩‍👦 Dados dos Pais (Opcional)
                  </h3>
                  
                  <div className="mb-6">
                    <p className="font-semibold text-gray-700 mb-3">Pai:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Nome</label>
                        <input
                          type="text"
                          value={pai.nome}
                          onChange={(e) => setPai({ ...pai, nome: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Data de Nascimento</label>
                        <input
                          type="date"
                          value={pai.data_nascimento}
                          onChange={(e) => setPai({ ...pai, data_nascimento: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div className="flex items-center">
                        <label className="flex items-center cursor-pointer mt-6">
                          <input
                            type="checkbox"
                            checked={pai.falecido}
                            onChange={(e) => setPai({ ...pai, falecido: e.target.checked })}
                            className="w-4 h-4 text-blue-600"
                          />
                          <span className="ml-2 text-sm font-medium text-gray-700">Falecido</span>
                        </label>
                      </div>
                      {pai.falecido && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Data do Óbito</label>
                          <input
                            type="date"
                            value={pai.data_obito}
                            onChange={(e) => setPai({ ...pai, data_obito: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="font-semibold text-gray-700 mb-3">Mãe:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Nome</label>
                        <input
                          type="text"
                          value={mae.nome}
                          onChange={(e) => setMae({ ...mae, nome: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Data de Nascimento</label>
                        <input
                          type="date"
                          value={mae.data_nascimento}
                          onChange={(e) => setMae({ ...mae, data_nascimento: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div className="flex items-center">
                        <label className="flex items-center cursor-pointer mt-6">
                          <input
                            type="checkbox"
                            checked={mae.falecido}
                            onChange={(e) => setMae({ ...mae, falecido: e.target.checked })}
                            className="w-4 h-4 text-blue-600"
                          />
                          <span className="ml-2 text-sm font-medium text-gray-700">Falecida</span>
                        </label>
                      </div>
                      {mae.falecido && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Data do Óbito</label>
                          <input
                            type="date"
                            value={mae.data_obito}
                            onChange={(e) => setMae({ ...mae, data_obito: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Dados dos Filhos */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-purple-900 pb-2 border-b-2 border-purple-200">
                      👶 Dados dos Filhos (Opcional)
                    </h3>
                    <button
                      type="button"
                      onClick={adicionarFilho}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
                    >
                      + Adicionar Filho
                    </button>
                  </div>
                  
                  {filhos.map((filho, index) => (
                    <div key={index} className="mb-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="flex justify-between items-center mb-3">
                        <p className="font-semibold text-gray-700">Filho {index + 1}:</p>
                        {filhos.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removerFilho(index)}
                            className="text-red-600 hover:text-red-800 text-sm font-semibold"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Nome</label>
                          <input
                            type="text"
                            value={filho.nome}
                            onChange={(e) => atualizarFilho(index, 'nome', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Data de Nascimento</label>
                          <input
                            type="date"
                            value={filho.data_nascimento}
                            onChange={(e) => atualizarFilho(index, 'data_nascimento', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div className="flex items-center">
                          <label className="flex items-center cursor-pointer mt-6">
                            <input
                              type="checkbox"
                              checked={filho.falecido}
                              onChange={(e) => atualizarFilho(index, 'falecido', e.target.checked)}
                              className="w-4 h-4 text-blue-600"
                            />
                            <span className="ml-2 text-sm font-medium text-gray-700">Falecido</span>
                          </label>
                        </div>
                        {filho.falecido && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Data do Óbito</label>
                            <input
                              type="date"
                              value={filho.data_obito}
                              onChange={(e) => atualizarFilho(index, 'data_obito', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Botões de ação */}
                <div className="flex justify-end gap-4 pt-6 border-t">
                  <button
                    type="button"
                    onClick={limparFormulario}
                    className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition"
                  >
                    {modoEdicao ? 'Cancelar' : 'Limpar Formulário'}
                  </button>
                  <button
                    onClick={modoEdicao ? handleAtualizarIrmao : handleSubmitIrmao}
                    disabled={loading || !irmaoForm.cim || !irmaoForm.nome}
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Salvando...' : modoEdicao ? '💾 Atualizar Cadastro' : '💾 Salvar Cadastro'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* GERENCIAMENTO DE USUÁRIOS */}
        {currentPage === 'usuarios' && permissoes?.canManageUsers && (
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-6">👤 Gerenciamento de Usuários</h2>

            {/* FORMULÁRIO DE USUÁRIO */}
            <div className="bg-white rounded-xl shadow-md p-6 mb-6">
              <h3 className="text-xl font-bold text-blue-900 mb-4">
                {modoEdicaoUsuario ? '✏️ Editar Usuário' : '➕ Novo Usuário'}
              </h3>

              <form onSubmit={modoEdicaoUsuario ? handleAtualizarUsuario : handleSubmitUsuario}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nome Completo *</label>
                    <input
                      type="text"
                      value={usuarioForm.nome}
                      onChange={(e) => setUsuarioForm({ ...usuarioForm, nome: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                    <input
                      type="email"
                      value={usuarioForm.email}
                      onChange={(e) => setUsuarioForm({ ...usuarioForm, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                      disabled={modoEdicaoUsuario}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Senha {modoEdicaoUsuario ? '(deixe vazio para não alterar)' : '*'}
                    </label>
                    <input
                      type="password"
                      value={usuarioForm.senha}
                      onChange={(e) => setUsuarioForm({ ...usuarioForm, senha: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      required={!modoEdicaoUsuario}
                      minLength={6}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Cargo *</label>
                    <select
                      value={usuarioForm.cargo}
                      onChange={(e) => setUsuarioForm({ ...usuarioForm, cargo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    >
                      <option value="irmao">Irmão</option>
                      <option value="secretario">Secretário</option>
                      <option value="tesoureiro">Tesoureiro</option>
                      <option value="chanceler">Chanceler</option>
                      <option value="veneravel">Venerável</option>
                      <option value="administrador">Administrador</option>
                    </select>
                  </div>

                  <div className="flex items-center">
                    <label className="flex items-center cursor-pointer mt-6">
                      <input
                        type="checkbox"
                        checked={usuarioForm.ativo}
                        onChange={(e) => setUsuarioForm({ ...usuarioForm, ativo: e.target.checked })}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700">Usuário Ativo</span>
                    </label>
                  </div>
                </div>

                {/* Mostrar permissões do cargo selecionado */}
                {getPermissoesUsuario(usuarioForm.cargo) && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="font-semibold text-blue-900 mb-2">Permissões do cargo "{usuarioForm.cargo}":</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div className="flex items-center">
                        <span className={getPermissoesUsuario(usuarioForm.cargo).pode_editar_cadastros ? 'text-green-600' : 'text-red-600'}>
                          {getPermissoesUsuario(usuarioForm.cargo).pode_editar_cadastros ? '✅' : '❌'}
                        </span>
                        <span className="ml-2">Editar Cadastros</span>
                      </div>
                      <div className="flex items-center">
                        <span className={getPermissoesUsuario(usuarioForm.cargo).pode_visualizar_financeiro ? 'text-green-600' : 'text-red-600'}>
                          {getPermissoesUsuario(usuarioForm.cargo).pode_visualizar_financeiro ? '✅' : '❌'}
                        </span>
                        <span className="ml-2">Ver Financeiro</span>
                      </div>
                      <div className="flex items-center">
                        <span className={getPermissoesUsuario(usuarioForm.cargo).pode_editar_financeiro ? 'text-green-600' : 'text-red-600'}>
                          {getPermissoesUsuario(usuarioForm.cargo).pode_editar_financeiro ? '✅' : '❌'}
                        </span>
                        <span className="ml-2">Editar Financeiro</span>
                      </div>
                      <div className="flex items-center">
                        <span className={getPermissoesUsuario(usuarioForm.cargo).pode_gerenciar_usuarios ? 'text-green-600' : 'text-red-600'}>
                          {getPermissoesUsuario(usuarioForm.cargo).pode_gerenciar_usuarios ? '✅' : '❌'}
                        </span>
                        <span className="ml-2">Gerenciar Usuários</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-4 mt-6">
                  {modoEdicaoUsuario && (
                    <button
                      type="button"
                      onClick={limparFormularioUsuario}
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
                    {loading ? 'Salvando...' : modoEdicaoUsuario ? '💾 Atualizar' : '💾 Criar Usuário'}
                  </button>
                </div>
              </form>
            </div>

            {/* LISTA DE USUÁRIOS */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                <h3 className="text-xl font-bold">Usuários Cadastrados</h3>
                <p className="text-sm text-blue-100">Total: {usuarios.length} usuários</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b-2 border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cargo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {usuarios.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                          Nenhum usuário cadastrado
                        </td>
                      </tr>
                    ) : (
                      usuarios.map((usuario) => (
                        <tr key={usuario.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-medium text-gray-900">{usuario.nome}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-600">{usuario.email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 capitalize">
                              {usuario.cargo}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                              usuario.ativo 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {usuario.ativo ? '✅ Ativo' : '❌ Inativo'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => handleEditarUsuario(usuario)}
                                className="text-blue-600 hover:text-blue-800 font-semibold"
                                title="Editar"
                              >
                                ✏️
                              </button>
                              {usuario.email !== userData?.email && (
                                <button
                                  onClick={() => handleExcluirUsuario(usuario)}
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

        {/* PRANCHAS EXPEDIDAS */}
        {currentPage === 'pranchas' && (
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-6">📄 Controle de Pranchas Expedidas</h2>

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
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-6">👔 Corpo Administrativo</h2>

            {/* FORMULÁRIO DE CADASTRO */}
            <div className="bg-white rounded-xl shadow-md p-6 mb-6">
              <h3 className="text-xl font-bold text-blue-900 mb-4">
                {modoEdicaoCorpoAdmin ? '✏️ Editar Cargo Administrativo' : '➕ Registrar Cargo Administrativo'}
              </h3>

              <form onSubmit={modoEdicaoCorpoAdmin ? handleAtualizarCorpoAdmin : handleSubmitCorpoAdmin}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Irmão *</label>
                    <select
                      value={corpoAdminForm.irmao_id}
                      onChange={(e) => setCorpoAdminForm({ ...corpoAdminForm, irmao_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    >
                      <option value="">Selecione um irmão</option>
                      {irmaos
                        .filter(i => i.status === 'ativo')
                        .map(irmao => (
                          <option key={irmao.id} value={irmao.id}>
                            {irmao.nome} - CIM {irmao.cim}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Cargo *</label>
                    <select
                      value={corpoAdminForm.cargo}
                      onChange={(e) => setCorpoAdminForm({ ...corpoAdminForm, cargo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    >
                      <option value="">Selecione um cargo</option>
                      {cargosAdministrativos.map((cargo) => (
                        <option key={cargo} value={cargo}>
                          {cargo}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Ano de Exercício *</label>
                    <input
                      type="text"
                      value={corpoAdminForm.ano_exercicio}
                      onChange={(e) => setCorpoAdminForm({ ...corpoAdminForm, ano_exercicio: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Ex: 2024"
                      required
                      pattern="[0-9]{4}"
                      title="Digite um ano válido (4 dígitos)"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-4 mt-6">
                  {modoEdicaoCorpoAdmin && (
                    <button
                      type="button"
                      onClick={limparFormularioCorpoAdmin}
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
                    {loading ? 'Salvando...' : modoEdicaoCorpoAdmin ? '💾 Atualizar Cargo' : '💾 Registrar Cargo'}
                  </button>
                </div>
              </form>
            </div>

            {/* FILTRO POR ANO */}
            <div className="bg-white rounded-xl shadow-md p-4 mb-6">
              <div className="flex gap-4 items-center">
                <label className="font-medium text-gray-700">Filtrar por Ano:</label>
                <input
                  type="text"
                  placeholder="Digite o ano (ex: 2024)"
                  value={anoFiltroAdmin}
                  onChange={(e) => setAnoFiltroAdmin(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  pattern="[0-9]*"
                />
                {anoFiltroAdmin && (
                  <button
                    onClick={() => setAnoFiltroAdmin('')}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-semibold transition"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>

            {/* LISTA POR ANO */}
            <div className="space-y-6">
              {[...new Set(corpoAdmin
                .filter(ca => !anoFiltroAdmin || ca.ano_exercicio?.includes(anoFiltroAdmin))
                .map(ca => ca.ano_exercicio))]
                .sort((a, b) => b - a)
                .map(ano => (
                  <div key={ano} className="bg-white rounded-xl shadow-md overflow-hidden">
                    <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                      <h3 className="text-xl font-bold">Administração {ano}</h3>
                      <p className="text-sm text-blue-100">
                        {corpoAdmin.filter(ca => ca.ano_exercicio === ano).length} cargos
                      </p>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b-2 border-gray-200">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cargo</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Irmão</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">CIM</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {corpoAdmin
                            .filter(ca => ca.ano_exercicio === ano)
                            .sort((a, b) => {
                              // Ordem por cargo (alfabética)
                              return (a.cargo || '').localeCompare(b.cargo || '');
                            })
                            .map((item) => (
                              <tr key={item.id} className="hover:bg-gray-50 transition">
                                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                                  {item.cargo || 'Cargo não informado'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                  {item.irmao?.nome || 'Irmão não encontrado'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                  {item.irmao?.cim || '-'}
                                </td>
                                <td className="px-6 py-4 text-center">
                                  {permissoes?.canEdit && (
                                    <div className="flex justify-center gap-2">
                                      <button
                                        onClick={() => handleEditarCorpoAdmin(item)}
                                        className="text-blue-600 hover:text-blue-800 font-semibold"
                                        title="Editar"
                                      >
                                        ✏️
                                      </button>
                                      <button
                                        onClick={() => handleExcluirCorpoAdmin(item.id)}
                                        className="text-red-600 hover:text-red-800 font-semibold"
                                        title="Remover"
                                      >
                                        🗑️
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}

              {[...new Set(corpoAdmin
                .filter(ca => !anoFiltroAdmin || ca.ano_exercicio?.includes(anoFiltroAdmin))
                .map(ca => ca.ano_exercicio))].length === 0 && (
                <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-500">
                  {anoFiltroAdmin 
                    ? `Nenhum registro encontrado para o ano "${anoFiltroAdmin}"`
                    : 'Nenhum cargo administrativo registrado'}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
export default App;
