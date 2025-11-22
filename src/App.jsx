import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// CONFIGURAÇÃO DO SUPABASE
const supabaseUrl = 'https://ypnvzjctyfdrkkrhskzs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwbnZ6amN0eWZkcmtrcmhza3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NTgxMzcsImV4cCI6MjA3OTMzNDEzN30.J5Jj7wudOhIAxy35DDBIWtr9yr9Lq3ABBRI9ZJ5z2pc';
const supabase = createClient(supabaseUrl, supabaseKey);

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    // Verificar sessão existente
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        loadUserData(session.user.email);
      }
      setLoading(false);
    });

    // Ouvir mudanças de autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        loadUserData(session.user.email);
      } else {
        setUserData(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async (userEmail) => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', userEmail)
        .single();

      if (error) throw error;
      setUserData(data);
    } catch (err) {
      console.error('Erro ao carregar dados do usuário:', err);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) throw error;

      // Verificar se usuário está ativo
      const { data: userData, error: userError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', email)
        .single();

      if (userError) {
        throw new Error('Usuário não encontrado no sistema');
      }

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
    setEmail('');
    setPassword('');
  };

  // Tela de carregamento inicial
  if (loading && !session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Carregando...</div>
      </div>
    );
  }

  // Área logada
  if (session && userData) {
    return (
      <div className="min-h-screen bg-gray-100">
        {/* Header */}
        <header className="bg-gradient-to-r from-blue-900 to-blue-700 text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-6 py-5 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Sistema Loja Maçônica</h1>
              <p className="text-blue-200 mt-1">Bem-vindo, {userData.nome}</p>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded-lg font-semibold transition shadow-md"
            >
              Sair
            </button>
          </div>
        </header>

        {/* Conteúdo Principal */}
        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-600">
              <h3 className="font-bold text-blue-900 text-lg mb-3">👤 Seu Perfil</h3>
              <div className="space-y-2">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Email:</span> {userData.email}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Nível:</span> {userData.nivel_acesso}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Status:</span>
                  <span
                    className={
                      userData.ativo
                        ? 'text-green-600 font-semibold'
                        : 'text-red-600 font-semibold'
                    }
                  >
                    {userData.ativo ? ' ✅ Ativo' : ' ❌ Inativo'}
                  </span>
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-600">
              <h3 className="font-bold text-green-900 text-lg mb-3">📋 Próximas Fases</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>✅ Fase 1: Login completo</li>
                <li>⏳ Fase 2: Cadastro de Irmãos</li>
                <li>⏳ Fase 3: Listagem e Pesquisa</li>
                <li>⏳ Fase 4: Edição de dados</li>
                <li>⏳ Fase 5: Familiares</li>
              </ul>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-purple-600">
              <h3 className="font-bold text-purple-900 text-lg mb-3">⚙️ Sistema</h3>
              <div className="space-y-2 text-sm text-gray-700">
                <p>
                  <span className="font-semibold">Versão:</span> 1.0
                </p>
                <p>
                  <span className="font-semibold">Fase:</span> 1 - Autenticação
                </p>
                <p className="text-green-600 font-semibold">✅ Operacional</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl shadow-md p-8 border border-green-200">
            <div className="flex items-start gap-4">
              <div className="text-4xl">🎉</div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-3">
                  Fase 1 Concluída com Sucesso!
                </h2>
                <p className="text-gray-700 mb-2">
                  O sistema de autenticação está funcionando perfeitamente. Você conseguiu:
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-1 mb-4">
                  <li>Fazer login com email e senha</li>
                  <li>Validar credenciais no Supabase</li>
                  <li>Carregar dados do usuário</li>
                  <li>Visualizar informações do perfil</li>
                </ul>
                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <p className="text-gray-800 font-semibold mb-1">🚀 Próximo Passo:</p>
                  <p className="text-gray-600">
                    Vamos criar o módulo de <strong>Cadastro de Irmãos</strong> com campos
                    personalizados (CIM, nome, data de nascimento, telefone, endereço, etc.)
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Tela de Login
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🔷</div>
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
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
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span> Entrando...
              </span>
            ) : (
              '🔐 Entrar'
            )}
          </button>
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-gray-400">Fase 1: Autenticação ✅</p>
        </div>
      </div>
    </div>
  );
}

export default App;
