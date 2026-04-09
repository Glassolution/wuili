import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Busca o token do usuário
    const { data: integration, error } = await supabase
      .from('user_integrations')
      .select('access_token, expires_at, refresh_token')
      .eq('user_id', user_id)
      .eq('platform', 'mercadolivre')
      .single()

    if (error || !integration) {
      return new Response(
        JSON.stringify({ error: 'Mercado Livre não conectado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let accessToken = integration.access_token

    // Renova token se expirado
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
      accessToken = refreshData.access_token

      await supabase.from('user_integrations').update({
        access_token: refreshData.access_token,
        refresh_token: refreshData.refresh_token,
        expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('user_id', user_id).eq('platform', 'mercadolivre')
    }

    // Publica o anúncio no ML
    const mlRes = await fetch('https://api.mercadolibre.com/items', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: product.title,
        category_id: product.category_id || 'MLB1648',
        price: product.price,
        currency_id: 'BRL',
        available_quantity: product.available_quantity || 10,
        buying_mode: 'buy_it_now',
        condition: product.condition || 'new',
        listing_type_id: 'gold_special',
        description: { plain_text: product.description },
        pictures: product.images?.map((url: string) => ({ source: url })) || [],
      }),
    })

    const mlData = await mlRes.json()

    if (!mlRes.ok) {
      return new Response(
        JSON.stringify({ error: 'Erro ao publicar no ML', details: mlData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, permalink: mlData.permalink, item_id: mlData.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
