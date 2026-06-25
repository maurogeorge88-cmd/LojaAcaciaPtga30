import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import RelatorioIrmaosPendencias from './RelatorioIrmaosPendencias';

const fmtR = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MESES_NOME = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const sTh = { border: '1px solid var(--color-border)', padding: '0.6rem 0.75rem', fontWeight: '700', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', background: 'var(--color-surface-2)', textAlign: 'right' };
const sTd = { border: '1px solid var(--color-border)', padding: '0.55rem 0.75rem', textAlign: 'right', fontSize: '0.85rem' };
const sInp = { padding: '0.38rem 0.7rem', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', cursor: 'pointer', outline: 'none' };

const SITUACOES_ATIVAS = ['regular', 'licenciado'];

function TabelaIrmaos({ lista, ordem, titulo, corTitulo, bgTitulo }) {
  if (lista.length === 0) return null;
  const totLojaPg    = lista.reduce((s, i) => s + ((i.totalDespesas  || 0) - (i.despesasPendentes || 0)), 0);
  const totLojaDev   = lista.reduce((s, i) => s + (i.despesasPendentes  || 0), 0);
  const totRecPagas  = lista.reduce((s, i) => s + ((i.totalReceitas  || 0) - (i.receitasPendentes || 0)), 0);
  const totValDevido = lista.reduce((s, i) => s + (i.receitasPendentes  || 0), 0);
  const sorted = [...lista].sort((a, b) =>
    ordem === 'valor' ? (b.receitasPendentes || 0) - (a.receitasPendentes || 0)
                      : a.nomeIrmao.localeCompare(b.nomeIrmao)
  );
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 1rem', background: bgTitulo, border: `1px solid ${corTitulo}40`, borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', borderBottom: 'none' }}>
        <span style={{ fontWeight: '800', fontSize: '0.92rem', color: corTitulo }}>{titulo}</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: '700', color: corTitulo, background: `${corTitulo}20`, padding: '0.15rem 0.6rem', borderRadius: '999px', border: `1px solid ${corTitulo}40` }}>
          {lista.length} irmão{lista.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div style={{ overflowX: 'auto', border: `1px solid ${corTitulo}30`, borderRadius: '0 0 var(--radius-lg) var(--radius-lg)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...sTh, textAlign: 'left', width: '26%' }}>Irmão</th>
              <th style={sTh}>Desp. Pagas<div style={{ fontSize: '0.62rem', fontWeight: '400', marginTop: '0.1rem' }}>Loja → Irmão (pago)</div></th>
              <th style={{ ...sTh, color: '#7c3aed' }}>Loja Deve<div style={{ fontSize: '0.62rem', fontWeight: '400', marginTop: '0.1rem', color: 'var(--color-text-muted)' }}>Loja → Irmão (pendente)</div></th>
              <th style={{ ...sTh, color: '#16a34a' }}>Rec. Pagas<div style={{ fontSize: '0.62rem', fontWeight: '400', marginTop: '0.1rem', color: 'var(--color-text-muted)' }}>Irmão → Loja (pago)</div></th>
              <th style={{ ...sTh, color: '#ea580c' }}>Valor Devido<div style={{ fontSize: '0.62rem', fontWeight: '400', marginTop: '0.1rem', color: 'var(--color-text-muted)' }}>Irmão → Loja (pendente)</div></th>
              <th style={{ ...sTh, textAlign: 'center' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((irmao, idx) => {
              const despPagas = (irmao.totalDespesas  || 0) - (irmao.despesasPendentes || 0);
              const lojaDeve  = irmao.despesasPendentes  || 0;
              const recPagas  = (irmao.totalReceitas  || 0) - (irmao.receitasPendentes || 0);
              const valDevido = irmao.receitasPendentes  || 0;
              const devedor   = valDevido > 0;
              return (
                <tr key={idx} style={{ background: idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)' }}>
                  <td style={{ ...sTd, textAlign: 'left' }}>
                    <p style={{ margin: 0, fontWeight: '700', color: 'var(--color-text)', fontSize: '0.875rem' }}>{irmao.nomeIrmao}</p>
                    <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>CIM: {irmao.cim || 'N/A'}</p>
                  </td>
                  <td style={{ ...sTd, color: '#6b7280' }}>{fmtR(despPagas)}</td>
                  <td style={{ ...sTd, color: lojaDeve > 0 ? '#7c3aed' : 'var(--color-text-muted)', fontWeight: lojaDeve > 0 ? '700' : '400' }}>{fmtR(lojaDeve)}</td>
                  <td style={{ ...sTd, color: '#16a34a', fontWeight: '600' }}>{fmtR(recPagas)}</td>
                  <td style={{ ...sTd, color: valDevido > 0 ? '#ea580c' : '#16a34a', fontWeight: valDevido > 0 ? '800' : '600', fontSize: valDevido > 0 ? '0.95rem' : '0.85rem' }}>{fmtR(valDevido)}</td>
                  <td style={{ ...sTd, textAlign: 'center' }}>
                    <span style={{ padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: '700', background: devedor ? 'rgba(234,88,12,0.12)' : 'rgba(22,163,74,0.12)', color: devedor ? '#ea580c' : '#16a34a', border: '1px solid ' + (devedor ? 'rgba(234,88,12,0.3)' : 'rgba(22,163,74,0.3)') }}>
                      {devedor ? 'Devedor' : 'Em Dia'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: 'var(--color-surface-2)', borderTop: '2px solid var(--color-border)' }}>
              <td style={{ ...sTd, textAlign: 'left', fontWeight: '700', color: 'var(--color-text)' }}>TOTAL ({lista.length} irmãos)</td>
              <td style={{ ...sTd, color: '#6b7280', fontWeight: '700' }}>{fmtR(totLojaPg)}</td>
              <td style={{ ...sTd, color: '#7c3aed', fontWeight: '800' }}>{fmtR(totLojaDev)}</td>
              <td style={{ ...sTd, color: '#16a34a', fontWeight: '800' }}>{fmtR(totRecPagas)}</td>
              <td style={{ ...sTd, color: '#ea580c', fontWeight: '800', fontSize: '0.95rem' }}>{fmtR(totValDevido)}</td>
              <td style={sTd}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default function ModalResumoIrmaos({ isOpen, onClose }) {
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [ordem, setOrdem]               = useState('alfa');
  const [filtroAno, setFiltroAno]       = useState('todos');
  const [filtroMes, setFiltroMes]       = useState('todos');
  const [anosDisp, setAnosDisp]         = useState([]);
  const [mesesDisp, setMesesDisp]       = useState([]);
  const [loading, setLoading]           = useState(false);
  const [todosLanc, setTodosLanc]       = useState([]);   // todos os lançamentos de irmãos
  const [irmaosMap, setIrmaosMap]       = useState({});   // { id → { nome, cim, situacao } }
  const [resumoIrmaos, setResumoIrmaos] = useState([]);

  // ── Busca inicial quando o modal abre ─────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    buscarDados();
  }, [isOpen]);

  const buscarDados = async () => {
    setLoading(true);
    try {
      // 1. Todos os irmãos (para saber situação)
      const { data: irmaosData } = await supabase
        .from('irmaos')
        .select('id, nome, cim, situacao')
        .order('nome');
      const mapa = {};
      (irmaosData || []).forEach(i => { mapa[i.id] = i; });
      setIrmaosMap(mapa);

      // 2. Todos os lançamentos de irmãos (sem filtro de período)
      const { data: lancData } = await supabase
        .from('lancamentos_loja')
        .select('origem_irmao_id, valor, status, data_vencimento, data_pagamento, categorias_financeiras(tipo), irmaos(nome, cim, situacao)')
        .eq('origem_tipo', 'Irmao')
        .not('origem_irmao_id', 'is', null);

      const lista = lancData || [];
      setTodosLanc(lista);

      // Anos disponíveis (por data_vencimento)
      const anos = [...new Set(lista.map(l => l.data_vencimento?.substring(0,4)).filter(Boolean))].sort((a,b)=>b-a);
      setAnosDisp(anos);
      setFiltroAno('todos');
      setFiltroMes('todos');
      setMesesDisp([]);
    } catch(e) {
      console.error('ModalResumoIrmaos erro:', e);
    } finally {
      setLoading(false);
    }
  };

  // ── Recalcular meses quando ano muda ──────────────────────────
  useEffect(() => {
    if (filtroAno === 'todos') { setMesesDisp([]); setFiltroMes('todos'); return; }
    const meses = [...new Set(
      todosLanc
        .filter(l => l.data_vencimento?.startsWith(filtroAno))
        .map(l => l.data_vencimento?.substring(5,7))
        .filter(Boolean)
    )].sort();
    setMesesDisp(meses);
    setFiltroMes('todos');
  }, [filtroAno, todosLanc]);

  // ── Recalcular resumo quando filtros mudam ────────────────────
  useEffect(() => {
    if (!isOpen || todosLanc.length === 0) return;

    // Filtrar lançamentos pelo período
    const lancFiltrados = todosLanc.filter(l => {
      const dataRef = l.data_vencimento;
      if (filtroAno !== 'todos' && !dataRef?.startsWith(filtroAno)) return false;
      if (filtroMes !== 'todos' && dataRef?.substring(5,7) !== filtroMes) return false;
      return true;
    });

    // Montar resumo por irmão
    const resumoPorIrmao = {};

    lancFiltrados.forEach(lanc => {
      const id = lanc.origem_irmao_id;
      if (!id) return;
      if (!resumoPorIrmao[id]) {
        const dadosIrmao = irmaosMap[id] || lanc.irmaos || {};
        resumoPorIrmao[id] = {
          nomeIrmao: dadosIrmao.nome || `Irmão #${id}`,
          cim: dadosIrmao.cim || null,
          situacao: (dadosIrmao.situacao || '').toLowerCase(),
          totalDespesas: 0, totalReceitas: 0,
          despesasPendentes: 0, receitasPendentes: 0, saldo: 0
        };
      }
      const valor = parseFloat(lanc.valor) || 0;
      const tipo  = lanc.categorias_financeiras?.tipo;
      if (tipo === 'despesa') {
        resumoPorIrmao[id].totalDespesas += valor;
        if (lanc.status === 'pendente') resumoPorIrmao[id].despesasPendentes += valor;
      } else if (tipo === 'receita') {
        resumoPorIrmao[id].totalReceitas += valor;
        if (lanc.status === 'pendente') resumoPorIrmao[id].receitasPendentes += valor;
      }
    });

    Object.values(resumoPorIrmao).forEach(i => { i.saldo = i.despesasPendentes - i.receitasPendentes; });

    const arr = Object.values(resumoPorIrmao).filter(i => i.totalDespesas > 0 || i.totalReceitas > 0);
    const ativos   = arr.filter(i => SITUACOES_ATIVAS.includes(i.situacao)).map(i => ({ ...i, _grupo: 'ativo' }));
    const inativos = arr.filter(i => !SITUACOES_ATIVAS.includes(i.situacao) && (i.receitasPendentes > 0 || i.despesasPendentes > 0)).map(i => ({ ...i, _grupo: 'inativo' }));
    setResumoIrmaos([...ativos, ...inativos]);
  }, [isOpen, todosLanc, filtroAno, filtroMes, irmaosMap]);

  if (!isOpen) return null;

  const ativos   = resumoIrmaos.filter(i => i._grupo === 'ativo');
  const inativos = resumoIrmaos.filter(i => i._grupo === 'inativo');

  const irmaosDevendo = ativos.filter(i => (i.receitasPendentes || 0) > 0);
  const irmaosEmDia   = ativos.filter(i => (i.receitasPendentes || 0) === 0);
  const ativosExibir  = filtroStatus === 'devendo' ? irmaosDevendo
    : filtroStatus === 'em-dia' ? irmaosEmDia : ativos;

  const totRecPagas  = ativosExibir.reduce((s,i)=>s+((i.totalReceitas||0)-(i.receitasPendentes||0)),0);
  const totValDevido = ativosExibir.reduce((s,i)=>s+(i.receitasPendentes||0),0);
  const totLojaDev   = ativosExibir.reduce((s,i)=>s+(i.despesasPendentes||0),0);
  const totLojaPg    = ativosExibir.reduce((s,i)=>s+((i.totalDespesas||0)-(i.despesasPendentes||0)),0);

  const labelPeriodo = filtroAno === 'todos' ? 'Todo o período'
    : filtroMes === 'todos' ? `Ano ${filtroAno}`
    : `${MESES_NOME[parseInt(filtroMes)-1]} / ${filtroAno}`;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '1100px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ background: 'var(--color-accent)', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ color: '#fff', fontWeight: '800', fontSize: '1.25rem', margin: 0 }}>💰 Resumo Financeiro dos Irmãos</h2>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.78rem', margin: '0.2rem 0 0' }}>{labelPeriodo}</p>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '50%', width: '2.25rem', height: '2.25rem', fontSize: '1.4rem', fontWeight: '700', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>

          {/* ── Filtros de período ── */}
          <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem', padding: '0.75rem 1rem', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>📅 Período:</span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: '600' }}>Ano:</label>
              <select value={filtroAno} onChange={e => setFiltroAno(e.target.value)} style={sInp}>
                <option value="todos">Todos</option>
                {anosDisp.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: '600' }}>Mês:</label>
              <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)} disabled={filtroAno === 'todos'} style={{ ...sInp, opacity: filtroAno === 'todos' ? 0.5 : 1 }}>
                <option value="todos">Todos</option>
                {mesesDisp.map(m => <option key={m} value={m}>{MESES_NOME[parseInt(m)-1]}</option>)}
              </select>
            </div>

            {(filtroAno !== 'todos' || filtroMes !== 'todos') && (
              <button onClick={() => { setFiltroAno('todos'); setFiltroMes('todos'); }}
                style={{ padding: '0.32rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600' }}>
                ✕ Limpar
              </button>
            )}

            {loading && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>⏳ Carregando...</span>}
          </div>

          {/* ── Filtros de status + ordenação ── */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {[
              ['todos',   '📊 Todos ('   + ativos.length + ')',       filtroStatus === 'todos'   ? '#2563eb' : 'var(--color-surface-2)', filtroStatus === 'todos'   ? '#fff' : 'var(--color-text)'],
              ['devendo', '⚠️ Devendo (' + irmaosDevendo.length + ')' , filtroStatus === 'devendo' ? '#ea580c' : 'var(--color-surface-2)', filtroStatus === 'devendo' ? '#fff' : 'var(--color-text)'],
              ['em-dia',  '✅ Em Dia ('  + irmaosEmDia.length + ')',   filtroStatus === 'em-dia'  ? '#16a34a' : 'var(--color-surface-2)', filtroStatus === 'em-dia'  ? '#fff' : 'var(--color-text)'],
            ].map(item => (
              <button key={item[0]} onClick={() => setFiltroStatus(item[0])}
                style={{ padding: '0.45rem 1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', background: item[2], color: item[3] }}>
                {item[1]}
              </button>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: 'auto' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: '600' }}>Ordenar:</span>
              {[['alfa','A→Z'],['valor','Maior Débito']].map(([val, lbl]) => (
                <button key={val} onClick={() => setOrdem(val)}
                  style={{ padding: '0.35rem 0.7rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontWeight: '600', fontSize: '0.75rem', cursor: 'pointer', background: ordem === val ? 'var(--color-accent)' : 'var(--color-surface-2)', color: ordem === val ? '#fff' : 'var(--color-text)' }}>
                  {lbl}
                </button>
              ))}
              <RelatorioIrmaosPendencias resumoIrmaos={resumoIrmaos} />
            </div>
          </div>

          {/* Cards resumo */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {[
              { label: 'Irmãos Exibindo', valor: null, num: ativosExibir.length, cor: '#2563eb' },
              { label: 'Rec. Pagas (Irmão→Loja)', valor: totRecPagas, cor: '#16a34a' },
              { label: 'Valor Devido (Irmão→Loja)', valor: totValDevido, cor: '#ea580c', borda: true },
              { label: 'Loja Deve (Pendente)', valor: totLojaDev, cor: '#7c3aed', borda: true },
            ].map((card, i) => (
              <div key={i} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderLeft: card.borda ? `3px solid ${card.cor}` : undefined, borderRadius: 'var(--radius-lg)', padding: '0.85rem' }}>
                <p style={{ margin: '0 0 0.3rem', fontSize: '0.68rem', fontWeight: '700', color: card.borda ? card.cor : 'var(--color-text-muted)', textTransform: 'uppercase' }}>{card.label}</p>
                <p style={{ margin: 0, fontSize: card.num !== undefined ? '1.75rem' : '1.1rem', fontWeight: '800', color: card.cor }}>
                  {card.num !== undefined ? card.num : fmtR(card.valor)}
                </p>
              </div>
            ))}
          </div>

          {/* Tabela ativos */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>⏳ Carregando dados...</div>
          ) : ativosExibir.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
              <p style={{ fontSize: '1.5rem', margin: 0 }}>📭</p>
              <p style={{ marginTop: '0.5rem', fontWeight: '600' }}>Nenhum irmão ativo encontrado para o período</p>
            </div>
          ) : (
            <TabelaIrmaos lista={ativosExibir} ordem={ordem}
              titulo="👥 Irmãos Ativos e Licenciados"
              corTitulo="#2563eb" bgTitulo="rgba(37,99,235,0.06)" />
          )}

          {/* Tabela inativos */}
          {inativos.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.5rem 0 0.25rem' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
                <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>⚠️ Pendências de Irmãos Inativos</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
              </div>
              <TabelaIrmaos lista={inativos} ordem={ordem}
                titulo="🔴 Débitos de Irmãos Inativos — Irregular / Desligado / Suspenso / Excluído / Ex-Ofício"
                corTitulo="#ea580c" bgTitulo="rgba(234,88,12,0.06)" />
            </>
          )}

          {/* Legenda */}
          <div style={{ marginTop: '0.5rem', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '0.85rem 1rem' }}>
            <p style={{ margin: '0 0 0.4rem', fontWeight: '700', color: 'var(--color-text)', fontSize: '0.82rem' }}>ℹ️ Legenda:</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.2rem', fontSize: '0.73rem', color: 'var(--color-text-muted)' }}>
              <p style={{ margin: 0 }}>• <strong>Desp. Pagas:</strong> O que a Loja já pagou ao irmão</p>
              <p style={{ margin: 0 }}>• <strong style={{ color: '#7c3aed' }}>Loja Deve:</strong> O que a Loja ainda deve ao irmão</p>
              <p style={{ margin: 0 }}>• <strong style={{ color: '#16a34a' }}>Rec. Pagas:</strong> O que o irmão já pagou à Loja</p>
              <p style={{ margin: 0 }}>• <strong style={{ color: '#ea580c' }}>Valor Devido:</strong> O que o irmão ainda deve à Loja</p>
            </div>
          </div>
        </div>

        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 1.5rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontWeight: '600', cursor: 'pointer' }}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
