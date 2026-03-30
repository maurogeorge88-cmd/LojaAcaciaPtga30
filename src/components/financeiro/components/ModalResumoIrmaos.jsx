import React, { useState } from 'react';
import RelatorioIrmaosPendencias from './RelatorioIrmaosPendencias';

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
      <div className="rounded-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        
        {/* HEADER */}
        <div 
          className="text-white p-6 flex justify-between items-center"
          style={{ background:'var(--color-accent)' }}
        >
          <h2 className="text-2xl font-bold" style={{color:"var(--color-text)"}}>💰 Resumo Financeiro dos Irmãos</h2>
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
          <div className="flex gap-3 mb-6 flex-wrap items-center">
            <button
              onClick={() => setFiltroStatus('todos')}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                filtroStatus === 'todos'
                  ? 'bg-primary-600 text-white'
                  : '  '
              }`}
            >
              📊 Todos ({resumoIrmaos.length})
            </button>
            <button
              onClick={() => setFiltroStatus('devendo')}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                filtroStatus === 'devendo'
                  ? 'bg-orange-600 text-white'
                  : '  '
              }`}
            >
              ⚠️ Devendo ({irmaosComPendencias.length})
            </button>
            <button
              onClick={() => setFiltroStatus('em-dia')}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                filtroStatus === 'em-dia'
                  ? 'bg-emerald-600 text-white'
                  : '  '
              }`}
            >
              ✅ Em Dia ({irmaosEmDia.length})
            </button>
            
            {/* Botão de Relatório */}
            <div className="ml-auto">
              <RelatorioIrmaosPendencias resumoIrmaos={resumoIrmaos} />
            </div>
          </div>

          {/* ESTATÍSTICAS DO FILTRO ATUAL */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4 border" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
              <div className="text-sm text-primary-600 font-semibold mb-1">Irmãos Exibindo</div>
              <div className="text-2xl font-bold text-blue-700">{irmaosExibir.length}</div>
            </div>
            
            <div className="bg-red-50 rounded-lg p-4 border" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
              <div className="text-sm text-red-600 font-semibold mb-1">Total Despesas</div>
              <div className="text-xl font-bold text-red-700">
                R$ {totalDespesasExibindo.toFixed(2)}
              </div>
            </div>
            
            <div className="bg-green-50 rounded-lg p-4 border" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
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
            <div className="text-center py-12">
              <p className="text-xl mb-2">📭</p>
              <p>Nenhum irmão encontrado com este filtro</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead style={{background:"var(--color-surface-2)"}}>
                  <tr>
                    <th className="border px-4 py-3 text-left font-semibold" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>
                      Irmão
                    </th>
                    <th className="border px-4 py-3 text-right font-semibold" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>
                      Despesas
                      <div className="text-xs font-normal">(Loja → Irmão)</div>
                    </th>
                    <th className="border px-4 py-3 text-right font-semibold" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>
                      Receitas
                      <div className="text-xs font-normal">(Irmão → Loja)</div>
                    </th>
                    <th className="border px-4 py-3 text-right font-semibold" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>
                      Saldo Final
                    </th>
                    <th className="border px-4 py-3 text-center font-semibold" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>
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
                        className={`${index % 2 === 0 ? '' : ''} hover:bg-blue-50 transition`}
                      >
                        <td className="border px-4 py-3" style={{color:"var(--color-text)"}}>
                          <div className="font-medium">{irmao.nomeIrmao}</div>
                          <div className="text-xs">CIM: {irmao.cim || 'N/A'}</div>
                        </td>
                        <td className="border px-4 py-3 text-right" style={{color:"var(--color-text)"}}>
                          <span className="text-red-600 font-semibold">
                            R$ {irmao.totalDespesas.toFixed(2)}
                          </span>
                        </td>
                        <td className="border px-4 py-3 text-right" style={{color:"var(--color-text)"}}>
                          <span className="text-green-600 font-semibold">
                            R$ {irmao.totalReceitas.toFixed(2)}
                          </span>
                        </td>
                        <td className="border px-4 py-3 text-right" style={{color:"var(--color-text)"}}>
                          <span className={`font-bold text-lg ${
                            irmao.saldo >= 0 ? 'text-emerald-600' : 'text-orange-600'
                          }`}>
                            R$ {irmao.saldo.toFixed(2)}
                          </span>
                        </td>
                        <td className="border px-4 py-3 text-center" style={{color:"var(--color-text)"}}>
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
                  <tr className="font-bold">
                    <td className="border px-4 py-3" style={{color:"var(--color-text)"}}>
                      TOTAL ({irmaosExibir.length} irmãos)
                    </td>
                    <td className="border px-4 py-3 text-right text-red-700" style={{color:"var(--color-text)"}}>
                      R$ {totalDespesasExibindo.toFixed(2)}
                    </td>
                    <td className="border px-4 py-3 text-right text-green-700" style={{color:"var(--color-text)"}}>
                      R$ {totalReceitasExibindo.toFixed(2)}
                    </td>
                    <td className={`border  px-4 py-3 text-right text-lg ${
                      saldoTotalExibindo >= 0 
                        ? 'text-emerald-700' 
                        : 'text-orange-700'
                    }`}>
                      R$ {saldoTotalExibindo.toFixed(2)}
                    </td>
                    <td className="border px-4 py-3" style={{color:"var(--color-text)"}}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* LEGENDA */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <h3 className="font-semibold text-blue-900 mb-2" style={{color:"var(--color-text)"}}>ℹ️ Informações:</h3>
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
        <div className="px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg font-semibold" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
