import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const CadastroSessao = ({ onSuccess, onClose }) => {
  const [graus, setGraus] = useState([]);
  const [classificacoes, setClassificacoes] = useState([]);
  const [sessoes, setSessoes] = useState([]);
  const [anosDisponiveis, setAnosDisponiveis] = useState([]);
  const [anoFiltro, setAnoFiltro] = useState(new Date().getFullYear());
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });
  const [modalAberto, setModalAberto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({
    dataSessao: '',
    grauSessao: '',
    classificacaoId: '',
    observacoes: '',
  });

  useEffect(() => { carregarGraus(); carregarClassificacoes(); }, []);
  useEffect(() => { carregarSessoes(); }, [anoFiltro]);

  const carregarGraus = async () => {
    const { data } = await supabase.from('graus_sessao').select('*').order('grau_minimo_requerido');
    setGraus(data || []);
    if (data?.length > 0) setForm(f => ({ ...f, grauSessao: data[0].id }));
  };

  const carregarClassificacoes = async () => {
    const { data } = await supabase.from('classificacoes_sessao').select('*').order('nome');
    setClassificacoes(data || []);
  };

  const carregarSessoes = async () => {
    // Buscar anos disponíveis
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
  };

  const abrirModalNovo = () => {
    setForm({ dataSessao: '', grauSessao: graus[0]?.id || '', classificacaoId: '', observacoes: '' });
    setEditando(null);
    setMensagem({ tipo: '', texto: '' });
    setModalAberto(true);
  };

  const abrirModalEditar = (sessao) => {
    setForm({
      dataSessao: sessao.data_sessao,
      grauSessao: sessao.grau_sessao_id,
      classificacaoId: sessao.classificacao_id || '',
      observacoes: sessao.observacoes || '',
    });
    setEditando(sessao.id);
    setMensagem({ tipo: '', texto: '' });
    setModalAberto(true);
  };

  const fecharModal = () => { setModalAberto(false); setEditando(null); };

  const excluirSessao = async (id) => {
    if (!confirm('Tem certeza que deseja excluir esta sessão?')) return;
    const { error } = await supabase.from('sessoes_presenca').delete().eq('id', id);
    if (error) { setMensagem({ tipo: 'erro', texto: 'Erro ao excluir sessão.' }); return; }
    setMensagem({ tipo: 'sucesso', texto: 'Sessão excluída com sucesso!' });
    carregarSessoes();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.dataSessao) { setMensagem({ tipo: 'erro', texto: 'Informe a data da sessão.' }); return; }
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
      setTimeout(() => { fecharModal(); if (onSuccess) onSuccess(); }, 900);
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: err.message || 'Erro ao salvar sessão.' });
    } finally {
      setLoading(false);
    }
  };

  const corClassificacao = (nome) => {
    const map = {
      'Econômica':     ['rgba(16,185,129,0.12)', '#10b981', 'rgba(16,185,129,0.3)'],
      'Especial':      ['rgba(139,92,246,0.12)',  '#8b5cf6', 'rgba(139,92,246,0.3)'],
      'Magna':         ['rgba(245,158,11,0.12)',  '#f59e0b', 'rgba(245,158,11,0.3)'],
      'Extraordinária':['rgba(239,68,68,0.12)',   '#ef4444', 'rgba(239,68,68,0.3)'],
    };
    return map[nome] || ['var(--color-surface-2)', 'var(--color-text-muted)', 'var(--color-border)'];
  };

  const inp = {
    width: '100%', padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-lg)',
    background: 'var(--color-surface-2)', color: 'var(--color-text)',
    border: '1px solid var(--color-border)', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box',
  };
  const lbl = {
    fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem', display: 'block',
  };

  return (
    <div style={{ padding: '1.5rem', background: 'var(--color-bg)', minHeight: '100vh' }}>

      {/* ── Cabeçalho ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--color-text)', margin: 0 }}>📋 Sessões</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: '0.2rem 0 0' }}>
            Gerencie as sessões realizadas pela loja
          </p>
        </div>
        <button onClick={abrirModalNovo} style={{
          height: '40px', padding: '0 1.1rem', background: 'var(--color-accent)', color: '#fff',
          border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: '700', fontSize: '0.85rem',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
        }}>
          ➕ Nova Sessão
        </button>
      </div>

      {/* ── Mensagem global ───────────────────────────────────────── */}
      {!modalAberto && mensagem.texto && (
        <div style={{
          marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-lg)',
          fontSize: '0.85rem', fontWeight: '600',
          background: mensagem.tipo === 'sucesso' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
          color: mensagem.tipo === 'sucesso' ? '#10b981' : '#ef4444',
          border: `1px solid ${mensagem.tipo === 'sucesso' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
        }}>
          {mensagem.tipo === 'sucesso' ? '✅' : '❌'} {mensagem.texto}
        </div>
      )}

      {/* ── Lista ─────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>

        {/* Barra de filtro */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1.25rem', background: 'var(--color-surface-2)', borderBottom: '2px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ano</span>
            <select
              value={anoFiltro}
              onChange={e => setAnoFiltro(Number(e.target.value))}
              style={{ padding: '0.25rem 0.65rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer', outline: 'none' }}
            >
              {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
            {sessoes.length} sessão{sessoes.length !== 1 ? 'ões' : ''} em {anoFiltro}
          </span>
        </div>

        {/* Cabeçalho colunas */}
        <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 160px auto', gap: '0.75rem', padding: '0.5rem 1.25rem', borderBottom: '1px solid var(--color-border)' }}>
          {['DATA', 'GRAU / OBSERVAÇÃO', 'CLASSIFICAÇÃO', 'AÇÕES'].map((h, i) => (
            <div key={h} style={{ fontSize: '0.67rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: i === 3 ? 'right' : 'left' }}>{h}</div>
          ))}
        </div>

        {/* Linhas */}
        {sessoes.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            Nenhuma sessão cadastrada em {anoFiltro}.
          </div>
        ) : sessoes.map((s, idx) => {
          const [bgCl, txtCl, bdCl] = corClassificacao(s.classificacoes_sessao?.nome);
          return (
            <div key={s.id} style={{
              display: 'grid', gridTemplateColumns: '110px 1fr 160px auto', gap: '0.75rem',
              padding: '0.7rem 1.25rem', alignItems: 'center',
              background: idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)',
              borderBottom: '1px solid var(--color-border)',
            }}>
              <div style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--color-text)' }}>
                {new Date(s.data_sessao + 'T00:00:00').toLocaleDateString('pt-BR')}
              </div>
              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', padding: '0.18rem 0.55rem', borderRadius: '999px', background: 'rgba(99,102,241,0.12)', color: 'var(--color-accent)', border: '1px solid rgba(99,102,241,0.25)' }}>
                  {s.graus_sessao?.nome || '—'}
                </span>
                {s.observacoes && (
                  <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: '0.25rem 0 0', wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'normal', maxWidth: '100%' }}>
                    💬 {s.observacoes}
                  </p>
                )}
              </div>
              <div>
                {s.classificacoes_sessao?.nome ? (
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', padding: '0.18rem 0.55rem', borderRadius: '999px', background: bgCl, color: txtCl, border: `1px solid ${bdCl}` }}>
                    {s.classificacoes_sessao.nome}
                  </span>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>—</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                <button onClick={() => abrirModalEditar(s)} style={{ padding: '0.25rem 0.6rem', background: 'rgba(99,102,241,0.12)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}>
                  ✏️ Editar
                </button>
                <button onClick={() => excluirSessao(s.id)} style={{ padding: '0.25rem 0.6rem', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}>
                  🗑 Excluir
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── MODAL ─────────────────────────────────────────────────── */}
      {modalAberto && (
        <div onClick={fecharModal} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.1rem 1.4rem', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.2rem' }}>📋</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: 'var(--color-text)' }}>
                    {editando ? 'Editar Sessão' : 'Nova Sessão'}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                    {editando ? 'Atualize os dados da sessão' : 'Preencha os dados para cadastrar'}
                  </p>
                </div>
              </div>
              <button onClick={fecharModal} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.3rem', cursor: 'pointer', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-md)', lineHeight: 1 }}>✕</button>
            </div>

            {/* Corpo */}
            <form onSubmit={handleSubmit} style={{ padding: '1.4rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {mensagem.texto && (
                <div style={{ padding: '0.65rem 0.9rem', borderRadius: 'var(--radius-lg)', fontSize: '0.82rem', fontWeight: '600', background: mensagem.tipo === 'sucesso' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: mensagem.tipo === 'sucesso' ? '#10b981' : '#ef4444', border: `1px solid ${mensagem.tipo === 'sucesso' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                  {mensagem.tipo === 'sucesso' ? '✅' : '❌'} {mensagem.texto}
                </div>
              )}
              <div>
                <label style={lbl}>Data da Sessão *</label>
                <input type="date" required value={form.dataSessao} onChange={e => setForm(f => ({ ...f, dataSessao: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>Grau da Sessão *</label>
                <select required value={form.grauSessao} onChange={e => setForm(f => ({ ...f, grauSessao: parseInt(e.target.value) }))} style={inp}>
                  {graus.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Classificação</label>
                <select value={form.classificacaoId} onChange={e => setForm(f => ({ ...f, classificacaoId: e.target.value }))} style={inp}>
                  <option value="">Sem classificação</option>
                  {classificacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Observações</label>
                <textarea rows={3} placeholder="Observações opcionais..." value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} style={{ ...inp, resize: 'vertical', minHeight: '80px' }} />
              </div>
              <div style={{ display: 'flex', gap: '0.65rem', paddingTop: '0.25rem' }}>
                <button type="button" onClick={fecharModal} style={{ flex: 1, height: '40px', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={loading} style={{ flex: 2, height: '40px', background: loading ? 'var(--color-surface-3)' : 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: '700', fontSize: '0.85rem', cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {loading ? 'Salvando...' : editando ? '✏️ Atualizar Sessão' : '✅ Cadastrar Sessão'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CadastroSessao;
