/**
 * Aplicação em equipamentos de comodato: as NFs do recurso e os equipamentos de cada NF.
 * Os equipamentos continuam sendo cadastrados em Comodatos > Equipamentos (escolhendo a NF).
 */
import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { inp, lbl, overlay, box, head, card, btn, btnPequeno, moeda, dataBR, num, arred, BUCKET_NF, nomeSeguro, abrirArquivo } from './comum';

const FORM_VAZIO = { numero_nf: '', data_nf: '', fornecedor: '', valor_total: '', processo: '', observacoes: '' };

export default function ComodatoRecurso({ recurso, nfs, equipamentos, podeEditar, onChange, showSuccess, showError }) {
  const lista = (nfs || []).filter(n => n.recurso_publico_id === recurso.id)
    .sort((a, b) => String(b.data_nf || '').localeCompare(String(a.data_nf || '')));
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [arquivo, setArquivo] = useState(null);
  const [removerArquivo, setRemoverArquivo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [abertos, setAbertos] = useState({});

  const eqDaNf = (n) => (equipamentos || []).filter(e => e.recurso_id === n.id);
  const totalNfs = lista.reduce((t, n) => t + num(n.valor_total), 0);

  const abrir = (n = null) => {
    setEditando(n);
    setForm(n ? {
      numero_nf: n.numero_nf || '', data_nf: n.data_nf || '', fornecedor: n.fornecedor || '',
      valor_total: n.valor_total ?? '', processo: n.processo || '', observacoes: n.observacoes || '',
    } : FORM_VAZIO);
    setArquivo(null); setRemoverArquivo(false); setModal(true);
  };

  const salvar = async (e) => {
    e.preventDefault();
    if (!form.numero_nf.trim()) { showError('Informe o número da nota fiscal.'); return; }
    if (form.valor_total === '' || isNaN(parseFloat(form.valor_total))) { showError('Informe o valor da nota fiscal.'); return; }
    setSalvando(true);
    let novoPath = null;
    try {
      const dados = {
        origem_id: recurso.origem_id,
        recurso_publico_id: recurso.id,
        numero_nf: form.numero_nf.trim(),
        data_nf: form.data_nf || null,
        fornecedor: form.fornecedor.trim() || null,
        valor_total: arred(parseFloat(form.valor_total)),
        processo: form.processo.trim() || null,
        observacoes: form.observacoes.trim() || null,
        liberado_ente: !!recurso.liberado_ente,
      };
      if (arquivo) {
        novoPath = `${Date.now()}_${nomeSeguro(arquivo.name)}`;
        const { error: up } = await supabase.storage.from(BUCKET_NF).upload(novoPath, arquivo, { contentType: arquivo.type || undefined });
        if (up) throw up;
        dados.arquivo_path = novoPath; dados.arquivo_nome = arquivo.name;
      } else if (removerArquivo) {
        dados.arquivo_path = null; dados.arquivo_nome = null;
      }
      if (editando) {
        const { data, error } = await supabase.from('comodato_recursos').update(dados).eq('id', editando.id).select();
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('Sem permissão para alterar esta nota.');
        if (editando.arquivo_path && (arquivo || removerArquivo)) await supabase.storage.from(BUCKET_NF).remove([editando.arquivo_path]);
      } else {
        const { data, error } = await supabase.from('comodato_recursos').insert([dados]).select();
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('Sem permissão para cadastrar a nota.');
      }
      showSuccess('✅ Nota fiscal salva!');
      setModal(false);
      onChange();
    } catch (err) {
      if (novoPath) await supabase.storage.from(BUCKET_NF).remove([novoPath]);
      showError(err.code === '23505' ? 'Já existe uma nota com esse número para este ente.' : 'Erro ao salvar: ' + err.message);
    } finally { setSalvando(false); }
  };

  const excluir = async (n) => {
    const qtd = eqDaNf(n).length;
    if (!confirm(`Excluir a NF ${n.numero_nf}?${qtd ? `\n\n${qtd} equipamento(s) vinculado(s) ficarão sem recurso (não serão apagados).` : ''}`)) return;
    try {
      const { data, error } = await supabase.from('comodato_recursos').delete().eq('id', n.id).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Sem permissão para excluir.');
      if (n.arquivo_path) await supabase.storage.from(BUCKET_NF).remove([n.arquivo_path]);
      showSuccess('✅ Nota excluída.');
      onChange();
    } catch (err) { showError('Erro ao excluir: ' + err.message); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
          {lista.length} nota(s) • total <strong style={{ color: 'var(--color-text)' }}>{moeda(totalNfs)}</strong>
        </span>
        {podeEditar && <button onClick={() => abrir()} style={btn('16,185,129')}>➕ Nova NF de comodato</button>}
      </div>
      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
        Para vincular equipamentos a uma nota, cadastre o equipamento em Comodatos › Equipamentos e escolha esta NF no campo “Recurso de origem”. O valor do equipamento é obrigatório.
      </p>

      {lista.length === 0 && <div style={{ ...card, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>Nenhuma nota fiscal de comodato neste recurso.</div>}

      {lista.map(n => {
        const eqs = eqDaNf(n);
        const somaEq = arred(eqs.reduce((t, e) => t + num(e.valor_aquisicao), 0));
        const semValor = eqs.filter(e => e.valor_aquisicao == null || e.valor_aquisicao === '').length;
        const diverge = eqs.length > 0 && Math.abs(somaEq - num(n.valor_total)) > 0.01;
        return (
          <div key={n.id} style={{ ...card, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
              <strong style={{ color: 'var(--color-text)' }}>NF nº {n.numero_nf}{n.data_nf ? ` • ${dataBR(n.data_nf)}` : ''}</strong>
              <strong style={{ color: 'var(--color-text)' }}>{moeda(n.valor_total)}</strong>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', flexWrap: 'wrap', gap: '0.3rem 1rem' }}>
              {n.fornecedor && <span>🏢 {n.fornecedor}</span>}
              {n.processo && <span>Processo/Ofício: {n.processo}</span>}
              <span>🦽 {eqs.length} equipamento(s) • soma {moeda(somaEq)}</span>
            </div>
            {(diverge || semValor > 0) && (
              <div style={{ fontSize: '0.78rem', color: '#f59e0b', fontWeight: 600 }}>
                {diverge && `⚠️ A soma dos equipamentos (${moeda(somaEq)}) difere do valor da nota (${moeda(n.valor_total)}). `}
                {semValor > 0 && `⚠️ ${semValor} equipamento(s) sem valor informado.`}
              </div>
            )}
            {n.observacoes && <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{n.observacoes}</div>}
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.3rem', flexWrap: 'wrap' }}>
              {eqs.length > 0 && <button onClick={() => setAbertos({ ...abertos, [n.id]: !abertos[n.id] })} style={btnPequeno('100,116,139')}>{abertos[n.id] ? 'Ocultar equipamentos' : 'Ver equipamentos'}</button>}
              {n.arquivo_path && <button onClick={() => abrirArquivo(BUCKET_NF, n.arquivo_path, showError)} style={btnPequeno('59,130,246')}>📎 Ver nota fiscal</button>}
              {podeEditar && <button onClick={() => abrir(n)} style={btnPequeno()}>✏️ Editar</button>}
              {podeEditar && <button onClick={() => excluir(n)} style={btnPequeno('239,68,68')}>🗑️</button>}
            </div>
            {abertos[n.id] && (
              <div style={{ marginTop: '0.4rem', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead><tr style={{ textAlign: 'left', color: 'var(--color-text-muted)' }}>
                    <th style={{ padding: '0.3rem 0.5rem' }}>Patrimônio</th><th style={{ padding: '0.3rem 0.5rem' }}>Tipo</th><th style={{ padding: '0.3rem 0.5rem' }}>Situação</th><th style={{ padding: '0.3rem 0.5rem', textAlign: 'right' }}>Valor</th>
                  </tr></thead>
                  <tbody>
                    {eqs.map(e => (
                      <tr key={e.id} style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
                        <td style={{ padding: '0.3rem 0.5rem' }}>{e.numero_patrimonio}</td>
                        <td style={{ padding: '0.3rem 0.5rem' }}>{e.tipos_equipamentos?.nome || '—'}</td>
                        <td style={{ padding: '0.3rem 0.5rem' }}>{e.status}</td>
                        <td style={{ padding: '0.3rem 0.5rem', textAlign: 'right' }}>{e.valor_aquisicao == null ? '—' : moeda(e.valor_aquisicao)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {modal && (
        <div style={overlay}>
          <div style={box('40rem')}>
            <div style={head}>
              <h3 style={{ margin: 0, color: 'var(--color-text)' }}>{editando ? '✏️ Editar NF de comodato' : '➕ Nova NF de comodato'}</h3>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.4rem', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={salvar} style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.9rem' }}>
                <div><label style={lbl}>Nº da NF *</label><input value={form.numero_nf} onChange={e => setForm({ ...form, numero_nf: e.target.value })} style={inp()} /></div>
                <div><label style={lbl}>Data da NF</label><input type="date" value={form.data_nf} onChange={e => setForm({ ...form, data_nf: e.target.value })} style={inp()} /></div>
                <div><label style={lbl}>Valor total (R$) *</label><input type="number" step="0.01" min="0" value={form.valor_total} onChange={e => setForm({ ...form, valor_total: e.target.value })} style={inp()} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem' }}>
                <div><label style={lbl}>Fornecedor</label><input value={form.fornecedor} onChange={e => setForm({ ...form, fornecedor: e.target.value })} style={inp()} /></div>
                <div><label style={lbl}>Processo / Ofício</label><input value={form.processo} onChange={e => setForm({ ...form, processo: e.target.value })} style={inp()} /></div>
              </div>
              <div><label style={lbl}>Observações</label><textarea rows={2} value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} style={inp({ resize: 'vertical' })} /></div>
              <div>
                <label style={lbl}>Arquivo da nota (PDF ou imagem)</label>
                <input type="file" accept=".pdf,image/*" onChange={e => setArquivo(e.target.files?.[0] || null)} style={inp({ padding: '0.4rem 0.75rem' })} />
                {editando?.arquivo_path && !removerArquivo && !arquivo && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.35rem' }}>
                    📎 {editando.arquivo_nome} <button type="button" onClick={() => setRemoverArquivo(true)} style={{ marginLeft: '0.5rem', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}>remover</button>
                  </div>
                )}
              </div>
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
