import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import {
  SITUACOES_ARCO_REAL, membroNoQuadro, mesesEntre, tempoTexto, nomeCurto, proximoAniversario,
  buscarPeriodosSituacao, calcularPresencaMembro, hojeISO, fmtData,
} from '../../utils/arcoRealMembros';

const boxCard = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.25rem' };
const tituloBox = { fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 };
const subBox = { fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: '0.15rem 0 0' };
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const moeda = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const FAIXAS_TEMPO = [
  { label: 'Menos de 1 ano', min: 0, max: 12, cor: '#38bdf8' },
  { label: '1 a 5 anos', min: 12, max: 60, cor: '#10b981' },
  { label: '5 a 10 anos', min: 60, max: 120, cor: '#f59e0b' },
  { label: '10 a 20 anos', min: 120, max: 240, cor: '#f97316' },
  { label: '20 anos ou mais', min: 240, max: Infinity, cor: '#a855f7' },
];

function Kpi({ icone, titulo, valor, detalhe, cor }) {
  return (
    <div style={{ ...boxCard, padding: '0.9rem 1rem', borderLeft: `4px solid ${cor}`, display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
      <p style={{ fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', margin: 0 }}>{icone} {titulo}</p>
      <p style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, lineHeight: 1.15 }}>{valor}</p>
      {detalhe && <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: 0 }}>{detalhe}</p>}
    </div>
  );
}

