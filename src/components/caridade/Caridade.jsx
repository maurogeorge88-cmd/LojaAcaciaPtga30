/**
 * MÓDULO DE CARIDADE
 * Controle de Famílias Carentes e Ajudas
 */

import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function Caridade({ permissoes, showSuccess, showError }) {
  const [familias, setFamilias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [familiaEditando, setFamiliaEditando] = useState(null);

  const [modalFamilia, setModalFamilia] = useState(null);
  const [ajudasFamilia, setAjudasFamilia] = useState([]);

  const [modalNovaAjuda, setModalNovaAjuda] = useState(false);
  const [familiaParaAjuda, setFamiliaParaAjuda] = useState(null);
  const [modoEdicaoAjuda, setModoEdicaoAjuda] = useState(false);
  const [ajudaEditando, setAjudaEditando] = useState(null);

  const [familiaForm, setFamiliaForm] = useState({
    nome_marido: '', nome_esposa: '', tem_filhos: false, quantidade_filhos: 0,
    endereco: '', cidade: '', estado: 'MT', cep: '', telefone: '',
    marido_empregado: false, esposa_empregada: false,
    profissao_marido: '', profissao_esposa: '',
    descricao_situacao: '', observacoes: '', ativa: true
  });

  const [ajudaForm, setAjudaForm] = useState({
    data_ajuda: new Date().toISOString().split('T')[0],
    tipo_ajuda: 'Cesta Básica', descricao: '',
    valor_estimado: '', quantidade: '', responsavel_nome: ''
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('ativas');

  useEffect(() => { carregarFamilias(); }, []);

  const carregarFamilias = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('familias_carentes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setFamilias(data || []);
    } catch (error) {
      showError('Erro ao carregar famílias');
    } finally {
      setLoading(false);
    }
  };

  const carregarAjudas = async (familiaId) => {
    const { data, error } = await supabase
      .from('ajudas_caridade')
      .select('*')
      .eq('familia_id', familiaId)
      .order('data_ajuda', { ascending: false });
    if (!error) setAjudasFamilia(data || []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (modoEdicao) {
        const { error } = await supabase.from('familias_carentes').update(familiaForm).eq('id', familiaEditando.id);
        if (error) throw error;
        showSuccess('Família atualizada com sucesso!');
      } else {
        const { error } = await supabase.from('familias_carentes').insert([familiaForm]);
        if (error) throw error;
        showSuccess('Família cadastrada com sucesso!');
      }
      limparFormulario();
      carregarFamilias();
    } catch (error) {
      showError('Erro ao salvar família');
    }
  };

  const handleSubmitAjuda = async (e) => {
    e.preventDefault();
    try {
      if (modoEdicaoAjuda) {
        const { error } = await supabase.from('ajudas_caridade').update(ajudaForm).eq('id', ajudaEditando.id);
        if (error) throw error;
        showSuccess('Ajuda atualizada com sucesso!');
      } else {
        const { error } = await supabase.from('ajudas_caridade').insert([{ ...ajudaForm, familia_id: familiaParaAjuda.id }]);
        if (error) throw error;
        showSuccess('Ajuda registrada com sucesso!');
      }
      setModalNovaAjuda(false);
      limparFormularioAjuda();
      if (modalFamilia) carregarAjudas(familiaParaAjuda.id);
    } catch (error) {
      showError('Erro ao salvar ajuda');
    }
  };

  const handleEditar = (familia) => {
    setFamiliaForm(familia);
    setFamiliaEditando(familia);
    setModoEdicao(true);
    setMostrarForm(true);
  };

  const handleExcluir = async (id) => {
    if (!confirm('Tem certeza que deseja excluir esta família?')) return;
    try {
      const { error } = await supabase.from('familias_carentes').delete().eq('id', id);
      if (error) throw error;
      showSuccess('Família excluída com sucesso!');
      carregarFamilias();
    } catch (error) {
      showError('Erro ao excluir família');
    }
  };

  const handleExcluirAjuda = async (ajudaId) => {
    if (!confirm('Tem certeza que deseja excluir esta ajuda?')) return;
    try {
      const { error } = await supabase.from('ajudas_caridade').delete().eq('id', ajudaId);
      if (error) throw error;
      showSuccess('Ajuda excluída com sucesso!');
      carregarAjudas(modalFamilia.id);
    } catch (error) {
      showError('Erro ao excluir ajuda');
    }
  };

  const handleEditarAjuda = (ajuda) => {
    setAjudaForm({
      data_ajuda: ajuda.data_ajuda, tipo_ajuda: ajuda.tipo_ajuda,
      descricao: ajuda.descricao || '', valor_estimado: ajuda.valor_estimado || '',
      quantidade: ajuda.quantidade || '', responsavel_nome: ajuda.responsavel_nome || ''
    });
    setAjudaEditando(ajuda);
    setModoEdicaoAjuda(true);
    setFamiliaParaAjuda(modalFamilia);
    setModalNovaAjuda(true);
  };

  const handleVisualizarFamilia = async (familia) => {
    setModalFamilia(familia);
    await carregarAjudas(familia.id);
  };

  const limparFormulario = () => {
    setFamiliaForm({
      nome_marido: '', nome_esposa: '', tem_filhos: false, quantidade_filhos: 0,
      endereco: '', cidade: '', estado: 'MT', cep: '', telefone: '',
      marido_empregado: false, esposa_empregada: false,
      profissao_marido: '', profissao_esposa: '',
      descricao_situacao: '', observacoes: '', ativa: true
    });
    setModoEdicao(false);
    setFamiliaEditando(null);
    setMostrarForm(false);
  };

  const limparFormularioAjuda = () => {
    setAjudaForm({
      data_ajuda: new Date().toISOString().split('T')[0],
      tipo_ajuda: 'Cesta Básica', descricao: '',
      valor_estimado: '', quantidade: '', responsavel_nome: ''
    });
    setModoEdicaoAjuda(false);
    setAjudaEditando(null);
  };

  const abrirModalAjuda = (familia) => {
    setFamiliaParaAjuda(familia);
    limparFormularioAjuda();
    setModalNovaAjuda(true);
  };

  const familiasFiltradas = familias.filter(f => {
    const matchSearch =
      f.nome_marido?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.nome_esposa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.endereco?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus =
      filtroStatus === 'todas' ? true :
      filtroStatus === 'ativas' ? f.ativa : !f.ativa;
    return matchSearch && matchStatus;
  });

  const totalFamilias = familias.length;
  const familiasAtivas = familias.filter(f => f.ativa).length;
  const totalPessoas = familias.reduce((acc, f) => {
    let total = 0;
    if (f.nome_marido) total++;
    if (f.nome_esposa) total++;
    if (f.tem_filhos) total += f.quantidade_filhos || 0;
    return acc + total;
  }, 0);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--color-accent)' }}></div>
      </div>
    );
  }

  const btnStyle = (bg) => ({
    background: bg, color: 'white', border: 'none',
    borderRadius: '0.375rem', padding: '0.375rem 0.75rem',
    fontSize: '0.875rem', fontWeight: '500', cursor: 'pointer'
  });

  const overlayStyle = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999, padding: '1rem'
  };

  return (
    <div className="space-y-6" style={{background:"var(--color-bg)",minHeight:"100vh",padding:"0.5rem",overflowX:"hidden"}}>
      {/* HEADER */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>❤️ Caridade</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Controle de Famílias Carentes</p>
          </div>
          {permissoes?.pode_editar_caridade && (
            <button
              onClick={() => { limparFormulario(); setMostrarForm(!mostrarForm); }}
              style={{
                background: 'var(--color-accent)', color: 'white',
                border: 'none', borderRadius: '0.5rem',
                padding: '0.625rem 1.25rem', fontWeight: '600', cursor: 'pointer'
              }}
            >
              {mostrarForm ? '✖️ Fechar' : '➕ Nova Família'}
            </button>
          )}
        </div>
      </div>

      {/* CARDS DE RESUMO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { emoji: '👨‍👩‍👧‍👦', label: 'Total de Famílias', value: totalFamilias },
          { emoji: '✅',         label: 'Famílias Ativas',  value: familiasAtivas },
          { emoji: '👥',         label: 'Total de Pessoas', value: totalPessoas   },
        ].map(card => (
          <div key={card.label} className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{card.label}</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--color-accent)' }}>{card.value}</p>
              </div>
              <div className="text-4xl">{card.emoji}</div>
            </div>
          </div>
        ))}
      </div>

      {/* FORMULÁRIO CADASTRO */}
      {(mostrarForm && permissoes?.pode_editar_caridade) && (
        <div className="card rounded-xl shadow-lg">
          <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem', marginBottom: '0.5rem' }}>
            <h3 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
              {modoEdicao ? '✏️ Editar Família' : '➕ Cadastrar Nova Família'}
            </h3>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div>
              <h4 className="text-base font-semibold mb-3" style={{ color: 'var(--color-text)' }}>👫 Dados do Casal</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Nome do Marido</label>
                  <input type="text" className="form-input" value={familiaForm.nome_marido} onChange={(e) => setFamiliaForm({ ...familiaForm, nome_marido: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Nome da Esposa</label>
                  <input type="text" className="form-input" value={familiaForm.nome_esposa} onChange={(e) => setFamiliaForm({ ...familiaForm, nome_esposa: e.target.value })} />
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-base font-semibold mb-3" style={{ color: 'var(--color-text)' }}>👶 Filhos</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={familiaForm.tem_filhos} onChange={(e) => setFamiliaForm({ ...familiaForm, tem_filhos: e.target.checked })} className="w-5 h-5 rounded" style={{ accentColor: 'var(--color-accent)' }} />
                  <label className="form-label" style={{ marginBottom: 0 }}>Tem filhos?</label>
                </div>
                {familiaForm.tem_filhos && (
                  <div>
                    <label className="form-label">Quantidade de Filhos</label>
                    <input type="number" min="0" className="form-input" value={familiaForm.quantidade_filhos} onChange={(e) => setFamiliaForm({ ...familiaForm, quantidade_filhos: parseInt(e.target.value) || 0 })} />
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-base font-semibold mb-3" style={{ color: 'var(--color-text)' }}>📍 Endereço</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="form-label">Endereço Completo *</label>
                  <input type="text" className="form-input" value={familiaForm.endereco} onChange={(e) => setFamiliaForm({ ...familiaForm, endereco: e.target.value })} required />
                </div>
                <div>
                  <label className="form-label">Cidade</label>
                  <input type="text" className="form-input" value={familiaForm.cidade} onChange={(e) => setFamiliaForm({ ...familiaForm, cidade: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Estado</label>
                  <input type="text" className="form-input" value={familiaForm.estado} onChange={(e) => setFamiliaForm({ ...familiaForm, estado: e.target.value })} maxLength="2" />
                </div>
                <div>
                  <label className="form-label">CEP</label>
                  <input type="text" className="form-input" value={familiaForm.cep} onChange={(e) => setFamiliaForm({ ...familiaForm, cep: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Telefone</label>
                  <input type="text" className="form-input" value={familiaForm.telefone} onChange={(e) => setFamiliaForm({ ...familiaForm, telefone: e.target.value })} />
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-base font-semibold mb-3" style={{ color: 'var(--color-text)' }}>💼 Situação de Emprego</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <input type="checkbox" checked={familiaForm.marido_empregado} onChange={(e) => setFamiliaForm({ ...familiaForm, marido_empregado: e.target.checked })} className="w-5 h-5 rounded" style={{ accentColor: 'var(--color-accent)' }} />
                    <label className="form-label" style={{ marginBottom: 0 }}>Marido empregado?</label>
                  </div>
                  {familiaForm.marido_empregado && (
                    <input type="text" placeholder="Profissão do marido" className="form-input" value={familiaForm.profissao_marido} onChange={(e) => setFamiliaForm({ ...familiaForm, profissao_marido: e.target.value })} />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <input type="checkbox" checked={familiaForm.esposa_empregada} onChange={(e) => setFamiliaForm({ ...familiaForm, esposa_empregada: e.target.checked })} className="w-5 h-5 rounded" style={{ accentColor: 'var(--color-accent)' }} />
                    <label className="form-label" style={{ marginBottom: 0 }}>Esposa empregada?</label>
                  </div>
                  {familiaForm.esposa_empregada && (
                    <input type="text" placeholder="Profissão da esposa" className="form-input" value={familiaForm.profissao_esposa} onChange={(e) => setFamiliaForm({ ...familiaForm, profissao_esposa: e.target.value })} />
                  )}
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-base font-semibold mb-3" style={{ color: 'var(--color-text)' }}>📝 Situação Familiar</h4>
              <div className="space-y-4">
                <div>
                  <label className="form-label">Descrição da Situação *</label>
                  <textarea className="form-input" rows="4" value={familiaForm.descricao_situacao} onChange={(e) => setFamiliaForm({ ...familiaForm, descricao_situacao: e.target.value })} required />
                </div>
                <div>
                  <label className="form-label">Observações</label>
                  <textarea className="form-input" rows="3" value={familiaForm.observacoes} onChange={(e) => setFamiliaForm({ ...familiaForm, observacoes: e.target.value })} />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={familiaForm.ativa} onChange={(e) => setFamiliaForm({ ...familiaForm, ativa: e.target.checked })} className="w-5 h-5 rounded" style={{ accentColor: 'var(--color-accent)' }} />
                  <label className="form-label" style={{ marginBottom: 0 }}>Família ativa (recebendo ajuda atualmente)</label>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" style={{ background: 'var(--color-accent)', color: 'white', border: 'none', borderRadius: '0.5rem', padding: '0.75rem 1.5rem', fontWeight: '600', cursor: 'pointer' }}>
                {modoEdicao ? '💾 Atualizar' : '💾 Cadastrar'}
              </button>
              <button type="button" onClick={limparFormulario} style={{ background: 'var(--color-surface-3)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.75rem 1.5rem', fontWeight: '600', cursor: 'pointer' }}>
                ❌ Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FILTROS */}
      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <input type="text" placeholder="🔍 Buscar por nome ou endereço..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="form-input flex-1" />
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="form-input">
            <option value="todas">Todas</option>
            <option value="ativas">Ativas</option>
            <option value="inativas">Inativas</option>
          </select>
        </div>
      </div>

      {/* LISTA DE FAMÍLIAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {familiasFiltradas.map((familia) => (
          <div key={familia.id} className="card rounded-lg shadow-lg overflow-hidden"
            style={{ borderLeft: `4px solid ${familia.ativa ? 'var(--color-accent)' : 'var(--color-border)'}` }}
          >
            <div className="p-6">
              <div className="mb-3">
                <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{
                  background: familia.ativa ? 'rgba(34,197,94,0.15)' : 'var(--color-surface-3)',
                  color: familia.ativa ? '#16a34a' : 'var(--color-text-secondary)'
                }}>
                  {familia.ativa ? '✅ Ativa' : '⏸️ Inativa'}
                </span>
              </div>

              <div className="space-y-1 mb-3">
                {familia.nome_marido && (
                  <div className="flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                    <span>👨</span><span className="font-semibold">{familia.nome_marido}</span>
                  </div>
                )}
                {familia.nome_esposa && (
                  <div className="flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                    <span>👩</span><span className="font-semibold">{familia.nome_esposa}</span>
                  </div>
                )}
              </div>

              {familia.tem_filhos && (
                <div className="flex items-center gap-2 mb-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  <span>👶</span>
                  <span>{familia.quantidade_filhos} {familia.quantidade_filhos === 1 ? 'filho' : 'filhos'}</span>
                </div>
              )}

              <div className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                📍 {familia.endereco}{familia.cidade && `, ${familia.cidade}`}{familia.estado && `-${familia.estado}`}
              </div>

              <div className="flex gap-2 mb-3">
                {!familia.marido_empregado && !familia.esposa_empregada && (
                  <span className="px-2 py-1 rounded text-xs" style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626' }}>⚠️ Ambos desempregados</span>
                )}
                {familia.marido_empregado && familia.esposa_empregada && (
                  <span className="px-2 py-1 rounded text-xs" style={{ background: 'rgba(34,197,94,0.1)', color: '#16a34a' }}>✅ Ambos empregados</span>
                )}
                {(familia.marido_empregado || familia.esposa_empregada) && !(familia.marido_empregado && familia.esposa_empregada) && (
                  <span className="px-2 py-1 rounded text-xs" style={{ background: 'rgba(234,179,8,0.1)', color: '#ca8a04' }}>⚠️ Emprego parcial</span>
                )}
              </div>

              <p className="text-sm mb-4 line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>
                {familia.descricao_situacao}
              </p>

              <div className="flex gap-2">
                <button onClick={() => handleVisualizarFamilia(familia)} style={{ ...btnStyle('var(--color-accent)'), flex: 1 }}>
                  👁️ Ver Detalhes
                </button>
                {permissoes?.pode_editar_caridade && (
                  <>
                    <button onClick={() => abrirModalAjuda(familia)} style={btnStyle('#16a34a')} title="Registrar Ajuda">➕</button>
                    <button onClick={() => handleEditar(familia)} style={btnStyle('#ca8a04')} title="Editar">✏️</button>
                    <button onClick={() => handleExcluir(familia.id)} style={btnStyle('#dc2626')} title="Excluir">🗑️</button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {familiasFiltradas.length === 0 && (
        <div className="text-center py-12 rounded-lg" style={{ background: 'var(--color-surface-3)' }}>
          <div className="text-6xl mb-4">❤️</div>
          <p style={{ color: 'var(--color-text-secondary)' }}>Nenhuma família encontrada</p>
        </div>
      )}

      {/* MODAL VISUALIZAÇÃO DA FAMÍLIA */}
      {modalFamilia && (
        <div style={overlayStyle}>
          <div className="card" style={{ maxWidth: '56rem', width: '100%', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border)' }}>
              <h3 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Detalhes da Família</h3>
              <button onClick={() => setModalFamilia(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--color-text-muted)' }}>✖️</button>
            </div>

            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }} className="space-y-5">
              <div>
                <h4 className="text-base font-bold mb-3" style={{ color: 'var(--color-text)' }}>👫 Família</h4>
                <div className="rounded-lg p-4 space-y-2" style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)' }}>
                  {modalFamilia.nome_marido && <p style={{ color: 'var(--color-text)' }}><strong>Marido:</strong> {modalFamilia.nome_marido}</p>}
                  {modalFamilia.nome_esposa && <p style={{ color: 'var(--color-text)' }}><strong>Esposa:</strong> {modalFamilia.nome_esposa}</p>}
                  {modalFamilia.tem_filhos && <p style={{ color: 'var(--color-text)' }}><strong>Filhos:</strong> {modalFamilia.quantidade_filhos}</p>}
                  <p style={{ color: 'var(--color-text)' }}><strong>Endereço:</strong> {modalFamilia.endereco}, {modalFamilia.cidade}-{modalFamilia.estado}</p>
                  {modalFamilia.telefone && <p style={{ color: 'var(--color-text)' }}><strong>Telefone:</strong> {modalFamilia.telefone}</p>}
                </div>
              </div>

              <div>
                <h4 className="text-base font-bold mb-3" style={{ color: 'var(--color-text)' }}>💼 Situação de Emprego</h4>
                <div className="rounded-lg p-4 space-y-2" style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)' }}>
                  <p style={{ color: 'var(--color-text)' }}><strong>Marido:</strong> {modalFamilia.marido_empregado ? `✅ Empregado (${modalFamilia.profissao_marido || 'N/I'})` : '❌ Desempregado'}</p>
                  <p style={{ color: 'var(--color-text)' }}><strong>Esposa:</strong> {modalFamilia.esposa_empregada ? `✅ Empregada (${modalFamilia.profissao_esposa || 'N/I'})` : '❌ Desempregada'}</p>
                </div>
              </div>

              <div>
                <h4 className="text-base font-bold mb-3" style={{ color: 'var(--color-text)' }}>📝 Situação Familiar</h4>
                <div className="rounded-lg p-4" style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)' }}>
                  <p style={{ color: 'var(--color-text)' }}>{modalFamilia.descricao_situacao}</p>
                  {modalFamilia.observacoes && (
                    <>
                      <hr style={{ borderColor: 'var(--color-border)', margin: '0.75rem 0' }} />
                      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}><strong>Observações:</strong> {modalFamilia.observacoes}</p>
                    </>
                  )}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-base font-bold" style={{ color: 'var(--color-text)' }}>🎁 Histórico de Ajudas</h4>
                  {permissoes?.pode_editar_caridade && (
                    <button onClick={() => { setFamiliaParaAjuda(modalFamilia); setModalNovaAjuda(true); }} style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: '0.375rem', padding: '0.375rem 0.875rem', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}>
                      ➕ Nova Ajuda
                    </button>
                  )}
                </div>

                {ajudasFamilia.length === 0 ? (
                  <div className="p-6 rounded-lg text-center" style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-secondary)' }}>
                    Nenhuma ajuda registrada ainda
                  </div>
                ) : (
                  <div className="space-y-3">
                    {ajudasFamilia.map((ajuda) => (
                      <div key={ajuda.id} className="p-4 rounded-lg" style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)', borderLeft: '4px solid var(--color-accent)' }}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{ajuda.tipo_ajuda}</span>
                              {ajuda.quantidade && (
                                <span className="px-2 py-0.5 rounded text-xs" style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                                  {ajuda.quantidade}
                                </span>
                              )}
                            </div>
                            <p className="text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                              📅 {new Date(ajuda.data_ajuda + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </p>
                            {ajuda.descricao && <p className="text-sm mb-1" style={{ color: 'var(--color-text)' }}>{ajuda.descricao}</p>}
                            {ajuda.valor_estimado && <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>💰 R$ {parseFloat(ajuda.valor_estimado).toFixed(2)}</p>}
                            {ajuda.responsavel_nome && <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>👤 {ajuda.responsavel_nome}</p>}
                          </div>
                          {permissoes?.pode_editar_caridade && (
                            <div className="flex gap-1 ml-2">
                              <button onClick={() => handleEditarAjuda(ajuda)} style={btnStyle('#ca8a04')} title="Editar">✏️</button>
                              <button onClick={() => handleExcluirAjuda(ajuda.id)} style={btnStyle('#dc2626')} title="Excluir">🗑️</button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVA/EDITAR AJUDA */}
      {modalNovaAjuda && familiaParaAjuda && (
        <div style={overlayStyle}>
          <div className="card" style={{ maxWidth: '42rem', width: '100%', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', margin: 0 }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border)' }}>
              <h3 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
                {modoEdicaoAjuda ? '✏️ Editar Ajuda' : '➕ Registrar Nova Ajuda'}
              </h3>
              <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                Para: {familiaParaAjuda.nome_marido || familiaParaAjuda.nome_esposa}
              </p>
            </div>

            <form onSubmit={handleSubmitAjuda} style={{ padding: '1.5rem', flex: 1, overflowY: 'auto' }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Data da Ajuda *</label>
                  <input type="date" className="form-input" value={ajudaForm.data_ajuda} onChange={(e) => setAjudaForm({ ...ajudaForm, data_ajuda: e.target.value })} required />
                </div>
                <div>
                  <label className="form-label">Tipo de Ajuda *</label>
                  <select className="form-input" value={ajudaForm.tipo_ajuda} onChange={(e) => setAjudaForm({ ...ajudaForm, tipo_ajuda: e.target.value })} required>
                    {['Cesta Básica','Alimentos','Roupas','Medicamentos','Material Escolar','Material de Construção','Móveis','Eletrodomésticos','Auxílio Financeiro','Outros'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Quantidade</label>
                  <input type="text" placeholder="Ex: 1 cesta, 5kg arroz..." className="form-input" value={ajudaForm.quantidade} onChange={(e) => setAjudaForm({ ...ajudaForm, quantidade: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Valor Estimado (R$)</label>
                  <input type="number" step="0.01" placeholder="0.00" className="form-input" value={ajudaForm.valor_estimado} onChange={(e) => setAjudaForm({ ...ajudaForm, valor_estimado: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <label className="form-label">Descrição</label>
                  <textarea className="form-input" rows="3" value={ajudaForm.descricao} onChange={(e) => setAjudaForm({ ...ajudaForm, descricao: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <label className="form-label">Responsável pela Entrega</label>
                  <input type="text" placeholder="Nome de quem entregou/organizou" className="form-input" value={ajudaForm.responsavel_nome} onChange={(e) => setAjudaForm({ ...ajudaForm, responsavel_nome: e.target.value })} />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t" style={{ borderColor: 'var(--color-border)', marginTop: '1rem' }}>
                <button type="submit" className="flex-1" style={{ background: 'var(--color-accent)', color: 'white', border: 'none', borderRadius: '0.5rem', padding: '0.75rem 1.5rem', fontWeight: '600', cursor: 'pointer' }}>
                  {modoEdicaoAjuda ? '💾 Atualizar Ajuda' : '💾 Registrar Ajuda'}
                </button>
                <button type="button" onClick={() => { setModalNovaAjuda(false); limparFormularioAjuda(); }} style={{ background: 'var(--color-surface-3)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.75rem 1.5rem', fontWeight: '600', cursor: 'pointer' }}>
                  ❌ Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
