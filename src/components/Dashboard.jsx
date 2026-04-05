/**
 * COMPONENTE DASHBOARD
 * Sistema A∴R∴L∴S∴ Acácia de Paranatinga nº 30
 */

import React, { useMemo, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import ParticipacaoComissoes from './ParticipacaoComissoes';

export const Dashboard = ({ irmaos, balaustres, cronograma = [] }) => {
  const [historicoSituacoes, setHistoricoSituacoes] = useState([]);
  const [irmaos100, setIrmaos100] = useState([]);
  const [totalVisitantes, setTotalVisitantes] = useState(0);
  const [modalSituacao, setModalSituacao] = useState({ aberto: false, titulo: '', irmaos: [] });
  const [historicoCargos, setHistoricoCargos] = useState([]);
  const [filtroComCargo, setFiltroComCargo] = useState(false);
  
  // Estados para visitas
  const [visitasIrmaos, setVisitasIrmaos] = useState([]);
  const [totalVisitasIrmaos, setTotalVisitasIrmaos] = useState(0);
  const [modalVisitasIrmaos, setModalVisitasIrmaos] = useState(false);
  const [modalVisitantesRecebidos, setModalVisitantesRecebidos] = useState(false);
  const [visitantesRecebidos, setVisitantesRecebidos] = useState([]);

  // Função para formatar nome (2 primeiros nomes + último se tiver "de/da")
  const formatarNome = (nomeCompleto) => {
    if (!nomeCompleto) return '';
    const partes = nomeCompleto.trim().split(' ');
    if (partes.length <= 2) return nomeCompleto;
    
    const primeiros = partes.slice(0, 2).join(' ');
    const temPreposicao = partes.some(p => ['de', 'da', 'do', 'das', 'dos'].includes(p.toLowerCase()));
    
    if (temPreposicao && partes.length > 2) {
      return `${primeiros} ${partes[partes.length - 1]}`;
    }
    return primeiros;
  };

  // Função para nome curto (para cards de visitas)
  const formatarNomeCurto = (nomeCompleto) => {
    if (!nomeCompleto) return '';
    const partes = nomeCompleto.trim().split(' ');
    if (partes.length <= 2) return nomeCompleto;
    
    const conectores = ['de', 'da', 'do', 'dos', 'das'];
    const temConector = partes.some(p => conectores.includes(p.toLowerCase()));
    
    if (temConector) {
      return `${partes[0]} ${partes[partes.length - 1]}`;
    }
    return `${partes[0]} ${partes[1]}`;
  };

  // Função para obter cargo atual do irmão (do ano atual)
  const obterCargoAtual = (irmaoId) => {
    const anoAtual = new Date().getFullYear();
    const cargo = historicoCargos.find(c => c.irmao_id === irmaoId && c.ano === anoAtual);
    return cargo?.cargo || null;
  };

  useEffect(() => {
    const carregar = async () => {
      const { data } = await supabase
        .from('historico_situacoes')
        .select('*')
        .eq('status', 'ativa');
      setHistoricoSituacoes(data || []);
      
      // Carregar histórico de cargos
      const { data: cargosData } = await supabase
        .from('historico_cargos')
        .select('*');
      setHistoricoCargos(cargosData || []);
      
      // Carregar visitantes do ano
      const { count } = await supabase
        .from('visitantes_sessao')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${new Date().getFullYear()}-01-01`);
      setTotalVisitantes(count || 0);

      // Carregar visitas dos irmãos a outras lojas (ano atual)
      const { data: visitas, count: countVisitas } = await supabase
        .from('visitas_outras_lojas')
        .select(`
          *,
          irmaos(nome),
          potencias_masonicas(sigla, nome_completo)
        `, { count: 'exact' })
        .gte('data_visita', `${new Date().getFullYear()}-01-01`)
        .order('data_visita', { ascending: false });
      setVisitasIrmaos(visitas || []);
      setTotalVisitasIrmaos(countVisitas || 0);

      // Carregar visitantes recebidos detalhados
      const { data: visitantesData } = await supabase
        .from('visitantes_sessao')
        .select(`
          *,
          sessoes_presenca(data_sessao)
        `)
        .gte('created_at', `${new Date().getFullYear()}-01-01`)
        .order('created_at', { ascending: false });
      setVisitantesRecebidos(visitantesData || []);
    };
    carregar();
  }, []);

  useEffect(() => {
    const carregarPresenca100 = async () => {
      try {
        const anoAtual = new Date().getFullYear();
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0); // Zerar horas para comparação apenas de data
        const inicioAno = `${anoAtual}-01-01`;
        const dataHoje = hoje.toISOString().split('T')[0]; // Formato YYYY-MM-DD

        // 1. Buscar todas as sessões do ano ATÉ HOJE
        const { data: sessoesAno } = await supabase
          .from('sessoes_presenca')
          .select('id, data_sessao, grau_sessao_id')
          .gte('data_sessao', inicioAno)
          .lte('data_sessao', dataHoje);

        const sessaoIds = sessoesAno?.map(s => s.id) || [];
        if (sessaoIds.length === 0) {
          setIrmaos100([]);
          return;
        }

        // 2. Buscar histórico de situações
        const { data: historicoSituacoes } = await supabase
          .from('historico_situacoes')
          .select('*')
          .eq('status', 'ativa');

        // 3. Buscar irmãos com grau
        const { data: todosIrmaos } = await supabase
          .from('irmaos')
          .select('id, nome, data_iniciacao, data_elevacao, data_exaltacao, data_ingresso_loja')
          .eq('status', 'ativo');

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
        
        todosIrmaos?.forEach(irmao => {
          // Calcular grau do irmão
          let grauIrmao = 0;
          if (irmao.data_exaltacao) grauIrmao = 3;
          else if (irmao.data_elevacao) grauIrmao = 2;
          else if (irmao.data_iniciacao) grauIrmao = 1;

          if (grauIrmao === 0) return;

          let totalRegistros = 0;
          let presentes = 0;

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
              }
            }
          });

          // 100% = presentes em TODAS as sessões que tem registro
          if (totalRegistros > 0 && presentes === totalRegistros) {
            com100.push({
              id: irmao.id,
              nome: irmao.nome,
              total: totalRegistros
            });
          }
        });

        // Ordenar: 1º por total de sessões (maior -> menor), 2º alfabético
        com100.sort((a, b) => {
          if (b.total !== a.total) {
            return b.total - a.total; // Maior número primeiro
          }
          return a.nome.localeCompare(b.nome); // Alfabético
        });

        setIrmaos100(com100);
      } catch (error) {
        console.error('Erro ao carregar presença 100%:', error);
      }
    };

    carregarPresenca100();
  }, []);

  // Função para determinar o grau do irmão
  const obterGrau = (irmao) => {
    if (irmao.data_exaltacao) {
      return irmao.mestre_instalado ? 'Mestre Instalado' : 'Mestre';
    }
    if (irmao.data_elevacao) return 'Companheiro';
    if (irmao.data_iniciacao) return 'Aprendiz';
    return 'Não Iniciado';
  };

  // Contagens por situação
  const hoje = new Date();
  
  const irmaosLicenciados = irmaos.filter(i => {
    return historicoSituacoes.some(sit => 
      sit.membro_id === i.id &&
      sit.tipo_situacao?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 'licenca' &&
      (sit.data_fim === null || new Date(sit.data_fim) >= hoje)
    );
  });

  const irmaosRegulares = irmaos.filter(i => i.situacao?.toLowerCase() === 'regular');
  const irmaosIrregulares = irmaos.filter(i => i.situacao?.toLowerCase() === 'irregular');
  const irmaosSuspensos = irmaos.filter(i => i.situacao?.toLowerCase() === 'suspenso');
  const irmaosDesligados = irmaos.filter(i => i.situacao?.toLowerCase() === 'desligado');
  const irmaosExcluidos = irmaos.filter(i => i.situacao?.toLowerCase() === 'excluído');
  const irmaosFalecidos = irmaos.filter(i => i.situacao?.toLowerCase() === 'falecido');
  const irmaosExOficio = irmaos.filter(i => i.situacao?.toLowerCase() === 'ex-ofício');
  const totalIrmaos = irmaos.length;

  // Irmãos ativos (Regulares + Licenciados)
  const irmaosAtivos = [...irmaosRegulares, ...irmaosLicenciados];

  // Contagem por grau (regulares + licenciados)
  const irmaosAprendiz = irmaosAtivos.filter(i => obterGrau(i) === 'Aprendiz').length;
  const irmaosCompanheiro = irmaosAtivos.filter(i => obterGrau(i) === 'Companheiro').length;
  const irmaosMestre = irmaosAtivos.filter(i => obterGrau(i) === 'Mestre').length;
  const irmaosMestreInstalado = irmaosAtivos.filter(i => obterGrau(i) === 'Mestre Instalado').length;
  const totalMestres = irmaosMestre + irmaosMestreInstalado;

  // ========================================
  // ANIVERSARIANTES - INCLUINDO FAMILIARES
  // ========================================
  const aniversariantes = useMemo(() => {
    const hoje = new Date();
    const diaHoje = hoje.getDate();
    const mesHoje = hoje.getMonth() + 1;

    const aniversariantesHoje = [];
    const proximos7Dias = [];

    const verificarAniversario = (pessoa, tipo, irmaoNome = null) => {
      if (!pessoa.data_nascimento) return;

      const dataNasc = new Date(pessoa.data_nascimento + 'T00:00:00');
      const diaNasc = dataNasc.getDate();
      const mesNasc = dataNasc.getMonth() + 1;

      // Aniversariante de hoje
      if (diaNasc === diaHoje && mesNasc === mesHoje) {
        const idade = hoje.getFullYear() - dataNasc.getFullYear();
        aniversariantesHoje.push({
          nome: pessoa.nome,
          tipo: tipo,
          irmaoNome: irmaoNome,
          idade,
          dataNasc: dataNasc,
          id: `${tipo}-${pessoa.id || Math.random()}`
        });
      }

      // Próximos 7 dias
      const dataAnivEstano = new Date(hoje.getFullYear(), mesNasc - 1, diaNasc);
      
      // Se o aniversário já passou este ano, considera o próximo ano
      if (dataAnivEstano < hoje) {
        dataAnivEstano.setFullYear(hoje.getFullYear() + 1);
      }

      const diffDias = Math.ceil((dataAnivEstano - hoje) / (1000 * 60 * 60 * 24));

      if (diffDias > 0 && diffDias <= 7) {
        const idade = dataAnivEstano.getFullYear() - dataNasc.getFullYear();
        proximos7Dias.push({
          nome: pessoa.nome,
          tipo: tipo,
          irmaoNome: irmaoNome,
          idade,
          diasRestantes: diffDias,
          dataAniversario: dataAnivEstano,
          dataNasc: dataNasc,
          id: `${tipo}-${pessoa.id || Math.random()}`
        });
      }
    };

    // DEBUG
    console.log('🎂 Verificando aniversariantes...');
    console.log('Total irmãos:', irmaos.length);

    // Irmãos (apenas VIVOS)
    irmaos.forEach(irmao => {
      // Não mostrar irmãos falecidos
      if (irmao.falecido === true || irmao.data_falecimento) return;
      
      verificarAniversario(irmao, 'Irmão');

      // Esposa
      if (irmao.esposas && Array.isArray(irmao.esposas)) {
        console.log(`👰 ${irmao.nome} tem ${irmao.esposas.length} esposa(s)`);
        irmao.esposas.forEach(esposa => {
          verificarAniversario(esposa, 'Esposa', irmao.nome);
        });
      }

      // Pais (apenas VIVOS)
      if (irmao.pais && Array.isArray(irmao.pais)) {
        console.log(`👪 ${irmao.nome} tem ${irmao.pais.length} pai/mãe`);
        irmao.pais.forEach(pai => {
          // Não mostrar pais falecidos
          if (pai.falecido === true) return;
          
          const tipoPai = pai.tipo === 'pai' ? 'Pai' : 'Mãe';
          verificarAniversario(pai, tipoPai, irmao.nome);
        });
      }

      // Filhos (apenas VIVOS)
      if (irmao.filhos && Array.isArray(irmao.filhos)) {
        console.log(`👶 ${irmao.nome} tem ${irmao.filhos.length} filho(s)`);
        irmao.filhos.forEach(filho => {
          // Não mostrar filhos falecidos
          if (filho.falecido === true) return;
          
          verificarAniversario(filho, 'Filho(a)', irmao.nome);
        });
      }
    });

    // ===== CONSOLIDAR DUPLICATAS =====
    const consolidarDuplicatas = (lista) => {
      const map = new Map();
      
      lista.forEach(pessoa => {
        // Normalizar nome
        const nomeNormalizado = pessoa.nome
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, ' ');
        
        const timestamp = pessoa.dataNasc.getTime();
        const chave = `${nomeNormalizado}-${timestamp}`;
        
        if (map.has(chave)) {
          // Duplicata encontrada - adicionar vínculo
          const pessoaExistente = map.get(chave);
          
          if (!pessoaExistente.vinculos) {
            pessoaExistente.vinculos = [{
              tipo: pessoaExistente.tipo,
              irmao: pessoaExistente.irmaoNome
            }];
          }
          
          pessoaExistente.vinculos.push({
            tipo: pessoa.tipo,
            irmao: pessoa.irmaoNome
          });
          
          // Atualizar tipo
          const tipos = pessoaExistente.vinculos.map(v => v.tipo);
          pessoaExistente.tipo = tipos.join(' / ');
          
        } else {
          map.set(chave, pessoa);
        }
      });
      
      return Array.from(map.values());
    };
    
    const aniversariantesHojeConsolidados = consolidarDuplicatas(aniversariantesHoje);
    const proximos7DiasConsolidados = consolidarDuplicatas(proximos7Dias);

    // Ordenar próximos 7 dias por data
    proximos7DiasConsolidados.sort((a, b) => a.diasRestantes - b.diasRestantes);

    console.log('📅 Aniversariantes hoje:', aniversariantesHojeConsolidados.length);
    console.log('📅 Próximos 7 dias:', proximos7DiasConsolidados.length);

    return { 
      aniversariantesHoje: aniversariantesHojeConsolidados, 
      proximos7Dias: proximos7DiasConsolidados 
    };
  }, [irmaos]);

  return (
    <div style={{padding:'1.5rem 2rem',minHeight:'100vh',background:'var(--color-bg)',overflowX:'hidden'}}>
      {/* Cards de Graus */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div style={{background:"var(--color-accent)",borderRadius:"var(--radius-xl)",padding:"1.5rem",color:"#fff"}}>
          <h3 style={{fontSize:"1rem",fontWeight:"700",color:"#fff",marginBottom:"0.75rem"}}>Irmãos Regulares</h3>
          <div className="mb-4">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid rgba(255,255,255,0.2)",paddingBottom:"0.75rem",marginBottom:"0.75rem"}}>
              <span style={{fontSize:"0.82rem",opacity:0.9}}>📊 Total de Irmãos Ativos:</span>
              <span style={{fontWeight:"800",fontSize:"3rem"}}>{irmaosAtivos.length}</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.75rem",fontSize:"0.82rem"}}>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span>✅ Regulares:</span>
                <span className="font-bold">{irmaosRegulares.length}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span>🎫 Licenciados:</span>
                <span className="font-bold">{irmaosLicenciados.length}</span>
              </div>
            </div>
          </div>
          <div className="border-t pt-3">
            <div className="grid grid-cols-3 gap-4 text-sm">
              {/* Coluna 1: Aprendizes */}
              <div>
                <div style={{display:"flex",justifyContent:"space-between",fontWeight:"600"}}>
                  <span>⬜ Aprendizes:</span>
                  <span>{irmaosAprendiz}</span>
                </div>
              </div>
              
              {/* Coluna 2: Companheiros */}
              <div>
                <div style={{display:"flex",justifyContent:"space-between",fontWeight:"600"}}>
                  <span>🔷 Companheiros:</span>
                  <span>{irmaosCompanheiro}</span>
                </div>
              </div>
              
              {/* Coluna 3: Mestres */}
              <div>
                <div style={{display:"flex",justifyContent:"space-between",fontWeight:"700"}}>
                  <span>🔺 Total Mestres:</span>
                  <span>{totalMestres}</span>
                </div>
                <div style={{fontSize:"0.72rem",opacity:0.8,display:"flex",flexDirection:"column",gap:"0.1rem"}}>
                  <div style={{display:"flex",justifyContent:"space-between",paddingLeft:"0.5rem"}}>
                    <span>Mestres:</span>
                    <span>{irmaosMestre}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",paddingLeft:"0.5rem"}}>
                    <span>M. Instalados:</span>
                    <span>{irmaosMestreInstalado}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div style={{background:"var(--color-surface)",border:"1px solid var(--color-border)",borderLeft:"4px solid var(--color-accent)",borderRadius:"var(--radius-xl)",padding:"1.5rem"}}>
          <h3 style={{fontSize:"1rem",fontWeight:"700",color:"var(--color-text)",marginBottom:"0.75rem"}}>Total Geral</h3>
          <p style={{fontSize:"3rem",fontWeight:"800",color:"var(--color-text)",marginBottom:"0.5rem"}}>{totalIrmaos}</p>
          <p style={{fontSize:"0.82rem",color:"var(--color-text-muted)"}}>Todas as situações</p>
        </div>
        
        <div style={{background:"#8b5cf6",borderRadius:"var(--radius-xl)",padding:"1.5rem",color:"#fff",position:"relative"}}>
          <div style={{position:"absolute",top:"1rem",right:"1rem",background:"rgba(255,255,255,0.15)",padding:"0.2rem 0.75rem",borderRadius:"999px",fontSize:"0.82rem",fontWeight:"700",color:"#fff"}}>
            {new Date().getFullYear()}
          </div>
          <h3 style={{fontSize:"1rem",fontWeight:"700",color:"#fff",marginBottom:"0.75rem"}}>Balaustres</h3>
          <p style={{fontSize:"3rem",fontWeight:"800",color:"#fff",marginBottom:"1rem"}}>
            {balaustres.filter(b => {
              if (!b.data_sessao) return false;
              const dataBalaustre = new Date(b.data_sessao + 'T00:00:00');
              return dataBalaustre.getFullYear() === new Date().getFullYear();
            }).length}
          </p>
          <div style={{borderTop:"1px solid rgba(255,255,255,0.2)",paddingTop:"0.75rem",display:"flex",flexDirection:"column",gap:"0.25rem"}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.82rem",color:"rgba(255,255,255,0.85)"}}>
              <span>⬜ Grau 1 (Aprendiz):</span>
              <span className="font-bold">
                {balaustres.filter(b => {
                  if (!b.data_sessao) return false;
                  const dataBalaustre = new Date(b.data_sessao + 'T00:00:00');
                  return b.grau_sessao === 'Aprendiz' && dataBalaustre.getFullYear() === new Date().getFullYear();
                }).length}
              </span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.82rem",color:"rgba(255,255,255,0.85)"}}>
              <span>🔷 Grau 2 (Companheiro):</span>
              <span className="font-bold">
                {balaustres.filter(b => {
                  if (!b.data_sessao) return false;
                  const dataBalaustre = new Date(b.data_sessao + 'T00:00:00');
                  return b.grau_sessao === 'Companheiro' && dataBalaustre.getFullYear() === new Date().getFullYear();
                }).length}
              </span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.82rem",color:"rgba(255,255,255,0.85)"}}>
              <span>🔺 Grau 3 (Mestre):</span>
              <span className="font-bold">
                {balaustres.filter(b => {
                  if (!b.data_sessao) return false;
                  const dataBalaustre = new Date(b.data_sessao + 'T00:00:00');
                  return b.grau_sessao === 'Mestre' && dataBalaustre.getFullYear() === new Date().getFullYear();
                }).length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Cards de Situações */}
      <div className="rounded-xl p-6 mb-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <h3 className="text-xl font-bold mb-4" style={{color:"var(--color-text)"}}>📋 Situação dos Irmãos</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div 
            style={{border:"1px solid var(--color-border)",borderLeft:"4px solid var(--color-border)",borderRadius:"var(--radius-lg)",padding:"1rem",cursor:"pointer"}}
            onDoubleClick={() => setModalSituacao({ aberto: true, titulo: '✅ Irmãos Regulares', irmaos: irmaosRegulares })}
            title="Clique duplo para ver detalhes"
          >
            <div style={{fontSize:"0.78rem",fontWeight:"700",color:"#10b981",marginBottom:"0.4rem"}}>✅ Regulares</div>
            <div style={{fontSize:"1.75rem",fontWeight:"800",color:"var(--color-text)"}}>{irmaosRegulares.length}</div>
          </div>
          <div 
            style={{border:"1px solid rgba(59,130,246,0.3)",borderLeft:"4px solid #3b82f6",borderRadius:"var(--radius-lg)",padding:"1rem",cursor:"pointer",background:"rgba(59,130,246,0.1)"}}
            onDoubleClick={() => setModalSituacao({ aberto: true, titulo: '🎫 Irmãos Licenciados', irmaos: irmaosLicenciados })}
            title="Clique duplo para ver detalhes"
          >
            <div style={{fontSize:"0.78rem",fontWeight:"700",color:"#3b82f6",marginBottom:"0.4rem"}}>🎫 Licenciados</div>
            <div className="text-3xl font-bold">{irmaosLicenciados.length}</div>
          </div>
          <div 
            style={{border:"1px solid var(--color-border)",borderLeft:"4px solid var(--color-border)",borderRadius:"var(--radius-lg)",padding:"1rem",cursor:"pointer"}}
            onDoubleClick={() => setModalSituacao({ aberto: true, titulo: '⚠️ Irmãos Irregulares', irmaos: irmaosIrregulares })}
            title="Clique duplo para ver detalhes"
          >
            <div style={{fontSize:"0.78rem",fontWeight:"700",color:"#f59e0b",marginBottom:"0.4rem"}}>⚠️ Irregulares</div>
            <div style={{fontSize:"1.75rem",fontWeight:"800",color:"var(--color-text)"}}>{irmaosIrregulares.length}</div>
          </div>
          <div 
            style={{border:"1px solid var(--color-border)",borderLeft:"4px solid var(--color-border)",borderRadius:"var(--radius-lg)",padding:"1rem",cursor:"pointer"}}
            onDoubleClick={() => setModalSituacao({ aberto: true, titulo: '🚫 Irmãos Suspensos', irmaos: irmaosSuspensos })}
            title="Clique duplo para ver detalhes"
          >
            <div style={{fontSize:"0.78rem",fontWeight:"700",color:"#ef4444",marginBottom:"0.4rem"}}>🚫 Suspensos</div>
            <div style={{fontSize:"1.75rem",fontWeight:"800",color:"var(--color-text)"}}>{irmaosSuspensos.length}</div>
          </div>
          <div 
            style={{border:"1px solid var(--color-border)",borderLeft:"4px solid var(--color-border)",borderRadius:"var(--radius-lg)",padding:"1rem",cursor:"pointer"}}
            onDoubleClick={() => setModalSituacao({ aberto: true, titulo: '↩️ Irmãos Desligados', irmaos: irmaosDesligados })}
            title="Clique duplo para ver detalhes"
          >
            <div style={{fontSize:"0.78rem",fontWeight:"700",color:"#64748b",marginBottom:"0.4rem"}}>↩️ Desligados</div>
            <div style={{fontSize:"1.75rem",fontWeight:"800",color:"var(--color-text)"}}>{irmaosDesligados.length}</div>
          </div>
          <div 
            style={{border:"1px solid var(--color-border)",borderLeft:"4px solid var(--color-border)",borderRadius:"var(--radius-lg)",padding:"1rem",cursor:"pointer"}}
            onDoubleClick={() => setModalSituacao({ aberto: true, titulo: '❌ Irmãos Excluídos', irmaos: irmaosExcluidos })}
            title="Clique duplo para ver detalhes"
          >
            <div style={{fontSize:"0.78rem",fontWeight:"700",color:"#dc2626",marginBottom:"0.4rem"}}>❌ Excluídos</div>
            <div style={{fontSize:"1.75rem",fontWeight:"800",color:"var(--color-text)"}}>{irmaosExcluidos.length}</div>
          </div>
          <div 
            style={{border:"1px solid var(--color-border)",borderLeft:"4px solid var(--color-border)",borderRadius:"var(--radius-lg)",padding:"1rem",cursor:"pointer"}}
            onDoubleClick={() => setModalSituacao({ aberto: true, titulo: '🕊️ Irmãos Falecidos', irmaos: irmaosFalecidos })}
            title="Clique duplo para ver detalhes"
          >
            <div style={{fontSize:"0.78rem",fontWeight:"700",color:"#6366f1",marginBottom:"0.4rem"}}>🕊️ Falecidos</div>
            <div style={{fontSize:"1.75rem",fontWeight:"800",color:"var(--color-text)"}}>{irmaosFalecidos.length}</div>
          </div>
          <div 
            style={{border:"1px solid rgba(99,102,241,0.3)",borderLeft:"4px solid #6366f1",borderRadius:"var(--radius-lg)",padding:"1rem",cursor:"pointer",background:"rgba(99,102,241,0.1)"}}
            onDoubleClick={() => setModalSituacao({ aberto: true, titulo: '👔 Irmãos Ex-Ofício', irmaos: irmaosExOficio })}
            title="Clique duplo para ver detalhes"
          >
            <div style={{fontSize:"0.78rem",fontWeight:"700",color:"#8b5cf6",marginBottom:"0.4rem"}}>👔 Ex-Ofício</div>
            <div style={{fontSize:"1.75rem",fontWeight:"800",color:"var(--color-text)"}}>{irmaosExOficio.length}</div>
          </div>
        </div>
      </div>

      {/* PRESENÇA 100% - 3 COLUNAS */}
      {irmaos100.length > 0 && (
        <div className="rounded-xl p-6 mb-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold flex items-center gap-2" style={{color:"var(--color-text)"}}>
              <span className="text-2xl">🏆</span>
              Presença 100% no Ano ({irmaos100.length} {irmaos100.length === 1 ? 'Irmão' : 'Irmãos'})
            </h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Dividir irmãos em 3 colunas */}
            {[0, 1, 2].map(coluna => {
              const porColuna = Math.ceil(irmaos100.length / 3);
              const inicio = coluna * porColuna;
              const fim = inicio + porColuna;
              const irmaosColuna = irmaos100.slice(inicio, fim);
              
              return (
                <div key={coluna} className="space-y-2">
                  {irmaosColuna.map(irmao => (
                    <div 
                      key={irmao.id}
                      style={{background:"var(--color-surface)",border:"1px solid rgba(16,185,129,0.3)",borderLeft:"3px solid #10b981",borderRadius:"var(--radius-md)",padding:"0.75rem"}}>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">✅</span>
                        <div className="flex-1">
                          <div style={{fontWeight:"600",fontSize:"0.82rem",color:"var(--color-text)"}}>{irmao.nome}</div>
                          <div style={{fontSize:"0.7rem",color:"var(--color-text-muted)"}}>{irmao.total} sessões</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CARDS DE VISITAS - GRID COM 2 COLUNAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Card 1: Visitas dos Irmãos a Outras Lojas */}
        {totalVisitasIrmaos > 0 && (
          <div
            onDoubleClick={() => setModalVisitasIrmaos(true)}
            style={{background:"var(--color-accent)",borderRadius:"var(--radius-xl)",padding:"1.5rem",color:"#fff",cursor:"pointer"}}
            title="Clique 2x para ver detalhes"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 style={{fontSize:"1rem",fontWeight:"700",color:"#fff"}}>📍 Visitas a Outras Lojas</h3>
              <span className="text-4xl">🚶</span>
            </div>
            <p style={{fontSize:"3rem",fontWeight:"800",marginBottom:"0.25rem"}}>{totalVisitasIrmaos}</p>
            <p style={{fontSize:"0.82rem",opacity:0.85}}>Realizadas em {new Date().getFullYear()}</p>
          </div>
        )}

        {/* Card 2: Visitantes Recebidos */}
        {totalVisitantes > 0 && (
          <div
            onDoubleClick={() => setModalVisitantesRecebidos(true)}
            style={{background:"#10b981",borderRadius:"var(--radius-xl)",padding:"1.5rem",color:"#fff",cursor:"pointer"}}
            title="Clique 2x para ver detalhes"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 style={{fontSize:"1rem",fontWeight:"700",color:"#fff"}}>👥 Visitantes Recebidos</h3>
              <span className="text-4xl">🏛️</span>
            </div>
            <p style={{fontSize:"3rem",fontWeight:"800",marginBottom:"0.25rem"}}>{totalVisitantes}</p>
            <p style={{fontSize:"0.82rem",opacity:0.85}}>Registrados em {new Date().getFullYear()}</p>
          </div>
        )}
      </div>

      {/* Card de Visitantes ANTIGO - REMOVER */}
      {false && totalVisitantes > 0 && (
        <div className="mb-6">
          <div className="text-white p-6 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <h3 style={{fontSize:"1rem",fontWeight:"700",color:"#fff"}}>👥 Visitantes Recebidos</h3>
              <span className="text-4xl">🏛️</span>
            </div>
            <p style={{fontSize:"3rem",fontWeight:"800",marginBottom:"0.25rem"}}>{totalVisitantes}</p>
            <p style={{fontSize:"0.82rem",opacity:0.85}}>Registrados em {new Date().getFullYear()}</p>
          </div>
        </div>
      )}

      {/* ANIVERSARIANTES - LAYOUT COMPACTO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* ANIVERSARIANTES DO DIA - COR MAIS CLARA */}
        <div style={{background:"var(--color-surface)",border:"1px solid var(--color-border)",borderLeft:"4px solid #f43f5e",borderRadius:"var(--radius-xl)",padding:"1.5rem"}}>
          <div className="flex items-center justify-between mb-4">
            <h3 style={{fontSize:"1.1rem",fontWeight:"700",color:"var(--color-text)"}}>🎂 Aniversariantes do Dia</h3>
            <div className="text-4xl">🎉</div>
          </div>
          
          {aniversariantes.aniversariantesHoje.length > 0 ? (
            <div className="space-y-2">
              {aniversariantes.aniversariantesHoje.map(pessoa => (
                <div 
                  key={pessoa.id}
                  style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-md)",padding:"0.75rem"}}>
                  <div style={{fontWeight:"700",color:"var(--color-text)"}}>{pessoa.nome}</div>
                  <div style={{fontSize:"0.8rem",color:"var(--color-text-muted)"}}>
                    {pessoa.vinculos && pessoa.vinculos.length > 1 ? (
                      // Múltiplos vínculos
                      <div className="space-y-1">
                        {pessoa.vinculos.map((vinculo, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span>
                              {vinculo.tipo === 'Irmão' ? '👤' : 
                               vinculo.tipo === 'Esposa' ? '💑' :
                               vinculo.tipo === 'Pai' ? '👨' :
                               vinculo.tipo === 'Mãe' ? '👩' : '👶'} {vinculo.tipo} do Irmão {vinculo.irmao}
                            </span>
                          </div>
                        ))}
                        <div className="mt-1">
                          <span>🎂 {pessoa.idade} anos hoje</span>
                        </div>
                      </div>
                    ) : (
                      // Vínculo único
                      <div className="flex items-center gap-3 flex-wrap">
                        <span>
                          {pessoa.tipo === 'Irmão' ? '👤' : 
                           pessoa.tipo === 'Esposa' ? '💑' :
                           pessoa.tipo === 'Pai' ? '👨' :
                           pessoa.tipo === 'Mãe' ? '👩' : '👶'} {pessoa.tipo}
                          {pessoa.irmaoNome && ` de ${pessoa.irmaoNome}`}
                        </span>
                        <span>•</span>
                        <span>🎂 {pessoa.idade} anos hoje</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{textAlign:"center",padding:"1.5rem",borderRadius:"var(--radius-md)",background:"var(--color-surface-2)"}}>
              <div style={{fontSize:"2rem",marginBottom:"0.5rem"}}>📅</div>
              <p style={{fontSize:"0.82rem",color:"var(--color-text-muted)"}}>Nenhum aniversariante hoje</p>
            </div>
          )}
        </div>

        {/* PRÓXIMOS 7 DIAS - LAYOUT COMPACTO */}
        <div style={{background:"var(--color-surface)",border:"1px solid var(--color-border)",borderLeft:"4px solid #06b6d4",borderRadius:"var(--radius-xl)",padding:"1.5rem"}}>
          <div className="flex items-center justify-between mb-4">
            <h3 style={{fontSize:"1.1rem",fontWeight:"700",color:"var(--color-text)"}}>📅 Próximos 7 Dias</h3>
            <div className="text-4xl">🎁</div>
          </div>
          
          {aniversariantes.proximos7Dias.length > 0 ? (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {aniversariantes.proximos7Dias.map(pessoa => (
                <div 
                  key={pessoa.id}
                  style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-md)",padding:"0.75rem"}}>
                  <div className="flex items-center justify-between mb-1">
                    <div style={{fontWeight:"700",color:"var(--color-text)",flex:1}}>{pessoa.nome}</div>
                    <div style={{background:"var(--color-accent-bg)",color:"var(--color-accent)",borderRadius:"999px",padding:"0.1rem 0.5rem",fontSize:"0.7rem",fontWeight:"700",marginLeft:"0.5rem",whiteSpace:"nowrap"}}>
                      {pessoa.diasRestantes} {pessoa.diasRestantes === 1 ? 'dia' : 'dias'}
                    </div>
                  </div>
                  <div style={{fontSize:"0.8rem",color:"var(--color-text-muted)"}}>
                    {pessoa.vinculos && pessoa.vinculos.length > 1 ? (
                      // Múltiplos vínculos
                      <div className="space-y-1">
                        {pessoa.vinculos.map((vinculo, idx) => (
                          <div key={idx}>
                            <span>
                              {vinculo.tipo === 'Irmão' ? '👤' : 
                               vinculo.tipo === 'Esposa' ? '💑' :
                               vinculo.tipo === 'Pai' ? '👨' :
                               vinculo.tipo === 'Mãe' ? '👩' : '👶'} {vinculo.tipo} do Irmão {vinculo.irmao}
                            </span>
                          </div>
                        ))}
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          <span>🎂 {pessoa.idade} anos</span>
                          <span>•</span>
                          <span>📆 {pessoa.dataAniversario.toLocaleDateString('pt-BR', { 
                            day: '2-digit', 
                            month: 'long' 
                          })}</span>
                        </div>
                      </div>
                    ) : (
                      // Vínculo único
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>
                          {pessoa.tipo === 'Irmão' ? '👤' : 
                           pessoa.tipo === 'Esposa' ? '💑' :
                           pessoa.tipo === 'Pai' ? '👨' :
                           pessoa.tipo === 'Mãe' ? '👩' : '👶'} {pessoa.tipo}
                          {pessoa.irmaoNome && ` de ${pessoa.irmaoNome}`}
                        </span>
                        <span>•</span>
                        <span>🎂 {pessoa.idade} anos</span>
                        <span>•</span>
                        <span>📆 {pessoa.dataAniversario.toLocaleDateString('pt-BR', { 
                          day: '2-digit', 
                          month: 'long' 
                        })}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{textAlign:"center",padding:"1.5rem",borderRadius:"var(--radius-md)",background:"var(--color-surface-2)"}}>
              <div style={{fontSize:"2rem",marginBottom:"0.5rem"}}>📅</div>
              <p style={{fontSize:"0.82rem",color:"var(--color-text-muted)"}}>Nenhum aniversário nos próximos 7 dias</p>
            </div>
          )}
        </div>

        {/* EVENTOS COMEMORATIVOS */}
        <div style={{background:"var(--color-surface)",border:"1px solid var(--color-border)",borderLeft:"4px solid #f59e0b",borderRadius:"var(--radius-xl)",padding:"1.5rem"}}>
          <div className="flex items-center justify-between mb-4">
            <h3 style={{fontSize:"1.1rem",fontWeight:"700",color:"var(--color-text)"}}>📅 Datas Comemorativas</h3>
            <div className="text-4xl">🎊</div>
          </div>
          
          {(() => {
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0); // Zera as horas para comparação correta
            
            console.log('📅 Dashboard - Eventos recebidos:', cronograma);
            console.log('📅 Data de hoje:', hoje);
            
            const eventosProximos = cronograma
              .filter(evento => {
                if (!evento.mes || !evento.dia) return false;
                
                // Criar data do evento no ano atual
                const anoAtual = hoje.getFullYear();
                const dataEvento = new Date(anoAtual, evento.mes - 1, evento.dia);
                dataEvento.setHours(0, 0, 0, 0);
                
                // Se já passou este ano, considerar próximo ano
                if (dataEvento < hoje) {
                  dataEvento.setFullYear(anoAtual + 1);
                }
                
                const diffDias = Math.ceil((dataEvento - hoje) / (1000 * 60 * 60 * 24));
                console.log(`Evento: ${evento.nome} - ${evento.dia}/${evento.mes} - Diff: ${diffDias} dias`);
                return diffDias >= 0 && diffDias <= 30;
              })
              .sort((a, b) => {
                const anoAtual = hoje.getFullYear();
                const dataA = new Date(anoAtual, a.mes - 1, a.dia);
                const dataB = new Date(anoAtual, b.mes - 1, b.dia);
                if (dataA < hoje) dataA.setFullYear(anoAtual + 1);
                if (dataB < hoje) dataB.setFullYear(anoAtual + 1);
                return dataA - dataB;
              })
              .slice(0, 5);

            console.log('📅 Eventos filtrados:', eventosProximos);

            return eventosProximos.length > 0 ? (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {eventosProximos.map((evento, idx) => {
                  const anoAtual = hoje.getFullYear();
                  const dataEvento = new Date(anoAtual, evento.mes - 1, evento.dia);
                  if (dataEvento < hoje) dataEvento.setFullYear(anoAtual + 1);
                  
                  const diffDias = Math.ceil((dataEvento - hoje) / (1000 * 60 * 60 * 24));
                  const ehHoje = diffDias === 0;

                  return (
                    <div 
                      key={idx}
                      style={{background:ehHoje?'rgba(245,158,11,0.15)':'var(--color-surface-2)',border:ehHoje?'1px solid rgba(245,158,11,0.4)':'1px solid var(--color-border)',borderRadius:'var(--radius-md)',padding:'0.75rem'}}
                    >
                      <div className="flex items-start gap-2">
                        <div className="text-2xl">{evento.tipo === 'Maçônico' ? '🔷' : '🎊'}</div>
                        <div className="flex-1">
                          <div style={{fontWeight:"700",color:"var(--color-text)"}}>{evento.nome}</div>
                          <div style={{fontSize:"0.78rem",color:"var(--color-text-muted)",display:"flex",alignItems:"center",gap:"0.4rem",flexWrap:"wrap",marginTop:"0.25rem"}}>
                            <span>{evento.tipo}</span>
                            <span>•</span>
                            <span>📆 {dataEvento.toLocaleDateString('pt-BR', { 
                              day: '2-digit', 
                              month: 'long' 
                            })}</span>
                            {ehHoje && (
                              <>
                                <span>•</span>
                                <span style={{background:"rgba(245,158,11,0.2)",color:"#f59e0b",padding:"0.1rem 0.5rem",borderRadius:"999px",fontSize:"0.7rem",fontWeight:"700"}}>
                                  HOJE
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{textAlign:"center",padding:"1.5rem",borderRadius:"var(--radius-md)",background:"var(--color-surface-2)"}}>
                <div style={{fontSize:"2rem",marginBottom:"0.5rem"}}>📅</div>
                <p style={{fontSize:"0.82rem",color:"var(--color-text-muted)"}}>Nenhum evento nos próximos 30 dias</p>
              </div>
            );
          })()}
        </div>
      </div>

      {/* PARTICIPAÇÃO EM COMISSÕES */}
      <ParticipacaoComissoes />

      <div className="rounded-xl p-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <h3 className="text-xl font-bold mb-4" style={{color:"var(--color-text)"}}>Bem-vindo ao Sistema</h3>
        <p style={{color:"var(--color-text-muted)"}}>
          Utilize o menu de navegação para acessar as diferentes funcionalidades do sistema.
        </p>
      </div>

      {/* Modal de Situação dos Irmãos */}
      {modalSituacao.aberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            {/* Header */}
            <div style={{background:"var(--color-accent)",padding:"1rem 1.5rem"}}>
              <div className="flex justify-between items-center">
                <h3 style={{fontSize:"1.1rem",fontWeight:"700",color:"#fff",margin:0}}>{modalSituacao.titulo}</h3>
                <button
                  onClick={() => {
                    setModalSituacao({ aberto: false, titulo: '', irmaos: [] });
                    setFiltroComCargo(false);
                  }}
                  style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",color:"#fff",borderRadius:"50%",width:"2rem",height:"2rem",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:"1.1rem",fontWeight:"700"}}
                >
                  ×
                </button>
              </div>
              <p style={{fontSize:"0.82rem",color:"rgba(255,255,255,0.85)",marginTop:"0.25rem"}}>
                Total: {modalSituacao.irmaos.filter(i => !filtroComCargo || obterCargoAtual(i.id)).length} {modalSituacao.irmaos.filter(i => !filtroComCargo || obterCargoAtual(i.id)).length === 1 ? 'irmão' : 'irmãos'}
              </p>
              
              {/* Filtro apenas para Regulares */}
              {modalSituacao.titulo.includes('Regulares') && (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setFiltroComCargo(false)}
                    style={{padding:'0.2rem 0.65rem',borderRadius:'var(--radius-md)',fontSize:'0.72rem',fontWeight:'700',cursor:'pointer',border:'none',background:!filtroComCargo?'rgba(255,255,255,0.3)':'rgba(255,255,255,0.1)',color:'#fff'}}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setFiltroComCargo(true)}
                    style={{padding:'0.2rem 0.65rem',borderRadius:'var(--radius-md)',fontSize:'0.72rem',fontWeight:'700',cursor:'pointer',border:'none',background:filtroComCargo?'rgba(255,255,255,0.3)':'rgba(255,255,255,0.1)',color:'#fff'}}
                  >
                    Apenas com Cargo
                  </button>
                </div>
              )}
            </div>

            {/* Corpo */}
            <div className="p-6 overflow-y-auto flex-1">
              {(() => {
                const irmaosFiltrados = modalSituacao.irmaos.filter(i => 
                  !filtroComCargo || obterCargoAtual(i.id)
                );
                
                return irmaosFiltrados.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {irmaosFiltrados.map((irmao) => (
                    <div key={irmao.id} className="border-2 rounded-lg p-4 hover: transition" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                      <div className="flex items-start gap-3">
                        {irmao.foto_url ? (
                          <img src={irmao.foto_url} alt={irmao.nome} className="w-16 h-16 rounded-full object-cover border-2" />
                        ) : (
                          <div style={{width:"4rem",height:"4rem",borderRadius:"50%",background:"var(--color-accent)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:"700",fontSize:"1.25rem"}}>
                            {irmao.nome?.charAt(0)}
                          </div>
                        )}
                        
                        <div className="flex-1">
                          <h4 className="font-bold flex items-center gap-2" style={{color:"var(--color-text)"}}>
                            {modalSituacao.titulo.includes('Falecidos') && <span className="text-lg">🕊️</span>}
                            {formatarNome(irmao.nome)}
                          </h4>
                          
                          <div className="flex flex-wrap gap-2 mt-2">
                            {/* Badge de Grau */}
                            <span style={{fontSize:'0.7rem',padding:'0.15rem 0.5rem',borderRadius:'var(--radius-sm)',fontWeight:'700',
                              background:obterGrau(irmao)==='Mestre Instalado'?'rgba(245,158,11,0.15)':obterGrau(irmao)==='Mestre'?'rgba(139,92,246,0.15)':obterGrau(irmao)==='Companheiro'?'rgba(16,185,129,0.15)':'rgba(59,130,246,0.15)',
                              color:obterGrau(irmao)==='Mestre Instalado'?'#f59e0b':obterGrau(irmao)==='Mestre'?'#8b5cf6':obterGrau(irmao)==='Companheiro'?'#10b981':'#3b82f6'}}>
                              {obterGrau(irmao)}
                            </span>

                            {/* Badge de Cargo (do histórico do ano atual) */}
                            {obterCargoAtual(irmao.id) && (
                              <div className="flex flex-col gap-1">
                                {obterCargoAtual(irmao.id).split(',').map((cargo, i) => (
                                  <span key={i} style={{fontSize:"0.7rem",padding:"0.15rem 0.5rem",borderRadius:"var(--radius-sm)",fontWeight:"700",background:"rgba(245,158,11,0.15)",color:"#f59e0b",border:"1px solid rgba(245,158,11,0.3)"}}>
                                    {cargo.trim()}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* CIM */}
                          {irmao.cim && (
                            <p style={{fontSize:"0.72rem",color:"var(--color-text-muted)",marginTop:"0.5rem"}}>CIM: {irmao.cim}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-4xl mb-3">📭</p>
                  <p>{filtroComCargo ? 'Nenhum irmão com cargo nesta categoria' : 'Nenhum irmão nesta categoria'}</p>
                </div>
              );
              })()}
            </div>

            {/* Footer */}
            <div style={{borderTop:"1px solid var(--color-border)",padding:"1rem 1.5rem"}}>
              <button
                onClick={() => {
                  setModalSituacao({ aberto: false, titulo: '', irmaos: [] });
                  setFiltroComCargo(false);
                }}
                style={{width:"100%",padding:"0.75rem 1.5rem",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"700"}}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Visitas dos Irmãos a Outras Lojas */}
      {modalVisitasIrmaos && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            {/* Header */}
            <div style={{background:"var(--color-accent)",padding:"1.25rem 1.5rem"}}>
              <h3 style={{fontSize:"1.25rem",fontWeight:"700",color:"#fff",margin:0}}>📍 Visitas dos Irmãos a Outras Lojas - {new Date().getFullYear()}</h3>
              <p style={{fontSize:"0.82rem",color:"rgba(255,255,255,0.85)",marginTop:"0.25rem"}}>Total: {totalVisitasIrmaos} visita(s)</p>
            </div>

            {/* Conteúdo */}
            <div className="p-6">
              <div className="grid grid-cols-3 gap-3">
                {visitasIrmaos.map(visita => (
                  <div key={visita.id} className="border rounded-lg p-3 hover: transition-shadow" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                    {/* Linha 1: Data e Nome */}
                    <div className="mb-1">
                      <div style={{fontSize:"0.82rem",color:"var(--color-text)"}}>
                        <span>{new Date(visita.data_visita + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                        <span> - </span>
                        <span className="font-semibold">{formatarNomeCurto(visita.irmaos?.nome)}</span>
                      </div>
                    </div>
                    
                    {/* Linha 2: Loja - Potência - Oriente */}
                    <div style={{fontSize:"0.72rem",color:"var(--color-text-muted)"}}>
                      {visita.nome_loja} - {visita.potencias_masonicas?.sigla || 'N/A'} - {visita.oriente}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div style={{borderTop:"1px solid var(--color-border)",padding:"1rem 1.5rem"}}>
              <button
                onClick={() => setModalVisitasIrmaos(false)}
                style={{width:"100%",padding:"0.75rem 1.5rem",background:"var(--color-accent)",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"700"}}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Visitantes Recebidos */}
      {modalVisitantesRecebidos && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            {/* Header */}
            <div style={{background:"#10b981",padding:"1.25rem 1.5rem"}}>
              <h3 style={{fontSize:"1.25rem",fontWeight:"700",color:"#fff",margin:0}}>👥 Visitantes Recebidos - {new Date().getFullYear()}</h3>
              <p style={{fontSize:"0.82rem",color:"rgba(255,255,255,0.85)",marginTop:"0.25rem"}}>Total: {totalVisitantes} visitante(s)</p>
            </div>

            {/* Conteúdo */}
            <div className="p-6">
              <div className="grid grid-cols-3 gap-3">
                {visitantesRecebidos.map(visitante => (
                  <div key={visitante.id} className="border border-indigo-200 rounded-lg p-3 hover: transition-shadow" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                    {/* Linha 1: Data e Nome */}
                    <div className="mb-1">
                      <div style={{fontSize:"0.82rem",color:"var(--color-text)"}}>
                        <span>
                          {visitante.sessoes_presenca?.data_sessao 
                            ? new Date(visitante.sessoes_presenca.data_sessao + 'T00:00:00').toLocaleDateString('pt-BR')
                            : visitante.data_visita
                            ? new Date(visitante.data_visita + 'T00:00:00').toLocaleDateString('pt-BR')
                            : new Date(visitante.created_at).toLocaleDateString('pt-BR')}
                        </span>
                        <span> - </span>
                        <span className="font-semibold">
                          {visitante.nome || visitante.nome_visitante || 'N/A'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Linha 2: Loja - Oriente */}
                    <div style={{fontSize:"0.72rem",color:"var(--color-text-muted)"}}>
                      {visitante.nome_loja || visitante.loja_origem || visitante.loja || visitante.loja_visitante || 'Loja não informada'} - {visitante.oriente || visitante.cidade || visitante.oriente_visitante || 'Oriente não informado'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div style={{borderTop:"1px solid var(--color-border)",padding:"1rem 1.5rem"}}>
              <button
                onClick={() => setModalVisitantesRecebidos(false)}
                style={{width:"100%",padding:"0.75rem 1.5rem",background:"#10b981",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"700"}}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