export default function DashboardArcoReal({ permissoes = {} }) {
  const [membros, setMembros] = useState([]);
  const [sessoes, setSessoes] = useState([]);
  const [presencas, setPresencas] = useState([]);
  const [periodos, setPeriodos] = useState([]);
  const [pendencias, setPendencias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [principais, setPrincipais] = useState({ p1: null, p2: null, p3: null });
  const anoAtual = new Date().getFullYear();
  const podeVerFinanceiro = !!permissoes?.canViewFinancial;

  useEffect(() => { carregar(); carregarPrincipais(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const carregarPrincipais = async () => {
    try {
      const { data } = await supabase
        .from('arco_real_corpo_administrativo')
        .select('cargo, arco_real_membros(nome, foto_url)')
        .eq('ano_exercicio', String(anoAtual))
        .in('cargo', ['1º Principal', '2º Principal', '3º Principal']);
      const mapa = {};
      (data || []).forEach(l => { mapa[l.cargo] = l.arco_real_membros; });
      setPrincipais({ p1: mapa['1º Principal'] || null, p2: mapa['2º Principal'] || null, p3: mapa['3º Principal'] || null });
    } catch (e) {
      console.error('Erro ao carregar 3 Principais:', e.message);
    }
  };

  const carregar = async () => {
    setLoading(true);
    try {
      const { data: mb, error } = await supabase
        .from('arco_real_membros')
        .select('id, nome, situacao, ativo, data_nascimento, data_exaltacao, foto_url');
      if (error) throw error;
      setMembros(mb || []);

      const { data: ss } = await supabase
        .from('arco_real_sessoes')
        .select('id, data_sessao')
        .gte('data_sessao', `${anoAtual}-01-01`).lte('data_sessao', `${anoAtual}-12-31`)
        .order('data_sessao');
      const ids = (ss || []).map(s => s.id);
      let regs = [];
      if (ids.length) {
        const { data } = await supabase.from('arco_real_registros_presenca').select('membro_id, sessao_id, presente').in('sessao_id', ids);
        regs = data || [];
      }
      // só entram sessões que realmente têm registro de presença
      const comRegistro = new Set(regs.map(r => r.sessao_id));
      setSessoes((ss || []).filter(s => comRegistro.has(s.id)));
      setPresencas(regs);

      setPeriodos(await buscarPeriodosSituacao());

      if (podeVerFinanceiro) {
        const { data: lc } = await supabase
          .from('arco_real_lancamentos')
          .select('valor, data_vencimento, tipo, origem_membro_id')
          .eq('status', 'pendente').not('origem_membro_id', 'is', null);
        setPendencias(lc || []);
      }
    } catch (e) {
      console.error('Erro ao carregar dashboard do Arco Real:', e.message);
    } finally {
      setLoading(false);
    }
  };

  const d = useMemo(() => {
    const quadro = membros.filter(membroNoQuadro);
    const contagem = {};
    Object.keys(SITUACOES_ARCO_REAL).forEach(k => { contagem[k] = membros.filter(m => m.situacao === k).length; });

    // Tempo de Arco Real (membros do quadro com data de exaltação)
    const tempos = quadro.filter(m => m.data_exaltacao).map(m => ({ m, meses: mesesEntre(m.data_exaltacao) }));
    const mediaMeses = tempos.length ? Math.round(tempos.reduce((s, t) => s + t.meses, 0) / tempos.length) : null;
    const maisAntigo = tempos.length ? tempos.reduce((a, b) => (b.meses > a.meses ? b : a)) : null;
    const faixas = FAIXAS_TEMPO.map(f => ({ ...f, qtd: tempos.filter(t => t.meses >= f.min && t.meses < f.max).length }));
    const semData = quadro.length - tempos.length;

    // Presença do exercício
    const mapa = new Map(presencas.map(p => [`${p.membro_id}|${p.sessao_id}`, !!p.presente]));
    const porMembro = quadro.map(m => ({ m, ...calcularPresencaMembro(m, sessoes, mapa, periodos) }));
    const totEleg = porMembro.reduce((s, x) => s + x.elegiveis, 0);
    const totPres = porMembro.reduce((s, x) => s + x.presentes, 0);
    const mediaPresenca = totEleg ? Math.round((totPres / totEleg) * 1000) / 10 : null;
    const cem = porMembro.filter(x => x.elegiveis > 0 && x.presentes === x.elegiveis).map(x => x.m);

    const mensal = MESES.map((mes, i) => {
      const doMes = sessoes.filter(s => Number(s.data_sessao.substring(5, 7)) - 1 === i);
      if (!doMes.length) return { mes, pct: null, sessoes: 0 };
      let el = 0, pr = 0;
      quadro.forEach(m => {
        const r = calcularPresencaMembro(m, doMes, mapa, periodos);
        el += r.elegiveis; pr += r.presentes;
      });
      return { mes, pct: el ? Math.round((pr / el) * 100) : 0, sessoes: doMes.length };
    });

    // Aniversariantes (todos os membros ativos, inclusive licenciados)
    const aniv = membros.filter(m => m.ativo !== false && ['regular', 'licenciado'].includes(m.situacao) && m.data_nascimento)
      .map(m => ({ m, ...proximoAniversario(m.data_nascimento) }));
    const mesAtual = new Date().getMonth() + 1;
    const hoje = aniv.filter(a => a.dias === 0);
    const prox7 = aniv.filter(a => a.dias > 0 && a.dias <= 7).sort((a, b) => a.dias - b.dias);
    const doMes = aniv.filter(a => Number(a.m.data_nascimento.substring(5, 7)) === mesAtual)
      .sort((a, b) => Number(a.m.data_nascimento.substring(8, 10)) - Number(b.m.data_nascimento.substring(8, 10)));

    // Licenças vencendo / vencidas (membro ainda licenciado)
    const hojeIso = hojeISO();
    const em30 = new Date(); em30.setDate(em30.getDate() + 30);
    const lim30 = `${em30.getFullYear()}-${String(em30.getMonth() + 1).padStart(2, '0')}-${String(em30.getDate()).padStart(2, '0')}`;
    const licAlertas = periodos
      .filter(p => p.tipo_situacao === 'licenciado' && p.data_fim && p.data_fim <= lim30)
      .map(p => ({ p, membro: membros.find(m => m.id === p.membro_id) }))
      .filter(x => x.membro && x.membro.situacao === 'licenciado')
      .sort((a, b) => a.p.data_fim.localeCompare(b.p.data_fim))
      .map(x => ({ ...x, vencida: x.p.data_fim < hojeIso }));

    // Pendências
    const devidos = pendencias.filter(l => l.tipo === 'receita');
    const totalDevido = devidos.reduce((s, l) => s + Number(l.valor || 0), 0);
    const vencidos = devidos.filter(l => l.data_vencimento && l.data_vencimento < hojeIso);
    const totalVencido = vencidos.reduce((s, l) => s + Number(l.valor || 0), 0);
    const inadimplentes = new Set(vencidos.map(l => l.origem_membro_id)).size;

    return { quadro, contagem, mediaMeses, maisAntigo, faixas, semData, mediaPresenca, cem, mensal, hoje, prox7, doMes, licAlertas, totalDevido, totalVencido, inadimplentes, totEleg, totPres };
  }, [membros, sessoes, presencas, periodos, pendencias]);

  if (loading) return <div className="p-6" style={{ color: 'var(--color-text-muted)', textAlign: 'center' }}>Carregando...</div>;

  const totalCadastrados = membros.length;
  const maxFaixa = Math.max(1, ...d.faixas.map(f => f.qtd));

  return (
    <div className="p-6" style={{ maxWidth: '1280px', margin: '0 auto' }}>
      <div className="mb-6">
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)' }}>📊 Dashboard — Arco Real</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Visão geral do Capítulo — exercício {anoAtual}</p>
      </div>

      {/* Os 3 Principais */}
      {(principais.p1 || principais.p2 || principais.p3) && (
        <div style={{ position: 'relative', border: '2px solid #f59e0b', borderRadius: 'var(--radius-xl)', padding: '1.75rem 1.25rem 1.25rem', marginBottom: '1.5rem' }}>
          <span style={{ position: 'absolute', top: '-0.7rem', left: '50%', transform: 'translateX(-50%)', background: 'var(--color-bg)', padding: '0.1rem 1rem', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.1em', color: '#f59e0b', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            Exercício - {anoAtual}
          </span>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ alignItems: 'stretch' }}>
            {[
              { cargo: '1º Principal', irmao: principais.p1, gradiente: 'linear-gradient(135deg, #c9a84c 0%, #a3792f 100%)' },
              { cargo: '2º Principal', irmao: principais.p2, gradiente: 'linear-gradient(135deg, var(--color-accent) 0%, #4338ca 100%)' },
              { cargo: '3º Principal', irmao: principais.p3, gradiente: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)' },
            ].map(c => (
              <div key={c.cargo} style={{ background: c.gradiente, borderRadius: 'var(--radius-xl)', padding: '0.9rem 1.25rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
                {c.irmao?.foto_url ? (
                  <img src={c.irmao.foto_url} alt={c.irmao.nome} style={{ width: '90px', height: '90px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.6)', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', flexShrink: 0 }}>
                    {c.irmao ? '👤' : '❔'}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)', margin: '0 0 0.3rem' }}>{c.cargo}</p>
                  <p style={{ fontSize: '1.02rem', fontWeight: 800, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.irmao ? nomeCurto(c.irmao.nome) : 'Vago'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Indicadores */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        <Kpi icone="👥" titulo="Quadro de Membros" valor={d.quadro.length} detalhe={`${d.contagem.regular} regulares · ${d.contagem.licenciado} licenciados`} cor="#2d6a9f" />
        <Kpi icone="🗂️" titulo="Total no Cadastro" valor={totalCadastrados} detalhe="inclui desligados, excluídos e falecidos" cor="#64748b" />
        <Kpi icone="🔺" titulo="Tempo Médio de Arco Real" valor={d.mediaMeses === null ? '—' : `${(d.mediaMeses / 12).toFixed(1).replace('.', ',')} anos`} detalhe={d.mediaMeses === null ? 'sem datas de exaltação' : tempoTexto(d.mediaMeses)} cor="#f59e0b" />
        <Kpi icone="🏅" titulo="Mais Antigo" valor={d.maisAntigo ? `${Math.floor(d.maisAntigo.meses / 12)} anos` : '—'} detalhe={d.maisAntigo ? nomeCurto(d.maisAntigo.m.nome) : ''} cor="#a855f7" />
        <Kpi icone="📋" titulo="Sessões no Exercício" valor={sessoes.length} detalhe="com presença registrada" cor="#06b6d4" />
        <Kpi icone="✅" titulo="Presença Média" valor={d.mediaPresenca === null ? '—' : `${String(d.mediaPresenca).replace('.', ',')}%`} detalhe={d.totEleg ? `${d.totPres} de ${d.totEleg} registros elegíveis` : 'sem sessões'} cor="#10b981" />
      </div>

      {/* Situação + Tempo de Arco Real */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <div style={boxCard}>
          <p style={tituloBox}>Situação dos Membros</p>
          <p style={subBox}>{totalCadastrados} cadastros</p>
          <div style={{ display: 'flex', height: '14px', borderRadius: '999px', overflow: 'hidden', margin: '0.9rem 0', background: 'var(--color-surface-2)' }}>
            {Object.entries(SITUACOES_ARCO_REAL).map(([k, s]) => d.contagem[k] > 0 && (
              <div key={k} title={`${s.label}: ${d.contagem[k]}`} style={{ width: `${(d.contagem[k] / (totalCadastrados || 1)) * 100}%`, background: s.cor }} />
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {Object.entries(SITUACOES_ARCO_REAL).map(([k, s]) => (
              <div key={k} style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.55rem 0.7rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.cor, flexShrink: 0 }} />
                <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', flex: 1 }}>{s.label}</span>
                <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)' }}>{d.contagem[k]}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={boxCard}>
          <p style={tituloBox}>🔺 Tempo de Arco Real</p>
          <p style={subBox}>Membros do quadro por tempo desde a exaltação{d.semData > 0 ? ` · ${d.semData} sem data` : ''}</p>
          <div style={{ marginTop: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            {d.faixas.map(f => (
              <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ width: '110px', fontSize: '0.72rem', color: 'var(--color-text-muted)', flexShrink: 0 }}>{f.label}</span>
                <div style={{ flex: 1, height: '16px', background: 'var(--color-surface-2)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ width: `${(f.qtd / maxFaixa) * 100}%`, height: '100%', background: f.cor, borderRadius: '999px', transition: 'width .3s' }} />
                </div>
                <span style={{ width: '24px', textAlign: 'right', fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-text)' }}>{f.qtd}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Presença */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <div style={boxCard}>
          <p style={tituloBox}>📅 Presença Mensal — {anoAtual}</p>
          <p style={subBox}>% de presença dos membros do quadro nas sessões do mês</p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.4rem', height: '150px', marginTop: '1rem' }}>
            {d.mensal.map(m => (
              <div key={m.mes} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }} title={m.pct === null ? 'Sem sessões' : `${m.pct}% em ${m.sessoes} sessão(ões)`}>
                <span style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', marginBottom: '2px' }}>{m.pct === null ? '' : `${m.pct}%`}</span>
                <div style={{ width: '100%', maxWidth: '26px', height: m.pct === null ? '3px' : `${Math.max(m.pct, 3)}%`, background: m.pct === null ? 'var(--color-border)' : m.pct >= 70 ? '#10b981' : m.pct >= 40 ? '#f59e0b' : '#ef4444', borderRadius: '4px 4px 0 0' }} />
                <span style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>{m.mes}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...boxCard, borderLeft: '4px solid #f59e0b' }}>
          <p style={tituloBox}>🏆 Presença 100% no Exercício</p>
          <p style={subBox}>Presentes em todas as sessões elegíveis (desde a exaltação, fora de licenças)</p>
          {d.cem.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '2rem 0', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>Nenhum membro com 100% até agora.</p>
          ) : (
            <div style={{ marginTop: '0.8rem', display: 'flex', flexWrap: 'wrap', gap: '0.45rem', maxHeight: '170px', overflowY: 'auto' }}>
              {d.cem.map(m => (
                <span key={m.id} style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)', color: 'var(--color-text)', borderRadius: '999px', padding: '0.25rem 0.7rem', fontSize: '0.76rem', fontWeight: 600 }}>
                  🏅 {nomeCurto(m.nome)}
                </span>
              ))}
            </div>
          )}
          <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.8rem' }}>{d.cem.length} de {d.quadro.length} membros do quadro</p>
        </div>
      </div>

      {/* Alertas de licença + pendências */}
      {(d.licAlertas.length > 0 || podeVerFinanceiro) && (
        <div className={`grid grid-cols-1 ${d.licAlertas.length > 0 && podeVerFinanceiro ? 'lg:grid-cols-2' : ''} gap-5 mb-5`}>
          {d.licAlertas.length > 0 && (
            <div style={{ ...boxCard, borderLeft: '4px solid #6366f1' }}>
              <p style={tituloBox}>📋 Licenças a Vencer</p>
              <p style={subBox}>Vencidas ou com término nos próximos 30 dias</p>
              <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {d.licAlertas.map(({ p, membro, vencida }) => (
                  <div key={p.id} style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.55rem 0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--color-text)' }}>{nomeCurto(membro.nome)}</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: vencida ? '#ef4444' : '#f59e0b' }}>
                      {vencida ? 'Venceu em ' : 'Vence em '}{fmtData(p.data_fim)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {podeVerFinanceiro && (
            <div style={{ ...boxCard, borderLeft: '4px solid #ef4444' }}>
              <p style={tituloBox}>💰 Pendências Financeiras</p>
              <p style={subBox}>Valores a receber dos membros</p>
              <div className="grid grid-cols-3 gap-2" style={{ marginTop: '0.9rem' }}>
                {[
                  { t: 'Total a receber', v: moeda(d.totalDevido), c: '#f59e0b' },
                  { t: 'Vencido', v: moeda(d.totalVencido), c: '#ef4444' },
                  { t: 'Membros em atraso', v: d.inadimplentes, c: '#a855f7' },
                ].map(x => (
                  <div key={x.t} style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.7rem', textAlign: 'center' }}>
                    <p style={{ fontSize: '1.05rem', fontWeight: 800, color: x.c, margin: 0 }}>{x.v}</p>
                    <p style={{ fontSize: '0.64rem', color: 'var(--color-text-muted)', margin: '0.2rem 0 0', fontWeight: 600 }}>{x.t}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Aniversariantes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
        <div style={{ ...boxCard, borderLeft: '4px solid #f43f5e' }}>
          <p style={tituloBox}>🎂 Aniversariantes do Dia</p>
          <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {d.hoje.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '1rem 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>📅 Nenhum aniversariante hoje</p>
            ) : d.hoje.map(a => (
              <div key={a.m.id} style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.6rem 0.75rem' }}>
                <p style={{ fontWeight: 700, margin: 0, color: 'var(--color-text)', fontSize: '0.86rem' }}>{a.m.nome}</p>
                <p style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', margin: '0.15rem 0 0' }}>🎂 {a.idade} anos hoje</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...boxCard, borderLeft: '4px solid #06b6d4' }}>
          <p style={tituloBox}>📅 Próximos 7 Dias</p>
          <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '220px', overflowY: 'auto' }}>
            {d.prox7.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '1rem 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Nenhum nos próximos 7 dias</p>
            ) : d.prox7.map(a => (
              <div key={a.m.id} style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.6rem 0.75rem', display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 700, margin: 0, color: 'var(--color-text)', fontSize: '0.84rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nomeCurto(a.m.nome)}</p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: '0.1rem 0 0' }}>{a.m.data_nascimento.substring(8, 10)}/{a.m.data_nascimento.substring(5, 7)} · fará {a.idade} anos</p>
                </div>
                <span style={{ background: 'var(--color-accent-bg)', color: 'var(--color-accent)', borderRadius: '999px', padding: '0.1rem 0.55rem', fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {a.dias} {a.dias === 1 ? 'dia' : 'dias'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...boxCard, borderLeft: '4px solid #a855f7' }}>
          <p style={tituloBox}>🗓️ Aniversariantes de {MESES[new Date().getMonth()]}</p>
          <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '220px', overflowY: 'auto' }}>
            {d.doMes.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '1rem 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Nenhum aniversariante neste mês</p>
            ) : d.doMes.map(a => (
              <div key={a.m.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.8rem', padding: '0.3rem 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ color: 'var(--color-text)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nomeCurto(a.m.nome)}</span>
                <span style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>dia {a.m.data_nascimento.substring(8, 10)} · {new Date().getFullYear() - Number(a.m.data_nascimento.substring(0, 4))}a</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {totalCadastrados === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
          <p>Nenhum membro cadastrado ainda — comece pelo "Cadastro de Membros" no menu.</p>
        </div>
      )}
    </div>
  );
}
