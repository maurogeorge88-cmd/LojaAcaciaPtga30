import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function ModalGradePresenca({ onFechar }) {
  const [loading, setLoading] = useState(true);
  const [sessoes, setSessoes] = useState([]);
  const [irmaos, setIrmaos] = useState([]);
  const [registros, setRegistros] = useState([]);

  useEffect(() => {
    carregar();
  }, []);

  const carregar = async () => {
    try {
      setLoading(true);

      // 1. Buscar TODAS as sessões
      const { data: sessoesData } = await supabase
        .from('sessoes_presenca')
        .select('id, data_sessao')
        .order('data_sessao');

      console.log('Sessões:', sessoesData?.length);

      // 2. Buscar TODOS os irmãos ativos
      const { data: irmaosData } = await supabase
        .from('irmaos')
        .select('id, nome')
        .eq('status', 'ativo')
        .order('nome');

      console.log('Irmãos:', irmaosData?.length);

      // 3. Buscar TODOS os registros de presença
      const { data: registrosData } = await supabase
        .from('registros_presenca')
        .select('membro_id, sessao_id, presente, justificativa');

      console.log('Registros:', registrosData?.length);

      setSessoes(sessoesData || []);
      setIrmaos(irmaosData || []);
      setRegistros(registrosData || []);

    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  const obterRegistro = (irmaoId, sessaoId) => {
    return registros.find(r => r.membro_id === irmaoId && r.sessao_id === sessaoId);
  };

  const formatarData = (data) => {
    return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit' 
    });
  };

  const renderizarCelula = (irmao, sessao) => {
    const reg = obterRegistro(irmao.id, sessao.id);

    if (!reg) {
      return (
        <td key={sessao.id} className="border border-gray-300 px-2 py-2 text-center bg-gray-100">
          <span className="text-gray-400">-</span>
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
        <div className="bg-white p-8 rounded-lg">
          <div className="text-center">Carregando grade...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full h-[90vh] max-w-[95vw] flex flex-col">
        
        {/* Cabeçalho */}
        <div className="bg-blue-600 text-white p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Grade de Presença</h2>
            <p className="text-sm text-blue-100 mt-1">
              {sessoes.length} sessões • {irmaos.length} irmãos • {registros.length} registros
            </p>
          </div>
          <button
            onClick={onFechar}
            className="hover:bg-blue-700 rounded-full p-2 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabela */}
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-xs">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="border border-gray-300 px-4 py-3 text-left font-semibold bg-gray-100 sticky left-0 z-10">
                  Irmão
                </th>
                {sessoes.map(s => (
                  <th key={s.id} className="border border-gray-300 px-2 py-2 text-center whitespace-nowrap">
                    {formatarData(s.data_sessao)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {irmaos.map(irmao => (
                <tr key={irmao.id} className="hover:bg-gray-50">
                  <td className="border border-gray-300 px-4 py-3 font-medium bg-white sticky left-0 z-10">
                    {irmao.nome.split(' ').slice(0, 2).join(' ')}
                  </td>
                  {sessoes.map(sessao => renderizarCelula(irmao, sessao))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Rodapé */}
        <div className="bg-gray-50 px-6 py-4 border-t">
          <button
            onClick={onFechar}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
