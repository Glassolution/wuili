// ml-item-details
// ---------------
// Devolve os dados vivos de um anúncio do Mercado Livre (todas as fotos e o
// status atual) para a tela de publicações. A API do ML não responde mais sem
// token — nem para itens públicos — então a busca precisa passar por aqui, onde
// o access_token do usuário está guardado.
//
// Somente leitura: nada é gravado no banco. O status de `user_publications` é
// sincronizado pelo cron `ml-sync-listings-status`.

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

// O token do ML expira em 6h; renova antes de usar quando já passou do prazo.
async function getFreshToken(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<string | null> {
  const { data: integ } = await admin
    .from('user_integrations')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .eq('platform', 'mercadolivre')
    .maybeSingle()

  if (!integ?.access_token) return null

  const expiresAt = integ.expires_at ? new Date(integ.expires_at as string) : new Date(0)
  if (expiresAt > new Date(Date.now() + 60_000)) return integ.access_token as string

  const clientId = Deno.env.get('ML_CLIENT_ID')
  const clientSecret = Deno.env.get('ML_CLIENT_SECRET')
  if (!clientId || !clientSecret || !integ.refresh_token) return integ.access_token as string

  const res = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: integ.refresh_token as string,
    }),
  })

  if (!res.ok) return integ.access_token as string

  const tokens = await res.json()
  await admin
    .from('user_integrations')
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? integ.refresh_token,
      expires_at: new Date(Date.now() + (tokens.expires_in ?? 21600) * 1000).toISOString(),
    })
    .eq('user_id', userId)
    .eq('platform', 'mercadolivre')

  return tokens.access_token as string
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

    const body = await req.json().catch(() => ({}))
    const itemId = String(body?.ml_item_id ?? '').trim()
    if (!itemId) return json({ error: 'ml_item_id obrigatório' }, 400)

    const admin = createClient(supabaseUrl, serviceKey)

    // O anúncio precisa ser uma publicação do próprio usuário: sem isso a função
    // viraria um proxy para consultar qualquer item do ML com o token dele.
    const { data: publication } = await admin
      .from('user_publications')
      .select('id')
      .eq('user_id', userId)
      .eq('ml_item_id', itemId)
      .maybeSingle()

    if (!publication) return json({ error: 'Anúncio não encontrado' }, 404)

    const token = await getFreshToken(admin, userId)
    if (!token) return json({ connected: false, error: 'Mercado Livre não conectado' }, 200)

    // Sem filtro de `attributes`: o ML já devolve o item inteiro e o filtro é
    // uma fonte silenciosa de campo faltando quando o nome muda de lado deles.
    const res = await fetch(
      `https://api.mercadolibre.com/items/${encodeURIComponent(itemId)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.warn('[ml-item-details] ML respondeu', res.status, detail.slice(0, 200))
      return json({ connected: true, ok: false, ml_status: res.status }, 200)
    }

    const item = await res.json()
    const pictures = Array.isArray(item.pictures)
      ? item.pictures
          .map((picture: Record<string, unknown>) => String(picture.secure_url ?? picture.url ?? ''))
          .filter((url: string) => url.length > 0)
      : []

    return json({
      connected: true,
      ok: true,
      id: item.id ?? itemId,
      status: item.status ?? null,
      sub_status: Array.isArray(item.sub_status) ? item.sub_status : [],
      permalink: item.permalink ?? null,
      title: item.title ?? null,
      price: item.price ?? null,
      available_quantity: item.available_quantity ?? null,
      sold_quantity: item.sold_quantity ?? null,
      pictures,
      thumbnail: item.thumbnail ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return json({ error: message }, 500)
  }
})
