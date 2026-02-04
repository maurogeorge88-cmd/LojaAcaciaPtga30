import { useEffect } from 'react';
import { supabase } from '../supabaseClient';

/**
 * Hook para registrar acesso ao sistema
 * Registra automaticamente quando o componente que usa este hook é montado
 */
export const useRegistrarAcesso = (user) => {
  useEffect(() => {
    const registrarAcesso = async () => {
      if (!user?.id) return;
      
      try {
        // Registrar acesso
        await supabase.from('logs_sistema').insert({
          usuario_id: user.id,
          acao: 'acesso_sistema',
          detalhes: 'Usuário acessou o sistema',
          timestamp: new Date().toISOString()
        });
        
        console.log('✅ Acesso registrado');
      } catch (error) {
        console.error('❌ Erro ao registrar acesso:', error);
      }
    };
    
    registrarAcesso();
  }, [user?.id]); // Executa quando user.id muda (login)
};
