import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { formatarMoeda } from './utils/formatadores';

const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];
const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// ─── Filtro padrão de lançamentos válidos ────────────────────────────────────
const lancamentoValido = (l) => {
  if (l.status !== 'pago') return false;
  if (l.tipo_pagamento === 'compensacao') return false;
  const nomeCat = l.cat_nome?.toLowerCase() || '';
  // Tronco em dinheiro: entra no caixa físico, não no bancário
  if (nomeCat.includes('tronco') && l.tipo_pagamento === 'dinheiro') return false;
  // Despesas pagas pelo irmão: não são despesas da loja
  if (l.cat_tipo === 'despesa') {
    if (nomeCat.includes('despesas pagas pelo irmão') || nomeCat.includes('despesa paga pelo irmão')) return false;
  }
  return true;
};

const parseData = (dataStr) => dataStr ? new Date(dataStr + 'T00:00:00') : null;

export default function RelatorioFinanceiro({ isOpen, onClose, showError }) {
  const [lancamentos, setLancamentos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [anosDisponiveis, setAnosDisponiveis] = useState([]);
  const [loading, setLoading] = useState(true);

  const anoAtual = new Date().getFullYear();

  // Período A (principal) e Período B (comparação)
  const [periodoA, setPeriodoA] = useState({ mes: 0, ano: anoAtual });
  const [periodoB, setPeriodoB] = useState({ mes: 0, ano: anoAtual - 1 });
  const [mostrarComparacao, setMostrarComparacao] = useState(false);

  // Aba ativa: 'receitas' | 'despesas' | 'mensal'
  const [aba, setAba] = useState('receitas');

  // ─── Carregar dados ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) carregarDados();
  }, [isOpen]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      // Categorias com hierarquia
      const { data: cats, error: errCat } = await supabase
        .from('categorias_financeiras')
        .select('id, nome, tipo, categoria_pai_id, nivel')
        .order('nivel')
        .order('nome');
      if (errCat) throw errCat;
      setCategorias(cats || []);

      // Lançamentos com categoria
      const { data: lancs, error: errLanc } = await supabase
        .from('lancamentos_loja')
        .select('id, descricao, valor, status, tipo_pagamento, data_pagamento, data_vencimento, data_lancamento, categorias_financeiras(id, nome, tipo, categoria_pai_id, nivel)')
        .order('data_vencimento', { ascending: false });
      if (errLanc) throw errLanc;

      // Normalizar campos de categoria para facilitar filtragem
      const normalizados = (lancs || []).map(l => ({
        ...l,
        cat_id: l.categorias_financeiras?.id,
        cat_nome: l.categorias_financeiras?.nome,
        cat_tipo: l.categorias_financeiras?.tipo,
        cat_pai_id: l.categorias_financeiras?.categoria_pai_id,
        cat_nivel: l.categorias_financeiras?.nivel ?? 1,
      }));

      setLancamentos(normalizados);

      // Anos disponíveis
      const anos = [...new Set(
        normalizados
          .map(l => {
            const d = parseData(l.data_pagamento || l.data_vencimento);
            return d ? d.getFullYear() : null;
          })
          .filter(Boolean)
      )].sort((a, b) => b - a);
      setAnosDisponiveis(anos);

    } catch (err) {
      showError?.('Erro ao carregar dados: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Filtrar lançamentos por período ────────────────────────────────────────
  const filtrarPorPeriodo = (periodo) => {
    return lancamentos.filter(l => {
      if (!lancamentoValido(l)) return false;
      const d = parseData(l.data_pagamento || l.data_vencimento);
      if (!d) return false;
      if (d.getFullYear() !== periodo.ano) return false;
      if (periodo.mes > 0 && d.getMonth() + 1 !== periodo.mes) return false;
      return true;
    });
  };

  // ─── Agrupar por subcategoria → categoria pai ───────────────────────────────
  const agruparPorCategoria = (lancs, tipo) => {
    const filtrados = lancs.filter(l => l.cat_tipo === tipo);

    // Mapa de categorias pai
    const catMap = {};
    categorias.forEach(c => { catMap[c.id] = c; });

    // Acumular por cat_id
    const porCat = {};
    filtrados.forEach(l => {
      const id = l.cat_id;
      if (!porCat[id]) porCat[id] = { id, nome: l.cat_nome || 'Sem categoria', valor: 0, pai_id: l.cat_pai_id, nivel: l.cat_nivel };
      porCat[id].valor += parseFloat(l.valor || 0);
    });

    // Estruturar: categorias pai com filhos
    const grupos = {};

    Object.values(porCat).forEach(cat => {
      if (!cat.pai_id) {
        // É categoria raiz
        if (!grupos[cat.id]) grupos[cat.id] = { id: cat.id, nome: cat.nome, valor: 0, filhos: [] };
        grupos[cat.id].valor += cat.valor;
      } else {
        // É subcategoria — colocar sob o pai
        const pai = catMap[cat.pai_id];
        const paiId = pai?.id || cat.pai_id;
        const paiNome = pai?.nome || 'Outros';
        if (!grupos[paiId]) grupos[paiId] = { id: paiId, nome: paiNome, valor: 0, filhos: [] };
        grupos[paiId].filhos.push({ id: cat.id, nome: cat.nome, valor: cat.valor });
        grupos[paiId].valor += cat.valor;
      }
    });

    return Object.values(grupos).sort((a, b) => b.valor - a.valor);
  };

  // ─── Visão mensal (12 meses do ano) ─────────────────────────────────────────
  const dadosMensais = useMemo(() => {
    const mesesData = MESES.map((nome, idx) => {
      const mes = idx + 1;
      const lancsDoMes = lancamentos.filter(l => {
        if (!lancamentoValido(l)) return false;
        const d = parseData(l.data_pagamento || l.data_vencimento);
        if (!d) return false;
        return d.getFullYear() === periodoA.ano && d.getMonth() + 1 === mes;
      });
      const receitas = lancsDoMes.filter(l => l.cat_tipo === 'receita').reduce((s, l) => s + parseFloat(l.valor || 0), 0);
      const despesas = lancsDoMes.filter(l => l.cat_tipo === 'despesa').reduce((s, l) => s + parseFloat(l.valor || 0), 0);
      return { mes: MESES_ABREV[idx], receitas, despesas, saldo: receitas - despesas };
    });
    return mesesData;
  }, [lancamentos, periodoA.ano]);

  // ─── Dados dos dois períodos ─────────────────────────────────────────────────
  const lancsA = useMemo(() => filtrarPorPeriodo(periodoA), [lancamentos, periodoA]);
  const lancsB = useMemo(() => filtrarPorPeriodo(periodoB), [lancamentos, periodoB]);

  const receitasA = agruparPorCategoria(lancsA, 'receita');
  const despesasA = agruparPorCategoria(lancsA, 'despesa');
  const receitasB = agruparPorCategoria(lancsB, 'receita');
  const despesasB = agruparPorCategoria(lancsB, 'despesa');

  const totalRecA = receitasA.reduce((s, g) => s + g.valor, 0);
  const totalDespA = despesasA.reduce((s, g) => s + g.valor, 0);
  const totalRecB = receitasB.reduce((s, g) => s + g.valor, 0);
  const totalDespB = despesasB.reduce((s, g) => s + g.valor, 0);

  const maxMensal = Math.max(...dadosMensais.map(m => Math.max(m.receitas, m.despesas)), 1);

  if (!isOpen) return null;

  // ─── Componente de seletor de período ───────────────────────────────────────
  const SeletorPeriodo = ({ periodo, onChange, label }) => (
    <div style={{display:'flex', alignItems:'center', gap:'0.5rem'}}>
      <span style={{fontSize:'0.78rem', fontWeight:'700', color:'var(--color-text-muted)'}}>{label}</span>
      <select
        value={periodo.mes}
        onChange={e => onChange({ ...periodo, mes: parseInt(e.target.value) })}
        style={{padding:'0.3rem 0.6rem', borderRadius:'var(--radius-md)', border:'1px solid var(--color-border)', background:'var(--color-surface-2)', color:'var(--color-text)', fontSize:'0.82rem'}}
      >
        <option value={0}>Ano inteiro</option>
        {MESES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
      </select>
      <select
        value={periodo.ano}
        onChange={e => onChange({ ...periodo, ano: parseInt(e.target.value) })}
        style={{padding:'0.3rem 0.6rem', borderRadius:'var(--radius-md)', border:'1px solid var(--color-border)', background:'var(--color-surface-2)', color:'var(--color-text)', fontSize:'0.82rem'}}
      >
        {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
      </select>
    </div>
  );

  // ─── Card de grupo de categoria ──────────────────────────────────────────────
  const GrupoCategoria = ({ grupo, total, cor, corBg }) => {
    const [expandido, setExpandido] = useState(true);
    const pct = total > 0 ? (grupo.valor / total * 100) : 0;
    const temFilhos = grupo.filhos?.length > 0;

    return (
      <div style={{border:'1px solid var(--color-border)', borderRadius:'var(--radius-md)', overflow:'hidden', marginBottom:'0.4rem'}}>
        {/* Linha da categoria pai */}
        <div
          onClick={() => temFilhos && setExpandido(!expandido)}
          style={{
            display:'flex', alignItems:'center', gap:'0.5rem',
            padding:'0.5rem 0.75rem',
            background:'var(--color-surface-2)',
            cursor: temFilhos ? 'pointer' : 'default',
          }}
        >
          {temFilhos && (
            <span style={{fontSize:'0.7rem', color:'var(--color-text-muted)', width:'12px'}}>
              {expandido ? '▼' : '▶'}
            </span>
          )}
          <div style={{flex:1}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <span style={{fontSize:'0.82rem', fontWeight:'700', color:'var(--color-text)'}}>{grupo.nome}</span>
              <span style={{fontSize:'0.85rem', fontWeight:'800', color: cor}}>{formatarMoeda(grupo.valor)}</span>
            </div>
            <div style={{display:'flex', alignItems:'center', gap:'0.5rem', marginTop:'0.2rem'}}>
              <div style={{flex:1, height:'4px', borderRadius:'2px', background:'var(--color-surface-3)'}}>
                <div style={{width:`${pct}%`, height:'4px', borderRadius:'2px', background: cor, transition:'width 0.3s'}} />
              </div>
              <span style={{fontSize:'0.68rem', color:'var(--color-text-muted)', minWidth:'34px', textAlign:'right'}}>{pct.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Subcategorias */}
        {temFilhos && expandido && (
          <div style={{background: corBg}}>
            {grupo.filhos.sort((a,b) => b.valor - a.valor).map(filho => {
              const pctFilho = grupo.valor > 0 ? (filho.valor / grupo.valor * 100) : 0;
              return (
                <div key={filho.id} style={{display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.35rem 0.75rem 0.35rem 1.5rem', borderTop:'1px solid var(--color-border)'}}>
                  <span style={{fontSize:'0.7rem', color:'var(--color-text-muted)'}}>└</span>
                  <div style={{flex:1}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                      <span style={{fontSize:'0.78rem', color:'var(--color-text)'}}>{filho.nome}</span>
                      <span style={{fontSize:'0.78rem', fontWeight:'700', color: cor}}>{formatarMoeda(filho.valor)}</span>
                    </div>
                    <div style={{display:'flex', alignItems:'center', gap:'0.5rem', marginTop:'0.15rem'}}>
                      <div style={{flex:1, height:'3px', borderRadius:'2px', background:'var(--color-surface-3)'}}>
                        <div style={{width:`${pctFilho}%`, height:'3px', borderRadius:'2px', background: cor, opacity:0.6}} />
                      </div>
                      <span style={{fontSize:'0.65rem', color:'var(--color-text-muted)', minWidth:'34px', textAlign:'right'}}>{pctFilho.toFixed(1)}%</span>
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

  // ─── Painel de categoria (receitas ou despesas) ──────────────────────────────
  const PainelCategoria = ({ grupos, total, tipo, comparar, gruposB, totalB }) => {
    const cor = tipo === 'receita' ? '#10b981' : '#ef4444';
    const corBg = tipo === 'receita' ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)';
    const emoji = tipo === 'receita' ? '💵' : '💸';
    const titulo = tipo === 'receita' ? 'Receitas' : 'Despesas';

    return (
      <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-xl)', overflow:'hidden'}}>
        {/* Header do painel */}
        <div style={{padding:'0.75rem 1rem', borderBottom:'1px solid var(--color-border)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <span style={{fontWeight:'800', fontSize:'0.95rem', color:'var(--color-text)'}}>{emoji} {titulo}</span>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:'1.1rem', fontWeight:'800', color: cor}}>{formatarMoeda(total)}</div>
            {comparar && (
              <div style={{fontSize:'0.72rem', color:'var(--color-text-muted)'}}>
                vs {formatarMoeda(totalB)}
                {' '}
                <span style={{color: total >= totalB ? '#10b981' : '#ef4444', fontWeight:'700'}}>
                  {total >= totalB ? '▲' : '▼'} {totalB > 0 ? Math.abs((total - totalB) / totalB * 100).toFixed(1) : '—'}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Lista de grupos */}
        <div style={{padding:'0.75rem'}}>
          {grupos.length === 0 ? (
            <p style={{textAlign:'center', color:'var(--color-text-muted)', fontSize:'0.82rem', padding:'1rem 0'}}>
              Nenhum lançamento no período
            </p>
          ) : (
            grupos.map(g => (
              <GrupoCategoria key={g.id} grupo={g} total={total} cor={cor} corBg={corBg} />
            ))
          )}
        </div>
      </div>
    );
  };

  // ─── Render principal ────────────────────────────────────────────────────────
  return (
    <div style={{position:'fixed', inset:0, background:'var(--color-bg)', zIndex:50, overflowY:'auto'}}>

      {/* CABEÇALHO */}
      <div style={{
        position:'sticky', top:0, zIndex:10,
        background:'var(--color-accent)',
        padding:'0.75rem 1.25rem',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        flexWrap:'wrap', gap:'0.5rem',
        boxShadow:'0 2px 8px rgba(0,0,0,0.2)'
      }}>
        <div>
          <h2 style={{color:'#fff', fontWeight:'800', fontSize:'1.1rem', margin:0}}>📊 Relatório Financeiro</h2>
          <p style={{color:'rgba(255,255,255,0.8)', fontSize:'0.75rem', margin:'0.1rem 0 0'}}>
            Receitas e despesas por categoria e subcategoria
          </p>
        </div>

        <div style={{display:'flex', alignItems:'center', gap:'0.75rem', flexWrap:'wrap'}}>
          {/* Período A */}
          <SeletorPeriodo periodo={periodoA} onChange={setPeriodoA} label="Período:" />

          {/* Botão comparar */}
          <button
            onClick={() => setMostrarComparacao(!mostrarComparacao)}
            style={{
              padding:'0.3rem 0.75rem',
              background: mostrarComparacao ? '#fff' : 'rgba(255,255,255,0.2)',
              color: mostrarComparacao ? 'var(--color-accent)' : '#fff',
              border:'1px solid rgba(255,255,255,0.4)',
              borderRadius:'var(--radius-lg)',
              cursor:'pointer', fontSize:'0.78rem', fontWeight:'700'
            }}
          >
            {mostrarComparacao ? '✕ Comparação' : '⚖️ Comparar'}
          </button>

          {/* Período B (só quando comparação ativa) */}
          {mostrarComparacao && (
            <SeletorPeriodo periodo={periodoB} onChange={setPeriodoB} label="vs:" />
          )}

          <button
            onClick={onClose}
            style={{padding:'0.3rem 0.75rem', background:'rgba(255,255,255,0.15)', color:'#fff', border:'1px solid rgba(255,255,255,0.3)', borderRadius:'var(--radius-lg)', cursor:'pointer', fontSize:'0.82rem', fontWeight:'600'}}
          >
            ← Voltar
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{textAlign:'center', padding:'4rem', color:'var(--color-text-muted)'}}>
          ⏳ Carregando dados...
        </div>
      ) : (
        <div style={{maxWidth:'1400px', margin:'0 auto', padding:'1.25rem'}}>

          {/* RESUMO DO PERÍODO */}
          <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'0.75rem', marginBottom:'1.25rem'}}>
            {[
              { label:'💵 Receitas', valor: totalRecA, cor:'#10b981', valorB: totalRecB },
              { label:'💸 Despesas', valor: totalDespA, cor:'#ef4444', valorB: totalDespB },
              { label:'💳 Saldo', valor: totalRecA - totalDespA, cor: totalRecA - totalDespA >= 0 ? '#10b981' : '#ef4444', valorB: totalRecB - totalDespB },
            ].map(item => (
              <div key={item.label} style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-xl)', padding:'0.75rem 1rem'}}>
                <p style={{fontSize:'0.75rem', color:'var(--color-text-muted)', fontWeight:'600', margin:'0 0 0.25rem'}}>{item.label}</p>
                <p style={{fontSize:'1.2rem', fontWeight:'800', color: item.cor, margin:0}}>{formatarMoeda(item.valor)}</p>
                {mostrarComparacao && (
                  <p style={{fontSize:'0.72rem', color:'var(--color-text-muted)', margin:'0.2rem 0 0'}}>
                    vs {formatarMoeda(item.valorB)}
                    {' '}
                    <span style={{color: item.valor >= item.valorB ? '#10b981' : '#ef4444', fontWeight:'700'}}>
                      {item.valor >= item.valorB ? '▲' : '▼'}{' '}
                      {item.valorB !== 0 ? Math.abs((item.valor - item.valorB) / Math.abs(item.valorB) * 100).toFixed(1) + '%' : '—'}
                    </span>
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* ABAS */}
          <div style={{display:'flex', gap:'0.5rem', marginBottom:'1rem', borderBottom:'2px solid var(--color-border)', paddingBottom:'0'}}>
            {[
              { key:'receitas', label:'💵 Receitas por Categoria' },
              { key:'despesas', label:'💸 Despesas por Categoria' },
              { key:'mensal',   label:'📅 Visão Mensal' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setAba(tab.key)}
                style={{
                  padding:'0.5rem 1rem',
                  background:'transparent',
                  border:'none',
                  borderBottom: aba === tab.key ? '3px solid var(--color-accent)' : '3px solid transparent',
                  color: aba === tab.key ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  fontWeight: aba === tab.key ? '700' : '500',
                  cursor:'pointer',
                  fontSize:'0.85rem',
                  marginBottom:'-2px',
                  transition:'all 0.15s'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ABA RECEITAS */}
          {aba === 'receitas' && (
            mostrarComparacao ? (
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem'}}>
                <div>
                  <p style={{fontSize:'0.75rem', fontWeight:'700', color:'var(--color-text-muted)', marginBottom:'0.5rem', textTransform:'uppercase'}}>
                    {periodoA.mes > 0 ? MESES[periodoA.mes-1] : 'Ano inteiro'} {periodoA.ano}
                  </p>
                  <PainelCategoria grupos={receitasA} total={totalRecA} tipo="receita" comparar={false} />
                </div>
                <div>
                  <p style={{fontSize:'0.75rem', fontWeight:'700', color:'var(--color-text-muted)', marginBottom:'0.5rem', textTransform:'uppercase'}}>
                    {periodoB.mes > 0 ? MESES[periodoB.mes-1] : 'Ano inteiro'} {periodoB.ano}
                  </p>
                  <PainelCategoria grupos={receitasB} total={totalRecB} tipo="receita" comparar={false} />
                </div>
              </div>
            ) : (
              <PainelCategoria grupos={receitasA} total={totalRecA} tipo="receita" comparar={mostrarComparacao} gruposB={receitasB} totalB={totalRecB} />
            )
          )}

          {/* ABA DESPESAS */}
          {aba === 'despesas' && (
            mostrarComparacao ? (
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem'}}>
                <div>
                  <p style={{fontSize:'0.75rem', fontWeight:'700', color:'var(--color-text-muted)', marginBottom:'0.5rem', textTransform:'uppercase'}}>
                    {periodoA.mes > 0 ? MESES[periodoA.mes-1] : 'Ano inteiro'} {periodoA.ano}
                  </p>
                  <PainelCategoria grupos={despesasA} total={totalDespA} tipo="despesa" comparar={false} />
                </div>
                <div>
                  <p style={{fontSize:'0.75rem', fontWeight:'700', color:'var(--color-text-muted)', marginBottom:'0.5rem', textTransform:'uppercase'}}>
                    {periodoB.mes > 0 ? MESES[periodoB.mes-1] : 'Ano inteiro'} {periodoB.ano}
                  </p>
                  <PainelCategoria grupos={despesasB} total={totalDespB} tipo="despesa" comparar={false} />
                </div>
              </div>
            ) : (
              <PainelCategoria grupos={despesasA} total={totalDespA} tipo="despesa" comparar={mostrarComparacao} gruposB={despesasB} totalB={totalDespB} />
            )
          )}

          {/* ABA MENSAL */}
          {aba === 'mensal' && (
            <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-xl)', overflow:'hidden'}}>
              <div style={{padding:'0.75rem 1rem', borderBottom:'1px solid var(--color-border)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span style={{fontWeight:'800', fontSize:'0.95rem', color:'var(--color-text)'}}>📅 Evolução Mensal — {periodoA.ano}</span>
                <div style={{display:'flex', gap:'1rem', fontSize:'0.75rem'}}>
                  <span style={{color:'#10b981', fontWeight:'700'}}>■ Receitas</span>
                  <span style={{color:'#ef4444', fontWeight:'700'}}>■ Despesas</span>
                  <span style={{color:'var(--color-accent)', fontWeight:'700'}}>■ Saldo</span>
                </div>
              </div>

              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%', borderCollapse:'collapse', minWidth:'700px'}}>
                  <thead>
                    <tr style={{background:'var(--color-surface-2)'}}>
                      <th style={{padding:'0.5rem 0.75rem', textAlign:'left', fontSize:'0.75rem', fontWeight:'700', color:'var(--color-text-muted)'}}>Mês</th>
                      <th style={{padding:'0.5rem 0.75rem', textAlign:'right', fontSize:'0.75rem', fontWeight:'700', color:'#10b981'}}>Receitas</th>
                      <th style={{padding:'0.5rem 0.75rem', textAlign:'right', fontSize:'0.75rem', fontWeight:'700', color:'#ef4444'}}>Despesas</th>
                      <th style={{padding:'0.5rem 0.75rem', textAlign:'right', fontSize:'0.75rem', fontWeight:'700', color:'var(--color-accent)'}}>Saldo</th>
                      <th style={{padding:'0.5rem 0.75rem', textAlign:'left', fontSize:'0.75rem', fontWeight:'700', color:'var(--color-text-muted)'}}>Visualização</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dadosMensais.map((m, idx) => {
                      const temDados = m.receitas > 0 || m.despesas > 0;
                      const saldoPos = m.saldo >= 0;
                      return (
                        <tr
                          key={idx}
                          style={{
                            borderTop:'1px solid var(--color-border)',
                            background: temDados ? 'transparent' : 'var(--color-surface-2)',
                            opacity: temDados ? 1 : 0.5
                          }}
                        >
                          <td style={{padding:'0.6rem 0.75rem', fontWeight:'700', fontSize:'0.85rem', color:'var(--color-text)'}}>{m.mes}</td>
                          <td style={{padding:'0.6rem 0.75rem', textAlign:'right', fontSize:'0.82rem', fontWeight:'700', color:'#10b981'}}>{temDados ? formatarMoeda(m.receitas) : '—'}</td>
                          <td style={{padding:'0.6rem 0.75rem', textAlign:'right', fontSize:'0.82rem', fontWeight:'700', color:'#ef4444'}}>{temDados ? formatarMoeda(m.despesas) : '—'}</td>
                          <td style={{padding:'0.6rem 0.75rem', textAlign:'right', fontSize:'0.82rem', fontWeight:'800', color: saldoPos ? '#10b981' : '#ef4444'}}>
                            {temDados ? (saldoPos ? '+' : '') + formatarMoeda(m.saldo) : '—'}
                          </td>
                          <td style={{padding:'0.6rem 0.75rem', minWidth:'180px'}}>
                            {temDados && (
                              <div style={{display:'flex', flexDirection:'column', gap:'2px'}}>
                                <div style={{display:'flex', alignItems:'center', gap:'4px'}}>
                                  <div style={{width:`${(m.receitas / maxMensal * 100)}%`, maxWidth:'100%', height:'6px', borderRadius:'3px', background:'#10b981', minWidth: m.receitas > 0 ? '4px' : '0'}} />
                                </div>
                                <div style={{display:'flex', alignItems:'center', gap:'4px'}}>
                                  <div style={{width:`${(m.despesas / maxMensal * 100)}%`, maxWidth:'100%', height:'6px', borderRadius:'3px', background:'#ef4444', minWidth: m.despesas > 0 ? '4px' : '0'}} />
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {/* Totais */}
                    <tr style={{borderTop:'2px solid var(--color-border)', background:'var(--color-surface-2)'}}>
                      <td style={{padding:'0.6rem 0.75rem', fontWeight:'800', fontSize:'0.85rem', color:'var(--color-text)'}}>TOTAL {periodoA.ano}</td>
                      <td style={{padding:'0.6rem 0.75rem', textAlign:'right', fontWeight:'800', fontSize:'0.9rem', color:'#10b981'}}>{formatarMoeda(dadosMensais.reduce((s,m) => s+m.receitas, 0))}</td>
                      <td style={{padding:'0.6rem 0.75rem', textAlign:'right', fontWeight:'800', fontSize:'0.9rem', color:'#ef4444'}}>{formatarMoeda(dadosMensais.reduce((s,m) => s+m.despesas, 0))}</td>
                      <td style={{padding:'0.6rem 0.75rem', textAlign:'right', fontWeight:'800', fontSize:'0.9rem', color: dadosMensais.reduce((s,m) => s+m.saldo, 0) >= 0 ? '#10b981' : '#ef4444'}}>
                        {formatarMoeda(dadosMensais.reduce((s,m) => s+m.saldo, 0))}
                      </td>
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
