import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { calcularAptidaoVoto } from '../../utils/calcularAptidaoVoto';
import { gerarAptosVotarPDF } from '../../utils/gerarAptosVotarPDF';
import { gerarAtaSessao, gerarEditalEleicaoGLEMT, gerarListaPresencaEleicaoGLEMT } from '../../utils/gerarAtaSessao';
import { LOGO_LOJA_B64 } from '../../utils/logoLoja';

// ════════════════════════════════════════════════════════════════════════
// Eleição da GLEMT — modal do balaustre
// Abas: Configuração · Aptos e Presença · Apuração · Documentos
// Os dados ficam em balaustres.eleicao_glemt (jsonb).
// ════════════════════════════════════════════════════════════════════════

const ROXO = '#8b5cf6';
const fmt = (d) => (d ? String(d).substring(0, 10).split('-').reverse().join('/') : '');
const menos15 = (iso) => { if (!iso) return ''; const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() - 15); return d.toISOString().substring(0, 10); };
const VAZIA = () => {
  const ano = new Date().getFullYear() + 1;
  return { ativo: true, status: 'realizada', ano_inicio: ano, ano_fim: ano + 3, data_edital: '',
    chapas: [{ nome: '', gm: '', gm_adjunto: '', votos: '' }, { nome: '', gm: '', gm_adjunto: '', votos: '' }],
    brancos: '', nulos: '', votantes: '', escrutinador1_id: '', escrutinador2_id: '', presentes: [], aptidao_ajustes: {}, bloquear_inaptos: false };
};

