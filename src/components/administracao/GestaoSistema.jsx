/**
 * COMPONENTE GESTÃO DO SISTEMA
 * Sistema A∴R∴L∴S∴ Acácia de Paranatinga nº 30
 * 
 * Componente que unifica:
 * - Gerenciamento de Usuários
 * - Controle de Acesso e Logs
 */

import React, { useState } from 'react';
import Usuarios from './Usuarios';
import ControleAcesso from './ControleAcesso';

export default function GestaoSistema({ usuarios, userData, onUpdate, showSuccess, showError, abaInicial = 'usuarios' }) {
  const [abaSelecionada, setAbaSelecionada] = useState(abaInicial);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">⚙️ Gestão do Sistema</h1>
        <p className="text-gray-600">Gerencie usuários e monitore o acesso ao sistema</p>
      </div>

      {/* Abas de navegação */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="flex border-b">
          <button
            onClick={() => setAbaSelecionada('usuarios')}
            className={`flex-1 px-6 py-4 font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
              abaSelecionada === 'usuarios'
                ? 'bg-blue-600 text-white border-b-4 border-blue-700'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span className="text-xl">👤</span>
            <span>Gerenciar Usuários</span>
          </button>
          
          <button
            onClick={() => setAbaSelecionada('logs')}
            className={`flex-1 px-6 py-4 font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
              abaSelecionada === 'logs'
                ? 'bg-blue-600 text-white border-b-4 border-blue-700'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span className="text-xl">🔐</span>
            <span>Controle de Acesso</span>
          </button>
        </div>
      </div>

      {/* Conteúdo da aba selecionada */}
      <div className="animate-fadeIn">
        {abaSelecionada === 'usuarios' && (
          <Usuarios 
            usuarios={usuarios}
            userData={userData}
            onUpdate={onUpdate}
            showSuccess={showSuccess}
            showError={showError}
          />
        )}

        {abaSelecionada === 'logs' && (
          <ControleAcesso 
            userData={userData}
            showSuccess={showSuccess}
            showError={showError}
          />
        )}
      </div>

      {/* Estilos para animação */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
