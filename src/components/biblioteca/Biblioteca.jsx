import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import FilaEspera from './FilaEspera';

// ── Constantes e helpers ──────────────────────────────────────────────────────
const PRAZO_DIAS = 15; // prazo padrão de devolução

const pad = (n) => String(n).padStart(2, '0');
// Data local (nunca toISOString: depois das 20h em Mato Grosso a data UTC já é a do dia seguinte)
const hojeLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const partes = (s) => String(s).slice(0, 10).split('-').map(Number);
const diasEntre = (a, b) => {
  const [ya, ma, da] = partes(a);
  const [yb, mb, db] = partes(b);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
};
const somarDias = (s, n) => {
  const [y, m, d] = partes(s);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
};
const fmtBR = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '');
const MESES_ABREV = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const DIAS_ABREV = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const tileData = (s) => {
  const [y, m, d] = partes(s);
  return { dia: pad(d), mes: MESES_ABREV[m - 1], semana: DIAS_ABREV[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] };
};
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

// Mesmas cores de grau dos Dashboards
const COR_GRAU = { Aprendiz: '#eab308', Companheiro: '#10b981', Mestre: '#3b82f6' };
const GRAUS = ['Aprendiz', 'Companheiro', 'Mestre'];
const HIERARQUIA_GRAUS = { Aprendiz: 1, Companheiro: 2, Mestre: 3 };
const irmaoApto = (irmao) => ['regular', 'licenciado'].includes(String(irmao?.situacao || 'regular').toLowerCase());