export default function EleicaoGLEMTModal({ balaustre, podeEditar, onClose, onSaved, onMarcarRealizada, showSuccess, showError }) {
  const [aba, setAba] = useState('config');
  const [el, setElState] = useState(() => ({ ...VAZIA(), ...(balaustre.eleicao_glemt || {}) }));
  const [alterado, setAlterado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [irmaos, setIrmaos] = useState([]);
  const [apt, setApt] = useState({ carregando: true, linhas: [], periodo: '', dadosLoja: {}, assinantes: {} });
  const [filtro, setFiltro] = useState('todos');
  const [gerando, setGerando] = useState('');

  const setEl = (campos) => { setElState(e => ({ ...e, ...campos })); setAlterado(true); };
  const setChapa = (i, campos) => setEl({ chapas: el.chapas.map((c, k) => (k === i ? { ...c, ...campos } : c)) });
  const pendente = el.status === 'pendente';
  const ref = balaustre.data_sessao;
  const balaustreAtual = { ...balaustre, eleicao_glemt: el };

  // ── Carrega irmãos + aptidão (período desde a última eleição GLEMT de outro mandato, ou 12 meses) ──
  useEffect(() => {
    (async () => {
      try {
        const { data: ir } = await supabase.from('irmaos').select('id, nome, cim, situacao, data_exaltacao, data_falecimento, data_nascimento, data_desligamento');
        setIrmaos(ir || []);
        const { data: ant } = await supabase.from('balaustres').select('id, data_sessao, eleicao_glemt')
          .lt('data_sessao', ref).not('eleicao_glemt', 'is', null).order('data_sessao', { ascending: false });
        const anterior = (ant || []).find(b => b.eleicao_glemt?.ativo && b.id !== balaustre.id && b.eleicao_glemt.status !== 'pendente'
          && String(b.eleicao_glemt.ano_inicio || '') !== String(el.ano_inicio || ''));
        const ini = anterior ? anterior.data_sessao : (() => { const d = new Date(ref + 'T00:00:00'); d.setFullYear(d.getFullYear() - 1); return d.toISOString().substring(0, 10); })();
        const linhas = await calcularAptidaoVoto({ ref, ini, irmaos: ir || [], ajustes: {} });
        const ano = String(ref).substring(0, 4);
        const [{ data: lojaData }, { data: corpo }] = await Promise.all([
          supabase.from('dados_loja').select('*').limit(1),
          supabase.from('corpo_administrativo').select('cargo, ano_exercicio, irmao_id'),
        ]);
        const norm = (c) => String(c || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
        const nomeCargo = (...alvos) => {
          const r = (corpo || []).find(c => String(c.ano_exercicio || '').split(/[^0-9]+/).includes(ano) && alvos.includes(norm(c.cargo)));
          return r ? (ir || []).find(x => x.id === r.irmao_id)?.nome : null;
        };
        const hoje = new Date().toISOString().substring(0, 10);
        setApt({ carregando: false, linhas, dadosLoja: (lojaData && lojaData[0]) || {},
          periodo: `${anterior ? 'desde a última eleição GLEMT' : 'últimos 12 meses'}: ${fmt(ini)} a ${fmt(ref < hoje ? ref : hoje)}`,
          assinantes: { vm: nomeCargo('veneravel mestre', 'veneravel'), chanceler: nomeCargo('chanceler'), tesoureiro: nomeCargo('tesoureiro') } });
      } catch (e) {
        setApt(a => ({ ...a, carregando: false }));
        showError('Erro ao analisar a aptidão: ' + e.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Aptidão com os ajustes manuais deste balaustre
  const linhas = apt.linhas.map(l => {
    const aj = (el.aptidao_ajustes || {})[String(l.irmao.id)];
    return { ...l, ajuste: aj, apto: aj ? aj.status === 'apto' : l.aptoAuto };
  });
  const aptos = linhas.filter(l => l.apto);
  const inaptos = linhas.filter(l => !l.apto);
  const pres = (el.presentes || []).map(String);

  const salvar = async (silencioso = false) => {
    setSalvando(true);
    try {
      const { data, error } = await supabase.from('balaustres').update({ eleicao_glemt: el }).eq('id', balaustre.id).select();
      if (error) throw error;
      if (!data?.length) throw new Error('o banco não permitiu a alteração (sem permissão).');
      setAlterado(false);
      if (!silencioso) showSuccess('✅ Eleição GLEMT salva.');
      onSaved?.();
    } catch (e) {
      showError('Erro ao salvar: ' + e.message);
    } finally {
      setSalvando(false);
    }
  };

  const ajustar = (l) => {
    const atuais = { ...(el.aptidao_ajustes || {}) };
    if (l.ajuste) delete atuais[String(l.irmao.id)];
    else {
      const just = window.prompt(`Tornar ${l.nomeCurto} APTO a votar.\nInforme a justificativa:`);
      if (!just || !just.trim()) return;
      atuais[String(l.irmao.id)] = { status: 'apto', justificativa: just.trim(), em: new Date().toISOString() };
    }
    setEl({ aptidao_ajustes: atuais });
  };
  const togglePresente = (l) => {
    const id = String(l.irmao.id);
    if (!pres.includes(id) && el.bloquear_inaptos && !l.apto) { showError(`${l.nomeCurto} está inapto (presença bloqueada).`); return; }
    setEl({ presentes: pres.includes(id) ? pres.filter(x => x !== id) : [...pres, id] });
  };

  // ── PDFs (gerados na hora do clique) ──
  const periodoTxt = el.ano_inicio && el.ano_fim ? `${el.ano_inicio}/${el.ano_fim}` : '';
  const pdf = (tipo) => {
    const lista = tipo === 'inaptos' ? inaptos : aptos;
    if (tipo !== 'ambos' && !lista.length) { showError(tipo === 'inaptos' ? 'Nenhum irmão inapto.' : 'Nenhum irmão apto.'); return; }
    gerarAptosVotarPDF({
      tipo, linhas: lista, linhasInaptos: inaptos, eleicao: {}, dadosLoja: apt.dadosLoja, logoB64: LOGO_LOJA_B64, periodo: apt.periodo, assinantes: apt.assinantes,
      glemt: { periodo: periodoTxt, dataSessao: ref },
      nomeArquivo: `${tipo === 'ambos' ? 'Aptos_e_Inaptos' : tipo === 'inaptos' ? 'Inaptos' : 'Aptos'}_a_Votar_GLEMT_${periodoTxt.replace('/', '-')}.pdf`,
    });
  };
  // ── Word (edital, lista, ata) — usa os dados da tela (salva em seguida, se houver alteração) ──
  const word = async (qual) => {
    setGerando(qual);
    try {
      if (qual === 'edital') { const r = await gerarEditalEleicaoGLEMT({ balaustre: balaustreAtual }); if (r?.faltando?.length) showError(`Falta no Corpo Administrativo: ${r.faltando.join(', ')}.`); }
      if (qual === 'lista') await gerarListaPresencaEleicaoGLEMT({ balaustre: balaustreAtual });
      if (qual === 'ata') {
        if (pendente) { showError('Sessão pendente: marque como realizada para numerar o balaustre e gerar a ata.'); return; }
        const r = await gerarAtaSessao({ balaustre: balaustreAtual });
        if (r?.faltando?.length) showError(`Falta no Corpo Administrativo: ${r.faltando.join(', ')}.`);
      }
      if (alterado && podeEditar) salvar(true);
    } catch (e) {
      showError('Erro ao gerar: ' + e.message);
    } finally {
      setGerando('');
    }
  };

  // ── estilos ──
  const inp = { width: '100%', padding: '0.5rem 0.65rem', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', fontSize: '0.85rem', boxSizing: 'border-box' };
  const lab = { fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' };
  const card = { border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '0.85rem', background: 'var(--color-surface)' };
  const btn = (cor, fundo) => ({ padding: '0.45rem 0.9rem', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', border: `1px solid ${cor}`, background: fundo || 'transparent', color: cor });
  const g2 = { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '0.6rem' };
  const mestres = irmaos.filter(i => String(i.situacao || 'regular').toLowerCase() === 'regular' && i.data_exaltacao && !i.data_falecimento).sort((a, b) => a.nome.localeCompare(b.nome));

  const ABAS = [['config', '⚙️ Configuração'], ['aptos', '🗳️ Aptos e Presença'], ['apuracao', '📊 Apuração'], ['docs', '📄 Documentos']];
  const num = (v) => Number(v) || 0;
  const totalVotos = (el.chapas || []).reduce((t, c) => t + num(c.votos), 0) + num(el.brancos) + num(el.nulos);
  const vencedora = [...(el.chapas || [])].map((c, i) => ({ ...c, i })).filter(c => c.nome || c.gm).sort((a, b) => num(b.votos) - num(a.votos))[0];

  // Cartão compacto (2 linhas):
  //  1) ☐ presença · Nome (dois nomes) · ★ · Lic
  //  2) Tesouraria: OK/Pendência | Presença: %   — o selo Apto/Inapto vai na cor da borda (clique no cartão inapto/ajustado para ajustar)
  const cardIrmao = (l) => {
    const presente = pres.includes(String(l.irmao.id));
    const podeAjustar = podeEditar && (l.ajuste || !l.aptoAuto);
    const corBorda = presente ? 'rgba(16,185,129,0.7)' : l.apto ? 'var(--color-border)' : 'rgba(239,68,68,0.45)';
    return (
      <div key={l.irmao.id} style={{ border: `1px solid ${corBorda}`, borderRadius: 'var(--radius-md)', padding: '0.3rem 0.5rem',
        background: presente ? 'rgba(16,185,129,0.08)' : 'var(--color-surface-2)', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', minWidth: 0 }}>
          <input type="checkbox" checked={presente} disabled={!podeEditar} onChange={() => togglePresente(l)} title="Presente na sessão" style={{ flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }} title={l.nome}>{l.nomeCurto}</span>
          {l.isento70 && <span title="Prerrogativa por idade: presença dispensada" style={{ color: '#facc15', fontSize: '0.8rem', flexShrink: 0 }}>★</span>}
          {l.licenca && <span title="Licenciado na data da eleição" style={{ fontSize: '0.58rem', color: '#d97706', fontWeight: 800, flexShrink: 0 }}>Lic</span>}
          {l.ajuste && <span title={`Tornado apto: ${l.ajuste.justificativa}`} style={{ fontSize: '0.7rem', flexShrink: 0 }}>✏️</span>}
        </div>
        <div onClick={() => podeAjustar && ajustar(l)}
          title={l.ajuste ? `Ajustado: ${l.ajuste.justificativa} (clique para desfazer)` : l.apto ? `CIM ${l.cim || '—'}` : `${l.motivos} — clique para tornar apto`}
          style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginTop: '0.1rem', paddingLeft: '1.3rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: podeAjustar ? 'pointer' : 'default' }}>
          <span style={{ color: l.finOk ? '#10b981' : '#ef4444', fontWeight: 700 }}>Tesouraria: {l.finOk ? 'OK' : 'Pendência'}</span>
          {' | '}
          <span style={{ color: l.presOk ? '#10b981' : '#ef4444', fontWeight: 700 }}>Presença: {l.isento70 ? 'Disp.' : `${l.pct}%`}</span>
        </div>
      </div>
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '1100px', maxHeight: '94vh', display: 'flex', flexDirection: 'column' }}>
        {/* Cabeçalho */}
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, flex: 1, fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)' }}>
            🗳️ Eleição GLEMT — {pendente ? '⏳ Pendente' : `Balaústre nº ${balaustre.numero_balaustre}/${balaustre.ano_balaustre}`}
            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}> · sessão de {fmt(ref)}{periodoTxt ? ` · Período ${periodoTxt}` : ''}</span>
          </h3>
          {podeEditar && (
            <button onClick={() => salvar()} disabled={salvando || !alterado} style={{ ...btn('#fff', ROXO), opacity: alterado ? 1 : 0.5 }}>
              {salvando ? 'Salvando…' : '💾 Salvar'}
            </button>
          )}
          <button onClick={() => { if (!alterado || window.confirm('Há alterações não salvas. Fechar mesmo assim?')) onClose(); }} style={btn('var(--color-text-muted)')}>✕ Fechar</button>
        </div>
        {/* Abas */}
        <div style={{ display: 'flex', gap: '0.25rem', padding: '0.6rem 1.25rem 0', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
          {ABAS.map(([k, l]) => (
            <button key={k} onClick={() => setAba(k)}
              style={{ padding: '0.5rem 0.9rem', border: 'none', borderBottom: `3px solid ${aba === k ? ROXO : 'transparent'}`, background: 'transparent', cursor: 'pointer',
                fontWeight: 700, fontSize: '0.85rem', color: aba === k ? ROXO : 'var(--color-text-muted)' }}>{l}</button>
          ))}
        </div>

        <div style={{ padding: '1rem 1.25rem', overflowY: 'auto', flex: 1 }}>
          {/* ── 1. Configuração ── */}
          {aba === 'config' && (
            <fieldset disabled={!podeEditar} style={{ border: 'none', margin: 0, padding: 0, minWidth: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={card}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: '0.6rem', alignItems: 'end' }}>
                  <div><label style={lab}>Período — de</label>
                    <input type="number" style={inp} value={el.ano_inicio || ''} onChange={e => { const v = parseInt(e.target.value) || ''; setEl({ ano_inicio: v, ano_fim: v ? v + 3 : el.ano_fim }); }} /></div>
                  <div><label style={lab}>até</label>
                    <input type="number" style={inp} value={el.ano_fim || ''} onChange={e => setEl({ ano_fim: parseInt(e.target.value) || '' })} /></div>
                  <div><label style={lab}>Data do edital</label>
                    <input type="date" style={inp} value={el.data_edital || ''} onChange={e => setEl({ data_edital: e.target.value })} /></div>
                  <div>
                    <label style={lab}>Status</label>
                    {pendente ? (
                      <button type="button" onClick={async () => { if (alterado) await salvar(true); onMarcarRealizada?.(balaustreAtual); }}
                        style={{ ...btn('#10b981', 'rgba(16,185,129,0.12)'), width: '100%' }}>✅ Marcar como realizada</button>
                    ) : <div style={{ ...inp, color: '#10b981', fontWeight: 700 }}>✅ Realizada</div>}
                  </div>
                </div>
                {(() => {
                  const de = el.data_edital || menos15(ref);
                  if (!de || !ref) return null;
                  const dias = Math.round((new Date(ref + 'T00:00:00') - new Date(de + 'T00:00:00')) / 86400000);
                  return <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: dias < 15 ? '#ef4444' : 'var(--color-text-muted)', fontWeight: dias < 15 ? 700 : 400 }}>
                    {el.data_edital ? '' : `Sem data informada: o edital usa ${fmt(de)} (15 dias antes). `}
                    {dias < 15 ? `⚠️ O edital está a ${dias} dia(s) da sessão — o mínimo é 15.` : `Edital ${dias} dias antes da sessão.`}
                  </p>;
                })()}
              </div>

              <div style={card}>
                <strong style={{ fontSize: '0.85rem', color: ROXO }}>Escrutinadores</strong>
                <div style={{ ...g2, marginTop: '0.5rem' }}>
                  {['escrutinador1_id', 'escrutinador2_id'].map((k, i) => (
                    <div key={k}><label style={lab}>Escrutinador {i + 1}</label>
                      <select style={inp} value={el[k] || ''} onChange={e => setEl({ [k]: e.target.value })}>
                        <option value="">Selecione...</option>
                        {mestres.filter(m => String(m.id) !== String(i ? el.escrutinador1_id : el.escrutinador2_id)).map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                      </select></div>
                  ))}
                </div>
              </div>

              <div style={card}>
                <strong style={{ fontSize: '0.85rem', color: ROXO }}>Chapas e candidatos</strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.6rem', marginTop: '0.5rem' }}>
                  {(el.chapas || []).map((c, i) => (
                    <div key={i} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.6rem', background: 'var(--color-surface-2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                        <strong style={{ fontSize: '0.8rem', color: ROXO }}>Chapa {i + 1}</strong>
                        {i >= 2 && <button type="button" onClick={() => setEl({ chapas: el.chapas.filter((_, k) => k !== i) })}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>✕ Remover</button>}
                      </div>
                      <label style={lab}>Nome da chapa</label>
                      <input style={inp} value={c.nome || ''} onChange={e => setChapa(i, { nome: e.target.value })} />
                      <div style={{ marginTop: '0.4rem' }}>
                        <label style={lab}>Grão-Mestre</label>
                        <input style={inp} value={c.gm || ''} onChange={e => setChapa(i, { gm: e.target.value })} />
                      </div>
                      <div style={{ marginTop: '0.4rem' }}>
                        <label style={lab}>Grão-Mestre Adjunto</label>
                        <input style={inp} value={c.gm_adjunto || ''} onChange={e => setChapa(i, { gm_adjunto: e.target.value })} />
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setEl({ chapas: [...(el.chapas || []), { nome: '', gm: '', gm_adjunto: '', votos: '' }] })}
                  style={{ ...btn(ROXO), marginTop: '0.6rem', borderStyle: 'dashed' }}>➕ Adicionar chapa</button>
              </div>
            </div>
            </fieldset>
          )}

          {/* ── 2. Aptos e Presença ── */}
          {aba === 'aptos' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '0.6rem' }}>
                {[['✅ Aptos', aptos.length, '#10b981'], ['⛔ Inaptos', inaptos.length, '#ef4444'], ['🖊️ Presentes', pres.length, ROXO]].map(([t, v, c]) => (
                  <div key={t} style={{ ...card, borderTop: `3px solid ${c}`, padding: '0.6rem 0.85rem' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{t}</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: c }}>{apt.carregando ? '…' : v}</div>
                  </div>
                ))}
              </div>
              <div style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                {[['todos', 'Todos'], ['aptos', 'Aptos'], ['inaptos', 'Inaptos'], ['presentes', 'Presentes']].map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setFiltro(k)}
                    style={{ ...btn(filtro === k ? ROXO : 'var(--color-text-muted)', filtro === k ? 'rgba(139,92,246,0.12)' : 'transparent'), padding: '0.3rem 0.75rem', borderRadius: '999px' }}>{l}</button>
                ))}
                <span style={{ flex: 1 }} />
                <button type="button" disabled={!podeEditar} onClick={() => setEl({ presentes: (el.bloquear_inaptos ? aptos : linhas).map(l => String(l.irmao.id)) })} style={btn('var(--color-text-muted)')}>Marcar todos</button>
                <button type="button" disabled={!podeEditar} onClick={() => setEl({ presentes: [] })} style={btn('var(--color-text-muted)')}>Limpar presença</button>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--color-text)' }}>
                  <input type="checkbox" disabled={!podeEditar} checked={!!el.bloquear_inaptos} onChange={e => setEl({ bloquear_inaptos: e.target.checked })} />
                  Bloquear presença dos inaptos
                </label>
              </div>
              <div style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.8rem', color: 'var(--color-text)', marginRight: '0.25rem' }}>Relatórios:</strong>
                <button type="button" disabled={apt.carregando} onClick={() => pdf('aptos')} style={btn('#10b981', 'rgba(16,185,129,0.1)')}>📄 PDF Aptos</button>
                <button type="button" disabled={apt.carregando} onClick={() => pdf('inaptos')} style={btn('#ef4444', 'rgba(239,68,68,0.1)')}>📄 PDF Inaptos</button>
                <button type="button" disabled={apt.carregando} onClick={() => pdf('ambos')} style={btn(ROXO, 'rgba(139,92,246,0.1)')}>📄 PDF Aptos e Inaptos</button>
                <button type="button" disabled={!!gerando} onClick={() => word('lista')} style={btn('var(--color-text)')}>{gerando === 'lista' ? '⏳' : '📋'} Lista de Presença (Word)</button>
              </div>
              <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                Regras: tesouraria com no máximo 2 meses em aberto e presença mínima de 50% — período {apt.periodo || '…'}.
                <span style={{ color: '#facc15' }}> ★</span> prerrogativa por idade · Lic = licenciado · clique no selo Inapto para tornar apto (com justificativa).
              </p>
              {apt.carregando ? <p style={{ color: 'var(--color-text-muted)' }}>Analisando tesouraria e presença…</p> : (() => {
                const vis = filtro === 'aptos' ? aptos : filtro === 'inaptos' ? inaptos : filtro === 'presentes' ? linhas.filter(l => pres.includes(String(l.irmao.id))) : null;
                const grade = (lista) => <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: '0.35rem' }}>{lista.map(cardIrmao)}</div>;
                if (vis) return grade(vis);
                return (
                  <>
                    <div style={{ ...card, borderLeft: '4px solid #10b981' }}>
                      <strong style={{ fontSize: '0.85rem', color: '#10b981' }}>✅ Irmãos Aptos ({aptos.length})</strong>
                      <div style={{ marginTop: '0.5rem' }}>{grade(aptos)}</div>
                    </div>
                    <div style={{ ...card, borderLeft: '4px solid #ef4444' }}>
                      <strong style={{ fontSize: '0.85rem', color: '#ef4444' }}>⛔ Irmãos Inaptos ({inaptos.length})</strong>
                      <div style={{ marginTop: '0.5rem' }}>{grade(inaptos)}</div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* ── 3. Apuração ── */}
          {aba === 'apuracao' && (
            <fieldset disabled={!podeEditar} style={{ border: 'none', margin: 0, padding: 0, minWidth: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={card}>
                <strong style={{ fontSize: '0.85rem', color: ROXO }}>Votos por chapa</strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.6rem', marginTop: '0.5rem' }}>
                  {(el.chapas || []).map((c, i) => (
                    <div key={i}><label style={lab}>Chapa {i + 1}{c.nome ? ` – ${c.nome}` : ''}</label>
                      <input type="number" min="0" style={inp} value={c.votos ?? ''} onChange={e => setChapa(i, { votos: e.target.value })} /></div>
                  ))}
                </div>
              </div>
              <div style={card}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '0.6rem' }}>
                  <div><label style={lab}>Votos em branco</label><input type="number" min="0" style={inp} value={el.brancos ?? ''} onChange={e => setEl({ brancos: e.target.value })} /></div>
                  <div><label style={lab}>Votos nulos</label><input type="number" min="0" style={inp} value={el.nulos ?? ''} onChange={e => setEl({ nulos: e.target.value })} /></div>
                  <div><label style={lab}>Total de votantes</label><input type="number" min="0" style={inp} value={el.votantes ?? ''} placeholder={String(totalVotos || pres.length)} onChange={e => setEl({ votantes: e.target.value })} /></div>
                </div>
                <p style={{ margin: '0.6rem 0 0', fontSize: '0.8rem', color: 'var(--color-text)' }}>
                  Soma dos votos: <strong>{totalVotos}</strong> · Presentes marcados: <strong>{pres.length}</strong>
                  {vencedora && num(vencedora.votos) > 0 && <> · Mais votada: <strong style={{ color: '#10b981' }}>Chapa {vencedora.i + 1} – {vencedora.nome}</strong></>}
                </p>
                {totalVotos > 0 && pres.length > 0 && totalVotos !== (num(el.votantes) || pres.length) && (
                  <p style={{ margin: '0.3rem 0 0', fontSize: '0.75rem', color: '#f59e0b', fontWeight: 700 }}>⚠️ A soma dos votos difere do total de votantes — confira as cédulas.</p>
                )}
              </div>
            </div>
            </fieldset>
          )}

          {/* ── 4. Documentos ── */}
          {aba === 'docs' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
              {[
                ['edital', '📢 Edital de Convocação', 'Word — aos Mestres, com as chapas', false],
                ['lista', '📋 Lista de Presença', 'Word — presentes marcados (ou todos os aptos)', false],
                ['ata', '📜 Ata da Eleição', pendente ? 'Bloqueada: sessão pendente' : 'Word — modelo "Ata Eleição GLEMT"', pendente],
              ].map(([k, t, d, bloq]) => (
                <button key={k} type="button" disabled={!!gerando || bloq} onClick={() => word(k)}
                  style={{ ...card, textAlign: 'left', cursor: bloq ? 'not-allowed' : 'pointer', opacity: bloq ? 0.5 : 1 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--color-text)' }}>{gerando === k ? '⏳ Gerando…' : t}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>{d}</div>
                </button>
              ))}
              {[['aptos', '✅ PDF Aptos', 'Relação dos aptos a votar'], ['inaptos', '⛔ PDF Inaptos', 'Relação dos inaptos'], ['ambos', '🗳️ PDF Aptos e Inaptos', 'Os dois quadros no mesmo arquivo']].map(([k, t, d]) => (
                <button key={k} type="button" disabled={apt.carregando} onClick={() => pdf(k)} style={{ ...card, textAlign: 'left', cursor: 'pointer' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--color-text)' }}>{t}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>{d}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
