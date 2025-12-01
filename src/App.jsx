import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import './App.css';

// ============================================
// IMPORTS - COMPONENTES DO SISTEMA
// ============================================

// Autenticação
import Login from './components/Login';

// Irmãos
import CadastrarIrmao from './components/irmaos/CadastrarIrmao';
import VisualizarIrmaos from './components/irmaos/VisualizarIrmaos';

// Financeiro da Loja (ÚNICO SISTEMA FINANCEIRO)
import FinancasLoja from './components/financeiro/FinancasLoja';

// Balaustres
import Balaustres from './components/balaustres/Balaustres';

// Pranchas
import Pranchas from './components/pranchas/Pranchas';

// Comissões
import Comissoes from './components/comissoes/Comissoes';

// Biblioteca
import Biblioteca from './components/biblioteca/Biblioteca';

// Outros módulos (se houver)
// import OutroModulo from './components/outros/OutroModulo';

function App() {
  // ============================================
  // ESTADOS
  // ============================================
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modulo, setModulo] = useState('dashboard');
  const [menuAberto, setMenuAberto] = useState(true);

  // ============================================
  // EFEITOS
  // ============================================
  useEffect(() => {
    // Verificar sessão atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listener para mudanças na autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ============================================
  // HANDLERS
  // ============================================
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setModulo('dashboard');
  };

  // ============================================
  // RENDERIZAÇÃO - LOADING
  // ============================================
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDERIZAÇÃO - SEM SESSÃO (LOGIN)
  // ============================================
  if (!session) {
    return <Login />;
  }

  // ============================================
  // RENDERIZAÇÃO - COM SESSÃO (SISTEMA)
  // ============================================
  return (
    <div className="flex h-screen bg-gray-100">
      {/* ============================================ */}
      {/* SIDEBAR - MENU LATERAL */}
      {/* ============================================ */}
      <aside
        className={`${
          menuAberto ? 'w-64' : 'w-20'
        } bg-blue-900 text-white transition-all duration-300 flex flex-col`}
      >
        {/* CABEÇALHO */}
        <div className="p-4 border-b border-blue-800">
          <div className="flex items-center justify-between">
            {menuAberto && (
              <h1 className="text-xl font-bold">Sistema Acácia</h1>
            )}
            <button
              onClick={() => setMenuAberto(!menuAberto)}
              className="p-2 hover:bg-blue-800 rounded"
            >
              {menuAberto ? '◀' : '▶'}
            </button>
          </div>
          {menuAberto && (
            <p className="text-sm text-blue-300 mt-1">
              {session.user.email}
            </p>
          )}
        </div>

        {/* MENU DE NAVEGAÇÃO */}
        <nav className="flex-1 overflow-y-auto py-4">
          <div className="space-y-1 px-2">
            {/* Dashboard */}
            <button
              onClick={() => setModulo('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                modulo === 'dashboard'
                  ? 'bg-blue-700'
                  : 'hover:bg-blue-800'
              }`}
              title="Dashboard"
            >
              <span className="text-xl">🏠</span>
              {menuAberto && <span>Dashboard</span>}
            </button>

            {/* Irmãos */}
            <div className="pt-4 pb-2">
              {menuAberto && (
                <p className="text-xs text-blue-400 px-3 uppercase tracking-wider">
                  Irmãos
                </p>
              )}
            </div>
            
            <button
              onClick={() => setModulo('cadastrar-irmao')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                modulo === 'cadastrar-irmao'
                  ? 'bg-blue-700'
                  : 'hover:bg-blue-800'
              }`}
              title="Cadastrar Irmão"
            >
              <span className="text-xl">➕</span>
              {menuAberto && <span>Cadastrar Irmão</span>}
            </button>

            <button
              onClick={() => setModulo('visualizar-irmaos')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                modulo === 'visualizar-irmaos'
                  ? 'bg-blue-700'
                  : 'hover:bg-blue-800'
              }`}
              title="Visualizar Irmãos"
            >
              <span className="text-xl">👥</span>
              {menuAberto && <span>Visualizar Irmãos</span>}
            </button>

            {/* Financeiro */}
            <div className="pt-4 pb-2">
              {menuAberto && (
                <p className="text-xs text-blue-400 px-3 uppercase tracking-wider">
                  Financeiro
                </p>
              )}
            </div>

            <button
              onClick={() => setModulo('financas-loja')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                modulo === 'financas-loja'
                  ? 'bg-blue-700'
                  : 'hover:bg-blue-800'
              }`}
              title="Finanças da Loja"
            >
              <span className="text-xl">💰</span>
              {menuAberto && <span>Finanças da Loja</span>}
            </button>

            {/* Sessões */}
            <div className="pt-4 pb-2">
              {menuAberto && (
                <p className="text-xs text-blue-400 px-3 uppercase tracking-wider">
                  Sessões
                </p>
              )}
            </div>

            <button
              onClick={() => setModulo('balaustres')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                modulo === 'balaustres'
                  ? 'bg-blue-700'
                  : 'hover:bg-blue-800'
              }`}
              title="Balaustres"
            >
              <span className="text-xl">📋</span>
              {menuAberto && <span>Balaustres</span>}
            </button>

            <button
              onClick={() => setModulo('pranchas')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                modulo === 'pranchas'
                  ? 'bg-blue-700'
                  : 'hover:bg-blue-800'
              }`}
              title="Pranchas"
            >
              <span className="text-xl">📄</span>
              {menuAberto && <span>Pranchas</span>}
            </button>

            {/* Comissões */}
            <div className="pt-4 pb-2">
              {menuAberto && (
                <p className="text-xs text-blue-400 px-3 uppercase tracking-wider">
                  Comissões
                </p>
              )}
            </div>

            <button
              onClick={() => setModulo('comissoes')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                modulo === 'comissoes'
                  ? 'bg-blue-700'
                  : 'hover:bg-blue-800'
              }`}
              title="Comissões"
            >
              <span className="text-xl">👔</span>
              {menuAberto && <span>Comissões</span>}
            </button>

            {/* Biblioteca */}
            <div className="pt-4 pb-2">
              {menuAberto && (
                <p className="text-xs text-blue-400 px-3 uppercase tracking-wider">
                  Biblioteca
                </p>
              )}
            </div>

            <button
              onClick={() => setModulo('biblioteca')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                modulo === 'biblioteca'
                  ? 'bg-blue-700'
                  : 'hover:bg-blue-800'
              }`}
              title="Biblioteca"
            >
              <span className="text-xl">📚</span>
              {menuAberto && <span>Biblioteca</span>}
            </button>
          </div>
        </nav>

        {/* RODAPÉ - LOGOUT */}
        <div className="p-4 border-t border-blue-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            title="Sair"
          >
            <span className="text-xl">🚪</span>
            {menuAberto && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* ============================================ */}
      {/* CONTEÚDO PRINCIPAL */}
      {/* ============================================ */}
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-6">
          {/* DASHBOARD */}
          {modulo === 'dashboard' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  🏛️ A∴R∴L∴S∴ Acácia de Paranatinga nº 30
                </h1>
                <p className="text-gray-600">
                  Sistema de Gerenciamento Maçônico
                </p>
              </div>

              {/* Cards de Resumo */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">👥</span>
                    <div>
                      <p className="text-sm text-blue-600">Irmãos</p>
                      <p className="text-2xl font-bold text-blue-900">-</p>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">💰</span>
                    <div>
                      <p className="text-sm text-green-600">Finanças</p>
                      <p className="text-2xl font-bold text-green-900">-</p>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">📋</span>
                    <div>
                      <p className="text-sm text-purple-600">Balaustres</p>
                      <p className="text-2xl font-bold text-purple-900">-</p>
                    </div>
                  </div>
                </div>

                <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">📚</span>
                    <div>
                      <p className="text-sm text-orange-600">Biblioteca</p>
                      <p className="text-2xl font-bold text-orange-900">-</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Acesso Rápido */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  ⚡ Acesso Rápido
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={() => setModulo('cadastrar-irmao')}
                    className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 text-left transition-colors"
                  >
                    <p className="text-2xl mb-2">➕</p>
                    <p className="font-medium text-gray-900">Cadastrar Irmão</p>
                    <p className="text-sm text-gray-600">Novo cadastro</p>
                  </button>

                  <button
                    onClick={() => setModulo('financas-loja')}
                    className="p-4 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 text-left transition-colors"
                  >
                    <p className="text-2xl mb-2">💰</p>
                    <p className="font-medium text-gray-900">Finanças</p>
                    <p className="text-sm text-gray-600">Lançamentos e relatórios</p>
                  </button>

                  <button
                    onClick={() => setModulo('balaustres')}
                    className="p-4 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 text-left transition-colors"
                  >
                    <p className="text-2xl mb-2">📋</p>
                    <p className="font-medium text-gray-900">Balaustres</p>
                    <p className="text-sm text-gray-600">Registros de sessões</p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MÓDULO: CADASTRAR IRMÃO */}
          {modulo === 'cadastrar-irmao' && <CadastrarIrmao />}

          {/* MÓDULO: VISUALIZAR IRMÃOS */}
          {modulo === 'visualizar-irmaos' && <VisualizarIrmaos />}

          {/* MÓDULO: FINANÇAS DA LOJA (ÚNICO SISTEMA FINANCEIRO) */}
          {modulo === 'financas-loja' && <FinancasLoja />}

          {/* MÓDULO: BALAUSTRES */}
          {modulo === 'balaustres' && <Balaustres />}

          {/* MÓDULO: PRANCHAS */}
          {modulo === 'pranchas' && <Pranchas />}

          {/* MÓDULO: COMISSÕES */}
          {modulo === 'comissoes' && <Comissoes />}

          {/* MÓDULO: BIBLIOTECA */}
          {modulo === 'biblioteca' && <Biblioteca />}

          {/* ADICIONE OUTROS MÓDULOS AQUI */}
        </div>
      </main>
    </div>
  );
}

export default App;
