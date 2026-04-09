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
    const { nicho, user_id } = await req.json()

    if (!nicho) {
      return new Response(
        JSON.stringify({ error: 'Nicho é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Busca o token ML do usuário
    let accessToken: string | null = null

    if (user_id) {
      const { data: integration } = await supabase
        .from('user_integrations')
        .select('access_token, expires_at, refresh_token')
        .eq('user_id', user_id)
        .eq('platform', 'mercadolivre')
        .single()

      if (integration?.access_token) {
        // Renova token se expirado
        const expiresAt = new Date(integration.expires_at)
        if (expiresAt <= new Date() && integration.refresh_token) {
          try {
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

            if (accessToken) {
              await supabase.from('user_integrations').update({
                access_token: refreshData.access_token,
                refresh_token: refreshData.refresh_token,
                expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
                updated_at: new Date().toISOString(),
              }).eq('user_id', user_id).eq('platform', 'mercadolivre')
            }
          } catch (e) {
            console.error('Token refresh failed:', e)
          }
        } else {
          accessToken = integration.access_token
        }
      }
    }

    // Se não tem token do usuário, tenta client_credentials (app token)
    if (!accessToken) {
      const clientId     = Deno.env.get('ML_CLIENT_ID')
      const clientSecret = Deno.env.get('ML_CLIENT_SECRET')

      if (clientId && clientSecret) {
        try {
          const tokenRes = await fetch('https://api.mercadolibre.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'client_credentials',
              client_id: clientId,
              client_secret: clientSecret,
            }),
          })
          const tokenData = await tokenRes.json()
          accessToken = tokenData.access_token ?? null
        } catch (e) {
          console.error('Client credentials failed:', e)
        }
      }
    }

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Mercado Livre não conectado. Conecte sua conta em Integrações.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Chama a API de busca do ML com o token
    const searchUrl = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(nicho)}&limit=5`
    console.log('Searching ML:', searchUrl)

    const mlRes = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    })

    console.log('ML search status:', mlRes.status)

    if (!mlRes.ok) {
      const errBody = await mlRes.text()
      console.error('ML search error:', errBody)
      return new Response(
        JSON.stringify({ error: `Erro na busca ML: ${mlRes.status}`, details: errBody }),
        { status: mlRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await mlRes.json()
    const rawResults: any[] = data.results ?? []

    console.log(`ML returned ${rawResults.length} results for "${nicho}"`)

    const products = rawResults.slice(0, 5).map((item: any) => {
      const precoCusto = Number(item.price ?? 0)
      const precoVenda = parseFloat((precoCusto * 1.6).toFixed(2))
      const margem     = precoVenda > 0 ? Math.round(((precoVenda - precoCusto) / precoVenda) * 100) : 38
      return {
        nome:       String(item.title ?? 'Produto').slice(0, 60),
        imagem:     (item.thumbnail ?? '').replace('http://', 'https://'),
        url:        item.permalink ?? '',
        precoCusto,
        precoVenda,
        margem:     `${margem}%+`,
        vendas:     item.sold_quantity ? String(item.sold_quantity) : '—',
        score:      'Alta',
      }
    })

    return new Response(
      JSON.stringify({ products, total: data.paging?.total ?? rawResults.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('ml-search error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
