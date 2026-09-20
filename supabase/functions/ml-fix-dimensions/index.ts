// Corrige peso e medidas dos anúncios que já estão no ar.
// Somente GET + PUT dos campos de embalagem: não toca em preço, título,
// fotos ou estoque. Roda em lotes (cron) e pode ser disparada por um admin.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { getSellerAccessToken } from '../_shared/mlSellerToken.ts'
import { montarPesoMedidas, garantirMedidasNoAnuncio, reativarAnuncio } from '../_shared/mlPackage.ts'

// Backoff progressivo entre as tentativas de auto-correcao (1min .. ~2h).
const proximaTentativa = (tentativas: number) => {
  const minutos = Math.min(120, Math.max(1, 2 ** tentativas))
  return new Date(Date.now() + minutos * 60_000).toISOString()
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Autorização: cron (segredo interno / service role) ou usuário admin.
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '').trim()
  const cronHeader = req.headers.get('x-cron-secret') ?? ''
  const envSecret = Deno.env.get('ML_DIMENSIONS_CRON_SECRET') ?? ''
  let isCron = token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
    (envSecret.length > 0 && cronHeader === envSecret)
  if (!isCron && cronHeader.length > 0) {
    const { data: row } = await supabase
      .from('cron_tokens')
      .select('token')
      .eq('name', 'ml-fix-dimensions')
      .maybeSingle()
    isCron = Boolean(row?.token) && row!.token === cronHeader
  }
  if (!isCron) {
    const { data: userData } = await supabase.auth.getUser(token)
    const uid = userData?.user?.id
    if (!uid) return json({ error: 'Não autenticado' }, 401)
    const { data: admin } = await supabase.rpc('is_admin', { _user_id: uid })
    if (!admin) return json({ error: 'Acesso restrito a administradores' }, 403)
  }

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch (_e) { /* cron pode chamar sem corpo */ }

  const limit = Math.min(Number(body.limit ?? 40) || 40, 100)

  // 1) Enfileira anúncios ativos ainda não verificados.
  const { data: pendentes } = await supabase
    .from('user_publications')
    .select('id, user_id, ml_item_id, catalog_product_id')
    .eq('status', 'active')
    .is('dimensions_ok', null)
    .not('ml_item_id', 'is', null)
    .limit(500)

  if (pendentes && pendentes.length > 0) {
    await supabase.from('ml_dimension_fixes').upsert(
      pendentes.map((p) => ({
        user_id: p.user_id,
        ml_item_id: p.ml_item_id,
        publication_id: p.id,
        status: 'pending',
      })),
      { onConflict: 'ml_item_id', ignoreDuplicates: true },
    )
  }

  // 2) Processa um lote.
  const { data: fila } = await supabase
    .from('ml_dimension_fixes')
    .select('id, user_id, ml_item_id, publication_id, attempts, paused_by_velo')
    .eq('status', 'pending')
    .lt('attempts', 8)
    .lte('next_attempt_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(limit)

  const tokensPorUsuario = new Map<string, string | null>()
  let corrigidos = 0
  let jaOk = 0
  let falhas = 0
  let reativados = 0

  for (const item of fila ?? []) {
    let accessToken = tokensPorUsuario.get(item.user_id) ?? null
    if (!tokensPorUsuario.has(item.user_id)) {
      const res = await getSellerAccessToken(supabase, item.user_id)
      accessToken = res.ok ? res.accessToken : null
      tokensPorUsuario.set(item.user_id, accessToken)
    }

    if (!accessToken) {
      falhas++
      const tentativasSemToken = item.attempts + 1
      await supabase.from('ml_dimension_fixes').update({
        status: tentativasSemToken >= 8 ? 'failed' : 'pending',
        attempts: tentativasSemToken,
        next_attempt_at: proximaTentativa(tentativasSemToken),
        error: 'vendedor sem conta do Mercado Livre conectada',
        processed_at: new Date().toISOString(),
      }).eq('id', item.id)
      if (item.publication_id) {
        await supabase.from('user_publications').update({
          dimensions_ok: false,
          dimensions_checked_at: new Date().toISOString(),
        }).eq('id', item.publication_id)
      }
      continue
    }

    // Peso/medidas a partir do produto de origem (mesma regra da publicação).
    let pesoKg: number | null = null
    let categoria: string | null = null
    if (item.publication_id) {
      const { data: pub } = await supabase
        .from('user_publications')
        .select('catalog_product_id')
        .eq('id', item.publication_id)
        .maybeSingle()
      const externalId = pub?.catalog_product_id
      if (externalId) {
        const { data: prod } = await supabase
          .from('catalog_products')
          .select('weight, category')
          .eq('external_id', externalId)
          .maybeSingle()
        pesoKg = typeof prod?.weight === 'number' ? prod.weight : null
        categoria = (prod?.category as string | null) ?? null
      }
    }
    const pacote = montarPesoMedidas(pesoKg, categoria)

    try {
      const r = await garantirMedidasNoAnuncio(accessToken, item.ml_item_id, pacote)
      if (r.ok) {
        if (r.jaEstavaOk) jaOk++
        else corrigidos++
      } else {
        falhas++
      }

      // Se fomos nos que pausamos o anuncio durante a publicacao, reativamos
      // assim que as medidas entram - o usuario nao precisa fazer nada.
      let reativado = false
      if (r.ok && item.paused_by_velo) {
        reativado = await reativarAnuncio(accessToken, item.ml_item_id)
        if (reativado) reativados++
      }

      const tentativas = item.attempts + 1
      await supabase.from('ml_dimension_fixes').update({
        status: r.ok
          ? (r.jaEstavaOk ? 'already_ok' : 'fixed')
          : (tentativas >= 8 ? 'failed' : 'pending'),
        attempts: tentativas,
        next_attempt_at: proximaTentativa(tentativas),
        paused_by_velo: item.paused_by_velo && !reativado,
        reactivated_at: reativado ? new Date().toISOString() : null,
        before_dimensions: r.antes,
        after_dimensions: r.depois,
        weight_g: pacote.weightGrams,
        error: r.erro ?? null,
        processed_at: new Date().toISOString(),
      }).eq('id', item.id)

      if (item.publication_id) {
        await supabase.from('user_publications').update({
          package_weight_g: pacote.weightGrams,
          package_dimensions: r.ok ? pacote.shippingDimensions : null,
          dimensions_ok: r.ok,
          dimensions_checked_at: new Date().toISOString(),
          ...(reativado ? { status: 'active' } : {}),
        }).eq('id', item.publication_id)
      }
    } catch (err) {
      falhas++
      const tentativas = item.attempts + 1
      await supabase.from('ml_dimension_fixes').update({
        status: tentativas >= 8 ? 'failed' : 'pending',
        attempts: tentativas,
        next_attempt_at: proximaTentativa(tentativas),
        error: err instanceof Error ? err.message : 'erro desconhecido',
        processed_at: new Date().toISOString(),
      }).eq('id', item.id)
      if (tentativas >= 8 && item.publication_id) {
        await supabase.from('user_publications').update({
          dimensions_ok: false,
          dimensions_checked_at: new Date().toISOString(),
        }).eq('id', item.publication_id)
      }
    }
  }

  const { count: restantes } = await supabase
    .from('ml_dimension_fixes')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .lt('attempts', 8)

  return json({
    processados: (fila ?? []).length,
    corrigidos,
    reativados,
    ja_estavam_ok: jaOk,
    falhas,
    restantes: restantes ?? 0,
  })
})
