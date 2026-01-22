import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

// Função auxiliar para calcular idade
const calcularIdade = (dataNascimento) => {
  if (!dataNascimento) return null;
  const hoje = new Date();
  const nascimento = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const mes = hoje.getMonth() - nascimento.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }
  return idade;
};

export default function ModalVisualizarPresenca({ sessaoId, onFechar, onEditar }) {
  const [loading, setLoading] = useState(true);
  const [sessao, setSessao] = useState(null);
  const [presencas, setPresencas] = useState([]);
  const [visitantes, setVisitantes] = useState([]);
  const [visitanteForm, setVisitanteForm] = useState({ nome_visitante: '', nome_loja: '', cidade: '' });

  useEffect(() => {
    if (sessaoId) {
      carregarDados();
    }
  }, [sessaoId]);

  const carregarDados = async () => {
    try {
      setLoading(true);

      // Buscar dados da sessão
      const { data: sessaoData, error: sessaoError } = await supabase
        .from('sessoes_presenca')
        .select(`
          *,
          graus_sessao:grau_sessao_id (
            nome,
            grau_minimo_requerido
          ),
          classificacoes_sessao:classificacao_id (
            nome
          )
        `)
        .eq('id', sessaoId)
        .single();

      if (sessaoError) throw sessaoError;
      setSessao(sessaoData);

      // Buscar TODOS os irmãos ativos com filtro de grau mínimo
      const grauMinimo = sessaoData?.graus_sessao?.grau_minimo_requerido;
      
      let queryIrmaos = supabase
        .from('irmaos')
        .select('id, nome, foto_url, data_nascimento, situacao, data_iniciacao, data_ingresso_loja, data_elevacao, data_exaltacao, mestre_instalado, data_instalacao, data_falecimento')
        .eq('status', 'ativo');
      
      // Aplicar filtro de grau (igual RegistroPresenca)
      if (grauMinimo === 2) {
        queryIrmaos = queryIrmaos.not('data_elevacao', 'is', null);
      } else if (grauMinimo === 3) {
        queryIrmaos = queryIrmaos.not('data_exaltacao', 'is', null);
      }
      
      const { data: todosIrmaos, error: irmaosError } = await queryIrmaos.order('nome');

      if (irmaosError) throw irmaosError;

      // Buscar registros de presença existentes
      const { data: registrosPresenca, error: registrosError } = await supabase
        .from('registros_presenca')
        .select('membro_id, presente, justificativa')
        .eq('sessao_id', sessaoId);

      if (registrosError) throw registrosError;

      // Criar um Map para acesso rápido aos registros
      const registrosMap = new Map();
      registrosPresenca?.forEach(reg => {
        registrosMap.set(reg.membro_id, reg);
      });

      // Buscar visitantes
      const { data: visitantesData, error: visitantesError } = await supabase
        .from('visitantes_sessao')
        .select('*')
        .eq('sessao_id', sessaoId)
        .order('created_at', { ascending: false });

      if (!visitantesError) {
        setVisitantes(visitantesData || []);
      }

      // Filtrar e adicionar grau calculado NA DATA DA SESSÃO
      const dataSessao = new Date(sessaoData.data_sessao + 'T00:00:00');
      
      const presencasComGrau = todosIrmaos
        .filter(irmao => {
          if (!irmao) return false;
          
          // Filtro 1: Situações que não podem ter presença registrada
          const situacoesExcluidas = ['irregular', 'suspenso', 'ex-ofício', 'ex-oficio', 'desligado', 'excluído', 'excluido'];
          if (irmao.situacao && situacoesExcluidas.includes(irmao.situacao.toLowerCase())) {
            return false;
          }
          
          // Filtro 2: Data de ingresso - só aparece se já estava na loja
          const dataIngresso = irmao.data_ingresso_loja 
            ? new Date(irmao.data_ingresso_loja + 'T00:00:00')
            : irmao.data_iniciacao 
            ? new Date(irmao.data_iniciacao + 'T00:00:00')
            : null;
          
          if (!dataIngresso) return false;
          if (dataSessao < dataIngresso) return false;
          
          // Filtro 3: Falecimento - só aparece se sessão foi ANTES OU NO DIA do falecimento
          if (irmao.data_falecimento) {
            const dataFalecimento = new Date(irmao.data_falecimento + 'T00:00:00');
            return dataSessao <= dataFalecimento;
          }
          
          // Filtro 4: Grau NA DATA DA SESSÃO (não o grau atual)
          if (grauMinimo === 2) {
            // Sessão de Companheiro: precisa ter sido elevado antes/na data da sessão
            if (!irmao.data_elevacao) return false;
            const dataElevacao = new Date(irmao.data_elevacao + 'T00:00:00');
            return dataSessao >= dataElevacao;
          } else if (grauMinimo === 3) {
            // Sessão de Mestre: precisa ter sido exaltado antes/na data da sessão
            if (!irmao.data_exaltacao) return false;
            const dataExaltacao = new Date(irmao.data_exaltacao + 'T00:00:00');
            return dataSessao >= dataExaltacao;
          }
          
          return true;
        })
        .map(irmao => {
          let grau = 'Sem Grau';
          
          // Calcular grau que o irmão tinha NA DATA DA SESSÃO
          if (irmao.data_exaltacao) {
            const dataExaltacao = new Date(irmao.data_exaltacao + 'T00:00:00');
            if (dataSessao >= dataExaltacao) {
              // Era Mestre na data da sessão, verificar se já era Instalado
              if (irmao.mestre_instalado && irmao.data_instalacao) {
                const dataInstalacao = new Date(irmao.data_instalacao + 'T00:00:00');
                grau = dataSessao >= dataInstalacao ? 'Mestre Instalado' : 'Mestre';
              } else {
                grau = 'Mestre';
              }
            } else if (irmao.data_elevacao) {
              const dataElevacao = new Date(irmao.data_elevacao + 'T00:00:00');
              grau = dataSessao >= dataElevacao ? 'Companheiro' : 'Aprendiz';
            } else {
              grau = 'Aprendiz';
            }
          } else if (irmao.data_elevacao) {
            const dataElevacao = new Date(irmao.data_elevacao + 'T00:00:00');
            grau = dataSessao >= dataElevacao ? 'Companheiro' : 'Aprendiz';
          } else if (irmao.data_iniciacao) {
            grau = 'Aprendiz';
          }

          const idade = irmao.data_nascimento ? calcularIdade(irmao.data_nascimento) : null;
          const tem_prerrogativa = idade >= 70;

          // Buscar registro de presença (se existir)
          const registro = registrosMap.get(irmao.id) || { presente: false, justificativa: null };

          return {
            id: `presenca-${irmao.id}`,
            membro_id: irmao.id,
            irmaos: irmao,
            presente: registro.presente,
            justificativa: registro.justificativa,
            grau,
            tem_prerrogativa
          };
        });

      setPresencas(presencasComGrau);

    } catch (error) {
      console.error('Erro ao carregar presença:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatarData = (data) => {
    if (!data) return '-';
    return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
  };

  const adicionarVisitante = async () => {
    if (!visitanteForm.nome_visitante || !visitanteForm.nome_loja || !visitanteForm.cidade) return;
    
    const { error } = await supabase
      .from('visitantes_sessao')
      .insert([{ sessao_id: sessaoId, ...visitanteForm }]);
    
    if (!error) {
      carregarDados();
      setVisitanteForm({ nome_visitante: '', nome_loja: '', cidade: '' });
    }
  };

  const excluirVisitante = async (id) => {
    const { error } = await supabase
      .from('visitantes_sessao')
      .delete()
      .eq('id', id);
    
    if (!error) carregarDados();
  };

  const estatisticas = {
    total: presencas.length,
    presentes: presencas.filter(p => p.presente).length,
    ausentesJustificados: presencas.filter(p => !p.presente && p.justificativa).length,
    ausentesInjustificados: presencas.filter(p => !p.presente && !p.justificativa).length
  };

  const percentualPresenca = estatisticas.total > 0 
    ? Math.round((estatisticas.presentes / estatisticas.total) * 100) 
    : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Cabeçalho */}
        <div className="bg-blue-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Visualizar Presença</h2>
              {sessao && (
                <div className="mt-2 space-y-1">
                  <p className="text-blue-100">
                    {sessao.graus_sessao?.nome}
                    {sessao.classificacoes_sessao && ` - ${sessao.classificacoes_sessao.nome}`}
                  </p>
                  <p className="text-sm text-blue-200">
                    Data: {formatarData(sessao.data_sessao)}
                  </p>
                </div>
              )}
            </div>
            <button
              onClick={onFechar}
              className="text-white hover:bg-blue-700 rounded-full p-2 transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Estatísticas */}
        {!loading && (
          <div className="grid grid-cols-4 gap-4 p-6 bg-gray-50 border-b">
            <div className="text-center">
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-800">{estatisticas.total}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-green-600">Presentes</p>
              <p className="text-2xl font-bold text-green-700">{estatisticas.presentes}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-yellow-600">Justificados</p>
              <p className="text-2xl font-bold text-yellow-700">{estatisticas.ausentesJustificados}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-red-600">Injustificados</p>
              <p className="text-2xl font-bold text-red-700">{estatisticas.ausentesInjustificados}</p>
            </div>
          </div>
        )}

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Carregando presenças...</p>
              </div>
            </div>
          ) : presencas.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              Nenhuma presença registrada nesta sessão.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Irmão
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Grau
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Presença
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Justificativa
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {presencas.map((registro) => (
                    <tr key={registro.id} className={
                      registro.presente 
                        ? 'bg-green-50 hover:bg-green-100' 
                        : registro.justificativa 
                          ? 'bg-yellow-50 hover:bg-yellow-100'
                          : 'bg-red-50 hover:bg-red-100'
                    }>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {registro.irmaos.foto_url && (
                            <img
                              src={registro.irmaos.foto_url}
                              alt={registro.irmaos.nome}
                              className="h-10 w-10 rounded-full mr-3 object-cover"
                            />
                          )}
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {registro.irmaos.nome}
                            </div>
                            <div className="flex gap-2 mt-1">
                              {registro.irmaos.situacao && registro.irmaos.situacao.toLowerCase() === 'licenciado' && (
                                <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded bg-orange-100 text-orange-800">
                                  Licenciado
                                </span>
                              )}
                              {registro.tem_prerrogativa && (
                                <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded bg-purple-100 text-purple-800">
                                  Com Prerrogativa
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          {registro.grau}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {registro.presente ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                            ✓ Presente
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                            ✗ Ausente
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {registro.justificativa ? (
                          <div className="text-sm text-gray-700 bg-yellow-100 px-3 py-2 rounded">
                            {registro.justificativa}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Seção de Visitantes - Altura limitada - SOMENTE VISUALIZAÇÃO */}
        <div className="px-6 py-4 border-t bg-gray-50">
          <h3 className="text-lg font-bold text-gray-800 mb-3">👥 Visitantes</h3>

          {/* Tabela com altura máxima de ~5cm (200px) e scroll vertical */}
          {visitantes.length > 0 ? (
            <div className="max-h-[200px] overflow-y-auto border border-gray-300 rounded">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-200 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left">Nome</th>
                    <th className="px-3 py-2 text-left">Loja</th>
                    <th className="px-3 py-2 text-left">Cidade</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {visitantes.map((v) => (
                    <tr key={v.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2">{v.nome_visitante}</td>
                      <td className="px-3 py-2">{v.nome_loja}</td>
                      <td className="px-3 py-2">{v.cidade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-sm text-center py-3">Nenhum visitante registrado</p>
          )}
        </div>

        {/* Rodapé */}
        <div className="bg-gray-50 px-6 py-4 border-t flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Taxa de Presença: <span className="font-bold text-lg">{percentualPresenca}%</span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                onFechar();
                if (onEditar) {
                  onEditar(sessaoId);
                }
              }}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"
            >
              ✏️ Editar Presenças
            </button>
            <button
              onClick={onFechar}
              className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
