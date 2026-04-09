import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

let cachedToken: { token: string; expiresAt: number } | null = null

async function getAppToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token
  }

  const clientId = Deno.env.get('ML_CLIENT_ID')
  const clientSecret = Deno.env.get('ML_CLIENT_SECRET')

  if (!clientId || !clientSecret) {
    throw new Error('ML_CLIENT_ID ou ML_CLIENT_SECRET não configurados')
  }

  const res = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('Token error:', res.status, errText)
    throw new Error(`Erro ao obter token ML: ${res.status}`)
  }

  const data = await res.json()
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  }
  return cachedToken.token
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { nicho } = await req.json()

    if (!nicho) {
      return new Response(
        JSON.stringify({ error: 'Nicho é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = await getAppToken()
    const searchUrl =
      `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(nicho)}&limit=12`

    console.log('ML search:', searchUrl)

    const mlRes = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    console.log('ML status:', mlRes.status)

    if (!mlRes.ok) {
      const errBody = await mlRes.text()
      console.error('ML search error:', mlRes.status, errBody)
      return new Response(
        JSON.stringify({ error: `Erro na busca ML: ${mlRes.status}`, details: errBody }),
        { status: mlRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await mlRes.json()
    const rawResults: any[] = data.results ?? []

    console.log(`ML returned ${rawResults.length} results for "${nicho}"`)

    const products = rawResults.slice(0, 8).map((item: any) => {
      const precoCusto = Number(item.price ?? 0)
      const precoVenda = parseFloat((precoCusto * 1.6).toFixed(2))
      const margem = precoVenda > 0
        ? Math.round(((precoVenda - precoCusto) / precoVenda) * 100)
        : 38

      return {
        product_id: String(item.id ?? ''),
        nome: String(item.title ?? 'Produto').slice(0, 60),
        imagem: (item.thumbnail ?? '')
          .replace('http://', 'https://')
          .replace('I.jpg', 'O.jpg'),
        link: item.permalink ?? '',
        condicao: item.condition === 'new' ? 'Novo' : 'Usado',
        vendedor: item.seller?.nickname ?? '',
        preco_custo: `R$ ${precoCusto.toFixed(2)}`,
        preco_venda: `R$ ${precoVenda.toFixed(2)}`,
        margem: `${margem}%+`,
        vendas: item.sold_quantity ? String(item.sold_quantity) : '—',
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