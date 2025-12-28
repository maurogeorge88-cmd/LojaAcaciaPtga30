import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function ModalGradePresenca({ onFechar, periodoInicio, periodoFim }) {
  const [loading, setLoading] = useState(true);
  const [sessoes, setSessoes] = useState([]);
  const [irmaos, setIrmaos] = useState([]);
  const [registros, setRegistros] = useState([]);

  useEffect(() => {
    carregarDados();
  }, [periodoInicio, periodoFim]);

  const carregarDados = async () => {
    try {
      setLoading(true);

      // 1. Buscar sessões
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

      // 2. Buscar irmãos regulares e licenciados
      const { data: irmaosData, error: erroIrmaos } = await supabase
        .from('irmaos')
        .select('id, nome, situacao')
        .in('situacao', ['regular', 'licenciado'])
        .order('nome');

      if (erroIrmaos) throw erroIrmaos;

      // 3. Buscar TODOS os registros de presença
      const sessaoIds = sessoesData.map(s => s.id);
      const { data: registrosData, error: erroRegistros } = await supabase
        .from('registros_presenca')
        .select('sessao_id, membro_id, presente, justificativa')
        .in('sessao_id', sessaoIds);

      if (erroRegistros) throw erroRegistros;

      setSessoes(sessoesData || []);
      setIrmaos(irmaosData || []);
      setRegistros(registrosData || []);

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

  const obterRegistro = (irmaoId, sessaoId) => {
    return registros.find(r => r.membro_id === irmaoId && r.sessao_id === sessaoId);
  };

  const renderizarCelula = (irmao, sessao) => {
    const reg = obterRegistro(irmao.id, sessao.id);

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
  };

  const calcularTaxa = (irmaoId) => {
    const registrosIrmao = registros.filter(r => r.membro_id === irmaoId);
    if (registrosIrmao.length === 0) return 0;
    
    const presentes = registrosIrmao.filter(r => r.presente).length;
    return Math.round((presentes / registrosIrmao.length) * 100);
  };

  const obterCorTaxa = (taxa) => {
    if (taxa === 100) return 'bg-green-500 text-white';
    if (taxa >= 90) return 'bg-green-400 text-white';
    if (taxa >= 70) return 'bg-yellow-400 text-gray-900';
    if (taxa >= 50) return 'bg-orange-400 text-white';
    return 'bg-red-500 text-white';
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
              <h2 className="text-2xl font-bold">Grade de Presença</h2>
              <p className="text-blue-100 mt-1">
                Período: {new Date(periodoInicio).toLocaleDateString('pt-BR')} a {new Date(periodoFim).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <button
              onClick={onFechar}
              className="text-white hover:bg-blue-700 rounded-full p-2 transition-colors"
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
                {sessoes.map((sessao) => (
                  <th key={sessao.id} className="border border-gray-300 px-2 py-2 text-center text-xs whitespace-nowrap">
                    <div className="font-semibold text-xs">{formatarData(sessao.data_sessao)}</div>
                    <div className="text-gray-600 font-normal text-xs">
                      {(sessao.graus_sessao?.nome || 'Sessão').replace('Sessão de ', '').replace('Sessão ', '')}
                    </div>
                  </th>
                ))}
                <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-sm bg-gray-100 sticky right-0 z-20">
                  Taxa
                </th>
              </tr>
            </thead>
            <tbody>
              {irmaos.map((irmao) => {
                const taxa = calcularTaxa(irmao.id);
                
                return (
                  <tr key={irmao.id} className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-4 py-3 font-medium text-sm whitespace-nowrap bg-white sticky left-0 z-10">
                      <div>{irmao.nome.split(' ').slice(0, 2).join(' ')}</div>
                      {irmao.situacao === 'licenciado' && (
                        <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded bg-orange-100 text-orange-800 mt-1">
                          Licenciado
                        </span>
                      )}
                    </td>
                    
                    {sessoes.map((sessao) => renderizarCelula(irmao, sessao))}
                    
                    <td className="border border-gray-300 px-2 py-2 text-center bg-white sticky right-0 z-10">
                      <span className={`px-3 py-1 rounded font-semibold text-sm ${obterCorTaxa(taxa)}`}>
                        {taxa}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Rodapé */}
        <div className="bg-gray-50 px-6 py-4 border-t">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Exibindo <strong>{irmaos.length}</strong> irmão(s) • <strong>{sessoes.length}</strong> sessão(ões)
            </div>
            <button
              onClick={onFechar}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
