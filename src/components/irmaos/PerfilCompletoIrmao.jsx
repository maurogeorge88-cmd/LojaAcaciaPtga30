import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

const PerfilCompletoIrmao = ({ irmaoId, userData, irmaoLogadoId, onClose }) => {
  const [irmao, setIrmao]                           = useState(null);
  const [anoPresenca, setAnoPresenca]               = useState(new Date().getFullYear().toString());
  const [anosDisponiveis, setAnosDisponiveis]       = useState([]);
  const [anoFinanceiro, setAnoFinanceiro]           = useState('todos');
  const [mesFinanceiro, setMesFinanceiro]           = useState('todos');
  const [dadosPresenca, setDadosPresenca]           = useState(null);
  const [dadosFinanceiro, setDadosFinanceiro]       = useState(null);
  const [grausFilosoficos, setGrausFilosoficos]     = useState([]);
  const [comissoesAtivas, setComissoesAtivas]       = useState([]);
  const [comissoesInativas, setComissoesInativas]   = useState([]);
  const [eventosParticipados, setEventosParticipados] = useState([]);
  const [loading, setLoading]                       = useState(true);

  const podeVerOutros =
    userData?.nivel_acesso === 'admin' ||
    userData?.cargo?.toLowerCase() === 'veneravel' ||
    userData?.cargo?.toLowerCase() === 'tesoureiro' ||
    userData?.cargo?.toLowerCase() === 'chanceler';

  useEffect(() => {
    if (!podeVerOutros && irmaoId !== irmaoLogadoId) {
      alert('Acesso negado. Você só pode visualizar seu próprio perfil completo.');
      onClose(); return;
    }
    carregarDados();
  }, [irmaoId, anoPresenca, mesFinanceiro, anoFinanceiro]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const { data: irmaoData, error } = await supabase.from('irmaos').select('*').eq('id', irmaoId).single();
      if (error) throw error;
      setIrmao(irmaoData);

      const { data: anosData } = await supabase.from('registros_presenca')
        .select('sessoes_presenca!inner(data_sessao)').eq('membro_id', irmaoId);
      const anos = [...new Set(anosData?.map(r => new Date(r.sessoes_presenca.data_sessao).getFullYear()))].sort((a,b)=>b-a);
      setAnosDisponiveis(anos);

      await carregarPresenca(irmaoData);
      await carregarFinanceiro();
      await carregarGrausFilosoficos();
      await carregarComissoes();
      await carregarEventos();
    } catch (err) {
      console.error(err);
      alert('Erro ao carregar perfil');
    } finally {
      setLoading(false);
    }
  };

  const carregarPresenca = async (irmaoData) => {
    try {
      let q = supabase.from('sessoes_presenca').select('id, data_sessao, grau_sessao_id');
      if (anoPresenca !== 'todos') q = q.gte('data_sessao',`${anoPresenca}-01-01`).lte('data_sessao',`${anoPresenca}-12-31`);
      const { data: sessoes } = await q.order('data_sessao', { ascending: false });
      const ids = sessoes?.map(s=>s.id) || [];
      const { data: registros } = await supabase.from('registros_presenca').select('*').eq('membro_id',irmaoId).in('sessao_id',ids);
      const { data: historico } = await supabase.from('historico_situacoes').select('*').eq('membro_id',irmaoId);

      let total=0, pres=0, just=0, ause=0;
      const ultimas = [];

      const grauNaData = (d) => {
        const dt = new Date(d+'T12:00:00');
        if (irmaoData.data_exaltacao && dt>=new Date(irmaoData.data_exaltacao+'T12:00:00')) return 3;
        if (irmaoData.data_elevacao  && dt>=new Date(irmaoData.data_elevacao+'T12:00:00'))  return 2;
        if (irmaoData.data_iniciacao && dt>=new Date(irmaoData.data_iniciacao+'T12:00:00')) return 1;
        return 0;
      };

      sessoes?.forEach((s, idx) => {
        let gs = s.grau_sessao_id || 1; if (gs===4) gs=1;
        const gi = grauNaData(s.data_sessao);
        const ds = new Date(s.data_sessao+'T12:00:00');
        if (gi < gs) return;
        const di = irmaoData.data_ingresso_loja ? new Date(irmaoData.data_ingresso_loja+'T12:00:00') : irmaoData.data_iniciacao ? new Date(irmaoData.data_iniciacao+'T12:00:00') : null;
        if (di && ds < di) return;
        const bloq = historico?.find(sit => {
          const tn = sit.tipo_situacao?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'') || '';
          const ex = ['desligado','desligamento','irregular','suspenso','excluido','ex-oficio','licenca'];
          if (!ex.includes(tn) && !ex.some(e=>tn.includes(e))) return false;
          const di2 = new Date(sit.data_inicio+'T00:00:00'); di2.setHours(0,0,0,0);
          const dsn = new Date(ds); dsn.setHours(0,0,0,0);
          if (dsn < di2) return false;
          if (sit.data_fim) { const df = new Date(sit.data_fim+'T00:00:00'); df.setHours(0,0,0,0); return dsn>=di2 && dsn<=df; }
          return dsn >= di2;
        });
        if (bloq) return;
        total++;
        const reg = registros?.find(r=>r.sessao_id===s.id);
        let status = 'F';
        if (reg) { if (reg.presente) { pres++; status='P'; } else if (reg.justificativa) { just++; status='J'; } else { ause++; } } else { ause++; }
        if (idx < 10) ultimas.push({ data: s.data_sessao, status });
      });

      setDadosPresenca({ totalSessoes:total, presencas:pres, ausenciasJustificadas:just, ausenciasInjustificadas:ause, taxa: total>0?Math.round(pres/total*100):0, ultimasSessoes:ultimas });
    } catch(e) { console.error(e); }
  };

  const carregarFinanceiro = async () => {
    try {
      let q = supabase.from('lancamentos_loja').select('*, categorias_financeiras(nome,tipo)').eq('origem_irmao_id',irmaoId).eq('origem_tipo','Irmao');
      if (anoFinanceiro !== 'todos') {
        q = q.gte('data_vencimento',`${anoFinanceiro}-01-01`).lte('data_vencimento',`${anoFinanceiro}-12-31`);
        if (mesFinanceiro !== 'todos') {
          const m = String(mesFinanceiro).padStart(2,'0');
          const ult = new Date(anoFinanceiro, mesFinanceiro, 0).getDate();
          q = q.gte('data_vencimento',`${anoFinanceiro}-${m}-01`).lte('data_vencimento',`${anoFinanceiro}-${m}-${ult}`);
        }
      }
      const { data: lancs } = await q.limit(300);
      const rec  = (lancs||[]).filter(l=>l.categorias_financeiras?.tipo==='receita').reduce((s,l)=>s+parseFloat(l.valor||0),0);
      const desp = (lancs||[]).filter(l=>l.categorias_financeiras?.tipo==='despesa').reduce((s,l)=>s+parseFloat(l.valor||0),0);
      setDadosFinanceiro({ receitas:rec, despesas:desp, saldo:rec-desp });
    } catch(e) { console.error(e); }
  };

  const carregarGrausFilosoficos = async () => {
    try {
      const { data } = await supabase.from('vida_maconica').select('*, graus_maconicos(numero_grau, nome_grau)').eq('irmao_id',irmaoId).order('data_conquista',{ascending:false});
      setGrausFilosoficos(data||[]);
    } catch(e) { setGrausFilosoficos([]); }
  };

  const carregarComissoes = async () => {
    try {
      const { data } = await supabase.from('comissoes_integrantes').select('*, comissoes(nome,status,origem,data_inicio,data_fim)').eq('irmao_id',irmaoId);
      setComissoesAtivas((data||[]).filter(c=>c.comissoes?.status!=='encerrada'));
      setComissoesInativas((data||[]).filter(c=>c.comissoes?.status==='encerrada'));
    } catch(e) { console.error(e); }
  };

  const carregarEventos = async () => {
    try {
      const { data } = await supabase.from('eventos_participantes').select('*, eventos_loja(nome_evento,descricao,data_aviso)').eq('irmao_id',irmaoId).limit(20);
      setEventosParticipados(data||[]);
    } catch(e) { console.error(e); }
  };

  const fmtMoeda = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
  const fmtData  = d => d ? new Date(d+'T12:00:00').toLocaleDateString('pt-BR') : '—';
  const grauAtual = () => {
    if (!irmao) return '—';
    if (irmao.mestre_instalado) return 'Mestre Instalado';
    if (irmao.data_exaltacao)   return 'Mestre';
    if (irmao.data_elevacao)    return 'Companheiro';
    if (irmao.data_iniciacao)   return 'Aprendiz';
    return '—';
  };

  // ── Estilos reutilizáveis ─────────────────────────────────────────────────
  const sSelect = { padding:'0.35rem 0.65rem', background:'var(--color-surface-2)', color:'var(--color-text)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-md)', fontSize:'0.8rem', cursor:'pointer' };
  const sSection = { marginBottom:'1.75rem' };
  const sSecTitle = { fontSize:'1.05rem', fontWeight:'700', color:'var(--color-text)', marginBottom:'0.75rem', display:'flex', alignItems:'center', gap:'0.4rem' };
  const sMeses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const anoAtual = new Date().getFullYear();
  const anosFinanceiro = Array.from({length:5},(_,i)=>anoAtual-i);

  const taxaCor = t => t>=90?'#10b981':t>=70?'#3b82f6':t>=50?'#f59e0b':'#ef4444';

  if (loading) return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50}}>
      <div style={{background:'var(--color-surface)',borderRadius:'var(--radius-xl)',padding:'2rem',display:'flex',alignItems:'center',gap:'1rem',border:'1px solid var(--color-border)'}}>
        <div style={{width:'2rem',height:'2rem',borderRadius:'50%',borderBottom:'3px solid var(--color-accent)',borderTop:'3px solid transparent',borderLeft:'3px solid transparent',borderRight:'3px solid transparent',animation:'spin 0.8s linear infinite'}} />
        <p style={{color:'var(--color-text)',fontWeight:'600'}}>Carregando perfil...</p>
      </div>
    </div>
  );
  if (!irmao) return null;

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:'1rem'}}>
      <div style={{background:'var(--color-surface)',borderRadius:'var(--radius-xl)',boxShadow:'var(--shadow-2xl)',width:'100%',maxWidth:'900px',maxHeight:'90vh',overflow:'hidden',display:'flex',flexDirection:'column',border:'1px solid var(--color-border)'}}>

        {/* Header */}
        <div style={{background:'var(--color-accent)',padding:'1.25rem 1.5rem',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <div style={{display:'flex',gap:'1rem',alignItems:'center'}}>
            {irmao.foto_url && <img src={irmao.foto_url} alt={irmao.nome} style={{width:'60px',height:'60px',borderRadius:'50%',objectFit:'cover',border:'3px solid rgba(255,255,255,0.6)'}} />}
            <div>
              <h2 style={{color:'#fff',fontWeight:'800',fontSize:'1.25rem',margin:0}}>{irmao.nome}</h2>
              <p style={{color:'rgba(255,255,255,0.85)',fontSize:'0.82rem',margin:'0.2rem 0 0'}}>CIM: {irmao.cim||'Não informado'}</p>
              <p style={{color:'rgba(255,255,255,0.85)',fontSize:'0.82rem',margin:'0.1rem 0 0'}}>Grau: {grauAtual()} | Iniciado em: {fmtData(irmao.data_iniciacao)}</p>
            </div>
          </div>
          <button onClick={onClose} style={{background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',color:'#fff',borderRadius:'50%',width:'2rem',height:'2rem',fontSize:'1rem',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:'700'}}>✕</button>
        </div>

        {/* Conteúdo */}
        <div style={{padding:'1.25rem 1.5rem',overflowY:'auto',flex:1}}>

          {/* ── Presença ─────────────────────────────────────────────────── */}
          <section style={sSection}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem'}}>
              <h3 style={sSecTitle}>📊 Presença</h3>
              <select value={anoPresenca} onChange={e=>setAnoPresenca(e.target.value)} style={sSelect}>
                <option value="todos">Todos os anos</option>
                {anosDisponiveis.map(a=><option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            {dadosPresenca && (
              <>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))',gap:'0.6rem',marginBottom:'0.75rem'}}>
                  {[
                    {label:'Total Sessões', val:dadosPresenca.totalSessoes,       cor:'var(--color-accent)'},
                    {label:'Presenças',     val:dadosPresenca.presencas,          cor:'#10b981'},
                    {label:'Justificadas',  val:dadosPresenca.ausenciasJustificadas, cor:'#f59e0b'},
                    {label:'Ausências',     val:dadosPresenca.ausenciasInjustificadas, cor:'#ef4444'},
                    {label:'Taxa',          val:`${dadosPresenca.taxa}%`,         cor:taxaCor(dadosPresenca.taxa)},
                  ].map((item,i)=>(
                    <div key={i} style={{borderRadius:'var(--radius-lg)',padding:'0.85rem',background:'var(--color-surface-2)',border:'1px solid var(--color-border)',borderLeft:`4px solid ${item.cor}`,textAlign:'center'}}>
                      <p style={{fontSize:'1.5rem',fontWeight:'800',color:item.cor,margin:0}}>{item.val}</p>
                      <p style={{fontSize:'0.7rem',color:'var(--color-text-muted)',margin:'0.15rem 0 0'}}>{item.label}</p>
                    </div>
                  ))}
                </div>
                {dadosPresenca.ultimasSessoes.length > 0 && (
                  <div style={{background:'var(--color-surface-2)',borderRadius:'var(--radius-lg)',padding:'0.85rem',border:'1px solid var(--color-border)'}}>
                    <p style={{fontSize:'0.78rem',fontWeight:'600',color:'var(--color-text-muted)',marginBottom:'0.5rem'}}>Últimas {dadosPresenca.ultimasSessoes.length} sessões:</p>
                    <div style={{display:'flex',gap:'0.4rem',flexWrap:'wrap'}}>
                      {dadosPresenca.ultimasSessoes.map((s,i)=>(
                        <div key={i} style={{width:'2.5rem',height:'2.5rem',borderRadius:'var(--radius-md)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:'800',fontSize:'0.9rem',color:'#fff',background:s.status==='P'?'#10b981':s.status==='J'?'#f59e0b':'#ef4444',title:fmtData(s.data)}}>
                          {s.status}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          {/* ── Financeiro ────────────────────────────────────────────────── */}
          <section style={sSection}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem',flexWrap:'wrap',gap:'0.5rem'}}>
              <h3 style={sSecTitle}>💰 Situação Financeira</h3>
              <div style={{display:'flex',gap:'0.4rem'}}>
                <select value={anoFinanceiro} onChange={e=>setAnoFinanceiro(e.target.value)} style={sSelect}>
                  <option value="todos">Todos os anos</option>
                  {anosFinanceiro.map(a=><option key={a} value={a}>{a}</option>)}
                </select>
                {anoFinanceiro !== 'todos' && (
                  <select value={mesFinanceiro} onChange={e=>setMesFinanceiro(e.target.value)} style={sSelect}>
                    <option value="todos">Todos os meses</option>
                    {sMeses.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
                  </select>
                )}
              </div>
            </div>
            {dadosFinanceiro && (
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:'0.6rem'}}>
                {[
                  {label:'Receitas',  val:fmtMoeda(dadosFinanceiro.receitas),  cor:'#f97316'},
                  {label:'Despesas',  val:fmtMoeda(dadosFinanceiro.despesas),  cor:'#10b981'},
                  {label:'Saldo',     val:fmtMoeda(dadosFinanceiro.saldo),     cor:dadosFinanceiro.saldo>=0?'#3b82f6':'#ef4444'},
                  {label:'Situação',  val:dadosFinanceiro.saldo>=0?'✅ Pago':'⚠️ Devendo', cor:dadosFinanceiro.saldo>=0?'#10b981':'#ef4444'},
                ].map((item,i)=>(
                  <div key={i} style={{borderRadius:'var(--radius-lg)',padding:'0.9rem',background:'var(--color-surface-2)',border:'1px solid var(--color-border)',borderLeft:`4px solid ${item.cor}`}}>
                    <p style={{fontSize:'0.75rem',fontWeight:'600',color:'var(--color-text-muted)',margin:'0 0 0.3rem'}}>{item.label}</p>
                    <p style={{fontSize:'1.1rem',fontWeight:'800',color:item.cor,margin:0}}>{item.val}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Graus Filosóficos ─────────────────────────────────────────── */}
          <section style={sSection}>
            <h3 style={sSecTitle}>🎓 Graus Filosóficos ({grausFilosoficos.length})</h3>
            {grausFilosoficos.length > 0 ? (
              <div style={{borderRadius:'var(--radius-lg)',overflow:'hidden',border:'1px solid var(--color-border)'}}>
                {grausFilosoficos.map((g,i)=>(
                  <div key={g.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0.65rem 1rem',background:i%2===0?'var(--color-surface-2)':'var(--color-surface)',borderBottom:i<grausFilosoficos.length-1?'1px solid var(--color-border)':'none'}}>
                    <p style={{fontWeight:'600',color:'var(--color-text)',margin:0}}>Grau {g.graus_maconicos?.numero_grau}° — {g.graus_maconicos?.nome_grau}</p>
                    <span style={{fontSize:'0.78rem',color:'var(--color-text-muted)'}}>{fmtData(g.data_conquista)}</span>
                  </div>
                ))}
              </div>
            ) : <p style={{color:'var(--color-text-muted)',textAlign:'center',padding:'1rem'}}>Nenhum grau filosófico registrado</p>}
          </section>

          {/* ── Comissões ─────────────────────────────────────────────────── */}
          <section style={sSection}>
            <h3 style={sSecTitle}>👥 Comissões</h3>
            {/* Ativas */}
            <p style={{fontSize:'0.78rem',fontWeight:'700',color:'#10b981',marginBottom:'0.4rem'}}>✓ Ativas ({comissoesAtivas.length})</p>
            {comissoesAtivas.length > 0 ? (
              <div style={{borderRadius:'var(--radius-lg)',overflow:'hidden',border:'1px solid var(--color-border)',marginBottom:'0.75rem'}}>
                {comissoesAtivas.map((com,i)=>{
                  const orig = com.comissoes?.origem;
                  return (
                    <div key={com.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0.6rem 1rem',background:i%2===0?'var(--color-surface-2)':'var(--color-surface)',borderBottom:i<comissoesAtivas.length-1?'1px solid var(--color-border)':'none'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
                        <span style={{fontSize:'0.72rem',color:orig==='interna'?'#3b82f6':'#8b5cf6'}}>{orig==='interna'?'🏢':'🌐'}</span>
                        <span style={{fontWeight:'600',color:'var(--color-text)',fontSize:'0.875rem'}}>{com.comissoes?.nome||'Sem nome'}</span>
                      </div>
                      <span style={{padding:'0.15rem 0.65rem',borderRadius:'999px',fontSize:'0.72rem',fontWeight:'700',background:'rgba(16,185,129,0.15)',color:'#10b981',border:'1px solid rgba(16,185,129,0.3)'}}>{com.funcao||'Membro'}</span>
                    </div>
                  );
                })}
              </div>
            ) : <p style={{color:'var(--color-text-muted)',fontSize:'0.82rem',paddingLeft:'0.5rem',marginBottom:'0.75rem'}}>Nenhuma comissão ativa</p>}
            {/* Inativas */}
            {comissoesInativas.length > 0 && (
              <>
                <p style={{fontSize:'0.78rem',fontWeight:'700',color:'var(--color-text-muted)',marginBottom:'0.4rem'}}>✗ Inativas ({comissoesInativas.length})</p>
                <div style={{borderRadius:'var(--radius-lg)',overflow:'hidden',border:'1px solid var(--color-border)',opacity:0.75}}>
                  {comissoesInativas.map((com,i)=>(
                    <div key={com.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0.5rem 1rem',background:i%2===0?'var(--color-surface-2)':'var(--color-surface)',borderBottom:i<comissoesInativas.length-1?'1px solid var(--color-border)':'none'}}>
                      <span style={{color:'var(--color-text)',fontSize:'0.85rem'}}>{com.comissoes?.nome||'Sem nome'}</span>
                      <span style={{fontSize:'0.72rem',color:'var(--color-text-muted)'}}>{fmtData(com.data_saida)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* ── Eventos ───────────────────────────────────────────────────── */}
          <section style={{marginBottom:'0.5rem'}}>
            <h3 style={sSecTitle}>🎉 Eventos Participados ({eventosParticipados.length})</h3>
            {eventosParticipados.length > 0 ? (
              <div style={{borderRadius:'var(--radius-lg)',overflow:'hidden',border:'1px solid var(--color-border)',maxHeight:'280px',overflowY:'auto'}}>
                {eventosParticipados.map((ev,i)=>(
                  <div key={ev.id} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'0.65rem 1rem',background:i%2===0?'var(--color-surface-2)':'var(--color-surface)',borderBottom:i<eventosParticipados.length-1?'1px solid var(--color-border)':'none'}}>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{fontWeight:'600',color:'var(--color-text)',margin:0,fontSize:'0.875rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ev.eventos_loja?.nome_evento||'Sem nome'}</p>
                      {ev.eventos_loja?.descricao && <p style={{fontSize:'0.75rem',color:'var(--color-text-muted)',margin:'0.15rem 0 0'}}>{ev.eventos_loja.descricao}</p>}
                    </div>
                    <span style={{fontSize:'0.75rem',color:'var(--color-text-muted)',marginLeft:'1rem',flexShrink:0}}>{fmtData(ev.eventos_loja?.data_aviso)}</span>
                  </div>
                ))}
              </div>
            ) : <p style={{color:'var(--color-text-muted)',textAlign:'center',padding:'1rem'}}>Nenhum evento participado</p>}
          </section>

        </div>
      </div>
    </div>
  );
};

export default PerfilCompletoIrmao;
