import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function ListaSessoes({ onEditarPresenca, onVisualizarPresenca, onNovaSessao }) {
  const [loading, setLoading] = useState(true);
  const [sessoes, setSessoes] = useState([]);
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });
  const [anosDisponiveis, setAnosDisponiveis] = useState([]);

  // Estados para visitas
  const [visitas, setVisitas] = useState([]);
  const [irmaos, setIrmaos] = useState([]);
  const [potencias, setPotencias] = useState([]);
  const [modalVisita, setModalVisita] = useState(false);
  const [visitaEditando, setVisitaEditando] = useState(null);
  const [visitaForm, setVisitaForm] = useState({
    irmao_id: '',
    data_visita: '',
    nome_loja: '',
    oriente: '',
    potencia_id: '',
    observacoes: ''
  });

  const meses = [
    { valor: '', nome: 'Todos os meses' },
    { valor: '1', nome: 'Janeiro' },
    { valor: '2', nome: 'Fevereiro' },
    { valor: '3', nome: 'Março' },
    { valor: '4', nome: 'Abril' },
    { valor: '5', nome: 'Maio' },
    { valor: '6', nome: 'Junho' },
    { valor: '7', nome: 'Julho' },
    { valor: '8', nome: 'Agosto' },
    { valor: '9', nome: 'Setembro' },
    { valor: '10', nome: 'Outubro' },
    { valor: '11', nome: 'Novembro' },
    { valor: '12', nome: 'Dezembro' }
  ];

  const anoAtual = new Date().getFullYear();

  const formatarData = (data) => {
    if (!data) return '';
    const date = new Date(data + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
  };

  const obterCorPorcentagem = (total, presentes) => {
    if (total === 0) return 'bg-gray-200 text-gray-700';
    const percentual = (presentes / total) * 100;
    if (percentual >= 75) return 'bg-green-100 text-green-800';
    if (percentual >= 50) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  // Buscar anos disponíveis
  useEffect(() => {
    const buscarAnos = async () => {
      const { data } = await supabase
        .from('sessoes_presenca')
        .select('data_sessao')
        .order('data_sessao', { ascending: true });
      
      if (data && data.length > 0) {
        const anos = [...new Set(data.map(s => new Date(s.data_sessao).getFullYear()))];
        const anosSorted = anos.sort((a, b) => b - a);
        setAnosDisponiveis(anosSorted);
        setFiltroAno(anosSorted[0].toString());
      }
    };
    buscarAnos();
  }, []);

  useEffect(() => {
    carregarSessoes();
    carregarVisitas();
  }, [filtroMes, filtroAno]);

  useEffect(() => {
    carregarIrmaos();
    carregarPotencias();
  }, []);

  const carregarSessoes = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('sessoes_presenca')
        .select('*, graus_sessao:grau_sessao_id(nome, grau_minimo_requerido), classificacoes_sessao:classificacao_id(nome)')
        .order('data_sessao', { ascending: false });

      if (filtroAno) {
        const anoInicio = `${filtroAno}-01-01`;
        const anoFim = `${filtroAno}-12-31`;
        query = query.gte('data_sessao', anoInicio).lte('data_sessao', anoFim);
      }

      if (filtroMes && filtroAno) {
        const mesInicio = `${filtroAno}-${filtroMes.padStart(2, '0')}-01`;
        const ultimoDia = new Date(parseInt(filtroAno), parseInt(filtroMes), 0).getDate();
        const mesFim = `${filtroAno}-${filtroMes.padStart(2, '0')}-${ultimoDia}`;
        query = query.gte('data_sessao', mesInicio).lte('data_sessao', mesFim);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Buscar histórico de situações
      const { data: historicoSituacoes } = await supabase
        .from('historico_situacoes')
        .select('*')
        .eq('status', 'ativa');

      const sessoesComPresenca = await Promise.all((data || []).map(async (sessao) => {
        const grauMinimoRaw = sessao?.graus_sessao?.grau_minimo_requerido;
        const grauMinimo = grauMinimoRaw ? parseInt(grauMinimoRaw) : null;
        
        const { data: todosIrmaos } = await supabase
          .from('irmaos')
          .select('id, data_iniciacao, data_ingresso_loja, data_elevacao, data_exaltacao, mestre_instalado, data_instalacao, data_falecimento, situacao');
        
        const { data: registrosPresenca } = await supabase
          .from('registros_presenca')
          .select('membro_id, presente')
          .eq('sessao_id', sessao.id);
        
        const presencaMap = new Map();
        registrosPresenca?.forEach(r => presencaMap.set(r.membro_id, r.presente));
        
        const { count: totalVisitantes } = await supabase
          .from('visitantes_sessao')
          .select('*', { count: 'exact', head: true })
          .eq('sessao_id', sessao.id);
        
        const dataSessao = new Date(sessao.data_sessao + 'T00:00:00');
        const irmaosValidos = todosIrmaos?.filter(irmao => {
          if (!irmao) return false;
          
          const situacaoBloqueadora = historicoSituacoes?.find(sit => {
            if (sit.membro_id !== irmao.id) return false;
            
            const tipoSituacao = sit.tipo_situacao?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const situacoesQueExcluem = ['desligado', 'desligamento', 'irregular', 'suspenso', 'excluido', 'ex-oficio'];
            
            if (!situacoesQueExcluem.includes(tipoSituacao)) return false;
            
            const dataInicio = new Date(sit.data_inicio + 'T00:00:00');
            if (dataSessao < dataInicio) return false;
            
            if (sit.data_fim) {
              const dataFim = new Date(sit.data_fim + 'T00:00:00');
              return dataSessao >= dataInicio && dataSessao <= dataFim;
            }
            
            return dataSessao >= dataInicio;
          });
          
          if (situacaoBloqueadora) return false;
          
          const dataIngresso = irmao.data_ingresso_loja 
            ? new Date(irmao.data_ingresso_loja + 'T00:00:00')
            : irmao.data_iniciacao 
            ? new Date(irmao.data_iniciacao + 'T00:00:00')
            : null;
          
          if (!dataIngresso || dataSessao < dataIngresso) return false;
          
          if (irmao.data_falecimento) {
            const dataFalec = new Date(irmao.data_falecimento + 'T00:00:00');
            if (dataSessao > dataFalec) return false;
          }
          
          if (grauMinimo === 2) {
            if (!irmao.data_elevacao) return false;
            const dataElevacao = new Date(irmao.data_elevacao + 'T00:00:00');
            if (dataSessao < dataElevacao) return false;
          } else if (grauMinimo === 3) {
            if (!irmao.data_exaltacao) return false;
            const dataExaltacao = new Date(irmao.data_exaltacao + 'T00:00:00');
            if (dataSessao < dataExaltacao) return false;
          }
          
          return true;
        });

        const total_registros = irmaosValidos?.length || 0;
        const total_presentes = irmaosValidos?.filter(i => presencaMap.get(i.id) === true).length || 0;
        const total_ausentes = total_registros - total_presentes;

        const aprendizes = irmaosValidos?.filter(i => {
          if (!presencaMap.get(i.id)) return false;
          return !i.data_elevacao;
        }).length || 0;

        const companheiros = irmaosValidos?.filter(i => {
          if (!presencaMap.get(i.id)) return false;
          return i.data_elevacao && !i.data_exaltacao;
        }).length || 0;

        const mestres = irmaosValidos?.filter(i => {
          if (!presencaMap.get(i.id)) return false;
          return i.data_exaltacao && !i.mestre_instalado;
        }).length || 0;

        const mestresInstalados = irmaosValidos?.filter(i => {
          if (!presencaMap.get(i.id)) return false;
          return i.mestre_instalado && i.data_instalacao;
        }).length || 0;

        return {
          ...sessao,
          grau_sessao: sessao.graus_sessao?.nome || 'Aprendiz',
          classificacao: sessao.classificacoes_sessao?.nome || null,
          total_registros,
          total_presentes,
          total_ausentes,
          total_visitantes: totalVisitantes || 0,
          graus_presentes: {
            aprendizes,
            companheiros,
            mestres,
            mestres_instalados: mestresInstalados
          }
        };
      }));
      
      setSessoes(sessoesComPresenca);

    } catch (error) {
      console.error('Erro ao carregar sessões:', error);
      setMensagem({
        tipo: 'erro',
        texto: 'Erro ao carregar sessões.'
      });
    } finally {
      setLoading(false);
    }
  };

  const carregarVisitas = async () => {
    try {
      let query = supabase
        .from('visitas_outras_lojas')
        .select(`
          *,
          irmaos(nome),
          potencias_masonicas(sigla, nome_completo)
        `)
        .order('data_visita', { ascending: false });

      if (filtroAno) {
        const anoInicio = `${filtroAno}-01-01`;
        const anoFim = `${filtroAno}-12-31`;
        query = query.gte('data_visita', anoInicio).lte('data_visita', anoFim);
      }

      if (filtroMes && filtroAno) {
        const mesInicio = `${filtroAno}-${filtroMes.padStart(2, '0')}-01`;
        const ultimoDia = new Date(parseInt(filtroAno), parseInt(filtroMes), 0).getDate();
        const mesFim = `${filtroAno}-${filtroMes.padStart(2, '0')}-${ultimoDia}`;
        query = query.gte('data_visita', mesInicio).lte('data_visita', mesFim);
      }

      const { data, error } = await query;
      if (error) throw error;
      setVisitas(data || []);
    } catch (error) {
      console.error('Erro ao carregar visitas:', error);
    }
  };

  const carregarIrmaos = async () => {
    // Buscar irmãos ativos
    const { data: todosIrmaos } = await supabase
      .from('irmaos')
      .select('id, nome')
      .eq('status', 'ativo')
      .order('nome');

    // Buscar situações ativas
    const { data: situacoes } = await supabase
      .from('historico_situacoes')
      .select('*')
      .eq('status', 'ativa')
      .is('data_fim', null);

    // Filtrar apenas Regular e Licenciado
    const irmaosValidos = todosIrmaos?.filter(irmao => {
      const situacaoAtual = situacoes?.find(s => s.membro_id === irmao.id);
      if (!situacaoAtual) return false;
      
      const tipoSituacao = situacaoAtual.tipo_situacao?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return tipoSituacao === 'regular' || tipoSituacao === 'licenciado';
    }) || [];

    setIrmaos(irmaosValidos);
  };

  const carregarPotencias = async () => {
    const { data } = await supabase
      .from('potencias_masonicas')
      .select('*')
      .eq('ativa', true)
      .order('sigla');
    setPotencias(data || []);
  };

  const abrirModalVisita = (visita = null) => {
    if (visita) {
      setVisitaEditando(visita);
      setVisitaForm({
        irmao_id: visita.irmao_id,
        data_visita: visita.data_visita,
        nome_loja: visita.nome_loja,
        oriente: visita.oriente,
        potencia_id: visita.potencia_id,
        observacoes: visita.observacoes || ''
      });
    } else {
      setVisitaEditando(null);
      setVisitaForm({
        irmao_id: '',
        data_visita: '',
        nome_loja: '',
        oriente: '',
        potencia_id: '',
        observacoes: ''
      });
    }
    setModalVisita(true);
  };

  const salvarVisita = async (e) => {
    e.preventDefault();

    if (!visitaForm.irmao_id || !visitaForm.data_visita || !visitaForm.nome_loja || !visitaForm.oriente) {
      setMensagem({ tipo: 'erro', texto: 'Preencha todos os campos obrigatórios' });
      return;
    }

    try {
      if (visitaEditando) {
        const { error } = await supabase
          .from('visitas_outras_lojas')
          .update(visitaForm)
          .eq('id', visitaEditando.id);
        
        if (error) throw error;
        setMensagem({ tipo: 'sucesso', texto: '✅ Visita atualizada com sucesso!' });
      } else {
        const { error } = await supabase
          .from('visitas_outras_lojas')
          .insert([visitaForm]);
        
        if (error) throw error;
        setMensagem({ tipo: 'sucesso', texto: '✅ Visita cadastrada com sucesso!' });
      }

      setModalVisita(false);
      carregarVisitas();
    } catch (error) {
      console.error('Erro ao salvar visita:', error);
      setMensagem({ tipo: 'erro', texto: '❌ Erro ao salvar visita' });
    }
  };

  const excluirVisita = async (id) => {
    if (!confirm('Deseja realmente excluir esta visita?')) return;

    try {
      const { error } = await supabase
        .from('visitas_outras_lojas')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      setMensagem({ tipo: 'sucesso', texto: '✅ Visita excluída com sucesso!' });
      carregarVisitas();
    } catch (error) {
      console.error('Erro ao excluir visita:', error);
      setMensagem({ tipo: 'erro', texto: '❌ Erro ao excluir visita' });
    }
  };

  const handleExcluir = async (sessaoId) => {
    if (!confirm('Tem certeza que deseja excluir esta sessão?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('sessoes_presenca')
        .delete()
        .eq('id', sessaoId);

      if (error) throw error;

      setMensagem({
        tipo: 'sucesso',
        texto: '✅ Sessão excluída com sucesso!'
      });

      carregarSessoes();
    } catch (error) {
      console.error('Erro ao excluir:', error);
      setMensagem({
        tipo: 'erro',
        texto: '❌ Erro ao excluir sessão'
      });
    }
  };

  const formatarNomeCurto = (nomeCompleto) => {
    if (!nomeCompleto) return '';
    
    const partes = nomeCompleto.trim().split(' ');
    
    // Se tem 2 nomes ou menos, retorna tudo
    if (partes.length <= 2) return nomeCompleto;
    
    // Se tem "de" ou "da", pega primeiro nome + último
    const conectores = ['de', 'da', 'do', 'dos', 'das'];
    const temConector = partes.some(p => conectores.includes(p.toLowerCase()));
    
    if (temConector) {
      return `${partes[0]} ${partes[partes.length - 1]}`;
    }
    
    // Caso contrário, retorna os dois primeiros nomes
    return `${partes[0]} ${partes[1]}`;
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Cabeçalho */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              Sessões Realizadas
            </h2>
            <p className="text-gray-600 mt-1">
              Visualize e gerencie as sessões cadastradas
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => abrirModalVisita()}
              className="px-6 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition font-medium"
            >
              📍 Nova Visita
            </button>
            <button
              onClick={onNovaSessao}
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition font-medium"
            >
              ➕ Nova Sessão
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mês
            </label>
            <select
              value={filtroMes}
              onChange={(e) => setFiltroMes(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {meses.map(mes => (
                <option key={mes.valor} value={mes.valor}>
                  {mes.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ano
            </label>
            <select
              value={filtroAno}
              onChange={(e) => setFiltroAno(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {anosDisponiveis.map(ano => (
                <option key={ano} value={ano}>
                  {ano}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Mensagens */}
      {mensagem.texto && (
        <div className={`mb-4 p-4 rounded-lg ${
          mensagem.tipo === 'sucesso'
            ? 'bg-green-100 text-green-800 border border-green-300'
            : 'bg-red-100 text-red-800 border border-red-300'
        }`}>
          {mensagem.texto}
          <button
            onClick={() => setMensagem({ tipo: '', texto: '' })}
            className="ml-4 text-sm underline"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Lista de Sessões */}
      {loading ? (
        <div className="flex items-center justify-center h-64 bg-white rounded-lg shadow-md">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Carregando sessões...</p>
          </div>
        </div>
      ) : sessoes.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-lg font-medium text-gray-900">Nenhuma sessão encontrada</h3>
          <p className="mt-1 text-gray-500">
            {filtroMes || filtroAno !== anoAtual.toString() 
              ? 'Tente ajustar os filtros ou cadastre uma nova sessão.'
              : 'Comece cadastrando sua primeira sessão.'
            }
          </p>
          <div className="mt-6">
            <button
              onClick={onNovaSessao}
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition font-medium"
            >
              Cadastrar Primeira Sessão
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {(() => {
            const sessoesPorMes = {};
            
            sessoes.forEach((sessao) => {
              const data = new Date(sessao.data_sessao + 'T00:00:00');
              const mes = data.getMonth();
              const ano = data.getFullYear();
              const mesAno = `${ano}-${String(mes + 1).padStart(2, '0')}`;
              
              if (!sessoesPorMes[mesAno]) {
                sessoesPorMes[mesAno] = {
                  mesNome: `${meses[mes + 1].nome} de ${ano}`,
                  mes,
                  ano,
                  sessoes: []
                };
              }
              
              sessoesPorMes[mesAno].sessoes.push(sessao);
            });

            return Object.entries(sessoesPorMes).map(([mesAno, grupo]) => (
              <div key={mesAno} className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-blue-400 px-6 py-3">
                  <h3 className="text-lg font-bold text-white">
                    📅 {grupo.mesNome}
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo de Sessão</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Classificação</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Presença</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Visitantes</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {grupo.sessoes.map((sessao) => {
                        const totalRegistros = sessao.total_registros || 0;
                        const presentes = sessao.total_presentes || 0;
                        const ausentes = sessao.total_ausentes || 0;
                        const percentual = totalRegistros > 0 ? Math.round((presentes / totalRegistros) * 100) : 0;

                        return (
                          <tr key={sessao.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {formatarData(sessao.data_sessao)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">{sessao.grau_sessao}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                sessao.classificacao ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {sessao.classificacao || '-'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex flex-col items-center">
                                <div className={`px-3 py-1 rounded-full text-sm font-semibold ${obterCorPorcentagem(totalRegistros, presentes)}`}>
                                  {percentual}% ({presentes}/{totalRegistros})
                                </div>
                                {totalRegistros > 0 && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    {ausentes} ausente(s)
                                  </div>
                                )}
                                {sessao.graus_presentes && presentes > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2 text-xs">
                                    {sessao.graus_presentes.aprendizes > 0 && (
                                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded font-medium">
                                        A: {sessao.graus_presentes.aprendizes}
                                      </span>
                                    )}
                                    {sessao.graus_presentes.companheiros > 0 && (
                                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-medium">
                                        C: {sessao.graus_presentes.companheiros}
                                      </span>
                                    )}
                                    {sessao.graus_presentes.mestres > 0 && (
                                      <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded font-medium">
                                        M: {sessao.graus_presentes.mestres}
                                      </span>
                                    )}
                                    {sessao.graus_presentes.mestres_instalados > 0 && (
                                      <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded font-medium">
                                        M.I: {sessao.graus_presentes.mestres_instalados}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium">
                                {sessao.total_visitantes}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <div className="flex justify-center gap-2">
                                <button
                                  onClick={() => onVisualizarPresenca(sessao.id)}
                                  className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition text-sm"
                                >
                                  👁️ Visualizar
                                </button>
                                <button
                                  onClick={() => onEditarPresenca(sessao.id)}
                                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm"
                                >
                                  ✏️ Editar
                                </button>
                                <button
                                  onClick={() => handleExcluir(sessao.id)}
                                  className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition text-sm"
                                >
                                  🗑️ Excluir
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* VISITAS DO MÊS */}
                {(() => {
                  const visitasDoMes = visitas.filter(v => {
                    const dataVisita = new Date(v.data_visita + 'T00:00:00');
                    return dataVisita.getMonth() === grupo.mes && dataVisita.getFullYear() === grupo.ano;
                  });

                  if (visitasDoMes.length === 0) return null;

                  return (
                    <div className="border-t-4 border-dashed border-purple-300 mt-4">
                      <div className="bg-purple-50 px-6 py-3">
                        <h4 className="text-sm font-bold text-purple-800">
                          📍 Visitas dos Irmãos a Outras Lojas
                        </h4>
                      </div>
                      <div className="p-4">
                        <div className="grid grid-cols-3 gap-3">
                          {visitasDoMes.map(visita => (
                            <div key={visita.id} className="bg-white border border-purple-200 rounded-lg p-3 hover:shadow-md transition-shadow">
                              {/* Linha 1: Data e Nome */}
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <div className="text-xs text-gray-500">
                                    {new Date(visita.data_visita + 'T00:00:00').toLocaleDateString('pt-BR')}
                                  </div>
                                  <div className="text-sm font-semibold text-purple-900">
                                    {formatarNomeCurto(visita.irmaos?.nome)}
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => abrirModalVisita(visita)}
                                    className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs"
                                    title="Editar"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    onClick={() => excluirVisita(visita.id)}
                                    className="p-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-xs"
                                    title="Excluir"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </div>
                              
                              {/* Linha 2: Loja e Oriente */}
                              <div className="text-xs text-gray-700 mb-1">
                                <span className="font-medium">{visita.nome_loja}</span>
                              </div>
                              <div className="text-xs text-gray-500 mb-2">
                                {visita.oriente}
                              </div>
                              
                              {/* Linha 3: Potência */}
                              {visita.potencias_masonicas?.sigla && (
                                <div>
                                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                                    {visita.potencias_masonicas.sigla}
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ));
          })()}
        </div>
      )}

      {/* Resumo */}
      {sessoes.length > 0 && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Total:</strong> {sessoes.length} sessão(ões) encontrada(s)
            {filtroMes && ` em ${meses.find(m => m.valor === filtroMes)?.nome}`}
            {filtroAno && ` de ${filtroAno}`}
          </p>
        </div>
      )}

      {/* MODAL */}
      {modalVisita && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-purple-600 text-white p-6">
              <h3 className="text-2xl font-bold">
                {visitaEditando ? '✏️ Editar Visita' : '➕ Nova Visita'}
              </h3>
            </div>

            <form onSubmit={salvarVisita} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Irmão Visitante *</label>
                <select
                  value={visitaForm.irmao_id}
                  onChange={(e) => setVisitaForm({ ...visitaForm, irmao_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                >
                  <option value="">Selecione...</option>
                  {irmaos.map(irmao => (
                    <option key={irmao.id} value={irmao.id}>{irmao.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data da Visita *</label>
                <input
                  type="date"
                  value={visitaForm.data_visita}
                  onChange={(e) => setVisitaForm({ ...visitaForm, data_visita: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome da Loja *</label>
                  <input
                    type="text"
                    value={visitaForm.nome_loja}
                    onChange={(e) => setVisitaForm({ ...visitaForm, nome_loja: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="Ex: Acácia do Cerrado"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Oriente (Município) *</label>
                  <input
                    type="text"
                    value={visitaForm.oriente}
                    onChange={(e) => setVisitaForm({ ...visitaForm, oriente: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="Ex: Cuiabá"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Potência Maçônica</label>
                <select
                  value={visitaForm.potencia_id}
                  onChange={(e) => setVisitaForm({ ...visitaForm, potencia_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Selecione...</option>
                  {potencias.map(pot => (
                    <option key={pot.id} value={pot.id}>
                      {pot.sigla} - {pot.nome_completo}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
                <textarea
                  value={visitaForm.observacoes}
                  onChange={(e) => setVisitaForm({ ...visitaForm, observacoes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  rows="3"
                  placeholder="Informações adicionais..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setModalVisita(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  ❌ Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  💾 Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
