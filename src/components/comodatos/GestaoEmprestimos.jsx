import React, { useState, useEffect } from 'react';
import { supabase } from '../../App';

export default function GestaoEmprestimos({ showSuccess, showError, permissoes }) {
  const [emprestimos, setEmprestimos] = useState([]);
  const [equipamentos, setEquipamentos] = useState([]);
  const [beneficiarios, setBeneficiarios] = useState([]);
  const [responsaveis, setResponsaveis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [modalDevolucao, setModalDevolucao] = useState(false);
  const [emprestimoSelecionado, setEmprestimoSelecionado] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('ativo');
  const [busca, setBusca] = useState('');
  const [modoEdicao, setModoEdicao] = useState(false);

  const [form, setForm] = useState({
    equipamento_id: '',
    beneficiario_id: '',
    responsavel_id: '',
    data_emprestimo: new Date().toISOString().split('T')[0],
    data_devolucao_prevista: '',
    prazo_tipo: 'determinado',
    termo_responsabilidade_assinado: false,
    numero_termo: '',
    observacoes_entrega: '',
    estado_equipamento_entrega: 'Bom'
  });

  const [formDevolucao, setFormDevolucao] = useState({
    data_devolucao_real: new Date().toISOString().split('T')[0],
    estado_equipamento_devolucao: 'Bom',
    observacoes_devolucao: ''
  });

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);

      // Empréstimos
      const { data: empData, error: empError } = await supabase
        .from('comodatos')
        .select(`
          *,
          equipamentos (
            id,
            numero_patrimonio,
            tipos_equipamentos (nome)
          ),
          beneficiarios (
            id,
            nome,
            cpf,
            celular
          ),
          responsaveis (
            id,
            nome,
            cpf,
            telefone
          )
        `)
        .order('data_emprestimo', { ascending: false });

      if (empError) throw empError;
      setEmprestimos(empData || []);

      // Equipamentos disponíveis
      const { data: eqData, error: eqError } = await supabase
        .from('equipamentos')
        .select(`
          id,
          numero_patrimonio,
          status,
          tipos_equipamentos (nome)
        `)
        .eq('status', 'disponivel')
        .order('numero_patrimonio');

      if (eqError) throw eqError;
      setEquipamentos(eqData || []);

      // Beneficiários
      const { data: benData, error: benError } = await supabase
        .from('beneficiarios')
        .select('id, nome, cpf')
        .order('nome');

      if (benError) throw benError;
      setBeneficiarios(benData || []);

      setLoading(false);
    } catch (error) {
      console.error('Erro:', error);
      showError('Erro ao carregar dados');
      setLoading(false);
    }
  };

  const carregarResponsaveis = async (beneficiarioId) => {
    if (!beneficiarioId) {
      setResponsaveis([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('responsaveis')
        .select('*')
        .eq('beneficiario_id', beneficiarioId);

      if (error) throw error;
      setResponsaveis(data || []);
    } catch (error) {
      console.error('Erro:', error);
      setResponsaveis([]);
    }
  };

  const abrirModal = () => {
    setForm({
      equipamento_id: '',
      beneficiario_id: '',
      responsavel_id: '',
      data_emprestimo: new Date().toISOString().split('T')[0],
      data_devolucao_prevista: '',
      prazo_tipo: 'determinado',
      termo_responsabilidade_assinado: false,
      numero_termo: '',
      observacoes_entrega: '',
      estado_equipamento_entrega: 'Bom'
    });
    setResponsaveis([]);
    setModalAberto(true);
  };

  const salvarEmprestimo = async (e) => {
    e.preventDefault();

    if (!form.equipamento_id || !form.beneficiario_id) {
      showError('Selecione equipamento e beneficiário!');
      return;
    }

    if (form.prazo_tipo === 'determinado' && !form.data_devolucao_prevista) {
      showError('Informe a data de devolução prevista!');
      return;
    }

    try {
      const dados = {
        equipamento_id: parseInt(form.equipamento_id),
        beneficiario_id: parseInt(form.beneficiario_id),
        responsavel_id: form.responsavel_id ? parseInt(form.responsavel_id) : null,
        data_emprestimo: form.data_emprestimo,
        data_devolucao_prevista: form.prazo_tipo === 'determinado' ? form.data_devolucao_prevista : null,
        prazo_tipo: form.prazo_tipo,
        termo_responsabilidade_assinado: form.termo_responsabilidade_assinado,
        numero_termo: form.numero_termo || null,
        observacoes_entrega: form.observacoes_entrega || null,
        estado_equipamento_entrega: form.estado_equipamento_entrega
      };

      if (modoEdicao && emprestimoSelecionado) {
        // EDITAR empréstimo existente
        const { error } = await supabase
          .from('comodatos')
          .update(dados)
          .eq('id', emprestimoSelecionado.id);

        if (error) throw error;
        showSuccess('Empréstimo atualizado com sucesso!');
      } else {
        // CRIAR novo empréstimo
        dados.status = 'ativo';
        
        const { error } = await supabase
          .from('comodatos')
          .insert([dados]);

        if (error) throw error;
        showSuccess('Empréstimo registrado com sucesso!');
      }

      fecharModal();
      carregarDados();
    } catch (error) {
      console.error('Erro:', error);
      showError(error.message || 'Erro ao salvar empréstimo');
    }
  };

  // Função para abrir modal em modo de edição
  const abrirEdicao = (emprestimo) => {
    setModoEdicao(true);
    setEmprestimoSelecionado(emprestimo);
    setForm({
      equipamento_id: emprestimo.equipamento_id,
      beneficiario_id: emprestimo.beneficiario_id,
      responsavel_id: emprestimo.responsavel_id || '',
      data_emprestimo: emprestimo.data_emprestimo,
      data_devolucao_prevista: emprestimo.data_devolucao_prevista || '',
      prazo_tipo: emprestimo.prazo_tipo,
      termo_responsabilidade_assinado: emprestimo.termo_responsabilidade_assinado,
      numero_termo: emprestimo.numero_termo || '',
      observacoes_entrega: emprestimo.observacoes_entrega || '',
      estado_equipamento_entrega: emprestimo.estado_equipamento_entrega
    });
    setModalAberto(true);
  };

  // Função para fechar modal e limpar estados
  const fecharModal = () => {
    setModalAberto(false);
    setModoEdicao(false);
    setEmprestimoSelecionado(null);
    setForm({
      equipamento_id: '',
      beneficiario_id: '',
      responsavel_id: '',
      data_emprestimo: new Date().toISOString().split('T')[0],
      data_devolucao_prevista: '',
      prazo_tipo: 'determinado',
      termo_responsabilidade_assinado: false,
      numero_termo: '',
      observacoes_entrega: '',
      estado_equipamento_entrega: 'Bom'
    });
  };

  const abrirModalDevolucao = (emprestimo) => {
    setEmprestimoSelecionado(emprestimo);
    setFormDevolucao({
      data_devolucao_real: new Date().toISOString().split('T')[0],
      estado_equipamento_devolucao: 'Bom',
      observacoes_devolucao: ''
    });
    setModalDevolucao(true);
  };

  const registrarDevolucao = async (e) => {
    e.preventDefault();

    try {
      const { error } = await supabase
        .from('comodatos')
        .update({
          data_devolucao_real: formDevolucao.data_devolucao_real,
          estado_equipamento_devolucao: formDevolucao.estado_equipamento_devolucao,
          observacoes_devolucao: formDevolucao.observacoes_devolucao,
          status: 'devolvido'
        })
        .eq('id', emprestimoSelecionado.id);

      if (error) throw error;

      showSuccess('Devolução registrada com sucesso!');
      setModalDevolucao(false);
      carregarDados();
    } catch (error) {
      console.error('Erro:', error);
      showError(error.message || 'Erro ao registrar devolução');
    }
  };

  const excluir = async (id) => {
    if (!confirm('⚠️ Tem certeza que deseja excluir este empréstimo?\n\nEsta ação não pode ser desfeita!')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('comodatos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showSuccess('Empréstimo excluído!');
      carregarDados();
    } catch (error) {
      console.error('Erro:', error);
      showError('Erro ao excluir empréstimo');
    }
  };

  // Função para calcular dias restantes (precisa estar ANTES do filtro)
  const calcularDiasRestantes = (dataPrevista) => {
    if (!dataPrevista) return null;
    const hoje = new Date();
    const prevista = new Date(dataPrevista + 'T00:00:00');
    const diff = Math.ceil((prevista - hoje) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const emprestimosFiltrados = emprestimos.filter(emp => {
    // Calcular se está vencido
    const diasRestantes = calcularDiasRestantes(emp.data_devolucao_prevista);
    const vencido = diasRestantes !== null && diasRestantes < 0 && emp.status === 'ativo';
    
    // Verificar correspondência de status
    let matchStatus = false;
    if (filtroStatus === 'todos') {
      matchStatus = true;
    } else if (filtroStatus === 'vencido') {
      matchStatus = vencido; // Mostrar apenas vencidos
    } else {
      matchStatus = emp.status === filtroStatus && !vencido; // Ativos = não vencidos
    }
    
    const matchBusca = emp.beneficiarios?.nome.toLowerCase().includes(busca.toLowerCase()) ||
                       emp.equipamentos?.numero_patrimonio.toLowerCase().includes(busca.toLowerCase());
    return matchStatus && matchBusca;
  });

  const getStatusBadge = (status) => {
    const badges = {
      ativo: 'bg-blue-100 text-blue-800',
      devolvido: 'bg-green-100 text-green-800',
      vencido: 'bg-red-100 text-red-800'
    };
    const labels = {
      ativo: '🔄 Ativo',
      devolvido: '✅ Devolvido',
      vencido: '⚠️ Vencido'
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badges[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            📋 Empréstimos
          </h2>
          {permissoes?.pode_editar_comodatos && (
            <button
              onClick={abrirModal}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
            >
              ➕ Novo Empréstimo
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="🔍 Buscar..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="border rounded-lg px-4 py-2"
          />

          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="border rounded-lg px-4 py-2"
          >
            <option value="todos">Todos os Status</option>
            <option value="ativo">🔄 Ativos</option>
            <option value="devolvido">✅ Devolvidos</option>
            <option value="vencido">⚠️ Vencidos</option>
          </select>

          <div className="text-gray-600 flex items-center">
            <strong>{emprestimosFiltrados.length}</strong>
            <span className="ml-2">empréstimo(s)</span>
          </div>
        </div>
      </div>

      {/* LISTA */}
      <div className="grid grid-cols-1 gap-4">
        {emprestimosFiltrados.map(emprestimo => {
          const diasRestantes = calcularDiasRestantes(emprestimo.data_devolucao_prevista);
          const vencido = diasRestantes !== null && diasRestantes < 0;

          return (
            <div
              key={emprestimo.id}
              className={`bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow ${
                vencido && emprestimo.status === 'ativo' 
                  ? 'border-l-4 border-red-500 bg-red-50' 
                  : ''
              }`}
            >
              {/* Badge de alerta para vencidos */}
              {vencido && emprestimo.status === 'ativo' && (
                <div className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold inline-block mb-3">
                  ⚠️ EMPRÉSTIMO VENCIDO - {Math.abs(diasRestantes)} DIA(S) ATRASADO
                </div>
              )}
              
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-gray-800">
                      {emprestimo.equipamentos?.tipos_equipamentos?.nome}
                    </h3>
                    {getStatusBadge(vencido && emprestimo.status === 'ativo' ? 'vencido' : emprestimo.status)}
                  </div>
                  <p className="text-cyan-600 font-semibold">
                    Patrimônio: {emprestimo.equipamentos?.numero_patrimonio}
                  </p>
                  <p className="text-gray-700 font-semibold mt-1">
                    👤 {emprestimo.beneficiarios?.nome}
                  </p>
                  {emprestimo.beneficiarios?.celular && (
                    <p className="text-gray-600 text-sm">
                      📱 {emprestimo.beneficiarios.celular}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
                <div>
                  <span className="text-gray-500">Empréstimo:</span>
                  <p className="font-semibold">
                    {new Date(emprestimo.data_emprestimo + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </p>
                </div>

                {emprestimo.data_devolucao_prevista && (
                  <div>
                    <span className="text-gray-500">Devolução Prevista:</span>
                    <p className={`font-semibold ${vencido ? 'text-red-600' : ''}`}>
                      {new Date(emprestimo.data_devolucao_prevista + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </p>
                    {diasRestantes !== null && emprestimo.status === 'ativo' && (
                      <p className={`text-xs ${vencido ? 'text-red-600' : 'text-gray-500'}`}>
                        {vencido ? `${Math.abs(diasRestantes)} dia(s) atrasado` : `${diasRestantes} dia(s) restantes`}
                      </p>
                    )}
                  </div>
                )}

                {emprestimo.prazo_tipo === 'indeterminado' && (
                  <div>
                    <span className="text-gray-500">Prazo:</span>
                    <p className="font-semibold text-purple-600">Indeterminado</p>
                  </div>
                )}

                {emprestimo.data_devolucao_real && (
                  <div>
                    <span className="text-gray-500">Devolvido em:</span>
                    <p className="font-semibold text-green-600">
                      {new Date(emprestimo.data_devolucao_real + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                )}

                <div>
                  <span className="text-gray-500">Estado Entrega:</span>
                  <p className="font-semibold">{emprestimo.estado_equipamento_entrega}</p>
                </div>

                {emprestimo.estado_equipamento_devolucao && (
                  <div>
                    <span className="text-gray-500">Estado Devolução:</span>
                    <p className="font-semibold">{emprestimo.estado_equipamento_devolucao}</p>
                  </div>
                )}
              </div>

              {emprestimo.responsaveis && (
                <div className="bg-blue-50 rounded p-3 mb-3">
                  <p className="text-sm font-semibold text-blue-900">
                    👤 Responsável: {emprestimo.responsaveis.nome}
                  </p>
                  {emprestimo.responsaveis.telefone && (
                    <p className="text-sm text-blue-800">
                      📞 {emprestimo.responsaveis.telefone}
                    </p>
                  )}
                </div>
              )}

              {emprestimo.termo_responsabilidade_assinado && emprestimo.numero_termo && (
                <div className="bg-green-50 rounded p-3 mb-3">
                  <p className="text-sm font-semibold text-green-900">
                    ✅ Termo assinado: Nº {emprestimo.numero_termo}
                  </p>
                </div>
              )}

              {emprestimo.observacoes_entrega && (
                <div className="bg-gray-50 rounded p-3 mb-3">
                  <p className="text-sm text-gray-700">
                    <strong>Obs. Entrega:</strong> {emprestimo.observacoes_entrega}
                  </p>
                </div>
              )}

              {emprestimo.observacoes_devolucao && (
                <div className="bg-gray-50 rounded p-3 mb-3">
                  <p className="text-sm text-gray-700">
                    <strong>Obs. Devolução:</strong> {emprestimo.observacoes_devolucao}
                  </p>
                </div>
              )}

              {permissoes?.pode_editar_comodatos && (
                <div className="flex gap-2">
                  {emprestimo.status === 'ativo' && (
                    <>
                      <button
                        onClick={() => abrirEdicao(emprestimo)}
                        className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={() => abrirModalDevolucao(emprestimo)}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                      >
                        ✅ Registrar Devolução
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => excluir(emprestimo.id)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                  >
                    ❌ Excluir
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {emprestimosFiltrados.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-xl">Nenhum empréstimo encontrado</p>
        </div>
      )}

      {/* MODAL NOVO EMPRÉSTIMO */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className={`text-white p-6 rounded-t-xl ${modoEdicao ? 'bg-yellow-600' : 'bg-cyan-600'}`}>
              <h3 className="text-2xl font-bold">
                {modoEdicao ? '✏️ Editar Empréstimo' : '➕ Novo Empréstimo'}
              </h3>
            </div>

            <form onSubmit={salvarEmprestimo} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Equipamento *
                  </label>
                  <select
                    value={form.equipamento_id}
                    onChange={(e) => setForm({ ...form, equipamento_id: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                    required
                  >
                    <option value="">Selecione...</option>
                    {equipamentos.map(eq => (
                      <option key={eq.id} value={eq.id}>
                        {eq.numero_patrimonio} - {eq.tipos_equipamentos?.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Beneficiário *
                  </label>
                  <select
                    value={form.beneficiario_id}
                    onChange={(e) => {
                      setForm({ ...form, beneficiario_id: e.target.value, responsavel_id: '' });
                      carregarResponsaveis(e.target.value);
                    }}
                    className="w-full border rounded-lg px-4 py-2"
                    required
                  >
                    <option value="">Selecione...</option>
                    {beneficiarios.map(ben => (
                      <option key={ben.id} value={ben.id}>
                        {ben.nome} - {ben.cpf}
                      </option>
                    ))}
                  </select>
                </div>

                {responsaveis.length > 0 && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Responsável
                    </label>
                    <select
                      value={form.responsavel_id}
                      onChange={(e) => setForm({ ...form, responsavel_id: e.target.value })}
                      className="w-full border rounded-lg px-4 py-2"
                    >
                      <option value="">Nenhum</option>
                      {responsaveis.map(resp => (
                        <option key={resp.id} value={resp.id}>
                          {resp.nome} - {resp.parentesco}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Data do Empréstimo
                  </label>
                  <input
                    type="date"
                    value={form.data_emprestimo}
                    onChange={(e) => setForm({ ...form, data_emprestimo: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tipo de Prazo
                  </label>
                  <select
                    value={form.prazo_tipo}
                    onChange={(e) => setForm({ ...form, prazo_tipo: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                  >
                    <option value="determinado">Determinado</option>
                    <option value="indeterminado">Indeterminado</option>
                  </select>
                </div>

                {form.prazo_tipo === 'determinado' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Devolução Prevista *
                    </label>
                    <input
                      type="date"
                      value={form.data_devolucao_prevista}
                      onChange={(e) => setForm({ ...form, data_devolucao_prevista: e.target.value })}
                      className="w-full border rounded-lg px-4 py-2"
                      required={form.prazo_tipo === 'determinado'}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Estado do Equipamento
                  </label>
                  <select
                    value={form.estado_equipamento_entrega}
                    onChange={(e) => setForm({ ...form, estado_equipamento_entrega: e.target.value })}
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
                    Nº do Termo
                  </label>
                  <input
                    type="text"
                    value={form.numero_termo}
                    onChange={(e) => setForm({ ...form, numero_termo: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                  />
                </div>

                <div className="flex items-center md:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.termo_responsabilidade_assinado}
                    onChange={(e) => setForm({ ...form, termo_responsabilidade_assinado: e.target.checked })}
                    className="mr-2"
                  />
                  <label className="text-sm text-gray-700">
                    Termo de responsabilidade assinado
                  </label>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Observações da Entrega
                  </label>
                  <textarea
                    value={form.observacoes_entrega}
                    onChange={(e) => setForm({ ...form, observacoes_entrega: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                    rows="3"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className={`flex-1 text-white px-6 py-3 rounded-lg transition-colors font-semibold ${
                    modoEdicao ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-cyan-600 hover:bg-cyan-700'
                  }`}
                >
                  💾 {modoEdicao ? 'Atualizar' : 'Registrar'} Empréstimo
                </button>
                <button
                  type="button"
                  onClick={fecharModal}
                  className="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-semibold"
                >
                  ❌ Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DEVOLUÇÃO */}
      {modalDevolucao && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
            <div className="bg-green-600 text-white p-6 rounded-t-xl">
              <h3 className="text-2xl font-bold">✅ Registrar Devolução</h3>
              <p className="text-green-100 text-sm mt-1">
                {emprestimoSelecionado?.equipamentos?.numero_patrimonio} - {emprestimoSelecionado?.beneficiarios?.nome}
              </p>
            </div>

            <form onSubmit={registrarDevolucao} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Data da Devolução
                  </label>
                  <input
                    type="date"
                    value={formDevolucao.data_devolucao_real}
                    onChange={(e) => setFormDevolucao({ ...formDevolucao, data_devolucao_real: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Estado do Equipamento
                  </label>
                  <select
                    value={formDevolucao.estado_equipamento_devolucao}
                    onChange={(e) => setFormDevolucao({ ...formDevolucao, estado_equipamento_devolucao: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                  >
                    <option value="Novo">Novo</option>
                    <option value="Bom">Bom</option>
                    <option value="Regular">Regular</option>
                    <option value="Ruim">Ruim</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Observações da Devolução
                  </label>
                  <textarea
                    value={formDevolucao.observacoes_devolucao}
                    onChange={(e) => setFormDevolucao({ ...formDevolucao, observacoes_devolucao: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                    rows="3"
                    placeholder="Ex: Equipamento devolvido em bom estado, sem avarias..."
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-semibold"
                >
                  ✅ Confirmar Devolução
                </button>
                <button
                  type="button"
                  onClick={() => setModalDevolucao(false)}
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
