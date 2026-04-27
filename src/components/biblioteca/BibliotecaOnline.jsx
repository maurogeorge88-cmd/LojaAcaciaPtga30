import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';

// ── Helpers ───────────────────────────────────────────────────────────────────
const GRAUS = ['Aprendiz', 'Companheiro', 'Mestre'];
const GRAU_ORDEM = { 'Aprendiz': 1, 'Companheiro': 2, 'Mestre': 3, 'Mestre Instalado': 3 };
const CATEGORIAS = ['Ritualística', 'Filosofia', 'História', 'Simbolismo', 'Esoterismo', 'Outros'];

const GRAU_STYLE = {
  'Aprendiz':    { bg: 'rgba(16,185,129,0.15)',  cor: '#059669', brd: 'rgba(16,185,129,0.4)' },
  'Companheiro': { bg: 'rgba(59,130,246,0.15)',  cor: '#2563eb', brd: 'rgba(59,130,246,0.4)' },
  'Mestre':      { bg: 'rgba(139,92,246,0.15)',  cor: '#7c3aed', brd: 'rgba(139,92,246,0.4)' },
};

function fmtBytes(b) {
  if (!b) return '';
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

const FORM_VAZIO = {
  titulo: '', autor: '', categoria: 'Ritualística',
  grau: 'Aprendiz', descricao: '',
};

// ── Componente principal ──────────────────────────────────────────────────────
export default function BibliotecaOnline({ permissoes, grauUsuario, irmaoLogadoId, showSuccess, showError }) {
  const [livros, setLivros]             = useState([]);
  const [loading, setLoading]           = useState(true);
  const [modalCadastro, setModalCadastro] = useState(false);
  const [livroEditando, setLivroEditando] = useState(null);
  const [form, setForm]                 = useState(FORM_VAZIO);
  const [filePdf, setFilePdf]           = useState(null);
  const [fileCapa, setFileCapa]         = useState(null);
  const [previewCapa, setPreviewCapa]   = useState(null);
  const [uploadProgress, setUploadProgress] = useState('');
  const [salvando, setSalvando]         = useState(false);
  const [filtroGrau, setFiltroGrau]     = useState('todos');
  const [filtroCat, setFiltroCat]       = useState('todas');
  const [filtroNome, setFiltroNome]     = useState('');
  const [baixando, setBaixando]         = useState({});
  const pdfRef  = useRef();
  const capaRef = useRef();

  // Grau hierárquico do usuário logado
  const grauOrdem = GRAU_ORDEM[grauUsuario] || 3;

  useEffect(() => { carregarLivros(); }, []);

  const carregarLivros = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('biblioteca_online')
      .select('*')
      .order('grau')
      .order('titulo');
    if (error) { showError('Erro ao carregar: ' + error.message); }
    else setLivros(data || []);
    setLoading(false);
  };

  // ── Filtros ─────────────────────────────────────────────────────────────────
  const livrosFiltrados = livros.filter(l => {
    if (filtroGrau !== 'todos' && l.grau !== filtroGrau) return false;
    if (filtroCat !== 'todas' && l.categoria !== filtroCat) return false;
    if (filtroNome && !l.titulo.toLowerCase().includes(filtroNome.toLowerCase()) &&
        !(l.autor || '').toLowerCase().includes(filtroNome.toLowerCase())) return false;
    return true;
  });

  // ── Pode baixar ──────────────────────────────────────────────────────────────
  const podeBaixar = (grauLivro) => grauOrdem >= (GRAU_ORDEM[grauLivro] || 1);

  // ── Upload de arquivo ────────────────────────────────────────────────────────
  const onChangePdf = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.type !== 'application/pdf') { showError('Apenas arquivos PDF são aceitos.'); return; }
    if (f.size > 100 * 1024 * 1024) { showError('PDF muito grande. Máximo 100 MB.'); return; }
    setFilePdf(f);
  };

  const onChangeCapa = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { showError('A capa deve ser uma imagem.'); return; }
    setFileCapa(f);
    setPreviewCapa(URL.createObjectURL(f));
  };

  // ── Abrir modal ──────────────────────────────────────────────────────────────
  const abrirCadastro = (livro = null) => {
    if (livro) {
      setLivroEditando(livro);
      setForm({ titulo: livro.titulo, autor: livro.autor || '', categoria: livro.categoria, grau: livro.grau, descricao: livro.descricao || '' });
      setPreviewCapa(livro.capa_url || null);
    } else {
      setLivroEditando(null);
      setForm(FORM_VAZIO);
      setPreviewCapa(null);
    }
    setFilePdf(null);
    setFileCapa(null);
    setUploadProgress('');
    setModalCadastro(true);
  };

  const fecharModal = () => {
    setModalCadastro(false);
    setLivroEditando(null);
    setFilePdf(null);
    setFileCapa(null);
    setPreviewCapa(null);
    setUploadProgress('');
  };

  // ── Salvar ───────────────────────────────────────────────────────────────────
  const salvar = async () => {
    if (!form.titulo) { showError('Título é obrigatório.'); return; }
    if (!livroEditando && !filePdf) { showError('Selecione um arquivo PDF.'); return; }
    setSalvando(true);
    try {
      let pdfUrl = livroEditando?.pdf_url || null;
      let pdfPath = livroEditando?.pdf_path || null;
      let capaUrl = livroEditando?.capa_url || null;
      let capaPath = livroEditando?.capa_path || null;
      let tamanhoPdf = livroEditando?.tamanho_pdf || null;

      // Upload PDF
      if (filePdf) {
        setUploadProgress('Enviando PDF...');
        const ext = filePdf.name.split('.').pop();
        const tituloSanitizado = form.titulo
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
          .replace(/[^a-zA-Z0-9_\-]/g, '_')                 // só ASCII seguro
          .substring(0, 40);
        const path = `${Date.now()}_${tituloSanitizado}.${ext}`;
        const { error: upErr } = await supabase.storage.from('biblioteca-pdf').upload(path, filePdf, { upsert: false });
        if (upErr) throw new Error('Erro no upload do PDF: ' + upErr.message);
        const { data: urlData } = supabase.storage.from('biblioteca-pdf').getPublicUrl(path);
        pdfUrl = urlData.publicUrl;
        pdfPath = path;
        tamanhoPdf = filePdf.size;
        // Deletar PDF antigo se editando
        if (livroEditando?.pdf_path) {
          await supabase.storage.from('biblioteca-pdf').remove([livroEditando.pdf_path]);
        }
      }

      // Upload Capa
      if (fileCapa) {
        setUploadProgress('Enviando capa...');
        const ext = fileCapa.name.split('.').pop().replace(/[^a-zA-Z0-9]/g, '');
        const path = `capa_${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('biblioteca-capas').upload(path, fileCapa, { upsert: false });
        if (upErr) throw new Error('Erro no upload da capa: ' + upErr.message);
        const { data: urlData } = supabase.storage.from('biblioteca-capas').getPublicUrl(path);
        capaUrl = urlData.publicUrl;
        capaPath = path;
        // Deletar capa antiga
        if (livroEditando?.capa_path) {
          await supabase.storage.from('biblioteca-capas').remove([livroEditando.capa_path]);
        }
      }

      setUploadProgress('Salvando dados...');
      const payload = {
        titulo: form.titulo,
        autor: form.autor || null,
        categoria: form.categoria,
        grau: form.grau,
        descricao: form.descricao || null,
        pdf_url: pdfUrl,
        pdf_path: pdfPath,
        capa_url: capaUrl,
        capa_path: capaPath,
        tamanho_pdf: tamanhoPdf,
      };

      if (livroEditando) {
        const { error } = await supabase.from('biblioteca_online').update(payload).eq('id', livroEditando.id);
        if (error) throw error;
        showSuccess('Livro atualizado!');
      } else {
        const { error } = await supabase.from('biblioteca_online').insert([{ ...payload, cadastrado_por: (await supabase.auth.getUser()).data.user?.id }]);
        if (error) throw error;
        showSuccess('Livro cadastrado!');
      }

      fecharModal();
      carregarLivros();
    } catch (e) {
      showError(e.message);
    } finally {
      setSalvando(false);
      setUploadProgress('');
    }
  };

  // ── Excluir ──────────────────────────────────────────────────────────────────
  const excluir = async (livro) => {
    if (!window.confirm(`Excluir "${livro.titulo}"? O arquivo PDF será removido permanentemente.`)) return;
    try {
      if (livro.pdf_path)  await supabase.storage.from('biblioteca-pdf').remove([livro.pdf_path]);
      if (livro.capa_path) await supabase.storage.from('biblioteca-capas').remove([livro.capa_path]);
      const { error } = await supabase.from('biblioteca_online').delete().eq('id', livro.id);
      if (error) throw error;
      showSuccess('Livro excluído.');
      carregarLivros();
    } catch (e) {
      showError('Erro ao excluir: ' + e.message);
    }
  };

  // ── Download ─────────────────────────────────────────────────────────────────
  const baixar = async (livro) => {
    if (!podeBaixar(livro.grau)) {
      showError(`Seu grau não permite baixar livros de ${livro.grau}.`);
      return;
    }
    setBaixando(b => ({ ...b, [livro.id]: true }));
    try {
      // Registrar download
      await supabase.from('biblioteca_online_downloads').insert([{ livro_id: livro.id, irmao_id: irmaoLogadoId }]);
      // Incrementar contador
      await supabase.from('biblioteca_online').update({ total_downloads: (livro.total_downloads || 0) + 1 }).eq('id', livro.id);
      // Iniciar download
      const link = document.createElement('a');
      link.href = livro.pdf_url;
      link.download = `${livro.titulo}.pdf`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Atualizar contador local
      setLivros(ls => ls.map(l => l.id === livro.id ? { ...l, total_downloads: (l.total_downloads || 0) + 1 } : l));
    } catch (e) {
      showError('Erro ao baixar: ' + e.message);
    } finally {
      setBaixando(b => { const n = { ...b }; delete n[livro.id]; return n; });
    }
  };

  // ── Estilos ──────────────────────────────────────────────────────────────────
  const sInput = {
    background: 'var(--color-surface-2)', color: 'var(--color-text)',
    border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
    padding: '0.5rem 0.75rem', fontSize: '0.875rem', width: '100%',
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh', padding: '0.75rem', overflowX: 'hidden' }}>

      {/* ── Cabeçalho ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--color-text)', margin: 0 }}>📖 Biblioteca Online</h2>
          <p style={{ color: 'var(--color-text-muted)', margin: '0.2rem 0 0', fontSize: '0.85rem' }}>
            Acervo digital de livros maçônicos para download
            {grauUsuario && (
              <span style={{ marginLeft: '0.5rem', padding: '0.1rem 0.6rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: '700',
                background: GRAU_STYLE[grauUsuario]?.bg || 'var(--color-accent-bg)',
                color: GRAU_STYLE[grauUsuario]?.cor || 'var(--color-accent)',
                border: `1px solid ${GRAU_STYLE[grauUsuario]?.brd || 'var(--color-accent)'}` }}>
                Seu grau: {grauUsuario}
              </span>
            )}
          </p>
        </div>
        {permissoes?.pode_editar_biblioteca && (
          <button onClick={() => abrirCadastro()}
            style={{ padding: '0.6rem 1.25rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: '700', cursor: 'pointer', fontSize: '0.875rem' }}>
            ➕ Cadastrar Livro
          </button>
        )}
      </div>

      {/* ── Filtros ── */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1rem', marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>🔍 Buscar</label>
          <input value={filtroNome} onChange={e => setFiltroNome(e.target.value)} placeholder="Título ou autor..." style={sInput} />
        </div>
        <div style={{ flex: '0 0 150px' }}>
          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Grau</label>
          <select value={filtroGrau} onChange={e => setFiltroGrau(e.target.value)} style={sInput}>
            <option value="todos">Todos</option>
            {GRAUS.filter(g => grauOrdem >= GRAU_ORDEM[g]).map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div style={{ flex: '0 0 180px' }}>
          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Categoria</label>
          <select value={filtroCat} onChange={e => setFiltroCat(e.target.value)} style={sInput}>
            <option value="todas">Todas</option>
            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'flex-end' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', paddingBottom: '0.5rem' }}>
            {livrosFiltrados.length} livro(s)
          </span>
        </div>
      </div>

      {/* ── Legenda de permissões ── */}
      <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '0.6rem 1rem', marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
        <span>📋 Aprendiz pode baixar: livros de Aprendiz</span>
        <span>📋 Companheiro pode baixar: Aprendiz + Companheiro</span>
        <span>📋 Mestre pode baixar: todos os graus</span>
      </div>

      {/* ── Grid de livros ── */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4rem' }}>
          <div style={{ width: '2.5rem', height: '2.5rem', border: '3px solid var(--color-border)', borderTopColor: 'var(--color-accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : livrosFiltrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📚</div>
          <p style={{ margin: 0, fontWeight: '600' }}>Nenhum livro encontrado</p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
            {livros.length === 0 ? 'Nenhum livro cadastrado ainda.' : 'Tente ajustar os filtros.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
          {livrosFiltrados.map(livro => {
            const gs = GRAU_STYLE[livro.grau] || GRAU_STYLE['Mestre'];
            const pode = podeBaixar(livro.grau);
            return (
              <div key={livro.id} style={{
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-xl)', overflow: 'hidden',
                display: 'flex', flexDirection: 'column',
                boxShadow: 'var(--shadow-md)',
                opacity: pode ? 1 : 0.55,
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => { if (pode) { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)'; }}}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}>

                {/* ── Cabeçalho do card: grau + botões admin ── */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.6rem', background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)', gap: '0.4rem' }}>
                  <span style={{ padding: '0.15rem 0.55rem', borderRadius: '999px', fontSize: '0.65rem', fontWeight: '800', background: gs.bg, color: gs.cor, border: `1px solid ${gs.brd}` }}>
                    {livro.grau}
                  </span>
                  <div style={{ display: 'flex', gap: '0.3rem', marginLeft: 'auto' }}>
                    {permissoes?.pode_editar_biblioteca && (
                      <>
                        <button onClick={() => abrirCadastro(livro)}
                          style={{ padding: '0.2rem 0.45rem', background: 'var(--color-accent-bg)', color: 'var(--color-accent)', border: `1px solid var(--color-accent)`, borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', cursor: 'pointer' }}>✏️</button>
                        <button onClick={() => excluir(livro)}
                          style={{ padding: '0.2rem 0.45rem', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', cursor: 'pointer' }}>🗑️</button>
                      </>
                    )}
                  </div>
                </div>

                {/* Capa */}
                <div style={{ position: 'relative', paddingTop: '133%', background: 'var(--color-surface-2)', overflow: 'hidden' }}>
                  {livro.capa_url ? (
                    <img src={livro.capa_url} alt={livro.titulo}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${gs.bg}, var(--color-surface-3))` }}>
                      <span style={{ fontSize: '3rem' }}>📖</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginTop: '0.25rem', textAlign: 'center', padding: '0 0.5rem' }}>Sem capa</span>
                    </div>
                  )}
                  {/* Lock se não pode baixar */}
                  {!pode && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '2rem' }}>🔒</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div style={{ padding: '0.75rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <p style={{ margin: 0, fontWeight: '700', fontSize: '0.82rem', color: 'var(--color-text)', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {livro.titulo}
                  </p>
                  {livro.autor && (
                    <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{livro.autor}</p>
                  )}
                  <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.1rem' }}>
                    <span style={{ fontSize: '0.62rem', fontWeight: '600', padding: '0.1rem 0.4rem', borderRadius: '999px', background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                      {livro.categoria}
                    </span>
                    {livro.tamanho_pdf && (
                      <span style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)' }}>{fmtBytes(livro.tamanho_pdf)}</span>
                    )}
                  </div>
                  {livro.total_downloads > 0 && (
                    <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>⬇️ {livro.total_downloads} download(s)</p>
                  )}
                </div>

                {/* Botão download */}
                <div style={{ padding: '0 0.75rem 0.75rem' }}>
                  <button
                    onClick={() => pode ? baixar(livro) : showError(`Acesso restrito ao grau ${livro.grau}.`)}
                    disabled={!pode || baixando[livro.id]}
                    style={{
                      width: '100%', padding: '0.55rem', fontWeight: '700', fontSize: '0.8rem',
                      border: 'none', borderRadius: 'var(--radius-lg)', cursor: pode ? 'pointer' : 'not-allowed',
                      background: pode ? 'var(--color-accent)' : 'var(--color-surface-3)',
                      color: pode ? '#fff' : 'var(--color-text-muted)',
                      transition: 'all 0.15s',
                    }}>
                    {baixando[livro.id] ? '⏳ Baixando...' : pode ? '⬇️ Baixar PDF' : `🔒 Grau ${livro.grau}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal de Cadastro ── */}
      {modalCadastro && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>

            {/* Header */}
            <div style={{ background: 'var(--color-accent)', padding: '1.1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <h3 style={{ color: '#fff', fontWeight: '800', margin: 0, fontSize: '1.05rem' }}>
                {livroEditando ? '✏️ Editar Livro' : '➕ Cadastrar Livro Online'}
              </h3>
              <button onClick={fecharModal} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '50%', width: '2rem', height: '2rem', cursor: 'pointer', fontSize: '1.1rem', fontWeight: '700' }}>×</button>
            </div>

            {/* Body */}
            <div style={{ overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>

              {/* Grid de campos */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Título *</label>
                  <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Ritual do Aprendiz Maçom" style={sInput} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Autor</label>
                  <input value={form.autor} onChange={e => setForm(f => ({ ...f, autor: e.target.value }))} placeholder="Nome do autor" style={sInput} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Grau *</label>
                  <select value={form.grau} onChange={e => setForm(f => ({ ...f, grau: e.target.value }))} style={sInput}>
                    {GRAUS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Categoria</label>
                  <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} style={sInput}>
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Descrição</label>
                  <textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Breve descrição do livro..." rows={2}
                    style={{ ...sInput, resize: 'vertical', fontFamily: 'inherit' }} />
                </div>
              </div>

              {/* Upload PDF */}
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                  Arquivo PDF {!livroEditando && '*'}
                </label>
                <div
                  onClick={() => pdfRef.current?.click()}
                  style={{ border: `2px dashed ${filePdf ? 'var(--color-accent)' : 'var(--color-border)'}`, borderRadius: 'var(--radius-lg)', padding: '1rem', textAlign: 'center', cursor: 'pointer', background: filePdf ? 'var(--color-accent-bg)' : 'var(--color-surface-2)', transition: 'all 0.15s' }}>
                  <input ref={pdfRef} type="file" accept=".pdf" onChange={onChangePdf} style={{ display: 'none' }} />
                  {filePdf ? (
                    <div>
                      <p style={{ margin: 0, fontWeight: '700', color: 'var(--color-accent)', fontSize: '0.85rem' }}>📄 {filePdf.name}</p>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{fmtBytes(filePdf.size)}</p>
                    </div>
                  ) : livroEditando?.pdf_url ? (
                    <div>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>📄 PDF já cadastrado — clique para substituir</p>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{fmtBytes(livroEditando.tamanho_pdf)}</p>
                    </div>
                  ) : (
                    <div>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-muted)', fontWeight: '600' }}>📤 Clique para selecionar o PDF</p>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Máximo 100 MB</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Upload Capa */}
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Imagem da Capa</label>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  {/* Preview */}
                  <div style={{ flexShrink: 0, width: '80px', height: '106px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {previewCapa ? (
                      <img src={previewCapa} alt="Capa" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '1.5rem' }}>🖼️</span>
                    )}
                  </div>
                  <div
                    onClick={() => capaRef.current?.click()}
                    style={{ flex: 1, border: `2px dashed ${fileCapa ? 'var(--color-accent)' : 'var(--color-border)'}`, borderRadius: 'var(--radius-lg)', padding: '1rem', textAlign: 'center', cursor: 'pointer', background: fileCapa ? 'var(--color-accent-bg)' : 'var(--color-surface-2)', transition: 'all 0.15s' }}>
                    <input ref={capaRef} type="file" accept="image/*" onChange={onChangeCapa} style={{ display: 'none' }} />
                    {fileCapa ? (
                      <div>
                        <p style={{ margin: 0, fontWeight: '700', color: 'var(--color-accent)', fontSize: '0.82rem' }}>🖼️ {fileCapa.name}</p>
                      </div>
                    ) : (
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                        {livroEditando?.capa_url ? '🖼️ Clique para trocar a capa' : '📷 Clique para adicionar uma capa (JPG, PNG)'}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress */}
              {uploadProgress && (
                <div style={{ background: 'var(--color-accent-bg)', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-md)', padding: '0.6rem 1rem', fontSize: '0.82rem', color: 'var(--color-accent)', fontWeight: '600' }}>
                  ⏳ {uploadProgress}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--color-border)', display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
              <button onClick={fecharModal} style={{ flex: 1, padding: '0.6rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontWeight: '600', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={salvar} disabled={salvando} style={{ flex: 2, padding: '0.6rem', background: salvando ? 'var(--color-surface-3)' : 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: '700', cursor: salvando ? 'not-allowed' : 'pointer' }}>
                {salvando ? `⏳ ${uploadProgress || 'Salvando...'}` : livroEditando ? '💾 Salvar Alterações' : '✅ Cadastrar Livro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
