import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Upload image to Supabase Storage and return public URL — with fallback
async function uploadImageToSupabase(
  supabase: any,
  imageUrl: string,
  productId: string,
  index: number
): Promise<string> {
  try {
    console.log(`Uploading image ${index}: ${imageUrl.substring(0, 80)}...`)
    const response = await fetch(imageUrl)
    if (!response.ok) {
      console.warn(`Failed to download image ${index}, status: ${response.status}`)
      return imageUrl // fallback to original
    }
    const arrayBuffer = await response.arrayBuffer()
    const uint8 = new Uint8Array(arrayBuffer)
    const fileName = `products/${productId}/${Date.now()}_${index}.jpg`

    const { error } = await supabase.storage
      .from('product-images')
      .upload(fileName, uint8, { contentType: 'image/jpeg', upsert: true })

    if (error) {
      console.warn(`Storage upload error for image ${index}:`, error.message)
      return imageUrl // fallback to original
    }

    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName)

    console.log(`Image ${index} uploaded: ${publicUrl.substring(0, 80)}`)
    return publicUrl
  } catch (err) {
    console.warn(`Exception uploading image ${index}:`, err)
    return imageUrl // fallback to original
  }
}

// Map ML API errors to user-friendly messages
function mapMLError(mlData: any): string {
  const msg = mlData?.message || ''
  const causeArr = mlData?.cause || []
  const causeStr = JSON.stringify(causeArr)

  if (causeStr.includes('missing_required') || causeStr.includes('attributes'))
    return 'Atributos obrigatórios faltando (marca/modelo). O Mercado Livre exige esses dados para esta categoria.'
  if (msg.includes('title') || causeStr.includes('title.length'))
    return 'Título muito longo. Máximo 60 caracteres.'
  if (msg.includes('category') || causeStr.includes('category'))
    return 'Categoria não encontrada. Tente outro título para melhor detecção.'
  if (msg.includes('picture') || causeStr.includes('download_error'))
    return 'Erro ao processar imagens. Tente novamente.'
  if (msg.includes('token') || msg.includes('unauthorized') || mlData?.status === 401)
    return 'Sessão do Mercado Livre expirada. Reconecte sua conta em Integrações.'
  if (msg.includes('price'))
    return 'Preço inválido. Verifique o valor de venda.'
  if (causeStr.includes('shipping'))
    return 'Configuração de envio necessária no Mercado Livre. Verifique suas preferências de frete.'

  return `Erro do Mercado Livre: ${msg || JSON.stringify(mlData)}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('=== ml-publish START ===')
    const body = await req.json()
    const { user_id, product } = body
    console.log('user_id:', user_id)
    console.log('product title:', product?.title?.substring(0, 60))
    console.log('product images count:', product?.images?.length || 0)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    console.log('Env vars present:', { SUPABASE_URL: !!supabaseUrl, SERVICE_ROLE_KEY: !!serviceRoleKey })

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Configuração do servidor incompleta.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Get user's ML integration
    console.log('Fetching ML integration...')
    const { data: integration, error } = await supabase
      .from('user_integrations')
      .select('access_token, expires_at, refresh_token')
      .eq('user_id', user_id)
      .eq('platform', 'mercadolivre')
      .single()

    if (error || !integration) {
      console.log('No ML integration found:', error?.message)
      return new Response(
        JSON.stringify({ error: 'Conecte sua conta do Mercado Livre para publicar.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let accessToken = integration.access_token

    // Refresh token if expired
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
        return new Response(
          JSON.stringify({ error: 'Sessão do Mercado Livre expirada. Reconecte sua conta em Integrações.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      accessToken = refreshData.access_token
      await supabase.from('user_integrations').update({
        access_token: refreshData.access_token,
        refresh_token: refreshData.refresh_token,
        expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('user_id', user_id).eq('platform', 'mercadolivre')
    }

    // 1. Truncate title to 60 chars
    const title = product.title.length > 60
      ? product.title.substring(0, 57) + '...'
      : product.title
    console.log('Título final:', title, `(${title.length} chars)`)

    // 2. Auto-detect category
    let categoryId = 'MLB1648'
    try {
      const catRes = await fetch(
        `https://api.mercadolibre.com/sites/MLB/domain_discovery/search?q=${encodeURIComponent(title)}`
      )
      const catData = await catRes.json()
      if (Array.isArray(catData) && catData[0]?.category_id) {
        categoryId = catData[0].category_id
      }
    } catch (_e) { /* fallback */ }
    console.log('Categoria detectada:', categoryId)

    // 3. Proxy images through Supabase Storage (with per-image fallback)
    const rawImages: string[] = product.images || []
    const imagesToUse = rawImages.slice(0, 6)
    const productId = product.id || `pub_${Date.now()}`

    const pictures = await Promise.all(
      imagesToUse.map((url: string, i: number) =>
        uploadImageToSupabase(supabase, url, productId, i).then(src => ({ source: src }))
      )
    )
    console.log('Imagens processadas:', pictures.length)

    // 4. Publish to ML
    const mlPayload: Record<string, unknown> = {
      title,
      category_id: categoryId,
      price: product.price,
      currency_id: 'BRL',
      available_quantity: product.available_quantity || 10,
      buying_mode: 'buy_it_now',
      listing_type_id: 'gold_pro',
      description: { plain_text: product.description || '' },
      pictures,
      attributes: [
        { id: 'BRAND', value_name: 'Genérico' },
        { id: 'SELLER_SKU', value_name: product.external_id || 'SKU-001' },
      ],
    }
    console.log('Sending to ML API...')

    const mlRes = await fetch('https://api.mercadolibre.com/items', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mlPayload),
    })

    const mlData = await mlRes.json()

    if (!mlRes.ok) {
      console.error('ML Error completo:', JSON.stringify(mlData))
      const friendlyError = mapMLError(mlData)
      return new Response(
        JSON.stringify({ error: friendlyError, details: mlData }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('=== ml-publish SUCCESS ===', mlData.id)
    return new Response(
      JSON.stringify({ success: true, permalink: mlData.permalink, item_id: mlData.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('ml-publish error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
