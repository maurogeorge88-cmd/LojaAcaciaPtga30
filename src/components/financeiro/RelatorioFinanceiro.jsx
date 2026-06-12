import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { formatarMoeda } from './utils/formatadores';
import { gerarPDFRelatorioFinanceiro } from './utils/pdfRelatorioFinanceiro';

const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];
const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const sSelect = {
  padding:'0.35rem 0.6rem',
  borderRadius:'var(--radius-md)',
  border:'1px solid var(--color-border)',
  background:'var(--color-surface-2)',
  color:'var(--color-text)',
  fontSize:'0.82rem'
};

export default function RelatorioFinanceiro({ isOpen, onClose, showError, showSuccess }) {
  const [lancamentos, setLancamentos] = useState([]);
  const [categorias, setCategorias]   = useState([]);
  const [anosDisponiveis, setAnosDisponiveis] = useState([]);
  const [loading, setLoading]         = useState(true);

  const anoAtual = new Date().getFullYear();
  const [periodoA, setPeriodoA] = useState({ mes: 0, ano: anoAtual });
  const [periodoB, setPeriodoB] = useState({ mes: 0, ano: anoAtual - 1 });
  const [mostrarComparacao, setMostrarComparacao] = useState(false);
  const [aba, setAba] = useState('saldo');

  // Saldos anteriores calculados via query (igual ao FinancasLoja)
  const [saldoAntA, setSaldoAntA] = useState({ bancario: 0, caixa: 0 });
  const [caixaFisicoHistorico, setCaixaFisicoHistorico] = useState(0);
  const [caixaDetalhes, setCaixaDetalhes] = useState({ recDinheiro: 0, sangrias: 0, despDinheiro: 0 });
  const [saldoAntB, setSaldoAntB] = useState({ bancario: 0, caixa: 0 });

  useEffect(() => { if (isOpen) carregarDados(); }, [isOpen]);

  // ─── Buscar saldo anterior do banco (igual ao calcularSaldoAnterior do FinancasLoja) ─
  const buscarSaldoAnterior = async (periodo) => {
    // ano=0 = histórico completo = sem saldo anterior
    if (periodo.ano === 0) return { bancario: 0, caixa: 0 };

    let dataLimite;
    if (periodo.mes > 0) {
      dataLimite = `${periodo.ano}-${String(periodo.mes).padStart(2,'0')}-01`;
    } else {
      dataLimite = `${periodo.ano}-01-01`;
    }

    const { data, error } = await supabase
      .from('lancamentos_loja')
      .select('valor, tipo_pagamento, eh_transferencia_interna, categorias_financeiras(tipo, nome)')
      .eq('status', 'pago')
      .lt('data_pagamento', dataLimite);

    if (error) { showError?.('Erro ao calcular saldo anterior'); return { bancario: 0, caixa: 0 }; }

    const d = data || [];
    const nomeCat = (l) => l.categorias_financeiras?.nome?.toLowerCase() || '';

    // BANCO — idêntico ao calcularSaldoAnterior do FinancasLoja
    const recBanco = d
      .filter(l => l.categorias_financeiras?.tipo === 'receita'
        && l.tipo_pagamento !== 'compensacao'
        && l.tipo_pagamento !== 'dinheiro'
        && !l.eh_transferencia_interna)
      .reduce((s,l) => s + parseFloat(l.valor), 0);

    const depositos = d
      .filter(l => l.categorias_financeiras?.tipo === 'receita' && l.eh_transferencia_interna === true)
      .reduce((s,l) => s + parseFloat(l.valor), 0);

    const despBanco = d
      .filter(l => l.categorias_financeiras?.tipo === 'despesa'
        && l.tipo_pagamento !== 'compensacao'
        && l.tipo_pagamento !== 'dinheiro'
        && !l.eh_transferencia_interna)
      .reduce((s,l) => s + parseFloat(l.valor), 0);

    const bancario = recBanco + depositos - despBanco;

    // CAIXA — idêntico ao calcularCaixaFisicoTotal do FinancasLoja (histórico anterior)
    const recCaixa = d
      .filter(l => l.categorias_financeiras?.tipo === 'receita'
        && l.tipo_pagamento === 'dinheiro'
        && !l.eh_transferencia_interna
        && !nomeCat(l).includes('tronco'))
      .reduce((s,l) => s + parseFloat(l.valor), 0);

    const sangrias = d
      .filter(l => l.categorias_financeiras?.tipo === 'despesa'
        && l.eh_transferencia_interna === true
        && !nomeCat(l).includes('tronco'))
      .reduce((s,l) => s + parseFloat(l.valor), 0);

    const despCaixa = d
      .filter(l => l.categorias_financeiras?.tipo === 'despesa'
        && l.tipo_pagamento === 'dinheiro'
        && l.eh_transferencia_interna === false
        && !nomeCat(l).includes('tronco'))
      .reduce((s,l) => s + parseFloat(l.valor), 0);

    const caixa = recCaixa - sangrias - despCaixa;

    return { bancario, caixa };
  };

  // Recalcular saldos anteriores quando período muda
  useEffect(() => {
    if (!isOpen || lancamentos.length === 0) return;
    buscarSaldoAnterior(periodoA).then(setSaldoAntA);
  }, [periodoA, isOpen, lancamentos.length]);

  useEffect(() => {
    if (!isOpen || !mostrarComparacao || lancamentos.length === 0) return;
    buscarSaldoAnterior(periodoB).then(setSaldoAntB);
  }, [periodoB, mostrarComparacao, isOpen, lancamentos.length]);

  // ─── Carregar lançamentos e categorias ──────────────────────────────────────
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

      const norm = (lancs || []).map(l => ({
        ...l,
        cat_id:    l.categorias_financeiras?.id,
        cat_nome:  l.categorias_financeiras?.nome,
        cat_tipo:  l.categorias_financeiras?.tipo,
        cat_pai_id: l.categorias_financeiras?.categoria_pai_id,
        cat_nivel: l.categorias_financeiras?.nivel ?? 1,
        eh_transferencia_interna: l.eh_transferencia_interna ?? false,
      }));

      setLancamentos(norm);

      const anos = [...new Set(
        norm.map(l => l.data_pagamento ? parseInt(l.data_pagamento.slice(0,4)) : null).filter(Boolean)
      )].sort((a,b) => b - a);
      setAnosDisponiveis(anos);

      // Caixa físico histórico — query direta igual ao calcularCaixaFisicoTotal do FinancasLoja
      const { data: dadosCaixa } = await supabase
        .from('lancamentos_loja')
        .select('valor, tipo_pagamento, eh_transferencia_interna, categorias_financeiras(tipo, nome)')
        .eq('status', 'pago');
      if (dadosCaixa) {
        const nc = (l) => l.categorias_financeiras?.nome?.toLowerCase() || '';
        const dinheiroRec = dadosCaixa
          .filter(l => l.categorias_financeiras?.tipo === 'receita' && l.tipo_pagamento === 'dinheiro' && !l.eh_transferencia_interna && !nc(l).includes('tronco'))
          .reduce((s,l) => s + parseFloat(l.valor), 0);
        const sangriasHist = dadosCaixa
          .filter(l => l.categorias_financeiras?.tipo === 'despesa' && l.eh_transferencia_interna === true && !nc(l).includes('tronco'))
          .reduce((s,l) => s + parseFloat(l.valor), 0);
        const despDinhHist = dadosCaixa
          .filter(l => l.categorias_financeiras?.tipo === 'despesa' && l.tipo_pagamento === 'dinheiro' && l.eh_transferencia_interna === false && !nc(l).includes('tronco'))
          .reduce((s,l) => s + parseFloat(l.valor), 0);
        setCaixaFisicoHistorico(dinheiroRec - sangriasHist - despDinhHist);
        setCaixaDetalhes({ recDinheiro: dinheiroRec, sangrias: sangriasHist, despDinheiro: despDinhHist });
      }

      // Calcular saldo anterior para o período padrão
      const sa = await buscarSaldoAnterior({ mes: 0, ano: anoAtual });
      setSaldoAntA(sa);

    } catch (err) {
      showError?.('Erro ao carregar dados: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Filtrar por período — usa data_pagamento (consistente com saldo anterior) ─
  const filtrarPeriodo = (periodo) => {
    if (periodo.ano === 0) {
      // Histórico completo — todos pagos com data_pagamento
      return lancamentos.filter(l => l.status === 'pago' && l.data_pagamento);
    }
    const anoStr = String(periodo.ano);
    const mesStr = periodo.mes > 0 ? String(periodo.mes).padStart(2,'0') : null;
    return lancamentos.filter(l => {
      if (l.status !== 'pago' || !l.data_pagamento) return false;
      if (!l.data_pagamento.startsWith(anoStr + '-')) return false;
      if (mesStr && l.data_pagamento.slice(5,7) !== mesStr) return false;
      return true;
    });
  };

  // ─── Classificar lançamento — IDÊNTICO ao FinancasLoja ──────────────────────
  const classificar = (l) => {
    if (l.status !== 'pago') return null;
    const nomeCat = l.cat_nome?.toLowerCase() || '';
    const isTronco       = nomeCat.includes('tronco');
    const isDinheiro     = l.tipo_pagamento === 'dinheiro';
    const isCompensacao  = l.tipo_pagamento === 'compensacao';
    const isTransfInterna = l.eh_transferencia_interna === true;

    if (isCompensacao) return null;

    if (l.cat_tipo === 'receita') {
      // Depósito de tronco (transf. interna + tronco receita) → banco (como receitasBancarias)
      if (isTronco && isTransfInterna) return { grupo: 'banco_receita' };
      // Tronco em dinheiro → NÃO conta (nem banco nem caixa)
      if (isTronco && isDinheiro) return null;
      // Depósito normal (sangria depositada) → banco (como depositos)
      if (isTransfInterna) return { grupo: 'banco_deposito' };
      // Receita em dinheiro → caixa físico
      if (isDinheiro) return { grupo: 'caixa_receita' };
      // Receita bancária (pix, transf., cartão)
      return { grupo: 'banco_receita' };
    }

    if (l.cat_tipo === 'despesa') {
      // Sangria (transf. interna despesa) → sai do caixa físico
      if (isTransfInterna) return { grupo: 'sangria' };
      // Despesa em dinheiro → caixa físico
      if (isDinheiro) return { grupo: 'caixa_despesa' };
      // Despesa bancária (pix, transf., cartão)
      return { grupo: 'banco_despesa' };
    }
    return null;
  };

  // ─── Calcular valores do período ────────────────────────────────────────────
  const calcularPeriodo = (lancsPeríodo, saldoAnterior) => {
    let recBanco = 0, recCaixa = 0, despBanco = 0, despCaixa = 0, depositos = 0, sangrias = 0;

    lancsPeríodo.forEach(l => {
      const cl = classificar(l);
      if (!cl) return;
      const v = parseFloat(l.valor || 0);
      if (cl.grupo === 'banco_receita')  recBanco  += v;
      if (cl.grupo === 'caixa_receita')  recCaixa  += v;
      if (cl.grupo === 'banco_deposito') depositos += v;
      if (cl.grupo === 'banco_despesa')  despBanco += v;
      if (cl.grupo === 'caixa_despesa')  despCaixa += v;
      if (cl.grupo === 'sangria')        sangrias  += v;
    });

    // Fórmula idêntica ao FinancasLoja
    const saldoBancario = saldoAnterior.bancario + recBanco + depositos - despBanco;
    const saldoCaixa    = saldoAnterior.caixa    + recCaixa - despCaixa - sangrias;
    const saldoTotal    = saldoBancario + saldoCaixa;

    return { recBanco, recCaixa, despBanco, despCaixa, depositos, sangrias, saldoBancario, saldoCaixa, saldoTotal };
  };

  // ─── Agrupar por categoria/subcategoria ─────────────────────────────────────
  const agruparCategorias = (lancsPeríodo, tipo) => {
    const catMap = {};
    categorias.forEach(c => { catMap[c.id] = c; });

    const filtrados = lancsPeríodo.filter(l => {
      const cl = classificar(l);
      if (!cl) return false;
      // Excluir transferências internas (banco_deposito / sangria) — não são categorias reais
      if (cl.grupo === 'banco_deposito') return false;
      if (cl.grupo === 'sangria') return false;
      return l.cat_tipo === tipo;
    });

    const porCat = {};
    filtrados.forEach(l => {
      const id = l.cat_id || 'sem';
      if (!porCat[id]) porCat[id] = { id, nome: l.cat_nome || 'Sem categoria', valor: 0, valorBanco: 0, valorCaixa: 0, pai_id: l.cat_pai_id };
      const v = parseFloat(l.valor || 0);
      const cl = classificar(l);
      porCat[id].valor += v;
      if (cl?.grupo === 'banco_receita' || cl?.grupo === 'banco_despesa') porCat[id].valorBanco += v;
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
        if (!grupos[paiId]) grupos[paiId] = { id: paiId, nome: pai?.nome || 'Outros', valor: 0, valorBanco: 0, valorCaixa: 0, filhos: [] };
        grupos[paiId].filhos.push(cat);
        grupos[paiId].valor      += cat.valor;
        grupos[paiId].valorBanco += cat.valorBanco;
        grupos[paiId].valorCaixa += cat.valorCaixa;
      }
    });
    return Object.values(grupos).sort((a,b) => b.valor - a.valor);
  };

  // ─── Dados computados ────────────────────────────────────────────────────────
  const lancsA = useMemo(() => filtrarPeriodo(periodoA), [lancamentos, periodoA]);
  const lancsB = useMemo(() => filtrarPeriodo(periodoB), [lancamentos, periodoB]);

  const dadosA = useMemo(() => calcularPeriodo(lancsA, saldoAntA), [lancsA, saldoAntA]);
  const dadosB = useMemo(() => calcularPeriodo(lancsB, saldoAntB), [lancsB, saldoAntB]);

  const gruposRecA = useMemo(() => agruparCategorias(lancsA, 'receita'), [lancsA, categorias]);
  const gruposRecB = useMemo(() => agruparCategorias(lancsB, 'receita'), [lancsB, categorias]);
  const gruposDespA = useMemo(() => agruparCategorias(lancsA, 'despesa'), [lancsA, categorias]);
  const gruposDespB = useMemo(() => agruparCategorias(lancsB, 'despesa'), [lancsB, categorias]);

  const dadosMensais = useMemo(() => {
    if (periodoA.ano === 0) return [];
    // Saldo bancário acumulado mês a mês
    // Para cada mês: saldo banco = saldoAntA.bancario + tudo pago de jan até esse mês
    const anoStr = String(periodoA.ano);
    const todosPeriodo = lancamentos.filter(l =>
      l.status === 'pago' && l.data_pagamento?.startsWith(anoStr + '-')
    );

    return MESES.map((_, idx) => {
      const mes = idx + 1;
      const mesStr = String(mes).padStart(2,'0');
      // Lançamentos só deste mês
      const lancsDoMes = todosPeriodo.filter(l => l.data_pagamento?.slice(5,7) === mesStr);
      // Lançamentos acumulados até este mês (para saldo banco cumulativo)
      const lancsAte = todosPeriodo.filter(l => parseInt(l.data_pagamento?.slice(5,7) || 0) <= mes);

      // Calcular saldo bancário acumulado até este mês
      const dmAte = calcularPeriodo(lancsAte, saldoAntA);

      // Receitas e despesas só do mês
      const dmMes = calcularPeriodo(lancsDoMes, { bancario: 0, caixa: 0 });

      const mesAtualNum = new Date().getFullYear() === periodoA.ano ? new Date().getMonth() + 1 : 12;
      const mesJaOcorreu = mes <= mesAtualNum;

      return {
        mes: MESES_ABREV[idx],
        recBanco: dmMes.recBanco,
        recCaixa: dmMes.recCaixa,
        despBanco: dmMes.despBanco,
        despCaixa: dmMes.despCaixa,
        // Saldo banco cumulativo — só exibir se o mês já ocorreu
        saldoBancario: mesJaOcorreu ? dmAte.saldoBancario : null,
        mesJaOcorreu,
      };
    });
  }, [lancamentos, periodoA, saldoAntA, caixaFisicoHistorico]);

  const maxMensal = Math.max(...dadosMensais.map(m => Math.max(m.recBanco + m.recCaixa, m.despBanco + m.despCaixa)), 1);

  if (!isOpen) return null;

  const labelPeriodo = (p) => p.ano === 0 ? '📊 Histórico Completo' : p.mes > 0 ? `${MESES[p.mes-1]} ${p.ano}` : `Ano ${p.ano}`;

  // ─── Sub-componentes ─────────────────────────────────────────────────────────
  const SeletorPeriodo = ({ periodo, onChange, label }) => (
    <div style={{display:'flex', alignItems:'center', gap:'0.4rem'}}>
      <span style={{fontSize:'0.78rem', fontWeight:'700', color:'var(--color-text-muted)'}}>{label}</span>
      <select value={periodo.mes} onChange={e => onChange({ ...periodo, mes: parseInt(e.target.value) })} style={sSelect}
        disabled={periodo.ano === 0}>
        <option value={0}>Ano inteiro</option>
        {MESES.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
      </select>
      <select value={periodo.ano} onChange={e => onChange({ ...periodo, ano: parseInt(e.target.value), mes: 0 })} style={sSelect}>
        <option value={0}>📊 Histórico completo</option>
        {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
      </select>
    </div>
  );

  const Linha = ({ label, valor, cor, negrito = true, grande = false }) => (
    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.2rem'}}>
      <span style={{fontSize: grande ? '0.85rem' : '0.76rem', color:'var(--color-text)', fontWeight: negrito ? '700' : '400'}}>{label}</span>
      <span style={{fontSize: grande ? '0.92rem' : '0.82rem', fontWeight: negrito ? '800' : '500', color: cor}}>{formatarMoeda(Math.abs(valor))}</span>
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
                  <div style={{fontSize:'0.65rem', color:'var(--color-text-muted)'}}>🏦 {formatarMoeda(grupo.valorBanco)} · 💵 {formatarMoeda(grupo.valorCaixa)}</div>
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
                <div key={filho.id} style={{display:'flex', gap:'0.5rem', padding:'0.35rem 0.75rem 0.35rem 1.5rem', borderTop:'1px solid var(--color-border)'}}>
                  <span style={{fontSize:'0.68rem', color:'var(--color-text-muted)', marginTop:'2px'}}>└</span>
                  <div style={{flex:1}}>
                    <div style={{display:'flex', justifyContent:'space-between'}}>
                      <span style={{fontSize:'0.78rem', color:'var(--color-text)'}}>{filho.nome}</span>
                      <div style={{textAlign:'right'}}>
                        <span style={{fontSize:'0.78rem', fontWeight:'700', color: cor}}>{formatarMoeda(filho.valor)}</span>
                        {filho.valorBanco > 0 && filho.valorCaixa > 0 && (
                          <div style={{fontSize:'0.62rem', color:'var(--color-text-muted)'}}>🏦 {formatarMoeda(filho.valorBanco)} · 💵 {formatarMoeda(filho.valorCaixa)}</div>
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

  const PainelExtrato = ({ dados, anterior, label, caixaHistorico, caixaDetalhes }) => (
    <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-xl)', overflow:'hidden'}}>
      {label && (
        <div style={{padding:'0.5rem 1rem', background:'var(--color-surface-2)', borderBottom:'1px solid var(--color-border)'}}>
          <span style={{fontSize:'0.78rem', fontWeight:'700', color:'var(--color-text-muted)', textTransform:'uppercase'}}>{label}</span>
        </div>
      )}
      <div style={{padding:'0.75rem 1rem'}}>

        {/* BANCO */}
        <div style={{marginBottom:'0.75rem'}}>
          <p style={{fontSize:'0.72rem', fontWeight:'700', color:'var(--color-text-muted)', textTransform:'uppercase', marginBottom:'0.4rem'}}>🏦 Conta Bancária</p>
          <div style={{background:'var(--color-surface-2)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-md)', padding:'0.6rem 0.75rem'}}>
            <Linha label="Saldo Anterior" valor={anterior.bancario} cor="var(--color-text-muted)" negrito={false} />
            <Linha label="+ Receitas Bancárias" valor={dados.recBanco} cor="#10b981" />
            {dados.depositos > 0 && <Linha label="+ Depósitos (sangrias)" valor={dados.depositos} cor="#10b981" />}
            <Linha label="− Despesas Bancárias" valor={-dados.despBanco} cor="#ef4444" />
            <div style={{borderTop:'1px solid var(--color-border)', marginTop:'0.4rem', paddingTop:'0.4rem'}}>
              <Linha label="= Saldo Bancário" valor={dados.saldoBancario} cor={dados.saldoBancario >= 0 ? '#3b82f6' : '#ef4444'} negrito={true} grande={true} />
            </div>
          </div>
        </div>

        {/* CAIXA */}
        <div style={{marginBottom:'0.75rem'}}>
          <p style={{fontSize:'0.72rem', fontWeight:'700', color:'var(--color-text-muted)', textTransform:'uppercase', marginBottom:'0.2rem'}}>💵 Caixa Físico</p>
          <div style={{background:'var(--color-surface-2)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-md)', padding:'0.6rem 0.75rem'}}>
            <Linha label="+ Rec. Dinheiro (histórico)" valor={caixaDetalhes?.recDinheiro || 0} cor="#10b981" negrito={false} />
            {(caixaDetalhes?.sangrias || 0) > 0 && <Linha label="− Sangrias Depositadas" valor={-(caixaDetalhes?.sangrias || 0)} cor="#f59e0b" negrito={false} />}
            {(caixaDetalhes?.despDinheiro || 0) > 0 && <Linha label="− Despesas em Dinheiro" valor={-(caixaDetalhes?.despDinheiro || 0)} cor="#ef4444" negrito={false} />}
            <div style={{borderTop:'1px solid var(--color-border)', marginTop:'0.4rem', paddingTop:'0.4rem'}}>
              <Linha label="= Saldo Caixa Físico" valor={caixaHistorico} cor={caixaHistorico >= 0 ? '#f59e0b' : '#ef4444'} negrito={true} grande={true} />
            </div>
          </div>
        </div>

        {/* TOTAL */}
        {(() => {
          const cxFinal = caixaHistorico !== undefined ? caixaHistorico : dados.saldoCaixa;
          const total = dados.saldoBancario + cxFinal;
          return (
            <div style={{background: total >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border:`1px solid ${total >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius:'var(--radius-md)', padding:'0.6rem 0.75rem'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span style={{fontSize:'0.85rem', fontWeight:'800', color:'var(--color-text)'}}>💳 Saldo Total (Banco + Caixa)</span>
                <span style={{fontSize:'1.15rem', fontWeight:'800', color: total >= 0 ? '#10b981' : '#ef4444'}}>{formatarMoeda(total)}</span>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );

  const PainelCategoria = ({ grupos, totalBanco, totalCaixa, tipo, labelComp }) => {
    const cor = tipo === 'receita' ? '#10b981' : '#ef4444';
    const emoji = tipo === 'receita' ? '💵' : '💸';
    const titulo = tipo === 'receita' ? 'Receitas' : 'Despesas';
    const totalGeral = totalBanco + totalCaixa;
    return (
      <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-xl)', overflow:'hidden'}}>
        <div style={{padding:'0.75rem 1rem', borderBottom:'1px solid var(--color-border)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <span style={{fontWeight:'800', fontSize:'0.95rem', color:'var(--color-text)'}}>{emoji} {titulo}</span>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:'1.05rem', fontWeight:'800', color: cor}}>{formatarMoeda(totalGeral)}</div>
            <div style={{fontSize:'0.68rem', color:'var(--color-text-muted)'}}>
              🏦 {formatarMoeda(totalBanco)} · 💵 {formatarMoeda(totalCaixa)}
            </div>
            {labelComp && <div style={{fontSize:'0.7rem', color:'var(--color-text-muted)'}}>{labelComp}</div>}
          </div>
        </div>
        <div style={{padding:'0.75rem'}}>
          {grupos.length === 0
            ? <p style={{textAlign:'center', color:'var(--color-text-muted)', fontSize:'0.82rem', padding:'1rem 0'}}>Nenhum lançamento no período</p>
            : grupos.map(g => <GrupoCategoria key={g.id} grupo={g} total={totalGeral} cor={cor} />)
          }
        </div>
      </div>
    );
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{position:'fixed', inset:0, background:'var(--color-bg)', zIndex:50, overflowY:'auto'}}>

      {/* Barra título */}
      <div style={{position:'sticky', top:0, zIndex:11, background:'var(--color-accent)', padding:'0.6rem 1.25rem', display:'flex', alignItems:'center', justifyContent:'space-between', boxShadow:'0 2px 8px rgba(0,0,0,0.2)'}}>
        <div>
          <h2 style={{color:'#fff', fontWeight:'800', fontSize:'1.05rem', margin:0}}>📋 Relatório Financeiro</h2>
          <p style={{color:'rgba(255,255,255,0.8)', fontSize:'0.7rem', margin:'0.1rem 0 0'}}>Saldo, receitas e despesas por categoria</p>
        </div>
        <button onClick={onClose}
          style={{padding:'0.3rem 0.9rem', background:'rgba(255,255,255,0.15)', color:'#fff', border:'1px solid rgba(255,255,255,0.3)', borderRadius:'var(--radius-lg)', cursor:'pointer', fontSize:'0.82rem', fontWeight:'600'}}>
          ← Voltar
        </button>
        <button
          onClick={() => gerarPDFRelatorioFinanceiro({
            supabase,
            periodoA,
            dadosA,
            saldoAntA,
            caixaFisicoHistorico,
            caixaDetalhes,
            gruposReceitas: gruposRecA,
            gruposDespesas: gruposDespA,
            dadosMensais: periodoA.ano > 0 ? dadosMensais : [],
            showError,
            showSuccess,
          })}
          style={{padding:'0.3rem 0.9rem', background:'rgba(255,255,255,0.9)', color:'var(--color-accent)', border:'none', borderRadius:'var(--radius-lg)', cursor:'pointer', fontSize:'0.82rem', fontWeight:'700'}}>
          📄 Gerar PDF
        </button>
      </div>

      {/* Barra filtros */}
      <div style={{position:'sticky', top:'44px', zIndex:10, background:'var(--color-surface)', borderBottom:'1px solid var(--color-border)', padding:'0.5rem 1.25rem', display:'flex', alignItems:'center', gap:'0.75rem', flexWrap:'wrap'}}>
        <SeletorPeriodo periodo={periodoA} onChange={async (p) => { setPeriodoA(p); const s = await buscarSaldoAnterior(p); setSaldoAntA(s); }} label="Período:" />
        <button onClick={() => setMostrarComparacao(!mostrarComparacao)}
          style={{padding:'0.3rem 0.75rem', background: mostrarComparacao ? 'var(--color-accent)' : 'var(--color-surface-2)', color: mostrarComparacao ? '#fff' : 'var(--color-text)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-lg)', cursor:'pointer', fontSize:'0.78rem', fontWeight:'700'}}>
          {mostrarComparacao ? '✕ Comparação' : '⚖️ Comparar período'}
        </button>
        {mostrarComparacao && (
          <SeletorPeriodo periodo={periodoB} onChange={async (p) => { setPeriodoB(p); const s = await buscarSaldoAnterior(p); setSaldoAntB(s); }} label="vs:" />
        )}
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
              <PainelExtrato dados={dadosA} anterior={saldoAntA} caixaHistorico={caixaFisicoHistorico} caixaDetalhes={caixaDetalhes} label={mostrarComparacao ? labelPeriodo(periodoA) : null} />
              {mostrarComparacao && <PainelExtrato dados={dadosB} anterior={saldoAntB} caixaHistorico={caixaFisicoHistorico} caixaDetalhes={caixaDetalhes} label={labelPeriodo(periodoB)} />}
            </div>
          )}

          {/* ABA RECEITAS */}
          {aba === 'receitas' && (
            <div style={{display:'grid', gridTemplateColumns: mostrarComparacao ? '1fr 1fr' : '1fr', gap:'1rem'}}>
              <PainelCategoria grupos={gruposRecA} totalBanco={dadosA.recBanco} totalCaixa={dadosA.recCaixa} tipo="receita" labelComp={mostrarComparacao ? labelPeriodo(periodoA) : null} />
              {mostrarComparacao && <PainelCategoria grupos={gruposRecB} totalBanco={dadosB.recBanco} totalCaixa={dadosB.recCaixa} tipo="receita" labelComp={labelPeriodo(periodoB)} />}
            </div>
          )}

          {/* ABA DESPESAS */}
          {aba === 'despesas' && (
            <div style={{display:'grid', gridTemplateColumns: mostrarComparacao ? '1fr 1fr' : '1fr', gap:'1rem'}}>
              <PainelCategoria grupos={gruposDespA} totalBanco={dadosA.despBanco} totalCaixa={dadosA.despCaixa} tipo="despesa" labelComp={mostrarComparacao ? labelPeriodo(periodoA) : null} />
              {mostrarComparacao && <PainelCategoria grupos={gruposDespB} totalBanco={dadosB.despBanco} totalCaixa={dadosB.despCaixa} tipo="despesa" labelComp={labelPeriodo(periodoB)} />}
            </div>
          )}

          {/* ABA MENSAL */}
          {aba === 'mensal' && periodoA.ano === 0 && (
            <div style={{textAlign:'center', padding:'2rem', color:'var(--color-text-muted)', background:'var(--color-surface)', borderRadius:'var(--radius-xl)', border:'1px solid var(--color-border)'}}>
              <p style={{fontSize:'1.5rem', marginBottom:'0.5rem'}}>📅</p>
              <p>Selecione um ano específico para ver a evolução mensal.</p>
            </div>
          )}
          {aba === 'mensal' && periodoA.ano > 0 && (
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
                <table style={{width:'100%', borderCollapse:'collapse', minWidth:'750px'}}>
                  <thead>
                    <tr style={{background:'var(--color-surface-2)'}}>
                      {['Mês','Rec. Banco','Rec. Caixa','Desp. Banco','Desp. Caixa','Saldo Banco','Saldo Caixa','Saldo Total',''].map((h,i) => (
                        <th key={i} style={{padding:'0.5rem 0.6rem', textAlign: i === 0 || i === 8 ? 'left' : 'right', fontSize:'0.7rem', fontWeight:'700', color:'var(--color-text-muted)', whiteSpace:'nowrap'}}>{h}</th>
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
                          <td style={{padding:'0.5rem 0.6rem', textAlign:'right', fontSize:'0.8rem', fontWeight:'700', color: (m.saldoBancario ?? 0) >= 0 ? '#3b82f6' : '#ef4444'}}>
                            {m.mesJaOcorreu && m.saldoBancario !== null ? formatarMoeda(m.saldoBancario) : '—'}
                          </td>
                          <td style={{padding:'0.5rem 0.6rem', minWidth:'100px'}}>
                            {temDados && (
                              <div style={{display:'flex', flexDirection:'column', gap:'2px'}}>
                                <div style={{width:`${(m.recBanco+m.recCaixa)/maxMensal*100}%`, height:'5px', borderRadius:'3px', background:'#10b981', minWidth:'2px'}} />
                                <div style={{width:`${(m.despBanco+m.despCaixa)/maxMensal*100}%`, height:'5px', borderRadius:'3px', background:'#ef4444', minWidth:'2px'}} />
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    <tr style={{borderTop:'2px solid var(--color-border)', background:'var(--color-surface-2)'}}>
                      <td style={{padding:'0.6rem', fontWeight:'800', fontSize:'0.82rem', color:'var(--color-text)'}}>TOTAL {periodoA.ano}</td>
                      <td style={{padding:'0.6rem', textAlign:'right', fontWeight:'800', fontSize:'0.82rem', color:'#10b981'}}>{formatarMoeda(dadosMensais.reduce((s,m)=>s+m.recBanco,0))}</td>
                      <td style={{padding:'0.6rem', textAlign:'right', fontWeight:'800', fontSize:'0.82rem', color:'#10b981'}}>{formatarMoeda(dadosMensais.reduce((s,m)=>s+m.recCaixa,0))}</td>
                      <td style={{padding:'0.6rem', textAlign:'right', fontWeight:'800', fontSize:'0.82rem', color:'#ef4444'}}>{formatarMoeda(dadosMensais.reduce((s,m)=>s+m.despBanco,0))}</td>
                      <td style={{padding:'0.6rem', textAlign:'right', fontWeight:'800', fontSize:'0.82rem', color:'#ef4444'}}>{formatarMoeda(dadosMensais.reduce((s,m)=>s+m.despCaixa,0))}</td>
                      <td style={{padding:'0.6rem', textAlign:'right', fontWeight:'800', fontSize:'0.9rem', color:'#3b82f6'}}>
                        {formatarMoeda(dadosA.saldoBancario)}
                      </td>
                      <td style={{padding:'0.6rem', textAlign:'right', fontWeight:'800', fontSize:'0.82rem', color:'var(--color-text-muted)', whiteSpace:'nowrap'}}>
                        + caixa {formatarMoeda(caixaFisicoHistorico)} = <span style={{color:'#10b981'}}>{formatarMoeda(dadosA.saldoBancario + caixaFisicoHistorico)}</span>
                      </td>
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
