/**
 * CADASTRO DE CUNHADAS
 * CRUD completo: listar, cadastrar, editar, inativar
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

// ─── helpers ─────────────────────────────────────────────────────────────────
const fmtDate = (d) => {
  if (!d) return '—';
  const [y, m, dia] = d.split('-');
  return `${dia}/${m}/${y}`;
};

const VAZIO = {
  nome: '',
  cpf: '',
  telefone: '',
  email: '',
  data_nascimento: '',
  endereco: '',
  ativa: true,
  observacoes: '',
};

// ─── máscaras ────────────────────────────────────────────────────────────────
const maskCpf = (v) =>
  v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');

const maskTel = (v) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10)
    return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
};

// ─── Campo helper (FORA do componente para evitar remount a cada render) ──────
const Campo = ({ label, children, style }) => (
  <div style={style}>
    <label style={{
      display: 'block',
      fontSize: '0.8rem',
      fontWeight: '600',
      color: 'var(--color-text-muted)',
      marginBottom: '0.4rem',
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
    }}>{label}</label>
    {children}
  </div>
);

// ─── Componente principal ─────────────────────────────────────────────────────
export const CadastroCunhadas = ({ userData }) => {
  const [cunhadas, setCunhadas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroAtiva, setFiltroAtiva] = useState('todas'); // 'todas' | 'ativas' | 'inativas'
  const [modalAberto, setModalAberto] = useState(false);
  const [modalExcluir, setModalExcluir] = useState(null);
  const [form, setForm] = useState(VAZIO);
  const [editandoId, setEditandoId] = useState(null);
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });

  useEffect(() => {
    carregar();
  }, []);

  // ─── Carregar ──────────────────────────────────────────────────────────────
  const carregar = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cunhadas')
        .select('*')
        .order('nome');
      if (error) throw error;
      setCunhadas(data || []);
    } catch (err) {
      mostrarMensagem('erro', 'Erro ao carregar cunhadas: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Filtro ────────────────────────────────────────────────────────────────
  const lista = cunhadas.filter((c) => {
    const ok =
      filtroAtiva === 'todas' ||
      (filtroAtiva === 'ativas' && c.ativa) ||
      (filtroAtiva === 'inativas' && !c.ativa);
    const q = busca.toLowerCase();
    return ok && (!q || c.nome?.toLowerCase().includes(q) || c.cpf?.includes(q));
  });

  // ─── Modal helpers ─────────────────────────────────────────────────────────
  const abrirNovo = () => {
    setForm(VAZIO);
    setEditandoId(null);
    setModalAberto(true);
  };

  const abrirEditar = (c) => {
    setForm({
      nome: c.nome || '',
      cpf: c.cpf || '',
      telefone: c.telefone || '',
      email: c.email || '',
      data_nascimento: c.data_nascimento || '',
      endereco: c.endereco || '',
      ativa: c.ativa ?? true,
      observacoes: c.observacoes || '',
    });
    setEditandoId(c.id);
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setEditandoId(null);
    setForm(VAZIO);
  };

  // ─── Salvar ────────────────────────────────────────────────────────────────
  const salvar = async () => {
    if (!form.nome.trim()) {
      mostrarMensagem('erro', 'O nome é obrigatório.');
      return;
    }

    // Verifica CPF duplicado apenas se preenchido
    const cpfLimpo = form.cpf.replace(/\D/g, '');
    if (cpfLimpo) {
      let q = supabase.from('cunhadas').select('id').eq('cpf', form.cpf);
      if (editandoId) q = q.neq('id', editandoId);
      const { data: dup } = await q;
      if (dup && dup.length > 0) {
        mostrarMensagem('erro', 'Já existe uma cunhada com este CPF.');
        return;
      }
    }

    setSalvando(true);
    try {
      const payload = {
        ...form,
        cpf: cpfLimpo ? form.cpf : null,
        data_nascimento: form.data_nascimento || null,
        telefone: form.telefone || null,
        email: form.email || null,
        endereco: form.endereco || null,
        observacoes: form.observacoes || null,
      };

      if (editandoId) {
        const { error } = await supabase
          .from('cunhadas')
          .update(payload)
          .eq('id', editandoId);
        if (error) throw error;
        mostrarMensagem('sucesso', 'Cunhada atualizada com sucesso!');
      } else {
        const { error } = await supabase.from('cunhadas').insert([payload]);
        if (error) throw error;
        mostrarMensagem('sucesso', 'Cunhada cadastrada com sucesso!');
      }

      fecharModal();
      carregar();
    } catch (err) {
      mostrarMensagem('erro', 'Erro ao salvar: ' + err.message);
    } finally {
      setSalvando(false);
    }
  };

  // ─── Inativar/ativar ───────────────────────────────────────────────────────
  const toggleAtiva = async (c) => {
    try {
      const { error } = await supabase
        .from('cunhadas')
        .update({ ativa: !c.ativa })
        .eq('id', c.id);
      if (error) throw error;
      mostrarMensagem(
        'sucesso',
        `${c.nome} foi ${!c.ativa ? 'ativada' : 'inativada'}.`
      );
      carregar();
    } catch (err) {
      mostrarMensagem('erro', 'Erro: ' + err.message);
    }
  };

  // ─── Excluir ───────────────────────────────────────────────────────────────
  const confirmarExcluir = async () => {
    if (!modalExcluir) return;
    try {
      const { error } = await supabase
        .from('cunhadas')
        .delete()
        .eq('id', modalExcluir.id);
      if (error) throw error;
      mostrarMensagem('sucesso', `${modalExcluir.nome} excluída.`);
      setModalExcluir(null);
      carregar();
    } catch (err) {
      mostrarMensagem('erro', 'Erro ao excluir: ' + err.message);
    }
  };

  const mostrarMensagem = (tipo, texto) => {
    setMensagem({ tipo, texto });
    setTimeout(() => setMensagem({ tipo: '', texto: '' }), 4000);
  };

  // ─── Estilos ───────────────────────────────────────────────────────────────
  const s = {
    page: { padding: '2rem', maxWidth: '1200px', margin: '0 auto' },

    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '1.5rem',
      flexWrap: 'wrap',
      gap: '1rem',
    },
    titulo: { fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-text)', margin: 0 },
    subtitulo: { fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' },

    btnPrimary: {
      background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
      color: '#fff',
      border: 'none',
      borderRadius: 'var(--radius-lg)',
      padding: '0.65rem 1.4rem',
      fontWeight: '600',
      fontSize: '0.875rem',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      boxShadow: '0 4px 14px rgba(168,85,247,0.35)',
      transition: 'all var(--transition-base)',
    },

    toolbar: {
      display: 'flex',
      gap: '0.75rem',
      marginBottom: '1.25rem',
      flexWrap: 'wrap',
      alignItems: 'center',
    },
    searchBox: {
      flex: 1,
      minWidth: '200px',
      padding: '0.65rem 1rem',
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      color: 'var(--color-text)',
      fontSize: '0.875rem',
      outline: 'none',
    },
    filterBtn: (active) => ({
      padding: '0.5rem 1rem',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid',
      borderColor: active ? '#a855f7' : 'var(--color-border)',
      background: active ? 'rgba(168,85,247,0.12)' : 'var(--color-surface)',
      color: active ? '#c084fc' : 'var(--color-text-muted)',
      fontWeight: active ? '600' : '400',
      fontSize: '0.8rem',
      cursor: 'pointer',
      transition: 'all var(--transition-fast)',
    }),


    // Modal
    overlay: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem',
    },
    modal: {
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-2xl)',
      width: '100%',
      maxWidth: '680px',
      maxHeight: '90vh',
      overflowY: 'auto',
      boxShadow: 'var(--shadow-xl)',
    },
    modalHeader: {
      padding: '1.5rem 2rem',
      borderBottom: '1px solid var(--color-border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      background: 'var(--color-surface)',
      zIndex: 1,
    },
    modalTitle: { fontSize: '1.1rem', fontWeight: '700', color: 'var(--color-text)', margin: 0 },
    modalBody: { padding: '1.75rem 2rem' },
    modalFooter: {
      padding: '1.25rem 2rem',
      borderTop: '1px solid var(--color-border)',
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '0.75rem',
      position: 'sticky',
      bottom: 0,
      background: 'var(--color-surface)',
    },

    grid2: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '1rem',
    },
    grid3: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: '1rem',
    },
    fullRow: { gridColumn: '1 / -1' },

    label: {
      display: 'block',
      fontSize: '0.8rem',
      fontWeight: '600',
      color: 'var(--color-text-muted)',
      marginBottom: '0.4rem',
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
    },
    input: {
      width: '100%',
      padding: '0.65rem 0.9rem',
      background: 'var(--color-surface-2)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      color: 'var(--color-text)',
      fontSize: '0.875rem',
      outline: 'none',
      boxSizing: 'border-box',
      transition: 'border-color var(--transition-fast)',
    },
    select: {
      width: '100%',
      padding: '0.65rem 0.9rem',
      background: 'var(--color-surface-2)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      color: 'var(--color-text)',
      fontSize: '0.875rem',
      outline: 'none',
      boxSizing: 'border-box',
    },
    textarea: {
      width: '100%',
      padding: '0.65rem 0.9rem',
      background: 'var(--color-surface-2)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      color: 'var(--color-text)',
      fontSize: '0.875rem',
      outline: 'none',
      resize: 'vertical',
      minHeight: '80px',
      boxSizing: 'border-box',
      fontFamily: 'var(--font-sans)',
    },
    sectionTitle: {
      fontSize: '0.78rem',
      fontWeight: '700',
      color: '#a855f7',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      marginBottom: '1rem',
      marginTop: '0.5rem',
      paddingBottom: '0.5rem',
      borderBottom: '1px solid rgba(168,85,247,0.2)',
    },

    btnSecondary: {
      padding: '0.65rem 1.4rem',
      background: 'var(--color-surface-2)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      color: 'var(--color-text-muted)',
      fontWeight: '600',
      fontSize: '0.875rem',
      cursor: 'pointer',
    },
    btnSave: {
      padding: '0.65rem 1.4rem',
      background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
      border: 'none',
      borderRadius: 'var(--radius-lg)',
      color: '#fff',
      fontWeight: '600',
      fontSize: '0.875rem',
      cursor: 'pointer',
      boxShadow: '0 4px 14px rgba(168,85,247,0.35)',
    },
    btnDanger: {
      padding: '0.65rem 1.4rem',
      background: 'rgba(239,68,68,0.1)',
      border: '1px solid rgba(239,68,68,0.3)',
      borderRadius: 'var(--radius-lg)',
      color: '#ef4444',
      fontWeight: '600',
      fontSize: '0.875rem',
      cursor: 'pointer',
    },

    toast: (tipo) => ({
      position: 'fixed',
      bottom: '1.5rem',
      right: '1.5rem',
      padding: '0.85rem 1.25rem',
      borderRadius: 'var(--radius-xl)',
      background: tipo === 'sucesso' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
      border: `1px solid ${tipo === 'sucesso' ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`,
      color: tipo === 'sucesso' ? '#10b981' : '#ef4444',
      fontWeight: '600',
      fontSize: '0.875rem',
      zIndex: 2000,
      boxShadow: 'var(--shadow-lg)',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
    }),

    emptyState: {
      padding: '4rem 2rem',
      textAlign: 'center',
      color: 'var(--color-text-faint)',
    },
  };

  // ─── render ────────────────────────────────────────────────────────────────
  return (
    <div style={s.page}>
      {/* Toast */}
      {mensagem.texto && (
        <div style={s.toast(mensagem.tipo)}>
          {mensagem.tipo === 'sucesso' ? '✅' : '❌'} {mensagem.texto}
        </div>
      )}

      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.titulo}>👥 Cadastro de Cunhadas</h1>
          <p style={s.subtitulo}>
            {lista.length} cunhada{lista.length !== 1 ? 's' : ''} encontrada
            {lista.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button style={s.btnPrimary} onClick={abrirNovo}>
          ＋ Nova Cunhada
        </button>
      </div>

      {/* Toolbar */}
      <div style={s.toolbar}>
        <input
          style={s.searchBox}
          placeholder="🔍  Buscar por nome ou CPF..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {['todas', 'ativas', 'inativas'].map((f) => (
          <button
            key={f}
            style={s.filterBtn(filtroAtiva === f)}
            onClick={() => setFiltroAtiva(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Tabela */}
      {loading ? (
        <div style={s.emptyState}>
          <div className="spinner" style={{ margin: '0 auto 1rem' }} />
          Carregando...
        </div>
      ) : lista.length === 0 ? (
        <div style={{ ...s.emptyState, background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👥</div>
          <p style={{ color: 'var(--color-text-muted)', fontWeight: '500' }}>
            {busca ? 'Nenhuma cunhada encontrada para esta busca.' : 'Nenhuma cunhada cadastrada ainda.'}
          </p>
          {!busca && (
            <button style={{ ...s.btnPrimary, margin: '1rem auto 0' }} onClick={abrirNovo}>
              Cadastrar primeira cunhada
            </button>
          )}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1.25rem',
        }}>
          {lista.map((c) => (
            <div
              key={c.id}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-xl)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all var(--transition-base)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(168,85,247,0.15)';
                e.currentTarget.style.borderColor = '#a855f7';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                e.currentTarget.style.borderColor = 'var(--color-border)';
              }}
            >
              {/* Topo colorido com avatar e status */}
              <div style={{
                background: c.ativa
                  ? 'linear-gradient(135deg, #6d28d9, #a855f7)'
                  : 'linear-gradient(135deg, #334155, #475569)',
                padding: '1.25rem 1.25rem 0.75rem',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
              }}>
                {/* Avatar com inicial */}
                <div style={{
                  width: '2.75rem',
                  height: '2.75rem',
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.1rem',
                  fontWeight: '700',
                  color: '#fff',
                  flexShrink: 0,
                }}>
                  {c.nome?.charAt(0).toUpperCase() || '?'}
                </div>
                {/* Badge status */}
                <span style={{
                  padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  fontSize: '0.7rem',
                  fontWeight: '700',
                  background: c.ativa ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  letterSpacing: '0.03em',
                }}>
                  {c.ativa ? '● Ativa' : '○ Inativa'}
                </span>
              </div>

              {/* Corpo do card */}
              <div style={{ padding: '1rem 1.25rem', flex: 1 }}>
                {/* Nome */}
                <p style={{
                  fontWeight: '700',
                  fontSize: '0.975rem',
                  color: 'var(--color-text)',
                  margin: '0 0 0.75rem',
                  lineHeight: 1.3,
                }}>
                  {c.nome}
                </p>

                {/* Infos */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {[
                    { icon: '📋', label: c.cpf || '—' },
                    { icon: '📱', label: c.telefone || '—' },
                    { icon: '✉️', label: c.email || '—' },
                    { icon: '🎂', label: c.data_nascimento ? fmtDate(c.data_nascimento) : '—' },
                  ].map(({ icon, label }) => (
                    <div key={icon} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.8rem',
                      color: 'var(--color-text-muted)',
                    }}>
                      <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>{icon}</span>
                      <span style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ações */}
              <div style={{
                padding: '0.75rem 1.25rem',
                borderTop: '1px solid var(--color-border)',
                display: 'flex',
                gap: '0.5rem',
              }}>
                <button
                  onClick={() => abrirEditar(c)}
                  style={{
                    flex: 1,
                    padding: '0.4rem 0',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    background: 'rgba(168,85,247,0.12)',
                    color: '#a855f7',
                    fontWeight: '600',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                  }}
                >
                  ✏️ Editar
                </button>
                <button
                  onClick={() => toggleAtiva(c)}
                  style={{
                    flex: 1,
                    padding: '0.4rem 0',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    background: c.ativa ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)',
                    color: c.ativa ? '#f59e0b' : '#10b981',
                    fontWeight: '600',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                  }}
                >
                  {c.ativa ? '⏸' : '▶'}
                </button>
                <button
                  onClick={() => setModalExcluir(c)}
                  style={{
                    padding: '0.4rem 0.65rem',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    background: 'rgba(239,68,68,0.12)',
                    color: '#ef4444',
                    fontWeight: '600',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                  }}
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal Formulário ─────────────────────────────────────────────── */}
      {modalAberto && (
        <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && fecharModal()}>
          <div style={s.modal}>
            {/* Cabeçalho */}
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>
                💜 {editandoId ? 'Editar Cunhada' : 'Nova Cunhada'}
              </h2>
              <button
                onClick={fecharModal}
                style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div style={s.modalBody}>
              {/* Dados pessoais */}
              <div style={s.sectionTitle}>Dados Pessoais</div>
              <div style={{ ...s.grid2, marginBottom: '1rem' }}>
                <Campo label="Nome completo *" style={s.fullRow}>
                  <input
                    style={s.input}
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    placeholder="Nome da cunhada"
                  />
                </Campo>
                <Campo label="CPF">
                  <input
                    style={s.input}
                    value={form.cpf}
                    onChange={(e) => setForm({ ...form, cpf: maskCpf(e.target.value) })}
                    placeholder="000.000.000-00"
                  />
                </Campo>
                <Campo label="Data de nascimento">
                  <input
                    type="date"
                    style={s.input}
                    value={form.data_nascimento}
                    onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })}
                  />
                </Campo>
                <Campo label="Telefone">
                  <input
                    style={s.input}
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: maskTel(e.target.value) })}
                    placeholder="(00) 00000-0000"
                  />
                </Campo>
                <Campo label="E-mail">
                  <input
                    type="email"
                    style={s.input}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="email@exemplo.com"
                  />
                </Campo>
                <Campo label="Endereço" style={s.fullRow}>
                  <input
                    style={s.input}
                    value={form.endereco}
                    onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                    placeholder="Rua, número, bairro, cidade"
                  />
                </Campo>
              </div>

              {/* Observações */}
              <div style={s.sectionTitle}>Observações</div>
              <Campo label="Observações">
                <textarea
                  style={s.textarea}
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  placeholder="Informações adicionais..."
                />
              </Campo>

              {/* Ativa */}
              {editandoId && (
                <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <input
                    type="checkbox"
                    id="ativa-check"
                    checked={form.ativa}
                    onChange={(e) => setForm({ ...form, ativa: e.target.checked })}
                    style={{ width: '1rem', height: '1rem', accentColor: '#a855f7' }}
                  />
                  <label htmlFor="ativa-check" style={{ color: 'var(--color-text)', fontSize: '0.875rem', cursor: 'pointer' }}>
                    Cunhada ativa
                  </label>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={s.modalFooter}>
              <button style={s.btnSecondary} onClick={fecharModal} disabled={salvando}>
                Cancelar
              </button>
              <button style={s.btnSave} onClick={salvar} disabled={salvando}>
                {salvando ? '⏳ Salvando...' : editandoId ? '💾 Salvar alterações' : '💜 Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Confirmar Exclusão ─────────────────────────────────────── */}
      {modalExcluir && (
        <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && setModalExcluir(null)}>
          <div style={{ ...s.modal, maxWidth: '420px' }}>
            <div style={s.modalHeader}>
              <h2 style={{ ...s.modalTitle, color: '#ef4444' }}>⚠️ Confirmar exclusão</h2>
              <button onClick={() => setModalExcluir(null)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ ...s.modalBody, textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗑️</div>
              <p style={{ color: 'var(--color-text)', marginBottom: '0.5rem' }}>
                Deseja excluir permanentemente a cunhada:
              </p>
              <p style={{ fontWeight: '700', color: '#ef4444', fontSize: '1.1rem' }}>
                {modalExcluir.nome}
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-faint)', marginTop: '0.5rem' }}>
                Esta ação não pode ser desfeita. Considere inativar em vez de excluir.
              </p>
            </div>
            <div style={s.modalFooter}>
              <button style={s.btnSecondary} onClick={() => setModalExcluir(null)}>Cancelar</button>
              <button style={s.btnDanger} onClick={confirmarExcluir}>Excluir definitivamente</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CadastroCunhadas;
