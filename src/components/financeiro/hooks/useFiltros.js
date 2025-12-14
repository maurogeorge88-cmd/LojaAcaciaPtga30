// ========================================
// 🎣 HOOK: useFiltros
// ========================================
// Gerencia os filtros de lançamentos financeiros
// Extraído de FinancasLoja.jsx para melhor organização

import { useState } from 'react';

/**
 * Hook para gerenciar filtros de lançamentos
 * @returns {Object} { filtros, atualizarFiltro, resetarFiltros, aplicarFiltroMesAtual }
 */
export const useFiltros = () => {
  const [filtros, setFiltros] = useState({
    mes: new Date().getMonth() + 1, // Mês atual (1-12)
    ano: new Date().getFullYear(), // Ano atual
    tipo: '', // 'receita' ou 'despesa'
    categoria: '',
    status: '', // 'pago', 'pendente', 'vencido', 'cancelado'
    origem_tipo: '', // 'Loja' ou 'Irmao'
    origem_irmao_id: '' // ID do irmão
  });

  /**
   * Atualiza um filtro específico
   * @param {string} campo - Nome do campo a atualizar
   * @param {any} valor - Novo valor
   */
  const atualizarFiltro = (campo, valor) => {
    setFiltros(prev => ({
      ...prev,
      [campo]: valor
    }));
  };

  /**
   * Atualiza múltiplos filtros de uma vez
   * @param {Object} novosFiltros - Objeto com os filtros a atualizar
   */
  const atualizarFiltros = (novosFiltros) => {
    setFiltros(prev => ({
      ...prev,
      ...novosFiltros
    }));
  };

  /**
   * Reseta todos os filtros para valores padrão
   */
  const resetarFiltros = () => {
    setFiltros({
      mes: new Date().getMonth() + 1,
      ano: new Date().getFullYear(),
      tipo: '',
      categoria: '',
      status: '',
      origem_tipo: '',
      origem_irmao_id: ''
    });
  };

  /**
   * Aplica filtro para o mês atual
   */
  const aplicarFiltroMesAtual = () => {
    setFiltros(prev => ({
      ...prev,
      mes: new Date().getMonth() + 1,
      ano: new Date().getFullYear()
    }));
  };

  /**
   * Aplica filtro para um mês específico
   * @param {number} mes - Mês (1-12)
   * @param {number} ano - Ano
   */
  const aplicarFiltroMes = (mes, ano) => {
    setFiltros(prev => ({
      ...prev,
      mes,
      ano
    }));
  };

  /**
   * Verifica se há filtros ativos (além de mês/ano)
   * @returns {boolean}
   */
  const temFiltrosAtivos = () => {
    return !!(filtros.tipo || filtros.categoria || filtros.status || 
              filtros.origem_tipo || filtros.origem_irmao_id);
  };

  return {
    filtros,
    atualizarFiltro,
    atualizarFiltros,
    resetarFiltros,
    aplicarFiltroMesAtual,
    aplicarFiltroMes,
    temFiltrosAtivos
  };
};
