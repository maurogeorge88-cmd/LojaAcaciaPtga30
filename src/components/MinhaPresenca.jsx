import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

// Função auxiliar para formatar data
const formatarData = (data) => {
  if (!data) return '-';
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}`;
};

export default function MinhaPresenca({ userData }) {
  const [loading, setLoading] = useState(true);
  const [sessoes, setSessoes] = useState([]);
  const [presencas, setPresencas] = useState({});
  const [irmaoData, setIrmaoData] = useState(null);
  const [estatisticas, setEstatisticas] = useState({
    total: 0,
    presencas: 0,
    ausencias: 0,
    justificadas: 0,
    taxa: 0
  });
  const [periodoSelecionado, setPeriodoSelecionado] = useState('ano-atual');
  const anoAtual = new Date().getFullYear();
  const [dataInicio, setDataInicio] = useState(`${anoAtual}-01-01`);
  const [dataFim, setDataFim] = useState(`${anoAtual}-12-31`);

  useEffect(() => {
    carregarDados();
  }, [periodoSelecionado]);

  const calcularPeriodo = () => {
    const hoje = new Date();
    let inicio, fim;

    switch (periodoSelecionado) {
      case 'mes-atual':
        inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
        break;
      case 'trimestre':
        const mesAtual = hoje.getMonth();
        const trimestreInicio = Math.floor(mesAtual / 3) * 3;
        inicio = new Date(hoje.getFullYear(), trimestreInicio, 1);
        fim = new Date(hoje.getFullYear(), trimestreInicio + 3, 0);
        break;
      case 'semestre':
        const semestreInicio = hoje.getMonth() < 6 ? 0 : 6;
        inicio = new Date(hoje.getFullYear(), semestreInicio, 1);
        fim = new Date(hoje.getFullYear(), semestreInicio + 6, 0);
        break;
      case 'ano-atual':
        inicio = new Date(hoje.getFullYear(), 0, 1);
        fim = new Date(hoje.getFullYear(), 11, 31);
        break;
      case 'personalizado':
        if (dataInicio && dataFim) {
          inicio = new Date(dataInicio);
          fim = new Date(dataFim);
        } else {
          return null;
        }
        break;
      default:
        inicio = new Date(hoje.getFullYear(), 0, 1);
        fim = new Date(hoje.getFullYear(), 11, 31);
    }

    return {
      inicio: inicio.toISOString().split('T')[0],
      fim: fim.toISOString().split('T')[0]
    };
  };

  const carregarDados = async () => {
    try {
      setLoading(true);

      const periodo = calcularPeriodo();
      if (!periodo) return;

      // Buscar dados do irmão logado usando email
      const { data: irmao, error: irmaoError } = await supabase
        .from('irmaos')
        .select('id, nome, data_iniciacao, data_elevacao, data_exaltacao, data_nascimento, situacao, email')
        .eq('email', userData.email)
        .single();

      if (irmaoError) {
        console.error('Erro ao buscar irmão:', irmaoError);
        throw irmaoError;
      }
      if (!irmao) {
        throw new Error('Irmão não encontrado. Verifique se seu email está cadastrado.');
      }

      setIrmaoData(irmao);

      // Calcular grau
      let grau = 'Sem Grau';
      if (irmao.data_exaltacao) grau = 'Mestre';
      else if (irmao.data_elevacao) grau = 'Companheiro';
      else if (irmao.data_iniciacao) grau = 'Aprendiz';

      // Buscar sessões do período
      const { data: sessoesData, error: sessoesError } = await supabase
        .from('sessoes_presenca')
        .select(`
          id,
          data_sessao,
          graus_sessao:grau_sessao_id (nome, grau_minimo_requerido)
        `)
        .gte('data_sessao', periodo.inicio)
        .lte('data_sessao', periodo.fim)
        .order('data_sessao', { ascending: true });

      if (sessoesError) throw sessoesError;

      // Filtrar apenas sessões que o irmão pode participar
      const sessoesElegiveis = sessoesData.filter(sessao => {
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
          return true;
        }
        return tipoSessao === 'Sessão Administrativa';
      });

      setSessoes(sessoesElegiveis);

      // Buscar registros de presença do irmão
      const sessaoIds = sessoesElegiveis.map(s => s.id);
      if (sessaoIds.length > 0) {
        const { data: registros, error: registrosError } = await supabase
          .from('registros_presenca')
          .select('sessao_id, presente, justificativa')
          .eq('membro_id', irmao.id)
          .in('sessao_id', sessaoIds);

        if (registrosError) throw registrosError;

        // Criar mapa de presenças
        const mapaPresencas = {};
        registros.forEach(reg => {
          mapaPresencas[reg.sessao_id] = {
            presente: reg.presente,
            justificativa: reg.justificativa
          };
        });
        setPresencas(mapaPresencas);

        // Calcular estatísticas
        const total = sessoesElegiveis.length;
        const presentes = registros.filter(r => r.presente).length;
        const ausentes = registros.filter(r => !r.presente && !r.justificativa).length;
        const justificadas = registros.filter(r => !r.presente && r.justificativa).length;
        const taxa = total > 0 ? Math.round((presentes / total) * 100) : 0;

        setEstatisticas({
          total,
          presencas: presentes,
          ausencias: ausentes,
          justificadas,
          taxa
        });
      }

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      alert('Erro ao carregar dados de presença');
    } finally {
      setLoading(false);
    }
  };

  const obterCorTaxa = (taxa) => {
    if (taxa >= 90) return 'bg-green-100 text-green-800';
    if (taxa >= 70) return 'bg-blue-100 text-blue-800';
    if (taxa >= 50) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando suas presenças...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-400 rounded-lg shadow-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">📊 Minhas Presenças</h1>
        <p className="text-blue-100">
          {irmaoData?.nome}
        </p>
      </div>

      {/* Filtros de Período */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Período:</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <button
            onClick={() => setPeriodoSelecionado('mes-atual')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              periodoSelecionado === 'mes-atual'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Mês Atual
          </button>
          <button
            onClick={() => setPeriodoSelecionado('trimestre')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              periodoSelecionado === 'trimestre'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Trimestre
          </button>
          <button
            onClick={() => setPeriodoSelecionado('semestre')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              periodoSelecionado === 'semestre'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Semestre
          </button>
          <button
            onClick={() => setPeriodoSelecionado('ano-atual')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              periodoSelecionado === 'ano-atual'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Ano Atual
          </button>
          <button
            onClick={() => setPeriodoSelecionado('personalizado')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              periodoSelecionado === 'personalizado'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Personalizado
          </button>
        </div>

        {/* Filtro Personalizado */}
        {periodoSelecionado === 'personalizado' && (
          <div className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data Início:
                </label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data Fim:
                </label>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <button
              onClick={() => carregarDados()}
              className="mt-4 w-full md:w-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors"
            >
              🔍 Aplicar Filtro
            </button>
          </div>
        )}
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="text-sm text-gray-600 font-semibold mb-1">Total de Sessões</div>
          <div className="text-3xl font-bold text-blue-600">{estatisticas.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="text-sm text-gray-600 font-semibold mb-1">Presenças</div>
          <div className="text-3xl font-bold text-green-600">{estatisticas.presencas}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
          <div className="text-sm text-gray-600 font-semibold mb-1">Ausências</div>
          <div className="text-3xl font-bold text-red-600">{estatisticas.ausencias}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
          <div className="text-sm text-gray-600 font-semibold mb-1">Justificadas</div>
          <div className="text-3xl font-bold text-yellow-600">{estatisticas.justificadas}</div>
        </div>
        <div className={`rounded-lg shadow p-6 border-l-4 ${
          estatisticas.taxa >= 90 ? 'border-green-500 bg-green-50' :
          estatisticas.taxa >= 70 ? 'border-blue-500 bg-blue-50' :
          estatisticas.taxa >= 50 ? 'border-yellow-500 bg-yellow-50' :
          'border-red-500 bg-red-50'
        }`}>
          <div className="text-sm text-gray-600 font-semibold mb-1">Taxa de Presença</div>
          <div className={`text-3xl font-bold ${
            estatisticas.taxa >= 90 ? 'text-green-600' :
            estatisticas.taxa >= 70 ? 'text-blue-600' :
            estatisticas.taxa >= 50 ? 'text-yellow-600' :
            'text-red-600'
          }`}>
            {estatisticas.taxa}%
          </div>
        </div>
      </div>

      {/* Grade de Presença */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Histórico de Sessões</h3>
        </div>
        
        {sessoes.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Nenhuma sessão encontrada no período selecionado.
          </div>
        ) : (
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
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Observação
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sessoes.map((sessao) => {
                  const reg = presencas[sessao.id];
                  const dataFormatada = new Date(sessao.data_sessao + 'T00:00:00').toLocaleDateString('pt-BR');
                  
                  let statusClasse = '';
                  let statusTexto = '';
                  let statusIcone = '';
                  
                  if (!reg) {
                    statusClasse = 'bg-gray-50';
                    statusTexto = 'text-gray-500';
                    statusIcone = '-';
                  } else if (reg.presente) {
                    statusClasse = 'bg-green-50';
                    statusTexto = 'text-green-700';
                    statusIcone = '✓ Presente';
                  } else if (reg.justificativa) {
                    statusClasse = 'bg-yellow-50';
                    statusTexto = 'text-yellow-700';
                    statusIcone = 'J Justificado';
                  } else {
                    statusClasse = 'bg-red-50';
                    statusTexto = 'text-red-700';
                    statusIcone = '✗ Ausente';
                  }

                  return (
                    <tr key={sessao.id} className={`hover:bg-opacity-75 ${statusClasse}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {dataFormatada}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {sessao.graus_sessao?.nome || 'Não informado'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusTexto}`}>
                          {statusIcone}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {reg?.justificativa || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legenda */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">ℹ️ Informações:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Taxa de Presença:</strong> Percentual de sessões que você esteve presente</li>
          <li>• <strong>✓ Verde:</strong> Presença confirmada</li>
          <li>• <strong>✗ Vermelho:</strong> Ausência injustificada</li>
          <li>• <strong>J Amarelo:</strong> Ausência justificada</li>
          <li>• <strong>- Cinza:</strong> Sem registro de presença</li>
        </ul>
      </div>
    </div>
  );
}
