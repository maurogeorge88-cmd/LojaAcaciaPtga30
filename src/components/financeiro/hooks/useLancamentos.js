// ========================================
// 🎣 HOOK: useLancamentos
// ========================================
// Gerencia carregamento, criação, edição e exclusão de lançamentos
// Extraído de FinancasLoja.jsx para melhor organização

import { useState, useCallback } from 'react';
import { supabase } from '../../../App';

/**
 * Hook para gerenciar lançamentos financeiros
 * @param {Array} categorias - Lista de categorias disponíveis
 * @returns {Object} Objeto com estados e funções
 */
export const useLancamentos = (categorias = []) => {
  const [lancamentos, setLancamentos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalRegistros, setTotalRegistros] = useState(0);

  /**
   * Carrega lançamentos do banco aplicando filtros
   * @param {Object} filtros - Filtros a aplicar
   */
  const carregarLancamentos = useCallback(async (filtros) => {
    try {
      setLoading(true);
      const { mes, ano, tipo, categoria, status, origem_tipo, origem_irmao_id } = filtros;

      let query = supabase
        .from('lancamentos_loja')
        .select(`
          *,
          categorias_financeiras(nome, tipo),
          irmaos(nome)
        `)
        .order('data_lancamento', { ascending: false })
        .limit(500); // ⚡ PERFORMANCE: Limita a 500 registros

      // Filtro de MÊS e ANO (0 = Todos)
      if (mes > 0 && ano > 0) {
        const primeiroDia = `${ano}-${mes.toString().padStart(2, '0')}-01`;
        const ultimoDia = new Date(ano, mes, 0).getDate();
        const ultimoDiaFormatado = `${ano}-${mes.toString().padStart(2, '0')}-${ultimoDia}`;
        query = query.gte('data_lancamento', primeiroDia).lte('data_lancamento', ultimoDiaFormatado);
      } else if (ano > 0) {
        query = query.gte('data_lancamento', `${ano}-01-01`).lte('data_lancamento', `${ano}-12-31`);
      }

      // Filtro de TIPO (receita/despesa)
      if (tipo) {
        const categoriasDoTipo = categorias
          .filter(c => c.tipo === tipo)
          .map(c => c.id);
        if (categoriasDoTipo.length > 0) {
          query = query.in('categoria_id', categoriasDoTipo);
        }
      }

      // Filtro de CATEGORIA específica
      if (categoria) {
        query = query.eq('categoria_id', parseInt(categoria));
      }

      // Filtro de STATUS
      if (status) {
        query = query.eq('status', status);
      }

      // Filtro de ORIGEM (Loja ou Irmão)
      if (origem_tipo) {
        query = query.eq('origem_tipo', origem_tipo);
      }

      // Filtro de IRMÃO específico
      if (origem_irmao_id) {
        query = query.eq('origem_irmao_id', parseInt(origem_irmao_id));
      }

      const { data, error } = await query;

      if (error) throw error;

      // RECALCULAR valores considerando pagamentos parciais
      const lancamentosProcessados = await Promise.all((data || []).map(async (lanc) => {
        // Ignorar os próprios registros de pagamento parcial
        if (lanc.eh_pagamento_parcial) {
          return lanc;
        }

        // Buscar pagamentos parciais deste lançamento
        const { data: pagamentosParcias, error: errPag } = await supabase
          .from('lancamentos_loja')
          .select('valor, tipo_pagamento')
          .eq('lancamento_principal_id', lanc.id)
          .eq('eh_pagamento_parcial', true);

        if (!errPag && pagamentosParcias && pagamentosParcias.length > 0) {
          const pagamentosReais = pagamentosParcias.filter(p => p.tipo_pagamento !== 'compensacao');
          const compensacoes = pagamentosParcias.filter(p => p.tipo_pagamento === 'compensacao');
          
          const totalPago = pagamentosReais.reduce((sum, p) => sum + parseFloat(p.valor), 0);
          const totalCompensado = compensacoes.reduce((sum, p) => sum + parseFloat(p.valor), 0);
          
          const valorOriginalCalculado = parseFloat(lanc.valor) + totalPago + totalCompensado;
          
          return {
            ...lanc,
            valor_original: valorOriginalCalculado,
            total_pago_parcial: totalPago,
            tem_pagamento_parcial: totalPago > 0 || totalCompensado > 0
          };
        }

        return lanc;
      }));

      setLancamentos(lancamentosProcessados);
      setTotalRegistros(lancamentosProcessados.length);
    } catch (error) {
      console.error('Erro ao carregar lançamentos:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [categorias]);

  /**
   * Salva um novo lançamento ou atualiza existente
   * @param {Object} dadosLancamento - Dados do lançamento
   * @param {number|null} id - ID do lançamento (null para novo)
   * @returns {Object} Lançamento salvo
   */
  const salvarLancamento = useCallback(async (dadosLancamento, id = null) => {
    try {
      setLoading(true);

      if (id) {
        // Atualizar lançamento existente
        const { data, error } = await supabase
          .from('lancamentos_loja')
          .update(dadosLancamento)
          .eq('id', id)
          .select();
        
        if (error) throw error;
        return data[0];
      } else {
        // Criar novo lançamento
        const { data, error } = await supabase
          .from('lancamentos_loja')
          .insert([dadosLancamento])
          .select();
        
        if (error) throw error;
        return data[0];
      }
    } catch (error) {
      console.error('Erro ao salvar lançamento:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Exclui um lançamento
   * @param {number} id - ID do lançamento
   */
  const excluirLancamento = useCallback(async (id) => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('lancamentos_loja')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    } catch (error) {
      console.error('Erro ao excluir lançamento:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Busca pagamentos parciais de um lançamento
   * @param {number} lancamentoId - ID do lançamento principal
   * @returns {Array} Lista de pagamentos
   */
  const buscarPagamentosParciais = useCallback(async (lancamentoId) => {
    try {
      const { data, error } = await supabase
        .from('lancamentos_loja')
        .select('*')
        .eq('lancamento_principal_id', lancamentoId)
        .eq('eh_pagamento_parcial', true)
        .order('data_pagamento', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erro ao buscar pagamentos parciais:', error);
      return [];
    }
  }, []);

  /**
   * Atualiza o status de um lançamento
   * @param {number} id - ID do lançamento
   * @param {string} novoStatus - Novo status
   */
  const atualizarStatus = useCallback(async (id, novoStatus) => {
    try {
      const { error } = await supabase
        .from('lancamentos_loja')
        .update({ status: novoStatus })
        .eq('id', id);
      
      if (error) throw error;
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      throw error;
    }
  }, []);

  return {
    lancamentos,
    loading,
    totalRegistros,
    carregarLancamentos,
    salvarLancamento,
    excluirLancamento,
    buscarPagamentosParciais,
    atualizarStatus,
    setLancamentos
  };
};
