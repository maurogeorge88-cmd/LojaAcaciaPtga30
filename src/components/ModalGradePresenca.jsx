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

export default function ModalGradePresenca({ onFechar, periodoInicio, periodoFim }) {
  const [loading, setLoading] = useState(true);
  const [sessoes, setSessoes] = useState([]);
  const [irmaos, setIrmaos] = useState([]);
  const [irmaosExibidos, setIrmaosExibidos] = useState([]);
  const [gradePresenca, setGradePresenca] = useState({});
  const [filtroNome, setFiltroNome] = useState('');
  const [filtro100, setFiltro100] = useState(false);

  useEffect(() => {
    carregarDados();
  }, [periodoInicio, periodoFim]);

  useEffect(() => {
    aplicarFiltros();
  }, [irmaos, filtroNome, filtro100, sessoes, gradePresenca]);

  const aplicarFiltros = () => {
    let filtrados = [...irmaos];

    // Filtro por nome
    if (filtroNome.trim()) {
      filtrados = filtrados.filter(irmao =>
        irmao.nome.toLowerCase().includes(filtroNome.toLowerCase())
      );
    }

    // Filtro 100%
    if (filtro100) {
      filtrados = filtrados.filter(irmao => {
        // Filtrar sessões obrigatórias (não isentas)
        const sessoesObrigatorias = sessoes.filter(sessao => {
          const tipoSessao = sessao.graus_sessao?.nome;
          const dataSessao = new Date(sessao.data_sessao + 'T00:00:00');
          
          // 1. Verificar se já estava no grau
          if (irmao.grau === 'Aprendiz' && irmao.data_iniciacao) {
            const dataIniciacao = new Date(irmao.data_iniciacao + 'T00:00:00');
            if (dataSessao < dataIniciacao) return false; // Ainda não era aprendiz
          } else if (irmao.grau === 'Companheiro' && irmao.data_elevacao) {
            const dataElevacao = new Date(irmao.data_elevacao + 'T00:00:00');
            if (dataSessao < dataElevacao) return false; // Ainda não era companheiro
          } else if (irmao.grau === 'Mestre' && irmao.data_exaltacao) {
            const dataExaltacao = new Date(irmao.data_exaltacao + 'T00:00:00');
            if (dataSessao < dataExaltacao) return false; // Ainda não era mestre
          }
          
          // 2. Verificar se estava licenciado (isento APÓS data_licenca)
          if (irmao.situacao === 'licenciado' && irmao.data_licenca) {
            const dataLicenca = new Date(irmao.data_licenca + 'T00:00:00');
            if (dataSessao >= dataLicenca) return false; // Isento após licença
          }
          
          // 3. Verificar prerrogativa - calcular idade na data da sessão
          if (irmao.data_nascimento) {
            const dataNasc = new Date(irmao.data_nascimento + 'T00:00:00');
            let idadeNaSessao = dataSessao.getFullYear() - dataNasc.getFullYear();
            const mes = dataSessao.getMonth() - dataNasc.getMonth();
            if (mes < 0 || (mes === 0 && dataSessao.getDate() < dataNasc.getDate())) {
              idadeNaSessao--;
            }
            if (idadeNaSessao >= 70) return false; // Isento com 70+
          }
          
          // 4. Verificar tipo de sessão permitido pelo grau
          if (irmao.grau === 'Aprendiz') {
            return tipoSessao === 'Sessão de Aprendiz' || tipoSessao === 'Sessão Administrativa';
          }
          if (irmao.grau === 'Companheiro') {
            return tipoSessao === 'Sessão de Aprendiz' || 
                   tipoSessao === 'Sessão de Companheiro' || 
                   tipoSessao === 'Sessão Administrativa';
          }
          if (irmao.grau === 'Mestre') {
            return true;
          }
          return tipoSessao === 'Sessão Administrativa';
        });

        const presencasIrmao = gradePresenca[irmao.id] || {};
        const totalObrigatorias = sessoesObrigatorias.length;
        const presentesObrigatorias = sessoesObrigatorias.filter(s => 
          presencasIrmao[s.id]?.presente
        ).length;

        return totalObrigatorias > 0 && presentesObrigatorias === totalObrigatorias;
      });
    }

    setIrmaosExibidos(filtrados);
  };

  const carregarDados = async () => {
    try {
      setLoading(true);

      // 1. Buscar todas as sessões do período
      const { data: sessoesData, error: erroSessoes } = await supabase
        .from('sessoes_presenca')
        .select(`
          id,
          data_sessao,
          graus_sessao:grau_sessao_id (nome)
        `)
        .gte('data_sessao', periodoInicio)
        .lte('data_sessao', periodoFim)
        .order('data_sessao', { ascending: true });

      if (erroSessoes) throw erroSessoes;
      setSessoes(sessoesData || []);

      // 2. Buscar todos os irmãos regulares e licenciados
      const { data: irmaosData, error: erroIrmaos } = await supabase
        .from('irmaos')
        .select('id, nome, data_nascimento, situacao, data_iniciacao, data_elevacao, data_exaltacao, data_licenca, data_desligamento, data_falecimento')
        .in('situacao', ['regular', 'licenciado'])
        .order('nome');

      if (erroIrmaos) throw erroIrmaos;

      // Adicionar grau, idade e prerrogativa aos irmãos
      const irmaosComGrau = irmaosData.map(irmao => {
        const idade = irmao.data_nascimento ? calcularIdade(irmao.data_nascimento) : null;
        return {
          ...irmao,
          grau: irmao.data_exaltacao ? 'Mestre' : 
                irmao.data_elevacao ? 'Companheiro' : 
                irmao.data_iniciacao ? 'Aprendiz' : 'Sem Grau',
          idade,
          tem_prerrogativa: idade >= 70,
          data_licenca: irmao.data_licenca,
          data_desligamento: irmao.data_desligamento,
          data_falecimento: irmao.data_falecimento
        };
      });

      setIrmaos(irmaosComGrau || []);

      // 3. Buscar todos os registros de presença do período
      const sessaoIds = sessoesData.map(s => s.id);
      if (sessaoIds.length > 0) {
        const { data: presencasData, error: erroPresencas } = await supabase
          .from('registros_presenca')
          .select('sessao_id, membro_id, presente, justificativa')
          .in('sessao_id', sessaoIds);

        if (erroPresencas) throw erroPresencas;

        // Criar grade de presença: { [irmaoId]: { [sessaoId]: { presente, justificativa } } }
        const grade = {};
        presencasData.forEach(reg => {
          if (!grade[reg.membro_id]) grade[reg.membro_id] = {};
          grade[reg.membro_id][reg.sessao_id] = {
            presente: reg.presente,
            justificativa: reg.justificativa
          };
        });

        setGradePresenca(grade);
      }

    } catch (error) {
      console.error('Erro ao carregar grade:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatarData = (data) => {
    if (!data) return '-';
    const date = new Date(data + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const calcularTaxaIrmao = (irmaoId) => {
    const presencasIrmao = gradePresenca[irmaoId] || {};
    const totalSessoes = sessoes.length;
    if (totalSessoes === 0) return 0;
    
    const presentes = Object.values(presencasIrmao).filter(p => p.presente).length;
    return Math.round((presentes / totalSessoes) * 100);
  };

  const obterCorTaxa = (taxa) => {
    if (taxa === 100) return 'bg-green-500 text-white';
    if (taxa >= 90) return 'bg-green-400 text-white';
    if (taxa >= 70) return 'bg-yellow-400 text-gray-900';
    if (taxa >= 50) return 'bg-orange-400 text-white';
    return 'bg-red-500 text-white';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full h-[90vh] max-w-[95vw] overflow-hidden flex flex-col">
        {/* Cabeçalho */}
        <div className="bg-blue-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Grade de Presença</h2>
              <p className="text-blue-100 mt-1">
                Período: {formatarData(periodoInicio)} a {formatarData(periodoFim)}
              </p>
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

          {/* Filtros */}
          <div className="flex gap-4 mt-4">
            <div className="flex-1">
              <input
                type="text"
                value={filtroNome}
                onChange={(e) => setFiltroNome(e.target.value)}
                placeholder="🔍 Pesquisar irmão..."
                className="w-full px-4 py-2 rounded-md text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white"
              />
            </div>
            <label className="flex items-center gap-2 bg-white bg-opacity-20 px-4 py-2 rounded-md cursor-pointer hover:bg-opacity-30 transition">
              <input
                type="checkbox"
                checked={filtro100}
                onChange={(e) => setFiltro100(e.target.checked)}
                className="w-5 h-5 cursor-pointer"
              />
              <span className="font-medium whitespace-nowrap">Apenas 100%</span>
            </label>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Carregando grade...</p>
              </div>
            </div>
          ) : sessoes.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              Nenhuma sessão encontrada no período selecionado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 sticky top-0 z-10">
                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-sm bg-gray-100 sticky left-0 z-20">
                      Irmão
                    </th>
                    <th className="border border-gray-300 px-2 py-3 text-center font-semibold text-sm bg-gray-100 sticky left-[200px] z-20">
                      Grau
                    </th>
                    {sessoes.map((sessao) => {
                      // Simplificar nome da sessão
                      let nomeSessao = sessao.graus_sessao?.nome || 'Sessão';
                      nomeSessao = nomeSessao
                        .replace('Sessão de ', '')
                        .replace('Sessão ', '');
                      
                      return (
                        <th key={sessao.id} className="border border-gray-300 px-2 py-2 text-center text-xs whitespace-nowrap">
                          <div className="font-semibold text-xs">{formatarData(sessao.data_sessao)}</div>
                          <div className="text-gray-600 font-normal text-xs">{nomeSessao}</div>
                        </th>
                      );
                    })}
                    <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-sm bg-gray-100 sticky right-0 z-20">
                      Taxa
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {irmaosExibidos.map((irmao) => {
                    // Filtrar sessões obrigatórias (não isentas)
                    const sessoesObrigatorias = sessoes.filter(sessao => {
                      const tipoSessao = sessao.graus_sessao?.nome;
                      const dataSessao = new Date(sessao.data_sessao + 'T00:00:00');
                      
                      // 1. Verificar se já estava no grau
                      if (irmao.grau === 'Aprendiz' && irmao.data_iniciacao) {
                        const dataIniciacao = new Date(irmao.data_iniciacao + 'T00:00:00');
                        if (dataSessao < dataIniciacao) return false;
                      } else if (irmao.grau === 'Companheiro' && irmao.data_elevacao) {
                        const dataElevacao = new Date(irmao.data_elevacao + 'T00:00:00');
                        if (dataSessao < dataElevacao) return false;
                      } else if (irmao.grau === 'Mestre' && irmao.data_exaltacao) {
                        const dataExaltacao = new Date(irmao.data_exaltacao + 'T00:00:00');
                        if (dataSessao < dataExaltacao) return false;
                      }
                      
                      // 2. Licenciado isento APÓS data_licenca
                      if (irmao.situacao === 'licenciado' && irmao.data_licenca) {
                        const dataLicenca = new Date(irmao.data_licenca + 'T00:00:00');
                        if (dataSessao >= dataLicenca) return false;
                      }
                      
                      // 3. Prerrogativa - idade NA DATA DA SESSÃO
                      if (irmao.data_nascimento) {
                        const dataNasc = new Date(irmao.data_nascimento + 'T00:00:00');
                        let idadeNaSessao = dataSessao.getFullYear() - dataNasc.getFullYear();
                        const mes = dataSessao.getMonth() - dataNasc.getMonth();
                        if (mes < 0 || (mes === 0 && dataSessao.getDate() < dataNasc.getDate())) {
                          idadeNaSessao--;
                        }
                        if (idadeNaSessao >= 70) return false;
                      }
                      
                      // 4. Tipo de sessão permitido
                      if (irmao.grau === 'Aprendiz') {
                        return tipoSessao === 'Sessão de Aprendiz' || tipoSessao === 'Sessão Administrativa';
                      }
                      if (irmao.grau === 'Companheiro') {
                        return tipoSessao === 'Sessão de Aprendiz' || 
                               tipoSessao === 'Sessão de Companheiro' || 
                               tipoSessao === 'Sessão Administrativa';
                      }
                      if (irmao.grau === 'Mestre') {
                        return true;
                      }
                      return tipoSessao === 'Sessão Administrativa';
                    });

                    const presencasIrmao = gradePresenca[irmao.id] || {};
                    
                    // Calcular taxa baseada apenas nas sessões obrigatórias
                    const totalObrigatorias = sessoesObrigatorias.length;
                    const presentesObrigatorias = sessoesObrigatorias.filter(s => 
                      presencasIrmao[s.id]?.presente
                    ).length;
                    const taxa = totalObrigatorias > 0 
                      ? Math.round((presentesObrigatorias / totalObrigatorias) * 100) 
                      : 0;

                    return (
                      <tr key={irmao.id} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-4 py-3 font-medium text-sm whitespace-nowrap bg-white sticky left-0 z-10">
                          <div>
                            <div>{irmao.nome.split(' ').slice(0, 2).join(' ')}</div>
                            <div className="flex gap-1 mt-1">
                              {irmao.situacao && irmao.situacao.toLowerCase() === 'licenciado' && (
                                <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded bg-orange-100 text-orange-800">
                                  Licenciado
                                </span>
                              )}
                              {irmao.tem_prerrogativa && (
                                <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded bg-purple-100 text-purple-800">
                                  Com Prerrogativa
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="border border-gray-300 px-2 py-3 text-center text-xs bg-white sticky left-[200px] z-10">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                            {irmao.grau}
                          </span>
                        </td>
                        {sessoes.map((sessao) => {
                          const tipoSessao = sessao.graus_sessao?.nome;
                          const dataSessao = new Date(sessao.data_sessao + 'T00:00:00');
                          
                          // VERIFICAR SE AINDA NÃO ESTAVA NO GRAU (mostra traço -)
                          let aindaNaoTinhaGrau = false;
                          if (irmao.grau === 'Aprendiz' && irmao.data_iniciacao) {
                            const dataIniciacao = new Date(irmao.data_iniciacao + 'T00:00:00');
                            aindaNaoTinhaGrau = dataSessao < dataIniciacao;
                          } else if (irmao.grau === 'Companheiro' && irmao.data_elevacao) {
                            const dataElevacao = new Date(irmao.data_elevacao + 'T00:00:00');
                            aindaNaoTinhaGrau = dataSessao < dataElevacao;
                          } else if (irmao.grau === 'Mestre' && irmao.data_exaltacao) {
                            const dataExaltacao = new Date(irmao.data_exaltacao + 'T00:00:00');
                            aindaNaoTinhaGrau = dataSessao < dataExaltacao;
                          }
                          
                          // Se ainda não tinha o grau, mostrar apenas traço
                          if (aindaNaoTinhaGrau) {
                            return (
                              <td key={sessao.id} className="border border-gray-300 px-2 py-2 text-center bg-gray-100">
                                <span className="text-gray-400 text-sm">-</span>
                              </td>
                            );
                          }
                          
                          // VERIFICAR SE PODE PARTICIPAR PELO TIPO DE SESSÃO (grau)
                          let podeParticipar = false;
                          if (irmao.grau === 'Aprendiz') {
                            podeParticipar = tipoSessao === 'Sessão de Aprendiz' || tipoSessao === 'Sessão Administrativa';
                          } else if (irmao.grau === 'Companheiro') {
                            podeParticipar = tipoSessao === 'Sessão de Aprendiz' || 
                                           tipoSessao === 'Sessão de Companheiro' || 
                                           tipoSessao === 'Sessão Administrativa';
                          } else if (irmao.grau === 'Mestre') {
                            podeParticipar = true;
                          } else {
                            podeParticipar = tipoSessao === 'Sessão Administrativa';
                          }

                          // Se não pode participar (grau superior), mostrar traço
                          if (!podeParticipar) {
                            return (
                              <td key={sessao.id} className="border border-gray-300 px-2 py-2 text-center bg-gray-100">
                                <span className="text-gray-400 text-sm">-</span>
                              </td>
                            );
                          }

                          // Licenciados e prerrogativa mostram normalmente (✓, X, J)
                          const reg = presencasIrmao[sessao.id];
                          
                          if (!reg) {
                            // Sem registro
                            return (
                              <td key={sessao.id} className="border border-gray-300 px-2 py-2 text-center bg-gray-100">
                                <span className="text-gray-400 text-sm">-</span>
                              </td>
                            );
                          }

                          if (reg.presente) {
                            // Presente
                            return (
                              <td key={sessao.id} className="border border-gray-300 px-2 py-2 text-center bg-green-50">
                                <span className="text-green-600 text-lg font-bold">✓</span>
                              </td>
                            );
                          }

                          if (reg.justificativa) {
                            // Ausente justificado
                            return (
                              <td 
                                key={sessao.id} 
                                className="border border-gray-300 px-2 py-2 text-center bg-yellow-50"
                                title={reg.justificativa}
                              >
                                <span className="text-yellow-600 text-lg font-bold">J</span>
                              </td>
                            );
                          }

                          // Ausente injustificado
                          return (
                            <td key={sessao.id} className="border border-gray-300 px-2 py-2 text-center bg-red-50">
                              <span className="text-red-600 text-lg font-bold">✗</span>
                            </td>
                          );
                        })}
                        <td className={`border border-gray-300 px-4 py-3 text-center font-bold sticky right-0 z-10 ${obterCorTaxa(taxa)}`}>
                          {taxa}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Legenda */}
          {!loading && sessoes.length > 0 && (
            <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-sm text-gray-700">Legenda:</h4>
                <p className="text-sm text-gray-600">
                  Exibindo <strong>{irmaosExibidos.length}</strong> de <strong>{irmaos.length}</strong> irmão(s)
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-green-600 text-2xl font-bold">✓</span>
                  <span className="text-gray-700">Presente</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-red-600 text-2xl font-bold">✗</span>
                  <span className="text-gray-700">Ausente (injustificado)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-yellow-600 text-2xl font-bold">J</span>
                  <span className="text-gray-700">Ausente (justificado)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-xs">-</span>
                  <span className="text-gray-700">Sem registro</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-xs font-semibold">N/A</span>
                  <span className="text-gray-700">Grau não permitido</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="bg-gray-50 px-6 py-4 border-t flex justify-end">
          <button
            onClick={onFechar}
            className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
