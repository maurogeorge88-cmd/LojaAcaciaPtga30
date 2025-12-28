import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function ModalGradePresenca({ onFechar, periodoInicio, periodoFim }) {
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState({ sessoes: [], irmaos: [], registros: [] });

  useEffect(() => {
    carregar();
  }, [periodoInicio, periodoFim]);

  const carregar = async () => {
    try {
      setLoading(true);

      const { data: s } = await supabase
        .from('sessoes_presenca')
        .select('id, data_sessao')
        .gte('data_sessao', periodoInicio)
        .lte('data_sessao', periodoFim)
        .order('data_sessao');

      const { data: i } = await supabase
        .from('irmaos')
        .select('id, nome')
        .eq('status', 'ativo')
        .in('situacao', ['regular', 'licenciado'])
        .order('nome');

      const ids = s.map(x => x.id);
      const { data: r } = await supabase
        .from('registros_presenca')
        .select('sessao_id, membro_id, presente')
        .in('sessao_id', ids);

      console.log('CARREGADO:', s?.length, 'sessões,', i?.length, 'irmãos,', r?.length, 'registros');
      setDados({ sessoes: s || [], irmaos: i || [], registros: r || [] });

    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  const getReg = (irmaoId, sessaoId) => {
    return dados.registros.find(r => r.membro_id === irmaoId && r.sessao_id === sessaoId);
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
      <div className="bg-white rounded w-full h-[90vh] max-w-[95vw] flex flex-col">
        
        {/* Cabeçalho */}
        <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Grade de Presença</h2>
            <p className="text-sm">{dados.sessoes.length} sessões | {dados.irmaos.length} irmãos | {dados.registros.length} registros</p>
          </div>
          <button onClick={onFechar} className="hover:bg-blue-700 p-2 rounded">✕</button>
        </div>

        {/* Tabela */}
        <div className="flex-1 overflow-auto">
          <table className="border-collapse text-xs">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="border p-2 sticky left-0 bg-gray-100 z-10">Irmão</th>
                {dados.sessoes.map(s => (
                  <th key={s.id} className="border p-1">
                    {new Date(s.data_sessao + 'T00:00:00').toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dados.irmaos.map(i => (
                <tr key={i.id} className="hover:bg-gray-50">
                  <td className="border p-2 sticky left-0 bg-white">{i.nome.split(' ').slice(0,2).join(' ')}</td>
                  {dados.sessoes.map(s => {
                    const reg = getReg(i.id, s.id);
                    return (
                      <td key={s.id} className="border p-1 text-center">
                        {!reg ? '-' : reg.presente ? '✓' : '✗'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Rodapé */}
        <div className="bg-gray-50 p-4">
          <button onClick={onFechar} className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
