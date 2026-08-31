import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

const CLASSIFICACOES = ['Econômica', 'Especial', 'Magna', 'Extraordinária'];

const corClassificacao = (nome) => {
  const map = {
    'Econômica':      ['rgba(16,185,129,0.12)', '#10b981', 'rgba(16,185,129,0.3)'],
    'Especial':       ['rgba(139,92,246,0.12)', '#8b5cf6', 'rgba(139,92,246,0.3)'],
    'Magna':          ['rgba(245,158,11,0.12)', '#f59e0b', 'rgba(245,158,11,0.3)'],
    'Extraordinária': ['rgba(239,68,68,0.12)', '#ef4444', 'rgba(239,68,68,0.3)'],
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

// Faixa colorida de título — mesmo padrão visual do restante do módulo Arco Real
const Faixa = ({ children }) => (
  <div style={{ background: 'linear-gradient(135deg,#1e3a5f,#2d6a9f)', margin: '-1.1rem -1.4rem 1rem -1.4rem', padding: '0.55rem 1.4rem' }}>
    <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{children}</span>
  </div>
);

export default function CadastroSessaoArcoReal({ onAbrirPresenca, showSuccess, showError }) {
  const [sessoes, setSessoes] = useState([]);
  const [anosDisponiveis, setAnosDisponiveis] = useState([new Date().getFullYear()]);
  const [anoFiltro, setAnoFiltro] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [confirmExcluir, setConfirmExcluir] = useState(null);
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });
  const [form, setForm] = useState({ dataSessao: '', classificacao: '', observacoes: '' });

  useEffect(() => { carregarSessoes(); }, [anoFiltro]);

  const carregarSessoes = async () => {
    setLoading(true);
    try {
      const { data: todos } = await supabase.from('arco_real_sessoes').select('data_sessao');
      const anosEncontrados = (todos || []).map(s => new Date(s.data_sessao + 'T00:00:00').getFullYear());
      const anosFinal = [...new Set([...anosEncontrados, new Date().getFullYear()])].sort((a, b) => b - a);
      setAnosDisponiveis(anosFinal);
      if (!anosFinal.includes(anoFiltro)) setAnoFiltro(anosFinal[0]);

      const { data, error } = await supabase
        .from('arco_real_sessoes')
        .select('*')
        .gte('data_sessao', `${anoFiltro}-01-01`)
        .lte('data_sessao', `${anoFiltro}-12-31`)
        .order('data_sessao', { ascending: false });
      if (error) throw error;
      setSessoes(data || []);
    } catch (e) {
      showError ? showError('Erro ao carregar sessões do Arco Real.') : console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const abrirModalNovo = () => {
    setForm({ dataSessao: '', classificacao: '', observacoes: '' });
    setEditando(null);
    setMensagem({ tipo: '', texto: '' });
    setModalAberto(true);
  };

  const abrirModalEditar = (sessao) => {
    setForm({
      dataSessao: sessao.data_sessao,
      classificacao: sessao.classificacao || '',
      observacoes: sessao.observacoes || '',
    });
    setEditando(sessao.id);
    setMensagem({ tipo: '', texto: '' });
    setModalAberto(true);
  };

  const fecharModal = () => { setModalAberto(false); setEditando(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.dataSessao) { setMensagem({ tipo: 'erro', texto: 'Informe a data da sessão.' }); return; }
    setSalvando(true);
    try {
      const payload = {
        data_sessao: form.dataSessao,
        classificacao: form.classificacao || null,
        observacoes: form.observacoes || null,
      };
      if (editando) {
        const { error } = await supabase.from('arco_real_sessoes').update(payload).eq('id', editando).select();
        if (error) throw error;
      } else {
        const { error } = await supabase.from('arco_real_sessoes').insert([payload]);
        if (error) throw error;
      }
      setMensagem({ tipo: 'sucesso', texto: editando ? 'Sessão atualizada!' : 'Sessão cadastrada!' });
      carregarSessoes();
      showSuccess?.(editando ? 'Sessão atualizada!' : 'Sessão cadastrada!');
      setTimeout(fecharModal, 700);
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: err.message || 'Erro ao salvar sessão.' });
    } finally {
      setSalvando(false);
    }
  };

  const excluirSessao = async (id) => {
    try {
      const { error } = await supabase.from('arco_real_sessoes').delete().eq('id', id).select();
      if (error) throw error;
      showSuccess?.('Sessão excluída com sucesso!');
      setConfirmExcluir(null);
      carregarSessoes();
    } catch (e) {
      showError ? showError('Erro ao excluir sessão.') : console.error(e);
    }
  };

  return (
    <div style={{ padding: '1.5rem', background: 'var(--color-bg)', minHeight: '100vh' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--color-text)', margin: 0 }}>📋 Sessões — Arco Real</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: '0.2rem 0 0' }}>
            Gerencie as sessões do Capítulo Guardiões da Aliança nº 04
          </p>
        </div>
        <button onClick={abrirModalNovo} style={{
          height: '40px', padding: '0 1.1rem', background: 'linear-gradient(135deg,#1e3a5f,#2d6a9f)', color: '#fff',
          border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: '700', fontSize: '0.85rem',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
        }}>
          ➕ Nova Sessão
        </button>
      </div>

      {/* Lista */}
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
          {['DATA', 'OBSERVAÇÃO', 'CLASSIFICAÇÃO', 'AÇÕES'].map((h, i) => (
            <div key={h} style={{ fontSize: '0.67rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: i === 3 ? 'right' : 'left' }}>{h}</div>
          ))}
        </div>

        {/* Linhas */}
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Carregando...</div>
        ) : sessoes.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            Nenhuma sessão cadastrada em {anoFiltro}.
          </div>
        ) : sessoes.map((s, idx) => {
          const [bgCl, txtCl, bdCl] = corClassificacao(s.classificacao);
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
                {s.observacoes ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text)', margin: 0, wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'normal', maxWidth: '100%' }}>
                    💬 {s.observacoes}
                  </p>
                ) : (
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>—</span>
                )}
              </div>
              <div>
                {s.classificacao ? (
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', padding: '0.18rem 0.55rem', borderRadius: '999px', background: bgCl, color: txtCl, border: `1px solid ${bdCl}` }}>
                    {s.classificacao}
                  </span>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>—</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                <button onClick={() => onAbrirPresenca(s.id)} style={{ padding: '0.25rem 0.6rem', background: 'rgba(45,106,159,0.15)', color: '#2d6a9f', border: '1px solid rgba(45,106,159,0.4)', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}>
                  📋 Presença
                </button>
                <button onClick={() => abrirModalEditar(s)} style={{ padding: '0.25rem 0.6rem', background: 'rgba(99,102,241,0.12)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}>
                  ✏️
                </button>
                <button onClick={() => setConfirmExcluir(s)} style={{ padding: '0.25rem 0.6rem', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}>
                  🗑
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL — Nova/Editar Sessão */}
      {modalAberto && (
        <div onClick={fecharModal} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.1rem 1.4rem', background: 'linear-gradient(135deg,#1e3a5f,#2d6a9f)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: '#fff' }}>
                  {editando ? 'Editar Sessão' : 'Nova Sessão'}
                </h3>
                <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(255,255,255,0.75)' }}>Arco Real</p>
              </div>
              <button onClick={fecharModal} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.3rem', cursor: 'pointer', padding: '0.2rem 0.5rem', lineHeight: 1 }}>✕</button>
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
                <label style={lbl}>Classificação</label>
                <select value={form.classificacao} onChange={e => setForm(f => ({ ...f, classificacao: e.target.value }))} style={inp}>
                  <option value="">Sem classificação</option>
                  {CLASSIFICACOES.map(c => <option key={c} value={c}>{c}</option>)}
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
                <button type="submit" disabled={salvando} style={{ flex: 2, height: '40px', background: salvando ? 'var(--color-surface-3)' : 'linear-gradient(135deg,#1e3a5f,#2d6a9f)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: '700', fontSize: '0.85rem', cursor: salvando ? 'not-allowed' : 'pointer' }}>
                  {salvando ? 'Salvando...' : editando ? '✏️ Atualizar Sessão' : '✅ Cadastrar Sessão'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmar exclusão */}
      {confirmExcluir && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1rem' }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.5rem', maxWidth: '400px', width: '100%' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.5rem' }}>Excluir sessão?</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
              {new Date(confirmExcluir.data_sessao + 'T00:00:00').toLocaleDateString('pt-BR')}
              <span style={{ display: 'block', marginTop: '0.5rem', color: '#f59e0b', fontWeight: 600 }}>
                ⚠️ Isso também excluirá os registros de presença associados a esta sessão.
              </span>
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmExcluir(null)} style={{ padding: '0.55rem 1.1rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={() => excluirSessao(confirmExcluir.id)} style={{ padding: '0.55rem 1.25rem', borderRadius: 'var(--radius-md)', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', fontWeight: 600, cursor: 'pointer' }}>
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
