import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const formatarDataBR = (d) => {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
};

const sBtn = (ativo) => ({
  padding: '0.4rem 1rem', borderRadius: 'var(--radius-lg)', fontWeight: '600',
  fontSize: '0.82rem', cursor: 'pointer', border: 'none', transition: 'all 0.15s',
  background: ativo ? 'var(--color-accent)' : 'var(--color-surface-2)',
  color: ativo ? '#fff' : 'var(--color-text)',
});

const PERIODOS = [
  { id: 'mes-atual',    label: 'Mês Atual' },
  { id: 'trimestre',   label: 'Trimestre' },
  { id: 'semestre',    label: 'Semestre' },
  { id: 'ano-atual',   label: 'Ano Atual' },
  { id: 'personalizado', label: 'Personalizado' },
];

const NOMES_MES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export default function MinhaPresenca({ userData }) {
  const [loading, setLoading]           = useState(true);
  const [sessoes, setSessoes]           = useState([]);
  const [presencas, setPresencas]       = useState({});
  const [irmaoData, setIrmaoData]       = useState(null);
  const [estatisticas, setEstatisticas] = useState({ total:0, presencas:0, ausencias:0, justificadas:0, taxa:0 });
  const [periodo, setPeriodo]           = useState('ano-atual');
  const anoAtual = new Date().getFullYear();
  const [dataInicio, setDataInicio]     = useState(`${anoAtual}-01-01`);
  const [dataFim, setDataFim]           = useState(`${anoAtual}-12-31`);

  useEffect(() => { if (periodo !== 'personalizado') carregarDados(); }, [periodo]);

  const calcularPeriodo = () => {
    const hoje = new Date();
    let inicio, fim;
    switch (periodo) {
      case 'mes-atual':
        inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        fim    = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
        break;
      case 'trimestre':
        const t = Math.floor(hoje.getMonth() / 3) * 3;
        inicio = new Date(hoje.getFullYear(), t, 1);
        fim    = new Date(hoje.getFullYear(), t + 3, 0);
        break;
      case 'semestre':
        const s = hoje.getMonth() < 6 ? 0 : 6;
        inicio = new Date(hoje.getFullYear(), s, 1);
        fim    = new Date(hoje.getFullYear(), s + 6, 0);
        break;
      case 'personalizado':
        if (!dataInicio || !dataFim) return null;
        inicio = new Date(dataInicio); fim = new Date(dataFim);
        break;
      default:
        inicio = new Date(hoje.getFullYear(), 0, 1);
        fim    = new Date(hoje.getFullYear(), 11, 31);
    }
    if (fim > hoje) fim = hoje;
    return { inicio: inicio.toISOString().split('T')[0], fim: fim.toISOString().split('T')[0] };
  };

  const carregarDados = async () => {
    setLoading(true);
    try {
      const p = calcularPeriodo();
      if (!p) return;

      const { data: irmao } = await supabase.from('irmaos')
        .select('id, nome, data_iniciacao, data_elevacao, data_exaltacao, mestre_instalado')
        .eq('email', userData.email).single();
      if (!irmao) return;
      setIrmaoData(irmao);

      const hoje = new Date().toISOString().split('T')[0];
      const { data: sessoesData } = await supabase.from('sessoes_presenca')
        .select('id, data_sessao, grau_sessao_id, graus_sessao:grau_sessao_id(nome, grau_minimo_requerido)')
        .gte('data_sessao', p.inicio).lte('data_sessao', p.fim).lte('data_sessao', hoje)
        .order('data_sessao', { ascending: false });

      // Filtrar elegíveis por grau na data
      const elegiveis = (sessoesData || []).filter(s => {
        const d = new Date(s.data_sessao);
        let gs = s.grau_sessao_id || 1;
        if (gs === 4) gs = 1;
        let gi = 0;
        if (irmao.data_exaltacao && d >= new Date(irmao.data_exaltacao)) gi = 3;
        else if (irmao.data_elevacao && d >= new Date(irmao.data_elevacao)) gi = 2;
        else if (irmao.data_iniciacao && d >= new Date(irmao.data_iniciacao)) gi = 1;
        return gi >= gs;
      });
      setSessoes(elegiveis);

      const ids = elegiveis.map(s => s.id);
      if (ids.length > 0) {
        const { data: regs } = await supabase.from('registros_presenca')
          .select('sessao_id, presente, justificativa')
          .eq('membro_id', irmao.id).in('sessao_id', ids);
        const mapa = {};
        (regs || []).forEach(r => { mapa[r.sessao_id] = r; });
        setPresencas(mapa);
        const total = elegiveis.length;
        const pres  = (regs || []).filter(r => r.presente).length;
        const just  = (regs || []).filter(r => !r.presente && r.justificativa).length;
        const ause  = total - pres - just;
        setEstatisticas({ total, presencas: pres, ausencias: ause < 0 ? 0 : ause, justificadas: just, taxa: total > 0 ? Math.round(pres/total*100) : 0 });
      } else {
        setEstatisticas({ total: 0, presencas: 0, ausencias: 0, justificadas: 0, taxa: 0 });
      }
    } finally {
      setLoading(false);
    }
  };

  // Agrupar por mês
  const porMes = {};
  sessoes.forEach(s => {
    const key = s.data_sessao.substring(0, 7);
    if (!porMes[key]) porMes[key] = [];
    porMes[key].push(s);
  });
  const mesesOrdenados = Object.keys(porMes).sort((a, b) => b.localeCompare(a));

  const statusInfo = (sessaoId) => {
    const r = presencas[sessaoId];
    if (!r)              return { cor: '#94a3b8', bg: 'rgba(148,163,184,0.15)', borda: 'rgba(148,163,184,0.3)', txt: '— Sem registro' };
    if (r.presente)      return { cor: '#10b981', bg: 'rgba(16,185,129,0.15)',  borda: 'rgba(16,185,129,0.3)',  txt: '✓ Presente' };
    if (r.justificativa) return { cor: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  borda: 'rgba(245,158,11,0.3)',  txt: 'J Justificado' };
    return               { cor: '#ef4444', bg: 'rgba(239,68,68,0.15)',  borda: 'rgba(239,68,68,0.3)',  txt: '✗ Ausente' };
  };

  const taxaCor = (t) => t >= 90 ? '#10b981' : t >= 70 ? '#3b82f6' : t >= 50 ? '#f59e0b' : '#ef4444';

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
      Carregando suas presenças...
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--color-bg)', minHeight: '100vh', overflowX: 'hidden' }}>

      {/* Cabeçalho */}
      <div style={{ borderRadius: 'var(--radius-xl)', padding: '1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderLeft: '4px solid var(--color-accent)' }}>
        <h2 style={{ fontWeight: '800', fontSize: '1.2rem', color: 'var(--color-text)', margin: 0 }}>📊 Minhas Presenças</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', margin: '0.2rem 0 0' }}>{irmaoData?.nome || userData?.nome}</p>
      </div>

      {/* Cards de estatísticas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.6rem' }}>
        {[
          { label: 'Sessões',     valor: estatisticas.total,        cor: 'var(--color-accent)' },
          { label: 'Presente',    valor: estatisticas.presencas,    cor: '#10b981' },
          { label: 'Justificado', valor: estatisticas.justificadas, cor: '#f59e0b' },
          { label: 'Ausente',     valor: estatisticas.ausencias,    cor: '#ef4444' },
          { label: 'Taxa',        valor: `${estatisticas.taxa}%`,   cor: taxaCor(estatisticas.taxa) },
        ].map((item, i) => (
          <div key={i} style={{ borderRadius: 'var(--radius-lg)', padding: '0.85rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderLeft: `4px solid ${item.cor}`, textAlign: 'center' }}>
            <p style={{ fontSize: '1.5rem', fontWeight: '800', color: item.cor, margin: 0 }}>{item.valor}</p>
            <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: '0.15rem 0 0' }}>{item.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros de período */}
      <div style={{ borderRadius: 'var(--radius-lg)', padding: '0.75rem 1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
        {PERIODOS.map(p => (
          <button key={p.id} onClick={() => setPeriodo(p.id)} style={sBtn(periodo === p.id)}>{p.label}</button>
        ))}
      </div>

      {/* Inputs de período personalizado */}
      {periodo === 'personalizado' && (
        <div style={{ borderRadius: 'var(--radius-lg)', padding: '1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
          {[{ label: 'Início', val: dataInicio, set: setDataInicio }, { label: 'Fim', val: dataFim, set: setDataFim }].map(({ label, val, set }) => (
            <div key={label}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>{label}</label>
              <input type="date" value={val} onChange={e => set(e.target.value)}
                style={{ padding: '0.4rem 0.6rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem' }} />
            </div>
          ))}
          <button onClick={carregarDados}
            style={{ padding: '0.4rem 1.2rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: '700', cursor: 'pointer', fontSize: '0.85rem' }}>
            🔍 Aplicar
          </button>
        </div>
      )}

      {/* Lista agrupada por mês */}
      {mesesOrdenados.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          Nenhuma sessão encontrada no período selecionado.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {mesesOrdenados.map(mesAno => {
            const sessMes = porMes[mesAno];
            const [a, m]  = mesAno.split('-');
            const pres    = sessMes.filter(s => presencas[s.id]?.presente).length;
            const ause    = sessMes.filter(s => presencas[s.id] && !presencas[s.id].presente && !presencas[s.id].justificativa).length;
            const just    = sessMes.filter(s => presencas[s.id] && !presencas[s.id].presente && presencas[s.id].justificativa).length;
            const taxa    = sessMes.length > 0 ? Math.round(pres/sessMes.length*100) : 0;
            return (
              <div key={mesAno} style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                {/* Cabeçalho do mês */}
                <div style={{ padding: '0.7rem 1rem', background: 'var(--color-surface-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span style={{ fontWeight: '700', color: 'var(--color-accent)', fontSize: '0.95rem' }}>
                    📅 {NOMES_MES[parseInt(m)-1]} {a}
                  </span>
                  <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.72rem', fontWeight: '700' }}>
                    <span style={{ color: '#10b981' }}>✓ {pres}</span>
                    <span style={{ color: '#f59e0b' }}>J {just}</span>
                    <span style={{ color: '#ef4444' }}>✗ {ause}</span>
                    <span style={{ color: taxaCor(taxa) }}>{taxa}%</span>
                  </div>
                </div>
                {/* Cards de sessão */}
                <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {sessMes.map((sessao, idx) => {
                    const si  = statusInfo(sessao.id);
                    const reg = presencas[sessao.id];
                    return (
                      <div key={sessao.id} style={{
                        borderRadius: 'var(--radius-lg)', borderLeft: `4px solid ${si.cor}`,
                        background: idx % 2 === 0 ? 'var(--color-surface-2)' : 'var(--color-surface)',
                        border: '1px solid var(--color-border)', borderLeftColor: si.cor,
                        padding: '0.55rem 0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem'
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: '600', color: 'var(--color-text)', margin: '0 0 0.15rem', fontSize: '0.85rem' }}>
                            {sessao.graus_sessao?.nome || 'Sessão'}
                          </p>
                          <p style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)', margin: 0 }}>
                            {formatarDataBR(sessao.data_sessao)}
                            {reg?.justificativa && <> · <span style={{ fontStyle: 'italic' }}>{reg.justificativa}</span></>}
                          </p>
                        </div>
                        <span style={{ padding: '0.2rem 0.7rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: '700', background: si.bg, color: si.cor, border: `1px solid ${si.borda}`, flexShrink: 0 }}>
                          {si.txt}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legenda */}
      <div style={{ padding: '0.9rem 1rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <p style={{ fontWeight: '700', color: 'var(--color-text)', margin: '0 0 0.4rem', fontSize: '0.85rem' }}>ℹ️ Legenda</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          {[['#10b981','✓ Presente'],['#f59e0b','J Justificado'],['#ef4444','✗ Ausente'],['#94a3b8','— Sem registro']].map(([cor, txt]) => (
            <span key={txt}><span style={{ color: cor, fontWeight: '700' }}>{txt.split(' ')[0]}</span> {txt.split(' ').slice(1).join(' ')}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
