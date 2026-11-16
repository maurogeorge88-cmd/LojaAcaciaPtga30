import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

const fmtR = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtData = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

const PASSOS = ['Seleção', 'Configuração', 'Confirmação'];

export default function ModalRenegociacao({ isOpen, onClose, irmaos, showSuccess, showError, onConcluido }) {
  const [passo, setPasso]           = useState(0);
  const [irmaoId, setIrmaoId]       = useState('');
  const [pendentes, setPendentes]   = useState([]);
  const [selecionados, setSelecionados] = useState({});
  const [loading, setLoading]       = useState(false);

  // Configuração
  const [modoCal, setModoCal]       = useState('parcelas'); // 'parcelas' | 'valor'
  const [nParcelas, setNParcelas]   = useState(6);
  const [valorParcela, setValorParcela] = useState('');
  const [dataPrimeira, setDataPrimeira] = useState('');
  const [diaVenc, setDiaVenc]       = useState(10);

  const [salvando, setSalvando]     = useState(false);

  useEffect(() => {
    if (!isOpen) { resetar(); }
  }, [isOpen]);

  useEffect(() => {
    if (irmaoId) buscarPendentes();
    else { setPendentes([]); setSelecionados({}); }
  }, [irmaoId]);

  const resetar = () => {
    setPasso(0); setIrmaoId(''); setPendentes([]); setSelecionados({});
    setModoCal('parcelas'); setNParcelas(6); setValorParcela('');
    setDataPrimeira(''); setDiaVenc(10);
  };

  const buscarPendentes = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('lancamentos_loja')
        .select('*, categorias_financeiras(nome, tipo)')
        .eq('origem_irmao_id', irmaoId)
        .eq('status', 'pendente')
        .order('data_vencimento');

      // Filtrar apenas receitas em JS (irmão deve à loja)
      const apenasDeve = (data || []).filter(l => l.categorias_financeiras?.tipo === 'receita');
      setPendentes(apenasDeve);
      // Marcar todos por padrão
      const sel = {};
      apenasDeve.forEach(l => sel[l.id] = true);
      setSelecionados(sel);
    } catch(e) {
      showError('Erro ao buscar pendentes: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSel = (id) => setSelecionados(s => ({ ...s, [id]: !s[id] }));
  const toggleTodos = () => {
    const todos = pendentes.every(l => selecionados[l.id]);
    const novo = {};
    pendentes.forEach(l => novo[l.id] = !todos);
    setSelecionados(novo);
  };

  const lancSelecionados = pendentes.filter(l => selecionados[l.id]);
  const totalSel = lancSelecionados.reduce((s, l) => s + Number(l.valor || 0), 0);

  // Calcular parcelas
  const calcParcelas = () => {
    if (!dataPrimeira || totalSel <= 0) return [];
    let qtd, valUnit;
    if (modoCal === 'parcelas') {
      qtd    = parseInt(nParcelas) || 1;
      valUnit = Math.round((totalSel / qtd) * 100) / 100;
    } else {
      valUnit = parseFloat(valorParcela) || 0;
      qtd     = valUnit > 0 ? Math.ceil(totalSel / valUnit) : 0;
    }
    if (qtd <= 0) return [];
    const parcelas = [];
    let [yy, mm] = dataPrimeira.split('-').map(Number);
    for (let i = 0; i < qtd; i++) {
      const ultimoDia = new Date(yy, mm, 0).getDate();
      const dia = Math.min(diaVenc, ultimoDia);
      const dtVenc = `${yy}-${String(mm).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
      // Última parcela absorve diferença de arredondamento
      const val = i === qtd - 1
        ? Math.round((totalSel - valUnit * (qtd - 1)) * 100) / 100
        : valUnit;
      parcelas.push({ num: i + 1, total: qtd, dtVenc, val });
      mm++;
      if (mm > 12) { mm = 1; yy++; }
    }
    return parcelas;
  };

  const parcelasBase = calcParcelas();

  // Grupos por categoria de origem (cada categoria mantém seu próprio valor)
  const grupos = (() => {
    const mapa = {};
    lancSelecionados.forEach(l => {
      const k = l.categoria_id;
      if (!mapa[k]) mapa[k] = { categoria_id: k, categoria: l.categorias_financeiras?.nome || 'Sem categoria', lancs: [], total: 0 };
      mapa[k].lancs.push(l);
      mapa[k].total += Number(l.valor || 0);
    });
    return Object.values(mapa).map(g => ({ ...g, total: Math.round(g.total * 100) / 100 }));
  })();

  const descricaoOrigem = (g) => {
    const descs = [...new Set(g.lancs.map(l => (l.descricao || '').trim()).filter(Boolean))];
    const txt = descs.join(' + ');
    return txt && txt.length <= 150 ? txt : `${g.categoria}${g.lancs.length > 1 ? ` (${g.lancs.length} lançamentos)` : ''}`;
  };

  // Divide cada parcela entre as categorias, proporcional ao total de cada uma.
  // Usa valores acumulados para que a soma de cada categoria feche exatamente.
  const linhas = (() => {
    const out = [];
    if (!parcelasBase.length || totalSel <= 0) return out;
    const acumAnt = {};
    let cumGeral = 0;
    parcelasBase.forEach(p => {
      cumGeral = Math.round((cumGeral + p.val) * 100) / 100;
      grupos.forEach(g => {
        const alvo = p.num === p.total ? g.total : Math.round(g.total * cumGeral / totalSel * 100) / 100;
        const val = Math.round((alvo - (acumAnt[g.categoria_id] || 0)) * 100) / 100;
        acumAnt[g.categoria_id] = alvo;
        out.push({ ...p, val, grupo: g, descricao: `Parc ${p.num}/${p.total} - ${descricaoOrigem(g)}` });
      });
    });
    return out;
  })();

  // Total de cada parcela (soma das categorias)
  const parcelas = parcelasBase.map(p => ({ ...p, val: Math.round(linhas.filter(x => x.num === p.num).reduce((a, x) => a + x.val, 0) * 100) / 100 }));
  const qtdParcelas = parcelas.length;

  const observacaoOrigem = (g) => {
    const hoje = new Date();
    const dh = `${String(hoje.getDate()).padStart(2,'0')}/${String(hoje.getMonth()+1).padStart(2,'0')}/${hoje.getFullYear()}`;
    const itens = g.lancs.map(l => `${(l.descricao || g.categoria).trim()} (venc. ${fmtData(l.data_vencimento)}) ${fmtR(l.valor)}`).join('; ');
    return `Renegociado em ${dh}. Origem: ${g.categoria} - ${itens}. Total original: ${fmtR(g.total)}.`;
  };

  const confirmar = async () => {
    if (!parcelas.length) { showError('Configure as parcelas corretamente.'); return; }
    setSalvando(true);
    try {
      // 2. Excluir lançamentos selecionados
      const ids = lancSelecionados.map(l => l.id);
      const { error: errDel } = await supabase
        .from('lancamentos_loja')
        .delete()
        .in('id', ids);
      if (errDel) throw errDel;

      // 3. Inserir parcelas com todos os campos obrigatórios
      const hoje2 = new Date();
      const hojeISO = hoje2.getFullYear() + '-' + String(hoje2.getMonth()+1).padStart(2,'0') + '-' + String(hoje2.getDate()).padStart(2,'0');
      const inserts = linhas.map(p => ({
        tipo:            'receita',
        categoria_id:    p.grupo.categoria_id,
        origem_irmao_id: parseInt(irmaoId),
        origem_tipo:     'Irmao',
        descricao:       p.descricao,
        observacoes:     observacaoOrigem(p.grupo),
        valor:           p.val,
        status:          'pendente',
        data_lancamento: hojeISO,
        data_vencimento: p.dtVenc,
        tipo_pagamento:  'pix',
        eh_parcelado:    true,
        parcela_numero:  p.num,
        parcela_total:   p.total,
      }));
      const { error: errIns } = await supabase.from('lancamentos_loja').insert(inserts);
      if (errIns) throw errIns;

      showSuccess(`✅ ${ids.length} lançamentos excluídos e ${inserts.length} lançamentos de parcela criados!`);
      onConcluido?.();
      onClose();
    } catch(e) {
      showError('Erro ao renegociar: ' + e.message);
    } finally {
      setSalvando(false);
    }
  };

  if (!isOpen) return null;

  const sInp = { background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem', fontSize: '0.875rem', width: '100%' };
  const sTh  = { padding: '0.4rem 0.6rem', fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--color-border)', textAlign: 'left' };
  const sTd  = { padding: '0.45rem 0.6rem', fontSize: '0.82rem', borderBottom: '1px solid var(--color-border)' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '720px', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>

        {/* Header */}
        <div style={{ background: '#7c3aed', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ color: '#fff', fontWeight: '800', fontSize: '1.1rem', margin: 0 }}>🔄 Renegociar Dívida</h2>
            <p style={{ color: 'rgba(255,255,255,0.75)', margin: '0.2rem 0 0', fontSize: '0.78rem' }}>
              Passo {passo + 1} de 3 — {PASSOS[passo]}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '50%', width: '2rem', height: '2rem', fontSize: '1.2rem', fontWeight: '700', cursor: 'pointer' }}>×</button>
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
          {PASSOS.map((p, i) => (
            <div key={i} style={{ flex: 1, padding: '0.5rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: '700', color: i === passo ? '#7c3aed' : i < passo ? '#16a34a' : 'var(--color-text-muted)', borderBottom: i === passo ? '2px solid #7c3aed' : '2px solid transparent' }}>
              {i < passo ? '✓ ' : ''}{p}
            </div>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>

          {/* ── PASSO 1: SELEÇÃO ─────────────────────────────────────────── */}
          {passo === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Irmão *</label>
                <select value={irmaoId} onChange={e => setIrmaoId(e.target.value)} style={sInp}>
                  <option value="">-- Selecionar irmão --</option>
                  {[...irmaos].sort((a,b) => a.nome.localeCompare(b.nome)).map(i => (
                    <option key={i.id} value={i.id}>{i.nome}</option>
                  ))}
                </select>
              </div>

              {irmaoId && loading && <p style={{ color: 'var(--color-text-muted)', textAlign: 'center' }}>Buscando pendentes...</p>}

              {irmaoId && !loading && pendentes.length === 0 && (
                <div style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)', borderRadius: 'var(--radius-lg)', padding: '1rem', textAlign: 'center', color: '#16a34a', fontWeight: '600' }}>
                  ✅ Este irmão não possui pendências.
                </div>
              )}

              {pendentes.length > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{pendentes.length} lançamento(s) pendente(s)</span>
                    <button onClick={toggleTodos} style={{ fontSize: '0.78rem', color: '#7c3aed', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}>
                      {pendentes.every(l => selecionados[l.id]) ? 'Desmarcar todos' : 'Marcar todos'}
                    </button>
                  </div>

                  <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--color-surface-2)' }}>
                          <th style={{ ...sTh, width: '36px', textAlign: 'center' }}>
                            <input type="checkbox" checked={pendentes.every(l => selecionados[l.id])} onChange={toggleTodos} />
                          </th>
                          <th style={sTh}>Vencimento</th>
                          <th style={sTh}>Categoria</th>
                          <th style={sTh}>Descrição</th>
                          <th style={{ ...sTh, textAlign: 'right' }}>Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendentes.map((l, i) => (
                          <tr key={l.id} style={{ background: selecionados[l.id] ? 'rgba(124,58,237,0.05)' : 'var(--color-surface)', cursor: 'pointer' }} onClick={() => toggleSel(l.id)}>
                            <td style={{ ...sTd, textAlign: 'center' }}>
                              <input type="checkbox" checked={!!selecionados[l.id]} onChange={() => toggleSel(l.id)} onClick={e => e.stopPropagation()} />
                            </td>
                            <td style={{ ...sTd, color: 'var(--color-text-muted)' }}>{fmtData(l.data_vencimento)}</td>
                            <td style={{ ...sTd, color: 'var(--color-text-muted)' }}>{l.categorias_financeiras?.nome || '—'}</td>
                            <td style={{ ...sTd, color: 'var(--color-text)' }}>{l.descricao}</td>
                            <td style={{ ...sTd, textAlign: 'right', fontWeight: '700', color: '#dc2626' }}>{fmtR(l.valor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Total selecionado */}
                  <div style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 'var(--radius-lg)', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '700', color: '#7c3aed' }}>{lancSelecionados.length} lançamento(s) selecionado(s)</span>
                    <span style={{ fontWeight: '800', fontSize: '1.1rem', color: '#7c3aed' }}>{fmtR(totalSel)}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── PASSO 2: CONFIGURAÇÃO ────────────────────────────────────── */}
          {passo === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Total a renegociar */}
              <div style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 'var(--radius-lg)', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#7c3aed', fontWeight: '700' }}>Total a renegociar</span>
                <span style={{ color: '#7c3aed', fontWeight: '800', fontSize: '1.1rem' }}>{fmtR(totalSel)}</span>
              </div>

              {/* Modo de cálculo */}
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Calcular por</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {[['parcelas','Número de Parcelas'],['valor','Valor da Parcela']].map(([v,l]) => (
                    <button key={v} onClick={() => setModoCal(v)}
                      style={{ flex: 1, padding: '0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', background: modoCal === v ? '#7c3aed' : 'var(--color-surface-2)', color: modoCal === v ? '#fff' : 'var(--color-text)', borderColor: modoCal === v ? '#7c3aed' : 'var(--color-border)' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Número de parcelas ou valor */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {modoCal === 'parcelas' ? (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Número de Parcelas *</label>
                    <input type="number" min="1" max="60" value={nParcelas} onChange={e => setNParcelas(e.target.value)} style={sInp} />
                    {nParcelas > 0 && totalSel > 0 && (
                      <p style={{ margin: '0.3rem 0 0', fontSize: '0.72rem', color: '#7c3aed' }}>
                        = {fmtR(totalSel / nParcelas)} por parcela
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Valor da Parcela (R$) *</label>
                    <input type="number" min="1" step="0.01" value={valorParcela} onChange={e => setValorParcela(e.target.value)} placeholder="0,00" style={sInp} />
                    {valorParcela > 0 && totalSel > 0 && (
                      <p style={{ margin: '0.3rem 0 0', fontSize: '0.72rem', color: '#7c3aed' }}>
                        = {Math.ceil(totalSel / valorParcela)} parcela(s)
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Dia de Vencimento *</label>
                  <input type="number" min="1" max="31" value={diaVenc} onChange={e => setDiaVenc(parseInt(e.target.value))} style={sInp} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Data da Primeira Parcela *</label>
                <input type="date" value={dataPrimeira} onChange={e => setDataPrimeira(e.target.value)} style={{ ...sInp, width: '50%' }} />
              </div>

              {/* Preview das parcelas */}
              {parcelas.length > 0 && (
                <div>
                  <p style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', margin: '0 0 0.5rem' }}>
                    Preview — {parcelas.length} parcela(s){grupos.length > 1 ? ` × ${grupos.length} categorias` : ''}
                  </p>
                  <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', maxHeight: '260px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--color-surface-2)' }}>
                          <th style={sTh}>Parcela</th>
                          <th style={sTh}>Vencimento</th>
                          <th style={sTh}>Categoria</th>
                          <th style={sTh}>Descrição</th>
                          <th style={{ ...sTh, textAlign: 'right' }}>Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {linhas.map((p, idx) => (
                          <tr key={idx} style={{ background: p.num % 2 === 0 ? 'var(--color-surface-2)' : 'var(--color-surface)' }}>
                            <td style={{ ...sTd, color: '#7c3aed', fontWeight: '700' }}>{p.num}/{p.total}</td>
                            <td style={{ ...sTd, color: 'var(--color-text-muted)' }}>{fmtData(p.dtVenc)}</td>
                            <td style={{ ...sTd, color: 'var(--color-text-muted)' }}>{p.grupo.categoria}</td>
                            <td style={{ ...sTd, color: 'var(--color-text)' }}>{p.descricao}</td>
                            <td style={{ ...sTd, textAlign: 'right', fontWeight: '700', color: '#7c3aed' }}>{fmtR(p.val)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── PASSO 3: CONFIRMAÇÃO ─────────────────────────────────────── */}
          {passo === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 'var(--radius-lg)', padding: '1rem' }}>
                <p style={{ margin: '0 0 0.5rem', fontWeight: '700', color: '#dc2626', fontSize: '0.9rem' }}>⚠️ Atenção — Ação Irreversível</p>
                <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                  Os lançamentos abaixo serão <strong>excluídos permanentemente</strong> e substituídos pelas novas parcelas.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '0.85rem', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 0.3rem', fontSize: '0.7rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Lançamentos excluídos</p>
                  <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: '#dc2626' }}>{lancSelecionados.length}</p>
                </div>
                <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '0.85rem', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 0.3rem', fontSize: '0.7rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Lançamentos de parcela</p>
                  <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: '#7c3aed' }}>{linhas.length}</p>
                </div>
                <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '0.85rem', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 0.3rem', fontSize: '0.7rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Valor por parcela</p>
                  <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: '#7c3aed' }}>{fmtR(parcelas[0]?.val || 0)}</p>
                </div>
                <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '0.85rem', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 0.3rem', fontSize: '0.7rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Total renegociado</p>
                  <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: '#7c3aed' }}>{fmtR(totalSel)}</p>
                </div>
              </div>

              <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '0.75rem 1rem' }}>
                <p style={{ margin: '0 0 0.4rem', fontSize: '0.78rem', fontWeight: '700', color: 'var(--color-text-muted)' }}>Categorias de origem mantidas:</p>
                <ul style={{ margin: '0 0 0.5rem', paddingLeft: '1.1rem', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                  {grupos.map(g => <li key={g.categoria_id}><span style={{ color: '#7c3aed', fontWeight: 700 }}>{g.categoria}</span> — {fmtR(g.total)}</li>)}
                </ul>
                <p style={{ margin: '0 0 0.4rem', fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>Os valores originais ficam registrados em Obs. de cada parcela.</p>
                <p style={{ margin: '0 0 0.4rem', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                  Vencimento: todo dia <strong>{diaVenc}</strong>, a partir de <strong>{fmtData(dataPrimeira)}</strong>
                </p>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                  Última parcela: <strong>{fmtData(parcelas[parcelas.length - 1]?.dtVenc)}</strong>
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--color-border)', display: 'flex', gap: '0.5rem', justifyContent: 'space-between' }}>
          <button onClick={passo === 0 ? onClose : () => setPasso(p => p - 1)}
            style={{ padding: '0.6rem 1.25rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontWeight: '600', cursor: 'pointer' }}>
            {passo === 0 ? 'Cancelar' : '← Voltar'}
          </button>

          {passo < 2 && (
            <button
              disabled={
                (passo === 0 && lancSelecionados.length === 0) ||
                (passo === 1 && parcelas.length === 0)
              }
              onClick={() => setPasso(p => p + 1)}
              style={{ padding: '0.6rem 1.5rem', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: '700', cursor: 'pointer', opacity: ((passo === 0 && lancSelecionados.length === 0) || (passo === 1 && parcelas.length === 0)) ? 0.5 : 1 }}>
              Próximo →
            </button>
          )}

          {passo === 2 && (
            <button onClick={confirmar} disabled={salvando}
              style={{ padding: '0.6rem 1.5rem', background: salvando ? '#9ca3af' : '#7c3aed', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: '700', cursor: salvando ? 'not-allowed' : 'pointer' }}>
              {salvando ? 'Salvando...' : '✅ Confirmar Renegociação'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
