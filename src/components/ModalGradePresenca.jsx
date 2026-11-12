import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { gerarRelatorioPresencaPDF } from '../utils/gerarRelatorioPresencaPDF';
import { gerarRelatorioIndividualPDF } from '../utils/gerarRelatorioIndividualPDF';

export default function ModalGradePresenca({ onFechar }) {
  const [loading, setLoading] = useState(true);
  const [sessoes, setSessoes] = useState([]);
  const [irmaos, setIrmaos] = useState([]);
  const [historicoSituacoes, setHistoricoSituacoes] = useState([]);
  const [grade, setGrade] = useState({});
  const [busca, setBusca] = useState('');
  const [modalIndividual, setModalIndividual] = useState(false);
  const [periodoInicio, setPeriodoInicio] = useState(`${new Date().getFullYear()}-01-01`);
  const [periodoFim, setPeriodoFim]     = useState(new Date().toISOString().split('T')[0]);
  const [irmaoIndividual, setIrmaoIndividual] = useState(null);
  const [gerandoIndividual, setGerandoIndividual] = useState(false);
  const [anosDisponiveis, setAnosDisponiveis] = useState([]);
  const anoAtual = new Date().getFullYear();
  const [anoSelecionado, setAnoSelecionado] = useState(anoAtual);
  const [mesSelecionado, setMesSelecionado] = useState(0);
  const [dadosLoja, setDadosLoja] = useState(null);

  // Tela cheia: Esc fecha (primeiro o relatório individual, se estiver aberto) e a rolagem do fundo fica travada
  useEffect(() => {
    const aoTeclar = (e) => {
      if (e.key !== 'Escape') return;
      if (modalIndividual) setModalIndividual(false); else onFechar();
    };
    window.addEventListener('keydown', aoTeclar);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = overflowAnterior;
    };
  }, [modalIndividual, onFechar]);

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

  // Busca sessões + presenças do PERÍODO EXATO escolhido no modal (não usa o
  // filtro ano/mês da tela da Matriz — senão o relatório fica restrito ao
  // mesmo recorte da tela, mesmo que o usuário peça um intervalo maior).
  const handleGerarRelatorioIndividual = async () => {
    if (!irmaoIndividual) { alert('Selecione um irmão.'); return; }
    if (!periodoInicio || !periodoFim) { alert('Selecione o período.'); return; }
    if (periodoInicio > periodoFim) { alert('Data início deve ser anterior ao fim.'); return; }

    setGerandoIndividual(true);
    try {
      const { data: sessoesPeriodo } = await supabase
        .from('sessoes_presenca')
        .select('id, data_sessao, grau_sessao_id, graus_sessao:grau_sessao_id(nome), classificacoes_sessao:classificacao_id(nome)')
        .gte('data_sessao', periodoInicio)
        .lte('data_sessao', periodoFim)
        .order('data_sessao');

      const sessaoIds = (sessoesPeriodo || []).map(s => s.id);

      let todosRegistros = [];
      if (sessaoIds.length > 0) {
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
            if (lote.length < tamanhoPagina) continuar = false;
          } else {
            continuar = false;
          }
        }
      }

      const gradePeriodo = {};
      todosRegistros.forEach(reg => {
        if (!gradePeriodo[reg.membro_id]) gradePeriodo[reg.membro_id] = {};
        gradePeriodo[reg.membro_id][reg.sessao_id] = {
          presente: reg.presente,
          justificativa: reg.justificativa
        };
      });

      gerarRelatorioIndividualPDF(
        irmaoIndividual, sessoesPeriodo || [], gradePeriodo, historicoSituacoes,
        dadosLoja, periodoInicio, periodoFim
      );
      setModalIndividual(false);
    } catch (error) {
      console.error('Erro ao gerar relatório individual:', error);
      alert('Erro ao gerar relatório. Tente novamente.');
    } finally {
      setGerandoIndividual(false);
    }
  };

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
        .select('id, data_sessao, grau_sessao_id, graus_sessao:grau_sessao_id(nome), classificacoes_sessao:classificacao_id(nome)')
        .gte('data_sessao', dataInicio)
        .lte('data_sessao', dataFim)
        .order('data_sessao');

      console.log('Sessões:', sessoesData?.length);

      // 2. Buscar histórico de situações - todos os registros com status ativa
      const { data: historicoSituacoesData } = await supabase
        .from('historico_situacoes')
        .select('*')
        .in('status', ['ativa', 'vencida']);

      console.log('🔍 historicoSituacoes carregados:', historicoSituacoesData?.length);
      console.log('🔍 tipos de situacao únicos:', [...new Set(historicoSituacoesData?.map(s => s.tipo_situacao))]);

      // 3. Buscar irmãos ATIVOS (incluir datas de grau e ingresso)
      const { data: irmaosData } = await supabase
        .from('irmaos')
        .select('id, nome, data_nascimento, data_falecimento, data_iniciacao, data_elevacao, data_exaltacao, mestre_instalado, data_ingresso_loja, situacao, status')
        .eq('status', 'ativo')
        .order('nome');

      // Filtrar: remover falecidos de MESES ANTERIORES
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

        // 2. Desligado/Irregular/Suspenso/Excluído/Ex-ofício SEM data de
        // retorno: se TODAS as sessões deste período visível (ano ou mês
        // selecionado na Matrix) já são depois do início da situação, o
        // irmão não tem mais nenhum vínculo relevante aqui e some da lista
        // por completo — igual a um desligado/falecido. Se parte do período
        // for antes da situação, ele continua aparecendo normalmente (com
        // dado real até a data, e "-" dali em diante — tratado célula a
        // célula mais abaixo). Isso é automático a partir da data cadastrada,
        // funciona pra qualquer irmão, em qualquer período.
        const semVinculoNoPeriodo = historicoSituacoesData?.some(sit => {
          if (sit.membro_id !== i.id) return false;
          const tipo = sit.tipo_situacao?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const situacoesQueEncerram = ['desligado', 'desligamento', 'irregular', 'suspenso', 'excluido', 'ex-oficio'];
          const ehEncerramento = situacoesQueEncerram.includes(tipo) || situacoesQueEncerram.some(s => tipo.includes(s));
          if (!ehEncerramento) return false;
          if (sit.data_fim) return false; // já foi regularizado, deve aparecer

          const dataInicioSit = new Date(sit.data_inicio + 'T00:00:00');
          return sessoesData?.every(s => new Date(s.data_sessao + 'T00:00:00') >= dataInicioSit);
        });
        if (semVinculoNoPeriodo) return false;

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

  const MESES_CURTOS = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

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
        <td key={sessaoId} className="border border-gray-300 px-0.5 py-2 text-center bg-gray-100">
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
        <td key={sessaoId} className="border border-gray-300 px-0.5 py-2 text-center bg-gray-100">
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
        <td key={sessaoId} className="border border-gray-300 px-0.5 py-2 text-center bg-gray-100">
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
          <td key={sessaoId} className="border border-gray-300 px-0.5 py-2 text-center bg-gray-100">
            <span className="text-gray-400">-</span>
          </td>
        );
      }
      // Se computa, mostra ausência (✗ vermelho)
      return (
        <td key={sessaoId} className="border border-gray-300 px-0.5 py-2 text-center bg-red-50">
          <span className="text-red-600 text-base font-bold">✗</span>
        </td>
      );
    }

    // Se TEM registro e não computa
    if (!computa) {
      // Se veio (presente), mostra ✓ normal
      if (reg.presente) {
        return (
          <td key={sessaoId} className="border border-gray-300 px-0.5 py-2 text-center bg-green-50">
            <span className="text-green-600 text-base font-bold">✓</span>
          </td>
        );
      }
      // Se ausente (não computa), mostra -
      return (
        <td key={sessaoId} className="border border-gray-300 px-0.5 py-2 text-center bg-gray-100">
          <span className="text-gray-400">-</span>
        </td>
      );
    }

    // Computa normalmente
    if (reg.presente) {
      return (
        <td key={sessaoId} className="border border-gray-300 px-0.5 py-2 text-center bg-green-50">
          <span className="text-green-600 text-base font-bold">✓</span>
        </td>
      );
    }

    if (reg.justificativa) {
      return (
        <td 
          key={sessaoId} 
          className="border border-gray-300 px-0.5 py-2 text-center bg-yellow-50"
          title={reg.justificativa}
        >
          <span className="text-yellow-600 text-base font-bold">J</span>
        </td>
      );
    }

    return (
      <td key={sessaoId} className="border border-gray-300 px-0.5 py-2 text-center bg-red-50">
        <span className="text-red-600 text-base font-bold">✗</span>
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

  // Estilos do cabeçalho (padrão do sistema: campos escuros, ação principal e ação secundária)
  const campoTema = { height: '2.4rem', padding: '0 0.75rem', background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 600 };
  const btnBase = { display: 'inline-flex', alignItems: 'center', gap: '0.45rem', height: '2.4rem', padding: '0 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' };
  const btnPrimario = { ...btnBase, background: 'var(--color-accent)', color: '#fff', border: '1px solid var(--color-accent)' };
  const btnSecundario = { ...btnBase, background: 'transparent', color: 'var(--color-accent)', border: '1px solid var(--color-accent)' };
  const btnFechar = { ...btnBase, padding: 0, width: '2.4rem', justifyContent: 'center', background: 'var(--color-bg)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border-light)', fontSize: '1.3rem', lineHeight: 1 };

  // Cabeçalho resumido: mês (3 letras + quantidade de sessões) e, embaixo, só o dia
  const gruposMesTela = [];
  sessoes.forEach((sess) => {
    const mes = parseInt(sess.data_sessao.split('-')[1], 10);
    const ultimo = gruposMesTela[gruposMesTela.length - 1];
    if (ultimo && ultimo.mes === mes) ultimo.qtd += 1; else gruposMesTela.push({ mes, qtd: 1 });
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'var(--color-bg)' }} role="dialog" aria-modal="true" aria-label="Grade de Presença">

        {/* Cabeçalho compacto (uma linha) */}
        <div style={{ background: 'var(--color-surface)', borderTop: '3px solid var(--color-accent)', borderBottom: '1px solid var(--color-border)', padding: '0.75rem 1.25rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem 1rem' }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, lineHeight: 1.2 }}>Grade de Presença</h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '0.15rem 0 0' }}>
              {sessoes.length} sessões • {irmaos.length} irmãos
            </p>
          </div>

          {/* Filtros de Período */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select
              value={anoSelecionado}
              onChange={(e) => setAnoSelecionado(Number(e.target.value))}
              style={campoTema}
              aria-label="Ano"
            >
              {anosDisponiveis.map(ano => (
                <option key={ano} value={ano}>{ano}</option>
              ))}
            </select>
            <select
              value={mesSelecionado}
              onChange={(e) => setMesSelecionado(Number(e.target.value))}
              style={campoTema}
              aria-label="Período"
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
          </div>

          {/* Campo de Busca */}
          <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: '460px' }}>
            <span aria-hidden="true" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.85rem', pointerEvents: 'none' }}>🔍</span>
            <input
              type="text"
              placeholder="Buscar irmão..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              style={{ ...campoTema, width: '100%', paddingLeft: '2.1rem', paddingRight: busca ? '2rem' : '0.75rem' }}
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca('')}
                aria-label="Limpar busca"
                style={{ position: 'absolute', right: '0.4rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '1.15rem', lineHeight: 1 }}
              >
                ×
              </button>
            )}
          </div>

          {/* Ações */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => {
                const irmaoBusca = busca.trim()
                  ? irmaos.find(i => i.nome.toLowerCase().includes(busca.toLowerCase()))
                  : null;
                setIrmaoIndividual(irmaoBusca || null);
                setModalIndividual(true);
              }}
              style={btnSecundario}
              title="Gerar relatório individual de um irmão"
            >
              👤 Individual
            </button>
            <button
              onClick={() => {
                if (sessoes.length === 0) {
                  alert('Não há sessões para gerar o relatório');
                  return;
                }
                gerarRelatorioPresencaPDF(sessoes, irmaos, grade, historicoSituacoes, anoSelecionado, mesSelecionado, dadosLoja);
              }}
              style={btnPrimario}
              title="Gerar relatório geral em PDF"
            >
              📄 Gerar PDF
            </button>
            <button onClick={onFechar} style={btnFechar} aria-label="Fechar" title="Fechar (Esc)">×</button>
          </div>
        </div>

        {/* Tabela */}
        <div className="flex-1 overflow-auto" style={{ minHeight: 0 }}>
          <table className="w-full border-collapse" style={{fontSize:"clamp(0.7rem,1.8vw,0.75rem)"}}>
            <thead style={{ background: 'var(--color-surface-2)', position: 'sticky', top: 0 }}>
              <tr>
                <th rowSpan={2} style={{ 
                  border: '1px solid var(--color-border)', 
                  padding: '0.75rem 1rem', 
                  textAlign: 'left', 
                  fontWeight: '600', 
                  background: 'var(--color-surface-2)', 
                  position: 'sticky', 
                  left: 0, 
                  zIndex: 20,
                  color: 'var(--color-text)'
                }}>
                  Irmão
                </th>
                <th rowSpan={2} style={{ 
                  border: '1px solid var(--color-border)', 
                  padding: '0.75rem', 
                  textAlign: 'center', 
                  fontWeight: '600', 
                  background: 'var(--color-surface-2)', 
                  position: 'sticky', 
                  left: '105px', 
                  zIndex: 20,
                  color: 'var(--color-text)'
                }}>
                  Grau
                </th>
                {gruposMesTela.map((g, gi) => (
                  <th
                    key={`mes-${g.mes}-${gi}`}
                    colSpan={g.qtd}
                    className={`border border-gray-300 px-1 py-1 text-center ${g.qtd < 2 ? 'text-[10px] leading-tight' : 'whitespace-nowrap'}`}
                    style={{ color: 'var(--color-text)', fontWeight: 700 }}
                  >
                    {MESES_CURTOS[g.mes]} ({g.qtd})
                  </th>
                ))}
                <th rowSpan={2} style={{ border: '1px solid var(--color-border)', padding: '0.5rem', textAlign: 'center', fontWeight: '600', background: 'var(--color-surface-2)', fontSize: '0.75rem', whiteSpace: 'nowrap', color: 'var(--color-text)' }}>
                  Total
                </th>
                <th rowSpan={2} style={{ border: '1px solid var(--color-border)', padding: '0.5rem', textAlign: 'center', fontWeight: '600', background: 'var(--color-surface-2)', fontSize: '0.75rem', color: 'var(--color-text)' }}>
                  %
                </th>
              </tr>
              <tr>
                {sessoes.map(s => {
                  const grauTexto = s.grau_sessao_id === 1 ? 'A' : 
                                   s.grau_sessao_id === 2 ? 'C' : 
                                   s.grau_sessao_id === 3 ? 'M' :
                                   s.grau_sessao_id === 4 ? 'ADM' : 'A';
                  return (
                    <th key={s.id} className="border border-gray-300 px-0.5 py-1 text-center whitespace-nowrap">
                      <div>{s.data_sessao.split('-')[2]}</div>
                      <div className="text-[10px] font-semibold text-blue-600 leading-none mt-0.5">{grauTexto}</div>
                    </th>
                  );
                })}
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
                  // Faixa de cor das colunas Total e %: tons translúcidos que funcionam nos dois temas.
                  // Sem nenhuma sessão contada (ex.: licença/prerrogativa o período todo) fica neutro.
                  const tomFaixa = sessoesElegiveis === 0
                    ? 'var(--color-surface-2)'
                    : percentual >= 75 ? 'rgba(16,185,129,0.22)'
                    : percentual >= 50 ? 'rgba(245,158,11,0.22)'
                    : 'rgba(239,68,68,0.22)';
                  
                  return (
                <tr key={irmao.id} className="hover:bg-gray-50">
                  <td style={{ 
                    border: '1px solid var(--color-border)', 
                    padding: '0.75rem 1rem', 
                    fontWeight: '500',
                    background: 'var(--color-surface)',
                    position: 'sticky',
                    left: 0,
                    zIndex: 10,
                    color: 'var(--color-text)'
                  }}>
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
                  <td style={{
                    border: '1px solid var(--color-border)',
                    padding: '0.75rem',
                    textAlign: 'center',
                    background: 'var(--color-surface)',
                    position: 'sticky',
                    left: '105px',
                    zIndex: 10,
                    color: 'var(--color-text)'
                  }}>
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
                  <td style={{ border: '1px solid var(--color-border)', padding: '0.5rem', textAlign: 'center', fontWeight: '700', background: tomFaixa, fontSize: '0.75rem', color: 'var(--color-text)' }}>
                    {presencasIrmao}/{sessoesElegiveis}
                    {temPrerrogativa && (
                      <div className="text-[10px] mt-0.5" style={{ color: '#8b5cf6', fontWeight: 700 }}>
                        +{presencasPrerrogativa}/{sessoesPrerrogativa}
                      </div>
                    )}
                  </td>
                  <td style={{ 
                    border: '1px solid var(--color-border)', 
                    padding: '0.5rem', 
                    textAlign: 'center', 
                    fontWeight: '600', 
                    fontSize: '0.75rem',
                    backgroundColor: tomFaixa,
                    color: 'var(--color-text)'
                  }}>
                    {sessoesElegiveis > 0 ? `${percentual}%` : '-'}
                    {temPrerrogativa && (
                      <div className="text-[10px] mt-0.5" style={{ color: '#8b5cf6', fontWeight: 700 }}>
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

        {/* Rodapé: legenda */}
        <div style={{ background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', padding: '0.6rem 1.25rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem 1.25rem', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
          <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>Legenda</span>
          <span><strong style={{ color: '#16a34a', fontSize: '0.95rem' }}>✓</strong> Presente</span>
          <span><strong style={{ color: '#dc2626', fontSize: '0.95rem' }}>✗</strong> Falta</span>
          <span><strong style={{ color: '#ca8a04', fontSize: '0.95rem' }}>J</strong> Falta justificada</span>
          <span><strong style={{ color: 'var(--color-text)', fontSize: '0.95rem' }}>–</strong> Não conta (licença, prerrogativa, afastamento, antes do ingresso ou sessão de grau acima do irmão)</span>
          <span><strong style={{ color: '#8b5cf6' }}>+n/N</strong> Presenças em sessões dentro da prerrogativa (informativo)</span>
          <span style={{ marginLeft: 'auto' }}>Letra abaixo do dia = grau da sessão: <strong>A</strong> Aprendiz · <strong>C</strong> Companheiro · <strong>M</strong> Mestre · <strong>ADM</strong> Administrativa</span>
        </div>

      {/* ── Modal Relatório Individual ── */}
      {modalIndividual && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:'1rem'}}>
          <div style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-xl)',width:'100%',maxWidth:'460px',overflow:'hidden',boxShadow:'0 24px 64px rgba(0,0,0,0.4)'}}>
            <div style={{background:'#6366f1',padding:'1rem 1.5rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <h3 style={{color:'#fff',fontWeight:'800',margin:0,fontSize:'1.05rem'}}>📄 Relatório Individual</h3>
                <p style={{color:'rgba(255,255,255,0.8)',margin:'0.2rem 0 0',fontSize:'0.78rem'}}>Selecione o irmão e o período</p>
              </div>
              <button onClick={() => setModalIndividual(false)} style={{background:'rgba(255,255,255,0.15)',border:'none',color:'#fff',borderRadius:'50%',width:'2rem',height:'2rem',cursor:'pointer',fontWeight:'700',fontSize:'1.1rem'}}>×</button>
            </div>
            <div style={{padding:'1.25rem',display:'flex',flexDirection:'column',gap:'0.75rem'}}>
              <div>
                <label style={{display:'block',fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',marginBottom:'0.3rem'}}>Irmão *</label>
                <select
                  value={irmaoIndividual?.id || ''}
                  onChange={e => setIrmaoIndividual(irmaos.find(i => String(i.id) === e.target.value) || null)}
                  style={{background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',padding:'0.5rem 0.75rem',fontSize:'0.875rem',width:'100%'}}
                >
                  <option value="">-- Selecionar irmão --</option>
                  {[...irmaos].sort((a,b) => a.nome.localeCompare(b.nome)).map(i => (
                    <option key={i.id} value={i.id}>{i.nome}</option>
                  ))}
                </select>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
                <div>
                  <label style={{display:'block',fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',marginBottom:'0.3rem'}}>Data Início *</label>
                  <input type="date" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)}
                    style={{background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',padding:'0.5rem 0.75rem',fontSize:'0.875rem',width:'100%'}} />
                </div>
                <div>
                  <label style={{display:'block',fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',marginBottom:'0.3rem'}}>Data Fim *</label>
                  <input type="date" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)}
                    style={{background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',padding:'0.5rem 0.75rem',fontSize:'0.875rem',width:'100%'}} />
                </div>
              </div>
              {irmaoIndividual && (
                <div style={{background:'rgba(99,102,241,0.1)',border:'1px solid rgba(99,102,241,0.3)',borderRadius:'var(--radius-md)',padding:'0.6rem 0.75rem',fontSize:'0.8rem',color:'#6366f1',fontWeight:'600'}}>
                  {irmaoIndividual.nome}{irmaoIndividual.cim ? ` — CIM: ${irmaoIndividual.cim}` : ''}
                </div>
              )}
            </div>
            <div style={{padding:'1rem 1.25rem',borderTop:'1px solid var(--color-border)',display:'flex',gap:'0.5rem'}}>
              <button onClick={() => setModalIndividual(false)}
                style={{flex:1,padding:'0.6rem',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-lg)',fontWeight:'600',cursor:'pointer'}}>
                Cancelar
              </button>
              <button
                onClick={handleGerarRelatorioIndividual}
                disabled={gerandoIndividual}
                style={{flex:2,padding:'0.6rem',background:'#6366f1',color:'#fff',border:'none',borderRadius:'var(--radius-lg)',fontWeight:'700',cursor:gerandoIndividual?'wait':'pointer',opacity:gerandoIndividual?0.7:1}}>
                {gerandoIndividual ? '⏳ Gerando...' : '📄 Gerar Relatório'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
