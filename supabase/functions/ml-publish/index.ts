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

type PlanName = 'gratis' | 'go' | 'base' | 'pro' | 'business'
type MLAttribute = {
  id: string
  value_id?: string
  value_name?: string
}

type SellerStatusBlock = {
  message: string
  details: Record<string, unknown>
}

// Limites de produtos publicados por plano, alinhados ao que é vendido no
// checkout/landing: base = 50, pro = 200, business = ilimitado. 'go' é um plano
// legado (não vendido mais) — tratado como base para não bloquear quem o tenha.
const PRODUCT_LIMITS: Record<PlanName, number | null> = {
  gratis: 0,
  go: 50,
  base: 50,
  pro: 200,
  business: null,
}

function normalizePlanName(plan: unknown): PlanName {
  const value = String(plan ?? 'gratis').toLowerCase()
  if (value === 'free') return 'gratis'
  if (value === 'plus') return 'pro'
  if (value === 'go' || value === 'base' || value === 'pro' || value === 'business') return value
  return 'gratis'
}

function cleanText(value: unknown): string {
  return String(value ?? '').trim()
}

function normalizeText(value: unknown): string {
  return cleanText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function arrayFromUnknown(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function collectSellerStatusCodes(...values: unknown[]): string[] {
  const codes = new Set<string>()

  const visit = (value: unknown) => {
    if (!value) return
    if (typeof value === 'string' || typeof value === 'number') {
      const code = cleanText(value)
      if (code) codes.add(code)
      return
    }
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>
      for (const key of ['code', 'cause_id', 'cause', 'reason', 'type', 'department']) {
        const code = cleanText(obj[key])
        if (code) codes.add(code)
      }
      for (const key of ['codes', 'reasons', 'causes']) visit(obj[key])
    }
  }

  values.forEach(visit)
  return Array.from(codes)
}

function describeSellerStatusCodes(codes: string[]): string {
  if (codes.length === 0) return 'bloqueio não especificado pelo Mercado Livre'

  const normalized = codes.map((code) => normalizeText(code))
  const reasons: string[] = []

  const addReason = (condition: boolean, reason: string) => {
    if (condition && !reasons.includes(reason)) reasons.push(reason)
  }

  addReason(
    normalized.some((code) => code.includes('regulation') || code.includes('regul') || code.includes('kyc')),
    'cadastro regulatório/documentos pendentes no Mercado Livre',
  )
  addReason(
    normalized.some((code) => code.includes('identity') || code.includes('identification') || code.includes('identidade')),
    'validação de identidade pendente',
  )
  addReason(
    normalized.some((code) => code.includes('address') || code.includes('endereco')),
    'endereço de venda pendente ou incompleto',
  )
  addReason(
    normalized.some((code) => code.includes('phone') || code.includes('telefone')),
    'telefone pendente de confirmação',
  )
  addReason(
    normalized.some((code) => code.includes('billing') || code.includes('fiscal') || code.includes('tax')),
    'dados fiscais/de faturamento pendentes',
  )
  addReason(
    normalized.some((code) => code.includes('payment') || code.includes('mercadopago')),
    'configuração do Mercado Pago/pagamento pendente',
  )
  addReason(
    normalized.some((code) => code.includes('suspend') || code.includes('disabled') || code.includes('blocked')),
    'restrição ou bloqueio ativo na conta',
  )

  return reasons.length > 0 ? reasons.join(', ') : codes.join(', ')
}

function buildSellerBlockedMessage(codes: string[]): string {
  const reason = describeSellerStatusCodes(codes)
  const codeText = codes.length > 0 ? ` Códigos do Mercado Livre: ${codes.join(', ')}.` : ''
  return `O Mercado Livre bloqueou a criação do anúncio para esta conta: ${reason}.${codeText} Faça uma publicação manual de teste dentro do Mercado Livre com esta mesma conta para ver o aviso oficial e, depois de resolver, reconecte a integração na Velo.`
}

async function validateSellerCanList(accessToken: string): Promise<SellerStatusBlock | null> {
  try {
    const res = await fetch('https://api.mercadolibre.com/users/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>

    if (!res.ok) {
      console.warn('[ml-publish] Não foi possível validar status do vendedor:', JSON.stringify(data).substring(0, 600))
      return null
    }

    const status = (data.status as Record<string, unknown> | undefined) ?? {}
    const list = (status.list as Record<string, unknown> | undefined) ?? {}
    const sell = (status.sell as Record<string, unknown> | undefined) ?? {}
    const shoppingCart = (status.shopping_cart as Record<string, unknown> | undefined) ?? {}
    const listAllow = list.allow
    const sellAllow = sell.allow
    const shoppingCartSell = shoppingCart.sell

    if (listAllow === false || sellAllow === false || shoppingCartSell === 'not_allowed') {
      const codes = collectSellerStatusCodes(
        list.codes,
        list.immediate_payment,
        sell.codes,
        sell.immediate_payment,
        status.required_action,
        status.site_status,
      )
      return {
        message: buildSellerBlockedMessage(codes),
        details: {
          ml_user_id: data.id,
          status: {
            list,
            sell,
            required_action: status.required_action,
            site_status: status.site_status,
            confirmed_email: status.confirmed_email,
            mercadoenvios: status.mercadoenvios,
          },
        },
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[ml-publish] Validação de vendedor indisponível:', message)
  }

  return null
}

// NOTE: heurísticas antigas de "sticker/album/fifa" foram removidas de propósito.
// Elas sobrescreviam a marca/álbum digitados pelo usuário (ex.: Panini virava
// "Genérico", ALBUM_NAME caía no primeiro valor da lista do ML — "Dragon Ball
// Super" — para produtos de Copa do Mundo). Hoje TODO valor de BRAND, MODEL,
// ALBUM_NAME e SALE_FORMAT vem do frontend (ImportProductModal), via
// product.brand / product.model / product.ml_attributes.


function mergeAttribute(attributes: MLAttribute[], incoming: MLAttribute) {
  const attr = {
    id: cleanText(incoming.id),
    ...(cleanText(incoming.value_id) ? { value_id: cleanText(incoming.value_id) } : {}),
    ...(cleanText(incoming.value_name) ? { value_name: cleanText(incoming.value_name) } : {}),
  }
  if (!attr.id || (!attr.value_id && !attr.value_name)) return

  const index = attributes.findIndex((existing) => existing.id === attr.id)
  if (index >= 0) attributes[index] = attr
  else attributes.push(attr)
}

function parseIncomingAttributes(value: unknown): MLAttribute[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((rawAttr) => {
    if (!rawAttr || typeof rawAttr !== 'object') return []
    const attr = rawAttr as Record<string, unknown>
    const id = cleanText(attr.id)
    const valueId = cleanText(attr.value_id)
    const valueName = cleanText(attr.value_name)

    if (!id || (!valueId && !valueName)) return []
    return [{
      id,
      ...(valueId ? { value_id: valueId } : {}),
      ...(valueName ? { value_name: valueName } : {}),
    }]
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

// Verifica se uma categoria é folha (leaf) e existe no ML
async function isLeafCategory(categoryId: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.mercadolibre.com/categories/${categoryId}`)
    if (!res.ok) return false
    const cat = await res.json()
    const children = Array.isArray(cat?.children_categories) ? cat.children_categories : []
    return children.length === 0
  } catch { return false }
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
        if (await isLeafCategory(predData.id)) return predData.id
        const leaf = await resolveLeafCategory(predData.id)
        if (leaf) return leaf
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
function mapMLError(mlData: Record<string, unknown>): { message: string; code?: string } {
  const msg = (mlData?.message as string) || ''
  const causeArr = arrayFromUnknown(mlData?.cause)
  const causeStr = JSON.stringify(causeArr).toLowerCase()
  const msgLower = msg.toLowerCase()

  // Restrições da conta do vendedor (não é bug nosso — é a conta ML que está bloqueada)
  if (
    msgLower.includes('unable_to_list') ||
    msgLower.includes('seller.unable_to_list') ||
    causeStr.includes('restrictions_') ||
    causeStr.includes('restriction')
  ) {
    const codes = collectSellerStatusCodes(causeArr, mlData.error, mlData.code, mlData.message)
    return { message: buildSellerBlockedMessage(codes), code: 'ML_SELLER_CANNOT_LIST' }
  }

  if (causeStr.includes('category_id') || msgLower.includes('category')) return { message: 'Não conseguimos identificar a categoria automaticamente para este produto. Edite o título para deixá-lo mais descritivo ou selecione a categoria manualmente antes de publicar.', code: 'INVALID_CATEGORY' }
  // Repassa a mensagem/atributo real da API do ML, sem mascarar como
  // "Atributos obrigatórios faltando" (isso dificultava diagnóstico).
  if (causeStr.includes('missing_required') || causeStr.includes('attributes') || causeStr.includes('value')) {
    const messages = causeArr
      .map((cause) => {
        if (!cause || typeof cause !== 'object') return ''
        const c = cause as Record<string, unknown>
        const attr = cleanText(c.attribute_id) || cleanText(c.code)
        const m = cleanText(c.message)
        return attr ? `${attr}: ${m}` : m
      })
      .filter(Boolean)
    const details = messages.length > 0 ? messages.join(' | ') : msg || JSON.stringify(causeArr)
    return { message: `Mercado Livre rejeitou atributos: ${details}` }
  }

  if (msgLower.includes('title') || causeStr.includes('title.length'))
    return { message: 'Título muito longo. Máximo 60 caracteres.' }
  if (msgLower.includes('picture') || causeStr.includes('download_error'))
    return { message: 'Erro ao processar imagens. Verifique se as imagens são válidas.' }
  if (msgLower.includes('token') || msgLower.includes('unauthorized') || mlData?.status === 401)
    return { message: 'Sessão do Mercado Livre expirada. Reconecte sua conta em Integrações.' }
  if (msgLower.includes('price'))
    return { message: 'Preço inválido. Verifique o valor de venda.' }
  if (causeStr.includes('shipping'))
    return { message: 'Configuração de envio necessária no Mercado Livre. Verifique suas preferências de frete na sua conta ML.' }

  return { message: `Erro do Mercado Livre: ${msg || JSON.stringify(mlData)}` }
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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Nao autorizado.' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return json({ error: 'Configuracao do servidor incompleta.' }, 500)
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) {
      return json({ error: 'Token invalido.' }, 401)
    }
    const user_id = userData.user.id
    const body = await req.json()
    const { product } = body

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

    const MIN_REQUIRED_IMAGES = 3
    const publicImages = rawImages.filter(isPublicUrl).slice(0, 6)
    if (publicImages.length < MIN_REQUIRED_IMAGES) {
      return json({
        error: `O Mercado Livre exige no mínimo ${MIN_REQUIRED_IMAGES} fotos para publicar. Este produto tem apenas ${publicImages.length} foto(s) pública(s). Adicione mais imagens antes de publicar (imagens locais não são aceitas).`,
        code: 'INSUFFICIENT_IMAGES',
      }, 400)
    }

    console.log('user_id:', user_id)
    console.log('title:', product.title.substring(0, 60))
    console.log('price:', product.price)
    console.log('images (public):', publicImages.length)

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: 'Configuração do servidor incompleta.' }, 500)
    }

    // Hybrid deployment: DB may live on a different project than the functions
    const dbUrl = Deno.env.get('DB_URL') ?? supabaseUrl
    const dbKey = Deno.env.get('DB_SERVICE_ROLE_KEY') ?? serviceRoleKey
    const supabase = createClient(dbUrl, dbKey)

    // === COOLDOWN ANTI-ABUSO (pós-reembolso) ===
    const { data: profileCd } = await supabase
      .from('profiles')
      .select('refund_cooldown_until, plano')
      .eq('user_id', user_id)
      .maybeSingle()
    if (profileCd?.refund_cooldown_until && new Date(profileCd.refund_cooldown_until) > new Date()) {
      const until = new Date(profileCd.refund_cooldown_until).toLocaleDateString('pt-BR')
      return json({ error: `Você solicitou um reembolso recentemente. Novas publicações estarão liberadas a partir de ${until}.` }, 403)
    }

    // === PLAN LIMITS ===
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', user_id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const userPlan = normalizePlanName(subscription?.plan ?? profileCd?.plano)
    const productLimit = PRODUCT_LIMITS[userPlan]

    if (productLimit === 0) {
      return json({
        error: 'O plano grátis é apenas para teste. Desbloqueie a operação completa para publicar produtos.',
      }, 403)
    }

    if (typeof productLimit === 'number') {
      const activePublicationsQuery = await supabase
        .from('user_publications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user_id)
        .in('status', ['active', 'published'])

      let publishedProducts = activePublicationsQuery.count ?? 0
      if (activePublicationsQuery.error) {
        const fallbackPublicationsQuery = await supabase
          .from('user_publications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user_id)
        publishedProducts = fallbackPublicationsQuery.count ?? 0
      }

      if (publishedProducts >= productLimit) {
        return json({ error: `Você atingiu o limite de ${productLimit} produtos do seu plano. Faça upgrade para publicar mais.` }, 403)
      }
    }

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

    // Antes bloqueávamos aqui com base em /users/me `list.allow=false`, mas o ML
    // marca essa flag mesmo para contas que conseguem publicar via API
    // (address_pending / simple_registration são frequentemente soft-blocks
    // relacionados ao formulário web, não à API). Deixamos o POST /items
    // decidir — se ML rejeitar de verdade, mapMLError devolve o mesmo
    // buildSellerBlockedMessage + code=ML_SELLER_CANNOT_LIST e a UI abre o
    // tutorial. Mantemos apenas um log de aviso para observabilidade.
    const sellerBlock = await validateSellerCanList(accessToken)
    if (sellerBlock) {
      console.warn('[ml-publish] /users/me indica bloqueio soft, tentando publicar mesmo assim:', JSON.stringify(sellerBlock.details).substring(0, 500))
    }

    // === TITLE (max 60 chars) ===
    const title = product.title.length > 60
      ? product.title.substring(0, 57) + '...'
      : product.title
    console.log('Título final:', title, `(${title.length} chars)`)

    // Prevent duplicate Mercado Livre listings for the same catalog product.
    // The DB also enforces a partial unique index on
    // (user_id, catalog_product_id) WHERE status IN ('active','published'),
    // so a race between two simultaneous requests will still be caught at
    // insert time (see catch below).
    const catalogProductId: string | null =
      (product.catalog_product_id as string | undefined) ??
      (product.cj_product_id as string | undefined) ??
      (product.external_id as string | undefined) ??
      null

    if (catalogProductId) {
      const dup = await supabase
        .from('user_publications')
        .select('id, ml_item_id, permalink, status')
        .eq('user_id', user_id)
        .eq('catalog_product_id', catalogProductId)
        .in('status', ['active', 'published'])
        .limit(1)

      if (dup.error) {
        console.error('Erro ao verificar publicação duplicada:', dup.error)
        return json({ error: 'Não foi possível verificar se este produto já foi publicado. Tente novamente.' }, 500)
      }

      const existing = dup.data?.[0]
      if (existing) {
        console.warn('Publicação duplicada bloqueada (catalog_product_id):', existing.id)
        return json({
          error: 'Este produto já foi publicado.',
          code: 'DUPLICATE_PUBLICATION',
          item_id: existing.ml_item_id,
          permalink: existing.permalink,
        }, 409)
      }
    }


    // === CATEGORY (leaf only) ===
    let categoryId = await predictCategory(title)
    console.log('Categoria final (leaf):', categoryId)

    // === ATTRIBUTES ===
    // Buscamos a ficha de atributos da categoria para saber quais sao
    // obrigatorios e quais tem lista fechada de valores permitidos.
    const fetchCategoryAttrs = async (catId: string): Promise<Record<string, unknown>[]> => {
      try {
        const attrRes = await fetch(`https://api.mercadolibre.com/categories/${catId}/attributes`)
        if (attrRes.ok) return await attrRes.json()
      } catch (_e) { /* ignore */ }
      return []
    }
    let categoryAttrs = await fetchCategoryAttrs(categoryId)

    // fashion_grid: categorias de moda (roupas/calçados) exigem SIZE_GRID_ID, que
    // referencia uma grade de medidas (guia de tamanhos) criada pelo vendedor —
    // NÃO tem lista fechada de valores. O catálogo de dropshipping não tem como
    // preencher, então o ML rejeita com "missing.fashion_grid.grid_id.values" e a
    // publicação trava. Como não dá para fabricar uma grade confiável,
    // reencaminhamos para uma categoria genérica publicável (sem grade).
    const sizeGridDef = categoryAttrs.find((a) => cleanText(a.id) === 'SIZE_GRID_ID')
    const sizeGridHasValues = (((sizeGridDef?.values as unknown[]) ?? []).length) > 0
    // Qualquer categoria que declara SIZE_GRID_ID sem lista fechada de valores
    // é impublicável via dropshipping (não temos grade de medidas do vendedor).
    // Antes só reencaminhávamos quando `tags.required` estava marcado, mas o ML
    // rejeita "missing.fashion_grid.grid_id.values" mesmo em categorias onde
    // esse flag não vem populado — então reencaminhamos sempre que o atributo
    // existir sem valores.
    if (sizeGridDef && !sizeGridHasValues) {
      const FALLBACK_CATEGORY = 'MLB1051' // "Outros" — leaf genérico sem grade de medidas
      console.warn(`[ml-publish] Categoria ${categoryId} declara SIZE_GRID_ID sem valores publicáveis — reencaminhando para ${FALLBACK_CATEGORY}.`)
      categoryId = FALLBACK_CATEGORY
      categoryAttrs = await fetchCategoryAttrs(categoryId)
    }

    // IDs de atributos que ESTA categoria de fato aceita. Usado para não enviar
    // atributos que o ML descarta como inválidos ("was dropped because does not
    // exists"), como SELLER_PACKAGE_DIMENSIONS em categorias que não os suportam.
    const categoryAttrIds = new Set(categoryAttrs.map((a) => cleanText(a.id)))

    const productRecord = product as Record<string, unknown>

    // Resolve o valor digitado pelo usuário contra a lista fechada de valores
    // do ML (quando existe). NUNCA cai para values[0] silenciosamente — se o
    // usuário digitou algo específico e não bate com a lista, mandamos o
    // value_name livre e deixamos o ML devolver o erro real (que agora é
    // repassado pelo mapMLError).
    const resolveAgainstList = (
      attrDef: Record<string, unknown> | undefined,
      userValue: { value_id?: string; value_name?: string },
    ): { value_id?: string; value_name?: string } => {
      const values = (attrDef?.values as Array<{ id?: string; name?: string }> | undefined) ?? []
      if (values.length === 0) return userValue
      if (userValue.value_id) {
        const byId = values.find(v => v.id === userValue.value_id)
        if (byId) return { value_id: byId.id, value_name: byId.name }
      }
      if (userValue.value_name) {
        const norm = normalizeText(userValue.value_name)
        const exact = values.find(v => normalizeText(v.name) === norm)
        if (exact) return { value_id: exact.id, value_name: exact.name }
        const partial = values.find(v => {
          const vn = normalizeText(v.name)
          return vn && (vn.includes(norm) || norm.includes(vn))
        })
        if (partial) return { value_id: partial.id, value_name: partial.name }
      }
      // Lista fechada e nenhum match: mandamos value_name livre (o ML pode
      // aceitar como "Outro" ou devolver erro claro que agora é repassado).
      return userValue
    }

    // 1) Junta o que o usuário mandou: campos top-level (brand/model) +
    //    ml_attributes (BRAND, MODEL, ALBUM_NAME, SALE_FORMAT, ...).
    const userAttrsMap = new Map<string, { value_id?: string; value_name?: string }>()
    for (const inc of parseIncomingAttributes(productRecord.ml_attributes)) {
      userAttrsMap.set(inc.id, {
        ...(inc.value_id ? { value_id: inc.value_id } : {}),
        ...(inc.value_name ? { value_name: inc.value_name } : {}),
      })
    }
    const topBrand = cleanText(productRecord.brand)
    if (topBrand && !userAttrsMap.has('BRAND')) {
      userAttrsMap.set('BRAND', { value_name: topBrand })
    }
    const topModel = cleanText(productRecord.model)
    if (topModel && !userAttrsMap.has('MODEL')) {
      userAttrsMap.set('MODEL', { value_name: topModel })
    }

    const allAttrs: MLAttribute[] = []

    // 2) Aplica cada atributo do usuário resolvido contra a lista da categoria.
    //    Ignora valores "N/D"/vazios do usuário — assim o fallback abaixo
    //    consegue preencher com número real p/ atributos numéricos (VOLUME_CAPACITY etc.)
    for (const [id, val] of userAttrsMap.entries()) {
      const rawName = cleanText((val as { value_name?: unknown })?.value_name).toUpperCase()
      const rawId = cleanText((val as { value_id?: unknown })?.value_id)
      if (!rawId && (rawName === '' || rawName === 'N/D' || rawName === 'N/A')) continue
      const def = categoryAttrs.find(a => a.id === id) as Record<string, unknown> | undefined
      const resolved = resolveAgainstList(def, val)
      mergeAttribute(allAttrs, { id, ...resolved })
    }

    // 3) SELLER_SKU (nosso, não é atributo do catálogo).
    mergeAttribute(allAttrs, {
      id: 'SELLER_SKU',
      value_name: cleanText(productRecord.external_id) || 'SKU-001',
    })

    // 3.5) PACKAGE_WEIGHT (peso da embalagem para frete)
    let rawWeight = null
    
    // PRIORIDADE 1: Tenta scraping direto da página do produto (via flavorProduct/JSON-LD)
    if (typeof productRecord.product_url === 'string' && productRecord.product_url.startsWith('http')) {
      try {
        console.log(`[ml-publish] Obtendo peso real via scraping direto de ${productRecord.product_url}...`)
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 4000) // Timeout de 4 segundos
        const pageRes = await fetch(productRecord.product_url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId))

        if (pageRes.ok) {
          const html = await pageRes.text()
          const flavorMatch = html.match(/flavorProduct\s*=\s*(\{[\s\S]*?\});/)
          let parsedWeight = null
          if (flavorMatch) {
            try {
              const data = JSON.parse(flavorMatch[1])
              if (data.weight) {
                const parsed = parseFloat(data.weight)
                if (!isNaN(parsed) && parsed > 0) parsedWeight = parsed
              }
            } catch (_e) { /* ignore */ }
          }
          if (!parsedWeight) {
            const regexWeight = html.match(/"weight"\s*:\s*"([^"]+)"/)
            if (regexWeight) {
              const parsed = parseFloat(regexWeight[1])
              if (!isNaN(parsed) && parsed > 0) parsedWeight = parsed
            }
          }
          if (parsedWeight) {
            rawWeight = parsedWeight
            console.log(`[ml-publish] Peso real obtido via scraping direto: ${rawWeight} kg`)
            
            // Atualiza de forma assíncrona no banco para futuras publicações/dashboard
            const catalogProductId = productRecord.external_id
            if (catalogProductId) {
              supabase
                .from('catalog_products')
                .update({ weight: rawWeight })
                .eq('source', 'c7drop')
                .eq('external_id', catalogProductId)
                .then(({ error: dbErr }) => {
                  if (dbErr) console.error('[ml-publish] Erro ao atualizar peso no banco:', dbErr.message)
                  else console.log('[ml-publish] Peso atualizado com sucesso no banco de dados.')
                })
            }
          }
        }
      } catch (err) {
        console.error('[ml-publish] Erro ou Timeout ao obter peso da página (usará fallbacks):', err.message || err)
      }
    }

    // PRIORIDADE 2: Fallback para o peso extraído via regex da description no catálogo
    if (!rawWeight || rawWeight <= 0) {
      const dbWeight = typeof productRecord.weight === 'number' ? productRecord.weight : null
      if (dbWeight && dbWeight > 0) {
        rawWeight = dbWeight
        console.log(`[ml-publish] Peso obtido via fallback (dados do catálogo): ${rawWeight} kg`)
      }
    }

    // PRIORIDADE 3: Fallback baseado na categoria do catálogo. Antes usávamos
    // 0,5 kg fixo, mas isso combinado com o formato errado de SELLER_PACKAGE_DIMENSIONS
    // (com espaço em vez de vírgula) fazia o ML descartar as dimensões e aplicar
    // a tabela de "pacote grande" — o que gerava fretes absurdos (R$170+) em
    // produtos pequenos. O mapa abaixo é uma estimativa realista por categoria.
    if (!rawWeight || rawWeight <= 0) {
      const catRaw = (productRecord.category || '').toString().toLowerCase()
      const weightByCategory: Array<[RegExp, number]> = [
        [/beleza|cosm|maquiag|cabelo/, 0.2],
        [/moda|roupa|vestu|calc|acess/, 0.3],
        [/bebê|beb[eê]|crian/, 0.4],
        [/eletr[oô]n|gadget|fone|celular/, 0.5],
        [/pet/, 0.5],
        [/organiza|utilid/, 0.6],
        [/esport|lazer|fitness/, 0.8],
        [/casa|jardim|cozinh/, 0.8],
      ]
      const match = weightByCategory.find(([re]) => re.test(catRaw))
      rawWeight = match ? match[1] : 0.4
      console.log(`[ml-publish] Peso ausente na origem — usando fallback por categoria (${catRaw || 'desconhecida'}): ${rawWeight} kg`)
    }

    // Para SELLER_PACKAGE_WEIGHT, a API do Mercado Livre permite APENAS a unidade 'g' (gramas)
    const weightGrams = Math.max(50, Math.round(rawWeight * 1000))
    const weightValName = `${weightGrams} g`

    if (categoryAttrIds.has('SELLER_PACKAGE_WEIGHT')) {
      mergeAttribute(allAttrs, {
        id: 'SELLER_PACKAGE_WEIGHT',
        value_name: weightValName,
      })
    }

    // 3.6) Dimensões da embalagem — CRÍTICO para o cálculo do frete.
    // Sem dimensões válidas, o Mercado Livre aplica uma tabela padrão de "pacote
    // grande" que resulta em fretes absurdos (R$170+) independente do peso ou
    // preço real. Estimamos dimensões proporcionais ao peso.
    let dimsCm: [number, number, number]
    if (rawWeight <= 0.3) dimsCm = [20, 15, 5]
    else if (rawWeight <= 1) dimsCm = [25, 20, 10]
    else if (rawWeight <= 3) dimsCm = [35, 25, 15]
    else if (rawWeight <= 6) dimsCm = [40, 30, 20]
    else dimsCm = [50, 40, 30]

    // Formato aceito pelo ML: "AxBxC,cm" (vírgula antes da unidade). Antes
    // enviávamos "AxBxC cm" com espaço, o que era descartado pela API — daí
    // vinham os fretes gigantescos mesmo com peso correto.
    const dimsValName = `${dimsCm[0]}x${dimsCm[1]}x${dimsCm[2]},cm`
    if (categoryAttrIds.has('SELLER_PACKAGE_DIMENSIONS')) {
      mergeAttribute(allAttrs, {
        id: 'SELLER_PACKAGE_DIMENSIONS',
        value_name: dimsValName,
      })
    }
    // Exposto no objeto para reaproveitar no payload de shipping abaixo.
    const shippingDimensions = `${dimsCm[0]}x${dimsCm[1]}x${dimsCm[2]},${weightGrams}`
    console.log(`[ml-publish] Dimensões da embalagem: ${dimsValName} / shipping.dimensions=${shippingDimensions} (peso ${rawWeight}kg)`)



    // 4) Atributos obrigatórios que o usuário NÃO enviou:
    //    - BRAND: fallback seguro "Genérica"
    //    - MODEL: fallback seguro (título curto)
    //    - Outros: só preenche automaticamente se houver lista fechada de
    //      valores (aí pegar o primeiro é razoável para atributos técnicos como
    //      SALE_FORMAT/ITEM_CONDITION). Para atributos identificadores
    //      abertos (ALBUM_NAME, GAME_TITLE, LINE etc.) NÃO chutamos —
    //      preferimos deixar o ML retornar erro claro do que colocar
    //      "Dragon Ball Super" num produto de Copa do Mundo.
    const OPEN_IDENTIFYING_ATTRS = new Set([
      'ALBUM_NAME', 'GAME_TITLE', 'BOOK_TITLE', 'MOVIE_TITLE', 'LINE',
      'COLLECTION', 'ARTIST', 'AUTHOR',
    ])
    for (const attrDef of categoryAttrs) {
      const id = attrDef.id as string
      const tags = (attrDef.tags as Record<string, unknown>) ?? {}
      if (!tags.required) continue
      if (allAttrs.find(a => a.id === id)) continue

      // SIZE_GRID_ID (grade de medidas): nunca fabricar um valor. Sem grade real
      // o ML rejeita qualquer chute ("missing.fashion_grid.grid_id.values"). Se a
      // categoria chegou aqui exigindo grade, o reencaminhamento acima já tratou;
      // este continue é a salvaguarda para não mandar "N/D" e travar o anúncio.
      if (id === 'SIZE_GRID_ID') continue

      if (id === 'BRAND') {
        const def = attrDef as Record<string, unknown>
        const resolved = resolveAgainstList(def, { value_name: 'Genérica' })
        mergeAttribute(allAttrs, { id, ...resolved })
        continue
      }
      if (id === 'MODEL') {
        // Categorias com lista fechada de MODEL (celulares, alguns tênis) NÃO
        // aceitam texto livre. Não chutar — deixar o ML devolver erro claro
        // e o usuário escolher no modal. Para categorias de texto livre,
        // "Não especificado" é aceito universalmente e não gera pausa.
        const def = attrDef as Record<string, unknown>
        const values = (def?.values as Array<{ id?: string; name?: string }> | undefined) ?? []
        if (values.length > 0) {
          // Lista fechada: não chutar.
          continue
        }
        mergeAttribute(allAttrs, { id, value_name: 'Não especificado' })
        continue
      }
      // Detecta atributos numéricos (com ou sem unidade). O ML rejeita "N/D"
      // com item.attribute.number_invalid_format nesses casos — precisamos
      // enviar um número real seguido de uma unidade permitida.
      const valueType = cleanText((attrDef as Record<string, unknown>).value_type).toLowerCase()
      // Safety-net: mesmo que a categoria não declare value_type,
      // esses IDs são sempre numéricos com unidade no ML e "N/D" quebra o anúncio.
      const KNOWN_NUMBER_UNIT = new Set([
        'VOLUME_CAPACITY', 'WEIGHT', 'NET_WEIGHT', 'GROSS_WEIGHT',
        'CAPACITY', 'LENGTH', 'HEIGHT', 'WIDTH', 'DEPTH', 'DIAMETER',
        'PACKAGE_LENGTH', 'PACKAGE_HEIGHT', 'PACKAGE_WIDTH',
      ])
      const isNumberUnit = valueType === 'number_unit' || valueType === 'numeric_unit' || KNOWN_NUMBER_UNIT.has(id)
      const isNumber = valueType === 'number' || valueType === 'numeric'
      const allowedUnits = ((attrDef as Record<string, unknown>).allowed_units as Array<{ id?: string; name?: string }> | undefined) ?? []

      if (OPEN_IDENTIFYING_ATTRS.has(id) && !isNumber && !isNumberUnit) {
        // Não chutar valor específico. Manda "N/D" para satisfazer a
        // obrigatoriedade sem inventar dado errado.
        mergeAttribute(allAttrs, { id, value_name: 'N/D' })
        continue
      }
      const values = (attrDef.values as Record<string, unknown>[] | undefined) ?? []
      if (values.length > 0) {
        const firstValue = values[0]
        const valueId = cleanText(firstValue?.id)
        const valueName = cleanText(firstValue?.name)
        if (valueId || valueName) {
          mergeAttribute(allAttrs, {
            id,
            ...(valueId ? { value_id: valueId } : {}),
            ...(valueName ? { value_name: valueName } : {}),
          })
        }
      } else if (isNumberUnit) {
        // Atributo numérico com unidade (ex.: VOLUME_CAPACITY, WEIGHT,
        // CAPACITY). "N/D" quebra com number_invalid_format. Enviamos "1 <un>"
        // com a primeira unidade permitida pela categoria para satisfazer
        // formato — o usuário pode ajustar depois no modal de revisão.
        const unit = cleanText(allowedUnits[0]?.id) || cleanText(allowedUnits[0]?.name) || 'un'
        mergeAttribute(allAttrs, { id, value_name: `1 ${unit}` })
      } else if (isNumber) {
        mergeAttribute(allAttrs, { id, value_name: '1' })
      } else {
        // Atributo obrigatório de texto livre. Sem valor confiável →
        // preenche "N/D" para o ML não travar o anúncio.
        mergeAttribute(allAttrs, { id, value_name: 'N/D' })
      }
    }

    console.log('Atributos:', allAttrs.map(a => `${a.id}=${a.value_id ?? a.value_name}`))


    // === PICTURES ===    // ML exige foto de capa com FUNDO BRANCO digitalizado em várias categorias
    // (beleza, saúde, moda etc). As imagens do catálogo Velo nem sempre vêm
    // assim — então normalizamos via proxy gratuito images.weserv.nl, que
    // redimensiona para 1200x1200 com `fit=contain` e preenche o canvas com
    // branco puro. Isso evita o status "Inativo para revisar" em massa.
    const toWhiteBg = (url: string): string => {
      try {
        // weserv exige URL sem protocolo
        const stripped = url.replace(/^https?:\/\//i, '')
        const encoded = encodeURIComponent(stripped)
        return `https://images.weserv.nl/?url=${encoded}&w=1200&h=1200&fit=contain&cbg=white&bg=white&output=jpg&q=90`
      } catch {
        return url
      }
    }
    const pictures = publicImages.map(url => ({ source: toWhiteBg(url) }))
    console.log('Imagens para ML (normalizadas fundo branco):', pictures.length)

    // === BUILD PAYLOAD ===
    const mlPayload = {
      title,
      // O novo modelo User Products do Mercado Livre exige family_name.
      // Mantemos title para contas/categorias ainda no modelo clássico.
      family_name: title,
      category_id: categoryId,
      price: product.price,
      currency_id: 'BRL',
      available_quantity: product.available_quantity || 10,
      buying_mode: 'buy_it_now',
      condition: 'new',
      listing_type_id: 'gold_special',
      pictures,
      attributes: allAttrs,
      // Frete: Mercado Envios 2 (padrão para dropshipping), com frete grátis
      // — muitas categorias já exigem `mandatory_free_shipping`, e `me1`
      // requer contrato próprio do vendedor (causa `lost_me1_by_user`).
      shipping: {
        mode: 'me2',
        local_pick_up: false,
        free_shipping: true,
        free_methods: [],
        // Campo canônico do ML para cálculo de frete: "AxBxC,pesoEmGramas".
        // Sem isso a API usa a tabela padrão de pacote grande e o frete
        // volta a ficar absurdo (R$170+) mesmo com atributos de dimensão
        // preenchidos, porque o motor de frete lê primeiro este campo.
        dimensions: shippingDimensions,
        tags: ['self_service_in'],
      },

    }

    console.log('Payload:', JSON.stringify(mlPayload))
    let itemResponse = await fetch('https://api.mercadolibre.com/items', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mlPayload),
    })

    let itemData = await itemResponse.json()
    console.log('Item criado:', JSON.stringify(itemData).substring(0, 800))

    // Detecção de causas conhecidas retornadas pelo ML.
    const causeMessages = (data: any): string => {
      const parts: string[] = []
      if (Array.isArray(data?.cause)) {
        for (const c of data.cause) {
          if (c?.message) parts.push(String(c.message))
          if (c?.code) parts.push(String(c.code))
        }
      }
      parts.push(String(data?.message ?? ''))
      parts.push(String(data?.error ?? ''))
      return parts.join(' | ').toLowerCase()
    }

    // Contas migradas para User Products rejeitam `title` com
    // body.invalid_fields → "The fields [title] are invalid". Reenviamos
    // sem `title`, mantendo apenas `family_name`.
    if (!itemResponse.ok && causeMessages(itemData).includes('[title]')) {
      console.warn('[ml-publish] Conta no modelo User Products — reenviando sem title')
      const { title: _omitTitle, ...payloadNoTitle } = mlPayload
      itemResponse = await fetch('https://api.mercadolibre.com/items', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payloadNoTitle),
      })
      itemData = await itemResponse.json()
      console.log('Item criado (retry sem title):', JSON.stringify(itemData).substring(0, 800))
    }

    // Contas no modelo clássico rejeitam `family_name` com
    // "The field family name is invalid". Reenviamos sem family_name.
    if (!itemResponse.ok && causeMessages(itemData).includes('family name')) {
      console.warn('[ml-publish] Conta no modelo clássico — reenviando sem family_name')
      const { family_name: _omitFn, ...payloadNoFn } = mlPayload as any
      itemResponse = await fetch('https://api.mercadolibre.com/items', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payloadNoFn),
      })
      itemData = await itemResponse.json()
      console.log('Item criado (retry sem family_name):', JSON.stringify(itemData).substring(0, 800))
    }

    // Última rede de segurança: se o ML ainda rejeitar por grade de medidas
    // (fashion_grid/SIZE_GRID_ID) mesmo depois do reencaminhamento inicial,
    // reenviamos o item para a categoria genérica "Outros" (MLB1051) e
    // limpamos atributos exclusivos de moda para permitir a publicação.
    if (!itemResponse.ok) {
      const msg = causeMessages(itemData)
      if (msg.includes('size_grid_id') || msg.includes('fashion_grid') || msg.includes('grid_id')) {
        console.warn('[ml-publish] ML rejeitou por SIZE_GRID_ID mesmo após reencaminhamento — reenviando em MLB1051.')
        const fallbackPayload = {
          ...mlPayload,
          category_id: 'MLB1051',
          attributes: (mlPayload.attributes as MLAttribute[]).filter((a) =>
            !['SIZE_GRID_ID', 'SIZE_GRID_ROW_ID', 'SIZE'].includes(String(a.id))
          ),
        }
        itemResponse = await fetch('https://api.mercadolibre.com/items', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(fallbackPayload),
        })
        itemData = await itemResponse.json()
        console.log('Item criado (retry MLB1051):', JSON.stringify(itemData).substring(0, 800))
      }
    }

    if (!itemResponse.ok || !itemData?.id) {
      console.error('Erro ao criar produto:', JSON.stringify(itemData))
      const mapped = itemResponse.ok
        ? { message: 'Falha ao criar produto no Mercado Livre.' as string, code: undefined as string | undefined }
        : mapMLError(itemData)
      return json({ error: mapped.message, code: mapped.code, details: itemData }, 400)
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
    // Campos legados mantidos somente por compatibilidade com o schema atual.
    try {
      const insertRes = await supabase.from('user_publications').insert({
        user_id,
        ml_item_id:         itemId,
        title,
        thumbnail:          publicImages[0] || null,
        price:              product.price,
        cost_price:         product.cost_price || null,
        status:             'active',
        permalink:          itemData.permalink,
        published_at:       new Date().toISOString(),
        catalog_product_id: catalogProductId,
        cj_product_id:      product.cj_product_id  ?? null,
        cj_product_url:     product.cj_product_url ?? null,
        cj_variant_id:      product.cj_variant_id  ?? null,
      })
      if (insertRes.error) {
        // 23505 = unique_violation → race lost against another concurrent publish.
        const code = (insertRes.error as { code?: string }).code
        if (code === '23505') {
          console.warn('Publicação duplicada detectada pela constraint única:', catalogProductId)
          return json({
            error: 'Este produto já foi publicado.',
            code: 'DUPLICATE_PUBLICATION',
            item_id: itemId,
            permalink: itemData.permalink,
          }, 409)
        }
        console.error('Erro ao salvar publicação:', insertRes.error)
      }
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

