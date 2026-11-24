/**
 * Cadastro / edição de um recurso recebido de ente público.
 * Ao mudar "Liberado ao ente", replica para as NFs e equipamentos do recurso
 * (mesmo padrão que já existia nos Recursos de Origem).
 */
import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { inp, lbl, overlay, box, head, btn, arred } from './comum';

const VAZIO = { origem_id: '', titulo: '', data_recebimento: '', valor_recebido: '', numero_processo: '', documento_ref: '', finalidade: '', situacao: 'aberto', liberado_ente: false, observacoes: '' };

export default function ModalRecurso({ entes, recurso = null, nfs, equipamentos, onClose, onSaved, showSuccess, showError }) {
  const [form, setForm] = useState(recurso ? {
    origem_id: recurso.origem_id, titulo: recurso.titulo || '', data_recebimento: recurso.data_recebimento || '',
    valor_recebido: recurso.valor_recebido ?? '', numero_processo: recurso.numero_processo || '', documento_ref: recurso.documento_ref || '',
    finalidade: recurso.finalidade || '', situacao: recurso.situacao || 'aberto', liberado_ente: !!recurso.liberado_ente, observacoes: recurso.observacoes || '',
  } : VAZIO);
  const [salvando, setSalvando] = useState(false);

  const entesAtivos = (entes || []).filter(o => o.ativo !== false || String(o.id) === String(form.origem_id));

  const salvar = async (e) => {
    e.preventDefault();
    if (!form.origem_id) { showError('Selecione o ente.'); return; }
    if (!form.titulo.trim()) { showError('Informe um título para o recurso.'); return; }
    if (form.valor_recebido === '' || isNaN(parseFloat(form.valor_recebido))) { showError('Informe o valor recebido.'); return; }
    setSalvando(true);
    try {
      const dados = {
        origem_id: Number(form.origem_id),
        titulo: form.titulo.trim(),
        data_recebimento: form.data_recebimento || null,
        valor_recebido: arred(parseFloat(form.valor_recebido)),
        numero_processo: form.numero_processo.trim() || null,
        documento_ref: form.documento_ref.trim() || null,
        finalidade: form.finalidade.trim() || null,
        situacao: form.situacao,
        liberado_ente: !!form.liberado_ente,
        observacoes: form.observacoes.trim() || null,
        updated_at: new Date().toISOString(),
      };
      let id = recurso?.id;
      if (recurso) {
        const { data, error } = await supabase.from('recursos_publicos').update(dados).eq('id', recurso.id).select();
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('Sem permissão para alterar este recurso.');
      } else {
        const { data, error } = await supabase.from('recursos_publicos').insert([dados]).select();
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('Sem permissão para cadastrar.');
        id = data[0].id;
      }

      // liberação mudou: replica para NFs e equipamentos do recurso
      if (recurso && !!recurso.liberado_ente !== !!form.liberado_ente) {
        const { data: nfsAtual, error: e1 } = await supabase.from('comodato_recursos')
          .update({ liberado_ente: !!form.liberado_ente }).eq('recurso_publico_id', id).select('id');
        if (e1) throw e1;
        const ids = (nfsAtual || []).map(n => n.id);
        if (ids.length) {
          const esperados = (equipamentos || []).filter(q => ids.includes(q.recurso_id)).length;
          const { data: eqAtual, error: e2 } = await supabase.from('equipamentos')
            .update({ liberado_ente: !!form.liberado_ente }).in('recurso_id', ids).select('id');
          if (e2) throw e2;
          if ((eqAtual || []).length < esperados) showError('Recurso salvo, mas alguns equipamentos não puderam ter a liberação atualizada (permissão).');
        }
      }
      showSuccess('✅ Recurso salvo!');
      onSaved(id);
    } catch (err) {
      showError('Erro ao salvar: ' + err.message);
    } finally { setSalvando(false); }
  };

  return (
    <div style={overlay}>
      <div style={box('44rem')}>
        <div style={head}>
          <h3 style={{ margin: 0, color: 'var(--color-text)' }}>{recurso ? '✏️ Editar recurso' : '➕ Novo recurso recebido'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.4rem', cursor: 'pointer' }}>×</button>
        </div>
        <form onSubmit={salvar} style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem' }}>
            <div>
              <label style={lbl}>Ente *</label>
              <select value={form.origem_id} onChange={e => setForm({ ...form, origem_id: e.target.value })} style={inp()}>
                <option value="">— Selecione —</option>
                {entesAtivos.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Título do recurso *</label><input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} style={inp()} placeholder="Ex.: Recurso ação nº 123/2026" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem' }}>
            <div><label style={lbl}>Valor recebido (R$) *</label><input type="number" step="0.01" min="0" value={form.valor_recebido} onChange={e => setForm({ ...form, valor_recebido: e.target.value })} style={inp()} /></div>
            <div><label style={lbl}>Data do recebimento</label><input type="date" value={form.data_recebimento} onChange={e => setForm({ ...form, data_recebimento: e.target.value })} style={inp()} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem' }}>
            <div><label style={lbl}>Nº do processo</label><input value={form.numero_processo} onChange={e => setForm({ ...form, numero_processo: e.target.value })} style={inp()} /></div>
            <div><label style={lbl}>Termo / ofício / alvará</label><input value={form.documento_ref} onChange={e => setForm({ ...form, documento_ref: e.target.value })} style={inp()} /></div>
          </div>
          <div><label style={lbl}>Finalidade prevista</label><textarea rows={2} value={form.finalidade} onChange={e => setForm({ ...form, finalidade: e.target.value })} style={inp({ resize: 'vertical' })} placeholder="Para que o recurso foi destinado" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.9rem' }}>
            <div>
              <label style={lbl}>Situação</label>
              <select value={form.situacao} onChange={e => setForm({ ...form, situacao: e.target.value })} style={inp()}>
                <option value="aberto">Aberto</option>
                <option value="encerrado">Encerrado</option>
              </select>
            </div>
            <div><label style={lbl}>Observações</label><input value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} style={inp()} /></div>
          </div>
          <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', fontSize: '0.85rem', color: 'var(--color-text)', cursor: 'pointer', padding: '0.7rem 0.9rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 'var(--radius-lg)' }}>
            <input type="checkbox" checked={form.liberado_ente} onChange={e => setForm({ ...form, liberado_ente: e.target.checked })} style={{ marginTop: '0.2rem' }} />
            <span><strong>🏛️ Liberado ao ente público</strong><br />
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>O ente poderá ver este recurso, as notas, os equipamentos, as aplicações, os anexos e o saldo. Desmarcado por padrão.</span></span>
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
            <button type="button" onClick={onClose} style={btn('100,116,139')}>Cancelar</button>
            <button type="submit" disabled={salvando} style={btn('16,185,129')}>{salvando ? 'Salvando...' : '💾 Salvar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
