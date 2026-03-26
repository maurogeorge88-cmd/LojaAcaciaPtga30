/**
 * DASHBOARD CUNHADAS
 * Portal de acesso das cunhadas da loja
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export const DashboardCunhadas = ({ userData, onNavigate }) => {
  const [stats, setStats] = useState({
    totalCunhadas: 0,
    cunhadasAtivas: 0,
    receitasMes: 0,
    despesasMes: 0,
    inadimplentes: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarStats();
  }, []);

  const carregarStats = async () => {
    try {
      const mesAtual = new Date().toISOString().slice(0, 7); // "YYYY-MM"

      const [{ count: total }, { count: ativas }, { data: receitas }, { data: despesas }] =
        await Promise.all([
          supabase.from('cunhadas').select('*', { count: 'exact', head: true }),
          supabase.from('cunhadas').select('*', { count: 'exact', head: true }).eq('ativa', true),
          supabase
            .from('financeiro_cunhadas')
            .select('valor')
            .eq('tipo', 'receita')
            .gte('data_lancamento', `${mesAtual}-01`)
            .lte('data_lancamento', `${mesAtual}-31`),
          supabase
            .from('financeiro_cunhadas')
            .select('valor')
            .eq('tipo', 'despesa')
            .gte('data_lancamento', `${mesAtual}-01`)
            .lte('data_lancamento', `${mesAtual}-31`),
        ]);

      const somaReceitas = (receitas || []).reduce((s, r) => s + Number(r.valor), 0);
      const somaDespesas = (despesas || []).reduce((s, r) => s + Number(r.valor), 0);

      setStats({
        totalCunhadas: total || 0,
        cunhadasAtivas: ativas || 0,
        receitasMes: somaReceitas,
        despesasMes: somaDespesas,
        inadimplentes: 0,
      });
    } catch (err) {
      console.error('Erro ao carregar stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const saldoMes = stats.receitasMes - stats.despesasMes;

  const fmt = (v) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // ─── estilos reutilizáveis ────────────────────────────────────────────────
  const s = {
    page: {
      padding: '2rem',
      maxWidth: '1200px',
      margin: '0 auto',
    },
    // Header roxo
    header: {
      background: 'linear-gradient(135deg, #6d28d9, #a855f7)',
      padding: '2rem 2.5rem',
      borderRadius: 'var(--radius-xl)',
      marginBottom: '2rem',
      boxShadow: '0 8px 32px rgba(168, 85, 247, 0.35)',
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
    },
    headerIcon: { fontSize: '2.5rem', lineHeight: 1 },
    headerTitle: {
      fontSize: '1.75rem',
      fontWeight: '700',
      color: '#fff',
      margin: 0,
    },
    headerSub: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: '0.95rem',
      marginTop: '0.25rem',
    },
    // Grid de stat-cards
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '1.25rem',
      marginBottom: '2rem',
    },
    statCard: (accent) => ({
      background: 'var(--color-surface)',
      border: `1px solid var(--color-border)`,
      borderTop: `3px solid ${accent}`,
      borderRadius: 'var(--radius-xl)',
      padding: '1.5rem',
      boxShadow: 'var(--shadow-sm)',
    }),
    statLabel: {
      fontSize: '0.78rem',
      fontWeight: '600',
      color: 'var(--color-text-muted)',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      marginBottom: '0.5rem',
    },
    statValue: (accent) => ({
      fontSize: '1.6rem',
      fontWeight: '700',
      color: accent,
    }),
    statSub: {
      fontSize: '0.78rem',
      color: 'var(--color-text-faint)',
      marginTop: '0.25rem',
    },
    // Grid de nav-cards
    navGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
      gap: '1.25rem',
      marginBottom: '2rem',
    },
    navCard: {
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-xl)',
      padding: '2rem',
      cursor: 'pointer',
      transition: 'all var(--transition-base)',
      boxShadow: 'var(--shadow-sm)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
    },
    navCardIcon: {
      width: '3rem',
      height: '3rem',
      borderRadius: 'var(--radius-lg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '1.5rem',
    },
    navCardTitle: {
      fontSize: '1.05rem',
      fontWeight: '600',
      color: 'var(--color-text)',
      margin: 0,
    },
    navCardDesc: {
      fontSize: '0.875rem',
      color: 'var(--color-text-muted)',
      margin: 0,
    },
    navCardArrow: {
      marginTop: 'auto',
      fontSize: '0.8rem',
      fontWeight: '600',
      display: 'flex',
      alignItems: 'center',
      gap: '0.3rem',
    },
    // Banner dev
    devBanner: {
      padding: '1.25rem 1.5rem',
      background: 'rgba(168, 85, 247, 0.08)',
      border: '1px solid rgba(168, 85, 247, 0.25)',
      borderRadius: 'var(--radius-xl)',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
    },
    devText: {
      fontSize: '0.875rem',
      color: 'var(--color-text-muted)',
    },
  };

  const navItems = [
    {
      page: 'cadastro-cunhadas',
      icon: '👥',
      iconBg: 'rgba(168,85,247,0.15)',
      iconColor: '#a855f7',
      title: 'Cadastro de Cunhadas',
      desc: 'Gerenciar cadastro, dados e mensalidades',
      arrowColor: '#a855f7',
    },
    {
      page: 'financeiro-cunhadas',
      icon: '💰',
      iconBg: 'rgba(16,185,129,0.15)',
      iconColor: '#10b981',
      title: 'Financeiro',
      desc: 'Receitas, despesas e controle financeiro',
      arrowColor: '#10b981',
    },
    {
      page: 'relatorios-cunhadas',
      icon: '📊',
      iconBg: 'rgba(59,130,246,0.15)',
      iconColor: '#3b82f6',
      title: 'Relatórios',
      desc: 'Relatórios mensais, anuais e extratos',
      arrowColor: '#3b82f6',
    },
  ];

  return (
    <div style={s.page}>
      {/* ── Header ───────────────────────────────────────────── */}
      <div style={s.header}>
        <span style={s.headerIcon}>💜</span>
        <div>
          <h1 style={s.headerTitle}>Portal das Cunhadas</h1>
          <p style={s.headerSub}>
            Bem-vinda, {userData?.nome || 'Administrador'}!
          </p>
        </div>
      </div>

      {/* ── Stat cards ───────────────────────────────────────── */}
      <div style={s.statsGrid}>
        <div style={s.statCard('#a855f7')}>
          <div style={s.statLabel}>Total de Cunhadas</div>
          <div style={s.statValue('#a855f7')}>
            {loading ? '—' : stats.totalCunhadas}
          </div>
          <div style={s.statSub}>{stats.cunhadasAtivas} ativas</div>
        </div>

        <div style={s.statCard('#10b981')}>
          <div style={s.statLabel}>Receitas do Mês</div>
          <div style={s.statValue('#10b981')}>
            {loading ? '—' : fmt(stats.receitasMes)}
          </div>
          <div style={s.statSub}>Mês atual</div>
        </div>

        <div style={s.statCard('#ef4444')}>
          <div style={s.statLabel}>Despesas do Mês</div>
          <div style={s.statValue('#ef4444')}>
            {loading ? '—' : fmt(stats.despesasMes)}
          </div>
          <div style={s.statSub}>Mês atual</div>
        </div>

        <div style={s.statCard(saldoMes >= 0 ? '#10b981' : '#ef4444')}>
          <div style={s.statLabel}>Saldo do Mês</div>
          <div style={s.statValue(saldoMes >= 0 ? '#10b981' : '#ef4444')}>
            {loading ? '—' : fmt(saldoMes)}
          </div>
          <div style={s.statSub}>Receitas − Despesas</div>
        </div>
      </div>

      {/* ── Nav cards ────────────────────────────────────────── */}
      <div style={s.navGrid}>
        {navItems.map((item) => (
          <div
            key={item.page}
            style={s.navCard}
            onClick={() => onNavigate(item.page)}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = `0 12px 32px rgba(0,0,0,0.25)`;
              e.currentTarget.style.borderColor = item.iconColor;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
              e.currentTarget.style.borderColor = 'var(--color-border)';
            }}
          >
            <div
              style={{
                ...s.navCardIcon,
                background: item.iconBg,
              }}
            >
              {item.icon}
            </div>
            <div>
              <p style={s.navCardTitle}>{item.title}</p>
              <p style={s.navCardDesc}>{item.desc}</p>
            </div>
            <div style={{ ...s.navCardArrow, color: item.arrowColor }}>
              Acessar →
            </div>
          </div>
        ))}
      </div>

      {/* ── Banner dev ───────────────────────────────────────── */}
      <div style={s.devBanner}>
        <span style={{ fontSize: '1.25rem' }}>💡</span>
        <p style={s.devText}>
          <strong style={{ color: 'var(--color-text)' }}>
            Sistema em desenvolvimento.
          </strong>{' '}
          Mais funcionalidades serão adicionadas em breve.
        </p>
      </div>
    </div>
  );
};

export default DashboardCunhadas;
