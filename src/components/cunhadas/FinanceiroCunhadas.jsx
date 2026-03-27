/**
 * FINANCEIRO CUNHADAS - Versão completa com resumo financeiro
 *
 * SQL MIGRATION (Supabase SQL Editor):
 * ALTER TABLE categorias_financeiras_cunhadas
 *   ADD COLUMN IF NOT EXISTS categoria_pai_id UUID REFERENCES categorias_financeiras_cunhadas(id),
 *   ADD COLUMN IF NOT EXISTS nivel INTEGER DEFAULT 1,
 *   ADD COLUMN IF NOT EXISTS ordem INTEGER DEFAULT 0;
 */
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';

const fmtM = (v) => Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const fmtD = (d) => { if(!d)return'—'; const[y,m,dia]=d.split('-'); return`${dia}/${m}/${y}`; };
const MESES=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const HOJE=new Date();
const FPGTO=[{v:'dinheiro',l:'💵 Dinheiro'},{v:'pix',l:'📱 PIX'},{v:'transferencia',l:'🏦 Transferência'},{v:'debito',l:'💳 Débito'},{v:'credito',l:'💳 Crédito'},{v:'cheque',l:'📝 Cheque'}];
const FVAZIO={tipo:'receita',categoria_id:'',descricao:'',valor:'',data_lancamento:HOJE.toISOString().slice(0,10),data_vencimento:'',cunhada_id:'',pago:false,forma_pagamento:'',observacoes:''};
const LVAZIO={categoria_id:'',descricao:'',valor:'',data_lancamento:HOJE.toISOString().slice(0,10),data_vencimento:'',forma_pagamento:'',cunhadas_selecionadas:[]};

const s={
  inp:{width:'100%',padding:'0.6rem 0.85rem',background:'var(--color-surface-2)',border:'2px solid var(--color-border)',borderRadius:'var(--radius-lg)',color:'var(--color-text)',fontSize:'0.875rem',outline:'none',boxSizing:'border-box',fontFamily:'var(--font-sans)'},
  sel:{width:'100%',padding:'0.6rem 0.85rem',background:'var(--color-surface-2)',border:'2px solid var(--color-border)',borderRadius:'var(--radius-lg)',color:'var(--color-text)',fontSize:'0.875rem',outline:'none',boxSizing:'border-box'},
  ta:{width:'100%',padding:'0.6rem 0.85rem',background:'var(--color-surface-2)',border:'2px solid var(--color-border)',borderRadius:'var(--radius-lg)',color:'var(--color-text)',fontSize:'0.875rem',outline:'none',resize:'vertical',minHeight:'70px',boxSizing:'border-box',fontFamily:'var(--font-sans)'},
  card:{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-xl)',padding:'1.5rem',boxShadow:'var(--shadow-sm)'},
  csm:{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-lg)',padding:'0.9rem 1rem',boxShadow:'var(--shadow-sm)'},
  ov:{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:'1rem'},
  mo:{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-2xl)',width:'100%',maxWidth:'640px',maxHeight:'90vh',overflowY:'auto',boxShadow:'var(--shadow-xl)'},
  mol:{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-2xl)',width:'100%',maxWidth:'860px',maxHeight:'90vh',overflowY:'auto',boxShadow:'var(--shadow-xl)'},
  mh:{padding:'1.25rem 1.75rem',borderBottom:'1px solid var(--color-border)',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,background:'var(--color-surface)',zIndex:1},
  mb:{padding:'1.5rem 1.75rem'},
  mf:{padding:'1rem 1.75rem',borderTop:'1px solid var(--color-border)',display:'flex',justifyContent:'flex-end',gap:'0.75rem',position:'sticky',bottom:0,background:'var(--color-surface)'},
  bp:(c)=>({background:c,color:'#fff',border:'none',borderRadius:'var(--radius-lg)',padding:'0.58rem 1.15rem',fontWeight:'600',fontSize:'0.875rem',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:'0.4rem',whiteSpace:'nowrap'}),
  bs:{padding:'0.5rem 1rem',background:'var(--color-surface-2)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-lg)',color:'var(--color-text)',fontWeight:'600',fontSize:'0.875rem',cursor:'pointer'},
  nb:(a)=>({padding:'0.5rem 1rem',borderRadius:'var(--radius-lg)',border:'1px solid',borderColor:a?'var(--color-accent)':'var(--color-border)',background:a?'var(--color-accent)':'var(--color-surface-2)',color:a?'#fff':'var(--color-text)',fontWeight:a?'600':'400',fontSize:'0.85rem',cursor:'pointer',whiteSpace:'nowrap'}),
  bdg:(p)=>({display:'inline-flex',alignItems:'center',gap:'0.25rem',padding:'0.18rem 0.5rem',borderRadius:'999px',fontSize:'0.68rem',fontWeight:'600',background:p?'rgba(16,185,129,0.12)':'rgba(245,158,11,0.12)',color:p?'#10b981':'#f59e0b',border:`1px solid ${p?'rgba(16,185,129,0.3)':'rgba(245,158,11,0.3)'}`}),
  ib:{background:'var(--color-accent-bg)',border:'1px solid var(--color-accent)',borderRadius:'var(--radius-lg)',padding:'0.8rem 1rem'},
  ab:{padding:'0.3rem 0.6rem',background:'var(--color-surface-2)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',color:'var(--color-text)',cursor:'pointer',fontSize:'0.9rem',fontWeight:'700'},
};

const Lbl=({l,ch,st})=>(
  <div style={st}>
    <label style={{display:'block',fontSize:'0.7rem',fontWeight:'600',color:'var(--color-text-muted)',marginBottom:'0.3rem',textTransform:'uppercase',letterSpacing:'0.04em'}}>{l}</label>
    {ch}
  </div>
);

