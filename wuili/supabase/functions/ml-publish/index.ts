import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Resolve to a leaf category by walking children_categories until empty
async function resolveLeafCategory(categoryId: string): Promise<string> {
  let current = categoryId
  for (let depth = 0; depth < 8; depth++) {
    const res = await fetch(`https://api.mercadolibre.com/categories/${current}`)
    if (!res.ok) break
    const cat = await res.json()
    if (!cat.children_categories || cat.children_categories.length === 0) {
      return current // it's a leaf
    }
    current = cat.children_categories[0].id // pick first child
  }
  return current
}

// Predict category from title, ensuring it's a leaf
async function predictCategory(title: string): Promise<string> {
  const fallback = 'MLB1051' // Generic "Outros" leaf category

  try {
    // Try category predictor first (returns leaf categories)
    const predRes = await fetch(
      `https://api.mercadolibre.com/sites/MLB/category_predictor/predict?title=${encodeURIComponent(title)}`
    )
    if (predRes.ok) {
      const predData = await predRes.json()
      if (predData?.id) {
        console.log('Category predictor returned:', predData.id, predData.name)
        return predData.id
      }
    }
  } catch (_e) { /* ignore */ }

  try {
    // Fallback: domain_discovery + resolve to leaf
    const catRes = await fetch(
      `https://api.mercadolibre.com/sites/MLB/domain_discovery/search?q=${encodeURIComponent(title)}`
    )
    if (catRes.ok) {
      const catData = await catRes.json()
      if (Array.isArray(catData) && catData[0]?.category_id) {
        const leafId = await resolveLeafCategory(catData[0].category_id)
        console.log('domain_discovery resolved to leaf:', leafId)
        return leafId
      }
    }
  } catch (_e) { /* ignore */ }

  console.log('Using fallback category:', fallback)
  return fallback
}

// Map ML API errors to user-friendly messages
function mapMLError(mlData: Record<string, unknown>): string {
  const msg = (mlData?.message as string) || ''
  const causeArr = (mlData?.cause as unknown[]) || []
  const causeStr = JSON.stringify(causeArr)

  if (causeStr.includes('category_id')) return 'Categoria inválida. Tente editar o título para melhor detecção automática.'
  if (causeStr.includes('missing_required') || causeStr.includes('attributes'))
    return 'Atributos obrigatórios faltando (marca/modelo). O Mercado Livre exige esses dados para esta categoria.'
  if (msg.includes('title') || causeStr.includes('title.length'))
    return 'Título muito longo. Máximo 60 caracteres.'
  if (msg.includes('picture') || causeStr.includes('download_error'))
    return 'Erro ao processar imagens. Verifique se as imagens são válidas.'
  if (msg.includes('token') || msg.includes('unauthorized') || mlData?.status === 401)
    return 'Sessão do Mercado Livre expirada. Reconecte sua conta em Integrações.'
  if (msg.includes('price'))
    return 'Preço inválido. Verifique o valor de venda.'
  if (causeStr.includes('shipping'))
    return 'Configuração de envio necessária no Mercado Livre. Verifique suas preferências de frete na sua conta ML.'

  return `Erro do Mercado Livre: ${msg || JSON.stringify(mlData)}`
}

