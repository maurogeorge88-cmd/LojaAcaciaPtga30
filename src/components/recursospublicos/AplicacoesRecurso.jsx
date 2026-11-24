/**
 * Aplicações do recurso que NÃO são equipamento de comodato:
 * doações/repasses, obras/serviços e outros.
 */
import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import ModalAnexos from './ModalAnexos';
import { inp, lbl, overlay, box, head, card, btn, btnPequeno, moeda, dataBR, num, arred, TIPOS_APLICACAO, BUCKET_RP } from './comum';

const FORM_VAZIO = { descricao: '', destinatario: '', local: '', quantidade: '', valor: '', data_aplicacao: '', numero_nf: '', fornecedor: '', situacao: 'realizada', observacoes: '' };

export default function AplicacoesRecurso({ tipo, recurso, aplicacoes, anexos, podeEditar, onChange, showSuccess, showError }) {
  const cfg = TIPOS_APLICACAO[tipo];
  const lista = (aplicacoes || []).filter(a => a.recurso_id === recurso.id && a.tipo === tipo)
    .sort((a, b) => String(b.data_aplicacao || '').localeCompare(String(a.data_aplicacao || '')));
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [anexando, setAnexando] = useState(null);

  const total = lista.reduce((t, a) => t + num(a.valor), 0);
  const qtdAnexos = (a) => (anexos || []).filter(x => x.aplicacao_id === a.id).length;

  const abrir = (a = null) => {
    setEditando(a);
    setForm(a ? {
      descricao: a.descricao || '', destinatario: a.destinatario || '', local: a.local || '',
      quantidade: a.quantidade ?? '', valor: a.valor ?? '', data_aplicacao: a.data_aplicacao || '',
      numero_nf: a.numero_nf || '', fornecedor: a.fornecedor || '', situacao: a.situacao || 'realizada', observacoes: a.observacoes || '',
    } : FORM_VAZIO);
    setModal(true);
  };

  const salvar = async (e) => {
    e.preventDefault();
    if (!form.descricao.trim()) { showError('Informe a descrição.'); return; }
    if (form.valor === '' || isNaN(parseFloat(form.valor))) { showError('Informe o valor.'); return; }
    setSalvando(true);
    try {
      const dados = {
        recurso_id: recurso.id, tipo,
        descricao: form.descricao.trim(),
        destinatario: form.destinatario.trim() || null,
        local: form.local.trim() || null,
        quantidade: form.quantidade === '' ? null : parseFloat(form.quantidade),
        valor: arred(parseFloat(form.valor)),
        data_aplicacao: form.data_aplicacao || null,
        numero_nf: form.numero_nf.trim() || null,
        fornecedor: form.fornecedor.trim() || null,
        situacao: form.situacao,
        observacoes: form.observacoes.trim() || null,
        updated_at: new Date().toISOString(),
      };
      if (editando) {
        const { data, error } = await supabase.from('recurso_aplicacoes').update(dados).eq('id', editando.id).select();
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('Sem permissão para alterar.');
      } else {
        const { data, error } = await supabase.from('recurso_aplicacoes').insert([dados]).select();
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('Sem permissão para cadastrar.');
      }
      showSuccess('✅ Aplicação salva!');
      setModal(false);
      onChange();
    } catch (err) {
      showError('Erro ao salvar: ' + err.message);
    } finally { setSalvando(false); }
  };

  const excluir = async (a) => {
    if (!confirm(`Excluir "${a.descricao}"?\n\nOs anexos desta aplicação também serão excluídos.`)) return;
    try {
      const doAnexo = (anexos || []).filter(x => x.aplicacao_id === a.id).map(x => x.arquivo_path);
      const { data, error } = await supabase.from('recurso_aplicacoes').delete().eq('id', a.id).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Sem permissão para excluir.');
      if (doAnexo.length) await supabase.storage.from(BUCKET_RP).remove(doAnexo);
      showSuccess('✅ Aplicação excluída.');
      onChange();
    } catch (err) { showError('Erro ao excluir: ' + err.message); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
          {lista.length} registro(s) • total <strong style={{ color: 'var(--color-text)' }}>{moeda(total)}</strong>
        </span>
        {podeEditar && <button onClick={() => abrir()} style={btn('16,185,129')}>➕ {cfg.novo}</button>}
      </div>

      {lista.length === 0 && <div style={{ ...card, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>Nada registrado nesta categoria.</div>}

      {lista.map(a => (
        <div key={a.id} style={{ ...card, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
            <strong style={{ color: 'var(--color-text)' }}>
              {a.descricao}
              {a.situacao === 'prevista' && <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', padding: '0.1rem 0.5rem', borderRadius: '999px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.4)' }}>PREVISTA</span>}
            </strong>
            <strong style={{ color: 'var(--color-text)' }}>{moeda(a.valor)}</strong>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', flexWrap: 'wrap', gap: '0.3rem 1rem' }}>
            {a.destinatario && <span>👥 {a.destinatario}</span>}
            {a.local && <span>📍 {a.local}</span>}
            {a.quantidade != null && <span>Qtd: {a.quantidade}</span>}
            {a.data_aplicacao && <span>📅 {dataBR(a.data_aplicacao)}</span>}
            {a.numero_nf && <span>NF {a.numero_nf}{a.fornecedor ? ` — ${a.fornecedor}` : ''}</span>}
          </div>
          {a.observacoes && <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{a.observacoes}</div>}
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.3rem', flexWrap: 'wrap' }}>
            <button onClick={() => setAnexando(a)} style={btnPequeno('59,130,246')}>📎 Anexos ({qtdAnexos(a)})</button>
            {podeEditar && <button onClick={() => abrir(a)} style={btnPequeno()}>✏️ Editar</button>}
            {podeEditar && <button onClick={() => excluir(a)} style={btnPequeno('239,68,68')}>🗑️</button>}
          </div>
        </div>
      ))}

      {anexando && (
        <ModalAnexos recurso={recurso} aplicacao={anexando} anexos={anexos} podeEditar={podeEditar}
          onClose={() => setAnexando(null)} onChange={onChange} showSuccess={showSuccess} showError={showError} />
      )}

      {modal && (
        <div style={overlay}>
          <div style={box('42rem')}>
            <div style={head}>
              <h3 style={{ margin: 0, color: 'var(--color-text)' }}>{editando ? '✏️ Editar' : `➕ ${cfg.novo}`}</h3>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.4rem', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={salvar} style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div><label style={lbl}>{cfg.descLabel}</label><input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} style={inp()} placeholder={cfg.descPh} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem' }}>
                <div><label style={lbl}>{cfg.destLabel}</label><input value={form.destinatario} onChange={e => setForm({ ...form, destinatario: e.target.value })} style={inp()} placeholder={cfg.destPh} /></div>
                <div><label style={lbl}>Local</label><input value={form.local} onChange={e => setForm({ ...form, local: e.target.value })} style={inp()} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.9rem' }}>
                <div><label style={lbl}>Valor (R$) *</label><input type="number" step="0.01" min="0" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} style={inp()} /></div>
                <div><label style={lbl}>Quantidade</label><input type="number" step="any" min="0" value={form.quantidade} onChange={e => setForm({ ...form, quantidade: e.target.value })} style={inp()} /></div>
                <div><label style={lbl}>Data</label><input type="date" value={form.data_aplicacao} onChange={e => setForm({ ...form, data_aplicacao: e.target.value })} style={inp()} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '0.9rem' }}>
                <div><label style={lbl}>Nº da NF</label><input value={form.numero_nf} onChange={e => setForm({ ...form, numero_nf: e.target.value })} style={inp()} /></div>
                <div><label style={lbl}>Fornecedor</label><input value={form.fornecedor} onChange={e => setForm({ ...form, fornecedor: e.target.value })} style={inp()} /></div>
                <div>
                  <label style={lbl}>Situação</label>
                  <select value={form.situacao} onChange={e => setForm({ ...form, situacao: e.target.value })} style={inp()}>
                    <option value="realizada">Realizada</option>
                    <option value="prevista">Prevista</option>
                  </select>
                </div>
              </div>
              <div><label style={lbl}>Observações</label><textarea rows={2} value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} style={inp({ resize: 'vertical' })} /></div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Depois de salvar, use “📎 Anexos” para juntar o termo de entrega, a nota fiscal, o recibo e fotos.</p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <button type="button" onClick={() => setModal(false)} style={btn('100,116,139')}>Cancelar</button>
                <button type="submit" disabled={salvando} style={btn('16,185,129')}>{salvando ? 'Salvando...' : '💾 Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
