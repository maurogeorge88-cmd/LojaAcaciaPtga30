import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { formatarData } from '../../utils/formatters';
import { TIPOS_EDITAL, formatarNumeroEdital, anoDeData, proximoNumeroEdital } from '../../utils/editais';

// ════════════════════════════════════════════════════════════════════════
// EDITAIS — controle único (Expedientes → Editais)
// Numeração sequencial POR ANO, compartilhada entre todos os tipos.
// Os editais de Eleição/Posse (Loja) e da Eleição GLEMT são emitidos nas
// próprias telas e aparecem aqui automaticamente, com a descrição.
// ════════════════════════════════════════════════════════════════════════

const COR_TIPO = {
  eleicao_loja: '#3b82f6',
  posse_loja: '#10b981',
  eleicao_glemt: '#8b5cf6',
  outro: '#94a3b8',
};

const lab = { fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.35rem' };
const inp = { width: '100%', padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' };
const FORM_VAZIO = { tipo: 'outro', data_edital: '', descricao: '', numero: '' };
const COLUNAS = '90px 90px 150px 1fr 120px';

const Editais = ({ editais = [], onUpdate, showSuccess, showError, permissoes, grauUsuario }) => {
  const [form, setForm] = useState(FORM_VAZIO);
  const [editando, setEditando] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState('');
  const [anoSelecionado, setAnoSelecionado] = useState(null);
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [visualizando, setVisualizando] = useState(null);

  const podeEditar = !!permissoes?.pode_editar_balaustres;

  const fechar = () => { setForm(FORM_VAZIO); setEditando(null); setModalAberto(false); };

  const abrirNovo = () => { setForm(FORM_VAZIO); setEditando(null); setModalAberto(true); };

  const abrirEdicao = (ed) => {
    setEditando(ed);
    setForm({ tipo: ed.tipo || 'outro', data_edital: ed.data_edital || '', descricao: ed.descricao || '', numero: ed.numero });
    setModalAberto(true);
  };

  const salvar = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data_edital = form.data_edital || null;
      if (editando) {
        const numero = parseInt(form.numero);
        if (!numero || numero < 1) throw new Error('Informe um número válido.');
        const { data, error } = await supabase.from('editais')
          .update({ tipo: form.tipo, data_edital, descricao: form.descricao.trim(), numero, ano: anoDeData(data_edital) })
          .eq('id', editando.id).select();
        if (error) throw error;
        if (!data?.length) throw new Error('o banco não permitiu a alteração (sem permissão).');
        showSuccess('Edital atualizado!');
      } else {
        const ano = anoDeData(data_edital);
        let ok = false;
        for (let t = 0; t < 4 && !ok; t++) {
          const numero = await proximoNumeroEdital(ano);
          const { error } = await supabase.from('editais')
            .insert([{ numero, ano, tipo: form.tipo, data_edital, descricao: form.descricao.trim() }]);
          if (!error) { ok = true; showSuccess(`Edital nº ${formatarNumeroEdital(numero, ano)} registrado!`); }
          else if (error.code !== '23505') throw error;
        }
        if (!ok) throw new Error('conflito de numeração, tente novamente.');
      }
      fechar();
      onUpdate?.();
    } catch (err) {
      const dup = err?.code === '23505' || /duplicate|unique/i.test(err?.message || '');
      showError('Erro ao salvar edital: ' + (dup ? 'esse número já existe no ano.' : err.message));
    } finally {
      setLoading(false);
    }
  };

  const excluir = async (ed) => {
    const vinc = ed.origem_id ? '\nEle está vinculado a uma Eleição/Posse: o vínculo será desfeito e será preciso emitir outro.' : '';
    if (!window.confirm(`Excluir o edital nº ${formatarNumeroEdital(ed.numero, ed.ano)}?${vinc}`)) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from('editais').delete().eq('id', ed.id).select();
      if (error) throw error;
      if (!data?.length) throw new Error('o banco não permitiu a exclusão (sem permissão).');
      showSuccess('Edital excluído!');
      onUpdate?.();
    } catch (err) {
      showError('Erro ao excluir edital: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const anosDisponiveis = [...new Set(editais.map(e => e.ano))].sort((a, b) => b - a);

  const filtrados = editais.filter(e => {
    if (anoSelecionado && e.ano !== anoSelecionado) return false;
    if (tipoFiltro && e.tipo !== tipoFiltro) return false;
    if (!busca) return true;
    const t = busca.toLowerCase();
    return formatarNumeroEdital(e.numero, e.ano).includes(t) || (e.descricao || '').toLowerCase().includes(t) || (TIPOS_EDITAL[e.tipo] || '').toLowerCase().includes(t);
  }).sort((a, b) => (b.ano - a.ano) || (b.numero - a.numero));

  // Mesma regra das Pranchas: Aprendiz e Companheiro não acessam
  if (grauUsuario && ['aprendiz', 'companheiro'].includes(grauUsuario.toLowerCase())) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center rounded-lg p-8 max-w-md" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--color-text)' }}>Acesso Restrito</h2>
          <p className="text-sm">Editais são documentos oficiais de nível <strong>Mestre</strong>.</p>
        </div>
      </div>
    );
  }

  const grupos = filtrados.reduce((acc, e) => { (acc[e.ano] = acc[e.ano] || []).push(e); return acc; }, {});
  const anosGrupo = Object.keys(grupos).map(Number).sort((a, b) => b - a);

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh', padding: '0.5rem', overflowX: 'hidden' }}>

      {/* MODAL CADASTRO/EDIÇÃO */}
      {modalAberto && podeEditar && (
        <div onClick={fechar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem 1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)', width: '100%', maxWidth: '560px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.1rem 1.4rem', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.2rem' }}>📢</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: 'var(--color-text)' }}>{editando ? 'Editar Edital' : 'Novo Edital'}</h3>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                    {editando ? 'Atualize os dados do edital' : 'O número é gerado automaticamente (sequência do ano)'}
                  </p>
                </div>
              </div>
              <button onClick={fechar} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.3rem', cursor: 'pointer', padding: '0.2rem 0.5rem', lineHeight: 1 }}>✕</button>
            </div>

            <form onSubmit={salvar} style={{ padding: '1.4rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: editando ? '1fr 1fr 1fr' : '1fr 1fr', gap: '0.75rem' }}>
                {editando && (
                  <div>
                    <label style={lab}>Número *</label>
                    <input type="number" min="1" required value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} style={inp} />
                  </div>
                )}
                <div>
                  <label style={lab}>Data do Edital *</label>
                  <input type="date" required value={form.data_edital} onChange={e => setForm({ ...form, data_edital: e.target.value })} style={inp} />
                </div>
                <div>
                  <label style={lab}>Tipo *</label>
                  <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} style={inp}>
                    {Object.entries(TIPOS_EDITAL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={lab}>Descrição *</label>
                <input type="text" required value={form.descricao} placeholder="Ex: Edital de Convocação para Sessão Magna"
                  onChange={e => setForm({ ...form, descricao: e.target.value })} style={inp} />
              </div>
              <div style={{ display: 'flex', gap: '0.65rem', paddingTop: '0.25rem' }}>
                <button type="button" onClick={fechar}
                  style={{ flex: 1, height: '40px', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={loading}
                  style={{ flex: 2, height: '40px', background: loading ? 'var(--color-surface-3)' : 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: '700', fontSize: '0.85rem', cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {loading ? 'Salvando...' : editando ? '✏️ Atualizar Edital' : '✅ Registrar Edital'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BOTÃO NOVO */}
      {podeEditar && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
          <button onClick={abrirNovo}
            style={{ height: '38px', padding: '0 1rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer' }}>
            ➕ Novo Edital
          </button>
        </div>
      )}

      {/* BUSCA + FILTROS */}
      <div className="rounded-xl p-4 mb-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="flex gap-3 flex-wrap items-center">
          <input type="text" placeholder="🔍 Buscar por número, tipo ou descrição..." value={busca} onChange={e => setBusca(e.target.value)}
            className="flex-1 px-4 py-2 border rounded-lg outline-none"
            style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', minWidth: '200px' }} />
          <select value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value)}
            style={{ padding: '0.3rem 0.75rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text)', fontSize: '0.85rem', outline: 'none' }}>
            <option value="">Todos os tipos</option>
            {Object.entries(TIPOS_EDITAL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {anosDisponiveis.length >= 1 && (
            <select value={anoSelecionado ?? ''} onChange={e => setAnoSelecionado(e.target.value ? parseInt(e.target.value) : null)}
              style={{ padding: '0.3rem 0.75rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text)', fontSize: '0.85rem', outline: 'none' }}>
              <option value="">Todos os anos</option>
              {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* LISTA */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="p-4" style={{ background: 'var(--color-accent)' }}>
          <h3 className="text-xl font-bold" style={{ color: '#fff' }}>Editais Registrados</h3>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>Total: {filtrados.length} edital(is) · numeração reinicia a cada ano</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: COLUNAS, background: 'var(--color-surface-2)', borderBottom: '2px solid var(--color-accent)', padding: '0.5rem 1rem' }}>
          {['Número', 'Data', 'Tipo', 'Descrição', 'Ações'].map((h, i) => (
            <div key={h} style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', textAlign: i === 4 ? 'center' : 'left' }}>{h}</div>
          ))}
        </div>

        <div className="p-3 space-y-2" style={{ width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
          {filtrados.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--color-text-faint)' }}>
              {busca || tipoFiltro || anoSelecionado ? 'Nenhum edital encontrado' : 'Nenhum edital cadastrado'}
            </div>
          ) : anosGrupo.map(ano => (
            <div key={ano}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.75rem 0 0.5rem', padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface-2)', borderLeft: '3px solid var(--color-accent)' }}>
                <span style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--color-accent)' }}>📅 {ano}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{grupos[ano].length} edital(is)</span>
              </div>
              {grupos[ano].map((ed, idx) => (
                <div key={ed.id}
                  style={{ display: 'grid', gridTemplateColumns: COLUNAS, alignItems: 'center', borderRadius: 'var(--radius-md)', background: idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)', marginBottom: '0.3rem', padding: '0.6rem 1rem', border: '1px solid var(--color-border)', borderLeft: `4px solid ${COR_TIPO[ed.tipo] || 'var(--color-accent)'}` }}>
                  <p style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--color-accent)', margin: 0 }}>{formatarNumeroEdital(ed.numero, ed.ano)}</p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: 0 }}>{ed.data_edital ? formatarData(ed.data_edital) : '—'}</p>
                  <div style={{ overflow: 'hidden', paddingRight: '0.5rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '999px', color: COR_TIPO[ed.tipo] || '#94a3b8', border: `1px solid ${COR_TIPO[ed.tipo] || '#94a3b8'}`, whiteSpace: 'nowrap' }}>{TIPOS_EDITAL[ed.tipo] || ed.tipo}</span>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--color-text)', margin: 0, paddingRight: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ed.descricao}>{ed.descricao}</p>
                  <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'center' }}>
                    <button onClick={() => setVisualizando(ed)} title="Visualizar"
                      style={{ padding: '0.25rem 0.5rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', cursor: 'pointer' }}>👁️</button>
                    {podeEditar && (<>
                      <button onClick={() => abrirEdicao(ed)}
                        style={{ padding: '0.25rem 0.5rem', background: 'var(--color-accent-bg)', color: 'var(--color-accent)', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', cursor: 'pointer' }}>✏️</button>
                      <button onClick={() => excluir(ed)}
                        style={{ padding: '0.25rem 0.5rem', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', cursor: 'pointer' }}>🗑️</button>
                    </>)}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* MODAL DE VISUALIZAÇÃO */}
      {visualizando && (
        <div onClick={() => setVisualizando(null)} className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div onClick={e => e.stopPropagation()} className="rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="p-5 flex justify-between items-center" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <h3 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>📢 Edital Nº {formatarNumeroEdital(visualizando.numero, visualizando.ano)}</h3>
              <button onClick={() => setVisualizando(null)} className="text-2xl" style={{ color: 'var(--color-text-muted)' }}>✕</button>
            </div>
            <div className="p-5 space-y-3">
              {[
                ['Tipo', TIPOS_EDITAL[visualizando.tipo] || visualizando.tipo],
                ['Data do edital', visualizando.data_edital ? formatarData(visualizando.data_edital) : '—'],
                ['Descrição', visualizando.descricao],
                ['Origem', visualizando.origem_id ? 'Vinculado a uma Eleição/Posse da Loja ou Eleição GLEMT' : 'Livre (ainda não vinculado a nenhuma eleição/posse)'],
              ].map(([k, v]) => (
                <div key={k} className="p-3 rounded-lg" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
                  <label className="block text-sm font-semibold mb-1" style={{ color: 'var(--color-text-muted)' }}>{k}</label>
                  <p className="text-base" style={{ color: 'var(--color-text)' }}>{v}</p>
                </div>
              ))}
              <div className="flex justify-end pt-2">
                <button onClick={() => setVisualizando(null)} className="px-6 py-2 bg-gray-500 text-white rounded-lg">Fechar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Editais;