// Validate that image URL is a public HTTP(S) URL
function isPublicUrl(url: string): boolean {
  return typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('=== ml-publish START ===')
    const body = await req.json()
    const { user_id, product } = body

    // === VALIDATION ===
    if (!user_id) return json({ error: 'user_id é obrigatório.' }, 400)
    if (!product) return json({ error: 'Dados do produto ausentes.' }, 400)
    if (!product.title?.trim()) return json({ error: 'Título do produto é obrigatório.' }, 400)
    if (!product.price || product.price <= 0) return json({ error: 'Preço do produto é obrigatório e deve ser maior que zero.' }, 400)

    // Validate images - must be public URLs
    const rawImages: string[] = (() => {
      try {
        const arr = typeof product.images === 'string' ? JSON.parse(product.images) : product.images
        return Array.isArray(arr) ? arr : []
      } catch { return [] }
    })()

    const publicImages = rawImages.filter(isPublicUrl).slice(0, 6)
    if (publicImages.length === 0) {
      return json({ error: 'Pelo menos uma imagem pública é necessária. Imagens locais não são aceitas pelo Mercado Livre.' }, 400)
    }

    console.log('user_id:', user_id)
    console.log('title:', product.title.substring(0, 60))
    console.log('price:', product.price)
    console.log('images (public):', publicImages.length)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: 'Configuração do servidor incompleta.' }, 500)
    }

    // Hybrid deployment: DB may live on a different project than the functions
    const dbUrl = Deno.env.get('DB_URL') ?? supabaseUrl
    const dbKey = Deno.env.get('DB_SERVICE_ROLE_KEY') ?? serviceRoleKey
    const supabase = createClient(dbUrl, dbKey)

    // === GET ML INTEGRATION ===
    const { data: integration, error } = await supabase
      .from('user_integrations')
      .select('access_token, expires_at, refresh_token')
      .eq('user_id', user_id)
      .eq('platform', 'mercadolivre')
      .single()

    if (error || !integration?.access_token) {
      return json({ error: 'Conecte sua conta do Mercado Livre para publicar.' }, 400)
    }

    let accessToken = integration.access_token

    // === REFRESH TOKEN IF EXPIRED ===
    const expiresAt = new Date(integration.expires_at)
    if (expiresAt <= new Date()) {
      console.log('Token expired, refreshing...')
      const refreshRes = await fetch('https://api.mercadolibre.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: Deno.env.get('ML_CLIENT_ID')!,
          client_secret: Deno.env.get('ML_CLIENT_SECRET')!,
          refresh_token: integration.refresh_token,
        }),
      })
      const refreshData = await refreshRes.json()

      if (!refreshRes.ok || !refreshData.access_token) {
        console.error('Token refresh failed:', JSON.stringify(refreshData))
        return json({ error: 'Sessão do Mercado Livre expirada. Reconecte sua conta em Integrações.' }, 401)
      }

      accessToken = refreshData.access_token
      await supabase.from('user_integrations').update({
        access_token: refreshData.access_token,
        refresh_token: refreshData.refresh_token,
        expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('user_id', user_id).eq('platform', 'mercadolivre')
    }

    // === TITLE (max 60 chars) ===
    const title = product.title.length > 60
      ? product.title.substring(0, 57) + '...'
      : product.title
    console.log('Título final:', title, `(${title.length} chars)`)

    // === CATEGORY (leaf only) ===
    const categoryId = await predictCategory(title)
    console.log('Categoria final (leaf):', categoryId)

    // === ATTRIBUTES ===
    let categoryAttrs: Record<string, unknown>[] = []
    try {
      const attrRes = await fetch(`https://api.mercadolibre.com/categories/${categoryId}/attributes`)
      if (attrRes.ok) categoryAttrs = await attrRes.json()
    } catch (_e) { /* ignore */ }

    const baseAttrs = [
      { id: 'BRAND', value_name: 'Genérico' },
      { id: 'MODEL', value_name: 'Genérico' },
      { id: 'SELLER_SKU', value_name: product.external_id || 'SKU-001' },
    ]

    const requiredAttrs = categoryAttrs
      .filter((a: Record<string, unknown>) => (a.tags as Record<string, unknown>)?.required)
      .map((a: Record<string, unknown>) => ({
        id: a.id as string,
        value_name: ((a.values as Record<string, unknown>[])?.[0]?.name as string) || 'Genérico',
      }))

    const allAttrs = [...baseAttrs]
    for (const req of requiredAttrs) {
      if (!allAttrs.find(a => a.id === req.id)) allAttrs.push(req)
    }
    console.log('Atributos:', allAttrs.map(a => a.id))

    // === PICTURES (use source URLs directly — CJ URLs are public) ===
    const pictures = publicImages.map(url => ({ source: url }))
    console.log('Imagens para ML:', pictures.length)

    // === BUILD PAYLOAD ===
    const mlPayload = {
      title,
      category_id: categoryId,
      price: product.price,
      currency_id: 'BRL',
      available_quantity: product.available_quantity || 10,
      buying_mode: 'buy_it_now',
      condition: 'new',
      listing_type_id: 'gold_special',
      pictures,
      attributes: allAttrs,
    }

    console.log('Payload:', JSON.stringify(mlPayload).substring(0, 800))

    // === PUBLISH ===
    const itemResponse = await fetch('https://api.mercadolibre.com/items', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mlPayload),
    })

    const itemData = await itemResponse.json()
    console.log('Item criado:', JSON.stringify(itemData).substring(0, 800))

    if (!itemResponse.ok || !itemData?.id) {
      console.error('Erro ao criar produto:', JSON.stringify(itemData))
      const friendlyError = itemResponse.ok
        ? 'Falha ao criar produto no Mercado Livre.'
        : mapMLError(itemData)
      return json({ error: friendlyError, details: itemData }, 400)
    }

    const itemId = itemData.id as string
    console.log('Item ID:', itemId)

    // === DESCRIPTION (send only after item creation succeeds) ===
    const descriptionText = typeof product.description === 'string'
      ? product.description.trim()
      : ''
    console.log('Descrição:', descriptionText)

    if (descriptionText.length > 20) {
      try {
        const descResponse = await fetch(`https://api.mercadolibre.com/items/${itemId}/description`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ plain_text: descriptionText }),
        })

        const descData = await descResponse.json()

        if (!descResponse.ok) {
          console.error('Erro ao enviar descrição:', JSON.stringify(descData))
        } else {
          console.log('Descrição enviada com sucesso para:', itemId)
        }
      } catch (descErr) {
        console.error('Erro ao enviar descrição:', descErr)
      }
    } else {
      console.log('Descrição não enviada: texto vazio ou com menos de 20 caracteres')
    }

    // === SAVE PUBLICATION ===
    // cj_product_id and cj_variant_id come from the ImportProductModal payload
    // so the ml-orders-webhook can map ML item → CJ variant without an extra lookup
    try {
      await supabase.from('user_publications').insert({
        user_id,
        ml_item_id:     itemId,
        title,
        thumbnail:      publicImages[0] || null,
        price:          product.price,
        cost_price:     product.cost_price || null,
        status:         'active',
        permalink:      itemData.permalink,
        published_at:   new Date().toISOString(),
        // CJ product/variant IDs passed from frontend when importing the product
        cj_product_id:  product.cj_product_id  ?? null,
        cj_variant_id:  product.cj_variant_id  ?? null,
      })
    } catch (pubErr) {
      console.error('Erro ao salvar publicação:', pubErr)
    }

    console.log('=== ml-publish SUCCESS ===', itemId)
    return json({ success: true, permalink: itemData.permalink, item_id: itemId })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('ml-publish error:', message)
    return json({ error: message }, 500)
  }
})
