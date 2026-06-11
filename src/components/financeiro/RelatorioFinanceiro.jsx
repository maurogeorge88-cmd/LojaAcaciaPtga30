import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { formatarMoeda } from './utils/formatadores';

const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];
const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const parseData = (dataStr) => dataStr ? new Date(dataStr + 'T00:00:00') : null;

// ─── Classificação de lançamentos ──────────────────────────────────────────────
const classificar = (l) => {
  const nomeCat = l.cat_nome?.toLowerCase() || '';
  const isTronco = nomeCat.includes('tronco');
  const isDinheiro = l.tipo_pagamento === 'dinheiro';
  const isCompensacao = l.tipo_pagamento === 'compensacao';
  const isTransfInterna = l.eh_transferencia_interna === true;

  // Ignorar sempre
  if (l.status !== 'pago') return null;
  if (isCompensacao) return null;
  if (l.cat_tipo === 'despesa') {
    if (nomeCat.includes('despesas pagas pelo irmão') || nomeCat.includes('despesa paga pelo irmão')) return null;
  }

  if (l.cat_tipo === 'receita') {
    // Tronco em dinheiro → caixa físico
    if (isTronco && isDinheiro) return { grupo: 'caixa_receita' };
    // Depósito de tronco (transferência interna receita tronco) → bancário
    if (isTronco && isTransfInterna) return { grupo: 'banco_receita' };
    // Depósito (sangria depositada) → bancário
    if (isTransfInterna) return { grupo: 'banco_deposito' };
    // Receita em dinheiro → caixa físico
    if (isDinheiro) return { grupo: 'caixa_receita' };
    // Receita bancária
    return { grupo: 'banco_receita' };
  }

  if (l.cat_tipo === 'despesa') {
    // Sangria (transferência interna despesa) → reduz caixa, aumenta banco
    if (isTransfInterna) return { grupo: 'sangria' };
    // Despesa em dinheiro → caixa físico
    if (isDinheiro) return { grupo: 'caixa_despesa' };
    // Despesa bancária
    return { grupo: 'banco_despesa' };
  }

  return null;
};

// ─── Saldo acumulado ANTES de um período ───────────────────────────────────────
const calcularSaldoAnterior = (lancamentos, periodo) => {
  let dataLimite;
  if (periodo.mes > 0) {
    dataLimite = new Date(periodo.ano, periodo.mes - 1, 1); // 1º dia do mês
  } else {
    dataLimite = new Date(periodo.ano, 0, 1); // 1º jan do ano
  }

  const anteriores = lancamentos.filter(l => {
    const d = parseData(l.data_pagamento);
    if (!d) return false;
    return d < dataLimite;
  });

  let bancario = 0;
  let caixa = 0;

  anteriores.forEach(l => {
    const cl = classificar(l);
    if (!cl) return;
    if (cl.grupo === 'banco_receita') bancario += parseFloat(l.valor);
    if (cl.grupo === 'banco_deposito') bancario += parseFloat(l.valor);
    if (cl.grupo === 'banco_despesa') bancario -= parseFloat(l.valor);
    if (cl.grupo === 'sangria') { bancario += parseFloat(l.valor); caixa -= parseFloat(l.valor); }
    if (cl.grupo === 'caixa_receita') caixa += parseFloat(l.valor);
    if (cl.grupo === 'caixa_despesa') caixa -= parseFloat(l.valor);
  });

  return { bancario, caixa };
};

// ─── Filtrar lançamentos de um período ─────────────────────────────────────────
const filtrarPeriodo = (lancamentos, periodo) => {
  return lancamentos.filter(l => {
    if (l.status !== 'pago') return false;
    const d = parseData(l.data_pagamento || l.data_vencimento);
    if (!d) return false;
    if (d.getFullYear() !== periodo.ano) return false;
    if (periodo.mes > 0 && d.getMonth() + 1 !== periodo.mes) return false;
    return true;
  });
};

