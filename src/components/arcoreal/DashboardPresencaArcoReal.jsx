import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import ModalGradePresencaArcoReal from './ModalGradePresencaArcoReal';
import { situacaoNaData } from '../../utils/elegibilidadeArcoReal';
import { buscarPeriodosSituacao, periodoCobre, calcularPresencaMembro, nomeCurto, fmtData, SITUACOES_ARCO_REAL } from '../../utils/arcoRealMembros';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
} from 'recharts';

// Dashboard de Presença do Arco Real — mesma estrutura do DashboardPresenca da
// Loja, sem graus: cabeçalho com período, indicadores, gráficos, sessões
// recentes, presença 100%, ausências e licenciados. Relatórios ficam de fora.

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MESES_ABREV = MESES.map(m => m.slice(0, 3));
const fmtDataBR = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');
const corPorPct = (v) => (v >= 75 ? '#10b981' : v >= 50 ? '#f59e0b' : '#ef4444');
const COR_CLASSIFICACAO = { 'Econômica': '#10b981', 'Especial': '#8b5cf6', 'Magna': '#f59e0b', 'Extraordinária': '#ef4444' };
const pad = (n) => String(n).padStart(2, '0');
const ultimoDia = (ano, mes) => new Date(ano, mes, 0).getDate();

const tooltipEstilo = {
  contentStyle: { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, color: 'var(--color-text)', fontSize: 12 },
  labelStyle: { color: 'var(--color-text)', fontWeight: 700 },
  itemStyle: { color: 'var(--color-text)' },
};

