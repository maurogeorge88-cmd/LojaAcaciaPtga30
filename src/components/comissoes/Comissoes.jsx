import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { formatarData } from '../../utils/formatters';
import AtividadesComissao from './AtividadesComissao';

const Comissoes = ({ comissoes, irmaos, onUpdate, showSuccess, showError, permissoes, userData }) => {
  // Verificar se as props essenciais existem
  if (!comissoes || !irmaos) {
    return (
      <div className="rounded-xl p-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>>
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
    <div>
      {/* FORMULÁRIO - Só aparece para quem pode editar */}
      {(permissoes?.pode_gerenciar_usuarios || permissoes?.pode_editar_comissoes) && (
        <div className="rounded-xl p-6 mb-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>>
          <h3 className="text-xl font-bold text-blue-900 mb-4" style={{color:"var(--color-text)"}}>
            {modoEdicao ? '✏️ Editar Comissão' : '➕ Nova Comissão'}
          </h3>

        <div className="space-y-4 mb-4">
          {/* LINHA 1: Nome, Data Criação, Origem, Status */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Nome da Comissão *</label>
              <input
                type="text"
                value={comissaoForm.nome}
                onChange={(e) => setComissaoForm({ ...comissaoForm, nome: e.target.value })}
                className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Data de Criação *</label>
              <input
                type="date"
                value={comissaoForm.data_criacao}
                onChange={(e) => setComissaoForm({ ...comissaoForm, data_criacao: e.target.value })}
                className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Origem *</label>
              <select
                value={comissaoForm.origem}
                onChange={(e) => setComissaoForm({ ...comissaoForm, origem: e.target.value })}
                className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
              >
                <option value="interna">Interna</option>
                <option value="externa">Externa</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Status *</label>
              <select
                value={comissaoForm.status}
                onChange={(e) => setComissaoForm({ ...comissaoForm, status: e.target.value })}
                className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
              >
                <option value="em_andamento">Em Andamento</option>
                <option value="encerrada">Encerrada</option>
              </select>
            </div>
          </div>

          {/* LINHA 2: Data Início, Data Fim, Objetivo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Data Início *</label>
              <input
                type="date"
                value={comissaoForm.data_inicio}
                onChange={(e) => setComissaoForm({ ...comissaoForm, data_inicio: e.target.value })}
                className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Data Fim</label>
              <input
                type="date"
                value={comissaoForm.data_fim}
                onChange={(e) => setComissaoForm({ ...comissaoForm, data_fim: e.target.value })}
                className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Objetivo *</label>
              <textarea
                value={comissaoForm.objetivo}
                onChange={(e) => setComissaoForm({ ...comissaoForm, objetivo: e.target.value })}
                className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
                rows="1"
                required
              />
            </div>
          </div>
        </div>

        {/* INTEGRANTES */}
        <div className="border-t pt-4 mt-4">
          <h4 className="font-bold mb-3">👥 Integrantes</h4>
          
          <div className="flex gap-2 mb-3">
            <select
              id="select-irmao-comissao"
              className="flex-1 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
            >
              <option value="">Selecione um irmão</option>
              {irmaos
                .filter(irmao => irmao.situacao?.toLowerCase() === 'regular')
                .map(irmao => (
                  <option key={irmao.id} value={irmao.id}>
                    {irmao.nome} - CIM {irmao.cim}
                  </option>
                ))}
            </select>

            <select
              id="select-funcao-comissao"
              className="px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
            >
              <option value="">Função</option>
              <option value="Presidente">Presidente</option>
              <option value="Vice-Presidente">Vice-Presidente</option>
              <option value="Secretário">Secretário</option>
              <option value="Membro">Membro</option>
              <option value="Relator">Relator</option>
            </select>

            <button
              type="button"
              onClick={adicionarIntegrante}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Adicionar
            </button>
          </div>

          {integrantesTemp.length > 0 && (
            <div className="rounded-lg p-3" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>>
              {integrantesTemp.map((integrante, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b last:border-0">
                  <span className="font-medium">{integrante.irmao_nome}</span>
                  <span className="text-sm">{integrante.funcao}</span>
                  <button
                    type="button"
                    onClick={() => removerIntegrante(integrante.irmao_id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    ❌
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* BOTÕES */}
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={modoEdicao ? handleAtualizar : handleSubmit}
            disabled={loading}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Salvando...' : (modoEdicao ? 'Atualizar Comissão' : 'Cadastrar Comissão')}
          </button>
          
          {modoEdicao && (
            <button
              type="button"
              onClick={limparFormulario}
              className="px-6 py-2 rounded-lg transition-colors" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
            >
              Cancelar Edição
            </button>
          )}
        </div>
      </div>
      )}

      {/* LISTAGEM */}
      <div className="rounded-xl overflow-hidden" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>>
        <div className="p-4 bg-gradient-to-r from-primary-600 to-blue-700 text-white">
          <h3 className="text-xl font-bold" style={{color:"var(--color-text)"}}>Comissões Cadastradas</h3>
          <p className="text-sm text-blue-100">Total: {comissoes.length} comissão(ões)</p>
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
                    ? 'bg-purple-600 text-white'
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
                    <div className="bg-green-50 px-4 py-2 border-b border-green-200">
                      <h4 className="font-bold text-green-800">🔄 Em Andamento ({emAndamento.length})</h4>
                    </div>
                    {emAndamento.map((comissao) => (
                      <div key={comissao.id} className="p-4 hover:">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-bold text-lg">{comissao.nome}</h4>
                            <p className="text-sm mt-1" style={{color:"var(--color-text-muted)"}}>{comissao.objetivo}</p>
                            <div className="flex gap-4 mt-2 text-sm">
                              <span className="px-2 py-1 rounded bg-green-100 text-green-800">
                                Em Andamento
                              </span>
                              <span className="">
                                📅 {formatarData(comissao.data_inicio)} 
                                {comissao.data_fim && ` - ${formatarData(comissao.data_fim)}`}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <button
                              onClick={() => handleVisualizar(comissao)}
                              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-primary-600 text-sm"
                              title="Visualizar detalhes"
                            >
                              👁️ Ver
                            </button>
                            <button
                              onClick={() => {
                                setComissaoAtividades(comissao);
                                setModalAtividades(true);
                              }}
                              className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                              title="Gerenciar atividades"
                            >
                              📋 Atividades
                            </button>
                            {(permissoes?.pode_gerenciar_usuarios || permissoes?.pode_editar_comissoes) && (
                              <>
                                <button
                                  onClick={() => handleEditar(comissao)}
                                  className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm"
                                  title="Editar"
                                >
                                  ✏️ Editar
                                </button>
                                <button
                                  onClick={() => handleExcluir(comissao.id)}
                                  className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
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
                    {encerradas.map((comissao) => (
                      <div key={comissao.id} className="p-4 opacity-75">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-bold text-lg">{comissao.nome}</h4>
                            <p className="text-sm mt-1" style={{color:"var(--color-text-muted)"}}>{comissao.objetivo}</p>
                            <div className="flex gap-4 mt-2 text-sm">
                              <span className="px-2 py-1 rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)"}}>
                                Encerrada
                              </span>
                              <span className="">
                                📅 {formatarData(comissao.data_inicio)} - {formatarData(comissao.data_fim)}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <button
                              onClick={() => handleVisualizar(comissao)}
                              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-primary-600 text-sm"
                              title="Visualizar detalhes"
                            >
                              👁️ Ver
                            </button>
                            <button
                              onClick={() => {
                                setComissaoAtividades(comissao);
                                setModalAtividades(true);
                              }}
                              className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                              title="Gerenciar atividades"
                            >
                              📋 Atividades
                            </button>
                            {(permissoes?.pode_gerenciar_usuarios || permissoes?.pode_editar_comissoes) && (
                              <>
                                <button
                                  onClick={() => handleEditar(comissao)}
                                  className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm"
                                  title="Editar"
                                >
                                  ✏️ Editar
                                </button>
                                <button
                                  onClick={() => handleExcluir(comissao.id)}
                                  className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
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
          <div className="rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>>
            {/* Header do Modal */}
            <div className="bg-gradient-to-r from-primary-600 to-blue-800 text-white p-6 rounded-t-xl">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-bold mb-2" style={{color:"var(--color-text)"}}>📋 {comissaoVisualizar.nome}</h3>
                  <div className="flex gap-2 flex-wrap">
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      comissaoVisualizar.status === 'em_andamento'
                        ? 'bg-green-500'
                        : comissaoVisualizar.status === 'concluida'
                        ? 'bg-blue-500'
                        : 'opacity-60'
                    }`}>
                      {comissaoVisualizar.status === 'em_andamento' ? '🔄 Em Andamento' : 
                       comissaoVisualizar.status === 'concluida' ? '✅ Concluída' : '⏸️ Suspensa'}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      comissaoVisualizar.origem === 'interna' 
                        ? 'bg-blue-400' 
                        : 'bg-purple-400'
                    }`}>
                      {comissaoVisualizar.origem === 'interna' ? '🏢 Interna' : '🌐 Externa'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setModalVisualizar(false)}
                  className="text-white hover:text-gray-200 text-3xl font-bold leading-none"
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
                <div className="p-4 rounded-lg" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>>
                  <p className="text-sm mb-1">📅 Data de Criação</p>
                  <p className="text-lg font-semibold">
                    {formatarData(comissaoVisualizar.data_criacao)}
                  </p>
                </div>

                {comissaoVisualizar.data_inicio && (
                  <div className="p-4 rounded-lg" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>>
                    <p className="text-sm mb-1">🚀 Data de Início</p>
                    <p className="text-lg font-semibold">
                      {formatarData(comissaoVisualizar.data_inicio)}
                    </p>
                  </div>
                )}

                {comissaoVisualizar.data_fim && (
                  <div className="p-4 rounded-lg" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>>
                    <p className="text-sm mb-1">🏁 Data de Término</p>
                    <p className="text-lg font-semibold">
                      {formatarData(comissaoVisualizar.data_fim)}
                    </p>
                  </div>
                )}
              </div>

              {/* Objetivo */}
              {comissaoVisualizar.objetivo && (
                <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-600" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>>
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
                        <div key={index} className="flex items-center justify-between p-3 rounded-lg" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>>
                          <div>
                            <p className="font-semibold">
                              {irmao?.nome || 'Irmão não encontrado'}
                            </p>
                            {irmao?.cim && (
                              <p className="text-sm">CIM: {irmao.cim}</p>
                            )}
                          </div>
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
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
                    className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                    title="Gerenciar atividades"
                  >
                    ➕ Adicionar Atividade
                  </button>
                </div>
                {atividadesVisualizar && atividadesVisualizar.length > 0 ? (
                  <div className="space-y-3">
                    {atividadesVisualizar.map((atividade, index) => (
                      <div key={index} className="p-4 rounded-lg transition" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                        <div className="flex justify-between items-start mb-3">
                          <h5 className="font-bold text-base">{atividade.titulo}</h5>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            atividade.status === 'concluida' 
                              ? 'bg-green-100 text-green-800' 
                              : atividade.status === 'em_andamento'
                              ? 'bg-yellow-100 text-yellow-800'
                              : ' '
                          }`}>
                            {atividade.status === 'concluida' ? '✅ Concluída' : 
                             atividade.status === 'em_andamento' ? '🔄 Em Andamento' : '📝 Pendente'}
                          </span>
                        </div>
                        
                        <div className="space-y-3">
                          {/* Deliberações */}
                          {atividade.deliberacoes && (
                            <div className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-500" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>>
                              <p className="text-xs font-bold text-blue-800 mb-1">💬 Deliberações:</p>
                              <p className="text-sm whitespace-pre-wrap">{atividade.deliberacoes}</p>
                            </div>
                          )}
                          
                          {/* Observações */}
                          {atividade.observacoes && (
                            <div className="bg-purple-50 p-3 rounded-lg border-l-4 border-purple-500" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>>
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
                className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-semibold"
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
