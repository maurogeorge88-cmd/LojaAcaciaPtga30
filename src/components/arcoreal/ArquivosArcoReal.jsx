import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '../../supabaseClient';

const BUCKET = 'arco-real-arquivos';
const LIMITE_BYTES = 20 * 1024 * 1024; // 20 MB (igual ao bucket)
const TIPOS_OK = [
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'text/plain', 'text/csv',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];
const EXT_MIME = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', txt: 'text/plain', csv: 'text/csv', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };

const mimeDe = (f) => {
  if (f.type && TIPOS_OK.includes(f.type)) return f.type;
  const ext = (f.name.split('.').pop() || '').toLowerCase();
  return EXT_MIME[ext] || f.type || '';
};
const fmtTam = (b) => {
  if (!b && b !== 0) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
};
const iconeDe = (m = '') => {
  if (m.startsWith('image/')) return '🖼️';
  if (m === 'application/pdf') return '📕';
  if (m.includes('word')) return '📘';
  if (m.includes('sheet') || m.includes('excel') || m === 'text/csv') return '📗';
  if (m.includes('presentation') || m.includes('powerpoint')) return '📙';
  return '📄';
};
const limparNome = (n) => String(n || '').replace(/[\\/\u0000-\u001f]/g, '').trim().slice(0, 200);
// caminho seguro no storage: sem acentos/espaços/símbolos
const caminhoSeguro = (nome) => {
  const ext = (nome.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
  const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${id}.${ext}`;
};

const card = { background: 'var(--color-surface, #fff)', border: '1px solid var(--color-border, #e5e7eb)', borderRadius: 'var(--radius-lg, 12px)' };
const btn = (cor = '#6366f1', outline = false) => ({
  height: '2.3rem', padding: '0 0.9rem', borderRadius: 'var(--radius-md, 8px)', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
  border: outline ? `1px solid ${cor}` : 'none', background: outline ? 'transparent' : cor, color: outline ? cor : '#fff', whiteSpace: 'nowrap',
});
const btnIcone = (cor) => ({ width: '2rem', height: '2rem', borderRadius: '8px', border: `1px solid ${cor}55`, background: 'transparent', color: cor, cursor: 'pointer', fontSize: '0.9rem' });
const input = { height: '2.4rem', padding: '0 0.75rem', borderRadius: '8px', border: '1px solid var(--color-border, #d1d5db)', background: 'var(--color-bg, #fff)', color: 'var(--color-text)', fontSize: '0.88rem', width: '100%', boxSizing: 'border-box' };

export default function ArquivosArcoReal({ podeEditar, userData, showSuccess, showError }) {
  const [pastas, setPastas] = useState([]);       // todas as pastas (árvore pequena)
  const [arquivos, setArquivos] = useState([]);   // arquivos da pasta atual
  const [pastaId, setPastaId] = useState(null);   // null = raiz
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState('nome');
  const [enviando, setEnviando] = useState(null); // {atual,total}
  const [arrastando, setArrastando] = useState(false);
  const [modal, setModal] = useState(null);       // {tipo, alvo, valor, valor2}
  const [preview, setPreview] = useState(null);   // {nome,url,mime}
  const [ocupado, setOcupado] = useState(false);
  const inputRef = useRef(null);
  const quem = userData?.nome || userData?.email || null;

  const carregarPastas = useCallback(async () => {
    const { data, error } = await supabase.from('arco_real_pastas').select('*').order('nome');
    if (error) { showError?.('Erro ao carregar pastas.'); return; }
    setPastas(data || []);
  }, [showError]);

  const carregarArquivos = useCallback(async () => {
    let q = supabase.from('arco_real_arquivos').select('*');
    q = pastaId ? q.eq('pasta_id', pastaId) : q.is('pasta_id', null);
    const { data, error } = await q.order('nome');
    if (error) { showError?.('Erro ao carregar arquivos.'); return; }
    setArquivos(data || []);
  }, [pastaId, showError]);

  useEffect(() => { (async () => { setCarregando(true); await carregarPastas(); setCarregando(false); })(); }, [carregarPastas]);
  useEffect(() => { carregarArquivos(); }, [carregarArquivos]);

  const porId = useMemo(() => Object.fromEntries(pastas.map(p => [p.id, p])), [pastas]);
  const caminho = useMemo(() => {
    const out = []; let cur = pastaId; let guard = 0;
    while (cur && porId[cur] && guard++ < 50) { out.unshift(porId[cur]); cur = porId[cur].pasta_pai_id; }
    return out;
  }, [pastaId, porId]);
  const subpastas = useMemo(() => pastas.filter(p => (p.pasta_pai_id || null) === pastaId), [pastas, pastaId]);
  const filtro = busca.trim().toLowerCase();
  const subVis = subpastas.filter(p => !filtro || p.nome.toLowerCase().includes(filtro));
  const arqVis = useMemo(() => {
    const l = arquivos.filter(a => !filtro || a.nome.toLowerCase().includes(filtro) || (a.descricao || '').toLowerCase().includes(filtro));
    const cmp = { nome: (a, b) => a.nome.localeCompare(b.nome, 'pt-BR'), recente: (a, b) => new Date(b.created_at) - new Date(a.created_at), tamanho: (a, b) => (b.tamanho || 0) - (a.tamanho || 0) }[ordem];
    return [...l].sort(cmp);
  }, [arquivos, filtro, ordem]);

  // descendentes de uma pasta (inclui ela) — para impedir mover para dentro de si mesma e para excluir
  const descendentes = useCallback((id) => {
    const ids = [id]; let i = 0;
    while (i < ids.length) { pastas.forEach(p => { if (p.pasta_pai_id === ids[i] && !ids.includes(p.id)) ids.push(p.id); }); i++; }
    return ids;
  }, [pastas]);

  const nomeDuplicado = (nome, paiId, ignorarId) =>
    pastas.some(p => p.id !== ignorarId && (p.pasta_pai_id || null) === (paiId || null) && p.nome.trim().toLowerCase() === nome.trim().toLowerCase());

  // ── PASTAS ──
  const salvarPasta = async () => {
    if (!podeEditar || ocupado) return;
    const nome = limparNome(modal.valor);
    if (!nome) { showError?.('Informe o nome da pasta.'); return; }
    const pai = modal.tipo === 'nova-pasta' ? pastaId : (modal.alvo.pasta_pai_id || null);
    if (nomeDuplicado(nome, pai, modal.alvo?.id)) { showError?.('Já existe uma pasta com esse nome aqui.'); return; }
    setOcupado(true);
    try {
      if (modal.tipo === 'nova-pasta') {
        const { error } = await supabase.from('arco_real_pastas').insert({ nome, pasta_pai_id: pastaId, criado_por: quem });
        if (error) throw error;
        showSuccess?.('Pasta criada.');
      } else {
        const { error } = await supabase.from('arco_real_pastas').update({ nome }).eq('id', modal.alvo.id);
        if (error) throw error;
        showSuccess?.('Pasta renomeada.');
      }
      setModal(null); await carregarPastas();
    } catch { showError?.('Não foi possível salvar a pasta.'); }
    setOcupado(false);
  };

  // Exclui pasta + subpastas + arquivos (remove primeiro os objetos do storage, pois o cascade do banco não os apaga)
  const excluirPasta = async () => {
    if (!podeEditar || ocupado) return;
    const alvo = modal.alvo; setOcupado(true);
    try {
      const ids = descendentes(alvo.id);
      const { data: arqs, error: e1 } = await supabase.from('arco_real_arquivos').select('id,storage_path').in('pasta_id', ids);
      if (e1) throw e1;
      const paths = (arqs || []).map(a => a.storage_path);
      for (let i = 0; i < paths.length; i += 100) {
        const { error } = await supabase.storage.from(BUCKET).remove(paths.slice(i, i + 100));
        if (error) throw error;
      }
      const { error: e2 } = await supabase.from('arco_real_pastas').delete().eq('id', alvo.id);
      if (e2) throw e2;
      showSuccess?.('Pasta excluída.');
      setModal(null);
      if (ids.includes(pastaId)) setPastaId(alvo.pasta_pai_id || null);
      await carregarPastas(); await carregarArquivos();
    } catch { showError?.('Erro ao excluir a pasta. Nada foi perdido além do que já havia sido removido; tente novamente.'); }
    setOcupado(false);
  };

  // ── ARQUIVOS ──
  const enviar = async (lista) => {
    if (!podeEditar) return;
    const files = Array.from(lista || []);
    if (!files.length) return;
    let ok = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i]; setEnviando({ atual: i + 1, total: files.length });
      const mime = mimeDe(f);
      if (f.size > LIMITE_BYTES) { showError?.(`"${f.name}" passa de 20 MB.`); continue; }
      if (f.size === 0) { showError?.(`"${f.name}" está vazio.`); continue; }
      if (!TIPOS_OK.includes(mime)) { showError?.(`Tipo não permitido: "${f.name}".`); continue; }
      const path = caminhoSeguro(f.name);
      const { error: up } = await supabase.storage.from(BUCKET).upload(path, f, { contentType: mime, upsert: false });
      if (up) { showError?.(`Falha ao enviar "${f.name}".`); continue; }
      const { error: ins } = await supabase.from('arco_real_arquivos').insert({
        pasta_id: pastaId, nome: limparNome(f.name), storage_path: path, mime_type: mime, tamanho: f.size, enviado_por: quem,
      });
      if (ins) { await supabase.storage.from(BUCKET).remove([path]); showError?.(`Falha ao registrar "${f.name}".`); continue; }
      ok++;
    }
    setEnviando(null);
    if (inputRef.current) inputRef.current.value = '';
    if (ok) { showSuccess?.(ok === 1 ? 'Arquivo enviado.' : `${ok} arquivos enviados.`); await carregarArquivos(); }
  };

  const urlAssinada = async (a, download) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(a.storage_path, 120, download ? { download: a.nome } : undefined);
    if (error || !data?.signedUrl) { showError?.('Não foi possível abrir o arquivo.'); return null; }
    return data.signedUrl;
  };
  const baixar = async (a) => { const u = await urlAssinada(a, true); if (u) window.open(u, '_blank', 'noopener'); };
  const abrir = async (a) => {
    const u = await urlAssinada(a, false); if (!u) return;
    if (a.mime_type === 'application/pdf' || (a.mime_type || '').startsWith('image/')) setPreview({ nome: a.nome, url: u, mime: a.mime_type });
    else window.open(u, '_blank', 'noopener');
  };

  const salvarArquivo = async () => {
    if (!podeEditar || ocupado) return;
    setOcupado(true);
    try {
      if (modal.tipo === 'editar-arq') {
        const nome = limparNome(modal.valor);
        if (!nome) { showError?.('Informe o nome.'); setOcupado(false); return; }
        const { error } = await supabase.from('arco_real_arquivos').update({ nome, descricao: modal.valor2?.trim() || null }).eq('id', modal.alvo.id);
        if (error) throw error;
        showSuccess?.('Arquivo atualizado.');
      } else if (modal.tipo === 'mover-arq') {
        const destino = modal.valor === '' ? null : modal.valor;
        const { error } = await supabase.from('arco_real_arquivos').update({ pasta_id: destino }).eq('id', modal.alvo.id);
        if (error) throw error;
        showSuccess?.('Arquivo movido.');
      } else if (modal.tipo === 'mover-pasta') {
        const destino = modal.valor === '' ? null : modal.valor;
        if (destino && descendentes(modal.alvo.id).includes(destino)) { showError?.('Não é possível mover a pasta para dentro dela mesma.'); setOcupado(false); return; }
        if (nomeDuplicado(modal.alvo.nome, destino, modal.alvo.id)) { showError?.('Já existe uma pasta com esse nome no destino.'); setOcupado(false); return; }
        const { error } = await supabase.from('arco_real_pastas').update({ pasta_pai_id: destino }).eq('id', modal.alvo.id);
        if (error) throw error;
        showSuccess?.('Pasta movida.');
      }
      setModal(null); await carregarPastas(); await carregarArquivos();
    } catch { showError?.('Não foi possível salvar.'); }
    setOcupado(false);
  };

  const excluirArquivo = async () => {
    if (!podeEditar || ocupado) return;
    const a = modal.alvo; setOcupado(true);
    try {
      const { error: e1 } = await supabase.storage.from(BUCKET).remove([a.storage_path]);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('arco_real_arquivos').delete().eq('id', a.id);
      if (e2) throw e2;
      showSuccess?.('Arquivo excluído.'); setModal(null); await carregarArquivos();
    } catch { showError?.('Erro ao excluir o arquivo.'); }
    setOcupado(false);
  };

  // caminho completo p/ seletor de destino
  const rotuloPasta = (p) => { const n = []; let c = p; let g = 0; while (c && g++ < 50) { n.unshift(c.nome); c = porId[c.pasta_pai_id]; } return n.join(' / '); };
  const opcoesDestino = useMemo(() => {
    const excl = modal?.tipo === 'mover-pasta' ? descendentes(modal.alvo.id) : [];
    return pastas.filter(p => !excl.includes(p.id)).map(p => ({ id: p.id, rotulo: rotuloPasta(p) })).sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
    // eslint-disable-next-line
  }, [modal, pastas]);

  const soltar = (e) => { e.preventDefault(); setArrastando(false); if (podeEditar) enviar(e.dataTransfer.files); };

  if (carregando) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Carregando arquivos…</div>;

  const vazio = !subVis.length && !arqVis.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
      onDragOver={(e) => { if (podeEditar) { e.preventDefault(); setArrastando(true); } }}
      onDragLeave={() => setArrastando(false)} onDrop={soltar}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)' }}>📁 Arquivos</h2>
        {podeEditar && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button style={btn('#6366f1', true)} onClick={() => setModal({ tipo: 'nova-pasta', valor: '' })}>➕ Nova pasta</button>
            <button style={btn('#10b981')} disabled={!!enviando} onClick={() => inputRef.current?.click()}>⬆️ Enviar arquivos</button>
            <input ref={inputRef} type="file" multiple hidden onChange={(e) => enviar(e.target.files)} />
          </div>
        )}
      </div>

      {/* navegação */}
      <div style={{ ...card, padding: '0.6rem 0.9rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center', fontSize: '0.88rem' }}>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: '#6366f1' }} onClick={() => setPastaId(null)}>🏠 Início</button>
        {caminho.map(p => (
          <React.Fragment key={p.id}>
            <span style={{ color: 'var(--color-text-secondary)' }}>/</span>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: '#6366f1' }} onClick={() => setPastaId(p.id)}>{p.nome}</button>
          </React.Fragment>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        <input style={{ ...input, flex: '1 1 14rem' }} placeholder="🔍 Buscar nesta pasta…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select style={{ ...input, width: 'auto' }} value={ordem} onChange={(e) => setOrdem(e.target.value)}>
          <option value="nome">Ordenar: nome</option><option value="recente">Ordenar: mais recentes</option><option value="tamanho">Ordenar: maiores</option>
        </select>
      </div>

      {enviando && <div style={{ ...card, padding: '0.7rem 1rem', fontSize: '0.88rem', color: 'var(--color-text)' }}>⏳ Enviando {enviando.atual} de {enviando.total}…</div>}

      <div style={{ ...card, padding: '0.5rem', outline: arrastando ? '2px dashed #6366f1' : 'none', minHeight: '8rem' }}>
        {vazio && (
          <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
            {filtro ? 'Nada encontrado.' : podeEditar ? 'Pasta vazia. Arraste arquivos aqui ou use “Enviar arquivos”.' : 'Pasta vazia.'}
          </div>
        )}
        {subVis.map(p => (
          <div key={p.id} style={linha}>
            <button style={{ ...nomeBtn }} onClick={() => { setPastaId(p.id); setBusca(''); }}>📁 <b>{p.nome}</b></button>
            <span style={meta}>{pastas.filter(x => x.pasta_pai_id === p.id).length} subpasta(s)</span>
            {podeEditar && (
              <span style={{ display: 'flex', gap: '0.3rem' }}>
                <button style={btnIcone('#6366f1')} title="Renomear" onClick={() => setModal({ tipo: 'renomear-pasta', alvo: p, valor: p.nome })}>✏️</button>
                <button style={btnIcone('#0ea5e9')} title="Mover" onClick={() => setModal({ tipo: 'mover-pasta', alvo: p, valor: p.pasta_pai_id || '' })}>📂</button>
                <button style={btnIcone('#ef4444')} title="Excluir" onClick={() => setModal({ tipo: 'excluir-pasta', alvo: p })}>🗑️</button>
              </span>
            )}
          </div>
        ))}
        {arqVis.map(a => (
          <div key={a.id} style={linha}>
            <button style={nomeBtn} onClick={() => abrir(a)} title={a.descricao || a.nome}>
              {iconeDe(a.mime_type)} <b>{a.nome}</b>
              {a.descricao && <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--color-text-secondary)', fontWeight: 400 }}>{a.descricao}</span>}
            </button>
            <span style={meta}>{fmtTam(a.tamanho)} · {new Date(a.created_at).toLocaleDateString('pt-BR')}</span>
            <span style={{ display: 'flex', gap: '0.3rem' }}>
              <button style={btnIcone('#10b981')} title="Baixar" onClick={() => baixar(a)}>⬇️</button>
              {podeEditar && <>
                <button style={btnIcone('#6366f1')} title="Renomear / descrição" onClick={() => setModal({ tipo: 'editar-arq', alvo: a, valor: a.nome, valor2: a.descricao || '' })}>✏️</button>
                <button style={btnIcone('#0ea5e9')} title="Mover" onClick={() => setModal({ tipo: 'mover-arq', alvo: a, valor: a.pasta_id || '' })}>📂</button>
                <button style={btnIcone('#ef4444')} title="Excluir" onClick={() => setModal({ tipo: 'excluir-arq', alvo: a })}>🗑️</button>
              </>}
            </span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)' }}>Limite de 20 MB por arquivo · PDF, imagens, Word, Excel, PowerPoint, TXT e CSV · exclusão é definitiva.</div>

      {/* pré-visualização */}
      {preview && (
        <div style={overlay} onClick={() => setPreview(null)}>
          <div style={{ ...card, width: 'min(960px, 96vw)', height: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 1rem', borderBottom: '1px solid var(--color-border, #e5e7eb)' }}>
              <b style={{ color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview.nome}</b>
              <button style={btn('#6b7280', true)} onClick={() => setPreview(null)}>Fechar</button>
            </div>
            {preview.mime === 'application/pdf'
              ? <iframe title={preview.nome} src={preview.url} style={{ flex: 1, border: 'none' }} />
              : <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem' }}><img alt={preview.nome} src={preview.url} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /></div>}
          </div>
        </div>
      )}

      {/* modais */}
      {modal && (
        <div style={overlay} onClick={() => !ocupado && setModal(null)}>
          <div style={{ ...card, width: 'min(26rem, 94vw)', padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }} onClick={(e) => e.stopPropagation()}>
            {(modal.tipo === 'nova-pasta' || modal.tipo === 'renomear-pasta') && <>
              <h3 style={titulo}>{modal.tipo === 'nova-pasta' ? '➕ Nova pasta' : '✏️ Renomear pasta'}</h3>
              <input style={input} autoFocus maxLength={120} placeholder="Nome da pasta" value={modal.valor} onChange={(e) => setModal({ ...modal, valor: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && salvarPasta()} />
              <Acoes ocupado={ocupado} onCancel={() => setModal(null)} onOk={salvarPasta} ok="Salvar" />
            </>}
            {modal.tipo === 'editar-arq' && <>
              <h3 style={titulo}>✏️ Arquivo</h3>
              <input style={input} maxLength={200} value={modal.valor} onChange={(e) => setModal({ ...modal, valor: e.target.value })} />
              <textarea style={{ ...input, height: '5rem', padding: '0.5rem 0.75rem', resize: 'vertical' }} placeholder="Descrição (opcional)" value={modal.valor2} onChange={(e) => setModal({ ...modal, valor2: e.target.value })} />
              <Acoes ocupado={ocupado} onCancel={() => setModal(null)} onOk={salvarArquivo} ok="Salvar" />
            </>}
            {(modal.tipo === 'mover-arq' || modal.tipo === 'mover-pasta') && <>
              <h3 style={titulo}>📂 Mover “{modal.alvo.nome}”</h3>
              <select style={input} value={modal.valor} onChange={(e) => setModal({ ...modal, valor: e.target.value })}>
                <option value="">🏠 Início (raiz)</option>
                {opcoesDestino.map(o => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
              </select>
              <Acoes ocupado={ocupado} onCancel={() => setModal(null)} onOk={salvarArquivo} ok="Mover" />
            </>}
            {modal.tipo === 'excluir-arq' && <>
              <h3 style={titulo}>🗑️ Excluir arquivo?</h3>
              <p style={txt}>“{modal.alvo.nome}” será removido definitivamente.</p>
              <Acoes ocupado={ocupado} onCancel={() => setModal(null)} onOk={excluirArquivo} ok="Excluir" cor="#ef4444" />
            </>}
            {modal.tipo === 'excluir-pasta' && <>
              <h3 style={titulo}>🗑️ Excluir pasta?</h3>
              <p style={txt}>A pasta “{modal.alvo.nome}”, todas as suas subpastas e <b>todos os arquivos dentro</b> serão removidos definitivamente.</p>
              <Acoes ocupado={ocupado} onCancel={() => setModal(null)} onOk={excluirPasta} ok="Excluir tudo" cor="#ef4444" />
            </>}
          </div>
        </div>
      )}
    </div>
  );
}

function Acoes({ ocupado, onCancel, onOk, ok, cor = '#6366f1' }) {
  return (
    <div style={{ display: 'flex', gap: '0.6rem' }}>
      <button style={{ ...btn('#6b7280', true), flex: 1 }} disabled={ocupado} onClick={onCancel}>Cancelar</button>
      <button style={{ ...btn(cor), flex: 1, opacity: ocupado ? 0.6 : 1 }} disabled={ocupado} onClick={onOk}>{ocupado ? 'Aguarde…' : ok}</button>
    </div>
  );
}

const linha = { display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.55rem 0.7rem', borderBottom: '1px solid var(--color-border, #f1f5f9)', flexWrap: 'wrap' };
const nomeBtn = { flex: '1 1 14rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text)', fontSize: '0.9rem', padding: 0, minWidth: 0, wordBreak: 'break-word' };
const meta = { fontSize: '0.76rem', color: 'var(--color-text-secondary)' };
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem' };
const titulo = { margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)' };
const txt = { margin: 0, fontSize: '0.88rem', color: 'var(--color-text-secondary)' };
