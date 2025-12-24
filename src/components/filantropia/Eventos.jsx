import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function Eventos({ userPermissions, userData }) {
  const [eventos, setEventos] = useState([]);
  const [irmaos, setIrmaos] = useState([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [modalVisualizacao, setModalVisualizacao] = useState(false);
  const [eventoSelecionado, setEventoSelecionado] = useState(null);
  const [modoEdicao, setModoEdicao] = useState(false);

  // Verificar se tem permissão de edição (administrador, tesoureiro ou veneravel)
  // Usar optional chaining para evitar erro quando userPermissions não está definido
  const podeEditar = Boolean(
    userPermissions?.eh_administrador || 
    userPermissions?.pode_editar_financas || 
    userPermissions?.eh_veneravel
  );

  // Log para debug
  useEffect(() => {
    console.log('📋 Eventos - Permissões:', userPermissions);
    console.log('✏️ Eventos - Pode Editar:', podeEditar);
  }, [userPermissions]);

  const [formData, setFormData] = useState({
    tipo_evento: 'externo', // externo ou interno
    nome_evento: '',
    idealizador: '',
    local_evento: '',
    data_aviso: '',
    data_prevista: '',
    descricao: '',
    status: 'planejamento' // planejamento, em_andamento, concluido
  });

  const [itensEvento, setItensEvento] = useState([]);
  const [novoItem, setNovoItem] = useState({ descricao: '', quantidade: '', valor: '' });
  const [itemEditando, setItemEditando] = useState(null);
  
  const [participantes, setParticipantes] = useState([]);
  const [novoParticipante, setNovoParticipante] = useState('');
  
  // Estados para armazenar itens e participantes de TODOS os eventos
  const [todosItens, setTodosItens] = useState([]);
  const [todosParticipantes, setTodosParticipantes] = useState([]);

  useEffect(() => {
    carregarEventos();
    carregarIrmaos();
    carregarTodosItens();
    carregarTodosParticipantes();
  }, []);

  const carregarTodosItens = async () => {
    const { data, error } = await supabase
      .from('eventos_itens')
      .select('*');
    
    if (!error) {
      setTodosItens(data || []);
    }
  };

  const carregarTodosParticipantes = async () => {
    const { data, error } = await supabase
      .from('eventos_participantes')
      .select('*');
    
    if (!error) {
      setTodosParticipantes(data || []);
    }
  };

  const carregarEventos = async () => {
    const { data, error } = await supabase
      .from('eventos_loja')
      .select('*')
      .order('data_prevista', { ascending: false })
      .limit(100); // ⚡ PERFORMANCE: Limita a 100 eventos
    
    if (error) {
      console.error('Erro ao carregar eventos:', error);
    } else {
      setEventos(data || []);
    }
  };

  const carregarIrmaos = async () => {
    const { data, error } = await supabase
      .from('irmaos')
      .select('id, nome, situacao')
      .order('nome');
    
    if (error) {
      console.error('Erro ao carregar irmãos:', error);
    } else {
      // Filtrar apenas regulares e licenciados
      const irmaosFiltrados = (data || []).filter(irmao => {
        const situacao = (irmao.situacao || 'regular').toLowerCase();
        return situacao === 'regular' || situacao === 'licenciado';
      });
      console.log('Irmãos carregados:', irmaosFiltrados);
      setIrmaos(irmaosFiltrados);
    }
  };

  const abrirModal = (evento = null) => {
    if (evento) {
      setEventoSelecionado(evento);
      setFormData({
        tipo_evento: evento.tipo_evento,
        nome_evento: evento.nome_evento,
        idealizador: evento.idealizador,
        local_evento: evento.local_evento,
        data_aviso: evento.data_aviso,
        data_prevista: evento.data_prevista,
        descricao: evento.descricao || '',
        status: evento.status
      });
      carregarItensEvento(evento.id);
      carregarParticipantes(evento.id);
      setModoEdicao(true);
    } else {
      setEventoSelecionado(null);
      setFormData({
        tipo_evento: 'externo',
        nome_evento: '',
        idealizador: '',
        local_evento: '',
        data_aviso: '',
        data_prevista: '',
        descricao: '',
        status: 'planejamento'
      });
      setItensEvento([]);
      setParticipantes([]);
      setModoEdicao(false);
    }
    setModalAberto(true);
  };

  const abrirVisualizacao = async (evento) => {
    setEventoSelecionado(evento);
    await carregarItensEvento(evento.id);
    await carregarParticipantes(evento.id);
    setModalVisualizacao(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setModalVisualizacao(false);
    setEventoSelecionado(null);
    setModoEdicao(false);
  };

  const carregarItensEvento = async (eventoId) => {
    const { data, error } = await supabase
      .from('eventos_itens')
      .select('*')
      .eq('evento_id', eventoId)
      .order('created_at');
    
    if (!error) {
      setItensEvento(data || []);
    }
  };

  const carregarParticipantes = async (eventoId) => {
    const { data, error } = await supabase
      .from('eventos_participantes')
      .select(`
        id,
        irmao_id,
        irmaos (nome)
      `)
      .eq('evento_id', eventoId);
    
    if (!error) {
      setParticipantes(data || []);
    }
  };

  const salvarEvento = async () => {
    if (!formData.nome_evento || !formData.data_prevista) {
      alert('Preencha os campos obrigatórios!');
      return;
    }

    if (modoEdicao && eventoSelecionado) {
      // Atualizar evento
      const { error } = await supabase
        .from('eventos_loja')
        .update(formData)
        .eq('id', eventoSelecionado.id);
      
      if (error) {
        console.error('Erro ao atualizar evento:', error);
        alert('Erro ao atualizar evento!');
      } else {
        await salvarItens(eventoSelecionado.id);
        carregarEventos();
        carregarTodosItens();
        carregarTodosParticipantes();
        fecharModal();
      }
    } else {
      // Criar novo evento
      const { data, error } = await supabase
        .from('eventos_loja')
        .insert([formData])
        .select();
      
      if (error) {
        console.error('Erro ao criar evento:', error);
        alert('Erro ao criar evento!');
      } else if (data && data[0]) {
        await salvarItens(data[0].id);
        carregarEventos();
        carregarTodosItens();
        carregarTodosParticipantes();
        fecharModal();
      }
    }
  };

  const salvarItens = async (eventoId) => {
    // Salvar novos itens
    for (const item of itensEvento) {
      if (!item.id) {
        await supabase
          .from('eventos_itens')
          .insert([{ 
            evento_id: eventoId,
            descricao: item.descricao,
            quantidade: item.quantidade,
            valor: item.valor
          }]);
      }
    }

    // Salvar novos participantes
    for (const participante of participantes) {
      if (!participante.id) {
        await supabase
          .from('eventos_participantes')
          .insert([{
            evento_id: eventoId,
            irmao_id: participante.irmao_id
          }]);
      }
    }
  };

  const excluirEvento = async (id) => {
    if (!confirm('Deseja realmente excluir este evento?')) return;

    // Excluir itens e participantes primeiro
    await supabase.from('eventos_itens').delete().eq('evento_id', id);
    await supabase.from('eventos_participantes').delete().eq('evento_id', id);
    
    // Excluir evento
    const { error } = await supabase
      .from('eventos_loja')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Erro ao excluir evento:', error);
      alert('Erro ao excluir evento!');
    } else {
      carregarEventos();
    }
  };

  const adicionarItem = () => {
    if (!novoItem.descricao) return;
    
    if (itemEditando !== null) {
      // Editando item existente
      const novosItens = [...itensEvento];
      novosItens[itemEditando] = { ...novoItem };
      setItensEvento(novosItens);
      setItemEditando(null);
    } else {
      // Novo item
      setItensEvento([...itensEvento, { ...novoItem }]);
    }
    setNovoItem({ descricao: '', quantidade: '', valor: '' });
  };

  const editarItem = (index) => {
    setNovoItem(itensEvento[index]);
    setItemEditando(index);
  };

  const cancelarEdicaoItem = () => {
    setNovoItem({ descricao: '', quantidade: '', valor: '' });
    setItemEditando(null);
  };

  const removerItem = async (index, itemId) => {
    if (itemId) {
      await supabase.from('eventos_itens').delete().eq('id', itemId);
    }
    setItensEvento(itensEvento.filter((_, i) => i !== index));
  };

  const adicionarParticipante = () => {
    if (!novoParticipante) return;
    
    const irmao = irmaos.find(i => i.id === parseInt(novoParticipante));
    if (irmao && !participantes.find(p => p.irmao_id === irmao.id)) {
      setParticipantes([...participantes, { irmao_id: irmao.id, irmaos: { nome: irmao.nome } }]);
      setNovoParticipante('');
    }
  };

  const removerParticipante = async (index, participanteId) => {
    if (participanteId) {
      await supabase.from('eventos_participantes').delete().eq('id', participanteId);
    }
    setParticipantes(participantes.filter((_, i) => i !== index));
  };

  const totalCusto = itensEvento.reduce((sum, item) => {
    const valor = parseFloat(item.valor) || 0;
    const qtd = parseFloat(item.quantidade) || 1;
    return sum + (valor * qtd);
  }, 0);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Eventos da Loja</h1>
        {podeEditar && (
          <button
            onClick={() => abrirModal()}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            <span>➕</span>
            Novo Evento
          </button>
        )}
      </div>

      {/* Aviso para irmãos sem permissão */}
      {!podeEditar && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg mb-6">
          <div className="flex items-center gap-2">
            <span className="text-blue-600 text-lg">ℹ️</span>
            <p className="text-sm text-blue-800">
              <strong>Visualização:</strong> Você pode visualizar os eventos da loja. 
              Para criar ou editar eventos, entre em contato com a administração.
            </p>
          </div>
        </div>
      )}

      {/* Lista de Eventos */}
      <div className="grid gap-4">
        {eventos.map(evento => {
          const custoTotal = todosItens
            .filter(item => item.evento_id === evento.id)
            .reduce((sum, item) => sum + (parseFloat(item.valor || 0) * parseFloat(item.quantidade || 1)), 0);
          
          const numParticipantes = todosParticipantes.filter(p => p.evento_id === evento.id).length;

          return (
            <div key={evento.id} className="bg-white rounded-lg shadow-lg overflow-hidden border-l-4" 
                 style={{borderLeftColor: evento.tipo_evento === 'externo' ? '#9333ea' : '#10b981'}}>
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`px-4 py-1.5 rounded-full text-sm font-semibold ${
                        evento.tipo_evento === 'externo' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {evento.tipo_evento === 'externo' ? '🌍 Externo' : '🏛️ Interno'}
                      </span>
                      <span className={`px-4 py-1.5 rounded-full text-sm font-semibold ${
                        evento.status === 'planejamento' ? 'bg-yellow-100 text-yellow-800' :
                        evento.status === 'em_andamento' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {evento.status === 'planejamento' ? '📋 Planejamento' :
                         evento.status === 'em_andamento' ? '⚙️ Em Andamento' : '✅ Concluído'}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">{evento.nome_evento}</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">👤 Idealizador:</span>
                        <span>{evento.idealizador || 'Não informado'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">📍 Local:</span>
                        <span>{evento.local_evento || 'Não informado'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">📅 Aviso:</span>
                        <span>{evento.data_aviso ? new Date(evento.data_aviso + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">🎯 Evento:</span>
                        <span>{new Date(evento.data_prevista + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                    {evento.descricao && (
                      <p className="mt-3 text-sm text-gray-600 bg-gray-50 p-3 rounded">
                        {evento.descricao}
                      </p>
                    )}
                  </div>
                  {podeEditar && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => abrirModal(evento)}
                        className="p-3 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => excluirEvento(evento.id)}
                        className="p-3 text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Excluir"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>

                {/* Informações adicionais em cards */}
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-sm font-semibold text-blue-800 mb-1">💰 Custo Total</div>
                    <div className="text-2xl font-bold text-blue-900">
                      R$ {custoTotal.toFixed(2)}
                    </div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-sm font-semibold text-green-800 mb-1">👥 Participantes</div>
                    <div className="text-2xl font-bold text-green-900">
                      {numParticipantes} irmãos
                    </div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg flex items-center justify-center">
                    <button
                      onClick={() => abrirVisualizacao(evento)}
                      className="text-purple-700 hover:text-purple-900 font-semibold text-sm flex items-center gap-2"
                    >
                      👁️ Ver Detalhes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">
                {modoEdicao ? 'Editar Evento' : 'Novo Evento'}
              </h2>
              <button onClick={fecharModal} className="text-gray-500 hover:text-gray-700">
                ✖️
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Informações Básicas */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Tipo de Evento *</label>
                  <select
                    value={formData.tipo_evento}
                    onChange={(e) => setFormData({...formData, tipo_evento: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="externo">Externo</option>
                    <option value="interno">Interno</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="planejamento">Planejamento</option>
                    <option value="em_andamento">Em Andamento</option>
                    <option value="concluido">Concluído</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Nome do Evento *</label>
                <input
                  type="text"
                  value={formData.nome_evento}
                  onChange={(e) => setFormData({...formData, nome_evento: e.target.value})}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Ex: Festa Junina na Escola Municipal"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Idealizador</label>
                  <input
                    type="text"
                    value={formData.idealizador}
                    onChange={(e) => setFormData({...formData, idealizador: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                    placeholder="Quem está organizando"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Local do Evento</label>
                  <input
                    type="text"
                    value={formData.local_evento}
                    onChange={(e) => setFormData({...formData, local_evento: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                    placeholder="Onde será realizado"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Data do Aviso</label>
                  <input
                    type="date"
                    value={formData.data_aviso}
                    onChange={(e) => setFormData({...formData, data_aviso: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Data Prevista do Evento *</label>
                  <input
                    type="date"
                    value={formData.data_prevista}
                    onChange={(e) => setFormData({...formData, data_prevista: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Descrição</label>
                <textarea
                  value={formData.descricao}
                  onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                  className="w-full border rounded px-3 py-2"
                  rows="3"
                  placeholder="Detalhes sobre o evento..."
                />
              </div>

              {/* Itens/Custos */}
              <div className="border-t pt-6">
                <h3 className="font-bold mb-4 text-lg">💰 Itens e Custos</h3>
                
                <div className="grid grid-cols-12 gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="Descrição do item"
                    value={novoItem.descricao}
                    onChange={(e) => setNovoItem({...novoItem, descricao: e.target.value})}
                    className="col-span-5 border rounded px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Qtd"
                    value={novoItem.quantidade}
                    onChange={(e) => setNovoItem({...novoItem, quantidade: e.target.value})}
                    className="col-span-2 border rounded px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Valor R$"
                    value={novoItem.valor}
                    onChange={(e) => setNovoItem({...novoItem, valor: e.target.value})}
                    className="col-span-3 border rounded px-3 py-2 text-sm"
                  />
                  {itemEditando !== null ? (
                    <>
                      <button
                        onClick={adicionarItem}
                        className="col-span-1 bg-green-600 text-white rounded hover:bg-green-700 flex items-center justify-center"
                        title="Salvar edição"
                      >
                        💾
                      </button>
                      <button
                        onClick={cancelarEdicaoItem}
                        className="col-span-1 bg-gray-500 text-white rounded hover:bg-gray-600 flex items-center justify-center"
                        title="Cancelar"
                      >
                        ✖️
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={adicionarItem}
                      className="col-span-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center justify-center gap-1"
                    >
                      ➕ Adicionar
                    </button>
                  )}
                </div>

                {itensEvento.length > 0 && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-600 px-2">
                      <div className="col-span-5">Descrição</div>
                      <div className="col-span-2 text-center">Qtd</div>
                      <div className="col-span-2 text-right">Valor Unit.</div>
                      <div className="col-span-2 text-right">Total</div>
                      <div className="col-span-1"></div>
                    </div>
                    {itensEvento.map((item, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 items-center bg-gray-50 p-3 rounded-lg border hover:bg-gray-100 transition">
                        <span className="col-span-5 font-medium text-sm">{item.descricao}</span>
                        <span className="col-span-2 text-center text-sm">{item.quantidade}x</span>
                        <span className="col-span-2 text-right text-sm">R$ {parseFloat(item.valor || 0).toFixed(2)}</span>
                        <span className="col-span-2 text-right font-bold text-sm text-blue-600">
                          R$ {(parseFloat(item.valor || 0) * parseFloat(item.quantidade || 1)).toFixed(2)}
                        </span>
                        <div className="col-span-1 flex gap-1 justify-end">
                          <button
                            onClick={() => editarItem(index)}
                            className="text-blue-600 hover:bg-blue-50 p-1.5 rounded transition"
                            title="Editar"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => removerItem(index, item.id)}
                            className="text-red-600 hover:bg-red-50 p-1.5 rounded transition"
                            title="Remover"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                    
                    {/* Total Geral */}
                    <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200 mt-4">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold text-blue-900">💰 Custo Total do Evento</span>
                        <span className="text-2xl font-bold text-blue-900">
                          R$ {totalCusto.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Participantes */}
              <div className="border-t pt-6">
                <h3 className="font-bold mb-4 text-lg">👥 Irmãos Participantes</h3>
                
                <div className="flex gap-2 mb-3">
                  <select
                    value={novoParticipante}
                    onChange={(e) => setNovoParticipante(e.target.value)}
                    className="flex-1 border rounded px-3 py-2"
                  >
                    <option value="">Selecione um irmão...</option>
                    {irmaos.map(irmao => (
                      <option key={irmao.id} value={irmao.id}>
                        {irmao.nome}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={adicionarParticipante}
                    className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 flex items-center gap-2"
                  >
                    ➕ Adicionar
                  </button>
                </div>

                {participantes.length > 0 && (
                  <div className="grid gap-2">
                    {participantes.map((part, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border hover:bg-gray-100 transition">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">👤</span>
                          <span className="font-medium">{part.irmaos?.nome || 'Nome não encontrado'}</span>
                        </div>
                        <button
                          onClick={() => removerParticipante(index, part.id)}
                          className="text-red-600 hover:bg-red-50 p-2 rounded transition"
                          title="Remover"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t p-4 flex justify-end gap-2">
              <button
                onClick={fecharModal}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={salvarEvento}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                💾
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Visualização */}
      {modalVisualizacao && eventoSelecionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">{eventoSelecionado.nome_evento}</h2>
              <button onClick={fecharModal} className="text-gray-500 hover:text-gray-700">
                ✖️
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Informações Básicas */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-semibold text-gray-600">Tipo:</span>
                  <p className="text-lg">{eventoSelecionado.tipo_evento === 'externo' ? '🌍 Externo' : '🏛️ Interno'}</p>
                </div>
                <div>
                  <span className="text-sm font-semibold text-gray-600">Status:</span>
                  <p className="text-lg">
                    {eventoSelecionado.status === 'planejamento' ? '📋 Planejamento' :
                     eventoSelecionado.status === 'em_andamento' ? '⚙️ Em Andamento' : '✅ Concluído'}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-semibold text-gray-600">Idealizador:</span>
                  <p className="text-lg">{eventoSelecionado.idealizador || 'Não informado'}</p>
                </div>
                <div>
                  <span className="text-sm font-semibold text-gray-600">Local:</span>
                  <p className="text-lg">{eventoSelecionado.local_evento || 'Não informado'}</p>
                </div>
                <div>
                  <span className="text-sm font-semibold text-gray-600">Data do Aviso:</span>
                  <p className="text-lg">{eventoSelecionado.data_aviso ? new Date(eventoSelecionado.data_aviso + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</p>
                </div>
                <div>
                  <span className="text-sm font-semibold text-gray-600">Data do Evento:</span>
                  <p className="text-lg">{new Date(eventoSelecionado.data_prevista + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                </div>
              </div>

              {eventoSelecionado.descricao && (
                <div>
                  <span className="text-sm font-semibold text-gray-600">Descrição:</span>
                  <p className="text-gray-700 mt-1">{eventoSelecionado.descricao}</p>
                </div>
              )}

              {/* Itens */}
              {itensEvento.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="font-bold mb-3 text-lg">💰 Itens e Custos</h3>
                  <div className="space-y-2">
                    {itensEvento.map((item, index) => (
                      <div key={index} className="flex justify-between items-center bg-gray-50 p-3 rounded">
                        <span className="font-medium">{item.descricao}</span>
                        <div className="flex gap-4 text-sm">
                          <span>{item.quantidade}x</span>
                          <span>R$ {parseFloat(item.valor || 0).toFixed(2)}</span>
                          <span className="font-bold text-blue-600">
                            R$ {(parseFloat(item.valor || 0) * parseFloat(item.quantidade || 1)).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                    <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold text-blue-900">Total</span>
                        <span className="text-2xl font-bold text-blue-900">
                          R$ {itensEvento.reduce((sum, item) => sum + (parseFloat(item.valor || 0) * parseFloat(item.quantidade || 1)), 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Participantes */}
              {participantes.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="font-bold mb-3 text-lg">👥 Irmãos Participantes ({participantes.length})</h3>
                  <div className="grid grid-cols-4 gap-2">
                    {participantes.map((part, index) => (
                      <div key={index} className="bg-gray-50 p-2 rounded text-sm text-center border hover:bg-gray-100">
                        {part.irmaos?.nome || 'Nome não encontrado'}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-white border-t p-4 flex justify-end">
              <button
                onClick={fecharModal}
                className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
