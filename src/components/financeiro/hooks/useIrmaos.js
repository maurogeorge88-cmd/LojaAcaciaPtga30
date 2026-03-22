// ========================================
// 🎣 HOOK: useIrmaos
// ========================================
// Gerencia carregamento e filtragem de irmãos
// Extraído de FinancasLoja.jsx para melhor organização

import { useState, useCallback, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';

/**
 * Hook para gerenciar irmãos
 * @returns {Object} Objeto com estados e funções
 */
export const useIrmaos = () => {
  const [irmaos, setIrmaos] = useState([]);
  const [loading, setLoading] = useState(false);

  /**
   * Carrega todos os irmãos do banco
   * @param {boolean} apenasAtivos - Se true, carrega apenas regulares e licenciados
   */
  const carregarIrmaos = useCallback(async (apenasAtivos = true) => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('irmaos')
        .select('id, nome, cim, situacao, grau')
        .order('nome');
      
      if (apenasAtivos) {
        query = query.in('situacao', ['regular', 'licenciado']);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      setIrmaos(data || []);
    } catch (error) {
      console.error('Erro ao carregar irmãos:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Irmãos regulares
   */
  const irmaosRegulares = useMemo(() => {
    return irmaos.filter(i => i.situacao === 'regular');
  }, [irmaos]);

  /**
   * Irmãos licenciados
   */
  const irmaosLicenciados = useMemo(() => {
    return irmaos.filter(i => i.situacao === 'licenciado');
  }, [irmaos]);

  /**
   * Busca um irmão por ID
   * @param {number} id - ID do irmão
   * @returns {Object|null} Irmão encontrado
   */
  const buscarIrmaoPorId = useCallback((id) => {
    return irmaos.find(i => i.id === parseInt(id)) || null;
  }, [irmaos]);

  /**
   * Busca irmãos por nome (busca parcial)
   * @param {string} nome - Nome ou parte do nome
   * @returns {Array} Lista de irmãos encontrados
   */
  const buscarPorNome = useCallback((nome) => {
    if (!nome) return irmaos;
    
    const nomeLower = nome.toLowerCase();
    return irmaos.filter(i => 
      i.nome.toLowerCase().includes(nomeLower)
    );
  }, [irmaos]);

  /**
   * Busca irmãos por situação
   * @param {string} situacao - Situação do irmão
   * @returns {Array} Lista de irmãos
   */
  const buscarPorSituacao = useCallback((situacao) => {
    if (!situacao) return irmaos;
    return irmaos.filter(i => i.situacao === situacao);
  }, [irmaos]);

  /**
   * Conta irmãos por situação
   * @returns {Object} Objeto com contagem por situação
   */
  const contarPorSituacao = useMemo(() => {
    const contagem = {};
    
    irmaos.forEach(irmao => {
      const sit = irmao.situacao || 'indefinido';
      contagem[sit] = (contagem[sit] || 0) + 1;
    });
    
    return contagem;
  }, [irmaos]);

  return {
    irmaos,
    irmaosRegulares,
    irmaosLicenciados,
    loading,
    carregarIrmaos,
    buscarIrmaoPorId,
    buscarPorNome,
    buscarPorSituacao,
    contarPorSituacao,
    setIrmaos
  };
};
