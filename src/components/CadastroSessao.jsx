import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';

// ── Constantes e helpers ──────────────────────────────────────────────────────
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MESES_ABREV = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const DIAS_ABREV = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Mesmas cores dos Dashboards: Aprendiz, Companheiro, Mestre, Administrativa
const COR_GRAU = { 1: '#eab308', 2: '#10b981', 3: '#3b82f6', 4: '#8b5cf6' };
const PALETA_GRAU = ['#eab308', '#10b981', '#3b82f6', '#8b5cf6'];
const corGrau = (id, idx = 0) => COR_GRAU[id] || PALETA_GRAU[idx % PALETA_GRAU.length];

const COR_CLASSIFICACAO = {
  'Econômica':      ['rgba(16,185,129,0.14)', '#10b981', 'rgba(16,185,129,0.35)'],
  'Especial':       ['rgba(139,92,246,0.14)', '#8b5cf6', 'rgba(139,92,246,0.35)'],
  'Magna':          ['rgba(245,158,11,0.14)', '#f59e0b', 'rgba(245,158,11,0.35)'],
  'Extraordinária': ['rgba(239,68,68,0.14)',  '#ef4444', 'rgba(239,68,68,0.35)'],
};
const corClassificacao = (nome) =>
  COR_CLASSIFICACAO[nome] || ['var(--color-surface-2)', 'var(--color-text-muted)', 'var(--color-border-light)'];

const pad = (n) => String(n).padStart(2, '0');
const hojeLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const diasEntre = (a, b) => {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
};
const rotuloSessoes = (n) => `${n} ${n === 1 ? 'sessão' : 'sessões'}`;
const fmtBR = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');
const diaSemana = (d) => DIAS_SEMANA[new Date(d + 'T00:00:00').getDay()];
const relativo = (data, hoje) => {
  const n = diasEntre(hoje, data);
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  if (n === -1) return 'ontem';
  return n > 0 ? `em ${n} dias` : `há ${-n} dias`;
};

// Busca todas as linhas em blocos de 1000 (limite do Supabase)
const paginar = async (montar) => {
  let todos = [];
  let de = 0;
  while (true) {
    const { data, error } = await montar().range(de, de + 999);
    if (error) throw error;
    todos = todos.concat(data || []);
    if (!data || data.length < 1000) break;
    de += 1000;
  }
  return todos;
};

const relUm = (rel) => (Array.isArray(rel) ? rel[0] : rel);

