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

      console.log('📅 Período:', periodoInicio, 'até', periodoFim);

      // 1. Buscar sessões
      const { data: sessoesData, error: e1 } = await supabase
        .from('sessoes_presenca')
        .select('id, data_sessao, graus_sessao:grau_sessao_id(nome)')
        .gte('data_sessao', periodoInicio)
        .lte('data_sessao', periodoFim)
        .order('data_sessao');

      if (e1) throw e1;
      console.log('✅ Sessões:', sessoesData?.length);

      // 2. Buscar irmãos ativos
      const { data: irmaosData, error: e2 } = await supabase
        .from('irmaos')
        .select('id, nome, situacao')
        .eq('status', 'ativo')
        .in('situacao', ['regular', 'licenciado'])
        .order('nome');

      if (e2) throw e2;
      console.log('✅ Irmãos:', irmaosData?.length);

      // 3. Buscar registros
      const sessaoIds = sessoesData.map(s => s.id);
      console.log('🔍 Buscando registros para sessões:', sessaoIds);
      
      const { data: registrosData, error: e3 } = await supabase
        .from('registros_presenca')
        .select('sessao_id, membro_id, presente, justificativa')
        .in('sessao_id', sessaoIds);

      if (e3) throw e3;
      console.log('✅ Registros totais:', registrosData?.length);

      // Debug Mauro
      const mauro = irmaosData?.find(i => i.nome.includes('Mauro George'));
      if (mauro) {
        const regsMauro = registrosData?.filter(r => r.membro_id === mauro.id);
        console.log('🎯 Mauro ID:', mauro.id);
        console.log('🎯 Registros Mauro:', regsMauro?.length);
        console.log('🎯 Detalhes:', regsMauro);
      }

      setSessoes(sessoesData || []);
      setIrmaos(irmaosData || []);
      setRegistros(registrosData || []);

    } catch (error) {
      console.error('❌ Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  const obterRegistro = (irmaoId, sessaoId) => {
    return registros.find(r => r.membro_id === irmaoId && r.sessao_id === sessaoId);
  };

  const formatarData = (data) => {
    return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full h-[90vh] max-w-[95vw] flex flex-col">
        
        {/* Cabeçalho */}
        <div className="bg-blue-600 text-white p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Grade de Presença</h2>
            <p className="text-sm">{sessoes.length} sessões • {irmaos.length} irmãos • {registros.length} registros</p>
          </div>
          <button onClick={onFechar} className="hover:bg-blue-700 rounded p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabela */}
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 sticky top-0">
                <th className="border px-4 py-3 text-left sticky left-0 bg-gray-100 z-10">Irmão</th>
                {sessoes.map(s => (
                  <th key={s.id} className="border px-2 py-2 text-xs text-center">
                    <div>{formatarData(s.data_sessao)}</div>
                    <div className="text-gray-600 font-normal">
                      {(s.graus_sessao?.nome || '').replace('Sessão de ', '')}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {irmaos.map(irmao => (
                <tr key={irmao.id} className="hover:bg-gray-50">
                  <td className="border px-4 py-3 sticky left-0 bg-white">
                    {irmao.nome.split(' ').slice(0, 2).join(' ')}
                  </td>
                  {sessoes.map(sessao => {
                    const reg = obterRegistro(irmao.id, sessao.id);
                    
                    if (!reg) {
                      return <td key={sessao.id} className="border px-2 py-2 text-center bg-gray-100 text-gray-400">-</td>;
                    }
                    
                    if (reg.presente) {
                      return <td key={sessao.id} className="border px-2 py-2 text-center bg-green-50 text-green-600 font-bold text-lg">✓</td>;
                    }
                    
                    if (reg.justificativa) {
                      return <td key={sessao.id} className="border px-2 py-2 text-center bg-yellow-50 text-yellow-600 font-bold text-lg" title={reg.justificativa}>J</td>;
                    }
                    
                    return <td key={sessao.id} className="border px-2 py-2 text-center bg-red-50 text-red-600 font-bold text-lg">✗</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Rodapé */}
        <div className="bg-gray-50 p-4 border-t">
          <button onClick={onFechar} className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