export const FinanceiroCunhadas=({userData})=>{
  const[aba,setAba]=useState('lancamentos');
  const[lancamentos,setLancamentos]=useState([]);
  const[todos,setTodos]=useState([]);
  const[mensalidades,setMensalidades]=useState([]);
  const[cunhadas,setCunhadas]=useState([]);
  const[categorias,setCategorias]=useState([]);
  const[config,setConfig]=useState({valor_mensalidade:'50.00',dia_vencimento:'10'});
  const[saldoAnt,setSaldoAnt]=useState(0);
  const[loading,setLoading]=useState(true);
  const[msg,setMsg]=useState({tipo:'',texto:''});
  const[nomeGrupo,setNomeGrupo]=useState('Flores de Acácia');
  const[filtros,setFiltros]=useState({mes:HOJE.getMonth()+1,ano:HOJE.getFullYear(),tipo:'',categoria_id:'',status:'',cunhada_id:''});
  const[mesMens,setMesMens]=useState(HOJE.getMonth()+1);
  const[anoMens,setAnoMens]=useState(HOJE.getFullYear());
  // modais lançamento
  const[mAberto,setMAberto]=useState(false);
  const[editId,setEditId]=useState(null);
  const[form,setForm]=useState(FVAZIO);
  const[salv,setSalv]=useState(false);
  // modal lote
  const[mLote,setMLote]=useState(false);
  const[fLote,setFLote]=useState(LVAZIO);
  const[salvL,setSalvL]=useState(false);
  // modal quitacao individual
  const[mQuit,setMQuit]=useState(null);
  const[qForm,setQForm]=useState({forma_pagamento:'pix',observacoes:''});
  const[salvQ,setSalvQ]=useState(false);
  // modal quitacao lote
  const[mQLote,setMQLote]=useState(false);
  const[selQ,setSelQ]=useState([]);
  const[qLForm,setQLForm]=useState({forma_pagamento:'pix'});
  const[salvQL,setSalvQL]=useState(false);
  // modal config
  const[mCfg,setMCfg]=useState(false);
  const[cfgForm,setCfgForm]=useState({valor_mensalidade:'',dia_vencimento:''});
  const[salvCfg,setSalvCfg]=useState(false);
  // modal excluir
  const[mExcl,setMExcl]=useState(null);
  // modal categoria
  const[mCat,setMCat]=useState(false);
  const[catF,setCatF]=useState({nome:'',tipo:'receita',categoria_pai_id:null,ordem:0});
  const[editCatId,setEditCatId]=useState(null);
  const[salvCat,setSalvCat]=useState(false);

  const showMsg=(t,x)=>{setMsg({tipo:t,texto:x});setTimeout(()=>setMsg({tipo:'',texto:''}),4000);};

  const carregarTudo=useCallback(async()=>{
    setLoading(true);
    try{
      const[{data:lanc},{data:mens},{data:cunh},{data:cats},{data:cfgs}]=await Promise.all([
        supabase.from('financeiro_cunhadas').select('*,categoria:categorias_financeiras_cunhadas(nome,tipo),cunhada:cunhadas(nome)').order('data_lancamento',{ascending:false}),
        supabase.from('mensalidades_cunhadas').select('*,cunhada:cunhadas(nome)').order('ano',{ascending:false}).order('mes',{ascending:false}),
        supabase.from('cunhadas').select('id,nome').eq('ativa',true).order('nome'),
        supabase.from('categorias_financeiras_cunhadas').select('*').order('tipo').order('nome'),
        supabase.from('configuracoes_cunhadas').select('*'),
      ]);
      setTodos(lanc||[]);setMensalidades(mens||[]);setCunhadas(cunh||[]);setCategorias(cats||[]);
      if(cfgs){const o={};cfgs.forEach(c=>o[c.chave]=c.valor);setConfig(o);setCfgForm({valor_mensalidade:o.valor_mensalidade||'50.00',dia_vencimento:o.dia_vencimento||'10'});if(o.nome_grupo)setNomeGrupo(o.nome_grupo);}
    }catch(e){showMsg('erro','Erro: '+e.message);}finally{setLoading(false);}
  },[]);

  useEffect(()=>{carregarTudo();},[carregarTudo]);

  // Filtrar lançamentos
  useEffect(()=>{
    const{mes,ano,tipo,categoria_id,status,cunhada_id}=filtros;
    setLancamentos(todos.filter(l=>{
      const[y,m]=l.data_lancamento.split('-');
      if(parseInt(m)!==mes||parseInt(y)!==ano)return false;
      if(tipo&&l.categoria?.tipo!==tipo)return false;
      if(categoria_id&&l.categoria_id!==categoria_id)return false;
      if(status==='pago'&&!l.pago)return false;
      if(status==='pendente'&&l.pago)return false;
      if(cunhada_id&&l.cunhada_id!==cunhada_id)return false;
      return true;
    }));
  },[todos,filtros]);

  // Saldo anterior
  useEffect(()=>{
    const{mes,ano}=filtros;
    const lim=`${ano}-${mes.toString().padStart(2,'0')}-01`;
    const ant=todos.filter(l=>l.pago&&l.data_lancamento<lim);
    setSaldoAnt(ant.filter(l=>l.tipo==='receita').reduce((s,l)=>s+Number(l.valor),0)-ant.filter(l=>l.tipo==='despesa').reduce((s,l)=>s+Number(l.valor),0));
  },[todos,filtros.mes,filtros.ano]);

  const resumo=()=>{
    const rP=lancamentos.filter(l=>l.tipo==='receita'&&l.pago).reduce((s,l)=>s+Number(l.valor),0);
    const dP=lancamentos.filter(l=>l.tipo==='despesa'&&l.pago).reduce((s,l)=>s+Number(l.valor),0);
    const sp=rP-dP;
    const st=saldoAnt+sp;
    const aR=lancamentos.filter(l=>l.tipo==='receita'&&!l.pago).reduce((s,l)=>s+Number(l.valor),0);
    const aP=lancamentos.filter(l=>l.tipo==='despesa'&&!l.pago).reduce((s,l)=>s+Number(l.valor),0);
    return{rP,dP,sp,st,aR,aP};
  };
  const R=resumo();
  const mensM=mensalidades.filter(m=>m.mes===mesMens&&m.ano===anoMens);
  const per=`${MESES[filtros.mes-1]}/${filtros.ano}`;

  const navMes=dir=>{let m=filtros.mes+dir,a=filtros.ano;if(m>12){m=1;a++;}if(m<1){m=12;a--;}setFiltros({...filtros,mes:m,ano:a});};

  // CRUD lançamentos
  const salvarLanc=async()=>{
    if(!form.descricao.trim()){showMsg('erro','Descrição obrigatória.');return;}
    if(!form.valor||isNaN(parseFloat(form.valor))){showMsg('erro','Valor inválido.');return;}
    setSalv(true);
    try{
      const p={...form,valor:parseFloat(form.valor.toString().replace(',','.')),cunhada_id:form.cunhada_id||null,categoria_id:form.categoria_id||null,data_vencimento:form.data_vencimento||null,forma_pagamento:form.forma_pagamento||null};
      if(editId){const{error}=await supabase.from('financeiro_cunhadas').update(p).eq('id',editId);if(error)throw error;showMsg('sucesso','Atualizado!');}
      else{const{error}=await supabase.from('financeiro_cunhadas').insert([p]);if(error)throw error;showMsg('sucesso','Registrado!');}
      setMAberto(false);setEditId(null);setForm(FVAZIO);carregarTudo();
    }catch(e){showMsg('erro','Erro: '+e.message);}finally{setSalv(false);}
  };

  const salvarLote=async()=>{
    if(!fLote.cunhadas_selecionadas.length){showMsg('erro','Selecione cunhadas.');return;}
    if(!fLote.descricao.trim()||!fLote.valor){showMsg('erro','Preencha descrição e valor.');return;}
    setSalvL(true);
    try{
      const reg=fLote.cunhadas_selecionadas.map(cid=>({tipo:'receita',categoria_id:fLote.categoria_id||null,descricao:fLote.descricao,valor:parseFloat(fLote.valor),data_lancamento:fLote.data_lancamento,data_vencimento:fLote.data_vencimento||null,forma_pagamento:fLote.forma_pagamento||null,cunhada_id:cid,pago:false}));
      const{error}=await supabase.from('financeiro_cunhadas').insert(reg);
      if(error)throw error;
      showMsg('sucesso',`${reg.length} lançamento(s) criados!`);setMLote(false);setFLote(LVAZIO);carregarTudo();
    }catch(e){showMsg('erro','Erro: '+e.message);}finally{setSalvL(false);}
  };

  const quitarUm=async()=>{
    setSalvQ(true);
    try{
      const{error}=await supabase.from('financeiro_cunhadas').update({pago:true,forma_pagamento:qForm.forma_pagamento,observacoes:qForm.observacoes||null}).eq('id',mQuit.id);
      if(error)throw error;showMsg('sucesso','Quitado!');setMQuit(null);carregarTudo();
    }catch(e){showMsg('erro','Erro: '+e.message);}finally{setSalvQ(false);}
  };

  const desfazerQuit=async(id)=>{
    const{error}=await supabase.from('financeiro_cunhadas').update({pago:false,forma_pagamento:null}).eq('id',id);
    if(error)showMsg('erro','Erro');else{showMsg('sucesso','Desfeito.');carregarTudo();}
  };

  const quitarLote=async()=>{
    if(!selQ.length){showMsg('erro','Selecione lançamentos.');return;}
    setSalvQL(true);
    try{
      const{error}=await supabase.from('financeiro_cunhadas').update({pago:true,forma_pagamento:qLForm.forma_pagamento}).in('id',selQ);
      if(error)throw error;showMsg('sucesso',`${selQ.length} quitados!`);setMQLote(false);setSelQ([]);carregarTudo();
    }catch(e){showMsg('erro','Erro: '+e.message);}finally{setSalvQL(false);}
  };

  const excluir=async()=>{
    const{error}=await supabase.from('financeiro_cunhadas').delete().eq('id',mExcl.id);
    if(error)showMsg('erro','Erro');else{showMsg('sucesso','Excluído.');setMExcl(null);carregarTudo();}
  };

  const toggleMens=async(m)=>{
    const{error}=await supabase.from('mensalidades_cunhadas').update({pago:!m.pago,data_pagamento:!m.pago?HOJE.toISOString().slice(0,10):null}).eq('id',m.id);
    if(!error)carregarTudo();
  };

  const gerarMens=async()=>{
    const ja=mensM.map(m=>m.cunhada_id);
    const faltam=cunhadas.filter(c=>!ja.includes(c.id));
    if(!faltam.length){showMsg('sucesso','Já geradas!');return;}
    const{error}=await supabase.from('mensalidades_cunhadas').insert(faltam.map(c=>({cunhada_id:c.id,mes:mesMens,ano:anoMens,valor:parseFloat(config.valor_mensalidade),pago:false})));
    if(error)showMsg('erro','Erro');else{showMsg('sucesso',`${faltam.length} geradas!`);carregarTudo();}
  };

  const salvarCfg=async()=>{
    setSalvCfg(true);
    try{for(const[k,v]of Object.entries(cfgForm))await supabase.from('configuracoes_cunhadas').upsert({chave:k,valor:v.toString()},{onConflict:'chave'});
    showMsg('sucesso','Salvo!');setMCfg(false);carregarTudo();}catch(e){showMsg('erro','Erro: '+e.message);}finally{setSalvCfg(false);}
  };

  const fecharCat=()=>{setMCat(false);setEditCatId(null);setCatF({nome:'',tipo:'receita',categoria_pai_id:null,ordem:0});};
  const salvarCat=async()=>{
    if(!catF.nome.trim()){showMsg('erro','Nome obrigatório.');return;}
    setSalvCat(true);
    try{
      let nivel=1;
      if(catF.categoria_pai_id){const pai=categorias.find(c=>String(c.id)===String(catF.categoria_pai_id));nivel=pai?(pai.nivel||1)+1:1;}
      const p={nome:catF.nome,tipo:catF.tipo,categoria_pai_id:catF.categoria_pai_id||null,nivel,ordem:catF.ordem||0};
      if(editCatId){const{error}=await supabase.from('categorias_financeiras_cunhadas').update(p).eq('id',editCatId);if(error)throw error;showMsg('sucesso','Atualizado!');}
      else{const{error}=await supabase.from('categorias_financeiras_cunhadas').insert([p]);if(error)throw error;showMsg('sucesso','Criado!');}
      fecharCat();carregarTudo();
    }catch(e){showMsg('erro','Erro: '+e.message);}finally{setSalvCat(false);}
  };

  const excluirCat=async(id)=>{
    if(categorias.some(c=>String(c.categoria_pai_id)===String(id))){showMsg('erro','Remova subcategorias antes.');return;}
    if(!window.confirm('Excluir categoria?'))return;
    const{error}=await supabase.from('categorias_financeiras_cunhadas').delete().eq('id',id);
    if(error)showMsg('erro','Erro');else{showMsg('sucesso','Removida.');carregarTudo();}
  };

  const togCunh=id=>setFLote(p=>({...p,cunhadas_selecionadas:p.cunhadas_selecionadas.includes(id)?p.cunhadas_selecionadas.filter(x=>x!==id):[...p.cunhadas_selecionadas,id]}));
  const togSelQ=id=>setSelQ(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);

  // ── CARDS RESUMO ────────────────────────────────────────────────────────────
  const Cards=()=>(
    <div style={{display:'flex',flexDirection:'column',gap:'0.75rem',marginBottom:'1rem'}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'0.75rem'}}>
        {[
          {lbl:'💰 Saldo Anterior',val:fmtM(saldoAnt),cor:'#a855f7',sub:`Antes de ${per}`,neg:saldoAnt<0},
          {lbl:'📈 Receitas Pagas',val:fmtM(R.rP),cor:'#10b981',sub:`Total recebido · ${per}`},
          {lbl:'📉 Despesas Pagas',val:fmtM(R.dP),cor:'#ef4444',sub:`Total pago · ${per}`},
          {lbl:'📊 Saldo do Período',val:fmtM(R.sp),cor:R.sp>=0?'#06b6d4':'#ef4444',sub:'Receitas − Despesas',neg:R.sp<0},
        ].map(c=>(
          <div key={c.lbl} style={{...s.csm,borderLeft:`3px solid ${c.cor}`}}>
            <p style={{fontSize:'0.68rem',fontWeight:'700',color:c.cor,textTransform:'uppercase',letterSpacing:'0.04em',margin:'0 0 0.25rem'}}>{c.lbl}</p>
            <p style={{fontSize:'1.1rem',fontWeight:'700',color:c.neg?'#ef4444':c.cor,margin:0}}>{c.val}</p>
            <p style={{fontSize:'0.65rem',color:'var(--color-text-faint)',margin:'0.15rem 0 0'}}>{c.sub}</p>
          </div>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'0.75rem'}}>
        {[
          {lbl:'💎 Saldo Total',val:fmtM(R.st),cor:'var(--color-accent)',sub:'Anterior + Período',neg:R.st<0,bold:true},
          {lbl:'⏳ A Receber',val:fmtM(R.aR),cor:'#f59e0b',sub:`Receitas pendentes · ${per}`},
          {lbl:'⏰ A Pagar',val:fmtM(R.aP),cor:'#f97316',sub:`Despesas pendentes · ${per}`},
        ].map(c=>(
          <div key={c.lbl} style={{...s.csm,borderLeft:`${c.bold?'3px':'2px'} solid ${c.cor}`}}>
            <p style={{fontSize:'0.68rem',fontWeight:'700',color:c.cor,textTransform:'uppercase',letterSpacing:'0.04em',margin:'0 0 0.25rem'}}>{c.lbl}</p>
            <p style={{fontSize:c.bold?'1.2rem':'1.1rem',fontWeight:'700',color:c.neg?'#ef4444':c.cor,margin:0}}>{c.val}</p>
            <p style={{fontSize:'0.65rem',color:'var(--color-text-faint)',margin:'0.15rem 0 0'}}>{c.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );

  // ── FILTROS ─────────────────────────────────────────────────────────────────
  const Filtros=()=>(
    <div style={{...s.card,padding:'1rem',marginBottom:'1rem'}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:'0.65rem',alignItems:'end'}}>
        {/* Mês */}
        <div>
          <label style={{display:'block',fontSize:'0.68rem',fontWeight:'600',color:'var(--color-text-muted)',textTransform:'uppercase',marginBottom:'0.25rem'}}>Mês</label>
          <input readOnly value={MESES[filtros.mes-1]} style={{...s.inp,textAlign:'center',cursor:'default'}}/>
          <div style={{display:'flex',gap:'0.25rem',marginTop:'0.3rem'}}>
            <button style={s.ab} onClick={()=>navMes(-1)}>‹</button>
            <button style={s.ab} onClick={()=>navMes(1)}>›</button>
          </div>
        </div>
        {/* Ano */}
        <div>
          <label style={{display:'block',fontSize:'0.68rem',fontWeight:'600',color:'var(--color-text-muted)',textTransform:'uppercase',marginBottom:'0.25rem'}}>Ano</label>
          <input readOnly value={filtros.ano} style={{...s.inp,textAlign:'center',cursor:'default'}}/>
          <div style={{display:'flex',gap:'0.25rem',marginTop:'0.3rem'}}>
            <button style={s.ab} onClick={()=>setFiltros({...filtros,ano:filtros.ano-1})}>‹</button>
            <button style={s.ab} onClick={()=>setFiltros({...filtros,ano:filtros.ano+1})}>›</button>
          </div>
        </div>
        {/* Tipo */}
        <div>
          <label style={{display:'block',fontSize:'0.68rem',fontWeight:'600',color:'var(--color-text-muted)',textTransform:'uppercase',marginBottom:'0.25rem'}}>Tipo</label>
          <select style={s.sel} value={filtros.tipo} onChange={e=>setFiltros({...filtros,tipo:e.target.value,categoria_id:''})}>
            <option value="">Todos</option><option value="receita">📈 Receita</option><option value="despesa">📉 Despesa</option>
          </select>
        </div>
        {/* Categoria */}
        <div>
          <label style={{display:'block',fontSize:'0.68rem',fontWeight:'600',color:'var(--color-text-muted)',textTransform:'uppercase',marginBottom:'0.25rem'}}>Categoria</label>
          <select style={s.sel} value={filtros.categoria_id} onChange={e=>setFiltros({...filtros,categoria_id:e.target.value})}>
            <option value="">Todas</option>
            {categorias.filter(c=>!filtros.tipo||c.tipo===filtros.tipo).map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        {/* Status */}
        <div>
          <label style={{display:'block',fontSize:'0.68rem',fontWeight:'600',color:'var(--color-text-muted)',textTransform:'uppercase',marginBottom:'0.25rem'}}>Status</label>
          <select style={s.sel} value={filtros.status} onChange={e=>setFiltros({...filtros,status:e.target.value})}>
            <option value="">Todos</option><option value="pago">✓ Pago</option><option value="pendente">⏳ Pendente</option>
          </select>
        </div>
        {/* Cunhada */}
        <div>
          <label style={{display:'block',fontSize:'0.68rem',fontWeight:'600',color:'var(--color-text-muted)',textTransform:'uppercase',marginBottom:'0.25rem'}}>Cunhada</label>
          <select style={s.sel} value={filtros.cunhada_id} onChange={e=>setFiltros({...filtros,cunhada_id:e.target.value})}>
            <option value="">Todas</option>
            {cunhadas.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
      </div>
    </div>
  );

  // ── TABELA LANÇAMENTOS ──────────────────────────────────────────────────────
  const Tabela=()=>(
    <>
      <div style={{...s.card,padding:'0.85rem 1.25rem',marginBottom:'0.75rem',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'0.5rem'}}>
        <p style={{margin:0,fontWeight:'700',color:'var(--color-text)'}}>
          Lançamentos de {per}
          <span style={{marginLeft:'0.75rem',fontSize:'0.78rem',fontWeight:'400',color:'var(--color-text-muted)'}}>{lancamentos.length} registro(s)</span>
        </p>
        <div style={{display:'flex',gap:'0.4rem',flexWrap:'wrap'}}>
          <button style={s.bp('#10b981')} onClick={()=>{setForm({...FVAZIO,tipo:'receita'});setEditId(null);setMAberto(true);}}>＋ Receita</button>
          <button style={s.bp('#ef4444')} onClick={()=>{setForm({...FVAZIO,tipo:'despesa'});setEditId(null);setMAberto(true);}}>＋ Despesa</button>
          <button style={s.bp('var(--color-accent)')} onClick={()=>setMLote(true)}>👥 Em Lote</button>
          {lancamentos.some(l=>!l.pago)&&<button style={s.bp('#f59e0b')} onClick={()=>{setSelQ([]);setMQLote(true);}}>💰 Quitar Lote</button>}
        </div>
      </div>
      <div style={{...s.card,padding:0,overflow:'hidden'}}>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:'var(--color-surface-2)',borderBottom:'2px solid var(--color-border)'}}>
                {['Data','Tipo','Categoria','Descrição','Cunhada','Valor','Pgto','Status','Ações'].map(h=>(
                  <th key={h} style={{padding:'0.65rem 0.8rem',textAlign:'left',fontSize:'0.67rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.04em',whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lancamentos.length===0?(
                <tr><td colSpan={9} style={{textAlign:'center',padding:'2.5rem',color:'var(--color-text-faint)',fontSize:'0.875rem'}}>Nenhum lançamento para {per} com os filtros aplicados.</td></tr>
              ):lancamentos.map((l,i)=>(
                <tr key={l.id} style={{borderBottom:'1px solid var(--color-border)',background:i%2===0?'transparent':'var(--color-surface-2)'}}>
                  <td style={{padding:'0.6rem 0.8rem',fontSize:'0.78rem',color:'var(--color-text-muted)',whiteSpace:'nowrap'}}>{fmtD(l.data_lancamento)}</td>
                  <td style={{padding:'0.6rem 0.8rem'}}>
                    <span style={{fontSize:'0.72rem',fontWeight:'600',padding:'0.15rem 0.45rem',borderRadius:'999px',background:l.tipo==='receita'?'rgba(16,185,129,0.12)':'rgba(239,68,68,0.12)',color:l.tipo==='receita'?'#10b981':'#ef4444'}}>
                      {l.tipo==='receita'?'📈 Rec':'📉 Desp'}
                    </span>
                  </td>
                  <td style={{padding:'0.6rem 0.8rem',fontSize:'0.78rem',color:'var(--color-text-muted)',maxWidth:'110px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.categoria?.nome||'—'}</td>
                  <td style={{padding:'0.6rem 0.8rem',fontSize:'0.85rem',fontWeight:'500',color:'var(--color-text)',maxWidth:'170px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.descricao}</td>
                  <td style={{padding:'0.6rem 0.8rem',fontSize:'0.78rem',color:'var(--color-text-muted)',maxWidth:'130px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.cunhada?.nome||<span style={{color:'var(--color-text-faint)'}}>Geral</span>}</td>
                  <td style={{padding:'0.6rem 0.8rem',fontSize:'0.875rem',fontWeight:'700',color:l.tipo==='receita'?'#10b981':'#ef4444',whiteSpace:'nowrap'}}>{l.tipo==='receita'?'+':'-'}{fmtM(l.valor)}</td>
                  <td style={{padding:'0.6rem 0.8rem',fontSize:'0.72rem',color:'var(--color-text-faint)',whiteSpace:'nowrap'}}>{l.forma_pagamento||'—'}</td>
                  <td style={{padding:'0.6rem 0.8rem'}}><span style={s.bdg(l.pago)}>{l.pago?'✓ Pago':'⏳ Pend.'}</span></td>
                  <td style={{padding:'0.6rem 0.8rem'}}>
                    <div style={{display:'flex',gap:'0.2rem'}}>
                      {!l.pago?(
                        <button onClick={()=>{setMQuit(l);setQForm({forma_pagamento:l.forma_pagamento||'pix',observacoes:''}); }} title="Quitar" style={{padding:'0.22rem 0.45rem',background:'rgba(16,185,129,0.12)',color:'#10b981',border:'none',borderRadius:'var(--radius-md)',cursor:'pointer',fontSize:'0.72rem',fontWeight:'600'}}>💰</button>
                      ):(
                        <button onClick={()=>desfazerQuit(l.id)} title="Desfazer" style={{padding:'0.22rem 0.45rem',background:'rgba(245,158,11,0.12)',color:'#f59e0b',border:'none',borderRadius:'var(--radius-md)',cursor:'pointer',fontSize:'0.72rem',fontWeight:'600'}}>↩</button>
                      )}
                      <button onClick={()=>{setForm({tipo:l.tipo,categoria_id:l.categoria_id||'',descricao:l.descricao,valor:l.valor,data_lancamento:l.data_lancamento,data_vencimento:l.data_vencimento||'',cunhada_id:l.cunhada_id||'',pago:l.pago,forma_pagamento:l.forma_pagamento||'',observacoes:l.observacoes||''});setEditId(l.id);setMAberto(true);}} style={{padding:'0.22rem 0.45rem',background:'var(--color-accent-bg)',color:'var(--color-accent)',border:'none',borderRadius:'var(--radius-md)',cursor:'pointer',fontSize:'0.72rem'}}>✏️</button>
                      <button onClick={()=>setMExcl(l)} style={{padding:'0.22rem 0.45rem',background:'rgba(239,68,68,0.12)',color:'#ef4444',border:'none',borderRadius:'var(--radius-md)',cursor:'pointer',fontSize:'0.72rem'}}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  // ── ABA MENSALIDADES ─────────────────────────────────────────────────────────
  const renderMens=()=>(
    <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
      <div style={{display:'flex',gap:'0.75rem',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
          <button style={s.ab} onClick={()=>{let m=mesMens-1,a=anoMens;if(m<1){m=12;a--;}setMesMens(m);setAnoMens(a);}}>‹</button>
          <span style={{fontWeight:'700',color:'var(--color-text)',minWidth:'140px',textAlign:'center'}}>{MESES[mesMens-1]} {anoMens}</span>
          <button style={s.ab} onClick={()=>{let m=mesMens+1,a=anoMens;if(m>12){m=1;a++;}setMesMens(m);setAnoMens(a);}}>›</button>
        </div>
        <div style={{display:'flex',gap:'0.5rem'}}>
          <button style={s.bs} onClick={()=>setMCfg(true)}>⚙️ Valor: {fmtM(config.valor_mensalidade)}</button>
          <button style={s.bp('var(--color-accent)')} onClick={gerarMens}>⚡ Gerar mensalidades</button>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'1rem'}}>
        {[{l:'Total gerado',v:mensM.length,c:'var(--color-accent)'},{l:'Quitadas',v:mensM.filter(m=>m.pago).length,c:'#10b981'},{l:'Em aberto',v:mensM.filter(m=>!m.pago).length,c:'#f59e0b'}].map(r=>(
          <div key={r.l} style={s.csm}><p style={{margin:0,fontSize:'0.7rem',fontWeight:'600',color:'var(--color-text-muted)',textTransform:'uppercase'}}>{r.l}</p><p style={{margin:'0.2rem 0 0',fontSize:'1.5rem',fontWeight:'700',color:r.c}}>{r.v}</p></div>
        ))}
      </div>
      {mensM.length===0?(
        <div style={{...s.card,textAlign:'center',padding:'3rem'}}><p style={{color:'var(--color-text-muted)',marginBottom:'1rem'}}>Não geradas para {MESES[mesMens-1]}/{anoMens}.</p><button style={s.bp('var(--color-accent)')} onClick={gerarMens}>⚡ Gerar agora</button></div>
      ):(
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))',gap:'1rem'}}>
          {mensM.map(m=>(
            <div key={m.id} style={{...s.csm,borderTop:`3px solid ${m.pago?'#10b981':'#f59e0b'}`}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'0.5rem'}}>
                <div style={{width:'1.75rem',height:'1.75rem',borderRadius:'50%',background:m.pago?'rgba(16,185,129,0.15)':'rgba(245,158,11,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:'700',fontSize:'0.75rem',color:m.pago?'#10b981':'#f59e0b'}}>{m.cunhada?.nome?.charAt(0).toUpperCase()}</div>
                <span style={s.bdg(m.pago)}>{m.pago?'✓ Paga':'⏳ Aberto'}</span>
              </div>
              <p style={{margin:'0 0 0.15rem',fontWeight:'700',fontSize:'0.875rem',color:'var(--color-text)'}}>{m.cunhada?.nome}</p>
              <p style={{margin:'0 0 0.5rem',fontWeight:'700',color:m.pago?'#10b981':'#f59e0b'}}>{fmtM(m.valor)}</p>
              {m.data_pagamento&&<p style={{margin:'0 0 0.5rem',fontSize:'0.7rem',color:'var(--color-text-faint)'}}>Pago em {fmtD(m.data_pagamento)}</p>}
              <button onClick={()=>toggleMens(m)} style={{width:'100%',padding:'0.4rem',borderRadius:'var(--radius-md)',border:'none',background:m.pago?'rgba(245,158,11,0.12)':'rgba(16,185,129,0.12)',color:m.pago?'#f59e0b':'#10b981',fontWeight:'600',fontSize:'0.78rem',cursor:'pointer'}}>{m.pago?'↩ Desfazer':'✓ Marcar paga'}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── ABA EXTRATO ──────────────────────────────────────────────────────────────
  const renderExtrato=()=>{
    const pm={};
    todos.forEach(l=>{const[y,m]=l.data_lancamento.split('-');const k=`${y}-${m.padStart(2,'0')}`;if(!pm[k])pm[k]=[];pm[k].push(l);});
    const ks=Object.keys(pm).sort((a,b)=>b.localeCompare(a));
    const tR=todos.filter(l=>l.tipo==='receita').reduce((s,l)=>s+Number(l.valor),0);
    const tD=todos.filter(l=>l.tipo==='despesa').reduce((s,l)=>s+Number(l.valor),0);
    return(
      <div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.25rem',flexWrap:'wrap',gap:'1rem'}}>
          <div><p style={{margin:0,fontWeight:'700',color:'var(--color-text)'}}>Extrato completo</p><p style={{margin:0,fontSize:'0.8rem',color:'var(--color-text-muted)'}}>{todos.length} lançamentos</p></div>
          <div style={{textAlign:'right'}}><p style={{margin:0,fontSize:'0.75rem',color:'var(--color-text-muted)'}}>Saldo acumulado</p><p style={{margin:0,fontWeight:'700',fontSize:'1.25rem',color:(tR-tD)>=0?'#10b981':'#ef4444'}}>{fmtM(tR-tD)}</p></div>
        </div>
        {ks.map(k=>{
          const[y,m]=k.split('-');const its=pm[k];
          const r=its.filter(l=>l.tipo==='receita').reduce((s,l)=>s+Number(l.valor),0);
          const d=its.filter(l=>l.tipo==='despesa').reduce((s,l)=>s+Number(l.valor),0);
          return(
            <div key={k} style={{...s.card,marginBottom:'1rem'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem',paddingBottom:'0.75rem',borderBottom:'1px solid var(--color-border)'}}>
                <p style={{margin:0,fontWeight:'700',color:'var(--color-text)'}}>{MESES[parseInt(m)-1]} {y}</p>
                <div style={{display:'flex',gap:'1rem',fontSize:'0.8rem'}}>
                  <span style={{color:'#10b981'}}>+{fmtM(r)}</span><span style={{color:'#ef4444'}}>-{fmtM(d)}</span>
                  <span style={{color:(r-d)>=0?'#10b981':'#ef4444',fontWeight:'700'}}>{fmtM(r-d)}</span>
                </div>
              </div>
              {its.map(l=>(
                <div key={l.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0.45rem 0',borderBottom:'1px solid var(--color-border)'}}>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{margin:0,fontSize:'0.85rem',color:'var(--color-text)'}}>{l.descricao}</p>
                    <p style={{margin:0,fontSize:'0.7rem',color:'var(--color-text-faint)'}}>{fmtD(l.data_lancamento)}{l.cunhada?.nome?` · ${l.cunhada.nome}`:''}{l.categoria?.nome?` · ${l.categoria.nome}`:''}</p>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:'0.65rem',flexShrink:0}}>
                    <span style={{fontWeight:'700',color:l.tipo==='receita'?'#10b981':'#ef4444'}}>{l.tipo==='receita'?'+':'-'}{fmtM(l.valor)}</span>
                    <span style={s.bdg(l.pago)}>{l.pago?'✓':'⏳'}</span>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
        {ks.length===0&&<div style={{...s.card,textAlign:'center',padding:'3rem'}}><p style={{color:'var(--color-text-faint)'}}>Nenhum lançamento.</p></div>}
      </div>
    );
  };

  // ── ABA CATEGORIAS ───────────────────────────────────────────────────────────
  const renderCats=()=>{
    const tc={receita:'#10b981',despesa:'#ef4444'};
    const build=(lista,tipo)=>{const t=lista.filter(c=>c.tipo===tipo);const ps=t.filter(c=>!c.categoria_pai_id);const ch=pai=>{const fs=t.filter(c=>String(c.categoria_pai_id)===String(pai.id));return fs.map(f=>({...f,filhos:ch(f)}));};return ps.map(c=>({...c,filhos:ch(c)}));};
    const rows=(lista,p=0)=>lista.map(c=>(
      <React.Fragment key={c.id}>
        <div style={{display:'flex',alignItems:'center',padding:'0.55rem 0.75rem',borderBottom:'1px solid var(--color-border)',paddingLeft:`${0.75+p*1.5}rem`,background:p%2===1?'var(--color-surface-2)':'transparent'}}>
          {p>0&&<span style={{color:'var(--color-text-faint)',marginRight:'0.4rem',fontSize:'0.72rem'}}>└─</span>}
          <span style={{flex:1,fontWeight:p===0?'700':'500',fontSize:'0.875rem',color:'var(--color-text)'}}>{c.nome}</span>
          {c.nivel>1&&<span style={{marginRight:'0.5rem',fontSize:'0.65rem',color:'var(--color-text-faint)',background:'var(--color-surface-3)',padding:'0.1rem 0.35rem',borderRadius:'999px'}}>sub</span>}
          <div style={{display:'flex',gap:'0.25rem'}}>
            <button onClick={()=>{setCatF({nome:c.nome,tipo:c.tipo,categoria_pai_id:c.categoria_pai_id||null,ordem:c.ordem||0});setEditCatId(c.id);setMCat(true);}} style={{padding:'0.2rem 0.4rem',background:'var(--color-accent-bg)',color:'var(--color-accent)',border:'none',borderRadius:'var(--radius-md)',cursor:'pointer',fontSize:'0.7rem'}}>✏️</button>
            <button onClick={()=>excluirCat(c.id)} style={{padding:'0.2rem 0.4rem',background:'rgba(239,68,68,0.12)',color:'#ef4444',border:'none',borderRadius:'var(--radius-md)',cursor:'pointer',fontSize:'0.7rem'}}>🗑</button>
          </div>
        </div>
        {c.filhos?.length>0&&rows(c.filhos,p+1)}
      </React.Fragment>
    ));
    return(
      <div style={{display:'flex',flexDirection:'column',gap:'1.5rem'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div><p style={{margin:0,fontWeight:'700',fontSize:'1.05rem',color:'var(--color-text)'}}>🏷️ Categorias Financeiras</p><p style={{margin:0,fontSize:'0.8rem',color:'var(--color-text-muted)'}}>{categorias.length} categoria(s)</p></div>
          <button style={s.bp('var(--color-accent)')} onClick={()=>{setCatF({nome:'',tipo:'receita',categoria_pai_id:null,ordem:0});setEditCatId(null);setMCat(true);}}>＋ Nova</button>
        </div>
        {categorias.length===0?<div style={{...s.card,textAlign:'center',padding:'3rem'}}><p style={{color:'var(--color-text-muted)'}}>Nenhuma categoria.</p></div>:(
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.5rem'}}>
            {['receita','despesa'].map(tp=>{
              const arv=build(categorias,tp);
              return(
                <div key={tp} style={s.card}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.75rem',paddingBottom:'0.75rem',borderBottom:`2px solid ${tc[tp]}`}}>
                    <span style={{fontWeight:'700',color:tc[tp]}}>{tp==='receita'?'📈 Receitas':'📉 Despesas'}</span>
                    <span style={{fontSize:'0.7rem',color:'var(--color-text-faint)',background:'var(--color-surface-2)',padding:'0.15rem 0.5rem',borderRadius:'999px'}}>{categorias.filter(c=>c.tipo===tp).length} cat.</span>
                  </div>
                  {arv.length===0?<p style={{color:'var(--color-text-faint)',fontSize:'0.85rem',textAlign:'center',padding:'1.5rem 0'}}>Nenhuma.</p>:rows(arv)}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ── RENDER PRINCIPAL ─────────────────────────────────────────────────────────
  return(
    <div style={{padding:'1.5rem',maxWidth:'1280px',margin:'0 auto'}}>
      {msg.texto&&(
        <div style={{position:'fixed',bottom:'1.5rem',right:'1.5rem',padding:'0.85rem 1.25rem',borderRadius:'var(--radius-xl)',background:msg.tipo==='sucesso'?'rgba(16,185,129,0.12)':'rgba(239,68,68,0.12)',border:`1px solid ${msg.tipo==='sucesso'?'rgba(16,185,129,0.35)':'rgba(239,68,68,0.35)'}`,color:msg.tipo==='sucesso'?'#10b981':'#ef4444',fontWeight:'600',fontSize:'0.875rem',zIndex:2000,boxShadow:'var(--shadow-lg)',display:'flex',alignItems:'center',gap:'0.5rem'}}>
          {msg.tipo==='sucesso'?'✅':'❌'} {msg.texto}
        </div>
      )}

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem',flexWrap:'wrap',gap:'1rem'}}>
        <div>
          <h1 style={{fontSize:'1.4rem',fontWeight:'700',color:'var(--color-text)',margin:0}}>💰 Financeiro</h1>
          <p style={{fontSize:'0.875rem',color:'var(--color-text-muted)',margin:'0.15rem 0 0'}}>{nomeGrupo}</p>
        </div>
        <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap'}}>
          {[{id:'lancamentos',l:'📝 Lançamentos'},{id:'mensalidades',l:'📋 Mensalidades'},{id:'extrato',l:'📄 Extrato'},{id:'categorias',l:'🏷️ Categorias'}].map(a=>(
            <button key={a.id} style={s.nb(aba===a.id)} onClick={()=>setAba(a.id)}>{a.l}</button>
          ))}
        </div>
      </div>

      {loading?(
        <div style={{textAlign:'center',padding:'4rem',color:'var(--color-text-faint)'}}><div className="spinner" style={{margin:'0 auto 1rem'}}/>Carregando...</div>
      ):(
        <>
          {aba==='lancamentos'&&<><Cards/><Filtros/><Tabela/></>}
          {aba==='mensalidades'&&renderMens()}
          {aba==='extrato'&&renderExtrato()}
          {aba==='categorias'&&renderCats()}
        </>
      )}

      {/* MODAL LANÇAMENTO */}
      {mAberto&&(
        <div style={s.ov} onClick={e=>e.target===e.currentTarget&&(setMAberto(false),setEditId(null),setForm(FVAZIO))}>
          <div style={s.mo}>
            <div style={s.mh}><h2 style={{margin:0,fontSize:'1.05rem',fontWeight:'700',color:'var(--color-text)'}}>{form.tipo==='receita'?'📈':'📉'} {editId?'Editar':'Novo'} {form.tipo==='receita'?'Receita':'Despesa'}</h2><button onClick={()=>{setMAberto(false);setEditId(null);setForm(FVAZIO);}} style={{background:'none',border:'none',color:'var(--color-text-muted)',fontSize:'1.5rem',cursor:'pointer'}}>×</button></div>
            <div style={s.mb}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem',marginBottom:'1rem'}}>
                {['receita','despesa'].map(t=>(
                  <button key={t} onClick={()=>setForm({...form,tipo:t})} style={{padding:'0.6rem',borderRadius:'var(--radius-lg)',border:'2px solid',borderColor:form.tipo===t?(t==='receita'?'#10b981':'#ef4444'):'var(--color-border)',background:form.tipo===t?(t==='receita'?'rgba(16,185,129,0.12)':'rgba(239,68,68,0.12)'):'var(--color-surface-2)',color:form.tipo===t?(t==='receita'?'#10b981':'#ef4444'):'var(--color-text)',fontWeight:'700',cursor:'pointer'}}>
                    {t==='receita'?'📈 Receita':'📉 Despesa'}
                  </button>
                ))}
              </div>
              <div style={{marginBottom:'1rem'}}>
                <label style={{display:'block',fontSize:'0.7rem',fontWeight:'600',color:'var(--color-text-muted)',marginBottom:'0.3rem',textTransform:'uppercase',letterSpacing:'0.04em'}}>Lançamento para</label>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem'}}>
                  <button type="button" onClick={()=>setForm({...form,cunhada_id:''})} style={{padding:'0.5rem',borderRadius:'var(--radius-lg)',border:'2px solid',borderColor:!form.cunhada_id?'var(--color-accent)':'var(--color-border)',background:!form.cunhada_id?'var(--color-accent-bg)':'var(--color-surface-2)',color:!form.cunhada_id?'var(--color-accent)':'var(--color-text)',fontWeight:!form.cunhada_id?'700':'400',cursor:'pointer',fontSize:'0.85rem'}}>🌸 {nomeGrupo}</button>
                  <button type="button" onClick={()=>setForm({...form,cunhada_id:cunhadas[0]?.id||''})} style={{padding:'0.5rem',borderRadius:'var(--radius-lg)',border:'2px solid',borderColor:form.cunhada_id?'var(--color-accent)':'var(--color-border)',background:form.cunhada_id?'var(--color-accent-bg)':'var(--color-surface-2)',color:form.cunhada_id?'var(--color-accent)':'var(--color-text)',fontWeight:form.cunhada_id?'700':'400',cursor:'pointer',fontSize:'0.85rem'}}>👤 Individual</button>
                </div>
                {form.cunhada_id!==''&&<select style={{...s.sel,marginTop:'0.5rem'}} value={form.cunhada_id} onChange={e=>setForm({...form,cunhada_id:e.target.value})}><option value="">— Selecione —</option>{cunhadas.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select>}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
                <Lbl l="Descrição *" st={{gridColumn:'1/-1'}} ch={<input style={s.inp} value={form.descricao} onChange={e=>setForm({...form,descricao:e.target.value})} placeholder="Ex: Mensalidade de março"/>}/>
                <Lbl l="Valor (R$) *" ch={<input type="number" step="0.01" min="0" style={s.inp} value={form.valor} onChange={e=>setForm({...form,valor:e.target.value})} placeholder="0,00"/>}/>
                <Lbl l="Categoria" ch={<select style={s.sel} value={form.categoria_id} onChange={e=>setForm({...form,categoria_id:e.target.value})}><option value="">— Selecione —</option>{categorias.filter(c=>c.tipo===form.tipo).map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select>}/>
                <Lbl l="Data lançamento" ch={<input type="date" style={s.inp} value={form.data_lancamento} onChange={e=>setForm({...form,data_lancamento:e.target.value})}/>}/>
                <Lbl l="Data vencimento" ch={<input type="date" style={s.inp} value={form.data_vencimento} onChange={e=>setForm({...form,data_vencimento:e.target.value})}/>}/>
                <Lbl l="Forma pagamento" ch={<select style={s.sel} value={form.forma_pagamento} onChange={e=>setForm({...form,forma_pagamento:e.target.value})}><option value="">— Selecione —</option>{FPGTO.map(f=><option key={f.v} value={f.v}>{f.l}</option>)}</select>}/>
                <Lbl l="Status" ch={<div style={{display:'flex',alignItems:'center',gap:'0.75rem',paddingTop:'0.5rem'}}><input type="checkbox" id="pago-chk" checked={form.pago} onChange={e=>setForm({...form,pago:e.target.checked})} style={{width:'1rem',height:'1rem',accentColor:'var(--color-accent)'}}/><label htmlFor="pago-chk" style={{color:'var(--color-text)',fontSize:'0.875rem',cursor:'pointer'}}>Já pago / recebido</label></div>}/>
                <Lbl l="Observações" st={{gridColumn:'1/-1'}} ch={<textarea style={s.ta} value={form.observacoes} onChange={e=>setForm({...form,observacoes:e.target.value})} placeholder="Informações adicionais..."/>}/>
              </div>
            </div>
            <div style={s.mf}><button style={s.bs} onClick={()=>{setMAberto(false);setEditId(null);setForm(FVAZIO);}} disabled={salv}>Cancelar</button><button style={s.bp(form.tipo==='receita'?'#10b981':'#ef4444')} onClick={salvarLanc} disabled={salv}>{salv?'⏳...':editId?'💾 Salvar':`＋ Lançar ${form.tipo}`}</button></div>
          </div>
        </div>
      )}

      {/* MODAL LOTE */}
      {mLote&&(
        <div style={s.ov} onClick={e=>e.target===e.currentTarget&&setMLote(false)}>
          <div style={s.mol}>
            <div style={s.mh}><h2 style={{margin:0,fontSize:'1.05rem',fontWeight:'700',color:'var(--color-text)'}}>👥 Lançamento em Lote</h2><button onClick={()=>setMLote(false)} style={{background:'none',border:'none',color:'var(--color-text-muted)',fontSize:'1.5rem',cursor:'pointer'}}>×</button></div>
            <div style={s.mb}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem',marginBottom:'1rem'}}>
                <Lbl l="Descrição *" st={{gridColumn:'1/-1'}} ch={<input style={s.inp} value={fLote.descricao} onChange={e=>setFLote({...fLote,descricao:e.target.value})} placeholder="Ex: Mensalidade - Março/2025"/>}/>
                <Lbl l="Valor por cunhada *" ch={<input type="number" step="0.01" min="0" style={s.inp} value={fLote.valor} onChange={e=>setFLote({...fLote,valor:e.target.value})} placeholder="0,00"/>}/>
                <Lbl l="Categoria" ch={<select style={s.sel} value={fLote.categoria_id} onChange={e=>setFLote({...fLote,categoria_id:e.target.value})}><option value="">— Selecione —</option>{categorias.filter(c=>c.tipo==='receita').map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select>}/>
                <Lbl l="Data lançamento" ch={<input type="date" style={s.inp} value={fLote.data_lancamento} onChange={e=>setFLote({...fLote,data_lancamento:e.target.value})}/>}/>
                <Lbl l="Data vencimento" ch={<input type="date" style={s.inp} value={fLote.data_vencimento} onChange={e=>setFLote({...fLote,data_vencimento:e.target.value})}/>}/>
                <Lbl l="Forma pagamento" ch={<select style={s.sel} value={fLote.forma_pagamento} onChange={e=>setFLote({...fLote,forma_pagamento:e.target.value})}><option value="">— Selecione —</option>{FPGTO.map(f=><option key={f.v} value={f.v}>{f.l}</option>)}</select>}/>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.5rem'}}>
                <label style={{fontSize:'0.7rem',fontWeight:'600',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.04em'}}>Cunhadas * ({fLote.cunhadas_selecionadas.length}/{cunhadas.length})</label>
                <div style={{display:'flex',gap:'0.75rem'}}>
                  <button type="button" onClick={()=>setFLote({...fLote,cunhadas_selecionadas:cunhadas.map(c=>c.id)})} style={{background:'none',border:'none',cursor:'pointer',fontSize:'0.8rem',color:'var(--color-accent)',fontWeight:'600'}}>✅ Todas</button>
                  <button type="button" onClick={()=>setFLote({...fLote,cunhadas_selecionadas:[]})} style={{background:'none',border:'none',cursor:'pointer',fontSize:'0.8rem',color:'#ef4444',fontWeight:'600'}}>❌ Limpar</button>
                </div>
              </div>
              <div style={{border:'2px solid var(--color-border)',borderRadius:'var(--radius-lg)',padding:'0.75rem',maxHeight:'180px',overflowY:'auto',background:'var(--color-surface-2)'}}>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(155px,1fr))',gap:'0.4rem'}}>
                  {cunhadas.map(c=>(
                    <label key={c.id} style={{display:'flex',alignItems:'center',gap:'0.5rem',cursor:'pointer',padding:'0.35rem 0.6rem',borderRadius:'var(--radius-md)',background:fLote.cunhadas_selecionadas.includes(c.id)?'var(--color-accent-bg)':'transparent',border:`1px solid ${fLote.cunhadas_selecionadas.includes(c.id)?'var(--color-accent)':'var(--color-border)'}`}}>
                      <input type="checkbox" checked={fLote.cunhadas_selecionadas.includes(c.id)} onChange={()=>togCunh(c.id)} style={{accentColor:'var(--color-accent)'}}/>
                      <span style={{fontSize:'0.85rem',color:'var(--color-text)',fontWeight:fLote.cunhadas_selecionadas.includes(c.id)?'600':'400'}}>{c.nome}</span>
                    </label>
                  ))}
                </div>
              </div>
              {fLote.cunhadas_selecionadas.length>0&&fLote.valor&&(
                <div style={{...s.ib,marginTop:'0.75rem'}}><p style={{margin:0,fontSize:'0.875rem',color:'var(--color-accent)',fontWeight:'600'}}>Total: <strong>{fmtM(parseFloat(fLote.valor||0)*fLote.cunhadas_selecionadas.length)}</strong> ({fLote.cunhadas_selecionadas.length} × {fmtM(parseFloat(fLote.valor||0))})</p></div>
              )}
            </div>
            <div style={s.mf}><button style={s.bs} onClick={()=>setMLote(false)} disabled={salvL}>Cancelar</button><button style={s.bp('#10b981')} onClick={salvarLote} disabled={salvL}>{salvL?'⏳...`':`✅ Criar ${fLote.cunhadas_selecionadas.length}`}</button></div>
          </div>
        </div>
      )}

      {/* MODAL QUITAÇÃO */}
      {mQuit&&(
        <div style={s.ov} onClick={e=>e.target===e.currentTarget&&setMQuit(null)}>
          <div style={{...s.mo,maxWidth:'420px'}}>
            <div style={s.mh}><h2 style={{margin:0,fontSize:'1.05rem',fontWeight:'700',color:'var(--color-text)'}}>💰 Quitar Lançamento</h2><button onClick={()=>setMQuit(null)} style={{background:'none',border:'none',color:'var(--color-text-muted)',fontSize:'1.5rem',cursor:'pointer'}}>×</button></div>
            <div style={s.mb}>
              <div style={{...s.ib,marginBottom:'1.25rem'}}><p style={{margin:'0 0 0.2rem',fontWeight:'700',color:'var(--color-text)'}}>{mQuit.descricao}</p><p style={{margin:0,fontSize:'1.25rem',fontWeight:'700',color:'#10b981'}}>{fmtM(mQuit.valor)}</p>{mQuit.cunhada?.nome&&<p style={{margin:'0.2rem 0 0',fontSize:'0.8rem',color:'var(--color-text-muted)'}}>👤 {mQuit.cunhada.nome}</p>}</div>
              <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
                <Lbl l="Forma de pagamento" ch={<select style={s.sel} value={qForm.forma_pagamento} onChange={e=>setQForm({...qForm,forma_pagamento:e.target.value})}>{FPGTO.map(f=><option key={f.v} value={f.v}>{f.l}</option>)}</select>}/>
                <Lbl l="Observações" ch={<textarea style={s.ta} value={qForm.observacoes} onChange={e=>setQForm({...qForm,observacoes:e.target.value})} placeholder="Observações..."/>}/>
              </div>
            </div>
            <div style={s.mf}><button style={s.bs} onClick={()=>setMQuit(null)} disabled={salvQ}>Cancelar</button><button style={s.bp('#10b981')} onClick={quitarUm} disabled={salvQ}>{salvQ?'⏳...':'✅ Confirmar'}</button></div>
          </div>
        </div>
      )}

      {/* MODAL QUITAÇÃO LOTE */}
      {mQLote&&(
        <div style={s.ov} onClick={e=>e.target===e.currentTarget&&setMQLote(false)}>
          <div style={s.mol}>
            <div style={s.mh}><h2 style={{margin:0,fontSize:'1.05rem',fontWeight:'700',color:'var(--color-text)'}}>💰 Quitação em Lote — {selQ.length} selecionados</h2><button onClick={()=>setMQLote(false)} style={{background:'none',border:'none',color:'var(--color-text-muted)',fontSize:'1.5rem',cursor:'pointer'}}>×</button></div>
            <div style={s.mb}>
              <Lbl l="Forma de pagamento" st={{marginBottom:'1rem'}} ch={<select style={s.sel} value={qLForm.forma_pagamento} onChange={e=>setQLForm({...qLForm,forma_pagamento:e.target.value})}>{FPGTO.map(f=><option key={f.v} value={f.v}>{f.l}</option>)}</select>}/>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.5rem'}}>
                <label style={{fontSize:'0.7rem',fontWeight:'600',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.04em'}}>Pendentes</label>
                <div style={{display:'flex',gap:'0.75rem'}}>
                  <button type="button" onClick={()=>setSelQ(lancamentos.filter(l=>!l.pago).map(l=>l.id))} style={{background:'none',border:'none',cursor:'pointer',fontSize:'0.8rem',color:'var(--color-accent)',fontWeight:'600'}}>✅ Todos</button>
                  <button type="button" onClick={()=>setSelQ([])} style={{background:'none',border:'none',cursor:'pointer',fontSize:'0.8rem',color:'#ef4444',fontWeight:'600'}}>❌ Limpar</button>
                </div>
              </div>
              <div style={{border:'2px solid var(--color-border)',borderRadius:'var(--radius-lg)',maxHeight:'280px',overflowY:'auto',background:'var(--color-surface-2)'}}>
                {lancamentos.filter(l=>!l.pago).length===0?<p style={{textAlign:'center',padding:'2rem',color:'var(--color-text-faint)'}}>Nenhum pendente.</p>:lancamentos.filter(l=>!l.pago).map(l=>(
                  <label key={l.id} style={{display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.7rem 1rem',borderBottom:'1px solid var(--color-border)',cursor:'pointer',background:selQ.includes(l.id)?'var(--color-accent-bg)':'transparent'}}>
                    <input type="checkbox" checked={selQ.includes(l.id)} onChange={()=>togSelQ(l.id)} style={{accentColor:'var(--color-accent)',width:'1rem',height:'1rem'}}/>
                    <div style={{flex:1,minWidth:0}}><p style={{margin:0,fontSize:'0.875rem',fontWeight:'600',color:'var(--color-text)'}}>{l.descricao}</p><p style={{margin:0,fontSize:'0.7rem',color:'var(--color-text-faint)'}}>{fmtD(l.data_lancamento)}{l.cunhada?.nome?` · ${l.cunhada.nome}`:''}</p></div>
                    <span style={{fontWeight:'700',color:'#10b981',flexShrink:0}}>{fmtM(l.valor)}</span>
                  </label>
                ))}
              </div>
              {selQ.length>0&&<div style={{...s.ib,marginTop:'0.75rem'}}><p style={{margin:0,fontSize:'0.875rem',color:'var(--color-accent)',fontWeight:'600'}}>Total: <strong>{fmtM(todos.filter(l=>selQ.includes(l.id)).reduce((s,l)=>s+Number(l.valor),0))}</strong> ({selQ.length} lançamento(s))</p></div>}
            </div>
            <div style={s.mf}><button style={s.bs} onClick={()=>setMQLote(false)} disabled={salvQL}>Cancelar</button><button style={s.bp('#10b981')} onClick={quitarLote} disabled={salvQL||!selQ.length}>{salvQL?'⏳...`':`✅ Quitar ${selQ.length}`}</button></div>
          </div>
        </div>
      )}

      {/* MODAL CONFIG */}
      {mCfg&&(
        <div style={s.ov} onClick={e=>e.target===e.currentTarget&&setMCfg(false)}>
          <div style={{...s.mo,maxWidth:'380px'}}>
            <div style={s.mh}><h2 style={{margin:0,fontSize:'1.05rem',fontWeight:'700',color:'var(--color-text)'}}>⚙️ Configuração de Mensalidade</h2><button onClick={()=>setMCfg(false)} style={{background:'none',border:'none',color:'var(--color-text-muted)',fontSize:'1.5rem',cursor:'pointer'}}>×</button></div>
            <div style={s.mb}>
              <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
                <Lbl l="Valor da mensalidade (R$)" ch={<input type="number" step="0.01" min="0" style={s.inp} value={cfgForm.valor_mensalidade} onChange={e=>setCfgForm({...cfgForm,valor_mensalidade:e.target.value})}/>}/>
                <Lbl l="Dia de vencimento" ch={<input type="number" min="1" max="31" style={s.inp} value={cfgForm.dia_vencimento} onChange={e=>setCfgForm({...cfgForm,dia_vencimento:e.target.value})}/>}/>
              </div>
            </div>
            <div style={s.mf}><button style={s.bs} onClick={()=>setMCfg(false)}>Cancelar</button><button style={s.bp('var(--color-accent)')} onClick={salvarCfg} disabled={salvCfg}>{salvCfg?'⏳...':'💾 Salvar'}</button></div>
          </div>
        </div>
      )}

      {/* MODAL EXCLUIR */}
      {mExcl&&(
        <div style={s.ov} onClick={e=>e.target===e.currentTarget&&setMExcl(null)}>
          <div style={{...s.mo,maxWidth:'400px'}}>
            <div style={s.mh}><h2 style={{margin:0,fontSize:'1.05rem',fontWeight:'700',color:'#ef4444'}}>⚠️ Excluir lançamento</h2><button onClick={()=>setMExcl(null)} style={{background:'none',border:'none',color:'var(--color-text-muted)',fontSize:'1.5rem',cursor:'pointer'}}>×</button></div>
            <div style={{...s.mb,textAlign:'center'}}><div style={{fontSize:'3rem',marginBottom:'0.75rem'}}>🗑️</div><p style={{color:'var(--color-text)',marginBottom:'0.5rem'}}>Excluir o lançamento:</p><p style={{fontWeight:'700',color:'#ef4444'}}>{mExcl.descricao} — {fmtM(mExcl.valor)}</p><p style={{fontSize:'0.8rem',color:'var(--color-text-faint)',marginTop:'0.5rem'}}>Esta ação não pode ser desfeita.</p></div>
            <div style={s.mf}><button style={s.bs} onClick={()=>setMExcl(null)}>Cancelar</button><button style={s.bp('#ef4444')} onClick={excluir}>Excluir</button></div>
          </div>
        </div>
      )}

      {/* MODAL CATEGORIA */}
      {mCat&&(
        <div style={s.ov} onClick={e=>e.target===e.currentTarget&&fecharCat()}>
          <div style={{...s.mo,maxWidth:'460px'}}>
            <div style={s.mh}><h2 style={{margin:0,fontSize:'1.05rem',fontWeight:'700',color:'var(--color-text)'}}>🏷️ {editCatId?'Editar':'Nova'} Categoria</h2><button onClick={fecharCat} style={{background:'none',border:'none',color:'var(--color-text-muted)',fontSize:'1.5rem',cursor:'pointer'}}>×</button></div>
            <div style={s.mb}>
              <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
                <Lbl l="Nome *" ch={<input style={s.inp} value={catF.nome} onChange={e=>setCatF({...catF,nome:e.target.value})} placeholder="Ex: Mensalidade, Evento..."/>}/>
                <Lbl l="Tipo" ch={
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem'}}>
                    {[{v:'receita',l:'📈 Receita',c:'#10b981'},{v:'despesa',l:'📉 Despesa',c:'#ef4444'}].map(t=>(
                      <button key={t.v} type="button" onClick={()=>setCatF({...catF,tipo:t.v,categoria_pai_id:null})} style={{padding:'0.6rem',borderRadius:'var(--radius-lg)',border:'2px solid',borderColor:catF.tipo===t.v?t.c:'var(--color-border)',background:catF.tipo===t.v?`${t.c}18`:'var(--color-surface-2)',color:catF.tipo===t.v?t.c:'var(--color-text)',fontWeight:catF.tipo===t.v?'700':'400',cursor:'pointer'}}>{t.l}</button>
                    ))}
                  </div>
                }/>
                <Lbl l="Categoria pai (opcional)" ch={
                  <>
                    <select style={s.sel} value={catF.categoria_pai_id||''} onChange={e=>setCatF({...catF,categoria_pai_id:e.target.value||null})}>
                      <option value="">— Principal (sem pai) —</option>
                      {categorias.filter(c=>c.tipo===catF.tipo&&!c.categoria_pai_id&&c.id!==editCatId).map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                    <p style={{margin:'0.25rem 0 0',fontSize:'0.68rem',color:'var(--color-text-faint)'}}>Vazio = principal · Com pai = subcategoria</p>
                  </>
                }/>
                <Lbl l="Ordem" ch={<input type="number" min="0" style={s.inp} value={catF.ordem} onChange={e=>setCatF({...catF,ordem:parseInt(e.target.value)||0})}/>}/>
              </div>
            </div>
            <div style={s.mf}><button style={s.bs} onClick={fecharCat} disabled={salvCat}>Cancelar</button><button style={s.bp('var(--color-accent)')} onClick={salvarCat} disabled={salvCat}>{salvCat?'⏳...':editCatId?'💾 Salvar':'＋ Criar'}</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanceiroCunhadas;
