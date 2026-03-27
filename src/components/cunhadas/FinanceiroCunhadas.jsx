/**
 * FINANCEIRO CUNHADAS
 * Dashboard, lançamentos (individual e em lote), quitações,
 * mensalidades, extrato e filtros completos.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmtMoeda = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtData = (d) => {
  if (!d) return '—';
  const [y, m, dia] = d.split('-');
  return `${dia}/${m}/${y}`;
};

const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];

const HOJE = new Date();

const FORMAS_PAGAMENTO = [
  { value: 'dinheiro',      label: '💵 Dinheiro' },
  { value: 'pix',           label: '📱 PIX' },
  { value: 'transferencia', label: '🏦 Transferência' },
  { value: 'debito',        label: '💳 Débito' },
  { value: 'credito',       label: '💳 Crédito' },
  { value: 'cheque',        label: '📝 Cheque' },
];

const FORM_VAZIO = {
  tipo: 'receita',
  categoria_id: '',
  descricao: '',
  valor: '',
  data_lancamento: HOJE.toISOString().slice(0, 10),
  data_vencimento: '',
  cunhada_id: '',
  pago: false,
  forma_pagamento: '',
  observacoes: '',
};

const LOTE_VAZIO = {
  categoria_id: '',
  descricao: '',
  valor: '',
  data_lancamento: HOJE.toISOString().slice(0, 10),
  data_vencimento: '',
  forma_pagamento: '',
  cunhadas_selecionadas: [],
  eh_mensalidade: false,
};

// ─── Estilos base ──────────────────────────────────────────────────────────────
const s = {
  input:    { width: '100%', padding: '0.65rem 0.9rem', background: 'var(--color-surface-2)', border: '2px solid var(--color-border)', borderRadius: 'var(--radius-lg)', color: 'var(--color-text)', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-sans)' },
  select:   { width: '100%', padding: '0.65rem 0.9rem', background: 'var(--color-surface-2)', border: '2px solid var(--color-border)', borderRadius: 'var(--radius-lg)', color: 'var(--color-text)', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' },
  textarea: { width: '100%', padding: '0.65rem 0.9rem', background: 'var(--color-surface-2)', border: '2px solid var(--color-border)', borderRadius: 'var(--radius-lg)', color: 'var(--color-text)', fontSize: '0.875rem', outline: 'none', resize: 'vertical', minHeight: '70px', boxSizing: 'border-box', fontFamily: 'var(--font-sans)' },
  card:     { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' },
  overlay:  { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' },
  modal:    { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-2xl)', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-xl)' },
  modalLg:  { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-2xl)', width: '100%', maxWidth: '860px', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-xl)' },
  mHead:    { padding: '1.25rem 1.75rem', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 1 },
  mBody:    { padding: '1.5rem 1.75rem' },
  mFoot:    { padding: '1rem 1.75rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', position: 'sticky', bottom: 0, background: 'var(--color-surface)' },
  btnPrimary: (cor) => ({ background: cor, color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', padding: '0.6rem 1.25rem', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }),
  btnSec:   { padding: '0.6rem 1.25rem', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', color: 'var(--color-text-muted)', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer' },
  navBtn:   (active) => ({ padding: '0.55rem 1.1rem', borderRadius: 'var(--radius-lg)', border: '1px solid', borderColor: active ? 'var(--color-accent)' : 'var(--color-border)', background: active ? 'var(--color-accent-bg)' : 'var(--color-surface)', color: active ? 'var(--color-accent)' : 'var(--color-text-muted)', fontWeight: active ? '600' : '400', fontSize: '0.85rem', cursor: 'pointer' }),
  badge:    (pago) => ({ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: '600', background: pago ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)', color: pago ? '#10b981' : '#f59e0b', border: `1px solid ${pago ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}` }),
  infoBox:  { background: 'var(--color-accent-bg)', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-lg)', padding: '0.875rem 1rem' },
};

// ─── Campo helper ──────────────────────────────────────────────────────────────
const Campo = ({ label, children, style }) => (
  <div style={style}>
    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {label}
    </label>
    {children}
  </div>
);

// ─── Navegador de mês ──────────────────────────────────────────────────────────
const NavMes = ({ mes, ano, onChange }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
    <button onClick={() => { let m = mes - 1, a = ano; if (m < 1) { m = 12; a--; } onChange(m, a); }}
      style={{ ...s.btnSec, padding: '0.4rem 0.7rem' }}>‹</button>
    <span style={{ fontWeight: '600', color: 'var(--color-text)', minWidth: '140px', textAlign: 'center' }}>
      {MESES[mes - 1]} {ano}
    </span>
    <button onClick={() => { let m = mes + 1, a = ano; if (m > 12) { m = 1; a++; } onChange(m, a); }}
      style={{ ...s.btnSec, padding: '0.4rem 0.7rem' }}>›</button>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export const FinanceiroCunhadas = ({ userData }) => {

  // ── aba ativa ──────────────────────────────────────────────────────────────
  const [aba, setAba] = useState('dashboard');

  // ── dados ──────────────────────────────────────────────────────────────────
  const [lancamentos, setLancamentos]   = useState([]);
  const [mensalidades, setMensalidades] = useState([]);
  const [cunhadas, setCunhadas]         = useState([]);
  const [categorias, setCategorias]     = useState([]);
  const [config, setConfig]             = useState({ valor_mensalidade: '50.00', dia_vencimento: '10' });
  const [loading, setLoading]           = useState(true);
  const [msg, setMsg]                   = useState({ tipo: '', texto: '' });

  // ── filtros lançamentos ────────────────────────────────────────────────────
  const [filtroTipo, setFiltroTipo]       = useState('todos');
  const [filtroMes, setFiltroMes]         = useState(HOJE.getMonth() + 1);
  const [filtroAno, setFiltroAno]         = useState(HOJE.getFullYear());
  const [filtroStatus, setFiltroStatus]   = useState('todos');
  const [filtroCunhada, setFiltroCunhada] = useState('');

  // ── filtros mensalidades ───────────────────────────────────────────────────
  const [mesMens, setMesMens] = useState(HOJE.getMonth() + 1);
  const [anoMens, setAnoMens] = useState(HOJE.getFullYear());

  // ── modal lançamento individual ────────────────────────────────────────────
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId]   = useState(null);
  const [form, setForm]               = useState(FORM_VAZIO);
  const [salvando, setSalvando]       = useState(false);

  // ── modal lançamento em lote ───────────────────────────────────────────────
  const [modalLote, setModalLote]       = useState(false);
  const [formLote, setFormLote]         = useState(LOTE_VAZIO);
  const [salvandoLote, setSalvandoLote] = useState(false);

  // ── modal quitação individual ──────────────────────────────────────────────
  const [modalQuitacao, setModalQuitacao] = useState(null); // recebe o lançamento
  const [quitacaoForm, setQuitacaoForm]   = useState({ data_pagamento: HOJE.toISOString().slice(0, 10), forma_pagamento: 'dinheiro', observacoes: '' });
  const [salvandoQuitacao, setSalvandoQuitacao] = useState(false);

  // ── modal quitação em lote ─────────────────────────────────────────────────
  const [modalQuitacaoLote, setModalQuitacaoLote]       = useState(false);
  const [selecionadosQuitacao, setSelecionadosQuitacao] = useState([]);
  const [quitacaoLoteForm, setQuitacaoLoteForm]         = useState({ data_pagamento: HOJE.toISOString().slice(0, 10), forma_pagamento: 'dinheiro' });
  const [salvandoQuitacaoLote, setSalvandoQuitacaoLote] = useState(false);

  // ── modal config mensalidade ───────────────────────────────────────────────
  const [modalConfig, setModalConfig]       = useState(false);
  const [configForm, setConfigForm]         = useState({ valor_mensalidade: '', dia_vencimento: '' });
  const [salvandoConfig, setSalvandoConfig] = useState(false);

  // ── modal excluir ──────────────────────────────────────────────────────────
  const [modalExcluir, setModalExcluir] = useState(null);

  // ─── Carregar dados ────────────────────────────────────────────────────────
  const carregarTudo = useCallback(async () => {
    setLoading(true);
    try {
      const [
        { data: lanc },
        { data: mens },
        { data: cunh },
        { data: cats },
        { data: cfgs },
      ] = await Promise.all([
        supabase.from('financeiro_cunhadas')
          .select('*, categoria:categorias_financeiras_cunhadas(nome), cunhada:cunhadas(nome)')
          .order('data_lancamento', { ascending: false }),
        supabase.from('mensalidades_cunhadas')
          .select('*, cunhada:cunhadas(nome)')
          .order('ano', { ascending: false })
          .order('mes', { ascending: false }),
        supabase.from('cunhadas').select('id, nome').eq('ativa', true).order('nome'),
        supabase.from('categorias_financeiras_cunhadas').select('*').eq('ativo', true).order('nome'),
        supabase.from('configuracoes_cunhadas').select('*'),
      ]);

      setLancamentos(lanc || []);
      setMensalidades(mens || []);
      setCunhadas(cunh || []);
      setCategorias(cats || []);

      if (cfgs) {
        const obj = {};
        cfgs.forEach((c) => (obj[c.chave] = c.valor));
        setConfig(obj);
        setConfigForm({
          valor_mensalidade: obj.valor_mensalidade || '50.00',
          dia_vencimento: obj.dia_vencimento || '10',
        });
      }
    } catch (err) {
      mostrarMsg('erro', 'Erro ao carregar dados: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregarTudo(); }, [carregarTudo]);

  // ─── Filtros ───────────────────────────────────────────────────────────────
  const lancamentosFiltrados = lancamentos.filter((l) => {
    const [y, m] = l.data_lancamento.split('-');
    const mesOk     = parseInt(m) === filtroMes && parseInt(y) === filtroAno;
    const tipoOk    = filtroTipo === 'todos' || l.tipo === filtroTipo;
    const statusOk  = filtroStatus === 'todos' || (filtroStatus === 'pago' ? l.pago : !l.pago);
    const cunhadaOk = !filtroCunhada || l.cunhada_id === filtroCunhada;
    return mesOk && tipoOk && statusOk && cunhadaOk;
  });

  const mensalidadesMes = mensalidades.filter((m) => m.mes === mesMens && m.ano === anoMens);

  // ─── Stats ─────────────────────────────────────────────────────────────────
  const lancMes = lancamentos.filter((l) => {
    const [y, m] = l.data_lancamento.split('-');
    return parseInt(m) === HOJE.getMonth() + 1 && parseInt(y) === HOJE.getFullYear();
  });
  const receitasMes  = lancMes.filter((l) => l.tipo === 'receita').reduce((s, l) => s + Number(l.valor), 0);
  const despesasMes  = lancMes.filter((l) => l.tipo === 'despesa').reduce((s, l) => s + Number(l.valor), 0);
  const saldoMes     = receitasMes - despesasMes;
  const totalReceitas = lancamentos.filter((l) => l.tipo === 'receita').reduce((s, l) => s + Number(l.valor), 0);
  const totalDespesas = lancamentos.filter((l) => l.tipo === 'despesa').reduce((s, l) => s + Number(l.valor), 0);
  const pendentesCount = lancamentos.filter((l) => !l.pago).length;
  const pendentesValor = lancamentos.filter((l) => !l.pago).reduce((s, l) => s + Number(l.valor), 0);

  // ─── Salvar lançamento individual ──────────────────────────────────────────
  const salvarLancamento = async () => {
    if (!form.descricao.trim()) { mostrarMsg('erro', 'Descrição obrigatória.'); return; }
    if (!form.valor || isNaN(parseFloat(form.valor))) { mostrarMsg('erro', 'Valor inválido.'); return; }
    setSalvando(true);
    try {
      const payload = {
        ...form,
        valor: parseFloat(form.valor.toString().replace(',', '.')),
        cunhada_id: form.cunhada_id || null,
        categoria_id: form.categoria_id || null,
        data_vencimento: form.data_vencimento || null,
        forma_pagamento: form.forma_pagamento || null,
      };
      if (editandoId) {
        const { error } = await supabase.from('financeiro_cunhadas').update(payload).eq('id', editandoId);
        if (error) throw error;
        mostrarMsg('sucesso', 'Lançamento atualizado!');
      } else {
        const { error } = await supabase.from('financeiro_cunhadas').insert([payload]);
        if (error) throw error;
        mostrarMsg('sucesso', 'Lançamento registrado!');
      }
      fecharModalLancamento();
      carregarTudo();
    } catch (err) {
      mostrarMsg('erro', 'Erro ao salvar: ' + err.message);
    } finally {
      setSalvando(false);
    }
  };

  // ─── Salvar lançamento em lote ─────────────────────────────────────────────
  const salvarLote = async () => {
    if (formLote.cunhadas_selecionadas.length === 0) { mostrarMsg('erro', 'Selecione ao menos uma cunhada.'); return; }
    if (!formLote.descricao.trim()) { mostrarMsg('erro', 'Descrição obrigatória.'); return; }
    if (!formLote.valor || isNaN(parseFloat(formLote.valor))) { mostrarMsg('erro', 'Valor inválido.'); return; }

    setSalvandoLote(true);
    try {
      const registros = formLote.cunhadas_selecionadas.map((cid) => ({
        tipo: 'receita',
        categoria_id: formLote.categoria_id || null,
        descricao: formLote.descricao,
        valor: parseFloat(formLote.valor),
        data_lancamento: formLote.data_lancamento,
        data_vencimento: formLote.data_vencimento || null,
        forma_pagamento: formLote.forma_pagamento || null,
        cunhada_id: cid,
        pago: false,
        observacoes: null,
      }));

      const { error } = await supabase.from('financeiro_cunhadas').insert(registros);
      if (error) throw error;

      mostrarMsg('sucesso', `${registros.length} lançamento(s) criados com sucesso!`);
      setModalLote(false);
      setFormLote(LOTE_VAZIO);
      carregarTudo();
    } catch (err) {
      mostrarMsg('erro', 'Erro ao criar lançamentos: ' + err.message);
    } finally {
      setSalvandoLote(false);
    }
  };

  // ─── Quitação individual ───────────────────────────────────────────────────
  const abrirQuitacao = (lancamento) => {
    setModalQuitacao(lancamento);
    setQuitacaoForm({
      data_pagamento: HOJE.toISOString().slice(0, 10),
      forma_pagamento: lancamento.forma_pagamento || 'dinheiro',
      observacoes: '',
    });
  };

  const confirmarQuitacao = async () => {
    if (!modalQuitacao) return;
    setSalvandoQuitacao(true);
    try {
      const { error } = await supabase
        .from('financeiro_cunhadas')
        .update({ pago: true, forma_pagamento: quitacaoForm.forma_pagamento, observacoes: quitacaoForm.observacoes || null })
        .eq('id', modalQuitacao.id);
      if (error) throw error;
      mostrarMsg('sucesso', 'Lançamento quitado!');
      setModalQuitacao(null);
      carregarTudo();
    } catch (err) {
      mostrarMsg('erro', 'Erro: ' + err.message);
    } finally {
      setSalvandoQuitacao(false);
    }
  };

  const desfazerQuitacao = async (id) => {
    try {
      const { error } = await supabase.from('financeiro_cunhadas').update({ pago: false, forma_pagamento: null }).eq('id', id);
      if (error) throw error;
      mostrarMsg('sucesso', 'Quitação desfeita.');
      carregarTudo();
    } catch (err) {
      mostrarMsg('erro', 'Erro: ' + err.message);
    }
  };

  // ─── Quitação em lote ──────────────────────────────────────────────────────
  const toggleSelecionadoQuitacao = (id) => {
    setSelecionadosQuitacao((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selecionarTodosPendentes = () => {
    const pendentes = lancamentosFiltrados.filter((l) => !l.pago).map((l) => l.id);
    setSelecionadosQuitacao(pendentes);
  };

  const confirmarQuitacaoLote = async () => {
    if (selecionadosQuitacao.length === 0) { mostrarMsg('erro', 'Selecione ao menos um lançamento.'); return; }
    setSalvandoQuitacaoLote(true);
    try {
      const { error } = await supabase
        .from('financeiro_cunhadas')
        .update({ pago: true, forma_pagamento: quitacaoLoteForm.forma_pagamento })
        .in('id', selecionadosQuitacao);
      if (error) throw error;
      mostrarMsg('sucesso', `${selecionadosQuitacao.length} lançamento(s) quitados!`);
      setModalQuitacaoLote(false);
      setSelecionadosQuitacao([]);
      carregarTudo();
    } catch (err) {
      mostrarMsg('erro', 'Erro: ' + err.message);
    } finally {
      setSalvandoQuitacaoLote(false);
    }
  };

  // ─── Excluir lançamento ────────────────────────────────────────────────────
  const confirmarExcluir = async () => {
    if (!modalExcluir) return;
    try {
      const { error } = await supabase.from('financeiro_cunhadas').delete().eq('id', modalExcluir.id);
      if (error) throw error;
      mostrarMsg('sucesso', 'Lançamento excluído.');
      setModalExcluir(null);
      carregarTudo();
    } catch (err) {
      mostrarMsg('erro', 'Erro: ' + err.message);
    }
  };

  // ─── Mensalidades ──────────────────────────────────────────────────────────
  const toggleMensalidade = async (m) => {
    try {
      const { error } = await supabase
        .from('mensalidades_cunhadas')
        .update({ pago: !m.pago, data_pagamento: !m.pago ? HOJE.toISOString().slice(0, 10) : null })
        .eq('id', m.id);
      if (error) throw error;
      carregarTudo();
    } catch (err) {
      mostrarMsg('erro', 'Erro: ' + err.message);
    }
  };

  const gerarMensalidades = async () => {
    const jaExistem = mensalidadesMes.map((m) => m.cunhada_id);
    const faltam = cunhadas.filter((c) => !jaExistem.includes(c.id));
    if (faltam.length === 0) { mostrarMsg('sucesso', 'Mensalidades já geradas para este mês!'); return; }
    try {
      const registros = faltam.map((c) => ({
        cunhada_id: c.id, mes: mesMens, ano: anoMens,
        valor: parseFloat(config.valor_mensalidade), pago: false,
      }));
      const { error } = await supabase.from('mensalidades_cunhadas').insert(registros);
      if (error) throw error;
      mostrarMsg('sucesso', `${faltam.length} mensalidade(s) gerada(s)!`);
      carregarTudo();
    } catch (err) {
      mostrarMsg('erro', 'Erro: ' + err.message);
    }
  };

  // ─── Config mensalidade ────────────────────────────────────────────────────
  const salvarConfig = async () => {
    setSalvandoConfig(true);
    try {
      for (const [chave, valor] of Object.entries(configForm)) {
        await supabase.from('configuracoes_cunhadas')
          .upsert({ chave, valor: valor.toString() }, { onConflict: 'chave' });
      }
      mostrarMsg('sucesso', 'Configurações salvas!');
      setModalConfig(false);
      carregarTudo();
    } catch (err) {
      mostrarMsg('erro', 'Erro: ' + err.message);
    } finally {
      setSalvandoConfig(false);
    }
  };

  // ─── Helpers modais ────────────────────────────────────────────────────────
  const abrirNovo = (tipo = 'receita') => { setForm({ ...FORM_VAZIO, tipo }); setEditandoId(null); setModalAberto(true); };
  const abrirEditar = (l) => {
    setForm({ tipo: l.tipo, categoria_id: l.categoria_id || '', descricao: l.descricao, valor: l.valor,
      data_lancamento: l.data_lancamento, data_vencimento: l.data_vencimento || '', cunhada_id: l.cunhada_id || '',
      pago: l.pago, forma_pagamento: l.forma_pagamento || '', observacoes: l.observacoes || '' });
    setEditandoId(l.id);
    setModalAberto(true);
  };
  const fecharModalLancamento = () => { setModalAberto(false); setEditandoId(null); setForm(FORM_VAZIO); };
  const mostrarMsg = (tipo, texto) => { setMsg({ tipo, texto }); setTimeout(() => setMsg({ tipo: '', texto: '' }), 4000); };

  // ─── Toggle seleção cunhadas no lote ──────────────────────────────────────
  const toggleCunhadaLote = (id) => {
    setFormLote((prev) => ({
      ...prev,
      cunhadas_selecionadas: prev.cunhadas_selecionadas.includes(id)
        ? prev.cunhadas_selecionadas.filter((x) => x !== id)
        : [...prev.cunhadas_selecionadas, id],
    }));
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER ABAS
  // ═══════════════════════════════════════════════════════════════════════════

  const renderDashboard = () => (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        {[
          { label: 'Receitas do Mês',     valor: fmtMoeda(receitasMes),   cor: '#10b981', icon: '📈' },
          { label: 'Despesas do Mês',     valor: fmtMoeda(despesasMes),   cor: '#ef4444', icon: '📉' },
          { label: 'Saldo do Mês',        valor: fmtMoeda(saldoMes),      cor: saldoMes >= 0 ? '#10b981' : '#ef4444', icon: '💰' },
          { label: 'Pendentes',           valor: `${pendentesCount} (${fmtMoeda(pendentesValor)})`, cor: '#f59e0b', icon: '⏳' },
        ].map((stat) => (
          <div key={stat.label} style={{ ...s.card, borderTop: `3px solid ${stat.cor}` }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
              {stat.icon} {stat.label}
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: '700', color: stat.cor }}>{stat.valor}</div>
          </div>
        ))}
      </div>

      {/* Últimos lançamentos */}
      <div style={s.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <p style={{ fontWeight: '700', color: 'var(--color-text)', margin: 0 }}>Últimos lançamentos</p>
          <button style={s.btnPrimary('var(--color-accent)')} onClick={() => setAba('lancamentos')}>Ver todos →</button>
        </div>
        {lancamentos.slice(0, 8).map((l) => (
          <div key={l.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.1rem' }}>{l.tipo === 'receita' ? '📈' : '📉'}</span>
              <div>
                <p style={{ margin: 0, fontWeight: '600', fontSize: '0.875rem', color: 'var(--color-text)' }}>{l.descricao}</p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-faint)' }}>
                  {fmtData(l.data_lancamento)}
                  {l.cunhada?.nome ? ` · ${l.cunhada.nome}` : ''}
                  {l.categoria?.nome ? ` · ${l.categoria.nome}` : ''}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontWeight: '700', color: l.tipo === 'receita' ? '#10b981' : '#ef4444' }}>
                {l.tipo === 'receita' ? '+' : '-'}{fmtMoeda(l.valor)}
              </span>
              <span style={s.badge(l.pago)}>{l.pago ? '✓ Pago' : '⏳ Pendente'}</span>
            </div>
          </div>
        ))}
        {lancamentos.length === 0 && <p style={{ color: 'var(--color-text-faint)', textAlign: 'center', padding: '2rem 0' }}>Nenhum lançamento ainda.</p>}
      </div>
    </div>
  );

  const renderLancamentos = () => {
    const recFiltrado = lancamentosFiltrados.filter((l) => l.tipo === 'receita').reduce((s, l) => s + Number(l.valor), 0);
    const depFiltrado = lancamentosFiltrados.filter((l) => l.tipo === 'despesa').reduce((s, l) => s + Number(l.valor), 0);
    const pendFiltrado = lancamentosFiltrados.filter((l) => !l.pago);

    return (
      <div>
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <NavMes mes={filtroMes} ano={filtroAno} onChange={(m, a) => { setFiltroMes(m); setFiltroAno(a); }} />
            {['todos', 'receita', 'despesa'].map((t) => (
              <button key={t} style={s.navBtn(filtroTipo === t)} onClick={() => setFiltroTipo(t)}>
                {t === 'todos' ? 'Todos' : t === 'receita' ? '📈 Receitas' : '📉 Despesas'}
              </button>
            ))}
            {['todos', 'pendente', 'pago'].map((t) => (
              <button key={t} style={s.navBtn(filtroStatus === t)} onClick={() => setFiltroStatus(t)}>
                {t === 'todos' ? 'Todos status' : t === 'pago' ? '✓ Pagos' : '⏳ Pendentes'}
              </button>
            ))}
            <select style={{ ...s.select, width: 'auto', minWidth: '150px' }} value={filtroCunhada} onChange={(e) => setFiltroCunhada(e.target.value)}>
              <option value="">Todas as cunhadas</option>
              {cunhadas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button style={s.btnPrimary('#10b981')} onClick={() => abrirNovo('receita')}>＋ Receita</button>
            <button style={s.btnPrimary('#ef4444')} onClick={() => abrirNovo('despesa')}>＋ Despesa</button>
            <button style={s.btnPrimary('var(--color-accent)')} onClick={() => setModalLote(true)}>👥 Lançar em Lote</button>
            {pendFiltrado.length > 0 && (
              <button style={s.btnPrimary('#f59e0b')} onClick={() => { setSelecionadosQuitacao([]); setModalQuitacaoLote(true); }}>
                💰 Quitar em Lote
              </button>
            )}
          </div>
        </div>

        {/* Resumo */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
          {[
            { label: 'Receitas', valor: fmtMoeda(recFiltrado), cor: '#10b981' },
            { label: 'Despesas', valor: fmtMoeda(depFiltrado), cor: '#ef4444' },
            { label: 'Saldo',    valor: fmtMoeda(recFiltrado - depFiltrado), cor: 'var(--color-accent)' },
          ].map((r) => (
            <div key={r.label} style={{ ...s.card, padding: '1rem 1.25rem' }}>
              <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{r.label}</p>
              <p style={{ margin: '0.2rem 0 0', fontSize: '1.2rem', fontWeight: '700', color: r.cor }}>{r.valor}</p>
            </div>
          ))}
        </div>

        {/* Lista */}
        <div style={s.card}>
          {lancamentosFiltrados.length === 0 ? (
            <p style={{ color: 'var(--color-text-faint)', textAlign: 'center', padding: '3rem 0' }}>Nenhum lançamento neste período.</p>
          ) : (
            lancamentosFiltrados.map((l) => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 0', borderBottom: '1px solid var(--color-border)' }}>
                {/* Ícone tipo */}
                <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '50%', background: l.tipo === 'receita' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
                  {l.tipo === 'receita' ? '📈' : '📉'}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: '600', fontSize: '0.875rem', color: 'var(--color-text)' }}>{l.descricao}</p>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-faint)' }}>
                    {fmtData(l.data_lancamento)}
                    {l.cunhada?.nome ? ` · ${l.cunhada.nome}` : ' · Geral'}
                    {l.categoria?.nome ? ` · ${l.categoria.nome}` : ''}
                    {l.data_vencimento && !l.pago ? ` · Vence ${fmtData(l.data_vencimento)}` : ''}
                  </p>
                </div>

                {/* Valor + status */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ margin: 0, fontWeight: '700', color: l.tipo === 'receita' ? '#10b981' : '#ef4444' }}>
                    {l.tipo === 'receita' ? '+' : '-'}{fmtMoeda(l.valor)}
                  </p>
                  <span style={s.badge(l.pago)}>{l.pago ? '✓ Pago' : '⏳ Pendente'}</span>
                </div>

                {/* Ações */}
                <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                  {!l.pago ? (
                    <button onClick={() => abrirQuitacao(l)}
                      style={{ padding: '0.3rem 0.65rem', background: 'rgba(16,185,129,0.12)', color: '#10b981', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer' }}
                      title="Quitar">💰</button>
                  ) : (
                    <button onClick={() => desfazerQuitacao(l.id)}
                      style={{ padding: '0.3rem 0.65rem', background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer' }}
                      title="Desfazer quitação">↩</button>
                  )}
                  <button onClick={() => abrirEditar(l)}
                    style={{ padding: '0.3rem 0.65rem', background: 'var(--color-accent-bg)', color: 'var(--color-accent)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer' }}>✏️</button>
                  <button onClick={() => setModalExcluir(l)}
                    style={{ padding: '0.3rem 0.65rem', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer' }}>🗑</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderMensalidades = () => (
    <div>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <NavMes mes={mesMens} ano={anoMens} onChange={(m, a) => { setMesMens(m); setAnoMens(a); }} />
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button style={s.btnSec} onClick={() => setModalConfig(true)}>⚙️ Valor: {fmtMoeda(config.valor_mensalidade)}</button>
          <button style={s.btnPrimary('var(--color-accent)')} onClick={gerarMensalidades}>⚡ Gerar mensalidades</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'Total gerado', valor: mensalidadesMes.length,                         cor: 'var(--color-accent)' },
          { label: 'Quitadas',     valor: mensalidadesMes.filter((m) => m.pago).length,   cor: '#10b981' },
          { label: 'Em aberto',    valor: mensalidadesMes.filter((m) => !m.pago).length,  cor: '#f59e0b' },
        ].map((r) => (
          <div key={r.label} style={{ ...s.card, padding: '1rem 1.25rem' }}>
            <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{r.label}</p>
            <p style={{ margin: '0.2rem 0 0', fontSize: '1.5rem', fontWeight: '700', color: r.cor }}>{r.valor}</p>
          </div>
        ))}
      </div>

      {mensalidadesMes.length === 0 ? (
        <div style={{ ...s.card, textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>Mensalidades não geradas para {MESES[mesMens - 1]}/{anoMens}.</p>
          <button style={s.btnPrimary('var(--color-accent)')} onClick={gerarMensalidades}>⚡ Gerar agora</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
          {mensalidadesMes.map((m) => (
            <div key={m.id} style={{ ...s.card, padding: '1.25rem', borderTop: `3px solid ${m.pago ? '#10b981' : '#f59e0b'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: m.pago ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.85rem', color: m.pago ? '#10b981' : '#f59e0b' }}>
                  {m.cunhada?.nome?.charAt(0).toUpperCase()}
                </div>
                <span style={s.badge(m.pago)}>{m.pago ? '✓ Paga' : '⏳ Aberto'}</span>
              </div>
              <p style={{ margin: '0 0 0.2rem', fontWeight: '700', fontSize: '0.9rem', color: 'var(--color-text)' }}>{m.cunhada?.nome}</p>
              <p style={{ margin: '0 0 0.75rem', fontWeight: '700', color: m.pago ? '#10b981' : '#f59e0b' }}>{fmtMoeda(m.valor)}</p>
              {m.data_pagamento && <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: 'var(--color-text-faint)' }}>Pago em {fmtData(m.data_pagamento)}</p>}
              <button onClick={() => toggleMensalidade(m)}
                style={{ width: '100%', padding: '0.45rem', borderRadius: 'var(--radius-md)', border: 'none', background: m.pago ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)', color: m.pago ? '#f59e0b' : '#10b981', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer' }}>
                {m.pago ? '↩ Desfazer' : '✓ Marcar como paga'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderExtrato = () => {
    const porMes = {};
    lancamentos.forEach((l) => {
      const [y, m] = l.data_lancamento.split('-');
      const chave = `${y}-${m.padStart(2, '0')}`;
      if (!porMes[chave]) porMes[chave] = [];
      porMes[chave].push(l);
    });
    const chaves = Object.keys(porMes).sort((a, b) => b.localeCompare(a));

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <p style={{ margin: 0, fontWeight: '700', color: 'var(--color-text)' }}>Extrato completo</p>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{lancamentos.length} lançamentos</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Saldo acumulado</p>
            <p style={{ margin: 0, fontWeight: '700', fontSize: '1.25rem', color: (totalReceitas - totalDespesas) >= 0 ? '#10b981' : '#ef4444' }}>
              {fmtMoeda(totalReceitas - totalDespesas)}
            </p>
          </div>
        </div>

        {chaves.length === 0 ? (
          <div style={{ ...s.card, textAlign: 'center', padding: '3rem' }}>
            <p style={{ color: 'var(--color-text-faint)' }}>Nenhum lançamento registrado.</p>
          </div>
        ) : (
          chaves.map((chave) => {
            const [y, m] = chave.split('-');
            const items = porMes[chave];
            const rec = items.filter((l) => l.tipo === 'receita').reduce((s, l) => s + Number(l.valor), 0);
            const dep = items.filter((l) => l.tipo === 'despesa').reduce((s, l) => s + Number(l.valor), 0);
            return (
              <div key={chave} style={{ ...s.card, marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--color-border)' }}>
                  <p style={{ margin: 0, fontWeight: '700', color: 'var(--color-text)' }}>{MESES[parseInt(m) - 1]} {y}</p>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem' }}>
                    <span style={{ color: '#10b981' }}>+{fmtMoeda(rec)}</span>
                    <span style={{ color: '#ef4444' }}>-{fmtMoeda(dep)}</span>
                    <span style={{ color: (rec - dep) >= 0 ? '#10b981' : '#ef4444', fontWeight: '700' }}>{fmtMoeda(rec - dep)}</span>
                  </div>
                </div>
                {items.map((l) => (
                  <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text)' }}>{l.descricao}</p>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-text-faint)' }}>
                        {fmtData(l.data_lancamento)}
                        {l.cunhada?.nome ? ` · ${l.cunhada.nome}` : ''}
                        {l.categoria?.nome ? ` · ${l.categoria.nome}` : ''}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                      <span style={{ fontWeight: '700', color: l.tipo === 'receita' ? '#10b981' : '#ef4444' }}>
                        {l.tipo === 'receita' ? '+' : '-'}{fmtMoeda(l.valor)}
                      </span>
                      <span style={s.badge(l.pago)}>{l.pago ? '✓' : '⏳'}</span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER PRINCIPAL
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>

      {/* Toast */}
      {msg.texto && (
        <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', padding: '0.85rem 1.25rem', borderRadius: 'var(--radius-xl)', background: msg.tipo === 'sucesso' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${msg.tipo === 'sucesso' ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`, color: msg.tipo === 'sucesso' ? '#10b981' : '#ef4444', fontWeight: '600', fontSize: '0.875rem', zIndex: 2000, boxShadow: 'var(--shadow-lg)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {msg.tipo === 'sucesso' ? '✅' : '❌'} {msg.texto}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-text)', margin: 0 }}>💰 Financeiro</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '0.2rem 0 0' }}>Portal das Cunhadas</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { id: 'dashboard',    label: '📊 Dashboard' },
            { id: 'lancamentos',  label: '📝 Lançamentos' },
            { id: 'mensalidades', label: '📋 Mensalidades' },
            { id: 'extrato',      label: '📄 Extrato' },
          ].map((a) => (
            <button key={a.id} style={s.navBtn(aba === a.id)} onClick={() => setAba(a.id)}>{a.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-faint)' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem' }} />
          Carregando...
        </div>
      ) : (
        <>
          {aba === 'dashboard'    && renderDashboard()}
          {aba === 'lancamentos'  && renderLancamentos()}
          {aba === 'mensalidades' && renderMensalidades()}
          {aba === 'extrato'      && renderExtrato()}
        </>
      )}

      {/* ── MODAL LANÇAMENTO INDIVIDUAL ──────────────────────────────────────── */}
      {modalAberto && (
        <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && fecharModalLancamento()}>
          <div style={s.modal}>
            <div style={s.mHead}>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: 'var(--color-text)' }}>
                {form.tipo === 'receita' ? '📈' : '📉'} {editandoId ? 'Editar' : 'Novo'} {form.tipo === 'receita' ? 'Receita' : 'Despesa'}
              </h2>
              <button onClick={fecharModalLancamento} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <div style={s.mBody}>
              {/* Seletor tipo */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                {['receita', 'despesa'].map((t) => (
                  <button key={t} onClick={() => setForm({ ...form, tipo: t })}
                    style={{ padding: '0.65rem', borderRadius: 'var(--radius-lg)', border: '2px solid', borderColor: form.tipo === t ? (t === 'receita' ? '#10b981' : '#ef4444') : 'var(--color-border)', background: form.tipo === t ? (t === 'receita' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)') : 'transparent', color: form.tipo === t ? (t === 'receita' ? '#10b981' : '#ef4444') : 'var(--color-text-muted)', fontWeight: '700', cursor: 'pointer' }}>
                    {t === 'receita' ? '📈 Receita' : '📉 Despesa'}
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <Campo label="Descrição *" style={{ gridColumn: '1 / -1' }}>
                  <input style={s.input} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Ex: Mensalidade de março" />
                </Campo>
                <Campo label="Valor (R$) *">
                  <input type="number" step="0.01" min="0" style={s.input} value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} placeholder="0,00" />
                </Campo>
                <Campo label="Categoria">
                  <select style={s.select} value={form.categoria_id} onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}>
                    <option value="">— Selecione —</option>
                    {categorias.filter((c) => c.tipo === form.tipo || c.tipo === 'ambos').map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </Campo>
                <Campo label="Cunhada">
                  <select style={s.select} value={form.cunhada_id} onChange={(e) => setForm({ ...form, cunhada_id: e.target.value })}>
                    <option value="">— Geral (todas) —</option>
                    {cunhadas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </Campo>
                <Campo label="Data do lançamento">
                  <input type="date" style={s.input} value={form.data_lancamento} onChange={(e) => setForm({ ...form, data_lancamento: e.target.value })} />
                </Campo>
                <Campo label="Data de vencimento">
                  <input type="date" style={s.input} value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} />
                </Campo>
                <Campo label="Forma de pagamento">
                  <select style={s.select} value={form.forma_pagamento} onChange={(e) => setForm({ ...form, forma_pagamento: e.target.value })}>
                    <option value="">— Selecione —</option>
                    {FORMAS_PAGAMENTO.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </Campo>
                <Campo label="Status">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingTop: '0.5rem' }}>
                    <input type="checkbox" id="pago-check" checked={form.pago} onChange={(e) => setForm({ ...form, pago: e.target.checked })} style={{ width: '1rem', height: '1rem', accentColor: 'var(--color-accent)' }} />
                    <label htmlFor="pago-check" style={{ color: 'var(--color-text)', fontSize: '0.875rem', cursor: 'pointer' }}>Já pago / recebido</label>
                  </div>
                </Campo>
                <Campo label="Observações" style={{ gridColumn: '1 / -1' }}>
                  <textarea style={s.textarea} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} placeholder="Informações adicionais..." />
                </Campo>
              </div>
            </div>
            <div style={s.mFoot}>
              <button style={s.btnSec} onClick={fecharModalLancamento} disabled={salvando}>Cancelar</button>
              <button style={s.btnPrimary(form.tipo === 'receita' ? '#10b981' : '#ef4444')} onClick={salvarLancamento} disabled={salvando}>
                {salvando ? '⏳ Salvando...' : editandoId ? '💾 Salvar' : `＋ Lançar ${form.tipo}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL LANÇAMENTO EM LOTE ─────────────────────────────────────────── */}
      {modalLote && (
        <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && setModalLote(false)}>
          <div style={s.modalLg}>
            <div style={s.mHead}>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: 'var(--color-text)' }}>
                👥 Lançamento em Lote para Cunhadas
              </h2>
              <button onClick={() => setModalLote(false)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <div style={s.mBody}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <Campo label="Descrição *" style={{ gridColumn: '1 / -1' }}>
                  <input style={s.input} value={formLote.descricao} onChange={(e) => setFormLote({ ...formLote, descricao: e.target.value })} placeholder="Ex: Mensalidade - Março/2025" />
                </Campo>
                <Campo label="Valor por cunhada (R$) *">
                  <input type="number" step="0.01" min="0" style={s.input} value={formLote.valor} onChange={(e) => setFormLote({ ...formLote, valor: e.target.value })} placeholder="0,00" />
                </Campo>
                <Campo label="Categoria">
                  <select style={s.select} value={formLote.categoria_id} onChange={(e) => setFormLote({ ...formLote, categoria_id: e.target.value })}>
                    <option value="">— Selecione —</option>
                    {categorias.filter((c) => c.tipo === 'receita' || c.tipo === 'ambos').map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </Campo>
                <Campo label="Data do lançamento">
                  <input type="date" style={s.input} value={formLote.data_lancamento} onChange={(e) => setFormLote({ ...formLote, data_lancamento: e.target.value })} />
                </Campo>
                <Campo label="Data de vencimento">
                  <input type="date" style={s.input} value={formLote.data_vencimento} onChange={(e) => setFormLote({ ...formLote, data_vencimento: e.target.value })} />
                </Campo>
                <Campo label="Forma de pagamento">
                  <select style={s.select} value={formLote.forma_pagamento} onChange={(e) => setFormLote({ ...formLote, forma_pagamento: e.target.value })}>
                    <option value="">— Selecione —</option>
                    {FORMAS_PAGAMENTO.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </Campo>
              </div>

              {/* Seleção de cunhadas */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Selecionar Cunhadas * ({formLote.cunhadas_selecionadas.length} de {cunhadas.length})
                  </label>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button type="button" onClick={() => setFormLote({ ...formLote, cunhadas_selecionadas: cunhadas.map((c) => c.id) })}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--color-accent)', fontWeight: '600' }}>
                      ✅ Selecionar todas
                    </button>
                    <button type="button" onClick={() => setFormLote({ ...formLote, cunhadas_selecionadas: [] })}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: '#ef4444', fontWeight: '600' }}>
                      ❌ Limpar
                    </button>
                  </div>
                </div>
                <div style={{ border: '2px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1rem', maxHeight: '200px', overflowY: 'auto', background: 'var(--color-surface-2)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.5rem' }}>
                    {cunhadas.map((c) => (
                      <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-md)', background: formLote.cunhadas_selecionadas.includes(c.id) ? 'var(--color-accent-bg)' : 'transparent', border: `1px solid ${formLote.cunhadas_selecionadas.includes(c.id) ? 'var(--color-accent)' : 'transparent'}` }}>
                        <input type="checkbox" checked={formLote.cunhadas_selecionadas.includes(c.id)} onChange={() => toggleCunhadaLote(c.id)}
                          style={{ accentColor: 'var(--color-accent)' }} />
                        <span style={{ fontSize: '0.875rem', color: 'var(--color-text)', fontWeight: formLote.cunhadas_selecionadas.includes(c.id) ? '600' : '400' }}>{c.nome}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Preview total */}
              {formLote.cunhadas_selecionadas.length > 0 && formLote.valor && (
                <div style={{ ...s.infoBox, marginTop: '1rem' }}>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-accent)', fontWeight: '600' }}>
                    📋 Total a lançar: <strong>{fmtMoeda(parseFloat(formLote.valor || 0) * formLote.cunhadas_selecionadas.length)}</strong>
                    {' '}({formLote.cunhadas_selecionadas.length} cunhada(s) × {fmtMoeda(parseFloat(formLote.valor || 0))})
                  </p>
                </div>
              )}
            </div>
            <div style={s.mFoot}>
              <button style={s.btnSec} onClick={() => setModalLote(false)} disabled={salvandoLote}>Cancelar</button>
              <button style={s.btnPrimary('#10b981')} onClick={salvarLote} disabled={salvandoLote}>
                {salvandoLote ? '⏳ Criando...' : `✅ Criar ${formLote.cunhadas_selecionadas.length} lançamento(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL QUITAÇÃO INDIVIDUAL ────────────────────────────────────────── */}
      {modalQuitacao && (
        <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && setModalQuitacao(null)}>
          <div style={{ ...s.modal, maxWidth: '420px' }}>
            <div style={s.mHead}>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: 'var(--color-text)' }}>💰 Quitar Lançamento</h2>
              <button onClick={() => setModalQuitacao(null)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <div style={s.mBody}>
              {/* Resumo do lançamento */}
              <div style={{ ...s.infoBox, marginBottom: '1.25rem' }}>
                <p style={{ margin: '0 0 0.25rem', fontWeight: '700', color: 'var(--color-text)' }}>{modalQuitacao.descricao}</p>
                <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#10b981' }}>{fmtMoeda(modalQuitacao.valor)}</p>
                {modalQuitacao.cunhada?.nome && <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>👤 {modalQuitacao.cunhada.nome}</p>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <Campo label="Data de pagamento">
                  <input type="date" style={s.input} value={quitacaoForm.data_pagamento} onChange={(e) => setQuitacaoForm({ ...quitacaoForm, data_pagamento: e.target.value })} />
                </Campo>
                <Campo label="Forma de pagamento">
                  <select style={s.select} value={quitacaoForm.forma_pagamento} onChange={(e) => setQuitacaoForm({ ...quitacaoForm, forma_pagamento: e.target.value })}>
                    {FORMAS_PAGAMENTO.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </Campo>
                <Campo label="Observações">
                  <textarea style={s.textarea} value={quitacaoForm.observacoes} onChange={(e) => setQuitacaoForm({ ...quitacaoForm, observacoes: e.target.value })} placeholder="Observações sobre o pagamento (opcional)" />
                </Campo>
              </div>
            </div>
            <div style={s.mFoot}>
              <button style={s.btnSec} onClick={() => setModalQuitacao(null)} disabled={salvandoQuitacao}>Cancelar</button>
              <button style={s.btnPrimary('#10b981')} onClick={confirmarQuitacao} disabled={salvandoQuitacao}>
                {salvandoQuitacao ? '⏳...' : '✅ Confirmar Quitação'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL QUITAÇÃO EM LOTE ───────────────────────────────────────────── */}
      {modalQuitacaoLote && (
        <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && setModalQuitacaoLote(false)}>
          <div style={s.modalLg}>
            <div style={s.mHead}>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: 'var(--color-text)' }}>
                💰 Quitação em Lote — {selecionadosQuitacao.length} selecionados
              </h2>
              <button onClick={() => setModalQuitacaoLote(false)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <div style={s.mBody}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <Campo label="Data de pagamento">
                  <input type="date" style={s.input} value={quitacaoLoteForm.data_pagamento} onChange={(e) => setQuitacaoLoteForm({ ...quitacaoLoteForm, data_pagamento: e.target.value })} />
                </Campo>
                <Campo label="Forma de pagamento">
                  <select style={s.select} value={quitacaoLoteForm.forma_pagamento} onChange={(e) => setQuitacaoLoteForm({ ...quitacaoLoteForm, forma_pagamento: e.target.value })}>
                    {FORMAS_PAGAMENTO.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </Campo>
              </div>

              {/* Lista de pendentes */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Lançamentos Pendentes
                  </label>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button type="button" onClick={selecionarTodosPendentes}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--color-accent)', fontWeight: '600' }}>✅ Selecionar todos</button>
                    <button type="button" onClick={() => setSelecionadosQuitacao([])}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: '#ef4444', fontWeight: '600' }}>❌ Limpar</button>
                  </div>
                </div>
                <div style={{ border: '2px solid var(--color-border)', borderRadius: 'var(--radius-lg)', maxHeight: '320px', overflowY: 'auto', background: 'var(--color-surface-2)' }}>
                  {lancamentosFiltrados.filter((l) => !l.pago).length === 0 ? (
                    <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-faint)' }}>Nenhum lançamento pendente no filtro atual.</p>
                  ) : (
                    lancamentosFiltrados.filter((l) => !l.pago).map((l) => (
                      <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)', cursor: 'pointer', background: selecionadosQuitacao.includes(l.id) ? 'var(--color-accent-bg)' : 'transparent' }}>
                        <input type="checkbox" checked={selecionadosQuitacao.includes(l.id)} onChange={() => toggleSelecionadoQuitacao(l.id)}
                          style={{ accentColor: 'var(--color-accent)', width: '1rem', height: '1rem' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text)' }}>{l.descricao}</p>
                          <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-text-faint)' }}>
                            {fmtData(l.data_lancamento)}{l.cunhada?.nome ? ` · ${l.cunhada.nome}` : ''}
                          </p>
                        </div>
                        <span style={{ fontWeight: '700', color: '#10b981', flexShrink: 0 }}>{fmtMoeda(l.valor)}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {selecionadosQuitacao.length > 0 && (
                <div style={{ ...s.infoBox, marginTop: '1rem' }}>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-accent)', fontWeight: '600' }}>
                    Total a quitar: <strong>{fmtMoeda(lancamentos.filter((l) => selecionadosQuitacao.includes(l.id)).reduce((s, l) => s + Number(l.valor), 0))}</strong>
                    {' '}({selecionadosQuitacao.length} lançamento(s))
                  </p>
                </div>
              )}
            </div>
            <div style={s.mFoot}>
              <button style={s.btnSec} onClick={() => setModalQuitacaoLote(false)} disabled={salvandoQuitacaoLote}>Cancelar</button>
              <button style={s.btnPrimary('#10b981')} onClick={confirmarQuitacaoLote} disabled={salvandoQuitacaoLote || selecionadosQuitacao.length === 0}>
                {salvandoQuitacaoLote ? '⏳...' : `✅ Quitar ${selecionadosQuitacao.length} lançamento(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CONFIG MENSALIDADE ─────────────────────────────────────────── */}
      {modalConfig && (
        <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && setModalConfig(false)}>
          <div style={{ ...s.modal, maxWidth: '380px' }}>
            <div style={s.mHead}>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: 'var(--color-text)' }}>⚙️ Configuração de Mensalidade</h2>
              <button onClick={() => setModalConfig(false)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <div style={s.mBody}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <Campo label="Valor da mensalidade (R$)">
                  <input type="number" step="0.01" min="0" style={s.input} value={configForm.valor_mensalidade} onChange={(e) => setConfigForm({ ...configForm, valor_mensalidade: e.target.value })} />
                </Campo>
                <Campo label="Dia de vencimento">
                  <input type="number" min="1" max="31" style={s.input} value={configForm.dia_vencimento} onChange={(e) => setConfigForm({ ...configForm, dia_vencimento: e.target.value })} />
                </Campo>
              </div>
            </div>
            <div style={s.mFoot}>
              <button style={s.btnSec} onClick={() => setModalConfig(false)}>Cancelar</button>
              <button style={s.btnPrimary('var(--color-accent)')} onClick={salvarConfig} disabled={salvandoConfig}>
                {salvandoConfig ? '⏳...' : '💾 Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL EXCLUIR ────────────────────────────────────────────────────── */}
      {modalExcluir && (
        <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && setModalExcluir(null)}>
          <div style={{ ...s.modal, maxWidth: '400px' }}>
            <div style={s.mHead}>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: '#ef4444' }}>⚠️ Excluir lançamento</h2>
              <button onClick={() => setModalExcluir(null)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ ...s.mBody, textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗑️</div>
              <p style={{ color: 'var(--color-text)', marginBottom: '0.5rem' }}>Excluir o lançamento:</p>
              <p style={{ fontWeight: '700', color: '#ef4444' }}>{modalExcluir.descricao} — {fmtMoeda(modalExcluir.valor)}</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-faint)', marginTop: '0.5rem' }}>Esta ação não pode ser desfeita.</p>
            </div>
            <div style={s.mFoot}>
              <button style={s.btnSec} onClick={() => setModalExcluir(null)}>Cancelar</button>
              <button style={s.btnPrimary('#ef4444')} onClick={confirmarExcluir}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanceiroCunhadas;
