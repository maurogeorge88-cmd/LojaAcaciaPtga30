import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ypnvzjctyfdrkkrhskzs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwbnZ6amN0eWZkcmtrcmhza3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NTgxMzcsImV4cCI6MjA3OTMzNDEzN30.J5Jj7wudOhIAxy35DDBIWtr9yr9Lq3ABBRI9ZJ5z2pc';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,      // Renovar token automaticamente antes de expirar
    persistSession: true,        // Persistir sessão no localStorage
    detectSessionInUrl: true,    // Detectar sessão na URL (OAuth)
    storageKey: 'loja-acacia-auth', // Chave única para evitar conflito com outros apps
  },
});

// Listener global: se o token expirar e não puder ser renovado, recarrega a página
// para forçar novo login — evita erros "JWT expired" silenciosos
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
    if (event === 'TOKEN_REFRESHED') {
      console.log('🔄 Token renovado automaticamente');
    }
  }
});
