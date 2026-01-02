import React, { useState } from 'react';
import { gerarRelatorioFinanceiroPDF, compartilharViaWhatsApp } from './gerarRelatorioFinanceiroPDF';

/**
 * 📤 BOTÃO PARA GERAR E COMPARTILHAR RELATÓRIO FINANCEIRO
 * Componente que permite gerar PDF e compartilhar via WhatsApp
 */

export default function BotaoGerarRelatorio({ 
  dadosGrafico, 
  lancamentosCompletos, 
  filtroAnalise, 
  parseData,
  supabase 
}) {
  const [gerando, setGerando] = useState(false);
  const [mostrarOpcoes, setMostrarOpcoes] = useState(false);

  const handleGerarPDF = async () => {
    setGerando(true);
    try {
      const resultado = await gerarRelatorioFinanceiroPDF({
        dadosGrafico,
        lancamentosCompletos,
        filtroAnalise,
        parseData,
        supabase
      });

      if (resultado.success) {
        alert(`✅ Relatório gerado com sucesso!\n\nArquivo: ${resultado.nomeArquivo}`);
      } else {
        alert(`❌ Erro ao gerar relatório:\n${resultado.error}`);
      }
    } catch (error) {
      alert(`❌ Erro ao gerar relatório:\n${error.message}`);
    } finally {
      setGerando(false);
      setMostrarOpcoes(false);
    }
  };

  const handleCompartilharWhatsApp = () => {
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                   'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    const periodoTexto = filtroAnalise.mes > 0 
      ? `${meses[filtroAnalise.mes - 1]}/${filtroAnalise.ano}`
      : `${filtroAnalise.ano}`;

    const totalReceitas = dadosGrafico.reduce((sum, item) => sum + item.receitas, 0);
    const totalDespesas = dadosGrafico.reduce((sum, item) => sum + item.despesas, 0);
    const totalLucro = totalReceitas - totalDespesas;

    const mensagem = `📊 *Relatório Financeiro - ${periodoTexto}*\n\n` +
      `💰 Receitas: R$ ${totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
      `💸 Despesas: R$ ${totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
      `📈 Lucro: R$ ${totalLucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n` +
      `_Relatório completo disponível em PDF_`;

    compartilharViaWhatsApp(mensagem);
    setMostrarOpcoes(false);
  };

  return (
    <div className="relative">
      {/* Botão Principal */}
      <button
        onClick={() => setMostrarOpcoes(!mostrarOpcoes)}
        className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
        disabled={gerando}
      >
        {gerando ? (
          <>
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Gerando...</span>
          </>
        ) : (
          <>
            <span>📤</span>
            <span>Enviar Relatório</span>
          </>
        )}
      </button>

      {/* Menu de Opções */}
      {mostrarOpcoes && !gerando && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-2xl border-2 border-gray-200 z-50">
          <div className="p-3 border-b border-gray-200">
            <p className="text-sm font-semibold text-gray-700">Escolha uma opção:</p>
          </div>
          
          <div className="p-2 space-y-1">
            {/* Opção: Baixar PDF */}
            <button
              onClick={handleGerarPDF}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-blue-50 transition-colors text-left"
            >
              <div className="bg-blue-100 p-2 rounded-lg">
                <span className="text-2xl">📄</span>
              </div>
              <div>
                <p className="font-semibold text-gray-800 text-sm">Baixar PDF</p>
                <p className="text-xs text-gray-600">Download do relatório completo</p>
              </div>
            </button>

            {/* Opção: WhatsApp */}
            <button
              onClick={handleCompartilharWhatsApp}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-green-50 transition-colors text-left"
            >
              <div className="bg-green-100 p-2 rounded-lg">
                <span className="text-2xl">📱</span>
              </div>
              <div>
                <p className="font-semibold text-gray-800 text-sm">WhatsApp</p>
                <p className="text-xs text-gray-600">Compartilhar resumo por mensagem</p>
              </div>
            </button>

            {/* Opção: Gerar e Compartilhar */}
            <button
              onClick={async () => {
                await handleGerarPDF();
                setTimeout(() => handleCompartilharWhatsApp(), 1000);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-purple-50 transition-colors text-left"
            >
              <div className="bg-purple-100 p-2 rounded-lg">
                <span className="text-2xl">🚀</span>
              </div>
              <div>
                <p className="font-semibold text-gray-800 text-sm">PDF + WhatsApp</p>
                <p className="text-xs text-gray-600">Baixar e compartilhar</p>
              </div>
            </button>
          </div>

          {/* Botão Cancelar */}
          <div className="p-2 border-t border-gray-200">
            <button
              onClick={() => setMostrarOpcoes(false)}
              className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Overlay para fechar ao clicar fora */}
      {mostrarOpcoes && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setMostrarOpcoes(false)}
        />
      )}
    </div>
  );
}
