import React, { useState, useEffect } from 'react';
import { supabase } from '../../App';

export default function GestaoEmprestimos({ showSuccess, showError, permissoes }) {
  const [emprestimos, setEmprestimos] = useState([]);
  const [equipamentos, setEquipamentos] = useState([]);
  const [beneficiarios, setBeneficiarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState('ativo');
  const [editando, setEditando] = useState(null);
  
  // Múltiplos equipamentos
  const [equipamentosSelecionados, setEquipamentosSelecionados] = useState([]);

  const [form, setForm] = useState({
    beneficiario_id: '',
    data_emprestimo: new Date().toISOString().split('T')[0],
    data_devolucao_prevista: '',
    observacoes_entrega: ''
  });

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);

      // Empréstimos com itens
      const { data: empData, error: empError } = await supabase
        .from('comodatos')
        .select(`
          *,
          beneficiarios (id, nome, cpf),
          itens:comodato_itens (
            id,
            equipamento_id,
            status,
            data_devolucao_real,
            equipamentos (
              id,
              numero_patrimonio,
              tipos_equipamentos (nome)
            )
          )
        `)
        .order('created_at', { ascending: false });

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

  const salvarEmprestimo = async (e) => {
    e.preventDefault();

    if (!form.beneficiario_id) {
      showError('Selecione um beneficiário!');
      return;
    }

    if (equipamentosSelecionados.length === 0) {
      showError('Selecione pelo menos um equipamento!');
      return;
    }

    try {
      if (editando) {
        // MODO EDIÇÃO
        // 1. Atualizar comodato
        const { error: comodatoError } = await supabase
          .from('comodatos')
          .update({
            beneficiario_id: form.beneficiario_id,
            data_emprestimo: form.data_emprestimo,
            data_devolucao_prevista: form.data_devolucao_prevista || null,
            observacoes_entrega: form.observacoes_entrega || null
          })
          .eq('id', editando.id);

        if (comodatoError) throw comodatoError;

        // 2. Buscar itens atuais
        const { data: itensAtuais } = await supabase
          .from('comodato_itens')
          .select('equipamento_id')
          .eq('comodato_id', editando.id)
          .eq('status', 'emprestado');

        const idsAtuais = itensAtuais?.map(i => i.equipamento_id) || [];
        
        // 3. Equipamentos removidos - liberar
        const removidos = idsAtuais.filter(id => !equipamentosSelecionados.includes(id));
        for (const eqId of removidos) {
          await supabase
            .from('comodato_itens')
            .delete()
            .eq('comodato_id', editando.id)
            .eq('equipamento_id', eqId);
          
          await supabase
            .from('equipamentos')
            .update({ status: 'disponivel' })
            .eq('id', eqId);
        }

        // 4. Equipamentos novos - adicionar
        const novos = equipamentosSelecionados.filter(id => !idsAtuais.includes(id));
        if (novos.length > 0) {
          const itensNovos = novos.map(eq_id => ({
            comodato_id: editando.id,
            equipamento_id: eq_id,
            status: 'emprestado'
          }));

          await supabase.from('comodato_itens').insert(itensNovos);

          for (const eq_id of novos) {
            await supabase
              .from('equipamentos')
              .update({ status: 'emprestado' })
              .eq('id', eq_id);
          }
        }

        showSuccess('Empréstimo atualizado!');
      } else {
        // MODO CRIAÇÃO
        // 1. Criar comodato
        const { data: comodato, error: comodatoError } = await supabase
          .from('comodatos')
          .insert([{
            beneficiario_id: form.beneficiario_id,
            data_emprestimo: form.data_emprestimo,
            data_devolucao_prevista: form.data_devolucao_prevista || null,
            observacoes_entrega: form.observacoes_entrega || null,
            status: 'ativo'
          }])
          .select()
          .single();

        if (comodatoError) throw comodatoError;

        // 2. Criar itens
        const itens = equipamentosSelecionados.map(eq_id => ({
          comodato_id: comodato.id,
          equipamento_id: eq_id,
          status: 'emprestado'
        }));

        const { error: itensError } = await supabase
          .from('comodato_itens')
          .insert(itens);

        if (itensError) throw itensError;

        // 3. Atualizar status dos equipamentos
        for (const eq_id of equipamentosSelecionados) {
          await supabase
            .from('equipamentos')
            .update({ status: 'emprestado' })
            .eq('id', eq_id);
        }

        showSuccess(`Empréstimo criado com ${equipamentosSelecionados.length} equipamento(s)!`);
      }

      fecharModal();
      carregarDados();
    } catch (error) {
      console.error('Erro:', error);
      showError(error.message || 'Erro ao criar empréstimo');
    }
  };

  const abrirEdicao = async (emprestimo) => {
    setEditando(emprestimo);
    setForm({
      beneficiario_id: emprestimo.beneficiario_id,
      data_emprestimo: emprestimo.data_emprestimo,
      data_devolucao_prevista: emprestimo.data_devolucao_prevista || '',
      observacoes_entrega: emprestimo.observacoes_entrega || ''
    });

    // Carregar equipamentos emprestados (não devolvidos)
    const equipamentosEmprestados = emprestimo.itens
      ?.filter(item => item.status === 'emprestado')
      .map(item => item.equipamento_id) || [];
    
    setEquipamentosSelecionados(equipamentosEmprestados);

    // Carregar equipamentos disponíveis + os que já estão neste empréstimo
    const { data: eqDisponiveis } = await supabase
      .from('equipamentos')
      .select(`id, numero_patrimonio, status, tipos_equipamentos (nome)`)
      .eq('status', 'disponivel')
      .order('numero_patrimonio');

    const { data: eqDoEmprestimo } = await supabase
      .from('equipamentos')
      .select(`id, numero_patrimonio, status, tipos_equipamentos (nome)`)
      .in('id', equipamentosEmprestados)
      .order('numero_patrimonio');

    // Combinar e remover duplicatas
    const todosEquipamentos = [...(eqDisponiveis || []), ...(eqDoEmprestimo || [])];
    const unicos = todosEquipamentos.filter((eq, index, self) => 
      index === self.findIndex(e => e.id === eq.id)
    );
    
    setEquipamentos(unicos);
    setModalAberto(true);
  };

  const excluirEmprestimo = async (emprestimo) => {
    if (!window.confirm('Excluir este empréstimo? Os equipamentos serão liberados.')) return;

    try {
      // 1. Buscar todos os itens do empréstimo
      const { data: itens } = await supabase
        .from('comodato_itens')
        .select('equipamento_id')
        .eq('comodato_id', emprestimo.id);

      // 2. Liberar equipamentos
      for (const item of itens || []) {
        await supabase
          .from('equipamentos')
          .update({ status: 'disponivel' })
          .eq('id', item.equipamento_id);
      }

      // 3. Excluir itens (cascade vai excluir automaticamente, mas por segurança)
      await supabase
        .from('comodato_itens')
        .delete()
        .eq('comodato_id', emprestimo.id);

      // 4. Excluir empréstimo
      const { error } = await supabase
        .from('comodatos')
        .delete()
        .eq('id', emprestimo.id);

      if (error) throw error;

      showSuccess('Empréstimo excluído!');
      carregarDados();
    } catch (error) {
      console.error('Erro:', error);
      showError('Erro ao excluir empréstimo');
    }
  };

  const devolverItem = async (comodatoId, itemId, equipamentoId) => {
    if (!window.confirm('Confirmar devolução deste equipamento?')) return;

    try {
      // 1. Marcar item como devolvido
      const { error: itemError } = await supabase
        .from('comodato_itens')
        .update({
          status: 'devolvido',
          data_devolucao_real: new Date().toISOString()
        })
        .eq('id', itemId);

      if (itemError) throw itemError;

      // 2. Liberar equipamento
      await supabase
        .from('equipamentos')
        .update({ status: 'disponivel' })
        .eq('id', equipamentoId);

      // 3. Verificar se todos itens foram devolvidos
      const { data: itensRestantes } = await supabase
        .from('comodato_itens')
        .select('*')
        .eq('comodato_id', comodatoId)
        .eq('status', 'emprestado');

      // Se não tiver mais itens emprestados, marcar comodato como devolvido
      if (itensRestantes.length === 0) {
        await supabase
          .from('comodatos')
          .update({
            status: 'devolvido',
            data_devolucao_real: new Date().toISOString()
          })
          .eq('id', comodatoId);
      }

      showSuccess('Equipamento devolvido!');
      carregarDados();
    } catch (error) {
      console.error('Erro:', error);
      showError('Erro ao devolver equipamento');
    }
  };

  const toggleEquipamento = (eqId) => {
    setEquipamentosSelecionados(prev =>
      prev.includes(eqId)
        ? prev.filter(id => id !== eqId)
        : [...prev, eqId]
    );
  };

  const fecharModal = () => {
    setModalAberto(false);
    setEditando(null);
    setEquipamentosSelecionados([]);
    setForm({
      beneficiario_id: '',
      data_emprestimo: new Date().toISOString().split('T')[0],
      data_devolucao_prevista: '',
      observacoes_entrega: ''
    });
  };

  const emprestimosFiltrados = emprestimos.filter(emp => {
    if (filtroStatus === 'todos') return true;
    return emp.status === filtroStatus;
  });

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">📦 Empréstimos</h2>
        {permissoes?.pode_editar_comodatos && (
          <button
            onClick={() => setModalAberto(true)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            ➕ Novo Empréstimo
          </button>
        )}
      </div>

      {/* FILTROS */}
      <div className="flex gap-2">
        {['ativo', 'devolvido', 'todos'].map(status => (
          <button
            key={status}
            onClick={() => setFiltroStatus(status)}
            className={`px-4 py-2 rounded-lg ${
              filtroStatus === status
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            {status.toUpperCase()}
          </button>
        ))}
      </div>

      {/* LISTA DE EMPRÉSTIMOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {emprestimosFiltrados.map(emp => (
          <div key={emp.id} className="bg-white rounded-lg shadow p-4 border-l-4 border-emerald-500">
            <div className="flex flex-col gap-2 mb-3">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-base">{emp.beneficiarios?.nome}</h3>
                <span className={`px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                  emp.status === 'ativo' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {emp.status?.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-gray-600">CPF: {emp.beneficiarios?.cpf}</p>
              <p className="text-xs text-gray-500">
                Empréstimo: {new Date(emp.data_emprestimo).toLocaleDateString()}
              </p>
              {permissoes?.pode_editar_comodatos && (
                <div className="flex gap-1 mt-2">
                  <button
                    onClick={() => abrirEdicao(emp)}
                    className="flex-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                    title="Editar empréstimo"
                  >
                    ✏️ Editar
                  </button>
                  <button
                    onClick={() => excluirEmprestimo(emp)}
                    className="flex-1 px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                    title="Excluir empréstimo"
                  >
                    🗑️ Excluir
                  </button>
                </div>
              )}
            </div>

            {/* ITENS DO EMPRÉSTIMO */}
            <div className="space-y-1">
              <p className="font-semibold text-xs text-gray-700 mb-1">Equipamentos:</p>
              {emp.itens?.map(item => (
                <div
                  key={item.id}
                  className={`p-2 rounded ${
                    item.status === 'devolvido' ? 'bg-gray-100' : 'bg-emerald-50'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <p className="text-xs font-medium flex-1">
                      {item.equipamentos?.numero_patrimonio} - {item.equipamentos?.tipos_equipamentos?.nome}
                    </p>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap ${
                      item.status === 'emprestado'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-200 text-gray-700'
                    }`}>
                      {item.status === 'emprestado' ? '🔄' : '✅'}
                    </span>
                  </div>
                  {item.status === 'devolvido' && item.data_devolucao_real && (
                    <p className="text-xs text-gray-500">
                      Devolvido: {new Date(item.data_devolucao_real).toLocaleDateString()}
                    </p>
                  )}
                  {item.status === 'emprestado' && permissoes?.pode_editar_comodatos && (
                    <button
                      onClick={() => devolverItem(emp.id, item.id, item.equipamento_id)}
                      className="w-full mt-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                    >
                      Devolver
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {emprestimosFiltrados.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Nenhum empréstimo encontrado
          </div>
        )}
      </div>

      {/* MODAL NOVO EMPRÉSTIMO */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4">
                {editando ? '✏️ Editar Empréstimo' : '📦 Novo Empréstimo'}
              </h3>
              <form onSubmit={salvarEmprestimo} className="space-y-4">
                {/* Beneficiário */}
                <div>
                  <label className="block text-sm font-medium mb-1">Beneficiário *</label>
                  <select
                    value={form.beneficiario_id}
                    onChange={(e) => setForm({...form, beneficiario_id: e.target.value})}
                    className="w-full border rounded p-2"
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

                {/* Data Empréstimo */}
                <div>
                  <label className="block text-sm font-medium mb-1">Data Empréstimo *</label>
                  <input
                    type="date"
                    value={form.data_emprestimo}
                    onChange={(e) => setForm({...form, data_emprestimo: e.target.value})}
                    className="w-full border rounded p-2"
                    required
                  />
                </div>

                {/* Data Devolução Prevista */}
                <div>
                  <label className="block text-sm font-medium mb-1">Devolução Prevista</label>
                  <input
                    type="date"
                    value={form.data_devolucao_prevista}
                    onChange={(e) => setForm({...form, data_devolucao_prevista: e.target.value})}
                    className="w-full border rounded p-2"
                  />
                </div>

                {/* EQUIPAMENTOS - MÚLTIPLA SELEÇÃO */}
                <div className="border rounded p-3 bg-gray-50">
                  <label className="block text-sm font-medium mb-2">
                    Equipamentos * ({equipamentosSelecionados.length} selecionados)
                  </label>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {equipamentos.length === 0 ? (
                      <p className="text-sm text-gray-500">Nenhum equipamento disponível</p>
                    ) : (
                      equipamentos.map(eq => (
                        <label key={eq.id} className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={equipamentosSelecionados.includes(eq.id)}
                            onChange={() => toggleEquipamento(eq.id)}
                            className="w-4 h-4"
                          />
                          <span className="text-sm">
                            {eq.numero_patrimonio} - {eq.tipos_equipamentos?.nome}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {/* Observações */}
                <div>
                  <label className="block text-sm font-medium mb-1">Observações</label>
                  <textarea
                    value={form.observacoes_entrega}
                    onChange={(e) => setForm({...form, observacoes_entrega: e.target.value})}
                    className="w-full border rounded p-2"
                    rows="3"
                  />
                </div>

                {/* Botões */}
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={fecharModal}
                    className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
