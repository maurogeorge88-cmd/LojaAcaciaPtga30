/**
 * COMPONENTE HEADER (CABEÇALHO)
 * Sistema A∴R∴L∴S∴ Acácia de Paranatinga nº 30
 */

import React from 'react';

const PAGE_TITLES = {
  dashboard: '📊 Dashboard',
  cadastro: '➕ Cadastro de Irmãos',
  visualizar: '👥 Visualizar Irmãos',
  quadro: '📋 Quadro de Irmãos',
  balaustres: '📜 Balaustres',
  pranchas: '📄 Pranchas Expedidas',
  'corpo-admin': '👔 Corpo Administrativo',
  comissoes: '📋 Comissões',
  biblioteca: '📚 Biblioteca',
  usuarios: '👤 Gerenciar Usuários',
  financeiro: '💰 Sistema Financeiro'
};

export const Header = ({ currentPage, userData }) => {
  const formatarDataCompleta = () => {
    return new Date().toLocaleDateString('pt-BR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <header 
      className="shadow-md sticky top-0 z-40"
      style={{
        backgroundColor: `rgb(var(--color-primary-50))`,
        borderBottom: `4px solid rgb(var(--color-primary-600))`
      }}
    >
      <div className="px-8 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              {PAGE_TITLES[currentPage] || '📄 Página'}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-semibold text-sm text-gray-800">{userData?.nome || 'Usuário'}</p>
              <p className="text-xs text-gray-600 capitalize">{userData?.cargo || 'Irmão'}</p>
            </div>
            <div className="text-sm text-gray-500">
              {formatarDataCompleta()}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
