/**
 * DASHBOARD CUNHADAS
 * Portal de acesso das cunhadas da loja
 */

import React from 'react';

export const DashboardCunhadas = ({ userData, onNavigate }) => {
  return (
    <div style={{
      padding: '2rem',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))',
        padding: '2rem',
        borderRadius: '16px',
        marginBottom: '2rem',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: '700',
          color: 'white',
          marginBottom: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <span style={{ fontSize: '2.5rem' }}>💜</span>
          Portal das Cunhadas
        </h1>
        <p style={{
          color: 'rgba(255,255,255,0.9)',
          fontSize: '1.1rem'
        }}>
          Bem-vinda, {userData?.nome || 'Cunhada'}!
        </p>
      </div>

      {/* Cards de Menu */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.5rem',
        marginTop: '2rem'
      }}>
        {/* Card Cadastro */}
        <div
          onClick={() => onNavigate('cadastro-cunhadas')}
          style={{
            background: 'var(--card-bg)',
            padding: '2rem',
            borderRadius: '16px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            border: '2px solid var(--border-color)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 8px 25px rgba(168, 85, 247, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.05)';
          }}
        >
          <div style={{
            fontSize: '3rem',
            marginBottom: '1rem'
          }}>👥</div>
          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: '600',
            marginBottom: '0.5rem',
            color: 'var(--text-primary)'
          }}>
            Cadastro de Cunhadas
          </h3>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '0.95rem'
          }}>
            Gerenciar cadastro das cunhadas
          </p>
        </div>

        {/* Card Financeiro */}
        <div
          onClick={() => onNavigate('financeiro-cunhadas')}
          style={{
            background: 'var(--card-bg)',
            padding: '2rem',
            borderRadius: '16px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            border: '2px solid var(--border-color)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 8px 25px rgba(168, 85, 247, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.05)';
          }}
        >
          <div style={{
            fontSize: '3rem',
            marginBottom: '1rem'
          }}>💰</div>
          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: '600',
            marginBottom: '0.5rem',
            color: 'var(--text-primary)'
          }}>
            Financeiro
          </h3>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '0.95rem'
          }}>
            Receitas, despesas e mensalidades
          </p>
        </div>

        {/* Card Relatórios */}
        <div
          onClick={() => onNavigate('relatorios-cunhadas')}
          style={{
            background: 'var(--card-bg)',
            padding: '2rem',
            borderRadius: '16px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            border: '2px solid var(--border-color)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 8px 25px rgba(168, 85, 247, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.05)';
          }}
        >
          <div style={{
            fontSize: '3rem',
            marginBottom: '1rem'
          }}>📊</div>
          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: '600',
            marginBottom: '0.5rem',
            color: 'var(--text-primary)'
          }}>
            Relatórios
          </h3>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '0.95rem'
          }}>
            Relatórios mensais e anuais
          </p>
        </div>
      </div>

      {/* Informação */}
      <div style={{
        marginTop: '3rem',
        padding: '1.5rem',
        background: 'rgba(168, 85, 247, 0.1)',
        border: '2px solid rgba(168, 85, 247, 0.2)',
        borderRadius: '12px'
      }}>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '0.95rem',
          textAlign: 'center'
        }}>
          💡 <strong>Novo sistema em desenvolvimento!</strong><br/>
          Mais funcionalidades serão adicionadas em breve.
        </p>
      </div>
    </div>
  );
};

export default DashboardCunhadas;
