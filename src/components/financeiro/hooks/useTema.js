import { useEffect } from 'react';
import { supabase } from '../supabaseClient';

/**
 * Hook para carregar e aplicar tema do sistema
 * Deve ser chamado no componente App.jsx
 */
export const useTema = () => {
  useEffect(() => {
    carregarTemaInicial();
  }, []);

  const carregarTemaInicial = async () => {
    try {
      const { data, error } = await supabase
        .from('dados_loja')
        .select('tema_cor')
        .single();

      if (!error && data?.tema_cor) {
        aplicarTema(data.tema_cor);
      }
    } catch (error) {
      console.error('Erro ao carregar tema inicial:', error);
      // Aplica tema padrão em caso de erro
      aplicarTema('azul');
    }
  };

  const aplicarTema = (tema) => {
    // Remove tema anterior
    document.documentElement.removeAttribute('data-theme');
    
    // Aplica novo tema (se não for azul, que é o padrão)
    if (tema && tema !== 'azul') {
      document.documentElement.setAttribute('data-theme', tema);
    }
  };
};
