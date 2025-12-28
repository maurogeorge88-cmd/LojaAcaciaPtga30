import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function ModalGradePresenca({ onFechar, periodoInicio, periodoFim }) {
  const [dados, setDados] = useState({ sessoes: [], irmaos: [], registros: [] });

  useEffect(() => {
    carregarTudo();
  }, []);

  const carregarTudo = async () => {
    // Buscar TUDO sem filtro
    const { data: s } = await supabase.from('sessoes_presenca').select('*').order('data_sessao');
    const { data: i } = await supabase.from('irmaos').select('*').eq('status', 'ativo').order('nome');
    const { data: r } = await supabase.from('registros_presenca').select('*');
    
    console.log('SESSÕES:', s?.length, s);
    console.log('IRMÃOS:', i?.length, i);
    console.log('REGISTROS:', r?.length, r);
    
    setDados({ sessoes: s || [], irmaos: i || [], registros: r || [] });
  };

  const obterReg = (irmaoId, sessaoId) => {
    return dados.registros.find(r => r.membro_id === irmaoId && r.sessao_id === sessaoId);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded w-full h-[90vh] max-w-[95vw] flex flex-col">
        <div className="bg-blue-600 text-white p-4 flex justify-between">
          <div>
            <h2 className="text-xl font-bold">TESTE MODAL</h2>
            <p>Sessões: {dados.sessoes.length} | Irmãos: {dados.irmaos.length} | Registros: {dados.registros.length}</p>
          </div>
          <button onClick={onFechar} className="hover:bg-blue-700 p-2">✕</button>
        </div>
        
        <div className="flex-1 overflow-auto p-4">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">Irmão</th>
                {dados.sessoes.slice(0, 20).map(s => (
                  <th key={s.id} className="border p-1">
                    {new Date(s.data_sessao).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dados.irmaos.slice(0, 10).map(i => (
                <tr key={i.id}>
                  <td className="border p-2">{i.nome.split(' ')[0]}</td>
                  {dados.sessoes.slice(0, 20).map(s => {
                    const reg = obterReg(i.id, s.id);
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
        
        <div className="bg-gray-50 p-4">
          <button onClick={onFechar} className="px-4 py-2 bg-gray-600 text-white rounded">Fechar</button>
        </div>
      </div>
    </div>
  );
}
