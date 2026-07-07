import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';

const inp = { width:'100%', padding:'0.4rem 0.7rem', fontSize:'0.83rem',
  background:'var(--color-surface-2)', border:'1px solid var(--color-border)',
  borderRadius:'var(--radius-md)', color:'var(--color-text)', outline:'none', boxSizing:'border-box' };
const lbl = { display:'block', fontSize:'0.68rem', fontWeight:700,
  color:'var(--color-text-muted)', marginBottom:'0.2rem',
  textTransform:'uppercase', letterSpacing:'0.04em' };
const btn = (bg, cor='#fff') => ({
  padding:'0.45rem 1rem', borderRadius:'var(--radius-md)', border:'none',
  background:bg, color:cor, fontWeight:700, fontSize:'0.82rem', cursor:'pointer' });

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const anoAtual = new Date().getFullYear();
const ANOS = Array.from({length:5}, (_,i) => anoAtual - i);

export default function ModalEdicaoLote({ aberto, onFechar, categorias, verificarMesBloqueado, onAtualizar, canEditFinancial }) {
  // ── Filtros ───────────────────────────────────────────────────────────────
  const [filtroMes,      setFiltroMes]      = useState(new Date().getMonth() + 1);
  const [filtroAno,      setFiltroAno]      = useState(anoAtual);
  const [filtroTipo,     setFiltroTipo]     = useState('');
  const [filtroOrigem,   setFiltroOrigem]   = useState('');
  const [filtroCategoria,setFiltroCategoria]= useState('');
  const [filtroStatus,   setFiltroStatus]   = useState('');
  const [filtroDescricao,setFiltroDescricao]= useState('');

  // ── Resultados e seleção ─────────────────────────────────────────────────
  const [resultados,   setResultados]   = useState([]);
  const [selecionados, setSelecionados] = useState(new Set());
  const [buscando,     setBuscando]     = useState(false);
  const [buscaFeita,   setBuscaFeita]   = useState(false);

  // ── Ação ─────────────────────────────────────────────────────────────────
  const [modoAcao,     setModoAcao]     = useState('editar'); // 'editar' | 'excluir'
  const [processando,  setProcessando]  = useState(false);
  const [msg,          setMsg]          = useState('');
  const [msgTipo,      setMsgTipo]      = useState(''); // 'ok' | 'erro' | 'aviso'

  // Campos editáveis — cada um tem { ativo, valor }
  const [campos, setCampos] = useState({
    data_vencimento:  { ativo: false, valor: '' },
    data_lancamento:  { ativo: false, valor: '' },
    descricao:        { ativo: false, valor: '' },
    valor:            { ativo: false, valor: '' },
    status:           { ativo: false, valor: 'pendente' },
    categoria_id:     { ativo: false, valor: '' },
  });

  const [confirmExcluir, setConfirmExcluir] = useState(false);

  useEffect(() => {
    if (!aberto) { setResultados([]); setSelecionados(new Set()); setBuscaFeita(false); setMsg(''); setConfirmExcluir(false); }
  }, [aberto]);

  if (!aberto) return null;

  const fmt = (d) => { if (!d) return '—'; const [a,m,dia]=d.split('T')[0].split('-'); return `${dia}/${m}/${a}`; };
  const fmtV = (v) => `R$ ${parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}`;

  // ── BUSCAR ────────────────────────────────────────────────────────────────
  const buscar = async () => {
    setBuscando(true); setMsg(''); setResultados([]); setSelecionados(new Set()); setBuscaFeita(false);
    try {
      const dataInicio = `${filtroAno}-${String(filtroMes).padStart(2,'0')}-01`;
      const ultimoDia  = new Date(filtroAno, filtroMes, 0).getDate();
      const dataFim    = `${filtroAno}-${String(filtroMes).padStart(2,'0')}-${String(ultimoDia).padStart(2,'0')}`;

      let q = supabase.from('lancamentos_loja')
        .select('id, tipo, descricao, valor, status, data_vencimento, data_lancamento, data_pagamento, tipo_pagamento, categoria_id, origem_tipo, origem_irmao_id, eh_transferencia_interna, eh_pagamento_parcial, categorias_financeiras(nome, tipo), irmaos(nome)')
        .gte('data_vencimento', dataInicio)
        .lte('data_vencimento', dataFim)
        .order('data_vencimento', { ascending: true })
        .limit(500);

      if (filtroTipo)      q = q.eq('tipo', filtroTipo);
      if (filtroStatus)    q = q.eq('status', filtroStatus);
      if (filtroOrigem)    q = q.eq('origem_tipo', filtroOrigem);
      if (filtroCategoria) q = q.eq('categoria_id', filtroCategoria);
      if (filtroDescricao) q = q.ilike('descricao', `%${filtroDescricao}%`);

      const { data, error } = await q;
      if (error) throw error;
      setResultados(data || []);
      setBuscaFeita(true);
    } catch(e) {
      setMsg('Erro ao buscar: ' + e.message); setMsgTipo('erro');
    } finally { setBuscando(false); }
  };

  // ── SELEÇÃO ───────────────────────────────────────────────────────────────
  const toggleSel = (id) => setSelecionados(s => { const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n; });
  const selectAll = () => setSelecionados(new Set(resultados.map(r=>r.id)));
  const clearAll  = () => setSelecionados(new Set());

  const setCampo = (campo, key, val) => setCampos(p=>({...p,[campo]:{...p[campo],[key]:val}}));

  // ── Verificar bloqueados ───────────────────────────────────────────────────
  const getBloqueados = () => {
    if (!verificarMesBloqueado) return [];
    return resultados.filter(r => selecionados.has(r.id) && r.status !== 'pendente' &&
      verificarMesBloqueado(r.data_pagamento || r.data_lancamento || r.data_vencimento));
  };

  // ── APLICAR EDIÇÃO ────────────────────────────────────────────────────────
  const aplicarEdicao = async () => {
    const ids = [...selecionados];
    if (!ids.length) { setMsg('Selecione pelo menos um registro.'); setMsgTipo('aviso'); return; }

    const bloqueados = getBloqueados();
    if (bloqueados.length) {
      setMsg(`⚠️ ${bloqueados.length} registro(s) estão em mês fechado e não podem ser editados. Desmarque-os antes de continuar.`);
      setMsgTipo('aviso'); return;
    }

    const camposAtivos = Object.entries(campos).filter(([,v])=>v.ativo);
    if (!camposAtivos.length) { setMsg('Ative pelo menos um campo para editar.'); setMsgTipo('aviso'); return; }

    // Validar valor se ativo
    if (campos.valor.ativo && (isNaN(parseFloat(campos.valor.valor)) || parseFloat(campos.valor.valor) <= 0)) {
      setMsg('Valor inválido.'); setMsgTipo('aviso'); return;
    }

    setProcessando(true); setMsg('');
    try {
      const payload = {};
      camposAtivos.forEach(([k,v])=>{
        if (k==='valor') payload[k] = parseFloat(v.valor);
        else if (k==='categoria_id') payload[k] = parseInt(v.valor);
        else payload[k] = v.valor || null;
      });

      // Fazer em batches de 50 para evitar timeout
      const batch = 50;
      for (let i=0; i<ids.length; i+=batch) {
        const chunk = ids.slice(i, i+batch);
        const { error } = await supabase.from('lancamentos_loja').update(payload).in('id', chunk);
        if (error) throw error;
      }

      setMsg(`✅ ${ids.length} registro(s) atualizados com sucesso!`); setMsgTipo('ok');
      setSelecionados(new Set());
      // Resetar campos
      setCampos({ data_vencimento:{ativo:false,valor:''}, data_lancamento:{ativo:false,valor:''},
        descricao:{ativo:false,valor:''}, valor:{ativo:false,valor:''},
        status:{ativo:false,valor:'pendente'}, categoria_id:{ativo:false,valor:''} });
      await buscar();
      onAtualizar?.();
    } catch(e) {
      setMsg('Erro ao editar: ' + e.message); setMsgTipo('erro');
    } finally { setProcessando(false); }
  };

  // ── EXCLUIR ───────────────────────────────────────────────────────────────
  const aplicarExclusao = async () => {
    const ids = [...selecionados];
    if (!ids.length) { setMsg('Selecione pelo menos um registro.'); setMsgTipo('aviso'); return; }

    const bloqueados = getBloqueados();
    if (bloqueados.length) {
      setMsg(`⚠️ ${bloqueados.length} registro(s) em mês fechado não podem ser excluídos.`);
      setMsgTipo('aviso'); return;
    }

    setProcessando(true); setMsg('');
    try {
      const batch = 50;
      for (let i=0; i<ids.length; i+=batch) {
        const chunk = ids.slice(i, i+batch);
        const { error } = await supabase.from('lancamentos_loja').delete().in('id', chunk);
        if (error) throw error;
      }
      setMsg(`✅ ${ids.length} registro(s) excluídos.`); setMsgTipo('ok');
      setSelecionados(new Set());
      setConfirmExcluir(false);
      await buscar();
      onAtualizar?.();
    } catch(e) {
      setMsg('Erro ao excluir: ' + e.message); setMsgTipo('erro');
    } finally { setProcessando(false); }
  };

  const selArray   = [...selecionados];
  const bloqueados = getBloqueados();
  const corMsg     = msgTipo==='ok'?'#10b981':msgTipo==='erro'?'#ef4444':'#f59e0b';

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'flex-start',justifyContent:'center',zIndex:9999,padding:'1rem',overflowY:'auto'}}>
      <div style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-xl)',width:'100%',maxWidth:'1100px',marginTop:'1rem',overflow:'hidden',boxShadow:'0 24px 64px rgba(0,0,0,0.35)'}}>

        {/* Header */}
        <div style={{background:'#7c3aed',padding:'1rem 1.5rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <h3 style={{color:'#fff',fontWeight:800,margin:0,fontSize:'1.1rem'}}>✏️ Edição / Exclusão em Lote</h3>
            <p style={{color:'rgba(255,255,255,0.75)',fontSize:'0.78rem',margin:'0.2rem 0 0'}}>Busque, selecione e altere ou exclua múltiplos registros de uma vez</p>
          </div>
          <button onClick={onFechar} style={{background:'rgba(255,255,255,0.15)',border:'none',color:'#fff',borderRadius:'50%',width:'2rem',height:'2rem',cursor:'pointer',fontWeight:700,fontSize:'1.2rem'}}>×</button>
        </div>

        <div style={{padding:'1.25rem',display:'flex',flexDirection:'column',gap:'1rem'}}>

          {/* ── ETAPA 1: FILTROS ─────────────────────────────────────────── */}
          <div style={{background:'var(--color-surface-2)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-lg)',padding:'1rem'}}>
            <p style={{fontWeight:700,color:'var(--color-text)',margin:'0 0 0.75rem',fontSize:'0.9rem'}}>🔍 1. Filtrar Registros</p>
            <div style={{display:'grid',gridTemplateColumns:'100px 80px 120px 120px 1fr 150px',gap:'0.6rem',alignItems:'end'}}>
              <div><label style={lbl}>Mês</label>
                <select style={inp} value={filtroMes} onChange={e=>setFiltroMes(Number(e.target.value))}>
                  {MESES.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Ano</label>
                <select style={inp} value={filtroAno} onChange={e=>setFiltroAno(Number(e.target.value))}>
                  {ANOS.map(a=><option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Tipo</label>
                <select style={inp} value={filtroTipo} onChange={e=>setFiltroTipo(e.target.value)}>
                  <option value="">Todos</option>
                  <option value="receita">Receita</option>
                  <option value="despesa">Despesa</option>
                </select>
              </div>
              <div><label style={lbl}>Status</label>
                <select style={inp} value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)}>
                  <option value="">Todos</option>
                  <option value="pendente">Pendente</option>
                  <option value="pago">Pago</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
              <div><label style={lbl}>Descrição (contém)</label>
                <input style={inp} value={filtroDescricao} onChange={e=>setFiltroDescricao(e.target.value)}
                  placeholder="Ex: MENSALIDADE" onKeyDown={e=>e.key==='Enter'&&buscar()} />
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:'0.3rem'}}>
                <label style={lbl}>Categoria</label>
                <select style={inp} value={filtroCategoria} onChange={e=>setFiltroCategoria(e.target.value)}>
                  <option value="">Todas</option>
                  {categorias.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            </div>
            <div style={{marginTop:'0.75rem',display:'flex',gap:'0.5rem',alignItems:'center'}}>
              <button onClick={buscar} disabled={buscando} style={{...btn('#7c3aed'),opacity:buscando?0.7:1}}>
                {buscando ? '⏳ Buscando...' : '🔍 Buscar'}
              </button>
              <button onClick={()=>{setFiltroTipo('');setFiltroStatus('');setFiltroOrigem('');setFiltroCategoria('');setFiltroDescricao('');}}
                style={btn('var(--color-surface-2)','var(--color-text-muted)')}>
                ✕ Limpar filtros
              </button>
              {buscaFeita && <span style={{fontSize:'0.78rem',color:'var(--color-text-muted)'}}>
                {resultados.length} registro(s) encontrado(s)
              </span>}
            </div>
          </div>

          {/* ── ETAPA 2: LISTA DE RESULTADOS ─────────────────────────────── */}
          {buscaFeita && (
            <div style={{border:'1px solid var(--color-border)',borderRadius:'var(--radius-lg)',overflow:'hidden'}}>
              {/* Barra de seleção */}
              <div style={{padding:'0.6rem 1rem',background:'var(--color-surface-2)',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid var(--color-border)'}}>
                <div style={{display:'flex',gap:'0.5rem',alignItems:'center'}}>
                  <span style={{fontSize:'0.82rem',fontWeight:700,color:'var(--color-text)'}}>
                    {selArray.length > 0 ? `${selArray.length} de ${resultados.length} selecionados` : `${resultados.length} registros`}
                  </span>
                  <button onClick={selectAll} style={{...btn('var(--color-surface)','var(--color-text)'),padding:'0.25rem 0.65rem',fontSize:'0.72rem',border:'1px solid var(--color-border)'}}>✅ Todos</button>
                  <button onClick={clearAll}  style={{...btn('var(--color-surface)','var(--color-text)'),padding:'0.25rem 0.65rem',fontSize:'0.72rem',border:'1px solid var(--color-border)'}}>✕ Limpar</button>
                </div>
                {selArray.length > 0 && bloqueados.length > 0 && (
                  <span style={{fontSize:'0.72rem',color:'#f59e0b',fontWeight:700}}>
                    ⚠️ {bloqueados.length} em mês fechado serão ignorados
                  </span>
                )}
              </div>

              {/* Tabela */}
              {resultados.length === 0 ? (
                <div style={{padding:'2rem',textAlign:'center',color:'var(--color-text-muted)'}}>Nenhum registro encontrado para os filtros selecionados.</div>
              ) : (
                <div style={{maxHeight:'280px',overflowY:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.8rem'}}>
                    <thead style={{position:'sticky',top:0,zIndex:1}}>
                      <tr style={{background:'var(--color-surface-2)'}}>
                        <th style={{padding:'0.4rem 0.6rem',width:'32px'}}></th>
                        <th style={{padding:'0.4rem 0.6rem',textAlign:'left',color:'var(--color-text-muted)',fontWeight:700}}>Origem</th>
                        <th style={{padding:'0.4rem 0.6rem',textAlign:'left',color:'var(--color-text-muted)',fontWeight:700}}>Categoria</th>
                        <th style={{padding:'0.4rem 0.6rem',textAlign:'left',color:'var(--color-text-muted)',fontWeight:700}}>Descrição</th>
                        <th style={{padding:'0.4rem 0.6rem',textAlign:'center',color:'var(--color-text-muted)',fontWeight:700}}>Vencimento</th>
                        <th style={{padding:'0.4rem 0.6rem',textAlign:'right',color:'var(--color-text-muted)',fontWeight:700}}>Valor</th>
                        <th style={{padding:'0.4rem 0.6rem',textAlign:'center',color:'var(--color-text-muted)',fontWeight:700}}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultados.map((r,idx)=>{
                        const sel = selecionados.has(r.id);
                        const bloq = r.status!=='pendente' && verificarMesBloqueado?.(r.data_pagamento||r.data_lancamento||r.data_vencimento);
                        const corStatus = r.status==='pago'?'#10b981':r.status==='pendente'?'#f59e0b':'#94a3b8';
                        return (
                          <tr key={r.id} onClick={()=>toggleSel(r.id)} style={{
                            cursor:'pointer', borderBottom:'1px solid var(--color-border)',
                            background: sel ? 'rgba(124,58,237,0.08)' : idx%2===0 ? 'transparent' : 'rgba(0,0,0,0.03)',
                            opacity: bloq ? 0.5 : 1
                          }}>
                            <td style={{padding:'0.4rem 0.6rem',textAlign:'center'}}>
                              <input type="checkbox" checked={sel} onChange={()=>toggleSel(r.id)}
                                style={{accentColor:'#7c3aed',width:'14px',height:'14px'}} onClick={e=>e.stopPropagation()} />
                            </td>
                            <td style={{padding:'0.4rem 0.6rem',color:'var(--color-text-muted)',maxWidth:'120px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                              {r.irmaos?.nome || r.origem_tipo || '—'}
                            </td>
                            <td style={{padding:'0.4rem 0.6rem',color:'var(--color-text-muted)',maxWidth:'110px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                              {r.categorias_financeiras?.nome || '—'}
                            </td>
                            <td style={{padding:'0.4rem 0.6rem',color:'var(--color-text)',fontWeight:600,maxWidth:'180px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                              {r.descricao}
                              {r.eh_pagamento_parcial && <span style={{marginLeft:'0.3rem',fontSize:'0.65rem',color:'#8b5cf6'}}>parcial</span>}
                              {bloq && <span style={{marginLeft:'0.3rem',fontSize:'0.65rem',color:'#f59e0b'}}>🔒</span>}
                            </td>
                            <td style={{padding:'0.4rem 0.6rem',textAlign:'center',color:'var(--color-text-muted)'}}>{fmt(r.data_vencimento)}</td>
                            <td style={{padding:'0.4rem 0.6rem',textAlign:'right',fontWeight:700,color:r.tipo==='receita'?'#ef4444':'#3b82f6'}}>{fmtV(r.valor)}</td>
                            <td style={{padding:'0.4rem 0.6rem',textAlign:'center'}}>
                              <span style={{padding:'0.1rem 0.45rem',borderRadius:'999px',fontSize:'0.68rem',fontWeight:700,background:`${corStatus}18`,color:corStatus}}>
                                {r.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── ETAPA 3: AÇÃO ────────────────────────────────────────────── */}
          {selArray.length > 0 && (
            <div style={{border:'1px solid var(--color-border)',borderRadius:'var(--radius-lg)',overflow:'hidden'}}>
              {/* Abas Editar / Excluir */}
              <div style={{display:'flex',borderBottom:'1px solid var(--color-border)'}}>
                {[['editar','✏️ Editar','#7c3aed'],['excluir','🗑️ Excluir','#ef4444']].map(([modo,label,cor])=>(
                  <button key={modo} onClick={()=>{setModoAcao(modo);setMsg('');setConfirmExcluir(false);}} style={{
                    flex:1,padding:'0.6rem',fontWeight:700,fontSize:'0.85rem',cursor:'pointer',border:'none',
                    background: modoAcao===modo ? `${cor}15` : 'var(--color-surface-2)',
                    color: modoAcao===modo ? cor : 'var(--color-text-muted)',
                    borderBottom: modoAcao===modo ? `2px solid ${cor}` : '2px solid transparent',
                  }}>{label} ({selArray.length})</button>
                ))}
              </div>

              <div style={{padding:'1rem'}}>
                {/* MODO EDITAR */}
                {modoAcao === 'editar' && (
                  <>
                    <p style={{fontSize:'0.78rem',color:'var(--color-text-muted)',margin:'0 0 0.75rem'}}>
                      Ative (☑) apenas os campos que deseja alterar. Campos inativos não serão modificados.
                    </p>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0.65rem'}}>
                      {[
                        {key:'data_vencimento', label:'Data Vencimento', tipo:'date'},
                        {key:'data_lancamento',  label:'Data Lançamento',  tipo:'date'},
                        {key:'descricao',        label:'Descrição',        tipo:'text'},
                        {key:'valor',            label:'Valor (R$)',       tipo:'number'},
                        {key:'status',           label:'Status',           tipo:'select', opts:[{v:'pendente',l:'Pendente'},{v:'pago',l:'Pago'},{v:'cancelado',l:'Cancelado'}]},
                        {key:'categoria_id',     label:'Categoria',        tipo:'select_cat'},
                      ].map(({key,label,tipo,opts})=>(
                        <div key={key} style={{padding:'0.6rem',borderRadius:'var(--radius-md)',border:'1px solid',borderColor:campos[key].ativo?'#7c3aed':'var(--color-border)',background:campos[key].ativo?'rgba(124,58,237,0.05)':'transparent'}}>
                          <label style={{display:'flex',alignItems:'center',gap:'0.4rem',cursor:'pointer',marginBottom:'0.4rem'}}>
                            <input type="checkbox" checked={campos[key].ativo} onChange={e=>setCampo(key,'ativo',e.target.checked)}
                              style={{accentColor:'#7c3aed',width:'14px',height:'14px'}} />
                            <span style={{fontSize:'0.72rem',fontWeight:700,color:campos[key].ativo?'#7c3aed':'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.04em'}}>{label}</span>
                          </label>
                          {tipo==='date' && <input type="date" style={{...inp,opacity:campos[key].ativo?1:0.4}} disabled={!campos[key].ativo}
                            value={campos[key].valor} onChange={e=>setCampo(key,'valor',e.target.value)} />}
                          {tipo==='text' && <input type="text" style={{...inp,opacity:campos[key].ativo?1:0.4}} disabled={!campos[key].ativo}
                            value={campos[key].valor} onChange={e=>setCampo(key,'valor',e.target.value)} placeholder="Nova descrição..." />}
                          {tipo==='number' && <input type="number" style={{...inp,opacity:campos[key].ativo?1:0.4}} disabled={!campos[key].ativo}
                            value={campos[key].valor} onChange={e=>setCampo(key,'valor',e.target.value)} placeholder="0,00" min="0" step="0.01" />}
                          {tipo==='select' && <select style={{...inp,opacity:campos[key].ativo?1:0.4}} disabled={!campos[key].ativo}
                            value={campos[key].valor} onChange={e=>setCampo(key,'valor',e.target.value)}>
                            {opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                          </select>}
                          {tipo==='select_cat' && <select style={{...inp,opacity:campos[key].ativo?1:0.4}} disabled={!campos[key].ativo}
                            value={campos[key].valor} onChange={e=>setCampo(key,'valor',e.target.value)}>
                            <option value="">Selecione...</option>
                            {categorias.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
                          </select>}
                        </div>
                      ))}
                    </div>
                    <div style={{marginTop:'0.85rem',display:'flex',gap:'0.5rem',alignItems:'center'}}>
                      <button onClick={aplicarEdicao} disabled={processando} style={{...btn('#7c3aed'),opacity:processando?0.7:1}}>
                        {processando ? '⏳ Aplicando...' : `💾 Aplicar em ${selArray.length} registro(s)`}
                      </button>
                      {bloqueados.length > 0 && (
                        <span style={{fontSize:'0.72rem',color:'#f59e0b',fontWeight:700}}>
                          ⚠️ {bloqueados.length} registro(s) com 🔒 serão ignorados
                        </span>
                      )}
                    </div>
                  </>
                )}

                {/* MODO EXCLUIR */}
                {modoAcao === 'excluir' && (
                  <>
                    <div style={{padding:'0.75rem',background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.25)',borderRadius:'var(--radius-md)',marginBottom:'0.75rem'}}>
                      <p style={{fontWeight:700,color:'#ef4444',margin:'0 0 0.3rem',fontSize:'0.85rem'}}>⚠️ Atenção — Ação irreversível</p>
                      <p style={{color:'var(--color-text-muted)',fontSize:'0.78rem',margin:0}}>
                        Serão excluídos <strong style={{color:'#ef4444'}}>{selArray.length} registro(s)</strong> permanentemente.
                        {bloqueados.length>0 && ` ${bloqueados.length} em mês fechado serão ignorados.`}
                      </p>
                    </div>
                    {/* Lista resumida dos selecionados */}
                    <div style={{maxHeight:'140px',overflowY:'auto',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',marginBottom:'0.75rem'}}>
                      {resultados.filter(r=>selecionados.has(r.id)).map(r=>(
                        <div key={r.id} style={{display:'flex',justifyContent:'space-between',padding:'0.35rem 0.7rem',borderBottom:'1px solid var(--color-border)',fontSize:'0.78rem'}}>
                          <span style={{color:'var(--color-text)',fontWeight:600}}>{r.irmaos?.nome||r.origem_tipo} — {r.descricao}</span>
                          <span style={{color:r.tipo==='receita'?'#ef4444':'#3b82f6',fontWeight:700,flexShrink:0,marginLeft:'0.5rem'}}>{fmtV(r.valor)}</span>
                        </div>
                      ))}
                    </div>
                    {!confirmExcluir ? (
                      <button onClick={()=>setConfirmExcluir(true)} style={btn('#ef4444')}>
                        🗑️ Excluir {selArray.length} registro(s)
                      </button>
                    ) : (
                      <div style={{display:'flex',gap:'0.5rem',alignItems:'center'}}>
                        <span style={{fontSize:'0.82rem',fontWeight:700,color:'#ef4444'}}>Confirma a exclusão?</span>
                        <button onClick={aplicarExclusao} disabled={processando} style={{...btn('#ef4444'),opacity:processando?0.7:1}}>
                          {processando ? '⏳ Excluindo...' : '✅ Sim, excluir'}
                        </button>
                        <button onClick={()=>setConfirmExcluir(false)} style={btn('var(--color-surface-2)','var(--color-text-muted)')}>
                          Cancelar
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Mensagem de retorno */}
          {msg && (
            <div style={{padding:'0.6rem 0.9rem',borderRadius:'var(--radius-md)',border:`1px solid ${corMsg}40`,background:`${corMsg}10`,fontSize:'0.83rem',fontWeight:600,color:corMsg}}>
              {msg}
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{padding:'0.85rem 1.5rem',borderTop:'1px solid var(--color-border)',display:'flex',justifyContent:'flex-end'}}>
          <button onClick={onFechar} style={btn('var(--color-surface-2)','var(--color-text-muted)')}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
