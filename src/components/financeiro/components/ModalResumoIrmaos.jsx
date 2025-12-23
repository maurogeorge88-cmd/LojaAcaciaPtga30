import React from 'react';

export default function ModalResumoIrmaos({ 
  isOpen, 
  onClose, 
  resumoIrmaos 
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* HEADER */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-400 text-white p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold">💰 Resumo Financeiro dos Irmãos</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 text-3xl font-bold leading-none"
          >
            ×
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* ESTATÍSTICAS GERAIS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="text-sm text-blue-600 font-semibold mb-1">Total de Irmãos</div>
              <div className="text-2xl font-bold text-blue-700">{resumoIrmaos.length}</div>
            </div>
            
            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
              <div className="text-sm text-red-600 font-semibold mb-1">Total Despesas</div>
              <div className="text-2xl font-bold text-red-700">
                R$ {resumoIrmaos.reduce((sum, i) => sum + i.totalDespesas, 0).toFixed(2)}
              </div>
            </div>
            
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="text-sm text-green-600 font-semibold mb-1">Total Receitas</div>
              <div className="text-2xl font-bold text-green-700">
                R$ {resumoIrmaos.reduce((sum, i) => sum + i.totalReceitas, 0).toFixed(2)}
              </div>
            </div>
            
            <div className={`rounded-lg p-4 border ${
              resumoIrmaos.reduce((sum, i) => sum + i.saldo, 0) >= 0 
                ? 'bg-emerald-50 border-emerald-200' 
                : 'bg-orange-50 border-orange-200'
            }`}>
              <div className={`text-sm font-semibold mb-1 ${
                resumoIrmaos.reduce((sum, i) => sum + i.saldo, 0) >= 0 
                  ? 'text-emerald-600' 
                  : 'text-orange-600'
              }`}>
                Saldo Total
              </div>
              <div className={`text-2xl font-bold ${
                resumoIrmaos.reduce((sum, i) => sum + i.saldo, 0) >= 0 
                  ? 'text-emerald-700' 
                  : 'text-orange-700'
              }`}>
                R$ {resumoIrmaos.reduce((sum, i) => sum + i.saldo, 0).toFixed(2)}
              </div>
            </div>
          </div>

          {/* TABELA DE IRMÃOS */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">
                    Irmão
                  </th>
                  <th className="border border-gray-300 px-4 py-3 text-right font-semibold text-gray-700">
                    Despesas
                  </th>
                  <th className="border border-gray-300 px-4 py-3 text-right font-semibold text-gray-700">
                    Receitas
                  </th>
                  <th className="border border-gray-300 px-4 py-3 text-right font-semibold text-gray-700">
                    Saldo
                  </th>
                  <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {resumoIrmaos
                  .sort((a, b) => a.nomeIrmao.localeCompare(b.nomeIrmao))
                  .map((irmao, index) => (
                    <tr 
                      key={index}
                      className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition`}
                    >
                      <td className="border border-gray-300 px-4 py-3">
                        <div className="font-medium text-gray-900">{irmao.nomeIrmao}</div>
                        <div className="text-xs text-gray-500">CIM: {irmao.cim || 'N/A'}</div>
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-right">
                        <span className="text-red-600 font-semibold">
                          R$ {irmao.totalDespesas.toFixed(2)}
                        </span>
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-right">
                        <span className="text-green-600 font-semibold">
                          R$ {irmao.totalReceitas.toFixed(2)}
                        </span>
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-right">
                        <span className={`font-bold ${
                          irmao.saldo >= 0 ? 'text-emerald-600' : 'text-orange-600'
                        }`}>
                          R$ {irmao.saldo.toFixed(2)}
                        </span>
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          irmao.saldo >= 0 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-orange-100 text-orange-700'
                        }`}>
                          {irmao.saldo >= 0 ? 'Em Dia' : 'Devedor'}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
              
              {/* TOTALIZADOR */}
              <tfoot>
                <tr className="bg-gray-200 font-bold">
                  <td className="border border-gray-400 px-4 py-3">
                    TOTAL GERAL
                  </td>
                  <td className="border border-gray-400 px-4 py-3 text-right text-red-700">
                    R$ {resumoIrmaos.reduce((sum, i) => sum + i.totalDespesas, 0).toFixed(2)}
                  </td>
                  <td className="border border-gray-400 px-4 py-3 text-right text-green-700">
                    R$ {resumoIrmaos.reduce((sum, i) => sum + i.totalReceitas, 0).toFixed(2)}
                  </td>
                  <td className={`border border-gray-400 px-4 py-3 text-right ${
                    resumoIrmaos.reduce((sum, i) => sum + i.saldo, 0) >= 0 
                      ? 'text-emerald-700' 
                      : 'text-orange-700'
                  }`}>
                    R$ {resumoIrmaos.reduce((sum, i) => sum + i.saldo, 0).toFixed(2)}
                  </td>
                  <td className="border border-gray-400 px-4 py-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* LEGENDA */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2">ℹ️ Informações:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Despesas:</strong> Soma de todos os lançamentos de despesa do irmão (mensalidades, multas, etc)</li>
              <li>• <strong>Receitas:</strong> Soma de todos os pagamentos realizados pelo irmão</li>
              <li>• <strong>Saldo:</strong> Receitas - Despesas (positivo = crédito, negativo = débito)</li>
              <li>• <strong>Status:</strong> Em Dia (saldo ≥ 0) | Devedor (saldo &lt; 0)</li>
            </ul>
          </div>
        </div>

        {/* FOOTER */}
        <div className="bg-gray-100 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
