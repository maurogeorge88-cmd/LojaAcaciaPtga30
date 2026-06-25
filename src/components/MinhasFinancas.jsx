import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const fmt  = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtD = (d) => { if (!d) return '—'; const [a, m, dia] = d.split('T')[0].split('-'); return `${dia}/${m}/${a}`; };

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MESES_ABR = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export default function MinhasFinancas({ userEmail, userData }) {
  const [lancamentos, setLancamentos]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('pendente');
  const [filtroMes, setFiltroMes]       = useState('todos');
  const [filtroAno, setFiltroAno]       = useState(new Date().getFullYear());
  const [anosDisp, setAnosDisp]         = useState([]);
  const [mesesDisp, setMesesDisp]       = useState([]);

  const email = userEmail || userData?.email;
  useEffect(() => { if (email) carregarDados(); }, [email]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      if (!email) return;
      const { data: irmao } = await supabase.from('irmaos').select('id').eq('email', email).maybeSingle();
      if (!irmao) return;

      const { data } = await supabase
        .from('lancamentos_loja')
        .select('*, categorias_financeiras(tipo, nome)')
        .eq('origem_irmao_id', irmao.id)
        .eq('origem_tipo', 'Irmao')
        .order('data_vencimento', { ascending: false });

      const lista = data || [];
      setLancamentos(lista);

      // Anos disponíveis
      const anos = [...new Set(lista.map(l => l.data_vencimento?.substring(0, 4)).filter(Boolean))].sort((a, b) => b - a);
      setAnosDisp(anos);
      if (anos.length && !anos.includes(String(new Date().getFullYear()))) setFiltroAno(parseInt(anos[0]));
    } finally {
      setLoading(false);
    }
  };

  // Meses disponíveis para o ano selecionado
  useEffect(() => {
    const meses = [...new Set(
      lancamentos
        .filter(l => l.data_vencimento?.startsWith(String(filtroAno)))
        .map(l => l.data_vencimento?.substring(5, 7))
        .filter(Boolean)
    )].sort((a, b) => b.localeCompare(a));
    setMesesDisp(meses);
    setFiltroMes('todos');
  }, [filtroAno, lancamentos]);

  // Filtragem
  const lancsFiltrados = lancamentos.filter(l => {
    const statusOk = filtroStatus === 'todos' || l.status === filtroStatus;
    const anoOk    = l.data_vencimento?.startsWith(String(filtroAno));
    const mesOk    = filtroMes === 'todos' || l.data_vencimento?.substring(5, 7) === filtroMes;
    return statusOk && anoOk && mesOk;
  });

  // Resumo geral (todos os lançamentos, independente do filtro)
  const pendentes    = lancamentos.filter(l => l.status === 'pendente');
  const totalDevo    = pendentes.filter(l => l.categorias_financeiras?.tipo === 'receita').reduce((s, l) => s + parseFloat(l.valor || 0), 0);
  const totalCredito = pendentes.filter(l => l.categorias_financeiras?.tipo === 'despesa').reduce((s, l) => s + parseFloat(l.valor || 0), 0);
  const totalPago    = lancamentos.filter(l => l.status === 'pago' && l.tipo_pagamento !== 'compensacao').reduce((s, l) => s + parseFloat(l.valor || 0), 0);
  const saldo        = totalDevo - totalCredito;

  // Agrupar por mês → dentro: receitas e despesas separadas
  const porMes = {};
  lancsFiltrados.forEach(l => {
    const key = l.data_vencimento?.substring(0, 7) || 'sem-data';
    if (!porMes[key]) porMes[key] = { receitas: [], despesas: [] };
    if (l.categorias_financeiras?.tipo === 'despesa') porMes[key].despesas.push(l);
    else porMes[key].receitas.push(l);
  });
  const mesesOrdenados = Object.keys(porMes).sort((a, b) => b.localeCompare(a));

  const labelMes = (key) => {
    if (key === 'sem-data') return 'Sem data';
    const [a, m] = key.split('-');
    return `${MESES[parseInt(m) - 1]} ${a}`;
  };

  const badgeStatus = (s) => {
    const map = {
      pago:         { bg: 'rgba(16,185,129,0.15)',  cor: '#10b981', txt: '✅ Pago' },
      pendente:     { bg: 'rgba(245,158,11,0.15)',  cor: '#f59e0b', txt: '⏳ Pendente' },
      cancelado:    { bg: 'rgba(148,163,184,0.15)', cor: '#94a3b8', txt: '✕ Cancelado' },
      renegociado:  { bg: 'rgba(139,92,246,0.15)',  cor: '#8b5cf6', txt: '🔄 Reneg.' },
      compensacao:  { bg: 'rgba(99,102,241,0.15)',  cor: '#6366f1', txt: '↔ Comp.' },
    };
    const v = map[s] || map.cancelado;
    return { bg: v.bg, cor: v.cor, txt: v.txt };
  };

  const LancRow = ({ lanc, ehReceita }) => {
    const bs  = badgeStatus(lanc.status);
    const cor = ehReceita ? '#ef4444' : '#3b82f6';
    return (
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto auto',
        alignItems: 'center', gap: '0.75rem',
        padding: '0.6rem 0.9rem',
        borderBottom: '1px solid var(--color-border)',
      }}>
        {/* Esquerda: badges + descrição + data */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.25rem', alignItems: 'center' }}>
            {lanc.categorias_financeiras?.nome && (
              <span style={{ padding: '0.12rem 0.5rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: '700',
                background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                {lanc.categorias_financeiras.nome}
              </span>
            )}
            {lanc.eh_parcelado && (
              <span style={{ padding: '0.12rem 0.5rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: '700',
                background: 'rgba(99,102,241,0.12)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.3)' }}>
                {lanc.parcela_numero}/{lanc.parcela_total}
              </span>
            )}
            <span style={{ padding: '0.12rem 0.5rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: '700',
              background: bs.bg, color: bs.cor, border: `1px solid ${bs.cor}40` }}>
              {bs.txt}
            </span>
          </div>
          <div style={{ fontWeight: '600', color: 'var(--color-text)', fontSize: '0.85rem',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {lanc.descricao}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>
            Vence: {fmtD(lanc.data_vencimento)}
            {lanc.data_pagamento && (
              <> · <span style={{ color: '#10b981', fontWeight: '600' }}>Pago: {fmtD(lanc.data_pagamento)}</span></>
            )}
            {lanc.tipo_pagamento && <> · {lanc.tipo_pagamento}</>}
          </div>
        </div>
        {/* Valor */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontWeight: '800', fontSize: '1rem', color: cor, whiteSpace: 'nowrap' }}>
            {fmt(parseFloat(lanc.valor))}
          </div>
          {lanc.tem_pagamento_parcial && (
            <div style={{ fontSize: '0.68rem', color: '#10b981' }}>Pago: {fmt(lanc.total_pago_parcial)}</div>
          )}
        </div>
      </div>
    );
  };

  const SecaoTipo = ({ itens, ehReceita, totalSec }) => {
    if (!itens.length) return null;
    const cor = ehReceita ? '#ef4444' : '#3b82f6';
    const label = ehReceita ? '📈 Você Deve' : '💰 Créditos / Loja Deve';
    return (
      <div>
        {/* Sub-header receita/despesa */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0.35rem 0.9rem',
          background: ehReceita ? 'rgba(239,68,68,0.06)' : 'rgba(59,130,246,0.06)',
          borderBottom: `1px solid ${cor}30`,
        }}>
          <span style={{ fontSize: '0.72rem', fontWeight: '700', color: cor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {label} ({itens.length})
          </span>
          <span style={{ fontSize: '0.78rem', fontWeight: '700', color: cor }}>
            {fmt(totalSec)}
          </span>
        </div>
        {itens.map(l => <LancRow key={l.id} lanc={l} ehReceita={ehReceita} />)}
      </div>
    );
  };

  const sBtn = (ativo, cor = 'var(--color-accent)') => ({
    padding: '0.35rem 0.85rem', borderRadius: 'var(--radius-lg)', fontWeight: '600',
    fontSize: '0.8rem', cursor: 'pointer', border: 'none', transition: 'all 0.15s',
    background: ativo ? cor : 'var(--color-surface-2)',
    color: ativo ? '#fff' : 'var(--color-text)',
  });

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
      Carregando suas finanças...
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', background: 'var(--color-bg)', minHeight: '100vh' }}>

      {/* Cabeçalho */}
      <div style={{ borderRadius: 'var(--radius-xl)', padding: '1rem 1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderLeft: '4px solid var(--color-accent)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontWeight: '800', fontSize: '1.15rem', color: 'var(--color-text)', margin: 0 }}>💰 Minhas Finanças</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', margin: '0.15rem 0 0' }}>{userData?.nome || email}</p>
        </div>
        {/* Seletor de Ano */}
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {anosDisp.map(a => (
            <button key={a} onClick={() => setFiltroAno(parseInt(a))} style={sBtn(filtroAno === parseInt(a))}>
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Cards de resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.6rem' }}>
        {[
          { label: 'Você Deve',    valor: totalDevo,    cor: '#ef4444', sub: `${pendentes.filter(l=>l.categorias_financeiras?.tipo==='receita').length} pendente(s)` },
          { label: 'Loja Deve',   valor: totalCredito, cor: '#3b82f6', sub: `${pendentes.filter(l=>l.categorias_financeiras?.tipo==='despesa').length} pendente(s)` },
          { label: 'Total Pago',  valor: totalPago,    cor: '#10b981', sub: 'histórico geral' },
          { label: saldo > 0 ? 'Saldo Devedor' : saldo < 0 ? 'Saldo a Favor' : 'Quitado',
            valor: Math.abs(saldo), cor: saldo > 0 ? '#ef4444' : saldo < 0 ? '#3b82f6' : '#10b981', sub: 'posição atual' },
        ].map((item, i) => (
          <div key={i} style={{ borderRadius: 'var(--radius-lg)', padding: '0.85rem 1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderTop: `3px solid ${item.cor}` }}>
            <p style={{ fontSize: '1.3rem', fontWeight: '800', color: item.cor, margin: 0, lineHeight: 1 }}>{fmt(item.valor)}</p>
            <p style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--color-text)', margin: '0.3rem 0 0.1rem' }}>{item.label}</p>
            <p style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', margin: 0 }}>{item.sub}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ borderRadius: 'var(--radius-lg)', padding: '0.65rem 1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          { id: 'pendente', label: '⏳ Pendentes', cor: '#f59e0b' },
          { id: 'todos',    label: 'Todos',         cor: 'var(--color-accent)' },
          { id: 'pago',     label: '✅ Pagos',      cor: '#10b981' },
        ].map(f => (
          <button key={f.id} onClick={() => setFiltroStatus(f.id)} style={sBtn(filtroStatus === f.id, f.cor)}>
            {f.label}
          </button>
        ))}

        <div style={{ width: '1px', height: '24px', background: 'var(--color-border)', margin: '0 0.25rem' }} />

        {/* Filtro por mês */}
        <button onClick={() => setFiltroMes('todos')} style={sBtn(filtroMes === 'todos')}>
          Todos os meses
        </button>
        {mesesDisp.map(m => (
          <button key={m} onClick={() => setFiltroMes(m)} style={sBtn(filtroMes === m)}>
            {MESES_ABR[parseInt(m) - 1]}
          </button>
        ))}
      </div>

      {/* Lista agrupada por mês */}
      {mesesOrdenados.length === 0 ? (
        <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-text-muted)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          ℹ️ Nenhum lançamento encontrado para o filtro selecionado.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {mesesOrdenados.map(mesAno => {
            const { receitas, despesas } = porMes[mesAno];
            const totalRec  = receitas.reduce((s, l) => s + parseFloat(l.valor || 0), 0);
            const totalDesp = despesas.reduce((s, l) => s + parseFloat(l.valor || 0), 0);
            const pendMes   = [...receitas, ...despesas].filter(l => l.status === 'pendente').length;
            return (
              <div key={mesAno} style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                {/* Header do mês */}
                <div style={{ padding: '0.6rem 1rem', background: 'var(--color-surface-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)' }}>
                  <span style={{ fontWeight: '700', color: 'var(--color-accent)', fontSize: '0.95rem' }}>
                    📅 {labelMes(mesAno)}
                  </span>
                  <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
                    {pendMes > 0 && (
                      <span style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: '700' }}>
                        {pendMes} pendente(s)
                      </span>
                    )}
                    {receitas.length > 0 && (
                      <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#ef4444' }}>
                        📈 {fmt(totalRec)}
                      </span>
                    )}
                    {despesas.length > 0 && (
                      <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#3b82f6' }}>
                        💰 {fmt(totalDesp)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Receitas (você deve) */}
                <SecaoTipo itens={receitas} ehReceita={true} totalSec={totalRec} />

                {/* Despesas / créditos */}
                <SecaoTipo itens={despesas} ehReceita={false} totalSec={totalDesp} />
              </div>
            );
          })}
        </div>
      )}

      {/* Rodapé */}
      <div style={{ padding: '0.85rem 1rem', borderRadius: 'var(--radius-lg)', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)' }}>
        <p style={{ fontWeight: '700', color: 'var(--color-text)', margin: '0 0 0.3rem', fontSize: '0.82rem' }}>💡 Informações Importantes</p>
        <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.77rem', color: 'var(--color-text-muted)', lineHeight: '1.65' }}>
          <li>Para efetuar pagamentos, entre em contato com o Tesoureiro</li>
          <li>Mantenha suas mensalidades em dia para regularidade</li>
        </ul>
      </div>
    </div>
  );
}
