/**
 * HOOK DE AUTENTICAÇÃO
 * Sistema A∴R∴L∴S∴ Acácia de Paranatinga nº 30
 */

import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null); // Dados completos do usuário
  const [permissoes, setPermissoes] = useState(null); // Permissões do usuário

  // Buscar dados do usuário logado
  const fetchUserData = async (userId) => {
    try {
      // Buscar dados do usuário na tabela usuarios
      const { data: usuario, error: userError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', userId)
        .single();

      if (userError) throw userError;

      setUserData(usuario);

      // Buscar permissões baseado no cargo
      if (usuario?.cargo) {
        const { data: perms, error: permError } = await supabase
          .from('permissoes')
          .select('*')
          .eq('cargo', usuario.cargo)
          .single();

        if (permError) throw permError;
        setPermissoes(perms);
      }
    } catch (error) {
      console.error('Erro ao buscar dados do usuário:', error);
      setUserData(null);
      setPermissoes(null);
    }
  };

  useEffect(() => {
    // Obter sessão atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user?.email) {
        fetchUserData(session.user.email);
      }
      
      setLoading(false);
    });

    // Escutar mudanças de autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user?.email) {
        fetchUserData(session.user.email);
      } else {
        setUserData(null);
        setPermissoes(null);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  return {
    user,
    session,
    loading,
    signIn,
    signOut,
    isAuthenticated: !!user,
    userData, // Dados completos do usuário (incluindo tipo_acesso)
    permissoes, // Permissões do cargo
    tipoAcesso: userData?.tipo_acesso || 'irmaos', // 'irmaos', 'cunhadas', 'geral'
    podeAcessarCunhadas: permissoes?.pode_acessar_portal_cunhadas || false,
  };
};
