import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Upload image to Supabase Storage and return public URL
async function uploadImageToSupabase(
  supabase: any,
  imageUrl: string,
  productId: string,
  index: number
): Promise<string> {
  const response = await fetch(imageUrl)
  if (!response.ok) throw new Error(`Failed to download image ${index}`)
  const arrayBuffer = await response.arrayBuffer()
  const uint8 = new Uint8Array(arrayBuffer)
  const fileName = `products/${productId}/${Date.now()}_${index}.jpg`

  const { error } = await supabase.storage
    .from('product-images')
    .upload(fileName, uint8, { contentType: 'image/jpeg', upsert: true })

  if (error) throw error

  const { data: { publicUrl } } = supabase.storage
    .from('product-images')
    .getPublicUrl(fileName)

  return publicUrl
}

// Map ML API errors to user-friendly messages
function mapMLError(mlData: any): string {
  const msg = mlData?.message || ''
  const cause = JSON.stringify(mlData?.cause || mlData?.error || '')

  if (msg.includes('title') || cause.includes('title.length'))
    return 'Título muito longo. Máximo 60 caracteres.'
  if (msg.includes('category') || cause.includes('category'))
    return 'Categoria não encontrada. Tente outro título para melhor detecção.'
  if (msg.includes('picture') || cause.includes('download_error') || cause.includes('picture'))
    return 'Erro ao processar imagens. Tente novamente.'
  if (msg.includes('token') || msg.includes('unauthorized') || mlData?.status === 401)
    return 'Sessão do Mercado Livre expirada. Reconecte sua conta em Integrações.'
  if (msg.includes('price'))
    return 'Preço inválido. Verifique o valor de venda.'

  return `Erro do Mercado Livre: ${msg || JSON.stringify(mlData)}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user_id, product } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get user's ML integration
    const { data: integration, error } = await supabase
      .from('user_integrations')
      .select('access_token, expires_at, refresh_token')
      .eq('user_id', user_id)
      .eq('platform', 'mercadolivre')
      .single()

    if (error || !integration) {
      return new Response(
        JSON.stringify({ error: 'Conecte sua conta do Mercado Livre para publicar.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let accessToken = integration.access_token

    // Refresh token if expired
    const expiresAt = new Date(integration.expires_at)
    if (expiresAt <= new Date()) {
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

    // 3. Proxy images through Supabase Storage
    const rawImages: string[] = product.images || []
    const imagesToUse = rawImages.slice(0, 6)
    let pictures: { source: string }[] = []

    if (imagesToUse.length > 0) {
      const productId = product.id || `pub_${Date.now()}`
      try {
        const uploadedUrls = await Promise.all(
          imagesToUse.map((url: string, i: number) =>
            uploadImageToSupabase(supabase, url, productId, i)
          )
        )
        pictures = uploadedUrls.map(url => ({ source: url }))
        console.log('Imagens proxy:', pictures.length)
      } catch (imgErr) {
        console.error('Erro ao fazer proxy das imagens:', imgErr)
        return new Response(
          JSON.stringify({ error: 'Erro ao processar imagens. Tente novamente.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // 4. Publish to ML
    const mlRes = await fetch('https://api.mercadolibre.com/items', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        category_id: categoryId,
        price: product.price,
        currency_id: 'BRL',
        available_quantity: product.available_quantity || 10,
        buying_mode: 'buy_it_now',
        condition: product.condition || 'new',
        listing_type_id: 'gold_special',
        description: { plain_text: product.description || '' },
        pictures,
      }),
    })

    const mlData = await mlRes.json()

    if (!mlRes.ok) {
      const friendlyError = mapMLError(mlData)
      console.error('Erro ML API:', JSON.stringify(mlData))
      return new Response(
        JSON.stringify({ error: friendlyError, details: mlData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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
