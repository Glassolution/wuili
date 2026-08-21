// Auditoria/backfill de variações em anúncios já publicados no Mercado Livre.
// Levanta publicações cujo produto de catálogo tem variação real (>=2 valores
// em um mesmo eixo) e verifica no ML se o anúncio foi criado como item simples.
// Com apply=true, tenta adicionar as variações via PUT /items/{id} — apenas em
// anúncios SEM vendas (o ML não permite reestruturar item com histórico).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const norm = (v: string) =>
  v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

type VariantRow = { name: string; value: string; sku?: string }

function parseVariants(raw: unknown): VariantRow[] {
  if (!Array.isArray(raw)) return []
  const rows: VariantRow[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    const name = clean(r.name)
    const value = clean(r.value)
    if (!name || !value) continue
    if (norm(name) === 'compra') continue // eixo sintético do scraper
    rows.push({ name, value, sku: clean(r.sku) || undefined })
  }
  return rows
}

const ALIAS: Record<string, string[]> = {
  COLOR: ['cor', 'cores', 'color'],
  SIZE: ['tamanho', 'size'],
  MODEL: ['modelo', 'model', 'tipo'],
  VOLTAGE: ['voltagem', 'voltage'],
  CAPACITY: ['capacidade', 'quantidade'],
}

function matchAttr(name: string, attrs: Array<Record<string, unknown>>) {
  const target = norm(name)
  const allowed = attrs.filter((a) => {
    const tags = (a.tags ?? {}) as Record<string, unknown>
    return tags.allow_variations === true
  })
  for (const a of allowed) {
    const id = clean(a.id).toUpperCase()
    const nm = clean(a.name as string)
    if (norm(nm) === target) return id
    if (ALIAS[id]?.includes(target)) return id
  }
  for (const a of allowed) {
    const id = clean(a.id).toUpperCase()
    if (norm(clean(a.name as string)).startsWith(target)) return id
  }
  return null
}

