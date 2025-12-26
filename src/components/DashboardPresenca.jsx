import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import ModalVisualizarPresenca from './ModalVisualizarPresenca';
import ModalEditarSessao from './ModalEditarSessao';
import ModalGradePresenca from './ModalGradePresenca';

export default function DashboardPresenca({ onEditarPresenca }) {
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('mes'); // mes, trimestre, semestre, ano
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [sessaoIdModal, setSessaoIdModal] = useState(null);
  const [sessaoIdEditar, setSessaoIdEditar] = useState(null);
  const [mostrarGrade, setMostrarGrade] = useState(false);
  const [anoRanking, setAnoRanking] = useState(new Date().getFullYear());
  const [anoProblemas, setAnoProblemas] = useState(new Date().getFullYear());
  const [periodoProblemas, setPeriodoProblemas] = useState('anual'); // mensal, trimestral, semestral, anual
  const [estatisticas, setEstatisticas] = useState({
    totalSessoes: 0,
    totalIrmaos: 0,
    mediaPresenca: 0,
    irmaosComAlerta: 0
  });
  const [sessoesRecentes, setSessoesRecentes] = useState([]);
  const [irmaosComProblemas, setIrmaosComProblemas] = useState([]);
  const [rankingPresenca, setRankingPresenca] = useState([]);

  useEffect(() => {
    calcularDatas();
  }, [periodo]);

  useEffect(() => {
    if (dataInicio && dataFim) {
      carregarDados();
    }
  }, [dataInicio, dataFim, anoRanking]);

  useEffect(() => {
    carregarProblemas();
  }, [anoProblemas, periodoProblemas]);

  const calcularDatas = () => {
    const hoje = new Date();
    let inicio = new Date();
    let fim = new Date();

    switch (periodo) {
      case 'mes':
        inicio.setMonth(hoje.getMonth() - 1);
        inicio.setHours(0, 0, 0, 0);
        // Incluir até 7 dias no futuro
        fim.setDate(hoje.getDate() + 7);
        fim.setHours(23, 59, 59, 999);
        break;
      case 'trimestre':
        inicio.setMonth(hoje.getMonth() - 3);
        inicio.setHours(0, 0, 0, 0);
        fim.setDate(hoje.getDate() + 7);
        fim.setHours(23, 59, 59, 999);
        break;
      case 'semestre':
        inicio.setMonth(hoje.getMonth() - 6);
        inicio.setHours(0, 0, 0, 0);
        fim.setDate(hoje.getDate() + 7);
        fim.setHours(23, 59, 59, 999);
        break;
      case 'ano':
        inicio.setFullYear(hoje.getFullYear() - 1);
        inicio.setHours(0, 0, 0, 0);
        fim.setDate(hoje.getDate() + 7);
        fim.setHours(23, 59, 59, 999);
        break;
    }

    setDataInicio(inicio.toISOString().split('T')[0]);
    setDataFim(fim.toISOString().split('T')[0]);
  };

  const carregarDados = async () => {
    try {
      setLoading(true);

      console.log('DEBUG - Carregando sessões com período:', dataInicio, 'até', dataFim);

      // 1. Carregar sessões do período
      const { data: sessoes, error: erroSessoes } = await supabase
        .from('vw_sessoes_completas')
        .select('*')
        .gte('data_sessao', dataInicio)
        .lte('data_sessao', dataFim)
        .order('data_sessao', { ascending: false });

      console.log('DEBUG - Sessões retornadas:', sessoes);
      console.log('DEBUG - Erro:', erroSessoes);

      if (erroSessoes) throw erroSessoes;

      setSessoesRecentes(sessoes || []);

      // 2. Calcular estatísticas gerais
      const totalSessoes = sessoes?.length || 0;
      const totalPresencas = sessoes?.reduce((acc, s) => acc + (s.total_presentes || 0), 0) || 0;
      const totalRegistros = sessoes?.reduce((acc, s) => acc + (s.total_registros || 0), 0) || 0;
      const mediaPresenca = totalRegistros > 0 ? Math.round((totalPresencas / totalRegistros) * 100) : 0;

      // 3. Buscar resumo de cada irmão (OTIMIZADO - usa a view)
      const inicioAno = `${anoRanking}-01-01`;
      const fimAno = `${anoRanking}-12-31`;

      // Usar a view que já faz os cálculos
      const { data: resumoIrmaos, error: erroResumo } = await supabase
        .from('vw_resumo_presencas_membros')
        .select('*');

      if (erroResumo) throw erroResumo;

      const totalIrmaos = resumoIrmaos?.length || 0;

      // 4. Identificar irmãos com problemas com filtro próprio
      await carregarProblemas();

      // 5. Criar ranking (TODOS com 100% de presença no ano selecionado)
      // Filtrar por ano calculando no frontend
      const rankingAno = resumoIrmaos?.filter(i => {
        // Considera apenas irmãos com sessões registradas
        return i.total_sessoes_obrigatorias > 0 && i.taxa_presenca === 100;
      }).sort((a, b) => b.presencas_obrigatorias - a.presencas_obrigatorias) || [];

      setRankingPresenca(rankingAno); // Todos com 100%

      // 6. Contar alertas (5+ ausências injustificadas)
      const comAlerta = resumoIrmaos?.filter(i => 
        i.ausencias_injustificadas >= 5
      ).length || 0;

      setEstatisticas({
        totalSessoes,
        totalIrmaos,
        mediaPresenca,
        irmaosComAlerta: comAlerta
      });

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const carregarProblemas = async () => {
    try {
      // Buscar todos os irmãos regulares com grau calculado
      const { data: todosIrmaos, error: erroTodos } = await supabase
        .from('irmaos')
        .select('id, nome, data_iniciacao, data_elevacao, data_exaltacao')
        .ilike('situacao', 'regular');

      if (erroTodos) throw erroTodos;

      // Buscar todas as sessões do período selecionado
      const hoje = new Date();
      let inicioProblemas, fimProblemas;

      switch (periodoProblemas) {
        case 'mensal':
          inicioProblemas = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
          fimProblemas = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
          break;
        case 'trimestral':
          const trimestreAtual = Math.floor(hoje.getMonth() / 3);
          inicioProblemas = new Date(hoje.getFullYear(), trimestreAtual * 3, 1);
          fimProblemas = new Date(hoje.getFullYear(), (trimestreAtual + 1) * 3, 0);
          break;
        case 'semestral':
          const semestreAtual = Math.floor(hoje.getMonth() / 6);
          inicioProblemas = new Date(hoje.getFullYear(), semestreAtual * 6, 1);
          fimProblemas = new Date(hoje.getFullYear(), (semestreAtual + 1) * 6, 0);
          break;
        case 'anual':
          inicioProblemas = new Date(anoProblemas, 0, 1);
          fimProblemas = new Date(anoProblemas, 11, 31);
          break;
      }

      const inicioStr = inicioProblemas.toISOString().split('T')[0];
      const fimStr = fimProblemas.toISOString().split('T')[0];

      // Buscar todas as sessões com informação do grau
      const { data: sessoesPeriodo, error: erroSessoes } = await supabase
        .from('sessoes_presenca')
        .select(`
          id, 
          grau_sessao_id,
          graus_sessao:grau_sessao_id (nome)
        `)
        .gte('data_sessao', inicioStr)
        .lte('data_sessao', fimStr);

      if (erroSessoes) throw erroSessoes;

      const sessaoIds = sessoesPeriodo.map(s => s.id);

      // Buscar todos os registros de presença de uma vez
      let registrosPresenca = [];
      if (sessaoIds.length > 0) {
        const { data: registros, error: erroRegistros } = await supabase
          .from('registros_presenca')
          .select('sessao_id, membro_id, presente, justificativa')
          .in('sessao_id', sessaoIds);

        if (erroRegistros) throw erroRegistros;
        registrosPresenca = registros || [];
      }

      // Calcular estatísticas para cada irmão
      const problemasCompleto = [];
      for (const irmao of todosIrmaos) {
        // Calcular grau
        let grau = 'Sem Grau';
        if (irmao.data_exaltacao) grau = 'Mestre';
        else if (irmao.data_elevacao) grau = 'Companheiro';
        else if (irmao.data_iniciacao) grau = 'Aprendiz';

        // Filtrar sessões que o irmão PODE participar baseado no grau
        const sessoesElegiveis = sessoesPeriodo.filter(sessao => {
          const tipoSessao = sessao.graus_sessao?.nome;
          
          if (grau === 'Aprendiz') {
            return tipoSessao === 'Sessão de Aprendiz' || tipoSessao === 'Sessão Administrativa';
          }
          if (grau === 'Companheiro') {
            return tipoSessao === 'Sessão de Aprendiz' || 
                   tipoSessao === 'Sessão de Companheiro' || 
                   tipoSessao === 'Sessão Administrativa';
          }
          if (grau === 'Mestre') {
            return true; // Mestre pode participar de todas
          }
          return tipoSessao === 'Sessão Administrativa'; // Sem grau só administrativa
        });

        // Filtrar registros deste irmão apenas nas sessões elegíveis
        const idsElegiveis = sessoesElegiveis.map(s => s.id);
        const registrosIrmao = registrosPresenca.filter(r => 
          r.membro_id === irmao.id && idsElegiveis.includes(r.sessao_id)
        );
        
        const totalSessoes = sessoesElegiveis.length;
        const presentes = registrosIrmao.filter(r => r.presente).length;
        const ausentesJust = registrosIrmao.filter(r => !r.presente && r.justificativa).length;
        const ausentesInjust = registrosIrmao.filter(r => !r.presente && !r.justificativa).length;
        
        const taxa = totalSessoes > 0 ? (presentes / totalSessoes) * 100 : 0;

        // Critérios para aparecer no quadro de problemas:
        // 1. Tem sessões elegíveis no período
        // 2. Taxa de presença < 70%
        // 3. Tem pelo menos 2 ausências injustificadas (senão é caso pontual)
        const deveAparecerNoQuadro = totalSessoes > 0 && 
                                     taxa < 70 && 
                                     ausentesInjust >= 2;

        if (deveAparecerNoQuadro) {
          problemasCompleto.push({
            membro_id: irmao.id,
            nome: irmao.nome,
            grau: grau,
            total_sessoes_obrigatorias: totalSessoes,
            presencas_obrigatorias: presentes,
            ausencias_justificadas: ausentesJust,
            ausencias_injustificadas: ausentesInjust,
            taxa_presenca: taxa
          });
        }
      }

      // Ordenar por taxa (menor primeiro)
      problemasCompleto.sort((a, b) => a.taxa_presenca - b.taxa_presenca);
      setIrmaosComProblemas(problemasCompleto);

    } catch (error) {
      console.error('Erro ao carregar problemas:', error);
    }
  };

  const formatarData = (data) => {
    if (!data) return '-';
    return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
  };

  const obterCorTaxa = (taxa) => {
    if (taxa >= 90) return 'text-green-600 bg-green-100';
    if (taxa >= 70) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              Dashboard de Presença
            </h2>
            <p className="text-gray-600 mt-1">
              Visão geral da frequência dos irmãos
            </p>
          </div>

          <div className="flex gap-3">
            {/* Botão Ver Grade */}
            <button
              onClick={() => setMostrarGrade(true)}
              className="px-6 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition font-medium"
            >
              📊 Ver Grade Completa
            </button>

            {/* Filtro de Período */}
            <div className="flex gap-2">
            <button
              onClick={() => setPeriodo('mes')}
              className={`px-4 py-2 rounded-md transition ${
                periodo === 'mes'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Último Mês
            </button>
            <button
              onClick={() => setPeriodo('trimestre')}
              className={`px-4 py-2 rounded-md transition ${
                periodo === 'trimestre'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Trimestre
            </button>
            <button
              onClick={() => setPeriodo('semestre')}
              className={`px-4 py-2 rounded-md transition ${
                periodo === 'semestre'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Semestre
            </button>
            <button
              onClick={() => setPeriodo('ano')}
              className={`px-4 py-2 rounded-md transition ${
                periodo === 'ano'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Ano
            </button>
          </div>
          </div>
        </div>

        {/* Período Selecionado */}
        <div className="mt-4 text-sm text-gray-600">
          Período: {formatarData(dataInicio)} até {formatarData(dataFim)}
        </div>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Total de Sessões */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Total de Sessões</p>
              <p className="text-4xl font-bold mt-2">{estatisticas.totalSessoes}</p>
            </div>
            <div className="bg-white bg-opacity-20 rounded-full p-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Total de Irmãos Ativos */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-md p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">Irmãos Ativos</p>
              <p className="text-4xl font-bold mt-2">{estatisticas.totalIrmaos}</p>
            </div>
            <div className="bg-white bg-opacity-20 rounded-full p-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Média de Presença */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-md p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">Média de Presença</p>
              <p className="text-4xl font-bold mt-2">{estatisticas.mediaPresenca}%</p>
            </div>
            <div className="bg-white bg-opacity-20 rounded-full p-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Irmãos com Alerta */}
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-md p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm font-medium">Alertas (5+ Faltas)</p>
              <p className="text-4xl font-bold mt-2">{estatisticas.irmaosComAlerta}</p>
            </div>
            <div className="bg-white bg-opacity-20 rounded-full p-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Duas Colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sessões Recentes */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">
            Sessões Recentes
          </h3>
          {sessoesRecentes.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Nenhuma sessão no período</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {sessoesRecentes.slice(0, 10).map((sessao) => {
                const percentual = sessao.total_registros > 0 
                  ? Math.round((sessao.total_presentes / sessao.total_registros) * 100) 
                  : 0;

                return (
                  <div key={sessao.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">{sessao.grau_sessao}</p>
                        <p className="text-sm text-gray-600">{formatarData(sessao.data_sessao)}</p>
                        {sessao.classificacao && (
                          <span className="inline-block mt-1 px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">
                            {sessao.classificacao}
                          </span>
                        )}
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <div>
                          <div className={`text-2xl font-bold px-3 py-1 rounded ${obterCorTaxa(percentual)}`}>
                            {percentual}%
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {sessao.total_presentes}/{sessao.total_registros}
                          </p>
                        </div>
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => setSessaoIdModal(sessao.id)}
                            className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition"
                            title="Ver detalhes"
                          >
                            👁️ Ver
                          </button>
                          <button
                            onClick={() => setSessaoIdEditar(sessao.id)}
                            className="px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition"
                            title="Editar sessão"
                          >
                            ✏️ Editar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Ranking de Presença */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800">
              🏆 100% de Presença
            </h3>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Ano:</label>
              <select
                value={anoRanking}
                onChange={(e) => setAnoRanking(parseInt(e.target.value))}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: 6 }, (_, i) => 2025 + i).map(ano => (
                  <option key={ano} value={ano}>{ano}</option>
                ))}
              </select>
            </div>
          </div>
          {rankingPresenca.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              Nenhum irmão com 100% de presença em {anoRanking}
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {rankingPresenca.map((irmao, index) => (
                <div key={irmao.membro_id} className="flex items-center gap-3 border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                    index === 0 ? 'bg-yellow-400 text-yellow-900' :
                    index === 1 ? 'bg-gray-300 text-gray-700' :
                    index === 2 ? 'bg-orange-300 text-orange-900' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">{irmao.nome}</p>
                    <p className="text-xs text-gray-500">
                      {irmao.presencas_obrigatorias}/{irmao.total_sessoes_obrigatorias} sessões
                    </p>
                  </div>
                  <div className="text-xl font-bold px-3 py-1 rounded bg-green-100 text-green-800">
                    100%
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Irmãos com Problemas de Frequência */}
      {irmaosComProblemas.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-red-600">
              ⚠️ Atenção: Irmãos com Baixa Frequência ({"<"}70%)
            </h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Período:</label>
                <select
                  value={periodoProblemas}
                  onChange={(e) => setPeriodoProblemas(e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="mensal">Mensal</option>
                  <option value="trimestral">Trimestral</option>
                  <option value="semestral">Semestral</option>
                  <option value="anual">Anual</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Ano:</label>
                <select
                  value={anoProblemas}
                  onChange={(e) => setAnoProblemas(parseInt(e.target.value))}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Array.from({ length: 6 }, (_, i) => 2025 + i).map(ano => (
                    <option key={ano} value={ano}>{ano}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Irmão
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Grau
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Presença
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Ausências Injustificadas
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Taxa
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {irmaosComProblemas.map((irmao) => (
                  <tr key={irmao.membro_id} className="hover:bg-red-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{irmao.nome}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded">
                        {irmao.grau}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-700">
                      {irmao.presencas_obrigatorias}/{irmao.total_sessoes_obrigatorias}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-2 py-1 text-sm font-semibold rounded ${
                        irmao.ausencias_injustificadas >= 5 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {irmao.ausencias_injustificadas}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-3 py-1 text-sm font-bold rounded ${obterCorTaxa(irmao.taxa_presenca)}`}>
                        {Math.round(irmao.taxa_presenca)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Visualização */}
      {sessaoIdModal && (
        <ModalVisualizarPresenca 
          sessaoId={sessaoIdModal}
          onFechar={() => setSessaoIdModal(null)}
          onEditar={(sessaoId) => {
            setSessaoIdModal(null);
            if (onEditarPresenca) {
              onEditarPresenca(sessaoId);
            }
          }}
        />
      )}

      {/* Modal de Edição */}
      {sessaoIdEditar && (
        <ModalEditarSessao 
          sessaoId={sessaoIdEditar}
          onFechar={() => setSessaoIdEditar(null)}
          onSalvo={() => {
            carregarDados(); // Recarregar dados após salvar
            setSessaoIdEditar(null);
          }}
        />
      )}

      {/* Modal de Grade de Presença */}
      {mostrarGrade && (
        <ModalGradePresenca 
          onFechar={() => setMostrarGrade(false)}
          periodoInicio={dataInicio}
          periodoFim={dataFim}
        />
      )}
    </div>
  );
}
