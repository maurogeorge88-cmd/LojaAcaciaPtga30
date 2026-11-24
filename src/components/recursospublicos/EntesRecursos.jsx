/**
 * ENTES — cadastro completo dos entes públicos que disponibilizam recursos.
 * Usa a tabela comodato_origens_recurso (a mesma já ligada aos usuários de ente público).
 */
import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { inp, lbl, overlay, box, head, card, btn, btnPequeno, idsDoRamo } from './comum';

const VAZIO = { parent_id: '', nome: '', tipo: '', cnpj: '', responsavel: '', telefone: '', email: '', endereco: '', observacoes: '' };
const TIPOS = ['Justiça', 'Ministério Público', 'Prefeitura', 'Câmara Municipal', 'Governo do Estado', 'Governo Federal', 'Outro'];

export default function EntesRecursos({ entes, recursos, podeEditar, showSuccess, showError, onChange }) {
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);

  // novo(e) = cadastrar uma unidade dentro de `paiId`
  const abrir = (e = null, paiId = '') => {
    setEditando(e);
    setForm(e ? {
      parent_id: e.parent_id == null ? '' : String(e.parent_id),
      nome: e.nome || '', tipo: e.tipo || '', cnpj: e.cnpj || '', responsavel: e.responsavel || '',
      telefone: e.telefone || '', email: e.email || '', endereco: e.endereco || '', observacoes: e.observacoes || '',
    } : { ...VAZIO, parent_id: paiId === '' ? '' : String(paiId) });
    setModal(true);
  };

  const salvar = async (ev) => {
    ev.preventDefault();
    const nome = form.nome.trim();
    if (!nome) { showError('Informe o nome do ente.'); return; }
    setSalvando(true);
    try {
      const dados = {
        parent_id: form.parent_id === '' ? null : Number(form.parent_id),
        nome,
        tipo: form.tipo.trim() || null,
        cnpj: form.cnpj.trim() || null,
        responsavel: form.responsavel.trim() || null,
        telefone: form.telefone.trim() || null,
        email: form.email.trim() || null,
        endereco: form.endereco.trim() || null,
        observacoes: form.observacoes.trim() || null,
      };
      if (editando) {
        const { data, error } = await supabase.from('comodato_origens_recurso').update(dados).eq('id', editando.id).select();
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('Sem permissão para alterar este ente.');
      } else {
        const { data, error } = await supabase.from('comodato_origens_recurso').insert([dados]).select();
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('Sem permissão para cadastrar.');
      }
      showSuccess('✅ Ente salvo!');
      setModal(false);
      onChange();
    } catch (err) {
      showError(err.code === '23505' ? 'Já existe um ente com esse nome dentro do mesmo ente superior.' : /Hierarquia|pai dele/.test(err.message || '') ? err.message : /parent|column/i.test(err.message || '') ? 'Execute o arquivo recursos_publicos_arvore.sql no Supabase.' : 'Erro ao salvar: ' + err.message);
    } finally { setSalvando(false); }
  };

  const alternar = async (e) => {
    const { data, error } = await supabase.from('comodato_origens_recurso').update({ ativo: !e.ativo }).eq('id', e.id).select();
    if (error || !data?.length) { showError('Não foi possível alterar o ente.'); return; }
    onChange();
  };

  const qtdRecursos = (id) => (recursos || []).filter(r => r.origem_id === id).length;
  // opções de "pertence a": exclui o próprio ente e seus descendentes
  const proibidos = editando ? idsDoRamo(entes, editando.id) : new Set();
  const opcoesPai = (entes || []).filter(o => !proibidos.has(String(o.id)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>🏛️ Entes</h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Em árvore: Justiça Estadual › Fórum › 1ª Vara Cível. Cada unidade é cadastrada individualmente e vê somente os seus recursos.</p>
        </div>
        {podeEditar && <button onClick={() => abrir()} style={btn('16,185,129')}>➕ Novo ente</button>}
      </div>

      {(entes || []).length === 0 && (
        <div style={{ ...card, textAlign: 'center', color: 'var(--color-text-muted)' }}>Nenhum ente cadastrado ainda.</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(max(13rem, calc((100% - 2.1rem) / 4)), 1fr))', gap: '0.7rem', alignItems: 'start' }}>
        {(entes || []).map(e => (
          <div key={e.id} style={{ ...card, gridColumn: e.nivel ? undefined : '1 / -1', padding: e.nivel ? '0.8rem 0.9rem' : card.padding, borderLeft: e.nivel ? '3px solid var(--color-accent)' : undefined, minWidth: 0, overflowWrap: 'anywhere', opacity: e.ativo === false ? 0.6 : 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'baseline' }}>
              <strong style={{ color: 'var(--color-text)', fontSize: '1rem' }}>{e.nome}</strong>
              {e.ativo === false && <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 700 }}>INATIVO</span>}
            </div>
            {e.nivel > 0 && <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>{e.caminho}</span>}
            {e.tipo && <span style={{ fontSize: '0.78rem', color: 'var(--color-accent)', fontWeight: 600 }}>{e.tipo}</span>}
            {e.cnpj && <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>CNPJ: {e.cnpj}</span>}
            {e.responsavel && <span style={{ fontSize: '0.8rem', color: 'var(--color-text)' }}>👤 {e.responsavel}</span>}
            {(e.telefone || e.email) && <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{[e.telefone, e.email].filter(Boolean).join(' • ')}</span>}
            {e.endereco && <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{e.endereco}</span>}
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>{qtdRecursos(e.id)} recurso(s){e.qtdFilhos ? ` • ${e.qtdFilhos} unidade(s) abaixo` : ''}</span>
            {podeEditar && (
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                <button onClick={() => abrir(e)} style={btnPequeno()}>✏️ Editar</button>
                <button onClick={() => abrir(null, e.id)} style={btnPequeno('16,185,129')}>➕ Unidade abaixo</button>
                <button onClick={() => alternar(e)} style={btnPequeno(e.ativo === false ? '16,185,129' : '100,116,139')}>{e.ativo === false ? 'Reativar' : 'Inativar'}</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {modal && (
        <div style={overlay}>
          <div style={box('40rem')}>
            <div style={head}>
              <h3 style={{ margin: 0, color: 'var(--color-text)' }}>{editando ? '✏️ Editar ente' : '➕ Novo ente'}</h3>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.4rem', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={salvar} style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div>
                <label style={lbl}>Pertence a (ente superior)</label>
                <select value={form.parent_id} onChange={e => setForm({ ...form, parent_id: e.target.value })} style={inp()}>
                  <option value="">— Nenhum (ente principal) —</option>
                  {opcoesPai.map(o => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Nome *</label><input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} style={inp()} placeholder="Ex.: Justiça Estadual, Fórum de Paranatinga, 1ª Vara Cível" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem' }}>
                <div>
                  <label style={lbl}>Tipo</label>
                  <input list="tipos-ente" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} style={inp()} placeholder="Selecione ou digite" />
                  <datalist id="tipos-ente">{TIPOS.map(t => <option key={t} value={t} />)}</datalist>
                </div>
                <div><label style={lbl}>CNPJ</label><input value={form.cnpj} onChange={e => setForm({ ...form, cnpj: e.target.value })} style={inp()} /></div>
              </div>
              <div><label style={lbl}>Responsável / contato</label><input value={form.responsavel} onChange={e => setForm({ ...form, responsavel: e.target.value })} style={inp()} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem' }}>
                <div><label style={lbl}>Telefone</label><input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} style={inp()} /></div>
                <div><label style={lbl}>E-mail</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={inp()} /></div>
              </div>
              <div><label style={lbl}>Endereço</label><input value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} style={inp()} /></div>
              <div><label style={lbl}>Observações</label><textarea rows={3} value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} style={inp({ resize: 'vertical' })} /></div>
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
