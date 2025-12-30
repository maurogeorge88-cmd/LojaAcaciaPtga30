/**
 * COMPONENTE DASHBOARD
 * Sistema A∴R∴L∴S∴ Acácia de Paranatinga nº 30
 */

import React, { useMemo, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export const Dashboard = ({ irmaos, balaustres, cronograma = [] }) => {
  const [historicoSituacoes, setHistoricoSituacoes] = useState([]);
  const [irmaos100, setIrmaos100] = useState([]);

  useEffect(() => {
    const carregar = async () => {
      const { data } = await supabase
        .from('historico_situacoes')
        .select('*')
        .eq('status', 'ativa');
      setHistoricoSituacoes(data || []);
    };
    carregar();
  }, []);

  useEffect(() => {
    const carregarPresenca100 = async () => {
      try {
        const anoAtual = new Date().getFullYear();
        const inicioAno = `${anoAtual}-01-01`;
        const fimAno = `${anoAtual}-12-31`;

        // 1. Buscar todas as sessões do ano
        const { data: sessoesAno } = await supabase
          .from('sessoes_presenca')
          .select('id, data_sessao, grau_sessao_id')
          .gte('data_sessao', inicioAno)
          .lte('data_sessao', fimAno);

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
              const grauSessao = sessao.grau_sessao_id || 1;

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

        setIrmaos100(com100);
      } catch (error) {
        console.error('Erro ao carregar presença 100%:', error);
      }
    };

    carregarPresenca100();
  }, []);

  // Função para determinar o grau do irmão
  const obterGrau = (irmao) => {
    if (irmao.data_exaltacao) return 'Mestre';
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

  // Contagem por grau (apenas regulares)
  const irmaosAprendiz = irmaosRegulares.filter(i => obterGrau(i) === 'Aprendiz').length;
  const irmaosCompanheiro = irmaosRegulares.filter(i => obterGrau(i) === 'Companheiro').length;
  const irmaosMestre = irmaosRegulares.filter(i => obterGrau(i) === 'Mestre').length;

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

    // Irmãos
    irmaos.forEach(irmao => {
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
    <div>
      {/* Cards de Graus */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-xl shadow-lg">
          <h3 className="text-lg font-semibold mb-3">Irmãos Regulares</h3>
          <p className="text-5xl font-bold mb-4">{irmaosRegulares.length}</p>
          <div className="border-t border-blue-400 pt-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span>⬜ Aprendizes:</span>
              <span className="font-bold">{irmaosAprendiz}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>🔷 Companheiros:</span>
              <span className="font-bold">{irmaosCompanheiro}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>🔺 Mestres:</span>
              <span className="font-bold">{irmaosMestre}</span>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-xl shadow-lg">
          <h3 className="text-lg font-semibold mb-2">Total Geral</h3>
          <p className="text-4xl font-bold mb-2">{totalIrmaos}</p>
          <p className="text-sm opacity-90">Todas as situações</p>
        </div>
        
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-xl shadow-lg relative">
          <div className="absolute top-4 right-4 bg-white/20 px-3 py-1 rounded-full text-sm font-bold">
            {new Date().getFullYear()}
          </div>
          <h3 className="text-lg font-semibold mb-3">Balaustres</h3>
          <p className="text-5xl font-bold mb-4">
            {balaustres.filter(b => {
              if (!b.data_sessao) return false;
              const dataBalaustre = new Date(b.data_sessao + 'T00:00:00');
              return dataBalaustre.getFullYear() === new Date().getFullYear();
            }).length}
          </p>
          <div className="border-t border-purple-400 pt-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span>⬜ Grau 1 (Aprendiz):</span>
              <span className="font-bold">
                {balaustres.filter(b => {
                  if (!b.data_sessao) return false;
                  const dataBalaustre = new Date(b.data_sessao + 'T00:00:00');
                  return b.grau_sessao === 'Aprendiz' && dataBalaustre.getFullYear() === new Date().getFullYear();
                }).length}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>🔷 Grau 2 (Companheiro):</span>
              <span className="font-bold">
                {balaustres.filter(b => {
                  if (!b.data_sessao) return false;
                  const dataBalaustre = new Date(b.data_sessao + 'T00:00:00');
                  return b.grau_sessao === 'Companheiro' && dataBalaustre.getFullYear() === new Date().getFullYear();
                }).length}
              </span>
            </div>
            <div className="flex justify-between text-sm">
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
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">📋 Situação dos Irmãos</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-green-50 border-2 border-green-200 p-4 rounded-lg">
            <div className="text-green-600 text-sm font-semibold mb-1">✅ Regulares</div>
            <div className="text-3xl font-bold text-green-700">{irmaosRegulares.length}</div>
          </div>
          <div className="bg-yellow-50 border-2 border-yellow-200 p-4 rounded-lg">
            <div className="text-yellow-600 text-sm font-semibold mb-1">⚠️ Irregulares</div>
            <div className="text-3xl font-bold text-yellow-700">{irmaosIrregulares.length}</div>
          </div>
          <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-lg">
            <div className="text-blue-600 text-sm font-semibold mb-1">🎫 Licenciados</div>
            <div className="text-3xl font-bold text-blue-700">{irmaosLicenciados.length}</div>
          </div>
          <div className="bg-orange-50 border-2 border-orange-200 p-4 rounded-lg">
            <div className="text-orange-600 text-sm font-semibold mb-1">🚫 Suspensos</div>
            <div className="text-3xl font-bold text-orange-700">{irmaosSuspensos.length}</div>
          </div>
          <div className="bg-gray-50 border-2 border-gray-200 p-4 rounded-lg">
            <div className="text-gray-600 text-sm font-semibold mb-1">↩️ Desligados</div>
            <div className="text-3xl font-bold text-gray-700">{irmaosDesligados.length}</div>
          </div>
          <div className="bg-red-50 border-2 border-red-200 p-4 rounded-lg">
            <div className="text-red-600 text-sm font-semibold mb-1">❌ Excluídos</div>
            <div className="text-3xl font-bold text-red-700">{irmaosExcluidos.length}</div>
          </div>
          <div className="bg-purple-50 border-2 border-purple-200 p-4 rounded-lg">
            <div className="text-purple-600 text-sm font-semibold mb-1">🕊️ Falecidos</div>
            <div className="text-3xl font-bold text-purple-700">{irmaosFalecidos.length}</div>
          </div>
          <div className="bg-indigo-50 border-2 border-indigo-200 p-4 rounded-lg">
            <div className="text-indigo-600 text-sm font-semibold mb-1">👔 Ex-Ofício</div>
            <div className="text-3xl font-bold text-indigo-700">{irmaosExOficio.length}</div>
          </div>
        </div>
      </div>

      {/* PRESENÇA 100% - 3 COLUNAS */}
      {irmaos100.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
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
                      className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg p-3 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-green-600 text-xl">✅</span>
                        <div className="flex-1">
                          <div className="font-semibold text-gray-800 text-sm">{irmao.nome}</div>
                          <div className="text-xs text-gray-600">{irmao.total} sessões</div>
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

      {/* ANIVERSARIANTES - LAYOUT COMPACTO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* ANIVERSARIANTES DO DIA - COR MAIS CLARA */}
        <div className="bg-gradient-to-br from-pink-300 to-rose-400 text-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold">🎂 Aniversariantes do Dia</h3>
            <div className="text-4xl">🎉</div>
          </div>
          
          {aniversariantes.aniversariantesHoje.length > 0 ? (
            <div className="space-y-2">
              {aniversariantes.aniversariantesHoje.map(pessoa => (
                <div 
                  key={pessoa.id}
                  className="bg-white/20 backdrop-blur-sm rounded-lg p-3 border border-white/30"
                >
                  <div className="font-bold text-base">{pessoa.nome}</div>
                  <div className="text-sm opacity-90">
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
            <div className="text-center py-6 bg-white/10 rounded-lg">
              <div className="text-3xl mb-2">📅</div>
              <p className="text-white/80 text-sm">Nenhum aniversariante hoje</p>
            </div>
          )}
        </div>

        {/* PRÓXIMOS 7 DIAS - LAYOUT COMPACTO */}
        <div className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold">📅 Próximos 7 Dias</h3>
            <div className="text-4xl">🎁</div>
          </div>
          
          {aniversariantes.proximos7Dias.length > 0 ? (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {aniversariantes.proximos7Dias.map(pessoa => (
                <div 
                  key={pessoa.id}
                  className="bg-white/20 backdrop-blur-sm rounded-lg p-3 border border-white/30"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-bold text-base flex-1">{pessoa.nome}</div>
                    <div className="bg-white/30 rounded-full px-2 py-0.5 text-xs font-bold ml-2">
                      {pessoa.diasRestantes} {pessoa.diasRestantes === 1 ? 'dia' : 'dias'}
                    </div>
                  </div>
                  <div className="text-sm opacity-90">
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
            <div className="text-center py-6 bg-white/10 rounded-lg">
              <div className="text-3xl mb-2">📅</div>
              <p className="text-white/80 text-sm">Nenhum aniversário nos próximos 7 dias</p>
            </div>
          )}
        </div>

        {/* EVENTOS COMEMORATIVOS */}
        <div className="bg-gradient-to-br from-amber-400 to-orange-500 text-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold">📅 Datas Comemorativas</h3>
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
                      className={`backdrop-blur-sm rounded-lg p-3 border ${
                        ehHoje 
                          ? 'bg-yellow-300/40 border-yellow-200' 
                          : 'bg-white/20 border-white/30'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="text-2xl">{evento.tipo === 'Maçônico' ? '🔷' : '🎊'}</div>
                        <div className="flex-1">
                          <div className="font-bold text-base">{evento.nome}</div>
                          <div className="text-sm opacity-90 flex items-center gap-2 flex-wrap mt-1">
                            <span>{evento.tipo}</span>
                            <span>•</span>
                            <span>📆 {dataEvento.toLocaleDateString('pt-BR', { 
                              day: '2-digit', 
                              month: 'long' 
                            })}</span>
                            {ehHoje && (
                              <>
                                <span>•</span>
                                <span className="bg-yellow-300 text-yellow-900 px-2 py-0.5 rounded-full text-xs font-bold">
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
              <div className="text-center py-6 bg-white/10 rounded-lg">
                <div className="text-3xl mb-2">📅</div>
                <p className="text-white/80 text-sm">Nenhum evento nos próximos 30 dias</p>
              </div>
            );
          })()}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Bem-vindo ao Sistema</h3>
        <p className="text-gray-600">
          Utilize o menu de navegação para acessar as diferentes funcionalidades do sistema.
        </p>
      </div>
    </div>
  );
};
