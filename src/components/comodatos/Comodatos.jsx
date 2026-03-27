import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import GestaoEquipamentos from './GestaoEquipamentos';
import GestaoBeneficiarios from './GestaoBeneficiarios';
import GestaoEmprestimos from './GestaoEmprestimos';

export default function Comodatos({ permissoes, showSuccess, showError }) {
  const [view, setView] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarEstatisticas();
  }, []);

  useEffect(() => {
    if (view === 'dashboard') {
      carregarEstatisticas();
    }
  }, [view]);

  const carregarEstatisticas = async () => {
    try {
      const { data, error } = await supabase
        .from('estatisticas_comodatos')
        .select('*')
        .single();

      if (error) throw error;
      setStats(data);
      setLoading(false);
    } catch (error) {
      console.error('Erro:', error);
      setStats({
        equipamentos_disponiveis: 0,
        equipamentos_emprestados: 0,
        total_beneficiarios: 0,
        emprestimos_vencidos: 0,
        equipamentos_manutencao: 0,
        emprestimos_ativos: 0,
        emprestimos_devolvidos: 0,
        equipamentos_descartados: 0
      });
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--color-accent)' }}></div>
      </div>
    );
  }

  // Cards do dashboard: alguns mantêm cores semânticas fixas (vermelho = alerta, cinza = descartado)
  // Os demais usam variáveis do tema
  const statsCards = [
    { emoji: '✅', label: 'Disponíveis',  sub: 'Equipamentos prontos',       value: stats?.equipamentos_disponiveis,  accent: true  },
    { emoji: '🔄', label: 'Emprestados',  sub: 'Em uso atualmente',           value: stats?.equipamentos_emprestados,  accent: true  },
    { emoji: '👥', label: 'Beneficiários',sub: 'Total cadastrado',            value: stats?.total_beneficiarios,       accent: true  },
    { emoji: '⚠️', label: 'Vencidos',     sub: 'Precisa atenção',             value: stats?.emprestimos_vencidos,      danger: true  },
    { emoji: '🔧', label: 'Manutenção',   sub: 'Em reparo',                   value: stats?.equipamentos_manutencao,   warning: true },
    { emoji: '📋', label: 'Ativos',       sub: 'Empréstimos em andamento',    value: stats?.emprestimos_ativos,        accent: true  },
    { emoji: '✔️', label: 'Devolvidos',   sub: 'Total histórico',             value: stats?.emprestimos_devolvidos,    success: true },
    { emoji: '🗑️', label: 'Descartados',  sub: 'Fora de uso',                 value: stats?.equipamentos_descartados,  muted: true   },
  ];

  const getCardStyle = (card) => {
    if (card.danger)   return { background: 'linear-gradient(135deg, #ef4444, #e11d48)' };
    if (card.warning)  return { background: 'linear-gradient(135deg, #f59e0b, #ea580c)' };
    if (card.success)  return { background: 'linear-gradient(135deg, #10b981, #16a34a)' };
    if (card.muted)    return { background: 'linear-gradient(135deg, #6b7280, #475569)' };
    // accent: usa gradiente do tema
    return { background: 'linear-gradient(135deg, var(--gradient-from), var(--gradient-to))' };
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="card-header rounded-xl shadow-xl p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">♿ Controle de Comodatos</h1>
            <p style={{ opacity: 0.85 }} className="text-lg">
              Gestão de Empréstimos de Equipamentos de Assistência
            </p>
          </div>
          <div className="text-7xl" style={{ opacity: 0.2 }}>🦽</div>
        </div>
      </div>

      {/* NAVEGAÇÃO */}
      <div className="card p-2">
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'dashboard',    label: '📊 Dashboard'    },
            { key: 'equipamentos', label: '🛠️ Equipamentos'  },
            { key: 'beneficiarios',label: '👥 Beneficiários' },
            { key: 'emprestimos',  label: '📋 Empréstimos'   },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              style={view === tab.key ? {
                background: 'var(--color-accent)',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                padding: '0.75rem 1.5rem',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 4px 6px rgba(0,0,0,0.15)'
              } : {
                background: 'var(--color-surface-3)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                borderRadius: '0.5rem',
                padding: '0.75rem 1.5rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* DASHBOARD */}
      {view === 'dashboard' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statsCards.map((card) => (
            <div
              key={card.label}
              className="rounded-xl shadow-lg p-6 text-white"
              style={{
                ...getCardStyle(card),
                transition: 'transform 0.2s ease',
                cursor: 'default'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="text-5xl">{card.emoji}</div>
                <div className="text-right">
                  <p className="text-sm font-medium" style={{ opacity: 0.85 }}>{card.label}</p>
                  <p className="text-4xl font-bold">{card.value || 0}</p>
                </div>
              </div>
              <p className="text-sm" style={{ opacity: 0.85 }}>{card.sub}</p>
            </div>
          ))}
        </div>
      )}

      {view === 'equipamentos' && (
        <GestaoEquipamentos
          showSuccess={showSuccess}
          showError={showError}
          permissoes={permissoes}
        />
      )}

      {view === 'beneficiarios' && (
        <GestaoBeneficiarios
          showSuccess={showSuccess}
          showError={showError}
          permissoes={permissoes}
        />
      )}

      {view === 'emprestimos' && (
        <GestaoEmprestimos
          showSuccess={showSuccess}
          showError={showError}
          permissoes={permissoes}
        />
      )}
    </div>
  );
}
