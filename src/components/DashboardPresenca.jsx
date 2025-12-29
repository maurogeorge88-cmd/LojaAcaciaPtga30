import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function DashboardPresenca() {
  const [dados, setDados] = useState({ sessoes: 0, irmaos: 0, registros: 0 });
  const [resumo, setResumo] = useState([]);

  useEffect(() => {
    carregar();
  }, []);

  const carregar = async () => {
    try {
      // 1. Contar sessões
      const { count: totalSessoes } = await supabase
        .from('sessoes_presenca')
        .select('*', { count: 'exact', head: true });

      // 2. Contar irmãos ativos
      const { count: totalIrmaos } = await supabase
        .from('irmaos')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ativo');

      // 3. Contar registros
      const { count: totalRegistros } = await supabase
        .from('registros_presenca')
        .select('*', { count: 'exact', head: true });

      setDados({
        sessoes: totalSessoes || 0,
        irmaos: totalIrmaos || 0,
        registros: totalRegistros || 0
      });

      // 4. Buscar resumo por irmão - SEM FILTROS
      const { data: irmaos } = await supabase
        .from('irmaos')
        .select('id, nome')
        .eq('status', 'ativo')
        .order('nome');

      // Para cada irmão, contar registros
      const resumoCompleto = [];
      for (const irmao of irmaos || []) {
        const { count: totalRegs } = await supabase
          .from('registros_presenca')
          .select('*', { count: 'exact', head: true })
          .eq('membro_id', irmao.id);

        const { count: presentes } = await supabase
          .from('registros_presenca')
          .select('*', { count: 'exact', head: true })
          .eq('membro_id', irmao.id)
          .eq('presente', true);

        const ausentes = (totalRegs || 0) - (presentes || 0);
        const taxa = totalRegs > 0 ? Math.round((presentes / totalRegs) * 100) : 0;

        resumoCompleto.push({
          id: irmao.id,
          nome: irmao.nome,
          total_registros: totalRegs || 0,
          presentes: presentes || 0,
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
      
      {/* Cards Totais */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 text-center">
          <p className="text-blue-600 font-semibold mb-2">Total de Sessões</p>
          <p className="text-4xl font-bold text-blue-800">{dados.sessoes}</p>
        </div>
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 text-center">
          <p className="text-green-600 font-semibold mb-2">Total de Irmãos</p>
          <p className="text-4xl font-bold text-green-800">{dados.irmaos}</p>
        </div>
        <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-6 text-center">
          <p className="text-purple-600 font-semibold mb-2">Total de Registros</p>
          <p className="text-4xl font-bold text-purple-800">{dados.registros}</p>
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
