import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ypnvzjctyfdrkkrhskzs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwbnZ6amN0eWZkcmtrcmhza3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NTgxMzcsImV4cCI6MjA3OTMzNDEzN30.J5Jj7wudOhIAxy35DDBIWtr9yr9Lq3ABBRI9ZJ5z2pc';
const supabase = createClient(supabaseUrl, supabaseKey);

const LOGO_URL = 'https://via.placeholder.com/150x150/1e3a8a/ffffff?text=LOJA';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [userData, setUserData] = useState(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [irmaos, setIrmaos] = useState([]);

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
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded-lg font-semibold transition"
            >
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
              className={`py-4 px-2 border-b-2 font-medium ${
                currentPage === 'dashboard'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-blue-600'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setCurrentPage('listagem')}
              className={`py-4 px-2 border-b-2 font-medium ${
                currentPage === 'listagem'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-blue-600'
              }`}
            >
              Listagem de Irmãos
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
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
                    ✅ Login funcional<br />
                    ✅ Dashboard com estatísticas<br />
                    ✅ Listagem de irmãos<br />
                    ✅ Sistema de permissões
                  </p>
                  <div className="bg-white rounded-lg p-4 border border-blue-200">
                    <p className="text-sm text-gray-700">
                      <strong>Próximos passos:</strong> Adicionar módulos de cadastro, edição, balaustres, pranchas e financeiro.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentPage === 'listagem' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Listagem de Irmãos</h2>

            {irmaos.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-xl mb-2">📭</p>
                <p>Nenhum irmão cadastrado</p>
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {irmaos.map((irmao) => (
                      <tr key={irmao.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{irmao.cim}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">{irmao.nome}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{irmao.cargo || '-'}</td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              irmao.status === 'ativo'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {irmao.status === 'ativo' ? '✅ Ativo' : '❌ Inativo'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
