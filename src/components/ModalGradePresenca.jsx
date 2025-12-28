import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function ModalGradePresenca({ onFechar, periodoInicio, periodoFim }) {
  const [sessoes, setSessoes] = useState([]);

  useEffect(() => {
    buscar();
  }, [periodoInicio, periodoFim]);

  const buscar = async () => {
    console.log('🔍 PARAMETROS:', { periodoInicio, periodoFim });
    
    const { data } = await supabase
      .from('sessoes_presenca')
      .select('*')
      .gte('data_sessao', periodoInicio)
      .lte('data_sessao', periodoFim)
      .order('data_sessao');
    
    console.log('✅ SESSOES RETORNADAS:', data?.length, data);
    setSessoes(data || []);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded p-8 max-w-2xl max-h-[80vh] overflow-auto">
        <div className="flex justify-between mb-4">
          <h2 className="text-xl font-bold">TESTE - Lista de Sessões</h2>
          <button onClick={onFechar} className="text-xl">✕</button>
        </div>
        
        <div className="mb-4">
          <p><strong>Período:</strong> {periodoInicio} até {periodoFim}</p>
          <p><strong>Total encontrado:</strong> {sessoes.length}</p>
        </div>
        
        <div className="border rounded p-4 bg-gray-50">
          <h3 className="font-bold mb-2">Lista de sessões:</h3>
          <ol className="list-decimal list-inside">
            {sessoes.map((s, i) => (
              <li key={s.id}>
                {s.data_sessao} - ID: {s.id}
              </li>
            ))}
          </ol>
        </div>
        
        <button 
          onClick={onFechar}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
