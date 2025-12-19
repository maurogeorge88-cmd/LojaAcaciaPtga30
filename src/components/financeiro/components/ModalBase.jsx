import React from 'react';

/**
 * Modal Base - Componente reutilizável para todos os modais
 * @param {boolean} aberto - Controla se o modal está visível
 * @param {function} onFechar - Callback para fechar o modal
 * @param {string} titulo - Título do modal
 * @param {string} corHeader - Classe CSS para cor de fundo do header (opcional)
 * @param {string} tamanho - Tamanho do modal: 'sm', 'md', 'lg', 'xl', '2xl', '4xl'
 * @param {ReactNode} children - Conteúdo do modal
 */
export default function ModalBase({ 
  aberto, 
  onFechar, 
  titulo, 
  corHeader = 'bg-white',
  tamanho = 'lg', 
  children 
}) {
  if (!aberto) return null;

  const tamanhos = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
  };

  // Determinar cor do texto baseado na cor do header
  const corTexto = corHeader === 'bg-white' ? 'text-gray-900' : 'text-white';
  const corBotaoFechar = corHeader === 'bg-white' ? 'text-gray-400 hover:text-gray-600' : 'text-white/80 hover:text-white';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-lg shadow-xl ${tamanhos[tamanho]} w-full max-h-[90vh] overflow-y-auto`}>
        {/* Header */}
        <div className={`sticky top-0 ${corHeader} border-b border-gray-200 px-6 py-4 flex justify-between items-center rounded-t-lg`}>
          <h3 className={`text-xl font-bold ${corTexto}`}>{titulo}</h3>
          <button
            onClick={onFechar}
            className={`${corBotaoFechar} transition-colors`}
            type="button"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
