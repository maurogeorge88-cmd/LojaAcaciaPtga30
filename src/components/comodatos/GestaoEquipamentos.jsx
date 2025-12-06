import React, { useState, useEffect } from 'react';
import { supabase } from '../../App';

export default function GestaoEquipamentos({ showSuccess, showError }) {
  const [equipamentos, setEquipamentos] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [modalTipo, setModalTipo] = useState(false);
  const [editando, setEditando] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('todos');
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

      // Carregar tipos
      const { data: tiposData, error: tiposError } = await supabase
        .from('tipos_equipamentos')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (tiposError) throw tiposError;
      setTipos(tiposData || []);

      // Carregar equipamentos
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
    const matchStatus = filtroStatus === 'todos' || eq.status === filtroStatus;
    const matchTipo = filtroTipo === 'todos' || eq.tipo_id === parseInt(filtroTipo);
    const matchBusca = eq.numero_patrimonio.toLowerCase().includes(busca.toLowerCase()) ||
                       eq.tipos_equipamentos?.nome.toLowerCase().includes(busca.toLowerCase());
    return matchStatus && matchTipo && matchBusca;
  });

  const getStatusBadge = (status) => {
    const badges = {
      disponivel: 'bg-green-100 text-green-800',
      emprestado: 'bg-blue-100 text-blue-800',
      manutencao: 'bg-yellow-100 text-yellow-800',
      descartado: 'bg-gray-100 text-gray-800'
    };
    const labels = {
      disponivel: '✅ Disponível',
      emprestado: '🔄 Emprestado',
      manutencao: '🔧 Manutenção',
      descartado: '🗑️ Descartado'
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badges[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const getEstadoBadge = (estado) => {
    const badges = {
      'Novo': 'bg-emerald-100 text-emerald-800',
      'Bom': 'bg-green-100 text-green-800',
      'Regular': 'bg-yellow-100 text-yellow-800',
      'Ruim': 'bg-red-100 text-red-800'
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${badges[estado]}`}>
        {estado}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            🛠️ Gestão de Equipamentos
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setModalTipo(true)}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              ➕ Novo Tipo
            </button>
            <button
              onClick={() => abrirModal()}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              ➕ Novo Equipamento
            </button>
          </div>
        </div>

        {/* FILTROS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="🔍 Buscar..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="border rounded-lg px-4 py-2"
          />
          
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="border rounded-lg px-4 py-2"
          >
            <option value="todos">Todos os Tipos</option>
            {tipos.map(tipo => (
              <option key={tipo.id} value={tipo.id}>{tipo.nome}</option>
            ))}
          </select>

          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="border rounded-lg px-4 py-2"
          >
            <option value="todos">Todos os Status</option>
            <option value="disponivel">✅ Disponível</option>
            <option value="emprestado">🔄 Emprestado</option>
            <option value="manutencao">🔧 Manutenção</option>
            <option value="descartado">🗑️ Descartado</option>
          </select>

          <div className="text-gray-600 flex items-center">
            <strong>{equipamentosFiltrados.length}</strong>
            <span className="ml-2">equipamento(s)</span>
          </div>
        </div>
      </div>

      {/* LISTA DE EQUIPAMENTOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {equipamentosFiltrados.map(equipamento => (
          <div
            key={equipamento.id}
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xl font-bold text-gray-800">
                    {equipamento.numero_patrimonio}
                  </h3>
                  {getStatusBadge(equipamento.status)}
                </div>
                <p className="text-emerald-600 font-semibold">
                  {equipamento.tipos_equipamentos?.nome}
                </p>
              </div>
              {getEstadoBadge(equipamento.estado_conservacao)}
            </div>

            {equipamento.descricao && (
              <p className="text-gray-600 text-sm mb-3">
                {equipamento.descricao}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              {equipamento.data_aquisicao && (
                <div>
                  <span className="text-gray-500">Aquisição:</span>
                  <p className="font-semibold">
                    {new Date(equipamento.data_aquisicao + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </p>
                </div>
              )}
              {equipamento.valor_aquisicao && (
                <div>
                  <span className="text-gray-500">Valor:</span>
                  <p className="font-semibold">
                    R$ {parseFloat(equipamento.valor_aquisicao).toFixed(2)}
                  </p>
                </div>
              )}
            </div>

            {equipamento.status === 'descartado' && (
              <div className="bg-red-50 border-l-4 border-red-500 p-3 mb-3">
                <p className="text-sm text-red-800">
                  <strong>Descartado em:</strong>{' '}
                  {new Date(equipamento.data_descarte + 'T00:00:00').toLocaleDateString('pt-BR')}
                </p>
                {equipamento.motivo_descarte && (
                  <p className="text-sm text-red-700 mt-1">
                    {equipamento.motivo_descarte}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => abrirModal(equipamento)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                disabled={equipamento.status === 'descartado'}
              >
                ✏️ Editar
              </button>
              {equipamento.status !== 'descartado' && (
                <button
                  onClick={() => descartar(equipamento.id)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                >
                  🗑️ Descartar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {equipamentosFiltrados.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-xl">Nenhum equipamento encontrado</p>
        </div>
      )}

      {/* MODAL EQUIPAMENTO */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-emerald-600 text-white p-6 rounded-t-xl">
              <h3 className="text-2xl font-bold">
                {editando ? '✏️ Editar Equipamento' : '➕ Novo Equipamento'}
              </h3>
            </div>

            <form onSubmit={salvarEquipamento} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tipo de Equipamento *
                  </label>
                  <select
                    value={form.tipo_id}
                    onChange={(e) => setForm({ ...form, tipo_id: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                    required
                  >
                    <option value="">Selecione...</option>
                    {tipos.map(tipo => (
                      <option key={tipo.id} value={tipo.id}>{tipo.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Número do Patrimônio *
                  </label>
                  <input
                    type="text"
                    value={form.numero_patrimonio}
                    onChange={(e) => setForm({ ...form, numero_patrimonio: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Estado de Conservação
                  </label>
                  <select
                    value={form.estado_conservacao}
                    onChange={(e) => setForm({ ...form, estado_conservacao: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                  >
                    <option value="Novo">Novo</option>
                    <option value="Bom">Bom</option>
                    <option value="Regular">Regular</option>
                    <option value="Ruim">Ruim</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                  >
                    <option value="disponivel">Disponível</option>
                    <option value="manutencao">Manutenção</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Data de Aquisição
                  </label>
                  <input
                    type="date"
                    value={form.data_aquisicao}
                    onChange={(e) => setForm({ ...form, data_aquisicao: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Valor de Aquisição (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.valor_aquisicao}
                    onChange={(e) => setForm({ ...form, valor_aquisicao: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Descrição
                </label>
                <textarea
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  className="w-full border rounded-lg px-4 py-2"
                  rows="3"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Observações
                </label>
                <textarea
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  className="w-full border rounded-lg px-4 py-2"
                  rows="2"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors font-semibold"
                >
                  💾 Salvar
                </button>
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-semibold"
                >
                  ❌ Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NOVO TIPO */}
      {modalTipo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="bg-gray-600 text-white p-6 rounded-t-xl">
              <h3 className="text-2xl font-bold">➕ Novo Tipo de Equipamento</h3>
            </div>

            <form onSubmit={salvarTipo} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nome do Tipo *
                </label>
                <input
                  type="text"
                  value={formTipo.nome}
                  onChange={(e) => setFormTipo({ ...formTipo, nome: e.target.value })}
                  className="w-full border rounded-lg px-4 py-2"
                  placeholder="Ex: Cadeira de Rodas Motorizada"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Descrição
                </label>
                <textarea
                  value={formTipo.descricao}
                  onChange={(e) => setFormTipo({ ...formTipo, descricao: e.target.value })}
                  className="w-full border rounded-lg px-4 py-2"
                  rows="3"
                  placeholder="Descrição do tipo de equipamento..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors font-semibold"
                >
                  💾 Salvar Tipo
                </button>
                <button
                  type="button"
                  onClick={() => setModalTipo(false)}
                  className="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-semibold"
                >
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
