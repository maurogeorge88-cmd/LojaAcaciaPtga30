import React, { useState } from 'react';

export default function ModalResumoIrmaos({ 
  isOpen, 
  onClose, 
  resumoIrmaos 
}) {
  const [filtroStatus, setFiltroStatus] = useState('todos'); // 'todos', 'devendo', 'em-dia'

  if (!isOpen) return null;

  // Filtrar apenas irmãos com pendências (saldo negativo = devendo)
  const irmaosComPendencias = resumoIrmaos.filter(irmao => irmao.saldo < 0);
  const irmaosEmDia = resumoIrmaos.filter(irmao => irmao.saldo >= 0);

  // Aplicar filtro selecionado
  let irmaosExibir = [];
  if (filtroStatus === 'todos') {
    irmaosExibir = resumoIrmaos;
  } else if (filtroStatus === 'devendo') {
    irmaosExibir = irmaosComPendencias;
  } else if (filtroStatus === 'em-dia') {
    irmaosExibir = irmaosEmDia;
  }

  // Calcular totais dos irmãos exibidos
  const totalDespesasExibindo = irmaosExibir.reduce((sum, i) => sum + i.totalDespesas, 0);
  const totalReceitasExibindo = irmaosExibir.reduce((sum, i) => sum + i.totalReceitas, 0);
  const saldoTotalExibindo = irmaosExibir.reduce((sum, i) => sum + i.saldo, 0);

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
          
          {/* FILTROS */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setFiltroStatus('todos')}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                filtroStatus === 'todos'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              📊 Todos ({resumoIrmaos.length})
            </button>
            <button
              onClick={() => setFiltroStatus('devendo')}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                filtroStatus === 'devendo'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              ⚠️ Devendo ({irmaosComPendencias.length})
            </button>
            <button
              onClick={() => setFiltroStatus('em-dia')}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                filtroStatus === 'em-dia'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              ✅ Em Dia ({irmaosEmDia.length})
            </button>
          </div>

          {/* ESTATÍSTICAS DO FILTRO ATUAL */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="text-sm text-blue-600 font-semibold mb-1">Irmãos Exibindo</div>
              <div className="text-2xl font-bold text-blue-700">{irmaosExibir.length}</div>
            </div>
            
            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
              <div className="text-sm text-red-600 font-semibold mb-1">Total Despesas</div>
              <div className="text-xl font-bold text-red-700">
                R$ {totalDespesasExibindo.toFixed(2)}
              </div>
            </div>
            
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="text-sm text-green-600 font-semibold mb-1">Total Receitas</div>
              <div className="text-xl font-bold text-green-700">
                R$ {totalReceitasExibindo.toFixed(2)}
              </div>
            </div>
            
            <div className={`rounded-lg p-4 border ${
              saldoTotalExibindo >= 0 
                ? 'bg-emerald-50 border-emerald-200' 
                : 'bg-orange-50 border-orange-200'
            }`}>
              <div className={`text-sm font-semibold mb-1 ${
                saldoTotalExibindo >= 0 
                  ? 'text-emerald-600' 
                  : 'text-orange-600'
              }`}>
                Saldo Total
              </div>
              <div className={`text-xl font-bold ${
                saldoTotalExibindo >= 0 
                  ? 'text-emerald-700' 
                  : 'text-orange-700'
              }`}>
                R$ {saldoTotalExibindo.toFixed(2)}
              </div>
            </div>
          </div>

          {/* TABELA DE IRMÃOS */}
          {irmaosExibir.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-xl mb-2">📭</p>
              <p>Nenhum irmão encontrado com este filtro</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">
                      Irmão
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-right font-semibold text-gray-700">
                      Despesas
                      <div className="text-xs font-normal text-gray-500">(Loja → Irmão)</div>
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-right font-semibold text-gray-700">
                      Receitas
                      <div className="text-xs font-normal text-gray-500">(Irmão → Loja)</div>
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-right font-semibold text-gray-700">
                      Saldo Final
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {irmaosExibir
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
                          <span className={`font-bold text-lg ${
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
                      TOTAL ({irmaosExibir.length} irmãos)
                    </td>
                    <td className="border border-gray-400 px-4 py-3 text-right text-red-700">
                      R$ {totalDespesasExibindo.toFixed(2)}
                    </td>
                    <td className="border border-gray-400 px-4 py-3 text-right text-green-700">
                      R$ {totalReceitasExibindo.toFixed(2)}
                    </td>
                    <td className={`border border-gray-400 px-4 py-3 text-right text-lg ${
                      saldoTotalExibindo >= 0 
                        ? 'text-emerald-700' 
                        : 'text-orange-700'
                    }`}>
                      R$ {saldoTotalExibindo.toFixed(2)}
                    </td>
                    <td className="border border-gray-400 px-4 py-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* LEGENDA */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2">ℹ️ Informações:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Despesas (Loja → Irmão):</strong> Pagamentos que o irmão realizou para a Loja</li>
              <li>• <strong>Receitas (Irmão → Loja):</strong> Valores que a Loja cobra do irmão (mensalidades, multas, etc)</li>
              <li>• <strong>Saldo Final:</strong> Receitas - Despesas</li>
              <li>• <strong>Positivo (verde):</strong> Irmão está em dia ou com crédito</li>
              <li>• <strong>Negativo (laranja):</strong> Irmão deve para a Loja</li>
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
