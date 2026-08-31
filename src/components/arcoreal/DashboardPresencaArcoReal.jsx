import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import ModalSessaoArcoReal from './ModalSessaoArcoReal';
import ModalVisualizarPresencaArcoReal from './ModalVisualizarPresencaArcoReal';
import ModalGradePresencaArcoReal from './ModalGradePresencaArcoReal';

const corClassificacao = (nome) => {
  const map = {
    'Econômica':      ['rgba(16,185,129,0.12)', '#10b981', 'rgba(16,185,129,0.3)'],
    'Especial':       ['rgba(139,92,246,0.12)', '#8b5cf6', 'rgba(139,92,246,0.3)'],
    'Magna':          ['rgba(245,158,11,0.12)', '#f59e0b', 'rgba(245,158,11,0.3)'],
    'Extraordinária': ['rgba(239,68,68,0.12)', '#ef4444', 'rgba(239,68,68,0.3)'],
  };
  return map[nome] || ['var(--color-surface-2)', 'var(--color-text-muted)', 'var(--color-border)'];
};

const corPercentual = (p) => p >= 70 ? '#10b981' : p >= 50 ? '#f59e0b' : '#ef4444';

const boxCard = { background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1rem' };

// Componente próprio do módulo Arco Real — hub central de Presença, no mesmo
// espírito do DashboardPresenca.jsx da Loja: números/percentuais no topo,
// botão de cadastrar sessão, acesso à tela de registro e ao modal de grade.
export default function DashboardPresencaArcoReal({ onAbrirPresenca, showSuccess, showError }) {
  const [loading, setLoading] = useState(true);
  const [sessoes, setSessoes] = useState([]);
  const [totalMembrosElegiveis, setTotalMembrosElegiveis] = useState(0);
  const [contagens, setContagens] = useState({}); // { sessaoId: { total, presentes } }
  const [anosDisponiveis, setAnosDisponiveis] = useState([new Date().getFullYear()]);
  const [anoFiltro, setAnoFiltro] = useState(new Date().getFullYear());

  const [modalSessaoAberto, setModalSessaoAberto] = useState(false);
  const [sessaoEditando, setSessaoEditando] = useState(null);
  const [sessaoVisualizando, setSessaoVisualizando] = useState(null);
  const [gradeAberta, setGradeAberta] = useState(false);
  const [confirmExcluir, setConfirmExcluir] = useState(null);

  useEffect(() => { buscarAnos(); }, []);
  useEffect(() => { if (anosDisponiveis.length > 0) carregar(); }, [anoFiltro, anosDisponiveis]);

  const buscarAnos = async () => {
    const { data } = await supabase.from('arco_real_sessoes').select('data_sessao');
    const anosEncontrados = (data || []).map(s => new Date(s.data_sessao + 'T00:00:00').getFullYear());
    const anosFinal = [...new Set([...anosEncontrados, new Date().getFullYear()])].sort((a, b) => b - a);
    setAnosDisponiveis(anosFinal);
    if (!anosFinal.includes(anoFiltro)) setAnoFiltro(anosFinal[0]);
  };

  const carregar = async () => {
    setLoading(true);
    try {
      const { data: sessoesData, error: sessoesError } = await supabase
        .from('arco_real_sessoes')
        .select('*')
        .gte('data_sessao', `${anoFiltro}-01-01`)
        .lte('data_sessao', `${anoFiltro}-12-31`)
        .order('data_sessao', { ascending: false });
      if (sessoesError) throw sessoesError;
      setSessoes(sessoesData || []);

      const { count: membrosCount } = await supabase
        .from('arco_real_membros')
        .select('id', { count: 'exact', head: true })
        .eq('ativo', true)
        .in('situacao', ['regular', 'licenciado']);
      setTotalMembrosElegiveis(membrosCount || 0);

      const sessaoIds = (sessoesData || []).map(s => s.id);
      const contagemObj = {};
      if (sessaoIds.length > 0) {
        const { data: registros } = await supabase
          .from('arco_real_registros_presenca')
          .select('sessao_id, presente')
          .in('sessao_id', sessaoIds);
        sessaoIds.forEach(id => { contagemObj[id] = { total: 0, presentes: 0 }; });
        (registros || []).forEach(r => {
          if (!contagemObj[r.sessao_id]) contagemObj[r.sessao_id] = { total: 0, presentes: 0 };
          contagemObj[r.sessao_id].total += 1;
          if (r.presente) contagemObj[r.sessao_id].presentes += 1;
        });
      }
      setContagens(contagemObj);
    } catch (e) {
      console.error('Erro ao carregar dashboard de presença do Arco Real:', e);
      showError?.('Erro ao carregar dados de presença.');
    } finally {
      setLoading(false);
    }
  };

  const excluirSessao = async (id) => {
    try {
      const { error } = await supabase.from('arco_real_sessoes').delete().eq('id', id).select();
      if (error) throw error;
      showSuccess?.('Sessão excluída com sucesso!');
      setConfirmExcluir(null);
      carregar();
    } catch (e) {
      showError?.('Erro ao excluir sessão.');
    }
  };

  // ── Estatísticas gerais do ano filtrado ─────────────────────────────
  const totalSessoes = sessoes.length;
  const totalPresencasRegistradas = Object.values(contagens).reduce((s, c) => s + c.presentes, 0);
  const totalPossivel = Object.values(contagens).reduce((s, c) => s + c.total, 0);
  const percentualMedio = totalPossivel > 0 ? Math.round((totalPresencasRegistradas / totalPossivel) * 100) : 0;

  return (
    <div style={{ padding: '1.5rem', background: 'var(--color-bg)', minHeight: '100vh' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--color-text)', margin: 0 }}>📋 Presença — Arco Real</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: '0.2rem 0 0' }}>
            Capítulo Guardiões da Aliança nº 04
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button onClick={() => setGradeAberta(true)} style={{
            height: '40px', padding: '0 1rem', background: 'var(--color-surface-2)', color: 'var(--color-text)',
            border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontWeight: '700', fontSize: '0.85rem',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
          }}>
            🔲 Ver Grade
          </button>
          <button onClick={() => { setSessaoEditando(null); setModalSessaoAberto(true); }} style={{
            height: '40px', padding: '0 1.1rem', background: 'linear-gradient(135deg,#1e3a5f,#2d6a9f)', color: '#fff',
            border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: '700', fontSize: '0.85rem',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
          }}>
            ➕ Cadastrar Sessão
          </button>
        </div>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" style={{ marginBottom: '1.25rem' }}>
        <div style={{ ...boxCard, borderTop: '3px solid #2d6a9f' }}>
          <p style={{ fontSize: '0.68rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', margin: '0 0 0.3rem' }}>Sessões em {anoFiltro}</p>
          <p style={{ fontSize: '1.7rem', fontWeight: '800', color: 'var(--color-text)', margin: 0 }}>{totalSessoes}</p>
        </div>
        <div style={{ ...boxCard, borderTop: '3px solid #3b82f6' }}>
          <p style={{ fontSize: '0.68rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', margin: '0 0 0.3rem' }}>Membros Elegíveis</p>
          <p style={{ fontSize: '1.7rem', fontWeight: '800', color: 'var(--color-text)', margin: 0 }}>{totalMembrosElegiveis}</p>
        </div>
        <div style={{ ...boxCard, borderTop: '3px solid #10b981' }}>
          <p style={{ fontSize: '0.68rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', margin: '0 0 0.3rem' }}>Presenças Registradas</p>
          <p style={{ fontSize: '1.7rem', fontWeight: '800', color: '#10b981', margin: 0 }}>{totalPresencasRegistradas}</p>
        </div>
        <div style={{ ...boxCard, borderTop: `3px solid ${corPercentual(percentualMedio)}` }}>
          <p style={{ fontSize: '0.68rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', margin: '0 0 0.3rem' }}>% Médio de Presença</p>
          <p style={{ fontSize: '1.7rem', fontWeight: '800', color: corPercentual(percentualMedio), margin: 0 }}>{percentualMedio}%</p>
        </div>
      </div>

      {/* Lista de sessões */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
        {/* Barra de filtro */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1.25rem', background: 'var(--color-surface-2)', borderBottom: '2px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ano</span>
            <select value={anoFiltro} onChange={e => setAnoFiltro(Number(e.target.value))} style={{ padding: '0.25rem 0.65rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer', outline: 'none' }}>
              {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
            {sessoes.length} sessão{sessoes.length !== 1 ? 'ões' : ''} em {anoFiltro}
          </span>
        </div>

        {/* Cabeçalho colunas */}
        <div style={{ display: 'grid', gridTemplateColumns: '100px 130px 1fr 130px 130px auto', gap: '0.75rem', padding: '0.5rem 1.25rem', borderBottom: '1px solid var(--color-border)' }}>
          {['DATA', 'CLASSIFICAÇÃO', 'OBSERVAÇÃO', 'PRESENÇA', '%', 'AÇÕES'].map((h, i) => (
            <div key={h} style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: i === 5 ? 'right' : (i === 3 || i === 4) ? 'center' : 'left' }}>{h}</div>
          ))}
        </div>

        {/* Linhas */}
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Carregando...</div>
        ) : sessoes.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            Nenhuma sessão cadastrada em {anoFiltro}. Clique em "➕ Cadastrar Sessão" para começar.
          </div>
        ) : sessoes.map((s, idx) => {
          const [bgCl, txtCl, bdCl] = corClassificacao(s.classificacao);
          const c = contagens[s.id] || { total: 0, presentes: 0 };
          const pct = c.total > 0 ? Math.round((c.presentes / c.total) * 100) : null;
          return (
            <div key={s.id} style={{
              display: 'grid', gridTemplateColumns: '100px 130px 1fr 130px 130px auto', gap: '0.75rem',
              padding: '0.65rem 1.25rem', alignItems: 'center',
              background: idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)',
              borderBottom: '1px solid var(--color-border)',
            }}>
              <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--color-text)' }}>
                {new Date(s.data_sessao + 'T00:00:00').toLocaleDateString('pt-BR')}
              </div>
              <div>
                {s.classificacao ? (
                  <span style={{ fontSize: '0.72rem', fontWeight: '700', padding: '0.15rem 0.5rem', borderRadius: '999px', background: bgCl, color: txtCl, border: `1px solid ${bdCl}` }}>
                    {s.classificacao}
                  </span>
                ) : <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>—</span>}
              </div>
              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                {s.observacoes ? (
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={s.observacoes}>💬 {s.observacoes}</p>
                ) : <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>—</span>}
              </div>
              <div style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--color-text)', fontWeight: '700' }}>
                {pct === null ? '—' : `${c.presentes}/${c.total}`}
              </div>
              <div style={{ textAlign: 'center' }}>
                {pct === null ? (
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Sem registro</span>
                ) : (
                  <span style={{ fontSize: '0.78rem', fontWeight: '800', color: corPercentual(pct) }}>{pct}%</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                <button onClick={() => onAbrirPresenca(s.id)} title="Registrar Presença" style={{ padding: '0.25rem 0.55rem', background: 'rgba(45,106,159,0.15)', color: '#2d6a9f', border: '1px solid rgba(45,106,159,0.4)', borderRadius: 'var(--radius-md)', fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer' }}>
                  📋
                </button>
                <button onClick={() => setSessaoVisualizando(s.id)} title="Visualizar" style={{ padding: '0.25rem 0.55rem', background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 'var(--radius-md)', fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer' }}>
                  👁️
                </button>
                <button onClick={() => { setSessaoEditando(s); setModalSessaoAberto(true); }} title="Editar Sessão" style={{ padding: '0.25rem 0.55rem', background: 'rgba(99,102,241,0.12)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 'var(--radius-md)', fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer' }}>
                  ✏️
                </button>
                <button onClick={() => setConfirmExcluir(s)} title="Excluir" style={{ padding: '0.25rem 0.55rem', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer' }}>
                  🗑
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL — Criar/Editar Sessão */}
      {modalSessaoAberto && (
        <ModalSessaoArcoReal
          sessaoEditando={sessaoEditando}
          showSuccess={showSuccess}
          showError={showError}
          onFechar={() => { setModalSessaoAberto(false); setSessaoEditando(null); }}
          onSalvo={() => { setModalSessaoAberto(false); setSessaoEditando(null); buscarAnos(); carregar(); }}
        />
      )}

      {/* MODAL — Visualizar Presença */}
      {sessaoVisualizando !== null && (
        <ModalVisualizarPresencaArcoReal
          sessaoId={sessaoVisualizando}
          onFechar={() => setSessaoVisualizando(null)}
          onEditar={(id) => { setSessaoVisualizando(null); onAbrirPresenca(id); }}
        />
      )}

      {/* MODAL — Grade de Presença */}
      {gradeAberta && (
        <ModalGradePresencaArcoReal onFechar={() => setGradeAberta(false)} />
      )}

      {/* Confirmar exclusão */}
      {confirmExcluir && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1rem' }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.5rem', maxWidth: '400px', width: '100%' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.5rem' }}>Excluir sessão?</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
              {new Date(confirmExcluir.data_sessao + 'T00:00:00').toLocaleDateString('pt-BR')}
              <span style={{ display: 'block', marginTop: '0.5rem', color: '#f59e0b', fontWeight: 600 }}>
                ⚠️ Isso também excluirá os registros de presença associados a esta sessão.
              </span>
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmExcluir(null)} style={{ padding: '0.55rem 1.1rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={() => excluirSessao(confirmExcluir.id)} style={{ padding: '0.55rem 1.25rem', borderRadius: 'var(--radius-md)', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', fontWeight: 600, cursor: 'pointer' }}>
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
