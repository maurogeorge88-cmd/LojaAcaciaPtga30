// ========================================
// 🔧 HELPER: Confirm seguro para SSR
// ========================================
// Solução para builds SSR que bloqueiam window.confirm

/**
 * Função helper para confirm que funciona em SSR
 * @param {string} message - Mensagem do confirm
 * @returns {boolean} - true se confirmou, false se cancelou
 */
export const safeConfirm = (message) => {
  // Durante build SSR, retorna true (não bloqueia)
  if (typeof window === 'undefined') {
    return true;
  }
  
  // No navegador, usa confirm normal
  return window.confirm(message);
};

/**
 * Função helper para alert que funciona em SSR
 * @param {string} message - Mensagem do alert
 */
export const safeAlert = (message) => {
  if (typeof window === 'undefined') {
    console.log(message);
    return;
  }
  
  window.alert(message);
};
