import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const CLASSIFICACOES = ['Econômica', 'Especial', 'Magna', 'Extraordinária'];
const COR_CLASS = {
  'Econômica': ['rgba(16,185,129,0.14)', '#10b981', 'rgba(16,185,129,0.35)'],
  'Especial': ['rgba(139,92,246,0.14)', '#8b5cf6', 'rgba(139,92,246,0.35)'],
  'Magna': ['rgba(245,158,11,0.14)', '#f59e0b', 'rgba(245,158,11,0.35)'],
  'Extraordinária': ['rgba(239,68,68,0.14)', '#ef4444', 'rgba(239,68,68,0.35)'],
};
const corClass = (n) => COR_CLASS[n] || ['var(--color-surface-2)', 'var(--color-text-muted)', 'var(--color-border)'];
const corPct = (p) => (p >= 70 ? '#10b981' : p >= 50 ? '#f59e0b' : '#ef4444');
const fmtBR = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');

const paginar = async (montar) => {
  let todos = [], de = 0;
  while (true) {
    const { data, error } = await montar().range(de, de + 999);
    if (error) throw error;
    todos = todos.concat(data || []);
    if (!data || data.length < 1000) break;
    de += 1000;
  }
  return todos;
};

const pilula = (bg, cor, borda) => ({ display: 'inline-flex', alignItems: 'center', padding: '0.15rem 0.6rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, background: bg, color: cor, border: `1px solid ${borda}`, whiteSpace: 'nowrap' });
const filtroSel = { height: '2.1rem', padding: '0 0.6rem', background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem' };
const btnIcone = (cor) => ({ width: 34, height: 34, borderRadius: 8, border: `1px solid ${cor}55`, background: `${cor}1f`, color: cor, cursor: 'pointer', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' });

// "Sessões Realizadas" — mesma ideia da ListaSessoes da Loja: sessões do ano
// agrupadas por mês (recolhíveis), com presença, visitantes e ações numa linha só.
export default function ListaSessoesArcoReal({ podeEditar, onVisualizar, onEditarPresenca, onNovaSessao, showSuccess, showError }) {
  const [loading, setLoading] = useState(true);
  const [sessoes, setSessoes] = useState([]);
  const [stats, setStats] = useState({});      // { sessaoId: { total, pres, just, injust, lic } }
  const [visitantes, setVisitantes] = useState({});
  const [anos, setAnos] = useState([new Date().getFullYear()]);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [classFiltro, setClassFiltro] = useState('');
  const [fechados, setFechados] = useState({}); // meses recolhidos
  const [excluindo, setExcluindo] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('arco_real_sessoes').select('data_sessao');
      const lista = [...new Set([...(data || []).map(s => new Date(s.data_sessao + 'T00:00:00').getFullYear()), new Date().getFullYear()])].sort((a, b) => b - a);
      setAnos(lista);
      if (!lista.includes(ano)) setAno(lista[0]);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { carregar(); }, [ano]); // eslint-disable-line react-hooks/exhaustive-deps

  const carregar = async () => {
    setLoading(true);
    try {
      const { data: ss, error } = await supabase.from('arco_real_sessoes').select('*')
        .gte('data_sessao', `${ano}-01-01`).lte('data_sessao', `${ano}-12-31`).order('data_sessao', { ascending: false });
      if (error) throw error;
      setSessoes(ss || []);
      const ids = (ss || []).map(s => s.id);
      const st = {}, vis = {};
      if (ids.length) {
        const [{ data: membros }, regs, vs] = await Promise.all([
          supabase.from('arco_real_membros').select('id, situacao'),
          paginar(() => supabase.from('arco_real_registros_presenca').select('sessao_id, membro_id, presente, justificativa').in('sessao_id', ids)),
          paginar(() => supabase.from('arco_real_visitantes_sessao').select('id, sessao_id').in('sessao_id', ids)),
        ]);
        const sit = new Map((membros || []).map(m => [m.id, m.situacao]));
        regs.forEach(r => {
          const x = st[r.sessao_id] || (st[r.sessao_id] = { total: 0, pres: 0, just: 0, injust: 0, lic: 0 });
          x.total++;
          if (r.presente) x.pres++;
          else if (sit.get(r.membro_id) === 'licenciado') x.lic++;
          else if (r.justificativa) x.just++;
          else x.injust++;
        });
        vs.forEach(v => { vis[v.sessao_id] = (vis[v.sessao_id] || 0) + 1; });
      }
      setStats(st); setVisitantes(vis);
    } catch (e) {
      console.error(e);
      showError?.('Erro ao carregar sessões.');
    } finally {
      setLoading(false);
    }
  };

  const filtradas = useMemo(() => sessoes.filter(s => !classFiltro || (classFiltro === '__sem' ? !s.classificacao : s.classificacao === classFiltro)), [sessoes, classFiltro]);
  const grupos = useMemo(() => {
    const g = [];
    filtradas.forEach(s => {
      const chave = s.data_sessao.slice(0, 7);
      const ult = g[g.length - 1];
      if (ult && ult.chave === chave) ult.itens.push(s); else g.push({ chave, mes: parseInt(chave.slice(5), 10), itens: [s] });
    });
    return g;
  }, [filtradas]);

  const pctSessao = (id) => { const x = stats[id]; return x && x.total > 0 ? Math.round((x.pres / x.total) * 100) : null; };
  const mediaGrupo = (itens) => {
    const ps = itens.map(s => pctSessao(s.id)).filter(p => p !== null);
    return ps.length ? Math.round(ps.reduce((a, b) => a + b, 0) / ps.length) : null;
  };

  const excluir = async () => {
    const alvo = excluindo; setExcluindo(null);
    try {
      const { error } = await supabase.from('arco_real_sessoes').delete().eq('id', alvo.id).select();
      if (error) throw error;
      showSuccess?.('Sessão excluída com sucesso!');
      carregar();
    } catch { showError?.('Erro ao excluir sessão.'); }
  };

  const totalAno = sessoes.length;
  const pctAno = (() => { const ps = sessoes.map(s => pctSessao(s.id)).filter(p => p !== null); return ps.length ? Math.round(ps.reduce((a, b) => a + b, 0) / ps.length) : null; })();

  return (
    <div style={{ padding: '1.5rem', maxWidth: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>📑 Sessões Realizadas</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: '0.2rem 0 0' }}>{totalAno} sessão(ões) em {ano}{pctAno !== null ? ` · presença média ${pctAno}%` : ''}</p>
        </div>
        {podeEditar && onNovaSessao && (
          <button onClick={onNovaSessao} style={{ height: '2.5rem', padding: '0 1.1rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, cursor: 'pointer' }}>➕ Nova Sessão</button>
        )}
      </div>

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 1.25rem', background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
          <select value={ano} onChange={e => setAno(Number(e.target.value))} style={filtroSel} aria-label="Ano">{anos.map(a => <option key={a} value={a}>{a}</option>)}</select>
          <select value={classFiltro} onChange={e => setClassFiltro(e.target.value)} style={filtroSel} aria-label="Classificação">
            <option value="">Todas as classificações</option>
            {CLASSIFICACOES.map(c => <option key={c} value={c}>{c}</option>)}
            <option value="__sem">Sem classificação</option>
          </select>
          {grupos.length > 0 && (
            <button onClick={() => setFechados(grupos.every(g => fechados[g.chave]) ? {} : Object.fromEntries(grupos.map(g => [g.chave, true])))} style={{ background: 'none', border: 'none', color: 'var(--color-accent)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
              {grupos.every(g => fechados[g.chave]) ? 'Expandir todos' : 'Recolher todos'}
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Carregando...</div>
        ) : grupos.length === 0 ? (
          <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            <p style={{ fontSize: '2rem', margin: '0 0 0.5rem' }}>📭</p>Nenhuma sessão em {ano}.
          </div>
        ) : grupos.map(g => {
          const aberto = !fechados[g.chave];
          const media = mediaGrupo(g.itens);
          return (
            <div key={g.chave}>
              <button onClick={() => setFechados(f => ({ ...f, [g.chave]: aberto }))} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 1.25rem', background: 'var(--color-bg)', border: 'none', borderBottom: '1px solid var(--color-border)', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ color: 'var(--color-accent)', fontSize: '0.8rem' }}>{aberto ? '▼' : '▶'}</span>
                <span style={{ fontWeight: 800, color: 'var(--color-text)', fontSize: '0.95rem' }}>📅 {MESES[g.mes - 1]} de {g.chave.slice(0, 4)}</span>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem' }}>
                  <span style={pilula('var(--color-surface-2)', 'var(--color-text-muted)', 'var(--color-border)')}>{g.itens.length} {g.itens.length === 1 ? 'sessão' : 'sessões'}</span>
                  {media !== null && <span style={pilula(`${corPct(media)}22`, corPct(media), `${corPct(media)}55`)}>presença média {media}%</span>}
                </span>
              </button>

              {aberto && g.itens.map(s => {
                const x = stats[s.id];
                const p = pctSessao(s.id);
                const [bg, cor, bd] = corClass(s.classificacao);
                const futura = s.data_sessao > new Date().toISOString().slice(0, 10);
                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--color-border)' }}>
                    <div style={{ width: 96, flexShrink: 0 }}>
                      <div style={{ fontWeight: 800, color: 'var(--color-text)', fontSize: '0.9rem' }}>{fmtBR(s.data_sessao)}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][new Date(s.data_sessao + 'T00:00:00').getDay()]}</div>
                    </div>

                    <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                      {s.classificacao ? <span style={pilula(bg, cor, bd)}>{s.classificacao}</span> : <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Sem classificação</span>}
                      {s.observacoes && <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '0.3rem 0 0', wordBreak: 'break-word' }}>💬 {s.observacoes}</p>}
                    </div>

                    <div style={{ flex: '0 0 190px', textAlign: 'center' }}>
                      {futura ? <span style={pilula('var(--color-surface-2)', 'var(--color-text-muted)', 'var(--color-border)')}>🗓 Agendada</span>
                        : !x ? <span style={pilula('rgba(245,158,11,0.14)', '#f59e0b', 'rgba(245,158,11,0.35)')}>⚠ Sem registro</span>
                        : (
                          <>
                            <span style={pilula(`${corPct(p)}22`, corPct(p), `${corPct(p)}55`)}>{p}% ({x.pres}/{x.total})</span>
                            <div style={{ height: 5, borderRadius: 999, background: 'var(--color-border)', margin: '0.35rem 0.5rem' }}><div style={{ width: `${p}%`, height: '100%', borderRadius: 999, background: corPct(p) }} /></div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
                              {x.total - x.pres} ausente(s){x.just > 0 && ` · ${x.just} justif.`}{x.lic > 0 && ` · ${x.lic} lic.`}
                            </div>
                          </>
                        )}
                    </div>

                    <div style={{ width: 56, textAlign: 'center', flexShrink: 0 }} title="Visitantes">
                      <span style={pilula('rgba(59,130,246,0.14)', '#3b82f6', 'rgba(59,130,246,0.35)')}>👥 {visitantes[s.id] || 0}</span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                      <button style={btnIcone('#10b981')} title="Visualizar presença" onClick={() => onVisualizar?.(s.id)}>👁️</button>
                      {podeEditar && <button style={btnIcone('#3b82f6')} title="Registrar / editar presença" onClick={() => onEditarPresenca?.(s.id)}>📋</button>}
                      {podeEditar && <button style={btnIcone('#ef4444')} title="Excluir sessão" onClick={() => setExcluindo(s)}>🗑️</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {excluindo && (
        <div onClick={() => setExcluindo(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)', borderTop: '3px solid #ef4444', width: '100%', maxWidth: 420, padding: '1.4rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)' }}>🗑️ Excluir sessão?</h3>
            <p style={{ margin: '0.75rem 0 0', fontSize: '0.9rem', color: 'var(--color-text)' }}><strong>{fmtBR(excluindo.data_sessao)}</strong>{excluindo.classificacao ? ` · ${excluindo.classificacao}` : ''}</p>
            {stats[excluindo.id]?.total > 0 && (
              <div style={{ marginTop: '0.75rem', padding: '0.65rem 0.8rem', borderRadius: 'var(--radius-md)', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', fontSize: '0.8rem', color: 'var(--color-text)' }}>
                ⚠️ Esta sessão tem <strong>{stats[excluindo.id].total} registros de presença</strong>. A exclusão pode apagá-los junto e afeta os relatórios.
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.65rem', marginTop: '1.25rem' }}>
              <button onClick={() => setExcluindo(null)} style={{ flex: 1, height: '2.6rem', background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={excluir} style={{ flex: 1, height: '2.6rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 700, cursor: 'pointer' }}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
