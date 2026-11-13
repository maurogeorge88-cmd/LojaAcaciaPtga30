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
  const anoAtual = new Date().getFullYear();
  const [anoFiltro, setAnoFiltro] = useState(anoAtual); // 0 = Todos (última opção); padrão = ano atual
  const [modalIntegrantes, setModalIntegrantes] = useState(null); // comissão cujo quadro de integrantes está aberto
  const [mostrarEncerradas, setMostrarEncerradas] = useState(false);
  const [integrantesPorComissao, setIntegrantesPorComissao] = useState({}); // { comissao_id: [{irmao_id, funcao}] }

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
  
  // Integrantes de todas as comissões (uma consulta só) — alimenta o botão e o quadro de integrantes
  useEffect(() => {
    const buscarIntegrantes = async () => {
      try {
        const { data } = await supabase.from('comissoes_integrantes').select('comissao_id, irmao_id, funcao');
        const mapa = {};
        (data || []).forEach(r => { (mapa[r.comissao_id] = mapa[r.comissao_id] || []).push(r); });
        setIntegrantesPorComissao(mapa);
      } catch {}
    };
    buscarIntegrantes();
  }, [comissoes]);

  // Esc fecha o que estiver aberto (integrantes primeiro, depois a visualização)
  useEffect(() => {
    const aoTeclar = (e) => {
      if (e.key !== 'Escape') return;
      if (modalIntegrantes) setModalIntegrantes(null);
      else if (modalVisualizar) setModalVisualizar(false);
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [modalIntegrantes, modalVisualizar]);

  // Ano da comissão = ano da DATA DE INÍCIO (lido direto do texto AAAA-MM-DD; evita o erro de fuso de 1 dia)
  const anoDaComissao = (c) => (c?.data_inicio ? parseInt(String(c.data_inicio).slice(0, 4), 10) : null);

  // Anos que têm comissão cadastrada (mais recente primeiro)
  const anosDisponiveis = [...new Set(comissoes.map(anoDaComissao).filter(a => a))].sort((a, b) => b - a);
  const qtdPorAno = {};
  comissoes.forEach(c => { const a = anoDaComissao(c); if (a) qtdPorAno[a] = (qtdPorAno[a] || 0) + 1; });
  const anoAtualTemComissao = anosDisponiveis.includes(anoAtual);
  // Padrão = ano atual; se ainda não há comissão nele, mostra o ano anterior mais recente
  const anoExibido = (anoFiltro === 0 || anosDisponiveis.includes(anoFiltro))
    ? anoFiltro
    : (anosDisponiveis.find(a => a < anoAtual) ?? anosDisponiveis[0] ?? 0);

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

  // ── Dados da listagem ──────────────────────────────────────────────────────
  const podeEditar = !!(permissoes?.pode_gerenciar_usuarios || permissoes?.pode_editar_comissoes);
  const comissoesDoAno = comissoes.filter(c => anoExibido === 0 || anoDaComissao(c) === anoExibido);
  const qtdInternas = comissoesDoAno.filter(c => c.origem === 'interna').length;
  const qtdExternas = comissoesDoAno.filter(c => c.origem === 'externa').length;
  const comissoesAba = comissoesDoAno.filter(c => c.origem === abaAtiva);
  const emAndamento = comissoesAba.filter(c => c.status === 'em_andamento');
  const encerradas = comissoesAba.filter(c => c.status !== 'em_andamento'); // inclui status antigos (ex.: concluída)
  const totalEmAndamento = comissoesDoAno.filter(c => c.status === 'em_andamento').length;
  const totalAtividadesAno = comissoesDoAno.reduce((soma, c) => soma + (contagemAtividades[c.id] || 0), 0);
  const encerradasVisiveis = mostrarEncerradas || emAndamento.length === 0;

  const FUNCOES = {
    'Presidente':      { cor: '#f59e0b', ordem: 0, icone: '⭐' },
    'Vice-Presidente': { cor: '#f97316', ordem: 1, icone: '' },
    'Relator':         { cor: '#8b5cf6', ordem: 2, icone: '' },
    'Secretário':      { cor: '#3b82f6', ordem: 3, icone: '' },
    'Membro':          { cor: '#64748b', ordem: 4, icone: '' },
  };
  const infoFuncao = (f) => FUNCOES[f] || { cor: '#64748b', ordem: 9, icone: '' };
  const iniciais = (nome) => {
    const partes = String(nome || '?').split(/\s+/).filter(p => p && !['de', 'da', 'do', 'das', 'dos', 'e'].includes(p.toLowerCase()));
    return ((partes[0]?.[0] || '?') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
  };
  const integrantesOrdenados = (comissaoId) => (integrantesPorComissao[comissaoId] || [])
    .map(r => ({ ...r, irmao: irmaos.find(i => i.id === r.irmao_id) }))
    .sort((a, b) => infoFuncao(a.funcao).ordem - infoFuncao(b.funcao).ordem || String(a.irmao?.nome || '').localeCompare(String(b.irmao?.nome || '')));
  const nomePresidente = (comissaoId) => integrantesOrdenados(comissaoId).find(r => r.funcao === 'Presidente')?.irmao?.nome;

  const rotuloKpi = { margin: 0, fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' };
  const cartaoKpi = (cor) => ({ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderTop: `3px solid ${cor}`, borderRadius: 'var(--radius-xl)', padding: '1rem 1.1rem', minWidth: 0 });
  const btnCartao = (cor) => ({ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', height: '2rem', padding: '0 0.75rem', borderRadius: 'var(--radius-md)', border: `1px solid ${cor}55`, background: `${cor}1f`, color: cor, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' });
  const btnIcone = (cor) => ({ width: '2rem', height: '2rem', borderRadius: 'var(--radius-md)', border: `1px solid ${cor}55`, background: `${cor}1f`, cursor: 'pointer', fontSize: '0.85rem' });

  const renderCartao = (comissao) => {
    const andamento = comissao.status === 'em_andamento';
    const cor = andamento ? '#10b981' : '#64748b';
    const qtdInt = (integrantesPorComissao[comissao.id] || []).length;
    const qtdAtiv = contagemAtividades[comissao.id] || 0;
    const presidente = nomePresidente(comissao.id);
    return (
      <div key={comissao.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderTop: `3px solid ${cor}`, borderRadius: 'var(--radius-xl)', padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.7rem', minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
          <button onClick={() => handleVisualizar(comissao)} title="Ver detalhes"
            style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', color: 'var(--color-text)', fontWeight: 800, fontSize: '1rem', lineHeight: 1.3, minWidth: 0, overflowWrap: 'anywhere' }}>
            {comissao.nome}
          </button>
          <span style={{ flexShrink: 0, padding: '0.15rem 0.6rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700, background: `${cor}22`, color: cor, border: `1px solid ${cor}55` }}>
            {andamento ? '🔄 Em andamento' : '✅ Encerrada'}
          </span>
        </div>

        {comissao.objetivo && (
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {comissao.objetivo}
          </p>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem 1rem', fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>
          <span>📅 {formatarData(comissao.data_inicio)}{comissao.data_fim && ` → ${formatarData(comissao.data_fim)}`}</span>
          {presidente && <span title="Presidente da comissão">⭐ {presidente}</span>}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.45rem', marginTop: 'auto', paddingTop: '0.7rem', borderTop: '1px solid var(--color-border)' }}>
          <button onClick={() => setModalIntegrantes(comissao)} style={btnCartao('#3b82f6')} title="Ver os integrantes">
            👥 Integrantes <strong>{qtdInt}</strong>
          </button>
          <button onClick={() => { setComissaoAtividades(comissao); setModalAtividades(true); }} style={btnCartao('#6366f1')} title="Gerenciar atividades">
            📋 Atividades <strong>{qtdAtiv}</strong>
          </button>
          <button onClick={() => handleVisualizar(comissao)} style={btnCartao('#10b981')} title="Visualizar detalhes">
            👁️ Detalhes
          </button>
          {podeEditar && (
            <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: '0.35rem' }}>
              <button onClick={() => handleEditar(comissao)} style={btnIcone('#3b82f6')} title="Editar" aria-label="Editar comissão">✏️</button>
              <button onClick={() => handleExcluir(comissao.id)} style={btnIcone('#ef4444')} title="Excluir" aria-label="Excluir comissão">🗑️</button>
            </span>
          )}
        </div>
      </div>
    );
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

      {/* CABEÇALHO */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>🏛️ Comissões</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: '0.2rem 0 0' }}>
            {anoExibido === 0 ? 'Todas as comissões cadastradas' : `Comissões de ${anoExibido}`}
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.6rem' }}>
          <select
            value={anoExibido}
            onChange={(e) => setAnoFiltro(parseInt(e.target.value))}
            aria-label="Ano"
            style={{ height: '2.6rem', padding: '0 0.9rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-light)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer' }}
          >
            {anosDisponiveis.map(ano => (
              <option key={ano} value={ano}>{ano} ({qtdPorAno[ano]})</option>
            ))}
            <option value={0}>Todos ({comissoes.length})</option>
          </select>
          {podeEditar && (
            <button onClick={() => { limparFormulario(); setModalComissaoAberto(true); }}
              style={{ height: '2.6rem', padding: '0 1.2rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              ➕ Nova Comissão
            </button>
          )}
        </div>
      </div>

      {/* AVISO: ano atual sem comissões cadastradas */}
      {!anoAtualTemComissao && (
        <div style={{ marginBottom: '1rem', padding: '0.85rem 1.1rem', borderRadius: 'var(--radius-lg)', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.45)', borderLeft: '4px solid #f59e0b', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div>
            <strong style={{ color: '#f59e0b', fontSize: '0.9rem' }}>⚠️ Ainda não há comissões cadastradas para {anoAtual}</strong>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--color-text)' }}>
              {anoExibido !== 0 ? `Estão sendo exibidas as comissões de ${anoExibido}. ` : ''}Cadastre as novas comissões do ano.
            </p>
          </div>
          {podeEditar && (
            <button onClick={() => { limparFormulario(); setModalComissaoAberto(true); }}
              style={{ height: '2.2rem', padding: '0 1rem', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
              ➕ Cadastrar comissão de {anoAtual}
            </button>
          )}
        </div>
      )}

      {/* INDICADORES */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <div style={cartaoKpi('var(--color-accent)')}>
          <p style={rotuloKpi}>Comissões {anoExibido === 0 ? '(todas)' : `em ${anoExibido}`}</p>
          <p style={{ margin: '0.25rem 0 0.5rem', fontSize: '2rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.1 }}>{comissoesDoAno.length}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.55rem', borderRadius: 999, background: 'var(--color-surface-2)', border: '1px solid var(--color-border-light)', color: 'var(--color-text-muted)' }}>🏛️ Internas <strong style={{ color: 'var(--color-text)' }}>{qtdInternas}</strong></span>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.55rem', borderRadius: 999, background: 'var(--color-surface-2)', border: '1px solid var(--color-border-light)', color: 'var(--color-text-muted)' }}>🌐 Externas <strong style={{ color: 'var(--color-text)' }}>{qtdExternas}</strong></span>
          </div>
        </div>
        <div style={cartaoKpi('#10b981')}>
          <p style={rotuloKpi}>Em andamento</p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '2rem', fontWeight: 800, color: '#10b981', lineHeight: 1.1 }}>{totalEmAndamento}</p>
        </div>
        <div style={cartaoKpi('#64748b')}>
          <p style={rotuloKpi}>Encerradas</p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '2rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.1 }}>{comissoesDoAno.length - totalEmAndamento}</p>
        </div>
        <div style={cartaoKpi('#6366f1')}>
          <p style={rotuloKpi}>Atividades registradas</p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '2rem', fontWeight: 800, color: '#6366f1', lineHeight: 1.1 }}>{totalAtividadesAno}</p>
        </div>
      </div>

      {/* ABAS */}
      <div style={{ display: 'inline-flex', gap: '0.25rem', padding: '0.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-lg)', marginBottom: '1rem' }}>
        {[['interna', '🏛️ Internas (Loja)', qtdInternas], ['externa', '🌐 Externas (Participação)', qtdExternas]].map(([valor, rotulo, qtd]) => (
          <button key={valor} onClick={() => setAbaAtiva(valor)}
            style={{ padding: '0.5rem 1.1rem', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700,
              background: abaAtiva === valor ? 'var(--color-accent)' : 'transparent', color: abaAtiva === valor ? '#fff' : 'var(--color-text-muted)' }}>
            {rotulo} <span style={{ opacity: 0.85 }}>({qtd})</span>
          </button>
        ))}
      </div>

      {/* LISTAGEM */}
      {comissoesAba.length === 0 ? (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '3rem 1rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          <p style={{ fontSize: '2rem', margin: '0 0 0.5rem' }}>📋</p>
          <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--color-text)' }}>Nenhuma comissão {abaAtiva === 'interna' ? 'interna' : 'externa'} encontrada</p>
          <p style={{ margin: '0.3rem 0 0', fontSize: '0.8rem' }}>{anoExibido !== 0 ? `em ${anoExibido}` : ''}</p>
        </div>
      ) : (
        <>
          {emAndamento.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ margin: '0 0 0.6rem', fontSize: '0.78rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                🔄 Em andamento ({emAndamento.length})
              </p>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {emAndamento.map(renderCartao)}
              </div>
            </div>
          )}

          {encerradas.length > 0 && (
            <div>
              <button onClick={() => setMostrarEncerradas(v => !v)} disabled={emAndamento.length === 0}
                style={{ background: 'none', border: 'none', padding: 0, margin: '0 0 0.6rem', cursor: emAndamento.length === 0 ? 'default' : 'pointer', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                ✅ Encerradas ({encerradas.length}) {emAndamento.length > 0 && (encerradasVisiveis ? '▾' : '▸')}
              </button>
              {encerradasVisiveis && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {encerradas.map(renderCartao)}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* MODAL DE VISUALIZAÇÃO */}
      {modalVisualizar && comissaoVisualizar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            {/* Header do Modal */}
            <div style={{background:"var(--color-surface)",borderTop:"3px solid var(--color-accent)",borderBottom:"1px solid var(--color-border)",padding:"1.1rem 1.5rem",borderRadius:"var(--radius-xl) var(--radius-xl) 0 0"}}>
              <div className="flex justify-between items-start" style={{gap:'1rem'}}>
                <div style={{minWidth:0}}>
                  <h3 style={{fontSize:"1.2rem",fontWeight:"800",color:"var(--color-text)",margin:"0 0 0.5rem",overflowWrap:'anywhere'}}>📋 {comissaoVisualizar.nome}</h3>
                  <div className="flex gap-2 flex-wrap">
                    <span style={{padding:"0.2rem 0.75rem",borderRadius:"999px",fontSize:"0.78rem",fontWeight:"700",
                      background:comissaoVisualizar.status==='em_andamento'?'rgba(16,185,129,0.15)':'rgba(100,116,139,0.18)',
                      color:comissaoVisualizar.status==='em_andamento'?'#10b981':'#94a3b8',
                      border:'1px solid currentColor'}}>
                      {comissaoVisualizar.status === 'em_andamento' ? '🔄 Em Andamento' : '✅ Encerrada'}
                    </span>
                    <span style={{padding:"0.2rem 0.75rem",borderRadius:"999px",fontSize:"0.78rem",fontWeight:"700",
                      background:comissaoVisualizar.origem==='interna'?'rgba(59,130,246,0.15)':'rgba(139,92,246,0.15)',
                      color:comissaoVisualizar.origem==='interna'?'#3b82f6':'#8b5cf6',
                      border:'1px solid currentColor'}}>
                      {comissaoVisualizar.origem === 'interna' ? '🏢 Interna' : '🌐 Externa'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setModalVisualizar(false)}
                  aria-label="Fechar"
                  style={{background:"var(--color-bg)",border:"1px solid var(--color-border-light)",color:"var(--color-text-muted)",borderRadius:"var(--radius-md)",width:"2.2rem",height:"2.2rem",fontSize:"1.3rem",lineHeight:1,cursor:"pointer",flexShrink:0}}
                  title="Fechar (Esc)"
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
            <div className="px-6 py-4 flex justify-end gap-3" style={{borderTop:"1px solid var(--color-border)"}}>
              {podeEditar && (
                <button
                  onClick={() => {
                    setModalVisualizar(false);
                    handleEditar(comissaoVisualizar);
                  }}
                  style={{height:"2.5rem",padding:"0 1.1rem",background:"var(--color-accent)",color:"#fff",border:"none",borderRadius:"var(--radius-md)",fontWeight:700,fontSize:"0.875rem",cursor:"pointer"}}
                >
                  ✏️ Editar
                </button>
              )}
              <button
                onClick={() => setModalVisualizar(false)}
                style={{height:"2.5rem",padding:"0 1.1rem",background:"transparent",color:"var(--color-text-muted)",border:"1px solid var(--color-border-light)",borderRadius:"var(--radius-md)",fontWeight:600,fontSize:"0.875rem",cursor:"pointer"}}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE INTEGRANTES */}
      {modalIntegrantes && (() => {
        const lista = integrantesOrdenados(modalIntegrantes.id);
        const porFuncao = {};
        lista.forEach(r => { porFuncao[r.funcao] = (porFuncao[r.funcao] || 0) + 1; });
        return (
          <div onClick={() => setModalIntegrantes(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderTop: '3px solid #3b82f6', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '520px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px rgba(0,0,0,0.4)' }}>

              {/* Cabeçalho */}
              <div style={{ padding: '1.1rem 1.4rem', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)' }}>👥 Integrantes</h3>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)', overflowWrap: 'anywhere' }}>{modalIntegrantes.nome}</p>
                </div>
                <button onClick={() => setModalIntegrantes(null)} aria-label="Fechar" title="Fechar (Esc)"
                  style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border-light)', color: 'var(--color-text-muted)', borderRadius: 'var(--radius-md)', width: '2.2rem', height: '2.2rem', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', flexShrink: 0 }}>×</button>
              </div>

              {/* Resumo por função */}
              {lista.length > 0 && (
                <div style={{ padding: '0.75rem 1.4rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.65rem', borderRadius: 999, background: 'var(--color-bg)', border: '1px solid var(--color-border-light)', color: 'var(--color-text)' }}>
                    {lista.length} integrante{lista.length === 1 ? '' : 's'}
                  </span>
                  {Object.entries(porFuncao).sort((x, y) => infoFuncao(x[0]).ordem - infoFuncao(y[0]).ordem).map(([f, n]) => (
                    <span key={f} style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.65rem', borderRadius: 999, background: `${infoFuncao(f).cor}1f`, color: infoFuncao(f).cor, border: `1px solid ${infoFuncao(f).cor}55` }}>
                      {f} · {n}
                    </span>
                  ))}
                </div>
              )}

              {/* Lista */}
              <div style={{ padding: '0.9rem 1.4rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {lista.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--color-text-muted)' }}>
                    <p style={{ fontSize: '2rem', margin: '0 0 0.4rem' }}>👥</p>
                    <p style={{ margin: 0, fontSize: '0.9rem' }}>Nenhum integrante cadastrado nesta comissão</p>
                  </div>
                ) : lista.map((r, idx) => {
                  const f = infoFuncao(r.funcao);
                  return (
                    <div key={`${r.irmao_id}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-lg)', background: r.funcao === 'Presidente' ? `${f.cor}14` : 'var(--color-bg)', border: `1px solid ${r.funcao === 'Presidente' ? f.cor + '55' : 'var(--color-border)'}` }}>
                      <div style={{ width: '2.4rem', height: '2.4rem', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', color: f.cor, background: `${f.cor}22`, border: `1px solid ${f.cor}55` }}>
                        {iniciais(r.irmao?.nome)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.88rem', color: 'var(--color-text)', overflowWrap: 'anywhere' }}>{r.irmao?.nome || 'Irmão não encontrado'}</p>
                        {r.irmao?.cim && <p style={{ margin: '0.1rem 0 0', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>CIM {r.irmao.cim}</p>}
                      </div>
                      <span style={{ flexShrink: 0, padding: '0.18rem 0.7rem', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, color: f.cor, background: `${f.cor}1f`, border: `1px solid ${f.cor}55` }}>
                        {f.icone} {r.funcao}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div style={{ padding: '0.85rem 1.4rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setModalIntegrantes(null)}
                  style={{ height: '2.5rem', padding: '0 1.2rem', background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
