/**
 * HOOK DE MENSAGENS/ALERTAS
 * Sistema A∴R∴L∴S∴ Acácia de Paranatinga nº 30
 */

import { useState, useCallback } from 'react';
import { DURACAO_MENSAGEM, DURACAO_MENSAGEM_ERRO } from '../utils/constants';

export const useAlert = () => {
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const showSuccess = useCallback((message, duration = DURACAO_MENSAGEM) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(''), duration);
  }, []);

  const showError = useCallback((message, duration = DURACAO_MENSAGEM_ERRO) => {
    setErrorMessage(message);
    setTimeout(() => setErrorMessage(''), duration);
  }, []);

  const clearMessages = useCallback(() => {
    setSuccessMessage('');
    setErrorMessage('');
  }, []);

  return {
    successMessage,
    errorMessage,
    showSuccess,
    showError,
    clearMessages,
  };
};
