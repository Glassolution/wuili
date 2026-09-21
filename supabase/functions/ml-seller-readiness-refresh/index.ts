// Verifica em lote a aptidão real de vendedor no Mercado Livre de quem pagou
// e ainda não publicou. Usa o token já guardado (renovando quando dá) e grava
// o resultado em `ml_seller_readiness`, para o admin saber o motivo sem
// depender de a pessoa voltar ao app.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type Integracao = {
  user_id: string
  access_token: string | null
  refresh_token: string | null
  expires_at: string | null
  ml_user_id: number | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!supabaseUrl || !serviceKey) return json({ error: 'Configuração incompleta' }, 500)

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // Autoriza cron (segredo) ou administrador autenticado.
  const headerSecret = req.headers.get('x-cron-secret')
  let autorizado = Boolean(cronSecret && headerSecret && headerSecret === cronSecret)
  if (!autorizado && headerSecret) {
    const { data: tok } = await admin
      .from('cron_tokens')
      .select('token')
      .eq('name', 'ml-seller-readiness-refresh')
      .maybeSingle()
    autorizado = Boolean(tok?.token && tok.token === headerSecret)
  }
  if (!autorizado) {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Não autorizado' }, 401)
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const authed = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data, error } = await authed.auth.getUser()
    if (error || !data?.user) return json({ error: 'Token inválido' }, 401)
    const { data: ehAdmin } = await admin.rpc('is_admin', { _user_id: data.user.id })
    if (ehAdmin !== true) return json({ error: 'Somente administradores' }, 403)
  }

  const limite = Math.min(Number(new URL(req.url).searchParams.get('limit') ?? 120), 300)

  // Quem pagou (assinatura ativa) e ainda não publicou nada.
  const { data: assinantes } = await admin
    .from('subscriptions')
    .select('user_id')
    .in('status', ['active', 'paid', 'authorized'])
    .limit(2000)

  const ids = [...new Set((assinantes ?? []).map((s: { user_id: string }) => s.user_id).filter(Boolean))]
  if (!ids.length) return json({ ok: true, verificados: 0 })

  const { data: publicaram } = await admin
    .from('user_publications')
    .select('user_id')
    .in('user_id', ids)
  const comAnuncio = new Set((publicaram ?? []).map((p: { user_id: string }) => p.user_id))
  const alvo = ids.filter((id) => !comAnuncio.has(id)).slice(0, limite)
  if (!alvo.length) return json({ ok: true, verificados: 0 })

  const { data: integracoes } = await admin
    .from('user_integrations')
    .select('user_id, access_token, refresh_token, expires_at, ml_user_id')
    .eq('platform', 'mercadolivre')
    .in('user_id', alvo)

  let verificados = 0
  let aptos = 0
  let bloqueados = 0
  let semResposta = 0

  for (const integ of (integracoes ?? []) as Integracao[]) {
    let token = integ.access_token ?? ''
    const expira = integ.expires_at ? new Date(integ.expires_at).getTime() : 0

    // Renova o token quando estiver vencido/perto de vencer.
    if (token && expira < Date.now() + 60_000 && integ.refresh_token) {
      try {
        const r = await fetch('https://api.mercadolibre.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: Deno.env.get('ML_CLIENT_ID') ?? '',
            client_secret: Deno.env.get('ML_CLIENT_SECRET') ?? '',
            refresh_token: integ.refresh_token,
          }),
        })
        const d = await r.json().catch(() => ({}))
        if (r.ok && d?.access_token) {
          token = d.access_token
          await admin
            .from('user_integrations')
            .update({
              access_token: d.access_token,
              refresh_token: d.refresh_token ?? integ.refresh_token,
              expires_at: new Date(Date.now() + Number(d.expires_in ?? 21600) * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', integ.user_id)
            .eq('platform', 'mercadolivre')
        } else {
          token = ''
        }
      } catch (_) {
        token = ''
      }
    }

    let canList: boolean | null = null
    let codes: string[] = []
    let lastError: string | null = null

    if (!token) {
      lastError = 'conexao_expirada'
    } else {
      try {
        const res = await fetch('https://api.mercadolibre.com/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const me = await res.json().catch(() => ({}))
        if (res.ok) {
          const status = me?.status ?? {}
          const listAllow = status?.list?.allow === true
          const sellAllow = status?.sell?.allow === true
          canList = listAllow && sellAllow
          codes = Array.isArray(status?.list?.codes) ? status.list.codes.map(String) : []
        } else {
          lastError = `ml_http_${res.status}`
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message.slice(0, 200) : 'erro_desconhecido'
      }
    }

    await admin.from('ml_seller_readiness').upsert(
      {
        user_id: integ.user_id,
        can_list: canList,
        codes,
        source: 'batch',
        ml_user_id: integ.ml_user_id,
        last_error: lastError,
        checked_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

    verificados += 1
    if (canList === true) aptos += 1
    else if (canList === false) bloqueados += 1
    else semResposta += 1
  }

  return json({ ok: true, alvo: alvo.length, verificados, aptos, bloqueados, semResposta })
})
