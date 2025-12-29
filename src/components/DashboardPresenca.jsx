import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import ModalGradePresenca from './ModalGradePresenca';

export default function DashboardPresenca() {
  const [dados, setDados] = useState({ sessoes: 0, irmaos: 0, registros: 0 });
  const [resumo, setResumo] = useState([]);
  const [resumoAno, setResumoAno] = useState([]);
  const [mostrarGrade, setMostrarGrade] = useState(false);
  const [periodo, setPeriodo] = useState('ano');
  const [percentualAlerta, setPercentualAlerta] = useState(30);
  const [anoPresenca100, setAnoPresenca100] = useState(2025);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  useEffect(() => {
    definirPeriodo('ano');
  }, []);

  useEffect(() => {
    if (dataInicio && dataFim) {
      carregar();
    }
  }, [dataInicio, dataFim]);

  useEffect(() => {
    carregarResumoAno();
  }, [anoPresenca100]);

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
        .select('*')
        .gte('data_sessao', inicioAno)
        .lte('data_sessao', fimAno);

      const sessaoIds = sessoesAno?.map(s => s.id) || [];
      if (sessaoIds.length === 0) {
        setResumoAno([]);
        return;
      }

      // 2. Buscar irmãos com grau
      const { data: irmaos } = await supabase
        .from('irmaos')
        .select('id, nome, data_iniciacao, data_elevacao, data_exaltacao')
        .eq('status', 'ativo');

      // 3. Buscar todos registros do ano
      const { data: registros } = await supabase
        .from('registros_presenca')
        .select('membro_id, presente, sessao_id')
        .in('sessao_id', sessaoIds);

      // Mapear sessões por ID
      const sessoesMap = {};
      sessoesAno?.forEach(s => {
        sessoesMap[s.id] = s;
      });

      // Processar cada irmão
      const com100 = [];
      
      irmaos?.forEach(irmao => {
        // Determinar grau ATUAL e data correspondente
        let grauAtual = 0;
        let dataGrauAtual = null;
        
        if (irmao.data_exaltacao) {
          grauAtual = 3;
          dataGrauAtual = new Date(irmao.data_exaltacao);
        } else if (irmao.data_elevacao) {
          grauAtual = 2;
          dataGrauAtual = new Date(irmao.data_elevacao);
        } else if (irmao.data_iniciacao) {
          grauAtual = 1;
          dataGrauAtual = new Date(irmao.data_iniciacao);
        }

        if (grauAtual === 0 || !dataGrauAtual) return;

        // Filtrar sessões: APÓS data do grau E do tipo permitido
        const sessoesAplicaveis = sessoesAno.filter(s => {
          const dataSessao = new Date(s.data_sessao);
          
          // Sessão ANTES da data do grau? Não aplica
          if (dataSessao < dataGrauAtual) return false;
          
          const tipo = s.tipo || s.tipo_sessao || s.grau_sessao || '';
          
          // Aprendiz: só sessões Aprendiz
          if (grauAtual === 1) {
            return tipo.includes('Aprendiz') || tipo.includes('Administrativa');
          }
          
          // Companheiro: Aprendiz + Companheiro
          if (grauAtual === 2) {
            return tipo.includes('Aprendiz') || tipo.includes('Companheiro') || tipo.includes('Administrativa');
          }
          
          // Mestre: TODAS
          if (grauAtual === 3) {
            return true;
          }
          
          return false;
        });

        const totalAplicaveis = sessoesAplicaveis.length;
        if (totalAplicaveis === 0) return;

        // Contar presenças
        let presentes = 0;
        let aprendiz = 0, companheiro = 0, mestre = 0;

        sessoesAplicaveis.forEach(sessao => {
          const reg = registros?.find(r => r.membro_id === irmao.id && r.sessao_id === sessao.id);
          
          if (reg && reg.presente) {
            presentes++;
            
            const tipo = sessao.tipo || sessao.tipo_sessao || sessao.grau_sessao || '';
            if (tipo.includes('Aprendiz')) aprendiz++;
            else if (tipo.includes('Companheiro')) companheiro++;
            else if (tipo.includes('Mestre')) mestre++;
          }
        });

        // 100% = presentes em TODAS aplicáveis
        if (presentes === totalAplicaveis && presentes > 0) {
          com100.push({
            id: irmao.id,
            nome: irmao.nome,
            total_sessoes: totalAplicaveis,
            aprendiz,
            companheiro,
            mestre
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
      // 1. Contar sessões DO PERÍODO
      const { count: totalSessoes } = await supabase
        .from('sessoes_presenca')
        .select('*', { count: 'exact', head: true })
        .gte('data_sessao', dataInicio)
        .lte('data_sessao', dataFim);

      // 2. Contar irmãos ativos
      const { count: totalIrmaos } = await supabase
        .from('irmaos')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ativo');

      // 3. Query ÚNICA com JOIN e agregação
      const { data: registros } = await supabase
        .from('registros_presenca')
        .select(`
          membro_id,
          presente,
          irmaos!inner(nome),
          sessoes_presenca!inner(data_sessao)
        `)
        .gte('sessoes_presenca.data_sessao', dataInicio)
        .lte('sessoes_presenca.data_sessao', dataFim)
        .eq('irmaos.status', 'ativo');

      // Agrupar por irmão
      const grupos = {};
      registros?.forEach(reg => {
        if (!grupos[reg.membro_id]) {
          grupos[reg.membro_id] = {
            id: reg.membro_id,
            nome: reg.irmaos.nome,
            total_registros: 0,
            presentes: 0
          };
        }
        grupos[reg.membro_id].total_registros++;
        if (reg.presente) grupos[reg.membro_id].presentes++;
      });

      // Calcular taxas
      const resumoCompleto = Object.values(grupos).map(g => ({
        ...g,
        ausentes: g.total_registros - g.presentes,
        taxa: g.total_registros > 0 ? Math.round((g.presentes / g.total_registros) * 100) : 0
      }));

      // Média de presença
      const somaPresencas = resumoCompleto.reduce((sum, r) => sum + r.taxa, 0);
      const totalComRegistros = resumoCompleto.filter(r => r.total_registros > 0).length;
      const mediaPresenca = totalComRegistros > 0 ? Math.round(somaPresencas / totalComRegistros) : 0;

      setDados({
        sessoes: totalSessoes || 0,
        irmaos: totalIrmaos || 0,
        mediaPresenca
      });

      setResumo(resumoCompleto);

    } catch (error) {
      console.error('Erro:', error);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      
      {/* Cabeçalho com Título e Filtros */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Dashboard de Presença</h1>
        
        {/* Seletor de Período */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700 min-w-[60px]">Período:</label>
          <div className="flex gap-3 flex-1">
            {['mes', 'trimestre', 'semestre', 'ano'].map(p => (
              <button
                key={p}
                onClick={() => definirPeriodo(p)}
                className={`flex-1 py-3 rounded-lg text-sm font-semibold transition-all ${
                  periodo === p
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50'
                }`}
              >
                {p === 'mes' ? 'Mês' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-3 text-sm text-gray-600">
          📅 De <strong>{new Date(dataInicio).toLocaleDateString('pt-BR')}</strong> até <strong>{new Date(dataFim).toLocaleDateString('pt-BR')}</strong>
        </p>
      </div>
      {/* Cards Totais */}
      <div className="grid grid-cols-4 gap-6 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <p className="text-blue-600 font-semibold mb-2">Sessões</p>
          <p className="text-4xl font-bold text-blue-800">{dados.sessoes}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <p className="text-green-600 font-semibold mb-2">Irmãos</p>
          <p className="text-4xl font-bold text-green-800">{dados.irmaos}</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 text-center">
          <p className="text-purple-600 font-semibold mb-2">Média Presença</p>
          <p className="text-4xl font-bold text-purple-800">{dados.mediaPresenca || 0}%</p>
        </div>
        <div className="bg-white border border-gray-300 rounded-lg p-6 text-center">
          <button
            onClick={() => setMostrarGrade(true)}
            className="w-full h-full flex flex-col items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <span className="text-3xl mb-2">📊</span>
            <span className="font-semibold text-gray-700">Matrix Presença</span>
          </button>
        </div>
      </div>

      {/* Quadros lado a lado */}
      <div className="grid grid-cols-2 gap-6">
        
        {/* Quadro: Presença 100% */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-green-600 text-white p-4 flex items-center justify-between">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <span>🏆</span>
              Presença 100%
            </h3>
            <select
              value={anoPresenca100}
              onChange={(e) => setAnoPresenca100(Number(e.target.value))}
              className="bg-green-700 text-white px-3 py-1 rounded font-semibold"
            >
              {[2025, 2026, 2027, 2028, 2029, 2030].map(ano => (
                <option key={ano} value={ano}>{ano}</option>
              ))}
            </select>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto">
            {resumoAno.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Nenhum irmão com 100% em {anoPresenca100}</p>
            ) : (
              <div className="space-y-2">
                {resumoAno.map(irmao => (
                  <div key={irmao.id} className="p-3 bg-green-50 rounded hover:bg-green-100 transition-colors">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-gray-800">
                        {irmao.nome.split(' ').slice(0, 2).join(' ')}
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
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quadro: Ausências acima do percentual configurado */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-orange-600 text-white p-4 flex items-center justify-between">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <span>⚠️</span>
              Ausências
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-sm">≥</span>
              <input
                type="number"
                min="0"
                max="100"
                value={percentualAlerta}
                onChange={(e) => setPercentualAlerta(Number(e.target.value))}
                className="w-16 px-2 py-1 bg-orange-700 text-white rounded font-semibold text-center"
              />
              <span className="text-sm">%</span>
            </div>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto">
            {resumo.filter(i => {
              const percAusencias = i.total_registros > 0 ? (i.ausentes / i.total_registros) * 100 : 0;
              return percAusencias >= percentualAlerta;
            }).length === 0 ? (
              <p className="text-gray-500 text-center py-8">Nenhum irmão com ≥{percentualAlerta}% ausências</p>
            ) : (
              <div className="space-y-2">
                {resumo
                  .filter(i => {
                    const percAusencias = i.total_registros > 0 ? (i.ausentes / i.total_registros) * 100 : 0;
                    return percAusencias >= percentualAlerta;
                  })
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
                            {irmao.nome.split(' ').slice(0, 2).join(' ')}
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
                  <span className="font-semibold text-gray-900">{irmao.nome}</span>
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
