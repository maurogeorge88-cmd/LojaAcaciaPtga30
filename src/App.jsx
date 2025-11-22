import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ypnvzjctyfdrkkrhskzs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwbnZ6amN0eWZkcmtrcmhza3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NTgxMzcsImV4cCI6MjA3OTMzNDEzN30.J5Jj7wudOhIAxy35DDBIWtr9yr9Lq3ABBRI9ZJ5z2pc';
const supabase = createClient(supabaseUrl, supabaseKey);

const LOGO_URL = 'https://via.placeholder.com/150x150/1e3a8a/ffffff?text=LOJA';

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

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [userData, setUserData] = useState(null);
  const [permissoes, setPermissoes] = useState(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [irmaos, setIrmaos] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ativo');
  const [irmaoSelecionado, setIrmaoSelecionado] = useState(null);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [irmaoEditando, setIrmaoEditando] = useState(null);

  const [irmaoForm, setIrmaoForm] = useState({
    cim: '', nome: '', cpf: '', rg: '', data_nascimento: '', estado_civil: '',
    profissao: '', formacao: '', status: 'ativo', naturalidade: '', endereco: '',
    cidade: '', celular: '', email: '', local_trabalho: '', cargo: '',
    data_iniciacao: '', data_elevacao: '', data_exaltacao: ''
  });

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
    try {
      const { data } = await supabase.from('irmaos').select('*').order('nome');
      setIrmaos(data || []);
    } catch (err) {
      console.error('Erro:', err);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const { data: userData } = await supabase.from('usuarios').select('*').eq('email', email).single();
      if (!userData?.ativo) {
        await supabase.auth.signOut();
        throw new Error('Usuário inativo');
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
    setCurrentPage('dashboard');
  };

  const limparFormulario = () => {
    setIrmaoForm({
      cim: '', nome: '', cpf: '', rg: '', data_nascimento: '', estado_civil: '',
      profissao: '', formacao: '', status: 'ativo', naturalidade: '', endereco: '',
      cidade: '', celular: '', email: '', local_trabalho: '', cargo: '',
      data_iniciacao: '', data_elevacao: '', data_exaltacao: ''
    });
    setModoEdicao(false);
    setIrmaoEditando(null);
  };

  const handleSubmitIrmao = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      await supabase.from('irmaos').insert([irmaoForm]);
      setSuccessMessage('✅ Irmão cadastrado com sucesso!');
      limparFormulario();
      loadIrmaos();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message || 'Erro ao cadastrar');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  const iniciarEdicao = (irmao) => {
    setModoEdicao(true);
    setIrmaoEditando(irmao);
    setIrmaoForm({
      ...irmao,
      data_nascimento: formatarDataInput(irmao.data_nascimento),
      data_iniciacao: formatarDataInput(irmao.data_iniciacao),
      data_elevacao: formatarDataInput(irmao.data_elevacao),
      data_exaltacao: formatarDataInput(irmao.data_exaltacao)
    });
    setCurrentPage('cadastro');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAtualizarIrmao = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      await supabase.from('irmaos').update(irmaoForm).eq('id', irmaoEditando.id);
      setSuccessMessage('✅ Cadastro atualizado com sucesso!');
      limparFormulario();
      loadIrmaos();
      setCurrentPage('listagem');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message || 'Erro ao atualizar');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  const handleExcluirIrmao = async (id) => {
    if (!window.confirm('⚠️ Tem certeza que deseja EXCLUIR este irmão?')) return;

    try {
      await supabase.from('irmaos').delete().eq('id', id);
      setSuccessMessage('✅ Irmão excluído com sucesso!');
      loadIrmaos();
      setCurrentPage('listagem');
    } catch (err) {
      setError('Erro ao excluir: ' + err.message);
    }
  };

  const visualizarIrmao = (irmao) => {
    setIrmaoSelecionado(irmao);
    setCurrentPage('visualizar');
  };

  const irmaosFiltrados = irmaos.filter(irmao => {
    const matchSearch = irmao.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       irmao.cim.toLowerCase().includes(searchTerm.toLowerCase());
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
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="seu@email.com"
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
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                ⚠️ {error}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading || !email || !password}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition disabled:bg-gray-400"
            >
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
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={LOGO_URL} alt="Logo" className="w-12 h-12 rounded-full shadow-md" />
              <div>
                <h1 className="text-2xl font-bold">Sistema Loja Maçônica</h1>
                <p className="text-sm text-blue-200">{userData?.nome}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded-lg font-semibold transition">
              Sair
            </button>
          </div>
        </div>
      </header>

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
                onClick={modoEdicao ? handleAtualizarIrmao : handleSubmitIrmao}
                disabled={loading || !irmaoForm.cim || !irmaoForm.nome}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition disabled:bg-gray-400"
              >
                {loading ? 'Salvando...' : modoEdicao ? '💾 Atualizar' : '💾 Salvar'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;={() => { limparFormulario(); setCurrentPage('cadastro'); }}
                className={`py-4 px-2 border-b-2 font-medium ${currentPage === 'cadastro' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-blue-600'}`}
              >
                Cadastrar
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">⚠️ {error}</div>}
        {successMessage && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">{successMessage}</div>}

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
                  <h2 className="text-2xl font-bold text-gray-800 mb-3">Sistema Operacional!</h2>
                  <p className="text-gray-700 mb-4">
                    ✅ Login e autenticação<br />
                    ✅ Dashboard com estatísticas<br />
                    ✅ Listagem e pesquisa de irmãos<br />
                    ✅ Cadastro e edição<br />
                    ✅ Sistema de permissões
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentPage === 'listagem' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Listagem de Irmãos</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="🔍 Buscar por nome ou CIM..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
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
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${irmao.status === 'ativo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {irmao.status === 'ativo' ? '✅ Ativo' : '❌ Inativo'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm space-x-3">
                          <button onClick={() => visualizarIrmao(irmao)} className="text-blue-600 hover:text-blue-800 font-semibold">Ver</button>
                          {permissoes?.pode_editar_cadastros && (
                            <button onClick={() => iniciarEdicao(irmao)} className="text-green-600 hover:text-green-800 font-semibold">Editar</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {currentPage === 'visualizar' && irmaoSelecionado && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <button onClick={() => setCurrentPage('listagem')} className="text-blue-600 hover:text-blue-800 font-semibold">← Voltar</button>
              {permissoes?.pode_editar_cadastros && (
                <div className="flex gap-3">
                  <button onClick={() => iniciarEdicao(irmaoSelecionado)} className="bg-blue-600 text-white px-4 py-2 rounded-lg">✏️ Editar</button>
                  <button onClick={() => handleExcluirIrmao(irmaoSelecionado.id)} className="bg-red-600 text-white px-4 py-2 rounded-lg">🗑️ Excluir</button>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Dados Completos do Irmão</h2>
              
              <div className="mb-6">
                <h3 className="text-lg font-bold text-blue-900 mb-3 pb-2 border-b">📋 Dados Pessoais</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div><strong>CIM:</strong> {irmaoSelecionado.cim}</div>
                  <div><strong>Nome:</strong> {irmaoSelecionado.nome}</div>
                  <div><strong>CPF:</strong> {irmaoSelecionado.cpf || '-'}</div>
                  <div><strong>RG:</strong> {irmaoSelecionado.rg || '-'}</div>
                  <div><strong>Data Nasc:</strong> {formatarData(irmaoSelecionado.data_nascimento)}</div>
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

              <div>
                <h3 className="text-lg font-bold text-blue-900 mb-3 pb-2 border-b">🔷 Dados Maçônicos</h3>
                <div className="grid grid-cols-1 gap-2">
                  <div><strong>Cargo na Loja:</strong> {irmaoSelecionado.cargo || '-'}</div>
                  <div><strong>Status:</strong> <span className={`px-2 py-1 rounded text-xs ${irmaoSelecionado.status === 'ativo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{irmaoSelecionado.status}</span></div>
                  <div><strong>Data de Iniciação:</strong> {formatarData(irmaoSelecionado.data_iniciacao)}</div>
                  <div><strong>Data de Elevação:</strong> {formatarData(irmaoSelecionado.data_elevacao)}</div>
                  <div><strong>Data de Exaltação:</strong> {formatarData(irmaoSelecionado.data_exaltacao)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentPage === 'cadastro' && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">{modoEdicao ? '✏️ Editar Irmão' : 'Cadastrar Irmão'}</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">CIM *</label>
                <input type="text" value={irmaoForm.cim} onChange={(e) => setIrmaoForm({...irmaoForm, cim: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome Completo *</label>
                <input type="text" value={irmaoForm.nome} onChange={(e) => setIrmaoForm({...irmaoForm, nome: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">CPF</label>
                <input type="text" value={irmaoForm.cpf} onChange={(e) => setIrmaoForm({...irmaoForm, cpf: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">RG</label>
                <input type="text" value={irmaoForm.rg} onChange={(e) => setIrmaoForm({...irmaoForm, rg: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data Nascimento</label>
                <input type="date" value={irmaoForm.data_nascimento} onChange={(e) => setIrmaoForm({...irmaoForm, data_nascimento: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Estado Civil</label>
                <select value={irmaoForm.estado_civil} onChange={(e) => setIrmaoForm({...irmaoForm, estado_civil: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">Selecione</option>
                  <option value="solteiro">Solteiro</option>
                  <option value="casado">Casado</option>
                  <option value="divorciado">Divorciado</option>
                  <option value="viuvo">Viúvo</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Profissão</label>
                <input type="text" value={irmaoForm.profissao} onChange={(e) => setIrmaoForm({...irmaoForm, profissao: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Formação</label>
                <input type="text" value={irmaoForm.formacao} onChange={(e) => setIrmaoForm({...irmaoForm, formacao: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select value={irmaoForm.status} onChange={(e) => setIrmaoForm({...irmaoForm, status: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Naturalidade</label>
                <input type="text" value={irmaoForm.naturalidade} onChange={(e) => setIrmaoForm({...irmaoForm, naturalidade: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Endereço</label>
                <input type="text" value={irmaoForm.endereco} onChange={(e) => setIrmaoForm({...irmaoForm, endereco: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cidade</label>
                <input type="text" value={irmaoForm.cidade} onChange={(e) => setIrmaoForm({...irmaoForm, cidade: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Celular</label>
                <input type="text" value={irmaoForm.celular} onChange={(e) => setIrmaoForm({...irmaoForm, celular: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">E-mail</label>
                <input type="email" value={irmaoForm.email} onChange={(e) => setIrmaoForm({...irmaoForm, email: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Local de Trabalho</label>
                <input type="text" value={irmaoForm.local_trabalho} onChange={(e) => setIrmaoForm({...irmaoForm, local_trabalho: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cargo na Loja</label>
                <input type="text" value={irmaoForm.cargo} onChange={(e) => setIrmaoForm({...irmaoForm, cargo: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ex: Venerável Mestre" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data de Iniciação</label>
                <input type="date" value={irmaoForm.data_iniciacao} onChange={(e) => setIrmaoForm({...irmaoForm, data_iniciacao: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data de Elevação</label>
                <input type="date" value={irmaoForm.data_elevacao} onChange={(e) => setIrmaoForm({...irmaoForm, data_elevacao: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data de Exaltação</label>
                <input type="date" value={irmaoForm.data_exaltacao} onChange={(e) => setIrmaoForm({...irmaoForm, data_exaltacao: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <button onClick={limparFormulario} className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50">
                {modoEdicao ? 'Cancelar' : 'Limpar'}
              </button>
              <button
                onClick
