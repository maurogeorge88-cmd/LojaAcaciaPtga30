/**
 * RECURSOS DE ORIGEM (Justiça, Ministério Público...) — aba dentro de Equipamentos
 * Cadastro de notas fiscais por entidade, composição de equipamentos e relatório em PDF.
 */
import React, { useState, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { gerarRelatorioRecursosComodatoPDF } from '../../utils/gerarRelatorioRecursosComodatoPDF';

const BUCKET = 'comodato-notas';
const GREEN = '16,185,129';

const inp = (extra = {}) => ({
  background: 'var(--color-surface-2)', color: 'var(--color-text)',
  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
  padding: '0.5rem 1rem', width: '100%', outline: 'none', boxSizing: 'border-box', ...extra,
});
const lbl = { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.35rem' };
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 50, padding: '1rem', overflowY: 'auto' };
const box = (w = '40rem') => ({ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: w, marginTop: '0.5rem' });
const head = { padding: '1.1rem 1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const btn = (cor = '99,102,241') => ({ padding: '0.5rem 1rem', background: `rgba(${cor},0.15)`, color: `rgb(${cor})`, border: `1px solid rgba(${cor},0.35)`, borderRadius: 'var(--radius-lg)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' });

const moeda = (v) => (v == null || v === '' ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const dataBR = (d) => (d ? String(d).substring(0, 10).split('-').reverse().join('/') : '—');

const FORM_VAZIO = { origem_id: '', numero_nf: '', data_nf: '', fornecedor: '', valor_total: '', processo: '', observacoes: '' };

export default function RecursosEquipamentos({ recursos, origens, equipamentos, podeEditar, showSuccess, showError, onChange }) {
  const [filtroOrigem, setFiltroOrigem] = useState('todas');
  const [busca, setBusca] = useState('');
  const [abertos, setAbertos] = useState({});
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [arquivo, setArquivo] = useState(null);
  const [removerArquivo, setRemoverArquivo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [modalOrigens, setModalOrigens] = useState(false);
  const [novaOrigem, setNovaOrigem] = useState('');
  const [modalRel, setModalRel] = useState(false);
  const [rel, setRel] = useState({ origem: 'todas', recurso: 'todos', de: '', ate: '' });
  const [gerando, setGerando] = useState(false);

  // equipamentos agrupados por recurso
  const itensPorRecurso = useMemo(() => {
    const m = {};
    (equipamentos || []).forEach(e => { if (e.recurso_id) (m[e.recurso_id] = m[e.recurso_id] || []).push(e); });
    return m;
  }, [equipamentos]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (recursos || [])
      .filter(r => filtroOrigem === 'todas' || String(r.origem_id) === String(filtroOrigem))
      .filter(r => !q || String(r.numero_nf).toLowerCase().includes(q) || (r.fornecedor || '').toLowerCase().includes(q) || (r.processo || '').toLowerCase().includes(q))
      .map(r => ({ ...r, itens: itensPorRecurso[r.id] || [] }));
  }, [recursos, filtroOrigem, busca, itensPorRecurso]);

  const resumo = useMemo(() => {
    const m = {};
    lista.forEach(r => {
      const n = r.origem?.nome || '—';
      m[n] = m[n] || { notas: 0, valor: 0, eq: 0 };
      m[n].notas += 1; m[n].valor += Number(r.valor_total) || 0; m[n].eq += r.itens.length;
    });
    return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0]));
  }, [lista]);

  const abrirModal = (r = null) => {
    setEditando(r);
    setForm(r ? {
      origem_id: r.origem_id, numero_nf: r.numero_nf, data_nf: r.data_nf || '', fornecedor: r.fornecedor || '',
      valor_total: r.valor_total ?? '', processo: r.processo || '', observacoes: r.observacoes || '',
    } : FORM_VAZIO);
    setArquivo(null); setRemoverArquivo(false); setModal(true);
  };

  const salvar = async (e) => {
    e.preventDefault();
    if (!form.origem_id || !form.numero_nf.trim()) { showError('Informe a entidade e o número da nota fiscal.'); return; }
    setSalvando(true);
    let novoPath = null;
    try {
      const dados = {
        origem_id: Number(form.origem_id),
        numero_nf: form.numero_nf.trim(),
        data_nf: form.data_nf || null,
        fornecedor: form.fornecedor.trim() || null,
        valor_total: form.valor_total === '' ? null : parseFloat(form.valor_total),
        processo: form.processo.trim() || null,
        observacoes: form.observacoes.trim() || null,
      };
      if (arquivo) {
        const seguro = arquivo.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
        novoPath = `${Date.now()}_${seguro}`;
        const { error: up } = await supabase.storage.from(BUCKET).upload(novoPath, arquivo, { contentType: arquivo.type || undefined });
        if (up) throw up;
        dados.arquivo_path = novoPath; dados.arquivo_nome = arquivo.name;
      } else if (removerArquivo) {
        dados.arquivo_path = null; dados.arquivo_nome = null;
      }

      if (editando) {
        const { data, error } = await supabase.from('comodato_recursos').update(dados).eq('id', editando.id).select();
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('Sem permissão para alterar este registro.');
        if (editando.arquivo_path && (arquivo || removerArquivo)) await supabase.storage.from(BUCKET).remove([editando.arquivo_path]);
      } else {
        const { error } = await supabase.from('comodato_recursos').insert([dados]);
        if (error) throw error;
      }
      showSuccess('✅ Recurso salvo!');
      setModal(false);
      onChange();
    } catch (err) {
      if (novoPath) await supabase.storage.from(BUCKET).remove([novoPath]);
      showError(err.code === '23505' ? 'Já existe uma nota com esse número para esta entidade.' : 'Erro ao salvar: ' + err.message);
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (r) => {
    const n = (itensPorRecurso[r.id] || []).length;
    if (!confirm(`Excluir a NF ${r.numero_nf}?${n ? `\n\n${n} equipamento(s) vinculado(s) ficarão sem recurso (não serão apagados).` : ''}`)) return;
    try {
      const { data, error } = await supabase.from('comodato_recursos').delete().eq('id', r.id).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Sem permissão para excluir.');
      if (r.arquivo_path) await supabase.storage.from(BUCKET).remove([r.arquivo_path]);
      showSuccess('✅ Recurso excluído.');
      onChange();
    } catch (err) { showError('Erro ao excluir: ' + err.message); }
  };

  const abrirNota = async (r) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(r.arquivo_path, 300);
    if (error) { showError('Não foi possível abrir o arquivo: ' + error.message); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const addOrigem = async () => {
    const nome = novaOrigem.trim();
    if (!nome) return;
    const { error } = await supabase.from('comodato_origens_recurso').insert([{ nome }]);
    if (error) { showError(error.code === '23505' ? 'Essa entidade já existe.' : 'Erro: ' + error.message); return; }
    setNovaOrigem(''); onChange();
  };
  const alternarOrigem = async (o) => {
    const { data, error } = await supabase.from('comodato_origens_recurso').update({ ativo: !o.ativo }).eq('id', o.id).select();
    if (error || !data?.length) { showError('Não foi possível alterar a entidade.'); return; }
    onChange();
  };

  const urlParaDataUrl = async (url) => {
    const r = await fetch(url); const b = await r.blob();
    return await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(b); });
  };

  const gerarRelatorio = async () => {
    setGerando(true);
    try {
      let sel = (recursos || []).map(r => ({ ...r, itens: itensPorRecurso[r.id] || [] }));
      if (rel.origem !== 'todas') sel = sel.filter(r => String(r.origem_id) === String(rel.origem));
      if (rel.recurso !== 'todos') sel = sel.filter(r => String(r.id) === String(rel.recurso));
      if (rel.de) sel = sel.filter(r => r.data_nf && r.data_nf >= rel.de);
      if (rel.ate) sel = sel.filter(r => r.data_nf && r.data_nf <= rel.ate);
      const { data: loja } = await supabase.from('dados_loja').select('*').limit(1).maybeSingle();
      let logo = null;
      if (loja?.logo_url) { try { logo = await urlParaDataUrl(loja.logo_url); } catch (e) { /* sem logo */ } }
      const filtro = [
        rel.origem !== 'todas' && `Entidade: ${origens.find(o => String(o.id) === String(rel.origem))?.nome}`,
        rel.recurso !== 'todos' && `NF nº ${(recursos || []).find(r => String(r.id) === String(rel.recurso))?.numero_nf}`,
        rel.de && `A partir de ${dataBR(rel.de)}`, rel.ate && `Até ${dataBR(rel.ate)}`,
      ].filter(Boolean).join(' • ');
      gerarRelatorioRecursosComodatoPDF({ recursos: sel, dadosLoja: loja || {}, logo, filtro });
      setModalRel(false);
    } catch (err) {
      showError('Erro ao gerar relatório: ' + err.message);
    } finally { setGerando(false); }
  };

  const notasDaOrigem = (recursos || []).filter(r => rel.origem === 'todas' || String(r.origem_id) === String(rel.origem));
  const origensAtivas = (origens || []).filter(o => o.ativo || String(o.id) === String(form.origem_id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Cabeçalho */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>⚖️ Recursos de Origem</h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Notas fiscais por entidade (Justiça, Ministério Público...) e os equipamentos adquiridos com cada recurso.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {podeEditar && <button onClick={() => abrirModal()} style={btn(GREEN)}>➕ Novo Recurso (NF)</button>}
            {podeEditar && <button onClick={() => setModalOrigens(true)} style={btn('139,92,246')}>🏛️ Entidades</button>}
            <button onClick={() => { setRel({ origem: filtroOrigem, recurso: 'todos', de: '', ate: '' }); setModalRel(true); }} style={btn()}>📄 Relatório PDF</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.75rem', alignItems: 'center' }}>
          <input placeholder="🔍 Nº da NF, fornecedor ou processo..." value={busca} onChange={e => setBusca(e.target.value)} style={inp()} />
          <select value={filtroOrigem} onChange={e => setFiltroOrigem(e.target.value)} style={inp()}>
            <option value="todas">Todas as entidades</option>
            {(origens || []).map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}><strong style={{ color: 'var(--color-text)' }}>{lista.length}</strong> nota(s)</div>
        </div>
      </div>

      {/* Resumo por entidade */}
      {resumo.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '0.75rem' }}>
          {resumo.map(([nome, r]) => (
            <div key={nome} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderLeft: `4px solid rgb(${GREEN})`, borderRadius: 'var(--radius-lg)', padding: '0.85rem 1rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>{nome}</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-text)', margin: '0.15rem 0' }}>{moeda(r.valor)}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{r.notas} nota(s) • {r.eq} equipamento(s)</div>
            </div>
          ))}
        </div>
      )}

      {/* Lista de notas */}
      {lista.length === 0 ? (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '2.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          Nenhum recurso cadastrado{busca || filtroOrigem !== 'todas' ? ' para os filtros' : ''}.
        </div>
      ) : lista.map(r => {
        const somaItens = r.itens.reduce((t, e) => t + (Number(e.valor_aquisicao) || 0), 0);
        const comValor = r.itens.filter(e => e.valor_aquisicao != null).length;
        const dif = r.valor_total != null ? Number(r.valor_total) - somaItens : null;
        const grupos = {};
        r.itens.forEach(e => { const t = e.tipos_equipamentos?.nome || 'Sem tipo'; (grupos[t] = grupos[t] || []).push(e); });
        const aberto = !!abertos[r.id];
        return (
          <div key={r.id} style={{ background: 'var(--color-surface)', border: `1px solid rgba(${GREEN},0.45)`, borderLeft: `4px solid rgb(${GREEN})`, borderRadius: 'var(--radius-xl)', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '0.2rem 0.6rem', borderRadius: 999, background: `rgba(${GREEN},0.15)`, color: `rgb(${GREEN})`, border: `1px solid rgba(${GREEN},0.4)` }}>{r.origem?.nome || '—'}</span>
                <h3 style={{ margin: '0.5rem 0 0', fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text)' }}>NF nº {r.numero_nf}</h3>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-text)' }}>{moeda(r.valor_total)}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{r.itens.length} equipamento(s) vinculado(s)</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.6rem 1rem', fontSize: '0.85rem' }}>
              {[['Data da nota', dataBR(r.data_nf)], ['Fornecedor', r.fornecedor || '—'], ['Processo/Ofício', r.processo || '—']].map(([k, v]) => (
                <div key={k}><div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{k}</div><div style={{ color: 'var(--color-text)', fontWeight: 600 }}>{v}</div></div>
              ))}
            </div>

            {r.itens.length > 0 && dif != null && comValor > 0 && (
              <div style={{ fontSize: '0.78rem', color: Math.abs(dif) < 0.01 ? `rgb(${GREEN})` : '#f59e0b', background: Math.abs(dif) < 0.01 ? `rgba(${GREEN},0.1)` : 'rgba(245,158,11,0.1)', padding: '0.4rem 0.7rem', borderRadius: 'var(--radius-md)' }}>
                {Math.abs(dif) < 0.01
                  ? `✅ Valor dos equipamentos (${moeda(somaItens)}) confere com a nota.`
                  : `⚠️ Valor lançado nos equipamentos: ${moeda(somaItens)} — ${dif > 0 ? 'faltam' : 'excedem'} ${moeda(Math.abs(dif))} em relação à nota${comValor < r.itens.length ? ` (${r.itens.length - comValor} item(ns) sem valor)` : ''}.`}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button onClick={() => setAbertos(a => ({ ...a, [r.id]: !a[r.id] }))} style={btn()}>{aberto ? '▴ Ocultar composição' : '▾ Ver composição'}</button>
              {r.arquivo_path && <button onClick={() => abrirNota(r)} style={btn('59,130,246')}>📎 Ver nota fiscal</button>}
              {podeEditar && <button onClick={() => abrirModal(r)} style={btn('245,158,11')}>✏️ Editar</button>}
              {podeEditar && <button onClick={() => excluir(r)} style={btn('239,68,68')}>🗑️</button>}
            </div>

            {aberto && (
              <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '0.8rem 1rem' }}>
                {r.itens.length === 0 ? (
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Nenhum equipamento vinculado. Ao cadastrar equipamentos, selecione esta nota no campo "Recurso de origem".</span>
                ) : Object.keys(grupos).sort().map(t => (
                  <div key={t} style={{ marginBottom: '0.6rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--color-text)' }}>{grupos[t].length}× {t}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{grupos[t].map(e => e.numero_patrimonio + (e.status === 'descartado' ? ' (descartado)' : '')).sort().join(', ')}</div>
                  </div>
                ))}
                {r.observacoes && <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Obs.: {r.observacoes}</div>}
              </div>
            )}
          </div>
        );
      })}

      {/* Modal Recurso */}
      {modal && (
        <div style={overlay}>
          <div style={box()}>
            <div style={head}>
              <h3 style={{ margin: 0, color: 'var(--color-text)' }}>{editando ? '✏️ Editar Recurso' : '➕ Novo Recurso (Nota Fiscal)'}</h3>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.3rem', cursor: 'pointer' }}>✕</button>
            </div>
            <form onSubmit={salvar} style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div>
                <label style={lbl}>Entidade de origem *</label>
                <select value={form.origem_id} onChange={e => setForm({ ...form, origem_id: e.target.value })} style={inp()} required>
                  <option value="">Selecione...</option>
                  {origensAtivas.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div><label style={lbl}>Nº da nota fiscal *</label><input value={form.numero_nf} onChange={e => setForm({ ...form, numero_nf: e.target.value })} style={inp()} required /></div>
                <div><label style={lbl}>Data da nota</label><input type="date" value={form.data_nf} onChange={e => setForm({ ...form, data_nf: e.target.value })} style={inp()} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div><label style={lbl}>Fornecedor</label><input value={form.fornecedor} onChange={e => setForm({ ...form, fornecedor: e.target.value })} style={inp()} /></div>
                <div><label style={lbl}>Valor total da nota (R$)</label><input type="number" step="0.01" min="0" value={form.valor_total} onChange={e => setForm({ ...form, valor_total: e.target.value })} style={inp()} /></div>
              </div>
              <div><label style={lbl}>Nº do processo / ofício</label><input value={form.processo} onChange={e => setForm({ ...form, processo: e.target.value })} style={inp()} /></div>
              <div><label style={lbl}>Observações</label><textarea rows={2} value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} style={inp({ resize: 'vertical' })} /></div>
              <div>
                <label style={lbl}>Arquivo da nota fiscal (PDF ou imagem) — opcional</label>
                {editando?.arquivo_path && !removerArquivo && !arquivo && (
                  <div style={{ fontSize: '0.82rem', color: 'var(--color-text)', marginBottom: '0.4rem' }}>
                    📎 {editando.arquivo_nome} <button type="button" onClick={() => setRemoverArquivo(true)} style={{ marginLeft: '0.5rem', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}>remover</button>
                  </div>
                )}
                <input type="file" accept="application/pdf,image/*" onChange={e => setArquivo(e.target.files?.[0] || null)} style={{ color: 'var(--color-text)', fontSize: '0.85rem' }} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setModal(false)} style={btn('100,116,139')}>Cancelar</button>
                <button type="submit" disabled={salvando} style={btn(GREEN)}>{salvando ? 'Salvando...' : '💾 Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Entidades */}
      {modalOrigens && (
        <div style={overlay}>
          <div style={box('32rem')}>
            <div style={head}>
              <h3 style={{ margin: 0, color: 'var(--color-text)' }}>🏛️ Entidades de origem</h3>
              <button onClick={() => setModalOrigens(false)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.3rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input placeholder="Nova entidade (ex.: Justiça Eleitoral)" value={novaOrigem} onChange={e => setNovaOrigem(e.target.value)} onKeyDown={e => e.key === 'Enter' && addOrigem()} style={inp()} />
                <button onClick={addOrigem} style={btn(GREEN)}>Adicionar</button>
              </div>
              {(origens || []).map(o => (
                <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.8rem', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', opacity: o.ativo ? 1 : 0.55 }}>
                  <span style={{ color: 'var(--color-text)', fontWeight: 600, fontSize: '0.88rem' }}>{o.nome}</span>
                  <button onClick={() => alternarOrigem(o)} style={{ ...btn(o.ativo ? '239,68,68' : GREEN), padding: '0.25rem 0.7rem', fontSize: '0.75rem' }}>{o.ativo ? 'Desativar' : 'Ativar'}</button>
                </div>
              ))}
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>Entidades desativadas não aparecem em novos cadastros, mas continuam nos recursos já lançados.</p>
            </div>
          </div>
        </div>
      )}

      {/* Modal Relatório */}
      {modalRel && (
        <div style={overlay}>
          <div style={box('30rem')}>
            <div style={head}>
              <h3 style={{ margin: 0, color: 'var(--color-text)' }}>📄 Relatório de Recursos</h3>
              <button onClick={() => setModalRel(false)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.3rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div>
                <label style={lbl}>Entidade</label>
                <select value={rel.origem} onChange={e => setRel({ ...rel, origem: e.target.value, recurso: 'todos' })} style={inp()}>
                  <option value="todas">Todas as entidades</option>
                  {(origens || []).map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Nota fiscal</label>
                <select value={rel.recurso} onChange={e => setRel({ ...rel, recurso: e.target.value })} style={inp()}>
                  <option value="todos">Todas as notas</option>
                  {notasDaOrigem.map(r => <option key={r.id} value={r.id}>NF {r.numero_nf} — {r.origem?.nome} ({dataBR(r.data_nf)})</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div><label style={lbl}>Nota emitida a partir de</label><input type="date" value={rel.de} onChange={e => setRel({ ...rel, de: e.target.value })} style={inp()} /></div>
                <div><label style={lbl}>Até</label><input type="date" value={rel.ate} onChange={e => setRel({ ...rel, ate: e.target.value })} style={inp()} /></div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button onClick={() => setModalRel(false)} style={btn('100,116,139')}>Cancelar</button>
                <button onClick={gerarRelatorio} disabled={gerando} style={btn()}>{gerando ? 'Gerando...' : '📄 Gerar PDF'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Seletor usado nos cadastros de equipamento (individual e em lote)
export const SeletorRecurso = ({ value, onChange, recursos, lbl: lblStyle, inpStyle }) => (
  <div>
    <label style={lblStyle}>⚖️ Recurso de origem (Justiça, MP...) — opcional</label>
    <select value={value || ''} onChange={e => onChange(e.target.value)} style={inpStyle}>
      <option value="">— Compra própria / sem recurso —</option>
      {(recursos || []).map(r => (
        <option key={r.id} value={r.id}>{r.origem?.nome || '—'} — NF {r.numero_nf}{r.data_nf ? ` (${dataBR(r.data_nf)})` : ''}</option>
      ))}
    </select>
  </div>
);
