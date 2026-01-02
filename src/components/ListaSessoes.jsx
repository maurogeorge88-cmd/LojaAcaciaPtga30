import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function ListaSessoes({ onEditarPresenca, onNovaSessao }) {
  const [loading, setLoading] = useState(true);
  const [sessoes, setSessoes] = useState([]);
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });
  const [anosDisponiveis, setAnosDisponiveis] = useState([]);

  // Buscar anos disponíveis
  useEffect(() => {
    const buscarAnos = async () => {
      const { data } = await supabase
        .from('sessoes_presenca')
        .select('data_sessao')
        .order('data_sessao', { ascending: true });
      
      if (data && data.length > 0) {
        const anos = [...new Set(data.map(s => new Date(s.data_sessao).getFullYear()))];
        const anosSorted = anos.sort((a, b) => b - a); // Mais recente primeiro
        setAnosDisponiveis(anosSorted);
        
        // Definir ano mais recente como padrão
        setFiltroAno(anosSorted[0].toString());
      }
    };
    buscarAnos();
  }, []);

  useEffect(() => {
    carregarSessoes();
  }, [filtroMes, filtroAno]);

  const carregarSessoes = async () => {
    try {
      setLoading(true);

      // Buscar direto da tabela sessoes_presenca
      let query = supabase
        .from('sessoes_presenca')
        .select('*, graus_sessao:grau_sessao_id(nome)')
        .order('data_sessao', { ascending: false });

      // Aplicar filtros se houver
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

      if (error) {
        console.error('❌ Erro na query:', error);
        throw error;
      }

      console.log('📊 Sessões carregadas:', data?.length);
      
      // Processar dados para adicionar nome do grau
      const sessoesProcessadas = data?.map(sessao => ({
        ...sessao,
        grau_sessao: sessao.graus_sessao?.nome || 'Aprendiz'
      })) || [];
      
      setSessoes(sessoesProcessadas);

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

  const handleExcluir = async (sessaoId) => {
    if (!confirm('Tem certeza que deseja excluir esta sessão? Todos os registros de presença também serão excluídos.')) {
      return;
    }

    try {
      console.log('🗑️ Iniciando exclusão da sessão ID:', sessaoId);

      // 1. Verificar em qual tabela a sessão está
      console.log('🔍 Verificando tabela sessoes_presenca...');
      const { data: sessaoPresenca } = await supabase
        .from('sessoes_presenca')
        .select('id, data_sessao')
        .eq('id', sessaoId)
        .maybeSingle();

      console.log('🔍 Verificando tabela sessoes...');
      const { data: sessao } = await supabase
        .from('sessoes')
        .select('id, data_sessao')
        .eq('id', sessaoId)
        .maybeSingle();

      if (!sessaoPresenca && !sessao) {
        throw new Error('Sessão não encontrada em nenhuma tabela');
      }

      console.log('✅ Sessão encontrada em:', {
        sessoes_presenca: !!sessaoPresenca,
        sessoes: !!sessao
      });

      // 2. PRIMEIRO: Excluir registros de presença
      console.log('🔄 Excluindo registros de presença...');
      const { error: errorPresenca } = await supabase
        .from('registros_presenca')
        .delete()
        .eq('sessao_id', sessaoId);

      if (errorPresenca) {
        console.error('❌ Erro ao excluir registros:', errorPresenca);
        throw errorPresenca;
      }
      console.log('✅ Registros de presença excluídos');

      // 3. Excluir da tabela correta
      let tabelaCorreta = sessaoPresenca ? 'sessoes_presenca' : 'sessoes';
      console.log(`🔄 Excluindo sessão da tabela: ${tabelaCorreta}...`);
      
      const { data: deletedData, error: errorSessao, status, statusText } = await supabase
        .from(tabelaCorreta)
        .delete()
        .eq('id', sessaoId)
        .select(); // IMPORTANTE: adicionar .select() para ver o que foi deletado

      console.log('📋 Resposta do DELETE:', {
        data: deletedData,
        error: errorSessao,
        status,
        statusText,
        qtdDeletados: deletedData?.length || 0
      });

      if (errorSessao) {
        console.error('❌ Erro ao excluir sessão:', errorSessao);
        throw errorSessao;
      }

      if (!deletedData || deletedData.length === 0) {
        console.error('⚠️ NENHUM REGISTRO FOI EXCLUÍDO! Pode ser problema de permissão (RLS)');
        throw new Error('Nenhum registro foi excluído. Verifique as permissões no banco de dados.');
      }

      console.log('✅ Sessão excluída com sucesso!');

      // IMPORTANTE: Remover do estado IMEDIATAMENTE para atualização visual instantânea
      setSessoes(prevSessoes => prevSessoes.filter(s => s.id !== sessaoId));

      setMensagem({
        tipo: 'sucesso',
        texto: 'Sessão excluída com sucesso!'
      });

      // Recarregar em background para sincronizar
      setTimeout(() => carregarSessoes(), 500);

    } catch (error) {
      console.error('💥 Erro ao excluir sessão:', error);
      setMensagem({
        tipo: 'erro',
        texto: error.message || 'Erro ao excluir sessão. Verifique as permissões.'
      });
    }
  };

  const formatarData = (data) => {
    if (!data) return '-';
    return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
  };

  const obterCorPorcentagem = (total, presentes) => {
    if (total === 0) return 'bg-gray-100 text-gray-800';
    const percentual = (presentes / total) * 100;
    if (percentual >= 80) return 'bg-green-100 text-green-800';
    if (percentual >= 50) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  // Gerar opções de anos dinâmicas
  const anoAtual = new Date().getFullYear();

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
          <button
            onClick={onNovaSessao}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition font-medium"
          >
            + Nova Sessão
          </button>
        </div>

        {/* Filtros */}
        <div className="flex gap-4 mt-6">
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
            // Agrupar sessões por mês/ano
            const sessoesPorMes = {};
            
            sessoes.forEach(sessao => {
              const data = new Date(sessao.data_sessao + 'T00:00:00');
              const mesAno = `${data.getMonth() + 1}/${data.getFullYear()}`;
              const mesNome = data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
              
              if (!sessoesPorMes[mesAno]) {
                sessoesPorMes[mesAno] = {
                  mesNome: mesNome.charAt(0).toUpperCase() + mesNome.slice(1),
                  sessoes: []
                };
              }
              
              sessoesPorMes[mesAno].sessoes.push(sessao);
            });

            return Object.entries(sessoesPorMes).map(([mesAno, grupo]) => (
              <div key={mesAno} className="bg-white rounded-lg shadow-md overflow-hidden">
                {/* Faixa do Mês/Ano */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-400 px-6 py-3">
                  <h3 className="text-lg font-bold text-white">
                    📅 {grupo.mesNome}
                  </h3>
                </div>

                {/* Tabela do Mês */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Data
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tipo de Sessão
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Classificação
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Presença
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Ações
                        </th>
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatarData(sessao.data_sessao)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{sessao.grau_sessao}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          sessao.classificacao 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-gray-100 text-gray-600'
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
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => onEditarPresenca(sessao.id)}
                            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition"
                            title="Editar presença"
                          >
                            ✏️ Editar
                          </button>
                          <button
                            onClick={() => handleExcluir(sessao.id)}
                            className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition"
                            title="Excluir sessão"
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
    </div>
  );
}
