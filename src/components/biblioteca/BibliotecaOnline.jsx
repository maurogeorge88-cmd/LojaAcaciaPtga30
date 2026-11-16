import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../supabaseClient';

const GRAUS = ['Aprendiz', 'Companheiro', 'Mestre'];
const GRAU_ORDEM = { 'Aprendiz': 1, 'Companheiro': 2, 'Mestre': 3, 'Mestre Instalado': 3 };
// Cores de grau no padrão do sistema
const COR_GRAU = { 'Aprendiz': '#eab308', 'Companheiro': '#10b981', 'Mestre': '#3b82f6' };

const CATEGORIAS = [
  'Ritualisticas', 'Filosofia Maconica', 'Historia da Maconaria',
  'Simbolismo', 'Esoterismo', 'Religiao e Espiritualidade',
  'Ciencias e Tecnologia', 'Literatura', 'Direito', 'Administracao',
  'Saude', 'Educacao', 'Outros',
];
// Rótulos exibidos (o valor gravado no banco continua sem acento)
const CAT_ROTULO = {
  'Ritualisticas': 'Ritualísticas', 'Filosofia Maconica': 'Filosofia Maçônica', 'Historia da Maconaria': 'História da Maçonaria',
  'Simbolismo': 'Simbolismo', 'Esoterismo': 'Esoterismo', 'Religiao e Espiritualidade': 'Religião e Espiritualidade',
  'Ciencias e Tecnologia': 'Ciências e Tecnologia', 'Literatura': 'Literatura', 'Direito': 'Direito',
  'Administracao': 'Administração', 'Saude': 'Saúde', 'Educacao': 'Educação', 'Outros': 'Outros',
};
const rotuloCat = (c) => CAT_ROTULO[c] || c;

