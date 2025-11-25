/**
 * COMPONENTE DE ALERTA
 * Sistema A∴R∴L∴S∴ Acácia de Paranatinga nº 30
 */

import React from 'react';

export const Alert = ({ type = 'info', message, onClose }) => {
  if (!message) return null;

  const colors = {
    success: {
      bg: 'bg-green-50',
      border: 'border-green-500',
      text: 'text-green-800',
      icon: '✅'
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-500',
      text: 'text-red-800',
      icon: '❌'
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-500',
      text: 'text-yellow-800',
      icon: '⚠️'
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-500',
      text: 'text-blue-800',
      icon: 'ℹ️'
    }
  };

  const style = colors[type] || colors.info;

  return (
    <div className={`${style.bg} ${style.border} border-l-4 p-4 mb-4 rounded-r-lg flex items-center justify-between`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{style.icon}</span>
        <p className={`${style.text} font-medium`}>{message}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className={`${style.text} hover:opacity-75 font-bold text-xl`}
        >
          ×
        </button>
      )}
    </div>
  );
};
