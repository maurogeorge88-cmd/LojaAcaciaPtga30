import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import GestaoEquipamentos from './GestaoEquipamentos';
import GestaoBeneficiarios from './GestaoBeneficiarios';
import GestaoEmprestimos from './GestaoEmprestimos';

export default function Comodatos({ permissoes, showSuccess, showError }) {
  const [view, setView]     = useState('dashboard');
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [anosDisponiveis, setAnosDisponiveis] = useState([]);
  const [filtroAno, setFiltroAno] = useState('todos');

  useEffect(() => { carregarEstatisticas(); }, []);
  useEffect(() => { if (view === 'dashboard') carregarEstatisticas(); }, [view]);
  useEffect(() => { if (stats !== null) calcularStats(); }, [filtroAno]);

  // Dados brutos armazenados para re-calcular ao trocar ano sem nova query
  const [dadosBrutos, setDadosBrutos] = useState(null);

  const carregarEstatisticas = async () => {
    setLoading(true);
    try {
      const hoje = new Date(); hoje.setHours(0, 0, 0, 0);

      // Equipamentos (não dependem de ano)
      const { data: equips } = await supabase
        .from('equipamentos')
        .select('id, status');

      // Beneficiários (não dependem de ano)
      const { data: beneficiarios } = await supabase
        .from('beneficiarios')
        .select('id');

      // Todos os empréstimos com itens
      const { data: emprestimos } = await supabase
        .from('comodatos')
        .select(`
          id, status, data_emprestimo, data_devolucao_prevista, data_devolucao_real,
          itens:comodato_itens (id, status)
        `)
        .order('data_emprestimo', { ascending: false });

      const brutos = { equips: equips || [], beneficiarios: beneficiarios || [], emprestimos: emprestimos || [], hoje };
      setDadosBrutos(brutos);

      // Anos disponíveis dos empréstimos
      const anos = [...new Set((emprestimos || [])
        .map(e => e.data_emprestimo ? new Date(e.data_emprestimo + 'T00:00:00').getFullYear() : null)
        .filter(Boolean)
      )].sort((a, b) => b - a);
      setAnosDisponiveis(anos);

      calcularStatsComDados(brutos, filtroAno);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const calcularStats = () => {
    if (dadosBrutos) calcularStatsComDados(dadosBrutos, filtroAno);
  };

  const calcularStatsComDados = (brutos, ano) => {
    const { equips, beneficiarios, emprestimos, hoje } = brutos;

    // Filtrar empréstimos pelo ano selecionado
    const empFiltrados = ano === 'todos'
      ? emprestimos
      : emprestimos.filter(e => {
          if (!e.data_emprestimo) return false;
          return new Date(e.data_emprestimo + 'T00:00:00').getFullYear() === ano;
        });

    // Para ativos/vencidos: sempre considerar TODOS os ativos (independente do ano),
    // pois um empréstimo de 2024 ainda ativo deve aparecer
    const todosAtivos = emprestimos.filter(e => e.status === 'ativo');

    const ativosNoFiltro    = empFiltrados.filter(e => e.status === 'ativo');
    const devolvidosNoFiltro = empFiltrados.filter(e => e.status === 'devolvido');

    const vencidosTodos = todosAtivos.filter(e => {
      if (!e.data_devolucao_prevista) return false;
      return new Date(e.data_devolucao_prevista + 'T00:00:00') < hoje;
    });

    // Ativos de outros anos (só aparece quando filtro de ano específico)
    const ativosOutrosAnos = ano !== 'todos'
      ? todosAtivos.filter(e => {
          if (!e.data_emprestimo) return false;
          return new Date(e.data_emprestimo + 'T00:00:00').getFullYear() !== ano;
        })
      : [];

    const vencidosOutrosAnos = ativosOutrosAnos.filter(e => {
      if (!e.data_devolucao_prevista) return false;
      return new Date(e.data_devolucao_prevista + 'T00:00:00') < hoje;
    });

    setStats({
      // Equipamentos (sempre totais)
      equip_disponiveis:  equips.filter(e => e.status === 'disponivel').length,
      equip_emprestados:  equips.filter(e => e.status === 'emprestado').length,
      equip_manutencao:   equips.filter(e => e.status === 'manutencao').length,
      equip_descartados:  equips.filter(e => e.status === 'descartado').length,
      total_beneficiarios: beneficiarios.length,
      // Empréstimos filtrados pelo ano
      emp_ativos:          ativosNoFiltro.length,
      emp_devolvidos:      devolvidosNoFiltro.length,
      emp_total:           empFiltrados.length,
      // Vencidos: sempre todos os ativos vencidos (qualquer ano)
      emp_vencidos:        vencidosTodos.length,
      // Outros anos (só quando filtro de ano específico)
      ativos_outros_anos:  ativosOutrosAnos.length,
      vencidos_outros_anos: vencidosOutrosAnos.length,
      filtroAtivo:         ano,
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--color-accent)' }}></div>
      </div>
    );
  }

  const s = stats || {};
  const temFiltroAno = filtroAno !== 'todos';
  const labelFiltro  = temFiltroAno ? `Ano ${filtroAno}` : 'Todos os anos';

  return (
    <div className="space-y-6" style={{ background: 'var(--color-bg)', minHeight: '100vh', padding: '0.5rem', overflowX: 'hidden' }}>

      {/* HEADER */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>♿ Controle de Comodatos</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Gestão de Empréstimos de Equipamentos de Assistência
            </p>
          </div>
          <div className="text-5xl" style={{ opacity: 0.3 }}>🦽</div>
        </div>
      </div>

      {/* NAVEGAÇÃO */}
      <div className="card p-2">
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'dashboard',     label: '📊 Dashboard'    },
            { key: 'equipamentos',  label: '🛠️ Equipamentos'  },
            { key: 'beneficiarios', label: '👥 Beneficiários' },
            { key: 'emprestimos',   label: '📋 Empréstimos'   },
          ].map(tab => (
            <button key={tab.key} onClick={() => setView(tab.key)}
              style={view === tab.key ? {
                background: 'var(--color-accent)', color: 'white', border: 'none',
                borderRadius: '0.5rem', padding: '0.75rem 1.5rem', fontWeight: '700', cursor: 'pointer',
                boxShadow: '0 4px 6px rgba(0,0,0,0.15)'
              } : {
                background: 'var(--color-surface-3)', color: 'var(--color-text)',
                border: '1px solid var(--color-border)', borderRadius: '0.5rem',
                padding: '0.75rem 1.5rem', fontWeight: '600', cursor: 'pointer'
              }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* DASHBOARD */}
      {view === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Filtro de ano */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Filtrar por ano:
            </span>
            <button onClick={() => setFiltroAno('todos')}
              style={{ padding: '0.35rem 0.9rem', borderRadius: '0.5rem', fontWeight: '600', fontSize: '0.82rem', cursor: 'pointer', border: filtroAno === 'todos' ? 'none' : '1px solid var(--color-border)', background: filtroAno === 'todos' ? 'var(--color-accent)' : 'var(--color-surface-2)', color: filtroAno === 'todos' ? '#fff' : 'var(--color-text)' }}>
              Todos
            </button>
            {anosDisponiveis.map(a => (
              <button key={a} onClick={() => setFiltroAno(a)}
                style={{ padding: '0.35rem 0.9rem', borderRadius: '0.5rem', fontWeight: '600', fontSize: '0.82rem', cursor: 'pointer', border: filtroAno === a ? 'none' : '1px solid var(--color-border)', background: filtroAno === a ? 'var(--color-accent)' : 'var(--color-surface-2)', color: filtroAno === a ? '#fff' : 'var(--color-text)' }}>
                {a}
              </button>
            ))}
          </div>

          {/* ── Seção: Equipamentos (sempre totais) ── */}
          <div>
            <p style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.6rem', letterSpacing: '0.05em' }}>
              🛠️ Equipamentos — totais gerais
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { emoji: '✅', label: 'Disponíveis',  sub: 'Prontos para uso',   val: s.equip_disponiveis, bg: 'var(--color-accent)' },
                { emoji: '🔄', label: 'Emprestados',  sub: 'Em uso atualmente',  val: s.equip_emprestados, bg: 'var(--color-accent)' },
                { emoji: '🔧', label: 'Manutenção',   sub: 'Em reparo',          val: s.equip_manutencao,  bg: '#f59e0b' },
                { emoji: '🗑️', label: 'Descartados',  sub: 'Fora de uso',        val: s.equip_descartados, bg: '#64748b' },
              ].map(c => (
                <DashCard key={c.label} {...c} />
              ))}
            </div>
          </div>

          {/* ── Seção: Empréstimos filtrados ── */}
          <div>
            <p style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.6rem', letterSpacing: '0.05em' }}>
              📋 Empréstimos — {labelFiltro}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { emoji: '📋', label: 'Total',       sub: `Empréstimos em ${labelFiltro}`, val: s.emp_total,     bg: 'var(--color-accent)' },
                { emoji: '🔵', label: 'Ativos',      sub: 'Em andamento',                  val: s.emp_ativos,    bg: '#3b82f6' },
                { emoji: '✔️', label: 'Devolvidos',  sub: 'Finalizados',                   val: s.emp_devolvidos,bg: '#10b981' },
                { emoji: '👥', label: 'Beneficiários',sub: 'Total cadastrado',              val: s.total_beneficiarios, bg: 'var(--color-accent)' },
              ].map(c => (
                <DashCard key={c.label} {...c} />
              ))}
            </div>
          </div>

          {/* ── Seção: Atenção — vencidos (sempre todos os ativos) ── */}
          <div>
            <p style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.6rem', letterSpacing: '0.05em' }}>
              ⚠️ Atenção — todos os ativos vencidos (qualquer ano)
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <DashCard emoji="⚠️" label="Vencidos" sub="Prazo expirado — precisam devolução"
                val={s.emp_vencidos}
                bg={s.emp_vencidos > 0 ? '#ef4444' : '#10b981'}
                pulse={s.emp_vencidos > 0} />

              {/* Ativos de outros anos (só quando filtro de ano ativo) */}
              {temFiltroAno && (
                <>
                  <DashCard emoji="📅" label="Ativos outros anos" sub={`Emprestados antes de ${filtroAno}`}
                    val={s.ativos_outros_anos}
                    bg={s.ativos_outros_anos > 0 ? '#f59e0b' : '#10b981'} />
                  <DashCard emoji="🔴" label="Vencidos outros anos" sub={`Prazo expirado antes de ${filtroAno}`}
                    val={s.vencidos_outros_anos}
                    bg={s.vencidos_outros_anos > 0 ? '#ef4444' : '#10b981'} />
                </>
              )}
            </div>
          </div>

        </div>
      )}

      {view === 'equipamentos'  && <GestaoEquipamentos  showSuccess={showSuccess} showError={showError} permissoes={permissoes} />}
      {view === 'beneficiarios' && <GestaoBeneficiarios showSuccess={showSuccess} showError={showError} permissoes={permissoes} />}
      {view === 'emprestimos'   && <GestaoEmprestimos   showSuccess={showSuccess} showError={showError} permissoes={permissoes} />}
    </div>
  );
}

function DashCard({ emoji, label, sub, val, bg, pulse }) {
  return (
    <div className="rounded-xl shadow-lg p-5 text-white"
      style={{ background: bg, transition: 'transform 0.2s ease', cursor: 'default', position: 'relative', overflow: 'hidden' }}
      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.04)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
      {pulse && (
        <span style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', width: '10px', height: '10px',
          background: '#fff', borderRadius: '50%', opacity: 0.85,
          boxShadow: '0 0 0 0 rgba(255,255,255,0.6)', animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite' }} />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '2.5rem', lineHeight: 1 }}>{emoji}</span>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: '600', opacity: 0.85 }}>{label}</p>
          <p style={{ margin: 0, fontSize: '2.5rem', fontWeight: '800', lineHeight: 1.1 }}>{val ?? 0}</p>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.85 }}>{sub}</p>
    </div>
  );
}
