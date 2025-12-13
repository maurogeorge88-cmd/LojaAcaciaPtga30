import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function Eventos() {
  const [eventos, setEventos] = useState([]);
  const [irmaos, setIrmaos] = useState([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [eventoSelecionado, setEventoSelecionado] = useState(null);
  const [modoEdicao, setModoEdicao] = useState(false);

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
  
  const [participantes, setParticipantes] = useState([]);
  const [novoParticipante, setNovoParticipante] = useState('');

  useEffect(() => {
    carregarEventos();
    carregarIrmaos();
  }, []);

  const carregarEventos = async () => {
    const { data, error } = await supabase
      .from('eventos_loja')
      .select('*')
      .order('data_prevista', { ascending: false });
    
    if (error) {
      console.error('Erro ao carregar eventos:', error);
    } else {
      setEventos(data || []);
    }
  };

  const carregarIrmaos = async () => {
    const { data, error } = await supabase
      .from('irmaos')
      .select('id, nome')
      .eq('ativo', true)
      .order('nome');
    
    if (error) {
      console.error('Erro ao carregar irmãos:', error);
    } else {
      setIrmaos(data || []);
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

  const fecharModal = () => {
    setModalAberto(false);
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
    
    setItensEvento([...itensEvento, { ...novoItem }]);
    setNovoItem({ descricao: '', quantidade: '', valor: '' });
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
        <button
          onClick={() => abrirModal()}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          <span>➕</span>
          Novo Evento
        </button>
      </div>

      {/* Lista de Eventos */}
      <div className="grid gap-4">
        {eventos.map(evento => (
          <div key={evento.id} className="bg-white p-4 rounded-lg shadow">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`px-3 py-1 rounded text-sm ${
                    evento.tipo_evento === 'externo' 
                      ? 'bg-purple-100 text-purple-800' 
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {evento.tipo_evento === 'externo' ? 'Externo' : 'Interno'}
                  </span>
                  <span className={`px-3 py-1 rounded text-sm ${
                    evento.status === 'planejamento' ? 'bg-yellow-100 text-yellow-800' :
                    evento.status === 'em_andamento' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {evento.status === 'planejamento' ? 'Planejamento' :
                     evento.status === 'em_andamento' ? 'Em Andamento' : 'Concluído'}
                  </span>
                </div>
                <h3 className="text-lg font-bold">{evento.nome_evento}</h3>
                <p className="text-gray-600 text-sm mt-1">Idealizador: {evento.idealizador}</p>
                <p className="text-gray-600 text-sm">Local: {evento.local_evento}</p>
                <div className="flex gap-4 mt-2 text-sm">
                  <span>📅 Aviso: {new Date(evento.data_aviso).toLocaleDateString('pt-BR')}</span>
                  <span>📍 Evento: {new Date(evento.data_prevista).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => abrirModal(evento)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                >
                  ✏️
                </button>
                <button
                  onClick={() => excluirEvento(evento.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        ))}
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
                <h3 className="font-bold mb-4">Itens e Custos</h3>
                
                <div className="grid grid-cols-12 gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Descrição do item"
                    value={novoItem.descricao}
                    onChange={(e) => setNovoItem({...novoItem, descricao: e.target.value})}
                    className="col-span-6 border rounded px-3 py-2"
                  />
                  <input
                    type="number"
                    placeholder="Qtd"
                    value={novoItem.quantidade}
                    onChange={(e) => setNovoItem({...novoItem, quantidade: e.target.value})}
                    className="col-span-2 border rounded px-3 py-2"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Valor R$"
                    value={novoItem.valor}
                    onChange={(e) => setNovoItem({...novoItem, valor: e.target.value})}
                    className="col-span-3 border rounded px-3 py-2"
                  />
                  <button
                    onClick={adicionarItem}
                    className="col-span-1 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    ➕
                  </button>
                </div>

                {itensEvento.length > 0 && (
                  <div className="space-y-2">
                    {itensEvento.map((item, index) => (
                      <div key={index} className="flex items-center gap-2 bg-gray-50 p-2 rounded">
                        <span className="flex-1">{item.descricao}</span>
                        <span className="w-16 text-center">{item.quantidade}x</span>
                        <span className="w-24 text-right">R$ {parseFloat(item.valor || 0).toFixed(2)}</span>
                        <span className="w-24 text-right font-bold">
                          R$ {(parseFloat(item.valor || 0) * parseFloat(item.quantidade || 1)).toFixed(2)}
                        </span>
                        <button
                          onClick={() => removerItem(index, item.id)}
                          className="text-red-600 hover:bg-red-50 p-1 rounded"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                    <div className="text-right font-bold text-lg mt-4">
                      Total: R$ {totalCusto.toFixed(2)}
                    </div>
                  </div>
                )}
              </div>

              {/* Participantes */}
              <div className="border-t pt-6">
                <h3 className="font-bold mb-4">Irmãos Participantes</h3>
                
                <div className="flex gap-2 mb-2">
                  <select
                    value={novoParticipante}
                    onChange={(e) => setNovoParticipante(e.target.value)}
                    className="flex-1 border rounded px-3 py-2"
                  >
                    <option value="">Selecione um irmão...</option>
                    {irmaos.map(irmao => (
                      <option key={irmao.id} value={irmao.id}>{irmao.nome}</option>
                    ))}
                  </select>
                  <button
                    onClick={adicionarParticipante}
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                  >
                    ➕
                  </button>
                </div>

                {participantes.length > 0 && (
                  <div className="space-y-1">
                    {participantes.map((part, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                        <span>{part.irmaos.nome}</span>
                        <button
                          onClick={() => removerParticipante(index, part.id)}
                          className="text-red-600 hover:bg-red-50 p-1 rounded"
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
    </div>
  );
}
