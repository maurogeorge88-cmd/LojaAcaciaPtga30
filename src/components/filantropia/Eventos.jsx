import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function Eventos({ userPermissions, userData }) {
  const [eventos, setEventos] = useState([]);
  const [irmaos, setIrmaos] = useState([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [modalVisualizacao, setModalVisualizacao] = useState(false);
  const [eventoSelecionado, setEventoSelecionado] = useState(null);
  const [modoEdicao, setModoEdicao] = useState(false);

  const podeEditar = Boolean(
    userPermissions?.pode_gerenciar_usuarios ||
    userPermissions?.canManageUsers
  );

  const [formData, setFormData] = useState({
    tipo_evento: 'externo',
    nome_evento: '',
    idealizador: '',
    local_evento: '',
    data_aviso: '',
    data_prevista: '',
    descricao: '',
    status: 'planejamento'
  });

  const [itensEvento, setItensEvento] = useState([]);
  const [novoItem, setNovoItem] = useState({ descricao: '', quantidade: '', valor: '' });
  const [itemEditando, setItemEditando] = useState(null);

  const [participantes, setParticipantes] = useState([]);
  const [novoParticipante, setNovoParticipante] = useState('');

  const [todosItens, setTodosItens] = useState([]);
  const [todosParticipantes, setTodosParticipantes] = useState([]);

  useEffect(() => {
    carregarEventos();
    carregarIrmaos();
    carregarTodosItens();
    carregarTodosParticipantes();
  }, []);

  const carregarTodosItens = async () => {
    const { data, error } = await supabase.from('eventos_itens').select('*');
    if (!error) setTodosItens(data || []);
  };

  const carregarTodosParticipantes = async () => {
    const { data, error } = await supabase.from('eventos_participantes').select('*');
    if (!error) setTodosParticipantes(data || []);
  };

  const carregarEventos = async () => {
    const { data, error } = await supabase
      .from('eventos_loja')
      .select('*')
      .order('data_prevista', { ascending: false })
      .limit(100);

    if (error) console.error('Erro ao carregar eventos:', error);
    else setEventos(data || []);
  };

  const carregarIrmaos = async () => {
    const { data, error } = await supabase
      .from('irmaos')
      .select('id, nome, situacao')
      .order('nome');

    if (error) {
      console.error('Erro ao carregar irmãos:', error);
    } else {
      const irmaosFiltrados = (data || []).filter(irmao => {
        const situacao = (irmao.situacao || 'regular').toLowerCase();
        return situacao === 'regular' || situacao === 'licenciado';
      });
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
    if (!error) setItensEvento(data || []);
  };

  const carregarParticipantes = async (eventoId) => {
    const { data, error } = await supabase
      .from('eventos_participantes')
      .select('id, irmao_id, irmaos (nome)')
      .eq('evento_id', eventoId);
    if (!error) setParticipantes(data || []);
  };

  const salvarEvento = async () => {
    if (!formData.nome_evento || !formData.data_prevista) {
      alert('Preencha os campos obrigatórios!');
      return;
    }

    if (modoEdicao && eventoSelecionado) {
      const { error } = await supabase
        .from('eventos_loja')
        .update(formData)
        .eq('id', eventoSelecionado.id);

      if (error) { alert('Erro ao atualizar evento!'); return; }
      await salvarItens(eventoSelecionado.id);
    } else {
      const { data, error } = await supabase
        .from('eventos_loja')
        .insert([formData])
        .select();

      if (error) { alert('Erro ao criar evento!'); return; }
      if (data?.[0]) await salvarItens(data[0].id);
    }

    carregarEventos();
    carregarTodosItens();
    carregarTodosParticipantes();
    fecharModal();
  };

  const salvarItens = async (eventoId) => {
    for (const item of itensEvento) {
      if (!item.id) {
        await supabase.from('eventos_itens').insert([{
          evento_id: eventoId,
          descricao: item.descricao,
          quantidade: item.quantidade,
          valor: item.valor
        }]);
      }
    }
    for (const participante of participantes) {
      if (!participante.id) {
        await supabase.from('eventos_participantes').insert([{
          evento_id: eventoId,
          irmao_id: participante.irmao_id
        }]);
      }
    }
  };

  const excluirEvento = async (id) => {
    if (!confirm('Deseja realmente excluir este evento?')) return;
    await supabase.from('eventos_itens').delete().eq('evento_id', id);
    await supabase.from('eventos_participantes').delete().eq('evento_id', id);
    const { error } = await supabase.from('eventos_loja').delete().eq('id', id);
    if (error) alert('Erro ao excluir evento!');
    else carregarEventos();
  };

  const adicionarItem = () => {
    if (!novoItem.descricao) return;
    if (itemEditando !== null) {
      const novosItens = [...itensEvento];
      novosItens[itemEditando] = { ...novoItem };
      setItensEvento(novosItens);
      setItemEditando(null);
    } else {
      setItensEvento([...itensEvento, { ...novoItem }]);
    }
    setNovoItem({ descricao: '', quantidade: '', valor: '' });
  };

  const editarItem = (index) => { setNovoItem(itensEvento[index]); setItemEditando(index); };
  const cancelarEdicaoItem = () => { setNovoItem({ descricao: '', quantidade: '', valor: '' }); setItemEditando(null); };

  const removerItem = async (index, itemId) => {
    if (itemId) await supabase.from('eventos_itens').delete().eq('id', itemId);
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
    if (participanteId) await supabase.from('eventos_participantes').delete().eq('id', participanteId);
    setParticipantes(participantes.filter((_, i) => i !== index));
  };

  const totalCusto = itensEvento.reduce((sum, item) => {
    return sum + (parseFloat(item.valor) || 0) * (parseFloat(item.quantidade) || 1);
  }, 0);

  return (
    <div className="p-6">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Eventos da Loja</h1>
        {podeEditar && (
          <button
            onClick={() => abrirModal()}
            style={{
              background: 'var(--color-accent)', color: 'white', border: 'none',
              borderRadius: '0.5rem', padding: '0.625rem 1.25rem',
              fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}
          >
            <span>➕</span> Novo Evento
          </button>
        )}
      </div>

      {/* Aviso para irmãos sem permissão */}
      {!podeEditar && (
        <div className="rounded-r-lg p-4 mb-6" style={{
          background: 'var(--color-surface-3)',
          borderLeft: '4px solid var(--color-accent)'
        }}>
          <div className="flex items-center gap-2">
            <span className="text-lg">ℹ️</span>
            <p className="text-sm" style={{ color: 'var(--color-text)' }}>
              <strong>Visualização:</strong> Você pode visualizar os eventos da loja.
              Para criar ou editar eventos, entre em contato com a administração.
            </p>
          </div>
        </div>
      )}

      {/* LISTA DE EVENTOS */}
      <div className="grid gap-4">
        {eventos.map(evento => {
          const custoTotal = todosItens
            .filter(item => item.evento_id === evento.id)
            .reduce((sum, item) => sum + (parseFloat(item.valor || 0) * parseFloat(item.quantidade || 1)), 0);
          const numParticipantes = todosParticipantes.filter(p => p.evento_id === evento.id).length;

          return (
            <div key={evento.id} className="card overflow-hidden"
              style={{
                borderLeft: `4px solid ${evento.tipo_evento === 'externo' ? 'var(--color-accent)' : 'var(--gradient-from)'}`,
                transition: 'transform 0.2s ease, box-shadow 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    {/* Badges tipo e status */}
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <span style={{
                        background: 'var(--color-surface-3)',
                        color: 'var(--color-accent)',
                        border: '1px solid var(--color-border)',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.875rem',
                        fontWeight: '600'
                      }}>
                        {evento.tipo_evento === 'externo' ? '🌍 Externo' : '🏛️ Interno'}
                      </span>
                      <span style={{
                        background: 'var(--color-surface-3)',
                        color: evento.status === 'concluido' ? '#16a34a' :
                               evento.status === 'em_andamento' ? 'var(--color-accent)' : '#ca8a04',
                        border: '1px solid var(--color-border)',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.875rem',
                        fontWeight: '600'
                      }}>
                        {evento.status === 'planejamento' ? '📋 Planejamento' :
                         evento.status === 'em_andamento' ? '⚙️ Em Andamento' : '✅ Concluído'}
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--color-text)', marginBottom: '0.5rem' }}>
                      {evento.nome_evento}
                    </h3>

                    <div className="grid grid-cols-2 gap-3" style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
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
                        marginTop: '0.75rem', fontSize: '0.875rem',
                        color: 'var(--color-text-secondary)',
                        background: 'var(--color-surface-3)',
                        padding: '0.75rem', borderRadius: '0.5rem'
                      }}>
                        {evento.descricao}
                      </p>
                    )}
                  </div>

                  {podeEditar && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => abrirModal(evento)}
                        title="Editar"
                        style={{
                          background: 'var(--color-surface-3)', color: 'var(--color-text)',
                          border: '1px solid var(--color-border)', borderRadius: '0.5rem',
                          padding: '0.5rem', cursor: 'pointer', fontSize: '1rem'
                        }}
                      >✏️</button>
                      <button
                        onClick={() => excluirEvento(evento.id)}
                        title="Excluir"
                        style={{
                          background: 'rgba(239,68,68,0.1)', color: '#dc2626',
                          border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.5rem',
                          padding: '0.5rem', cursor: 'pointer', fontSize: '1rem'
                        }}
                      >🗑️</button>
                    </div>
                  )}
                </div>

                {/* Mini cards de resumo */}
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)', padding: '1rem', borderRadius: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>💰 Custo Total</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--color-accent)' }}>R$ {custoTotal.toFixed(2)}</div>
                  </div>
                  <div style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)', padding: '1rem', borderRadius: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>👥 Participantes</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--color-accent)' }}>{numParticipantes} irmãos</div>
                  </div>
                  <div style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)', padding: '1rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <button
                      onClick={() => abrirVisualizacao(evento)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--color-accent)', fontWeight: '600', fontSize: '0.875rem'
                      }}
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

      {eventos.length === 0 && (
        <div className="text-center py-12" style={{ color: 'var(--color-text-secondary)' }}>
          <p className="text-xl">Nenhum evento cadastrado</p>
        </div>
      )}

      {/* MODAL EDIÇÃO/CRIAÇÃO */}
      {modalAberto && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1rem'
        }}>
          <div className="card" style={{
            width: '100%', maxWidth: '56rem', maxHeight: '90vh',
            overflow: 'hidden', display: 'flex', flexDirection: 'column', margin: 0
          }}>
            {/* Header fixo */}
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="text-xl font-bold">{modoEdicao ? 'Editar Evento' : 'Novo Evento'}</h2>
              <button onClick={fecharModal} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', opacity: 0.8 }}>✖️</button>
            </div>

            {/* Corpo com scroll */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Tipo de Evento *</label>
                  <select value={formData.tipo_evento} onChange={(e) => setFormData({...formData, tipo_evento: e.target.value})} className="form-input">
                    <option value="externo">Externo</option>
                    <option value="interno">Interno</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Status</label>
                  <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})} className="form-input">
                    <option value="planejamento">Planejamento</option>
                    <option value="em_andamento">Em Andamento</option>
                    <option value="concluido">Concluído</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Nome do Evento *</label>
                <input type="text" value={formData.nome_evento} onChange={(e) => setFormData({...formData, nome_evento: e.target.value})} className="form-input" placeholder="Ex: Festa Junina na Escola Municipal" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Idealizador</label>
                  <input type="text" value={formData.idealizador} onChange={(e) => setFormData({...formData, idealizador: e.target.value})} className="form-input" placeholder="Quem está organizando" />
                </div>
                <div>
                  <label className="form-label">Local do Evento</label>
                  <input type="text" value={formData.local_evento} onChange={(e) => setFormData({...formData, local_evento: e.target.value})} className="form-input" placeholder="Onde será realizado" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Data do Aviso</label>
                  <input type="date" value={formData.data_aviso} onChange={(e) => setFormData({...formData, data_aviso: e.target.value})} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Data Prevista do Evento *</label>
                  <input type="date" value={formData.data_prevista} onChange={(e) => setFormData({...formData, data_prevista: e.target.value})} className="form-input" />
                </div>
              </div>

              <div>
                <label className="form-label">Descrição</label>
                <textarea value={formData.descricao} onChange={(e) => setFormData({...formData, descricao: e.target.value})} className="form-input" rows="3" placeholder="Detalhes sobre o evento..." />
              </div>

              {/* Itens/Custos */}
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1.25rem' }}>
                <h3 className="font-bold mb-4 text-lg" style={{ color: 'var(--color-text)' }}>💰 Itens e Custos</h3>

                <div className="grid grid-cols-12 gap-2 mb-3">
                  <input type="text" placeholder="Descrição do item" value={novoItem.descricao} onChange={(e) => setNovoItem({...novoItem, descricao: e.target.value})} className="form-input col-span-5" style={{ fontSize: '0.875rem' }} />
                  <input type="number" placeholder="Qtd" value={novoItem.quantidade} onChange={(e) => setNovoItem({...novoItem, quantidade: e.target.value})} className="form-input col-span-2" style={{ fontSize: '0.875rem' }} />
                  <input type="number" step="0.01" placeholder="Valor R$" value={novoItem.valor} onChange={(e) => setNovoItem({...novoItem, valor: e.target.value})} className="form-input col-span-3" style={{ fontSize: '0.875rem' }} />
                  {itemEditando !== null ? (
                    <>
                      <button onClick={adicionarItem} className="col-span-1 rounded flex items-center justify-center" style={{ background: 'var(--color-accent)', color: 'white', border: 'none', cursor: 'pointer' }} title="Salvar">💾</button>
                      <button onClick={cancelarEdicaoItem} className="col-span-1 rounded flex items-center justify-center" style={{ background: 'var(--color-surface-3)', color: 'var(--color-text)', border: '1px solid var(--color-border)', cursor: 'pointer' }} title="Cancelar">✖️</button>
                    </>
                  ) : (
                    <button onClick={adicionarItem} className="col-span-2 rounded flex items-center justify-center gap-1" style={{ background: 'var(--color-accent)', color: 'white', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}>➕ Add</button>
                  )}
                </div>

                {itensEvento.length > 0 && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-12 gap-2 px-2" style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-text-secondary)' }}>
                      <div className="col-span-5">Descrição</div>
                      <div className="col-span-2 text-center">Qtd</div>
                      <div className="col-span-2 text-right">Unit.</div>
                      <div className="col-span-2 text-right">Total</div>
                      <div className="col-span-1"></div>
                    </div>
                    {itensEvento.map((item, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 items-center p-3 rounded-lg" style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)' }}>
                        <span className="col-span-5 font-medium text-sm" style={{ color: 'var(--color-text)' }}>{item.descricao}</span>
                        <span className="col-span-2 text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>{item.quantidade}x</span>
                        <span className="col-span-2 text-right text-sm" style={{ color: 'var(--color-text-secondary)' }}>R$ {parseFloat(item.valor || 0).toFixed(2)}</span>
                        <span className="col-span-2 text-right font-bold text-sm" style={{ color: 'var(--color-accent)' }}>
                          R$ {(parseFloat(item.valor || 0) * parseFloat(item.quantidade || 1)).toFixed(2)}
                        </span>
                        <div className="col-span-1 flex gap-1 justify-end">
                          <button onClick={() => editarItem(index)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }} title="Editar">✏️</button>
                          <button onClick={() => removerItem(index, item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }} title="Remover">🗑️</button>
                        </div>
                      </div>
                    ))}
                    <div className="p-4 rounded-lg" style={{ background: 'var(--color-surface-3)', border: '2px solid var(--color-accent)' }}>
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>💰 Custo Total do Evento</span>
                        <span className="text-2xl font-bold" style={{ color: 'var(--color-accent)' }}>R$ {totalCusto.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Participantes */}
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1.25rem' }}>
                <h3 className="font-bold mb-4 text-lg" style={{ color: 'var(--color-text)' }}>👥 Irmãos Participantes</h3>
                <div className="flex gap-2 mb-3">
                  <select value={novoParticipante} onChange={(e) => setNovoParticipante(e.target.value)} className="form-input flex-1">
                    <option value="">Selecione um irmão...</option>
                    {irmaos.map(irmao => <option key={irmao.id} value={irmao.id}>{irmao.nome}</option>)}
                  </select>
                  <button onClick={adicionarParticipante} style={{ background: 'var(--color-accent)', color: 'white', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1rem', fontWeight: '600', cursor: 'pointer' }}>➕ Adicionar</button>
                </div>
                {participantes.length > 0 && (
                  <div className="grid gap-2">
                    {participantes.map((part, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)' }}>
                        <div className="flex items-center gap-2">
                          <span>👤</span>
                          <span className="font-medium" style={{ color: 'var(--color-text)' }}>{part.irmaos?.nome || 'Nome não encontrado'}</span>
                        </div>
                        <button onClick={() => removerParticipante(index, part.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '0.25rem' }} title="Remover">🗑️</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer fixo */}
            <div style={{ borderTop: '1px solid var(--color-border)', padding: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={fecharModal} style={{ background: 'var(--color-surface-3)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.625rem 1.25rem', fontWeight: '600', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={salvarEvento} style={{ background: 'var(--color-accent)', color: 'white', border: 'none', borderRadius: '0.5rem', padding: '0.625rem 1.25rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                💾 Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VISUALIZAÇÃO */}
      {modalVisualizacao && eventoSelecionado && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1rem'
        }}>
          <div className="card" style={{
            width: '100%', maxWidth: '56rem', maxHeight: '90vh',
            overflow: 'hidden', display: 'flex', flexDirection: 'column', margin: 0
          }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="text-xl font-bold">{eventoSelecionado.nome_evento}</h2>
              <button onClick={fecharModal} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', opacity: 0.8 }}>✖️</button>
            </div>

            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Tipo', value: eventoSelecionado.tipo_evento === 'externo' ? '🌍 Externo' : '🏛️ Interno' },
                  { label: 'Status', value: eventoSelecionado.status === 'planejamento' ? '📋 Planejamento' : eventoSelecionado.status === 'em_andamento' ? '⚙️ Em Andamento' : '✅ Concluído' },
                  { label: 'Idealizador', value: eventoSelecionado.idealizador || 'Não informado' },
                  { label: 'Local', value: eventoSelecionado.local_evento || 'Não informado' },
                  { label: 'Data do Aviso', value: eventoSelecionado.data_aviso ? new Date(eventoSelecionado.data_aviso + 'T00:00:00').toLocaleDateString('pt-BR') : '-' },
                  { label: 'Data do Evento', value: new Date(eventoSelecionado.data_prevista + 'T00:00:00').toLocaleDateString('pt-BR') }
                ].map(({ label, value }) => (
                  <div key={label}>
                    <span className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>{label}:</span>
                    <p className="text-base mt-1" style={{ color: 'var(--color-text)' }}>{value}</p>
                  </div>
                ))}
              </div>

              {eventoSelecionado.descricao && (
                <div>
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Descrição:</span>
                  <p className="mt-1" style={{ color: 'var(--color-text)' }}>{eventoSelecionado.descricao}</p>
                </div>
              )}

              {itensEvento.length > 0 && (
                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
                  <h3 className="font-bold mb-3 text-lg" style={{ color: 'var(--color-text)' }}>💰 Itens e Custos</h3>
                  <div className="space-y-2">
                    {itensEvento.map((item, index) => (
                      <div key={index} className="flex justify-between items-center p-3 rounded" style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)' }}>
                        <span className="font-medium" style={{ color: 'var(--color-text)' }}>{item.descricao}</span>
                        <div className="flex gap-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          <span>{item.quantidade}x</span>
                          <span>R$ {parseFloat(item.valor || 0).toFixed(2)}</span>
                          <span className="font-bold" style={{ color: 'var(--color-accent)' }}>
                            R$ {(parseFloat(item.valor || 0) * parseFloat(item.quantidade || 1)).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                    <div className="p-4 rounded-lg" style={{ background: 'var(--color-surface-3)', border: '2px solid var(--color-accent)' }}>
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>Total</span>
                        <span className="text-2xl font-bold" style={{ color: 'var(--color-accent)' }}>
                          R$ {itensEvento.reduce((sum, item) => sum + (parseFloat(item.valor || 0) * parseFloat(item.quantidade || 1)), 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {participantes.length > 0 && (
                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
                  <h3 className="font-bold mb-3 text-lg" style={{ color: 'var(--color-text)' }}>👥 Irmãos Participantes ({participantes.length})</h3>
                  <div className="grid grid-cols-4 gap-2">
                    {participantes.map((part, index) => (
                      <div key={index} className="p-2 rounded text-sm text-center" style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
                        {part.irmaos?.nome || 'Nome não encontrado'}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--color-border)', padding: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={fecharModal} style={{ background: 'var(--color-surface-3)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.625rem 1.5rem', fontWeight: '600', cursor: 'pointer' }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
