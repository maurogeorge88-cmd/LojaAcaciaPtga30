import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { gerarRelatorioPresencaPDF } from '../utils/gerarRelatorioPresencaPDF';

export default function ModalGradePresenca({ onFechar }) {
  const [loading, setLoading] = useState(true);
  const [sessoes, setSessoes] = useState([]);
  const [irmaos, setIrmaos] = useState([]);
  const [historicoSituacoes, setHistoricoSituacoes] = useState([]);
  const [grade, setGrade] = useState({});
  const [busca, setBusca] = useState('');
  const [anosDisponiveis, setAnosDisponiveis] = useState([]);
  const anoAtual = new Date().getFullYear();
  const [anoSelecionado, setAnoSelecionado] = useState(anoAtual);
  const [mesSelecionado, setMesSelecionado] = useState(0);
  const [dadosLoja, setDadosLoja] = useState(null);

  // Buscar anos disponíveis e dados da loja
  useEffect(() => {
    const buscarAnos = async () => {
      const { data } = await supabase
        .from('sessoes_presenca')
        .select('data_sessao');
      
      if (data && data.length > 0) {
        const anos = [...new Set(data.map(s => new Date(s.data_sessao).getFullYear()))];
        const anosSorted = anos.sort((a, b) => b - a);
        setAnosDisponiveis(anosSorted);
        
        // Definir ano mais recente como padrão
        setAnoSelecionado(anosSorted[0]);
      }
    };
    
    const buscarDadosLoja = async () => {
      const { data } = await supabase
        .from('dados_loja')
        .select('*')
        .single();
      
      if (data) {
        setDadosLoja(data);
      }
    };
    
    buscarAnos();
    buscarDadosLoja();
  }, []);

  useEffect(() => {
    if (anosDisponiveis.length > 0) {
      carregar();
    }
  }, [anoSelecionado, mesSelecionado, anosDisponiveis]);

  const carregar = async () => {
    try {
      setLoading(true);

      // Calcular período baseado em ano e mês
      let dataInicio, dataFim;
      if (mesSelecionado === 0) {
        // Ano inteiro
        dataInicio = `${anoSelecionado}-01-01`;
        dataFim = `${anoSelecionado}-12-31`;
      } else if (mesSelecionado === -1) {
        // 1º Semestre (Janeiro a Junho)
        dataInicio = `${anoSelecionado}-01-01`;
        dataFim = `${anoSelecionado}-06-30`;
      } else if (mesSelecionado === -2) {
        // 2º Semestre (Julho a Dezembro)
        dataInicio = `${anoSelecionado}-07-01`;
        dataFim = `${anoSelecionado}-12-31`;
      } else {
        // Mês específico
        const ultimoDia = new Date(anoSelecionado, mesSelecionado, 0).getDate();
        dataInicio = `${anoSelecionado}-${String(mesSelecionado).padStart(2, '0')}-01`;
        dataFim = `${anoSelecionado}-${String(mesSelecionado).padStart(2, '0')}-${ultimoDia}`;
      }

      // IMPORTANTE: Não incluir sessões futuras
      const hoje = new Date();
      const dataHoje = hoje.toISOString().split('T')[0];
      if (dataFim > dataHoje) {
        dataFim = dataHoje;
      }

      // 1. Buscar sessões do período
      const { data: sessoesData } = await supabase
        .from('sessoes_presenca')
        .select('id, data_sessao, grau_sessao_id')
        .gte('data_sessao', dataInicio)
        .lte('data_sessao', dataFim)
        .order('data_sessao');

      console.log('Sessões:', sessoesData?.length);

      // 2. Buscar histórico de situações - todos os registros com status ativa
      const { data: historicoSituacoesData } = await supabase
        .from('historico_situacoes')
        .select('*')
        .eq('status', 'ativa');

      console.log('🔍 historicoSituacoes carregados:', historicoSituacoesData?.length);
      console.log('🔍 tipos de situacao únicos:', [...new Set(historicoSituacoesData?.map(s => s.tipo_situacao))]);

      // 3. Buscar irmãos ATIVOS (incluir datas de grau e ingresso)
      const { data: irmaosData } = await supabase
        .from('irmaos')
        .select('id, nome, data_nascimento, data_falecimento, data_iniciacao, data_elevacao, data_exaltacao, mestre_instalado, data_ingresso_loja, situacao, status')
        .eq('status', 'ativo')
        .order('nome');

      // Filtrar: remover falecidos de MESES ANTERIORES e desligados
      const mesAtual = hoje.getMonth();
      const anoAtual = hoje.getFullYear();

      const irmaosValidos = irmaosData.filter(i => {
        // 1. Remover falecidos de meses anteriores
        if (i.data_falecimento) {
          const dataFalec = new Date(i.data_falecimento);
          if (dataFalec.getFullYear() < anoAtual || 
             (dataFalec.getFullYear() === anoAtual && dataFalec.getMonth() < mesAtual)) {
            return false;
          }
        }
        
        // 2. Verificar se tem situação bloqueadora ATIVA HOJE
        // (irregular, desligado desde data anterior ao mês atual)
        const temSituacaoBloqueadoraAtual = historicoSituacoesData?.some(sit => {
          if (sit.membro_id !== i.id) return false;
          
          const tipoSituacao = sit.tipo_situacao?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const situacoesQueExcluem = ['desligado', 'desligamento', 'irregular', 'suspenso', 'excluido', 'ex-oficio'];
          
          if (!situacoesQueExcluem.includes(tipoSituacao)) return false;
          
          const dataInicio = new Date(sit.data_inicio + 'T00:00:00');
          const dataInicioMes = new Date(anoAtual, mesAtual, 1);
          
          // Se desligou/ficou irregular ANTES do início do mês atual, excluir da lista
          if (dataInicio < dataInicioMes) {
            // Se tem data_fim e já passou, não bloqueia
            if (sit.data_fim) {
              const dataFim = new Date(sit.data_fim + 'T00:00:00');
              return dataFim >= dataInicioMes; // Ainda está bloqueado
            }
            return true; // Sem data_fim, está bloqueado
          }
          
          return false;
        });
        
        if (temSituacaoBloqueadoraAtual) return false;
        
        return true;
      });

      // Adicionar flags de prerrogativa
      const irmaosComFlags = irmaosValidos.map(i => {
        let idade = null;
        let dataPrerrogativa = null;
        
        if (i.data_nascimento) {
          const nasc = new Date(i.data_nascimento);
          const hoje = new Date();
          idade = hoje.getFullYear() - nasc.getFullYear();
          if (hoje.getMonth() < nasc.getMonth() || 
             (hoje.getMonth() === nasc.getMonth() && hoje.getDate() < nasc.getDate())) {
            idade--;
          }
          
          if (idade >= 70) {
            dataPrerrogativa = new Date(nasc);
            dataPrerrogativa.setFullYear(nasc.getFullYear() + 70);
          }
        }
        
        return {
          ...i,
          idade,
          data_prerrogativa: dataPrerrogativa
        };
      });

      // 3. Buscar TODOS os registros em lotes (paginação)
      const sessaoIds = sessoesData?.map(s => s.id) || [];
      
      let todosRegistros = [];
      let inicio = 0;
      const tamanhoPagina = 1000;
      let continuar = true;

      while (continuar) {
        const { data: lote } = await supabase
          .from('registros_presenca')
          .select('membro_id, sessao_id, presente, justificativa')
          .in('sessao_id', sessaoIds)
          .range(inicio, inicio + tamanhoPagina - 1);

        if (lote && lote.length > 0) {
          todosRegistros = [...todosRegistros, ...lote];
          inicio += tamanhoPagina;
          
          // Se retornou menos que o tamanho da página, acabou
          if (lote.length < tamanhoPagina) {
            continuar = false;
          }
        } else {
          continuar = false;
        }
      }

      console.log('📊 Registros carregados:', todosRegistros.length);

      // Criar grade agrupando por irmão
      const gradeCompleta = {};
      todosRegistros.forEach(reg => {
        if (!gradeCompleta[reg.membro_id]) {
          gradeCompleta[reg.membro_id] = {};
        }
        gradeCompleta[reg.membro_id][reg.sessao_id] = {
          presente: reg.presente,
          justificativa: reg.justificativa
        };
      });

      console.log('Grade montada');

      setSessoes(sessoesData || []);
      setIrmaos(irmaosComFlags || []);
      setHistoricoSituacoes(historicoSituacoesData || []);
      setGrade(gradeCompleta);

    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatarData = (data) => {
    return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit' 
    });
  };

  const renderizarCelula = (irmaoId, sessaoId) => {
    const reg = grade[irmaoId]?.[sessaoId];
    const irmao = irmaos.find(i => i.id === irmaoId);
    const sessao = sessoes.find(s => s.id === sessaoId);
    
    if (!irmao || !sessao) {
      return (
        <td key={sessaoId} className="border border-gray-300 px-2 py-2 text-center bg-gray-100">
          <span className="text-gray-400">-</span>
        </td>
      );
    }

    const dataSessao = new Date(sessao.data_sessao + 'T00:00:00');
    
    // 1. Verificar data de início na LOJA
    // PRIORIDADE: data_ingresso_loja (se existir) > data_iniciacao
    // Porque ingresso indica quando começou nesta loja (pode ser transferência/retorno)
    const dataIngresso = irmao.data_ingresso_loja ? new Date(irmao.data_ingresso_loja) : null;
    const dataIniciacao = irmao.data_iniciacao ? new Date(irmao.data_iniciacao) : null;
    const dataInicio = dataIngresso || dataIniciacao;
    
    if (dataInicio && dataSessao < dataInicio) {
      // Sessão antes de ingressar na loja → não se aplica
      return (
        <td key={sessaoId} className="border border-gray-300 px-2 py-2 text-center bg-gray-100">
          <span className="text-gray-400">-</span>
        </td>
      );
    }

    // 2. Calcular grau do irmão NA DATA DA SESSÃO
    let grauIrmao = 0;
    
    // Verificar exaltação
    if (irmao.data_exaltacao) {
      const dataExaltacao = new Date(irmao.data_exaltacao);
      if (dataSessao >= dataExaltacao) {
        grauIrmao = 3;
      }
    }
    
    // Se ainda não foi definido, verificar elevação
    if (grauIrmao === 0 && irmao.data_elevacao) {
      const dataElevacao = new Date(irmao.data_elevacao);
      if (dataSessao >= dataElevacao) {
        grauIrmao = 2;
      }
    }
    
    // Se ainda não foi definido, verificar iniciação
    if (grauIrmao === 0 && irmao.data_iniciacao) {
      const dataIniciacao = new Date(irmao.data_iniciacao);
      if (dataSessao >= dataIniciacao) {
        grauIrmao = 1;
      }
    }

    // 3. Verificar grau da sessão
    let grauSessao = sessao.grau_sessao_id || 1;
    
    // Sessão Administrativa (grau 4) deve ser tratada como Aprendiz (grau 1)
    if (grauSessao === 4) grauSessao = 1;

    // 4. Se sessão é de grau superior ao do irmão NA DATA DA SESSÃO → não pode participar
    if (grauSessao > grauIrmao) {
      return (
        <td key={sessaoId} className="border border-gray-300 px-2 py-2 text-center bg-gray-100">
          <span className="text-gray-400">-</span>
        </td>
      );
    }

    // 5. Verificar se computa (prerrogativa/situação ativa/falecimento)
    let computa = true;
    
    if (irmao.data_prerrogativa) {
      const dataPrer = new Date(irmao.data_prerrogativa);
      if (dataSessao >= dataPrer) computa = false;
    }
    
    // Verificar situação bloqueadora na data da sessão
    const situacaoBloqueadora = historicoSituacoes?.find(sit => {
      if (sit.membro_id !== irmao.id) return false;
      
      const tipoSituacao = sit.tipo_situacao?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '';
      const situacoesQueExcluem = ['desligado', 'desligamento', 'irregular', 'suspenso', 'excluido', 'ex-oficio', 'licenca'];
      
      const ehBloqueadora = situacoesQueExcluem.includes(tipoSituacao) ||
        situacoesQueExcluem.some(s => tipoSituacao.includes(s));
      
      if (!ehBloqueadora) return false;
      
      const dataInicio = new Date(sit.data_inicio + 'T00:00:00');
      
      console.log(`🔎 ${irmao.nome} | sessão: ${dataSessao.toLocaleDateString('pt-BR')} | situação: ${tipoSituacao} | início: ${dataInicio.toLocaleDateString('pt-BR')} | bloqueia: ${dataSessao >= dataInicio}`);
      
      if (dataSessao < dataInicio) return false;
      
      if (sit.data_fim) {
        const dataFim = new Date(sit.data_fim + 'T00:00:00');
        return dataSessao >= dataInicio && dataSessao <= dataFim;
      }
      
      return dataSessao >= dataInicio;
    });
    
    if (situacaoBloqueadora) computa = false;
    
    if (irmao.data_falecimento) {
      const dataFalec = new Date(irmao.data_falecimento + 'T00:00:00');
      if (dataSessao > dataFalec) computa = false;
    }

    // Se NÃO TEM registro
    if (!reg) {
      // Se não computa, mostra - (sem obrigação)
      if (!computa) {
        return (
          <td key={sessaoId} className="border border-gray-300 px-2 py-2 text-center bg-gray-100">
            <span className="text-gray-400">-</span>
          </td>
        );
      }
      // Se computa, mostra ausência (✗ vermelho)
      return (
        <td key={sessaoId} className="border border-gray-300 px-2 py-2 text-center bg-red-50">
          <span className="text-red-600 text-lg font-bold">✗</span>
        </td>
      );
    }

    // Se TEM registro e não computa
    if (!computa) {
      // Se veio (presente), mostra ✓ normal
      if (reg.presente) {
        return (
          <td key={sessaoId} className="border border-gray-300 px-2 py-2 text-center bg-green-50">
            <span className="text-green-600 text-lg font-bold">✓</span>
          </td>
        );
      }
      // Se ausente (não computa), mostra -
      return (
        <td key={sessaoId} className="border border-gray-300 px-2 py-2 text-center bg-gray-100">
          <span className="text-gray-400">-</span>
        </td>
      );
    }

    // Computa normalmente
    if (reg.presente) {
      return (
        <td key={sessaoId} className="border border-gray-300 px-2 py-2 text-center bg-green-50">
          <span className="text-green-600 text-lg font-bold">✓</span>
        </td>
      );
    }

    if (reg.justificativa) {
      return (
        <td 
          key={sessaoId} 
          className="border border-gray-300 px-2 py-2 text-center bg-yellow-50"
          title={reg.justificativa}
        >
          <span className="text-yellow-600 text-lg font-bold">J</span>
        </td>
      );
    }

    return (
      <td key={sessaoId} className="border border-gray-300 px-2 py-2 text-center bg-red-50">
        <span className="text-red-600 text-lg font-bold">✗</span>
      </td>
    );
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-lg">
          <div className="text-center">Carregando grade...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full h-[90vh] max-w-[95vw] flex flex-col">
        
        {/* Cabeçalho */}
        <div className="bg-blue-600 text-white p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-2xl font-bold">Grade de Presença</h2>
              <p className="text-sm text-blue-100 mt-1">
                {sessoes.length} sessões • {irmaos.length} irmãos
              </p>
            </div>
            <button
              onClick={onFechar}
              className="hover:bg-blue-700 rounded-full p-2 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Filtros de Período */}
          <div className="flex gap-3 mb-4">
            <select
              value={anoSelecionado}
              onChange={(e) => setAnoSelecionado(Number(e.target.value))}
              className="px-4 py-2 rounded text-gray-800 font-semibold"
            >
              {anosDisponiveis.map(ano => (
                <option key={ano} value={ano}>{ano}</option>
              ))}
            </select>
            <select
              value={mesSelecionado}
              onChange={(e) => setMesSelecionado(Number(e.target.value))}
              className="px-4 py-2 rounded text-gray-800 font-semibold"
            >
              <option value={0}>Ano todo</option>
              <option value={-1}>1º Semestre</option>
              <option value={-2}>2º Semestre</option>
              <option value={1}>Janeiro</option>
              <option value={2}>Fevereiro</option>
              <option value={3}>Março</option>
              <option value={4}>Abril</option>
              <option value={5}>Maio</option>
              <option value={6}>Junho</option>
              <option value={7}>Julho</option>
              <option value={8}>Agosto</option>
              <option value={9}>Setembro</option>
              <option value={10}>Outubro</option>
              <option value={11}>Novembro</option>
              <option value={12}>Dezembro</option>
            </select>
            
            {/* Botão Gerar PDF */}
            <button
              onClick={() => {
                if (sessoes.length === 0) {
                  alert('Não há sessões para gerar o relatório');
                  return;
                }
                gerarRelatorioPresencaPDF(sessoes, irmaos, grade, historicoSituacoes, anoSelecionado, mesSelecionado, dadosLoja);
              }}
              className="ml-auto px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-semibold flex items-center gap-2 transition"
              title="Gerar relatório em PDF"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Gerar PDF
            </button>
          </div>

          {/* Campo de Busca */}
          <input
            type="text"
            placeholder="🔍 Buscar irmão..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full px-4 py-2 rounded text-gray-800 placeholder-gray-500"
          />
        </div>

        {/* Tabela */}
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-xs">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="border border-gray-300 px-4 py-3 text-left font-semibold bg-gray-100 sticky left-0 z-20">
                  Irmão
                </th>
                <th className="border border-gray-300 px-3 py-3 text-center font-semibold bg-gray-100 sticky left-[105px] z-20">
                  Grau
                </th>
                {sessoes.map(s => {
                  const grauTexto = s.grau_sessao_id === 1 ? 'A' : 
                                   s.grau_sessao_id === 2 ? 'C' : 
                                   s.grau_sessao_id === 3 ? 'M' :
                                   s.grau_sessao_id === 4 ? 'ADM' : 'A';
                  return (
                    <th key={s.id} className="border border-gray-300 px-2 py-2 text-center whitespace-nowrap">
                      <div>{formatarData(s.data_sessao)}</div>
                      <div className="text-xs font-semibold text-blue-600 mt-0.5">{grauTexto}</div>
                    </th>
                  );
                })}
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold bg-blue-50 text-xs whitespace-nowrap">
                  Total
                </th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold bg-blue-50 text-xs">
                  %
                </th>
              </tr>
            </thead>
            <tbody>
              {irmaos
                .filter(irmao => 
                  busca === '' || irmao.nome.toLowerCase().includes(busca.toLowerCase())
                )
                .map(irmao => {
                  // Calcular presenças e sessões elegíveis usando a mesma lógica do renderizarCelula
                  let presencasIrmao = 0;
                  let sessoesElegiveis = 0;
                  let presencasPrerrogativa = 0; // Informativo
                  let sessoesPrerrogativa = 0; // Informativo
                  
                  sessoes.forEach(sessao => {
                    const reg = grade[irmao.id]?.[sessao.id];
                    const dataSessao = new Date(sessao.data_sessao + 'T00:00:00');
                    
                    // 1. Verificar data de início
                    const dataIngresso = irmao.data_ingresso_loja ? new Date(irmao.data_ingresso_loja) : null;
                    const dataIniciacao = irmao.data_iniciacao ? new Date(irmao.data_iniciacao) : null;
                    const dataInicio = dataIngresso || dataIniciacao;
                    if (dataInicio && dataSessao < dataInicio) return;
                    
                    // 2. Calcular grau do irmão NA DATA DA SESSÃO
                    let grauIrmao = 0;
                    
                    // Verificar exaltação
                    if (irmao.data_exaltacao) {
                      const dataExaltacao = new Date(irmao.data_exaltacao);
                      if (dataSessao >= dataExaltacao) {
                        grauIrmao = 3;
                      }
                    }
                    
                    // Se ainda não foi definido, verificar elevação
                    if (grauIrmao === 0 && irmao.data_elevacao) {
                      const dataElevacao = new Date(irmao.data_elevacao);
                      if (dataSessao >= dataElevacao) {
                        grauIrmao = 2;
                      }
                    }
                    
                    // Se ainda não foi definido, verificar iniciação
                    if (grauIrmao === 0 && irmao.data_iniciacao) {
                      const dataIniciacao = new Date(irmao.data_iniciacao);
                      if (dataSessao >= dataIniciacao) {
                        grauIrmao = 1;
                      }
                    }
                    
                    // 3. Verificar grau da sessão
                    let grauSessao = sessao.grau_sessao_id || 1;
                    
                    // Sessão Administrativa (grau 4) deve ser tratada como Aprendiz (grau 1)
                    if (grauSessao === 4) grauSessao = 1;
                    
                    if (grauSessao > grauIrmao) return;
                    
                    // 4. Verificar se computa
                    let computa = true;
                    let ehPrerrogativa = false;
                    
                    if (irmao.data_prerrogativa) {
                      const dataPrer = new Date(irmao.data_prerrogativa);
                      if (dataSessao >= dataPrer) {
                        computa = false;
                        ehPrerrogativa = true;
                      }
                    }
                    
                    const situacaoBloqueadora = historicoSituacoes?.find(sit => {
                      if (sit.membro_id !== irmao.id) return false;
                      const tipoSituacao = sit.tipo_situacao?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '';
                      const situacoesQueExcluem = ['desligado', 'desligamento', 'irregular', 'suspenso', 'excluido', 'ex-oficio'];
                      const ehBloqueadora = situacoesQueExcluem.includes(tipoSituacao) ||
                        situacoesQueExcluem.some(s => tipoSituacao.includes(s));
                      if (!ehBloqueadora) return false;
                      const dataInicio = new Date(sit.data_inicio + 'T00:00:00');
                      if (dataSessao < dataInicio) return false;
                      if (sit.data_fim) {
                        const dataFim = new Date(sit.data_fim + 'T00:00:00');
                        return dataSessao >= dataInicio && dataSessao <= dataFim;
                      }
                      return dataSessao >= dataInicio;
                    });
                    if (situacaoBloqueadora) computa = false;
                    
                    if (irmao.data_falecimento) {
                      const dataFalec = new Date(irmao.data_falecimento);
                      if (dataSessao >= dataFalec) computa = false;
                    }
                    
                    // Contar prerrogativa separadamente (informativo)
                    if (ehPrerrogativa) {
                      sessoesPrerrogativa++;
                      if (reg?.presente) presencasPrerrogativa++;
                      return;
                    }
                    
                    if (!computa) return;
                    
                    // É elegível
                    sessoesElegiveis++;
                    if (reg?.presente) presencasIrmao++;
                  });
                  
                  const percentual = sessoesElegiveis > 0 ? Math.round((presencasIrmao / sessoesElegiveis) * 100) : 0;
                  const percentualPrerrogativa = sessoesPrerrogativa > 0 ? Math.round((presencasPrerrogativa / sessoesPrerrogativa) * 100) : 0;
                  const temPrerrogativa = sessoesPrerrogativa > 0;
                  
                  return (
                <tr key={irmao.id} className="hover:bg-gray-50">
                  <td className="border border-gray-300 px-4 py-3 font-medium bg-white sticky left-0 z-10">
                    <div>{irmao.nome.split(' ').slice(0, 2).join(' ')}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(() => {
                        // Verificar se tem licença ativa no histórico
                        const hoje = new Date();
                        const temLicencaAtiva = historicoSituacoes?.some(sit => {
                          if (sit.membro_id !== irmao.id) return false;
                          const tipo = sit.tipo_situacao?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                          if (tipo !== 'licenca') return false;
                          
                          const dataInicio = new Date(sit.data_inicio);
                          if (dataInicio > hoje) return false;
                          
                          if (sit.data_fim === null) return true;
                          
                          const dataFim = new Date(sit.data_fim);
                          return dataFim >= hoje;
                        });
                        
                        return temLicencaAtiva && (
                          <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded">
                            Licenciado
                          </span>
                        );
                      })()}
                      {irmao.idade >= 70 && (
                        <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                          ≥70
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="border border-gray-300 px-3 py-3 text-center bg-white sticky left-[105px] z-10">
                    <span className={`text-xs px-2 py-1 rounded font-semibold ${
                      irmao.data_exaltacao 
                        ? (irmao.mestre_instalado ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800')
                        : irmao.data_elevacao 
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {irmao.data_exaltacao 
                        ? (irmao.mestre_instalado ? 'M.Inst.' : 'Mestre')
                        : irmao.data_elevacao 
                        ? 'Comp.'
                        : 'Aprend.'}
                    </span>
                  </td>
                  {sessoes.map(sessao => renderizarCelula(irmao.id, sessao.id))}
                  <td className="border border-gray-300 px-2 py-2 text-center font-semibold bg-blue-50 text-xs">
                    {presencasIrmao}/{sessoesElegiveis}
                    {temPrerrogativa && (
                      <div className="text-purple-600 text-[10px] mt-0.5">
                        +{presencasPrerrogativa}/{sessoesPrerrogativa}
                      </div>
                    )}
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-center font-semibold text-xs" 
                      style={{ backgroundColor: percentual >= 75 ? '#dcfce7' : percentual >= 50 ? '#fef9c3' : '#fee2e2' }}>
                    {percentual}%
                    {temPrerrogativa && (
                      <div className="text-purple-600 text-[10px] mt-0.5">
                        +{percentualPrerrogativa}%
                      </div>
                    )}
                  </td>
                </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Rodapé */}
        <div className="bg-gray-50 px-6 py-4 border-t">
          <button
            onClick={onFechar}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
