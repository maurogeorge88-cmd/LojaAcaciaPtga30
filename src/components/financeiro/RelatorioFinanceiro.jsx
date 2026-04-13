import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';

const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const fmt    = (v) => parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const fmtDt  = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const nomeAb = (nome) => {
  if (!nome) return '—';
  const p = nome.trim().split(' ');
  return p.length >= 2 ? `${p[0]} ${p[1]}` : p[0];
};

const VAZIO  = { status: null, obs: '' };
export default function RelatorioFinanceiro({ showError }) {
  const anoAtual = new Date().getFullYear();
  const mesAtual = new Date().getMonth() + 1;

  const [filtros, setFiltros]         = useState({ mes: mesAtual, ano: anoAtual, tipo: '', status: '' });
  const [lancamentos, setLancamentos] = useState([]);
  const [loading, setLoading]         = useState(false);
  const [carregou, setCarregou]       = useState(false);
  // conf: mapa { [lancamento_id]: { status: 'ok'|'ver'|null, obs: '' } }
  // Persistido no Supabase — tabela relatorio_financeiro_conferencia
  const [conf, setConf] = useState({});
  const confRef = useRef({});
  const [modalObs, setModalObs] = useState(null);
  const [salvando, setSalvando] = useState({}); // ids sendo salvos

  // Sincronizar confRef com conf
  useEffect(() => { confRef.current = conf; }, [conf]);

  // Carregar conferências do Supabase ao montar
  useEffect(() => { carregarConf(); }, []);

  const carregarConf = async () => {
    try {
      const { data, error } = await supabase
        .from('relatorio_financeiro_conferencia')
        .select('lancamento_id, status_conf, observacao');
      if (error) throw error;
      const mapa = {};
      (data || []).forEach(r => {
        mapa[r.lancamento_id] = { status: r.status_conf, obs: r.observacao || '' };
      });
      setConf(mapa);
      confRef.current = mapa;

      // ── Migração automática do localStorage ──────────────────────────────
      // Roda apenas se a tabela estiver vazia e houver dados no localStorage
      if ((data || []).length === 0) {
        await migrarLocalStorage();
      }
    } catch (e) {
      console.error('Erro ao carregar conferências:', e.message);
    }
  };

  const migrarLocalStorage = async () => {
    try {
      const fontes = [
        'relatorio_financeiro_conf_v2',
        'relatorio_financeiro_conf_v1',
        'relatorio_financeiro_conf',
      ];

      // Coletar todas as entradas de todas as versões
      const encontrados = {}; // { id: { status, obs } }

      fontes.forEach(fonte => {
        try {
          const raw = localStorage.getItem(fonte);
          if (!raw) return;
          const dados = JSON.parse(raw);
          Object.entries(dados).forEach(([k, v]) => {
            if (!v || !v.status) return;
            // Extrair ID numérico da chave (ex: "lrc_12345" → 12345)
            const base = k.replace('lrc_', '').split('|')[0];
            const idNum = parseInt(base, 10);
            if (!isNaN(idNum) && !encontrados[idNum]) {
              encontrados[idNum] = { status: v.status, obs: v.obs || '' };
            }
          });
        } catch {}
      });

      const registros = Object.entries(encontrados);
      if (registros.length === 0) return;

      // Verificar quais IDs existem de fato na tabela lancamentos_loja
      const ids = registros.map(([id]) => Number(id));
      const { data: validos } = await supabase
        .from('lancamentos_loja')
        .select('id')
        .in('id', ids);

      const idsValidos = new Set((validos || []).map(l => l.id));

      // Inserir apenas os válidos
      const upserts = registros
        .filter(([id]) => idsValidos.has(Number(id)))
        .map(([id, v]) => ({
          lancamento_id: Number(id),
          status_conf: v.status,
          observacao: v.obs || null,
        }));

      if (upserts.length === 0) return;

      const { error } = await supabase
        .from('relatorio_financeiro_conferencia')
        .upsert(upserts, { onConflict: 'lancamento_id' });

      if (!error) {
        console.log(`✅ Migrados ${upserts.length} registro(s) do localStorage para o Supabase`);
        // Limpar localStorage após migração bem-sucedida
        fontes.forEach(f => { try { localStorage.removeItem(f); } catch {} });
        // Recarregar conf do banco
        await carregarConf();
      }
    } catch (e) {
      console.error('Erro na migração:', e.message);
    }
  };

  const setStatus = async (id, novoStatus) => {
    if (!id) return;
    const atual = confRef.current[id] || { status: null, obs: '' };
    const statusFinal = atual.status === novoStatus ? null : novoStatus;

    // Atualizar local imediatamente (otimista)
    const novoConf = { ...confRef.current, [id]: { ...atual, status: statusFinal } };
    setConf(novoConf);
    confRef.current = novoConf;

    setSalvando(s => ({ ...s, [id]: true }));
    try {
      if (statusFinal === null) {
        // Remover registro se ambos nulos
        const obsAtual = atual.obs || '';
        if (!obsAtual) {
          await supabase.from('relatorio_financeiro_conferencia').delete().eq('lancamento_id', Number(id));
        } else {
          await supabase.from('relatorio_financeiro_conferencia')
            .update({ status_conf: 'ok', observacao: obsAtual })
            .eq('lancamento_id', id);
          // Mantém com status 'ok' se tinha obs — não deletar
        }
      } else {
        await supabase.from('relatorio_financeiro_conferencia')
          .upsert({ lancamento_id: id, status_conf: statusFinal, observacao: atual.obs || '' },
                  { onConflict: 'lancamento_id' });
      }
    } catch (e) {
      console.error('Erro ao salvar conferência:', e.message);
    } finally {
      setSalvando(s => { const n = { ...s }; delete n[id]; return n; });
    }
  };

  const salvarObs = async (id, texto) => {
    if (!id) return;
    const atual = confRef.current[id] || { status: 'ver', obs: '' };
    const novoConf = { ...confRef.current, [id]: { ...atual, obs: texto } };
    setConf(novoConf);
    confRef.current = novoConf;
    setModalObs(null);
    try {
      await supabase.from('relatorio_financeiro_conferencia')
        .upsert({ lancamento_id: Number(id), status_conf: atual.status || 'ver', observacao: texto },
                { onConflict: 'lancamento_id' });
    } catch (e) {
      console.error('Erro ao salvar observação:', e.message);
    }
  };

  const anos = [anoAtual - 1, anoAtual, anoAtual + 1];

  const getConf = (id) => conf[id] || VAZIO;



  const buscar = async () => {
    setLoading(true);
    try {
      const { mes, ano, tipo, status } = filtros;
      const prim = `${ano}-${String(mes).padStart(2,'0')}-01`;
      const ult  = `${ano}-${String(mes).padStart(2,'0')}-${new Date(ano, mes, 0).getDate()}`;

      // IDs marcados — são UUIDs diretos do lancamento_id
      const idsMarcados = Object.keys(confRef.current)
        .filter(k => confRef.current[k]?.status);

      // Query principal: lançamentos do período
      let query = supabase
        .from('lancamentos_loja')
        .select('id, data_pagamento, data_vencimento, status, valor, descricao, categoria_id, categorias_financeiras(nome, tipo), irmaos(nome), origem_tipo')
        .limit(1000);

      if (idsMarcados.length > 0) {
        // Incluir: registros do período OU registros marcados
        query = query.or(
          `and(status.eq.pago,data_pagamento.gte.${prim},data_pagamento.lte.${ult}),` +
          `and(status.eq.pendente,data_vencimento.gte.${prim},data_vencimento.lte.${ult}),` +
          `id.in.(${idsMarcados.join(',')})`
        );
      } else {
        query = query.or(
          `and(status.eq.pago,data_pagamento.gte.${prim},data_pagamento.lte.${ult}),` +
          `and(status.eq.pendente,data_vencimento.gte.${prim},data_vencimento.lte.${ult})`
        );
      }

      if (tipo) {
        const { data: cats } = await supabase.from('categorias_financeiras').select('id').eq('tipo', tipo);
        const ids = (cats || []).map(c => c.id);
        if (!ids.length) { setLancamentos([]); setCarregou(true); setLoading(false); return; }
        query = query.in('categoria_id', ids);
      }
      // Filtro de status: NÃO aplicar se houver marcados — eles podem ter status diferente
      if (status && idsMarcados.length === 0) query = query.eq('status', status);

      const { data, error } = await query;
      if (error) throw error;

      // Pós-filtro em JS: se tem marcados E filtro de status ativo,
      // manter os marcados independente do status deles
      let resultado = data || [];
      if (status && idsMarcados.length > 0) {
        resultado = resultado.filter(l =>
          l.status === status || idsMarcados.includes(String(l.id))
        );
      }

      const sorted = resultado.sort((a, b) => {
        const da = a.status === 'pago' ? a.data_pagamento : a.data_vencimento;
        const db = b.status === 'pago' ? b.data_pagamento : b.data_vencimento;
        return (da || '').localeCompare(db || '');
      });
      setLancamentos(sorted);
      setCarregou(true);
    } catch (e) {
      showError?.('Erro ao buscar: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const totalReceitas = lancamentos.filter(l => l.categorias_financeiras?.tipo === 'receita').reduce((s,l) => s + parseFloat(l.valor||0), 0);
  const totalDespesas = lancamentos.filter(l => l.categorias_financeiras?.tipo === 'despesa').reduce((s,l) => s + parseFloat(l.valor||0), 0);

  // Conferidos (OK)
  const lancamentosOk  = lancamentos.filter(l => getConf(l.id).status === 'ok');
  const lancamentosVer = lancamentos.filter(l => getConf(l.id).status === 'ver');
  const totalOk  = lancamentosOk.length;
  const totalVer = lancamentosVer.length;

  // Valores conferidos (OK)
  const receitasOk  = lancamentosOk.filter(l => l.categorias_financeiras?.tipo === 'receita').reduce((s,l) => s + parseFloat(l.valor||0), 0);
  const despesasOk  = lancamentosOk.filter(l => l.categorias_financeiras?.tipo === 'despesa').reduce((s,l) => s + parseFloat(l.valor||0), 0);
  const saldoOk     = receitasOk - despesasOk;

  // Diferença: total - conferido
  const diffReceitas = totalReceitas - receitasOk;
  const diffDespesas = totalDespesas - despesasOk;
  const diffSaldo    = (totalReceitas - totalDespesas) - saldoOk;

  const totalConferido = lancamentosOk.length + lancamentosVer.length;
  const pctConferido   = lancamentos.length > 0 ? Math.round((totalConferido / lancamentos.length) * 100) : 0;

  const imprimir = () => {
    const titulo = `Relatório Financeiro — ${meses[filtros.mes-1]}/${filtros.ano}`;
    const rows = lancamentos.map((l, idx) => {
      const c     = getConf(l.id);
      const tipo  = l.categorias_financeiras?.tipo || '—';
      const dtRef = l.status === 'pago' ? l.data_pagamento : l.data_vencimento;
      const irmao = l.origem_tipo !== 'Loja' ? nomeAb(l.irmaos?.nome) : '—';
      const st    = c.status === 'ok' ? '✓ OK' : c.status === 'ver' ? '! Ver' : '';
      const cor   = c.status === 'ok' ? '#166534' : c.status === 'ver' ? '#991b1b' : '#444';
      return `<tr>
        <td>${fmtDt(dtRef)}</td>
        <td>${tipo === 'receita' ? 'Receita' : 'Despesa'}</td>
        <td>${l.categorias_financeiras?.nome || '—'}</td>
        <td>${l.descricao || '—'}</td>
        <td>${irmao}</td>
        <td style="text-align:right;color:${tipo==='receita'?'#166534':'#991b1b'}">R$ ${fmt(l.valor)}</td>
        <td style="text-align:center">${l.status === 'pago' ? 'S' : 'N'}</td>
        <td style="text-align:center;color:${cor};font-weight:700">${st}</td>
        <td>${c.obs || ''}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${titulo}</title>
    <style>body{font-family:Arial,sans-serif;font-size:10px;margin:20px;color:#111}
    h2{font-size:14px;margin-bottom:3px}p.sub{font-size:9px;color:#555;margin:0 0 10px}
    table{width:100%;border-collapse:collapse}
    th{background:#1e3a5f;color:#fff;padding:4px 5px;text-align:left;font-size:9px}
    td{padding:3px 5px;border-bottom:1px solid #ddd;font-size:9px}
    tr:nth-child(even) td{background:#f9f9f9}
    .tot{margin-top:10px;display:flex;gap:20px}
    .tot div{font-size:10px}.tot strong{font-size:12px}
    @media print{body{margin:8px}}</style></head><body>
    <h2>🏛️ ${titulo}</h2>
    <p class="sub">A∴R∴L∴S∴ Acácia de Paranatinga nº 30 | Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</p>
    <table><thead><tr>
    <th>Dt Pgto/Venc</th><th>Tipo</th><th>Categoria</th><th>Descrição</th>
    <th>Irmão</th><th style="text-align:right">Valor</th><th style="text-align:center">Pg</th>
    <th style="text-align:center">Conf.</th><th>Obs.</th>
    </tr></thead><tbody>${rows}</tbody></table>
    <div class="tot">
    <div>Receitas:<strong style="color:#166534">R$ ${fmt(totalReceitas)}</strong></div>
    <div>Despesas:<strong style="color:#991b1b">R$ ${fmt(totalDespesas)}</strong></div>
    <div>Saldo:<strong style="color:${totalReceitas-totalDespesas>=0?'#166534':'#991b1b'}">R$ ${fmt(totalReceitas-totalDespesas)}</strong></div>
    <div>✓ OK:<strong>${totalOk}</strong></div>
    <div>! A Verificar:<strong>${totalVer}</strong></div>
    </div></body></html>`;

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  const sInput = { background:'var(--color-surface-2)', color:'var(--color-text)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-md)', padding:'0.45rem 0.75rem', fontSize:'0.875rem' };
  const GRID   = '92px 78px 145px 1fr 115px 98px 42px 95px';

  return (
    <div style={{background:'var(--color-bg)', minHeight:'100vh', padding:'1rem', overflowX:'hidden'}}>

      <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-xl)', padding:'1.25rem', marginBottom:'1rem'}}>
        <h2 style={{fontSize:'1.25rem', fontWeight:'700', color:'var(--color-text)', margin:'0 0 0.2rem'}}>📊 Relatório Financeiro</h2>
        <p style={{fontSize:'0.82rem', color:'var(--color-text-muted)', margin:0}}>Conferência e conciliação de lançamentos</p>


      </div>

      <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-xl)', padding:'1.25rem', marginBottom:'1rem'}}>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr auto', gap:'0.75rem', alignItems:'flex-end'}}>
          {[
            { label:'Mês',    el:<select value={filtros.mes}    onChange={e=>setFiltros(f=>({...f,mes:+e.target.value}))}    style={{...sInput,width:'100%'}}>{meses.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}</select> },
            { label:'Ano',    el:<select value={filtros.ano}    onChange={e=>setFiltros(f=>({...f,ano:+e.target.value}))}    style={{...sInput,width:'100%'}}>{anos.map(a=><option key={a} value={a}>{a}</option>)}</select> },
            { label:'Tipo',   el:<select value={filtros.tipo}   onChange={e=>setFiltros(f=>({...f,tipo:e.target.value}))}   style={{...sInput,width:'100%'}}><option value=''>Todos</option><option value='receita'>Receitas</option><option value='despesa'>Despesas</option></select> },
            { label:'Status', el:<select value={filtros.status} onChange={e=>setFiltros(f=>({...f,status:e.target.value}))} style={{...sInput,width:'100%'}}><option value=''>Todos</option><option value='pago'>Pagos</option><option value='pendente'>Pendentes</option></select> },
          ].map(({label,el}) => (
            <div key={label}>
              <label style={{display:'block', fontSize:'0.72rem', fontWeight:'700', color:'var(--color-text-muted)', marginBottom:'0.3rem', textTransform:'uppercase'}}>{label}</label>
              {el}
            </div>
          ))}
          <button onClick={buscar} disabled={loading}
            style={{padding:'0.45rem 1.5rem', background:'var(--color-accent)', color:'#fff', border:'none', borderRadius:'var(--radius-md)', cursor:'pointer', fontWeight:'700', opacity:loading?0.7:1}}>
            {loading ? '⏳' : '🔍 Buscar'}
          </button>
        </div>
      </div>

      {carregou && (<>
        {/* ── Painel de totalizadores ── */}
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0.75rem', marginBottom:'1rem'}}>

          {/* Coluna 1: Total do filtro */}
          <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-xl)', overflow:'hidden'}}>
            <div style={{background:'var(--color-accent)', padding:'0.5rem 0.9rem'}}>
              <span style={{fontSize:'0.72rem', fontWeight:'700', color:'#fff', textTransform:'uppercase', letterSpacing:'0.05em'}}>
                📋 Total do Período — {lancamentos.length} registro(s)
              </span>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0', borderTop:'1px solid var(--color-border)'}}>
              {[
                { label:'Receitas',  val:totalReceitas,               cor:'#10b981' },
                { label:'Despesas',  val:totalDespesas,               cor:'#ef4444' },
                { label:'Saldo',     val:totalReceitas-totalDespesas, cor:totalReceitas-totalDespesas>=0?'#10b981':'#ef4444' },
              ].map((c,i) => (
                <div key={c.label} style={{padding:'0.65rem 0.75rem', borderRight: i<2?'1px solid var(--color-border)':'none'}}>
                  <div style={{fontSize:'0.65rem', fontWeight:'700', color:'var(--color-text-muted)', textTransform:'uppercase', marginBottom:'0.15rem'}}>{c.label}</div>
                  <div style={{fontSize:'0.95rem', fontWeight:'800', color:c.cor}}>R$ {fmt(c.val)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Coluna 2: Conferido (OK) */}
          <div style={{background:'var(--color-surface)', border:'1px solid rgba(16,185,129,0.4)', borderRadius:'var(--radius-xl)', overflow:'hidden'}}>
            <div style={{background:'#10b981', padding:'0.5rem 0.9rem', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <span style={{fontSize:'0.72rem', fontWeight:'700', color:'#fff', textTransform:'uppercase', letterSpacing:'0.05em'}}>
                ✓ Conferido — {totalOk} registro(s)
              </span>
              <span style={{fontSize:'0.72rem', fontWeight:'800', color:'#fff', background:'rgba(255,255,255,0.25)', borderRadius:'999px', padding:'0.1rem 0.5rem'}}>
                {pctConferido}%
              </span>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0', borderTop:'1px solid rgba(16,185,129,0.2)'}}>
              {[
                { label:'Receitas', val:receitasOk, cor:'#10b981' },
                { label:'Despesas', val:despesasOk, cor:'#ef4444' },
                { label:'Saldo',    val:saldoOk,    cor:saldoOk>=0?'#10b981':'#ef4444' },
              ].map((c,i) => (
                <div key={c.label} style={{padding:'0.65rem 0.75rem', borderRight: i<2?'1px solid var(--color-border)':'none'}}>
                  <div style={{fontSize:'0.65rem', fontWeight:'700', color:'var(--color-text-muted)', textTransform:'uppercase', marginBottom:'0.15rem'}}>{c.label}</div>
                  <div style={{fontSize:'0.95rem', fontWeight:'800', color:c.cor}}>R$ {fmt(c.val)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Coluna 3: Diferença (ainda não conferido) */}
          <div style={{background:'var(--color-surface)', border:`1px solid ${diffSaldo!==0?'rgba(245,158,11,0.4)':'rgba(16,185,129,0.3)'}`, borderRadius:'var(--radius-xl)', overflow:'hidden'}}>
            <div style={{background: diffSaldo!==0?'#f59e0b':'#10b981', padding:'0.5rem 0.9rem', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <span style={{fontSize:'0.72rem', fontWeight:'700', color:'#fff', textTransform:'uppercase', letterSpacing:'0.05em'}}>
                {diffSaldo!==0?'⏳ Pendente conferência':'✅ Tudo conferido'}
              </span>
              {totalVer > 0 && (
                <span style={{fontSize:'0.72rem', fontWeight:'800', color:'#fff', background:'rgba(239,68,68,0.4)', borderRadius:'999px', padding:'0.1rem 0.5rem'}}>
                  ! {totalVer} a verificar
                </span>
              )}
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0', borderTop:'1px solid var(--color-border)'}}>
              {[
                { label:'Receitas', val:diffReceitas, cor: diffReceitas>0?'#f59e0b':'#10b981' },
                { label:'Despesas', val:diffDespesas, cor: diffDespesas>0?'#f59e0b':'#10b981' },
                { label:'Diferença',val:diffSaldo,    cor: diffSaldo!==0?'#f59e0b':'#10b981'  },
              ].map((c,i) => (
                <div key={c.label} style={{padding:'0.65rem 0.75rem', borderRight: i<2?'1px solid var(--color-border)':'none'}}>
                  <div style={{fontSize:'0.65rem', fontWeight:'700', color:'var(--color-text-muted)', textTransform:'uppercase', marginBottom:'0.15rem'}}>{c.label}</div>
                  <div style={{fontSize:'0.95rem', fontWeight:'800', color:c.cor}}>R$ {fmt(c.val)}</div>
                </div>
              ))}
            </div>
          </div>

        </div>

        <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-xl)', overflow:'hidden'}}>
          <div style={{padding:'0.75rem 1rem', background:'var(--color-accent)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <span style={{fontWeight:'700', color:'#fff', fontSize:'0.9rem'}}>
              {meses[filtros.mes-1]} / {filtros.ano}
              {filtros.tipo   ? ` — ${filtros.tipo==='receita'?'Receitas':'Despesas'}` : ''}
              {filtros.status ? ` — ${filtros.status==='pago'?'Pagos':'Pendentes'}` : ''}
            </span>
            <button onClick={imprimir} style={{padding:'0.3rem 0.9rem', background:'rgba(255,255,255,0.15)', color:'#fff', border:'1px solid rgba(255,255,255,0.35)', borderRadius:'var(--radius-md)', cursor:'pointer', fontWeight:'700', fontSize:'0.8rem'}}>
              🖨️ Imprimir
            </button>
          </div>

          <div style={{display:'grid', gridTemplateColumns:GRID, padding:'0.5rem 0.75rem', background:'var(--color-surface-2)', borderBottom:'2px solid var(--color-accent)'}}>
            {['Dt Pgto/Venc','Tipo','Categoria','Descrição','Irmão','Valor','Pg','Conf.'].map((h,i)=>(
              <div key={h} style={{fontSize:'0.66rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',textAlign:i>=5?'center':'left'}}>{h}</div>
            ))}
          </div>

          {lancamentos.length === 0 ? (
            <div style={{padding:'3rem', textAlign:'center', color:'var(--color-text-muted)'}}>Nenhum lançamento encontrado.</div>
          ) : lancamentos.map((l, idx) => {
            const ehReceita = l.categorias_financeiras?.tipo === 'receita';
            const dtRef     = l.status === 'pago' ? l.data_pagamento : l.data_vencimento;
            const irmao     = l.origem_tipo !== 'Loja' ? nomeAb(l.irmaos?.nome) : '—';
            const pago      = l.status === 'pago';
            const c         = getConf(l.id);
            const k         = l.id;
            const bgLinha   = c.status==='ok'  ? (idx%2===0?'rgba(16,185,129,0.07)':'rgba(16,185,129,0.12)')
                            : c.status==='ver' ? (idx%2===0?'rgba(239,68,68,0.07)':'rgba(239,68,68,0.12)')
                            : idx%2===0 ? 'var(--color-surface)' : 'var(--color-surface-2)';

            return (
              <div key={l.id||idx} style={{display:'grid',gridTemplateColumns:GRID,padding:'0.42rem 0.75rem',borderBottom:'1px solid var(--color-border)',background:bgLinha,alignItems:'center'}}>

                <div style={{fontSize:'0.76rem',color:'var(--color-text)',fontWeight:pago?'600':'400'}}>
                  {fmtDt(dtRef)}
                  {!pago && <div style={{fontSize:'0.6rem',color:'var(--color-text-muted)'}}>Venc.</div>}
                </div>

                <div>
                  <span style={{fontSize:'0.62rem',fontWeight:'700',padding:'0.1rem 0.38rem',borderRadius:'999px',
                    background:ehReceita?'rgba(16,185,129,0.15)':'rgba(239,68,68,0.15)',
                    color:ehReceita?'#10b981':'#ef4444',
                    border:`1px solid ${ehReceita?'rgba(16,185,129,0.3)':'rgba(239,68,68,0.3)'}`}}>
                    {ehReceita?'Receita':'Despesa'}
                  </span>
                </div>

                <div style={{fontSize:'0.76rem',color:'var(--color-text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={l.categorias_financeiras?.nome}>
                  {l.categorias_financeiras?.nome||'—'}
                </div>

                <div style={{fontSize:'0.76rem',color:'var(--color-text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',paddingRight:'0.5rem'}} title={l.descricao}>
                  {l.descricao||'—'}
                </div>

                <div style={{fontSize:'0.76rem',color:'var(--color-text-muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={l.irmaos?.nome}>
                  {irmao}
                </div>

                <div style={{textAlign:'right',fontSize:'0.8rem',fontWeight:'700',color:ehReceita?'#10b981':'#ef4444'}}>
                  R$ {fmt(l.valor)}
                </div>

                <div style={{textAlign:'center'}}>
                  <span style={{fontSize:'0.68rem',fontWeight:'800',padding:'0.1rem 0.38rem',borderRadius:'999px',
                    background:pago?'rgba(16,185,129,0.15)':'rgba(245,158,11,0.15)',
                    color:pago?'#10b981':'#f59e0b',
                    border:`1px solid ${pago?'rgba(16,185,129,0.3)':'rgba(245,158,11,0.3)'}`}}>
                    {pago?'S':'N'}
                  </span>
                </div>

                <div style={{display:'flex',gap:'0.22rem',justifyContent:'center',alignItems:'center'}}>
                  <button onClick={()=>setStatus(l.id,'ok')} title="Conferido — OK"
                    style={{padding:'0.1rem 0.36rem',borderRadius:'var(--radius-sm)',fontSize:'0.68rem',fontWeight:'800',
                      cursor:'pointer',border:'1px solid #10b981',
                      background:c.status==='ok'?'#10b981':'transparent',
                      color:c.status==='ok'?'#fff':'#10b981'}}>✓</button>

                  <button onClick={()=>setStatus(l.id,'ver')} title="Marcar para verificar"
                    style={{padding:'0.1rem 0.36rem',borderRadius:'var(--radius-sm)',fontSize:'0.68rem',fontWeight:'800',
                      cursor:'pointer',border:'1px solid #ef4444',
                      background:c.status==='ver'?'#ef4444':'transparent',
                      color:c.status==='ver'?'#fff':'#ef4444'}}>!</button>

                  {c.status === 'ver' && (
                    <button
                      onClick={()=>setModalObs({k:l.id, obs:c.obs, descricao:l.descricao||l.categorias_financeiras?.nome||''})}
                      title={c.obs?`Obs: ${c.obs}`:"Adicionar observação"}
                      style={{padding:'0.1rem 0.28rem',borderRadius:'var(--radius-sm)',fontSize:'0.62rem',
                        cursor:'pointer',border:`1px solid ${c.obs?'rgba(239,68,68,0.5)':'var(--color-border)'}`,
                        background:c.obs?'rgba(239,68,68,0.15)':'transparent',
                        color:c.obs?'#ef4444':'var(--color-text-muted)'}}>📝</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </>)}

      {modalObs && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:999,padding:'1rem'}}>
          <div style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-xl)',width:'100%',maxWidth:'26rem',overflow:'hidden'}}>
            <div style={{background:'#ef4444',padding:'0.9rem 1.25rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontWeight:'700',color:'#fff',fontSize:'0.95rem'}}>📝 Observação</div>
                <div style={{fontSize:'0.72rem',color:'rgba(255,255,255,0.85)',marginTop:'0.1rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'18rem'}}
                  title={modalObs.descricao}>{modalObs.descricao}</div>
              </div>
              <button onClick={()=>setModalObs(null)}
                style={{background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',color:'#fff',borderRadius:'50%',width:'1.8rem',height:'1.8rem',cursor:'pointer',fontWeight:'700',fontSize:'1rem',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
            </div>

            <div style={{padding:'1.25rem'}}>
              <label style={{display:'block',fontSize:'0.75rem',fontWeight:'700',color:'var(--color-text-muted)',marginBottom:'0.4rem',textTransform:'uppercase'}}>
                O que precisa verificar?
              </label>
              <textarea autoFocus rows={4} defaultValue={modalObs.obs} id="obs-ta"
                placeholder="Ex: valor diverge do comprovante, categoria errada..."
                style={{width:'100%',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',padding:'0.6rem 0.75rem',fontSize:'0.875rem',resize:'vertical',outline:'none',boxSizing:'border-box'}}
              />
            </div>

            <div style={{padding:'0 1.25rem 1.25rem',display:'flex',gap:'0.6rem',justifyContent:'flex-end'}}>
              <button onClick={()=>setModalObs(null)}
                style={{padding:'0.45rem 1rem',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',cursor:'pointer',fontWeight:'600',fontSize:'0.875rem'}}>
                Cancelar
              </button>
              <button onClick={()=>salvarObs(modalObs.k, document.getElementById('obs-ta').value.trim())}
                style={{padding:'0.45rem 1.25rem',background:'#ef4444',color:'#fff',border:'none',borderRadius:'var(--radius-md)',cursor:'pointer',fontWeight:'700',fontSize:'0.875rem'}}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
