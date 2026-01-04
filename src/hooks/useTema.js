import { useEffect } from 'react';
import { supabase } from '../supabaseClient';

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
      aplicarTema('azul');
    }
  };

  const aplicarTema = (tema) => {
    document.documentElement.removeAttribute('data-theme');
    if (tema && tema !== 'azul') {
      document.documentElement.setAttribute('data-theme', tema);
    }
  };
};