function buildVariations(
  variantsRaw: unknown,
  categoryAttrs: Array<Record<string, unknown>>,
  price: number,
  totalQuantity: number,
  pictureIds: string[],
) {
  const rows = parseVariants(variantsRaw)
  const grouped = new Map<string, string[]>()
  for (const r of rows) {
    const list = grouped.get(r.name) ?? []
    if (!list.includes(r.value)) list.push(r.value)
    grouped.set(r.name, list)
  }
  const axes: Array<{ attrId: string; values: string[] }> = []
  for (const [name, values] of grouped) {
    if (values.length < 2) continue
    const attrId = matchAttr(name, categoryAttrs)
    if (!attrId) return { variations: [], reason: `Categoria não aceita variação por "${name}"` }
    axes.push({ attrId, values })
  }
  if (axes.length === 0) return { variations: [], reason: 'Sem eixo de variação real' }

  let combos: Array<Array<{ id: string; value_name: string }>> = [[]]
  for (const axis of axes) {
    const next: Array<Array<{ id: string; value_name: string }>> = []
    for (const combo of combos) for (const v of axis.values) next.push([...combo, { id: axis.attrId, value_name: v }])
    combos = next
  }
  combos = combos.slice(0, 60)
  const per = Math.max(1, Math.floor((totalQuantity || 10) / combos.length))
  const variations = combos.map((attribute_combinations) => {
    const skuRow = rows.find((r) => r.sku && attribute_combinations.some((c) => c.value_name === r.value))
    return {
      attribute_combinations,
      price,
      available_quantity: per,
      ...(pictureIds.length > 0 ? { picture_ids: pictureIds.slice(0, 10) } : {}),
      ...(skuRow?.sku ? { attributes: [{ id: 'SELLER_SKU', value_name: skuRow.sku }] } : {}),
    }
  })
  return { variations, reason: '' }
}

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
async function categoryAttrs(categoryId: string) {
  if (attrCache.has(categoryId)) return attrCache.get(categoryId)!
  const res = await fetch(`https://api.mercadolibre.com/categories/${categoryId}/attributes`)
  const list = res.ok ? await res.json() : []
  const arr = Array.isArray(list) ? list : []
  attrCache.set(categoryId, arr)
  return arr
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const body = await req.json().catch(() => ({}))
    const apply = body.apply === true
    const limit = Math.min(Number(body.limit ?? 50), 300)
    const offset = Number(body.offset ?? 0)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: rows, error } = await supabase.rpc('ml_variation_backfill_candidates', {
      p_limit: limit,
      p_offset: offset,
    })
    if (error) return json({ error: error.message }, 500)

    const tokens = new Map<string, string | null>()
    const report: Array<Record<string, unknown>> = []

    for (const row of (rows ?? []) as Array<Record<string, unknown>>) {
      const userId = String(row.user_id)
      const itemId = String(row.ml_item_id)
      const entry: Record<string, unknown> = {
        ml_item_id: itemId,
        user_id: userId,
        email: row.email,
        title: row.title,
      }
      if (!tokens.has(userId)) tokens.set(userId, await getToken(supabase, userId))
      const token = tokens.get(userId)
      if (!token) {
        entry.status = 'sem_token'
        report.push(entry)
        continue
      }

      const itemRes = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!itemRes.ok) {
        entry.status = 'erro_ml'
        entry.detail = (await itemRes.text()).slice(0, 200)
        report.push(entry)
        continue
      }
      const item = await itemRes.json()
      entry.ml_status = item.status
      entry.sold = item.sold_quantity ?? 0

      if (Array.isArray(item.variations) && item.variations.length > 0) {
        entry.status = 'ja_tem_variacao'
        report.push(entry)
        continue
      }
      if ((item.sold_quantity ?? 0) > 0) {
        entry.status = 'tem_vendas_nao_editavel'
        report.push(entry)
        continue
      }
      if (item.status !== 'active') {
        entry.status = `ignorado_${item.status}`
        report.push(entry)
        continue
      }

      const attrs = await categoryAttrs(String(item.category_id))
      const pictureIds = (Array.isArray(item.pictures) ? item.pictures : [])
        .map((p: Record<string, unknown>) => String(p.id ?? ''))
        .filter(Boolean)
      const { variations, reason } = buildVariations(
        row.variants,
        attrs,
        Number(item.price ?? row.price ?? 0),
        Number(item.available_quantity ?? 10),
        pictureIds,
      )
      if (variations.length === 0) {
        entry.status = 'nao_aplicavel'
        entry.detail = reason
        report.push(entry)
        continue
      }
      entry.variations_count = variations.length
      if (!apply) {
        entry.status = 'corrigivel'
        report.push(entry)
        continue
      }

      // O ML rejeita quando o mesmo atributo (ex.: COLOR) está no item e nas
      // variações. Limpamos esses atributos no nível do item no mesmo PUT.
      const axisIds = new Set<string>(
        variations.flatMap((v) => (v.attribute_combinations as Array<{ id: string }>).map((c) => c.id)),
      )
      const itemAttrs = (Array.isArray(item.attributes) ? item.attributes : []) as Array<Record<string, unknown>>
      const clearedAttrs = itemAttrs
        .filter((a) => axisIds.has(String(a.id).toUpperCase()))
        .map((a) => ({ id: String(a.id), value_id: null, value_name: null }))

      const putRes = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(clearedAttrs.length > 0 ? { attributes: clearedAttrs, variations } : { variations }),

      })
      if (putRes.ok) {
        entry.status = 'corrigido'
      } else {
        entry.status = 'falha_update'
        entry.detail = (await putRes.text()).slice(0, 900)
        if (body.debug === true) {
          entry.item_attrs = itemAttrs.map((a) => `${a.id}=${a.value_name ?? a.value_id ?? ''}`)
          entry.sent = { attributes: clearedAttrs, variation0: variations[0] }
        }
      }

      report.push(entry)
    }

    const summary: Record<string, number> = {}
    for (const r of report) summary[String(r.status)] = (summary[String(r.status)] ?? 0) + 1

    return json({ apply, processed: report.length, summary, report })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
