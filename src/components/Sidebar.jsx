/**
 * COMPONENTE SIDEBAR (MENU LATERAL)
 * Sistema A∴R∴L∴S∴ Acácia de Paranatinga nº 30
 */

import React from 'react';

const LOGO_URL = 'https://bxcywxtbfbvitcssnrcj.supabase.co/storage/v1/object/public/imagens/logo-acacia.jpg';
const NOME_LOJA = 'A∴R∴L∴S∴ Acácia de Paranatinga nº 30';

export const Sidebar = ({ currentPage, setCurrentPage, permissoes, onLogout }) => {
  const [menuGestaoAberto, setMenuGestaoAberto] = React.useState(false);

  const MenuItem = ({ page, icon, label, requirePermission = null }) => {
    // Se requer permissão e não tem, não renderiza
    if (requirePermission && !permissoes?.[requirePermission]) {
      return null;
    }

    return (
      <button
        onClick={() => setCurrentPage(page)}
        className={`w-full px-4 py-2 flex items-center gap-2 transition text-sm ${
          currentPage === page
            ? 'bg-blue-700 border-l-4 border-white'
            : 'hover:bg-blue-800'
        }`}
      >
        <span className="text-base">{icon}</span>
        <span className="font-semibold">{label}</span>
      </button>
    );
  };

  const MenuDropdown = ({ icon, label, items, requirePermission = null }) => {
    // Se requer permissão e não tem, não renderiza
    if (requirePermission && !permissoes?.[requirePermission]) {
      return null;
    }

    const isAnyChildActive = items.some(item => item.page === currentPage);

    return (
      <div className="relative">
        <button
          onClick={() => setMenuGestaoAberto(!menuGestaoAberto)}
          className={`w-full px-4 py-2 flex items-center justify-between transition text-sm ${
            isAnyChildActive
              ? 'bg-blue-700 border-l-4 border-white'
              : 'hover:bg-blue-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">{icon}</span>
            <span className="font-semibold">{label}</span>
          </div>
          <span className={`transform transition-transform ${menuGestaoAberto ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </button>
        
        {menuGestaoAberto && (
          <div className="bg-blue-800 border-l-2 border-blue-600">
            {items.map((item, index) => (
              <button
                key={index}
                onClick={() => {
                  setCurrentPage(item.page);
                  setMenuGestaoAberto(false);
                }}
                className={`w-full px-8 py-2 flex items-center gap-2 transition text-sm ${
                  currentPage === item.page
                    ? 'bg-blue-600 border-l-4 border-white'
                    : 'hover:bg-blue-700'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="w-64 bg-gradient-to-b from-blue-900 to-indigo-900 text-white fixed h-screen shadow-2xl flex flex-col">
      {/* Logo e Título */}
      <div className="p-6 border-b border-blue-700 flex-shrink-0">
        <div className="flex flex-col items-center">
          <img 
            src={LOGO_URL} 
            alt="Logo" 
            className="w-20 h-20 rounded-full border-4 border-white mb-3" 
          />
          <h1 className="text-lg font-bold text-center leading-tight">{NOME_LOJA}</h1>
          <p className="text-xs text-blue-200 mt-1">Gestão e Controle</p>
        </div>
      </div>

      {/* Menu de Navegação */}
      <nav className="py-2 flex-1 overflow-y-auto">
        <MenuItem page="dashboard" icon="📊" label="Dashboard" />
        <MenuItem page="cadastro" icon="➕" label="Cadastrar Irmão" />
        <MenuItem page="visualizar" icon="👥" label="Visualizar Irmãos" />
        <MenuItem page="quadro" icon="📋" label="Quadro de Irmãos" />
        <MenuItem page="balaustres" icon="📜" label="Balaustres" />
        <MenuItem page="pranchas" icon="📄" label="Pranchas" />
        <MenuItem page="projetos" icon="📊" label="Projetos" />
        <MenuItem page="comissoes" icon="📋" label="Comissões" />
        <MenuItem page="biblioteca" icon="📚" label="Biblioteca" />
        
        {/* Menu Dropdown - Gestão do Sistema */}
        <MenuDropdown 
          icon="⚙️" 
          label="Gestão do Sistema"
          requirePermission="canManageUsers"
          items={[
            { page: 'gestao-sistema-usuarios', icon: '👤', label: 'Gerenciar Usuários' },
            { page: 'gestao-sistema-logs', icon: '🔐', label: 'Controle de Acesso' }
          ]}
        />
        
        <MenuItem page="corpo-admin" icon="👔" label="Administração" />
      </nav>

      {/* Botão Sair */}
      <div className="border-t border-blue-700 bg-blue-950 p-3 flex-shrink-0">
        <button
          onClick={onLogout}
          className="w-full bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-semibold transition flex items-center justify-center gap-2 text-sm"
        >
          <span>🚪</span>
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
};
