import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const searchUrl =
      `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(nicho)}&limit=12`

    console.log('ML public search:', searchUrl)

    const mlRes = await fetch(searchUrl)

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

    const products = rawResults.slice(0, 5).map((item: any) => {
      const precoCusto = Number(item.price ?? 0)
      const precoVenda = parseFloat((precoCusto * 1.6).toFixed(2))
      const margem     = precoVenda > 0
        ? Math.round(((precoVenda - precoCusto) / precoVenda) * 100)
        : 38

      return {
        nome:      String(item.title ?? 'Produto').slice(0, 60),
        // I.jpg → O.jpg sobe de thumbnail para imagem maior no CDN do ML
        imagem:    (item.thumbnail ?? '')
          .replace('http://', 'https://')
          .replace('I.jpg', 'O.jpg'),
        url:       item.permalink ?? '',
        condicao:  item.condition === 'new' ? 'Novo' : 'Usado',
        vendedor:  item.seller?.nickname ?? '',
        precoCusto,
        precoVenda,
        margem:    `${margem}%+`,
        vendas:    item.sold_quantity ? String(item.sold_quantity) : '—',
        score:     'Alta',
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
