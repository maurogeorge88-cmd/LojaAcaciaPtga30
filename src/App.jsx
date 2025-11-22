import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// ========================================
// CONFIGURAÇÃO SUPABASE
// ========================================
const supabaseUrl = 'https://ypnvzjctyfdrkkrhskzs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwbnZ6amN0eWZkcmtrcmhza3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NTgxMzcsImV4cCI6MjA3OTMzNDEzN30.J5Jj7wudOhIAxy35DDBIWtr9yr9Lq3ABBRI9ZJ5z2pc';
const supabase = createClient(supabaseUrl, supabaseKey);

// Logo placeholder - SUBSTITUA pela URL da sua logo
const LOGO_URL = 'https://ypnvzjctyfdrkkrhskzs.supabase.co/storage/v1/object/public/LogoAcacia/LogoAcaciaPtga30.png';

// ========================================
// FUNÇÕES AUXILIARES
// ========================================
const calcularTempoMaconaria = (dataIniciacao) => {
  if (!dataIniciacao) return '';
  const inicio = new Date(dataIniciacao);
  const hoje = new Date();
  let anos = hoje.getFullYear() - inicio.getFullYear();
  let meses = hoje.getMonth() - inicio.getMonth();
  if (meses < 0) { anos--; meses = 12 + meses; }
  return `${anos} ano(s) e ${meses} mês(es)`;
};

const calcularIdade = (dataNascimento) => {
  if (!dataNascimento) return '';
  const nascimento = new Date(dataNascimento);
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
  return new Date(data).toLocaleDateString('pt-BR');
};

