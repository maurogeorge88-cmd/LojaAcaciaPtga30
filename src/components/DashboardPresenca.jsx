import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import ModalGradePresenca from './ModalGradePresenca';

export default function DashboardPresenca() {
  const [loading, setLoading] = useState(true);
  const [resumo, setResumo] = useState([]);
  const [mostrarGrade, setMostrarGrade] = useState(false);
  const [periodo, setPeriodo] = useState('ano');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  useEffect(() => {
    definirPeriodo('ano');
  }, []);

  useEffect(() => {
    if (dataInicio && dataFim) {
      carregarDados();
    }
  }, [dataInicio, dataFim]);

  const definirPeriodo = (p) => {
    setPeriodo(p);
    const hoje = new Date();
    const inicio = new Date();
    const fim = new Date();

    if (p === 'ano') {
      inicio.setFullYear(hoje.getFullYear() - 1);
      fim.setDate(hoje.getDate() + 7);
    }

    setDataInicio(inicio.toISOString().split('T')[0]);
    setDataFim(fim.toISOString().split('T')[0]);
  };

  const carregarDados = async () => {
    try {
      setLoading(true);

      console.log('📅 Período:', dataInicio, 'até', dataFim);

      // 1. Buscar sessões
      const { data: sessoes } = await supabase
        .from('sessoes_presenca')
        .select('id')
        .gte('data_sessao', dataInicio)
        .lte('data_sessao', dataFim);

      console.log('✅ Sessões:', sessoes?.length);

      // 2. Buscar irmãos
      const { data: irmaos } = await supabase
        .from('irmaos')
        .select('id, nome')
        .eq('status', 'ativo')
        .in('situacao', ['regular', 'licenciado'])
        .order('nome');

      console.log('✅ Irmãos:', irmaos?.length);

      // 3. Buscar registros - método direto com subquery
      const sessaoIds = sessoes.map(s => s.id);
      
      console.log('🔍 Buscando registros para', sessaoIds.length, 'sessões');
      console.log('🔍 IDs:', sessaoIds);
      
      // Buscar em lotes de 50 para evitar limite do .in()
      let todosRegistros = [];
      for (let i = 0; i < sessaoIds.length; i += 50) {
        const lote = sessaoIds.slice(i, i + 50);
        const { data } = await supabase
          .from('registros_presenca')
          .select('membro_id, presente, sessao_id')
          .in('sessao_id', lote);
        
        if (data) todosRegistros = [...todosRegistros, ...data];
      }
      
      const registros = todosRegistros;
      console.log('✅ Registros:', registros?.length);

      // 4. Calcular resumo por irmão
      const resumoIrmaos = irmaos.map(irmao => {
        const regsIrmao = registros.filter(r => r.membro_id === irmao.id);
        const presentes = regsIrmao.filter(r => r.presente).length;
        const ausentes = regsIrmao.filter(r => !r.presente).length;
        const total = regsIrmao.length;

        // Debug para Mauro
        if (irmao.nome.includes('Mauro George')) {
          const sessoesComRegistro = regsIrmao.map(r => {
            const reg = registros.find(x => x.membro_id === irmao.id);
            return reg;
          });
          
          console.log('🔍 MAURO - Sessões no período:', sessoes.length);
          console.log('🔍 MAURO - IDs das sessões:', sessoes.map(s => s.id));
          console.log('🔍 MAURO - Registros encontrados:', regsIrmao.length);
          console.log('🔍 MAURO - Detalhes registros:', registros.filter(r => r.membro_id === irmao.id));
        }

        return {
          id: irmao.id,
          nome: irmao.nome,
          total_sessoes: sessoes.length,
          total_registros: total,
          presentes,
          ausentes,
          taxa: total > 0 ? Math.round((presentes / total) * 100) : 0
        };
      });

      console.log('✅ Resumo:', resumoIrmaos);
      setResumo(resumoIrmaos);

    } catch (error) {
      console.error('❌ Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Carregando...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      
      {/* Cabeçalho */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Dashboard de Presença SIMPLES</h1>
        
        <div className="flex gap-4 items-center">
          <button
            onClick={() => definirPeriodo('ano')}
            className={`px-4 py-2 rounded ${periodo === 'ano' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Último Ano
          </button>
          
          <button
            onClick={() => setMostrarGrade(true)}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            📊 Ver Grade
          </button>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          Período: {dataInicio} até {dataFim}
        </div>
      </div>

      {/* Tabela Resumo */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Irmão</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total Sessões</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Registros</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Presentes</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ausentes</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Taxa %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {resumo.map(irmao => (
              <tr key={irmao.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{irmao.nome}</td>
                <td className="px-6 py-4 text-sm text-center">{irmao.total_sessoes}</td>
                <td className="px-6 py-4 text-sm text-center">{irmao.total_registros}</td>
                <td className="px-6 py-4 text-sm text-center text-green-600 font-semibold">{irmao.presentes}</td>
                <td className="px-6 py-4 text-sm text-center text-red-600 font-semibold">{irmao.ausentes}</td>
                <td className="px-6 py-4 text-sm text-center">
                  <span className={`px-3 py-1 rounded font-semibold ${
                    irmao.taxa >= 70 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {irmao.taxa}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Grade */}
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
