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
    <div className="p-6 max-w-7xl mx-auto" style={{ 
      background: 'var(--color-bg)',
      minHeight: '100vh'
    }}>
      {/* Cabeçalho */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>⚙️ Gestão do Sistema</h1>
        <p style={{ color: 'var(--color-text-muted)' }}>Gerencie usuários e monitore o acesso ao sistema</p>
      </div>

      {/* Abas de navegação */}
      <div className="card mb-6" style={{ padding: 0 }}>
        <div className="flex" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <button
            onClick={() => setAbaSelecionada('usuarios')}
            style={{
              flex: 1,
              padding: '1rem 1.5rem',
              fontWeight: '600',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              background: abaSelecionada === 'usuarios' ? 'var(--color-accent)' : 'transparent',
              color: abaSelecionada === 'usuarios' ? 'white' : 'var(--color-text)',
              borderBottom: abaSelecionada === 'usuarios' ? '4px solid var(--color-accent-hover)' : 'none',
              border: 'none',
              cursor: 'pointer',
              borderTopLeftRadius: 'var(--radius-xl)'
            }}
            onMouseEnter={(e) => {
              if (abaSelecionada !== 'usuarios') {
                e.target.style.background = 'var(--color-surface-2)';
              }
            }}
            onMouseLeave={(e) => {
              if (abaSelecionada !== 'usuarios') {
                e.target.style.background = 'transparent';
              }
            }}
          >
            <span className="text-xl">👤</span>
            <span>Gerenciar Usuários</span>
          </button>
          
          <button
            onClick={() => setAbaSelecionada('logs')}
            style={{
              flex: 1,
              padding: '1rem 1.5rem',
              fontWeight: '600',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              background: abaSelecionada === 'logs' ? 'var(--color-accent)' : 'transparent',
              color: abaSelecionada === 'logs' ? 'white' : 'var(--color-text)',
              borderBottom: abaSelecionada === 'logs' ? '4px solid var(--color-accent-hover)' : 'none',
              border: 'none',
              cursor: 'pointer',
              borderTopRightRadius: 'var(--radius-xl)'
            }}
            onMouseEnter={(e) => {
              if (abaSelecionada !== 'logs') {
                e.target.style.background = 'var(--color-surface-2)';
              }
            }}
            onMouseLeave={(e) => {
              if (abaSelecionada !== 'logs') {
                e.target.style.background = 'transparent';
              }
            }}
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
            embedded={true}
          />
        )}

        {abaSelecionada === 'logs' && (
          <ControleAcesso 
            userData={userData}
            showSuccess={showSuccess}
            showError={showError}
            embedded={true}
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