// ========================================
// COMPONENTE PRINCIPAL
// ========================================
function App() {
  // Estados globais
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
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ativo');
  const [irmaoSelecionado, setIrmaoSelecionado] = useState(null);
  const [familiaresSelecionado, setFamiliaresSelecionado] = useState(null);

  // Estados de edição
  const [modoEdicao, setModoEdicao] = useState(false);
  const [irmaoEditando, setIrmaoEditando] = useState(null);

  // Estados de formulários
  const [irmaoForm, setIrmaoForm] = useState({
    cim: '', nome: '', cpf: '', rg: '', data_nascimento: '',
    estado_civil: '', profissao: '', formacao: '', status: 'ativo',
    naturalidade: '', endereco: '', cidade: '', celular: '',
    email: '', local_trabalho: '', cargo: '',
    data_iniciacao: '', data_elevacao: '', data_exaltacao: ''
  });

  const [esposa, setEsposa] = useState({ nome: '', data_nascimento: '' });
  const [pai, setPai] = useState({ nome: '', data_nascimento: '', falecido: false, data_obito: '' });
  const [mae, setMae] = useState({ nome: '', data_nascimento: '', falecido: false, data_obito: '' });
  const [filhos, setFilhos] = useState([{ nome: '', data_nascimento: '', falecido: false, data_obito: '' }]);

  // Estado de novo usuário
  const [novoUsuario, setNovoUsuario] = useState({
    email: '',
    senha: '',
    nome: '',
    cargo: 'irmao',
    ativo: true
  });

  // ========================================
  // EFEITOS E CARREGAMENTOS
  // ========================================
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        loadUserData(session.user.email);
        loadIrmaos();
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        loadUserData(session.user.email);
        loadIrmaos();
      } else {
        setUserData(null);
        setPermissoes(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async (userEmail) => {
    try {
      const { data, error } = await supabase.from('usuarios').select('*').eq('email', userEmail).single();
      if (error) throw error;
      setUserData(data);
      loadPermissoes(data.cargo);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    }
  };

  const loadPermissoes = async (cargo) => {
    try {
      const { data, error } = await supabase.from('permissoes').select('*').eq('cargo', cargo).single();
      if (error) throw error;
      setPermissoes(data);
    } catch (err) {
      console.error('Erro ao carregar permissões:', err);
    }
  };

  const loadIrmaos = async () => {
    try {
      const { data, error } = await supabase
        .from('irmaos')
        .select('*')
        .order('nome', { ascending: true });
      
      if (error) throw error;
      setIrmaos(data || []);
    } catch (err) {
      console.error('Erro ao carregar irmãos:', err);
    }
  };

  const loadUsuarios = async () => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .order('nome', { ascending: true });
      
      if (error) throw error;
      setUsuarios(data || []);
    } catch (err) {
      console.error('Erro ao carregar usuários:', err);
    }
  };

  const loadFamiliares = async (irmaoId) => {
    try {
      const [esposaRes, paisRes, filhosRes] = await Promise.all([
        supabase.from('esposas').select('*').eq('irmao_id', irmaoId),
        supabase.from('pais').select('*').eq('irmao_id', irmaoId),
        supabase.from('filhos').select('*').eq('irmao_id', irmaoId)
      ]);

      setFamiliaresSelecionado({
        esposa: esposaRes.data?.[0] || null,
        pai: paisRes.data?.find(p => p.tipo === 'pai') || null,
        mae: paisRes.data?.find(p => p.tipo === 'mae') || null,
        filhos: filhosRes.data || []
      });
    } catch (err) {
      console.error('Erro ao carregar familiares:', err);
    }
  };

  // ========================================
  // MÓDULO: AUTENTICAÇÃO
  // ========================================
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const { data: userData, error: userError } = await supabase.from('usuarios').select('*').eq('email', email).single();
      if (userError) throw new Error('Usuário não encontrado no sistema');
      if (!userData.ativo) {
        await supabase.auth.signOut();
        throw new Error('Usuário inativo. Contate o administrador.');
      }
    } catch (err) {
      setError(err.message || 'Erro ao fazer login');
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUserData(null);
    setPermissoes(null);
    setEmail('');
    setPassword('');
    setCurrentPage('dashboard');
  };

  // ========================================
  // MÓDULO: GESTÃO DE FORMULÁRIOS
  // ========================================
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
    setFilhos([...filhos, { nome: '', data_nascimento: '', falecido: false, data_obito: '' }]);
  };

  const removerFilho = (index) => {
    setFilhos(filhos.filter((_, i) => i !== index));
  };

  const atualizarFilho = (index, campo, valor) => {
    const novosFilhos = [...filhos];
    novosFilhos[index][campo] = valor;
    setFilhos(novosFilhos);
  };

  // ========================================
  // MÓDULO: CADASTRO DE IRMÃO
  // ========================================
  const handleSubmitIrmao = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const { data: irmaoData, error: irmaoError } = await supabase
        .from('irmaos')
        .insert([irmaoForm])
        .select()
        .single();

      if (irmaoError) throw irmaoError;

      const irmaoId = irmaoData.id;

      // Inserir familiares
      if (esposa.nome && esposa.nome.trim() !== '') {
        await supabase.from('esposas').insert([{ 
          irmao_id: irmaoId,
          nome: esposa.nome,
          data_nascimento: esposa.data_nascimento || null
        }]);
      }

      if (pai.nome && pai.nome.trim() !== '') {
        await supabase.from('pais').insert([{ 
          irmao_id: irmaoId,
          tipo: 'pai',
          nome: pai.nome,
          data_nascimento: pai.data_nascimento || null,
          falecido: pai.falecido,
          data_obito: pai.falecido ? pai.data_obito || null : null
        }]);
      }

      if (mae.nome && mae.nome.trim() !== '') {
        await supabase.from('pais').insert([{ 
          irmao_id: irmaoId,
          tipo: 'mae',
          nome: mae.nome,
          data_nascimento: mae.data_nascimento || null,
          falecido: mae.falecido,
          data_obito: mae.falecido ? mae.data_obito || null : null
        }]);
      }

      const filhosValidos = filhos.filter(f => f.nome && f.nome.trim() !== '');
      if (filhosValidos.length > 0) {
        await supabase.from('filhos').insert(filhosValidos.map(f => ({
          irmao_id: irmaoId,
          nome: f.nome,
          data_nascimento: f.data_nascimento || null,
          falecido: f.falecido,
          data_obito: f.falecido ? f.data_obito || null : null
        })));
      }

      setSuccessMessage('✅ Irmão cadastrado com sucesso!');
      limparFormulario();
      loadIrmaos();
      window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (err) {
      setError(err.message || 'Erro ao cadastrar irmão');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // MÓDULO: EDIÇÃO DE IRMÃO
  // ========================================
  const iniciarEdicao = async (irmao) => {
    setModoEdicao(true);
    setIrmaoEditando(irmao);
    setIrmaoForm(irmao);
    
    // Carregar familiares para edição
    try {
      const [esposaRes, paisRes, filhosRes] = await Promise.all([
        supabase.from('esposas').select('*').eq('irmao_id', irmao.id),
        supabase.from('pais').select('*').eq('irmao_id', irmao.id),
        supabase.from('filhos').select('*').eq('irmao_id', irmao.id)
      ]);

      setEsposa(esposaRes.data?.[0] || { nome: '', data_nascimento: '' });
      setPai(paisRes.data?.find(p => p.tipo === 'pai') || { nome: '', data_nascimento: '', falecido: false, data_obito: '' });
      setMae(paisRes.data?.find(p => p.tipo === 'mae') || { nome: '', data_nascimento: '', falecido: false, data_obito: '' });
      setFilhos(filhosRes.data?.length > 0 ? filhosRes.data : [{ nome: '', data_nascimento: '', falecido: false, data_obito: '' }]);
    } catch (err) {
      console.error('Erro ao carregar familiares para edição:', err);
    }

    setCurrentPage('cadastro');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAtualizarIrmao = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      // Atualizar dados do irmão
      const { error: irmaoError } = await supabase
        .from('irmaos')
        .update(irmaoForm)
        .eq('id', irmaoEditando.id);

      if (irmaoError) throw irmaoError;

      // Deletar familiares antigos
      await Promise.all([
        supabase.from('esposas').delete().eq('irmao_id', irmaoEditando.id),
        supabase.from('pais').delete().eq('irmao_id', irmaoEditando.id),
        supabase.from('filhos').delete().eq('irmao_id', irmaoEditando.id)
      ]);

      // Inserir familiares atualizados
      if (esposa.nome && esposa.nome.trim() !== '') {
        await supabase.from('esposas').insert([{ 
          irmao_id: irmaoEditando.id,
          nome: esposa.nome,
          data_nascimento: esposa.data_nascimento || null
        }]);
      }

      if (pai.nome && pai.nome.trim() !== '') {
        await supabase.from('pais').insert([{ 
          irmao_id: irmaoEditando.id,
          tipo: 'pai',
          nome: pai.nome,
          data_nascimento: pai.data_nascimento || null,
          falecido: pai.falecido,
          data_obito: pai.falecido ? pai.data_obito || null : null
        }]);
      }

      if (mae.nome && mae.nome.trim() !== '') {
        await supabase.from('pais').insert([{ 
          irmao_id: irmaoEditando.id,
          tipo: 'mae',
          nome: mae.nome,
          data_nascimento: mae.data_nascimento || null,
          falecido: mae.falecido,
          data_obito: mae.falecido ? mae.data_obito || null : null
        }]);
      }

      const filhosValidos = filhos.filter(f => f.nome && f.nome.trim() !== '');
      if (filhosValidos.length > 0) {
        await supabase.from('filhos').insert(filhosValidos.map(f => ({
          irmao_id: irmaoEditando.id,
          nome: f.nome,
          data_nascimento: f.data_nascimento || null,
          falecido: f.falecido,
          data_obito: f.falecido ? f.data_obito || null : null
        })));
      }

      setSuccessMessage('✅ Cadastro atualizado com sucesso!');
      limparFormulario();
      loadIrmaos();
      setCurrentPage('listagem');
      window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (err) {
      setError(err.message || 'Erro ao atualizar cadastro');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // MÓDULO: EXCLUSÃO DE IRMÃO
  // ========================================
  const handleExcluirIrmao = async (irmaoId) => {
    if (!window.confirm('⚠️ Tem certeza que deseja EXCLUIR este irmão?\n\nTodos os dados e familiares serão permanentemente removidos!')) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('irmaos').delete().eq('id', irmaoId);
      if (error) throw error;

      setSuccessMessage('✅ Irmão excluído com sucesso!');
      loadIrmaos();
      setCurrentPage('listagem');
    } catch (err) {
      setError('Erro ao excluir irmão: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // MÓDULO: GESTÃO DE USUÁRIOS
  // ========================================
  const handleCriarUsuario = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      // Criar usuário no Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: novoUsuario.email,
        password: novoUsuario.senha,
      });

      if (authError) throw authError;

      // Inserir na tabela usuarios
      const { error: userError } = await supabase.from('usuarios').insert([{
        email: novoUsuario.email,
        nome: novoUsuario.nome,
        cargo: novoUsuario.cargo,
        nivel_acesso: novoUsuario.cargo,
        ativo: novoUsuario.ativo
      }]);

      if (userError) throw userError;

      setSuccessMessage('✅ Usuário criado com sucesso!');
      setNovoUsuario({ email: '', senha: '', nome: '', cargo: 'irmao', ativo: true });
      loadUsuarios();
    } catch (err) {
      setError('Erro ao criar usuário: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAlterarStatusUsuario = async (usuarioId, novoStatus) => {
    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ ativo: novoStatus })
        .eq('id', usuarioId);

      if (error) throw error;
      setSuccessMessage('✅ Status do usuário atualizado!');
      loadUsuarios();
    } catch (err) {
      setError('Erro ao alterar status: ' + err.message);
    }
  };

  // ========================================
  // MÓDULO: VISUALIZAÇÃO
  // ========================================
  const visualizarIrmao = (irmao) => {
    setIrmaoSelecionado(irmao);
    loadFamiliares(irmao.id);
    setCurrentPage('visualizar');
  };

  // Filtros
  const irmaosFiltrados = irmaos.filter(irmao => {
    const matchSearch = irmao.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       irmao.cim.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'todos' || irmao.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // ========================================
  // RENDERIZAÇÃO: LOADING
  // ========================================
  if (loading && !session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Carregando...</div>
      </div>
    );
  }

  // ========================================
  // RENDERIZAÇÃO: TELA DE LOGIN
  // ========================================
  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-md">
          <div className="text-center mb-8">
            <img src={LOGO_URL} alt="Logo" className="w-32 h-32 mx-auto mb-4 rounded-full shadow-lg" />
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Loja Maçônica</h1>
            <p className="text-gray-600">Sistema de Gestão</p>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="seu@email.com"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="••••••••"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-medium">
                ⚠️ {error}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading || !email || !password}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition shadow-lg disabled:bg-gray-400"
            >
              {loading ? 'Entrando...' : '🔐 Entrar'}
            </button>
          </div>

          <div className="mt-8 text-center">
            <p className="text-xs text-gray-400">Fase 4: Edição e Permissões ✅</p>
          </div>
        </div>
      </div>
    );
  }

  // ========================================
  // RENDERIZAÇÃO: ÁREA LOGADA
  // ========================================
  return (
    <div className="min-h-screen bg-gray-100">
      {/* HEADER */}
      <header className="bg-gradient-to-r from-blue-900 to-blue-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={LOGO_URL} alt="Logo" className="w-12 h-12 rounded-full shadow-md" />
              <div>
                <h1 className="text-2xl font-bold">A∴R∴L∴S∴ Acácia de Paranatinga nº 30</h1>
                <p className="text-sm text-blue-200">
                  {userData?.nome} • {userData?.cargo.charAt(0).toUpperCase() + userData?.cargo.slice(1)}
                </p>
              </div>
            </div>
            <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded-lg font-semibold transition">
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* NAVEGAÇÃO */}
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex space-x-8">
            <button
              onClick={() => setCurrentPage('dashboard')}
              className={`py-4 px-2 border-b-2 font-medium ${currentPage === 'dashboard' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-blue-600'}`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setCurrentPage('listagem')}
              className={`py-4 px-2 border-b-2 font-medium ${currentPage === 'listagem' || currentPage === 'visualizar' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-blue-600'}`}
            >
              Irmãos
            </button>
            {permissoes?.pode_editar_cadastros && (
              <button
                onClick={() => { limparFormulario(); setCurrentPage('cadastro'); }}
                className={`py-4 px-2 border-b-2 font-medium ${currentPage === 'cadastro' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-blue-600'}`}
              >
                Cadastrar Irmão
              </button>
            )}
            {permissoes?.pode_gerenciar_usuarios && (
              <button
                onClick={() => { loadUsuarios(); setCurrentPage('usuarios'); }}
                className={`py-4 px-2 border-b-2 font-medium ${currentPage === 'usuarios' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-blue-600'}`}
              >
                Usuários
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* ========================================
            PÁGINA: DASHBOARD
            ======================================== */}
        {currentPage === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-600">
                <h3 className="text-3xl font-bold text-blue-900 mb-2">{irmaos.length}</h3>
                <p className="text-gray-600">Total de Irmãos</p>
              </div>
              <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-600">
                <h3 className="text-3xl font-bold text-green-900 mb-2">
                  {irmaos.filter(i => i.status === 'ativo').length}
                </h3>
                <p className="text-gray-600">Irmãos Ativos</p>
              </div>
              <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-red-600">
                <h3 className="text-3xl font-bold text-red-900 mb-2">
                  {irmaos.filter(i => i.status === 'inativo').length}
                </h3>
                <p className="text-gray-600">Irmãos Inativos</p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl shadow-md p-8 border border-green-200">
              <div className="flex items-start gap-4">
                <div className="text-5xl">🎉</div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-3">Sistema Completo - Fase 4!</h2>
                  <p className="text-gray-700 mb-4">
                    ✅ Fase 1: Autenticação<br />
                    ✅ Fase 2: Cadastro de Irmãos e Familiares<br />
                    ✅ Fase 3: Listagem e Pesquisa<br />
                    ✅ Fase 4: Edição e Sistema de Permissões
                  </p>
                  <div className="bg-white rounded-lg p-4 border border-blue-200">
                    <p className="text-sm text-gray-700 mb-2"><strong>Suas permissões:</strong></p>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>{permissoes?.pode_editar_cadastros ? '✅' : '❌'} Editar Cadastros</li>
                      <li>{permissoes?.pode_visualizar_financeiro ? '✅' : '❌'} Visualizar Financeiro</li>
                      <li>{permissoes?.pode_editar_financeiro ? '✅' : '❌'} Editar Financeiro</li>
                      <li>{permissoes?.pode_gerenciar_usuarios ? '✅' : '❌'} Gerenciar Usuários</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================
            PÁGINA: LISTAGEM DE IRMÃOS
            ======================================== */}
        {currentPage === 'listagem' && (
          <div>
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Listagem de Irmãos</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">🔍 Pesquisar por Nome ou CIM</label>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Digite o nome ou CIM..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filtrar por Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="todos">Todos</option>
                    <option value="ativo">Ativos</option>
                    <option value="inativo">Inativos</option>
                  </select>
                </div>
              </div>

              {irmaosFiltrados.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-xl mb-2">📭</p>
                  <p>Nenhum irmão encontrado</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">CIM</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Nome</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Cargo</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {irmaosFiltrados.map((irmao) => (
                        <tr key={irmao.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{irmao.cim}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">{irmao.nome}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{irmao.cargo || '-'}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              irmao.status === 'ativo' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {irmao.status === 'ativo' ? '✅ Ativo' : '❌ Inativo'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <button
                              onClick={() => visualizarIrmao(irmao)}
                              className="text-blue-600 hover:text-blue-800 font-semibold mr-3"
                            >
                              Ver Detalhes
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================
            PÁGINA: VISUALIZAR IRMÃO
            ======================================== */}
        {currentPage === 'visualizar' && irmaoSelecionado && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <button
                onClick={() => setCurrentPage('listagem')}
                className="text-blue-600 hover:text-blue-800 font-semibold"
              >
                ← Voltar para Listagem
              </button>
              
              <div className="flex gap-3">
                {permissoes?.pode_editar_cadastros && (
                  <>
                    <button
                      onClick={() => iniciarEdicao(irmaoSelecionado)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => handleExcluirIrmao(irmaoSelecionado.id)}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold"
                    >
                      🗑️ Excluir
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Dados Completos do Irmão</h2>

              <div className="mb-8">
                <h3 className="text-xl font-bold text-blue-900 mb-4 pb-2 border-b-2 border-blue-200">📋 Dados Pessoais</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div><strong>CIM:</strong> {irmaoSelecionado.cim}</div>
                  <div><strong>Nome:</strong> {irmaoSelecionado.nome}</div>
                  <div><strong>CPF:</strong> {irmaoSelecionado.cpf || '-'}</div>
                  <div><strong>RG:</strong> {irmaoSelecionado.rg || '-'}</div>
                  <div><strong>Data Nascimento:</strong> {formatarData(irmaoSelecionado.data_nascimento)}</div>
                  {irmaoSelecionado.data_nascimento && (
                    <div><strong>Idade:</strong> {calcularIdade(irmaoSelecionado.data_nascimento)}</div>
                  )}
                  <div><strong>Estado Civil:</strong> {irmaoSelecionado.estado_civil || '-'}</div>
                  <div><strong>Profissão:</strong> {irmaoSelecionado.profissao || '-'}</div>
                  <div><strong>Formação:</strong> {irmaoSelecionado.formacao || '-'}</div>
                  <div><strong>Naturalidade:</strong> {irmaoSelecionado.naturalidade || '-'}</div>
                  <div className="md:col-span-2"><strong>Endereço:</strong> {irmaoSelecionado.endereco || '-'}</div>
                  <div><strong>Cidade:</strong> {irmaoSelecionado.cidade || '-'}</div>
                  <div><strong>Celular:</strong> {irmaoSelecionado.celular || '-'}</div>
                  <div><strong>E-mail:</strong> {irmaoSelecionado.email || '-'}</div>
                  <div className="md:col-span-2"><strong>Local de Trabalho:</strong> {irmaoSelecionado.local_trabalho || '-'}</div>
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-xl font-bold text-blue-900 mb-4 pb-2 border-b-2 border-blue-200">🔷 Dados Maçônicos</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div><strong>Cargo:</strong> {irmaoSelecionado.cargo || '-'}</div>
                  <div><strong>Status:</strong> 
                    <span className={`ml-2 px-2 py-1 rounded-full text-xs font-semibold ${
                      irmaoSelecionado.status === 'ativo' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {irmaoSelecionado.status === 'ativo' ? '✅ Ativo' : '❌ Inativo'}
                    </span>
                  </div>
                  <div><strong>Data Iniciação:</strong> {formatarData(irmaoSelecionado.data_iniciacao)}</div>
                  <div><strong>Data Elevação:</strong> {formatarData(irmaoSelecionado.data_elevacao)}</div>
                  <div><strong>Data Exaltação:</strong> {formatarData(irmaoSelecionado.data_exaltacao)}</div>
                  {irmaoSelecionado.data_iniciacao && (
                    <div className="md:col-span-3 bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <strong>⏱️ Tempo de Maçonaria:</strong> {calcularTempoMaconaria(irmaoSelecionado.data_iniciacao)}
                    </div>
                  )}
                </div>
              </div>

              {familiaresSelecionado && (
                <div className="space-y-6">
                  {familiaresSelecionado.esposa && (
                    <div>
                      <h3 className="text-xl font-bold text-pink-900 mb-4 pb-2 border-b-2 border-pink-200">💑 Esposa</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><strong>Nome:</strong> {familiaresSelecionado.esposa.nome}</div>
                        <div><strong>Data Nascimento:</strong> {formatarData(familiaresSelecionado.esposa.data_nascimento)}</div>
                        {familiaresSelecionado.esposa.data_nascimento && (
                          <div><strong>Idade:</strong> {calcularIdade(familiaresSelecionado.esposa.data_nascimento)}</div>
                        )}
                      </div>
                    </div>
                  )}

                  {(familiaresSelecionado.pai || familiaresSelecionado.mae) && (
                    <div>
                      <h3 className="text-xl font-bold text-green-900 mb-4 pb-2 border-b-2 border-green-200">👨‍👩‍👦 Pais</h3>
                      
                      {familiaresSelecionado.pai && (
                        <div className="mb-4">
                          <p className="font-semibold text-gray-700 mb-2">Pai:</p>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg">
                            <div><strong>Nome:</strong> {familiaresSelecionado.pai.nome}</div>
                            <div><strong>Data Nascimento:</strong> {formatarData(familiaresSelecionado.pai.data_nascimento)}</div>
                            <div><strong>Status:</strong> {familiaresSelecionado.pai.falecido ? `❌ Falecido em ${formatarData(familiaresSelecionado.pai.data_obito)}` : '✅ Vivo'}</div>
                          </div>
                        </div>
                      )}

                      {familiaresSelecionado.mae && (
                        <div>
                          <p className="font-semibold text-gray-700 mb-2">Mãe:</p>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg">
                            <div><strong>Nome:</strong> {familiaresSelecionado.mae.nome}</div>
                            <div><strong>Data Nascimento:</strong> {formatarData(familiaresSelecionado.mae.data_nascimento)}</div>
                            <div><strong>Status:</strong> {familiaresSelecionado.mae.falecido ? `❌ Falecida em ${formatarData(familiaresSelecionado.mae.data_obito)}` : '✅ Viva'}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {familiaresSelecionado.filhos && familiaresSelecionado.filhos.length > 0 && (
                    <div>
                      <h3 className="text-xl font-bold text-purple-900 mb-4 pb-2 border-b-2 border-purple-200">👶 Filhos</h3>
                      <div className="space-y-3">
                        {familiaresSelecionado.filhos.map((filho, index) => (
                          <div key={filho.id} className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                            <p className="font-semibold text-gray-700 mb-2">Filho {index + 1}:</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div><strong>Nome:</strong> {filho.nome}</div>
                              <div><strong>Data Nascimento:</strong> {formatarData(filho.data_nascimento)}</div>
                              <div><strong>Status:</strong> {filho.falecido ? `❌ Falecido em ${formatarData(filho.data_obito)}` : '✅ Vivo'}</div>
                              {filho.data_nascimento && !filho.falecido && (
                                <div><strong>Idade:</strong> {calcularIdade(filho.data_nascimento)}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================
            PÁGINA: CADASTRO/EDIÇÃO DE IRMÃO
            ======================================== */}
        {currentPage === 'cadastro' && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              {modoEdicao ? '✏️ Editar Cadastro do Irmão' : 'Cadastro de Irmão'}
            </h2>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                ⚠️ {error}
              </div>
            )}

            {successMessage && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
                {successMessage}
              </div>
            )}

            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-bold text-blue-900 mb-4 pb-2 border-b-2 border-blue-200">📋 Dados do Irmão</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">CIM *</label>
                    <input type="text" value={irmaoForm.cim} onChange={(e) => setIrmaoForm({ ...irmaoForm, cim: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nome Completo *</label>
                    <input type="text" value={irmaoForm.nome} onChange={(e) => setIrmaoForm({ ...irmaoForm, nome: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">CPF</label>
                    <input type="text" value={irmaoForm.cpf} onChange={(e) => setIrmaoForm({ ...irmaoForm, cpf: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">RG</label>
                    <input type="text" value={irmaoForm.rg} onChange={(e) => setIrmaoForm({ ...irmaoForm, rg: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Data de Nascimento</label>
                    <input type="date" value={irmaoForm.data_nascimento} onChange={(e) => setIrmaoForm({ ...irmaoForm, data_nascimento: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Estado Civil</label>
                    <select value={irmaoForm.estado_civil} onChange={(e) => setIrmaoForm({ ...irmaoForm, estado_civil: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="">Selecione</option>
                      <option value="solteiro">Solteiro</option>
                      <option value="casado">Casado</option>
                      <option value="divorciado">Divorciado</option>
                      <option value="viuvo">Viúvo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Profissão</label>
                    <input type="text" value={irmaoForm.profissao} onChange={(e) => setIrmaoForm({ ...irmaoForm, profissao: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Formação</label>
                    <input type="text" value={irmaoForm.formacao} onChange={(e) => setIrmaoForm({ ...irmaoForm, formacao: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <select value={irmaoForm.status} onChange={(e) => setIrmaoForm({ ...irmaoForm, status: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="ativo">Ativo</option>
                      <option value="inativo">Inativo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Naturalidade</label>
                    <input type="text" value={irmaoForm.naturalidade} onChange={(e) => setIrmaoForm({ ...irmaoForm, naturalidade: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Endereço</label>
                    <input type="text" value={irmaoForm.endereco} onChange={(e) => setIrmaoForm({ ...irmaoForm, endereco: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Cidade</label>
                    <input type="text" value={irmaoForm.cidade} onChange={(e) => setIrmaoForm({ ...irmaoForm, cidade: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Celular</label>
                    <input type="text" value={irmaoForm.celular} onChange={(e) => setIrmaoForm({ ...irmaoForm, celular: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">E-mail</label>
                    <input type="email" value={irmaoForm.email} onChange={(e) => setIrmaoForm({ ...irmaoForm, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Local de Trabalho</label>
                    <input type="text" value={irmaoForm.local_trabalho} onChange={(e) => setIrmaoForm({ ...irmaoForm, local_trabalho: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Cargo na Loja</label>
                    <input type="text" value={irmaoForm.cargo} onChange={(e) => setIrmaoForm({ ...irmaoForm, cargo: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ex: Venerável Mestre, Orador..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Data de Iniciação</label>
                    <input type="date" value={irmaoForm.data_iniciacao} onChange={(e) => setIrmaoForm({ ...irmaoForm, data_iniciacao: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Data de Elevação</label>
                    <input type="date" value={irmaoForm.data_elevacao} onChange={(e) => setIrmaoForm({ ...irmaoForm, data_elevacao: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Data de Exaltação</label>
                    <input type="date" value={irmaoForm.data_exaltacao} onChange={(e) => setIrmaoForm({ ...irmaoForm, data_exaltacao: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  {irmaoForm.data_iniciacao && (
                    <div className="md:col-span-3 bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <p className="text-sm font-semibold text-blue-900">⏱️ Tempo de Maçonaria: {calcularTempoMaconaria(irmaoForm.data_iniciacao)}</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold text-pink-900 mb-4 pb-2 border-b-2 border-pink-200">💑 Dados da Esposa (Opcional)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nome</label>
                    <input type="text" value={esposa.nome} onChange={(e) => setEsposa({ ...esposa, nome: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Data de Nascimento</label>
                    <input type="date" value={esposa.data_nascimento} onChange={(e) => setEsposa({ ...esposa, data_nascimento: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold text-green-900 mb-4 pb-2 border-b-2 border-green-200">👨‍👩‍👦 Dados dos Pais (Opcional)</h3>
                
                <div className="mb-6">
                  <p className="font-semibold text-gray-700 mb-3">Pai:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Nome</label>
                      <input type="text" value={pai.nome} onChange={(e) => setPai({ ...pai, nome: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Data de Nascimento</label>
                      <input type="date" value={pai.data_nascimento} onChange={(e) => setPai({ ...pai, data_nascimento: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div className="flex items-center">
                      <label className="flex items-center cursor-pointer mt-6">
                        <input type="checkbox" checked={pai.falecido} onChange={(e) => setPai({ ...pai, falecido: e.target.checked })} className="w-4 h-4 text-blue-600" />
                        <span className="ml-2 text-sm font-medium text-gray-700">Falecido</span>
                      </label>
                    </div>
                    {pai.falecido && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Data do Óbito</label>
                        <input type="date" value={pai.data_obito} onChange={(e) => setPai({ ...pai, data_obito: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-gray-700 mb-3">Mãe:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Nome</label>
                      <input type="text" value={mae.nome} onChange={(e) => setMae({ ...mae, nome: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Data de Nascimento</label>
                      <input type="date" value={mae.data_nascimento} onChange={(e) => setMae({ ...mae, data_nascimento: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div className="flex items-center">
                      <label className="flex items-center cursor-pointer mt-6">
                        <input type="checkbox" checked={mae.falecido} onChange={(e) => setMae({ ...mae, falecido: e.target.checked })} className="w-4 h-4 text-blue-600" />
                        <span className="ml-2 text-sm font-medium text-gray-700">Falecida</span>
                      </label>
                    </div>
                    {mae.falecido && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Data do Óbito</label>
                        <input type="date" value={mae.data_obito} onChange={(e) => setMae({ ...mae, data_obito: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-purple-900 pb-2 border-b-2 border-purple-200">👶 Dados dos Filhos (Opcional)</h3>
                  <button type="button" onClick={adicionarFilho} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
                    + Adicionar Filho
                  </button>
                </div>
                
                {filhos.map((filho, index) => (
                  <div key={index} className="mb-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="flex justify-between items-center mb-3">
                      <p className="font-semibold text-gray-700">Filho {index + 1}:</p>
                      {filhos.length > 1 && (
                        <button type="button" onClick={() => removerFilho(index)} className="text-red-600 hover:text-red-800 text-sm font-semibold">Remover</button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Nome</label>
                        <input type="text" value={filho.nome} onChange={(e) => atualizarFilho(index, 'nome', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Data de Nascimento</label>
                        <input type="date" value={filho.data_nascimento} onChange={(e) => atualizarFilho(index, 'data_nascimento', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div className="flex items-center">
                        <label className="flex items-center cursor-pointer mt-6">
                          <input type="checkbox" checked={filho.falecido} onChange={(e) => atualizarFilho(index, 'falecido', e.target.checked)} className="w-4 h-4 text-blue-600" />
                          <span className="ml-2 text-sm font-medium text-gray-700">Falecido</span>
                        </label>
                      </div>
                      {filho.falecido && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Data do Óbito</label>
                          <input type="date" value={filho.data_obito} onChange={(e) => atualizarFilho(index, 'data_obito', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

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
        )}

        {/* ========================================
            PÁGINA: GESTÃO DE USUÁRIOS
            ======================================== */}
        {currentPage === 'usuarios' && (
          <div>
            <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Cadastrar Novo Usuário</h2>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                  ⚠️ {error}
                </div>
              )}

              {successMessage && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
                  {successMessage}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome Completo *</label>
                  <input
                    type="text"
                    value={novoUsuario.nome}
                    onChange={(e) => setNovoUsuario({ ...novoUsuario, nome: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Nome do usuário"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                  <input
                    type="email"
                    value={novoUsuario.email}
                    onChange={(e) => setNovoUsuario({ ...novoUsuario, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="email@exemplo.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Senha *</label>
                  <input
                    type="password"
                    value={novoUsuario.senha}
                    onChange={(e) => setNovoUsuario({ ...novoUsuario, senha: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cargo/Nível de Acesso *</label>
                  <select
                    value={novoUsuario.cargo}
                    onChange={(e) => setNovoUsuario({ ...novoUsuario, cargo: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="irmao">Irmão (apenas visualizar seus dados)</option>
                    <option value="secretario">Secretário (visualizar cadastros)</option>
                    <option value="tesoureiro">Tesoureiro (cadastros + financeiro)</option>
                    <option value="chanceler">Chanceler (editar cadastros)</option>
                    <option value="veneravel">Venerável (acesso total)</option>
                    <option value="administrador">Administrador (acesso total)</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={novoUsuario.ativo}
                      onChange={(e) => setNovoUsuario({ ...novoUsuario, ativo: e.target.checked })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700">Usuário ativo</span>
                  </label>
                </div>
              </div>

              <button
                onClick={handleCriarUsuario}
                disabled={loading || !novoUsuario.nome || !novoUsuario.email || !novoUsuario.senha}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition disabled:bg-gray-400"
              >
                {loading ? 'Criando...' : '➕ Criar Usuário'}
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Lista de Usuários</h2>

              {usuarios.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>Nenhum usuário cadastrado</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Nome</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Cargo</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {usuarios.map((usuario) => (
                        <tr key={usuario.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">{usuario.nome}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{usuario.email}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {usuario.cargo.charAt(0).toUpperCase() + usuario.cargo.slice(1)}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              usuario.ativo 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {usuario.ativo ? '✅ Ativo' : '❌ Inativo'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {usuario.id !== userData.id && (
                              <button
                                onClick={() => handleAlterarStatusUsuario(usuario.id, !usuario.ativo)}
                                className="text-blue-600 hover:text-blue-800 font-semibold"
                              >
                                {usuario.ativo ? 'Desativar' : 'Ativar'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
