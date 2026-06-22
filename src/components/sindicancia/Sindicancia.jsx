/**
 * SINDICÂNCIA
 * A∴R∴L∴S∴ Acácia de Paranatinga nº 30
 *
 * Acesso restrito a Mestres e Admins.
 * Props: grauUsuario {string}, userData {object}
 */

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';

// ─────────────────────────────────────────────────────────────────
//  Constantes
// ─────────────────────────────────────────────────────────────────
const GLEMT_LOGO = 'data:image/png;base64,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';

const SITUACOES = [
  { value: 'indicado',    label: 'Indicado',     cor: '#6b7280', bg: 'rgba(107,114,128,0.15)' },
  { value: 'em_analise',  label: 'Em Análise',   cor: '#3b82f6', bg: 'rgba(59,130,246,0.15)'  },
  { value: 'aprovado',    label: 'Aprovado',     cor: '#10b981', bg: 'rgba(16,185,129,0.15)'  },
  { value: 'excluido',    label: 'Excluído',     cor: '#ef4444', bg: 'rgba(239,68,68,0.15)'   },
  { value: 'desistiu',    label: 'Desistiu',     cor: '#f59e0b', bg: 'rgba(245,158,11,0.15)'  },
  { value: 'adiado',      label: 'Adiado',       cor: '#8b5cf6', bg: 'rgba(139,92,246,0.15)'  },
];

const STATUS_PROCESSO = [
  { value: 'em_andamento', label: '⚙️ Em Andamento', cor: '#3b82f6' },
  { value: 'encerrado',    label: '✅ Encerrado',     cor: '#10b981' },
  { value: 'arquivado',    label: '📦 Arquivado',     cor: '#6b7280' },
];

const ESTADOS_CIVIS = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União Estável'];

const getSit = (v) => SITUACOES.find(s => s.value === v) || SITUACOES[0];
const getStatus = (v) => STATUS_PROCESSO.find(s => s.value === v) || STATUS_PROCESSO[0];

// ─────────────────────────────────────────────────────────────────
//  Estilos base
// ─────────────────────────────────────────────────────────────────
const inp = {
  width: '100%', padding: '0.6rem 0.85rem', fontSize: '0.875rem',
  background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)', color: 'var(--color-text)', outline: 'none',
  boxSizing: 'border-box',
};
const lbl = {
  display: 'block', fontSize: '0.75rem', fontWeight: 600,
  color: 'var(--color-text-muted)', marginBottom: '0.3rem',
  textTransform: 'uppercase', letterSpacing: '0.04em',
};
const btnPrimary = {
  display: 'flex', alignItems: 'center', gap: '0.4rem',
  padding: '0.55rem 1.1rem', borderRadius: 'var(--radius-md)',
  background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.35)',
  color: '#c9a84c', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
};
const btnDanger = {
  padding: '0.3rem 0.6rem', borderRadius: 'var(--radius-sm)',
  background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
  color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem',
};
const btnEdit = {
  padding: '0.3rem 0.6rem', borderRadius: 'var(--radius-sm)',
  background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
  color: 'var(--color-accent)', cursor: 'pointer', fontSize: '0.8rem',
};
const card = {
  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)', padding: '1.1rem',
};
const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
  zIndex: 1000, padding: '1rem', overflowY: 'auto',
};
const modalBox = (maxW = '540px') => ({
  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: maxW,
  marginTop: '0.5rem', boxShadow: 'var(--shadow-xl)',
});
const modalHeader = {
  background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)',
  padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between',
  alignItems: 'center', borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
};

