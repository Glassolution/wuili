// Retorna se a conta do Mercado Livre do usuário está apta a publicar (list.allow=true).
// Usado pelo frontend para decidir se o tutorial de configuração de vendedor
// deve ser exibido. Fonte da verdade: GET /users/me do próprio Mercado Livre.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Não autorizado' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: 'Configuração incompleta' }, 500)

    const authed = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: userData, error: userErr } = await authed.auth.getUser()
    if (userErr || !userData?.user) return json({ error: 'Token inválido' }, 401)
    const userId = userData.user.id

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: integ } = await admin
      .from('user_integrations')
      .select('access_token')
      .eq('user_id', userId)
      .eq('platform', 'mercadolivre')
      .maybeSingle()

    // Sem integração ML → não bloqueamos o tutorial, mas também não sabemos.
    // Retornamos connected=false e canList=null → frontend NÃO abre tutorial.
    if (!integ?.access_token) {
      return json({ connected: false, canList: null, codes: [] })
    }

    const res = await fetch('https://api.mercadolibre.com/users/me', {
      headers: { Authorization: `Bearer ${integ.access_token}` },
    })
    const data = await res.json().catch(() => ({} as Record<string, unknown>))

    if (!res.ok) {
      // Token inválido/expirado — não sabemos; não abrimos tutorial.
      return json({ connected: true, canList: null, codes: [], reason: 'ml_api_error' })
    }

    const status = (data.status as Record<string, unknown> | undefined) ?? {}
    const list = (status.list as Record<string, unknown> | undefined) ?? {}
    const sell = (status.sell as Record<string, unknown> | undefined) ?? {}
    const listAllow = list.allow === true
    const sellAllow = sell.allow === true
    const canList = listAllow && sellAllow
    const codes = Array.isArray(list.codes) ? list.codes : []

    return json({
      connected: true,
      canList,
      codes,
      required_action: status.required_action ?? null,
      mercadoenvios: status.mercadoenvios ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return json({ error: message }, 500)
  }
})
