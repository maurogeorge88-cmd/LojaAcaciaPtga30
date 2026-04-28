import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';

const GRAUS = ['Aprendiz', 'Companheiro', 'Mestre'];
const GRAU_ORDEM = { 'Aprendiz': 1, 'Companheiro': 2, 'Mestre': 3, 'Mestre Instalado': 3 };

const CATEGORIAS = [
  'Ritualisticas', 'Filosofia Maconica', 'Historia da Maconaria',
  'Simbolismo', 'Esoterismo', 'Religiao e Espiritualidade',
  'Ciencias e Tecnologia', 'Literatura', 'Direito', 'Administracao',
  'Saude', 'Educacao', 'Outros',
];

const CAT_EMOJI = {
  'Ritualisticas': '\u{1F4DC}', 'Filosofia Maconica': '\u{1F52E}', 'Historia da Maconaria': '\u{1F3DB}\uFE0F',
  'Simbolismo': '\u2696\uFE0F', 'Esoterismo': '\u2728', 'Religiao e Espiritualidade': '\u{1F64F}',
  'Ciencias e Tecnologia': '\u{1F52C}', 'Literatura': '\u{1F4DA}', 'Direito': '\u2696\uFE0F',
  'Administracao': '\u{1F4CA}', 'Saude': '\u{1F3E5}', 'Educacao': '\u{1F393}', 'Outros': '\u{1F4C1}',
};

const GS = {
  'Aprendiz':    { bg: 'rgba(16,185,129,0.15)', cor: '#059669', brd: 'rgba(16,185,129,0.4)' },
  'Companheiro': { bg: 'rgba(59,130,246,0.15)', cor: '#2563eb', brd: 'rgba(59,130,246,0.4)' },
  'Mestre':      { bg: 'rgba(139,92,246,0.15)', cor: '#7c3aed', brd: 'rgba(139,92,246,0.4)' },
};

