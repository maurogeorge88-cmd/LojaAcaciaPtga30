import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function DashboardPresenca() {
  const [dados, setDados] = useState({ sessoes: 0, irmaos: 0, registros: 0 });
  const [resumo, setResumo] = useState([]);
  const [periodo, setPeriodo] = useState('ano');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [sessoesRecentes, setSessoesRecentes] = useState([]);
  const [irmaos100, setIrmaos100] = useState([]);

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
        .select('*, graus_sessao:grau_sessao_id(nome)', { count: 'exact' })
        .gte('data_sessao', dataInicio)
        .lte('data_sessao', dataFim)
        .order('data_sessao', { ascending: false });

      // 2. Contar irmãos ativos
      const { count: totalIrmaos } = await supabase
        .from('irmaos')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ativo');

      // 3. Contar registros DO PERÍODO
      const sessaoIds = sessoesData?.map(s => s.id) || [];
      
      let todosRegistros = [];
      for (let i = 0; i < sessaoIds.length; i += 100) {
        const lote = sessaoIds.slice(i, i + 100);
        const { data } = await supabase
          .from('registros_presenca')
          .select('membro_id, presente, sessao_id')
          .in('sessao_id', lote);
        if (data) todosRegistros = [...todosRegistros, ...data];
      }

      const totalRegistros = todosRegistros.length;

      setDados({
        sessoes: totalSessoes || 0,
        irmaos: totalIrmaos || 0,
        registros: totalRegistros
      });

      // 4. Sessões recentes (últimas 5)
      setSessoesRecentes(sessoesData?.slice(0, 5) || []);

      // 5. Buscar resumo por irmão
      const { data: irmaos } = await supabase
        .from('irmaos')
        .select('id, nome')
        .eq('status', 'ativo')
        .in('situacao', ['regular', 'licenciado'])
        .order('nome');

      const resumoCompleto = [];
      const lista100 = [];

      for (const irmao of irmaos || []) {
        const regsIrmao = todosRegistros.filter(r => r.membro_id === irmao.id);
        const presentes = regsIrmao.filter(r => r.presente).length;
        const total = regsIrmao.length;
        const ausentes = total - presentes;
        const taxa = total > 0 ? Math.round((presentes / total) * 100) : 0;

        resumoCompleto.push({
          id: irmao.id,
          nome: irmao.nome,
          total_registros: total,
          presentes,
          ausentes,
          taxa
        });

        // Irmãos com 100%
        if (taxa === 100 && total > 0) {
          lista100.push({
            nome: irmao.nome,
            total_sessoes: total
          });
        }
      }

      setResumo(resumoCompleto);
      setIrmaos100(lista100);

    } catch (error) {
      console.error('Erro:', error);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      
      {/* Seletor de Período */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Dashboard de Presença</h1>
        <div className="flex gap-3">
          {['mes', 'trimestre', 'semestre', 'ano'].map(p => (
            <button
              key={p}
              onClick={() => definirPeriodo(p)}
              className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                periodo === p
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-gray-600">
          📅 Período: <strong>{new Date(dataInicio).toLocaleDateString('pt-BR')}</strong> até <strong>{new Date(dataFim).toLocaleDateString('pt-BR')}</strong>
        </p>
      </div>

      {/* Cards Totais */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 text-center">
          <p className="text-blue-600 font-semibold mb-2">Sessões no Período</p>
          <p className="text-4xl font-bold text-blue-800">{dados.sessoes}</p>
        </div>
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 text-center">
          <p className="text-green-600 font-semibold mb-2">Irmãos Ativos</p>
          <p className="text-4xl font-bold text-green-800">{dados.irmaos}</p>
        </div>
        <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-6 text-center">
          <p className="text-purple-600 font-semibold mb-2">Registros no Período</p>
          <p className="text-4xl font-bold text-purple-800">{dados.registros}</p>
        </div>
      </div>

      {/* Quadros Lado a Lado */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        
        {/* Sessões Recentes */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-blue-600 text-white p-4">
            <h2 className="text-xl font-bold">📅 Sessões Recentes</h2>
          </div>
          <div className="p-4">
            {sessoesRecentes.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Nenhuma sessão no período</p>
            ) : (
              <ul className="space-y-2">
                {sessoesRecentes.map(s => (
                  <li key={s.id} className="flex justify-between items-center p-3 bg-gray-50 rounded hover:bg-blue-50 transition-colors">
                    <div>
                      <p className="font-semibold text-gray-800">
                        {new Date(s.data_sessao + 'T00:00:00').toLocaleDateString('pt-BR', { 
                          day: '2-digit', 
                          month: 'long', 
                          year: 'numeric' 
                        })}
                      </p>
                      <p className="text-sm text-gray-600">{s.graus_sessao?.nome}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Irmãos 100% */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-green-600 text-white p-4">
            <h2 className="text-xl font-bold">🏆 Presença 100%</h2>
          </div>
          <div className="p-4">
            {irmaos100.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Nenhum irmão com 100% no período</p>
            ) : (
              <ul className="space-y-2">
                {irmaos100.map((i, idx) => (
                  <li key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded hover:bg-green-50 transition-colors">
                    <span className="font-semibold text-gray-800">{i.nome}</span>
                    <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-bold">
                      {i.total_sessoes} sessões
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Tabela */}
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

      {/* Info */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          💡 <strong>Mostrando dados BRUTOS do banco:</strong> Total geral de sessões, irmãos e registros sem nenhum filtro por período ou grau.
        </p>
      </div>
    </div>
  );
}
