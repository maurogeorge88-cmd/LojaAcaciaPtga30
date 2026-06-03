/**
 * EVENTOS COMEMORATIVOS
 * A∴R∴L∴S∴ Acácia de Paranatinga nº 30
 *
 * Controle financeiro de eventos (Dia das Mães, Dia dos Pais, etc.)
 * com rateio entre participantes.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────
const fmtR = (v) =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtD = (d) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

const hojeISO = () => new Date().toISOString().split('T')[0];

// ─────────────────────────────────────────────
//  Estilos base
// ─────────────────────────────────────────────
const inp = {
  width: '100%', padding: '0.55rem 0.85rem', fontSize: '0.875rem',
  background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)', color: 'var(--color-text)', outline: 'none',
  boxSizing: 'border-box',
};
const lbl = {
  display: 'block', fontSize: '0.75rem', fontWeight: 600,
  color: 'var(--color-text-muted)', marginBottom: '0.3rem',
  textTransform: 'uppercase', letterSpacing: '0.04em',
};
const card = {
  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)', padding: '1.1rem',
};
const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
  zIndex: 1000, padding: '1rem', overflowY: 'auto',
};
const modalBox = (w = '540px') => ({
  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: w, marginTop: '0.5rem',
});
const mHead = {
  background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)',
  padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between',
  alignItems: 'center', borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
};
const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
  padding: '0.55rem 1.1rem', borderRadius: 'var(--radius-md)',
  background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.35)',
  color: '#c9a84c', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
};
const btnDanger = {
  padding: '0.3rem 0.55rem', borderRadius: 'var(--radius-sm)',
  background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
  color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
};
const btnEdit = {
  padding: '0.3rem 0.55rem', borderRadius: 'var(--radius-sm)',
  background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
  color: 'var(--color-accent)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
};

// ─────────────────────────────────────────────
//  Modal Novo/Editar Evento
// ─────────────────────────────────────────────
const EVENTO_VAZIO = {
  nome: '', ano: new Date().getFullYear(), data_evento: '',
  descricao: '', idade_gratuita: 5, idade_meia: 11, valor_ajustado: '', contribuicao_loja: '',
};

const ModalEvento = ({ aberto, onFechar, onSalvar, eventoEdit }) => {
  const [form, setForm] = useState(EVENTO_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (aberto) {
      setForm(eventoEdit ? {
        nome: eventoEdit.nome,
        ano: eventoEdit.ano,
        data_evento: eventoEdit.data_evento || '',
        descricao: eventoEdit.descricao || '',
        idade_gratuita: eventoEdit.idade_gratuita ?? 5,
        idade_meia: eventoEdit.idade_meia ?? 11,
        valor_ajustado: eventoEdit.valor_ajustado || '',
        contribuicao_loja: eventoEdit.contribuicao_loja || '',
      } : EVENTO_VAZIO);
      setErro('');
    }
  }, [aberto, eventoEdit]);

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSalvar = async () => {
    if (!form.nome.trim()) { setErro('Informe o nome do evento.'); return; }
    if (!form.ano) { setErro('Informe o ano.'); return; }
    setSalvando(true); setErro('');
    try { await onSalvar(form); }
    catch (e) { setErro(e.message); }
    finally { setSalvando(false); }
  };

  if (!aberto) return null;
  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onFechar()}>
      <div style={modalBox('560px')}>
        <div style={mHead}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
            {eventoEdit ? '✏️ Editar Evento' : '🎉 Novo Evento Comemorativo'}
          </h3>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '1.4rem', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '0.75rem' }}>
            <div>
              <label style={lbl}>Nome do Evento *</label>
              <input style={inp} value={form.nome} onChange={e => f('nome', e.target.value)} placeholder="Ex: Sessão Dia das Mães" autoFocus />
            </div>
            <div>
              <label style={lbl}>Ano *</label>
              <input style={inp} type="number" min="2000" max="2100" value={form.ano} onChange={e => f('ano', parseInt(e.target.value))} />
            </div>
          </div>

          <div>
            <label style={lbl}>Data do Evento</label>
            <input style={{ ...inp, colorScheme: 'dark' }} type="date" value={form.data_evento} onChange={e => f('data_evento', e.target.value)} />
          </div>

          <div>
            <label style={lbl}>Descrição</label>
            <textarea style={{ ...inp, resize: 'vertical' }} rows={2} value={form.descricao} onChange={e => f('descricao', e.target.value)} placeholder="Observações sobre o evento..." />
          </div>

          {/* Faixas etárias */}
          <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.85rem' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.65rem' }}>
              🎂 Faixas Etárias para Rateio
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={lbl}>Gratuidade — até idade</label>
                <input style={inp} type="number" min="0" max="17" value={form.idade_gratuita} onChange={e => f('idade_gratuita', parseInt(e.target.value))} />
                <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>Crianças até esta idade = 0 cotas</p>
              </div>
              <div>
                <label style={lbl}>Meia-cota — até idade</label>
                <input style={inp} type="number" min="0" max="17" value={form.idade_meia} onChange={e => f('idade_meia', parseInt(e.target.value))} />
                <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>Crianças até esta idade = 0,5 cotas</p>
              </div>
            </div>
          </div>

          {/* Contribuição da Loja */}
          <div>
            <label style={lbl}>Contribuição da Loja (R$)</label>
            <input style={inp} type="number" step="0.01" min="0" value={form.contribuicao_loja} onChange={e => f('contribuicao_loja', e.target.value)} placeholder="Ex: 500.00 — será abatido das despesas antes do rateio" />
            <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>Valor que a loja paga — reduz a base do rateio entre os irmãos</p>
          </div>

          {/* Valor ajustado */}
          <div>
            <label style={lbl}>Valor por Cota Ajustado (R$)</label>
            <input style={inp} type="number" step="0.01" min="0" value={form.valor_ajustado} onChange={e => f('valor_ajustado', e.target.value)} placeholder="Calculado automaticamente — ajuste aqui se necessário" />
            <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>Deixe em branco para usar o valor calculado pelas despesas</p>
          </div>

          {erro && <div style={{ padding: '0.6rem 0.85rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: '#ef4444' }}>{erro}</div>}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)' }}>
            <button onClick={onFechar} style={{ padding: '0.6rem 1.1rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer' }}>Cancelar</button>
            <button onClick={handleSalvar} disabled={salvando} style={{ ...btnPrimary, opacity: salvando ? 0.7 : 1 }}>
              {salvando ? 'Salvando...' : eventoEdit ? '💾 Salvar' : '🎉 Criar Evento'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
//  Modal Participante
// ─────────────────────────────────────────────
const PART_VAZIO = {
  tipo: 'irmao', // 'irmao' | 'externo'
  irmao_id: '',
  nome_externo: '',
  adultos_convidados: 0,
  criancas_meia: 0,
  criancas_gratuitas: 0,
};

const ModalParticipante = ({ aberto, onFechar, onSalvar, partEdit, irmaos, evento }) => {
  const [form, setForm] = useState(PART_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (aberto) {
      setForm(partEdit ? {
        tipo: partEdit.irmao_id ? 'irmao' : 'externo',
        irmao_id: partEdit.irmao_id || '',
        nome_externo: partEdit.nome_externo || '',
        adultos_convidados: partEdit.adultos_convidados || 0,
        criancas_meia: partEdit.criancas_meia || 0,
        criancas_gratuitas: partEdit.criancas_gratuitas || 0,
      } : PART_VAZIO);
      setErro('');
    }
  }, [aberto, partEdit]);

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Cálculo de cotas em tempo real
  const cotaCalc = 1 + (parseInt(form.adultos_convidados) || 0) + ((parseInt(form.criancas_meia) || 0) * 0.5);
  const valorEstimado = evento?.valor_ajustado ? cotaCalc * parseFloat(evento.valor_ajustado) : null;

  const handleSalvar = async () => {
    if (form.tipo === 'irmao' && !form.irmao_id) { setErro('Selecione um irmão.'); return; }
    if (form.tipo === 'externo' && !form.nome_externo.trim()) { setErro('Informe o nome do convidado externo.'); return; }
    setSalvando(true); setErro('');
    try { await onSalvar({ ...form, cotas: cotaCalc }); }
    catch (e) { setErro(e.message); }
    finally { setSalvando(false); }
  };

  if (!aberto) return null;

  const numStyle = { ...inp, textAlign: 'center' };

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onFechar()}>
      <div style={modalBox('520px')}>
        <div style={mHead}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
            {partEdit ? '✏️ Editar Participante' : '👤 Adicionar Participante'}
          </h3>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '1.4rem', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

          {/* Tipo */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {[['irmao','👤 Irmão da Loja'],['externo','🌍 Convidado Externo']].map(([v,l]) => (
              <button key={v} onClick={() => f('tipo', v)} style={{
                flex: 1, padding: '0.6rem', borderRadius: 'var(--radius-md)',
                border: `1px solid ${form.tipo === v ? 'rgba(201,168,76,0.4)' : 'var(--color-border)'}`,
                background: form.tipo === v ? 'rgba(201,168,76,0.12)' : 'var(--color-surface-2)',
                color: form.tipo === v ? '#c9a84c' : 'var(--color-text-muted)',
                fontWeight: form.tipo === v ? 700 : 500, cursor: 'pointer', fontSize: '0.85rem',
              }}>{l}</button>
            ))}
          </div>

          {/* Irmão ou externo */}
          {form.tipo === 'irmao' ? (
            <div>
              <label style={lbl}>Irmão *</label>
              <select style={inp} value={form.irmao_id} onChange={e => f('irmao_id', e.target.value)}>
                <option value="">Selecione...</option>
                {irmaos.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label style={lbl}>Nome do Convidado Externo *</label>
              <input style={inp} value={form.nome_externo} onChange={e => f('nome_externo', e.target.value)} placeholder="Nome completo" />
            </div>
          )}

          {/* Convidados */}
          <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.85rem' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.65rem' }}>
              👥 Composição do Grupo
              <span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: '0.5rem' }}>
                (o próprio participante já é contado como 1 adulto)
              </span>
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem' }}>
              <div>
                <label style={lbl}>Adultos Convidados</label>
                <input style={numStyle} type="number" min="0" max="99" value={form.adultos_convidados} onChange={e => f('adultos_convidados', parseInt(e.target.value) || 0)} />
                <p style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginTop: '0.2rem', textAlign: 'center' }}>cota cheia cada</p>
              </div>
              <div>
                <label style={lbl}>Crianças {evento?.idade_gratuita + 1 || 6}–{evento?.idade_meia || 11} anos</label>
                <input style={numStyle} type="number" min="0" max="99" value={form.criancas_meia} onChange={e => f('criancas_meia', parseInt(e.target.value) || 0)} />
                <p style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginTop: '0.2rem', textAlign: 'center' }}>meia cota cada</p>
              </div>
              <div>
                <label style={lbl}>Crianças ≤{evento?.idade_gratuita || 5} anos</label>
                <input style={numStyle} type="number" min="0" max="99" value={form.criancas_gratuitas} onChange={e => f('criancas_gratuitas', parseInt(e.target.value) || 0)} />
                <p style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginTop: '0.2rem', textAlign: 'center' }}>gratuito</p>
              </div>
            </div>
          </div>

          {/* Preview de cotas */}
          <div style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 'var(--radius-md)', padding: '0.85rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: '0.15rem' }}>TOTAL DE COTAS</p>
              <p style={{ fontSize: '1.4rem', fontWeight: 800, color: '#c9a84c' }}>{cotaCalc.toFixed(1)}</p>
            </div>
            {valorEstimado !== null && (
              <div>
                <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: '0.15rem' }}>VALOR ESTIMADO</p>
                <p style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>{fmtR(valorEstimado)}</p>
              </div>
            )}
          </div>

          {erro && <div style={{ padding: '0.6rem 0.85rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: '#ef4444' }}>{erro}</div>}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)' }}>
            <button onClick={onFechar} style={{ padding: '0.6rem 1.1rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer' }}>Cancelar</button>
            <button onClick={handleSalvar} disabled={salvando} style={{ ...btnPrimary, opacity: salvando ? 0.7 : 1 }}>
              {salvando ? 'Salvando...' : partEdit ? '💾 Salvar' : '👤 Adicionar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
//  Tabela de Participantes separada por grupo
// ─────────────────────────────────────────────
const TabelaParticipantes = ({ participantes, valorCota, encerrado, setPartEdit, setModalPart, setConfirmExcluirPart, totalCotas, btnEdit, btnDanger }) => {
  const irmaos_part   = participantes.filter(p => p.irmao_id);
  const externos_part = participantes.filter(p => !p.irmao_id);

  const thS = (center) => ({
    padding: '0.5rem 0.65rem',
    textAlign: center ? 'center' : 'left',
    fontSize: '0.7rem', fontWeight: 700,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase', whiteSpace: 'nowrap',
  });

  const Cabecalho = () => (
    <thead>
      <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
        <th style={thS(false)}>Participante</th>
        <th style={thS(true)}>Adultos<br/>(ele+conv.)</th>
        <th style={thS(true)}>C.Meia</th>
        <th style={thS(true)}>C.Grat.</th>
        <th style={thS(true)}>Cotas</th>
        <th style={thS(true)}>Valor a Pagar</th>
        <th style={thS(true)}></th>
      </tr>
    </thead>
  );

  const Linha = ({ p, i }) => (
    <tr style={{ borderBottom: '1px solid var(--color-border)', background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.06)' }}>
      <td style={{ padding: '0.55rem 0.65rem', fontWeight: 600, color: 'var(--color-text)' }}>
        {p.irmao_id ? (p.irmaos?.nome || '?') : (p.nome_externo || '?')}
      </td>
      <td style={{ padding: '0.55rem 0.65rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>1+{p.adultos_convidados}</td>
      <td style={{ padding: '0.55rem 0.65rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>{p.criancas_meia}</td>
      <td style={{ padding: '0.55rem 0.65rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>{p.criancas_gratuitas}</td>
      <td style={{ padding: '0.55rem 0.65rem', textAlign: 'center', fontWeight: 700, color: '#3b82f6' }}>{parseFloat(p.cotas).toFixed(1)}</td>
      <td style={{ padding: '0.55rem 0.65rem', textAlign: 'center', fontWeight: 700, color: '#10b981' }}>
        {valorCota > 0 ? fmtR(parseFloat(p.cotas) * valorCota) : '—'}
      </td>
      {!encerrado ? (
        <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>
          <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
            <button onClick={() => { setPartEdit(p); setModalPart(true); }} style={btnEdit}>✏️</button>
            <button onClick={() => setConfirmExcluirPart(p)} style={btnDanger}>🗑️</button>
          </div>
        </td>
      ) : <td />}
    </tr>
  );

  const SubtotalRow = ({ lista, cor, label }) => {
    const cotas = lista.reduce((s, p) => s + parseFloat(p.cotas), 0);
    const valor = lista.reduce((s, p) => s + parseFloat(p.cotas) * valorCota, 0);
    return (
      <tr style={{ background: 'var(--color-surface-2)', borderTop: '1px solid var(--color-border)' }}>
        <td style={{ padding: '0.45rem 0.65rem', fontWeight: 700, color: cor, fontSize: '0.78rem' }}>Subtotal {label}</td>
        <td colSpan={3} />
        <td style={{ padding: '0.45rem 0.65rem', textAlign: 'center', fontWeight: 700, color: '#3b82f6', fontSize: '0.85rem' }}>{cotas.toFixed(1)}</td>
        <td style={{ padding: '0.45rem 0.65rem', textAlign: 'center', fontWeight: 700, color: '#10b981', fontSize: '0.85rem' }}>{valorCota > 0 ? fmtR(valor) : '—'}</td>
        <td />
      </tr>
    );
  };

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>

        {/* Grupo Irmãos */}
        {irmaos_part.length > 0 && (
          <>
            <thead>
              <tr style={{ background: 'rgba(201,168,76,0.12)' }}>
                <th colSpan={7} style={{ padding: '0.45rem 0.65rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#c9a84c', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  👤 Irmãos da Loja ({irmaos_part.length})
                </th>
              </tr>
            </thead>
            <Cabecalho />
            <tbody>
              {irmaos_part.map((p, i) => <Linha key={p.id} p={p} i={i} />)}
              {externos_part.length > 0 && <SubtotalRow lista={irmaos_part} cor='#c9a84c' label='Irmãos' />}
            </tbody>
          </>
        )}

        {/* Grupo Externos */}
        {externos_part.length > 0 && (
          <>
            <thead>
              <tr style={{ background: 'rgba(99,102,241,0.12)', borderTop: irmaos_part.length > 0 ? '2px solid var(--color-border)' : 'none' }}>
                <th colSpan={7} style={{ padding: '0.45rem 0.65rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  🌍 Convidados Externos ({externos_part.length})
                </th>
              </tr>
            </thead>
            <Cabecalho />
            <tbody>
              {externos_part.map((p, i) => <Linha key={p.id} p={p} i={i} />)}
              {irmaos_part.length > 0 && <SubtotalRow lista={externos_part} cor='#6366f1' label='Externos' />}
            </tbody>
          </>
        )}

        {/* Total geral */}
        <tfoot>
          <tr style={{ background: 'var(--color-surface-2)', borderTop: '2px solid var(--color-border)' }}>
            <td colSpan={4} style={{ padding: '0.55rem 0.65rem', fontWeight: 700, color: 'var(--color-text)' }}>TOTAL GERAL</td>
            <td style={{ padding: '0.55rem 0.65rem', textAlign: 'center', fontWeight: 800, color: '#3b82f6' }}>{totalCotas.toFixed(1)}</td>
            <td style={{ padding: '0.55rem 0.65rem', textAlign: 'center', fontWeight: 800, color: '#10b981' }}>
              {valorCota > 0 ? fmtR(participantes.reduce((s, p) => s + parseFloat(p.cotas) * valorCota, 0)) : '—'}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

// ─────────────────────────────────────────────
//  Detalhe do Evento
// ─────────────────────────────────────────────
const DetalheEvento = ({ evento: eventoInit, onVoltar, irmaos, showSuccess, showError, onEventoAtualizado }) => {
  const [evento, setEvento] = useState(eventoInit);
  const [despesas, setDespesas] = useState([]);
  const [participantes, setParticipantes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modalPart, setModalPart] = useState(false);
  const [partEdit, setPartEdit] = useState(null);
  const [modalEvento, setModalEvento] = useState(false);
  const [confirmExcluirPart, setConfirmExcluirPart] = useState(null);
  const [confirmEncerrar, setConfirmEncerrar] = useState(false);
  const [editandoValor, setEditandoValor] = useState(false);
  const [novoValor, setNovoValor] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [{ data: desp }, { data: parts }, { data: ev }] = await Promise.all([
      supabase.from('lancamentos_loja').select('id,descricao,valor,data_pagamento,data_vencimento,status,tipo_pagamento,tipo').eq('evento_comemorativo_id', evento.id).order('data_vencimento'),
      supabase.from('evento_rateio_participantes').select('*, irmaos(nome)').eq('evento_id', evento.id).order('criado_em'),
      supabase.from('eventos_comemorativos_fin').select('*').eq('id', evento.id).single(),
    ]);
    setDespesas(desp || []);
    setParticipantes(parts || []);
    if (ev) setEvento(ev);
    setCarregando(false);
  }, [evento.id]);

  useEffect(() => { carregar(); }, [carregar]);

  // ── Cálculos ──
  const totalDespesas    = despesas.filter(d => d.tipo === 'despesa' && d.status === 'pago').reduce((s, d) => s + parseFloat(d.valor), 0);
  const contribuicaoLoja = evento.contribuicao_loja ? parseFloat(evento.contribuicao_loja) : 0;
  const baseRateio       = Math.max(0, totalDespesas - contribuicaoLoja);
  const totalCotas       = participantes.reduce((s, p) => s + parseFloat(p.cotas || 0), 0);
  const valorCalc        = totalCotas > 0 ? baseRateio / totalCotas : 0;
  const valorCota        = evento.valor_ajustado ? parseFloat(evento.valor_ajustado) : valorCalc;

  // ── Salvar participante ──
  const handleSalvarPart = async (form) => {
    const cotas = parseFloat(form.cotas);
    const payload = {
      evento_id: evento.id,
      irmao_id: form.tipo === 'irmao' ? parseInt(form.irmao_id) : null,
      nome_externo: form.tipo === 'externo' ? form.nome_externo.trim() : null,
      adultos_convidados: parseInt(form.adultos_convidados) || 0,
      criancas_meia: parseInt(form.criancas_meia) || 0,
      criancas_gratuitas: parseInt(form.criancas_gratuitas) || 0,
      cotas,
      valor_final: evento.valor_ajustado ? cotas * parseFloat(evento.valor_ajustado) : null,
    };
    if (partEdit) {
      const { error } = await supabase.from('evento_rateio_participantes').update(payload).eq('id', partEdit.id);
      if (error) throw error;
      showSuccess('✅ Participante atualizado!');
    } else {
      const { error } = await supabase.from('evento_rateio_participantes').insert(payload);
      if (error) throw error;
      showSuccess('✅ Participante adicionado!');
    }
    setModalPart(false); setPartEdit(null);
    carregar();
  };

  // ── Excluir participante ──
  const handleExcluirPart = async () => {
    const { error } = await supabase.from('evento_rateio_participantes').delete().eq('id', confirmExcluirPart.id);
    if (!error) { setConfirmExcluirPart(null); showSuccess('🗑️ Removido.'); carregar(); }
    else showError('Erro ao remover.');
  };

  // ── Encerrar evento ──
  const handleEncerrar = async () => {
    const { error } = await supabase.from('eventos_comemorativos_fin').update({ status: 'encerrado', data_encerramento: hojeISO() }).eq('id', evento.id);
    if (!error) { setConfirmEncerrar(false); showSuccess('✅ Evento encerrado.'); carregar(); onEventoAtualizado(); }
    else showError('Erro ao encerrar.');
  };

  // ── Salvar valor ajustado ──
  const handleSalvarValor = async () => {
    const val = parseFloat(novoValor) || null;
    const { error } = await supabase.from('eventos_comemorativos_fin').update({ valor_ajustado: val }).eq('id', evento.id);
    if (!error) { setEditandoValor(false); showSuccess('✅ Valor atualizado!'); carregar(); onEventoAtualizado(); }
    else showError('Erro ao salvar valor.');
  };

  // ── Recalcular valores dos participantes ──
  const recalcularParticipantes = async () => {
    if (valorCota <= 0) { showError('Defina o valor ajustado por cota antes de salvar.'); return; }
    for (const p of participantes) {
      await supabase.from('evento_rateio_participantes').update({ valor_final: parseFloat(p.cotas) * valorCota }).eq('id', p.id);
    }
    showSuccess('✅ Valores persistidos no banco!');
    carregar();
  };

  // ── Gerar PDF ──
  const gerarPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const s = (str) => { if (!str) return ''; let r = ''; for (const c of str.normalize('NFD')) { if (c.charCodeAt(0) < 128) r += c; } return r; };
    const doc = new jsPDF({ orientation: 'portrait', format: 'a4' });
    const pW = doc.internal.pageSize.getWidth();

    // Cabeçalho
    doc.setFillColor(26, 26, 26);
    doc.rect(0, 0, pW, 42, 'F');
    doc.setTextColor(201, 168, 76);
    doc.setFontSize(13); doc.setFont('helvetica', 'bold');
    doc.text('A.R.L.S. Acacia de Paranatinga no 30', pW / 2, 14, { align: 'center' });
    doc.setTextColor(220, 220, 220);
    doc.setFontSize(11);
    doc.text(`Evento Comemorativo - ${s(evento.nome)} ${evento.ano}`, pW / 2, 23, { align: 'center' });
    doc.setFontSize(8); doc.setTextColor(160, 160, 160);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, pW / 2, 32, { align: 'center' });
    if (evento.data_evento) doc.text(`Data do Evento: ${fmtD(evento.data_evento)}`, pW / 2, 38, { align: 'center' });

    let y = 52;

    // Resumo financeiro
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
    doc.text('Resumo Financeiro', 14, y); y += 5;
    autoTable(doc, {
      startY: y,
      body: [
        ['Total de Despesas', `R$ ${totalDespesas.toFixed(2).replace('.', ',')}`],
        ...(contribuicaoLoja > 0 ? [['Contribuicao da Loja', `- R$ ${contribuicaoLoja.toFixed(2).replace('.', ',')}`], ['Base do Rateio', `R$ ${baseRateio.toFixed(2).replace('.', ',')}`]] : []),
        ['Total de Cotas', totalCotas.toFixed(1)],
        ['Valor Calculado por Cota', `R$ ${valorCalc.toFixed(2).replace('.', ',')}`],
        ['Valor Ajustado por Cota', evento.valor_ajustado ? `R$ ${parseFloat(evento.valor_ajustado).toFixed(2).replace('.', ',')}` : 'Nao definido'],
      ],
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [40, 40, 40] },
      columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 10;

    // Despesas
    if (despesas.length > 0) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
      doc.text(`Despesas Vinculadas (${despesas.length})`, 14, y); y += 5;
      autoTable(doc, {
        startY: y,
        head: [['Data', 'Descricao', 'Status', 'Valor']],
        body: despesas.map(d => [
          fmtD(d.data_vencimento),
          s(d.descricao || ''),
          d.status === 'pago' ? 'Pago' : 'Pendente',
          `R$ ${parseFloat(d.valor).toFixed(2).replace('.', ',')}`,
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [55, 55, 55], textColor: 255 },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } },
        margin: { left: 14, right: 14 },
      });
      y = doc.lastAutoTable.finalY + 10;
    }

    // Rateio
    if (participantes.length > 0) {
      if (y > 200) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
      doc.text(`Rateio entre Participantes (${participantes.length})`, 14, y); y += 5;
      autoTable(doc, {
        startY: y,
        head: [['Participante', 'Tipo', 'Adultos', 'C.Meia', 'C.Grat.', 'Cotas', 'Valor a Pagar']],
        body: participantes.map(p => [
          s(p.irmao_id ? (p.irmaos?.nome || '') : (p.nome_externo || '')),
          p.irmao_id ? 'Irmao' : 'Externo',
          `1+${p.adultos_convidados}`,
          p.criancas_meia,
          p.criancas_gratuitas,
          parseFloat(p.cotas).toFixed(1),
          valorCota > 0 ? `R$ ${(parseFloat(p.cotas) * valorCota).toFixed(2).replace('.', ',')}` : '-',
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [40, 40, 40], textColor: 255 },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        columnStyles: {
          0: { cellWidth: 45 },
          6: { halign: 'right', fontStyle: 'bold' },
        },
        margin: { left: 14, right: 14 },
      });
      y = doc.lastAutoTable.finalY + 6;

      // Total do rateio
      const totalRateio = valorCota > 0 ? participantes.reduce((s, p) => s + parseFloat(p.cotas) * valorCota, 0) : 0;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(40, 40, 40);
      doc.text(`Total do Rateio: R$ ${totalRateio.toFixed(2).replace('.', ',')}`, pW - 14, y, { align: 'right' });
    }

    // Rodapé em todas as páginas
    const total = doc.internal.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFontSize(7); doc.setTextColor(180, 180, 180);
      doc.text(`Pagina ${i} de ${total}`, pW - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
    }

    doc.save(`Evento_${s(evento.nome)}_${evento.ano}.pdf`);
    showSuccess('📄 PDF gerado!');
  };

  const encerrado = evento.status === 'encerrado';

  return (
    <>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={onVoltar} style={{ ...btnEdit, padding: '0.4rem 0.8rem' }}>← Voltar</button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)' }}>{evento.nome} — {evento.ano}</span>
              <span style={{ padding: '0.15rem 0.6rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600, background: encerrado ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: encerrado ? '#10b981' : '#f59e0b', border: encerrado ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(245,158,11,0.4)' }}>
                {encerrado ? '✅ Encerrado' : '⚙️ Em Aberto'}
              </span>
            </div>
            {evento.data_evento && <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>📅 {fmtD(evento.data_evento)}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button onClick={() => setModalEvento(true)} style={{ ...btnEdit, padding: '0.45rem 0.85rem' }}>✏️ Editar</button>
          <button onClick={gerarPDF} style={{ ...btnPrimary, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.35)', color: '#3b82f6' }}>📄 PDF</button>
          {!encerrado && <button onClick={() => setConfirmEncerrar(true)} style={{ ...btnPrimary, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444' }}>🔒 Encerrar</button>}
        </div>
      </div>

      {carregando ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>Carregando...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Cards de resumo */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.65rem' }}>
            {[
              { label: 'Total Despesas', val: fmtR(totalDespesas), cor: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
              ...(contribuicaoLoja > 0 ? [
                { label: 'Contribuição Loja', val: fmtR(contribuicaoLoja), cor: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
                { label: 'Base do Rateio', val: fmtR(baseRateio), cor: '#f97316', bg: 'rgba(249,115,22,0.1)' },
              ] : []),
              { label: 'Total Cotas', val: totalCotas.toFixed(1), cor: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
              { label: 'Valor/Cota Calculado', val: fmtR(valorCalc), cor: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
              { label: 'Valor/Cota Ajustado', val: evento.valor_ajustado ? fmtR(parseFloat(evento.valor_ajustado)) : '—', cor: '#10b981', bg: 'rgba(16,185,129,0.1)' },
            ].map(({ label, val, cor, bg }) => (
              <div key={label} style={{ background: 'var(--color-surface)', border: `1px solid ${cor}33`, borderRadius: 'var(--radius-md)', padding: '0.75rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>{label}</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: cor }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Ajuste de valor */}
          <div style={{ ...card, borderLeft: '4px solid #c9a84c' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <p style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.9rem', marginBottom: '0.15rem' }}>🎯 Ajuste do Valor por Cota</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  {contribuicaoLoja > 0 && <>Base do rateio: <strong style={{ color: '#f97316' }}>{fmtR(baseRateio)}</strong> (Loja contribui {fmtR(contribuicaoLoja)}) · </>}
                  Calculado: <strong>{fmtR(valorCalc)}</strong>
                  {evento.valor_ajustado && <> → Ajustado: <strong style={{ color: '#10b981' }}>{fmtR(parseFloat(evento.valor_ajustado))}</strong></>}
                </p>
              </div>
              {editandoValor ? (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input style={{ ...inp, width: '140px' }} type="number" step="0.01" min="0" value={novoValor} onChange={e => setNovoValor(e.target.value)} placeholder="Ex: 145.00" autoFocus />
                  <button onClick={handleSalvarValor} style={btnPrimary}>💾</button>
                  <button onClick={() => setEditandoValor(false)} style={{ ...btnEdit }}>✕</button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => { setNovoValor(evento.valor_ajustado || valorCalc.toFixed(2)); setEditandoValor(true); }}
                    style={{ ...btnPrimary }}>✏️ Ajustar Valor</button>
                  {participantes.length > 0 && valorCota > 0 && (
                    <button onClick={recalcularParticipantes} style={{ ...btnPrimary, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.35)', color: '#8b5cf6' }}>
                      🔄 Recalcular
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Despesas vinculadas */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                💸 Despesas Vinculadas ({despesas.length})
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Vincule despesas via FinançasLoja → campo "Evento Comemorativo"
              </span>
            </div>
            {despesas.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '1.5rem', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                Nenhuma despesa vinculada. Registre despesas na FinançasLoja e selecione este evento.
              </p>
            ) : (
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                      {['Data','Descrição','Status','Tipo Pag.','Valor'].map(h => (
                        <th key={h} style={{ padding: '0.55rem 0.75rem', textAlign: h === 'Valor' ? 'right' : 'left', fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {despesas.map((d, i) => (
                      <tr key={d.id} style={{ borderBottom: '1px solid var(--color-border)', background: i % 2 === 0 ? 'transparent' : 'var(--color-surface-2)' }}>
                        <td style={{ padding: '0.55rem 0.75rem', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>{fmtD(d.data_vencimento)}</td>
                        <td style={{ padding: '0.55rem 0.75rem', fontWeight: 600, color: 'var(--color-text)' }}>{d.descricao}</td>
                        <td style={{ padding: '0.55rem 0.75rem' }}>
                          <span style={{ padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600, background: d.status === 'pago' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: d.status === 'pago' ? '#10b981' : '#f59e0b' }}>
                            {d.status === 'pago' ? '✅ Pago' : '⏳ Pendente'}
                          </span>
                        </td>
                        <td style={{ padding: '0.55rem 0.75rem', color: 'var(--color-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>{d.tipo_pagamento}</td>
                        <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>{fmtR(d.valor)}</td>
                      </tr>
                    ))}
                    <tr style={{ background: 'var(--color-surface-2)', borderTop: '2px solid var(--color-border)' }}>
                      <td colSpan={4} style={{ padding: '0.55rem 0.75rem', fontWeight: 700, color: 'var(--color-text)' }}>TOTAL</td>
                      <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', fontWeight: 800, color: '#ef4444', fontSize: '0.95rem' }}>{fmtR(totalDespesas)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Participantes / Rateio */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                👥 Participantes e Rateio ({participantes.length})
              </h3>
              {!encerrado && (
                <button onClick={() => { setPartEdit(null); setModalPart(true); }} style={btnPrimary}>➕ Adicionar Participante</button>
              )}
            </div>

            {participantes.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '1.5rem', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                Nenhum participante cadastrado ainda.
              </p>
            ) : (
              <TabelaParticipantes
                participantes={participantes}
                valorCota={valorCota}
                encerrado={encerrado}
                setPartEdit={setPartEdit}
                setModalPart={setModalPart}
                setConfirmExcluirPart={setConfirmExcluirPart}
                totalCotas={totalCotas}
                btnEdit={btnEdit}
                btnDanger={btnDanger}
              />
            )}
          </div>
        </div>
      )}

      {/* Modais */}
      <ModalParticipante aberto={modalPart} onFechar={() => { setModalPart(false); setPartEdit(null); }}
        onSalvar={handleSalvarPart} partEdit={partEdit} irmaos={irmaos} evento={evento} />

      <ModalEvento aberto={modalEvento} onFechar={() => setModalEvento(false)}
        onSalvar={async (form) => {
          const { error } = await supabase.from('eventos_comemorativos_fin').update({
            nome: form.nome, ano: form.ano, data_evento: form.data_evento || null,
            descricao: form.descricao || null, idade_gratuita: form.idade_gratuita,
            idade_meia: form.idade_meia, valor_ajustado: form.valor_ajustado ? parseFloat(form.valor_ajustado) : null,
            contribuicao_loja: form.contribuicao_loja ? parseFloat(form.contribuicao_loja) : null,
          }).eq('id', evento.id);
          if (error) throw error;
          showSuccess('✅ Evento atualizado!');
          setModalEvento(false);
          carregar(); onEventoAtualizado();
        }}
        eventoEdit={evento} />

      {/* Confirm excluir participante */}
      {confirmExcluirPart && (
        <div style={overlay}>
          <div style={modalBox('400px')}>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Remover participante?</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>
                <strong style={{ color: 'var(--color-text)' }}>
                  {confirmExcluirPart.irmao_id ? confirmExcluirPart.irmaos?.nome : confirmExcluirPart.nome_externo}
                </strong> será removido do rateio.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button onClick={() => setConfirmExcluirPart(null)} style={{ padding: '0.55rem 1.1rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={handleExcluirPart} style={{ ...btnDanger, padding: '0.55rem 1.25rem', fontWeight: 600 }}>Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm encerrar */}
      {confirmEncerrar && (
        <div style={overlay}>
          <div style={modalBox('420px')}>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>🔒 Encerrar Evento?</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
                Após encerrado, novos participantes e despesas não poderão ser adicionados. O rateio ficará registrado permanentemente.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button onClick={() => setConfirmEncerrar(false)} style={{ padding: '0.55rem 1.1rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={handleEncerrar} style={{ ...btnPrimary, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444' }}>🔒 Confirmar Encerramento</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ─────────────────────────────────────────────
//  Componente Principal
// ─────────────────────────────────────────────
// ─── MiniCard: indicador compacto nos cards da lista ────────
function MiniCard({ label, valor, sufixo, cor, flex, fullWidth }) {
  const cores = {
    default: { bg: 'var(--color-surface-2)', border: 'var(--color-border)',     text: 'var(--color-text)',   label: 'var(--color-text-muted)' },
    blue:    { bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.25)',  text: '#3b82f6',             label: '#3b82f6' },
    green:   { bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.25)',  text: '#10b981',             label: '#10b981' },
    red:     { bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)',    text: '#ef4444',             label: '#ef4444' },
    gold:    { bg: 'var(--color-accent-bg)', border: 'rgba(201,168,76,0.35)', text: 'var(--color-accent)', label: 'var(--color-accent)' },
  };
  const t = cores[cor] || cores.default;
  return (
    <div style={{
      background: t.bg, borderRadius: 'var(--radius-md)',
      padding: '0.35rem 0.6rem', border: `1px solid ${t.border}`,
      flex: flex || (fullWidth ? '1 1 100%' : undefined),
      minWidth: 0,
    }}>
      <div style={{ fontSize: '0.62rem', fontWeight: 600, color: t.label, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {valor}{sufixo ? <span style={{ fontSize: '0.65rem', fontWeight: 400, marginLeft: '0.2rem', opacity: 0.7 }}>{sufixo}</span> : null}
      </div>
    </div>
  );
}

export default function EventosComemorativos({ showSuccess, showError }) {
  const [eventos, setEventos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [eventoAtivo, setEventoAtivo] = useState(null);
  const [modalNovo, setModalNovo] = useState(false);
  const [irmaos, setIrmaos] = useState([]);
  const [filtroAno, setFiltroAno] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [confirmExcluir, setConfirmExcluir] = useState(null);

  const carregarEventos = async () => {
    setCarregando(true);
    const [{ data: evs }, { data: parts }, { data: lancs }] = await Promise.all([
      supabase.from('eventos_comemorativos_fin').select('*').order('ano', { ascending: false }).order('data_evento', { ascending: false }),
      supabase.from('evento_rateio_participantes').select('evento_id, adultos_convidados, criancas_meia, criancas_gratuitas, irmao_id'),
      supabase.from('lancamentos_loja').select('evento_comemorativo_id, valor').not('evento_comemorativo_id', 'is', null),
    ]);
    // Agrega por evento
    const partsPorEvento = {};
    (parts || []).forEach(p => {
      if (!partsPorEvento[p.evento_id]) partsPorEvento[p.evento_id] = [];
      partsPorEvento[p.evento_id].push(p);
    });
    const lancsPorEvento = {};
    (lancs || []).forEach(l => {
      if (!lancsPorEvento[l.evento_comemorativo_id]) lancsPorEvento[l.evento_comemorativo_id] = 0;
      lancsPorEvento[l.evento_comemorativo_id] += parseFloat(l.valor || 0);
    });
    const eventosEnriquecidos = (evs || []).map(ev => {
      const ps = partsPorEvento[ev.id] || [];
      // Irmãos = linhas com irmao_id; Externos = linhas com nome_externo
      const irmaos_ps    = ps.filter(p => p.irmao_id);
      const externos_ps  = ps.filter(p => !p.irmao_id);
      const qtdIrmaos    = irmaos_ps.length;
      const qtdExternos  = externos_ps.length;
      // Adultos convidados: soma de adultos_convidados de TODOS (irmãos trazem convidados tbm)
      const qtdAdultosConv = ps.reduce((s, p) => s + (parseInt(p.adultos_convidados) || 0), 0);
      // Meia e gratuitas: soma geral
      const qtdMeia      = ps.reduce((s, p) => s + (parseInt(p.criancas_meia) || 0), 0);
      const qtdGratuitas = ps.reduce((s, p) => s + (parseInt(p.criancas_gratuitas) || 0), 0);
      const totalDespesas = lancsPorEvento[ev.id] || 0;
      const contribuicaoLoja = parseFloat(ev.contribuicao_loja || 0);
      const baseRateio = Math.max(0, totalDespesas - contribuicaoLoja);
      // Cotas: irmão = 1; cada externo = 1; cada adulto convidado = 1; meia = 0.5; gratuitas = 0
      const totalCotas = qtdIrmaos + qtdExternos + qtdAdultosConv + (qtdMeia * 0.5);
      const valorCalc = totalCotas > 0 ? baseRateio / totalCotas : 0;
      return {
        ...ev,
        _qtdIrmaos: qtdIrmaos,
        _qtdExternos: qtdExternos,
        _qtdAdultosConv: qtdAdultosConv,
        _qtdMeia: qtdMeia,
        _qtdGratuitas: qtdGratuitas,
        _totalDespesas: totalDespesas,
        _baseRateio: baseRateio,
        _totalCotas: totalCotas,
        _valorCalc: valorCalc,
      };
    });
    setEventos(eventosEnriquecidos);
    setCarregando(false);
  };

  const carregarIrmaos = async () => {
    const { data } = await supabase.from('irmaos').select('id, nome').order('nome');
    setIrmaos(data || []);
  };

  useEffect(() => { carregarEventos(); carregarIrmaos(); }, []);

  const anos = [...new Set(eventos.map(e => e.ano))].sort((a, b) => b - a);

  const eventosFiltrados = eventos
    .filter(e => filtroAno === 'todos' || e.ano === parseInt(filtroAno))
    .filter(e => filtroStatus === 'todos' || e.status === filtroStatus);

  const handleCriarEvento = async (form) => {
    const { data, error } = await supabase.from('eventos_comemorativos_fin').insert({
      nome: form.nome.trim(), ano: form.ano,
      data_evento: form.data_evento || null,
      descricao: form.descricao || null,
      idade_gratuita: form.idade_gratuita,
      idade_meia: form.idade_meia,
      valor_ajustado: form.valor_ajustado ? parseFloat(form.valor_ajustado) : null,
      contribuicao_loja: form.contribuicao_loja ? parseFloat(form.contribuicao_loja) : null,
      contribuicao_loja: form.contribuicao_loja ? parseFloat(form.contribuicao_loja) : null,
    }).select().single();
    if (error) throw error;
    showSuccess('🎉 Evento criado!');
    setModalNovo(false);
    await carregarEventos();
    setEventoAtivo(data);
  };

  const handleExcluir = async () => {
    const { error } = await supabase.from('eventos_comemorativos_fin').delete().eq('id', confirmExcluir.id);
    if (!error) { setConfirmExcluir(null); showSuccess('🗑️ Evento excluído.'); carregarEventos(); }
    else showError('Erro ao excluir.');
  };

  if (eventoAtivo) {
    return (
      <div style={{ padding: '1.5rem', maxWidth: '1100px', margin: '0 auto' }}>
        <DetalheEvento
          evento={eventoAtivo}
          onVoltar={() => setEventoAtivo(null)}
          irmaos={irmaos}
          showSuccess={showSuccess}
          showError={showError}
          onEventoAtualizado={carregarEventos}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1100px', margin: '0 auto' }}>

      {/* Cabeçalho */}
      <div style={{ ...card, marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-lg)', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
              🎉
            </div>
            <div>
              <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.15rem' }}>Eventos Comemorativos</h1>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Controle financeiro e rateio de eventos da loja</p>
            </div>
          </div>
          <button onClick={() => setModalNovo(true)} style={btnPrimary}>🎉 Novo Evento</button>
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <select style={{ ...inp, width: 'auto', minWidth: '130px' }} value={filtroAno} onChange={e => setFiltroAno(e.target.value)}>
            <option value="todos">Todos os Anos</option>
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select style={{ ...inp, width: 'auto', minWidth: '160px' }} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
            <option value="todos">Todos os Status</option>
            <option value="aberto">⚙️ Em Aberto</option>
            <option value="encerrado">✅ Encerrado</option>
          </select>
          <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.82rem', color: 'var(--color-text-muted)', paddingLeft: '0.25rem' }}>
            {eventosFiltrados.length} evento{eventosFiltrados.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Loading */}
      {carregando && <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>Carregando eventos...</div>}

      {/* Vazio */}
      {!carregando && eventosFiltrados.length === 0 && (
        <div style={{ ...card, textAlign: 'center', padding: '3rem', border: '1px dashed var(--color-border)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎉</div>
          <p style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.25rem' }}>Nenhum evento encontrado</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Clique em "🎉 Novo Evento" para começar.</p>
        </div>
      )}

      {/* Lista */}
      {!carregando && eventosFiltrados.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {eventosFiltrados.map(ev => {
            const encerrado = ev.status === 'encerrado';
            return (
              <div key={ev.id} style={{ ...card, borderLeft: `4px solid ${encerrado ? '#10b981' : '#f59e0b'}`, cursor: 'pointer', transition: 'border-color 0.15s' }}
                onClick={() => setEventoAtivo(ev)}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                      <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>{ev.nome}</span>
                      <span style={{ padding: '0.12rem 0.55rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600, background: 'rgba(201,168,76,0.12)', color: '#c9a84c', border: '1px solid rgba(201,168,76,0.3)' }}>{ev.ano}</span>
                      <span style={{ padding: '0.12rem 0.55rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600, background: encerrado ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)', color: encerrado ? '#10b981' : '#f59e0b', border: encerrado ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(245,158,11,0.3)' }}>
                        {encerrado ? '✅ Encerrado' : '⚙️ Em Aberto'}
                      </span>
                    </div>
                    {/* Linha 1: data + descrição */}
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
                      {ev.data_evento && <span>📅 {fmtD(ev.data_evento)}</span>}
                      {ev.descricao && <span>📝 {ev.descricao}</span>}
                    </div>
                    {/* Grid hierárquico de indicadores */}
                    {(() => {
                      const totalAdultos = (ev._qtdIrmaos||0) + (ev._qtdExternos||0) + (ev._qtdAdultosConv||0);
                      const totalMeia    = ev._qtdMeia || 0;
                      const totalGratis  = ev._qtdGratuitas || 0;
                      const totalGeral   = totalAdultos + totalMeia + totalGratis;
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.5rem' }}>

                          {/* LINHA 1 — totalizador geral */}
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <MiniCard fullWidth label="👥 Total de Convidados" valor={totalGeral} sufixo={`pess. (${totalAdultos} adultos · ${totalMeia} meia · ${totalGratis} grátis)`} cor="gold" />
                          </div>

                          {/* LINHA 2 — dois grupos lado a lado */}
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            {/* Grupo adultos */}
                            <div style={{ flex: 3, display: 'flex', flexDirection: 'column', gap: '0.25rem', background: 'rgba(201,168,76,0.07)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 'var(--radius-md)', padding: '0.4rem' }}>
                              <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
                                Adultos — {totalAdultos} pess.
                              </div>
                              <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <MiniCard label="👤 Irmãos"    valor={ev._qtdIrmaos||0}    sufixo="pess." flex={1} />
                                <MiniCard label="🧑 Ad. Conv." valor={ev._qtdAdultosConv||0} sufixo="pess." flex={1} />
                                <MiniCard label="🌍 Externos"  valor={ev._qtdExternos||0}   sufixo="pess." flex={1} />
                              </div>
                            </div>

                            {/* Grupo meia e grátis */}
                            <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '0.25rem', background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 'var(--radius-md)', padding: '0.4rem' }}>
                              <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
                                Crianças — {totalMeia + totalGratis} pess.
                              </div>
                              <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <MiniCard label="🧒 Meia (6–11)" valor={totalMeia}    sufixo="pess." cor="blue" flex={1} />
                                <MiniCard label="👶 Grátis (≤5)" valor={totalGratis}  sufixo="pess." cor="green" flex={1} />
                              </div>
                            </div>
                          </div>

                          {/* LINHA 3 — financeiro */}
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <MiniCard label="💰 Despesas"  valor={fmtR(ev._totalDespesas||0)} cor="red"  flex={1} />
                            <MiniCard label="📊 Vlr/Cota"  valor={fmtR(ev._valorCalc||0)}     cor="blue" flex={1} />
                            {ev.valor_ajustado && (
                              <MiniCard label="✅ Ajustado" valor={fmtR(parseFloat(ev.valor_ajustado))} cor="gold" flex={1} />
                            )}
                          </div>

                        </div>
                      );
                    })()}
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => setEventoAtivo(ev)} style={{ ...btnEdit, padding: '0.4rem 0.75rem' }}>👁️ Abrir</button>
                    <button onClick={() => setConfirmExcluir(ev)} style={{ ...btnDanger, padding: '0.4rem 0.6rem' }}>🗑️</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modais */}
      <ModalEvento aberto={modalNovo} onFechar={() => setModalNovo(false)} onSalvar={handleCriarEvento} eventoEdit={null} />

      {confirmExcluir && (
        <div style={overlay}>
          <div style={modalBox('420px')}>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Excluir evento?</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--color-text)' }}>{confirmExcluir.nome} {confirmExcluir.ano}</strong> e todos os participantes do rateio serão excluídos permanentemente.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button onClick={() => setConfirmExcluir(null)} style={{ padding: '0.55rem 1.1rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={handleExcluir} style={{ ...btnDanger, padding: '0.55rem 1.25rem', fontWeight: 600 }}>Confirmar Exclusão</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
