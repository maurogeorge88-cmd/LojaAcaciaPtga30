import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const fmt = (v) => parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const fmtData = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const primeiroSegundoNome = (nome) => {
  if (!nome) return '—';
  const p = nome.trim().split(' ');
  return p.length >= 2 ? `${p[0]} ${p[1]}` : p[0];
};

export default function RelatorioFinanceiro({ showError }) {
  const anoAtual = new Date().getFullYear();
  const mesAtual = new Date().getMonth() + 1;

  const [filtros, setFiltros] = useState({
    mes: mesAtual,
    ano: anoAtual,
    tipo: '',       // '' | 'receita' | 'despesa'
    status: '',     // '' | 'pago' | 'pendente'
  });
  const [lancamentos, setLancamentos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [carregou, setCarregou] = useState(false);

  const anos = [anoAtual - 1, anoAtual, anoAtual + 1];

  const buscar = async () => {
    setLoading(true);
    try {
      const { mes, ano, tipo, status } = filtros;

      let query = supabase
        .from('lancamentos_loja')
        .select('data_pagamento, data_vencimento, data_lancamento, status, valor, descricao, tipo_pagamento, categoria_id, categorias_financeiras(nome, tipo), irmaos(nome), origem_tipo')
        .order('data_vencimento', { ascending: true })
        .limit(1000);

      // Filtro de período
      const prim = `${ano}-${mes.toString().padStart(2,'0')}-01`;
      const ult  = `${ano}-${mes.toString().padStart(2,'0')}-${new Date(ano, mes, 0).getDate()}`;
      query = query.or(
        `and(status.eq.pago,data_pagamento.gte.${prim},data_pagamento.lte.${ult}),` +
        `and(status.eq.pendente,data_vencimento.gte.${prim},data_vencimento.lte.${ult})`
      );

      if (tipo) {
        // buscar categorias do tipo
        const { data: cats } = await supabase
          .from('categorias_financeiras')
          .select('id').eq('tipo', tipo);
        const ids = (cats || []).map(c => c.id);
        if (ids.length > 0) query = query.in('categoria_id', ids);
        else { setLancamentos([]); setLoading(false); setCarregou(true); return; }
      }

      if (status) query = query.eq('status', status);

      const { data, error } = await query;
      if (error) throw error;

      // Ordenar: data_pagamento se pago, senão data_vencimento
      const sorted = (data || []).sort((a, b) => {
        const da = a.status === 'pago' ? a.data_pagamento : a.data_vencimento;
        const db = b.status === 'pago' ? b.data_pagamento : b.data_vencimento;
        return (da || '').localeCompare(db || '');
      });

      setLancamentos(sorted);
      setCarregou(true);
    } catch (e) {
      showError?.('Erro ao buscar lançamentos: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Totais
  const totalReceitas = lancamentos
    .filter(l => l.categorias_financeiras?.tipo === 'receita')
    .reduce((s, l) => s + parseFloat(l.valor || 0), 0);
  const totalDespesas = lancamentos
    .filter(l => l.categorias_financeiras?.tipo === 'despesa')
    .reduce((s, l) => s + parseFloat(l.valor || 0), 0);

  const imprimir = () => {
    const titulo = `Relatório Financeiro — ${meses[filtros.mes - 1]}/${filtros.ano}`;
    const rows = lancamentos.map(l => {
      const tipo = l.categorias_financeiras?.tipo || '—';
      const dtRef = l.status === 'pago' ? l.data_pagamento : l.data_vencimento;
      const nomeIrmao = l.origem_tipo !== 'Loja' ? primeiroSegundoNome(l.irmaos?.nome) : '—';
      return `
        <tr>
          <td>${fmtData(dtRef)}</td>
          <td>${tipo === 'receita' ? 'Receita' : 'Despesa'}</td>
          <td>${l.categorias_financeiras?.nome || '—'}</td>
          <td>${l.descricao || '—'}</td>
          <td>${nomeIrmao}</td>
          <td style="text-align:right;color:${tipo==='receita'?'#166534':'#991b1b'}">R$ ${fmt(l.valor)}</td>
          <td style="text-align:center">${l.status === 'pago' ? 'S' : 'N'}</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${titulo}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; color: #111; }
      h2 { font-size: 15px; margin-bottom: 4px; }
      p.sub { font-size: 10px; color: #555; margin: 0 0 12px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #1e3a5f; color: #fff; padding: 5px 6px; text-align: left; font-size: 10px; }
      td { padding: 4px 6px; border-bottom: 1px solid #ddd; font-size: 10px; }
      tr:nth-child(even) td { background: #f9f9f9; }
      .totais { margin-top: 12px; display: flex; gap: 24px; }
      .totais div { font-size: 11px; }
      .totais strong { font-size: 13px; }
      @media print { body { margin: 10px; } }
    </style></head><body>
    <h2>🏛️ ${titulo}</h2>
    <p class="sub">A∴R∴L∴S∴ Acácia de Paranatinga nº 30 &nbsp;|&nbsp; Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</p>
    <table>
      <thead><tr>
        <th>Dt Pgto/Venc</th><th>Tipo</th><th>Categoria</th><th>Descrição</th>
        <th>Irmão</th><th style="text-align:right">Valor</th><th style="text-align:center">Pg</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totais">
      <div>Total Receitas: <strong style="color:#166534">R$ ${fmt(totalReceitas)}</strong></div>
      <div>Total Despesas: <strong style="color:#991b1b">R$ ${fmt(totalDespesas)}</strong></div>
      <div>Saldo: <strong style="color:${totalReceitas-totalDespesas>=0?'#166534':'#991b1b'}">R$ ${fmt(totalReceitas-totalDespesas)}</strong></div>
      <div>Total registros: <strong>${lancamentos.length}</strong></div>
    </div>
    </body></html>`;

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  const sInput = { background:'var(--color-surface-2)', color:'var(--color-text)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-md)', padding:'0.45rem 0.75rem', fontSize:'0.875rem' };

  return (
    <div style={{background:'var(--color-bg)', minHeight:'100vh', padding:'1rem', overflowX:'hidden'}}>

      {/* Header */}
      <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-xl)', padding:'1.25rem', marginBottom:'1rem'}}>
        <h2 style={{fontSize:'1.25rem', fontWeight:'700', color:'var(--color-text)', margin:'0 0 0.25rem'}}>
          📊 Relatório Financeiro
        </h2>
        <p style={{fontSize:'0.82rem', color:'var(--color-text-muted)', margin:0}}>
          Conferência de lançamentos por período
        </p>
      </div>

      {/* Filtros */}
      <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-xl)', padding:'1.25rem', marginBottom:'1rem'}}>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr auto', gap:'0.75rem', alignItems:'flex-end'}}>

          <div>
            <label style={{display:'block', fontSize:'0.72rem', fontWeight:'700', color:'var(--color-text-muted)', marginBottom:'0.35rem', textTransform:'uppercase'}}>Mês</label>
            <select value={filtros.mes} onChange={e => setFiltros(f => ({...f, mes: +e.target.value}))} style={{...sInput, width:'100%'}}>
              {meses.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
          </div>

          <div>
            <label style={{display:'block', fontSize:'0.72rem', fontWeight:'700', color:'var(--color-text-muted)', marginBottom:'0.35rem', textTransform:'uppercase'}}>Ano</label>
            <select value={filtros.ano} onChange={e => setFiltros(f => ({...f, ano: +e.target.value}))} style={{...sInput, width:'100%'}}>
              {anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div>
            <label style={{display:'block', fontSize:'0.72rem', fontWeight:'700', color:'var(--color-text-muted)', marginBottom:'0.35rem', textTransform:'uppercase'}}>Tipo</label>
            <select value={filtros.tipo} onChange={e => setFiltros(f => ({...f, tipo: e.target.value}))} style={{...sInput, width:'100%'}}>
              <option value=''>Todos</option>
              <option value='receita'>Receitas</option>
              <option value='despesa'>Despesas</option>
            </select>
          </div>

          <div>
            <label style={{display:'block', fontSize:'0.72rem', fontWeight:'700', color:'var(--color-text-muted)', marginBottom:'0.35rem', textTransform:'uppercase'}}>Status</label>
            <select value={filtros.status} onChange={e => setFiltros(f => ({...f, status: e.target.value}))} style={{...sInput, width:'100%'}}>
              <option value=''>Todos</option>
              <option value='pago'>Pagos</option>
              <option value='pendente'>Pendentes</option>
            </select>
          </div>

          <button
            onClick={buscar}
            disabled={loading}
            style={{padding:'0.45rem 1.5rem', background:'var(--color-accent)', color:'#fff', border:'none', borderRadius:'var(--radius-md)', cursor:'pointer', fontWeight:'700', fontSize:'0.875rem', opacity: loading ? 0.7 : 1}}
          >
            {loading ? '⏳' : '🔍 Buscar'}
          </button>
        </div>
      </div>

      {/* Resultado */}
      {carregou && (
        <>
          {/* Totalizadores */}
          <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'0.75rem', marginBottom:'1rem'}}>
            {[
              { label:'Registros', valor: lancamentos.length, cor:'var(--color-accent)', bg:'rgba(59,130,246,0.1)', border:'rgba(59,130,246,0.3)', fmt: v => v },
              { label:'Total Receitas', valor: totalReceitas, cor:'#10b981', bg:'rgba(16,185,129,0.1)', border:'rgba(16,185,129,0.3)', fmt: v => `R$ ${fmt(v)}` },
              { label:'Total Despesas', valor: totalDespesas, cor:'#ef4444', bg:'rgba(239,68,68,0.1)', border:'rgba(239,68,68,0.3)', fmt: v => `R$ ${fmt(v)}` },
              { label:'Saldo', valor: totalReceitas - totalDespesas, cor: totalReceitas-totalDespesas>=0?'#10b981':'#ef4444', bg: totalReceitas-totalDespesas>=0?'rgba(16,185,129,0.1)':'rgba(239,68,68,0.1)', border: totalReceitas-totalDespesas>=0?'rgba(16,185,129,0.3)':'rgba(239,68,68,0.3)', fmt: v => `R$ ${fmt(v)}` },
            ].map(c => (
              <div key={c.label} style={{background:c.bg, border:`1px solid ${c.border}`, borderLeft:`4px solid ${c.cor}`, borderRadius:'var(--radius-lg)', padding:'0.85rem 1rem'}}>
                <div style={{fontSize:'0.7rem', fontWeight:'700', color:c.cor, textTransform:'uppercase', marginBottom:'0.25rem'}}>{c.label}</div>
                <div style={{fontSize:'1.25rem', fontWeight:'800', color:'var(--color-text)'}}>{c.fmt(c.valor)}</div>
              </div>
            ))}
          </div>

          {/* Tabela */}
          <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-xl)', overflow:'hidden'}}>

            {/* Cabeçalho da tabela + botão imprimir */}
            <div style={{padding:'0.75rem 1rem', background:'var(--color-accent)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <span style={{fontWeight:'700', color:'#fff', fontSize:'0.9rem'}}>
                {meses[filtros.mes - 1]} / {filtros.ano}
                {filtros.tipo ? ` — ${filtros.tipo === 'receita' ? 'Receitas' : 'Despesas'}` : ''}
                {filtros.status ? ` — ${filtros.status === 'pago' ? 'Pagos' : 'Pendentes'}` : ''}
              </span>
              <button
                onClick={imprimir}
                style={{padding:'0.3rem 0.9rem', background:'rgba(255,255,255,0.15)', color:'#fff', border:'1px solid rgba(255,255,255,0.35)', borderRadius:'var(--radius-md)', cursor:'pointer', fontWeight:'700', fontSize:'0.8rem'}}
              >
                🖨️ Imprimir
              </button>
            </div>

            {/* Grid header */}
            <div style={{display:'grid', gridTemplateColumns:'90px 80px 150px 1fr 120px 100px 45px', gap:'0', padding:'0.5rem 0.75rem', background:'var(--color-surface-2)', borderBottom:'2px solid var(--color-accent)'}}>
              {['Dt Pgto/Venc','Tipo','Categoria','Descrição','Irmão','Valor','Pg'].map((h,i) => (
                <div key={h} style={{fontSize:'0.68rem', fontWeight:'700', color:'var(--color-text-muted)', textTransform:'uppercase', textAlign: i>=5?'center':'left'}}>{h}</div>
              ))}
            </div>

            {/* Linhas */}
            {lancamentos.length === 0 ? (
              <div style={{padding:'3rem', textAlign:'center', color:'var(--color-text-muted)'}}>
                Nenhum lançamento encontrado para o período.
              </div>
            ) : (
              <div style={{display:'flex', flexDirection:'column'}}>
                {lancamentos.map((l, idx) => {
                  const ehReceita = l.categorias_financeiras?.tipo === 'receita';
                  const dtRef = l.status === 'pago' ? l.data_pagamento : l.data_vencimento;
                  const nomeIrmao = l.origem_tipo !== 'Loja' ? primeiroSegundoNome(l.irmaos?.nome) : '—';
                  const pago = l.status === 'pago';

                  return (
                    <div key={l.id || idx} style={{
                      display:'grid',
                      gridTemplateColumns:'90px 80px 150px 1fr 120px 100px 45px',
                      gap:'0',
                      padding:'0.45rem 0.75rem',
                      borderBottom:'1px solid var(--color-border)',
                      background: idx%2===0 ? 'var(--color-surface)' : 'var(--color-surface-2)',
                      alignItems:'center',
                    }}>
                      {/* Data */}
                      <div style={{fontSize:'0.78rem', color:'var(--color-text)', fontWeight: pago ? '600' : '400'}}>
                        {fmtData(dtRef)}
                        {!pago && <div style={{fontSize:'0.62rem', color:'var(--color-text-muted)'}}>Venc.</div>}
                      </div>
                      {/* Tipo */}
                      <div>
                        <span style={{
                          fontSize:'0.65rem', fontWeight:'700', padding:'0.1rem 0.4rem', borderRadius:'999px',
                          background: ehReceita ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                          color: ehReceita ? '#10b981' : '#ef4444',
                          border: `1px solid ${ehReceita ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                        }}>
                          {ehReceita ? 'Receita' : 'Despesa'}
                        </span>
                      </div>
                      {/* Categoria */}
                      <div style={{fontSize:'0.78rem', color:'var(--color-text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}} title={l.categorias_financeiras?.nome}>
                        {l.categorias_financeiras?.nome || '—'}
                      </div>
                      {/* Descrição */}
                      <div style={{fontSize:'0.78rem', color:'var(--color-text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', paddingRight:'0.5rem'}} title={l.descricao}>
                        {l.descricao || '—'}
                      </div>
                      {/* Irmão */}
                      <div style={{fontSize:'0.78rem', color:'var(--color-text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}} title={l.irmaos?.nome}>
                        {nomeIrmao}
                      </div>
                      {/* Valor */}
                      <div style={{textAlign:'right', fontSize:'0.82rem', fontWeight:'700', color: ehReceita ? '#10b981' : '#ef4444'}}>
                        R$ {fmt(l.valor)}
                      </div>
                      {/* Pg S/N */}
                      <div style={{textAlign:'center'}}>
                        <span style={{
                          fontSize:'0.72rem', fontWeight:'800', padding:'0.1rem 0.4rem', borderRadius:'999px',
                          background: pago ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                          color: pago ? '#10b981' : '#f59e0b',
                          border: `1px solid ${pago ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                        }}>
                          {pago ? 'S' : 'N'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
