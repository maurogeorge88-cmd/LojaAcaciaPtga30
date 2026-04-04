import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const formatarMoeda = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const formatarData = (d) => {
  if (!d) return '—';
  const [a, m, dia] = d.split('T')[0].split('-');
  return `${dia}/${m}/${a}`;
};

const sBtn = (ativo, cor = 'var(--color-accent)') => ({
  padding: '0.4rem 1rem', borderRadius: 'var(--radius-lg)', fontWeight: '600',
  fontSize: '0.82rem', cursor: 'pointer', border: 'none', transition: 'all 0.15s',
  background: ativo ? cor : 'var(--color-surface-2)',
  color: ativo ? '#fff' : 'var(--color-text)',
});

export default function MinhasFinancas({ userData }) {
  const [lancamentos, setLancamentos] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [filtro, setFiltro]           = useState('todos');
  const [anoFiltro, setAnoFiltro]     = useState('todos');
  const [anosComRegistros, setAnosComRegistros] = useState([]);

  useEffect(() => { if (userData?.email) carregarDados(); }, [userData]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      if (!userData?.email) { setLoading(false); return; }

      // Buscar irmão — usar maybeSingle para não lançar erro se não encontrar
      const { data: irmao, error: irmaoErr } = await supabase
        .from('irmaos').select('id').eq('email', userData.email).maybeSingle();

      if (irmaoErr) { console.error('Erro ao buscar irmão:', irmaoErr); setLoading(false); return; }
      if (!irmao) { console.warn('Irmão não encontrado para email:', userData.email); setLoading(false); return; }

      const { data, error: lancErr } = await supabase
        .from('lancamentos_loja')
        .select('*, categorias_financeiras(tipo, nome)')
        .eq('origem_irmao_id', irmao.id)
        .eq('origem_tipo', 'Irmao')
        .order('data_vencimento', { ascending: false });

      if (lancErr) { console.error('Erro lançamentos:', lancErr); setLoading(false); return; }
      setLancamentos(data || []);
      const anos = [...new Set((data || []).map(l => l.data_vencimento?.substring(0, 4)).filter(Boolean))].sort((a, b) => b - a);
      setAnosComRegistros(anos);
    } finally {
      setLoading(false);
    }
  };

  const lancsFiltrados = lancamentos.filter(l => {
    const statusOk = filtro === 'todos' || l.status === filtro;
    const anoOk = anoFiltro === 'todos' || l.data_vencimento?.startsWith(String(anoFiltro));
    return statusOk && anoOk;
  });

  // Totais só de pendentes
  const pendentes   = lancamentos.filter(l => l.status === 'pendente');
  const totalDevo   = pendentes.filter(l => l.categorias_financeiras?.tipo === 'receita').reduce((s, l) => s + parseFloat(l.valor || 0), 0);
  const totalCredito = pendentes.filter(l => l.categorias_financeiras?.tipo === 'despesa').reduce((s, l) => s + parseFloat(l.valor || 0), 0);
  const totalPago   = lancamentos.filter(l => l.status === 'pago' && l.tipo_pagamento !== 'compensacao').reduce((s, l) => s + parseFloat(l.valor || 0), 0);
  const saldo       = totalDevo - totalCredito;

  // Agrupar por mês
  const porMes = {};
  lancsFiltrados.forEach(l => {
    const d = l.data_vencimento?.split('T')[0] || '';
    const key = d.substring(0, 7);
    if (!porMes[key]) porMes[key] = { lancamentos: [], mes: key };
    porMes[key].lancamentos.push(l);
  });
  const mesesOrdenados = Object.keys(porMes).sort((a, b) => b.localeCompare(a));

  const badgeTipo = (ehReceita) => ({
    padding: '0.15rem 0.55rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: '700',
    background: ehReceita ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)',
    color: ehReceita ? '#ef4444' : '#3b82f6',
    border: `1px solid ${ehReceita ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.3)'}`,
  });

  const badgeStatus = (s) => {
    const map = {
      pago:      { bg: 'rgba(16,185,129,0.15)', cor: '#10b981', borda: 'rgba(16,185,129,0.3)', txt: '✅ Pago' },
      pendente:  { bg: 'rgba(245,158,11,0.15)', cor: '#f59e0b', borda: 'rgba(245,158,11,0.3)', txt: '⏳ Pendente' },
      vencido:   { bg: 'rgba(239,68,68,0.15)',  cor: '#ef4444', borda: 'rgba(239,68,68,0.3)',  txt: '⚠️ Vencido' },
      cancelado: { bg: 'rgba(148,163,184,0.15)',cor: '#94a3b8', borda: 'rgba(148,163,184,0.3)',txt: '✕ Cancelado' },
    };
    const v = map[s] || map.cancelado;
    return { style: { padding: '0.15rem 0.55rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: '700', background: v.bg, color: v.cor, border: `1px solid ${v.borda}` }, txt: v.txt };
  };

  const nomesMes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const labelMes = (key) => {
    const [a, m] = key.split('-');
    return `${nomesMes[parseInt(m) - 1]} ${a}`;
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
      Carregando suas finanças...
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--color-bg)', minHeight: '100vh', overflowX: 'hidden' }}>

      {/* Cabeçalho */}
      <div style={{ borderRadius: 'var(--radius-xl)', padding: '1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderLeft: '4px solid var(--color-accent)' }}>
        <h2 style={{ fontWeight: '800', fontSize: '1.2rem', color: 'var(--color-text)', margin: 0 }}>💰 Minhas Finanças</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', margin: '0.2rem 0 0' }}>{userData?.nome}</p>
      </div>

      {/* Cards de resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
        {[
          { label: 'Você Deve', valor: totalDevo,    cor: '#ef4444' },
          { label: 'Loja Deve', valor: totalCredito, cor: '#3b82f6' },
          { label: 'Total Pago', valor: totalPago,   cor: '#10b981' },
          { label: saldo > 0 ? 'Saldo Devedor' : saldo < 0 ? 'Saldo a Favor' : 'Quitado',
            valor: Math.abs(saldo), cor: saldo > 0 ? '#ef4444' : saldo < 0 ? '#3b82f6' : '#10b981' },
        ].map((item, i) => (
          <div key={i} style={{ borderRadius: 'var(--radius-lg)', padding: '1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderLeft: `4px solid ${item.cor}`, textAlign: 'center' }}>
            <p style={{ fontSize: '1.4rem', fontWeight: '800', color: item.cor, margin: 0 }}>{formatarMoeda(item.valor)}</p>
            <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: '0.2rem 0 0' }}>{item.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ borderRadius: 'var(--radius-lg)', padding: '0.75rem 1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          { id: 'todos',    label: 'Todos' },
          { id: 'pendente', label: '⏳ Pendentes' },
          { id: 'pago',     label: '✅ Pagos' },
          { id: 'vencido',  label: '⚠️ Vencidos' },
        ].map(f => (
          <button key={f.id} onClick={() => setFiltro(f.id)}
            style={sBtn(filtro === f.id, f.id === 'pendente' ? '#f59e0b' : f.id === 'pago' ? '#10b981' : f.id === 'vencido' ? '#ef4444' : 'var(--color-accent)')}>
            {f.label}
          </button>
        ))}
        <select value={anoFiltro} onChange={e => setAnoFiltro(e.target.value === 'todos' ? 'todos' : parseInt(e.target.value))}
          style={{ padding: '0.4rem 0.75rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', cursor: 'pointer' }}>
          <option value="todos">Todos os anos</option>
          {anosComRegistros.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Lista agrupada por mês */}
      {mesesOrdenados.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          ℹ️ Nenhum lançamento encontrado para o filtro selecionado.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {mesesOrdenados.map(mesAno => {
            const grupo = porMes[mesAno];
            const totalMes = grupo.lancamentos.reduce((s, l) => s + parseFloat(l.valor || 0), 0);
            const pendMes  = grupo.lancamentos.filter(l => l.status === 'pendente').length;
            return (
              <div key={mesAno} style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                {/* Cabeçalho do mês */}
                <div style={{ padding: '0.75rem 1rem', background: 'var(--color-surface-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)' }}>
                  <span style={{ fontWeight: '700', color: 'var(--color-accent)', fontSize: '0.95rem' }}>📅 {labelMes(mesAno)}</span>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {pendMes > 0 && <span style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: '700' }}>{pendMes} pendente(s)</span>}
                    <span style={{ fontWeight: '700', color: 'var(--color-text)', fontSize: '0.9rem' }}>{formatarMoeda(totalMes)}</span>
                  </div>
                </div>
                {/* Cards de lançamento */}
                <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {grupo.lancamentos.map((lanc, idx) => {
                    const ehReceita = lanc.categorias_financeiras?.tipo === 'receita';
                    const corBorda  = ehReceita ? '#ef4444' : '#3b82f6';
                    const bs        = badgeStatus(lanc.status);
                    return (
                      <div key={lanc.id} style={{
                        borderRadius: 'var(--radius-lg)', borderLeft: `4px solid ${corBorda}`,
                        background: idx % 2 === 0 ? 'var(--color-surface-2)' : 'var(--color-surface)',
                        border: '1px solid var(--color-border)', borderLeftColor: corBorda,
                        padding: '0.65rem 0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem'
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* Badges */}
                          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                            <span style={badgeTipo(ehReceita)}>{ehReceita ? '📈 Você Deve' : '💰 Loja Deve'}</span>
                            {lanc.categorias_financeiras?.nome && (
                              <span style={{ padding: '0.15rem 0.55rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: '600', background: 'var(--color-accent-bg)', color: 'var(--color-accent)', border: '1px solid var(--color-accent)' }}>
                                {lanc.categorias_financeiras.nome}
                              </span>
                            )}
                            {lanc.eh_parcelado && (
                              <span style={{ padding: '0.15rem 0.55rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: '600', background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.3)' }}>
                                📋 {lanc.parcela_numero}/{lanc.parcela_total}
                              </span>
                            )}
                            <span style={bs.style}>{bs.txt}</span>
                          </div>
                          {/* Descrição */}
                          <p style={{ fontWeight: '600', color: 'var(--color-text)', margin: '0 0 0.2rem', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {lanc.descricao}
                          </p>
                          {/* Datas */}
                          <p style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)', margin: 0 }}>
                            Vence: {formatarData(lanc.data_vencimento)}
                            {lanc.data_pagamento && <> · <span style={{ color: '#10b981', fontWeight: '600' }}>Pago: {formatarData(lanc.data_pagamento)}</span></>}
                            {lanc.tipo_pagamento && <> · {lanc.tipo_pagamento}</>}
                          </p>
                        </div>
                        <p style={{ fontSize: '1.15rem', fontWeight: '800', color: corBorda, flexShrink: 0, margin: 0 }}>
                          {formatarMoeda(parseFloat(lanc.valor))}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rodapé informativo */}
      <div style={{ padding: '0.9rem 1rem', borderRadius: 'var(--radius-lg)', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
        <p style={{ fontWeight: '700', color: 'var(--color-text)', margin: '0 0 0.35rem', fontSize: '0.85rem' }}>💡 Informações Importantes</p>
        <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.78rem', color: 'var(--color-text-muted)', lineHeight: '1.7' }}>
          <li>Para efetuar pagamentos, entre em contato com o Tesoureiro</li>
          <li>Mantenha suas mensalidades em dia para regularidade</li>
        </ul>
      </div>
    </div>
  );
}
