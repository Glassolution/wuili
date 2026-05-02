import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Map niches to ML category IDs
const nichoCategories: Record<string, string> = {
  eletronicos: 'MLB1648',
  moda: 'MLB1430',
  beleza: 'MLB1246',
  casa: 'MLB1574',
  esporte: 'MLB1276',
  brinquedos: 'MLB1132',
  joias: 'MLB3937',
  pet: 'MLB1071',
  bebes: 'MLB1384',
  ferramentas: 'MLB1500',
  automotivo: 'MLB1743',
  celular: 'MLB1055',
  informatica: 'MLB1648',
  relogios: 'MLB3937',
  games: 'MLB1144',
}

async function getAppToken(): Promise<string | null> {
  const clientId = Deno.env.get('ML_CLIENT_ID')
  const clientSecret = Deno.env.get('ML_CLIENT_SECRET')
  if (!clientId || !clientSecret) return null

  try {
    const res = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.access_token
  } catch {
    return null
  }
}

async function searchML(query: string, categoryId: string | undefined, token: string | null): Promise<any> {
  // Try multiple approaches
  const approaches = []

  // 1. Search with token + category
  if (token && categoryId) {
    approaches.push(
      `https://api.mercadolibre.com/sites/MLB/search?category=${categoryId}&limit=12&sort=sold_quantity_desc`
    )
  }
  // 2. Search with token + query
  if (token) {
    approaches.push(
      `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(query)}&limit=12`
    )
  }
  // 3. Highlights by category (public, no auth needed)
  if (categoryId) {
    approaches.push(
      `https://api.mercadolibre.com/highlights/MLB/category/${categoryId}`
    )
  }
  // 4. Trends (public)
  approaches.push(`https://api.mercadolibre.com/trends/MLB`)

  for (const url of approaches) {
    try {
      const headers: Record<string, string> = {}
      if (token && !url.includes('/trends/') && !url.includes('/highlights/')) {
        headers['Authorization'] = `Bearer ${token}`
      }

      console.log('Trying:', url)
      const res = await fetch(url, { headers })
      console.log('Status:', res.status)

      if (res.ok) {
        const data = await res.json()
        // Different response formats
        if (data.results) return { results: data.results, source: 'search' }
        if (data.content) return { results: data.content, source: 'highlights' }
        if (Array.isArray(data)) return { results: data, source: 'trends' }
      }
    } catch (e) {
      console.error('Approach failed:', url, e)
    }
  }

  return null
}

async function getItemDetails(itemIds: string[]): Promise<any[]> {
  if (itemIds.length === 0) return []
  const ids = itemIds.slice(0, 8).join(',')
  try {
    const res = await fetch(`https://api.mercadolibre.com/items?ids=${ids}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.map((d: any) => d.body).filter(Boolean)
  } catch {
    return []
  }
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

    const categoryId = nichoCategories[nicho.toLowerCase()] || nichoCategories[
      Object.keys(nichoCategories).find(k => nicho.toLowerCase().includes(k)) || ''
    ]

    const token = await getAppToken()
    console.log('Token obtained:', !!token, 'Category:', categoryId)

    const result = await searchML(nicho, categoryId, token)

    if (!result || result.results.length === 0) {
      return new Response(
        JSON.stringify({ products: [], total: 0, message: 'Nenhum produto encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let items = result.results
    console.log(`Source: ${result.source}, items: ${items.length}`)

    // If trends/highlights, we get IDs — fetch full details
    if (result.source === 'trends') {
      // Trends return keyword objects, not items. Use category search fallback
      return new Response(
        JSON.stringify({ products: [], total: 0, message: 'Use um nicho específico: eletrônicos, moda, beleza, casa' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (result.source === 'highlights' && items[0]?.id && !items[0]?.price) {
      const ids = items.map((i: any) => i.id)
      items = await getItemDetails(ids)
    }

    const products = items.slice(0, 8).map((item: any) => {
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
      JSON.stringify({ products, total: products.length }),
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