const KpiCard = ({ cor, rotulo, valor, sub, barra, chips = [] }) => (
  <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderTop: `3px solid ${cor}`, borderRadius: 'var(--radius-xl)', padding: '1rem 1.1rem', minWidth: 0 }}>
    <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{rotulo}</p>
    <p style={{ margin: '0.25rem 0 0', fontSize: '2rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.1 }}>{valor}</p>
    {sub && <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{sub}</p>}
    {barra != null && (
      <div style={{ height: 6, borderRadius: 999, background: 'var(--color-border)', marginTop: '0.6rem', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, barra)}%`, height: '100%', background: corPorPct(barra) }} />
      </div>
    )}
    {chips.length > 0 && (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.6rem' }}>
        {chips.map(c => (
          <span key={c.rotulo} style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.55rem', borderRadius: 999, background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
            {c.rotulo}: <strong style={{ color: 'var(--color-text)' }}>{c.valor}</strong>
          </span>
        ))}
      </div>
    )}
  </div>
);

const cartaoGrafico = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1rem 1.1rem', minWidth: 0 };
const tituloGrafico = { margin: '0 0 0.75rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' };
const selEstilo = { background: 'var(--color-bg)', color: 'var(--color-text)', padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-md)', fontWeight: 600, border: '1px solid var(--color-border)', cursor: 'pointer' };

const GraficoPizza = ({ titulo, dados }) => {
  const total = dados.reduce((acc, d) => acc + d.valor, 0);
  return (
    <div style={cartaoGrafico}>
      <p style={tituloGrafico}>{titulo}</p>
      {total === 0 ? (
        <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '2rem 0', margin: 0 }}>Sem sessões no período</p>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: 170, height: 170, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dados} dataKey="valor" nameKey="nome" innerRadius={52} outerRadius={80} paddingAngle={2} stroke="none">
                  {dados.map(d => <Cell key={d.nome} fill={d.cor} />)}
                </Pie>
                <Tooltip {...tooltipEstilo} formatter={(v, n) => [`${v} sessão(ões)`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1 }}>{total}</span>
              <span style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>sessões</span>
            </div>
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1, minWidth: 120 }}>
            {dados.map(d => (
              <li key={d.nome} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--color-text)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: d.cor, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{d.nome}</span>
                <strong>{d.valor}</strong>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem', minWidth: '2.4rem', textAlign: 'right' }}>{Math.round((d.valor / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const GraficoPresencaMensal = ({ dados }) => (
  <div style={cartaoGrafico}>
    <p style={tituloGrafico}>Presença por mês (%)</p>
    {dados.length === 0 ? (
      <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '2rem 0', margin: 0 }}>Sem registros no período</p>
    ) : (
      <div style={{ width: '100%', height: 190 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} margin={{ top: 18, right: 6, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="mes" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip {...tooltipEstilo} cursor={{ fill: 'rgba(148,163,184,0.12)' }} formatter={(v, n, item) => [`${v}% (${item.payload.presentes}/${item.payload.total})`, 'Presença']} />
            <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
              {dados.map(d => <Cell key={d.chave} fill={corPorPct(d.pct)} />)}
              <LabelList dataKey="pct" position="top" formatter={(v) => `${v}%`} style={{ fill: 'var(--color-text)', fontSize: 10, fontWeight: 700 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    )}
  </div>
);

const Quadro = ({ cor, icone, titulo, direita, children }) => (
  <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
    <div style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', borderTop: `3px solid ${cor}`, borderBottom: '1px solid var(--color-border)', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
      <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}><span>{icone}</span>{titulo}</h3>
      {direita}
    </div>
    <div style={{ padding: '1rem', maxHeight: 384, overflowY: 'auto' }}>{children}</div>
  </div>
);

const Vazio = ({ children }) => <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '2rem 0', margin: 0 }}>{children}</p>;

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

export default function DashboardPresencaArcoReal({ onCadastrarSessao, showError }) {
  const hoje = new Date();
  const hojeISO = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-${pad(hoje.getDate())}`;

  const [anos, setAnos] = useState([hoje.getFullYear()]);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [periodo, setPeriodo] = useState('ano');
  const [carregando, setCarregando] = useState(true);
  const [sessoes, setSessoes] = useState([]);       // sessões do ano
  const [registros, setRegistros] = useState([]);   // registros das sessões do ano
  const [visitantes, setVisitantes] = useState({}); // { sessaoId: n }
  const [membros, setMembros] = useState([]);
  const [periodos, setPeriodos] = useState([]);
  const [qtdRecentes, setQtdRecentes] = useState(4);
  const [percentualAlerta, setPercentualAlerta] = useState(30);
  const [mesAusencias, setMesAusencias] = useState(0);
  const [mostrarGrade, setMostrarGrade] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('arco_real_sessoes').select('data_sessao');
      const lista = [...new Set((data || []).map(s => parseInt(String(s.data_sessao).slice(0, 4), 10)))].filter(Boolean).sort((a, b) => b - a);
      if (lista.length) { setAnos(lista); setAno(lista[0]); }
    })();
  }, []);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      setCarregando(true);
      try {
        const { data: ss, error } = await supabase.from('arco_real_sessoes').select('id, data_sessao, classificacao')
          .gte('data_sessao', `${ano}-01-01`).lte('data_sessao', `${ano}-12-31`).order('data_sessao');
        if (error) throw error;
        const ids = (ss || []).map(s => s.id);
        const [{ data: ms }, ps, regs, vis] = await Promise.all([
          supabase.from('arco_real_membros').select('id, nome, situacao, ativo, data_exaltacao, data_nascimento'),
          buscarPeriodosSituacao(),
          ids.length ? paginar(() => supabase.from('arco_real_registros_presenca').select('sessao_id, membro_id, presente').in('sessao_id', ids)) : Promise.resolve([]),
          ids.length ? paginar(() => supabase.from('arco_real_visitantes_sessao').select('id, sessao_id').in('sessao_id', ids)) : Promise.resolve([]),
        ]);
        if (cancelado) return;
        const v = {}; vis.forEach(x => { v[x.sessao_id] = (v[x.sessao_id] || 0) + 1; });
        setSessoes(ss || []); setRegistros(regs); setVisitantes(v); setMembros(ms || []); setPeriodos(ps);
      } catch (e) {
        console.error(e); showError?.('Erro ao carregar o dashboard de presença.');
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => { cancelado = true; };
  }, [ano]); // eslint-disable-line react-hooks/exhaustive-deps

  // Janela do período (mês/trimestre/semestre terminam no mês de referência)
  const [dataInicio, dataFim] = useMemo(() => {
    if (periodo === 'ano') return [`${ano}-01-01`, `${ano}-12-31`];
    const mesRef = ano === hoje.getFullYear() ? hoje.getMonth() + 1 : 12;
    const n = periodo === 'mes' ? 1 : periodo === 'trimestre' ? 3 : 6;
    const ini = Math.max(1, mesRef - n + 1);
    return [`${ano}-${pad(ini)}-01`, `${ano}-${pad(mesRef)}-${ultimoDia(ano, mesRef)}`];
  }, [periodo, ano]); // eslint-disable-line react-hooks/exhaustive-deps

  const elegiveisBase = useMemo(() => membros.filter(m => m.ativo !== false && (m.situacao === 'regular' || m.situacao === 'licenciado')), [membros]);
  // Base dos cálculos: inclui quem saiu depois (a elegibilidade é avaliada pela data de cada sessão)
  const baseCalculo = useMemo(() => membros.filter(m => m.ativo !== false), [membros]);
  const mapaPresenca = useMemo(() => {
    const m = new Map();
    registros.forEach(r => m.set(`${r.membro_id}|${r.sessao_id}`, !!r.presente));
    return m;
  }, [registros]);
  const comRegistro = useMemo(() => new Set(registros.map(r => r.sessao_id)), [registros]);

  // Elegíveis / presentes de uma sessão (mesma regra da Matrix: exaltado até a data e sem licença cobrindo)
  const statsSessao = (s) => {
    let elegiveis = 0, presentes = 0;
    baseCalculo.forEach(m => {
      if (!situacaoNaData(m, periodos, s.data_sessao).conta) return;
      elegiveis += 1;
      if (mapaPresenca.get(`${m.id}|${s.id}`)) presentes += 1;
    });
    return { elegiveis, presentes, ausentes: elegiveis - presentes };
  };

  const sessoesJanela = useMemo(() => sessoes.filter(s => s.data_sessao >= dataInicio && s.data_sessao <= dataFim && s.data_sessao <= hojeISO), [sessoes, dataInicio, dataFim, hojeISO]);
  const janelaComReg = useMemo(() => sessoesJanela.filter(s => comRegistro.has(s.id)), [sessoesJanela, comRegistro]);

  const resumoMembros = (lista) => baseCalculo.map(m => ({ ...m, ...calcularPresencaMembro(m, lista, mapaPresenca, periodos) })).filter(r => r.elegiveis > 0);

  const mediaPresenca = useMemo(() => {
    const r = resumoMembros(janelaComReg);
    return r.length ? Math.round(r.reduce((a, x) => a + x.pct, 0) / r.length) : 0;
  }, [janelaComReg, baseCalculo, mapaPresenca, periodos]); // eslint-disable-line react-hooks/exhaustive-deps

  const presencaMensal = useMemo(() => {
    const por = {};
    janelaComReg.forEach(s => {
      const k = s.data_sessao.slice(0, 7), st = statsSessao(s);
      const x = por[k] || (por[k] = { presentes: 0, total: 0 });
      x.presentes += st.presentes; x.total += st.elegiveis;
    });
    return Object.keys(por).sort().map(k => ({ chave: k, mes: MESES_ABREV[parseInt(k.slice(5), 10) - 1], pct: por[k].total ? Math.round((por[k].presentes / por[k].total) * 100) : 0, presentes: por[k].presentes, total: por[k].total }));
  }, [janelaComReg, baseCalculo, mapaPresenca, periodos]); // eslint-disable-line react-hooks/exhaustive-deps

  const classificacoes = useMemo(() => {
    const c = {};
    sessoesJanela.forEach(s => { const n = s.classificacao || 'Sem classificação'; c[n] = (c[n] || 0) + 1; });
    return Object.entries(c).map(([nome, valor]) => ({ nome, valor, cor: COR_CLASSIFICACAO[nome] || '#64748b' }));
  }, [sessoesJanela]);

  const recentes = useMemo(() => [...sessoes].filter(s => s.data_sessao <= hojeISO).sort((a, b) => b.data_sessao.localeCompare(a.data_sessao)).slice(0, qtdRecentes)
    .map(s => ({ ...s, ...statsSessao(s), tem: comRegistro.has(s.id) })), [sessoes, qtdRecentes, baseCalculo, mapaPresenca, periodos, comRegistro]); // eslint-disable-line react-hooks/exhaustive-deps

  const anoComReg = useMemo(() => sessoes.filter(s => comRegistro.has(s.id) && s.data_sessao <= hojeISO), [sessoes, comRegistro, hojeISO]);
  const presenca100 = useMemo(() => resumoMembros(anoComReg).filter(r => r.presentes === r.elegiveis).sort((a, b) => b.elegiveis - a.elegiveis), [anoComReg, baseCalculo, mapaPresenca, periodos]); // eslint-disable-line react-hooks/exhaustive-deps
  const ausencias = useMemo(() => {
    const lista = mesAusencias === 0 ? anoComReg : anoComReg.filter(s => parseInt(s.data_sessao.slice(5, 7), 10) === mesAusencias);
    return resumoMembros(lista).map(r => ({ ...r, ausentes: r.elegiveis - r.presentes, pctAus: Math.round(((r.elegiveis - r.presentes) / r.elegiveis) * 100) }))
      .filter(r => r.pctAus >= percentualAlerta && r.ausentes > 0).sort((a, b) => b.pctAus - a.pctAus);
  }, [anoComReg, mesAusencias, percentualAlerta, baseCalculo, mapaPresenca, periodos]); // eslint-disable-line react-hooks/exhaustive-deps

  const licenciados = useMemo(() => membros.filter(m => m.ativo !== false && m.situacao === 'licenciado').map(m => {
    const p = periodos.filter(x => x.membro_id === m.id && periodoCobre(x, hojeISO))[0];
    return { ...m, desde: p?.data_inicio, ate: p?.data_fim };
  }).sort((a, b) => a.nome.localeCompare(b.nome)), [membros, periodos, hojeISO]);

  const stats = useMemo(() => {
    const c = (s) => membros.filter(m => m.situacao === s).length;
    return { total: membros.length, regulares: elegiveisBase.filter(m => m.situacao === 'regular').length, licenciados: elegiveisBase.filter(m => m.situacao === 'licenciado').length, falecidos: c('falecido'), desligados: c('desligado'), excluidos: c('excluido') };
  }, [membros, elegiveisBase]);

  const th = { padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-muted)' };
  const td = { padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--color-text)', textAlign: 'center' };

  return (
    <div style={{ padding: '2rem', background: 'var(--color-bg)', minHeight: '100vh' }}>
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>Dashboard de Presença</h1>
            <p style={{ margin: '0.3rem 0 0', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              📅 <strong style={{ color: 'var(--color-text)' }}>{fmtDataBR(dataInicio)}</strong> até <strong style={{ color: 'var(--color-text)' }}>{fmtDataBR(dataFim)}</strong> · Capítulo Guardiões da Aliança nº 04
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
              {['mes', 'trimestre', 'semestre'].map(p => (
                <button key={p} onClick={() => setPeriodo(p)}
                  style={{ padding: '0.45rem 1rem', borderRadius: 'var(--radius-md)', border: 'none', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', background: periodo === p ? 'var(--color-accent)' : 'transparent', color: periodo === p ? '#fff' : 'var(--color-text)' }}>
                  {p === 'mes' ? 'Mês' : p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
              <select value={ano} onChange={e => { setAno(Number(e.target.value)); setPeriodo('ano'); }}
                style={{ padding: '0.45rem 0.9rem', borderRadius: 'var(--radius-md)', border: 'none', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', background: periodo === 'ano' ? 'var(--color-accent)' : 'transparent', color: periodo === 'ano' ? '#fff' : 'var(--color-text)' }}>
                {anos.map(a => <option key={a} value={a} style={{ color: '#111' }}>{a}</option>)}
              </select>
            </div>
            {onCadastrarSessao && (
              <button onClick={onCadastrarSessao} style={{ padding: '0.6rem 1.1rem', borderRadius: 'var(--radius-lg)', border: 'none', background: 'var(--color-accent)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>➕ Cadastrar Sessão</button>
            )}
            <button onClick={() => setMostrarGrade(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-accent)', background: 'transparent', color: 'var(--color-accent)', fontWeight: 700, cursor: 'pointer' }}>
              <span>📊</span> Matrix Presença
            </button>
          </div>
        </div>
      </div>

      {carregando ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Carregando...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
            <KpiCard cor="var(--color-accent)" rotulo="Sessões" valor={sessoesJanela.length} sub="no período" />
            <KpiCard cor="#f59e0b" rotulo="Média de presença" valor={`${mediaPresenca}%`} barra={mediaPresenca} />
            <KpiCard cor="#6366f1" rotulo="Irmãos ativos" valor={elegiveisBase.length} chips={[{ rotulo: 'Regulares', valor: stats.regulares }, { rotulo: 'Licenciados', valor: stats.licenciados }]} />
            <KpiCard cor="#10b981" rotulo="Quadro de irmãos" valor={stats.total}
              chips={[{ rotulo: 'Ativos', valor: elegiveisBase.length }, ...(stats.falecidos ? [{ rotulo: 'Falecidos', valor: stats.falecidos }] : []), ...(stats.desligados ? [{ rotulo: SITUACOES_ARCO_REAL.desligado.label + 's', valor: stats.desligados }] : []), ...(stats.excluidos ? [{ rotulo: 'Excluídos', valor: stats.excluidos }] : [])]} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-5">
            <GraficoPizza titulo="Sessões por classificação" dados={classificacoes} />
            <GraficoPresencaMensal dados={presencaMensal} />
          </div>

          <div className="card" style={{ overflow: 'hidden', marginBottom: '1.5rem', padding: 0 }}>
            <div style={{ background: 'var(--color-surface-2)', borderTop: '3px solid #3b82f6', borderBottom: '1px solid var(--color-border)', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, color: 'var(--color-text)' }}><span>📅</span>Sessões Recentes</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text)' }}>
                <span style={{ fontSize: '0.875rem' }}>Quantidade:</span>
                <select value={qtdRecentes} onChange={e => setQtdRecentes(Number(e.target.value))} style={selEstilo}>{[4, 6, 8, 10].map(n => <option key={n} value={n}>{n}</option>)}</select>
              </div>
            </div>
            <div className="p-4">
              {recentes.length === 0 ? <Vazio>Nenhuma sessão em {ano}</Vazio> : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead style={{ background: 'var(--color-surface-2)' }}>
                      <tr>
                        <th style={{ ...th, textAlign: 'left' }}>Data</th>
                        <th style={{ ...th, textAlign: 'center' }}>Classificação</th>
                        <th style={{ ...th, textAlign: 'center' }}>Elegíveis</th>
                        <th style={{ ...th, textAlign: 'center' }}>Presenças</th>
                        <th style={{ ...th, textAlign: 'center' }}>Ausências</th>
                        <th style={{ ...th, textAlign: 'center' }}>Visitantes</th>
                        <th style={{ ...th, textAlign: 'center' }}>%</th>
                      </tr>
                    </thead>
                    <tbody style={{ borderTop: '1px solid var(--color-border)' }}>
                      {recentes.map(s => {
                        const pct = s.tem && s.elegiveis ? Math.round((s.presentes / s.elegiveis) * 100) : null;
                        const cor = COR_CLASSIFICACAO[s.classificacao] || '#64748b';
                        return (
                          <tr key={s.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <td style={{ ...td, textAlign: 'left' }}>{fmtDataBR(s.data_sessao)}</td>
                            <td style={td}>{s.classificacao ? <span style={{ padding: '0.15rem 0.6rem', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, background: `${cor}26`, color: cor, border: `1px solid ${cor}55` }}>{s.classificacao}</span> : '—'}</td>
                            <td style={{ ...td, fontWeight: 600 }}>{s.tem ? s.elegiveis : '—'}</td>
                            <td style={{ ...td, fontWeight: 600 }}>{s.tem ? s.presentes : '—'}</td>
                            <td style={{ ...td, fontWeight: 600 }}>{s.tem ? s.ausentes : '—'}</td>
                            <td style={td}><span style={{ padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-sm)', background: 'rgba(99,102,241,0.15)', color: '#6366f1', fontWeight: 700 }}>{visitantes[s.id] || 0}</span></td>
                            <td style={td}>{pct === null ? <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Sem registro</span> : <span style={{ padding: '0.15rem 0.6rem', borderRadius: 999, fontWeight: 700, fontSize: '0.8rem', background: pct >= 80 ? 'rgba(16,185,129,0.15)' : pct >= 60 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)', color: pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444' }}>{pct}%</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Quadro cor="#10b981" icone="🏆" titulo={`Presença 100% - ${presenca100.length} ${presenca100.length === 1 ? 'Irmão' : 'Irmãos'}`}
              direita={<span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>em {ano}</span>}>
              {presenca100.length === 0 ? <Vazio>Nenhum irmão com 100% em {ano}</Vazio> : presenca100.map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', marginBottom: '0.5rem', background: 'rgba(16,185,129,0.1)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>{nomeCurto(r.nome)}</span>
                  <span style={{ background: '#10b981', color: '#fff', padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 600 }}>{r.elegiveis}</span>
                </div>
              ))}
            </Quadro>

            <Quadro cor="#ef4444" icone="⚠️" titulo="Ausências"
              direita={
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', color: 'var(--color-text)' }}>
                  <select value={mesAusencias} onChange={e => setMesAusencias(Number(e.target.value))} style={selEstilo}>
                    <option value={0}>Ano todo</option>
                    {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                  <span style={{ fontSize: '0.875rem' }}>≥</span>
                  <input type="number" min="0" max="100" value={percentualAlerta} onChange={e => setPercentualAlerta(Number(e.target.value))} style={{ ...selEstilo, width: '4rem', textAlign: 'center' }} />
                  <span style={{ fontSize: '0.875rem' }}>%</span>
                </div>
              }>
              {ausencias.length === 0 ? <Vazio>Nenhum irmão com ≥{percentualAlerta}% de ausências no período</Vazio> : ausencias.map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', marginBottom: '0.5rem', background: 'rgba(245,158,11,0.1)', borderRadius: 'var(--radius-md)' }}>
                  <div>
                    <p style={{ fontWeight: 500, color: 'var(--color-text)', margin: 0 }}>{nomeCurto(r.nome)}</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0 }}>{r.ausentes}/{r.elegiveis}</p>
                  </div>
                  <span style={{ background: '#f59e0b', color: '#fff', padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 600 }}>{r.pctAus}%</span>
                </div>
              ))}
            </Quadro>

            <Quadro cor="#6366f1" icone="📋" titulo={`Irmãos Licenciados - ${licenciados.length} ${licenciados.length === 1 ? 'Irmão' : 'Irmãos'}`}>
              {licenciados.length === 0 ? <Vazio>Nenhum irmão licenciado</Vazio> : licenciados.map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', marginBottom: '0.5rem', background: 'rgba(99,102,241,0.1)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>{nomeCurto(r.nome)}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{r.desde ? `desde ${fmtData(r.desde)}${r.ate ? ` até ${fmtData(r.ate)}` : ''}` : ''}</span>
                </div>
              ))}
            </Quadro>
          </div>
        </>
      )}

      {mostrarGrade && <ModalGradePresencaArcoReal onFechar={() => setMostrarGrade(false)} />}
    </div>
  );
}