// ─────────────────────────────────────────────────────────────────
//  Badge situação
// ─────────────────────────────────────────────────────────────────
const BadgeSit = ({ value }) => {
  const s = getSit(value);
  return (
    <span style={{ background: s.bg, color: s.cor, border: `1px solid ${s.cor}44`,
      padding: '0.2rem 0.65rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────
//  Modal Candidato (criar / editar)
// ─────────────────────────────────────────────────────────────────
const CAND_VAZIO = {
  nome: '', idade: '', estado_civil: '', profissao: '',
  local_trabalho: '', cidade: '', indicado_por_irmao: '',
  data_indicacao: '', situacao: 'indicado', motivo_exclusao: '', observacoes: '',
};

const ModalCandidato = ({ aberto, onFechar, onSalvar, candidato, irmaos, podeVerMotivo = false }) => {
  const [form, setForm] = useState(CAND_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (aberto) {
      setForm(candidato ? { ...CAND_VAZIO, ...candidato } : CAND_VAZIO);
      setErro('');
    }
  }, [aberto, candidato]);

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSalvar = async () => {
    if (!form.nome.trim()) { setErro('Nome é obrigatório.'); return; }
    if (form.situacao === 'excluido' && !form.motivo_exclusao.trim()) {
      setErro('Informe o motivo da exclusão.'); return;
    }
    setSalvando(true); setErro('');
    try { await onSalvar(form); }
    catch (e) { setErro(e.message || 'Erro ao salvar.'); }
    finally { setSalvando(false); }
  };

  if (!aberto) return null;
  return (
    <div style={overlayStyle} onClick={e => e.target === e.currentTarget && onFechar()}>
      <div style={modalBox('600px')}>
        <div style={modalHeader}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
            {candidato ? '✏️ Editar Candidato' : '➕ Novo Candidato'}
          </h3>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '1.4rem', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

          {/* Nome + Idade */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '0.75rem' }}>
            <div>
              <label style={lbl}>Nome Completo *</label>
              <input style={inp} value={form.nome} onChange={e => f('nome', e.target.value)} placeholder="Nome do profano" autoFocus />
            </div>
            <div>
              <label style={lbl}>Idade</label>
              <input style={inp} type="number" min="18" max="99" value={form.idade} onChange={e => f('idade', e.target.value)} placeholder="Ex: 35" />
            </div>
          </div>

          {/* Estado Civil + Profissão */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={lbl}>Estado Civil</label>
              <select style={inp} value={form.estado_civil} onChange={e => f('estado_civil', e.target.value)}>
                <option value="">Selecione...</option>
                {ESTADOS_CIVIS.map(ec => <option key={ec} value={ec}>{ec}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Profissão</label>
              <input style={inp} value={form.profissao} onChange={e => f('profissao', e.target.value)} placeholder="Ex: Engenheiro" />
            </div>
          </div>

          {/* Local Trabalho + Cidade */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={lbl}>Local de Trabalho</label>
              <input style={inp} value={form.local_trabalho} onChange={e => f('local_trabalho', e.target.value)} placeholder="Empresa / Órgão" />
            </div>
            <div>
              <label style={lbl}>Cidade</label>
              <input style={inp} value={form.cidade} onChange={e => f('cidade', e.target.value)} placeholder="Cidade - UF" />
            </div>
          </div>

          {/* Indicado por + Data */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '0.75rem' }}>
            <div>
              <label style={lbl}>Indicado por (Irmão)</label>
              <input style={inp} list="lista-irmaos" value={form.indicado_por_irmao}
                onChange={e => f('indicado_por_irmao', e.target.value)} placeholder="Nome do irmão indicante" />
              <datalist id="lista-irmaos">
                {irmaos.map(i => <option key={i.id} value={i.nome} />)}
              </datalist>
            </div>
            <div>
              <label style={lbl}>Data Indicação</label>
              <input style={{ ...inp, colorScheme: 'dark' }} type="date" value={form.data_indicacao} onChange={e => f('data_indicacao', e.target.value)} />
            </div>
          </div>

          {/* Situação */}
          <div>
            <label style={lbl}>Situação</label>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {SITUACOES.map(s => (
                <button key={s.value} onClick={() => f('situacao', s.value)} style={{
                  padding: '0.35rem 0.85rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.15s',
                  background: form.situacao === s.value ? s.bg : 'var(--color-surface-2)',
                  border: `1px solid ${form.situacao === s.value ? s.cor : 'var(--color-border)'}`,
                  color: form.situacao === s.value ? s.cor : 'var(--color-text-muted)',
                }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Motivo exclusão — só se excluído */}
          {form.situacao === 'excluido' && (
            <div>
              <label style={lbl}>Motivo da Exclusão *</label>
              <textarea style={{ ...inp, resize: 'vertical' }} rows={3}
                value={form.motivo_exclusao} onChange={e => f('motivo_exclusao', e.target.value)}
                placeholder="Descreva o motivo pelo qual o profano foi excluído do processo..." />
            </div>
          )}

          {/* Observações */}
          <div>
            <label style={lbl}>Observações</label>
            <textarea style={{ ...inp, resize: 'vertical' }} rows={3}
              value={form.observacoes} onChange={e => f('observacoes', e.target.value)}
              placeholder="Anotações do processo, discussões, pendências..." />
          </div>

          {erro && (
            <div style={{ padding: '0.6rem 0.85rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: '#ef4444' }}>
              {erro}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)' }}>
            <button onClick={onFechar} style={{ padding: '0.6rem 1.1rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.875rem' }}>Cancelar</button>
            <button onClick={handleSalvar} disabled={salvando} style={{ ...btnPrimary, opacity: salvando ? 0.7 : 1 }}>
              {salvando ? 'Salvando...' : candidato ? '💾 Salvar' : '➕ Adicionar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
//  Modal Situação do Processo (painel de filtro por situação)
// ─────────────────────────────────────────────────────────────────
const ModalSituacao = ({ aberto, onFechar, candidatos, processo, podeVerMotivo = false }) => {
  const [filtro, setFiltro] = useState('todos');

  const lista = filtro === 'todos' ? candidatos : candidatos.filter(c => c.situacao === filtro);

  const totais = SITUACOES.reduce((acc, s) => {
    acc[s.value] = candidatos.filter(c => c.situacao === s.value).length;
    return acc;
  }, {});

  if (!aberto) return null;
  return (
    <div style={overlayStyle} onClick={e => e.target === e.currentTarget && onFechar()}>
      <div style={modalBox('760px')}>
        <div style={modalHeader}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
              📊 Situação do Processo — {processo?.titulo || `${processo?.numero}/${processo?.ano}`}
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '0.2rem 0 0' }}>
              {candidatos.length} candidato{candidatos.length !== 1 ? 's' : ''} no total
            </p>
          </div>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '1.4rem', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Cards de totais por situação */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
            <button onClick={() => setFiltro('todos')} style={{
              padding: '0.65rem', borderRadius: 'var(--radius-md)', textAlign: 'center', cursor: 'pointer',
              background: filtro === 'todos' ? 'rgba(201,168,76,0.15)' : 'var(--color-surface-2)',
              border: `1px solid ${filtro === 'todos' ? 'rgba(201,168,76,0.4)' : 'var(--color-border)'}`,
            }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#c9a84c' }}>{candidatos.length}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>TODOS</div>
            </button>
            {SITUACOES.map(s => (
              <button key={s.value} onClick={() => setFiltro(s.value)} style={{
                padding: '0.65rem', borderRadius: 'var(--radius-md)', textAlign: 'center', cursor: 'pointer',
                background: filtro === s.value ? s.bg : 'var(--color-surface-2)',
                border: `1px solid ${filtro === s.value ? s.cor : 'var(--color-border)'}`,
              }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.cor }}>{totais[s.value] || 0}</div>
                <div style={{ fontSize: '0.72rem', color: filtro === s.value ? s.cor : 'var(--color-text-muted)', fontWeight: 600 }}>{s.label.toUpperCase()}</div>
              </button>
            ))}
          </div>

          {/* Lista filtrada */}
          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '0.85rem' }}>
            {lista.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                Nenhum candidato nesta situação.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '380px', overflowY: 'auto' }}>
                {lista.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--color-surface-2)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>{c.nome}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.1rem' }}>
                        {[c.profissao, c.cidade].filter(Boolean).join(' · ')}
                        {c.indicado_por_irmao && ` · Ir∴ ${c.indicado_por_irmao}`}
                      </div>
                      {c.situacao === 'excluido' && c.motivo_exclusao && podeVerMotivo && (
                        <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.2rem' }}>
                          ⚠️ {c.motivo_exclusao}
                        </div>
                      )}
                      {c.observacoes && (!['excluido','adiado','desistiu'].includes(c.situacao) || podeVerMotivo) && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.2rem', fontStyle: 'italic' }}>
                          💬 {c.observacoes}
                        </div>
                      )}
                    </div>
                    <BadgeSit value={c.situacao} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)' }}>
            <button onClick={onFechar} style={{ padding: '0.6rem 1.25rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.875rem' }}>Fechar</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
//  Modal Encerrar Processo
// ─────────────────────────────────────────────────────────────────
const ModalEncerrar = ({ aberto, onFechar, onEncerrar, processo }) => {
  const [obs, setObs] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { if (aberto) setObs(''); }, [aberto]);

  if (!aberto) return null;
  return (
    <div style={overlayStyle} onClick={e => e.target === e.currentTarget && onFechar()}>
      <div style={modalBox()}>
        <div style={modalHeader}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>🔒 Encerrar Processo</h3>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '1.4rem' }}>×</button>
        </div>
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ padding: '0.85rem 1rem', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', color: '#f59e0b' }}>
            ⚠️ Após encerrado, o processo não poderá ser reaberto. Candidatos não finalizados serão mantidos com sua situação atual.
          </div>
          <div>
            <label style={lbl}>Observação Final</label>
            <textarea style={{ ...inp, resize: 'vertical' }} rows={4} value={obs} onChange={e => setObs(e.target.value)}
              placeholder="Resultado geral do processo, decisões tomadas em sessão, etc." />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)' }}>
            <button onClick={onFechar} style={{ padding: '0.6rem 1.1rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer' }}>Cancelar</button>
            <button onClick={async () => { setSalvando(true); await onEncerrar(obs); setSalvando(false); }}
              disabled={salvando}
              style={{ padding: '0.6rem 1.25rem', borderRadius: 'var(--radius-md)', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', fontWeight: 600, cursor: 'pointer' }}>
              {salvando ? 'Encerrando...' : '🔒 Confirmar Encerramento'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
//  Detalhe do Processo (candidatos)
// ─────────────────────────────────────────────────────────────────
const DetalheProcesso = ({ processo, onVoltar, irmaos, podeEditar, podeVerMotivo, onProcessoAtualizado }) => {
  const [candidatos, setCandidatos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modalCand, setModalCand] = useState(false);
  const [candEditando, setCandEditando] = useState(null);
  const [confirmExcluir, setConfirmExcluir] = useState(null);
  const [modalSituacao, setModalSituacao] = useState(false);
  const [modalEncerrar, setModalEncerrar] = useState(false);
  const [msg, setMsg] = useState('');
  const [buscaLocal, setBuscaLocal] = useState('');
  const [filtroSitLocal, setFiltroSitLocal] = useState('todos');

  const carregarCandidatos = async () => {
    await supabase.auth.refreshSession();
    const { data } = await supabase
      .from('sindicancia_candidatos')
      .select('*')
      .eq('processo_id', processo.id)
      .order('criado_em', { ascending: true });
    setCandidatos(data || []);
    setCarregando(false);
  };

  useEffect(() => { carregarCandidatos(); }, [processo.id]);

  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const handleSalvarCandidato = async (form) => {
    await supabase.auth.refreshSession();
    const payload = {
      processo_id: processo.id,
      nome: form.nome.trim(),
      idade: form.idade ? parseInt(form.idade) : null,
      estado_civil: form.estado_civil || null,
      profissao: form.profissao || null,
      local_trabalho: form.local_trabalho || null,
      cidade: form.cidade || null,
      indicado_por_irmao: form.indicado_por_irmao || null,
      data_indicacao: form.data_indicacao || null,
      situacao: form.situacao,
      motivo_exclusao: form.situacao === 'excluido' ? form.motivo_exclusao : null,
      observacoes: form.observacoes || null,
    };
    if (candEditando) {
      const { error } = await supabase.from('sindicancia_candidatos').update(payload).eq('id', candEditando.id);
      if (error) throw error;
      showMsg('✅ Candidato atualizado!');
    } else {
      const { error } = await supabase.from('sindicancia_candidatos').insert(payload);
      if (error) throw error;
      showMsg('✅ Candidato adicionado!');
    }
    setModalCand(false); setCandEditando(null);
    await carregarCandidatos();
  };

  const handleExcluir = async () => {
    if (!confirmExcluir) return;
    await supabase.from('sindicancia_candidatos').delete().eq('id', confirmExcluir.id);
    setConfirmExcluir(null);
    await carregarCandidatos();
    showMsg('🗑️ Candidato removido.');
  };

  const handleEncerrar = async (obs) => {
    const { error } = await supabase.from('sindicancia_processos').update({
      status: 'encerrado',
      data_encerramento: new Date().toISOString().split('T')[0],
      observacao_final: obs || null,
    }).eq('id', processo.id);
    if (!error) {
      setModalEncerrar(false);
      showMsg('✅ Processo encerrado.');
      onProcessoAtualizado();
    }
  };

  const gerarFormularioI = async (cand) => {
    const { jsPDF } = await import('jspdf');
    const s  = (v) => { if (!v) return ''; let r = ''; for (const c of String(v).normalize('NFD')) { if (c.charCodeAt(0) < 128) r += c; } return r; };
    const nomeLoja = s(processo.loja_nome || 'ARLS Acacia de Paranatinga No 30');
    const doc = new jsPDF({ orientation: 'portrait', format: 'a4', unit: 'mm' });
    const W = 210; const M = 10; const IW = W - M * 2;

    // ── helpers ────────────────────────────────────────────────────────────
    const linha  = (dots = IW - 4) => '.'.repeat(Math.floor(dots * 2.2));
    const box    = (x, y, w, h, fill) => { if (fill) { doc.setFillColor(...fill); doc.rect(x, y, w, h, 'F'); } doc.setDrawColor(0,0,180); doc.setLineWidth(0.3); doc.rect(x, y, w, h); };
    const label  = (txt, x, y, size = 7.5, bold = false) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(0, 0, 100); doc.text(s(txt), x, y); };
    const valor  = (txt, x, y, size = 8) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(size); doc.setTextColor(0, 0, 0); doc.text(s(txt || ''), x, y); };
    const campo  = (lbl, val, x, y, w, h = 6) => {
      box(x, y, w, h, [230, 232, 245]);
      label(lbl, x + 1.5, y + 3.5, 6.5);
      valor(val, x + 1.5, y + 5.8, 7.5);
    };
    const campoLinha = (lbl, val, x, y, w) => {
      label(lbl, x, y, 7); doc.setDrawColor(0, 0, 180); doc.setLineWidth(0.2);
      doc.line(x, y + 0.8, x + w, y + 0.8);
      valor(val, x + 0.5, y, 7.5);
    };
    const pontos = (x, y, w) => { doc.setTextColor(0, 0, 180); doc.setFontSize(6); doc.text('.'.repeat(Math.floor(w * 2.5)), x, y); };

    // ═══════════════════════════════════════════════════════════════════════
    //  PÁGINA 1 — Cabeçalho + dados do candidato
    // ═══════════════════════════════════════════════════════════════════════
    let y = M;

    // Número de página (canto superior direito)
    const numPag = (n, tot) => { doc.setFillColor(0, 0, 100); doc.circle(W - M - 7, M + 7, 8, 'F'); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.text(`${n}`, W - M - 7, M + 8, {align:'center'}); doc.setFontSize(6.5); doc.text(`Pagina`, W - M - 7, M + 2.5, {align:'center'}); doc.text(`de ${tot}`, W - M - 7, M + 12, {align:'center'}); };
    numPag(1, 3);

    // Título formulario
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(0);
    doc.text('Formulario I', W / 2, y + 5, { align: 'center' }); y += 9;

    // Caixa do cabeçalho (Or, Do Mestre, A Aug, Veneravel)
    doc.setDrawColor(0, 0, 180); doc.setLineWidth(0.5); doc.rect(M, y, IW, 28);
    // Brasão GLEMT
    try { doc.addImage(GLEMT_LOGO, 'PNG', M + 1, y + 1, 22, 22); } catch(e) {}
    doc.setLineWidth(0.2);
    label(`Or. de ${nomeLoja} ....../......../20........, E.V.`,          M + 25, y + 5, 8);
    label('Do Mestre Macon ' + linha(85),                                 M + 25, y + 11, 8);
    label('A Aug. e Resp. Loj. Simb. ' + linha(70) + '  No.........',    M + 25, y + 17, 8);
    label('Veneravel Mestre,',                                             M + 25, y + 23, 8);
    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(0,0,100);
    doc.text('S.:.S.:.S.:.',  W / 2,  y + 27, { align: 'center' });
    y += 33;

    // Título proposta (fundo azul)
    doc.setFillColor(0, 0, 180); doc.rect(M, y, IW, 7, 'F');
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(8.5);
    doc.text('PROPOSTA PRELIMINAR DE CANDIDATO PARA ADMISSAO (SINDICANCIA PREVIA)', W / 2, y + 4.8, { align: 'center' });
    y += 9;

    // Texto submeto
    doc.setTextColor(0); doc.setFont('helvetica','bold'); doc.setFontSize(7.5);
    const submeto = 'Submeto a apreciacao do quadro dessa Loja, nos termos do Regulamento geral o nome do profano abaixo indicado, solicitando que sejam feitas as devidas sindicancias regulamentares:';
    const linSubmeto = doc.splitTextToSize(s(submeto), IW);
    doc.text(linSubmeto, M, y + 4); y += linSubmeto.length * 4 + 3;

    // Grid de dados pessoais
    const rh = 7; // row height
    const apoiador = s(cand.indicado_por_irmao || '');
    const dataInd  = cand.data_indicacao ? new Date(cand.data_indicacao + 'T00:00:00').toLocaleDateString('pt-BR') : '';

    campo('Nome do candidato:', s(cand.nome),       M,        y, IW * 0.68, rh);
    campo('Data Nasc:',         '',                  M + IW * 0.68, y, IW * 0.32, rh);
    y += rh;
    campo('Nacionalidade:',     'Brasileiro(a)',     M,        y, IW * 0.33, rh);
    campo('Naturalidade:',      '',                  M + IW * 0.33, y, IW * 0.43, rh);
    campo('Idade:',             s(cand.idade ? cand.idade + ' anos' : ''), M + IW * 0.76, y, IW * 0.24, rh);
    y += rh;
    campo('Tel. Resid:',        '',                  M,        y, IW * 0.33, rh);
    campo('Comercial:',         '',                  M + IW * 0.33, y, IW * 0.33, rh);
    campo('Cel:',               '',                  M + IW * 0.66, y, IW * 0.34, rh);
    y += rh;
    campo('RG:',                '',                  M,        y, IW * 0.3, rh);
    campo('Org Exp/UF:',        '',                  M + IW * 0.3, y, IW * 0.3, rh);
    campo('CPF:',               '',                  M + IW * 0.6, y, IW * 0.4, rh);
    y += rh;
    campo('End Residencial:',   '',                  M,        y, IW * 0.8, rh);
    campo('No:',                '',                  M + IW * 0.8, y, IW * 0.2, rh);
    y += rh;
    campo('Bairro:',            '',                  M,        y, IW * 0.33, rh);
    campo('Cidade:',            s(cand.cidade),      M + IW * 0.33, y, IW * 0.43, rh);
    campo('UF:',                'MT',                M + IW * 0.76, y, IW * 0.24, rh);
    y += rh;
    campo('CEP:',               '',                  M,        y, IW * 0.25, rh);
    campo('Complemento:',       '',                  M + IW * 0.25, y, IW * 0.4, rh);
    campo('Reside em MT ha (anos):', '',             M + IW * 0.65, y, IW * 0.35, rh);
    y += rh;
    campo('Tipo Sanguineo:',    '',                  M,        y, IW * 0.25, rh);
    campo('Profissao CBO:',     s(cand.profissao),   M + IW * 0.25, y, IW * 0.5, rh);
    campo('Ha(em anos):',       '',                  M + IW * 0.75, y, IW * 0.25, rh);
    y += rh;
    campo('Cargo:',             '',                  M,        y, IW * 0.5, rh);
    campo('Empresa:',           s(cand.local_trabalho), M + IW * 0.5, y, IW * 0.5, rh);
    y += rh;
    campo('End Comercial:',     '',                  M,        y, IW * 0.8, rh);
    campo('No:',                '',                  M + IW * 0.8, y, IW * 0.2, rh);
    y += rh;
    campo('Bairro:',            '',                  M,        y, IW * 0.33, rh);
    campo('Cidade:',            s(cand.cidade),      M + IW * 0.33, y, IW * 0.43, rh);
    campo('UF:',                'MT',                M + IW * 0.76, y, IW * 0.24, rh);
    y += rh;
    campo('CEP:',               '',                  M,        y, IW * 0.35, rh);
    campo('Renda Aproximada:',  '',                  M + IW * 0.35, y, IW * 0.65, rh);
    y += rh + 1;

    // Esposa
    campo('Nome da Esposa:',    '',                  M,        y, IW * 0.68, rh);
    campo('Data Nasc:',         '',                  M + IW * 0.68, y, IW * 0.32, rh);
    y += rh;
    campo('Tipo Sanguineo:',    '',                  M,        y, IW * 0.25, rh);
    campo('Profissao CBO:',     '',                  M + IW * 0.25, y, IW * 0.5, rh);
    campo('Ha(em anos):',       '',                  M + IW * 0.75, y, IW * 0.25, rh);
    y += rh;
    campo('Cargo:',             '',                  M,        y, IW * 0.5, rh);
    campo('Empresa:',           '',                  M + IW * 0.5, y, IW * 0.5, rh);
    y += rh;
    campo('End Comercial esposa:', '',               M,        y, IW * 0.8, rh);
    campo('No:',                '',                  M + IW * 0.8, y, IW * 0.2, rh);
    y += rh;
    campo('Bairro:',            '',                  M,        y, IW * 0.33, rh);
    campo('Cidade:',            '',                  M + IW * 0.33, y, IW * 0.43, rh);
    campo('UF:',                '',                  M + IW * 0.76, y, IW * 0.24, rh);
    y += rh;
    campo('CEP:',               '',                  M,        y, IW * 0.35, rh);
    campo('Renda Aproximada:',  '',                  M + IW * 0.35, y, IW * 0.65, rh);

    // ═══════════════════════════════════════════════════════════════════════
    //  CONTINUAÇÃO PÁG 1 — Declarações 1-4 (mesma página dos dados)
    // ═══════════════════════════════════════════════════════════════════════
    y += 3;

    const bloco = (num, texto, linhas = 5, yAtual) => {
      const txtLines = doc.splitTextToSize(s(texto), IW - 16);
      const bh = txtLines.length * 5 + linhas * 4.5 + 8;
      box(M, yAtual, IW, bh, [255,255,255]);
      doc.setFillColor(0,0,180); doc.rect(M, yAtual, 7, 7, 'F');
      doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(9);
      doc.text(`${num}`, M + 3.5, yAtual + 5, { align:'center' });
      doc.setTextColor(0); doc.setFont('helvetica','bold'); doc.setFontSize(7.5);
      doc.text(txtLines, M + 8, yAtual + 5);
      for (let i = 0; i < linhas; i++) {
        const ly = yAtual + txtLines.length * 5 + 4 + i * 4.5;
        doc.setDrawColor(0,0,180); doc.setLineWidth(0.15);
        doc.line(M + 3, ly, M + IW - 3, ly);
      }
      return yAtual + bh + 3;
    };

    // Item 1
    y = bloco(1,
      `Declaro que conheco pessoalmente o candidato ha mais de ............. anos e ATESTO ser o candidato ora apresentado, pessoa de conduta bem conceituada, de boa indole, cumpridora de suas obrigacoes em sua vida familiar, comercial e profissional.`,
      0, y);

    // Item 2
    box(M, y, IW, 10, [255,255,255]);
    doc.setFillColor(0,0,180); doc.rect(M, y, 7, 7, 'F');
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.text('2', M + 3.5, y + 5, { align:'center' });
    doc.setTextColor(0); doc.setFont('helvetica','bold'); doc.setFontSize(7.5);
    doc.text('Considero que o Candidato possui nivel intelectual:   REGULAR (   )   BOM (   )   EXCELENTE (   )', M + 8, y + 5);
    y += 13;

    y = bloco(3,
      'O candidato podera contribuir muito para com a instituicao Maconica, porque:',
      5, y);

    y = bloco(4,
      'O candidato desfruta de condicoes para arcar com os encargos financeiros, mensalidades, rateios e outras captacoes caso seja admitido, porque:',
      4, y);

    // Rodapé pág 1
    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(0);
    doc.text('Este Formulario devera ser preenchido pelo Apoiador da Iniciacao', W/2, 290, { align:'center' });

    // ═══════════════════════════════════════════════════════════════════════
    //  PÁGINA 2 — Itens 5-7 + Tramitação
    // ═══════════════════════════════════════════════════════════════════════
    doc.addPage(); y = M; numPag(2, 2);
    doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(0);
    doc.text('Formulario I', W / 2, y + 5, { align:'center' }); y += 11;

    y = bloco(5,
      'O candidato dispoe de horarios para participar assiduamente dos trabalhos da Oficina, todas as semanas bem como para atender a outras incumbencias porque:',
      6, y);

    // Item 6 — Referências
    const bh6 = 52;
    box(M, y, IW, bh6, [255,255,255]);
    doc.setFillColor(0,0,180); doc.rect(M, y, 7, 7, 'F');
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.text('6', M + 3.5, y + 5, { align:'center' });
    doc.setTextColor(0); doc.setFont('helvetica','bold'); doc.setFontSize(7);
    doc.text('Na qualidade de Apoiador, declaro que o candidato esta ciente e nao faz restricao alguma a que os Irmaos busquem informacoes junto aos ambientes de seu relacionamento social, profissional e comercial. para tanto, indica as seguintes fontes para eventuais verificacoes:', M + 8, y + 5, { maxWidth: IW - 10 });
    // Tabela referências
    const tr = y + 18; const col = [M, M + 35, M + 100];
    doc.setFillColor(0,0,180); doc.rect(M, tr, IW, 7, 'F');
    doc.setTextColor(255,255,255); doc.setFontSize(7.5);
    ['REFERENCIAS', 'NOME', 'ENDERECO'].forEach((h, i) => doc.text(h, col[i] + 2, tr + 4.5));
    ['BANCARIA:', 'COMERCIAL:', 'PESSOAL:'].forEach((ref, i) => {
      const ry = tr + 7 + i * 8;
      doc.setFillColor(210, 215, 240); doc.rect(M, ry, 35, 8, 'F');
      doc.setDrawColor(0,0,180); doc.setLineWidth(0.2); doc.rect(M, ry, IW, 8);
      doc.setTextColor(0,0,120); doc.setFont('helvetica','bold'); doc.setFontSize(7);
      doc.text(ref, M + 2, ry + 5);
      doc.setDrawColor(0,0,180); doc.line(M + 35, ry, M + 35, ry + 8); doc.line(M + 100, ry, M + 100, ry + 8);
    });
    y += bh6 + 3;

    // Item 7
    y = bloco(7,
      'Tudo eu declaro conscientemente que estou apresentando um Candidato de grande valor que muito pode oferecer a esta Oficina e a Maconaria Universal.',
      0, y);

    // Assinatura
    y += 5;
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(0);
    doc.text('Fraternalmente:', M, y); y += 12;
    const sigW = 75;
    const sigX = (W - sigW) / 2;
    doc.setDrawColor(0); doc.setLineWidth(0.3);
    doc.line(sigX, y, sigX + sigW, y);
    doc.text('(...................)', sigX + sigW + 2, y, { align:'left' });
    y += 4;
    doc.setFontSize(7.5); doc.text(`Nome do M.:.M.:. Apoiador e No do Cadastro GLEMT`, W/2, y, { align:'center' });
    y += 12;

    // ─── TRAMITAÇÃO (continua na pág 3) ───────────────────────────────────
    doc.setFillColor(0,0,180); doc.rect(M, y, IW, 8, 'F');
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(11);
    doc.text('TRAMITACAO DA PROPOSTA', W/2, y + 6, { align:'center' });
    y += 11;

    doc.setTextColor(0); doc.setFont('helvetica','normal'); doc.setFontSize(8);
    doc.text('5    Proposta recebida ne Bolsa de Propostas e Informacoes da Sessao do dia: ______/______/____________', M, y + 5);
    y += 11;

    // Tabela tramitação
    const th = y; const cols = [M, M + 20, M + 70]; const colW = [20, 50, IW - 70];
    doc.setFillColor(0,0,180); doc.rect(M, th, IW, 7, 'F');
    doc.setTextColor(255,255,255); doc.setFontSize(7.5); doc.setFont('helvetica','bold');
    ['LEITURAS','SESSAO DO DIA','PROVIDENCIAS'].forEach((h, i) => doc.text(h, cols[i] + 2, th + 4.5));
    const tramRows = [
      ['1a', '', 'Publicidade:\n  - Edital (afixar no mural da Loja);\n  - Boletim Informativo Mensal (Anexar 01 foto 3x4)'],
      ['2a', '', 'Ler pela 2a vez e aguardar para a 3a leitura'],
      ['3a', '', 'Entrega da proposta de admissao - Modelo Completo'],
      ['--', '', 'PUBLICACAO EM BOLETIM OFICIAL DA GRANDE LOJA DO ESTADO DE MT'],
      ['4a', '', 'Apos a publicacao - efetuar a 4a leitura'],
      ['5a', '', 'Escrutinio Secreto'],
    ];
    let ry = th + 7;
    tramRows.forEach((row, idx) => {
      const linhas = doc.splitTextToSize(s(row[2]), colW[2] - 4);
      const rHeight = Math.max(7, linhas.length * 4.5 + 3);
      if (idx % 2 === 0) { doc.setFillColor(240,241,250); doc.rect(M, ry, IW, rHeight, 'F'); }
      doc.setDrawColor(0,0,180); doc.setLineWidth(0.15); doc.rect(M, ry, IW, rHeight);
      doc.line(cols[1], ry, cols[1], ry + rHeight); doc.line(cols[2], ry, cols[2], ry + rHeight);
      doc.setTextColor(0); doc.setFont('helvetica', row[0] === '--' ? 'bold' : 'normal'); doc.setFontSize(7.5);
      doc.text(s(row[0]), cols[0] + 2, ry + 4.5);
      doc.text(linhas, cols[2] + 2, ry + 4.5);
      ry += rHeight;
    });
    y = ry + 5;

    // Observações finais
    doc.setDrawColor(0,0,180); doc.setLineWidth(0.3); doc.rect(M, y, IW, 40);
    doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(0);
    doc.text('Observacoes/Providencias:', M + 2, y + 5);
    for (let i = 0; i < 6; i++) {
      const ly = y + 10 + i * 5;
      doc.setDrawColor(0,0,180); doc.setLineWidth(0.12); doc.line(M + 3, ly, M + IW - 3, ly);
    }

    // Salvar
    const nomePDF = s(cand.nome || 'candidato').replace(/\s+/g, '_');
    doc.save(`Formulario_I_${nomePDF}.pdf`);
  };

  const gerarPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const sanitize = (str) => { if (!str) return ''; let r = ''; for (const c of str.normalize('NFD')) { if (c.charCodeAt(0) < 128) r += c; } return r; };
    const doc = new jsPDF({ orientation: 'portrait', format: 'a4' });
    const pW = doc.internal.pageSize.getWidth();

    // Cabeçalho
    doc.setFillColor(26, 26, 26);
    doc.rect(0, 0, pW, 40, 'F');
    doc.setTextColor(201, 168, 76);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('A.R.L.S. Acacia de Paranatinga no 30', pW / 2, 14, { align: 'center' });
    doc.setTextColor(220, 220, 220);
    doc.setFontSize(10);
    doc.text(`Sindicancia - Processo ${processo.numero}/${processo.ano}`, pW / 2, 22, { align: 'center' });
    if (processo.titulo) {
      doc.setFontSize(9);
      doc.text(sanitize(processo.titulo), pW / 2, 29, { align: 'center' });
    }
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(8);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} - DOCUMENTO SIGILOSO`, pW / 2, 36, { align: 'center' });

    let y = 48;

    // Info do processo
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const stProc = getStatus(processo.status);
    doc.text(`Status: ${sanitize(stProc.label)}  |  Abertura: ${processo.data_abertura ? new Date(processo.data_abertura + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}  |  Candidatos: ${candidatos.length}`, 14, y);
    y += 6;
    if (processo.data_encerramento) {
      doc.text(`Encerramento: ${new Date(processo.data_encerramento + 'T00:00:00').toLocaleDateString('pt-BR')}`, 14, y);
      y += 6;
    }
    if (processo.observacao_final) {
      doc.setFont('helvetica', 'italic');
      const linhas = doc.splitTextToSize(`Observacao Final: ${sanitize(processo.observacao_final)}`, pW - 28);
      doc.text(linhas, 14, y);
      y += linhas.length * 5 + 2;
    }
    y += 4;

    // Resumo por situação
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    doc.text('Resumo por Situacao', 14, y); y += 6;

    const resumoData = SITUACOES.map(s => [
      s.label,
      candidatos.filter(c => c.situacao === s.value).length.toString()
    ]);
    autoTable(doc, {
      startY: y, head: [['Situacao', 'Qtd']],
      body: resumoData.map(r => [r[0].normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x00-\x7F]/g,'?'), r[1]]),
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [40, 40, 40], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'center', cellWidth: 20 } },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 10;

    // Tabela de candidatos por situação
    for (const sit of SITUACOES) {
      const grupo = candidatos.filter(c => c.situacao === sit.value);
      if (!grupo.length) continue;

      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      const labelSit = sit.label.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x00-\x7F]/g,'?');
      doc.text(`${labelSit} (${grupo.length})`, 14, y); y += 5;

      const rows = grupo.map(c => [
        sanitize(c.nome),
        c.idade ? `${c.idade} anos` : '-',
        sanitize(c.profissao) || '-',
        sanitize(c.cidade) || '-',
        c.indicado_por_irmao ? `Ir. ${sanitize(c.indicado_por_irmao)}` : '-',
        sit.value === 'excluido' ? sanitize(c.motivo_exclusao || '-') : sanitize(c.observacoes || '-'),
      ]);

      autoTable(doc, {
        startY: y,
        head: [['Nome', 'Idade', 'Profissao', 'Cidade', 'Indicado por', sit.value === 'excluido' ? 'Motivo' : 'Observacoes']],
        body: rows,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [55, 55, 55], textColor: 255 },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        columnStyles: {
          0: { cellWidth: 38 },
          1: { cellWidth: 16, halign: 'center' },
          2: { cellWidth: 28 },
          3: { cellWidth: 25 },
          4: { cellWidth: 28 },
          5: { cellWidth: 42, fontSize: 7 },
        },
        margin: { left: 14, right: 14 },
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    // Rodapé sigiloso em todas as páginas
    const total = doc.internal.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(180, 180, 180);
      doc.text('DOCUMENTO SIGILOSO - USO RESTRITO AOS MESTRES DA LOJA', pW / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
      doc.text(`Página ${i} de ${total}`, pW - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
    }

    doc.save(`Sindicancia_${processo.numero}_${processo.ano}.pdf`);
    showMsg('📄 PDF gerado!');
  };

  const encerrado = processo.status !== 'em_andamento';

  // Totais rápidos
  const totRapidos = SITUACOES.reduce((acc, s) => {
    acc[s.value] = candidatos.filter(c => c.situacao === s.value).length;
    return acc;
  }, {});

  return (
    <>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={onVoltar} style={{ ...btnEdit, padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}>← Voltar</button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>
                Processo {processo.numero}/{processo.ano}
              </span>
              <span style={{ padding: '0.15rem 0.6rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600,
                background: getStatus(processo.status).cor + '22', color: getStatus(processo.status).cor,
                border: `1px solid ${getStatus(processo.status).cor}44` }}>
                {getStatus(processo.status).label}
              </span>
            </div>
            {processo.titulo && <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{processo.titulo}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={() => setModalSituacao(true)} style={{ ...btnPrimary, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.35)', color: '#8b5cf6' }}>
            📊 Situação
          </button>
          <button onClick={gerarPDF} style={{ ...btnPrimary, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.35)', color: '#3b82f6' }}>
            📄 PDF
          </button>
          {podeEditar && !encerrado && (
            <>
              <button onClick={() => { setCandEditando(null); setModalCand(true); }} style={btnPrimary}>
                ➕ Candidato
              </button>
              <button onClick={() => setModalEncerrar(true)} style={{ ...btnPrimary, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444' }}>
                🔒 Encerrar
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mensagem */}
      {msg && (
        <div style={{ marginBottom: '0.85rem', padding: '0.65rem 1rem', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', color: '#10b981' }}>
          {msg}
        </div>
      )}

      {/* Cards resumo rápido */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.5rem', marginBottom: '1.25rem' }}>
        {SITUACOES.map(s => (
          <div key={s.value} style={{ background: 'var(--color-surface)', border: `1px solid ${s.cor}33`, borderRadius: 'var(--radius-md)', padding: '0.65rem 0.75rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.cor }}>{totRapidos[s.value] || 0}</div>
            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Observação final (se encerrado) */}
      {encerrado && processo.observacao_final && (
        <div style={{ ...card, borderLeft: '4px solid #10b981', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Observação Final</div>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.6, margin: 0 }}>{processo.observacao_final}</p>
        </div>
      )}

      {/* Busca local + filtro situação */}
      {candidatos.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <input
            value={buscaLocal}
            onChange={e => setBuscaLocal(e.target.value)}
            placeholder="🔍 Buscar por nome..."
            style={{ ...inp, flex: '1', minWidth: '180px' }}
          />
          <select
            value={filtroSitLocal}
            onChange={e => setFiltroSitLocal(e.target.value)}
            style={{ ...inp, width: 'auto', minWidth: '140px' }}
          >
            <option value="todos">Todas as situações</option>
            {SITUACOES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      )}

      {/* Lista de candidatos */}
      {carregando ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>Carregando...</div>
      ) : candidatos.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: '3rem', border: '1px dashed var(--color-border)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🔍</div>
          <p style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.25rem' }}>Nenhum candidato cadastrado</p>
          {podeEditar && !encerrado && <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Clique em "➕ Candidato" para começar.</p>}
        </div>
      ) : (() => {
        // Ordem de exibição dos grupos
        const ORDEM = ['indicado', 'em_analise', 'aprovado', 'adiado', 'desistiu', 'excluido'];

        const candidatosFiltrados = candidatos
          .filter(c => filtroSitLocal === 'todos' || c.situacao === filtroSitLocal)
          .filter(c => !buscaLocal.trim() || c.nome.toLowerCase().includes(buscaLocal.toLowerCase().trim()));

        // Agrupar por situação na ordem definida
        const grupos = ORDEM.map(sit => ({
          sit,
          cfg: getSit(sit),
          lista: candidatosFiltrados.filter(c => c.situacao === sit),
        })).filter(g => g.lista.length > 0);

        const renderCard = (c) => {
          const sit = getSit(c.situacao);
          return (
            <div key={c.id} style={{ ...card, borderLeft: `4px solid ${sit.cor}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)' }}>{c.nome}</span>
                    {c.idade && <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{c.idade} anos</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    {c.estado_civil    && <span>💍 {c.estado_civil}</span>}
                    {c.profissao       && <span>💼 {c.profissao}</span>}
                    {c.local_trabalho  && <span>🏢 {c.local_trabalho}</span>}
                    {c.cidade          && <span>📍 {c.cidade}</span>}
                    {c.indicado_por_irmao && <span>👤 Ir∴ {c.indicado_por_irmao}</span>}
                    {c.data_indicacao  && <span>📅 {new Date(c.data_indicacao + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                  </div>
                  {c.situacao === 'excluido' && c.motivo_exclusao && podeVerMotivo && (
                    <div style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: '#ef4444', background: 'rgba(239,68,68,0.08)', padding: '0.4rem 0.65rem', borderRadius: 'var(--radius-sm)' }}>
                      ⚠️ <strong>Motivo:</strong> {c.motivo_exclusao}
                    </div>
                  )}
                  {c.observacoes && (!['excluido','adiado','desistiu'].includes(c.situacao) || podeVerMotivo) && (
                    <div style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                      💬 {c.observacoes}
                    </div>
                  )}
                </div>
                {podeEditar && !encerrado && (
                  <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                    <button onClick={() => gerarFormularioI(c)} style={{ ...btnEdit, background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.4)', color: '#c9a84c' }} title="Gerar Formulário I">📋</button>
                    <button onClick={() => { setCandEditando(c); setModalCand(true); }} style={btnEdit} title="Editar">✏️</button>
                    <button onClick={() => setConfirmExcluir(c)} style={btnDanger} title="Excluir">🗑️</button>
                  </div>
                )}
              </div>
            </div>
          );
        };

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {buscaLocal.trim() && candidatosFiltrados.length > 0 && (
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                {candidatosFiltrados.length} resultado{candidatosFiltrados.length !== 1 ? 's' : ''} para "{buscaLocal}"
              </div>
            )}
            {candidatosFiltrados.length === 0 && (
              <div style={{ ...card, textAlign: 'center', padding: '2rem', border: '1px dashed var(--color-border)' }}>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Nenhum candidato encontrado com este filtro.</p>
              </div>
            )}
            {grupos.map(g => (
              <div key={g.sit}>
                {/* Cabeçalho do grupo */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                  marginBottom: '0.75rem', paddingBottom: '0.5rem',
                  borderBottom: `2px solid ${g.cfg.cor}33`,
                }}>
                  <div style={{
                    width: '10px', height: '10px', borderRadius: '50%',
                    background: g.cfg.cor, flexShrink: 0,
                  }} />
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: g.cfg.cor }}>
                    {g.cfg.label}
                  </span>
                  <span style={{
                    padding: '0.1rem 0.5rem', borderRadius: '999px', fontSize: '0.72rem',
                    fontWeight: 600, background: g.cfg.bg,
                    border: `1px solid ${g.cfg.cor}44`, color: g.cfg.cor,
                  }}>
                    {g.lista.length}
                  </span>
                </div>
                {/* Cards do grupo */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {g.lista.map(c => renderCard(c))}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Modais */}
      <ModalCandidato aberto={modalCand} onFechar={() => { setModalCand(false); setCandEditando(null); }}
        onSalvar={handleSalvarCandidato} candidato={candEditando} irmaos={irmaos} podeVerMotivo={podeVerMotivo} />

      <ModalSituacao aberto={modalSituacao} onFechar={() => setModalSituacao(false)}
        candidatos={candidatos} processo={processo} podeVerMotivo={podeVerMotivo} />

      <ModalEncerrar aberto={modalEncerrar} onFechar={() => setModalEncerrar(false)}
        onEncerrar={handleEncerrar} processo={processo} />

      {/* Confirm excluir candidato */}
      {confirmExcluir && (
        <div style={overlayStyle}>
          <div style={modalBox('400px')}>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Remover candidato?</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>
                <strong style={{ color: 'var(--color-text)' }}>{confirmExcluir.nome}</strong> será removido permanentemente deste processo.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button onClick={() => setConfirmExcluir(null)} style={{ padding: '0.55rem 1.1rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={handleExcluir} style={{ ...btnDanger, padding: '0.55rem 1.25rem', fontWeight: 600 }}>Confirmar Remoção</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ─────────────────────────────────────────────────────────────────
//  Modal Novo Processo
// ─────────────────────────────────────────────────────────────────
const ModalNovoProcesso = ({ aberto, onFechar, onSalvar, processos }) => {
  const anoAtual = new Date().getFullYear();
  const [form, setForm] = useState({ titulo: '', ano: anoAtual, data_abertura: new Date().toISOString().split('T')[0] });
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (aberto) setForm({ titulo: '', ano: anoAtual, data_abertura: new Date().toISOString().split('T')[0] });
  }, [aberto]);

  // Recalcula o próximo número sempre que o ano mudar
  const calcProxNumero = (ano) => {
    const doAno = (processos || []).filter(p => p.ano === ano);
    return doAno.length > 0 ? Math.max(...doAno.map(p => p.numero)) + 1 : 1;
  };
  const proxNum = calcProxNumero(form.ano);

  const handleChangeAno = (e) => {
    const ano = parseInt(e.target.value) || anoAtual;
    setForm(p => ({ ...p, ano }));
  };

  if (!aberto) return null;
  return (
    <div style={overlayStyle} onClick={e => e.target === e.currentTarget && onFechar()}>
      <div style={modalBox()}>
        <div style={modalHeader}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>📁 Novo Processo de Sindicância</h3>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '1.4rem' }}>×</button>
        </div>
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ padding: '0.75rem', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', color: '#c9a84c', fontWeight: 600 }}>
            📋 Processo nº {proxNum}/{form.ano}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '0.75rem' }}>
            <div>
              <label style={lbl}>Título (opcional)</label>
              <input style={inp} value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Ex: Turma Retroativa 2025" />
            </div>
            <div>
              <label style={lbl}>Ano</label>
              <input style={inp} type="number" min="2000" max="2100" value={form.ano}
                onChange={handleChangeAno} />
            </div>
          </div>
          <div>
            <label style={lbl}>Data de Abertura</label>
            <input style={{ ...inp, colorScheme: 'dark' }} type="date" value={form.data_abertura}
              onChange={e => setForm(p => ({ ...p, data_abertura: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)' }}>
            <button onClick={onFechar} style={{ padding: '0.6rem 1.1rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer' }}>Cancelar</button>
            <button onClick={async () => { setSalvando(true); await onSalvar({ ...form, numero: proxNum }); setSalvando(false); }}
              disabled={salvando} style={{ ...btnPrimary, opacity: salvando ? 0.7 : 1 }}>
              {salvando ? 'Criando...' : '📁 Criar Processo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
//  Modal Histórico do Profano (busca global)
// ─────────────────────────────────────────────────────────────────
const ModalHistorico = ({ aberto, onFechar, nome, registros }) => {
  if (!aberto) return null;
  return (
    <div style={overlayStyle} onClick={e => e.target === e.currentTarget && onFechar()}>
      <div style={modalBox('720px')}>
        <div style={modalHeader}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
              📋 Histórico — {nome}
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '0.2rem 0 0' }}>
              {registros.length} ocorrência{registros.length !== 1 ? 's' : ''} em processos distintos
            </p>
          </div>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '1.4rem', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '70vh', overflowY: 'auto' }}>
          {registros.map((r, i) => {
            const sit = getSit(r.situacao);
            const proc = r.sindicancia_processos;
            const stProc = getStatus(proc?.status || 'em_andamento');
            return (
              <div key={r.id} style={{ background: 'var(--color-surface-2)', border: `1px solid var(--color-border)`, borderLeft: `4px solid ${sit.cor}`, borderRadius: 'var(--radius-lg)', padding: '1rem' }}>
                {/* Cabeçalho: processo + situação */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.6rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>
                      Processo {proc?.numero}/{proc?.ano}
                    </span>
                    {proc?.titulo && (
                      <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>— {proc.titulo}</span>
                    )}
                    <span style={{ padding: '0.15rem 0.55rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600, background: stProc.cor + '22', color: stProc.cor, border: `1px solid ${stProc.cor}44` }}>
                      {stProc.label}
                    </span>
                  </div>
                  <BadgeSit value={r.situacao} />
                </div>

                {/* Dados do candidato */}
                <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>
                  {r.idade          && <span>👤 {r.idade} anos</span>}
                  {r.estado_civil   && <span>💍 {r.estado_civil}</span>}
                  {r.profissao      && <span>💼 {r.profissao}</span>}
                  {r.local_trabalho && <span>🏢 {r.local_trabalho}</span>}
                  {r.cidade         && <span>📍 {r.cidade}</span>}
                  {r.indicado_por_irmao && <span>👤 Ir∴ {r.indicado_por_irmao}</span>}
                  {r.data_indicacao && <span>📅 Indicado em {new Date(r.data_indicacao + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                </div>

                {/* Motivo exclusão — visível apenas para Mestres e Admin */}
                {r.situacao === 'excluido' && r.motivo_exclusao && podeVerMotivo && (
                  <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius-sm)', padding: '0.45rem 0.75rem', fontSize: '0.8rem', color: '#ef4444', marginBottom: '0.35rem' }}>
                    ⚠️ <strong>Motivo da exclusão:</strong> {r.motivo_exclusao}
                  </div>
                )}

                {/* Observações — ocultas para não-Mestres em situações restritas */}
                {r.observacoes && (!['excluido','adiado','desistiu'].includes(r.situacao) || podeVerMotivo) && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                    💬 {r.observacoes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onFechar} style={{ padding: '0.6rem 1.25rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.875rem' }}>Fechar</button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
//  Componente Principal
// ─────────────────────────────────────────────────────────────────
const Sindicancia = ({ grauUsuario, userData }) => {
  // Controle de acesso
  const isMestre  = grauUsuario === 'Mestre' || grauUsuario === 'Mestre Instalado';
  const isAdmin   = userData?.nivel_acesso === 'admin';
  const isIrmao   = userData?.nivel_acesso === 'irmao' || userData?.nivel_acesso === 'cargo';

  // Todos os irmãos têm acesso de leitura
  const temAcesso = isAdmin || isMestre || isIrmao;
  // Pode ver motivo de exclusão do profano: apenas Mestres e Admin
  const podeverMotivo = isAdmin || isMestre;

  // Cargos que podem criar/editar/encerrar processos e candidatos
  const CARGOS_EDITORES = ['veneravel', 'Veneravel', 'orador', 'Orador', 'vigilante', 'Vigilante', '1o_vigilante', '2o_vigilante', 'secretario', 'Secretario', 'secretário', 'Secretário'];
  const podeEditarGlobal = isAdmin || CARGOS_EDITORES.includes(userData?.cargo);

  const [processos, setProcessos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [processoAtivo, setProcessoAtivo] = useState(null);
  const [modalNovo, setModalNovo] = useState(false);
  const [irmaos, setIrmaos] = useState([]);
  const [confirmExcluirProc, setConfirmExcluirProc] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [buscaGlobal, setBuscaGlobal] = useState('');
  const [resultadosBusca, setResultadosBusca] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [modalHistorico, setModalHistorico] = useState(false);
  const [historicoSelecionado, setHistoricoSelecionado] = useState({ nome: '', registros: [] });

  const carregarProcessos = async () => {
    setCarregando(true);
    await supabase.auth.refreshSession();
    const { data } = await supabase
      .from('sindicancia_processos')
      .select('*')
      .order('ano', { ascending: false })
      .order('numero', { ascending: false });
    setProcessos(data || []);
    setCarregando(false);
  };

  const carregarIrmaos = async () => {
    const { data } = await supabase.from('irmaos').select('id, nome').order('nome');
    setIrmaos(data || []);
  };

  const buscarGlobal = async (termo) => {
    if (!termo.trim()) { setResultadosBusca([]); return; }
    setBuscando(true);
    await supabase.auth.refreshSession();
    const { data } = await supabase
      .from('sindicancia_candidatos')
      .select(`
        *,
        sindicancia_processos (numero, ano, titulo, status)
      `)
      .ilike('nome', `%${termo.trim()}%`)
      .order('criado_em', { ascending: false });
    setResultadosBusca(data || []);
    setBuscando(false);
  };

  const abrirHistorico = (nome, registros) => {
    setHistoricoSelecionado({ nome, registros });
    setModalHistorico(true);
  };

  useEffect(() => {
    if (temAcesso) { carregarProcessos(); carregarIrmaos(); }
  }, [temAcesso]);

  // Bloqueio de acesso
  if (!temAcesso) {
    return (
      <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ ...card, padding: '3rem', borderTop: '4px solid #ef4444' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.5rem' }}>
            Acesso Restrito
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: '1rem' }}>
            O módulo de <strong style={{ color: 'var(--color-text)' }}>Sindicância</strong> é de acesso exclusivo aos
            Mestres e ao corpo administrativo da loja.
          </p>
          <div style={{ padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: '#ef4444' }}>
            Seu grau atual: <strong>{grauUsuario || 'Não identificado'}</strong>
          </div>
        </div>
      </div>
    );
  }

  const handleCriarProcesso = async (form) => {
    await supabase.auth.refreshSession();
    const { data, error } = await supabase.from('sindicancia_processos').insert({
      numero: form.numero,
      ano: form.ano,
      titulo: form.titulo || null,
      data_abertura: form.data_abertura,
      aberto_por: userData?.nome || userData?.email || null,
      status: 'em_andamento',
    }).select().single();
    if (!error && data) {
      setModalNovo(false);
      await carregarProcessos();
      setProcessoAtivo(data);
    }
  };

  const handleExcluirProcesso = async () => {
    if (!confirmExcluirProc) return;
    await supabase.from('sindicancia_candidatos').delete().eq('processo_id', confirmExcluirProc.id);
    await supabase.from('sindicancia_processos').delete().eq('id', confirmExcluirProc.id);
    setConfirmExcluirProc(null);
    await carregarProcessos();
  };

  const listaFiltrada = filtroStatus === 'todos' ? processos : processos.filter(p => p.status === filtroStatus);

  // Se há processo ativo (detalhe aberto)
  if (processoAtivo) {
    return (
      <div style={{ padding: '1.5rem', maxWidth: '1100px', margin: '0 auto' }}>
        <DetalheProcesso
          processo={processoAtivo}
          onVoltar={() => setProcessoAtivo(null)}
          irmaos={irmaos}
          podeEditar={podeEditarGlobal}
          podeVerMotivo={podeverMotivo}
          onProcessoAtualizado={async () => {
            await carregarProcessos();
            // Atualizar processo ativo com dados frescos
            const { data } = await supabase.from('sindicancia_processos').select('*').eq('id', processoAtivo.id).single();
            if (data) setProcessoAtivo(data);
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1100px', margin: '0 auto' }}>

      {/* Cabeçalho */}
      <div style={{ ...card, marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: 'var(--radius-lg)', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
              🔍
            </div>
            <div>
              <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.2rem' }}>Sindicância</h1>
              <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                Controle de candidatos a iniciação — <span style={{ color: podeverMotivo ? '#ef4444' : 'var(--color-accent)', fontWeight: 600 }}>{podeverMotivo ? 'Mestres e Administração' : 'Somente visualização'}</span>
              </p>
            </div>
          </div>
          {podeEditarGlobal && (
            <button onClick={() => setModalNovo(true)} style={btnPrimary}>
              📁 Novo Processo
            </button>
          )}
        </div>

        {/* Busca Global */}
        <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-border)' }}>
          <label style={{ ...lbl, marginBottom: '0.4rem' }}>🔍 Busca Global — pesquisar em todos os processos</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              value={buscaGlobal}
              onChange={e => { setBuscaGlobal(e.target.value); if (!e.target.value.trim()) setResultadosBusca([]); }}
              onKeyDown={e => e.key === 'Enter' && buscarGlobal(buscaGlobal)}
              placeholder="Digite o nome do profano e pressione Enter..."
              style={{ ...inp, flex: 1 }}
            />
            <button onClick={() => buscarGlobal(buscaGlobal)} disabled={buscando} style={{ ...btnPrimary, whiteSpace: 'nowrap' }}>
              {buscando ? 'Buscando...' : '🔍 Buscar'}
            </button>
            {resultadosBusca.length > 0 && (
              <button onClick={() => { setBuscaGlobal(''); setResultadosBusca([]); }} style={{ padding: '0.55rem 0.75rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}>✕</button>
            )}
          </div>

          {/* Resultados da busca global */}
          {resultadosBusca.length > 0 && (() => {
            // Agrupar por nome normalizado
            const grupos = {};
            resultadosBusca.forEach(r => {
              const chave = r.nome.trim().toLowerCase();
              if (!grupos[chave]) grupos[chave] = { nome: r.nome, registros: [] };
              grupos[chave].registros.push(r);
            });
            return (
              <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
                  {resultadosBusca.length} ocorrência{resultadosBusca.length !== 1 ? 's' : ''} encontrada{resultadosBusca.length !== 1 ? 's' : ''} em {Object.keys(grupos).length} nome{Object.keys(grupos).length !== 1 ? 's' : ''}
                </div>
                {Object.values(grupos).map(g => (
                  <div key={g.nome} style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)', marginBottom: '0.3rem' }}>{g.nome}</div>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {g.registros.map(r => {
                          const sit = getSit(r.situacao);
                          const proc = r.sindicancia_processos;
                          return (
                            <span key={r.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600, background: sit.bg, color: sit.cor, border: `1px solid ${sit.cor}44` }}>
                              {proc?.numero}/{proc?.ano} · {sit.label}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <button onClick={() => abrirHistorico(g.nome, g.registros)} style={{ ...btnPrimary, padding: '0.4rem 0.85rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      📋 Ver Histórico
                    </button>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {[{ value: 'todos', label: `Todos (${processos.length})` }, ...STATUS_PROCESSO.map(s => ({ value: s.value, label: `${s.label} (${processos.filter(p => p.status === s.value).length})` }))].map(f => (
            <button key={f.value} onClick={() => setFiltroStatus(f.value)} style={{
              padding: '0.4rem 0.9rem', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', fontWeight: filtroStatus === f.value ? 600 : 500, cursor: 'pointer',
              background: filtroStatus === f.value ? 'rgba(201,168,76,0.12)' : 'var(--color-surface-2)',
              border: `1px solid ${filtroStatus === f.value ? 'rgba(201,168,76,0.35)' : 'var(--color-border)'}`,
              color: filtroStatus === f.value ? '#c9a84c' : 'var(--color-text-muted)',
            }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {carregando && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>Carregando processos...</div>
      )}

      {/* Vazio */}
      {!carregando && listaFiltrada.length === 0 && (
        <div style={{ ...card, textAlign: 'center', padding: '3rem', border: '1px dashed var(--color-border)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📂</div>
          <p style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.25rem' }}>Nenhum processo encontrado</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Clique em "📁 Novo Processo" para iniciar.</p>
        </div>
      )}

      {/* Lista de processos */}
      {!carregando && listaFiltrada.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {listaFiltrada.map(proc => {
            const st = getStatus(proc.status);
            return (
              <div key={proc.id} style={{ ...card, borderLeft: `4px solid ${st.cor}`, cursor: 'pointer', transition: 'border-color 0.15s' }}
                onClick={() => setProcessoAtivo(proc)}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                      <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>
                        Processo {proc.numero}/{proc.ano}
                      </span>
                      <span style={{ padding: '0.15rem 0.6rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600, background: st.cor + '22', color: st.cor, border: `1px solid ${st.cor}44` }}>
                        {st.label}
                      </span>
                    </div>
                    {proc.titulo && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.3rem' }}>{proc.titulo}</div>
                    )}
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      <span>📅 Aberto em {new Date(proc.data_abertura + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                      {proc.data_encerramento && <span>🔒 Encerrado em {new Date(proc.data_encerramento + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                    </div>
                    {proc.observacao_final && (
                      <div style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        💬 {proc.observacao_final}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => setProcessoAtivo(proc)} style={{ ...btnEdit, padding: '0.4rem 0.75rem' }}>
                      👁️ Abrir
                    </button>
                    {podeEditarGlobal && proc.status !== 'em_andamento' && (
                      <button onClick={() => setConfirmExcluirProc(proc)} style={{ ...btnDanger, padding: '0.4rem 0.6rem' }}>🗑️</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Histórico */}
      <ModalHistorico
        aberto={modalHistorico}
        onFechar={() => setModalHistorico(false)}
        nome={historicoSelecionado.nome}
        registros={historicoSelecionado.registros}
      />

      {/* Modal novo processo */}
      <ModalNovoProcesso aberto={modalNovo} onFechar={() => setModalNovo(false)}
        onSalvar={handleCriarProcesso} processos={processos} />

      {/* Confirm excluir processo */}
      {confirmExcluirProc && (
        <div style={overlayStyle}>
          <div style={modalBox('420px')}>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Excluir processo?</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
                O processo <strong style={{ color: 'var(--color-text)' }}>nº {confirmExcluirProc.numero}/{confirmExcluirProc.ano}</strong> e todos os seus candidatos serão excluídos permanentemente.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button onClick={() => setConfirmExcluirProc(null)} style={{ padding: '0.55rem 1.1rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={handleExcluirProcesso} style={{ ...btnDanger, padding: '0.55rem 1.25rem', fontWeight: 600 }}>Confirmar Exclusão</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sindicancia;
