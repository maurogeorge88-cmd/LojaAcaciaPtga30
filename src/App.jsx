import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ypnvzjctyfdrkkrhskzs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwbnZ6amN0eWZkcmtrcmhza3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NTgxMzcsImV4cCI6MjA3OTMzNDEzN30.J5Jj7wudOhIAxy35DDBIWtr9yr9Lq3ABBRI9ZJ5z2pc';
const supabase = createClient(supabaseUrl, supabaseKey);

const LOGO_URL = 'https://via.placeholder.com/150x150/1e3a8a/ffffff?text=LOJA';

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
  if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) idade--;
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

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [permissoes, setPermissoes] = useState(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [irmaos, setIrmaos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [balaustres, setBalaustres] = useState([]);
  const [pranchas, setPranchas] = useState([]);
  const [corpoAdmin, setCorpoAdmin] = useState([]);
  const [tiposSessao, setTiposSessao] = useState([]);
  const [cargosLoja, setCargosLoja] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ativo');
  const [irmaoSelecionado, setIrmaoSelecionado] = useState(null);
  const [familiaresSelecionado, setFamiliaresSelecionado] = useState(null);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [irmaoEditando, setIrmaoEditando] = useState(null);

  const [irmaoForm, setIrmaoForm] = useState({
    cim: '', nome: '', cpf: '', rg: '', data_nascimento: '', estado_civil: '', 
    profissao: '', formacao: '', status: 'ativo', naturalidade: '', endereco: '', 
    cidade: '', celular: '', email: '', local_trabalho: '', cargo: '',
    data_iniciacao: '', data_elevacao: '', data_exaltacao: ''
  });

  const [esposa, setEsposa] = useState({ nome: '', data_nascimento: '' });
  const [pai, setPai] = useState({ nome: '', data_nascimento: '', falecido: false, data_obito: '' });
  const [mae, setMae] = useState({ nome: '', data_nascimento: '', falecido: false, data_obito: '' });
  const [filhos, setFilhos] = useState([{ nome: '', data_nascimento: '', falecido: false, data_obito: '' }]);
  const [novoUsuario, setNovoUsuario] = useState({ email: '', senha: '', nome: '', cargo: 'irmao', ativo: true });
  const [balaustreForm, setBalaustreForm] = useState({ numero_balaustre: '', data_sessao: '', tipo_sessao: '', ordem_dia: '' });
  const [pranchaForm, setPranchaForm] = useState({ numero_prancha: '', data_prancha: '', assunto: '', destinatario: '' });
  const [corpoAdminForm, setCorpoAdminForm] = useState({ irmao_id: '', cargo: '', ano_exercicio: '' });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        loadUserData(session.user.email);
        loadIrmaos();
        loadTiposSessao();
        loadCargosLoja();
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
      const { data } = await supabase.from('usuarios').select('*').eq('email', userEmail).single();
      setUserData(data);
      loadPermissoes(data.cargo);
    } catch (err) {
      console.error('Erro:', err);
    }
  };

  const loadPermissoes = async (cargo) => {
    try {
      const { data } = await supabase.from('permissoes').select('*').eq('cargo', cargo).single();
      setPermissoes(data);
    } catch (err) {
      console.error('Erro:', err);
    }
  };

  const loadIrmaos = async () => {
    const { data } = await supabase.from('irmaos').select('*').order('nome', { ascending: true });
    setIrmaos(data || []);
  };

  const loadUsuarios = async () => {
    const { data } = await supabase.from('usuarios').select('*').order('nome', { ascending: true });
    setUsuarios(data || []);
  };

  const loadBalaustres = async () => {
    const { data } = await supabase.from('balaustres').select('*').order('data_sessao', { ascending: false });
    setBalaustres(data || []);
  };

  const loadPranchas = async () => {
    const { data } = await supabase.from('pranchas_expedidas').select('*').order('data_prancha', { ascending: false });
    setPranchas(data || []);
  };

  const loadCorpoAdmin = async () => {
    const { data } = await supabase.from('corpo_administrativo').select('*, irmaos(nome, cim)').order('ano_exercicio', { ascending: false });
    setCorpoAdmin(data || []);
  };

  const loadTiposSessao = async () => {
    const { data } = await supabase.from('tipos_sessao').select('*').eq('ativo', true).order('nome');
    setTiposSessao(data || []);
  };

  const loadCargosLoja = async () => {
    const { data } = await supabase.from('cargos_loja').select('*').eq('ativo', true).order('ordem');
    setCargosLoja(data || []);
  };

  const loadFamiliares = async (irmaoId) => {
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
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const { data: userData } = await supabase.from('usuarios').select('*').eq('email', email).single();
      if (!userData.ativo) {
        await supabase.auth.signOut();
        throw new Error('Usuário inativo');
      }
    } catch (err) {
      setError(err.message);
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUserData(null);
    setCurrentPage('dashboard');
  };

  const limparFormulario = () => {
    setIrmaoForm({
      cim: '', nome: '', cpf: '', rg: '', data_nascimento: '', estado_civil: '',
      profissao: '', formacao: '', status: 'ativo', naturalidade: '', endereco: '',
      cidade: '', celular: '', email: '', local_trabalho: '', cargo: '',
      data_iniciacao: '', data_elevacao: '', data_exaltacao: ''
    });
    setEsposa({ nome: '', data_nascimento: '' });
    setPai({ nome: '', data_nascimento: '', falecido: false, data_obito: '' });
    setMae({ nome: '', data_nascimento: '', falecido: false, data_obito: '' });
    setFilhos([{ nome: '', data_nascimento: '', falecido: false, data_obito: '' }]);
    setModoEdicao(false);
  };

  const adicionarFilho = () => setFilhos([...filhos, { nome: '', data_nascimento: '', falecido: false, data_obito: '' }]);
  const removerFilho = (index) => setFilhos(filhos.filter((_, i) => i !== index));
  const atualizarFilho = (index, campo, valor) => {
    const novos = [...filhos];
    novos[index][campo] = valor;
    setFilhos(novos);
  };

  const handleSubmitIrmao = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const { data: irmaoData } = await supabase.from('irmaos').insert([irmaoForm]).select().single();
      const irmaoId = irmaoData.id;

      if (esposa.nome?.trim()) await supabase.from('esposas').insert([{ irmao_id: irmaoId, ...esposa }]);
      if (pai.nome?.trim()) await supabase.from('pais').insert([{ irmao_id: irmaoId, tipo: 'pai', ...pai }]);
      if (mae.nome?.trim()) await supabase.from('pais').insert([{ irmao_id: irmaoId, tipo: 'mae', ...mae }]);
      
      const filhosValidos = filhos.filter(f => f.nome?.trim());
      if (filhosValidos.length) await supabase.from('filhos').insert(filhosValidos.map(f => ({ irmao_id: irmaoId, ...f })));

      setSuccessMessage('✅ Irmão cadastrado!');
      limparFormulario();
      loadIrmaos();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const iniciarEdicao = async (irmao) => {
    setModoEdicao(true);
    setIrmaoEditando(irmao);
    setIrmaoForm({
      ...irmao,
      data_nascimento: formatarDataInput(irmao.data_nascimento),
      data_iniciacao: formatarDataInput(irmao.data_iniciacao),
      data_elevacao: formatarDataInput(irmao.data_elevacao),
      data_exaltacao: formatarDataInput(irmao.data_exaltacao)
    });

    const [esposaRes, paisRes, filhosRes] = await Promise.all([
      supabase.from('esposas').select('*').eq('irmao_id', irmao.id),
      supabase.from('pais').select('*').eq('irmao_id', irmao.id),
      supabase.from('filhos').select('*').eq('irmao_id', irmao.id)
    ]);

    const e = esposaRes.data?.[0];
    setEsposa(e ? { nome: e.nome, data_nascimento: formatarDataInput(e.data_nascimento) } : { nome: '', data_nascimento: '' });
    
    const p = paisRes.data?.find(p => p.tipo === 'pai');
    setPai(p ? { nome: p.nome, data_nascimento: formatarDataInput(p.data_nascimento), falecido: p.falecido, data_obito: formatarDataInput(p.data_obito) } : { nome: '', data_nascimento: '', falecido: false, data_obito: '' });
    
    const m = paisRes.data?.find(p => p.tipo === 'mae');
    setMae(m ? { nome: m.nome, data_nascimento: formatarDataInput(m.data_nascimento), falecido: m.falecido, data_obito: formatarDataInput(m.data_obito) } : { nome: '', data_nascimento: '', falecido: false, data_obito: '' });
    
    const f = filhosRes.data?.map(f => ({ nome: f.nome, data_nascimento: formatarDataInput(f.data_nascimento), falecido: f.falecido, data_obito: formatarDataInput(f.data_obito) }));
    setFilhos(f?.length ? f : [{ nome: '', data_nascimento: '', falecido: false, data_obito: '' }]);

    setCurrentPage('cadastro');
  };

  const handleAtualizarIrmao = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await supabase.from('irmaos').update(irmaoForm).eq('id', irmaoEditando.id);
      await Promise.all([
        supabase.from('esposas').delete().eq('irmao_id', irmaoEditando.id),
        supabase.from('pais').delete().eq('irmao_id', irmaoEditando.id),
        supabase.from('filhos').delete().eq('irmao_id', irmaoEditando.id)
      ]);

      if (esposa.nome?.trim()) await supabase.from('esposas').insert([{ irmao_id: irmaoEditando.id, ...esposa }]);
      if (pai.nome?.trim()) await supabase.from('pais').insert([{ irmao_id: irmaoEditando.id, tipo: 'pai', ...pai }]);
      if (mae.nome?.trim()) await supabase.from('pais').insert([{ irmao_id: irmaoEditando.id, tipo: 'mae', ...mae }]);
      
      const filhosValidos = filhos.filter(f => f.nome?.trim());
      if (filhosValidos.length) await supabase.from('filhos').insert(filhosValidos.map(f => ({ irmao_id: irmaoEditando.id, ...f })));

      setSuccessMessage('✅ Atualizado!');
      limparFormulario();
      loadIrmaos();
      setCurrentPage('listagem');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExcluirIrmao = async (id) => {
    if (!window.confirm('Excluir irmão?')) return;
    await supabase.from('irmaos').delete().eq('id', id);
    setSuccessMessage('✅ Excluído!');
    loadIrmaos();
    setCurrentPage('listagem');
  };

  const handleCriarUsuario = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await supabase.auth.signUp({ email: novoUsuario.email, password: novoUsuario.senha });
      await supabase.from('usuarios').insert([{ ...novoUsuario, nivel_acesso: novoUsuario.cargo }]);
      setSuccessMessage('✅ Usuário criado!');
      setNovoUsuario({ email: '', senha: '', nome: '', cargo: 'irmao', ativo: true });
      loadUsuarios();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitBalaustre = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await supabase.from('balaustres').insert([{ ...balaustreForm, dia_semana: obterDiaSemana(balaustreForm.data_sessao) }]);
      setSuccessMessage('✅ Balaustre cadastrado!');
      setBalaustreForm({ numero_balaustre: '', data_sessao: '', tipo_sessao: '', ordem_dia: '' });
      loadBalaustres();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitPrancha = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await supabase.from('pranchas_expedidas').insert([pranchaForm]);
      setSuccessMessage('✅ Prancha cadastrada!');
      setPranchaForm({ numero_prancha: '', data_prancha: '', assunto: '', destinatario: '' });
      loadPranchas();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitCorpoAdmin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await supabase.from('corpo_administrativo').insert([corpoAdminForm]);
      setSuccessMessage('✅ Cargo cadastrado!');
      setCorpoAdminForm({ irmao_id: '', cargo: '', ano_exercicio: '' });
      loadCorpoAdmin();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const visualizarIrmao = (irmao) => {
    setIrmaoSelecionado(irmao);
    loadFamiliares(irmao.id);
    setCurrentPage('visualizar');
  };

  const irmaosFiltrados = irmaos.filter(irmao => {
    const matchSearch = irmao.nome.toLowerCase().includes(searchTerm.toLowerCase()) || irmao.cim.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'todos' || irmao.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (loading && !session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Carregando...</div>
      </div>
    );
  }

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
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Senha</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">⚠️ {error}</div>}

            <button onClick={handleLogin} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg">
              {loading ? 'Entrando...' : '🔐 Entrar'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-gradient-to-r from-blue-900 to-blue-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={LOGO_URL} alt="Logo" className="w-12 h-12 rounded-full" />
            <div>
              <h1 className="text-2xl font-bold">Sistema Loja Maçônica</h1>
              <p className="text-sm text-blue-200">{userData?.nome}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded-lg">Sair</button>
        </div>
      </header>

      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-6 flex space-x-8 overflow-x-auto">
          <button onClick={() => setCurrentPage('dashboard')} className={`py-4 px-2 border-b-2 whitespace-nowrap ${currentPage === 'dashboard' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600'}`}>Dashboard</button>
          <button onClick={() => setCurrentPage('listagem')} className={`py-4 px-2 border-b-2 whitespace-nowrap ${currentPage === 'listagem' || currentPage === 'visualizar' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600'}`}>Irmãos</button>
          {permissoes?.pode_editar_cadastros && (
            <button onClick={() => { limparFormulario(); setCurrentPage('cadastro'); }} className={`py-4 px-2 border-b-2 whitespace-nowrap ${currentPage === 'cadastro' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600'}`}>Cadastrar</button>
          )}
          <button onClick={() => { loadBalaustres(); setCurrentPage('balaustres'); }} className={`py-4 px-2 border-b-2 whitespace-nowrap ${currentPage === 'balaustres' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600'}`}>Balaustres</button>
          <button onClick={() => { loadPranchas(); setCurrentPage('pranchas'); }} className={`py-4 px-2 border-b-2 whitespace-nowrap ${currentPage === 'pranchas' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600'}`}>Pranchas</button>
          <button onClick={() => { loadCorpoAdmin(); setCurrentPage('corpo-admin'); }} className={`py-4 px-2 border-b-2 whitespace-nowrap ${currentPage === 'corpo-admin' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600'}`}>Corpo Admin</button>
          {permissoes?.pode_gerenciar_usuarios && (
            <button onClick={() => { loadUsuarios(); setCurrentPage('usuarios'); }} className={`py-4 px-2 border-b-2 whitespace-nowrap ${currentPage === 'usuarios' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600'}`}>Usuários</button>
          )}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">⚠️ {error}</div>}
        {successMessage && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">{successMessage}</div>}

        {currentPage === 'dashboard' && (
          <div className="text-center py-20">
            <h2 className="text-3xl font-bold mb-4">Bem-vindo ao Sistema!</h2>
            <p className="text-gray-600">Total de irmãos: {irmaos.length}</p>
          </div>
        )}

        {currentPage === 'listagem' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-6">Listagem de Irmãos</h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar..." className="px-4 py-2 border rounded-lg" />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2 border rounded-lg">
                <option value="todos">Todos</option>
                <option value="ativo">Ativos</option>
                <option value="inativo">Inativos</option>
              </select>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">Nome</th>
                  <th className="px-4 py-3 text-left">CIM</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Ações</th>
                </tr>
              </thead>
              <tbody>
                {irmaosFiltrados.map(i => (
                  <tr key={i.id} className="border-t">
                    <td className="px-4 py-3">
                      <button onClick={() => visualizarIrmao(i)} className="text-blue-600 hover:text-blue-800">Ver</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {currentPage === 'visualizar' && irmaoSelecionado && (
          <div>
            <button onClick={() => setCurrentPage('listagem')} className="mb-4 text-blue-600">← Voltar</button>
            <div className="bg-white rounded-xl shadow-lg p-8">
              <div className="flex justify-between mb-6">
                <h2 className="text-2xl font-bold">Dados do Irmão</h2>
                {permissoes?.pode_editar_cadastros && (
                  <div className="flex gap-3">
                    <button onClick={() => iniciarEdicao(irmaoSelecionado)} className="bg-blue-600 text-white px-4 py-2 rounded-lg">Editar</button>
                    <button onClick={() => handleExcluirIrmao(irmaoSelecionado.id)} className="bg-red-600 text-white px-4 py-2 rounded-lg">Excluir</button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div><strong>Nome:</strong> {irmaoSelecionado.nome}</div>
                <div><strong>CIM:</strong> {irmaoSelecionado.cim}</div>
                <div><strong>CPF:</strong> {irmaoSelecionado.cpf || '-'}</div>
                <div><strong>Data Nascimento:</strong> {formatarData(irmaoSelecionado.data_nascimento)}</div>
                <div><strong>Cargo:</strong> {irmaoSelecionado.cargo || '-'}</div>
                <div><strong>Status:</strong> {irmaoSelecionado.status}</div>
              </div>
              <h3 className="text-xl font-bold mb-3">Dados Maçônicos</h3>
              <div className="grid grid-cols-1 gap-2 mb-6">
                <div><strong>Data Iniciação:</strong> {formatarData(irmaoSelecionado.data_iniciacao)}</div>
                <div><strong>Data Elevação:</strong> {formatarData(irmaoSelecionado.data_elevacao)}</div>
                <div><strong>Data Exaltação:</strong> {formatarData(irmaoSelecionado.data_exaltacao)}</div>
                {irmaoSelecionado.data_iniciacao && (
                  <div className="bg-blue-50 p-3 rounded"><strong>Tempo de Maçonaria:</strong> {calcularTempoMaconaria(irmaoSelecionado.data_iniciacao)}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {currentPage === 'cadastro' && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-6">{modoEdicao ? 'Editar Irmão' : 'Cadastrar Irmão'}</h2>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <input type="text" placeholder="CIM *" value={irmaoForm.cim} onChange={(e) => setIrmaoForm({...irmaoForm, cim: e.target.value})} className="px-3 py-2 border rounded-lg" />
              <input type="text" placeholder="Nome *" value={irmaoForm.nome} onChange={(e) => setIrmaoForm({...irmaoForm, nome: e.target.value})} className="px-3 py-2 border rounded-lg" />
              <input type="text" placeholder="CPF" value={irmaoForm.cpf} onChange={(e) => setIrmaoForm({...irmaoForm, cpf: e.target.value})} className="px-3 py-2 border rounded-lg" />
              <input type="date" placeholder="Data Nascimento" value={irmaoForm.data_nascimento} onChange={(e) => setIrmaoForm({...irmaoForm, data_nascimento: e.target.value})} className="px-3 py-2 border rounded-lg" />
              <input type="text" placeholder="Profissão" value={irmaoForm.profissao} onChange={(e) => setIrmaoForm({...irmaoForm, profissao: e.target.value})} className="px-3 py-2 border rounded-lg" />
              <input type="text" placeholder="Cargo na Loja" value={irmaoForm.cargo} onChange={(e) => setIrmaoForm({...irmaoForm, cargo: e.target.value})} className="px-3 py-2 border rounded-lg" />
              <input type="date" placeholder="Data Iniciação" value={irmaoForm.data_iniciacao} onChange={(e) => setIrmaoForm({...irmaoForm, data_iniciacao: e.target.value})} className="px-3 py-2 border rounded-lg" />
              <input type="date" placeholder="Data Elevação" value={irmaoForm.data_elevacao} onChange={(e) => setIrmaoForm({...irmaoForm, data_elevacao: e.target.value})} className="px-3 py-2 border rounded-lg" />
              <input type="date" placeholder="Data Exaltação" value={irmaoForm.data_exaltacao} onChange={(e) => setIrmaoForm({...irmaoForm, data_exaltacao: e.target.value})} className="px-3 py-2 border rounded-lg" />
            </div>
            <button onClick={modoEdicao ? handleAtualizarIrmao : handleSubmitIrmao} disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">
              {loading ? 'Salvando...' : modoEdicao ? 'Atualizar' : 'Salvar'}
            </button>
          </div>
        )}

        {currentPage === 'balaustres' && (
          <div>
            <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
              <h2 className="text-2xl font-bold mb-6">Cadastrar Balaustre</h2>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <input type="text" placeholder="Número" value={balaustreForm.numero_balaustre} onChange={(e) => setBalaustreForm({...balaustreForm, numero_balaustre: e.target.value})} className="px-4 py-2 border rounded-lg" />
                <input type="date" value={balaustreForm.data_sessao} onChange={(e) => setBalaustreForm({...balaustreForm, data_sessao: e.target.value})} className="px-4 py-2 border rounded-lg" />
                <select value={balaustreForm.tipo_sessao} onChange={(e) => setBalaustreForm({...balaustreForm, tipo_sessao: e.target.value})} className="px-4 py-2 border rounded-lg">
                  <option value="">Tipo de Sessão</option>
                  {tiposSessao.map(t => <option key={t.id} value={t.nome}>{t.nome}</option>)}
                </select>
                <textarea placeholder="Ordem do Dia" value={balaustreForm.ordem_dia} onChange={(e) => setBalaustreForm({...balaustreForm, ordem_dia: e.target.value})} className="px-4 py-2 border rounded-lg" />
              </div>
              <button onClick={handleSubmitBalaustre} className="w-full bg-blue-600 text-white py-3 rounded-lg">Cadastrar</button>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold mb-6">Lista</h2>
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">Número</th>
                    <th className="px-4 py-3 text-left">Data</th>
                    <th className="px-4 py-3 text-left">Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {balaustres.map(b => (
                    <tr key={b.id} className="border-t">
                      <td className="px-4 py-3">{b.numero_balaustre}</td>
                      <td className="px-4 py-3">{formatarData(b.data_sessao)}</td>
                      <td className="px-4 py-3">{b.tipo_sessao}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {currentPage === 'pranchas' && (
          <div>
            <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
              <h2 className="text-2xl font-bold mb-6">Cadastrar Prancha</h2>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <input type="text" placeholder="Número" value={pranchaForm.numero_prancha} onChange={(e) => setPranchaForm({...pranchaForm, numero_prancha: e.target.value})} className="px-4 py-2 border rounded-lg" />
                <input type="date" value={pranchaForm.data_prancha} onChange={(e) => setPranchaForm({...pranchaForm, data_prancha: e.target.value})} className="px-4 py-2 border rounded-lg" />
                <input type="text" placeholder="Assunto" value={pranchaForm.assunto} onChange={(e) => setPranchaForm({...pranchaForm, assunto: e.target.value})} className="px-4 py-2 border rounded-lg" />
                <input type="text" placeholder="Destinatário" value={pranchaForm.destinatario} onChange={(e) => setPranchaForm({...pranchaForm, destinatario: e.target.value})} className="px-4 py-2 border rounded-lg" />
              </div>
              <button onClick={handleSubmitPrancha} className="w-full bg-blue-600 text-white py-3 rounded-lg">Cadastrar</button>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold mb-6">Lista</h2>
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">Número</th>
                    <th className="px-4 py-3 text-left">Data</th>
                    <th className="px-4 py-3 text-left">Assunto</th>
                    <th className="px-4 py-3 text-left">Destinatário</th>
                  </tr>
                </thead>
                <tbody>
                  {pranchas.map(p => (
                    <tr key={p.id} className="border-t">
                      <td className="px-4 py-3">{p.numero_prancha}</td>
                      <td className="px-4 py-3">{formatarData(p.data_prancha)}</td>
                      <td className="px-4 py-3">{p.assunto}</td>
                      <td className="px-4 py-3">{p.destinatario}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {currentPage === 'corpo-admin' && (
          <div>
            <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
              <h2 className="text-2xl font-bold mb-6">Cadastrar Cargo</h2>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <select value={corpoAdminForm.irmao_id} onChange={(e) => setCorpoAdminForm({...corpoAdminForm, irmao_id: e.target.value})} className="px-4 py-2 border rounded-lg">
                  <option value="">Selecione o Irmão</option>
                  {irmaos.filter(i => i.status === 'ativo').map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                </select>
                <select value={corpoAdminForm.cargo} onChange={(e) => setCorpoAdminForm({...corpoAdminForm, cargo: e.target.value})} className="px-4 py-2 border rounded-lg">
                  <option value="">Selecione o Cargo</option>
                  {cargosLoja.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                </select>
                <select value={corpoAdminForm.ano_exercicio} onChange={(e) => setCorpoAdminForm({...corpoAdminForm, ano_exercicio: e.target.value})} className="px-4 py-2 border rounded-lg">
                  <option value="">Ano</option>
                  <option value="2025/2026">2025/2026</option>
                  <option value="2026/2027">2026/2027</option>
                </select>
              </div>
              <button onClick={handleSubmitCorpoAdmin} className="w-full bg-blue-600 text-white py-3 rounded-lg">Cadastrar</button>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold mb-6">Lista</h2>
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">Nome</th>
                    <th className="px-4 py-3 text-left">Cargo</th>
                    <th className="px-4 py-3 text-left">Ano</th>
                  </tr>
                </thead>
                <tbody>
                  {corpoAdmin.map(c => (
                    <tr key={c.id} className="border-t">
                      <td className="px-4 py-3">{c.irmaos?.nome}</td>
                      <td className="px-4 py-3">{c.cargo}</td>
                      <td className="px-4 py-3">{c.ano_exercicio}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {currentPage === 'usuarios' && (
          <div>
            <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
              <h2 className="text-2xl font-bold mb-6">Criar Usuário</h2>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <input type="text" placeholder="Nome" value={novoUsuario.nome} onChange={(e) => setNovoUsuario({...novoUsuario, nome: e.target.value})} className="px-4 py-2 border rounded-lg" />
                <input type="email" placeholder="Email" value={novoUsuario.email} onChange={(e) => setNovoUsuario({...novoUsuario, email: e.target.value})} className="px-4 py-2 border rounded-lg" />
                <input type="password" placeholder="Senha" value={novoUsuario.senha} onChange={(e) => setNovoUsuario({...novoUsuario, senha: e.target.value})} className="px-4 py-2 border rounded-lg" />
                <select value={novoUsuario.cargo} onChange={(e) => setNovoUsuario({...novoUsuario, cargo: e.target.value})} className="px-4 py-2 border rounded-lg">
                  <option value="irmao">Irmão</option>
                  <option value="secretario">Secretário</option>
                  <option value="tesoureiro">Tesoureiro</option>
                  <option value="chanceler">Chanceler</option>
                  <option value="veneravel">Venerável</option>
                  <option value="administrador">Administrador</option>
                </select>
              </div>
              <button onClick={handleCriarUsuario} className="w-full bg-green-600 text-white py-3 rounded-lg">Criar</button>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold mb-6">Lista</h2>
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">Nome</th>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Cargo</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map(u => (
                    <tr key={u.id} className="border-t">
                      <td className="px-4 py-3">{u.nome}</td>
                      <td className="px-4 py-3">{u.email}</td>
                      <td className="px-4 py-3">{u.cargo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;-3">{i.nome}</td>
                    <td className="px-4 py-3">{i.cim}</td>
                    <td className="px-4 py-3">{i.status}</td>
                    <td className="px-4 py
