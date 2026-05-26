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

const ModalCandidato = ({ aberto, onFechar, onSalvar, candidato, irmaos }) => {
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
const ModalSituacao = ({ aberto, onFechar, candidatos, processo }) => {
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
                      {c.situacao === 'excluido' && c.motivo_exclusao && (
                        <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.2rem' }}>
                          ⚠️ {c.motivo_exclusao}
                        </div>
                      )}
                      {c.observacoes && (
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
const DetalheProcesso = ({ processo, onVoltar, irmaos, onProcessoAtualizado }) => {
  const [candidatos, setCandidatos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modalCand, setModalCand] = useState(false);
  const [candEditando, setCandEditando] = useState(null);
  const [confirmExcluir, setConfirmExcluir] = useState(null);
  const [modalSituacao, setModalSituacao] = useState(false);
  const [modalEncerrar, setModalEncerrar] = useState(false);
  const [msg, setMsg] = useState('');

  const carregarCandidatos = async () => {
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

  const gerarPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'portrait', format: 'a4' });
    const pW = doc.internal.pageSize.getWidth();

    // Cabeçalho
    doc.setFillColor(26, 26, 26);
    doc.rect(0, 0, pW, 40, 'F');
    doc.setTextColor(201, 168, 76);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('A∴R∴L∴S∴ Acácia de Paranatinga nº 30', pW / 2, 14, { align: 'center' });
    doc.setTextColor(220, 220, 220);
    doc.setFontSize(10);
    doc.text(`Sindicância — Processo ${processo.numero}/${processo.ano}`, pW / 2, 22, { align: 'center' });
    if (processo.titulo) {
      doc.setFontSize(9);
      doc.text(processo.titulo, pW / 2, 29, { align: 'center' });
    }
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(8);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} — DOCUMENTO SIGILOSO`, pW / 2, 36, { align: 'center' });

    let y = 48;

    // Info do processo
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const stProc = getStatus(processo.status);
    doc.text(`Status: ${stProc.label}  |  Abertura: ${processo.data_abertura ? new Date(processo.data_abertura + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}  |  Candidatos: ${candidatos.length}`, 14, y);
    y += 6;
    if (processo.data_encerramento) {
      doc.text(`Encerramento: ${new Date(processo.data_encerramento + 'T00:00:00').toLocaleDateString('pt-BR')}`, 14, y);
      y += 6;
    }
    if (processo.observacao_final) {
      doc.setFont('helvetica', 'italic');
      const linhas = doc.splitTextToSize(`Observação Final: ${processo.observacao_final}`, pW - 28);
      doc.text(linhas, 14, y);
      y += linhas.length * 5 + 2;
    }
    y += 4;

    // Resumo por situação
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    doc.text('Resumo por Situação', 14, y); y += 6;

    const resumoData = SITUACOES.map(s => [
      s.label,
      candidatos.filter(c => c.situacao === s.value).length.toString()
    ]);
    autoTable(doc, {
      startY: y, head: [['Situação', 'Qtd']],
      body: resumoData,
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
      doc.text(`${sit.label} (${grupo.length})`, 14, y); y += 5;

      const rows = grupo.map(c => [
        c.nome,
        c.idade ? `${c.idade} anos` : '-',
        c.profissao || '-',
        c.cidade || '-',
        c.indicado_por_irmao ? `Ir∴ ${c.indicado_por_irmao}` : '-',
        sit.value === 'excluido' ? (c.motivo_exclusao || '-') : (c.observacoes || '-'),
      ]);

      autoTable(doc, {
        startY: y,
        head: [['Nome', 'Idade', 'Profissão', 'Cidade', 'Indicado por', sit.value === 'excluido' ? 'Motivo' : 'Observações']],
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
      doc.text('DOCUMENTO SIGILOSO — USO RESTRITO AOS MESTRES DA LOJA', pW / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
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
          {!encerrado && (
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

      {/* Lista de candidatos */}
      {carregando ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>Carregando...</div>
      ) : candidatos.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: '3rem', border: '1px dashed var(--color-border)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🔍</div>
          <p style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.25rem' }}>Nenhum candidato cadastrado</p>
          {!encerrado && <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Clique em "➕ Candidato" para começar.</p>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {candidatos.map(c => {
            const sit = getSit(c.situacao);
            return (
              <div key={c.id} style={{ ...card, borderLeft: `4px solid ${sit.cor}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)' }}>{c.nome}</span>
                      {c.idade && <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{c.idade} anos</span>}
                      <BadgeSit value={c.situacao} />
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      {c.estado_civil    && <span>💍 {c.estado_civil}</span>}
                      {c.profissao       && <span>💼 {c.profissao}</span>}
                      {c.local_trabalho  && <span>🏢 {c.local_trabalho}</span>}
                      {c.cidade          && <span>📍 {c.cidade}</span>}
                      {c.indicado_por_irmao && <span>👤 Ir∴ {c.indicado_por_irmao}</span>}
                      {c.data_indicacao  && <span>📅 {new Date(c.data_indicacao + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                    </div>
                    {c.situacao === 'excluido' && c.motivo_exclusao && (
                      <div style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: '#ef4444', background: 'rgba(239,68,68,0.08)', padding: '0.4rem 0.65rem', borderRadius: 'var(--radius-sm)' }}>
                        ⚠️ <strong>Motivo:</strong> {c.motivo_exclusao}
                      </div>
                    )}
                    {c.observacoes && (
                      <div style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        💬 {c.observacoes}
                      </div>
                    )}
                  </div>
                  {!encerrado && (
                    <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                      <button onClick={() => { setCandEditando(c); setModalCand(true); }} style={btnEdit} title="Editar">✏️</button>
                      <button onClick={() => setConfirmExcluir(c)} style={btnDanger} title="Excluir">🗑️</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modais */}
      <ModalCandidato aberto={modalCand} onFechar={() => { setModalCand(false); setCandEditando(null); }}
        onSalvar={handleSalvarCandidato} candidato={candEditando} irmaos={irmaos} />

      <ModalSituacao aberto={modalSituacao} onFechar={() => setModalSituacao(false)}
        candidatos={candidatos} processo={processo} />

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
const ModalNovoProcesso = ({ aberto, onFechar, onSalvar, proximoNumero }) => {
  const anoAtual = new Date().getFullYear();
  const [form, setForm] = useState({ titulo: '', ano: anoAtual, data_abertura: new Date().toISOString().split('T')[0] });
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (aberto) setForm({ titulo: '', ano: anoAtual, data_abertura: new Date().toISOString().split('T')[0] });
  }, [aberto]);

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
            📋 Processo nº {proximoNumero}/{form.ano}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '0.75rem' }}>
            <div>
              <label style={lbl}>Título (opcional)</label>
              <input style={inp} value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Ex: Turma de Candidatos 2026" />
            </div>
            <div>
              <label style={lbl}>Ano</label>
              <input style={inp} type="number" min="2000" max="2100" value={form.ano}
                onChange={e => setForm(p => ({ ...p, ano: parseInt(e.target.value) }))} />
            </div>
          </div>
          <div>
            <label style={lbl}>Data de Abertura</label>
            <input style={{ ...inp, colorScheme: 'dark' }} type="date" value={form.data_abertura}
              onChange={e => setForm(p => ({ ...p, data_abertura: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)' }}>
            <button onClick={onFechar} style={{ padding: '0.6rem 1.1rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer' }}>Cancelar</button>
            <button onClick={async () => { setSalvando(true); await onSalvar({ ...form, numero: proximoNumero }); setSalvando(false); }}
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
//  Componente Principal
// ─────────────────────────────────────────────────────────────────
const Sindicancia = ({ grauUsuario, userData }) => {
  // Controle de acesso
  const isMestre = grauUsuario === 'Mestre' || grauUsuario === 'Mestre Instalado';
  const isAdmin  = userData?.nivel_acesso === 'admin';
  const temAcesso = isMestre || isAdmin;

  const [processos, setProcessos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [processoAtivo, setProcessoAtivo] = useState(null);
  const [modalNovo, setModalNovo] = useState(false);
  const [irmaos, setIrmaos] = useState([]);
  const [confirmExcluirProc, setConfirmExcluirProc] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('todos');

  const carregarProcessos = async () => {
    setCarregando(true);
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

  const proxNumero = () => {
    const anoAtual = new Date().getFullYear();
    const deste = processos.filter(p => p.ano === anoAtual);
    return deste.length > 0 ? Math.max(...deste.map(p => p.numero)) + 1 : 1;
  };

  const handleCriarProcesso = async (form) => {
    const { data, error } = await supabase.from('sindicancia_processos').insert({
      numero: form.numero,
      ano: form.ano,
      titulo: form.titulo || null,
      data_abertura: form.data_abertura,
      aberto_por: userData?.id || null,
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
                Controle de candidatos a iniciação — <span style={{ color: '#ef4444', fontWeight: 600 }}>Uso restrito · Mestres e Administração</span>
              </p>
            </div>
          </div>
          <button onClick={() => setModalNovo(true)} style={btnPrimary}>
            📁 Novo Processo
          </button>
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
                    {proc.status !== 'em_andamento' && (
                      <button onClick={() => setConfirmExcluirProc(proc)} style={{ ...btnDanger, padding: '0.4rem 0.6rem' }}>🗑️</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal novo processo */}
      <ModalNovoProcesso aberto={modalNovo} onFechar={() => setModalNovo(false)}
        onSalvar={handleCriarProcesso} proximoNumero={proxNumero()} />

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