function fmtBytes(b) {
  if (!b) return '';
  if (b < 1048576) return Math.round(b / 1024) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

function sanitizarNome(str) {
  return str
    .normalize('NFD').split('').filter(c => c.charCodeAt(0) < 128).join('').replace(/[^a-zA-Z0-9]/g, '_')
    .substring(0, 40);
}

const FORM0 = { titulo: '', autor: '', categoria: 'Ritualisticas', grau: 'Aprendiz', descricao: '' };

export default function BibliotecaOnline({ permissoes, grauUsuario, irmaoLogadoId, showSuccess, showError }) {
  const [livros, setLivros]               = useState([]);
  const [loading, setLoading]             = useState(true);
  const [modal, setModal]                 = useState(false);
  const [editando, setEditando]           = useState(null);
  const [form, setForm]                   = useState(FORM0);
  const [filePdf, setFilePdf]             = useState(null);
  const [fileCapa, setFileCapa]           = useState(null);
  const [preview, setPreview]             = useState(null);
  const [progress, setProgress]           = useState('');
  const [salvando, setSalvando]           = useState(false);
  const [fGrau, setFGrau]               = useState('todos');
  const [fCat, setFCat]                 = useState('todas');
  const [fNome, setFNome]               = useState('');
  const [baixando, setBaixando]           = useState({});
  const pdfRef  = useRef();
  const capaRef = useRef();

  const grauOrd = GRAU_ORDEM[grauUsuario] || 3;

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('biblioteca_online').select('*').order('categoria').order('titulo');
    if (error) showError('Erro: ' + error.message);
    else setLivros(data || []);
    setLoading(false);
  }

  const filtrados = livros.filter(l => {
    if (fGrau !== 'todos' && l.grau !== fGrau) return false;
    if (fCat !== 'todas' && l.categoria !== fCat) return false;
    if (fNome) {
      const q = fNome.toLowerCase();
      if (!l.titulo.toLowerCase().includes(q) && !(l.autor || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  function podeBaixar(grauLivro) { return grauOrd >= (GRAU_ORDEM[grauLivro] || 1); }

  function abrirModal(livro) {
    if (livro) {
      setEditando(livro);
      setForm({ titulo: livro.titulo, autor: livro.autor || '', categoria: livro.categoria, grau: livro.grau, descricao: livro.descricao || '' });
      setPreview(livro.capa_url || null);
    } else {
      setEditando(null);
      setForm(FORM0);
      setPreview(null);
    }
    setFilePdf(null); setFileCapa(null); setProgress('');
    setModal(true);
  }

  function fechar() {
    setModal(false); setEditando(null);
    setFilePdf(null); setFileCapa(null); setPreview(null); setProgress('');
  }

  function onPdf(e) {
    const f = e.target.files[0];
    if (!f) return;
    if (f.type !== 'application/pdf') { showError('Apenas PDFs.'); return; }
    if (f.size > 104857600) { showError('Max 100 MB.'); return; }
    setFilePdf(f);
  }

  function onCapa(e) {
    const f = e.target.files[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { showError('A capa deve ser imagem.'); return; }
    setFileCapa(f);
    setPreview(URL.createObjectURL(f));
  }

  async function salvar() {
    if (!form.titulo) { showError('Titulo obrigatorio.'); return; }
    if (!editando && !filePdf) { showError('Selecione um PDF.'); return; }
    setSalvando(true);
    try {
      let pdfUrl = editando?.pdf_url || null;
      let pdfPath = editando?.pdf_path || null;
      let capaUrl = editando?.capa_url || null;
      let capaPath = editando?.capa_path || null;
      let tamPdf = editando?.tamanho_pdf || null;

      if (filePdf) {
        setProgress('Enviando PDF...');
        const ext = filePdf.name.split('.').pop();
        const path = Date.now() + '_' + sanitizarNome(form.titulo) + '.' + ext;
        const { error: e1 } = await supabase.storage.from('biblioteca-pdf').upload(path, filePdf, { upsert: false });
        if (e1) throw new Error('Upload PDF: ' + e1.message);
        pdfUrl = supabase.storage.from('biblioteca-pdf').getPublicUrl(path).data.publicUrl;
        pdfPath = path;
        tamPdf = filePdf.size;
        if (editando?.pdf_path) await supabase.storage.from('biblioteca-pdf').remove([editando.pdf_path]);
      }

      if (fileCapa) {
        setProgress('Enviando capa...');
        const ext = fileCapa.name.split('.').pop().replace(/[^a-zA-Z0-9]/g, '');
        const path = 'capa_' + Date.now() + '.' + ext;
        const { error: e2 } = await supabase.storage.from('biblioteca-capas').upload(path, fileCapa, { upsert: false });
        if (e2) throw new Error('Upload capa: ' + e2.message);
        capaUrl = supabase.storage.from('biblioteca-capas').getPublicUrl(path).data.publicUrl;
        capaPath = path;
        if (editando?.capa_path) await supabase.storage.from('biblioteca-capas').remove([editando.capa_path]);
      }

      setProgress('Salvando...');
      const payload = {
        titulo: form.titulo, autor: form.autor || null,
        categoria: form.categoria, grau: form.grau,
        descricao: form.descricao || null,
        pdf_url: pdfUrl, pdf_path: pdfPath,
        capa_url: capaUrl, capa_path: capaPath,
        tamanho_pdf: tamPdf,
      };

      if (editando) {
        const { error } = await supabase.from('biblioteca_online').update(payload).eq('id', editando.id);
        if (error) throw error;
        showSuccess('Livro atualizado!');
      } else {
        const uid = (await supabase.auth.getUser()).data.user?.id;
        const { error } = await supabase.from('biblioteca_online').insert([{ ...payload, cadastrado_por: uid }]);
        if (error) throw error;
        showSuccess('Livro cadastrado!');
      }
      fechar(); load();
    } catch (e) {
      showError(e.message);
    } finally {
      setSalvando(false); setProgress('');
    }
  }

  async function excluir(livro) {
    if (!window.confirm('Excluir "' + livro.titulo + '"?')) return;
    try {
      if (livro.pdf_path)  await supabase.storage.from('biblioteca-pdf').remove([livro.pdf_path]);
      if (livro.capa_path) await supabase.storage.from('biblioteca-capas').remove([livro.capa_path]);
      const { error } = await supabase.from('biblioteca_online').delete().eq('id', livro.id);
      if (error) throw error;
      showSuccess('Excluido.'); load();
    } catch (e) { showError(e.message); }
  }

  async function baixar(livro) {
    if (!podeBaixar(livro.grau)) { showError('Acesso restrito: ' + livro.grau); return; }
    setBaixando(b => ({ ...b, [livro.id]: true }));
    try {
      await supabase.from('biblioteca_online_downloads').insert([{ livro_id: livro.id, irmao_id: irmaoLogadoId }]);
      await supabase.from('biblioteca_online').update({ total_downloads: (livro.total_downloads || 0) + 1 }).eq('id', livro.id);
      const a = document.createElement('a');
      a.href = livro.pdf_url; a.download = livro.titulo + '.pdf'; a.target = '_blank';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setLivros(ls => ls.map(l => l.id === livro.id ? { ...l, total_downloads: (l.total_downloads || 0) + 1 } : l));
    } catch (e) { showError(e.message); }
    finally { setBaixando(b => { const n = { ...b }; delete n[livro.id]; return n; }); }
  }

  const inp = {
    background: 'var(--color-surface-2)', color: 'var(--color-text)',
    border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
    padding: '0.5rem 0.75rem', fontSize: '0.875rem', width: '100%',
  };

  const cats = [...new Set(filtrados.map(l => l.categoria))].sort();

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh', padding: '0.75rem' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--color-text)', margin: 0 }}>Biblioteca Online</h2>
          <p style={{ color: 'var(--color-text-muted)', margin: '0.2rem 0 0', fontSize: '0.85rem' }}>Acervo digital para download</p>
        </div>
        {permissoes?.pode_editar_biblioteca && (
          <button onClick={() => abrirModal(null)} style={{ padding: '0.6rem 1.25rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: '700', cursor: 'pointer' }}>
            Cadastrar Livro
          </button>
        )}
      </div>

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1rem', marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Buscar</label>
          <input value={fNome} onChange={e => setFNome(e.target.value)} placeholder="Titulo ou autor..." style={inp} />
        </div>
        <div style={{ flex: '0 0 150px' }}>
          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Grau</label>
          <select value={fGrau} onChange={e => setFGrau(e.target.value)} style={inp}>
            <option value="todos">Todos</option>
            {GRAUS.filter(g => grauOrd >= GRAU_ORDEM[g]).map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div style={{ flex: '0 0 200px' }}>
          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Categoria</label>
          <select value={fCat} onChange={e => setFCat(e.target.value)} style={inp}>
            <option value="todas">Todas</option>
            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', paddingBottom: '0.5rem' }}>{filtrados.length} livro(s)</span>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <div style={{ width: '2.5rem', height: '2.5rem', border: '3px solid var(--color-border)', borderTopColor: 'var(--color-accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      )}

      {!loading && filtrados.length === 0 && (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>
          <p style={{ fontSize: '3rem', margin: 0 }}>📚</p>
          <p style={{ fontWeight: '600' }}>Nenhum livro encontrado</p>
        </div>
      )}

      {!loading && filtrados.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {cats.map(cat => {
            const livCat = filtrados.filter(l => l.categoria === cat);
            const em = CAT_EMOJI[cat] || '📁';
            return (
              <div key={cat}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 1rem', background: 'var(--color-accent)', borderRadius: 'var(--radius-lg)', flexShrink: 0 }}>
                    <span>{em}</span>
                    <span style={{ fontWeight: '800', color: '#fff', fontSize: '0.9rem' }}>{cat}</span>
                    <span style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', borderRadius: '999px', padding: '0 0.4rem', fontSize: '0.72rem', fontWeight: '700' }}>{livCat.length}</span>
                  </div>
                  <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
                  {livCat.map(livro => {
                    const gs = GS[livro.grau] || GS['Mestre'];
                    const pode = podeBaixar(livro.grau);
                    return (
                      <div key={livro.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', display: 'flex', flexDirection: 'column', opacity: pode ? 1 : 0.55 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.6rem', background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                          <span style={{ padding: '0.15rem 0.55rem', borderRadius: '999px', fontSize: '0.65rem', fontWeight: '800', background: gs.bg, color: gs.cor, border: '1px solid ' + gs.brd }}>
                            {livro.grau}
                          </span>
                          {permissoes?.pode_editar_biblioteca && (
                            <div style={{ display: 'flex', gap: '0.3rem' }}>
                              <button onClick={() => abrirModal(livro)} style={{ padding: '0.2rem 0.45rem', background: 'var(--color-accent-bg)', color: 'var(--color-accent)', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', cursor: 'pointer' }}>✏️</button>
                              <button onClick={() => excluir(livro)} style={{ padding: '0.2rem 0.45rem', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', cursor: 'pointer' }}>🗑️</button>
                            </div>
                          )}
                        </div>
                        <div style={{ position: 'relative', paddingTop: '133%', background: 'var(--color-surface-2)' }}>
                          {livro.capa_url
                            ? <img src={livro.capa_url} alt={livro.titulo} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem' }}>📖</div>
                          }
                          {!pode && (
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>🔒</div>
                          )}
                        </div>
                        <div style={{ padding: '0.75rem', flex: 1 }}>
                          <p style={{ margin: '0 0 0.2rem', fontWeight: '700', fontSize: '0.82rem', color: 'var(--color-text)', lineHeight: 1.3 }}>{livro.titulo}</p>
                          {livro.autor && <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{livro.autor}</p>}
                          {livro.tamanho_pdf && <p style={{ margin: '0.2rem 0 0', fontSize: '0.62rem', color: 'var(--color-text-muted)' }}>{fmtBytes(livro.tamanho_pdf)}</p>}
                          {livro.total_downloads > 0 && <p style={{ margin: '0.1rem 0 0', fontSize: '0.62rem', color: 'var(--color-text-muted)' }}>{livro.total_downloads} download(s)</p>}
                        </div>
                        <div style={{ padding: '0 0.75rem 0.75rem' }}>
                          <button onClick={() => pode ? baixar(livro) : showError('Acesso restrito: ' + livro.grau)} disabled={!pode || baixando[livro.id]} style={{ width: '100%', padding: '0.55rem', fontWeight: '700', fontSize: '0.8rem', border: 'none', borderRadius: 'var(--radius-lg)', cursor: pode ? 'pointer' : 'not-allowed', background: pode ? 'var(--color-accent)' : 'var(--color-surface-3)', color: pode ? '#fff' : 'var(--color-text-muted)' }}>
                            {baixando[livro.id] ? 'Baixando...' : pode ? 'Baixar PDF' : 'Grau ' + livro.grau}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: 'var(--color-accent)', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ color: '#fff', fontWeight: '800', margin: 0 }}>{editando ? 'Editar Livro' : 'Cadastrar Livro'}</h3>
              <button onClick={fechar} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '50%', width: '2rem', height: '2rem', cursor: 'pointer', fontWeight: '700' }}>x</button>
            </div>
            <div style={{ overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Titulo</label>
                <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} style={inp} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Autor</label>
                  <input value={form.autor} onChange={e => setForm(f => ({ ...f, autor: e.target.value }))} style={inp} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Grau</label>
                  <select value={form.grau} onChange={e => setForm(f => ({ ...f, grau: e.target.value }))} style={inp}>
                    {GRAUS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Categoria</label>
                <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} style={inp}>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Descricao</label>
                <textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={2} style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>PDF{!editando && ' *'}</label>
                <div onClick={() => pdfRef.current && pdfRef.current.click()} style={{ border: '2px dashed var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1rem', textAlign: 'center', cursor: 'pointer', background: 'var(--color-surface-2)' }}>
                  <input ref={pdfRef} type="file" accept=".pdf" onChange={onPdf} style={{ display: 'none' }} />
                  <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                    {filePdf ? filePdf.name + ' (' + fmtBytes(filePdf.size) + ')' : editando && editando.pdf_url ? 'PDF cadastrado - clique para trocar' : 'Clique para selecionar (max 100 MB)'}
                  </p>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Capa</label>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ width: '70px', height: '93px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {preview ? <img src={preview} alt="Capa" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>🖼️</span>}
                  </div>
                  <div onClick={() => capaRef.current && capaRef.current.click()} style={{ flex: 1, border: '2px dashed var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1rem', textAlign: 'center', cursor: 'pointer', background: 'var(--color-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <input ref={capaRef} type="file" accept="image/*" onChange={onCapa} style={{ display: 'none' }} />
                    <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                      {fileCapa ? fileCapa.name : editando && editando.capa_url ? 'Clique para trocar' : 'Clique para adicionar (JPG, PNG)'}
                    </p>
                  </div>
                </div>
              </div>
              {progress !== '' && (
                <div style={{ background: 'var(--color-accent-bg)', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-md)', padding: '0.6rem 1rem', fontSize: '0.82rem', color: 'var(--color-accent)', fontWeight: '600' }}>
                  {progress}
                </div>
              )}
            </div>
            <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--color-border)', display: 'flex', gap: '0.5rem' }}>
              <button onClick={fechar} style={{ flex: 1, padding: '0.6rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontWeight: '600', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando} style={{ flex: 2, padding: '0.6rem', background: salvando ? 'var(--color-surface-3)' : 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: '700', cursor: salvando ? 'not-allowed' : 'pointer' }}>
                {salvando ? (progress || 'Salvando...') : editando ? 'Salvar' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
