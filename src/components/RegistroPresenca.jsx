import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

// Função auxiliar para calcular idade
const calcularIdade = (dataNascimento) => {
  if (!dataNascimento) return null;
  const hoje = new Date();
  const nascimento = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const mes = hoje.getMonth() - nascimento.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }
  return idade;
};

export default function RegistroPresenca({ sessaoId, onVoltar }) {
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [sessao, setSessao] = useState(null);
  const [irmaosElegiveis, setIrmaosElegiveis] = useState([]);
  const [presencas, setPresencas] = useState({});
  const [justificativas, setJustificativas] = useState({});
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });
  const [busca, setBusca] = useState('');
  const [visitantes, setVisitantes] = useState([]);
  const [visitanteForm, setVisitanteForm] = useState({ nome_visitante: '', nome_loja: '', cidade: '' });

  useEffect(() => {
    if (sessaoId) {
      carregarDados();
    }
  }, [sessaoId]);

  const carregarDados = async () => {
    try {
      setLoading(true);

      // Buscar dados da sessão
      const { data: sessaoData, error: sessaoError } = await supabase
        .from('sessoes_presenca')
        .select(`
          *,
          graus_sessao:grau_sessao_id (
            id,
            nome,
            grau_minimo_requerido
          ),
          classificacoes_sessao:classificacao_id (
            nome
          )
        `)
        .eq('id', sessaoId)
        .single();

      if (sessaoError) throw sessaoError;
      setSessao(sessaoData);

      // Buscar histórico de situações (licenças, desligamentos, etc)
      const { data: historicoSituacoes } = await supabase
        .from('historico_situacoes')
        .select('*')
        .eq('status', 'ativa');

      // Buscar irmãos elegíveis DIRETO da tabela (sem usar função RPC)
      const grauMinimoRaw = sessaoData.graus_sessao?.grau_minimo_requerido;
      const grauMinimo = grauMinimoRaw ? parseInt(grauMinimoRaw) : 1;
      
      console.log('  - grau_minimo_requerido (raw):', grauMinimoRaw, typeof grauMinimoRaw);
      console.log('  - grauMinimo (convertido):', grauMinimo, typeof grauMinimo);
      console.log('  - sessaoData:', sessaoData);
      
      // Buscar todos os irmãos ativos (SEM filtro de grau na query)
      const { data: irmaosData, error: irmaosError } = await supabase
        .from('irmaos')
        .select('id, nome, cim, foto_url, situacao, data_nascimento, data_iniciacao, data_elevacao, data_exaltacao, mestre_instalado, data_instalacao, data_licenca, data_desligamento, data_falecimento, data_ingresso_loja')
        .eq('status', 'ativo')
        .order('nome');

      console.log('DEBUG - Sessão:', sessaoData);
      console.log('DEBUG - Irmãos retornados:', irmaosData);
      console.log('DEBUG - Erro ao buscar irmãos:', irmaosError);

      if (irmaosError) {
        console.error('Erro ao buscar irmãos:', irmaosError);
        throw irmaosError;
      }

      // Aplicar lógica de filtro por datas (ingresso/falecimento/desligamento)
      const dataSessao = new Date(sessaoData.data_sessao + 'T00:00:00');
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const sessaoPassada = dataSessao < hoje;
      
      const irmaosFiltrados = irmaosData?.filter(i => {
        // FILTRO 0: SITUAÇÕES QUE NÃO PODEM REGISTRAR PRESENÇA
        // Para sessões FUTURAS ou HOJE: excluir situações problemáticas
        // Para sessões PASSADAS: permitir todos (histórico), exceto falecidos antes da sessão
        if (!sessaoPassada) {
          const situacoesExcluidas = ['irregular', 'suspenso', 'ex-ofício', 'ex-oficio', 'desligado', 'excluído', 'excluido'];
          if (i.situacao && situacoesExcluidas.includes(i.situacao.toLowerCase())) {
            return false; // Não aparece para registro de presença futura
          }
        }
        
        // FILTRO 1: INGRESSO NA LOJA - só aparece se sessão for DEPOIS do ingresso
        // Prioridade: data_ingresso_loja > data_iniciacao
        const dataIngresso = i.data_ingresso_loja ? new Date(i.data_ingresso_loja + 'T00:00:00') : null;
        const dataIniciacao = i.data_iniciacao ? new Date(i.data_iniciacao + 'T00:00:00') : null;
        const dataInicio = dataIngresso || dataIniciacao;
        
        if (dataInicio && dataSessao < dataInicio) {
          return false; // Sessão antes do ingresso na loja
        }
        
        // FILTRO: Situações bloqueadoras na data da sessão
        // APENAS: desligamento, irregular, suspenso, excluído (NÃO licença)
        const situacaoBloqueadora = historicoSituacoes?.find(sit => {
          if (sit.membro_id !== i.id) return false;
          
          // Verificar se é situação bloqueadora (licença NÃO bloqueia)
          const tipoSituacao = sit.tipo_situacao?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const situacoesQueExcluem = ['desligado', 'desligamento', 'irregular', 'suspenso', 'excluido', 'ex-oficio'];
          
          if (!situacoesQueExcluem.includes(tipoSituacao)) return false;
          
          const dataInicio = new Date(sit.data_inicio + 'T00:00:00');
          
          // Sessão antes da situação começar - está OK
          if (dataSessao < dataInicio) return false;
          
          // Se tem data_fim, verificar se sessão está dentro do período
          if (sit.data_fim) {
            const dataFim = new Date(sit.data_fim + 'T00:00:00');
            return dataSessao >= dataInicio && dataSessao <= dataFim;
          }
          
          // Sem data_fim (indefinida) - se já começou, bloqueia
          return dataSessao >= dataInicio;
        });
        
        if (situacaoBloqueadora) {
          return false; // Situação bloqueadora ativa na data da sessão
        }
        
        // FILTRO: FALECIDO - só aparece se sessão foi ANTES OU NO DIA do falecimento
        if (i.data_falecimento) {
          const dataFalecimento = new Date(i.data_falecimento + 'T00:00:00');
          return dataSessao <= dataFalecimento; // <= para incluir o dia do falecimento
        }
        
        // FILTRO: Grau mínimo NA DATA DA SESSÃO
        if (grauMinimo === 2) {
          // Sessão de Companheiro: já era Companheiro na data?
          if (!i.data_elevacao) return false;
          const dataElevacao = new Date(i.data_elevacao + 'T00:00:00');
          return dataSessao >= dataElevacao;
        } else if (grauMinimo === 3) {
          // Sessão de Mestre: já era Mestre na data?
          if (!i.data_exaltacao) return false;
          const dataExaltacao = new Date(i.data_exaltacao + 'T00:00:00');
          return dataSessao >= dataExaltacao;
        }
        
        // Outros aparecem (incluindo licenças/desligamentos TEMPORÁRIOS com data_fim)
        return true;
      }) || [];

      // Mapear para formato esperado com grau calculado NA DATA DA SESSÃO
      const irmaos = irmaosFiltrados.map(i => {
        let grau_atual = 'Não Iniciado';
        
        // Calcular grau que o irmão tinha NA DATA DA SESSÃO
        if (i.data_iniciacao && dataSessao >= new Date(i.data_iniciacao + 'T00:00:00')) {
          grau_atual = 'Aprendiz';
          
          if (i.data_elevacao && dataSessao >= new Date(i.data_elevacao + 'T00:00:00')) {
            grau_atual = 'Companheiro';
            
            if (i.data_exaltacao && dataSessao >= new Date(i.data_exaltacao + 'T00:00:00')) {
              grau_atual = 'Mestre';
              
              if (i.mestre_instalado) {
                // Se tem data de instalação, verifica se já era instalado na data
                if (i.data_instalacao) {
                  if (dataSessao >= new Date(i.data_instalacao + 'T00:00:00')) {
                    grau_atual = 'Mestre Instalado';
                  }
                } else {
                  // Sem data de instalação, considera Mestre Instalado
                  grau_atual = 'Mestre Instalado';
                }
              }
            }
          }
        }
        
        return {
          membro_id: i.id,
          nome_completo: i.nome,
          cim: i.cim,
          grau_atual,
          foto_url: i.foto_url,
          situacao: i.situacao,
          data_nascimento: i.data_nascimento,
          data_licenca: i.data_licenca
        };
      });

      // Adicionar idade e verificar situação na data da sessão
      const irmaosComIdade = irmaos.map(irmao => {
        const idade = irmao.data_nascimento ? calcularIdade(irmao.data_nascimento) : null;
        
        // Verificar se tem situação ativa na data da sessão (licença, desligamento, etc)
        const situacaoNaData = historicoSituacoes?.find(sit => 
          sit.membro_id === irmao.membro_id &&
          dataSessao >= new Date(sit.data_inicio + 'T00:00:00') &&
          (sit.data_fim === null || dataSessao <= new Date(sit.data_fim + 'T00:00:00'))
        );
        
        return {
          ...irmao,
          idade,
          tem_prerrogativa: idade >= 70,
          esta_licenciado_efetivo: situacaoNaData?.tipo_situacao === 'licenca',
          situacao_na_data: situacaoNaData // guardar para usar depois
        };
      });

      setIrmaosElegiveis(irmaosComIdade);

      // Buscar presenças já registradas (se houver)
      const { data: presencasExistentes, error: presencasError } = await supabase
        .from('registros_presenca')
        .select('*')
        .eq('sessao_id', sessaoId);

      if (presencasError) throw presencasError;

      // Preencher estado de presenças e justificativas
      const presencasObj = {};
      const justificativasObj = {};

      presencasExistentes?.forEach(p => {
        presencasObj[p.membro_id] = p.presente;
        if (p.justificativa) {
          justificativasObj[p.membro_id] = p.justificativa;
        }
      });

      setPresencas(presencasObj);
      setJustificativas(justificativasObj);

      // Carregar visitantes
      const { data: visitantesData } = await supabase
        .from('visitantes_sessao')
        .select('*')
        .eq('sessao_id', sessaoId)
        .order('created_at', { ascending: false });
      setVisitantes(visitantesData || []);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setMensagem({
        tipo: 'erro',
        texto: 'Erro ao carregar dados da sessão.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePresencaChange = (membroId, presente) => {
    setPresencas(prev => ({
      ...prev,
      [membroId]: presente
    }));

    // Se marcar como presente, limpar justificativa
    if (presente && justificativas[membroId]) {
      const novasJustificativas = { ...justificativas };
      delete novasJustificativas[membroId];
      setJustificativas(novasJustificativas);
    }
  };

  const handleJustificativaChange = (membroId, texto) => {
    setJustificativas(prev => ({
      ...prev,
      [membroId]: texto
    }));
  };

  const marcarTodosPresentes = () => {
    const todasPresencas = {};
    irmaosElegiveis.forEach(irmao => {
      todasPresencas[irmao.membro_id] = true;
    });
    setPresencas(todasPresencas);
    setJustificativas({});
  };

  const desmarcarTodos = () => {
    setPresencas({});
    setJustificativas({});
  };

  const adicionarVisitante = async () => {
    if (!visitanteForm.nome_visitante || !visitanteForm.nome_loja || !visitanteForm.cidade) return;
    
    const { error } = await supabase
      .from('visitantes_sessao')
      .insert([{ sessao_id: sessaoId, ...visitanteForm }]);
    
    if (!error) {
      carregarDados();
      setVisitanteForm({ nome_visitante: '', nome_loja: '', cidade: '' });
    }
  };

  const excluirVisitante = async (id) => {
    const { error } = await supabase
      .from('visitantes_sessao')
      .delete()
      .eq('id', id);
    
    if (!error) carregarDados();
  };

  const handleSalvar = async () => {
    try {
      setSalvando(true);
      setMensagem({ tipo: '', texto: '' });

      // Buscar ID do usuário logado (só para verificar permissão)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Preparar registros de presença (SEM registrado_por)
      const registros = irmaosElegiveis.map(irmaoElegivel => ({
        sessao_id: sessaoId,
        membro_id: irmaoElegivel.membro_id,
        presente: presencas[irmaoElegivel.membro_id] || false,
        justificativa: (!presencas[irmaoElegivel.membro_id] && justificativas[irmaoElegivel.membro_id]) 
          ? justificativas[irmaoElegivel.membro_id] 
          : null
      }));

      // Usar UPSERT (inserir ou atualizar) para evitar duplicação
      const { error: upsertError } = await supabase
        .from('registros_presenca')
        .upsert(registros, {
          onConflict: 'sessao_id,membro_id',
          ignoreDuplicates: false
        });

      if (upsertError) throw upsertError;

      setMensagem({
        tipo: 'sucesso',
        texto: 'Presenças salvas com sucesso!'
      });

      // Recarregar dados
      setTimeout(() => {
        carregarDados();
      }, 1500);

    } catch (error) {
      console.error('Erro ao salvar presenças:', error);
      setMensagem({
        tipo: 'erro',
        texto: error.message || 'Erro ao salvar presenças. Tente novamente.'
      });
    } finally {
      setSalvando(false);
    }
  };

  // Filtrar irmãos pela busca
  const irmaosFiltrados = irmaosElegiveis.filter(irmao =>
    irmao.nome_completo?.toLowerCase().includes(busca.toLowerCase())
  );

  // Estatísticas
  const totalIrmaos = irmaosElegiveis.length;
  const totalPresentes = Object.values(presencas).filter(p => p === true).length;
  const totalAusentes = totalIrmaos - totalPresentes;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{borderColor:"var(--color-accent)"}}></div>
          <p style={{marginTop:"1rem",color:"var(--color-text-muted)"}}>Carregando dados da sessão...</p>
        </div>
      </div>
    );
  }

  if (!sessao) {
    return (
      <div style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"var(--radius-lg)",padding:"1.5rem",textAlign:"center"}}>
        <p style={{color:"#ef4444"}}>Sessão não encontrada.</p>
        <button
          onClick={onVoltar}
          style={{marginTop:"1rem",padding:"0.5rem 1rem",background:"var(--color-accent)",color:"#fff",border:"none",borderRadius:"var(--radius-md)",cursor:"pointer",fontWeight:"600"}}
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div style={{maxWidth:"72rem",margin:"0 auto",padding:"1.5rem",background:"var(--color-bg)",minHeight:"100vh",overflowX:"hidden"}}>
      {/* Cabeçalho */}
      <div className="rounded-lg p-6 mb-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold" style={{color:"var(--color-text)"}}>
              Registro de Presença
            </h2>
            <p style={{color:"var(--color-text-muted)",marginTop:"0.25rem"}}>
              {sessao.graus_sessao?.nome}
              {sessao.classificacoes_sessao && ` - ${sessao.classificacoes_sessao.nome}`}
            </p>
            <p style={{fontSize:"0.875rem",color:"var(--color-text-muted)"}}>
              Data: {new Date(sessao.data_sessao + 'T00:00:00').toLocaleDateString('pt-BR')}
            </p>
          </div>
          <button
            onClick={onVoltar}
            style={{padding:"0.5rem 1rem",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-md)",cursor:"pointer",fontWeight:"600"}}
          >
            ← Voltar
          </button>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div style={{background:"rgba(59,130,246,0.1)",border:"1px solid rgba(59,130,246,0.3)",borderLeft:"4px solid #3b82f6",borderRadius:"var(--radius-lg)",padding:"1rem",textAlign:"center"}}>
            <p style={{fontSize:"0.82rem",fontWeight:"600",color:"#3b82f6",marginBottom:"0.25rem"}}>Total de Irmãos</p>
            <p style={{fontSize:"1.875rem",fontWeight:"800",color:"var(--color-text)"}}>{totalIrmaos}</p>
          </div>
          <div style={{background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.3)",borderLeft:"4px solid #10b981",borderRadius:"var(--radius-lg)",padding:"1rem",textAlign:"center"}}>
            <p style={{fontSize:"0.82rem",fontWeight:"600",color:"#10b981",marginBottom:"0.25rem"}}>Presentes</p>
            <p style={{fontSize:"1.875rem",fontWeight:"800",color:"#10b981"}}>{totalPresentes}</p>
          </div>
          <div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderLeft:"4px solid #ef4444",borderRadius:"var(--radius-lg)",padding:"1rem",textAlign:"center"}}>
            <p style={{fontSize:"0.82rem",fontWeight:"600",color:"#ef4444",marginBottom:"0.25rem"}}>Ausentes</p>
            <p style={{fontSize:"1.875rem",fontWeight:"800",color:"#ef4444"}}>{totalAusentes}</p>
          </div>
        </div>
      </div>

      {/* Mensagens */}
      {mensagem.texto && (
        <div style={{marginBottom:"1rem",padding:"1rem",borderRadius:"var(--radius-lg)",background:mensagem.tipo==='sucesso'?'rgba(16,185,129,0.15)':'rgba(239,68,68,0.15)',color:mensagem.tipo==='sucesso'?'#10b981':'#ef4444',border:`1px solid ${mensagem.tipo==='sucesso'?'rgba(16,185,129,0.3)':'rgba(239,68,68,0.3)'}`}}>
          {mensagem.texto}
        </div>
      )}

      {/* Ferramentas */}
      <div className="rounded-lg p-4 mb-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <div className="flex gap-4 items-center">
          <input
            type="text"
            placeholder="🔍 Buscar irmão..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{flex:1,background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-md)",padding:"0.5rem 1rem",outline:"none"}}
          />
          <button
            onClick={marcarTodosPresentes}
            style={{padding:"0.5rem 1rem",background:"#10b981",color:"#fff",border:"none",borderRadius:"var(--radius-md)",cursor:"pointer",fontWeight:"700"}}
          >
            ✓ Marcar Todos Presentes
          </button>
          <button
            onClick={desmarcarTodos}
            style={{padding:"0.5rem 1rem",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-md)",cursor:"pointer",fontWeight:"600"}}
          >
            ✗ Desmarcar Todos
          </button>
        </div>
      </div>

      {/* Lista de Irmãos */}
      <div className="rounded-lg overflow-hidden" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y">
            <thead style={{background:"var(--color-surface-2)"}}>
              <tr>
                <th style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>
                  Irmão
                </th>
                <th style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>
                  Grau
                </th>
                <th style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>
                  Presença
                </th>
                <th style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>
                  Justificativa (se ausente)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {irmaosFiltrados.map((irmao) => (
                <tr key={irmao.membro_id} style={{borderBottom:"1px solid var(--color-border)",transition:"background 0.1s"}}>
                  <td style={{color:"var(--color-text)"}}>
                    <div className="flex items-center gap-2">
                      {irmao.foto_url && (
                        <img
                          src={irmao.foto_url}
                          alt={irmao.nome_completo}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      )}
                      <div>
                        <div style={{fontSize:"0.875rem",fontWeight:"600",color:"var(--color-text)"}}>
                          {irmao.nome_completo}
                        </div>
                        {irmao.esta_licenciado_efetivo && (
                          <span style={{display:"inline-block",marginTop:"0.25rem",padding:"0.1rem 0.5rem",fontSize:"0.7rem",fontWeight:"700",borderRadius:"999px",background:"rgba(245,158,11,0.15)",color:"#f59e0b",border:"1px solid rgba(245,158,11,0.3)"}}>
                            Licenciado
                          </span>
                        )}
                        {irmao.tem_prerrogativa && (
                          <span style={{display:"inline-block",marginTop:"0.25rem",padding:"0.1rem 0.5rem",fontSize:"0.7rem",fontWeight:"700",borderRadius:"999px",background:"rgba(139,92,246,0.15)",color:"#8b5cf6",border:"1px solid rgba(139,92,246,0.3)"}}>
                            Com Prerrogativa
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{color:"var(--color-text)"}}>
                    <span style={{padding:"0.15rem 0.55rem",fontSize:"0.7rem",fontWeight:"700",borderRadius:"999px",background:"rgba(59,130,246,0.15)",color:"#3b82f6",border:"1px solid rgba(59,130,246,0.3)"}}>
                      {irmao.grau_atual}
                    </span>
                  </td>
                  <td style={{color:"var(--color-text)"}}>
                    <label className="inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={presencas[irmao.membro_id] || false}
                        onChange={(e) => handlePresencaChange(irmao.membro_id, e.target.checked)}
                        style={{width:"1.25rem",height:"1.25rem",accentColor:"#10b981",cursor:"pointer"}}
                      />
                      <span style={{marginLeft:"0.5rem",fontSize:"0.875rem",fontWeight:"600",color:"var(--color-text)"}}>
                        {presencas[irmao.membro_id] ? 'Presente' : 'Ausente'}
                      </span>
                    </label>
                  </td>
                  <td style={{color:"var(--color-text)"}}>
                    {!presencas[irmao.membro_id] && (
                      <input
                        type="text"
                        placeholder="Motivo da ausência..."
                        value={justificativas[irmao.membro_id] || ''}
                        onChange={(e) => handleJustificativaChange(irmao.membro_id, e.target.value)}
                        style={{width:"100%",padding:"0.35rem 0.6rem",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-md)",fontSize:"0.875rem",outline:"none"}}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {irmaosFiltrados.length === 0 && (
          <div className="text-center py-8">
  <span style={{color:"var(--color-text-muted)"}}>{busca ? 'Nenhum irmão encontrado com esse nome.' : 'Nenhum irmão elegível para esta sessão.'}</span>
          </div>
        )}
      </div>

      {/* Seção de Visitantes */}
      <div className="rounded-lg p-6 mt-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <h3 className="text-lg font-bold mb-4" style={{color:"var(--color-text)"}}>👥 Visitantes</h3>
        
        {/* Formulário */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <input
            type="text"
            placeholder="Nome do Visitante"
            value={visitanteForm.nome_visitante}
            onChange={(e) => setVisitanteForm({...visitanteForm, nome_visitante: e.target.value})}
            style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-md)",padding:"0.5rem 0.75rem",outline:"none",width:"100%"}}
          />
          <input
            type="text"
            placeholder="Loja"
            value={visitanteForm.nome_loja}
            onChange={(e) => setVisitanteForm({...visitanteForm, nome_loja: e.target.value})}
            style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-md)",padding:"0.5rem 0.75rem",outline:"none",width:"100%"}}
          />
          <input
            type="text"
            placeholder="Cidade"
            value={visitanteForm.cidade}
            onChange={(e) => setVisitanteForm({...visitanteForm, cidade: e.target.value})}
            style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-md)",padding:"0.5rem 0.75rem",outline:"none",width:"100%"}}
          />
          <button
            onClick={adicionarVisitante}
            style={{padding:"0.5rem 1rem",background:"var(--color-accent)",color:"#fff",border:"none",borderRadius:"var(--radius-md)",cursor:"pointer",fontWeight:"600"}}
          >
            ➕ Adicionar
          </button>
        </div>

        {/* Tabela */}
        {visitantes.length > 0 ? (
          <table className="w-full text-sm">
            <thead style={{background:"var(--color-surface-2)"}}>
              <tr style={{borderBottom:"1px solid var(--color-border)"}}>
                <th style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Nome</th>
                <th style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Loja</th>
                <th style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Cidade</th>
                <th style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {visitantes.map((v) => (
                <tr key={v.id} style={{borderBottom:"1px solid var(--color-border)",transition:"background 0.1s"}}>
                  <td style={{color:"var(--color-text)"}}>{v.nome_visitante}</td>
                  <td style={{color:"var(--color-text)"}}>{v.nome_loja}</td>
                  <td style={{color:"var(--color-text)"}}>{v.cidade}</td>
                  <td style={{color:"var(--color-text)"}}>
                    <button
                      onClick={() => excluirVisitante(v.id)}
                      style={{color:"#ef4444",background:"none",border:"none",cursor:"pointer",fontSize:"1rem"}}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{fontSize:"0.875rem",textAlign:"center",padding:"0.75rem",color:"var(--color-text-muted)"}}>Nenhum visitante registrado</p>
        )}
      </div>

      {/* Botão Salvar */}
      <div className="mt-6 flex justify-end gap-4">
        <button
          onClick={onVoltar}
          style={{padding:"0.75rem 1.5rem",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-md)",cursor:"pointer",fontWeight:"600"}}
        >
          Cancelar
        </button>
        <button
          onClick={handleSalvar}
          disabled={salvando}
          style={{padding:'0.75rem 1.5rem',background:salvando?'var(--color-surface-3)':'var(--color-accent)',color:'#fff',border:'none',borderRadius:'var(--radius-md)',cursor:salvando?'not-allowed':'pointer',fontWeight:'700',opacity:salvando?0.6:1}}
        >
          {salvando ? 'Salvando...' : 'Salvar Presenças'}
        </button>
      </div>
    </div>
  );
}
