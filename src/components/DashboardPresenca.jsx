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
          <label className="text-sm font-medium text-gray-700 min-w-[60px]">Período:</label>
          <div className="flex gap-3 flex-1">
            {['mes', 'trimestre', 'semestre'].map(p => (
              <button
                key={p}
                onClick={() => definirPeriodo(p)}
                className={`flex-1 py-4 rounded-lg text-base font-bold transition-all ${
                  periodo === p
                    ? 'bg-green-400 text-white shadow-lg scale-105'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
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
              className={`flex-1 py-4 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                periodo === 'ano'
                  ? 'bg-green-400 text-white shadow-lg'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {anosDisponiveis.map(ano => (
                <option key={ano} value={ano}>{ano}</option>
              ))}
            </select>
          </div>
        </div>

        <p className="mt-3 text-sm text-gray-600">
          📅 De <strong>{new Date(dataInicio).toLocaleDateString('pt-BR')}</strong> até <strong>{new Date(dataFim).toLocaleDateString('pt-BR')}</strong>
        </p>
      </div>
      {/* Cards Totais */}
      <div className="grid grid-cols-5 gap-6 mb-6">
        <div style={{ 
          background: 'var(--color-accent-bg)', 
          border: '1px solid var(--color-border)', 
          borderRadius: 'var(--radius-lg)', 
          padding: '1.5rem', 
          textAlign: 'center' 
        }}>
          <p style={{ color: 'var(--color-accent)', fontWeight: '600', marginBottom: '0.5rem' }}>Sessões</p>
          <p style={{ fontSize: '2.25rem', fontWeight: 'bold', color: 'var(--color-text)' }}>{dados.sessoes}</p>
        </div>
        <div style={{ 
          background: 'var(--color-success-bg)', 
          border: '1px solid var(--color-border)', 
          borderRadius: 'var(--radius-lg)', 
          padding: '1.5rem', 
          textAlign: 'center' 
        }}>
          <p style={{ color: 'var(--color-success)', fontWeight: '600', marginBottom: '0.5rem' }}>Total de Irmãos</p>
          <p style={{ fontSize: '2.25rem', fontWeight: 'bold', color: 'var(--color-text)' }}>{dados.irmaos}</p>
          {dados.stats && (
            <div className="mt-3 text-xs text-gray-600 space-y-1">
              <div>✅ Ativos: {dados.stats.ativos}</div>
              {dados.stats.falecidos > 0 && <div>🕊️ Falecidos: {dados.stats.falecidos}</div>}
              {dados.stats.irregulares > 0 && <div>⚠️ Irregulares: {dados.stats.irregulares}</div>}
              {dados.stats.suspensos > 0 && <div>🚫 Suspensos: {dados.stats.suspensos}</div>}
              {dados.stats.desligados > 0 && <div>📤 Desligados: {dados.stats.desligados}</div>}
            </div>
          )}
        </div>
        <div style={{ 
          background: 'var(--color-info-bg)', 
          border: '1px solid var(--color-border)', 
          borderRadius: 'var(--radius-lg)', 
          padding: '1.5rem', 
          textAlign: 'center' 
        }}>
          <p style={{ color: 'var(--color-info)', fontWeight: '600', marginBottom: '0.5rem' }}>Irmãos Ativos</p>
          <p style={{ fontSize: '2.25rem', fontWeight: 'bold', color: 'var(--color-text)' }}>{dados.irmaosAtivos || 0}</p>
          {dados.stats && (
            <div className="mt-3 text-xs text-gray-600 space-y-1">
              <div>✅ Regulares: {dados.stats.regulares}</div>
              <div>🎫 Licenciados: {dados.stats.licenciados}</div>
            </div>
          )}
        </div>
        <div style={{ 
          background: 'var(--color-warning-bg)', 
          border: '1px solid var(--color-border)', 
          borderRadius: 'var(--radius-lg)', 
          padding: '1.5rem', 
          textAlign: 'center' 
        }}>
          <p style={{ color: 'var(--color-warning)', fontWeight: '600', marginBottom: '0.5rem' }}>Média Presença</p>
          <p style={{ fontSize: '2.25rem', fontWeight: 'bold', color: 'var(--color-text)' }}>{dados.mediaPresenca || 0}%</p>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <button
            onClick={() => setMostrarGrade(true)}
            className="w-full h-full flex flex-col items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <span className="text-3xl mb-2">📊</span>
            <span className="font-semibold text-gray-700">Matrix Presença</span>
          </button>
        </div>
      </div>

      {/* Quadro: Sessões Recentes - largura total */}
      <div className="card" style={{ overflow: "hidden", marginBottom: "1.5rem" }}>
        <div className="bg-indigo-600 text-white p-4 flex items-center justify-between">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <span>📅</span>
            Sessões Recentes
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-sm">Quantidade:</span>
            <select
              value={qtdSessoesRecentes}
              onChange={(e) => setQtdSessoesRecentes(Number(e.target.value))}
              className="px-3 py-1.5 bg-indigo-700 text-white rounded font-semibold"
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
            <p className="text-gray-500 text-center py-8">Carregando sessões...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Data</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Grau</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Elegíveis</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Presenças</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Ausências</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Visitantes</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">%</th>
                  </tr>
                </thead>
                <tbody>
                  {sessoesRecentes.map((sessao, idx) => (
                    <tr key={sessao.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 text-sm">
                        {new Date(sessao.data_sessao + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-center text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          sessao.grau === 1 ? 'bg-blue-100 text-blue-800' :
                          sessao.grau === 2 ? 'bg-green-100 text-green-800' :
                          sessao.grau === 4 ? 'bg-orange-100 text-orange-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {sessao.grau === 1 ? 'Aprendiz' : 
                           sessao.grau === 2 ? 'Companheiro' : 
                           sessao.grau === 4 ? 'Administrativa' :
                           'Mestre'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm font-semibold">{sessao.elegiveis}</td>
                      <td className="px-4 py-3 text-center text-sm font-semibold text-green-600">{sessao.presencas}</td>
                      <td className="px-4 py-3 text-center text-sm font-semibold text-red-600">{sessao.ausencias}</td>
                      <td className="px-4 py-3 text-center text-sm">
                        <span className="px-2 py-1 rounded bg-indigo-100 text-indigo-800 font-semibold">
                          {sessao.visitantes}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm">
                        <span className={`px-2 py-1 rounded font-semibold ${
                          sessao.percentual >= 80 ? 'bg-green-100 text-green-800' :
                          sessao.percentual >= 60 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
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
              <p className="text-gray-500 text-center py-8">Nenhum irmão com 100% em {anoPresenca100}</p>
            ) : (
              <div className="space-y-2">
                {resumoAno
                  .sort((a, b) => b.total_sessoes - a.total_sessoes)
                  .map(irmao => (
                  <div key={irmao.id} className="p-3 bg-green-50 rounded hover:bg-green-100 transition-colors">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-gray-800">
                        {formatarNome(irmao.nome)}
                      </span>
                      <span className="bg-green-600 text-white px-3 py-1 rounded text-sm font-semibold">
                        {irmao.total_sessoes}
                      </span>
                    </div>
                    <div className="flex gap-3 text-xs text-gray-600">
                      {irmao.aprendiz > 0 && (
                        <span className="bg-blue-100 px-2 py-1 rounded">
                          Apr: {irmao.aprendiz}
                        </span>
                      )}
                      {irmao.companheiro > 0 && (
                        <span className="bg-yellow-100 px-2 py-1 rounded">
                          Comp: {irmao.companheiro}
                        </span>
                      )}
                      {irmao.mestre > 0 && (
                        <span className="bg-purple-100 px-2 py-1 rounded">
                          Mest: {irmao.mestre}
                        </span>
                      )}
                      {irmao.administrativa > 0 && (
                        <span className="bg-orange-100 px-2 py-1 rounded">
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
                          <span className={`inline-block px-3 py-1 rounded text-sm font-semibold ${
                            irmao.percentual >= 75 ? 'bg-green-100 text-green-800' :
                            irmao.percentual >= 50 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
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
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-3 py-1 rounded text-sm font-semibold ${
                            irmao.percentual >= 75 ? 'bg-green-100 text-green-800' :
                            irmao.percentual >= 50 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
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
                className="px-3 py-1.5 bg-orange-700 text-white rounded font-semibold"
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
              <p className="text-gray-500 text-center py-8">Nenhum irmão com ≥{percentualAlerta}% ausências no período</p>
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
                      <div key={irmao.id} className="flex justify-between items-center p-3 bg-orange-50 rounded hover:bg-orange-100 transition-colors">
                        <div className="flex-1">
                          <p className="font-medium text-gray-800">
                            {formatarNome(irmao.nome)}
                          </p>
                          <p className="text-sm text-gray-600">
                            {irmao.ausentes}/{irmao.total_registros}
                          </p>
                        </div>
                        <span className="bg-orange-600 text-white px-3 py-1 rounded text-sm font-semibold">
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
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="bg-gray-800 text-white p-4">
          <h2 className="text-2xl font-bold">Resumo por Irmão</h2>
        </div>
        
        <table className="min-w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 uppercase">Irmão</th>
              <th className="px-6 py-4 text-center text-sm font-bold text-gray-700 uppercase">Registros</th>
              <th className="px-6 py-4 text-center text-sm font-bold text-gray-700 uppercase">Presentes</th>
              <th className="px-6 py-4 text-center text-sm font-bold text-gray-700 uppercase">Ausentes</th>
              <th className="px-6 py-4 text-center text-sm font-bold text-gray-700 uppercase">Taxa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {resumo.map(irmao => (
              <tr key={irmao.id} className="hover:bg-blue-50 transition-colors">
                <td className="px-6 py-4">
                  <span className="font-semibold text-gray-900">{formatarNome(irmao.nome)}</span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="text-lg font-bold text-blue-600">{irmao.total_registros}</span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="text-lg font-bold text-green-600">{irmao.presentes}</span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="text-lg font-bold text-red-600">{irmao.ausentes}</span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-4 py-2 rounded-full font-bold text-sm ${
                    irmao.taxa >= 90 ? 'bg-green-100 text-green-800' :
                    irmao.taxa >= 70 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
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
