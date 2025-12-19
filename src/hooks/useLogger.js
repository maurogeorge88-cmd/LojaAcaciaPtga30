/**
 * HOOK useLogger
 * Sistema A∴R∴L∴S∴ Acácia de Paranatinga nº 30
 * 
 * Hook para registrar logs de acesso e ações dos usuários
 */

import { supabase } from '../supabaseClient';

export const useLogger = (userData) => {
  /**
   * Registra um log de ação no sistema
   * @param {string} acao - Tipo de ação (login, logout, criar, editar, excluir, visualizar, exportar)
   * @param {string} detalhes - Detalhes da ação realizada
   * @param {object} metadados - Dados adicionais (opcional)
   */
  const registrarLog = async (acao, detalhes, metadados = {}) => {
    try {
      // Obter informações do navegador
      const userAgent = navigator.userAgent;
      
      // Tentar obter IP (em produção, isso deve vir do backend)
      let ip = 'Não disponível';
      
      // Criar registro de log
      const logData = {
        usuario_id: userData?.id, // Usar o ID da tabela usuarios (BIGINT)
        acao,
        detalhes,
        ip,
        user_agent: userAgent,
        metadados: JSON.stringify(metadados),
        created_at: new Date().toISOString()
      };

      // Inserir no banco
      const { error } = await supabase
        .from('logs_acesso')
        .insert([logData]);

      if (error) {
        console.error('Erro ao registrar log:', error);
      }
    } catch (error) {
      console.error('Erro ao registrar log:', error);
    }
  };

  /**
   * Registra login do usuário
   */
  const registrarLogin = async () => {
    await registrarLog(
      'login',
      `${userData?.nome || 'Usuário'} fez login no sistema`,
      { cargo: userData?.cargo }
    );
  };

  /**
   * Registra logout do usuário
   */
  const registrarLogout = async () => {
    await registrarLog(
      'logout',
      `${userData?.nome || 'Usuário'} fez logout do sistema`
    );
  };

  /**
   * Registra visualização de página/módulo
   */
  const registrarVisualizacao = async (modulo) => {
    await registrarLog(
      'visualizar',
      `Acessou o módulo: ${modulo}`,
      { modulo }
    );
  };

  /**
   * Registra criação de registro
   */
  const registrarCriacao = async (tipo, descricao) => {
    await registrarLog(
      'criar',
      `Criou ${tipo}: ${descricao}`,
      { tipo }
    );
  };

  /**
   * Registra edição de registro
   */
  const registrarEdicao = async (tipo, descricao, alteracoes = {}) => {
    await registrarLog(
      'editar',
      `Editou ${tipo}: ${descricao}`,
      { tipo, alteracoes }
    );
  };

  /**
   * Registra exclusão de registro
   */
  const registrarExclusao = async (tipo, descricao) => {
    await registrarLog(
      'excluir',
      `Excluiu ${tipo}: ${descricao}`,
      { tipo }
    );
  };

  /**
   * Registra exportação de dados
   */
  const registrarExportacao = async (tipo, formato) => {
    await registrarLog(
      'exportar',
      `Exportou ${tipo} em formato ${formato}`,
      { tipo, formato }
    );
  };

  return {
    registrarLog,
    registrarLogin,
    registrarLogout,
    registrarVisualizacao,
    registrarCriacao,
    registrarEdicao,
    registrarExclusao,
    registrarExportacao
  };
};