// ─── Agrupar por categoria/subcategoria ────────────────────────────────────────
const agruparCategorias = (lancs, tipo, catMap) => {
  const filtrados = lancs.filter(l => {
    const cl = classificar(l);
    if (!cl) return false;
    if (tipo === 'receita') return cl.grupo === 'banco_receita' || cl.grupo === 'caixa_receita' || cl.grupo === 'banco_deposito';
    if (tipo === 'despesa') return cl.grupo === 'banco_despesa' || cl.grupo === 'caixa_despesa';
    return false;
  }).filter(l => l.cat_tipo === tipo);

  const porCat = {};
  filtrados.forEach(l => {
    const id = l.cat_id || 'sem';
    if (!porCat[id]) porCat[id] = {
      id, nome: l.cat_nome || 'Sem categoria',
      valor: 0, valorBanco: 0, valorCaixa: 0,
      pai_id: l.cat_pai_id, nivel: l.cat_nivel ?? 1
    };
    const v = parseFloat(l.valor || 0);
    const cl = classificar(l);
    porCat[id].valor += v;
    if (cl?.grupo?.startsWith('banco') || cl?.grupo === 'banco_deposito') porCat[id].valorBanco += v;
    else porCat[id].valorCaixa += v;
  });

  const grupos = {};
  Object.values(porCat).forEach(cat => {
    if (!cat.pai_id) {
      if (!grupos[cat.id]) grupos[cat.id] = { ...cat, filhos: [] };
      else { grupos[cat.id].valor += cat.valor; grupos[cat.id].valorBanco += cat.valorBanco; grupos[cat.id].valorCaixa += cat.valorCaixa; }
    } else {
      const pai = catMap[cat.pai_id];
      const paiId = pai?.id || cat.pai_id;
      const paiNome = pai?.nome || 'Outros';
      if (!grupos[paiId]) grupos[paiId] = { id: paiId, nome: paiNome, valor: 0, valorBanco: 0, valorCaixa: 0, filhos: [] };
      grupos[paiId].filhos.push(cat);
      grupos[paiId].valor += cat.valor;
      grupos[paiId].valorBanco += cat.valorBanco;
      grupos[paiId].valorCaixa += cat.valorCaixa;
    }
  });

  return Object.values(grupos).sort((a, b) => b.valor - a.valor);
};

