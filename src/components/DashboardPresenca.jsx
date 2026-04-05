import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import ModalGradePresenca from './ModalGradePresenca';

export default function DashboardPresenca() {
  const [dados, setDados] = useState({ sessoes: 0, irmaos: 0, registros: 0 });

  const calcularIdade = (dataNascimento) => {
    const nasc = new Date(dataNascimento);
    const hoje = new Date();
    let idade = hoje.getFullYear() - nasc.getFullYear();
    if (hoje.getMonth() < nasc.getMonth() || 
       (hoje.getMonth() === nasc.getMonth() && hoje.getDate() < nasc.getDate())) {
      idade--;
    }
    return idade;
  };

  const formatarNome = (nomeCompleto) => {
    const partes = nomeCompleto.split(' ');
    if (partes.length <= 2) return nomeCompleto;
    
    const segundoNome = partes[1]?.toLowerCase();
    if (['de', 'da', 'do', 'dos', 'das'].includes(segundoNome)) {
      return partes.slice(0, 3).join(' ');
    }
    
    return `${partes[0]} ${partes[partes.length - 1]}`;
  };
  const [resumo, setResumo] = useState([]);
  const [resumoAno, setResumoAno] = useState([]);
  const [mostrarGrade, setMostrarGrade] = useState(false);
  const [periodo, setPeriodo] = useState('ano');
  const [percentualAlerta, setPercentualAlerta] = useState(30);
  const anoAtual = new Date().getFullYear();
  const [anoPresenca100, setAnoPresenca100] = useState(anoAtual);
  const [resumoPrerrogativa, setResumoPrerrogativa] = useState([]);
  const [resumoLicenciados, setResumoLicenciados] = useState([]);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [anoAusencias, setAnoAusencias] = useState(anoAtual);
  const [mesAusencias, setMesAusencias] = useState(0);
  const [anoPrerrogativa, setAnoPrerrogativa] = useState(anoAtual);
  const [anoLicenciados, setAnoLicenciados] = useState(anoAtual);
  const [qtdSessoesRecentes, setQtdSessoesRecentes] = useState(4);
  const [sessoesRecentes, setSessoesRecentes] = useState([]);
  const [anosDisponiveis, setAnosDisponiveis] = useState([]);
  const [anoSelecionado, setAnoSelecionado] = useState(null); // Inicia null, define depois de buscar

  // Buscar anos disponíveis na base
  useEffect(() => {
    const buscarAnos = async () => {
      console.log('🔍 Buscando anos disponíveis...');
      const { data } = await supabase
        .from('sessoes_presenca')
        .select('data_sessao')
        .order('data_sessao', { ascending: true });
      
      if (data && data.length > 0) {
        const anos = [...new Set(data.map(s => new Date(s.data_sessao).getFullYear()))];
        const anosSorted = anos.sort((a, b) => b - a); // Mais recente primeiro
        console.log('📅 Anos encontrados:', anosSorted);
        setAnosDisponiveis(anosSorted);
        
        // Definir ano mais recente como padrão
        const anoMaisRecente = anosSorted[0];
        console.log('✅ Definindo ano mais recente:', anoMaisRecente);
        setAnoSelecionado(anoMaisRecente);
        setAnoPresenca100(anoMaisRecente);
        setAnoAusencias(anoMaisRecente);
        setAnoPrerrogativa(anoMaisRecente);
        setAnoLicenciados(anoMaisRecente);
        setPeriodo('ano'); // Definir período como 'ano'
      }
    };
    buscarAnos();
  }, []);

  useEffect(() => {
    // Quando ano selecionado mudar, atualizar datas
    if (anoSelecionado) {
      console.log('📆 Atualizando datas para ano:', anoSelecionado);
      setDataInicio(`${anoSelecionado}-01-01`);
      setDataFim(`${anoSelecionado}-12-31`);
    }
  }, [anoSelecionado]);

  useEffect(() => {
    if (dataInicio && dataFim) {
      console.log('🔄 Carregando dados:', dataInicio, 'até', dataFim);
      carregar();
    }
  }, [dataInicio, dataFim]);

  useEffect(() => {
    carregarResumoAno();
  }, [anoPresenca100]);

  useEffect(() => {
    carregarPrerrogativa();
  }, [anoPrerrogativa]);

  useEffect(() => {
    carregarLicenciados();
  }, [anoLicenciados]);

  useEffect(() => {
    carregarSessoesRecentes();
  }, [qtdSessoesRecentes]);

  const carregarPrerrogativa = async () => {
    try {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const dataHoje = hoje.toISOString().split('T')[0];
      const inicioAno = `${anoPrerrogativa}-01-01`;

      console.log('🔍 Buscando sessões para prerrogativa:');
      console.log('  Ano:', anoPrerrogativa);
      console.log('  Período:', inicioAno, 'até', dataHoje);

      const { data: sessoes, error: erroSessoes } = await supabase
        .from('sessoes_presenca')
        .select('id, data_sessao, grau_sessao_id')
        .gte('data_sessao', inicioAno)
        .lte('data_sessao', dataHoje);

      console.log('  Sessões encontradas:', sessoes?.length || 0);
      console.log('  Erro:', erroSessoes);
      console.log('  Dados:', sessoes);

      // Buscar TODOS os registros com paginação
      let todosRegistros = [];
      let pagina = 0;
      const tamanhoPagina = 1000;
      let continuar = true;

      while (continuar) {
        const { data: lote, error: erroRegistros } = await supabase
          .from('registros_presenca')
          .select('membro_id, presente, sessao_id')
          .in('sessao_id', sessoes?.map(s => s.id) || [])
          .range(pagina * tamanhoPagina, (pagina + 1) * tamanhoPagina - 1);

        if (erroRegistros) {
          console.error('Erro ao buscar registros:', erroRegistros);
          break;
        }

        if (lote && lote.length > 0) {
          todosRegistros = [...todosRegistros, ...lote];
          pagina++;
          
          if (lote.length < tamanhoPagina) {
            continuar = false;
          }
        } else {
          continuar = false;
        }
      }

      const registros = todosRegistros;
      console.log('  Registros encontrados (após paginação):', registros?.length || 0);

      const { data: irmaos } = await supabase
        .from('irmaos')
        .select('id, nome, data_nascimento, data_iniciacao, data_elevacao, data_exaltacao, mestre_instalado, data_falecimento, data_ingresso_loja');

      const { data: historicoSituacoes } = await supabase
        .from('historico_situacoes')
        .select('*')
        .eq('status', 'ativa');

      const sessoesMap = {};
      sessoes?.forEach(s => { sessoesMap[s.id] = s; });

      const comPrerrogativa = [];

      console.log('🔍 DEBUG PRERROGATIVA:');
      console.log('  Total de sessões no ano:', sessoes?.length);
      console.log('  Total de registros:', registros?.length);

      irmaos?.forEach(irmao => {
        if (irmao.data_falecimento) return;
        
        const idade = irmao.data_nascimento ? calcularIdade(irmao.data_nascimento) : null;
        if (idade < 70) return;

        console.log(`\n👤 ${irmao.nome}:`);

        let grauTexto = 'Não iniciado';
        let grauIrmao = 0;
        if (irmao.data_exaltacao) { grauTexto = irmao.mestre_instalado ? 'Mestre Instalado' : 'Mestre'; grauIrmao = 3; }
        else if (irmao.data_elevacao) { grauTexto = 'Companheiro'; grauIrmao = 2; }
        else if (irmao.data_iniciacao) { grauTexto = 'Aprendiz'; grauIrmao = 1; }

        const dataIngresso = irmao.data_ingresso_loja ? new Date(irmao.data_ingresso_loja + 'T00:00:00') : null;
        const dataIniciacao = irmao.data_iniciacao ? new Date(irmao.data_iniciacao + 'T00:00:00') : null;
        const dataInicio = dataIngresso || dataIniciacao;

        let totalRegistros = 0;
        let presentes = 0;

        // Para prerrogativa 70+: percorre TODAS as sessões do ano
        sessoes?.forEach(sessao => {
          const dataSessao = new Date(sessao.data_sessao + 'T00:00:00');
          
          // Só conta se sessão é após ingresso
          if (dataInicio && dataSessao < dataInicio) return;
          
          // Só conta se não estava em situação especial
          const situacaoNaData = historicoSituacoes?.find(sit => 
            sit.membro_id === irmao.id &&
            dataSessao >= new Date(sit.data_inicio + 'T00:00:00') &&
            (sit.data_fim === null || dataSessao <= new Date(sit.data_fim + 'T00:00:00'))
          );
          if (situacaoNaData) return;
          
          // Sessão válida para este irmão
          totalRegistros++;
          
          // Verificar se tem registro de presença
          const reg = registros?.find(r => r.membro_id === irmao.id && r.sessao_id === sessao.id);
          if (reg && reg.presente) {
            presentes++;
          }
        });

        console.log(`  ✅ Sessões elegíveis: ${totalRegistros}`);
        console.log(`  ✅ Presenças: ${presentes}`);

        const percentual = totalRegistros > 0 ? Math.round((presentes / totalRegistros) * 100) : 0;

        comPrerrogativa.push({
          id: irmao.id,
          nome: irmao.nome,
          grau: grauTexto,
          presencas: presentes,
          total: totalRegistros,
          percentual
        });
      });

      setResumoPrerrogativa(comPrerrogativa);
    } catch (error) {
      console.error('Erro ao carregar prerrogativa:', error);
    }
  };

  const carregarLicenciados = async () => {
    try {
      const inicioAno = `${anoLicenciados}-01-01`;
      const fimAno = `${anoLicenciados}-12-31`;

      const { data: sessoes } = await supabase
        .from('sessoes_presenca')
        .select('id, data_sessao, grau_sessao_id')
        .gte('data_sessao', inicioAno)
        .lte('data_sessao', fimAno);

      const { data: registros } = await supabase
        .from('registros_presenca')
        .select('membro_id, presente, sessao_id')
        .in('sessao_id', sessoes?.map(s => s.id) || []);

      const { data: irmaos } = await supabase
        .from('irmaos')
        .select('id, nome, data_iniciacao, data_elevacao, data_exaltacao, mestre_instalado, data_ingresso_loja')
        ;

      const { data: historicoSituacoes } = await supabase
        .from('historico_situacoes')
        .select('*')
        .eq('status', 'ativa');

      const hoje = new Date();
      const sessoesMap = {};
      sessoes?.forEach(s => { sessoesMap[s.id] = s; });

      const licenciados = [];

      irmaos?.forEach(irmao => {
        const estaLicenciado = historicoSituacoes?.some(sit => {
          const tipoNormalizado = sit.tipo_situacao?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          return sit.membro_id === irmao.id &&
            tipoNormalizado === 'licenca' &&
            (sit.data_fim === null || new Date(sit.data_fim) >= hoje);
        }) || false;

        if (!estaLicenciado) return;


        let grauTexto = 'Não iniciado';
        let grauIrmao = 0;
        if (irmao.data_exaltacao) { grauTexto = irmao.mestre_instalado ? 'Mestre Instalado' : 'Mestre'; grauIrmao = 3; }
        else if (irmao.data_elevacao) { grauTexto = 'Companheiro'; grauIrmao = 2; }
        else if (irmao.data_iniciacao) { grauTexto = 'Aprendiz'; grauIrmao = 1; }

        const dataIngresso = irmao.data_ingresso_loja ? new Date(irmao.data_ingresso_loja) : null;
        const dataIniciacao = irmao.data_iniciacao ? new Date(irmao.data_iniciacao) : null;
        const dataInicio = dataIngresso || dataIniciacao;

        let totalRegistros = 0;
        let presentes = 0;


        registros?.forEach(reg => {
          if (reg.membro_id === irmao.id) {
            const sessao = sessoesMap[reg.sessao_id];
            if (!sessao) {
              console.log('  ❌ Sessão não encontrada:', reg.sessao_id);
              return;
            }

            const dataSessao = new Date(sessao.data_sessao);
            let grauSessao = sessao.grau_sessao_id || 1;
            
            // Sessão Administrativa (grau 4) deve ser tratada como Aprendiz (grau 1)
            if (grauSessao === 4) grauSessao = 1;


            if (dataInicio && dataSessao < dataInicio) {
              return;
            }
            if (grauSessao > grauIrmao) {
              return;
            }

            // Para licenciados, só conta sessões quando NÃO estava em licença
            const situacaoNaData = historicoSituacoes?.find(sit => {
              const tipoNormalizado = sit.tipo_situacao?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              return sit.membro_id === irmao.id &&
                tipoNormalizado === 'licenca' &&
                dataSessao >= new Date(sit.data_inicio + 'T00:00:00') &&
                (sit.data_fim === null || dataSessao <= new Date(sit.data_fim + 'T00:00:00'));
            });
            
            // Se estava em licença na data da sessão, não conta
            if (situacaoNaData) {
              return;
            }

            totalRegistros++;
            if (reg.presente) presentes++;
          }
        });


        const percentual = totalRegistros > 0 ? Math.round((presentes / totalRegistros) * 100) : 0;

        licenciados.push({
          id: irmao.id,
          nome: irmao.nome,
          grau: grauTexto,
          presencas: presentes,
          total: totalRegistros,
          percentual
        });
      });

      setResumoLicenciados(licenciados);
    } catch (error) {
      console.error('Erro ao carregar licenciados:', error);
    }
  };

  const carregarSessoesRecentes = async () => {
    try {
      const { data: sessoes } = await supabase
        .from('sessoes_presenca')
        .select('id, data_sessao, grau_sessao_id')
        .lte('data_sessao', new Date().toISOString().split('T')[0]) // Não incluir sessões futuras
        .order('data_sessao', { ascending: false })
        .limit(qtdSessoesRecentes);

      const { data: irmaos } = await supabase
        .from('irmaos')
        .select('id, data_iniciacao, data_elevacao, data_exaltacao, mestre_instalado, data_ingresso_loja, data_nascimento, data_falecimento, data_desligamento');

      const { data: historicoSituacoes } = await supabase
        .from('historico_situacoes')
        .select('*')
        .eq('status', 'ativa');

      const sessoesComDados = await Promise.all(sessoes.map(async (sessao) => {
        const { data: registros } = await supabase
          .from('registros_presenca')
          .select('membro_id, presente')
          .eq('sessao_id', sessao.id);

        // Buscar visitantes da sessão
        const { data: visitantes, count: totalVisitantes } = await supabase
          .from('visitantes_sessao')
          .select('*', { count: 'exact', head: true })
          .eq('sessao_id', sessao.id);

        let grauSessao = sessao.grau_sessao_id || 1;
        const grauOriginal = sessao.grau_sessao_id || 1; // Salvar original para exibição
        
        // Sessão Administrativa (grau 4) deve ser tratada como Aprendiz (grau 1)
        if (grauSessao === 4) grauSessao = 1;
        
        const dataSessao = new Date(sessao.data_sessao + 'T00:00:00'); // Adicionar hora para evitar problema de timezone

        const elegiveis = irmaos.filter(i => {
          // 1. Verificar grau
          let grauIrmao = 0;
          if (i.data_exaltacao) grauIrmao = 3;
          else if (i.data_elevacao) grauIrmao = 2;
          else if (i.data_iniciacao) grauIrmao = 1;

          // Sessão de grau superior - não pode
          if (grauSessao > grauIrmao) return false;

          // 2. Verificar data de ingresso
          const dataInicio = i.data_ingresso_loja ? new Date(i.data_ingresso_loja + 'T00:00:00') : 
                            i.data_iniciacao ? new Date(i.data_iniciacao + 'T00:00:00') : null;
          if (dataInicio && dataSessao < dataInicio) return false;

          // 3. Verificar SITUAÇÕES BLOQUEADORAS na data da sessão - EXCLUIR
          const temSituacaoBloqueadora = historicoSituacoes?.find(sit => {
            const tipoNormalizado = sit.tipo_situacao?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const situacoesExcluidas = ['desligado', 'irregular', 'suspenso', 'ex-oficio', 'excluido'];
            
            return sit.membro_id === i.id &&
              situacoesExcluidas.includes(tipoNormalizado) &&
              dataSessao >= new Date(sit.data_inicio + 'T00:00:00') &&
              (sit.data_fim === null || dataSessao <= new Date(sit.data_fim + 'T00:00:00'));
          });
          if (temSituacaoBloqueadora) return false;

          // 4. Verificar falecimento - SE faleceu ANTES da sessão, NÃO é elegível
          if (i.data_falecimento) {
            const dataFalec = new Date(i.data_falecimento + 'T00:00:00');
            if (dataSessao >= dataFalec) return false;
          }

          // 5. Licenciados e Prerrogativa CONTAM como elegíveis (não excluir)

          return true;
        });

        const presencas = registros?.filter(r => r.presente).length || 0;
        const totalElegiveis = elegiveis.length;
        const ausencias = totalElegiveis - presencas;
        const percentual = totalElegiveis > 0 ? Math.round((presencas / totalElegiveis) * 100) : 0;

        return {
          id: sessao.id,
          data_sessao: sessao.data_sessao,
          grau: grauOriginal, // Usar grau original para exibição
          elegiveis: totalElegiveis,
          presencas,
          ausencias,
          percentual,
          visitantes: totalVisitantes || 0
        };
      }));

      setSessoesRecentes(sessoesComDados);
    } catch (error) {
      console.error('Erro ao carregar sessões recentes:', error);
    }
  };

  // Filtrar ausências por ano/mês selecionado
  const ausenciasFiltradas = useMemo(() => {
    // TODO: Implementar filtro real por ano/mês quando necessário
    // Por enquanto, mantém o filtro básico por percentual
    return resumo.filter(i => {
      const temPrerrogativa = resumoPrerrogativa.some(p => p.id === i.id);
      if (temPrerrogativa) return false;
      
      const percAusencias = i.total_registros > 0 ? (i.ausentes / i.total_registros) * 100 : 0;
      return percAusencias >= percentualAlerta;
    });
  }, [resumo, resumoPrerrogativa, percentualAlerta]);

  const definirPeriodo = (p) => {
    setPeriodo(p);
    const hoje = new Date();
    const inicio = new Date();
    const fim = new Date();

    switch (p) {
      case 'mes':
        // Primeiro dia do mês atual
        inicio.setDate(1);
        inicio.setHours(0, 0, 0, 0);
        // Último dia do mês atual
        fim.setMonth(hoje.getMonth() + 1, 0);
        fim.setHours(23, 59, 59, 999);
        break;
      case 'trimestre':
        inicio.setMonth(hoje.getMonth() - 3);
        break;
      case 'semestre':
        inicio.setMonth(hoje.getMonth() - 6);
        break;
      case 'ano':
        // Primeiro dia do ano atual
        inicio.setMonth(0, 1);
        inicio.setHours(0, 0, 0, 0);
        // Último dia do ano atual
        fim.setMonth(11, 31);
        fim.setHours(23, 59, 59, 999);
        break;
    }

    setDataInicio(inicio.toISOString().split('T')[0]);
    setDataFim(fim.toISOString().split('T')[0]);
  };

  const carregarResumoAno = async () => {
    try {
      const inicioAno = `${anoPresenca100}-01-01`;
      const fimAno = `${anoPresenca100}-12-31`;

      // 1. Buscar todas as sessões do ano
      const { data: sessoesAno } = await supabase
        .from('sessoes_presenca')
        .select('id, data_sessao, grau_sessao_id')
        .gte('data_sessao', inicioAno)
        .lte('data_sessao', fimAno);

      const sessaoIds = sessoesAno?.map(s => s.id) || [];
      if (sessaoIds.length === 0) {
        setResumoAno([]);
        return;
      }

      // 2. Buscar histórico de situações
      const { data: historicoSituacoes } = await supabase
        .from('historico_situacoes')
        .select('*')
        .eq('status', 'ativa');

      // 3. Buscar irmãos com grau
      const { data: irmaos } = await supabase
        .from('irmaos')
        .select('id, nome, data_iniciacao, data_elevacao, data_exaltacao, mestre_instalado, data_ingresso_loja')
        ;

      // 4. Buscar registros com paginação
      let registros = [];
      let inicio = 0;
      const tamanhoPagina = 1000;
      let continuar = true;

      while (continuar) {
        const { data: lote } = await supabase
          .from('registros_presenca')
          .select('membro_id, presente, sessao_id')
          .in('sessao_id', sessaoIds)
          .range(inicio, inicio + tamanhoPagina - 1);

        if (lote && lote.length > 0) {
          registros = [...registros, ...lote];
          inicio += tamanhoPagina;
          
          if (lote.length < tamanhoPagina) {
            continuar = false;
          }
        } else {
          continuar = false;
        }
      }

      // Mapear sessões por ID
      const sessoesMap = {};
      sessoesAno?.forEach(s => {
        sessoesMap[s.id] = s;
      });

      // Processar cada irmão
      const com100 = [];
      
      irmaos?.forEach(irmao => {
        // Calcular grau do irmão
        let grauIrmao = 0;
        if (irmao.data_exaltacao) grauIrmao = 3;
        else if (irmao.data_elevacao) grauIrmao = 2;
        else if (irmao.data_iniciacao) grauIrmao = 1;

        if (grauIrmao === 0) return;

        // Contar APENAS registros VÁLIDOS (após iniciação e do grau permitido)
        let totalRegistros = 0;
        let presentes = 0;
        let aprendiz = 0, companheiro = 0, mestre = 0, administrativa = 0;

        // Prioridade: data_ingresso_loja > data_iniciacao
        const dataIngresso = irmao.data_ingresso_loja ? new Date(irmao.data_ingresso_loja) : null;
        const dataIniciacao = irmao.data_iniciacao ? new Date(irmao.data_iniciacao) : null;
        const dataInicio = dataIngresso || dataIniciacao;

        registros.forEach(reg => {
          if (reg.membro_id === irmao.id) {
            const sessao = sessoesMap[reg.sessao_id];
            if (!sessao) return;

            const dataSessao = new Date(sessao.data_sessao);
            let grauSessao = sessao.grau_sessao_id || 1;
            const grauOriginalSessao = sessao.grau_sessao_id || 1; // Guardar original
            
            // Sessão Administrativa (grau 4) deve ser tratada como Aprendiz (grau 1)
            if (grauSessao === 4) grauSessao = 1;

            // Ignorar se sessão é ANTES do ingresso na loja
            if (dataInicio && dataSessao < dataInicio) return;

            // Ignorar se sessão é de grau SUPERIOR ao do irmão
            if (grauSessao > grauIrmao) return;

            // Verificar se tem situação ativa na data da sessão
            const situacaoNaData = historicoSituacoes?.find(sit => 
              sit.membro_id === irmao.id &&
              dataSessao >= new Date(sit.data_inicio + 'T00:00:00') &&
              (sit.data_fim === null || dataSessao <= new Date(sit.data_fim + 'T00:00:00'))
            );
            
            // Se tem situação ativa, ignora
            if (situacaoNaData) return;

            // Registro válido
            totalRegistros++;
            
            if (reg.presente) {
              presentes++;
              
              // Contar por grau ORIGINAL da sessão
              if (grauOriginalSessao === 4) administrativa++;
              else if (grauSessao === 1) aprendiz++;
              else if (grauSessao === 2) companheiro++;
              else if (grauSessao === 3) mestre++;
            }
          }
        });

        // 100% = presentes em TODAS as sessões que tem registro
        if (totalRegistros > 0 && presentes === totalRegistros) {
          com100.push({
            id: irmao.id,
            nome: irmao.nome,
            total_sessoes: totalRegistros,
            aprendiz,
            companheiro,
            mestre,
            administrativa
          });
        }
      });

      setResumoAno(com100);

    } catch (error) {
      console.error('❌ Erro ao carregar resumo do ano:', error);
    }
  };

  const carregar = async () => {
    try {
      const hoje = new Date().toISOString().split('T')[0];
      
      // 1. Buscar sessões do período ATÉ HOJE
      const { data: sessoesPerio, count: totalSessoes } = await supabase
        .from('sessoes_presenca')
        .select('id, data_sessao, grau_sessao_id', { count: 'exact' })
        .gte('data_sessao', dataInicio)
        .lte('data_sessao', dataFim < hoje ? dataFim : hoje); // Não incluir futuras

      const sessaoIds = sessoesPerio?.map(s => s.id) || [];

      // 2. Buscar histórico de situações (licenças, desligamentos, etc)
      const { data: historicoSituacoes } = await supabase
        .from('historico_situacoes')
        .select('*')
        .eq('status', 'ativa');

      // 3. Buscar TODOS os irmãos (ativos e inativos) para estatísticas
      const { data: todosIrmaos } = await supabase
        .from('irmaos')
        .select('id, situacao, status');

      // Calcular estatísticas por situação
      const stats = {
        total: todosIrmaos?.length || 0,
        regulares: todosIrmaos?.filter(i => i.situacao?.toLowerCase() === 'regular').length || 0,
        licenciados: todosIrmaos?.filter(i => i.situacao?.toLowerCase() === 'licenciado').length || 0,
        irregulares: todosIrmaos?.filter(i => i.situacao?.toLowerCase() === 'irregular').length || 0,
        suspensos: todosIrmaos?.filter(i => i.situacao?.toLowerCase() === 'suspenso').length || 0,
        falecidos: todosIrmaos?.filter(i => 
          i.status === 'falecido' || i.situacao?.toLowerCase() === 'falecido'
        ).length || 0,
        desligados: todosIrmaos?.filter(i => 
          i.status === 'desligado' || i.situacao?.toLowerCase() === 'desligado'
        ).length || 0
      };
      stats.ativos = stats.regulares + stats.licenciados;

      // 4. Buscar irmãos ativos para cálculos de presença
      const { data: irmaos } = await supabase
        .from('irmaos')
        .select('id, nome, data_iniciacao, data_elevacao, data_exaltacao, mestre_instalado, data_nascimento, data_ingresso_loja, data_falecimento')
        ;

      // 5. Buscar registros com paginação
      let registros = [];
      let inicio = 0;
      const tamanhoPagina = 1000;
      let continuar = true;

      while (continuar) {
        const { data: lote } = await supabase
          .from('registros_presenca')
          .select('membro_id, presente, sessao_id')
          .in('sessao_id', sessaoIds)
          .range(inicio, inicio + tamanhoPagina - 1);

        if (lote && lote.length > 0) {
          registros = [...registros, ...lote];
          inicio += tamanhoPagina;
          
          if (lote.length < tamanhoPagina) {
            continuar = false;
          }
        } else {
          continuar = false;
        }
      }

      // Mapear sessões
      const sessoesMap = {};
      sessoesPerio?.forEach(s => {
        sessoesMap[s.id] = s;
      });

      // Processar cada irmão
      const resumoCompleto = [];

      irmaos?.forEach(irmao => {
        // Calcular grau
        let grauIrmao = 0;
        if (irmao.data_exaltacao) grauIrmao = 3;
        else if (irmao.data_elevacao) grauIrmao = 2;
        else if (irmao.data_iniciacao) grauIrmao = 1;

        if (grauIrmao === 0) return;

        // Calcular idade e prerrogativa
        let temPrerrogativa = false;
        let dataPrerrogativa = null;
        if (irmao.data_nascimento) {
          const nasc = new Date(irmao.data_nascimento);
          const hoje = new Date();
          let idade = hoje.getFullYear() - nasc.getFullYear();
          if (hoje.getMonth() < nasc.getMonth() || 
             (hoje.getMonth() === nasc.getMonth() && hoje.getDate() < nasc.getDate())) {
            idade--;
          }
          
          if (idade >= 70) {
            temPrerrogativa = true;
            dataPrerrogativa = new Date(nasc);
            dataPrerrogativa.setFullYear(nasc.getFullYear() + 70);
          }
        }

        // Prioridade: data_ingresso_loja > data_iniciacao
        const dataIngresso = irmao.data_ingresso_loja ? new Date(irmao.data_ingresso_loja) : null;
        const dataIniciacao = irmao.data_iniciacao ? new Date(irmao.data_iniciacao) : null;
        const dataInicio = dataIngresso || dataIniciacao;

        // Contar apenas registros VÁLIDOS
        let totalRegistros = 0;
        let presentes = 0;

        registros.forEach(reg => {
          if (reg.membro_id === irmao.id) {
            const sessao = sessoesMap[reg.sessao_id];
            if (!sessao) return;

            const dataSessao = new Date(sessao.data_sessao);
            let grauSessao = sessao.grau_sessao_id || 1;
            
            // Sessão Administrativa (grau 4) deve ser tratada como Aprendiz (grau 1)
            if (grauSessao === 4) grauSessao = 1;

            // Ignorar sessão ANTES do ingresso na loja
            if (dataInicio && dataSessao < dataInicio) return;

            // Ignorar sessão de grau SUPERIOR
            if (grauSessao > grauIrmao) return;

            // Verificar se tem situação ativa na data da sessão (licença, desligamento, etc)
            const situacaoNaData = historicoSituacoes?.find(sit => 
              sit.membro_id === irmao.id &&
              dataSessao >= new Date(sit.data_inicio + 'T00:00:00') &&
              (sit.data_fim === null || dataSessao <= new Date(sit.data_fim + 'T00:00:00'))
            );
            
            // Se tem situação ativa (licença/desligamento), ignora
            if (situacaoNaData) return;

            // Registro válido
            totalRegistros++;
            if (reg.presente) presentes++;
          }
        });

        const ausentes = totalRegistros - presentes;
        const taxa = totalRegistros > 0 ? Math.round((presentes / totalRegistros) * 100) : 0;

        resumoCompleto.push({
          id: irmao.id,
          nome: irmao.nome,
          total_registros: totalRegistros,
          presentes,
          ausentes,
          taxa
        });
      });

      // Média de presença
      const somaPresencas = resumoCompleto.reduce((sum, r) => sum + r.taxa, 0);
      const totalComRegistros = resumoCompleto.filter(r => r.total_registros > 0).length;
      const mediaPresenca = totalComRegistros > 0 ? Math.round(somaPresencas / totalComRegistros) : 0;

      // Contar irmãos ativos baseado em situações reais
      const irmaosAtivosCount = stats.ativos; // Já calculado: regulares + licenciados

      setDados({
        sessoes: totalSessoes || 0,
        irmaos: stats.total,
        irmaosAtivos: irmaosAtivosCount,
        stats, // Incluir estatísticas completas
        mediaPresenca
      });

      setResumo(resumoCompleto);

    } catch (error) {
      console.error('Erro:', error);
    }
  };

  return (
    <div style={{ 
      padding: '2rem', 
      background: 'var(--color-bg)', 
      minHeight: '100vh' 
    }}>
      
      {/* Cabeçalho com Título e Filtros */}
      <div className="card">
        <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: 'var(--color-text)', marginBottom: '1.5rem' }}>Dashboard de Presença</h1>
        
        {/* Seletor de Período */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium min-w-[60px]" style={{color:"var(--color-text-muted)"}}>Período:</label>
          <div className="flex gap-3 flex-1">
            {['mes', 'trimestre', 'semestre'].map(p => (
              <button
                key={p}
                onClick={() => definirPeriodo(p)}
                style={{flex:1,padding:'1rem',borderRadius:'var(--radius-lg)',fontSize:'1rem',fontWeight:'700',cursor:'pointer',border:'none',transition:'all 0.15s',background:periodo===p?'var(--color-accent)':'var(--color-surface-2)',color:periodo===p?'#fff':'var(--color-text)',transform:periodo===p?'scale(1.02)':'none'}}
              >
                {p === 'mes' ? 'Mês' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
            <select
              value={anoSelecionado || ''}
              onChange={(e) => {
                const ano = Number(e.target.value);
                setAnoSelecionado(ano);
                setPeriodo('ano');
                setDataInicio(`${ano}-01-01`);
                setDataFim(`${ano}-12-31`);
              }}
              disabled={!anoSelecionado}
              style={{flex:1,padding:'1rem',borderRadius:'var(--radius-lg)',fontSize:'0.875rem',fontWeight:'600',cursor:'pointer',border:'1px solid var(--color-border)',background:periodo==='ano'?'var(--color-accent)':'var(--color-surface-2)',color:periodo==='ano'?'#fff':'var(--color-text)'}}
            >
              {anosDisponiveis.map(ano => (
                <option key={ano} value={ano}>{ano}</option>
              ))}
            </select>
          </div>
        </div>

        <p style={{marginTop:"0.75rem",fontSize:"0.85rem",color:"var(--color-text-muted)"}}>
          📅 De <strong>{new Date(dataInicio).toLocaleDateString('pt-BR')}</strong> até <strong>{new Date(dataFim).toLocaleDateString('pt-BR')}</strong>
        </p>
      </div>
      {/* Cards Totais */}
      <div className="grid grid-cols-5 gap-6 mb-6">
        <div style={{ 
          background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.3)',borderRadius:'var(--radius-xl)',padding:'1.25rem',textAlign:'center',borderLeft:'4px solid var(--color-accent)'
        }}>
          <p style={{ color:'var(--color-accent)',fontWeight:'700',marginBottom:'0.4rem',fontSize:'0.85rem',textTransform:'uppercase',letterSpacing:'0.05em' }}>Sessões</p>
          <p style={{ fontSize:'2rem',fontWeight:'800',color:'var(--color-text)',lineHeight:'1.1' }}>{dados.sessoes}</p>
        </div>
        <div style={{ 
          background:'rgba(16,185,129,0.1)',border:'1px solid rgba(16,185,129,0.3)',borderRadius:'var(--radius-xl)',padding:'1.25rem',textAlign:'center',borderLeft:'4px solid #10b981'
        }}>
          <p style={{ color:'#10b981',fontWeight:'700',marginBottom:'0.4rem',fontSize:'0.85rem',textTransform:'uppercase',letterSpacing:'0.05em' }}>Total de Irmãos</p>
          <p style={{ fontSize:'2rem',fontWeight:'800',color:'var(--color-text)',lineHeight:'1.1' }}>{dados.irmaos}</p>
          {dados.stats && (
            <div style={{marginTop:"0.5rem",fontSize:"0.72rem",color:"var(--color-text-muted)",lineHeight:"1.6"}}>
              <div>✅ Ativos: {dados.stats.ativos}</div>
              {dados.stats.falecidos > 0 && <div>🕊️ Falecidos: {dados.stats.falecidos}</div>}
              {dados.stats.irregulares > 0 && <div>⚠️ Irregulares: {dados.stats.irregulares}</div>}
              {dados.stats.suspensos > 0 && <div>🚫 Suspensos: {dados.stats.suspensos}</div>}
              {dados.stats.desligados > 0 && <div>📤 Desligados: {dados.stats.desligados}</div>}
            </div>
          )}
        </div>
        <div style={{ 
          background:'rgba(99,102,241,0.1)',border:'1px solid rgba(99,102,241,0.3)',borderRadius:'var(--radius-xl)',padding:'1.25rem',textAlign:'center',borderLeft:'4px solid #6366f1'
        }}>
          <p style={{ color:'#6366f1',fontWeight:'700',marginBottom:'0.4rem',fontSize:'0.85rem',textTransform:'uppercase',letterSpacing:'0.05em' }}>Irmãos Ativos</p>
          <p style={{ fontSize:'2rem',fontWeight:'800',color:'var(--color-text)',lineHeight:'1.1' }}>{dados.irmaosAtivos || 0}</p>
          {dados.stats && (
            <div style={{marginTop:"0.5rem",fontSize:"0.72rem",color:"var(--color-text-muted)",lineHeight:"1.6"}}>
              <div>✅ Regulares: {dados.stats.regulares}</div>
              <div>🎫 Licenciados: {dados.stats.licenciados}</div>
            </div>
          )}
        </div>
        <div style={{ 
          background:'rgba(245,158,11,0.1)',border:'1px solid rgba(245,158,11,0.3)',borderRadius:'var(--radius-xl)',padding:'1.25rem',textAlign:'center',borderLeft:'4px solid #f59e0b'
        }}>
          <p style={{ color:'#f59e0b',fontWeight:'700',marginBottom:'0.4rem',fontSize:'0.85rem',textTransform:'uppercase',letterSpacing:'0.05em' }}>Média Presença</p>
          <p style={{ fontSize:'2rem',fontWeight:'800',color:'var(--color-text)',lineHeight:'1.1' }}>{dados.mediaPresenca || 0}%</p>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <button
            onClick={() => setMostrarGrade(true)}
            style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"none",border:"none",cursor:"pointer",color:"var(--color-text)"}}
          >
            <span className="text-3xl mb-2">📊</span>
            <span style={{fontWeight:"600",color:"var(--color-text-muted)",fontSize:"0.85rem",marginTop:"0.25rem"}}>Matrix Presença</span>
          </button>
        </div>
      </div>

      {/* Quadro: Sessões Recentes - largura total */}
      <div className="card" style={{ overflow: "hidden", marginBottom: "1.5rem", padding: 0 }}>
        <div style={{ background: 'var(--color-accent)', color: 'white', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📅</span>
            Sessões Recentes
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem' }}>Quantidade:</span>
            <select
              value={qtdSessoesRecentes}
              onChange={(e) => setQtdSessoesRecentes(Number(e.target.value))}
              style={{
                padding: '0.25rem 0.75rem',
                background: 'rgba(0,0,0,0.2)',
                color: 'white',
                borderRadius: 'var(--radius-md)',
                fontWeight: '600',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <option value={4}>4</option>
              <option value={6}>6</option>
              <option value={8}>8</option>
              <option value={10}>10</option>
            </select>
          </div>
        </div>
        <div className="p-4">
          {sessoesRecentes.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '2rem 0' }}>Carregando sessões...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead style={{ background: 'var(--color-surface-2)' }}>
                  <tr>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>Data</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>Grau</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>Elegíveis</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>Presenças</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>Ausências</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>Visitantes</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>%</th>
                  </tr>
                </thead>
                <tbody style={{ borderTop: '1px solid var(--color-border)' }}>
                  {sessoesRecentes.map((sessao, idx) => (
                    <tr 
                      key={sessao.id} 
                      style={{ borderBottom: '1px solid var(--color-border)' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--color-text)' }}>
                        {new Date(sessao.data_sessao + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-center text-sm" style={{color:"var(--color-text)"}}>
                        <span style={{...({1:{background:'rgba(59,130,246,0.15)',color:'#3b82f6',border:'1px solid rgba(59,130,246,0.3)'},2:{background:'rgba(16,185,129,0.15)',color:'#10b981',border:'1px solid rgba(16,185,129,0.3)'},4:{background:'rgba(245,158,11,0.15)',color:'#f59e0b',border:'1px solid rgba(245,158,11,0.3)'},3:{background:'rgba(139,92,246,0.15)',color:'#8b5cf6',border:'1px solid rgba(139,92,246,0.3)'}}[sessao.grau]||{}),padding:'0.15rem 0.5rem',borderRadius:'999px',fontSize:'0.7rem',fontWeight:'700'}}>
                          {sessao.grau === 1 ? 'Aprendiz' : 
                           sessao.grau === 2 ? 'Companheiro' : 
                           sessao.grau === 4 ? 'Administrativa' :
                           'Mestre'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm font-semibold" style={{color:"var(--color-text)"}}>{sessao.elegiveis}</td>
                      <td className="px-4 py-3 text-center text-sm font-semibold text-green-600" style={{color:"var(--color-text)"}}>{sessao.presencas}</td>
                      <td className="px-4 py-3 text-center text-sm font-semibold text-red-600" style={{color:"var(--color-text)"}}>{sessao.ausencias}</td>
                      <td className="px-4 py-3 text-center text-sm" style={{color:"var(--color-text)"}}>
                        <span style={{padding:"0.15rem 0.5rem",borderRadius:"var(--radius-sm)",background:"rgba(99,102,241,0.15)",color:"#6366f1",fontWeight:"700"}}>
                          {sessao.visitantes}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm" style={{color:"var(--color-text)"}}>
                        <span style={{background:sessao.percentual>=80?'rgba(16,185,129,0.15)':sessao.percentual>=60?'rgba(245,158,11,0.15)':'rgba(239,68,68,0.15)',color:sessao.percentual>=80?'#10b981':sessao.percentual>=60?'#f59e0b':'#ef4444',border:'1px solid currentColor',padding:'0.15rem 0.5rem',borderRadius:'999px',fontSize:'0.7rem',fontWeight:'700'}}>
                          {sessao.percentual}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Quadros lado a lado */}
      <div className="grid grid-cols-2 gap-6">
        
        {/* Quadro: Presença 100% */}
        <div className="card" style={{ overflow: "hidden", padding: 0 }}>
          <div style={{ background: 'var(--color-success)', color: 'white', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🏆</span>
              Presença 100% - {resumoAno.length} {resumoAno.length === 1 ? 'Irmão' : 'Irmãos'}
            </h3>
            <select
              value={anoPresenca100}
              onChange={(e) => setAnoPresenca100(Number(e.target.value))}
              style={{
                background: 'rgba(0,0,0,0.2)',
                color: 'white',
                padding: '0.25rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                fontWeight: '600',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              {anosDisponiveis.map(ano => (
                <option key={ano} value={ano}>{ano}</option>
              ))}
            </select>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto">
            {resumoAno.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '2rem 0' }}>Nenhum irmão com 100% em {anoPresenca100}</p>
            ) : (
              <div className="space-y-2">
                {resumoAno
                  .sort((a, b) => b.total_sessoes - a.total_sessoes)
                  .map(irmao => (
                  <div key={irmao.id} style={{ 
                    padding: '0.75rem', 
                    background: 'var(--color-success-bg)', 
                    borderRadius: 'var(--radius-md)',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-accent-bg)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-success-bg)'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: '500', color: 'var(--color-text)' }}>
                        {formatarNome(irmao.nome)}
                      </span>
                      <span style={{ background: 'var(--color-success)', color: 'white', padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: '600' }}>
                        {irmao.total_sessoes}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      {irmao.aprendiz > 0 && (
                        <span style={{padding:"0.15rem 0.5rem",borderRadius:"var(--radius-sm)",background:"rgba(59,130,246,0.15)",color:"#3b82f6"}}>
                          Apr: {irmao.aprendiz}
                        </span>
                      )}
                      {irmao.companheiro > 0 && (
                        <span style={{padding:"0.15rem 0.5rem",borderRadius:"var(--radius-sm)",background:"rgba(245,158,11,0.15)",color:"#f59e0b"}}>
                          Comp: {irmao.companheiro}
                        </span>
                      )}
                      {irmao.mestre > 0 && (
                        <span style={{padding:"0.15rem 0.5rem",borderRadius:"var(--radius-sm)",background:"rgba(139,92,246,0.15)",color:"#8b5cf6"}}>
                          Mest: {irmao.mestre}
                        </span>
                      )}
                      {irmao.administrativa > 0 && (
                        <span style={{padding:"0.15rem 0.5rem",borderRadius:"var(--radius-sm)",background:"rgba(245,158,11,0.15)",color:"#f59e0b"}}>
                          Adm: {irmao.administrativa}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quadro: Irmãos com Prerrogativa (70+) */}
        <div className="card" style={{ overflow: "hidden", padding: 0 }}>
          <div style={{ background: 'var(--color-warning)', color: 'white', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>👴</span>
              Irmãos com Prerrogativa (70+) - {resumoPrerrogativa.length} {resumoPrerrogativa.length === 1 ? 'Irmão' : 'Irmãos'}
            </h3>
            <select
              value={anoPrerrogativa}
              onChange={(e) => setAnoPrerrogativa(Number(e.target.value))}
              style={{
                background: 'rgba(0,0,0,0.2)',
                color: 'white',
                padding: '0.25rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                fontWeight: '600',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              {anosDisponiveis.map(ano => (
                <option key={ano} value={ano}>{ano}</option>
              ))}
            </select>
          </div>
          <div className="p-4">
            {resumoPrerrogativa.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '2rem 0' }}>Nenhum irmão com prerrogativa no período</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead style={{ background: 'var(--color-surface-2)' }}>
                    <tr>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>Nome</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>Grau</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>Presenças</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>%</th>
                    </tr>
                  </thead>
                  <tbody style={{ borderTop: '1px solid var(--color-border)' }}>
                    {resumoPrerrogativa
                      .sort((a, b) => b.percentual - a.percentual)
                      .map(irmao => (
                      <tr 
                        key={irmao.id} 
                        style={{ borderBottom: '1px solid var(--color-border)' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--color-text)' }}>
                          {formatarNome(irmao.nome)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                          {irmao.grau}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text)' }}>
                          {irmao.presencas}/{irmao.total}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          <span style={{background:irmao.percentual>=75?'rgba(16,185,129,0.15)':irmao.percentual>=50?'rgba(245,158,11,0.15)':'rgba(239,68,68,0.15)',color:irmao.percentual>=75?'#10b981':irmao.percentual>=50?'#f59e0b':'#ef4444',border:'1px solid currentColor',padding:'0.15rem 0.5rem',borderRadius:'999px',fontSize:'0.7rem',fontWeight:'700'}}>
                            {irmao.percentual}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Quadro: Irmãos Licenciados */}
        <div className="card" style={{ overflow: "hidden", padding: 0 }}>
          <div style={{ background: 'var(--color-warning)', color: 'white', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📋</span>
              Irmãos Licenciados - {resumoLicenciados.length} {resumoLicenciados.length === 1 ? 'Irmão' : 'Irmãos'}
            </h3>
            <select
              value={anoLicenciados}
              onChange={(e) => setAnoLicenciados(Number(e.target.value))}
              style={{
                background: 'rgba(0,0,0,0.2)',
                color: 'white',
                padding: '0.25rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                fontWeight: '600',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              {anosDisponiveis.map(ano => (
                <option key={ano} value={ano}>{ano}</option>
              ))}
            </select>
          </div>
          <div className="p-4">
            {resumoLicenciados.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '2rem 0' }}>Nenhum irmão licenciado no período</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead style={{ background: 'var(--color-surface-2)' }}>
                    <tr>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>Nome</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>Grau</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>Presenças</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>%</th>
                    </tr>
                  </thead>
                  <tbody style={{ borderTop: '1px solid var(--color-border)' }}>
                    {resumoLicenciados
                      .sort((a, b) => b.percentual - a.percentual)
                      .map(irmao => (
                      <tr 
                        key={irmao.id} 
                        style={{ borderBottom: '1px solid var(--color-border)' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--color-text)' }}>
                          {formatarNome(irmao.nome)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                          {irmao.grau}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text)' }}>
                          {irmao.presencas}/{irmao.total}
                        </td>
                        <td className="px-4 py-3 text-center" style={{color:"var(--color-text)"}}>
                          <span style={{background:irmao.percentual>=75?'rgba(16,185,129,0.15)':irmao.percentual>=50?'rgba(245,158,11,0.15)':'rgba(239,68,68,0.15)',color:irmao.percentual>=75?'#10b981':irmao.percentual>=50?'#f59e0b':'#ef4444',border:'1px solid currentColor',padding:'0.15rem 0.5rem',borderRadius:'999px',fontSize:'0.7rem',fontWeight:'700'}}>
                            {irmao.percentual}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Quadro: Ausências acima do percentual configurado */}
        <div className="card" style={{ overflow: "hidden", padding: 0 }}>
          <div style={{ background: 'var(--color-warning)', color: 'white', padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>⚠️</span>
                  Ausências
                </h3>
                <select
                  value={anoAusencias}
                  onChange={(e) => {
                    setAnoAusencias(Number(e.target.value));
                    const ano = Number(e.target.value);
                    const mes = mesAusencias;
                    
                    // Definir período baseado no ano/mês
                    if (mes === 0) {
                      setDataInicio(`${ano}-01-01`);
                      setDataFim(`${ano}-12-31`);
                    } else {
                      const ultimoDia = new Date(ano, mes, 0).getDate();
                      setDataInicio(`${ano}-${String(mes).padStart(2, '0')}-01`);
                      setDataFim(`${ano}-${String(mes).padStart(2, '0')}-${ultimoDia}`);
                    }
                  }}
                  style={{
                    background: 'rgba(0,0,0,0.2)',
                    color: 'white',
                    padding: '0.25rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    fontWeight: '600',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {anosDisponiveis.map(ano => (
                    <option key={ano} value={ano}>{ano}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem' }}>≥</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={percentualAlerta}
                  onChange={(e) => setPercentualAlerta(Number(e.target.value))}
                  style={{
                    width: '4rem',
                    padding: '0.25rem 0.5rem',
                    background: 'rgba(0,0,0,0.2)',
                    color: 'white',
                    borderRadius: 'var(--radius-md)',
                    fontWeight: '600',
                    textAlign: 'center',
                    border: 'none'
                  }}
                />
                <span style={{ fontSize: '0.875rem' }}>%</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: '500' }}>Mês:</label>
              <select
                value={mesAusencias}
                onChange={(e) => {
                  setMesAusencias(Number(e.target.value));
                  const ano = anoAusencias;
                  const mes = Number(e.target.value);
                  
                  // Definir período baseado no ano/mês
                  if (mes === 0) {
                    setDataInicio(`${ano}-01-01`);
                    setDataFim(`${ano}-12-31`);
                  } else {
                    const ultimoDia = new Date(ano, mes, 0).getDate();
                    setDataInicio(`${ano}-${String(mes).padStart(2, '0')}-01`);
                    setDataFim(`${ano}-${String(mes).padStart(2, '0')}-${ultimoDia}`);
                  }
                }}
                style={{padding:"0.35rem 0.75rem",background:"#f59e0b",color:"#fff",border:"none",borderRadius:"var(--radius-md)",fontWeight:"600",cursor:"pointer"}}
              >
                <option value={0}>Ano todo</option>
                {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((mes, idx) => (
                  <option key={idx + 1} value={idx + 1}>{mes}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto">
            {ausenciasFiltradas.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '2rem 0' }}>Nenhum irmão com ≥{percentualAlerta}% ausências no período</p>
            ) : (
              <div className="space-y-2">
                {ausenciasFiltradas
                  .sort((a, b) => {
                    const percA = (a.ausentes / a.total_registros) * 100;
                    const percB = (b.ausentes / b.total_registros) * 100;
                    return percB - percA;
                  })
                  .map(irmao => {
                    const percAusencias = Math.round((irmao.ausentes / irmao.total_registros) * 100);
                    return (
                      <div 
                        key={irmao.id} 
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          padding: '0.75rem', 
                          background: 'var(--color-warning-bg)', 
                          borderRadius: 'var(--radius-md)',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-accent-bg)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-warning-bg)'}
                      >
                        <div style={{ flex: 1 }}>
                          <p style={{ fontWeight: '500', color: 'var(--color-text)' }}>
                            {formatarNome(irmao.nome)}
                          </p>
                          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                            {irmao.ausentes}/{irmao.total_registros}
                          </p>
                        </div>
                        <span style={{ background: 'var(--color-warning)', color: 'white', padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: '600' }}>
                          {percAusencias}%
                        </span>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabela - COMENTADA para adicionar quadros
      <div className="rounded-lg overflow-hidden" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <div style={{background:"var(--color-accent)",color:"#fff",padding:"1rem"}}>
          <h2 className="text-2xl font-bold" style={{color:"var(--color-text)"}}>Resumo por Irmão</h2>
        </div>
        
        <table className="min-w-full">
          <thead style={{background:"var(--color-surface-2)"}}>
            <tr>
              <th className="px-6 py-4 text-left text-sm font-bold uppercase" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Irmão</th>
              <th className="px-6 py-4 text-center text-sm font-bold uppercase" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Registros</th>
              <th className="px-6 py-4 text-center text-sm font-bold uppercase" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Presentes</th>
              <th className="px-6 py-4 text-center text-sm font-bold uppercase" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Ausentes</th>
              <th className="px-6 py-4 text-center text-sm font-bold uppercase" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Taxa</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {resumo.map(irmao => (
              <tr key={irmao.id} style={{borderBottom:"1px solid var(--color-border)",transition:"background 0.1s"}}>
                <td className="px-6 py-4" style={{color:"var(--color-text)"}}>
                  <span className="font-semibold">{formatarNome(irmao.nome)}</span>
                </td>
                <td className="px-6 py-4 text-center" style={{color:"var(--color-text)"}}>
                  <span style={{fontSize:"1.1rem",fontWeight:"800",color:"var(--color-accent)"}}>{irmao.total_registros}</span>
                </td>
                <td className="px-6 py-4 text-center" style={{color:"var(--color-text)"}}>
                  <span style={{fontSize:"1.1rem",fontWeight:"800",color:"#10b981"}}>{irmao.presentes}</span>
                </td>
                <td className="px-6 py-4 text-center" style={{color:"var(--color-text)"}}>
                  <span className="text-lg font-bold text-red-600">{irmao.ausentes}</span>
                </td>
                <td className="px-6 py-4 text-center" style={{color:"var(--color-text)"}}>
                  <span style={{background:irmao.taxa>=90?'rgba(16,185,129,0.15)':irmao.taxa>=70?'rgba(245,158,11,0.15)':'rgba(239,68,68,0.15)',color:irmao.taxa>=90?'#10b981':irmao.taxa>=70?'#f59e0b':'#ef4444',border:'1px solid currentColor',padding:'0.2rem 0.6rem',borderRadius:'999px',fontSize:'0.75rem',fontWeight:'700'}}>
                    {irmao.taxa}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      */}

      {/* Info */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          💡 <strong>Mostrando dados BRUTOS do banco:</strong> Total geral de sessões, irmãos e registros sem nenhum filtro por período ou grau.
        </p>
      </div>

      {/* Modal Grade */}
      {mostrarGrade && (
        <ModalGradePresenca onFechar={() => setMostrarGrade(false)} />
      )}
    </div>
  );
}
