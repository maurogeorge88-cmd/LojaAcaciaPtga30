import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function ModalGradePresenca({ onFechar, periodoInicio, periodoFim }) {
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState({
    sessoes: [],
    irmaos: [],
    registros: []
  });

  useEffect(() => {
    carregarDados();
  }, [periodoInicio, periodoFim]);

  const carregarDados = async () => {
    try {
      setLoading(true);

      console.log('🔍 Carregando dados do período:', periodoInicio, 'até', periodoFim);

      // 1. Buscar TODAS as sessões do período
      const { data: sessoesData, error: erroSessoes } = await supabase
        .from('sessoes_presenca')
        .select('id, data_sessao, grau_sessao_id, graus_sessao:grau_sessao_id(nome)')
        .gte('data_sessao', periodoInicio)
        .lte('data_sessao', periodoFim)
        .order('data_sessao', { ascending: true });

      if (erroSessoes) throw erroSessoes;
      console.log('✅ Sessões carregadas:', sessoesData?.length);

      // 2. Buscar TODOS os irmãos ativos (regular + licenciado)
      const { data: irmaosData, error: erroIrmaos } = await supabase
        .from('irmaos')
        .select('id, nome, situacao')
        .eq('status', 'ativo')
        .in('situacao', ['regular', 'licenciado'])
        .order('nome');

      if (erroIrmaos) throw erroIrmaos;
      console.log('✅ Irmãos carregados:', irmaosData?.length);

      // 3. Buscar TODOS os registros de presença dessas sessões
      const sessaoIds = sessoesData.map(s => s.id);
      const { data: registrosData, error: erroRegistros } = await supabase
        .from('registros_presenca')
        .select('sessao_id, membro_id, presente, justificativa')
        .in('sessao_id', sessaoIds);

      if (erroRegistros) throw erroRegistros;
      console.log('✅ Registros carregados:', registrosData?.length);

      // Debug específico para Mauro
      const mauro = irmaosData.find(i => i.nome.includes('Mauro George'));
      if (mauro) {
        const registrosMauro = registrosData.filter(r => r.membro_id === mauro.id);
        console.log('🔍 Mauro George - ID:', mauro.id);
        console.log('🔍 Mauro George - Total de registros:', registrosMauro.length);
        console.log('🔍 Mauro George - Registros:', registrosMauro);
      }

      setDados({
        sessoes: sessoesData || [],
        irmaos: irmaosData || [],
        registros: registrosData || []
      });

    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatarData = (data) => {
    if (!data) return '-';
    const date = new Date(data + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const obterRegistro = (irmaoId, sessaoId) => {
    return dados.registros.find(r => r.membro_id === irmaoId && r.sessao_id === sessaoId);
  };

  const renderizarCelula = (irmao, sessao) => {
    const reg = obterRegistro(irmao.id, sessao.id);

    if (!reg) {
      return (
        <td key={sessao.id} className="border border-gray-300 px-2 py-2 text-center bg-gray-100">
          <span className="text-gray-400 text-sm">-</span>
        </td>
      );
    }

    if (reg.presente) {
      return (
        <td key={sessao.id} className="border border-gray-300 px-2 py-2 text-center bg-green-50">
          <span className="text-green-600 text-lg font-bold">✓</span>
        </td>
      );
    }

    if (reg.justificativa) {
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

    return (
      <td key={sessao.id} className="border border-gray-300 px-2 py-2 text-center bg-red-50">
        <span className="text-red-600 text-lg font-bold">✗</span>
      </td>
    );
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="text-center">Carregando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full h-[90vh] max-w-[95vw] overflow-hidden flex flex-col">
        
        {/* Cabeçalho */}
        <div className="bg-blue-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Grade de Presença COMPLETA</h2>
              <p className="text-blue-100 mt-1">
                {dados.sessoes.length} sessões • {dados.irmaos.length} irmãos • {dados.registros.length} registros
              </p>
            </div>
            <button
              onClick={onFechar}
              className="text-white hover:bg-blue-700 rounded-full p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabela */}
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 sticky top-0 z-10">
                <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-sm bg-gray-100 sticky left-0 z-20">
                  Irmão
                </th>
                {dados.sessoes.map((sessao) => (
                  <th key={sessao.id} className="border border-gray-300 px-2 py-2 text-center text-xs whitespace-nowrap">
                    <div className="font-semibold">{formatarData(sessao.data_sessao)}</div>
                    <div className="text-gray-600 font-normal text-xs">
                      {(sessao.graus_sessao?.nome || '').replace('Sessão de ', '').replace('Sessão ', '')}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dados.irmaos.map((irmao) => (
                <tr key={irmao.id} className="hover:bg-gray-50">
                  <td className="border border-gray-300 px-4 py-3 font-medium text-sm whitespace-nowrap bg-white sticky left-0 z-10">
                    <div>{irmao.nome.split(' ').slice(0, 2).join(' ')}</div>
                    {irmao.situacao === 'licenciado' && (
                      <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded bg-orange-100 text-orange-800 mt-1">
                        Licenciado
                      </span>
                    )}
                  </td>
                  {dados.sessoes.map((sessao) => renderizarCelula(irmao, sessao))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Rodapé */}
        <div className="bg-gray-50 px-6 py-4 border-t">
          <button
            onClick={onFechar}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
