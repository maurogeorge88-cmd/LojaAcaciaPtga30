import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { formatarData } from '../../utils/formatters';
import AtividadesComissao from './AtividadesComissao';

const Comissoes = ({ comissoes, irmaos, onUpdate, showSuccess, showError, permissoes, userData }) => {
  // Verificar se as props essenciais existem
  if (!comissoes || !irmaos) {
    return (
      <div className="rounded-xl p-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <div className="text-center">
          <p className="text-xl mb-4">⚠️ Carregando dados...</p>
          <p className="text-sm">Se esta mensagem persistir, recarregue a página.</p>
        </div>
      </div>
    );
  }

  // Função para verificar se usuário é membro de uma comissão
  const ehMembroComissao = (comissao, integrantesComissao) => {
    // Primeiro, precisamos encontrar qual irmão está vinculado a este usuário
    // userData deve ter ou o id do usuário ou já vir com o irmao vinculado
    
    if (!userData) {
      console.log('⚠️ userData não existe');
      return false;
    }
    
    // Buscar o irmão deste usuário
    const irmaoDoUsuario = irmaos.find(irmao => {
      // Pode ser que o usuário tenha email igual ao do irmão
      return irmao.email === userData.email;
    });
    
    if (!irmaoDoUsuario) {
      console.log('⚠️ Irmão do usuário não encontrado. Email:', userData.email);
      return false;
    }
    
    // Verificar se este irmão está nos integrantes
    const ehMembro = integrantesComissao.some(integrante => {
      return integrante.irmao_id === irmaoDoUsuario.id;
    });
    
    console.log('🔍 Verificando membro:', {
      usuario_email: userData.email,
      irmao_id: irmaoDoUsuario.id,
      irmao_nome: irmaoDoUsuario.nome,
      integrantesComissao,
      ehMembro
    });
    
    return ehMembro;
  };

  // Estados do formulário
  const [comissaoForm, setComissaoForm] = useState({
    nome: '',
    data_criacao: '',
    origem: 'interna',
    status: 'em_andamento',
    data_inicio: '',
    data_fim: '',
    objetivo: ''
  });

  // Estados de controle
  const [modoEdicao, setModoEdicao] = useState(false);
  const [comissaoEditando, setComissaoEditando] = useState(null);
  const [loading, setLoading] = useState(false);
  const [integrantesTemp, setIntegrantesTemp] = useState([]);
  const [modalComissaoAberto, setModalComissaoAberto] = useState(false);
  
  // Estados para visualização
  const [modalVisualizar, setModalVisualizar] = useState(false);
  const [comissaoVisualizar, setComissaoVisualizar] = useState(null);
  const [integrantesVisualizar, setIntegrantesVisualizar] = useState([]);
  const [atividadesVisualizar, setAtividadesVisualizar] = useState([]);
  
  // Estados para atividades
  const [modalAtividades, setModalAtividades] = useState(false);
  const [comissaoAtividades, setComissaoAtividades] = useState(null);
  
  // Estados para filtros e navegação
  const [abaAtiva, setAbaAtiva] = useState('interna'); // 'interna' ou 'externa'
  const [anoFiltro, setAnoFiltro] = useState(0); // 0 = Todos

  // Contagem de atividades por comissão { [comissao_id]: count }
  const [contagemAtividades, setContagemAtividades] = useState({});

  useEffect(() => {
    const buscarContagem = async () => {
      try {
        const { data } = await supabase
          .from('atividades_comissoes')
          .select('comissao_id');
        if (!data) return;
        const mapa = {};
        data.forEach(a => {
          mapa[a.comissao_id] = (mapa[a.comissao_id] || 0) + 1;
        });
        setContagemAtividades(mapa);
      } catch {}
    };
    buscarContagem();
  }, []);
  
  // Obter anos com cadastros
  const anosDisponiveis = [...new Set(
    comissoes.map(c => new Date(c.data_inicio).getFullYear())
  )].sort((a, b) => b - a);

  // Limpar formulário
  const limparFormulario = () => {
    setComissaoForm({
      nome: '',
      data_criacao: '',
      origem: 'interna',
      status: 'em_andamento',
      data_inicio: '',
      data_fim: '',
      objetivo: ''
    });
    setIntegrantesTemp([]);
    setModoEdicao(false);
    setComissaoEditando(null);
    setModalComissaoAberto(false);
  };

  // Adicionar integrante temporário
  const adicionarIntegrante = () => {
    const selectIrmao = document.getElementById('select-irmao-comissao');
    const selectFuncao = document.getElementById('select-funcao-comissao');
    
    const irmaoId = selectIrmao.value;
    const funcao = selectFuncao.value;
    
    if (!irmaoId || !funcao) {
      showError('Selecione um irmão e uma função');
      return;
    }
    
    const irmao = irmaos.find(i => i.id === parseInt(irmaoId));
    if (!irmao) return;
    
    // Verificar se já existe
    if (integrantesTemp.some(i => i.irmao_id === irmao.id)) {
      showError('Este irmão já está na comissão');
      return;
    }
    
    setIntegrantesTemp([...integrantesTemp, {
      irmao_id: irmao.id,
      irmao_nome: irmao.nome,
      funcao: funcao
    }]);
    
    selectIrmao.value = '';
    selectFuncao.value = '';
  };

  // Remover integrante temporário
  const removerIntegrante = (irmaoId) => {
    setIntegrantesTemp(integrantesTemp.filter(i => i.irmao_id !== irmaoId));
  };

  // Cadastrar comissão
  const handleSubmit = async () => {
    if (!comissaoForm.nome || !comissaoForm.data_criacao || !comissaoForm.data_inicio || !comissaoForm.objetivo) {
      showError('Preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);

    try {
      // Inserir comissão
      const { data: comissaoData, error: comissaoError } = await supabase
        .from('comissoes')
        .insert([{
          nome: comissaoForm.nome,
          data_criacao: comissaoForm.data_criacao,
          origem: comissaoForm.origem,
          status: comissaoForm.status,
          data_inicio: comissaoForm.data_inicio,
          data_fim: comissaoForm.data_fim || null,
          objetivo: comissaoForm.objetivo
        }])
        .select()
        .single();

      if (comissaoError) throw comissaoError;

      // Inserir integrantes
      if (integrantesTemp.length > 0) {
        const integrantesData = integrantesTemp.map(i => ({
          comissao_id: comissaoData.id,
          irmao_id: i.irmao_id,
          funcao: i.funcao
        }));

        const { error: integrantesError } = await supabase
          .from('comissoes_integrantes')
          .insert(integrantesData);

        if (integrantesError) throw integrantesError;
      }

      showSuccess('Comissão cadastrada com sucesso!');
      limparFormulario();
      limparFormulario();
      onUpdate();

    } catch (error) {
      showError('Erro ao salvar comissão: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Atualizar comissão
  const handleAtualizar = async () => {
    if (!comissaoForm.nome || !comissaoForm.data_criacao || !comissaoForm.data_inicio || !comissaoForm.objetivo) {
      showError('Preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);

    try {
      // Atualizar dados da comissão
      const { error } = await supabase
        .from('comissoes')
        .update({
          nome: comissaoForm.nome,
          data_criacao: comissaoForm.data_criacao,
          origem: comissaoForm.origem,
          status: comissaoForm.status,
          data_inicio: comissaoForm.data_inicio,
          data_fim: comissaoForm.data_fim || null,
          objetivo: comissaoForm.objetivo
        })
        .eq('id', comissaoEditando.id);

      if (error) throw error;

      // DELETAR integrantes antigos
      const { error: deleteError } = await supabase
        .from('comissoes_integrantes')
        .delete()
        .eq('comissao_id', comissaoEditando.id);
      
      if (deleteError) throw deleteError;

      // INSERIR novos integrantes
      if (integrantesTemp.length > 0) {
        const integrantesData = integrantesTemp.map(i => ({
          comissao_id: comissaoEditando.id,
          irmao_id: i.irmao_id,
          funcao: i.funcao
        }));

        const { error: integrantesError } = await supabase
          .from('comissoes_integrantes')
          .insert(integrantesData);

        if (integrantesError) throw integrantesError;
      }

      showSuccess('Comissão atualizada com sucesso!');
      limparFormulario();
      limparFormulario();
      onUpdate();

    } catch (error) {
      showError('Erro ao atualizar comissão: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Editar comissão
  const handleEditar = async (comissao) => {
    setModoEdicao(true);
    setModalComissaoAberto(true);
    setComissaoEditando(comissao);
    setComissaoForm({
      nome: comissao.nome,
      data_criacao: comissao.data_criacao,
      origem: comissao.origem,
      status: comissao.status,
      data_inicio: comissao.data_inicio,
      data_fim: comissao.data_fim || '',
      objetivo: comissao.objetivo
    });
    
    // BUSCAR INTEGRANTES DA COMISSÃO
    try {
      const { data: integrantes, error } = await supabase
        .from('comissoes_integrantes')
        .select('*')
        .eq('comissao_id', comissao.id);
      
      if (error) {
        console.error('Erro ao buscar integrantes:', error);
        setIntegrantesTemp([]);
      } else {
        // Mapear integrantes para o formato do integrantesTemp
        const integrantesFormatados = integrantes.map(int => {
          const irmao = irmaos.find(i => i.id === int.irmao_id);
          return {
            irmao_id: int.irmao_id,
            irmao_nome: irmao ? irmao.nome : 'Desconhecido',
            funcao: int.funcao
          };
        });
        setIntegrantesTemp(integrantesFormatados);
      }
    } catch (err) {
      console.error('Erro ao buscar integrantes:', err);
      setIntegrantesTemp([]);
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Excluir comissão
  const handleExcluir = async (id) => {
    if (typeof window !== 'undefined' && !window.confirm('Tem certeza que deseja excluir esta comissão?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('comissoes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      showSuccess('Comissão excluída com sucesso!');
      onUpdate();

    } catch (error) {
      showError('Erro ao excluir comissão: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Visualizar comissão
  const handleVisualizar = async (comissao) => {
    setComissaoVisualizar(comissao);
    setModalVisualizar(true);
    
    // Buscar integrantes desta comissão
    try {
      const { data, error } = await supabase
        .from('comissoes_integrantes')
        .select('*')
        .eq('comissao_id', comissao.id);
      
      if (error) {
        console.error('Erro ao buscar integrantes:', error);
        setIntegrantesVisualizar([]);
      } else {
        setIntegrantesVisualizar(data || []);
      }
    } catch (err) {
      console.error('Erro ao buscar integrantes:', err);
      setIntegrantesVisualizar([]);
    }

    // Buscar atividades desta comissão
    try {
      const { data, error } = await supabase
        .from('atividades_comissoes')
        .select('*')
        .eq('comissao_id', comissao.id)
        .order('data_atividade', { ascending: false });
      
      if (error) {
        console.error('Erro ao buscar atividades:', error);
        setAtividadesVisualizar([]);
      } else {
        setAtividadesVisualizar(data || []);
      }
    } catch (err) {
      console.error('Erro ao buscar atividades:', err);
      setAtividadesVisualizar([]);
    }
  };

  return (
    <div style={{background:"var(--color-bg)",minHeight:"100vh",padding:"0.5rem",overflowX:"hidden"}}>

      {/* MODAL CADASTRO/EDIÇÃO */}
      {modalComissaoAberto && (permissoes?.pode_gerenciar_usuarios || permissoes?.pode_editar_comissoes) && (
        <div onClick={limparFormulario} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',zIndex:50,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'1.5rem 1rem',overflowY:'auto'}}>
          <div onClick={e => e.stopPropagation()} style={{background:'var(--color-surface)',borderRadius:'var(--radius-xl)',border:'1px solid var(--color-border)',width:'100%',maxWidth:'680px',boxShadow:'0 20px 60px rgba(0,0,0,0.4)',overflow:'hidden',marginBottom:'1.5rem'}}>

            {/* Header do modal */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'1.1rem 1.4rem',borderBottom:'1px solid var(--color-border)',background:'var(--color-surface-2)'}}>
              <div style={{display:'flex',alignItems:'center',gap:'0.6rem'}}>
                <span style={{fontSize:'1.2rem'}}>🏛️</span>
                <div>
                  <h3 style={{margin:0,fontSize:'1rem',fontWeight:'800',color:'var(--color-text)'}}>
                    {modoEdicao ? 'Editar Comissão' : 'Nova Comissão'}
                  </h3>
                  <p style={{margin:0,fontSize:'0.72rem',color:'var(--color-text-muted)'}}>
                    {modoEdicao ? 'Atualize os dados da comissão' : 'Preencha os dados para cadastrar'}
                  </p>
                </div>
              </div>
              <button onClick={limparFormulario} style={{background:'transparent',border:'none',color:'var(--color-text-muted)',fontSize:'1.3rem',cursor:'pointer',padding:'0.2rem 0.5rem',borderRadius:'var(--radius-md)',lineHeight:1}}>✕</button>
            </div>

            {/* Corpo do modal */}
            <div style={{padding:'1.4rem',display:'flex',flexDirection:'column',gap:'1rem'}}>

              {/* LINHA 1: Nome, Origem, Status */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 140px 160px',gap:'0.75rem'}}>
                <div>
                  <label style={{fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:'0.35rem'}}>Nome da Comissão *</label>
                  <input type="text" value={comissaoForm.nome} onChange={e => setComissaoForm({...comissaoForm, nome: e.target.value})}
                    style={{width:'100%',padding:'0.6rem 0.85rem',borderRadius:'var(--radius-lg)',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',fontSize:'0.875rem',outline:'none',boxSizing:'border-box'}} required />
                </div>
                <div>
                  <label style={{fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:'0.35rem'}}>Origem *</label>
                  <select value={comissaoForm.origem} onChange={e => setComissaoForm({...comissaoForm, origem: e.target.value})}
                    style={{width:'100%',padding:'0.6rem 0.85rem',borderRadius:'var(--radius-lg)',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',fontSize:'0.875rem',outline:'none'}}>
                    <option value="interna">Interna</option>
                    <option value="externa">Externa</option>
                  </select>
                </div>
                <div>
                  <label style={{fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:'0.35rem'}}>Status *</label>
                  <select value={comissaoForm.status} onChange={e => setComissaoForm({...comissaoForm, status: e.target.value})}
                    style={{width:'100%',padding:'0.6rem 0.85rem',borderRadius:'var(--radius-lg)',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',fontSize:'0.875rem',outline:'none'}}>
                    <option value="em_andamento">Em Andamento</option>
                    <option value="encerrada">Encerrada</option>
                  </select>
                </div>
              </div>

              {/* LINHA 2: Data Criação, Data Início, Data Fim */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0.75rem'}}>
                <div>
                  <label style={{fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:'0.35rem'}}>Data de Criação *</label>
                  <input type="date" value={comissaoForm.data_criacao} onChange={e => setComissaoForm({...comissaoForm, data_criacao: e.target.value})}
                    style={{width:'100%',padding:'0.6rem 0.85rem',borderRadius:'var(--radius-lg)',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',fontSize:'0.875rem',outline:'none',boxSizing:'border-box'}} required />
                </div>
                <div>
                  <label style={{fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:'0.35rem'}}>Data Início *</label>
                  <input type="date" value={comissaoForm.data_inicio} onChange={e => setComissaoForm({...comissaoForm, data_inicio: e.target.value})}
                    style={{width:'100%',padding:'0.6rem 0.85rem',borderRadius:'var(--radius-lg)',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',fontSize:'0.875rem',outline:'none',boxSizing:'border-box'}} required />
                </div>
                <div>
                  <label style={{fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:'0.35rem'}}>Data Fim</label>
                  <input type="date" value={comissaoForm.data_fim} onChange={e => setComissaoForm({...comissaoForm, data_fim: e.target.value})}
                    style={{width:'100%',padding:'0.6rem 0.85rem',borderRadius:'var(--radius-lg)',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',fontSize:'0.875rem',outline:'none',boxSizing:'border-box'}} />
                </div>
              </div>

              {/* Objetivo */}
              <div>
                <label style={{fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:'0.35rem'}}>Objetivo *</label>
                <textarea value={comissaoForm.objetivo} onChange={e => setComissaoForm({...comissaoForm, objetivo: e.target.value})} rows={3}
                  placeholder="Descreva o objetivo desta comissão..."
                  style={{width:'100%',padding:'0.6rem 0.85rem',borderRadius:'var(--radius-lg)',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',fontSize:'0.875rem',outline:'none',resize:'vertical',boxSizing:'border-box'}} required />
              </div>

              {/* INTEGRANTES */}
              <div style={{borderTop:'1px solid var(--color-border)',paddingTop:'1rem'}}>
                <h4 style={{fontWeight:'700',fontSize:'0.85rem',color:'var(--color-text)',marginBottom:'0.75rem'}}>👥 Integrantes</h4>
                <div style={{display:'flex',gap:'0.5rem',marginBottom:'0.75rem'}}>
                  <select id="select-irmao-comissao" style={{flex:1,padding:'0.55rem 0.75rem',borderRadius:'var(--radius-lg)',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',fontSize:'0.82rem',outline:'none'}}>
                    <option value="">Selecione um irmão</option>
                    {irmaos.filter(i => i.situacao?.toLowerCase() === 'regular').map(i => (
                      <option key={i.id} value={i.id}>{i.nome} - CIM {i.cim}</option>
                    ))}
                  </select>
                  <select id="select-funcao-comissao" style={{width:'140px',padding:'0.55rem 0.75rem',borderRadius:'var(--radius-lg)',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',fontSize:'0.82rem',outline:'none'}}>
                    <option value="">Função</option>
                    <option value="Presidente">Presidente</option>
                    <option value="Vice-Presidente">Vice-Presidente</option>
                    <option value="Secretário">Secretário</option>
                    <option value="Membro">Membro</option>
                    <option value="Relator">Relator</option>
                  </select>
                  <button type="button" onClick={adicionarIntegrante}
                    style={{padding:'0.55rem 0.9rem',background:'#10b981',color:'#fff',border:'none',borderRadius:'var(--radius-lg)',cursor:'pointer',fontWeight:'700',fontSize:'0.82rem',whiteSpace:'nowrap'}}>
                    + Adicionar
                  </button>
                </div>
                {integrantesTemp.length > 0 && (
                  <div style={{borderRadius:'var(--radius-lg)',overflow:'hidden',border:'1px solid var(--color-border)'}}>
                    {integrantesTemp.map((integrante, idx) => (
                      <div key={idx} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0.5rem 0.75rem',background: idx%2===0 ? 'var(--color-surface)' : 'var(--color-surface-2)',borderBottom: idx < integrantesTemp.length-1 ? '1px solid var(--color-border)' : 'none'}}>
                        <span style={{fontWeight:'600',fontSize:'0.82rem',color:'var(--color-text)'}}>{integrante.irmao_nome}</span>
                        <span style={{fontSize:'0.75rem',color:'var(--color-text-muted)'}}>{integrante.funcao}</span>
                        <button type="button" onClick={() => removerIntegrante(integrante.irmao_id)}
                          style={{background:'rgba(239,68,68,0.12)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'var(--radius-md)',padding:'0.18rem 0.5rem',cursor:'pointer',fontSize:'0.75rem',fontWeight:'700'}}>
                          ❌
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Botões */}
              <div style={{display:'flex',gap:'0.65rem',paddingTop:'0.25rem'}}>
                <button type="button" onClick={limparFormulario}
                  style={{flex:1,height:'40px',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-lg)',fontWeight:'700',fontSize:'0.85rem',cursor:'pointer'}}>
                  Cancelar
                </button>
                <button type="button" onClick={modoEdicao ? handleAtualizar : handleSubmit} disabled={loading}
                  style={{flex:2,height:'40px',background: loading ? 'var(--color-surface-3)' : 'var(--color-accent)',color:'#fff',border:'none',borderRadius:'var(--radius-lg)',fontWeight:'700',fontSize:'0.85rem',cursor: loading ? 'not-allowed' : 'pointer'}}>
                  {loading ? 'Salvando...' : modoEdicao ? '✏️ Atualizar Comissão' : '✅ Cadastrar Comissão'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LISTAGEM */}
      <div className="rounded-xl overflow-hidden" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <div style={{padding:"1rem 1.25rem",background:"var(--color-accent)",display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <h3 className="text-xl font-bold" style={{color:"var(--color-text)"}}>Comissões Cadastradas</h3>
            <p className="text-sm text-blue-100">Total: {comissoes.length} comissão(ões)</p>
          </div>
          {(permissoes?.pode_gerenciar_usuarios || permissoes?.pode_editar_comissoes) && (
            <button onClick={() => { limparFormulario(); setModalComissaoAberto(true); }}
              style={{height:'38px',padding:'0 1rem',background:'rgba(255,255,255,0.15)',color:'#fff',border:'1px solid rgba(255,255,255,0.3)',borderRadius:'var(--radius-lg)',fontWeight:'700',fontSize:'0.82rem',cursor:'pointer',display:'flex',alignItems:'center',gap:'0.4rem',whiteSpace:'nowrap'}}>
              ➕ Nova Comissão
            </button>
          )}
        </div>

        {/* ABAS E FILTRO */}
        <div className="-b px-4 py-3" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}>
          <div className="flex items-center justify-between">
            {/* Abas */}
            <div className="flex gap-2">
              <button
                onClick={() => setAbaAtiva('interna')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  abaAtiva === 'interna'
                    ? 'bg-primary-600 text-white'
                    : '  hover:'
                }`}
              >
                🏛️ Internas (Loja)
              </button>
              <button
                onClick={() => setAbaAtiva('externa')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  abaAtiva === 'externa'
                    ? 'aba-ativa-placeholder'
                    : '  hover:'
                }`}
              >
                🌐 Externas (Participação)
              </button>
            </div>

            {/* Filtro de Ano */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium" style={{color:"var(--color-text-muted)"}}>Ano:</label>
              <select
                value={anoFiltro}
                onChange={(e) => setAnoFiltro(parseInt(e.target.value))}
                className="px-3 py-1.5 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
              >
                <option value={0}>Todos</option>
                {anosDisponiveis.map(ano => (
                  <option key={ano} value={ano}>{ano}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="divide-y">
          {(() => {
            // Filtrar por aba e ano
            const comissoesFiltradas = comissoes.filter(c => {
              const anoInicio = new Date(c.data_inicio).getFullYear();
              const origemMatch = c.origem === abaAtiva;
              const anoMatch = anoFiltro === 0 || anoInicio === anoFiltro;
              return origemMatch && anoMatch;
            });

            // Separar por status
            const emAndamento = comissoesFiltradas.filter(c => c.status === 'em_andamento');
            const encerradas = comissoesFiltradas.filter(c => c.status === 'encerrada');

            if (comissoesFiltradas.length === 0) {
              return (
                <div className="p-8 text-center">
                  <p className="text-lg">📋 Nenhuma comissão encontrada</p>
                  <p className="text-sm mt-2">
                    {abaAtiva === 'interna' ? 'Não há comissões internas' : 'Não há comissões externas'} 
                    {anoFiltro !== 0 && ` no ano de ${anoFiltro}`}
                  </p>
                </div>
              );
            }

            return (
              <>
                {/* COMISSÕES EM ANDAMENTO */}
                {emAndamento.length > 0 && (
                  <div>
                    <div style={{padding:"0.6rem 1rem",borderBottom:"1px solid var(--color-border)",background:"var(--color-surface-2)"}}>
                      <h4 className="font-bold" style={{color:"var(--color-text)"}}>🔄 Em Andamento ({emAndamento.length})</h4>
                    </div>
                    {emAndamento.map((comissao, ci) => (
                      <div key={comissao.id} className="rounded-lg border-l-4" style={{borderLeftColor:"var(--color-accent)",background:ci%2===0?"var(--color-surface)":"var(--color-surface-2)",padding:"1rem",marginBottom:"0.5rem"}}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1" style={{position:'relative'}}>
                            <h4 className="font-bold text-lg">{comissao.nome}</h4>
                            <p className="text-sm mt-1" style={{color:"var(--color-text-muted)"}}>{comissao.objetivo}</p>
                            <div className="flex gap-4 mt-2 text-sm" style={{flexWrap:'wrap',alignItems:'center'}}>
                              <span style={{padding:"0.15rem 0.5rem",borderRadius:"var(--radius-sm)",fontSize:"0.72rem",fontWeight:"600",background:"rgba(16,185,129,0.15)",color:"#10b981",border:"1px solid rgba(16,185,129,0.3)"}}>
                                Em Andamento
                              </span>
                              {contagemAtividades[comissao.id] > 0 && (
                                <span style={{padding:'0.1rem 0.5rem',borderRadius:'999px',fontSize:'0.65rem',fontWeight:'800',background:'rgba(99,102,241,0.15)',color:'#6366f1',border:'1px solid rgba(99,102,241,0.3)',whiteSpace:'nowrap'}}>
                                  📋 {contagemAtividades[comissao.id]} ativ.
                                </span>
                              )}
                              <span>
                                📅 {formatarData(comissao.data_inicio)} 
                                {comissao.data_fim && ` - ${formatarData(comissao.data_fim)}`}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <button
                              onClick={() => handleVisualizar(comissao)}
                              style={{padding:"0.25rem 0.55rem",background:"rgba(16,185,129,0.15)",color:"#10b981",border:"1px solid rgba(16,185,129,0.3)",borderRadius:"var(--radius-md)",fontSize:"0.82rem",cursor:"pointer"}}
                              title="Visualizar detalhes"
                            >
                              👁️ Ver
                            </button>
                            <button
                              onClick={() => {
                                setComissaoAtividades(comissao);
                                setModalAtividades(true);
                              }}
                              style={{padding:"0.25rem 0.55rem",background:"rgba(99,102,241,0.15)",color:"#6366f1",border:"1px solid rgba(99,102,241,0.3)",borderRadius:"var(--radius-md)",fontSize:"0.82rem",cursor:"pointer"}}
                              title="Gerenciar atividades"
                            >
                              📋 Atividades
                            </button>
                            {(permissoes?.pode_gerenciar_usuarios || permissoes?.pode_editar_comissoes) && (
                              <>
                                <button
                                  onClick={() => handleEditar(comissao)}
                                  style={{padding:"0.25rem 0.55rem",background:"var(--color-accent-bg)",color:"var(--color-accent)",border:"1px solid var(--color-accent)",borderRadius:"var(--radius-md)",fontSize:"0.82rem",cursor:"pointer"}}
                                  title="Editar"
                                >
                                  ✏️ Editar
                                </button>
                                <button
                                  onClick={() => handleExcluir(comissao.id)}
                                  style={{padding:"0.25rem 0.55rem",background:"rgba(239,68,68,0.15)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"var(--radius-md)",fontSize:"0.82rem",cursor:"pointer"}}
                                  title="Excluir"
                                >
                                  🗑️ Excluir
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* COMISSÕES ENCERRADAS */}
                {encerradas.length > 0 && (
                  <div>
                    <div className="px-4 py-2 -b" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}>
                      <h4 className="font-bold">✓ Encerradas ({encerradas.length})</h4>
                    </div>
                    {encerradas.map((comissao, ci) => (
                      <div key={comissao.id} className="rounded-lg border-l-4" style={{borderLeftColor:"var(--color-text-faint)",background:ci%2===0?"var(--color-surface)":"var(--color-surface-2)",padding:"1rem",marginBottom:"0.5rem",opacity:0.8}}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1" style={{position:'relative'}}>
                            <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
                              <h4 className="font-bold text-lg">{comissao.nome}</h4>
                              {contagemAtividades[comissao.id] > 0 && (
                                <span style={{padding:'0.1rem 0.5rem',borderRadius:'999px',fontSize:'0.65rem',fontWeight:'800',background:'rgba(99,102,241,0.15)',color:'#6366f1',border:'1px solid rgba(99,102,241,0.3)',whiteSpace:'nowrap'}}>
                                  📋 {contagemAtividades[comissao.id]} ativ.
                                </span>
                              )}
                            </div>
                            <p className="text-sm mt-1" style={{color:"var(--color-text-muted)"}}>{comissao.objetivo}</p>
                            <div className="flex gap-4 mt-2 text-sm">
                              <span className="px-2 py-1 rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)"}}>
                                Encerrada
                              </span>
                              <span>
                                📅 {formatarData(comissao.data_inicio)} - {formatarData(comissao.data_fim)}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <button
                              onClick={() => handleVisualizar(comissao)}
                              style={{padding:"0.25rem 0.55rem",background:"rgba(16,185,129,0.15)",color:"#10b981",border:"1px solid rgba(16,185,129,0.3)",borderRadius:"var(--radius-md)",fontSize:"0.82rem",cursor:"pointer"}}
                              title="Visualizar detalhes"
                            >
                              👁️ Ver
                            </button>
                            <button
                              onClick={() => {
                                setComissaoAtividades(comissao);
                                setModalAtividades(true);
                              }}
                              style={{padding:"0.25rem 0.55rem",background:"rgba(99,102,241,0.15)",color:"#6366f1",border:"1px solid rgba(99,102,241,0.3)",borderRadius:"var(--radius-md)",fontSize:"0.82rem",cursor:"pointer"}}
                              title="Gerenciar atividades"
                            >
                              📋 Atividades
                            </button>
                            {(permissoes?.pode_gerenciar_usuarios || permissoes?.pode_editar_comissoes) && (
                              <>
                                <button
                                  onClick={() => handleEditar(comissao)}
                                  style={{padding:"0.25rem 0.55rem",background:"var(--color-accent-bg)",color:"var(--color-accent)",border:"1px solid var(--color-accent)",borderRadius:"var(--radius-md)",fontSize:"0.82rem",cursor:"pointer"}}
                                  title="Editar"
                                >
                                  ✏️ Editar
                                </button>
                                <button
                                  onClick={() => handleExcluir(comissao.id)}
                                  style={{padding:"0.25rem 0.55rem",background:"rgba(239,68,68,0.15)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"var(--radius-md)",fontSize:"0.82rem",cursor:"pointer"}}
                                  title="Excluir"
                                >
                                  🗑️ Excluir
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* MODAL DE VISUALIZAÇÃO */}
      {modalVisualizar && comissaoVisualizar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            {/* Header do Modal */}
            <div style={{background:"var(--color-accent)",padding:"1.25rem 1.5rem",borderRadius:"var(--radius-xl) var(--radius-xl) 0 0"}}>
              <div className="flex justify-between items-start">
                <div>
                  <h3 style={{fontSize:"1.25rem",fontWeight:"800",color:"#fff",margin:"0 0 0.5rem"}}>📋 {comissaoVisualizar.nome}</h3>
                  <div className="flex gap-2 flex-wrap">
                    <span style={{padding:"0.2rem 0.75rem",borderRadius:"999px",fontSize:"0.78rem",fontWeight:"700",
                      background:comissaoVisualizar.status==='em_andamento'?'rgba(16,185,129,0.2)':comissaoVisualizar.status==='concluida'?'rgba(59,130,246,0.2)':'rgba(148,163,184,0.2)',
                      color:comissaoVisualizar.status==='em_andamento'?'#10b981':comissaoVisualizar.status==='concluida'?'#3b82f6':'#94a3b8',
                      border:'1px solid currentColor'}}>
                      {comissaoVisualizar.status === 'em_andamento' ? '🔄 Em Andamento' : 
                       comissaoVisualizar.status === 'concluida' ? '✅ Concluída' : '⏸️ Suspensa'}
                    </span>
                    <span style={{padding:"0.2rem 0.75rem",borderRadius:"999px",fontSize:"0.78rem",fontWeight:"700",
                      background:comissaoVisualizar.origem==='interna'?'rgba(59,130,246,0.2)':'rgba(139,92,246,0.2)',
                      color:comissaoVisualizar.origem==='interna'?'#3b82f6':'#8b5cf6',
                      border:'1px solid currentColor'}}>
                      {comissaoVisualizar.origem === 'interna' ? '🏢 Interna' : '🌐 Externa'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setModalVisualizar(false)}
                  style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",color:"#fff",borderRadius:"50%",width:"2rem",height:"2rem",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:"1.1rem",fontWeight:"700"}}
                  title="Fechar"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-6 space-y-6">
              {/* Informações Principais */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                  <p className="text-sm mb-1">📅 Data de Criação</p>
                  <p className="text-lg font-semibold">
                    {formatarData(comissaoVisualizar.data_criacao)}
                  </p>
                </div>

                {comissaoVisualizar.data_inicio && (
                  <div className="p-4 rounded-lg" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                    <p className="text-sm mb-1">🚀 Data de Início</p>
                    <p className="text-lg font-semibold">
                      {formatarData(comissaoVisualizar.data_inicio)}
                    </p>
                  </div>
                )}

                {comissaoVisualizar.data_fim && (
                  <div className="p-4 rounded-lg" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                    <p className="text-sm mb-1">🏁 Data de Término</p>
                    <p className="text-lg font-semibold">
                      {formatarData(comissaoVisualizar.data_fim)}
                    </p>
                  </div>
                )}
              </div>

              {/* Objetivo */}
              {comissaoVisualizar.objetivo && (
                <div className="p-4 rounded-lg border-l-4 border-blue-600" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                  <p className="text-sm mb-2 font-semibold">🎯 Objetivo</p>
                  <p className="whitespace-pre-wrap">
                    {comissaoVisualizar.objetivo}
                  </p>
                </div>
              )}

              {/* Integrantes */}
              <div className="rounded-lg p-4" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                <h4 className="text-lg font-bold mb-4">👥 Integrantes</h4>
                {integrantesVisualizar && integrantesVisualizar.length > 0 ? (
                  <div className="space-y-2">
                    {integrantesVisualizar.map((integrante, index) => {
                      const irmao = irmaos.find(i => i.id === integrante.irmao_id);
                      return (
                        <div key={index} className="flex items-center justify-between p-3 rounded-lg" style={{background:index%2===0?"var(--color-surface)":"var(--color-surface-2)",borderBottom:"1px solid var(--color-border)"}}>
                          <div>
                            <p className="font-semibold">
                              {irmao?.nome || 'Irmão não encontrado'}
                            </p>
                            {irmao?.cim && (
                              <p className="text-sm">CIM: {irmao.cim}</p>
                            )}
                          </div>
                          <span style={{padding:"0.2rem 0.75rem",borderRadius:"999px",fontSize:"0.78rem",fontWeight:"700",background:"rgba(59,130,246,0.15)",color:"#3b82f6",border:"1px solid rgba(59,130,246,0.3)"}}>
                            {integrante.funcao}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center py-4">Nenhum integrante cadastrado</p>
                )}
              </div>

              {/* Atividades */}
              <div className="rounded-lg p-4" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-lg font-bold">📋 Atividades</h4>
                  <button
                    onClick={() => {
                      setModalVisualizar(false);
                      setComissaoAtividades(comissaoVisualizar);
                      setModalAtividades(true);
                    }}
                    style={{padding:"0.25rem 0.55rem",background:"rgba(99,102,241,0.15)",color:"#6366f1",border:"1px solid rgba(99,102,241,0.3)",borderRadius:"var(--radius-md)",fontSize:"0.82rem",cursor:"pointer"}}
                              title="Gerenciar atividades"
                  >
                    ➕ Adicionar Atividade
                  </button>
                </div>
                {atividadesVisualizar && atividadesVisualizar.length > 0 ? (
                  <div className="space-y-3">
                    {atividadesVisualizar.map((atividade, index) => (
                      <div key={index} className="p-4 rounded-lg transition" style={{background:index%2===0?"var(--color-surface)":"var(--color-surface-2)",border:"1px solid var(--color-border)"}}>
                        <div className="flex justify-between items-start mb-3">
                          <h5 className="font-bold text-base">{atividade.titulo}</h5>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            atividade.status === 'concluida' 
                              ? ' text-green-800' 
                              : atividade.status === 'em_andamento'
                              ? ' text-yellow-800'
                              : ' '
                          }`}>
                            {atividade.status === 'concluida' ? '✅ Concluída' : 
                             atividade.status === 'em_andamento' ? '🔄 Em Andamento' : '📝 Pendente'}
                          </span>
                        </div>
                        
                        <div className="space-y-3">
                          {/* Deliberações */}
                          {atividade.deliberacoes && (
                            <div className="p-3 rounded-lg border-l-4 border-blue-500" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                              <p className="text-xs font-bold text-blue-800 mb-1">💬 Deliberações:</p>
                              <p className="text-sm whitespace-pre-wrap">{atividade.deliberacoes}</p>
                            </div>
                          )}
                          
                          {/* Observações */}
                          {atividade.observacoes && (
                            <div className="p-3 rounded-lg border-l-4 border-purple-500" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                              <p className="text-xs font-bold text-purple-800 mb-1">📝 Observações:</p>
                              <p className="text-sm whitespace-pre-wrap">{atividade.observacoes}</p>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex gap-4 text-xs mt-3">
                          <span>📅 {formatarData(atividade.data_atividade)}</span>
                          {atividade.data_conclusao && (
                            <span>✓ Concluída em {formatarData(atividade.data_conclusao)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center py-4">Nenhuma atividade cadastrada</p>
                )}
              </div>
            </div>

            {/* Footer do Modal */}
            <div className="px-6 py-4 rounded-b-xl flex justify-end gap-3">
              <button
                onClick={() => {
                  setModalVisualizar(false);
                  handleEditar(comissaoVisualizar);
                }}
                className="px-4 py-2 text-white rounded-lg hover: font-semibold"
              >
                ✏️ Editar
              </button>
              <button
                onClick={() => setModalVisualizar(false)}
                className="px-4 py-2 rounded-lg font-semibold" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ATIVIDADES */}
      {modalAtividades && comissaoAtividades && (
        <AtividadesComissao
          comissao={comissaoAtividades}
          onClose={() => {
            setModalAtividades(false);
            setComissaoAtividades(null);
          }}
          showSuccess={showSuccess}
          showError={showError}
          permissoes={permissoes}
        />
      )}
    </div>
  );
};

export default Comissoes;