const CAT_EMOJI = {
  'Ritualisticas': '\u{1F4DC}', 'Filosofia Maconica': '\u{1F52E}', 'Historia da Maconaria': '\u{1F3DB}️',
  'Simbolismo': '⚖️', 'Esoterismo': '✨', 'Religiao e Espiritualidade': '\u{1F64F}',
  'Ciencias e Tecnologia': '\u{1F52C}', 'Literatura': '\u{1F4DA}', 'Direito': '⚖️',
  'Administracao': '\u{1F4CA}', 'Saude': '\u{1F3E5}', 'Educacao': '\u{1F393}', 'Outros': '\u{1F4C1}',
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

const fmtDataHora = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const FORM0 = { titulo: '', autor: '', categoria: 'Ritualisticas', grau: 'Aprendiz', descricao: '' };

export default function BibliotecaOnline({ permissoes, grauUsuario, irmaoLogadoId, showSuccess, showError }) {
  const [livros, setLivros]               = useState([]);
  const [downloads, setDownloads]         = useState([]);   // todas as linhas de biblioteca_online_downloads
  const [nomes, setNomes]                 = useState({});   // irmao_id -> nome
  const [dlErro, setDlErro]               = useState(false);
  const [loading, setLoading]             = useState(true);
  const [aba, setAba]                     = useState('acervo');
  const [modal, setModal]                 = useState(false);
  const [editando, setEditando]           = useState(null);
  const [form, setForm]                   = useState(FORM0);
  const [filePdf, setFilePdf]             = useState(null);
  const [fileCapa, setFileCapa]           = useState(null);
  const [preview, setPreview]             = useState(null);
  const [progress, setProgress]           = useState('');
  const [salvando, setSalvando]           = useState(false);
  const [fGrau, setFGrau]                 = useState('todos');
  const [fCat, setFCat]                   = useState('todas');
  const [fNome, setFNome]                 = useState('');
  const [ordem, setOrdem]                 = useState('az');
  const [baixando, setBaixando]           = useState({});
  const [livroQuem, setLivroQuem]         = useState(null);   // modal "quem baixou"
  const [livroExcluir, setLivroExcluir]   = useState(null);   // modal de exclusão
  // Aba Downloads
  const [dAno, setDAno]                   = useState(null);   // null = automático
  const [dLivro, setDLivro]               = useState('todos');
  const [dIrmao, setDIrmao]               = useState('');
  const [dLimite, setDLimite]             = useState(30);
  const pdfRef  = useRef();
  const capaRef = useRef();

  // grauOrd: 0 = sem grau (bloqueia tudo), 1=Aprendiz, 2=Companheiro, 3=Mestre
  const grauOrd = grauUsuario ? (GRAU_ORDEM[grauUsuario] || 0) : 0;

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const aoTeclar = (e) => {
      if (e.key !== 'Escape') return;
      if (livroExcluir) setLivroExcluir(null);
      else if (livroQuem) setLivroQuem(null);
      else if (modal && !salvando) fechar();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [livroExcluir, livroQuem, modal, salvando]);

  async function carregarDownloads() {
    try {
      let todos = []; let ini = 0;
      for (;;) {
        const { data, error } = await supabase.from('biblioteca_online_downloads')
          .select('id, livro_id, irmao_id, baixado_em').order('baixado_em', { ascending: false }).range(ini, ini + 999);
        if (error) throw error;
        todos = todos.concat(data || []);
        if (!data || data.length < 1000) break;
        ini += 1000;
      }
      setDownloads(todos); setDlErro(false);
    } catch (e) {
      console.error('Downloads da biblioteca:', e);
      setDlErro(true);
    }
    try {
      const { data } = await supabase.from('irmaos').select('id, nome');
      const m = {}; (data || []).forEach(i => { m[i.id] = i.nome; });
      setNomes(m);
    } catch { /* nomes ficam como "Irmão" */ }
  }

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('biblioteca_online').select('*').order('categoria').order('titulo');
    if (error) showError('Erro: ' + error.message);
    else setLivros(data || []);
    await carregarDownloads();
    setLoading(false);
  }

  const nomeIrmao = (id) => nomes[id] || 'Irmão';

  // ── Contagens reais (pela tabela de downloads) ──
  const statsLivro = useMemo(() => {
    const m = {};
    downloads.forEach(d => {
      const s = m[d.livro_id] || (m[d.livro_id] = { total: 0, irmaos: new Set() });
      s.total++; s.irmaos.add(d.irmao_id);
    });
    return m;
  }, [downloads]);
  // Se a leitura da tabela falhar (permissão), usa o contador do livro como apoio
  const totalLivro = (l) => (dlErro ? (l.total_downloads || 0) : (statsLivro[l.id]?.total || 0));
  const irmaosLivro = (l) => statsLivro[l.id]?.irmaos.size || 0;

  const top3 = useMemo(() => {
    if (dlErro) return new Set();
    return new Set(Object.entries(statsLivro).filter(([, s]) => s.total > 0)
      .sort((a, b) => b[1].total - a[1].total).slice(0, 3).map(([id]) => String(id)));
  }, [statsLivro, dlErro]);

  const ehNovo = (l) => {
    const d = l.created_at || l.criado_em;
    if (!d) return false;
    return (Date.now() - new Date(d).getTime()) < 30 * 86400000;
  };

  function podeBaixar(grauLivro) {
    const grauLivroOrd = GRAU_ORDEM[grauLivro] || 1;
    return grauOrd >= grauLivroOrd;
  }

  // ── Acervo: filtros e ordenação ──
  const filtrados = useMemo(() => {
    const q = fNome.toLowerCase();
    const lista = livros.filter(l => {
      if (fGrau !== 'todos' && l.grau !== fGrau) return false;
      if (fCat !== 'todas' && l.categoria !== fCat) return false;
      if (q && !l.titulo.toLowerCase().includes(q) && !(l.autor || '').toLowerCase().includes(q)) return false;
      return true;
    });
    if (ordem === 'baixados') return [...lista].sort((a, b) => totalLivro(b) - totalLivro(a) || a.titulo.localeCompare(b.titulo));
    if (ordem === 'recentes') return [...lista].sort((a, b) => String(b.created_at || b.criado_em || '').localeCompare(String(a.created_at || a.criado_em || '')) || b.id - a.id);
    return lista;
  }, [livros, fGrau, fCat, fNome, ordem, statsLivro, dlErro]);

  const contaGrau = (g) => livros.filter(l => g === 'todos' || l.grau === g).length;

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
    if (f.size > 104857600) { showError('Máximo de 100 MB.'); return; }
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
    if (!form.titulo) { showError('Título obrigatório.'); return; }
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

  async function confirmarExclusao() {
    const livro = livroExcluir;
    if (!livro) return;
    setLivroExcluir(null);
    try {
      if (livro.pdf_path)  await supabase.storage.from('biblioteca-pdf').remove([livro.pdf_path]);
      if (livro.capa_path) await supabase.storage.from('biblioteca-capas').remove([livro.capa_path]);
      const { error } = await supabase.from('biblioteca_online').delete().eq('id', livro.id);
      if (error) throw error;
      showSuccess('Excluído.'); load();
    } catch (e) { showError(e.message); }
  }

  async function baixar(livro) {
    if (!podeBaixar(livro.grau)) {
      showError(
        'Este livro é restrito ao grau ' + livro.grau + '. ' +
        'Seu grau atual (' + (grauUsuario || 'não definido') + ') não permite o download.'
      );
      return;
    }
    setBaixando(b => ({ ...b, [livro.id]: true }));
    try {
      // Registro do download (cada clique conta, inclusive repetidos do mesmo irmão)
      const { data: ins, error: errIns } = await supabase.from('biblioteca_online_downloads')
        .insert([{ livro_id: livro.id, irmao_id: irmaoLogadoId }]).select('id, livro_id, irmao_id, baixado_em');
      if (errIns) {
        console.error(errIns);
        showError('O download foi liberado, mas não foi possível registrá-lo: ' + errIns.message);
      } else {
        setDownloads(ds => [ins?.[0] || { id: 'novo-' + Date.now(), livro_id: livro.id, irmao_id: irmaoLogadoId, baixado_em: new Date().toISOString() }, ...ds]);
      }
      // Contador antigo mantido apenas como número de apoio
      await supabase.from('biblioteca_online').update({ total_downloads: (livro.total_downloads || 0) + 1 }).eq('id', livro.id);
      setLivros(ls => ls.map(l => l.id === livro.id ? { ...l, total_downloads: (l.total_downloads || 0) + 1 } : l));
      const a = document.createElement('a');
      a.href = livro.pdf_url; a.download = livro.titulo + '.pdf'; a.target = '_blank';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (e) { showError(e.message); }
    finally { setBaixando(b => { const n = { ...b }; delete n[livro.id]; return n; }); }
  }

  // ── Aba Downloads ──
  const livroPorId = useMemo(() => { const m = {}; livros.forEach(l => { m[l.id] = l; }); return m; }, [livros]);
  const anoDe = (d) => new Date(d.baixado_em).getFullYear();
  const anosDl = useMemo(() => [...new Set(downloads.map(anoDe))].sort((a, b) => b - a), [downloads]);
  const dAnoEf = dAno ?? (anosDl.includes(new Date().getFullYear()) ? String(new Date().getFullYear()) : (anosDl[0] ? String(anosDl[0]) : 'todos'));

  const dlFiltrados = useMemo(() => downloads.filter(d => {
    if (dAnoEf !== 'todos' && String(anoDe(d)) !== dAnoEf) return false;
    if (dLivro !== 'todos' && String(d.livro_id) !== dLivro) return false;
    const q = dIrmao.trim().toLowerCase();
    if (q && !nomeIrmao(d.irmao_id).toLowerCase().includes(q)) return false;
    return true;
  }), [downloads, dAnoEf, dLivro, dIrmao, nomes]);

  const resumoDl = useMemo(() => {
    const porLivro = {}; const porIrmao = {};
    dlFiltrados.forEach(d => {
      const a = porLivro[d.livro_id] || (porLivro[d.livro_id] = { total: 0, irmaos: new Set() });
      a.total++; a.irmaos.add(d.irmao_id);
      const b = porIrmao[d.irmao_id] || (porIrmao[d.irmao_id] = { total: 0, livros: new Set() });
      b.total++; b.livros.add(d.livro_id);
    });
    const rankLivros = Object.entries(porLivro).map(([id, s]) => ({ id, total: s.total, irmaos: s.irmaos.size }))
      .sort((a, b) => b.total - a.total).slice(0, 10);
    const rankIrmaos = Object.entries(porIrmao).map(([id, s]) => ({ id, total: s.total, livros: s.livros.size }))
      .sort((a, b) => b.total - a.total || nomeIrmao(a.id).localeCompare(nomeIrmao(b.id))).slice(0, 10);
    const nIrmaos = Object.keys(porIrmao).length;
    return {
      total: dlFiltrados.length, livrosBaixados: Object.keys(porLivro).length, irmaos: nIrmaos,
      media: nIrmaos ? (dlFiltrados.length / nIrmaos) : 0, rankLivros, rankIrmaos,
    };
  }, [dlFiltrados, nomes]);

  // "Nª vez" do irmão naquele livro (ordem cronológica, considerando todo o histórico)
  const ordinalDl = useMemo(() => {
    const cont = {}; const ord = {}; const tot = {};
    [...downloads].sort((a, b) => new Date(a.baixado_em) - new Date(b.baixado_em)).forEach(d => {
      const k = d.livro_id + '|' + d.irmao_id;
      cont[k] = (cont[k] || 0) + 1; ord[d.id] = cont[k];
    });
    Object.assign(tot, cont);
    return { ord, tot };
  }, [downloads]);

  const inp = {
    background: 'var(--color-surface-2)', color: 'var(--color-text)',
    border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
    padding: '0.5rem 0.75rem', fontSize: '0.875rem', width: '100%',
  };
  const card = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' };
  const segBtn = (ativo, cor) => ({
    padding: '0.4rem 0.85rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
    border: `1px solid ${ativo ? (cor || 'var(--color-accent)') : 'var(--color-border)'}`,
    background: ativo ? (cor || 'var(--color-accent)') : 'var(--color-surface-2)', color: ativo ? '#fff' : 'var(--color-text-muted)',
  });
  const rotulo = { display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' };
  const kpi = (titulo, valor, cor, sub) => (
    <div style={{ ...card, borderTop: `4px solid ${cor}`, padding: '0.9rem 1.1rem' }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{titulo}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: cor, marginTop: '0.15rem' }}>{valor}</div>
      {sub && <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{sub}</div>}
    </div>
  );

  const cats = [...new Set(filtrados.map(l => l.categoria))].sort();
  const semAgrupar = ordem !== 'az';

  const renderLivro = (livro) => {
    const cor = COR_GRAU[livro.grau] || COR_GRAU.Mestre;
    const pode = podeBaixar(livro.grau);
    const total = totalLivro(livro);
    const ind = irmaosLivro(livro);
    return (
      <div key={livro.id} style={{ ...card, borderRadius: 'var(--radius-xl)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.6rem', background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)', gap: 6 }}>
          <span style={{ padding: '0.15rem 0.55rem', borderRadius: '999px', fontSize: '0.65rem', fontWeight: '800', background: cor + '26', color: cor, border: '1px solid ' + cor }}>
            {livro.grau}
          </span>
          {permissoes?.pode_editar_biblioteca && (
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              <button onClick={() => abrirModal(livro)} title="Editar" style={{ padding: '0.2rem 0.45rem', background: 'var(--color-accent-bg)', color: 'var(--color-accent)', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', cursor: 'pointer' }}>✏️</button>
              <button onClick={() => setLivroExcluir(livro)} title="Excluir" style={{ padding: '0.2rem 0.45rem', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', cursor: 'pointer' }}>🗑️</button>
            </div>
          )}
        </div>
        <div style={{ position: 'relative', paddingTop: '133%', background: 'var(--color-surface-2)' }}>
          {livro.capa_url
            ? <img src={livro.capa_url} alt={livro.titulo} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem' }}>📖</div>}
          <div style={{ position: 'absolute', top: 6, left: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {top3.has(String(livro.id)) && <span style={{ padding: '0.15rem 0.5rem', borderRadius: 999, fontSize: '0.65rem', fontWeight: 800, background: '#f97316', color: '#fff' }}>🔥 Mais baixado</span>}
            {ehNovo(livro) && <span style={{ padding: '0.15rem 0.5rem', borderRadius: 999, fontSize: '0.65rem', fontWeight: 800, background: '#10b981', color: '#fff' }}>🆕 Novo</span>}
          </div>
          {!pode && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>🔒</div>
          )}
        </div>
        <div style={{ padding: '0.75rem', flex: 1 }}>
          <p style={{ margin: '0 0 0.2rem', fontWeight: '700', fontSize: '0.82rem', color: 'var(--color-text)', lineHeight: 1.3 }}>{livro.titulo}</p>
          {livro.autor && <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{livro.autor}</p>}
          {livro.descricao && (
            <p title={livro.descricao} style={{ margin: '0.35rem 0 0', fontSize: '0.7rem', color: 'var(--color-text-muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{livro.descricao}</p>
          )}
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.62rem', color: 'var(--color-text-muted)' }}>
            {[semAgrupar ? `${CAT_EMOJI[livro.categoria] || '📁'} ${rotuloCat(livro.categoria)}` : '', fmtBytes(livro.tamanho_pdf)].filter(Boolean).join(' · ')}
          </p>
          <button onClick={() => setLivroQuem(livro)} title="Ver quem baixou"
            style={{ marginTop: '0.3rem', padding: 0, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700, color: total > 0 ? 'var(--color-accent)' : 'var(--color-text-muted)', textAlign: 'left' }}>
            ⬇️ {total} download(s){ind > 0 ? ` · 👥 ${ind} irmão(s)` : ''}
          </button>
        </div>
        <div style={{ padding: '0 0.75rem 0.75rem' }}>
          <button onClick={() => pode ? baixar(livro) : showError(
            'Livro restrito ao grau ' + livro.grau + '. ' +
            'Seu grau (' + (grauUsuario || 'não definido') + ') não tem acesso a este conteúdo.'
          )} disabled={!pode || baixando[livro.id]}
            style={{ width: '100%', padding: '0.55rem', fontWeight: '700', fontSize: '0.8rem', border: 'none', borderRadius: 'var(--radius-lg)', cursor: pode ? 'pointer' : 'not-allowed', background: pode ? 'var(--color-accent)' : 'var(--color-surface-2)', color: pode ? '#fff' : 'var(--color-text-muted)', opacity: baixando[livro.id] ? 0.7 : 1 }}>
            {baixando[livro.id] ? 'Baixando...' : pode ? '⬇️ Baixar PDF' : '🔒 ' + livro.grau + ' apenas'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Cabeçalho */}
      <div style={{ ...card, borderTop: '4px solid var(--color-accent)', padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--color-text)', margin: 0 }}>📖 Biblioteca Online</h2>
          <p style={{ color: 'var(--color-text-muted)', margin: '0.2rem 0 0', fontSize: '0.85rem' }}>{livros.length} livro(s) no acervo digital · {downloads.length} download(s) registrados</p>
        </div>
        {permissoes?.pode_editar_biblioteca && (
          <button onClick={() => abrirModal(null)} style={{ padding: '0.6rem 1.25rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: '700', cursor: 'pointer' }}>
            ➕ Cadastrar Livro
          </button>
        )}
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {[['acervo', '📚 Acervo'], ['downloads', '📊 Downloads e Leitura']].map(([k, r]) => (
          <button key={k} onClick={() => setAba(k)} style={{ ...segBtn(aba === k), padding: '0.55rem 1.3rem', fontSize: '0.9rem' }}>{r}</button>
        ))}
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <div style={{ width: '2.5rem', height: '2.5rem', border: '3px solid var(--color-border)', borderTopColor: 'var(--color-accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      )}

      {/* ═════════ ACERVO ═════════ */}
      {!loading && aba === 'acervo' && (
        <>
          <div style={{ ...card, padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 220px' }}>
                <label style={rotulo}>Buscar</label>
                <input value={fNome} onChange={e => setFNome(e.target.value)} placeholder="🔍 Título ou autor..." style={inp} />
              </div>
              <div style={{ flex: '0 0 220px' }}>
                <label style={rotulo}>Categoria</label>
                <select value={fCat} onChange={e => setFCat(e.target.value)} style={inp}>
                  <option value="todas">Todas</option>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{rotuloCat(c)}</option>)}
                </select>
              </div>
              <div style={{ flex: '0 0 190px' }}>
                <label style={rotulo}>Ordenar por</label>
                <select value={ordem} onChange={e => setOrdem(e.target.value)} style={inp}>
                  <option value="az">Categoria / A–Z</option>
                  <option value="baixados">Mais baixados</option>
                  <option value="recentes">Mais recentes</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', width: 48 }}>GRAU</span>
              <button onClick={() => setFGrau('todos')} style={segBtn(fGrau === 'todos')}>Todos ({contaGrau('todos')})</button>
              {GRAUS.filter(g => grauOrd >= GRAU_ORDEM[g]).map(g => (
                <button key={g} onClick={() => setFGrau(g)} style={segBtn(fGrau === g, COR_GRAU[g])}>{g} ({contaGrau(g)})</button>
              ))}
              <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{filtrados.length} livro(s)</span>
            </div>
          </div>

          {filtrados.length === 0 && (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>
              <p style={{ fontSize: '3rem', margin: 0 }}>📚</p>
              <p style={{ fontWeight: '600' }}>Nenhum livro encontrado</p>
            </div>
          )}

          {filtrados.length > 0 && semAgrupar && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
              {filtrados.map(renderLivro)}
            </div>
          )}

          {filtrados.length > 0 && !semAgrupar && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {cats.map(cat => {
                const livCat = filtrados.filter(l => l.categoria === cat);
                const em = CAT_EMOJI[cat] || '📁';
                return (
                  <div key={cat}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderLeft: '5px solid var(--color-accent)', borderRadius: 'var(--radius-lg)', flexShrink: 0 }}>
                        <span>{em}</span>
                        <span style={{ fontWeight: '800', color: 'var(--color-text)', fontSize: '0.9rem' }}>{rotuloCat(cat)}</span>
                        <span style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', borderRadius: '999px', padding: '0 0.45rem', fontSize: '0.72rem', fontWeight: '700' }}>{livCat.length}</span>
                      </div>
                      <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
                      {livCat.map(renderLivro)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ═════════ DOWNLOADS ═════════ */}
      {!loading && aba === 'downloads' && (
        <>
          {dlErro && (
            <div style={{ padding: '0.75rem 1rem', borderRadius: 'var(--radius-lg)', background: 'rgba(245,158,11,0.12)', border: '1px solid #f59e0b', color: 'var(--color-text)', fontSize: '0.85rem' }}>
              ⚠️ Não foi possível ler o histórico de downloads (permissão no banco). Execute o SQL <strong>20261115_biblioteca_downloads_leitura.sql</strong> no Supabase.
            </div>
          )}

          <div style={{ ...card, padding: '0.85rem 1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '0 0 140px' }}>
              <label style={rotulo}>Ano</label>
              <select value={dAnoEf} onChange={e => { setDAno(e.target.value); setDLimite(30); }} style={inp}>
                {anosDl.map(a => <option key={a} value={String(a)}>{a}</option>)}
                <option value="todos">Todos</option>
              </select>
            </div>
            <div style={{ flex: '1 1 220px' }}>
              <label style={rotulo}>Livro</label>
              <select value={dLivro} onChange={e => { setDLivro(e.target.value); setDLimite(30); }} style={inp}>
                <option value="todos">Todos os livros</option>
                {[...livros].sort((a, b) => a.titulo.localeCompare(b.titulo)).map(l => <option key={l.id} value={String(l.id)}>{l.titulo}</option>)}
              </select>
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <label style={rotulo}>Irmão</label>
              <input value={dIrmao} onChange={e => { setDIrmao(e.target.value); setDLimite(30); }} placeholder="🔍 Nome do irmão..." style={inp} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem' }}>
            {kpi('Downloads', resumoDl.total, 'var(--color-accent)', dAnoEf === 'todos' ? 'todo o período' : `em ${dAnoEf}`)}
            {kpi('Livros baixados', resumoDl.livrosBaixados, '#8b5cf6', `de ${livros.length} no acervo`)}
            {kpi('Irmãos leitores', resumoDl.irmaos, '#10b981', 'baixaram ao menos 1 livro')}
            {kpi('Média por irmão', resumoDl.media.toFixed(1).replace('.', ','), '#f59e0b', 'downloads por leitor')}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '0.75rem' }}>
            <div style={{ ...card, padding: '1rem 1.25rem' }}>
              <div style={{ fontWeight: 800, color: 'var(--color-text)', marginBottom: '0.75rem' }}>🔥 Livros mais baixados</div>
              {resumoDl.rankLivros.length === 0 ? <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Nenhum download no período.</p> : resumoDl.rankLivros.map((r, i) => {
                const l = livroPorId[r.id]; const max = resumoDl.rankLivros[0].total;
                return (
                  <div key={r.id} style={{ marginBottom: '0.6rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--color-text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i + 1}. {l?.titulo || 'Livro removido'}</span>
                      <span style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}><strong style={{ color: 'var(--color-text)' }}>{r.total}</strong> · {r.irmaos} irmão(s)</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: 'var(--color-surface-2)', marginTop: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${(r.total / max) * 100}%`, height: '100%', background: COR_GRAU[l?.grau] || 'var(--color-accent)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ ...card, padding: '1rem 1.25rem' }}>
              <div style={{ fontWeight: 800, color: 'var(--color-text)', marginBottom: '0.75rem' }}>🏆 Irmãos que mais baixaram</div>
              {resumoDl.rankIrmaos.length === 0 ? <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Nenhum download no período.</p> : resumoDl.rankIrmaos.map((r, i) => {
                const max = resumoDl.rankIrmaos[0].total;
                return (
                  <div key={r.id} style={{ marginBottom: '0.6rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--color-text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i + 1}. {nomeIrmao(r.id)}{String(r.id) === String(irmaoLogadoId) ? ' (você)' : ''}</span>
                      <span style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}><strong style={{ color: 'var(--color-text)' }}>{r.total}</strong> · {r.livros} livro(s)</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: 'var(--color-surface-2)', marginTop: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${(r.total / max) * 100}%`, height: '100%', background: '#10b981' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ ...card, overflow: 'hidden' }}>
            <div style={{ padding: '0.8rem 1.25rem', borderBottom: '1px solid var(--color-border)', fontWeight: 800, color: 'var(--color-text)' }}>
              🕑 Histórico de downloads <span style={{ fontWeight: 500, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>({dlFiltrados.length})</span>
            </div>
            {dlFiltrados.length === 0 ? (
              <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', margin: 0 }}>Nenhum download encontrado com esses filtros.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: 560 }}>
                  {dlFiltrados.slice(0, dLimite).map((d, i) => {
                    const l = livroPorId[d.livro_id];
                    const k = d.livro_id + '|' + d.irmao_id;
                    const repetido = (ordinalDl.tot[k] || 0) > 1;
                    return (
                      <div key={d.id} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 1.4fr 90px', gap: '0.5rem', alignItems: 'center', padding: '0.55rem 1.25rem', background: i % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)', fontSize: '0.82rem' }}>
                        <span style={{ color: 'var(--color-text-muted)' }}>{fmtDataHora(d.baixado_em)}</span>
                        <span style={{ color: 'var(--color-text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nomeIrmao(d.irmao_id)}</span>
                        <span style={{ color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l?.titulo || 'Livro removido'}</span>
                        <span style={{ textAlign: 'center' }}>
                          {repetido && <span title={`Este irmão baixou este livro ${ordinalDl.tot[k]} vezes`} style={{ padding: '0.1rem 0.5rem', borderRadius: 999, fontSize: '0.68rem', fontWeight: 800, background: '#f59e0b26', color: '#f59e0b', border: '1px solid #f59e0b' }}>{ordinalDl.ord[d.id]}ª vez</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {dlFiltrados.length > dLimite && (
              <div style={{ padding: '0.75rem', textAlign: 'center', borderTop: '1px solid var(--color-border)' }}>
                <button onClick={() => setDLimite(n => n + 50)} style={segBtn(false)}>Ver mais ({dlFiltrados.length - dLimite} restantes)</button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═════════ MODAL: QUEM BAIXOU ═════════ */}
      {livroQuem && (() => {
        const lista = {};
        downloads.filter(d => d.livro_id === livroQuem.id).forEach(d => {
          const x = lista[d.irmao_id] || (lista[d.irmao_id] = { id: d.irmao_id, vezes: 0, ultimo: d.baixado_em });
          x.vezes++; if (new Date(d.baixado_em) > new Date(x.ultimo)) x.ultimo = d.baixado_em;
        });
        const linhas = Object.values(lista).sort((a, b) => b.vezes - a.vezes || new Date(b.ultimo) - new Date(a.ultimo));
        return (
          <div onClick={() => setLivroQuem(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
            <div onClick={e => e.stopPropagation()} style={{ ...card, borderTop: '4px solid var(--color-accent)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: 480, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, color: 'var(--color-text)' }}>👥 Quem baixou</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{livroQuem.titulo}</div>
                </div>
                <button onClick={() => setLivroQuem(null)} style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)', borderRadius: '50%', width: '2rem', height: '2rem', cursor: 'pointer', flexShrink: 0 }}>✕</button>
              </div>
              <div style={{ overflowY: 'auto' }}>
                {linhas.length === 0 ? (
                  <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', margin: 0 }}>Ninguém baixou este livro ainda.</p>
                ) : linhas.map((x, i) => (
                  <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '0.6rem 1.25rem', background: i % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{nomeIrmao(x.id)}</span>
                    <span style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                      {x.vezes > 1 && <strong style={{ color: '#f59e0b', marginRight: 6 }}>{x.vezes}×</strong>}
                      último: {new Date(x.ultimo).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ padding: '0.7rem 1.25rem', borderTop: '1px solid var(--color-border)', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                {linhas.length} irmão(s) · {linhas.reduce((t, x) => t + x.vezes, 0)} download(s)
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═════════ MODAL: EXCLUIR ═════════ */}
      {livroExcluir && (
        <div onClick={() => setLivroExcluir(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ ...card, borderTop: '4px solid #ef4444', borderRadius: 'var(--radius-xl)', padding: '1.25rem', maxWidth: 400, width: '100%' }}>
            <h3 style={{ margin: 0, color: 'var(--color-text)', fontWeight: 800 }}>🗑️ Excluir livro</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>Excluir <strong style={{ color: 'var(--color-text)' }}>"{livroExcluir.titulo}"</strong>? O PDF e a capa também serão removidos. Esta ação não pode ser desfeita.</p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button onClick={() => setLivroExcluir(null)} style={{ flex: 1, padding: '0.6rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={confirmarExclusao} style={{ flex: 1, padding: '0.6rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, cursor: 'pointer' }}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════ MODAL: CADASTRO / EDIÇÃO ═════════ */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ ...card, borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: 'var(--color-accent)', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ color: '#fff', fontWeight: '800', margin: 0 }}>{editando ? '✏️ Editar Livro' : '➕ Cadastrar Livro'}</h3>
              <button onClick={fechar} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '50%', width: '2rem', height: '2rem', cursor: 'pointer', fontWeight: '700' }}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
              <div>
                <label style={rotulo}>Título</label>
                <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} style={inp} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={rotulo}>Autor</label>
                  <input value={form.autor} onChange={e => setForm(f => ({ ...f, autor: e.target.value }))} style={inp} />
                </div>
                <div>
                  <label style={rotulo}>Grau</label>
                  <select value={form.grau} onChange={e => setForm(f => ({ ...f, grau: e.target.value }))} style={inp}>
                    {GRAUS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={rotulo}>Categoria</label>
                <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} style={inp}>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{rotuloCat(c)}</option>)}
                </select>
              </div>
              <div>
                <label style={rotulo}>Descrição</label>
                <textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={2} style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
              <div>
                <label style={rotulo}>PDF{!editando && ' *'}</label>
                <div onClick={() => pdfRef.current && pdfRef.current.click()} style={{ border: '2px dashed var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1rem', textAlign: 'center', cursor: 'pointer', background: 'var(--color-surface-2)' }}>
                  <input ref={pdfRef} type="file" accept=".pdf" onChange={onPdf} style={{ display: 'none' }} />
                  <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                    {filePdf ? filePdf.name + ' (' + fmtBytes(filePdf.size) + ')' : editando && editando.pdf_url ? 'PDF cadastrado - clique para trocar' : 'Clique para selecionar (máx. 100 MB)'}
                  </p>
                </div>
              </div>
              <div>
                <label style={rotulo}>Capa</label>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ width: '70px', height: '93px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {preview ? <img src={preview} alt="Capa" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>🖼️</span>}
                  </div>
                  <div onClick={() => capaRef.current && capaRef.current.click()} style={{ flex: 1, border: '2px dashed var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1rem', textAlign: 'center', cursor: 'pointer', background: 'var(--color-surface-2)' }}>
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