export default function RelatorioFinanceiro({ isOpen, onClose, showError }) {
  const [lancamentos, setLancamentos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [anosDisponiveis, setAnosDisponiveis] = useState([]);
  const [loading, setLoading] = useState(true);

  const anoAtual = new Date().getFullYear();
  const [periodoA, setPeriodoA] = useState({ mes: 0, ano: anoAtual });
  const [periodoB, setPeriodoB] = useState({ mes: 0, ano: anoAtual - 1 });
  const [mostrarComparacao, setMostrarComparacao] = useState(false);
  const [aba, setAba] = useState('saldo');

  useEffect(() => { if (isOpen) carregarDados(); }, [isOpen]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const { data: cats, error: errCat } = await supabase
        .from('categorias_financeiras')
        .select('id, nome, tipo, categoria_pai_id, nivel')
        .order('nivel').order('nome');
      if (errCat) throw errCat;
      setCategorias(cats || []);

      const { data: lancs, error: errLanc } = await supabase
        .from('lancamentos_loja')
        .select('id, descricao, valor, status, tipo_pagamento, eh_transferencia_interna, data_pagamento, data_vencimento, categorias_financeiras(id, nome, tipo, categoria_pai_id, nivel)')
        .order('data_pagamento', { ascending: false });
      if (errLanc) throw errLanc;

      const normalizados = (lancs || []).map(l => ({
        ...l,
        cat_id: l.categorias_financeiras?.id,
        cat_nome: l.categorias_financeiras?.nome,
        cat_tipo: l.categorias_financeiras?.tipo,
        cat_pai_id: l.categorias_financeiras?.categoria_pai_id,
        cat_nivel: l.categorias_financeiras?.nivel ?? 1,
        eh_transferencia_interna: l.eh_transferencia_interna ?? false,
      }));

      setLancamentos(normalizados);

      const anos = [...new Set(
        normalizados.map(l => {
          const d = parseData(l.data_pagamento || l.data_vencimento);
          return d ? d.getFullYear() : null;
        }).filter(Boolean)
      )].sort((a, b) => b - a);
      setAnosDisponiveis(anos);

    } catch (err) {
      showError?.('Erro ao carregar dados: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Calcular tudo para um período ──────────────────────────────────────────
  const calcularPeriodo = (periodo) => {
    const lancsPeríodo = filtrarPeriodo(lancamentos, periodo);
    const anterior = calcularSaldoAnterior(lancamentos, periodo);
    const catMap = {};
    categorias.forEach(c => { catMap[c.id] = c; });

    let recBanco = 0, recCaixa = 0, despBanco = 0, despCaixa = 0, depositos = 0, sangrias = 0;
    lancsPeríodo.forEach(l => {
      const cl = classificar(l);
      if (!cl) return;
      const v = parseFloat(l.valor || 0);
      if (cl.grupo === 'banco_receita') recBanco += v;
      if (cl.grupo === 'caixa_receita') recCaixa += v;
      if (cl.grupo === 'banco_deposito') depositos += v;
      if (cl.grupo === 'banco_despesa') despBanco += v;
      if (cl.grupo === 'caixa_despesa') despCaixa += v;
      if (cl.grupo === 'sangria') sangrias += v;
    });

    const saldoBancario = anterior.bancario + recBanco + depositos - despBanco;
    const saldoCaixa = anterior.caixa + recCaixa - despCaixa - sangrias;
    const saldoTotal = saldoBancario + saldoCaixa;

    return {
      anterior,
      recBanco, recCaixa, despBanco, despCaixa, depositos, sangrias,
      saldoBancario, saldoCaixa, saldoTotal,
      grupos: {
        receitas: agruparCategorias(lancsPeríodo, 'receita', catMap),
        despesas: agruparCategorias(lancsPeríodo, 'despesa', catMap),
      }
    };
  };

  const dadosA = useMemo(() => calcularPeriodo(periodoA), [lancamentos, categorias, periodoA]);
  const dadosB = useMemo(() => calcularPeriodo(periodoB), [lancamentos, categorias, periodoB]);

  // ─── Visão mensal ────────────────────────────────────────────────────────────
  const dadosMensais = useMemo(() => {
    return MESES.map((_, idx) => {
      const mes = idx + 1;
      const p = { mes, ano: periodoA.ano };
      const d = calcularPeriodo(p);
      return {
        mes: MESES_ABREV[idx],
        recBanco: d.recBanco, recCaixa: d.recCaixa,
        despBanco: d.despBanco, despCaixa: d.despCaixa,
        saldoBancario: d.saldoBancario,
        saldoCaixa: d.saldoCaixa,
        saldoTotal: d.saldoTotal,
        anterior: d.anterior,
      };
    });
  }, [lancamentos, categorias, periodoA.ano]);

  const maxMensal = Math.max(...dadosMensais.map(m => Math.max(m.recBanco + m.recCaixa, m.despBanco + m.despCaixa)), 1);

  if (!isOpen) return null;

  // ─── Componentes internos ────────────────────────────────────────────────────
  const SeletorPeriodo = ({ periodo, onChange, label }) => (
    <div style={{display:'flex', alignItems:'center', gap:'0.4rem'}}>
      <span style={{fontSize:'0.75rem', fontWeight:'700', color:'rgba(255,255,255,0.8)'}}>{label}</span>
      <select value={periodo.mes} onChange={e => onChange({ ...periodo, mes: parseInt(e.target.value) })}
        style={{padding:'0.25rem 0.5rem', borderRadius:'var(--radius-md)', border:'1px solid rgba(255,255,255,0.3)', background:'rgba(255,255,255,0.15)', color:'#fff', fontSize:'0.8rem'}}>
        <option value={0}>Ano inteiro</option>
        {MESES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
      </select>
      <select value={periodo.ano} onChange={e => onChange({ ...periodo, ano: parseInt(e.target.value) })}
        style={{padding:'0.25rem 0.5rem', borderRadius:'var(--radius-md)', border:'1px solid rgba(255,255,255,0.3)', background:'rgba(255,255,255,0.15)', color:'#fff', fontSize:'0.8rem'}}>
        {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
      </select>
    </div>
  );

  const GrupoCategoria = ({ grupo, total, cor }) => {
    const [expandido, setExpandido] = useState(true);
    const pct = total > 0 ? grupo.valor / total * 100 : 0;
    const temFilhos = grupo.filhos?.length > 0;
    return (
      <div style={{border:'1px solid var(--color-border)', borderRadius:'var(--radius-md)', overflow:'hidden', marginBottom:'0.4rem'}}>
        <div onClick={() => temFilhos && setExpandido(!expandido)}
          style={{display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.5rem 0.75rem', background:'var(--color-surface-2)', cursor: temFilhos ? 'pointer' : 'default'}}>
          {temFilhos && <span style={{fontSize:'0.68rem', color:'var(--color-text-muted)', width:'10px'}}>{expandido ? '▼' : '▶'}</span>}
          <div style={{flex:1}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <span style={{fontSize:'0.82rem', fontWeight:'700', color:'var(--color-text)'}}>{grupo.nome}</span>
              <div style={{textAlign:'right'}}>
                <span style={{fontSize:'0.85rem', fontWeight:'800', color: cor}}>{formatarMoeda(grupo.valor)}</span>
                {grupo.valorBanco > 0 && grupo.valorCaixa > 0 && (
                  <div style={{fontSize:'0.65rem', color:'var(--color-text-muted)'}}>
                    🏦 {formatarMoeda(grupo.valorBanco)} · 💵 {formatarMoeda(grupo.valorCaixa)}
                  </div>
                )}
              </div>
            </div>
            <div style={{display:'flex', alignItems:'center', gap:'0.5rem', marginTop:'0.2rem'}}>
              <div style={{flex:1, height:'4px', borderRadius:'2px', background:'var(--color-surface-3)'}}>
                <div style={{width:`${pct}%`, height:'4px', borderRadius:'2px', background: cor, transition:'width 0.3s'}} />
              </div>
              <span style={{fontSize:'0.68rem', color:'var(--color-text-muted)', minWidth:'34px', textAlign:'right'}}>{pct.toFixed(1)}%</span>
            </div>
          </div>
        </div>
        {temFilhos && expandido && (
          <div>
            {grupo.filhos.sort((a,b) => b.valor - a.valor).map(filho => {
              const pctF = grupo.valor > 0 ? filho.valor / grupo.valor * 100 : 0;
              return (
                <div key={filho.id} style={{display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.35rem 0.75rem 0.35rem 1.5rem', borderTop:'1px solid var(--color-border)'}}>
                  <span style={{fontSize:'0.68rem', color:'var(--color-text-muted)'}}>└</span>
                  <div style={{flex:1}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                      <span style={{fontSize:'0.78rem', color:'var(--color-text)'}}>{filho.nome}</span>
                      <div style={{textAlign:'right'}}>
                        <span style={{fontSize:'0.78rem', fontWeight:'700', color: cor}}>{formatarMoeda(filho.valor)}</span>
                        {filho.valorBanco > 0 && filho.valorCaixa > 0 && (
                          <div style={{fontSize:'0.62rem', color:'var(--color-text-muted)'}}>
                            🏦 {formatarMoeda(filho.valorBanco)} · 💵 {formatarMoeda(filho.valorCaixa)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{display:'flex', alignItems:'center', gap:'0.5rem', marginTop:'0.15rem'}}>
                      <div style={{flex:1, height:'3px', borderRadius:'2px', background:'var(--color-surface-3)'}}>
                        <div style={{width:`${pctF}%`, height:'3px', borderRadius:'2px', background: cor, opacity:0.6}} />
                      </div>
                      <span style={{fontSize:'0.65rem', color:'var(--color-text-muted)', minWidth:'34px', textAlign:'right'}}>{pctF.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const PainelSaldo = ({ dados, periodo, label }) => (
    <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-xl)', overflow:'hidden'}}>
      {label && (
        <div style={{padding:'0.6rem 1rem', background:'var(--color-surface-2)', borderBottom:'1px solid var(--color-border)'}}>
          <span style={{fontSize:'0.78rem', fontWeight:'700', color:'var(--color-text-muted)', textTransform:'uppercase'}}>
            {periodo.mes > 0 ? MESES[periodo.mes-1] : 'Ano inteiro'} {periodo.ano}
          </span>
        </div>
      )}
      <div style={{padding:'0.75rem 1rem'}}>

        {/* BLOCO BANCÁRIO */}
        <div style={{marginBottom:'0.75rem'}}>
          <p style={{fontSize:'0.72rem', fontWeight:'700', color:'var(--color-text-muted)', textTransform:'uppercase', marginBottom:'0.4rem', display:'flex', alignItems:'center', gap:'0.3rem'}}>
            🏦 Conta Bancária
          </p>
          <div style={{background:'var(--color-surface-2)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-md)', padding:'0.6rem 0.75rem'}}>
            <Linha label="Saldo Anterior" valor={dados.anterior.bancario} cor="var(--color-text-muted)" negrito={false} />
            <Linha label="+ Receitas Bancárias" valor={dados.recBanco} cor="#10b981" />
            {dados.depositos > 0 && <Linha label="+ Depósitos (sangrias)" valor={dados.depositos} cor="#10b981" />}
            <Linha label="− Despesas Bancárias" valor={-dados.despBanco} cor="#ef4444" />
            <div style={{borderTop:'1px solid var(--color-border)', marginTop:'0.4rem', paddingTop:'0.4rem'}}>
              <Linha label="= Saldo Bancário" valor={dados.saldoBancario} cor={dados.saldoBancario >= 0 ? '#3b82f6' : '#ef4444'} negrito={true} grande={true} />
            </div>
          </div>
        </div>

        {/* BLOCO CAIXA FÍSICO */}
        <div style={{marginBottom:'0.75rem'}}>
          <p style={{fontSize:'0.72rem', fontWeight:'700', color:'var(--color-text-muted)', textTransform:'uppercase', marginBottom:'0.4rem'}}>
            💵 Caixa Físico
          </p>
          <div style={{background:'var(--color-surface-2)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-md)', padding:'0.6rem 0.75rem'}}>
            <Linha label="Saldo Anterior" valor={dados.anterior.caixa} cor="var(--color-text-muted)" negrito={false} />
            <Linha label="+ Receitas em Dinheiro" valor={dados.recCaixa} cor="#10b981" />
            {dados.sangrias > 0 && <Linha label="− Sangrias Depositadas" valor={-dados.sangrias} cor="#f59e0b" />}
            <Linha label="− Despesas em Dinheiro" valor={-dados.despCaixa} cor="#ef4444" />
            <div style={{borderTop:'1px solid var(--color-border)', marginTop:'0.4rem', paddingTop:'0.4rem'}}>
              <Linha label="= Saldo Caixa" valor={dados.saldoCaixa} cor={dados.saldoCaixa >= 0 ? '#f59e0b' : '#ef4444'} negrito={true} grande={true} />
            </div>
          </div>
        </div>

        {/* SALDO TOTAL */}
        <div style={{background: dados.saldoTotal >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border:`1px solid ${dados.saldoTotal >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius:'var(--radius-md)', padding:'0.6rem 0.75rem'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <span style={{fontSize:'0.85rem', fontWeight:'800', color:'var(--color-text)'}}>💳 Saldo Total (Banco + Caixa)</span>
            <span style={{fontSize:'1.15rem', fontWeight:'800', color: dados.saldoTotal >= 0 ? '#10b981' : '#ef4444'}}>{formatarMoeda(dados.saldoTotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );

  // Linha utilitária
  const Linha = ({ label, valor, cor, negrito = true, grande = false }) => (
    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.2rem'}}>
      <span style={{fontSize: grande ? '0.82rem' : '0.75rem', color:'var(--color-text)', fontWeight: negrito ? '700' : '400'}}>{label}</span>
      <span style={{fontSize: grande ? '0.9rem' : '0.8rem', fontWeight: negrito ? '800' : '500', color: cor}}>{formatarMoeda(Math.abs(valor))}</span>
    </div>
  );

  const labelPeriodoA = `${periodoA.mes > 0 ? MESES[periodoA.mes-1] + ' ' : ''}${periodoA.ano}`;

  return (
    <div style={{position:'fixed', inset:0, background:'var(--color-bg)', zIndex:50, overflowY:'auto'}}>

      {/* CABEÇALHO */}
      <div style={{position:'sticky', top:0, zIndex:10, background:'var(--color-accent)', padding:'0.75rem 1.25rem', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'0.5rem', boxShadow:'0 2px 8px rgba(0,0,0,0.2)'}}>
        <div>
          <h2 style={{color:'#fff', fontWeight:'800', fontSize:'1.1rem', margin:0}}>📋 Relatório Financeiro</h2>
          <p style={{color:'rgba(255,255,255,0.8)', fontSize:'0.72rem', margin:'0.1rem 0 0'}}>Saldo, receitas e despesas por categoria com saldo anterior</p>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:'0.6rem', flexWrap:'wrap'}}>
          <SeletorPeriodo periodo={periodoA} onChange={setPeriodoA} label="Período:" />
          <button onClick={() => setMostrarComparacao(!mostrarComparacao)}
            style={{padding:'0.25rem 0.65rem', background: mostrarComparacao ? '#fff' : 'rgba(255,255,255,0.2)', color: mostrarComparacao ? 'var(--color-accent)' : '#fff', border:'1px solid rgba(255,255,255,0.4)', borderRadius:'var(--radius-lg)', cursor:'pointer', fontSize:'0.75rem', fontWeight:'700'}}>
            {mostrarComparacao ? '✕ Comparar' : '⚖️ Comparar'}
          </button>
          {mostrarComparacao && <SeletorPeriodo periodo={periodoB} onChange={setPeriodoB} label="vs:" />}
          <button onClick={onClose}
            style={{padding:'0.25rem 0.65rem', background:'rgba(255,255,255,0.15)', color:'#fff', border:'1px solid rgba(255,255,255,0.3)', borderRadius:'var(--radius-lg)', cursor:'pointer', fontSize:'0.8rem', fontWeight:'600'}}>
            ← Voltar
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{textAlign:'center', padding:'4rem', color:'var(--color-text-muted)'}}>⏳ Carregando dados...</div>
      ) : (
        <div style={{maxWidth:'1400px', margin:'0 auto', padding:'1.25rem'}}>

          {/* ABAS */}
          <div style={{display:'flex', gap:'0', marginBottom:'1rem', borderBottom:'2px solid var(--color-border)'}}>
            {[
              { key:'saldo',    label:'💳 Saldo e Extrato' },
              { key:'receitas', label:'💵 Receitas por Categoria' },
              { key:'despesas', label:'💸 Despesas por Categoria' },
              { key:'mensal',   label:'📅 Visão Mensal' },
            ].map(tab => (
              <button key={tab.key} onClick={() => setAba(tab.key)}
                style={{padding:'0.5rem 1rem', background:'transparent', border:'none', borderBottom: aba === tab.key ? '3px solid var(--color-accent)' : '3px solid transparent', color: aba === tab.key ? 'var(--color-accent)' : 'var(--color-text-muted)', fontWeight: aba === tab.key ? '700' : '500', cursor:'pointer', fontSize:'0.82rem', marginBottom:'-2px', transition:'all 0.15s'}}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* ABA SALDO */}
          {aba === 'saldo' && (
            <div style={{display:'grid', gridTemplateColumns: mostrarComparacao ? '1fr 1fr' : '1fr', gap:'1rem'}}>
              <PainelSaldo dados={dadosA} periodo={periodoA} label={mostrarComparacao} />
              {mostrarComparacao && <PainelSaldo dados={dadosB} periodo={periodoB} label={true} />}
            </div>
          )}

          {/* ABA RECEITAS */}
          {aba === 'receitas' && (
            <div style={{display:'grid', gridTemplateColumns: mostrarComparacao ? '1fr 1fr' : '1fr', gap:'1rem'}}>
              {[{ dados: dadosA, periodo: periodoA }, ...(mostrarComparacao ? [{ dados: dadosB, periodo: periodoB }] : [])].map(({ dados, periodo }, i) => (
                <div key={i} style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-xl)', overflow:'hidden'}}>
                  <div style={{padding:'0.75rem 1rem', borderBottom:'1px solid var(--color-border)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <span style={{fontWeight:'800', fontSize:'0.95rem', color:'var(--color-text)'}}>💵 Receitas</span>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:'1.05rem', fontWeight:'800', color:'#10b981'}}>{formatarMoeda(dados.recBanco + dados.recCaixa)}</div>
                      <div style={{fontSize:'0.68rem', color:'var(--color-text-muted)'}}>
                        🏦 {formatarMoeda(dados.recBanco)} · 💵 {formatarMoeda(dados.recCaixa)}
                      </div>
                      {mostrarComparacao && <div style={{fontSize:'0.7rem', color:'var(--color-text-muted)'}}>{periodo.mes > 0 ? MESES[periodo.mes-1] : 'Ano'} {periodo.ano}</div>}
                    </div>
                  </div>
                  <div style={{padding:'0.75rem'}}>
                    {dados.grupos.receitas.length === 0
                      ? <p style={{textAlign:'center', color:'var(--color-text-muted)', fontSize:'0.82rem', padding:'1rem 0'}}>Nenhuma receita no período</p>
                      : dados.grupos.receitas.map(g => <GrupoCategoria key={g.id} grupo={g} total={dados.recBanco + dados.recCaixa} cor="#10b981" />)
                    }
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ABA DESPESAS */}
          {aba === 'despesas' && (
            <div style={{display:'grid', gridTemplateColumns: mostrarComparacao ? '1fr 1fr' : '1fr', gap:'1rem'}}>
              {[{ dados: dadosA, periodo: periodoA }, ...(mostrarComparacao ? [{ dados: dadosB, periodo: periodoB }] : [])].map(({ dados, periodo }, i) => (
                <div key={i} style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-xl)', overflow:'hidden'}}>
                  <div style={{padding:'0.75rem 1rem', borderBottom:'1px solid var(--color-border)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <span style={{fontWeight:'800', fontSize:'0.95rem', color:'var(--color-text)'}}>💸 Despesas</span>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:'1.05rem', fontWeight:'800', color:'#ef4444'}}>{formatarMoeda(dados.despBanco + dados.despCaixa)}</div>
                      <div style={{fontSize:'0.68rem', color:'var(--color-text-muted)'}}>
                        🏦 {formatarMoeda(dados.despBanco)} · 💵 {formatarMoeda(dados.despCaixa)}
                      </div>
                      {mostrarComparacao && <div style={{fontSize:'0.7rem', color:'var(--color-text-muted)'}}>{periodo.mes > 0 ? MESES[periodo.mes-1] : 'Ano'} {periodo.ano}</div>}
                    </div>
                  </div>
                  <div style={{padding:'0.75rem'}}>
                    {dados.grupos.despesas.length === 0
                      ? <p style={{textAlign:'center', color:'var(--color-text-muted)', fontSize:'0.82rem', padding:'1rem 0'}}>Nenhuma despesa no período</p>
                      : dados.grupos.despesas.map(g => <GrupoCategoria key={g.id} grupo={g} total={dados.despBanco + dados.despCaixa} cor="#ef4444" />)
                    }
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ABA MENSAL */}
          {aba === 'mensal' && (
            <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-xl)', overflow:'hidden'}}>
              <div style={{padding:'0.75rem 1rem', borderBottom:'1px solid var(--color-border)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span style={{fontWeight:'800', fontSize:'0.95rem', color:'var(--color-text)'}}>📅 Evolução Mensal — {periodoA.ano}</span>
                <div style={{display:'flex', gap:'1rem', fontSize:'0.72rem'}}>
                  <span style={{color:'#10b981', fontWeight:'700'}}>■ Receitas</span>
                  <span style={{color:'#ef4444', fontWeight:'700'}}>■ Despesas</span>
                  <span style={{color:'#3b82f6', fontWeight:'700'}}>■ Saldo Banco</span>
                </div>
              </div>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%', borderCollapse:'collapse', minWidth:'800px'}}>
                  <thead>
                    <tr style={{background:'var(--color-surface-2)'}}>
                      {['Mês','Rec. Banco','Rec. Caixa','Desp. Banco','Desp. Caixa','Saldo Banco','Saldo Caixa','Saldo Total',''].map(h => (
                        <th key={h} style={{padding:'0.5rem 0.6rem', textAlign: h === '' ? 'left' : 'right', fontSize:'0.7rem', fontWeight:'700', color:'var(--color-text-muted)', whiteSpace:'nowrap', textAlign: h === 'Mês' || h === '' ? 'left' : 'right'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dadosMensais.map((m, idx) => {
                      const temDados = m.recBanco + m.recCaixa + m.despBanco + m.despCaixa > 0;
                      return (
                        <tr key={idx} style={{borderTop:'1px solid var(--color-border)', background: temDados ? 'transparent' : 'var(--color-surface-2)', opacity: temDados ? 1 : 0.45}}>
                          <td style={{padding:'0.5rem 0.6rem', fontWeight:'700', fontSize:'0.82rem', color:'var(--color-text)'}}>{m.mes}</td>
                          <td style={{padding:'0.5rem 0.6rem', textAlign:'right', fontSize:'0.78rem', color:'#10b981', fontWeight:'600'}}>{temDados ? formatarMoeda(m.recBanco) : '—'}</td>
                          <td style={{padding:'0.5rem 0.6rem', textAlign:'right', fontSize:'0.78rem', color:'#10b981', fontWeight:'600'}}>{temDados ? formatarMoeda(m.recCaixa) : '—'}</td>
                          <td style={{padding:'0.5rem 0.6rem', textAlign:'right', fontSize:'0.78rem', color:'#ef4444', fontWeight:'600'}}>{temDados ? formatarMoeda(m.despBanco) : '—'}</td>
                          <td style={{padding:'0.5rem 0.6rem', textAlign:'right', fontSize:'0.78rem', color:'#ef4444', fontWeight:'600'}}>{temDados ? formatarMoeda(m.despCaixa) : '—'}</td>
                          <td style={{padding:'0.5rem 0.6rem', textAlign:'right', fontSize:'0.8rem', fontWeight:'700', color: m.saldoBancario >= 0 ? '#3b82f6' : '#ef4444'}}>{temDados ? formatarMoeda(m.saldoBancario) : '—'}</td>
                          <td style={{padding:'0.5rem 0.6rem', textAlign:'right', fontSize:'0.8rem', fontWeight:'700', color: m.saldoCaixa >= 0 ? '#f59e0b' : '#ef4444'}}>{temDados ? formatarMoeda(m.saldoCaixa) : '—'}</td>
                          <td style={{padding:'0.5rem 0.6rem', textAlign:'right', fontSize:'0.82rem', fontWeight:'800', color: m.saldoTotal >= 0 ? '#10b981' : '#ef4444'}}>{temDados ? formatarMoeda(m.saldoTotal) : '—'}</td>
                          <td style={{padding:'0.5rem 0.6rem', minWidth:'120px'}}>
                            {temDados && (
                              <div style={{display:'flex', flexDirection:'column', gap:'2px'}}>
                                <div style={{width:`${(m.recBanco + m.recCaixa) / maxMensal * 100}%`, height:'5px', borderRadius:'3px', background:'#10b981', minWidth:'2px'}} />
                                <div style={{width:`${(m.despBanco + m.despCaixa) / maxMensal * 100}%`, height:'5px', borderRadius:'3px', background:'#ef4444', minWidth:'2px'}} />
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {/* Totais */}
                    <tr style={{borderTop:'2px solid var(--color-border)', background:'var(--color-surface-2)'}}>
                      <td style={{padding:'0.6rem', fontWeight:'800', fontSize:'0.82rem'}}>TOTAL {periodoA.ano}</td>
                      <td style={{padding:'0.6rem', textAlign:'right', fontWeight:'800', fontSize:'0.82rem', color:'#10b981'}}>{formatarMoeda(dadosMensais.reduce((s,m) => s+m.recBanco, 0))}</td>
                      <td style={{padding:'0.6rem', textAlign:'right', fontWeight:'800', fontSize:'0.82rem', color:'#10b981'}}>{formatarMoeda(dadosMensais.reduce((s,m) => s+m.recCaixa, 0))}</td>
                      <td style={{padding:'0.6rem', textAlign:'right', fontWeight:'800', fontSize:'0.82rem', color:'#ef4444'}}>{formatarMoeda(dadosMensais.reduce((s,m) => s+m.despBanco, 0))}</td>
                      <td style={{padding:'0.6rem', textAlign:'right', fontWeight:'800', fontSize:'0.82rem', color:'#ef4444'}}>{formatarMoeda(dadosMensais.reduce((s,m) => s+m.despCaixa, 0))}</td>
                      <td colSpan="3" />
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