// ── Componente ────────────────────────────────────────────────────────────────
const CadastroSessao = ({ onSuccess }) => {
  const [graus, setGraus] = useState([]);
  const [classificacoes, setClassificacoes] = useState([]);
  const [sessoes, setSessoes] = useState([]);
  const [presencas, setPresencas] = useState({});        // { sessaoId: { total, presentes } }
  const [cronogramaAno, setCronogramaAno] = useState([]); // sessões previstas no Cronograma (ano filtrado)
  const [ultimaSessao, setUltimaSessao] = useState(null);
  const [proximaSessao, setProximaSessao] = useState(null);
  const [anosDisponiveis, setAnosDisponiveis] = useState([]);
  const [anoFiltro, setAnoFiltro] = useState(new Date().getFullYear());
  const [mesFiltro, setMesFiltro] = useState(0);
  const [grauFiltro, setGrauFiltro] = useState('');
  const [classFiltro, setClassFiltro] = useState('');
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });
  const [modalAberto, setModalAberto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editando, setEditando] = useState(null);
  const [existentesNaData, setExistentesNaData] = useState([]);
  const [confirmarDuplicada, setConfirmarDuplicada] = useState(false);
  const [excluindo, setExcluindo] = useState(null); // sessão aguardando confirmação de exclusão
  const [form, setForm] = useState({ dataSessao: '', grauSessao: '', classificacaoId: '', observacoes: '' });

  const hoje = hojeLocal();

  useEffect(() => { carregarGraus(); carregarClassificacoes(); }, []);
  useEffect(() => { carregarUltimaProxima(); }, []);
  useEffect(() => { carregarSessoes(); carregarCronograma(); }, [anoFiltro]);

  // Esc fecha o que estiver aberto (confirmação de exclusão primeiro)
  useEffect(() => {
    const aoTeclar = (e) => {
      if (e.key !== 'Escape') return;
      if (excluindo) setExcluindo(null);
      else if (modalAberto) fecharModal();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [excluindo, modalAberto]);

  // Sessões já cadastradas na data escolhida (aviso de duplicidade)
  useEffect(() => {
    if (!modalAberto || !form.dataSessao) { setExistentesNaData([]); return; }
    let cancelado = false;
    supabase.from('sessoes_presenca').select('id, grau_sessao_id').eq('data_sessao', form.dataSessao)
      .then(({ data }) => { if (!cancelado) setExistentesNaData(data || []); });
    return () => { cancelado = true; };
  }, [modalAberto, form.dataSessao]);

  // ── Carregamentos ───────────────────────────────────────────────────────────
  const carregarGraus = async () => {
    const { data } = await supabase.from('graus_sessao').select('*').order('grau_minimo_requerido');
    setGraus(data || []);
    if (data?.length > 0) setForm(f => ({ ...f, grauSessao: f.grauSessao || data[0].id }));
  };

  const carregarClassificacoes = async () => {
    const { data } = await supabase.from('classificacoes_sessao').select('*').order('nome');
    setClassificacoes(data || []);
  };

  const carregarUltimaProxima = async () => {
    try {
      const { data: ult } = await supabase
        .from('sessoes_presenca')
        .select('id, data_sessao, grau_sessao_id, graus_sessao:grau_sessao_id(nome), classificacoes_sessao:classificacao_id(nome)')
        .lte('data_sessao', hojeLocal())
        .order('data_sessao', { ascending: false })
        .limit(1);
      setUltimaSessao(ult?.[0] || null);

      const { data: prox } = await supabase
        .from('cronograma')
        .select('id, titulo, tipo, data_evento, grau_sessao_id, status')
        .like('tipo', 'sessao%')
        .gte('data_evento', hojeLocal())
        .order('data_evento', { ascending: true })
        .limit(20);
      setProximaSessao((prox || []).find(e => e.status !== 'cancelado') || null);
    } catch (e) {
      console.error('Erro ao carregar última/próxima sessão:', e);
    }
  };

  const carregarCronograma = async () => {
    try {
      const { data } = await supabase
        .from('cronograma')
        .select('id, titulo, tipo, data_evento, grau_sessao_id, status')
        .like('tipo', 'sessao%')
        .gte('data_evento', `${anoFiltro}-01-01`)
        .lte('data_evento', `${anoFiltro}-12-31`);
      setCronogramaAno((data || []).filter(e => e.status !== 'cancelado'));
    } catch (e) {
      console.error('Erro ao carregar o Cronograma:', e);
      setCronogramaAno([]);
    }
  };

  const carregarSessoes = async () => {
    // Anos disponíveis
    const { data: todos } = await supabase.from('sessoes_presenca').select('data_sessao');
    if (todos?.length) {
      const anos = [...new Set(todos.map(s => new Date(s.data_sessao + 'T00:00:00').getFullYear()))].sort((a, b) => b - a);
      setAnosDisponiveis(anos);
      if (!anos.includes(anoFiltro)) setAnoFiltro(anos[0]);
    }

    const { data } = await supabase
      .from('sessoes_presenca')
      .select('*, graus_sessao:grau_sessao_id(nome), classificacoes_sessao:classificacao_id(nome)')
      .gte('data_sessao', `${anoFiltro}-01-01`)
      .lte('data_sessao', `${anoFiltro}-12-31`)
      .order('data_sessao', { ascending: false });
    setSessoes(data || []);

    // Presença lançada por sessão
    try {
      const ids = (data || []).map(s => s.id);
      const mapa = {};
      if (ids.length > 0) {
        const regs = await paginar(() => supabase.from('registros_presenca').select('sessao_id, presente').in('sessao_id', ids));
        regs.forEach(r => {
          if (!mapa[r.sessao_id]) mapa[r.sessao_id] = { total: 0, presentes: 0 };
          mapa[r.sessao_id].total++;
          if (r.presente) mapa[r.sessao_id].presentes++;
        });
      }
      setPresencas(mapa);
    } catch (e) {
      console.error('Erro ao carregar presenças das sessões:', e);
      setPresencas({});
    }
  };

  // ── Dados derivados ─────────────────────────────────────────────────────────
  const porGrau = useMemo(() => {
    const lista = graus.map((g, idx) => ({
      id: g.id, nome: g.nome, cor: corGrau(g.id, idx),
      qtd: sessoes.filter(s => s.grau_sessao_id === g.id).length,
    }));
    return lista;
  }, [graus, sessoes]);

  const porClassificacao = useMemo(() => {
    const cont = {};
    sessoes.forEach(s => {
      const nome = relUm(s.classificacoes_sessao)?.nome || 'Sem classificação';
      cont[nome] = (cont[nome] || 0) + 1;
    });
    return Object.entries(cont).sort((a, b) => b[1] - a[1]);
  }, [sessoes]);

  const datasCadastradas = useMemo(() => new Set(sessoes.map(s => s.data_sessao)), [sessoes]);

  const pendenciasCronograma = useMemo(
    () => cronogramaAno
      .filter(e => e.data_evento < hoje && !datasCadastradas.has(e.data_evento))
      .sort((a, b) => b.data_evento.localeCompare(a.data_evento)),
    [cronogramaAno, datasCadastradas, hoje]
  );

  const semPresenca = useMemo(
    () => sessoes.filter(s => s.data_sessao < hoje && !(presencas[s.id]?.total > 0)),
    [sessoes, presencas, hoje]
  );

  const sessoesFiltradas = useMemo(() => sessoes.filter(s => {
    if (mesFiltro && parseInt(s.data_sessao.split('-')[1], 10) !== mesFiltro) return false;
    if (grauFiltro && String(s.grau_sessao_id) !== String(grauFiltro)) return false;
    if (classFiltro === '__sem') { if (relUm(s.classificacoes_sessao)?.nome) return false; }
    else if (classFiltro && String(s.classificacao_id) !== String(classFiltro)) return false;
    return true;
  }), [sessoes, mesFiltro, grauFiltro, classFiltro]);

  const gruposPorMes = useMemo(() => {
    const grupos = [];
    sessoesFiltradas.forEach(s => {
      const chave = s.data_sessao.slice(0, 7);
      const ult = grupos[grupos.length - 1];
      if (ult && ult.chave === chave) ult.itens.push(s);
      else grupos.push({ chave, mes: parseInt(chave.split('-')[1], 10), itens: [s] });
    });
    return grupos;
  }, [sessoesFiltradas]);

  const filtrosAtivos = !!(mesFiltro || grauFiltro || classFiltro);

  // ── Formulário ──────────────────────────────────────────────────────────────
  const abrirModalNovo = (preenchido = {}) => {
    setForm({
      dataSessao: preenchido.dataSessao || '',
      grauSessao: preenchido.grauSessao || graus[0]?.id || '',
      classificacaoId: preenchido.classificacaoId || '',
      observacoes: preenchido.observacoes || '',
    });
    setEditando(null);
    setConfirmarDuplicada(false);
    setMensagem({ tipo: '', texto: '' });
    setModalAberto(true);
  };

  // Cadastrar a partir de uma sessão prevista no Cronograma
  const cadastrarDoCronograma = (ev) => {
    const grauValido = ev.grau_sessao_id && ev.grau_sessao_id !== 4 && graus.some(g => g.id === ev.grau_sessao_id);
    const classMagna = ev.tipo === 'sessao_magna' ? classificacoes.find(c => /magna/i.test(c.nome)) : null;
    abrirModalNovo({
      dataSessao: ev.data_evento,
      grauSessao: grauValido ? ev.grau_sessao_id : undefined,
      classificacaoId: classMagna?.id || '',
      observacoes: ev.titulo || '',
    });
  };

  const abrirModalEditar = (sessao) => {
    setForm({
      dataSessao: sessao.data_sessao,
      grauSessao: sessao.grau_sessao_id,
      classificacaoId: sessao.classificacao_id || '',
      observacoes: sessao.observacoes || '',
    });
    setEditando(sessao.id);
    setConfirmarDuplicada(false);
    setMensagem({ tipo: '', texto: '' });
    setModalAberto(true);
  };

  const fecharModal = () => { setModalAberto(false); setEditando(null); };

  const duplicada = existentesNaData.some(e => e.grau_sessao_id === form.grauSessao && e.id !== editando);
  const outraNoDia = !duplicada && existentesNaData.some(e => e.id !== editando);
  const dataFutura = !!form.dataSessao && form.dataSessao > hoje;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.dataSessao) { setMensagem({ tipo: 'erro', texto: 'Informe a data da sessão.' }); return; }
    if (duplicada && !confirmarDuplicada) {
      setMensagem({ tipo: 'erro', texto: 'Já existe uma sessão com esta data e grau. Marque "Cadastrar mesmo assim" para continuar.' });
      return;
    }
    setLoading(true);
    try {
      const payload = {
        data_sessao: form.dataSessao,
        grau_sessao_id: form.grauSessao,
        classificacao_id: form.classificacaoId || null,
        observacoes: form.observacoes || null,
      };
      if (editando) {
        const { error } = await supabase.from('sessoes_presenca').update(payload).eq('id', editando);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('sessoes_presenca').insert([payload]);
        if (error) throw error;
      }
      setMensagem({ tipo: 'sucesso', texto: editando ? 'Sessão atualizada!' : 'Sessão cadastrada!' });
      carregarSessoes();
      carregarCronograma();
      carregarUltimaProxima();
      setTimeout(() => { fecharModal(); if (onSuccess) onSuccess(); }, 900);
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: err.message || 'Erro ao salvar sessão.' });
    } finally {
      setLoading(false);
    }
  };

  const excluirSessao = async () => {
    const alvo = excluindo;
    if (!alvo) return;
    setExcluindo(null);
    const { error } = await supabase.from('sessoes_presenca').delete().eq('id', alvo.id);
    if (error) { setMensagem({ tipo: 'erro', texto: 'Erro ao excluir sessão.' }); return; }
    setMensagem({ tipo: 'sucesso', texto: 'Sessão excluída com sucesso!' });
    carregarSessoes();
    carregarCronograma();
    carregarUltimaProxima();
  };

  // ── Estilos ─────────────────────────────────────────────────────────────────
  const inp = {
    width: '100%', height: '2.5rem', padding: '0 0.85rem', borderRadius: 'var(--radius-md)',
    background: 'var(--color-bg)', color: 'var(--color-text)',
    border: '1px solid var(--color-border-light)', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box',
  };
  const lbl = {
    fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem', display: 'block',
  };
  const cartao = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)' };
  const rotuloCartao = { margin: 0, fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' };
  const filtroSel = { height: '2.2rem', padding: '0 0.65rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-light)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' };
  const pilula = (bg, cor, borda) => ({ fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.6rem', borderRadius: '999px', background: bg, color: cor, border: `1px solid ${borda}`, whiteSpace: 'nowrap' });

  const MensagemBox = ({ pequeno }) => (
    <div style={{
      padding: pequeno ? '0.65rem 0.9rem' : '0.75rem 1rem', borderRadius: 'var(--radius-lg)',
      fontSize: pequeno ? '0.82rem' : '0.85rem', fontWeight: '600',
      background: mensagem.tipo === 'sucesso' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
      color: mensagem.tipo === 'sucesso' ? '#10b981' : '#ef4444',
      border: `1px solid ${mensagem.tipo === 'sucesso' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
    }}>
      {mensagem.tipo === 'sucesso' ? '✅' : '❌'} {mensagem.texto}
    </div>
  );

  const totalSessoes = sessoes.length;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '1.5rem', background: 'var(--color-bg)', minHeight: '100vh' }}>

      {/* ── Cabeçalho ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>📋 Sessões</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: '0.2rem 0 0' }}>
            Cadastro das sessões realizadas pela Loja
          </p>
        </div>
        <button onClick={() => abrirModalNovo()} style={{
          height: '2.6rem', padding: '0 1.2rem', background: 'var(--color-accent)', color: '#fff',
          border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, fontSize: '0.875rem',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.45rem',
        }}>
          ➕ Nova Sessão
        </button>
      </div>

      {/* ── Informativos ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">

        {/* Sessões no ano, por grau */}
        <div style={{ ...cartao, borderTop: '3px solid var(--color-accent)', padding: '1rem 1.1rem', minWidth: 0 }}>
          <p style={rotuloCartao}>Sessões em {anoFiltro}</p>
          <p style={{ margin: '0.25rem 0 0.6rem', fontSize: '2rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.1 }}>{totalSessoes}</p>
          {totalSessoes > 0 && (
            <div style={{ display: 'flex', height: 8, borderRadius: 999, overflow: 'hidden', background: 'var(--color-border)', marginBottom: '0.6rem' }}>
              {porGrau.filter(g => g.qtd > 0).map(g => (
                <div key={g.id} title={`${g.nome}: ${g.qtd}`} style={{ width: `${(g.qtd / totalSessoes) * 100}%`, background: g.cor }} />
              ))}
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {porGrau.map(g => (
              <span key={g.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.55rem', borderRadius: 999, background: 'var(--color-surface-2)', border: '1px solid var(--color-border-light)', color: 'var(--color-text-muted)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: g.cor }} />
                {g.nome} <strong style={{ color: 'var(--color-text)' }}>{g.qtd}</strong>
              </span>
            ))}
          </div>
        </div>

        {/* Por classificação */}
        <div style={{ ...cartao, borderTop: '3px solid #8b5cf6', padding: '1rem 1.1rem', minWidth: 0 }}>
          <p style={rotuloCartao}>Por classificação</p>
          {porClassificacao.length === 0 ? (
            <p style={{ margin: '0.75rem 0 0', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>Nenhuma sessão em {anoFiltro}</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.75rem' }}>
              {porClassificacao.map(([nome, qtd]) => {
                const [bg, cor, bd] = corClassificacao(nome);
                return <span key={nome} style={pilula(bg, cor, bd)}>{nome} · {qtd}</span>;
              })}
            </div>
          )}
        </div>

        {/* Última sessão */}
        <div style={{ ...cartao, borderTop: '3px solid #10b981', padding: '1rem 1.1rem', minWidth: 0 }}>
          <p style={rotuloCartao}>Última sessão</p>
          {ultimaSessao ? (
            <>
              <p style={{ margin: '0.25rem 0 0', fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.2 }}>{fmtBR(ultimaSessao.data_sessao)}</p>
              <p style={{ margin: '0.15rem 0 0.5rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                {diaSemana(ultimaSessao.data_sessao)} · {relativo(ultimaSessao.data_sessao, hoje)}
              </p>
              <span style={pilula(`${corGrau(ultimaSessao.grau_sessao_id)}22`, corGrau(ultimaSessao.grau_sessao_id), `${corGrau(ultimaSessao.grau_sessao_id)}55`)}>
                {relUm(ultimaSessao.graus_sessao)?.nome || '—'}
              </span>
            </>
          ) : (
            <p style={{ margin: '0.75rem 0 0', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>Nenhuma sessão cadastrada</p>
          )}
        </div>

        {/* Próxima sessão (Cronograma) */}
        <div style={{ ...cartao, borderTop: '3px solid #f59e0b', padding: '1rem 1.1rem', minWidth: 0 }}>
          <p style={rotuloCartao}>Próxima sessão · Cronograma</p>
          {proximaSessao ? (
            <>
              <p style={{ margin: '0.25rem 0 0', fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.2 }}>{fmtBR(proximaSessao.data_evento)}</p>
              <p style={{ margin: '0.15rem 0 0.5rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                {diaSemana(proximaSessao.data_evento)} · {relativo(proximaSessao.data_evento, hoje)}
              </p>
              {proximaSessao.titulo && (
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={proximaSessao.titulo}>
                  {proximaSessao.titulo}
                </p>
              )}
            </>
          ) : (
            <p style={{ margin: '0.75rem 0 0', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>Nenhuma sessão futura no Cronograma</p>
          )}
        </div>
      </div>

      {/* ── Avisos ────────────────────────────────────────────────── */}
      {(pendenciasCronograma.length > 0 || semPresenca.length > 0) && (
        <div style={{ ...cartao, borderLeft: '4px solid #f59e0b', padding: '0.9rem 1.1rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {pendenciasCronograma.length > 0 && (
            <div>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)' }}>
                📅 {pendenciasCronograma.length} sessão(ões) do Cronograma já passaram e ainda não foram cadastradas
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {pendenciasCronograma.slice(0, 5).map(ev => (
                  <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', padding: '0.45rem 0.7rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}>{fmtBR(ev.data_evento)}</strong>
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{DIAS_ABREV[new Date(ev.data_evento + 'T00:00:00').getDay()]}</span>
                    <span style={{ flex: 1, minWidth: 120, fontSize: '0.8rem', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.titulo || 'Sessão'}</span>
                    <button onClick={() => cadastrarDoCronograma(ev)} style={{ height: '1.9rem', padding: '0 0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-accent)', background: 'transparent', color: 'var(--color-accent)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                      Cadastrar
                    </button>
                  </div>
                ))}
                {pendenciasCronograma.length > 5 && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>… e mais {pendenciasCronograma.length - 5}</span>
                )}
              </div>
            </div>
          )}
          {semPresenca.length > 0 && (
            <div>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)' }}>
                ⚠️ {semPresenca.length} sessão(ões) cadastrada(s) sem presença lançada
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {semPresenca.slice(0, 8).map(s => (
                  <span key={s.id} style={pilula('rgba(245,158,11,0.14)', '#f59e0b', 'rgba(245,158,11,0.35)')}>{fmtBR(s.data_sessao)}</span>
                ))}
                {semPresenca.length > 8 && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', alignSelf: 'center' }}>… e mais {semPresenca.length - 8}</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Mensagem global ───────────────────────────────────────── */}
      {!modalAberto && mensagem.texto && <div style={{ marginBottom: '1rem' }}><MensagemBox /></div>}

      {/* ── Lista ─────────────────────────────────────────────────── */}
      <div style={{ ...cartao, overflow: 'hidden' }}>

        {/* Filtros */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 1.25rem', background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
          <select value={anoFiltro} onChange={e => setAnoFiltro(Number(e.target.value))} style={filtroSel} aria-label="Ano">
            {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={mesFiltro} onChange={e => setMesFiltro(Number(e.target.value))} style={filtroSel} aria-label="Mês">
            <option value={0}>Todos os meses</option>
            {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select value={grauFiltro} onChange={e => setGrauFiltro(e.target.value)} style={filtroSel} aria-label="Grau">
            <option value="">Todos os graus</option>
            {graus.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
          </select>
          <select value={classFiltro} onChange={e => setClassFiltro(e.target.value)} style={filtroSel} aria-label="Classificação">
            <option value="">Todas as classificações</option>
            {classificacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            <option value="__sem">Sem classificação</option>
          </select>
          {filtrosAtivos && (
            <button onClick={() => { setMesFiltro(0); setGrauFiltro(''); setClassFiltro(''); }} style={{ background: 'none', border: 'none', color: 'var(--color-accent)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
              Limpar filtros
            </button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            {filtrosAtivos ? `${sessoesFiltradas.length} de ${rotuloSessoes(totalSessoes)}` : rotuloSessoes(totalSessoes)}
          </span>
        </div>

        {/* Linhas agrupadas por mês */}
        {sessoesFiltradas.length === 0 ? (
          <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            <p style={{ fontSize: '2rem', margin: '0 0 0.5rem' }}>📭</p>
            {totalSessoes === 0 ? `Nenhuma sessão cadastrada em ${anoFiltro}.` : 'Nenhuma sessão com esses filtros.'}
            {totalSessoes === 0 && (
              <div style={{ marginTop: '1rem' }}>
                <button onClick={() => abrirModalNovo()} style={{ height: '2.3rem', padding: '0 1rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 700, cursor: 'pointer' }}>➕ Cadastrar a primeira sessão</button>
              </div>
            )}
          </div>
        ) : gruposPorMes.map(grupo => (
          <div key={grupo.chave}>
            <div style={{ padding: '0.45rem 1.25rem', background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {MESES[grupo.mes - 1]} de {grupo.chave.slice(0, 4)} · {rotuloSessoes(grupo.itens.length)}
            </div>
            {grupo.itens.map(s => {
              const [bgCl, txtCl, bdCl] = corClassificacao(relUm(s.classificacoes_sessao)?.nome);
              const cg = corGrau(s.grau_sessao_id);
              const d = new Date(s.data_sessao + 'T00:00:00');
              const pres = presencas[s.id];
              const futura = s.data_sessao > hoje;
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', padding: '0.7rem 1.25rem', borderBottom: '1px solid var(--color-border)' }}>
                  {/* Bloco de calendário */}
                  <div style={{ width: 54, flexShrink: 0, textAlign: 'center', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--color-bg)' }}>
                    <div style={{ background: cg, color: '#fff', fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.06em', padding: '0.1rem 0' }}>{MESES_ABREV[d.getMonth()]}</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.15 }}>{pad(d.getDate())}</div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', paddingBottom: '0.15rem' }}>{DIAS_ABREV[d.getDay()]}</div>
                  </div>

                  {/* Grau, classificação e observação */}
                  <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={pilula(`${cg}22`, cg, `${cg}55`)}>{relUm(s.graus_sessao)?.nome || '—'}</span>
                      {relUm(s.classificacoes_sessao)?.nome
                        ? <span style={pilula(bgCl, txtCl, bdCl)}>{relUm(s.classificacoes_sessao).nome}</span>
                        : <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Sem classificação</span>}
                    </div>
                    {s.observacoes && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '0.3rem 0 0', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                        💬 {s.observacoes}
                      </p>
                    )}
                  </div>

                  {/* Presença lançada */}
                  <div style={{ flexShrink: 0 }}>
                    {futura ? (
                      <span style={pilula('var(--color-surface-2)', 'var(--color-text-muted)', 'var(--color-border-light)')}>🗓 Agendada</span>
                    ) : pres?.total > 0 ? (
                      <span style={pilula('rgba(16,185,129,0.14)', '#10b981', 'rgba(16,185,129,0.35)')}>✓ Presença lançada · {pres.presentes}/{pres.total}</span>
                    ) : (
                      <span style={pilula('rgba(245,158,11,0.14)', '#f59e0b', 'rgba(245,158,11,0.35)')}>⚠ Sem presença lançada</span>
                    )}
                  </div>

                  {/* Ações */}
                  <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                    <button onClick={() => abrirModalEditar(s)} title="Editar sessão" aria-label="Editar sessão" style={{ width: '2rem', height: '2rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-light)', background: 'var(--color-bg)', cursor: 'pointer', fontSize: '0.9rem' }}>✏️</button>
                    <button onClick={() => setExcluindo(s)} title="Excluir sessão" aria-label="Excluir sessão" style={{ width: '2rem', height: '2rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.1)', cursor: 'pointer', fontSize: '0.9rem' }}>🗑️</button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── MODAL: nova / editar sessão ───────────────────────────── */}
      {modalAberto && (
        <div onClick={fecharModal} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)', borderTop: '3px solid var(--color-accent)', width: '100%', maxWidth: '520px', maxHeight: '94vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.4)' }}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.1rem 1.4rem', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.3rem' }}>📋</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)' }}>{editando ? 'Editar Sessão' : 'Nova Sessão'}</h3>
                  <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>{editando ? 'Atualize os dados da sessão' : 'Preencha os dados para cadastrar'}</p>
                </div>
              </div>
              <button onClick={fecharModal} aria-label="Fechar" style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.4rem', cursor: 'pointer', padding: '0.2rem 0.5rem' }}>×</button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '1.4rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              {mensagem.texto && <MensagemBox pequeno />}

              {/* Data */}
              <div>
                <label style={lbl}>Data da Sessão *</label>
                <input type="date" required value={form.dataSessao} onChange={e => { setForm(f => ({ ...f, dataSessao: e.target.value })); setConfirmarDuplicada(false); }} style={inp} />
                {form.dataSessao && (
                  <p style={{ margin: '0.35rem 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                    {diaSemana(form.dataSessao)}{dataFutura ? ' · data futura (a sessão ficará agendada)' : ''}
                  </p>
                )}
                {outraNoDia && (
                  <p style={{ margin: '0.35rem 0 0', fontSize: '0.78rem', color: '#f59e0b' }}>ℹ️ Já existe outra sessão cadastrada neste dia (de outro grau).</p>
                )}
                {duplicada && (
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginTop: '0.5rem', padding: '0.55rem 0.7rem', borderRadius: 'var(--radius-md)', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)', fontSize: '0.8rem', color: 'var(--color-text)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={confirmarDuplicada} onChange={e => setConfirmarDuplicada(e.target.checked)} style={{ marginTop: '0.15rem' }} />
                    <span>⚠️ Já existe uma sessão com esta data e grau. <strong>Cadastrar mesmo assim</strong></span>
                  </label>
                )}
              </div>

              {/* Grau */}
              <div>
                <label style={lbl}>Grau da Sessão *</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {graus.map((g, idx) => {
                    const ativo = form.grauSessao === g.id;
                    const cor = corGrau(g.id, idx);
                    return (
                      <button type="button" key={g.id} onClick={() => { setForm(f => ({ ...f, grauSessao: g.id })); setConfirmarDuplicada(false); }}
                        style={{ flex: '1 1 110px', height: '2.5rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700,
                          border: `1px solid ${ativo ? cor : 'var(--color-border-light)'}`, background: ativo ? `${cor}26` : 'var(--color-bg)', color: ativo ? cor : 'var(--color-text-muted)' }}>
                        {g.nome}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Classificação */}
              <div>
                <label style={lbl}>Classificação</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {[{ id: '', nome: 'Sem classificação' }, ...classificacoes].map(c => {
                    const ativo = String(form.classificacaoId) === String(c.id);
                    const [bg, cor, bd] = c.id === '' ? ['var(--color-surface-2)', 'var(--color-text)', 'var(--color-border-light)'] : corClassificacao(c.nome);
                    return (
                      <button type="button" key={c.id === '' ? 'sem' : c.id} onClick={() => setForm(f => ({ ...f, classificacaoId: c.id }))}
                        style={{ height: '2.2rem', padding: '0 0.9rem', borderRadius: '999px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700,
                          border: `1px solid ${ativo ? cor : 'var(--color-border-light)'}`, background: ativo ? bg : 'var(--color-bg)', color: ativo ? cor : 'var(--color-text-muted)' }}>
                        {c.nome}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Observações */}
              <div>
                <label style={lbl}>Observações</label>
                <textarea rows={3} placeholder="Observações opcionais..." value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} style={{ ...inp, height: 'auto', padding: '0.6rem 0.85rem', resize: 'vertical', fontFamily: 'inherit' }} />
              </div>

              <div style={{ display: 'flex', gap: '0.65rem', paddingTop: '0.25rem' }}>
                <button type="button" onClick={fecharModal} style={{ flex: 1, height: '2.6rem', background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={loading || (duplicada && !confirmarDuplicada)} style={{ flex: 2, height: '2.6rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '0.875rem', cursor: loading ? 'wait' : 'pointer', opacity: (loading || (duplicada && !confirmarDuplicada)) ? 0.55 : 1 }}>
                  {loading ? 'Salvando...' : editando ? '✏️ Atualizar Sessão' : '✅ Cadastrar Sessão'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: confirmar exclusão ─────────────────────────────── */}
      {excluindo && (() => {
        const pres = presencas[excluindo.id];
        return (
          <div onClick={() => setExcluindo(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)', borderTop: '3px solid #ef4444', width: '100%', maxWidth: '440px', padding: '1.4rem', boxShadow: '0 25px 50px rgba(0,0,0,0.4)' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)' }}>🗑️ Excluir sessão?</h3>
              <p style={{ margin: '0.75rem 0 0', fontSize: '0.9rem', color: 'var(--color-text)' }}>
                <strong>{fmtBR(excluindo.data_sessao)}</strong> · {diaSemana(excluindo.data_sessao)} · {relUm(excluindo.graus_sessao)?.nome || '—'}
              </p>
              {pres?.total > 0 ? (
                <div style={{ marginTop: '0.75rem', padding: '0.65rem 0.8rem', borderRadius: 'var(--radius-md)', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', fontSize: '0.82rem', color: 'var(--color-text)' }}>
                  ⚠️ Esta sessão tem <strong>{pres.total} registros de presença</strong> lançados ({pres.presentes} presentes). A exclusão pode apagá-los junto e isso afeta os relatórios e o Dashboard de Presença.
                </div>
              ) : (
                <p style={{ margin: '0.75rem 0 0', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>Nenhuma presença foi lançada para esta sessão.</p>
              )}
              <div style={{ display: 'flex', gap: '0.65rem', marginTop: '1.25rem' }}>
                <button onClick={() => setExcluindo(null)} style={{ flex: 1, height: '2.6rem', background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={excluirSessao} style={{ flex: 1, height: '2.6rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 700, cursor: 'pointer' }}>
                  {pres?.total > 0 ? 'Excluir mesmo assim' : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default CadastroSessao;
