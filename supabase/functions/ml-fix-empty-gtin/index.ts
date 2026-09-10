// Corrige anúncios que o Mercado Livre deixou em "Inativo para revisar"
// (status=under_review / sub_status=waiting_for_patch) por falta do atributo
// EMPTY_GTIN_REASON — o produto do fornecedor não tem código de barras (GTIN),
// e o ML exige que o motivo seja declarado explicitamente.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

async function getToken(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data } = await supabase
    .from('user_integrations')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .eq('platform', 'mercadolivre')
    .maybeSingle()
  if (!data?.access_token) return null
  if (new Date(data.expires_at as string) > new Date()) return data.access_token as string
  const res = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: Deno.env.get('ML_CLIENT_ID')!,
      client_secret: Deno.env.get('ML_CLIENT_SECRET')!,
      refresh_token: String(data.refresh_token ?? ''),
    }),
  })
  const j = await res.json()
  if (!res.ok || !j.access_token) return null
  await supabase.from('user_integrations').update({
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_at: new Date(Date.now() + j.expires_in * 1000).toISOString(),
  }).eq('user_id', userId).eq('platform', 'mercadolivre')
  return j.access_token as string
}

const attrCache = new Map<string, Array<Record<string, unknown>>>()
async function emptyGtinValueId(categoryId: string): Promise<string | null> {
  if (!attrCache.has(categoryId)) {
    const res = await fetch(`https://api.mercadolibre.com/categories/${categoryId}/attributes`)
    const list = res.ok ? await res.json() : []
    attrCache.set(categoryId, Array.isArray(list) ? list : [])
  }
  const def = attrCache.get(categoryId)!.find(a => String(a.id).toUpperCase() === 'EMPTY_GTIN_REASON')
  if (!def) return null
  const values = (def.values as Array<{ id?: string; name?: string }> | undefined) ?? []
  const match = values.find(v => /não tem código|nao tem codigo/i.test(String(v?.name ?? '')))
    ?? values.find(v => /outro motivo/i.test(String(v?.name ?? '')))
  return match?.id ?? null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const apply = body.apply !== false
    const limit = Math.min(Number(body.limit ?? 300), 500)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: pubs, error } = await supabase
      .from('user_publications')
      .select('id, user_id, ml_item_id, status')
      .eq('status', 'under_review')
      .not('ml_item_id', 'is', null)
      .limit(limit)
    if (error) return json({ error: error.message }, 500)

    const tokens = new Map<string, string | null>()
    const report = { total: pubs?.length ?? 0, fixed: 0, already_active: 0, no_token: 0, other: 0, errors: [] as unknown[] }

    for (const pub of pubs ?? []) {
      const userId = String(pub.user_id)
      if (!tokens.has(userId)) tokens.set(userId, await getToken(supabase, userId))
      const token = tokens.get(userId)
      if (!token) { report.no_token++; continue }

      const itemRes = await fetch(`https://api.mercadolibre.com/items/${pub.ml_item_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!itemRes.ok) { report.other++; continue }
      const item = await itemRes.json()

      if (item.status !== 'under_review') {
        await supabase.from('user_publications').update({ status: item.status }).eq('id', pub.id)
        report.already_active++
        continue
      }
      const subs: string[] = Array.isArray(item.sub_status) ? item.sub_status : []
      if (!subs.includes('waiting_for_patch')) { report.other++; continue }

      const attrs: Array<Record<string, unknown>> = Array.isArray(item.attributes) ? item.attributes : []
      if (attrs.some(a => String(a.id).toUpperCase() === 'EMPTY_GTIN_REASON')) { report.other++; continue }

      const valueId = await emptyGtinValueId(String(item.category_id))
      if (!valueId) { report.other++; continue }
      if (!apply) { report.fixed++; continue }

      const putRes = await fetch(`https://api.mercadolibre.com/items/${pub.ml_item_id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ attributes: [{ id: 'EMPTY_GTIN_REASON', value_id: valueId }] }),
      })
      const putJson = await putRes.json().catch(() => ({}))
      if (putRes.ok) {
        report.fixed++
        await supabase.from('user_publications')
          .update({ status: putJson.status ?? 'active' })
          .eq('id', pub.id)
      } else {
        report.other++
        if (report.errors.length < 10) report.errors.push({ item: pub.ml_item_id, err: putJson })
      }
    }

    return json(report)
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
