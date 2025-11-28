import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// ========================================
// IMPORTAR COMPONENTES REFATORADOS
// ========================================
import { Dashboard } from './components/Dashboard';
import { CorpoAdmin } from './components/administracao/CorpoAdmin';
import Usuarios from './components/administracao/Usuarios';
import CadastrarIrmao from './components/irmaos/CadastrarIrmao';
import VisualizarIrmaos from './components/irmaos/VisualizarIrmaos';
import QuadroIrmaos from './components/irmaos/QuadroIrmaos';
import Balaustres from './components/balaustres/Balaustres';
import Pranchas from './components/pranchas/Pranchas';
import Comissoes from './components/comissoes/Comissoes';
import Biblioteca from './components/biblioteca/Biblioteca';
import VisualizarAltosGraus from './components/vida-maconica/VisualizarAltosGraus';

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
  const [irmaoParaEditar, setIrmaoParaEditar] = useState(null);
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
  
  // Estados para Comissões
  const [comissoes, setComissoes] = useState([]);

  // Estados para Biblioteca
  const [livros, setLivros] = useState([]);
  const [emprestimos, setEmprestimos] = useState([]);

  // Estados para Balaustre
  const [grauSelecionado, setGrauSelecionado] = useState('Aprendiz');

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

  const loadComissoes = async () => {
    try {
      console.log('🔍 Carregando comissões...');
      const { data, error } = await supabase
        .from('comissoes')
        .select('*')
        .order('data_criacao', { ascending: false });
      
      if (error) {
        console.error('❌ Erro ao carregar comissões:', error);
        return;
      }
      
      console.log('✅ Comissões carregadas:', data?.length || 0);
      setComissoes(data || []);
    } catch (err) {
      console.error('❌ Exceção ao carregar comissões:', err);
      setComissoes([]);
    }
  };

  const loadLivros = async () => {
    try {
      console.log('🔍 Carregando livros...');
      const { data, error } = await supabase
        .from('biblioteca_livros')
        .select('*')
        .order('titulo', { ascending: true });
      
      if (error) {
        console.error('❌ Erro ao carregar livros:', error);
        return;
      }
      
      console.log('✅ Livros carregados:', data?.length || 0);
      setLivros(data || []);
    } catch (err) {
      console.error('❌ Exceção ao carregar livros:', err);
      setLivros([]);
    }
  };

  const loadEmprestimos = async () => {
    try {
      console.log('🔍 Carregando empréstimos...');
      const { data, error } = await supabase
        .from('biblioteca_emprestimos')
        .select('*')
        .order('data_emprestimo', { ascending: false });
      
      if (error) {
        console.error('❌ Erro ao carregar empréstimos:', error);
        return;
      }
      
      console.log('✅ Empréstimos carregados:', data?.length || 0);
      setEmprestimos(data || []);
    } catch (err) {
      console.error('❌ Exceção ao carregar empréstimos:', err);
      setEmprestimos([]);
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

  // ========================================
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
        // Buscar o usuário no Auth pelo email para obter o UUID correto
        const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();
        
        if (listError) throw listError;
        
        // Encontrar o usuário pelo email
        const authUser = authUsers.users.find(u => u.email === usuarioEditando.email);
        
        if (authUser) {
          // Usar o UUID correto do Auth
          const { error: updateError } = await supabase.auth.admin.updateUserById(
            authUser.id,  // UUID do auth.users
            { password: usuarioForm.senha }
          );
          
          if (updateError) throw updateError;
        } else {
          throw new Error('Usuário não encontrado no sistema de autenticação');
        }
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
            onClick={() => setCurrentPage('altos-graus')}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-colors ${
              currentPage === 'altos-graus'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span className="text-xl">🔺</span>
            <span className="font-medium">Altos Graus</span>
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
            
              <span className="text-xl">🔺</span>
              <span className="font-medium">Altos Graus</span>
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
        {currentPage === 'dashboard' && (
          <Dashboard 
            irmaos={irmaos}
            balaustres={balaustres}
          />
        )}

        {/* CADASTRO DE IRMÃOS */}
        {currentPage === 'cadastro' && (
          <CadastrarIrmao
            irmaos={irmaos}
            irmaoParaEditar={irmaoParaEditar}
            onUpdate={loadIrmaos}
            showSuccess={showSuccess}
            showError={showError}
            onCancelarEdicao={() => setIrmaoParaEditar(null)}
          />
        )}

        {/* VISUALIZAR IRMÃOS */}
        {currentPage === 'visualizar' && (
          <VisualizarIrmaos
            irmaos={irmaos}
            onEdit={(irmao) => {
              setIrmaoParaEditar(irmao);
              setCurrentPage('cadastro');
            }}
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


        {/* CONTROLE DE BALAUSTRES */}
        {currentPage === 'balaustres' && (
          <Balaustres
            balaustres={balaustres}
            tiposSessao={tiposSessao}
            session={session}
            onUpdate={() => loadBalaustres(grauSelecionado)}
            showSuccess={showSuccess}
            showError={showError}
          />
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
          <Pranchas
            pranchas={pranchas}
            onUpdate={loadPranchas}
            showSuccess={showSuccess}
            showError={showError}
          />
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

        {/* COMISSÕES */}
        {currentPage === 'comissoes' && (
          <Comissoes
            comissoes={comissoes}
            irmaos={irmaos}
            onUpdate={loadComissoes}
            showSuccess={showSuccess}
            showError={showError}
          />
        )}


        {/* BIBLIOTECA */}
        {currentPage === 'biblioteca' && (
          <Biblioteca
            livros={livros}
            emprestimos={emprestimos}
            irmaos={irmaos}
            onUpdate={() => {
              loadLivros();
              loadEmprestimos();
            }}
            showSuccess={showSuccess}
            showError={showError}
          />
        )}
        </div> {/* Fecha div do conteúdo (px-8 py-6) */}
      </main>
    </div>
  );
}
export default App;