// ── Estilos compartilhados ────────────────────────────────────────────────────
const rotuloKpi = { margin: 0, fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' };
const cartaoKpi = (cor) => ({ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderTop: `3px solid ${cor}`, borderRadius: 'var(--radius-xl)', padding: '1rem 1.1rem', minWidth: 0 });
const cartao = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' };
const chipBase = { display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.55rem', borderRadius: 999, background: 'var(--color-surface-2)', border: '1px solid var(--color-border-light)', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' };
const chipCor = (cor) => ({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.6rem', borderRadius: 999, background: `${cor}22`, color: cor, border: `1px solid ${cor}66`, whiteSpace: 'nowrap' });
const campo = { width: '100%', height: '2.5rem', padding: '0 0.8rem', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border-light)', fontSize: '0.875rem', boxSizing: 'border-box' };
const rotuloCampo = { display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' };
const btnBase = { height: '2.6rem', padding: '0 1.2rem', borderRadius: 'var(--radius-lg)', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.45rem', whiteSpace: 'nowrap' };
const btnPrimario = { ...btnBase, background: 'var(--color-accent)', color: '#fff', border: 'none' };
const btnSecundario = { ...btnBase, background: 'transparent', color: 'var(--color-accent)', border: '1px solid var(--color-accent)' };
const btnPequeno = (cor) => ({ height: '2rem', padding: '0 0.75rem', borderRadius: 'var(--radius-md)', border: `1px solid ${cor}66`, background: `${cor}1f`, color: cor, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' });
const btnIcone = (cor) => ({ width: '2rem', height: '2rem', borderRadius: 'var(--radius-md)', border: `1px solid ${cor}66`, background: `${cor}1f`, cursor: 'pointer', fontSize: '0.85rem' });

const Tile = ({ data, cor }) => {
  const t = tileData(data);
  return (
    <div style={{ width: 54, flexShrink: 0, textAlign: 'center', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--color-bg)' }}>
      <div style={{ background: cor, color: '#fff', fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.06em', padding: '0.1rem 0' }}>{t.mes}</div>
      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.15 }}>{t.dia}</div>
      <div style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', paddingBottom: '0.15rem' }}>{t.semana}</div>
    </div>
  );
};

const Segmentado = ({ opcoes, valor, aoMudar }) => (
  <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.25rem', padding: '0.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-lg)' }}>
    {opcoes.map(([v, rotulo, qtd]) => (
      <button key={v} onClick={() => aoMudar(v)}
        style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700,
          background: valor === v ? 'var(--color-accent)' : 'transparent', color: valor === v ? '#fff' : 'var(--color-text-muted)' }}>
        {rotulo}{qtd !== undefined && <span style={{ marginLeft: '0.4rem', opacity: 0.85 }}>({qtd})</span>}
      </button>
    ))}
  </div>
);

const Vazio = ({ icone, titulo, texto }) => (
  <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
    <p style={{ fontSize: '2rem', margin: '0 0 0.5rem' }}>{icone}</p>
    <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--color-text)' }}>{titulo}</p>
    {texto && <p style={{ margin: '0.3rem 0 0', fontSize: '0.8rem' }}>{texto}</p>}
  </div>
);

// ── Componente ────────────────────────────────────────────────────────────────
const Biblioteca = ({ livros = [], emprestimos = [], irmaos = [], onUpdate, showSuccess, showError, permissoes }) => {
  const podeEditar = !!permissoes?.pode_editar_biblioteca;
  const anoAtual = new Date().getFullYear();
  const hoje = hojeLocal();

  const [abaAtiva, setAbaAtiva] = useState('livros');
  const [loading, setLoading] = useState(false);
  const [filaAguardando, setFilaAguardando] = useState(null);

  // Livros
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroGrau, setFiltroGrau] = useState('todos');
  const [somenteDisponiveis, setSomenteDisponiveis] = useState(false);
  const [livroForm, setLivroForm] = useState({ titulo: '', autor: '', categoria: 'Ritualística', grau: 'Aprendiz', localizacao: '', quantidade_total: 1, quantidade_disponivel: 1 });
  const [modoEdicaoLivro, setModoEdicaoLivro] = useState(false);
  const [livroEditando, setLivroEditando] = useState(null);
  const [modalLivroAberto, setModalLivroAberto] = useState(false);

  // Empréstimos
  const [filtroAtivos, setFiltroAtivos] = useState('todos'); // todos | atrasados | breve
  const [modalEmprestimo, setModalEmprestimo] = useState(false);
  const [emprestimoForm, setEmprestimoForm] = useState({ livro_id: '', irmao_id: '', data_emprestimo: hojeLocal() });
  const [confirmarMesmoAssim, setConfirmarMesmoAssim] = useState(false);
  const [modalEditarPrazo, setModalEditarPrazo] = useState(false);
  const [emprestimoEditando, setEmprestimoEditando] = useState(null);
  const [novoPrazo, setNovoPrazo] = useState('');
  const [confirmacao, setConfirmacao] = useState(null); // { titulo, mensagem, itens, bloqueado, rotuloConfirmar, aoConfirmar }

  // Devolvidos / por irmão
  const [anoDevolvidos, setAnoDevolvidos] = useState(anoAtual); // 0 = Todos
  const [buscaIrmao, setBuscaIrmao] = useState('');

  // Quantidade aguardando na fila (indicador do topo)
  useEffect(() => {
    let cancelado = false;
    const contar = async () => {
      try {
        const { count } = await supabase.from('fila_espera_livros').select('id', { count: 'exact', head: true }).eq('status', 'aguardando');
        if (!cancelado) setFilaAguardando(count ?? 0);
      } catch (e) { /* sem acesso à fila: indicador fica "—" */ }
    };
    contar();
    return () => { cancelado = true; };
  }, [abaAtiva]);

  // Esc fecha o que estiver aberto (o mais "por cima" primeiro)
  useEffect(() => {
    const aoTeclar = (e) => {
      if (e.key !== 'Escape') return;
      if (confirmacao) setConfirmacao(null);
      else if (modalEmprestimo) setModalEmprestimo(false);
      else if (modalEditarPrazo) fecharPrazo();
      else if (modalLivroAberto) { limparFormularioLivro(); setModalLivroAberto(false); }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [confirmacao, modalEmprestimo, modalEditarPrazo, modalLivroAberto]);

  // ── Auxiliares de dados ─────────────────────────────────────────────────────
  const obterNomeIrmao = (irmaoId) => irmaos.find(i => i.id === irmaoId)?.nome || 'Desconhecido';
  const obterTituloLivro = (livroId) => livros.find(l => l.id === livroId)?.titulo || 'Desconhecido';
  const qtdEmprestada = (livroId) => emprestimos.filter(e => e.livro_id === livroId && e.status === 'emprestado').length;
  // Disponibilidade = total − emprestados (fonte única usada na tela)
  const obterQuantidadeDisponivel = (livroId) => {
    const livro = livros.find(l => l.id === livroId);
    return livro ? Math.max(0, (livro.quantidade_total || 0) - qtdEmprestada(livroId)) : 0;
  };
  const diasParaDevolver = (e) => diasEntre(hoje, e.data_devolucao_prevista); // >0 faltam; 0 vence hoje; <0 atrasado

  const situacaoAtivo = (e) => {
    const d = diasParaDevolver(e);
    if (d < 0) return { cor: '#ef4444', rotulo: `⚠️ Atrasado há ${plural(-d, 'dia', 'dias')}`, nivel: 'atrasado', d };
    if (d === 0) return { cor: '#f59e0b', rotulo: '⏰ Vence hoje', nivel: 'breve', d };
    if (d <= 3) return { cor: '#f59e0b', rotulo: `⏰ Vence em ${plural(d, 'dia', 'dias')}`, nivel: 'breve', d };
    return { cor: '#10b981', rotulo: `✅ No prazo · ${d} dias`, nivel: 'ok', d };
  };

  // Mantém quantidade_disponivel do livro = total − emprestados, lendo o estado real do banco
  const sincronizarEstoque = async (livroId) => {
    const { data: ativos } = await supabase.from('biblioteca_emprestimos').select('id').eq('livro_id', livroId).eq('status', 'emprestado');
    const { data: lv } = await supabase.from('biblioteca_livros').select('quantidade_total').eq('id', livroId).single();
    const total = lv?.quantidade_total ?? livros.find(l => l.id === livroId)?.quantidade_total ?? 0;
    await supabase.from('biblioteca_livros').update({ quantidade_disponivel: Math.max(0, total - (ativos?.length || 0)) }).eq('id', livroId);
  };

  // ── Livros ──────────────────────────────────────────────────────────────────
  const limparFormularioLivro = () => {
    setLivroForm({ titulo: '', autor: '', categoria: 'Ritualística', grau: 'Aprendiz', localizacao: '', quantidade_total: 1, quantidade_disponivel: 1 });
    setModoEdicaoLivro(false);
    setLivroEditando(null);
  };

  const salvarLivro = async () => {
    if (!livroForm.titulo) { showError('O título é obrigatório'); return; }
    const total = Math.max(1, parseInt(livroForm.quantidade_total) || 1);
    const emprestadosAgora = modoEdicaoLivro ? qtdEmprestada(livroEditando.id) : 0;
    if (total < emprestadosAgora) {
      showError(`A quantidade total não pode ser menor que os ${emprestadosAgora} exemplar(es) emprestado(s) agora.`);
      return;
    }
    const payload = { ...livroForm, quantidade_total: total, quantidade_disponivel: Math.max(0, total - emprestadosAgora) };

    setLoading(true);
    try {
      if (modoEdicaoLivro) {
        const { error } = await supabase.from('biblioteca_livros').update(payload).eq('id', livroEditando.id);
        if (error) throw error;
        showSuccess('Livro atualizado com sucesso!');
      } else {
        const { error } = await supabase.from('biblioteca_livros').insert([payload]);
        if (error) throw error;
        showSuccess('Livro cadastrado com sucesso!');
      }
      limparFormularioLivro();
      setModalLivroAberto(false);
      onUpdate();
    } catch (error) {
      showError('Erro ao salvar livro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const editarLivro = (livro) => {
    setModoEdicaoLivro(true);
    setLivroEditando(livro);
    setLivroForm({
      titulo: livro.titulo, autor: livro.autor || '', categoria: livro.categoria, grau: livro.grau || 'Aprendiz',
      localizacao: livro.localizacao || '', quantidade_total: livro.quantidade_total, quantidade_disponivel: livro.quantidade_disponivel,
    });
    setModalLivroAberto(true);
  };

  const pedirExclusaoLivro = (livro) => {
    const ativosDoLivro = qtdEmprestada(livro.id);
    setConfirmacao({
      titulo: '🗑️ Excluir livro?',
      mensagem: ativosDoLivro > 0
        ? `Não é possível excluir: há ${plural(ativosDoLivro, 'exemplar emprestado', 'exemplares emprestados')} neste momento. Registre a devolução antes.`
        : 'Esta ação é irreversível.',
      itens: [livro.titulo, livro.autor].filter(Boolean),
      bloqueado: ativosDoLivro > 0,
      rotuloConfirmar: 'Excluir livro',
      aoConfirmar: async () => {
        setLoading(true);
        try {
          const { error } = await supabase.from('biblioteca_livros').delete().eq('id', livro.id);
          if (error) throw error;
          showSuccess('Livro excluído com sucesso!');
          onUpdate();
        } catch (error) {
          showError('Erro ao excluir livro: ' + error.message);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  // ── Empréstimos ─────────────────────────────────────────────────────────────
  const abrirEmprestimo = (livroId = '') => {
    setEmprestimoForm({ livro_id: livroId ? String(livroId) : '', irmao_id: '', data_emprestimo: hojeLocal() });
    setConfirmarMesmoAssim(false);
    setModalEmprestimo(true);
  };

  const irmaoSel = irmaos.find(i => i.id === parseInt(emprestimoForm.irmao_id));
  const livroSel = livros.find(l => l.id === parseInt(emprestimoForm.livro_id));
  const atrasosDoIrmao = irmaoSel ? emprestimos.filter(e => e.status === 'emprestado' && e.irmao_id === irmaoSel.id && diasParaDevolver(e) < 0) : [];
  const jaTemEsteLivro = !!(irmaoSel && livroSel && emprestimos.some(e => e.status === 'emprestado' && e.irmao_id === irmaoSel.id && e.livro_id === livroSel.id));
  const exigeConfirmacao = atrasosDoIrmao.length > 0 || jaTemEsteLivro;
  const prazoPrevisto = emprestimoForm.data_emprestimo ? somarDias(emprestimoForm.data_emprestimo, PRAZO_DIAS) : '';

  const registrarEmprestimo = async () => {
    if (!emprestimoForm.livro_id || !emprestimoForm.irmao_id) { showError('Selecione um livro e um irmão'); return; }

    // Compatibilidade de grau (o irmão precisa ter grau igual ou superior ao do livro)
    if (livroSel && irmaoSel) {
      const grauIrmaoTexto = irmaoSel.grau_maconico || irmaoSel.grau || 'Mestre';
      const grauLivro = HIERARQUIA_GRAUS[livroSel.grau] || 1;
      const grauIrmao = HIERARQUIA_GRAUS[grauIrmaoTexto] || 3;
      if (grauIrmao < grauLivro) {
        showError(`❌ Este livro é para o grau "${livroSel.grau}" e o irmão ${irmaoSel.nome} é "${grauIrmaoTexto}". O grau do livro não é compatível com o grau do irmão.`);
        return;
      }
    }
    if (exigeConfirmacao && !confirmarMesmoAssim) {
      showError('Há um aviso sobre este empréstimo. Marque "Emprestar mesmo assim" para continuar.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('biblioteca_emprestimos').insert([{
        livro_id: parseInt(emprestimoForm.livro_id),
        irmao_id: parseInt(emprestimoForm.irmao_id),
        data_emprestimo: emprestimoForm.data_emprestimo,
        data_devolucao_prevista: prazoPrevisto,
        status: 'emprestado',
      }]);
      if (error) throw error;
      await sincronizarEstoque(parseInt(emprestimoForm.livro_id));

      showSuccess('✅ Empréstimo registrado com sucesso!');
      setModalEmprestimo(false);
      setEmprestimoForm({ livro_id: '', irmao_id: '', data_emprestimo: hojeLocal() });
      onUpdate();
    } catch (error) {
      showError('Erro ao registrar empréstimo: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const devolverLivro = async (emprestimoId, livroId) => {
    setLoading(true);
    try {
      const { error } = await supabase.from('biblioteca_emprestimos').update({ status: 'devolvido', data_devolucao_real: hojeLocal() }).eq('id', emprestimoId);
      if (error) throw error;
      await sincronizarEstoque(livroId);
      showSuccess('✅ Devolução registrada com sucesso!');
      onUpdate();
    } catch (error) {
      showError('Erro ao devolver livro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const abrirModalEditarPrazo = (emprestimo) => {
    setEmprestimoEditando(emprestimo);
    setNovoPrazo(emprestimo.data_devolucao_prevista);
    setModalEditarPrazo(true);
  };
  const fecharPrazo = () => { setModalEditarPrazo(false); setEmprestimoEditando(null); setNovoPrazo(''); };

  const salvarNovoPrazo = async () => {
    if (!novoPrazo) { showError('Informe a nova data de devolução'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.from('biblioteca_emprestimos').update({ data_devolucao_prevista: novoPrazo }).eq('id', emprestimoEditando.id);
      if (error) throw error;
      showSuccess('Prazo atualizado com sucesso!');
      fecharPrazo();
      onUpdate();
    } catch (error) {
      showError('Erro ao atualizar prazo: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const pedirExclusaoEmprestimo = (emprestimo) => {
    const ativo = emprestimo.status === 'emprestado';
    setConfirmacao({
      titulo: '🗑️ Excluir empréstimo?',
      mensagem: ativo ? 'O empréstimo está ativo: ao excluir, o exemplar volta ao estoque.' : 'O registro desta devolução será apagado do histórico.',
      itens: [obterTituloLivro(emprestimo.livro_id), obterNomeIrmao(emprestimo.irmao_id), `Emprestado em ${fmtBR(emprestimo.data_emprestimo)}`],
      bloqueado: false,
      rotuloConfirmar: 'Excluir empréstimo',
      aoConfirmar: async () => {
        setLoading(true);
        try {
          const { error } = await supabase.from('biblioteca_emprestimos').delete().eq('id', emprestimo.id);
          if (error) throw error;
          if (ativo) await sincronizarEstoque(emprestimo.livro_id);
          showSuccess('Empréstimo excluído com sucesso!');
          onUpdate();
        } catch (error) {
          showError('Erro ao excluir empréstimo: ' + error.message);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  // ── Dados derivados da tela ─────────────────────────────────────────────────
  // Livros
  const livrosBase = livros.filter(l => {
    if (filtroNome && !String(l.titulo || '').toLowerCase().includes(filtroNome.toLowerCase())) return false;
    if (somenteDisponiveis && obterQuantidadeDisponivel(l.id) <= 0) return false;
    return true;
  });
  const livrosFiltrados = livrosBase.filter(l => filtroGrau === 'todos' || l.grau === filtroGrau);
  const livrosPorGrau = Object.fromEntries(GRAUS.map(g => [g, livrosFiltrados.filter(l => l.grau === g)]));
  const totalExemplares = livros.reduce((soma, l) => soma + (l.quantidade_total || 0), 0);
  const filtrosLivrosAtivos = !!(filtroNome || filtroGrau !== 'todos' || somenteDisponiveis);

  // Empréstimos ativos
  const emprestimosAtivos = emprestimos.filter(e => e.status === 'emprestado');
  const atrasados = emprestimosAtivos.filter(e => diasParaDevolver(e) < 0).sort((a, b) => diasParaDevolver(a) - diasParaDevolver(b));
  const vencemBreve = emprestimosAtivos.filter(e => diasParaDevolver(e) >= 0 && diasParaDevolver(e) <= 3);
  const ativosFiltrados = emprestimosAtivos
    .filter(e => filtroAtivos === 'todos' || (filtroAtivos === 'atrasados' && diasParaDevolver(e) < 0) || (filtroAtivos === 'breve' && diasParaDevolver(e) >= 0 && diasParaDevolver(e) <= 3))
    .sort((a, b) => diasParaDevolver(a) - diasParaDevolver(b));

  // Devolvidos (ano pela data da devolução; só anos com devolução; padrão = ano atual)
  const emprestimosDevolvidos = emprestimos.filter(e => e.status === 'devolvido');
  const anoDaDevolucao = (e) => parseInt(String(e.data_devolucao_real || e.data_emprestimo).slice(0, 4), 10);
  const anosDevolucao = [...new Set(emprestimosDevolvidos.map(anoDaDevolucao).filter(Boolean))].sort((a, b) => b - a);
  const qtdPorAnoDev = {};
  emprestimosDevolvidos.forEach(e => { const a = anoDaDevolucao(e); if (a) qtdPorAnoDev[a] = (qtdPorAnoDev[a] || 0) + 1; });
  const anoDevExibido = (anoDevolvidos === 0 || anosDevolucao.includes(anoDevolvidos))
    ? anoDevolvidos
    : (anosDevolucao.find(a => a < anoAtual) ?? anosDevolucao[0] ?? 0);
  const devolvidosDoAno = emprestimosDevolvidos
    .filter(e => anoDevExibido === 0 || anoDaDevolucao(e) === anoDevExibido)
    .sort((a, b) => String(b.data_devolucao_real || '').localeCompare(String(a.data_devolucao_real || '')));
  const devolveuAtrasado = (e) => String(e.data_devolucao_real || '').slice(0, 10) > String(e.data_devolucao_prevista || '').slice(0, 10);
  const devolvidosComAtraso = devolvidosDoAno.filter(devolveuAtrasado).length;

  // Por irmão
  const emprestimosPorIrmao = irmaos
    .map(irmao => {
      const doIrmao = emprestimos.filter(e => e.irmao_id === irmao.id);
      return {
        irmao,
        emprestimos: [...doIrmao].sort((a, b) => String(b.data_emprestimo).localeCompare(String(a.data_emprestimo))),
        ativos: doIrmao.filter(e => e.status === 'emprestado').length,
        atrasados: doIrmao.filter(e => e.status === 'emprestado' && diasParaDevolver(e) < 0).length,
        total: doIrmao.length,
      };
    })
    .filter(item => item.total > 0)
    .filter(item => !buscaIrmao || String(item.irmao.nome || '').toLowerCase().includes(buscaIrmao.toLowerCase()))
    .sort((a, b) => b.atrasados - a.atrasados || b.ativos - a.ativos || String(a.irmao.nome).localeCompare(String(b.irmao.nome)));

  const livrosDisponiveis = livros.filter(l => obterQuantidadeDisponivel(l.id) > 0 || String(l.id) === emprestimoForm.livro_id);
  const irmaosAptos = [...irmaos].filter(irmaoApto).sort((a, b) => String(a.nome).localeCompare(String(b.nome)));

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4" style={{ background: 'var(--color-bg)', minHeight: '100vh', padding: '0.5rem', overflowX: 'hidden' }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>📚 Biblioteca</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: '0.2rem 0 0' }}>Controle do acervo e dos empréstimos</p>
        </div>
        {podeEditar && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
            <button onClick={() => { limparFormularioLivro(); setModalLivroAberto(true); }} style={btnSecundario}>➕ Cadastrar Livro</button>
            <button onClick={() => abrirEmprestimo()} style={btnPrimario}>📖 Novo Empréstimo</button>
          </div>
        )}
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div style={cartaoKpi('var(--color-accent)')}>
          <p style={rotuloKpi}>Acervo</p>
          <p style={{ margin: '0.25rem 0 0.5rem', fontSize: '2rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.1 }}>
            {livros.length} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>títulos · {totalExemplares} exemplares</span>
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {GRAUS.map(g => (
              <span key={g} style={chipBase}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: COR_GRAU[g] }} />
                {g} <strong style={{ color: 'var(--color-text)' }}>{livros.filter(l => l.grau === g).length}</strong>
              </span>
            ))}
          </div>
        </div>

        <div style={cartaoKpi('#6366f1')}>
          <p style={rotuloKpi}>Emprestados agora</p>
          <p style={{ margin: '0.25rem 0 0.5rem', fontSize: '2rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.1 }}>{emprestimosAtivos.length}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            <span style={chipBase}>📗 Disponíveis <strong style={{ color: 'var(--color-text)' }}>{Math.max(0, totalExemplares - emprestimosAtivos.length)}</strong></span>
            {vencemBreve.length > 0 && <span style={chipBase}>⏰ Vencem em até 3 dias <strong style={{ color: '#f59e0b' }}>{vencemBreve.length}</strong></span>}
          </div>
        </div>

        <div style={cartaoKpi(atrasados.length > 0 ? '#ef4444' : '#10b981')}>
          <p style={rotuloKpi}>Atrasados</p>
          {atrasados.length === 0 ? (
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', fontWeight: 700, color: '#10b981' }}>✅ Nenhum atraso</p>
          ) : (
            <>
              <p style={{ margin: '0.25rem 0 0.4rem', fontSize: '2rem', fontWeight: 800, color: '#ef4444', lineHeight: 1.1 }}>{atrasados.length}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {atrasados.slice(0, 3).map(e => (
                  <span key={e.id} style={{ ...chipBase, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }} title={`${obterNomeIrmao(e.irmao_id)} — ${obterTituloLivro(e.livro_id)}`}>
                    {obterNomeIrmao(e.irmao_id).split(' ')[0]} · {obterTituloLivro(e.livro_id)} · há {-diasParaDevolver(e)}d
                  </span>
                ))}
                {atrasados.length > 3 && <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>+{atrasados.length - 3}</span>}
              </div>
            </>
          )}
        </div>

        <div style={cartaoKpi('#f59e0b')}>
          <p style={rotuloKpi}>Fila de espera</p>
          <p style={{ margin: '0.25rem 0 0.4rem', fontSize: '2rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.1 }}>{filaAguardando === null ? '—' : filaAguardando}</p>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>aguardando um exemplar</p>
        </div>
      </div>

      {/* Abas */}
      <Segmentado
        valor={abaAtiva}
        aoMudar={setAbaAtiva}
        opcoes={[
          ['livros', '📚 Livros', livros.length],
          ['emprestimos', '📖 Emprestados', emprestimosAtivos.length],
          ['devolvidos', '✅ Devolvidos', emprestimosDevolvidos.length],
          ['por-irmao', '👤 Por Irmão'],
          ['fila', '⏳ Fila de Espera'],
        ]}
      />

      {/* ── ABA LIVROS ─────────────────────────────────────────────── */}
      {abaAtiva === 'livros' && (
        <div className="space-y-4">
          <div style={{ ...cartao, padding: '0.9rem 1rem', overflow: 'visible' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: '420px' }}>
                <span aria-hidden="true" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.85rem', pointerEvents: 'none' }}>🔍</span>
                <input type="text" value={filtroNome} onChange={(e) => setFiltroNome(e.target.value)} placeholder="Pesquisar por título..." style={{ ...campo, paddingLeft: '2.1rem' }} />
              </div>
              <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {[['todos', 'Todos', livrosBase.length], ...GRAUS.map(g => [g, g, livrosBase.filter(l => l.grau === g).length])].map(([valor, rotulo, qtd]) => {
                  const ativo = filtroGrau === valor;
                  const cor = COR_GRAU[valor] || 'var(--color-accent)';
                  return (
                    <button key={valor} onClick={() => setFiltroGrau(valor)}
                      style={{ height: '2.2rem', padding: '0 0.8rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700,
                        border: `1px solid ${ativo ? cor : 'var(--color-border-light)'}`, background: ativo ? (valor === 'todos' ? 'var(--color-accent)' : `${cor}26`) : 'var(--color-bg)', color: ativo ? (valor === 'todos' ? '#fff' : cor) : 'var(--color-text)' }}>
                      {rotulo} <span style={{ opacity: 0.8, fontWeight: 600 }}>{qtd}</span>
                    </button>
                  );
                })}
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text)', cursor: 'pointer' }}>
                <input type="checkbox" checked={somenteDisponiveis} onChange={(e) => setSomenteDisponiveis(e.target.checked)} />
                Somente disponíveis
              </label>
              {filtrosLivrosAtivos && (
                <button onClick={() => { setFiltroNome(''); setFiltroGrau('todos'); setSomenteDisponiveis(false); }}
                  style={{ background: 'none', border: 'none', color: 'var(--color-accent)', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>Limpar filtros</button>
              )}
              <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                <strong style={{ color: 'var(--color-text)' }}>{livrosFiltrados.length}</strong> título(s)
              </span>
            </div>
          </div>

          {GRAUS.map(grau => {
            const lista = livrosPorGrau[grau];
            if (lista.length === 0) return null;
            const cor = COR_GRAU[grau];
            return (
              <div key={grau} style={cartao}>
                <div style={{ padding: '0.7rem 1.1rem', background: 'var(--color-surface-2)', borderLeft: `4px solid ${cor}`, borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)' }}>{grau}</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{plural(lista.length, 'título', 'títulos')} · {lista.reduce((s, l) => s + (l.quantidade_total || 0), 0)} exemplares</span>
                </div>
                <div>
                  {lista.map(livro => {
                    const disp = obterQuantidadeDisponivel(livro.id);
                    const corEstoque = disp > 0 ? '#10b981' : '#ef4444';
                    return (
                      <div key={livro.id} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem 1rem', padding: '0.75rem 1.1rem', borderBottom: '1px solid var(--color-border)' }}>
                        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)', overflowWrap: 'anywhere' }}>{livro.titulo}</p>
                          <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{livro.autor || '—'}</p>
                        </div>
                        <span style={{ ...chipBase, width: '7rem', justifyContent: 'center', boxSizing: 'border-box' }}>{livro.categoria || '—'}</span>
                        <span style={{ width: '9rem', fontSize: '0.76rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={livro.localizacao || ''}>{livro.localizacao ? `📍 ${livro.localizacao}` : '—'}</span>
                        <span style={{ ...chipCor(corEstoque), width: '8.2rem', boxSizing: 'border-box' }}>{disp > 0 ? `Disponível ${disp}/${livro.quantidade_total}` : `Indisponível 0/${livro.quantidade_total}`}</span>
                        {podeEditar && (
                          <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                            <button onClick={() => abrirEmprestimo(livro.id)} disabled={disp <= 0} title={disp > 0 ? 'Registrar empréstimo deste livro' : 'Sem exemplar disponível'}
                              style={{ ...btnPequeno('#6366f1'), opacity: disp > 0 ? 1 : 0.4, cursor: disp > 0 ? 'pointer' : 'not-allowed' }}>📖 Emprestar</button>
                            <button onClick={() => editarLivro(livro)} title="Editar" aria-label="Editar livro" style={btnIcone('#3b82f6')}>✏️</button>
                            <button onClick={() => pedirExclusaoLivro(livro)} title="Excluir" aria-label="Excluir livro" style={btnIcone('#ef4444')}>🗑️</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {livrosFiltrados.length === 0 && (
            <div style={cartao}>
              <Vazio icone="📚" titulo={livros.length === 0 ? 'Nenhum livro cadastrado' : 'Nenhum livro com esses filtros'} texto={livros.length === 0 && podeEditar ? 'Use "Cadastrar Livro" para começar' : ''} />
            </div>
          )}
        </div>
      )}

      {/* ── ABA EMPRESTADOS (ativos) ───────────────────────────────── */}
      {abaAtiva === 'emprestimos' && (
        <div className="space-y-4">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {[['todos', 'Todos', emprestimosAtivos.length, 'var(--color-accent)'], ['atrasados', 'Atrasados', atrasados.length, '#ef4444'], ['breve', 'Vencem em até 3 dias', vencemBreve.length, '#f59e0b']].map(([valor, rotulo, qtd, cor]) => {
              const ativo = filtroAtivos === valor;
              return (
                <button key={valor} onClick={() => setFiltroAtivos(valor)}
                  style={{ height: '2.2rem', padding: '0 0.9rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700,
                    border: `1px solid ${ativo ? cor : 'var(--color-border-light)'}`, background: ativo ? (valor === 'todos' ? 'var(--color-accent)' : `${cor}26`) : 'var(--color-surface)', color: ativo ? (valor === 'todos' ? '#fff' : cor) : 'var(--color-text)' }}>
                  {rotulo} <span style={{ opacity: 0.85, fontWeight: 600 }}>{qtd}</span>
                </button>
              );
            })}
          </div>

          <div style={cartao}>
            {ativosFiltrados.length === 0 ? (
              <Vazio icone="📖" titulo={emprestimosAtivos.length === 0 ? 'Nenhum empréstimo ativo no momento' : 'Nenhum empréstimo neste filtro'} />
            ) : ativosFiltrados.map(emprestimo => {
              const sit = situacaoAtivo(emprestimo);
              return (
                <div key={emprestimo.id} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem 1rem', padding: '0.85rem 1.1rem', borderBottom: '1px solid var(--color-border)' }}>
                  <Tile data={emprestimo.data_devolucao_prevista} cor={sit.cor} />
                  <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.92rem', color: 'var(--color-text)', overflowWrap: 'anywhere' }}>{obterTituloLivro(emprestimo.livro_id)}</p>
                    <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: 'var(--color-text)' }}>👤 {obterNomeIrmao(emprestimo.irmao_id)}</p>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
                      Emprestado em {fmtBR(emprestimo.data_emprestimo)} · devolver até <strong style={{ color: 'var(--color-text)' }}>{fmtBR(emprestimo.data_devolucao_prevista)}</strong>
                    </p>
                  </div>
                  <span style={{ ...chipCor(sit.cor), width: '11.5rem', boxSizing: 'border-box' }}>{sit.rotulo}</span>
                  {podeEditar && (
                    <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                      <button onClick={() => devolverLivro(emprestimo.id, emprestimo.livro_id)} disabled={loading} style={btnPequeno('#10b981')}>✅ Devolver</button>
                      <button onClick={() => abrirModalEditarPrazo(emprestimo)} title="Alterar prazo" aria-label="Alterar prazo" style={btnIcone('#f59e0b')}>📅</button>
                      <button onClick={() => pedirExclusaoEmprestimo(emprestimo)} title="Excluir" aria-label="Excluir empréstimo" style={btnIcone('#ef4444')}>🗑️</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── ABA DEVOLVIDOS ─────────────────────────────────────────── */}
      {abaAtiva === 'devolvidos' && (
        <div className="space-y-4">
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
            <select value={anoDevExibido} onChange={(e) => setAnoDevolvidos(parseInt(e.target.value))} aria-label="Ano da devolução"
              style={{ height: '2.4rem', padding: '0 0.9rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-light)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer' }}>
              {anosDevolucao.map(a => <option key={a} value={a}>{a} ({qtdPorAnoDev[a]})</option>)}
              <option value={0}>Todos ({emprestimosDevolvidos.length})</option>
            </select>
            <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
              <strong style={{ color: 'var(--color-text)' }}>{devolvidosDoAno.length}</strong> devolução(ões)
              {anoDevExibido !== 0 && ` em ${anoDevExibido}`}
            </span>
            <span style={chipBase}>✅ No prazo <strong style={{ color: 'var(--color-text)' }}>{devolvidosDoAno.length - devolvidosComAtraso}</strong></span>
            <span style={chipBase}>⏱️ Com atraso <strong style={{ color: 'var(--color-text)' }}>{devolvidosComAtraso}</strong></span>
            {anoDevolvidos === anoAtual && anoDevExibido !== anoAtual && anoDevExibido !== 0 && (
              <span style={{ fontSize: '0.78rem', color: '#f59e0b' }}>Sem devoluções em {anoAtual}; exibindo {anoDevExibido}.</span>
            )}
          </div>

          <div style={cartao}>
            {devolvidosDoAno.length === 0 ? (
              <Vazio icone="✅" titulo="Nenhuma devolução registrada" />
            ) : devolvidosDoAno.map(emprestimo => {
              const atrasou = devolveuAtrasado(emprestimo);
              const diasAtraso = atrasou ? diasEntre(emprestimo.data_devolucao_prevista, emprestimo.data_devolucao_real) : 0;
              return (
                <div key={emprestimo.id} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem 1rem', padding: '0.85rem 1.1rem', borderBottom: '1px solid var(--color-border)' }}>
                  <Tile data={emprestimo.data_devolucao_real || emprestimo.data_devolucao_prevista} cor={atrasou ? '#f59e0b' : '#10b981'} />
                  <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.92rem', color: 'var(--color-text)', overflowWrap: 'anywhere' }}>{obterTituloLivro(emprestimo.livro_id)}</p>
                    <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: 'var(--color-text)' }}>👤 {obterNomeIrmao(emprestimo.irmao_id)}</p>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
                      Emprestado em {fmtBR(emprestimo.data_emprestimo)} · prazo {fmtBR(emprestimo.data_devolucao_prevista)} · devolvido em <strong style={{ color: 'var(--color-text)' }}>{fmtBR(emprestimo.data_devolucao_real)}</strong>
                    </p>
                  </div>
                  <span style={{ ...chipCor(atrasou ? '#f59e0b' : '#10b981'), width: '10rem', boxSizing: 'border-box' }}>{atrasou ? `⏱️ Atrasou ${plural(diasAtraso, 'dia', 'dias')}` : '✅ No prazo'}</span>
                  {podeEditar && (
                    <button onClick={() => pedirExclusaoEmprestimo(emprestimo)} title="Excluir" aria-label="Excluir registro" style={btnIcone('#ef4444')}>🗑️</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── ABA POR IRMÃO ──────────────────────────────────────────── */}
      {abaAtiva === 'por-irmao' && (
        <div className="space-y-4">
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: '420px' }}>
              <span aria-hidden="true" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.85rem', pointerEvents: 'none' }}>🔍</span>
              <input type="text" value={buscaIrmao} onChange={(e) => setBuscaIrmao(e.target.value)} placeholder="Buscar irmão..." style={{ ...campo, paddingLeft: '2.1rem' }} />
            </div>
            <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
              <strong style={{ color: 'var(--color-text)' }}>{emprestimosPorIrmao.length}</strong> irmão(s) com empréstimos registrados
            </span>
          </div>

          {emprestimosPorIrmao.length === 0 ? (
            <div style={cartao}><Vazio icone="👤" titulo="Nenhum irmão com empréstimos registrados" /></div>
          ) : emprestimosPorIrmao.map(item => (
            <div key={item.irmao.id} style={cartao}>
              <div style={{ padding: '0.7rem 1.1rem', background: 'var(--color-surface-2)', borderLeft: `4px solid ${item.atrasados > 0 ? '#ef4444' : 'var(--color-accent)'}`, borderBottom: '1px solid var(--color-border)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)' }}>{item.irmao.nome}</h4>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {item.atrasados > 0 && <span style={chipCor('#ef4444')}>⚠️ Atrasados {item.atrasados}</span>}
                  <span style={chipCor('#6366f1')}>Ativos {item.ativos}</span>
                  <span style={chipBase}>Total <strong style={{ color: 'var(--color-text)' }}>{item.total}</strong></span>
                </div>
              </div>
              <div>
                {item.emprestimos.map(emprestimo => {
                  const ativo = emprestimo.status === 'emprestado';
                  const sit = ativo ? situacaoAtivo(emprestimo) : null;
                  return (
                    <div key={emprestimo.id} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem 1rem', padding: '0.6rem 1.1rem', borderBottom: '1px solid var(--color-border)' }}>
                      <p style={{ flex: '1 1 220px', margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)', overflowWrap: 'anywhere' }}>{obterTituloLivro(emprestimo.livro_id)}</p>
                      <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>📅 {fmtBR(emprestimo.data_emprestimo)} → {fmtBR(ativo ? emprestimo.data_devolucao_prevista : emprestimo.data_devolucao_real)}</span>
                      <span style={{ ...chipCor(ativo ? sit.cor : '#10b981'), width: '11.5rem', boxSizing: 'border-box' }}>{ativo ? sit.rotulo : '✅ Devolvido'}</span>
                      {ativo && podeEditar && (
                        <button onClick={() => devolverLivro(emprestimo.id, emprestimo.livro_id)} disabled={loading} style={btnPequeno('#10b981')}>✅ Devolver</button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── ABA FILA DE ESPERA ─────────────────────────────────────── */}
      {abaAtiva === 'fila' && (
        <FilaEspera permissoes={permissoes} showSuccess={showSuccess} showError={showError} livros={livros} irmaos={irmaos} />
      )}

      {/* ── MODAL: novo empréstimo ─────────────────────────────────── */}
      {modalEmprestimo && (
        <div onClick={() => setModalEmprestimo(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderTop: '3px solid var(--color-accent)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '520px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px rgba(0,0,0,0.4)' }}>
            <div style={{ padding: '1.1rem 1.4rem', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)' }}>📖 Novo Empréstimo</h3>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>Prazo padrão de {PRAZO_DIAS} dias</p>
              </div>
              <button onClick={() => setModalEmprestimo(false)} aria-label="Fechar" title="Fechar (Esc)"
                style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border-light)', color: 'var(--color-text-muted)', borderRadius: 'var(--radius-md)', width: '2.2rem', height: '2.2rem', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ padding: '1.2rem 1.4rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={rotuloCampo}>Livro *</label>
                <select value={emprestimoForm.livro_id} onChange={(e) => { setEmprestimoForm({ ...emprestimoForm, livro_id: e.target.value }); setConfirmarMesmoAssim(false); }} style={campo}>
                  <option value="">Selecione um livro</option>
                  {livrosDisponiveis.map(livro => (
                    <option key={livro.id} value={livro.id}>{livro.titulo} ({obterQuantidadeDisponivel(livro.id)} disponível)</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={rotuloCampo}>Irmão *</label>
                <select value={emprestimoForm.irmao_id} onChange={(e) => { setEmprestimoForm({ ...emprestimoForm, irmao_id: e.target.value }); setConfirmarMesmoAssim(false); }} style={campo}>
                  <option value="">Selecione um irmão</option>
                  {irmaosAptos.map(irmao => <option key={irmao.id} value={irmao.id}>{irmao.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={rotuloCampo}>Data do empréstimo</label>
                <input type="date" value={emprestimoForm.data_emprestimo} onChange={(e) => setEmprestimoForm({ ...emprestimoForm, data_emprestimo: e.target.value })} style={campo} />
                {prazoPrevisto && (
                  <p style={{ margin: '0.4rem 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    Devolução prevista: <strong style={{ color: 'var(--color-text)' }}>{fmtBR(prazoPrevisto)}</strong> ({tileData(prazoPrevisto).semana})
                  </p>
                )}
              </div>

              {exigeConfirmacao && (
                <div style={{ padding: '0.75rem 0.9rem', borderRadius: 'var(--radius-md)', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.45)', fontSize: '0.82rem', color: 'var(--color-text)' }}>
                  {atrasosDoIrmao.length > 0 && (
                    <p style={{ margin: '0 0 0.4rem' }}>
                      ⚠️ <strong>{irmaoSel.nome}</strong> tem {plural(atrasosDoIrmao.length, 'livro atrasado', 'livros atrasados')}: {atrasosDoIrmao.map(e => obterTituloLivro(e.livro_id)).join(', ')}.
                    </p>
                  )}
                  {jaTemEsteLivro && <p style={{ margin: '0 0 0.4rem' }}>⚠️ Este irmão já está com um exemplar deste livro.</p>}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 700 }}>
                    <input type="checkbox" checked={confirmarMesmoAssim} onChange={(e) => setConfirmarMesmoAssim(e.target.checked)} />
                    Emprestar mesmo assim
                  </label>
                </div>
              )}
            </div>

            <div style={{ padding: '0.9rem 1.4rem', borderTop: '1px solid var(--color-border)', display: 'flex', gap: '0.65rem' }}>
              <button onClick={() => setModalEmprestimo(false)} style={{ flex: 1, height: '2.6rem', background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={registrarEmprestimo} disabled={loading || (exigeConfirmacao && !confirmarMesmoAssim)}
                style={{ flex: 2, height: '2.6rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 700, cursor: loading ? 'wait' : 'pointer', opacity: (loading || (exigeConfirmacao && !confirmarMesmoAssim)) ? 0.55 : 1 }}>
                {loading ? 'Registrando...' : '📖 Registrar Empréstimo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: editar prazo ────────────────────────────────────── */}
      {modalEditarPrazo && emprestimoEditando && (
        <div onClick={fecharPrazo} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderTop: '3px solid #f59e0b', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '440px', boxShadow: '0 25px 50px rgba(0,0,0,0.4)' }}>
            <div style={{ padding: '1.1rem 1.4rem', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)' }}>📅 Prazo de devolução</h3>
              <button onClick={fecharPrazo} aria-label="Fechar" title="Fechar (Esc)"
                style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border-light)', color: 'var(--color-text-muted)', borderRadius: 'var(--radius-md)', width: '2.2rem', height: '2.2rem', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: '1.2rem 1.4rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ padding: '0.7rem 0.9rem', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)', border: '1px solid var(--color-border)', fontSize: '0.85rem', color: 'var(--color-text)' }}>
                <p style={{ margin: 0, fontWeight: 700 }}>{obterTituloLivro(emprestimoEditando.livro_id)}</p>
                <p style={{ margin: '0.2rem 0 0', color: 'var(--color-text-muted)' }}>👤 {obterNomeIrmao(emprestimoEditando.irmao_id)} · prazo atual <strong style={{ color: 'var(--color-text)' }}>{fmtBR(emprestimoEditando.data_devolucao_prevista)}</strong></p>
              </div>
              <div>
                <label style={rotuloCampo}>Nova data de devolução *</label>
                <input type="date" value={novoPrazo} onChange={(e) => setNovoPrazo(e.target.value)} min={hojeLocal()} style={campo} />
              </div>
            </div>
            <div style={{ padding: '0.9rem 1.4rem', borderTop: '1px solid var(--color-border)', display: 'flex', gap: '0.65rem' }}>
              <button onClick={fecharPrazo} style={{ flex: 1, height: '2.6rem', background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvarNovoPrazo} disabled={loading}
                style={{ flex: 2, height: '2.6rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 700, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.6 : 1 }}>
                {loading ? 'Salvando...' : '💾 Salvar novo prazo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: cadastro/edição de livro ────────────────────────── */}
      {modalLivroAberto && (
        <div onClick={() => { limparFormularioLivro(); setModalLivroAberto(false); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderTop: '3px solid var(--color-accent)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '560px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px rgba(0,0,0,0.4)' }}>
            <div style={{ padding: '1.1rem 1.4rem', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)' }}>{modoEdicaoLivro ? '✏️ Editar Livro' : '➕ Cadastrar Livro'}</h3>
              <button onClick={() => { limparFormularioLivro(); setModalLivroAberto(false); }} aria-label="Fechar" title="Fechar (Esc)"
                style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border-light)', color: 'var(--color-text-muted)', borderRadius: 'var(--radius-md)', width: '2.2rem', height: '2.2rem', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ overflowY: 'auto', padding: '1.2rem 1.4rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={rotuloCampo}>Título *</label>
                  <input type="text" value={livroForm.titulo} onChange={(e) => setLivroForm({ ...livroForm, titulo: e.target.value })} placeholder="Ex: Ritual do Aprendiz Maçom" style={campo} />
                </div>
                <div>
                  <label style={rotuloCampo}>Autor</label>
                  <input type="text" value={livroForm.autor} onChange={(e) => setLivroForm({ ...livroForm, autor: e.target.value })} placeholder="Ex: Rizzardo da Camino" style={campo} />
                </div>
                <div>
                  <label style={rotuloCampo}>Categoria</label>
                  <select value={livroForm.categoria} onChange={(e) => setLivroForm({ ...livroForm, categoria: e.target.value })} style={campo}>
                    {['Ritualística', 'Filosofia', 'História', 'Simbolismo', 'Outros'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={rotuloCampo}>Grau</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {GRAUS.map(g => {
                      const ativo = livroForm.grau === g;
                      return (
                        <button type="button" key={g} onClick={() => setLivroForm({ ...livroForm, grau: g })}
                          style={{ flex: 1, height: '2.5rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700,
                            border: `1px solid ${ativo ? COR_GRAU[g] : 'var(--color-border-light)'}`, background: ativo ? `${COR_GRAU[g]}26` : 'var(--color-bg)', color: ativo ? COR_GRAU[g] : 'var(--color-text-muted)' }}>{g}</button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label style={rotuloCampo}>Localização</label>
                  <input type="text" value={livroForm.localizacao} onChange={(e) => setLivroForm({ ...livroForm, localizacao: e.target.value })} placeholder="Ex: Estante 2 - Prateleira B" style={campo} />
                </div>
                <div>
                  <label style={rotuloCampo}>Quantidade total</label>
                  <input type="number" min="1" value={livroForm.quantidade_total} onChange={(e) => setLivroForm({ ...livroForm, quantidade_total: e.target.value })} style={campo} />
                  {modoEdicaoLivro && livroEditando && qtdEmprestada(livroEditando.id) > 0 && (
                    <p style={{ margin: '0.35rem 0 0', fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>{plural(qtdEmprestada(livroEditando.id), 'exemplar emprestado', 'exemplares emprestados')} agora — a disponibilidade é recalculada.</p>
                  )}
                </div>
              </div>
            </div>

            <div style={{ padding: '0.9rem 1.4rem', borderTop: '1px solid var(--color-border)', display: 'flex', gap: '0.65rem' }}>
              <button onClick={() => { limparFormularioLivro(); setModalLivroAberto(false); }} style={{ flex: 1, height: '2.6rem', background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvarLivro} disabled={loading}
                style={{ flex: 2, height: '2.6rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 700, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.6 : 1 }}>
                {loading ? 'Salvando...' : (modoEdicaoLivro ? '💾 Salvar alterações' : '➕ Cadastrar livro')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: confirmação (excluir livro / empréstimo) ────────── */}
      {confirmacao && (
        <div onClick={() => setConfirmacao(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderTop: '3px solid #ef4444', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '440px', padding: '1.4rem', boxShadow: '0 25px 50px rgba(0,0,0,0.4)' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)' }}>{confirmacao.titulo}</h3>
            {confirmacao.itens?.length > 0 && (
              <div style={{ margin: '0.8rem 0 0', padding: '0.65rem 0.8rem', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)', border: '1px solid var(--color-border)', fontSize: '0.85rem', color: 'var(--color-text)' }}>
                {confirmacao.itens.map((t, i) => <p key={i} style={{ margin: i === 0 ? 0 : '0.15rem 0 0', fontWeight: i === 0 ? 700 : 400, color: i === 0 ? 'var(--color-text)' : 'var(--color-text-muted)' }}>{t}</p>)}
              </div>
            )}
            <p style={{ margin: '0.8rem 0 0', fontSize: '0.84rem', color: confirmacao.bloqueado ? '#ef4444' : 'var(--color-text-muted)' }}>{confirmacao.mensagem}</p>
            <div style={{ display: 'flex', gap: '0.65rem', marginTop: '1.2rem' }}>
              <button onClick={() => setConfirmacao(null)} style={{ flex: 1, height: '2.6rem', background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer' }}>{confirmacao.bloqueado ? 'Fechar' : 'Cancelar'}</button>
              {!confirmacao.bloqueado && (
                <button onClick={() => { const fn = confirmacao.aoConfirmar; setConfirmacao(null); fn(); }} style={{ flex: 1, height: '2.6rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 700, cursor: 'pointer' }}>{confirmacao.rotuloConfirmar}</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Biblioteca;
