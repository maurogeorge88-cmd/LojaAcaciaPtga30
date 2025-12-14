// ========================================
// 🎣 HOOK: useCategorias
// ========================================
// Gerencia carregamento e organização de categorias financeiras
// Extraído de FinancasLoja.jsx para melhor organização

import { useState, useCallback, useMemo } from 'react';
import { supabase } from '../../../App';

/**
 * Hook para gerenciar categorias financeiras
 * @returns {Object} Objeto com estados e funções
 */
export const useCategorias = () => {
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(false);

  /**
   * Carrega todas as categorias do banco
   */
  const carregarCategorias = useCallback(async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('categorias_financeiras')
        .select('*')
        .order('tipo')
        .order('nome');
      
      if (error) throw error;
      
      setCategorias(data || []);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Categorias de receita
   */
  const categoriasReceita = useMemo(() => {
    return categorias.filter(c => c.tipo === 'receita');
  }, [categorias]);

  /**
   * Categorias de despesa
   */
  const categoriasDespesa = useMemo(() => {
    return categorias.filter(c => c.tipo === 'despesa');
  }, [categorias]);

  /**
   * Categorias principais (sem pai)
   */
  const categoriasPrincipais = useMemo(() => {
    return categorias.filter(c => !c.categoria_pai_id);
  }, [categorias]);

  /**
   * Busca subcategorias de uma categoria pai
   * @param {number} categoriaPaiId - ID da categoria pai
   * @returns {Array} Lista de subcategorias
   */
  const buscarSubcategorias = useCallback((categoriaPaiId) => {
    return categorias.filter(c => c.categoria_pai_id === categoriaPaiId);
  }, [categorias]);

  /**
   * Busca uma categoria por ID
   * @param {number} id - ID da categoria
   * @returns {Object|null} Categoria encontrada
   */
  const buscarCategoriaPorId = useCallback((id) => {
    return categorias.find(c => c.id === parseInt(id)) || null;
  }, [categorias]);

  /**
   * Organiza categorias em hierarquia (pai -> filhos)
   * @param {string} tipo - 'receita' ou 'despesa' (opcional)
   * @returns {Array} Categorias organizadas
   */
  const organizarHierarquia = useCallback((tipo = null) => {
    let categsFiltradas = categorias;
    
    if (tipo) {
      categsFiltradas = categorias.filter(c => c.tipo === tipo);
    }

    const principais = categsFiltradas.filter(c => !c.categoria_pai_id);
    
    return principais.map(principal => ({
      ...principal,
      subcategorias: categsFiltradas.filter(c => c.categoria_pai_id === principal.id)
    }));
  }, [categorias]);

  /**
   * Cria uma nova categoria
   * @param {Object} dadosCategoria - Dados da categoria
   * @returns {Object} Categoria criada
   */
  const criarCategoria = useCallback(async (dadosCategoria) => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('categorias_financeiras')
        .insert([dadosCategoria])
        .select();
      
      if (error) throw error;
      
      // Atualiza lista local
      setCategorias(prev => [...prev, data[0]]);
      
      return data[0];
    } catch (error) {
      console.error('Erro ao criar categoria:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Atualiza uma categoria existente
   * @param {number} id - ID da categoria
   * @param {Object} dadosAtualizados - Dados a atualizar
   */
  const atualizarCategoria = useCallback(async (id, dadosAtualizados) => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('categorias_financeiras')
        .update(dadosAtualizados)
        .eq('id', id);
      
      if (error) throw error;
      
      // Atualiza lista local
      setCategorias(prev => 
        prev.map(c => c.id === id ? { ...c, ...dadosAtualizados } : c)
      );
    } catch (error) {
      console.error('Erro ao atualizar categoria:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Exclui uma categoria
   * @param {number} id - ID da categoria
   */
  const excluirCategoria = useCallback(async (id) => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('categorias_financeiras')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      // Remove da lista local
      setCategorias(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error('Erro ao excluir categoria:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    categorias,
    categoriasReceita,
    categoriasDespesa,
    categoriasPrincipais,
    loading,
    carregarCategorias,
    buscarSubcategorias,
    buscarCategoriaPorId,
    organizarHierarquia,
    criarCategoria,
    atualizarCategoria,
    excluirCategoria,
    setCategorias
  };
};
