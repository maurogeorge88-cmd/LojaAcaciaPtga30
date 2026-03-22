import { useEffect } from 'react';
import { supabase } from '../supabaseClient';

/**
 * Hook para carregar tema do usuário logado automaticamente
 * Carrega: tema_base (light/dark), cor_paleta e cor_acento
 */
export const useCarregarTema = (user) => {
  useEffect(() => {
    if (!user?.email) return;
    
    carregarPreferenciasUsuario();
  }, [user]);

  const carregarPreferenciasUsuario = async () => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('pref_tema_base, pref_cor_paleta, pref_cor_acento')
        .eq('email', user.email)
        .single();

      if (error) {
        console.error('❌ Erro ao carregar tema:', error);
        aplicarTemasPadrao();
        return;
      }

      if (data) {
        aplicarTemaCompleto(
          data.pref_tema_base || 'dark',
          data.pref_cor_paleta || 'azul-escuro',
          data.pref_cor_acento || '#3b82f6'
        );
      } else {
        aplicarTemasPadrao();
      }
    } catch (error) {
      console.error('❌ Erro ao carregar preferências:', error);
      aplicarTemasPadrao();
    }
  };

  const aplicarTemaCompleto = (temaBase, corPaleta, corAcento) => {
    // 1. Aplicar tema claro/escuro
    if (temaBase === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    
    // 2. Aplicar paleta de cor (data-color)
    if (corPaleta && corPaleta !== 'azul-escuro') {
      document.documentElement.setAttribute('data-color', corPaleta);
    } else {
      document.documentElement.removeAttribute('data-color');
    }
    
    // 3. Aplicar cor de acento
    document.documentElement.style.setProperty('--color-accent', corAcento);
    
    // 4. Calcular cor hover (10% mais escura)
    const hoverColor = adjustColor(corAcento, -10);
    document.documentElement.style.setProperty('--color-accent-hover', hoverColor);
    
    console.log('🎨 Tema carregado:', { temaBase, corPaleta, corAcento });
  };

  const aplicarTemasPadrao = () => {
    // Tema padrão: dark, azul-escuro, #3b82f6
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-color');
    document.documentElement.style.setProperty('--color-accent', '#3b82f6');
    document.documentElement.style.setProperty('--color-accent-hover', '#2563eb');
    console.log('🎨 Tema padrão aplicado');
  };

  // Função auxiliar para ajustar cor
  const adjustColor = (color, percent) => {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    ).toString(16).slice(1);
  };
};
