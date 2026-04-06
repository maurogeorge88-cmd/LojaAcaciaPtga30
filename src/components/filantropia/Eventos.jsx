import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function Eventos({ userPermissions, userData }) {
  const [eventos, setEventos] = useState([]);
  const [irmaos, setIrmaos] = useState([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [modalVisualizacao, setModalVisualizacao] = useState(false);
  const [eventoSelecionado, setEventoSelecionado] = useState(null);
  const [modoEdicao, setModoEdicao] = useState(false);

  // Verificar se tem permissão de edição
  // Admin pode editar eventos
  const podeEditar = Boolean(
    userPermissions?.pode_gerenciar_usuarios || 
    userPermissions?.canManageUsers
  );

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
    <div style={{padding:"1.5rem",background:"var(--color-bg)",minHeight:"100vh",overflowX:"hidden"}}>
      <div className="flex justify-between items-center mb-6">
        <h1 style={{fontSize:"1.5rem",fontWeight:"700",color:"var(--color-text)"}}>📅 Eventos da Loja</h1>
        {podeEditar && (
          <button
            onClick={() => abrirModal()}
            style={{display:"flex",alignItems:"center",gap:"0.5rem",background:"var(--color-accent)",color:"#fff",padding:"0.5rem 1rem",borderRadius:"var(--radius-md)",border:"none",cursor:"pointer",fontWeight:"600"}}
          >
            <span>➕</span>
            Novo Evento
          </button>
        )}
      </div>

      {/* Aviso para irmãos sem permissão */}
      {!podeEditar && (
        <div style={{background:"var(--color-accent-bg)",borderLeft:"4px solid var(--color-accent)",padding:"1rem",borderRadius:"0 var(--radius-md) var(--radius-md) 0",marginBottom:"1.5rem"}}>
          <div className="flex items-center gap-2">
            <span style={{fontSize:"1.1rem"}}>ℹ️</span>
            <p style={{fontSize:"0.875rem",color:"var(--color-text)"}}>
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
            <div key={evento.id} className="overflow-hidden border-l-4" 
                 style={{
                   background: 'var(--color-surface)',
                   borderRadius: 'var(--radius-lg)',
                   borderLeftColor: evento.tipo_evento === 'externo' ? 'var(--color-accent)' : '#10b981',
                   boxShadow: 'var(--shadow-md)',
                   transition: 'all 0.3s ease'
                 }}
                 onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                 onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{padding:"1.5rem",background:"var(--color-bg)",minHeight:"100vh",overflowX:"hidden"}}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span style={{
                        background: evento.tipo_evento === 'externo' ? 'var(--color-accent-bg)' : 'rgba(16,185,129,0.12)',
                        color: evento.tipo_evento === 'externo' ? 'var(--color-accent)' : '#10b981',
                        padding: '0.375rem 1rem',
                        borderRadius: '9999px',
                        fontSize: '0.875rem',
                        fontWeight: '600'
                      }}>
                        {evento.tipo_evento === 'externo' ? '🌍 Externo' : '🏛️ Interno'}
                      </span>
                      <span style={{
                        background: evento.status === 'planejamento' ? 'rgba(245,158,11,0.12)' :
                                  evento.status === 'em_andamento' ? 'rgba(59,130,246,0.12)' : 'var(--color-surface-2)',
                        color: evento.status === 'planejamento' ? '#f59e0b' :
                               evento.status === 'em_andamento' ? '#3b82f6' : 'var(--color-text-muted)',
                        padding: '0.375rem 1rem',
                        borderRadius: '9999px',
                        fontSize: '0.875rem',
                        fontWeight: '600'
                      }}>
                        {evento.status === 'planejamento' ? '📋 Planejamento' :
                         evento.status === 'em_andamento' ? '⚙️ Em Andamento' : '✅ Concluído'}
                      </span>
                    </div>
                    <h3 style={{ 
                      fontSize: '1.25rem', 
                      fontWeight: '700', 
                      color: 'var(--color-text)', 
                      marginBottom: '0.5rem' 
                    }}>
                      {evento.nome_evento}
                    </h3>
                    <div className="grid grid-cols-2 gap-3" style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                      <div className="flex items-center gap-2">
                        <span style={{ fontWeight: '600' }}>👤 Idealizador:</span>
                        <span>{evento.idealizador || 'Não informado'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span style={{ fontWeight: '600' }}>📍 Local:</span>
                        <span>{evento.local_evento || 'Não informado'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span style={{ fontWeight: '600' }}>📅 Aviso:</span>
                        <span>{evento.data_aviso ? new Date(evento.data_aviso + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span style={{ fontWeight: '600' }}>🎯 Evento:</span>
                        <span>{new Date(evento.data_prevista + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                    {evento.descricao && (
                      <p style={{ 
                        marginTop: '0.75rem', 
                        fontSize: '0.875rem', 
                        color: 'var(--color-text-muted)', 
                        background: 'var(--color-surface-2)', 
                        padding: '0.75rem', 
                        borderRadius: 'var(--radius-lg)' 
                      }}>
                        {evento.descricao}
                      </p>
                    )}
                  </div>
                  {podeEditar && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => abrirModal(evento)}
                        style={{padding:"0.35rem 0.65rem",background:"var(--color-accent-bg)",color:"var(--color-accent)",border:"1px solid var(--color-accent)",borderRadius:"var(--radius-md)",cursor:"pointer",fontSize:"0.9rem"}}
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => excluirEvento(evento.id)}
                        style={{padding:"0.35rem 0.65rem",background:"rgba(239,68,68,0.15)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"var(--radius-md)",cursor:"pointer",fontSize:"0.9rem"}}
                        title="Excluir"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>

                {/* Informações adicionais em cards */}
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div style={{ background: 'rgba(59,130,246,0.12)', padding: '1rem', borderRadius: 'var(--radius-lg)' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#3b82f6', marginBottom: '0.25rem' }}>
                      💰 Custo Total
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#3b82f6' }}>
                      R$ {custoTotal.toFixed(2)}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(16,185,129,0.12)', padding: '1rem', borderRadius: 'var(--radius-lg)' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#10b981', marginBottom: '0.25rem' }}>
                      👥 Participantes
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#10b981' }}>
                      {numParticipantes} irmãos
                    </div>
                  </div>
                  <div style={{ background: 'var(--color-accent-bg)', padding: '1rem', borderRadius: 'var(--radius-lg)' }} className="flex items-center justify-center">
                    <button
                      onClick={() => abrirVisualizacao(evento)}
                      style={{background:"none",border:"none",cursor:"pointer",fontWeight:"600",fontSize:"0.875rem",textDecoration:"underline"}}
                      style={{ color: 'var(--color-accent)' }}
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
          <div style={{background:"var(--color-surface)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-xl)",width:"100%",maxWidth:"56rem",maxHeight:"90vh",overflowY:"auto"}}>
            <div style={{position:"sticky",top:0,background:"var(--color-accent)",padding:"1rem",display:"flex",justifyContent:"space-between",alignItems:"center",zIndex:10}}>
              <h2 style={{fontSize:"1.1rem",fontWeight:"700",color:"#fff",margin:0}}>{modoEdicao ? 'Editar Evento' : 'Novo Evento'}</h2>
              <button onClick={fecharModal} style={{color:"#fff",background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:"50%",width:"2rem",height:"2rem",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:"1.1rem",fontWeight:"700"}}>
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
                    style={{width:"100%",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-md)",padding:"0.5rem 0.75rem",outline:"none"}}
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
                    style={{width:"100%",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-md)",padding:"0.5rem 0.75rem",outline:"none"}}
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
                  style={{width:"100%",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-md)",padding:"0.5rem 0.75rem",outline:"none"}}
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
                    style={{width:"100%",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-md)",padding:"0.5rem 0.75rem",outline:"none"}}
                    placeholder="Quem está organizando"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Local do Evento</label>
                  <input
                    type="text"
                    value={formData.local_evento}
                    onChange={(e) => setFormData({...formData, local_evento: e.target.value})}
                    style={{width:"100%",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-md)",padding:"0.5rem 0.75rem",outline:"none"}}
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
                    style={{width:"100%",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-md)",padding:"0.5rem 0.75rem",outline:"none"}}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Data Prevista do Evento *</label>
                  <input
                    type="date"
                    value={formData.data_prevista}
                    onChange={(e) => setFormData({...formData, data_prevista: e.target.value})}
                    style={{width:"100%",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-md)",padding:"0.5rem 0.75rem",outline:"none"}}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Descrição</label>
                <textarea
                  value={formData.descricao}
                  onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                  style={{width:"100%",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-md)",padding:"0.5rem 0.75rem",outline:"none"}}
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
                        style={{background:"#10b981",color:"#fff",borderRadius:"var(--radius-md)",border:"none",padding:"0.5rem",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}
                        title="Salvar edição"
                      >
                        💾
                      </button>
                      <button
                        onClick={cancelarEdicaoItem}
                        style={{background:"var(--color-surface-2)",color:"var(--color-text)",borderRadius:"var(--radius-md)",border:"1px solid var(--color-border)",padding:"0.5rem",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}
                        title="Cancelar"
                      >
                        ✖️
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={adicionarItem}
                      style={{gridColumn:"span 2",background:"#10b981",color:"#fff",borderRadius:"var(--radius-md)",border:"none",padding:"0.5rem",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.25rem"}}
                    >
                      ➕ Adicionar
                    </button>
                  )}
                </div>

                {itensEvento.length > 0 && (
                  <div className="space-y-2">
                    <div style={{display:"grid",gridTemplateColumns:"repeat(12,minmax(0,1fr))",gap:"0.5rem",fontSize:"0.72rem",fontWeight:"700",color:"var(--color-text-muted)",padding:"0 0.5rem"}}>
                      <div className="col-span-5">Descrição</div>
                      <div className="col-span-2 text-center">Qtd</div>
                      <div className="col-span-2 text-right">Valor Unit.</div>
                      <div className="col-span-2 text-right">Total</div>
                      <div className="col-span-1"></div>
                    </div>
                    {itensEvento.map((item, index) => (
                      <div key={index} style={{display:"grid",gridTemplateColumns:"repeat(12,minmax(0,1fr))",gap:"0.5rem",alignItems:"center",background:"var(--color-surface-2)",padding:"0.75rem",borderRadius:"var(--radius-md)",border:"1px solid var(--color-border)"}}>
                        <span className="col-span-5 font-medium text-sm">{item.descricao}</span>
                        <span className="col-span-2 text-center text-sm">{item.quantidade}x</span>
                        <span className="col-span-2 text-right text-sm">R$ {parseFloat(item.valor || 0).toFixed(2)}</span>
                        <span style={{gridColumn:"span 2",textAlign:"right",fontWeight:"700",fontSize:"0.875rem",color:"var(--color-accent)"}}>
                          R$ {(parseFloat(item.valor || 0) * parseFloat(item.quantidade || 1)).toFixed(2)}
                        </span>
                        <div className="col-span-1 flex gap-1 justify-end">
                          <button
                            onClick={() => editarItem(index)}
                            style={{color:"var(--color-accent)",background:"none",border:"none",padding:"0.35rem",borderRadius:"var(--radius-sm)",cursor:"pointer"}}
                            title="Editar"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => removerItem(index, item.id)}
                            style={{color:"#ef4444",background:"none",border:"none",padding:"0.35rem",borderRadius:"var(--radius-sm)",cursor:"pointer"}}
                            title="Remover"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                    
                    {/* Total Geral */}
                    <div style={{background:"var(--color-accent-bg)",padding:"1rem",borderRadius:"var(--radius-lg)",border:"1px solid var(--color-accent)",marginTop:"1rem"}}>
                      <div className="flex justify-between items-center">
                        <span style={{fontSize:"1rem",fontWeight:"700",color:"var(--color-text)"}}>💰 Custo Total do Evento</span>
                        <span style={{fontSize:"1.5rem",fontWeight:"800",color:"var(--color-accent)"}}>
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
                      <div key={index} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"var(--color-surface-2)",padding:"0.75rem",borderRadius:"var(--radius-md)",border:"1px solid var(--color-border)"}}>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">👤</span>
                          <span className="font-medium">{part.irmaos?.nome || 'Nome não encontrado'}</span>
                        </div>
                        <button
                          onClick={() => removerParticipante(index, part.id)}
                          style={{color:"#ef4444",background:"none",border:"none",padding:"0.5rem",borderRadius:"var(--radius-sm)",cursor:"pointer"}}
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

            <div style={{position:"sticky",bottom:0,background:"var(--color-surface)",borderTop:"1px solid var(--color-border)",padding:"1rem",display:"flex",justifyContent:"flex-end",gap:"0.5rem"}}>
              <button
                onClick={fecharModal}
                style={{padding:"0.5rem 1rem",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-md)",cursor:"pointer"}}
              >
                Cancelar
              </button>
              <button
                onClick={salvarEvento}
                style={{display:"flex",alignItems:"center",gap:"0.5rem",background:"var(--color-accent)",color:"#fff",padding:"0.5rem 1rem",borderRadius:"var(--radius-md)",border:"none",cursor:"pointer",fontWeight:"600"}}
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
          <div style={{background:"var(--color-surface)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-xl)",width:"100%",maxWidth:"56rem",maxHeight:"90vh",overflowY:"auto"}}>
            <div style={{position:"sticky",top:0,background:"var(--color-accent)",padding:"1rem",display:"flex",justifyContent:"space-between",alignItems:"center",zIndex:10}}>
              <h2 className="text-xl font-bold">{eventoSelecionado.nome_evento}</h2>
              <button onClick={fecharModal} style={{color:"#fff",background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:"50%",width:"2rem",height:"2rem",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:"1.1rem",fontWeight:"700"}}>
                ✖️
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Informações Básicas */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span style={{fontSize:"0.82rem",fontWeight:"600",color:"var(--color-text-muted)"}}>Tipo:</span>
                  <p className="text-lg">{eventoSelecionado.tipo_evento === 'externo' ? '🌍 Externo' : '🏛️ Interno'}</p>
                </div>
                <div>
                  <span style={{fontSize:"0.82rem",fontWeight:"600",color:"var(--color-text-muted)"}}>Status:</span>
                  <p className="text-lg">
                    {eventoSelecionado.status === 'planejamento' ? '📋 Planejamento' :
                     eventoSelecionado.status === 'em_andamento' ? '⚙️ Em Andamento' : '✅ Concluído'}
                  </p>
                </div>
                <div>
                  <span style={{fontSize:"0.82rem",fontWeight:"600",color:"var(--color-text-muted)"}}>Idealizador:</span>
                  <p className="text-lg">{eventoSelecionado.idealizador || 'Não informado'}</p>
                </div>
                <div>
                  <span style={{fontSize:"0.82rem",fontWeight:"600",color:"var(--color-text-muted)"}}>Local:</span>
                  <p className="text-lg">{eventoSelecionado.local_evento || 'Não informado'}</p>
                </div>
                <div>
                  <span style={{fontSize:"0.82rem",fontWeight:"600",color:"var(--color-text-muted)"}}>Data do Aviso:</span>
                  <p className="text-lg">{eventoSelecionado.data_aviso ? new Date(eventoSelecionado.data_aviso + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</p>
                </div>
                <div>
                  <span style={{fontSize:"0.82rem",fontWeight:"600",color:"var(--color-text-muted)"}}>Data do Evento:</span>
                  <p className="text-lg">{new Date(eventoSelecionado.data_prevista + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                </div>
              </div>

              {eventoSelecionado.descricao && (
                <div>
                  <span style={{fontSize:"0.82rem",fontWeight:"600",color:"var(--color-text-muted)"}}>Descrição:</span>
                  <p style={{color:"var(--color-text)",marginTop:"0.25rem"}}>{eventoSelecionado.descricao}</p>
                </div>
              )}

              {/* Itens */}
              {itensEvento.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="font-bold mb-3 text-lg">💰 Itens e Custos</h3>
                  <div className="space-y-2">
                    {itensEvento.map((item, index) => (
                      <div key={index} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"var(--color-surface-2)",padding:"0.75rem",borderRadius:"var(--radius-md)"}}>
                        <span className="font-medium">{item.descricao}</span>
                        <div className="flex gap-4 text-sm">
                          <span>{item.quantidade}x</span>
                          <span>R$ {parseFloat(item.valor || 0).toFixed(2)}</span>
                          <span style={{fontWeight:"700",color:"var(--color-accent)"}}>
                            R$ {(parseFloat(item.valor || 0) * parseFloat(item.quantidade || 1)).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                    <div style={{background:"var(--color-accent-bg)",padding:"1rem",borderRadius:"var(--radius-lg)",border:"1px solid var(--color-accent)"}}>
                      <div className="flex justify-between items-center">
                        <span style={{fontSize:"1rem",fontWeight:"700",color:"var(--color-text)"}}>Total</span>
                        <span style={{fontSize:"1.5rem",fontWeight:"800",color:"var(--color-accent)"}}>
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
                      <div key={index} style={{background:"var(--color-surface-2)",padding:"0.5rem",borderRadius:"var(--radius-md)",fontSize:"0.875rem",textAlign:"center",border:"1px solid var(--color-border)",color:"var(--color-text)"}}>
                        {part.irmaos?.nome || 'Nome não encontrado'}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{position:"sticky",bottom:0,background:"var(--color-surface)",borderTop:"1px solid var(--color-border)",padding:"1rem",display:"flex",justifyContent:"flex-end"}}>
              <button
                onClick={fecharModal}
                style={{padding:"0.5rem 1.5rem",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-md)",cursor:"pointer",fontWeight:"600"}}
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
