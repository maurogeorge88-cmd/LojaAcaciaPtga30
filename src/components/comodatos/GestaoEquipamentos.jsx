import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function GestaoEquipamentos({ showSuccess, showError, permissoes }) {
  const [equipamentos, setEquipamentos] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [modalLote, setModalLote] = useState(false);
  const [modalTipo, setModalTipo] = useState(false);
  const [editando, setEditando] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('disponivel');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [busca, setBusca] = useState('');

  const [form, setForm] = useState({
    tipo_id: '',
    numero_patrimonio: '',
    descricao: '',
    estado_conservacao: 'Novo',
    data_aquisicao: '',
    valor_aquisicao: '',
    status: 'disponivel',
    observacoes: ''
  });

  const [formLote, setFormLote] = useState({
    tipo_id: '',
    prefixo_patrimonio: '',
    quantidade: 1,
    numero_inicial: 1,
    descricao: '',
    estado_conservacao: 'Novo',
    data_aquisicao: '',
    valor_aquisicao: '',
    observacoes: ''
  });

  const [formTipo, setFormTipo] = useState({
    nome: '',
    descricao: '',
    ativo: true
  });

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);

      const { data: tiposData, error: tiposError } = await supabase
        .from('tipos_equipamentos')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (tiposError) throw tiposError;
      setTipos(tiposData || []);

      const { data: equipData, error: equipError } = await supabase
        .from('equipamentos')
        .select(`
          *,
          tipos_equipamentos (
            id,
            nome
          )
        `)
        .order('created_at', { ascending: false });

      if (equipError) throw equipError;
      setEquipamentos(equipData || []);

      setLoading(false);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      showError('Erro ao carregar dados');
      setLoading(false);
    }
  };

  const abrirModal = (equipamento = null) => {
    if (equipamento) {
      setEditando(equipamento);
      setForm({
        tipo_id: equipamento.tipo_id,
        numero_patrimonio: equipamento.numero_patrimonio,
        descricao: equipamento.descricao || '',
        estado_conservacao: equipamento.estado_conservacao,
        data_aquisicao: equipamento.data_aquisicao || '',
        valor_aquisicao: equipamento.valor_aquisicao || '',
        status: equipamento.status,
        observacoes: equipamento.observacoes || ''
      });
    } else {
      setEditando(null);
      setForm({
        tipo_id: '',
        numero_patrimonio: '',
        descricao: '',
        estado_conservacao: 'Novo',
        data_aquisicao: '',
        valor_aquisicao: '',
        status: 'disponivel',
        observacoes: ''
      });
    }
    setModalAberto(true);
  };

  const salvarEquipamento = async (e) => {
    e.preventDefault();

    if (!form.tipo_id || !form.numero_patrimonio) {
      showError('Preencha os campos obrigatórios!');
      return;
    }

    try {
      const dados = {
        tipo_id: parseInt(form.tipo_id),
        numero_patrimonio: form.numero_patrimonio,
        descricao: form.descricao,
        estado_conservacao: form.estado_conservacao,
        data_aquisicao: form.data_aquisicao || null,
        valor_aquisicao: form.valor_aquisicao ? parseFloat(form.valor_aquisicao) : null,
        status: form.status,
        observacoes: form.observacoes
      };

      if (editando) {
        const { error } = await supabase
          .from('equipamentos')
          .update(dados)
          .eq('id', editando.id);

        if (error) throw error;
        showSuccess('Equipamento atualizado com sucesso!');
      } else {
        const { error } = await supabase
          .from('equipamentos')
          .insert([dados]);

        if (error) throw error;
        showSuccess('Equipamento cadastrado com sucesso!');
      }

      setModalAberto(false);
      carregarDados();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      showError(error.message || 'Erro ao salvar equipamento');
    }
  };

  const salvarLote = async (e) => {
    e.preventDefault();

    if (!formLote.tipo_id || !formLote.prefixo_patrimonio || formLote.quantidade < 1) {
      showError('Preencha os campos obrigatórios!');
      return;
    }

    try {
      const equipamentosLote = [];
      
      for (let i = 0; i < formLote.quantidade; i++) {
        const numeroPatrimonio = `${formLote.prefixo_patrimonio}-${String(formLote.numero_inicial + i).padStart(3, '0')}`;
        
        equipamentosLote.push({
          tipo_id: parseInt(formLote.tipo_id),
          numero_patrimonio: numeroPatrimonio,
          descricao: formLote.descricao,
          estado_conservacao: formLote.estado_conservacao,
          data_aquisicao: formLote.data_aquisicao || null,
          valor_aquisicao: formLote.valor_aquisicao ? parseFloat(formLote.valor_aquisicao) : null,
          status: 'disponivel',
          observacoes: formLote.observacoes
        });
      }

      const { error } = await supabase
        .from('equipamentos')
        .insert(equipamentosLote);

      if (error) throw error;

      showSuccess(`✅ ${formLote.quantidade} equipamento(s) cadastrado(s) com sucesso!`);
      setModalLote(false);
      setFormLote({
        tipo_id: '',
        prefixo_patrimonio: '',
        quantidade: 1,
        numero_inicial: 1,
        descricao: '',
        estado_conservacao: 'Novo',
        data_aquisicao: '',
        valor_aquisicao: '',
        observacoes: ''
      });
      carregarDados();
    } catch (error) {
      console.error('Erro ao salvar lote:', error);
      showError(error.message || 'Erro ao cadastrar equipamentos em lote');
    }
  };

  const excluirEquipamento = async (id) => {
    if (typeof window !== 'undefined' && !window.confirm('⚠️ ATENÇÃO! Esta ação NÃO pode ser desfeita.\n\nTem certeza que deseja EXCLUIR permanentemente este equipamento?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('equipamentos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showSuccess('Equipamento excluído permanentemente!');
      carregarDados();
    } catch (error) {
      console.error('Erro:', error);
      showError('Erro ao excluir equipamento: ' + error.message);
    }
  };

  const descartar = async (id) => {
    const motivo = prompt('Motivo do descarte:');
    if (!motivo) return;

    try {
      const { error } = await supabase
        .from('equipamentos')
        .update({
          status: 'descartado',
          motivo_descarte: motivo,
          data_descarte: new Date().toISOString().split('T')[0]
        })
        .eq('id', id);

      if (error) throw error;
      showSuccess('Equipamento descartado!');
      carregarDados();
    } catch (error) {
      console.error('Erro:', error);
      showError('Erro ao descartar equipamento');
    }
  };

  const salvarTipo = async (e) => {
    e.preventDefault();

    if (!formTipo.nome) {
      showError('Nome do tipo é obrigatório!');
      return;
    }

    try {
      const { data: tipoExistente } = await supabase
        .from('tipos_equipamentos')
        .select('id')
        .ilike('nome', formTipo.nome)
        .single();

      if (tipoExistente) {
        showError('Já existe um tipo com este nome!');
        return;
      }

      const { error } = await supabase
        .from('tipos_equipamentos')
        .insert([formTipo]);

      if (error) throw error;

      showSuccess('Tipo cadastrado com sucesso!');
      setModalTipo(false);
      setFormTipo({ nome: '', descricao: '', ativo: true });
      carregarDados();
    } catch (error) {
      console.error('Erro:', error);
      showError(error.message || 'Erro ao salvar tipo');
    }
  };

  const equipamentosFiltrados = equipamentos.filter(eq => {
    const statusEq = (eq.status || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const filtroStatusNorm = filtroStatus.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const matchStatus = filtroStatus === 'todos' || statusEq === filtroStatusNorm;
    const matchTipo = filtroTipo === 'todos' || eq.tipo_id === parseInt(filtroTipo);
    const matchBusca = eq.numero_patrimonio.toLowerCase().includes(busca.toLowerCase()) ||
                       eq.tipos_equipamentos?.nome.toLowerCase().includes(busca.toLowerCase());
    return matchStatus && matchTipo && matchBusca;
  });

  const getStatusBadge = (status) => {
    const styles = {
      disponivel: { background: 'rgba(34,197,94,0.15)', color: '#16a34a' },
      emprestado:  { background: 'rgba(59,130,246,0.15)', color: '#dc2626' },
      manutencao:  { background: 'rgba(234,179,8,0.15)',  color: '#ca8a04' },
      descartado:  { background: 'var(--color-surface-3)', color: 'var(--color-text-secondary)' }
    };
    const labels = {
      disponivel: '✅ Disponível',
      emprestado: '🔄 Emprestado',
      manutencao: '🔧 Manutenção',
      descartado: '🗑️ Descartado'
    };
    return (
      <span className="px-3 py-1 rounded-full text-xs font-semibold" style={styles[status]}>
        {labels[status]}
      </span>
    );
  };

  const getEstadoBadge = (estado) => {
    const styles = {
      'Novo':     { background: 'rgba(16,185,129,0.15)', color: '#059669' },
      'Bom':      { background: 'rgba(34,197,94,0.15)',  color: '#16a34a' },
      'Regular':  { background: 'rgba(234,179,8,0.15)',  color: '#ca8a04' },
      'Ruim':     { background: 'rgba(239,68,68,0.15)',  color: '#dc2626' }
    };
    return (
      <span className="px-2 py-1 rounded text-xs font-medium" style={styles[estado] || {}}>
        {estado}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--color-accent)' }}></div>
      </div>
    );
  }

  // Estilo reutilizável para botões de ação da tabela
  const btnAcao = (cor) => ({
    background: cor,
    color: 'white',
    border: 'none',
    borderRadius: '0.25rem',
    padding: '0.25rem 0.625rem',
    fontSize: '0.75rem',
    fontWeight: '500',
    cursor: 'pointer'
  });

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
            🛠️ Gestão de Equipamentos
          </h2>
          {permissoes?.pode_editar_comodatos && (
            <div className="flex gap-2">
              <button
                onClick={() => setModalTipo(true)}
                style={{
                  background: 'var(--color-surface-3)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '0.5rem',
                  padding: '0.5rem 1rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                ➕ Novo Tipo
              </button>
              <button
                onClick={() => setModalLote(true)}
                style={{
                  background: 'var(--color-surface-3)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '0.5rem',
                  padding: '0.5rem 1rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                📦 Cadastro em Lote
              </button>
              <button
                onClick={() => abrirModal()}
                style={{
                  background: 'var(--color-accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  padding: '0.5rem 1rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                ➕ Novo Equipamento
              </button>
            </div>
          )}
        </div>

        {/* FILTROS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="🔍 Buscar..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="form-input"
          />
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="form-input"
          >
            <option value="todos">Todos os Tipos</option>
            {tipos.map(tipo => (
              <option key={tipo.id} value={tipo.id}>{tipo.nome}</option>
            ))}
          </select>
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="form-input"
          >
            <option value="todos">Todos os Status</option>
            <option value="disponivel">✅ Disponível</option>
            <option value="emprestado">🔄 Emprestado</option>
            <option value="manutencao">🔧 Manutenção</option>
            <option value="descartado">🗑️ Descartado</option>
          </select>
          <div className="flex items-center" style={{ color: 'var(--color-text-secondary)' }}>
            <strong style={{ color: 'var(--color-text)' }}>{equipamentosFiltrados.length}</strong>
            <span className="ml-2">equipamento(s)</span>
          </div>
        </div>
      </div>

      {/* TABELA */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-3)', borderBottom: '1px solid var(--color-border)' }}>
                {['Patrimônio', 'Tipo', 'Status Uso', 'Conservação', 'Dt Aquisição'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--color-text-secondary)' }}>
                    {h}
                  </th>
                ))}
                {permissoes?.pode_editar_comodatos && (
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--color-text-secondary)' }}>
                    Ações
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {equipamentosFiltrados.map((equipamento, idx) => (
                <tr key={equipamento.id}
                    style={{
                      borderBottom: '1px solid var(--color-border)',
                      background: idx % 2 === 0 ? 'transparent' : 'var(--color-surface-3)'
                    }}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                      {equipamento.numero_patrimonio}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm" style={{ color: 'var(--color-text)' }}>
                      {equipamento.tipos_equipamentos?.nome}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {getStatusBadge(equipamento.status)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {getEstadoBadge(equipamento.estado_conservacao)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm" style={{ color: 'var(--color-text)' }}>
                      {equipamento.data_aquisicao
                        ? new Date(equipamento.data_aquisicao + 'T00:00:00').toLocaleDateString('pt-BR')
                        : '-'}
                    </span>
                  </td>
                  {permissoes?.pode_editar_comodatos && (
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => abrirModal(equipamento)}
                          style={btnAcao('var(--color-accent)')}
                          disabled={equipamento.status === 'descartado'}
                          title="Editar"
                        >
                          ✏️ Editar
                        </button>
                        {equipamento.status !== 'descartado' && equipamento.status !== 'emprestado' && (
                          <>
                            <button
                              onClick={() => descartar(equipamento.id)}
                              style={btnAcao('#ea580c')}
                              title="Descartar"
                            >
                              🗑️ Descartar
                            </button>
                            <button
                              onClick={() => excluirEquipamento(equipamento.id)}
                              style={btnAcao('#dc2626')}
                              title="Excluir permanentemente"
                            >
                              ❌ Excluir
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {equipamentosFiltrados.length === 0 && (
        <div className="text-center py-12" style={{ color: 'var(--color-text-secondary)' }}>
          <p className="text-xl">Nenhum equipamento encontrado</p>
        </div>
      )}

      {/* MODAL EQUIPAMENTO */}
      {modalAberto && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1rem'
        }}>
          <div className="card" style={{
            maxWidth: '42rem', width: '100%', maxHeight: '90vh',
            overflow: 'hidden', display: 'flex', flexDirection: 'column', margin: 0
          }}>
            <div className="card-header">
              <h3 className="text-2xl font-bold">
                {editando ? '✏️ Editar Equipamento' : '➕ Novo Equipamento'}
              </h3>
            </div>

            <form onSubmit={salvarEquipamento} style={{ padding: '1.5rem', flex: 1, overflowY: 'auto' }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Tipo de Equipamento *</label>
                  <select value={form.tipo_id} onChange={(e) => setForm({ ...form, tipo_id: e.target.value })} className="form-input" required>
                    <option value="">Selecione...</option>
                    {tipos.map(tipo => <option key={tipo.id} value={tipo.id}>{tipo.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Número do Patrimônio *</label>
                  <input type="text" value={form.numero_patrimonio} onChange={(e) => setForm({ ...form, numero_patrimonio: e.target.value })} className="form-input" required />
                </div>
                <div>
                  <label className="form-label">Estado de Conservação</label>
                  <select value={form.estado_conservacao} onChange={(e) => setForm({ ...form, estado_conservacao: e.target.value })} className="form-input">
                    <option value="Novo">Novo</option>
                    <option value="Bom">Bom</option>
                    <option value="Regular">Regular</option>
                    <option value="Ruim">Ruim</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="form-input">
                    <option value="disponivel">Disponível</option>
                    <option value="manutencao">Manutenção</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Data de Aquisição</label>
                  <input type="date" value={form.data_aquisicao} onChange={(e) => setForm({ ...form, data_aquisicao: e.target.value })} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Valor de Aquisição (R$)</label>
                  <input type="number" step="0.01" value={form.valor_aquisicao} onChange={(e) => setForm({ ...form, valor_aquisicao: e.target.value })} className="form-input" />
                </div>
                <div className="md:col-span-2">
                  <label className="form-label">Descrição</label>
                  <textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="form-input" rows="3" />
                </div>
                <div className="md:col-span-2">
                  <label className="form-label">Observações</label>
                  <textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} className="form-input" rows="2" />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t" style={{ borderColor: 'var(--color-border)', marginTop: '1rem' }}>
                <button type="submit" className="flex-1" style={{
                  background: 'var(--color-accent)', color: 'white', border: 'none',
                  borderRadius: '0.5rem', padding: '0.75rem 1.5rem', fontWeight: '600', cursor: 'pointer'
                }}>
                  💾 Salvar
                </button>
                <button type="button" onClick={() => setModalAberto(false)} style={{
                  background: 'var(--color-surface-3)', color: 'var(--color-text)',
                  border: '1px solid var(--color-border)', borderRadius: '0.5rem',
                  padding: '0.75rem 1.5rem', fontWeight: '600', cursor: 'pointer'
                }}>
                  ❌ Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CADASTRO EM LOTE */}
      {modalLote && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1rem'
        }}>
          <div className="card" style={{
            maxWidth: '42rem', width: '100%', maxHeight: '90vh',
            overflow: 'hidden', display: 'flex', flexDirection: 'column', margin: 0
          }}>
            <div className="card-header">
              <h3 className="text-2xl font-bold">📦 Cadastro em Lote</h3>
              <p className="text-sm mt-1" style={{ opacity: 0.8 }}>Cadastre vários equipamentos de uma vez</p>
            </div>

            <form onSubmit={salvarLote} style={{ padding: '1.5rem', flex: 1, overflowY: 'auto' }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Tipo de Equipamento *</label>
                  <select value={formLote.tipo_id} onChange={(e) => setFormLote({ ...formLote, tipo_id: e.target.value })} className="form-input" required>
                    <option value="">Selecione...</option>
                    {tipos.map(tipo => <option key={tipo.id} value={tipo.id}>{tipo.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Quantidade *</label>
                  <input type="number" min="1" max="1000" value={formLote.quantidade} onChange={(e) => setFormLote({ ...formLote, quantidade: parseInt(e.target.value) })} className="form-input" required />
                </div>
                <div>
                  <label className="form-label">Prefixo do Patrimônio *</label>
                  <input type="text" value={formLote.prefixo_patrimonio} onChange={(e) => setFormLote({ ...formLote, prefixo_patrimonio: e.target.value })} className="form-input" placeholder="Ex: CR" required />
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>Exemplo: CR-001, CR-002...</p>
                </div>
                <div>
                  <label className="form-label">Número Inicial *</label>
                  <input type="number" min="1" value={formLote.numero_inicial} onChange={(e) => setFormLote({ ...formLote, numero_inicial: parseInt(e.target.value) })} className="form-input" required />
                </div>
                <div>
                  <label className="form-label">Estado de Conservação</label>
                  <select value={formLote.estado_conservacao} onChange={(e) => setFormLote({ ...formLote, estado_conservacao: e.target.value })} className="form-input">
                    <option value="Novo">Novo</option>
                    <option value="Bom">Bom</option>
                    <option value="Regular">Regular</option>
                    <option value="Ruim">Ruim</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Data de Aquisição</label>
                  <input type="date" value={formLote.data_aquisicao} onChange={(e) => setFormLote({ ...formLote, data_aquisicao: e.target.value })} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Valor Unitário (R$)</label>
                  <input type="number" step="0.01" value={formLote.valor_aquisicao} onChange={(e) => setFormLote({ ...formLote, valor_aquisicao: e.target.value })} className="form-input" />
                </div>
                <div className="md:col-span-2">
                  <label className="form-label">Descrição (aplicada a todos)</label>
                  <textarea value={formLote.descricao} onChange={(e) => setFormLote({ ...formLote, descricao: e.target.value })} className="form-input" rows="2" />
                </div>
                <div className="md:col-span-2">
                  <label className="form-label">Observações (aplicadas a todos)</label>
                  <textarea value={formLote.observacoes} onChange={(e) => setFormLote({ ...formLote, observacoes: e.target.value })} className="form-input" rows="2" />
                </div>
              </div>

              {/* Preview */}
              <div className="rounded-lg p-4 mt-4" style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)' }}>
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text)' }}>📋 Pré-visualização:</p>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  Serão criados <strong style={{ color: 'var(--color-text)' }}>{formLote.quantidade}</strong> equipamento(s) de{' '}
                  <strong style={{ color: 'var(--color-text)' }}>{formLote.prefixo_patrimonio}-{String(formLote.numero_inicial).padStart(3, '0')}</strong> até{' '}
                  <strong style={{ color: 'var(--color-text)' }}>{formLote.prefixo_patrimonio}-{String(formLote.numero_inicial + formLote.quantidade - 1).padStart(3, '0')}</strong>
                </p>
              </div>

              <div className="flex gap-3 pt-4 border-t" style={{ borderColor: 'var(--color-border)', marginTop: '1rem' }}>
                <button type="submit" className="flex-1" style={{
                  background: 'var(--color-accent)', color: 'white', border: 'none',
                  borderRadius: '0.5rem', padding: '0.75rem 1.5rem', fontWeight: '600', cursor: 'pointer'
                }}>
                  💾 Cadastrar {formLote.quantidade} Equipamento(s)
                </button>
                <button type="button" onClick={() => setModalLote(false)} style={{
                  background: 'var(--color-surface-3)', color: 'var(--color-text)',
                  border: '1px solid var(--color-border)', borderRadius: '0.5rem',
                  padding: '0.75rem 1.5rem', fontWeight: '600', cursor: 'pointer'
                }}>
                  ❌ Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NOVO TIPO */}
      {modalTipo && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1rem'
        }}>
          <div className="card" style={{
            maxWidth: '28rem', width: '100%', margin: 0
          }}>
            <div className="card-header">
              <h3 className="text-2xl font-bold">➕ Novo Tipo de Equipamento</h3>
            </div>

            <form onSubmit={salvarTipo} style={{ padding: '1.5rem' }}>
              <div className="space-y-4">
                <div>
                  <label className="form-label">Nome do Tipo *</label>
                  <input
                    type="text"
                    value={formTipo.nome}
                    onChange={(e) => setFormTipo({ ...formTipo, nome: e.target.value })}
                    className="form-input"
                    placeholder="Ex: Cadeira de Rodas Motorizada"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Descrição</label>
                  <textarea
                    value={formTipo.descricao}
                    onChange={(e) => setFormTipo({ ...formTipo, descricao: e.target.value })}
                    className="form-input"
                    rows="3"
                    placeholder="Descrição do tipo de equipamento..."
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t" style={{ borderColor: 'var(--color-border)', marginTop: '1rem' }}>
                <button type="submit" className="flex-1" style={{
                  background: 'var(--color-accent)', color: 'white', border: 'none',
                  borderRadius: '0.5rem', padding: '0.75rem 1.5rem', fontWeight: '600', cursor: 'pointer'
                }}>
                  💾 Salvar Tipo
                </button>
                <button type="button" onClick={() => setModalTipo(false)} style={{
                  background: 'var(--color-surface-3)', color: 'var(--color-text)',
                  border: '1px solid var(--color-border)', borderRadius: '0.5rem',
                  padding: '0.75rem 1.5rem', fontWeight: '600', cursor: 'pointer'
                }}>
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
