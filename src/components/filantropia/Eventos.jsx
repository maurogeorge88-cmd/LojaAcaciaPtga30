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
    const { data, error } = await supabase.from('irmaos').select('id, nome, situacao').order('nome');
    if (error) console.error('Erro ao carregar irmãos:', error);
    else {
      const filtrados = (data || []).filter(i => {
        const s = (i.situacao || 'regular').toLowerCase();
        return s === 'regular' || s === 'licenciado';
      });
      setIrmaos(filtrados);
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
      setFormData({ tipo_evento: 'externo', nome_evento: '', idealizador: '', local_evento: '', data_aviso: '', data_prevista: '', descricao: '', status: 'planejamento' });
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
    const { data, error } = await supabase.from('eventos_itens').select('*').eq('evento_id', eventoId).order('created_at');
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
    if (!formData.nome_evento || !formData.data_prevista) { alert('Preencha os campos obrigatórios!'); return; }
    if (modoEdicao && eventoSelecionado) {
      const { error } = await supabase.from('eventos_loja').update(formData).eq('id', eventoSelecionado.id);
      if (error) { alert('Erro ao atualizar evento!'); return; }
      await salvarItens(eventoSelecionado.id);
    } else {
      const { data, error } = await supabase.from('eventos_loja').insert([formData]).select();
      if (error) { alert('Erro ao criar evento!'); return; }
      if (data?.[0]) await salvarItens(data[0].id);
    }
    carregarEventos(); carregarTodosItens(); carregarTodosParticipantes(); fecharModal();
  };

  const salvarItens = async (eventoId) => {
    for (const item of itensEvento) {
      if (!item.id) await supabase.from('eventos_itens').insert([{ evento_id: eventoId, descricao: item.descricao, quantidade: item.quantidade, valor: item.valor }]);
    }
    for (const part of participantes) {
      if (!part.id) await supabase.from('eventos_participantes').insert([{ evento_id: eventoId, irmao_id: part.irmao_id }]);
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
      const novos = [...itensEvento]; novos[itemEditando] = { ...novoItem }; setItensEvento(novos); setItemEditando(null);
    } else {
      setItensEvento([...itensEvento, { ...novoItem }]);
    }
    setNovoItem({ descricao: '', quantidade: '', valor: '' });
  };

  const editarItem = (i) => { setNovoItem(itensEvento[i]); setItemEditando(i); };
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

  const removerParticipante = async (index, partId) => {
    if (partId) await supabase.from('eventos_participantes').delete().eq('id', partId);
    setParticipantes(participantes.filter((_, i) => i !== index));
  };

  const totalCusto = itensEvento.reduce((sum, item) => sum + (parseFloat(item.valor || 0) * parseFloat(item.quantidade || 1)), 0);

  // ── Estilos reutilizáveis ──────────────────────────────────────
  const inputSt = {
    width: '100%', background: 'var(--color-surface-2)', color: 'var(--color-text)',
    border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
    padding: '0.55rem 0.75rem', outline: 'none', fontSize: '0.875rem', boxSizing: 'border-box',
  };
  const labelSt = {
    display: 'block', fontSize: '0.75rem', fontWeight: 600,
    color: 'var(--color-text-muted)', marginBottom: '0.3rem',
    textTransform: 'uppercase', letterSpacing: '0.04em',
  };
  const badgeSt = (bg, cor) => ({
    background: bg, color: cor, padding: '0.25rem 0.7rem',
    borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 600,
    whiteSpace: 'nowrap',
  });

  const statusLabel = (s) => s === 'planejamento' ? '📋 Planejamento' : s === 'em_andamento' ? '⚙️ Em Andamento' : '✅ Concluído';
  const statusBg    = (s) => s === 'planejamento' ? 'rgba(245,158,11,0.15)' : s === 'em_andamento' ? 'rgba(59,130,246,0.15)' : 'var(--color-surface-2)';
  const statusCor   = (s) => s === 'planejamento' ? '#f59e0b' : s === 'em_andamento' ? '#3b82f6' : 'var(--color-text-muted)';

  return (
    <div style={{padding:"1rem",background:"var(--color-bg)",minHeight:"100vh",overflowX:"hidden"}}>

      {/* ── Cabeçalho ────────────────────────────────────────── */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem",flexWrap:"wrap",gap:"0.5rem"}}>
        <h1 style={{fontSize:"1.15rem",fontWeight:"700",color:"var(--color-text)"}}>📅 Eventos da Loja</h1>
        {podeEditar && (
          <button onClick={() => abrirModal()} style={{
            display:"flex",alignItems:"center",gap:"0.4rem",
            background:"var(--color-accent)",color:"#fff",
            padding:"0.5rem 0.9rem",borderRadius:"var(--radius-md)",
            border:"none",cursor:"pointer",fontWeight:"600",fontSize:"0.85rem",
          }}>
            ➕ Novo Evento
          </button>
        )}
      </div>

      {/* ── Aviso sem permissão ───────────────────────────────── */}
      {!podeEditar && (
        <div style={{background:"var(--color-accent-bg)",borderLeft:"4px solid var(--color-accent)",padding:"0.75rem 1rem",borderRadius:"0 var(--radius-md) var(--radius-md) 0",marginBottom:"1rem",fontSize:"0.85rem",color:"var(--color-text)"}}>
          ℹ️ <strong>Visualização:</strong> Para criar ou editar eventos, fale com a administração.
        </div>
      )}

      {/* ── Lista de eventos ──────────────────────────────────── */}
      <div style={{display:"flex",flexDirection:"column",gap:"0.85rem"}}>
        {eventos.map(evento => {
          const custoTotal = todosItens
            .filter(i => i.evento_id === evento.id)
            .reduce((sum, i) => sum + (parseFloat(i.valor || 0) * parseFloat(i.quantidade || 1)), 0);
          const numPart = todosParticipantes.filter(p => p.evento_id === evento.id).length;
          const isExterno = evento.tipo_evento === 'externo';

          return (
            <div key={evento.id} style={{
              background:"var(--color-surface)",
              borderRadius:"var(--radius-lg)",
              borderLeft:`4px solid ${isExterno ? 'var(--color-accent)' : '#10b981'}`,
              border:`1px solid var(--color-border)`,
              borderLeftWidth:"4px",
              overflow:"hidden",
            }}>
              <div style={{padding:"0.9rem"}}>

                {/* Linha 1: badges + botões editar */}
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"0.5rem",marginBottom:"0.6rem",flexWrap:"wrap"}}>
                  <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap"}}>
                    <span style={badgeSt(isExterno ? 'var(--color-accent-bg)' : 'rgba(16,185,129,0.15)', isExterno ? 'var(--color-accent)' : '#10b981')}>
                      {isExterno ? '🌍 Externo' : '🏛️ Interno'}
                    </span>
                    <span style={badgeSt(statusBg(evento.status), statusCor(evento.status))}>
                      {statusLabel(evento.status)}
                    </span>
                  </div>
                  {podeEditar && (
                    <div style={{display:"flex",gap:"0.35rem"}}>
                      <button onClick={() => abrirModal(evento)}
                        style={{padding:"0.3rem 0.6rem",background:"var(--color-accent-bg)",color:"var(--color-accent)",border:"1px solid var(--color-accent)",borderRadius:"var(--radius-md)",cursor:"pointer",fontSize:"0.85rem"}}
                        title="Editar">✏️</button>
                      <button onClick={() => excluirEvento(evento.id)}
                        style={{padding:"0.3rem 0.6rem",background:"rgba(239,68,68,0.12)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"var(--radius-md)",cursor:"pointer",fontSize:"0.85rem"}}
                        title="Excluir">🗑️</button>
                    </div>
                  )}
                </div>

                {/* Nome do evento */}
                <h3 style={{fontSize:"1rem",fontWeight:"700",color:"var(--color-text)",marginBottom:"0.6rem",lineHeight:1.3}}>
                  {evento.nome_evento}
                </h3>

                {/* Infos em coluna única no mobile */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.3rem 0.75rem",fontSize:"0.8rem",color:"var(--color-text-muted)",marginBottom:"0.75rem"}}>
                  <div><span style={{fontWeight:600}}>👤 </span>{evento.idealizador || 'Não informado'}</div>
                  <div><span style={{fontWeight:600}}>📍 </span>{evento.local_evento || 'Não informado'}</div>
                  <div><span style={{fontWeight:600}}>📅 Aviso: </span>{evento.data_aviso ? new Date(evento.data_aviso+'T00:00:00').toLocaleDateString('pt-BR') : '-'}</div>
                  <div><span style={{fontWeight:600}}>🎯 Evento: </span>{new Date(evento.data_prevista+'T00:00:00').toLocaleDateString('pt-BR')}</div>
                </div>

                {/* Descrição */}
                {evento.descricao && (
                  <p style={{fontSize:"0.82rem",color:"var(--color-text-muted)",background:"var(--color-surface-2)",padding:"0.6rem 0.75rem",borderRadius:"var(--radius-md)",marginBottom:"0.75rem",lineHeight:1.5}}>
                    {evento.descricao}
                  </p>
                )}

                {/* Cards custo / participantes / detalhes */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.5rem"}}>
                  <div style={{background:"rgba(59,130,246,0.1)",padding:"0.65rem 0.75rem",borderRadius:"var(--radius-md)"}}>
                    <div style={{fontSize:"0.75rem",fontWeight:600,color:"#3b82f6",marginBottom:"0.2rem"}}>💰 Custo Total</div>
                    <div style={{fontSize:"1.05rem",fontWeight:"700",color:"#3b82f6"}}>R$ {custoTotal.toFixed(2)}</div>
                  </div>
                  <div style={{background:"rgba(16,185,129,0.1)",padding:"0.65rem 0.75rem",borderRadius:"var(--radius-md)"}}>
                    <div style={{fontSize:"0.75rem",fontWeight:600,color:"#10b981",marginBottom:"0.2rem"}}>👥 Participantes</div>
                    <div style={{fontSize:"1.05rem",fontWeight:"700",color:"#10b981"}}>{numPart} irmãos</div>
                  </div>
                  <div style={{gridColumn:"1 / -1",background:"var(--color-accent-bg)",padding:"0.6rem",borderRadius:"var(--radius-md)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <button onClick={() => abrirVisualizacao(evento)}
                      style={{background:"none",border:"none",cursor:"pointer",fontWeight:600,fontSize:"0.875rem",color:"var(--color-accent)"}}>
                      👁️ Ver Detalhes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Modal Editar/Criar ────────────────────────────────── */}
      {modalAberto && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"flex-start",justifyContent:"center",zIndex:50,padding:"0.5rem",overflowY:"auto"}}>
          <div style={{background:"var(--color-surface)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-xl)",width:"100%",maxWidth:"52rem",marginTop:"0.5rem"}}>

            {/* Header */}
            <div style={{position:"sticky",top:0,background:"var(--color-surface-2)",borderBottom:"1px solid var(--color-border)",padding:"0.85rem 1rem",display:"flex",justifyContent:"space-between",alignItems:"center",zIndex:10,borderRadius:"var(--radius-xl) var(--radius-xl) 0 0"}}>
              <h2 style={{fontSize:"1rem",fontWeight:"700",color:"var(--color-text)",margin:0}}>{modoEdicao ? '✏️ Editar Evento' : '➕ Novo Evento'}</h2>
              <button onClick={fecharModal} style={{color:"var(--color-text-muted)",background:"var(--color-surface)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-md)",width:"2rem",height:"2rem",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:"1rem"}}>×</button>
            </div>

            <div style={{padding:"1rem",display:"flex",flexDirection:"column",gap:"0.85rem"}}>

              {/* Tipo + Status */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.75rem"}}>
                <div>
                  <label style={labelSt}>Tipo *</label>
                  <select value={formData.tipo_evento} onChange={e => setFormData({...formData,tipo_evento:e.target.value})} style={inputSt}>
                    <option value="externo">Externo</option>
                    <option value="interno">Interno</option>
                  </select>
                </div>
                <div>
                  <label style={labelSt}>Status</label>
                  <select value={formData.status} onChange={e => setFormData({...formData,status:e.target.value})} style={inputSt}>
                    <option value="planejamento">Planejamento</option>
                    <option value="em_andamento">Em Andamento</option>
                    <option value="concluido">Concluído</option>
                  </select>
                </div>
              </div>

              {/* Nome */}
              <div>
                <label style={labelSt}>Nome do Evento *</label>
                <input type="text" value={formData.nome_evento} onChange={e => setFormData({...formData,nome_evento:e.target.value})} style={inputSt} placeholder="Ex: Festa Junina na Escola Municipal" />
              </div>

              {/* Idealizador + Local */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.75rem"}}>
                <div>
                  <label style={labelSt}>Idealizador</label>
                  <input type="text" value={formData.idealizador} onChange={e => setFormData({...formData,idealizador:e.target.value})} style={inputSt} placeholder="Quem organiza" />
                </div>
                <div>
                  <label style={labelSt}>Local</label>
                  <input type="text" value={formData.local_evento} onChange={e => setFormData({...formData,local_evento:e.target.value})} style={inputSt} placeholder="Onde será" />
                </div>
              </div>

              {/* Datas */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.75rem"}}>
                <div>
                  <label style={labelSt}>Data do Aviso</label>
                  <input type="date" value={formData.data_aviso} onChange={e => setFormData({...formData,data_aviso:e.target.value})} style={{...inputSt,colorScheme:"dark"}} />
                </div>
                <div>
                  <label style={labelSt}>Data do Evento *</label>
                  <input type="date" value={formData.data_prevista} onChange={e => setFormData({...formData,data_prevista:e.target.value})} style={{...inputSt,colorScheme:"dark"}} />
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label style={labelSt}>Descrição</label>
                <textarea value={formData.descricao} onChange={e => setFormData({...formData,descricao:e.target.value})} style={{...inputSt,resize:"vertical"}} rows="3" placeholder="Detalhes sobre o evento..." />
              </div>

              {/* Itens/Custos */}
              <div style={{borderTop:"1px solid var(--color-border)",paddingTop:"0.85rem"}}>
                <h3 style={{fontWeight:"700",fontSize:"0.95rem",color:"var(--color-text)",marginBottom:"0.75rem"}}>💰 Itens e Custos</h3>

                {/* Linha de adicionar item — empilhada no mobile */}
                <div style={{display:"flex",flexDirection:"column",gap:"0.5rem",marginBottom:"0.75rem"}}>
                  <input type="text" placeholder="Descrição do item" value={novoItem.descricao}
                    onChange={e => setNovoItem({...novoItem,descricao:e.target.value})} style={inputSt} />
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.5rem"}}>
                    <input type="number" placeholder="Qtd" value={novoItem.quantidade}
                      onChange={e => setNovoItem({...novoItem,quantidade:e.target.value})} style={inputSt} />
                    <input type="number" step="0.01" placeholder="Valor R$" value={novoItem.valor}
                      onChange={e => setNovoItem({...novoItem,valor:e.target.value})} style={inputSt} />
                  </div>
                  <div style={{display:"flex",gap:"0.5rem"}}>
                    <button onClick={adicionarItem} style={{flex:1,padding:"0.55rem",background:"rgba(16,185,129,0.15)",color:"#10b981",border:"1px solid rgba(16,185,129,0.4)",borderRadius:"var(--radius-md)",cursor:"pointer",fontWeight:600,fontSize:"0.875rem"}}>
                      {itemEditando !== null ? '💾 Salvar' : '➕ Adicionar'}
                    </button>
                    {itemEditando !== null && (
                      <button onClick={cancelarEdicaoItem} style={{padding:"0.55rem 0.85rem",background:"var(--color-surface-2)",color:"var(--color-text-muted)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-md)",cursor:"pointer"}}>✖</button>
                    )}
                  </div>
                </div>

                {/* Lista de itens */}
                {itensEvento.length > 0 && (
                  <div style={{display:"flex",flexDirection:"column",gap:"0.4rem"}}>
                    {itensEvento.map((item, index) => (
                      <div key={index} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"var(--color-surface-2)",padding:"0.6rem 0.75rem",borderRadius:"var(--radius-md)",border:"1px solid var(--color-border)",gap:"0.5rem"}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:"0.875rem",fontWeight:600,color:"var(--color-text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.descricao}</div>
                          <div style={{fontSize:"0.75rem",color:"var(--color-text-muted)"}}>
                            {item.quantidade}x · R$ {parseFloat(item.valor||0).toFixed(2)} = <span style={{color:"var(--color-accent)",fontWeight:700}}>R$ {(parseFloat(item.valor||0)*parseFloat(item.quantidade||1)).toFixed(2)}</span>
                          </div>
                        </div>
                        <div style={{display:"flex",gap:"0.25rem",flexShrink:0}}>
                          <button onClick={() => editarItem(index)} style={{padding:"0.3rem",background:"none",border:"none",cursor:"pointer",color:"var(--color-accent)",fontSize:"0.85rem"}}>✏️</button>
                          <button onClick={() => removerItem(index, item.id)} style={{padding:"0.3rem",background:"none",border:"none",cursor:"pointer",color:"#ef4444",fontSize:"0.85rem"}}>🗑️</button>
                        </div>
                      </div>
                    ))}
                    <div style={{background:"var(--color-accent-bg)",padding:"0.75rem 1rem",borderRadius:"var(--radius-md)",border:"1px solid var(--color-accent)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontWeight:700,color:"var(--color-text)",fontSize:"0.875rem"}}>💰 Total</span>
                      <span style={{fontSize:"1.1rem",fontWeight:"800",color:"var(--color-accent)"}}>R$ {totalCusto.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Participantes */}
              <div style={{borderTop:"1px solid var(--color-border)",paddingTop:"0.85rem"}}>
                <h3 style={{fontWeight:"700",fontSize:"0.95rem",color:"var(--color-text)",marginBottom:"0.75rem"}}>👥 Irmãos Participantes</h3>
                <div style={{display:"flex",gap:"0.5rem",marginBottom:"0.6rem"}}>
                  <select value={novoParticipante} onChange={e => setNovoParticipante(e.target.value)} style={{...inputSt,flex:1}}>
                    <option value="">Selecione um irmão...</option>
                    {irmaos.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                  </select>
                  <button onClick={adicionarParticipante} style={{padding:"0.55rem 0.85rem",background:"rgba(16,185,129,0.15)",color:"#10b981",border:"1px solid rgba(16,185,129,0.4)",borderRadius:"var(--radius-md)",cursor:"pointer",fontWeight:600,fontSize:"0.85rem",whiteSpace:"nowrap"}}>
                    ➕
                  </button>
                </div>
                {participantes.length > 0 && (
                  <div style={{display:"flex",flexDirection:"column",gap:"0.35rem"}}>
                    {participantes.map((p, i) => (
                      <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"var(--color-surface-2)",padding:"0.55rem 0.75rem",borderRadius:"var(--radius-md)",border:"1px solid var(--color-border)"}}>
                        <span style={{fontSize:"0.875rem",color:"var(--color-text)"}}>👤 {p.irmaos?.nome || 'Não encontrado'}</span>
                        <button onClick={() => removerParticipante(i, p.id)} style={{padding:"0.25rem",background:"none",border:"none",cursor:"pointer",color:"#ef4444",fontSize:"0.85rem"}}>🗑️</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{position:"sticky",bottom:0,background:"var(--color-surface)",borderTop:"1px solid var(--color-border)",padding:"0.85rem 1rem",display:"flex",justifyContent:"flex-end",gap:"0.5rem",borderRadius:"0 0 var(--radius-xl) var(--radius-xl)"}}>
              <button onClick={fecharModal} style={{padding:"0.55rem 1rem",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-md)",cursor:"pointer",fontSize:"0.875rem"}}>Cancelar</button>
              <button onClick={salvarEvento} style={{display:"flex",alignItems:"center",gap:"0.4rem",background:"var(--color-accent)",color:"#fff",padding:"0.55rem 1.1rem",borderRadius:"var(--radius-md)",border:"none",cursor:"pointer",fontWeight:"600",fontSize:"0.875rem"}}>💾 Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Visualização ────────────────────────────────── */}
      {modalVisualizacao && eventoSelecionado && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"flex-start",justifyContent:"center",zIndex:50,padding:"0.5rem",overflowY:"auto"}}>
          <div style={{background:"var(--color-surface)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-xl)",width:"100%",maxWidth:"52rem",marginTop:"0.5rem"}}>

            {/* Header */}
            <div style={{position:"sticky",top:0,background:"var(--color-surface-2)",borderBottom:"1px solid var(--color-border)",padding:"0.85rem 1rem",display:"flex",justifyContent:"space-between",alignItems:"center",zIndex:10,borderRadius:"var(--radius-xl) var(--radius-xl) 0 0"}}>
              <h2 style={{fontSize:"0.95rem",fontWeight:"700",color:"var(--color-text)",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"calc(100% - 3rem)"}}>{eventoSelecionado.nome_evento}</h2>
              <button onClick={fecharModal} style={{color:"var(--color-text-muted)",background:"var(--color-surface)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-md)",width:"2rem",height:"2rem",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>×</button>
            </div>

            <div style={{padding:"1rem",display:"flex",flexDirection:"column",gap:"0.85rem"}}>

              {/* Info grid */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.6rem"}}>
                {[
                  ['Tipo', eventoSelecionado.tipo_evento === 'externo' ? '🌍 Externo' : '🏛️ Interno'],
                  ['Status', statusLabel(eventoSelecionado.status)],
                  ['Idealizador', eventoSelecionado.idealizador || 'Não informado'],
                  ['Local', eventoSelecionado.local_evento || 'Não informado'],
                  ['Data do Aviso', eventoSelecionado.data_aviso ? new Date(eventoSelecionado.data_aviso+'T00:00:00').toLocaleDateString('pt-BR') : '-'],
                  ['Data do Evento', new Date(eventoSelecionado.data_prevista+'T00:00:00').toLocaleDateString('pt-BR')],
                ].map(([k, v]) => (
                  <div key={k} style={{background:"var(--color-surface-2)",padding:"0.6rem 0.75rem",borderRadius:"var(--radius-md)",border:"1px solid var(--color-border)"}}>
                    <div style={{fontSize:"0.7rem",fontWeight:600,color:"var(--color-text-muted)",textTransform:"uppercase",marginBottom:"0.2rem"}}>{k}</div>
                    <div style={{fontSize:"0.875rem",color:"var(--color-text)",fontWeight:500}}>{v}</div>
                  </div>
                ))}
              </div>

              {eventoSelecionado.descricao && (
                <div style={{background:"var(--color-surface-2)",padding:"0.75rem",borderRadius:"var(--radius-md)",border:"1px solid var(--color-border)",fontSize:"0.875rem",color:"var(--color-text-muted)",lineHeight:1.5}}>
                  {eventoSelecionado.descricao}
                </div>
              )}

              {/* Itens */}
              {itensEvento.length > 0 && (
                <div style={{borderTop:"1px solid var(--color-border)",paddingTop:"0.75rem"}}>
                  <h3 style={{fontWeight:700,fontSize:"0.9rem",color:"var(--color-text)",marginBottom:"0.6rem"}}>💰 Itens e Custos</h3>
                  <div style={{display:"flex",flexDirection:"column",gap:"0.35rem"}}>
                    {itensEvento.map((item, i) => (
                      <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"var(--color-surface-2)",padding:"0.6rem 0.75rem",borderRadius:"var(--radius-md)",border:"1px solid var(--color-border)",gap:"0.5rem"}}>
                        <span style={{fontSize:"0.875rem",color:"var(--color-text)",fontWeight:500,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.descricao}</span>
                        <div style={{display:"flex",gap:"0.6rem",fontSize:"0.8rem",color:"var(--color-text-muted)",flexShrink:0}}>
                          <span>{item.quantidade}x</span>
                          <span style={{color:"var(--color-accent)",fontWeight:700}}>R$ {(parseFloat(item.valor||0)*parseFloat(item.quantidade||1)).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                    <div style={{background:"var(--color-accent-bg)",padding:"0.75rem",borderRadius:"var(--radius-md)",border:"1px solid var(--color-accent)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontWeight:700,color:"var(--color-text)",fontSize:"0.875rem"}}>Total</span>
                      <span style={{fontSize:"1.1rem",fontWeight:"800",color:"var(--color-accent)"}}>R$ {itensEvento.reduce((s,i)=>s+(parseFloat(i.valor||0)*parseFloat(i.quantidade||1)),0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Participantes */}
              {participantes.length > 0 && (
                <div style={{borderTop:"1px solid var(--color-border)",paddingTop:"0.75rem"}}>
                  <h3 style={{fontWeight:700,fontSize:"0.9rem",color:"var(--color-text)",marginBottom:"0.6rem"}}>👥 Participantes ({participantes.length})</h3>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.4rem"}}>
                    {participantes.map((p, i) => (
                      <div key={i} style={{background:"var(--color-surface-2)",padding:"0.5rem 0.65rem",borderRadius:"var(--radius-md)",fontSize:"0.8rem",color:"var(--color-text)",border:"1px solid var(--color-border)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {p.irmaos?.nome || 'Não encontrado'}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{position:"sticky",bottom:0,background:"var(--color-surface)",borderTop:"1px solid var(--color-border)",padding:"0.85rem 1rem",display:"flex",justifyContent:"flex-end",borderRadius:"0 0 var(--radius-xl) var(--radius-xl)"}}>
              <button onClick={fecharModal} style={{padding:"0.55rem 1.25rem",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-md)",cursor:"pointer",fontWeight:600,fontSize:"0.875rem"}}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
