import { useEffect } from 'react';
import { supabase } from '../supabaseClient';

export const useTema = () => {
  // Hook desabilitado - useCarregarTema substituiu esta funcionalidade
  // Mantido apenas para compatibilidade com código existente
  useEffect(() => {
    console.log('📌 useTema (legado) - substituído por useCarregarTema');
  }, []);
};
