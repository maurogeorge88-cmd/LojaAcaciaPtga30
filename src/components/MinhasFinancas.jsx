import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const fmt  = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtD = (d) => { if (!d) return '—'; const [a, m, dia] = d.split('T')[0].split('-'); return `${dia}/${m}/${a}`; };
const MESES_NOME = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const badgeStatus = (s) => {
  const map = {
    pago:        { bg:'rgba(16,185,129,0.15)',  cor:'#10b981', txt:'✅ Pago' },
    pendente:    { bg:'rgba(245,158,11,0.15)',  cor:'#f59e0b', txt:'⏳ Pendente' },
    cancelado:   { bg:'rgba(148,163,184,0.15)', cor:'#94a3b8', txt:'✕ Cancelado' },
    renegociado: { bg:'rgba(139,92,246,0.15)',  cor:'#8b5cf6', txt:'🔄 Reneg.' },
  };
  return map[s] || map.cancelado;
};

const inp = {
  padding: '0.38rem 0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.82rem',
  background: 'var(--color-surface-2)', color: 'var(--color-text)',
  border: '1px solid var(--color-border)', cursor: 'pointer', outline: 'none',
};

export default function MinhasFinancas({ userEmail, userData }) {
  const [lancamentos, setLancamentos] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('pendente');
  const [filtroAno, setFiltroAno]     = useState('');
  const [filtroMes, setFiltroMes]     = useState('');

  // Opções dinâmicas
  const [anosDisp, setAnosDisp] = useState([]);
  const [mesesDisp, setMesesDisp] = useState([]);

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
      const anos = [...new Set(lista.map(l => l.data_vencimento?.substring(0,4)).filter(Boolean))].sort((a,b)=>b-a);
      setAnosDisp(anos);
      // Padrão: "Todos" — para não esconder pendências de anos anteriores ao atual
      setFiltroAno('');
    } finally { setLoading(false); }
  };

  // Recalcular meses disponíveis quando o ano muda
  useEffect(() => {
    const meses = [...new Set(
      lancamentos
        .filter(l => !filtroAno || l.data_vencimento?.startsWith(filtroAno))
        .map(l => l.data_vencimento?.substring(5,7))
        .filter(Boolean)
    )].sort((a,b) => b.localeCompare(a));
    setMesesDisp(meses);
    setFiltroMes(''); // reset mês ao trocar ano
  }, [filtroAno, lancamentos]);

  // Filtragem
  const lancsFiltrados = lancamentos.filter(l => {
    const statusOk = filtroStatus === 'todos' || l.status === filtroStatus;
    const anoOk    = !filtroAno || l.data_vencimento?.startsWith(filtroAno);
    const mesOk    = !filtroMes || l.data_vencimento?.substring(5,7) === filtroMes;
    return statusOk && anoOk && mesOk;
  });

  // Resumo de pendentes (sem filtro de período)
  const pendentes    = lancamentos.filter(l => l.status === 'pendente');
  const totalDevo    = pendentes.filter(l=>l.categorias_financeiras?.tipo==='receita').reduce((s,l)=>s+parseFloat(l.valor||0),0);
  const totalCredito = pendentes.filter(l=>l.categorias_financeiras?.tipo==='despesa').reduce((s,l)=>s+parseFloat(l.valor||0),0);
  const totalPago    = lancamentos.filter(l=>l.status==='pago'&&l.tipo_pagamento!=='compensacao').reduce((s,l)=>s+parseFloat(l.valor||0),0);
  const saldo        = totalDevo - totalCredito;

  // Agrupar: mês → dia → lançamentos
  const porMes = {};
  lancsFiltrados.forEach(l => {
    const dvenc = l.data_vencimento?.split('T')[0] || '';
    const mesKey = dvenc.substring(0,7);   // "2026-06"
    const diaKey = dvenc;                   // "2026-06-05"
    if (!porMes[mesKey]) porMes[mesKey] = {};
    if (!porMes[mesKey][diaKey]) porMes[mesKey][diaKey] = [];
    porMes[mesKey][diaKey].push(l);
  });
  const mesesOrdenados = Object.keys(porMes).sort((a,b)=>b.localeCompare(a));

  const labelMes = (key) => {
    const [a,m] = key.split('-');
    return `${MESES_NOME[parseInt(m)-1]} / ${a}`;
  };
  const labelDia = (key) => fmtD(key);

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:'3rem',color:'var(--color-text-muted)'}}>
      Carregando suas finanças...
    </div>
  );

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'0.85rem',background:'var(--color-bg)',minHeight:'100vh'}}>

      {/* Cabeçalho */}
      <div style={{borderRadius:'var(--radius-xl)',padding:'1rem 1.25rem',background:'var(--color-surface)',border:'1px solid var(--color-border)',borderLeft:'4px solid var(--color-accent)'}}>
        <h2 style={{fontWeight:'800',fontSize:'1.15rem',color:'var(--color-text)',margin:0}}>💰 Minhas Finanças</h2>
        <p style={{color:'var(--color-text-muted)',fontSize:'0.8rem',margin:'0.15rem 0 0'}}>{userData?.nome || email}</p>
      </div>

      {/* Cards resumo */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'0.6rem'}}>
        {[
          {label:'Você Deve',   valor:totalDevo,           cor:'#ef4444', sub:`${pendentes.filter(l=>l.categorias_financeiras?.tipo==='receita').length} pendente(s)`},
          {label:'Loja Deve',   valor:totalCredito,        cor:'#3b82f6', sub:`${pendentes.filter(l=>l.categorias_financeiras?.tipo==='despesa').length} pendente(s)`},
          {label:'Total Pago',  valor:totalPago,           cor:'#10b981', sub:'histórico geral'},
          {label: saldo>0?'Saldo Devedor':saldo<0?'Saldo a Favor':'Quitado',
           valor:Math.abs(saldo), cor:saldo>0?'#ef4444':saldo<0?'#3b82f6':'#10b981', sub:'posição atual'},
        ].map((item,i)=>(
          <div key={i} style={{borderRadius:'var(--radius-lg)',padding:'0.85rem 1rem',background:'var(--color-surface)',border:'1px solid var(--color-border)',borderTop:`3px solid ${item.cor}`}}>
            <p style={{fontSize:'1.25rem',fontWeight:'800',color:item.cor,margin:0,lineHeight:1}}>{fmt(item.valor)}</p>
            <p style={{fontSize:'0.75rem',fontWeight:'700',color:'var(--color-text)',margin:'0.3rem 0 0.1rem'}}>{item.label}</p>
            <p style={{fontSize:'0.68rem',color:'var(--color-text-muted)',margin:0}}>{item.sub}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{borderRadius:'var(--radius-lg)',padding:'0.65rem 1rem',background:'var(--color-surface)',border:'1px solid var(--color-border)',display:'flex',gap:'0.65rem',flexWrap:'wrap',alignItems:'center'}}>
        {/* Status */}
        <div style={{display:'flex',gap:'0.35rem',alignItems:'center'}}>
          <span style={{fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.04em'}}>Status:</span>
          {[
            {id:'pendente',label:'⏳ Pendentes',cor:'#f59e0b'},
            {id:'todos',   label:'Todos',       cor:'var(--color-accent)'},
            {id:'pago',    label:'✅ Pagos',    cor:'#10b981'},
          ].map(f=>(
            <button key={f.id} onClick={()=>setFiltroStatus(f.id)} style={{
              padding:'0.32rem 0.85rem',borderRadius:'var(--radius-lg)',fontWeight:'600',fontSize:'0.78rem',
              cursor:'pointer',border:'none',transition:'all 0.15s',
              background: filtroStatus===f.id ? f.cor : 'var(--color-surface-2)',
              color: filtroStatus===f.id ? '#fff' : 'var(--color-text)',
            }}>{f.label}</button>
          ))}
        </div>

        <div style={{width:'1px',height:'24px',background:'var(--color-border)'}}/>

        {/* Ano */}
        <div style={{display:'flex',gap:'0.4rem',alignItems:'center'}}>
          <span style={{fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.04em'}}>Ano:</span>
          <select value={filtroAno} onChange={e=>{setFiltroAno(e.target.value)}} style={inp}>
            <option value=''>Todos</option>
            {anosDisp.map(a=><option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {/* Mês */}
        <div style={{display:'flex',gap:'0.4rem',alignItems:'center'}}>
          <span style={{fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.04em'}}>Mês:</span>
          <select value={filtroMes} onChange={e=>setFiltroMes(e.target.value)} style={inp}>
            <option value=''>Todos</option>
            {mesesDisp.map(m=>(
              <option key={m} value={m}>{MESES_NOME[parseInt(m)-1]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista: Mês → Dia → Lançamentos */}
      {mesesOrdenados.length === 0 ? (
        <div style={{padding:'2.5rem',textAlign:'center',color:'var(--color-text-muted)',background:'var(--color-surface)',borderRadius:'var(--radius-lg)',border:'1px solid var(--color-border)'}}>
          ℹ️ Nenhum lançamento encontrado para o filtro selecionado.
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
          {mesesOrdenados.map(mesKey=>{
            const diasOrdenados = Object.keys(porMes[mesKey]).sort((a,b)=>b.localeCompare(a));
            const todosLanc = diasOrdenados.flatMap(d=>porMes[mesKey][d]);
            const totalMes  = todosLanc.reduce((s,l)=>s+parseFloat(l.valor||0),0);
            const pendMes   = todosLanc.filter(l=>l.status==='pendente').length;
            const vencMes   = todosLanc.filter(l=>l.status==='vencido').length;

            return (
              <div key={mesKey} style={{borderRadius:'var(--radius-xl)',overflow:'hidden',border:'1px solid var(--color-border)',background:'var(--color-surface)'}}>

                {/* Header Mês */}
                <div style={{padding:'0.6rem 1rem',background:'var(--color-surface-2)',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid var(--color-border)'}}>
                  <span style={{fontWeight:'800',color:'var(--color-accent)',fontSize:'1rem'}}>
                    📅 {labelMes(mesKey)}
                  </span>
                  <div style={{display:'flex',gap:'0.75rem',alignItems:'center'}}>
                    {pendMes>0 && <span style={{fontSize:'0.72rem',color:'#f59e0b',fontWeight:'700'}}>{pendMes} pendente(s)</span>}
                    {vencMes>0 && <span style={{fontSize:'0.72rem',color:'#ef4444',fontWeight:'700'}}>⚠️ {vencMes} vencido(s)</span>}
                    <span style={{fontWeight:'700',color:'var(--color-text)',fontSize:'0.9rem'}}>{fmt(totalMes)}</span>
                  </div>
                </div>

                {/* Dias */}
                {diasOrdenados.map(diaKey=>{
                  const lancsDia   = porMes[mesKey][diaKey];
                  const totalDia   = lancsDia.reduce((s,l)=>s+parseFloat(l.valor||0),0);
                  const pendDia    = lancsDia.filter(l=>l.status==='pendente').length;

                  return (
                    <div key={diaKey}>
                      {/* Sub-header Dia */}
                      <div style={{padding:'0.4rem 1rem 0.4rem 1.5rem',background:'rgba(0,0,0,0.12)',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid var(--color-border)'}}>
                        <span style={{fontWeight:'700',color:'var(--color-text)',fontSize:'0.82rem'}}>
                          📆 {labelDia(diaKey)}
                          <span style={{fontWeight:'400',color:'var(--color-text-muted)',fontSize:'0.72rem',marginLeft:'0.5rem'}}>
                            · {lancsDia.length} lançamento{lancsDia.length>1?'s':''}
                          </span>
                        </span>
                        <div style={{display:'flex',gap:'0.6rem',alignItems:'center'}}>
                          {pendDia>0 && <span style={{fontSize:'0.7rem',color:'#f59e0b',fontWeight:'700'}}>{pendDia} pend.</span>}
                          <span style={{fontSize:'0.8rem',fontWeight:'700',color:'var(--color-text-muted)'}}>{fmt(totalDia)}</span>
                        </div>
                      </div>

                      {/* Lançamentos do dia */}
                      {lancsDia.map((lanc,idx)=>{
                        const ehReceita = lanc.categorias_financeiras?.tipo === 'receita';
                        const corValor  = ehReceita ? '#ef4444' : '#3b82f6';
                        const bs = badgeStatus(lanc.status);
                        return (
                          <div key={lanc.id} style={{
                            display:'flex', alignItems:'center', gap:'0.6rem',
                            padding:'0.5rem 1rem 0.5rem 2rem',
                            borderBottom: idx < lancsDia.length-1 ? '1px solid var(--color-border)' : 'none',
                            background: idx%2===0 ? 'transparent' : 'rgba(0,0,0,0.05)',
                          }}>
                            {/* Categoria */}
                            {lanc.categorias_financeiras?.nome && (
                              <span style={{flexShrink:0,fontSize:'0.75rem',fontWeight:'600',color:'var(--color-text-muted)',
                                whiteSpace:'nowrap',minWidth:'80px'}}>
                                {lanc.categorias_financeiras.nome}
                              </span>
                            )}
                            {/* Separador */}
                            <span style={{flexShrink:0,color:'var(--color-border)',fontSize:'0.8rem'}}>·</span>
                            {/* Descrição */}
                            <span style={{flex:1,fontWeight:'600',color:'var(--color-text)',fontSize:'0.85rem',
                              overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                              {lanc.descricao}
                              {lanc.eh_parcelado && (
                                <span style={{marginLeft:'0.4rem',fontSize:'0.68rem',fontWeight:'700',
                                  color:'#6366f1',background:'rgba(99,102,241,0.12)',
                                  padding:'0.05rem 0.35rem',borderRadius:'999px',
                                  border:'1px solid rgba(99,102,241,0.3)'}}>
                                  {lanc.parcela_numero}/{lanc.parcela_total}
                                </span>
                              )}
                            </span>
                            {/* Status */}
                            <span style={{flexShrink:0,padding:'0.15rem 0.55rem',borderRadius:'999px',
                              fontSize:'0.68rem',fontWeight:'700',
                              background:bs.bg,color:bs.cor,border:`1px solid ${bs.cor}40`,
                              whiteSpace:'nowrap'}}>
                              {bs.txt}
                            </span>
                            {/* Valor */}
                            <span style={{flexShrink:0,fontWeight:'800',fontSize:'0.9rem',
                              color:corValor,textAlign:'right',minWidth:'90px'}}>
                              {fmt(parseFloat(lanc.valor))}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Rodapé */}
      <div style={{padding:'0.85rem 1rem',borderRadius:'var(--radius-lg)',background:'rgba(245,158,11,0.07)',border:'1px solid rgba(245,158,11,0.25)'}}>
        <p style={{fontWeight:'700',color:'var(--color-text)',margin:'0 0 0.3rem',fontSize:'0.82rem'}}>💡 Informações Importantes</p>
        <ul style={{margin:0,paddingLeft:'1rem',fontSize:'0.77rem',color:'var(--color-text-muted)',lineHeight:'1.65'}}>
          <li>Para efetuar pagamentos, entre em contato com o Tesoureiro</li>
          <li>Mantenha suas mensalidades em dia para regularidade</li>
        </ul>
      </div>

    </div>
  );
}
