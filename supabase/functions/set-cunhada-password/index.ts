// supabase/functions/set-cunhada-password/index.ts
// Edge Function — roda no servidor Supabase com acesso à Admin API
// Cria o usuário no Auth (se não existir) ou atualiza a senha,
// confirmando o email automaticamente.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'email e password são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'A senha deve ter pelo menos 6 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Cliente com SERVICE_ROLE_KEY — acesso total à Admin API
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verificar se o usuário já existe
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers()
    const existente = listData?.users?.find((u) => u.email === email)

    let userId: string

    if (existente) {
      // Usuário já existe — atualizar senha e confirmar email
      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
        existente.id,
        {
          password,
          email_confirm: true,
        }
      )
      if (error) throw error
      userId = data.user.id
    } else {
      // Usuário não existe — criar com email já confirmado
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      if (error) throw error
      userId = data.user.id
    }

    return new Response(
      JSON.stringify({ success: true, user_id: userId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
