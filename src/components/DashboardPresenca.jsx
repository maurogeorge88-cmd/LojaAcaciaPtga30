import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import ModalGradePresenca from './ModalGradePresenca';

export default function DashboardPresenca() {
  const [dados, setDados] = useState({ sessoes: 0, irmaos: 0, registros: 0 });
  const [resumo, setResumo] = useState([]);
  const [mostrarGrade, setMostrarGrade] = useState(false);
  const [periodo, setPeriodo] = useState('ano');
  const [percentualAlerta, setPercentualAlerta] = useState(30);
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

  const definirPeriodo = (p) => {
    setPeriodo(p);
    const hoje = new Date();
    const inicio = new Date();
    const fim = new Date();

    switch (p) {
      case 'mes':
        inicio.setMonth(hoje.getMonth() - 1);
        break;
      case 'trimestre':
        inicio.setMonth(hoje.getMonth() - 3);
        break;
      case 'semestre':
        inicio.setMonth(hoje.getMonth() - 6);
        break;
      case 'ano':
        inicio.setFullYear(hoje.getFullYear() - 1);
        break;
    }

    setDataInicio(inicio.toISOString().split('T')[0]);
    setDataFim(fim.toISOString().split('T')[0]);
  };

  const carregar = async () => {
    try {
      // 1. Contar sessões DO PERÍODO
      const { data: sessoesData, count: totalSessoes } = await supabase
        .from('sessoes_presenca')
        .select('*', { count: 'exact' })
        .gte('data_sessao', dataInicio)
        .lte('data_sessao', dataFim);

      const sessaoIds = sessoesData?.map(s => s.id) || [];

      // 2. Contar irmãos ativos
      const { count: totalIrmaos } = await supabase
        .from('irmaos')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ativo');

      // 3. Contar registros DO PERÍODO
      let totalRegs = 0;
      if (sessaoIds.length > 0) {
        const { count } = await supabase
          .from('registros_presenca')
          .select('*', { count: 'exact', head: true })
          .in('sessao_id', sessaoIds);
        totalRegs = count || 0;
      }

      setDados({
        sessoes: totalSessoes || 0,
        irmaos: totalIrmaos || 0,
        registros: totalRegs
      });

      // 4. Buscar resumo por irmão DO PERÍODO
      const { data: irmaos } = await supabase
        .from('irmaos')
        .select('id, nome')
        .eq('status', 'ativo')
        .order('nome');

      const resumoCompleto = [];
      for (const irmao of irmaos || []) {
        // Registros do irmão NO PERÍODO
        let totalRegs = 0;
        let presentes = 0;

        if (sessaoIds.length > 0) {
          const { count: total } = await supabase
            .from('registros_presenca')
            .select('*', { count: 'exact', head: true })
            .eq('membro_id', irmao.id)
            .in('sessao_id', sessaoIds);
          totalRegs = total || 0;

          const { count: pres } = await supabase
            .from('registros_presenca')
            .select('*', { count: 'exact', head: true })
            .eq('membro_id', irmao.id)
            .eq('presente', true)
            .in('sessao_id', sessaoIds);
          presentes = pres || 0;
        }

        const ausentes = totalRegs - presentes;
        const taxa = totalRegs > 0 ? Math.round((presentes / totalRegs) * 100) : 0;

        resumoCompleto.push({
          id: irmao.id,
          nome: irmao.nome,
          total_registros: totalRegs,
          presentes,
          ausentes,
          taxa
        });
      }

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
        <div className="flex items-center gap-4 mb-4">
          <label className="font-semibold text-gray-700">Período:</label>
          <div className="flex gap-2">
            {['mes', 'trimestre', 'semestre', 'ano'].map(p => (
              <button
                key={p}
                onClick={() => definirPeriodo(p)}
                className={`px-4 py-2 rounded font-medium transition-colors ${
                  periodo === p
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Controle de Percentual de Alerta */}
        <div className="flex items-center gap-4">
          <label className="font-semibold text-gray-700">% Alerta de Ausência:</label>
          <input
            type="number"
            min="0"
            max="100"
            value={percentualAlerta}
            onChange={(e) => setPercentualAlerta(Number(e.target.value))}
            className="w-20 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <span className="text-sm text-gray-600">
            (Irmãos com {percentualAlerta}% ou mais de ausências)
          </span>
        </div>

        <p className="mt-4 text-sm text-gray-600">
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
          <p className="text-purple-600 font-semibold mb-2">Registros</p>
          <p className="text-4xl font-bold text-purple-800">{dados.registros}</p>
        </div>
        <div className="bg-white border border-gray-300 rounded-lg p-6 text-center">
          <button
            onClick={() => setMostrarGrade(true)}
            className="w-full h-full flex flex-col items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <span className="text-3xl mb-2">📊</span>
            <span className="font-semibold text-gray-700">Ver Grade</span>
          </button>
        </div>
      </div>

      {/* Quadros lado a lado */}
      <div className="grid grid-cols-2 gap-6">
        
        {/* Quadro: Presença 100% */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-green-600 text-white p-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <span>🏆</span>
              Presença 100%
            </h3>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto">
            {resumo.filter(i => i.taxa === 100).length === 0 ? (
              <p className="text-gray-500 text-center py-8">Nenhum irmão com 100%</p>
            ) : (
              <div className="space-y-2">
                {resumo.filter(i => i.taxa === 100).map(irmao => (
                  <div key={irmao.id} className="flex justify-between items-center p-3 bg-green-50 rounded hover:bg-green-100 transition-colors">
                    <span className="font-medium text-gray-800">{irmao.nome}</span>
                    <span className="bg-green-600 text-white px-3 py-1 rounded text-sm font-semibold">
                      {irmao.total_registros}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quadro: Ausências acima do percentual configurado */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-orange-600 text-white p-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <span>⚠️</span>
              Ausências ≥ {percentualAlerta}%
            </h3>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto">
            {resumo.filter(i => {
              const percAusencias = i.total_registros > 0 ? (i.ausentes / i.total_registros) * 100 : 0;
              return percAusencias >= percentualAlerta;
            }).length === 0 ? (
              <p className="text-gray-500 text-center py-8">Nenhum irmão com {percentualAlerta}% ou mais de ausências</p>
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
                        <div>
                          <p className="font-medium text-gray-800">{irmao.nome}</p>
                          <p className="text-sm text-gray-600">
                            {irmao.ausentes} ausências de {irmao.total_registros}
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
