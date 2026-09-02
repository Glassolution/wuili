import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PLAN_LIMITS } from '../_shared/plan-limits.ts'
import { filterCleanImages } from '../_shared/ml-content-sanitizer.ts'
import { selectPublishableDimension } from '../_shared/ml-variations.ts'


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
  gratis: PLAN_LIMITS.gratis.mlActiveListings,
  go: PLAN_LIMITS.base.mlActiveListings,
  base: PLAN_LIMITS.base.mlActiveListings,
  pro: PLAN_LIMITS.pro.mlActiveListings,
  business: PLAN_LIMITS.business.mlActiveListings,
}

// Publicações novas por mês: separa quem opera em volume (Pro/Business) de quem
// só mantém uma vitrine enxuta (Base).
const MONTHLY_PUBLISH_LIMITS: Record<PlanName, number | null> = {
  gratis: PLAN_LIMITS.gratis.mlPublicationsPerMonth,
  go: PLAN_LIMITS.base.mlPublicationsPerMonth,
  base: PLAN_LIMITS.base.mlPublicationsPerMonth,
  pro: PLAN_LIMITS.pro.mlPublicationsPerMonth,
  business: PLAN_LIMITS.business.mlPublicationsPerMonth,
}

const startOfMonthISO = () => {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
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


/**
 * Variações no Mercado Livre.
 *
 * O ML não aceita variação "livre": cada eixo (Cor, Tamanho...) precisa ser um
 * atributo da categoria marcado com `tags.allow_variations`. Por isso só
 * montamos `variations[]` quando conseguimos casar o nome da variação do
 * fornecedor com um atributo válido da categoria. Se não casar, publicamos
 * como item simples (comportamento antigo) em vez de estourar erro no ML.
 */
type SupplierVariantRow = { name: string; value: string; sku: string | null; stock: number | null }

function parseSupplierVariantRows(raw: unknown): SupplierVariantRow[] {
  if (typeof raw === 'string') {
    try { return parseSupplierVariantRows(JSON.parse(raw)) } catch { return [] }
  }
  if (!Array.isArray(raw)) return []
  const rows: SupplierVariantRow[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const r = entry as Record<string, unknown>
    const name = cleanText(r.name as string | undefined)
    if (!name) continue
    const sku = cleanText(r.sku as string | undefined) || null
    const stockNum = Number(r.stock)
    const stock = Number.isFinite(stockNum) ? stockNum : null
    const value = cleanText(r.value as string | undefined)
    if (value) { rows.push({ name, value, sku, stock }); continue }
    if (Array.isArray(r.options)) {
      for (const opt of r.options) {
        const v = cleanText(opt as string | undefined)
        if (v) rows.push({ name, value: v, sku, stock })
      }
    }
  }
  return rows
}

/** "Cor"/"Color" → COLOR, "Tamanho"/"Size" → SIZE, senão casa pelo nome do atributo. */
function matchVariationAttribute(
  name: string,
  categoryAttrs: Array<Record<string, unknown>>,
): { id: string; name: string } | null {
  const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
  const target = norm(name)
  const alias: Record<string, string[]> = {
    COLOR: ['cor', 'color', 'cores'],
    SIZE: ['tamanho', 'size', 'tamanhos'],
    MODEL: ['modelo', 'model'],
    FLAVOR: ['sabor', 'flavor'],
    CAPACITY: ['capacidade', 'capacity'],
  }
  const allowed = categoryAttrs.filter((a) => {
    const tags = (a.tags as Record<string, unknown> | undefined) ?? {}
    return Boolean(tags.allow_variations)
  })
  for (const attr of allowed) {
    const id = cleanText(attr.id as string | undefined).toUpperCase()
    const attrName = cleanText(attr.name as string | undefined)
    if (norm(attrName) === target) return { id, name: attrName }
    if (alias[id]?.includes(target)) return { id, name: attrName || id }
  }
  // Muitas categorias não têm "COLOR" puro e sim "Cor da caixa"/"Cor da pulseira".
  // Casamos pelo prefixo do nome para não perder a variação nesses casos.
  for (const attr of allowed) {
    const id = cleanText(attr.id as string | undefined).toUpperCase()
    const attrName = cleanText(attr.name as string | undefined)
    if (norm(attrName).startsWith(target)) return { id, name: attrName || id }
  }
  return null
}

function buildMlVariations(
  variantsRaw: unknown,
  categoryAttrs: Array<Record<string, unknown>>,
  price: number,
  totalQuantity: number,
  pictures: Array<{ source?: string }> = [],
): Array<Record<string, unknown>> {
  const rows = parseSupplierVariantRows(variantsRaw)
  if (rows.length === 0) return []

  // GUARDA ÚNICA DE DIMENSÃO REAL (_shared/ml-variations.ts).
  // É a MESMA guarda usada pelo motor de variações: descarta tiers internos do
  // C7Drop ("Compra: Atacado/Dropshipping/Grupo Vip", "Kit", "Promoção"),
  // múltiplas dimensões e listas fora da faixa de 2..6 valores. Sem isso,
  // o caminho de anúncios-irmãos por family_name geraria um anúncio duplicado
  // por tier de preço do fornecedor.
  const guarda = selectPublishableDimension(variantsRaw)
  if (!guarda.ok || !guarda.name) {
    console.log(
      `[ml-publish] Sem variação publicável (motivo=${guarda.reason}; dimensões=${JSON.stringify(guarda.allDimensions)}) — item simples.`,
    )
    return []
  }

  const matched = matchVariationAttribute(guarda.name, categoryAttrs)
  if (!matched) {
    console.warn(`[ml-publish] Variação "${guarda.name}" sem atributo equivalente na categoria — publicando item simples.`)
    return []
  }

  const combos: Array<Array<{ id: string; value_name: string }>> = guarda.values.map((value) => [
    { id: matched.id, value_name: value },
  ])

  // Algumas categorias (ex.: Filtros de Linha) exigem picture_ids em cada
  // variação. Usamos as URLs já normalizadas do produto; o ML converte para
  // IDs internos durante a criação do anúncio.
  const pictureUrls = pictures.map((p) => p.source).filter((url): url is string => Boolean(url))

  // Imagem específica por variação: quando o produto tem pelo menos uma foto
  // para cada valor, a variação nº i recebe a foto nº i (as demais entram como
  // apoio). Sem fotos suficientes, todas herdam a galeria completa.
  const fotosSuficientes = pictureUrls.length >= combos.length
  const fotosDaVariacao = (indice: number): string[] => {
    if (pictureUrls.length === 0) return []
    if (!fotosSuficientes) return pictureUrls.slice(0, 10)
    const principal = pictureUrls[indice]
    return [principal, ...pictureUrls.filter((u) => u !== principal)].slice(0, 10)
  }

  // Estoque por variação: preferimos o estoque real informado pelo fornecedor
  // para aquele valor; se ele não existir, dividimos o estoque do produto.
  const perVariation = Math.max(1, Math.floor((totalQuantity || 1) / combos.length))
  const stockPorValor = new Map<string, number>()
  for (const r of rows) {
    const st = Number(r.stock ?? 0)
    if (r.value && st > 0) stockPorValor.set(String(r.value), Math.max(stockPorValor.get(String(r.value)) ?? 0, st))
  }
  return combos.map((attribute_combinations, indice) => {
    const skuRow = rows.find((r) => r.sku && attribute_combinations.some((c) => c.value_name === r.value))
    const estoqueDaVariacao = attribute_combinations
      .map((c) => stockPorValor.get(String(c.value_name)))
      .find((v) => typeof v === 'number' && v > 0)
    const fotos = fotosDaVariacao(indice)
    const variation: Record<string, unknown> = {
      attribute_combinations,
      price,
      available_quantity: Math.max(1, Math.floor(estoqueDaVariacao ?? perVariation)),
      ...(fotos.length > 0 ? { picture_ids: fotos } : {}),
      ...(skuRow?.sku ? { attributes: [{ id: 'SELLER_SKU', value_name: skuRow.sku }] } : {}),
      // Metadados internos (removidos antes de enviar ao ML) usados para
      // registrar o anúncio-irmão em user_publications.
      _velo_dimension: guarda.name,
      _velo_value: attribute_combinations[0]?.value_name ?? null,
      _velo_pictures: fotos,
    }
    return variation
  })
}

// Metadados internos não podem ir no POST do ML.
function semMetadadosVelo(v: Record<string, unknown>): Record<string, unknown> {
  const { _velo_dimension: _d, _velo_value: _v, _velo_pictures: _p, ...limpo } = v as Record<string, unknown>
  return limpo
}


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

function inferGenderValue(
  title: string,
  values: Array<{ id?: string; name?: string }>,
): { value_id?: string; value_name: string } {
  const normalizedTitle = normalizeText(title)
  const female = /\b(mulher|mulheres|feminino|feminina|femininos|femininas|menina|meninas|dama|damas)\b/.test(normalizedTitle)
  const male = /\b(homem|homens|masculino|masculina|masculinos|masculinas|menino|meninos)\b/.test(normalizedTitle)
  const wanted = female && !male ? 'feminino' : male && !female ? 'masculino' : 'sem genero'
  const aliases = wanted === 'sem genero' ? ['sem genero', 'unissex'] : [wanted]
  const matched = values.find((value) => aliases.some((alias) => normalizeText(value.name).includes(alias)))

  return matched
    ? { ...(matched.id ? { value_id: matched.id } : {}), value_name: cleanText(matched.name) }
    : { value_name: wanted === 'sem genero' ? 'Sem gênero' : wanted === 'feminino' ? 'Feminino' : 'Masculino' }
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

// === Category prediction (v2) ===
// `category_predictor/predict` foi descontinuado (retorna 404 mesmo com Bearer
// válido). Usamos apenas `domain_discovery/search` com estratégia de duas
// consultas: título cru (60 chars) e título normalizado (sem números/faixas de
// tamanho/stopwords de marketing). Se a categoria prevista exigir SIZE_GRID_ID
// (fashion_grid) sem que o payload traga a grade, o caller devolve 409 e o
// usuário escolhe a categoria manualmente pelo modal — nunca redirecionamos
// silenciosamente para MLB1051.

const STOPWORDS_PT = new Set([
  'nova','novo','moda','grande','premium','luxo','luxuoso','vintage','sexy',
  'elegante','casual','chic','requintado','estilo','estiloso','bonito','bonita',
  'lindo','linda','fofo','fofa','simples','pequeno','pequena','mini','maxi',
  'super','mega','ultra','melhor','melhores','incrivel','perfeito','perfeita',
  'diy','artesanal','handmade','novidade','tendencia','oferta','promocao','kit','set',
  'verao','inverno','primavera','outono',
  '2020','2021','2022','2023','2024','2025','2026','2027',
  'para','com','sem','de','do','da','dos','das','em','no','na','nos','nas','e','ou',
  'feminino','feminina','masculino','masculina','meninas','meninos','mulher','mulheres',
  'homem','homens','menina','menino','unissex','adulto','adulta','infantil',
  'o','a','os','as','um','uma','uns','umas',
])
const UNIT_RE = /\b\d+(?:[.,]\d+)?\s*(?:mm|cm|m|ml|l|g|kg|mah|w|v|hz|khz|mhz|ghz|gb|mb|tb|pcs|peças|pcs|pçs|un)\b/gi
const RANGE_RE = /\b\d+\s*[-–—\/]\s*\d+\b/g
const BARE_NUM_RE = /\b\d+(?:[.,]\d+)?\b/g
const PUNCT_RE = /[,;:!?()\[\]{}"'`]/g

function normalizeTitleForPrediction(t: string): string {
  const stripped = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const s = stripped
    .replace(UNIT_RE, ' ')
    .replace(RANGE_RE, ' ')
    .replace(BARE_NUM_RE, ' ')
    .replace(PUNCT_RE, ' ')
  const toks = s.split(/\s+/).filter((w) => w.length > 1 && !STOPWORDS_PT.has(w))
  return toks.slice(0, 6).join(' ')
}

// In-memory cache de atributos por categoria (TTL 6h). Usado tanto para
// decidir requiresSizeGrid quanto para reaproveitar a lista completa de
// atributos ao montar o payload.
type AttrCacheEntry = {
  attrs: Record<string, unknown>[]
  isLeaf: boolean
  requiresGrid: boolean
  ts: number
}
const attrCache = new Map<string, AttrCacheEntry>()
const ATTR_TTL_MS = 6 * 60 * 60 * 1000

async function fetchCategoryAttrsCached(catId: string): Promise<AttrCacheEntry> {
  const cached = attrCache.get(catId)
  if (cached && Date.now() - cached.ts < ATTR_TTL_MS) return cached
  let attrs: Record<string, unknown>[] = []
  let requiresGrid = false
  try {
    const r = await fetch(`https://api.mercadolibre.com/categories/${catId}/attributes`)
    if (r.ok) {
      attrs = (await r.json()) as Record<string, unknown>[]
      const sg = attrs.find((a) => cleanText(a.id) === 'SIZE_GRID_ID')
      if (sg) {
        const tags = (sg.tags as Record<string, unknown> | undefined) ?? {}
        const values = (sg.values as unknown[] | undefined) ?? []
        // fashion_grid: existe atributo SIZE_GRID_ID sem lista fechada de
        // valores (o vendedor precisa criar a grade), OU está marcado como
        // required/fixed. Em qualquer desses casos exigimos que o payload
        // traga um size_grid_id explícito.
        requiresGrid = values.length === 0 || Boolean(tags.required || tags.fixed)
      }
    }
  } catch (_e) { /* ignore */ }

  let isLeaf = false
  try {
    const r = await fetch(`https://api.mercadolibre.com/categories/${catId}`)
    if (r.ok) {
      const c = (await r.json()) as Record<string, unknown>
      const ch = Array.isArray(c.children_categories) ? (c.children_categories as unknown[]) : []
      isLeaf = ch.length === 0
    }
  } catch (_e) { /* ignore */ }

  const entry: AttrCacheEntry = { attrs, isLeaf, requiresGrid, ts: Date.now() }
  attrCache.set(catId, entry)
  return entry
}

async function domainDiscoveryLookup(q: string): Promise<{ id: string; name: string } | null> {
  if (!q || !q.trim()) return null
  try {
    const r = await fetch(
      `https://api.mercadolibre.com/sites/MLB/domain_discovery/search?limit=1&q=${encodeURIComponent(q)}`,
    )
    if (!r.ok) return null
    const data = (await r.json()) as Array<Record<string, unknown>>
    if (!Array.isArray(data) || !data[0]?.category_id) return null
    return { id: String(data[0].category_id), name: String(data[0].category_name ?? '') }
  } catch { return null }
}

type PredictionResult = {
  categoryId: string
  categoryName: string
  rawPrediction: string | null
  rawCategoryName: string | null
  normalizedPrediction: string | null
  normalizedCategoryName: string | null
  normalizedTitle: string
  requiresSizeGrid: boolean
  source: 'raw' | 'normalized' | 'agreed' | 'divergent' | 'fallback'
  lowConfidence: boolean
}

async function predictCategory(title: string): Promise<PredictionResult> {
  const FALLBACK = 'MLB1051'
  const normalized = normalizeTitleForPrediction(title)

  const rawHit = await domainDiscoveryLookup(title.slice(0, 60))
  const rawInfo = rawHit ? await fetchCategoryAttrsCached(rawHit.id) : null
  const normHit = normalized ? await domainDiscoveryLookup(normalized) : null
  const normInfo = normHit ? await fetchCategoryAttrsCached(normHit.id) : null

  const rawOK = Boolean(rawHit && rawInfo?.isLeaf && !rawInfo.requiresGrid)
  const normOK = Boolean(normHit && normInfo?.isLeaf && !normInfo.requiresGrid)

  const base = {
    rawPrediction: rawHit?.id ?? null,
    rawCategoryName: rawHit?.name ?? null,
    normalizedPrediction: normHit?.id ?? null,
    normalizedCategoryName: normHit?.name ?? null,
    normalizedTitle: normalized,
  }

  // Ambas válidas (folha, não-fashion): concordância = alta confiança;
  // divergência = baixa confiança → caller devolve 409 CATEGORY_LOW_CONFIDENCE.
  if (rawOK && normOK && rawHit && normHit) {
    if (rawHit.id === normHit.id) {
      return { ...base, categoryId: rawHit.id, categoryName: rawHit.name, requiresSizeGrid: false, source: 'agreed', lowConfidence: false }
    }
    return { ...base, categoryId: rawHit.id, categoryName: rawHit.name, requiresSizeGrid: false, source: 'divergent', lowConfidence: true }
  }

  // Só uma válida: usa (comportamento atual).
  if (rawOK && rawHit) {
    return { ...base, categoryId: rawHit.id, categoryName: rawHit.name, requiresSizeGrid: false, source: 'raw', lowConfidence: false }
  }
  if (normOK && normHit) {
    return { ...base, categoryId: normHit.id, categoryName: normHit.name, requiresSizeGrid: false, source: 'normalized', lowConfidence: false }
  }

  // Nenhuma válida: retorna a melhor previsão (mesmo fashion) — caller bloqueia com 409 se faltar grade.
  if (rawHit) {
    return { ...base, categoryId: rawHit.id, categoryName: rawHit.name, requiresSizeGrid: Boolean(rawInfo?.requiresGrid), source: 'raw', lowConfidence: false }
  }
  if (normHit) {
    return { ...base, categoryId: normHit.id, categoryName: normHit.name, requiresSizeGrid: Boolean(normInfo?.requiresGrid), source: 'normalized', lowConfidence: false }
  }

  return { ...base, categoryId: FALLBACK, categoryName: 'Outros', requiresSizeGrid: false, source: 'fallback', lowConfidence: false }
}

async function logPrediction(
  supabase: ReturnType<typeof createClient>,
  args: {
    productId: string | null
    userId: string | null
    title: string
    prediction: PredictionResult | null
    finalCategory: string
    finalStatus: string
    requiresSizeGrid: boolean
  },
) {
  if (!args.productId) return
  try {
    await supabase.from('ml_category_prediction_log').insert({
      product_id: args.productId,
      user_id: args.userId,
      title_raw: args.title,
      title_normalized: args.prediction?.normalizedTitle ?? '',
      predicted_raw: args.prediction?.rawPrediction ?? null,
      predicted_normalized: args.prediction?.normalizedPrediction ?? null,
      final_category: args.finalCategory,
      final_status: args.finalStatus,
      requires_size_grid: args.requiresSizeGrid,
      source: args.prediction?.source ?? null,
      low_confidence: args.prediction?.lowConfidence ?? false,
    })
  } catch (logErr) {
    console.error('[ml-publish] Falha ao gravar log de predição:', logErr)
  }
}

// Map ML API errors to user-friendly messages
function mapMLError(mlData: Record<string, unknown>): { message: string; code?: string; seller_codes?: string[] } {
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
    return { message: buildSellerBlockedMessage(codes), code: 'ML_SELLER_CANNOT_LIST', seller_codes: codes }
  }

  // Erros específicos de imagens em variações precisam de mensagem clara antes
  // do catch-all de categoria/pictures abaixo.
  if (causeStr.includes('item.pictures.variation')) {
    return { message: 'Cada variação precisa ter entre 1 e 10 fotos. Verifique se o produto possui imagens suficientes.' }
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

async function notifyUser(
  supabase: ReturnType<typeof createClient>,
  row: {
    user_id: string
    type: string
    title: string
    message: string
    action_url?: string
    metadata?: Record<string, unknown>
  },
) {
  const { error } = await supabase.from('notifications').insert({
    user_id: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    action_url: row.action_url ?? null,
    metadata: row.metadata ?? {},
  })
  if (error) console.warn('[ml-publish] falha ao criar notificacao:', error.message)
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
    const allPublicImages = rawImages.filter(isPublicUrl)
    if (allPublicImages.length < MIN_REQUIRED_IMAGES) {
      return json({
        error: `O Mercado Livre exige no mínimo ${MIN_REQUIRED_IMAGES} fotos para publicar. Este produto tem apenas ${allPublicImages.length} foto(s) pública(s). Adicione mais imagens antes de publicar (imagens locais não são aceitas).`,
        code: 'INSUFFICIENT_IMAGES',
      }, 400)
    }

    // O ML pausa anúncios cujas fotos sejam artes/infográficos do fornecedor
    // ("Ajuste o título e/ou substitua as fotos"). Filtramos antes de publicar:
    // heurística de URL + checagem visual por IA. Fail-open: se sobrarem menos
    // de 3 fotos limpas, completamos com as originais para não travar a venda.
    let publicImages = allPublicImages.slice(0, 6)
    try {
      const filtered = await filterCleanImages(allPublicImages, { useVision: true, max: 6 })
      if (filtered.rejected.length) {
        console.warn('[ml-publish] fotos recusadas (arte/texto promocional):',
          filtered.rejected.map(r => `${r.url} → ${r.reason}`).slice(0, 8))
      }
      if (filtered.clean.length >= MIN_REQUIRED_IMAGES) {
        publicImages = filtered.clean
      } else if (filtered.clean.length > 0) {
        const rest = allPublicImages.filter(u => !filtered.clean.includes(u))
        publicImages = [...filtered.clean, ...rest].slice(0, 6)
        console.warn('[ml-publish] menos de 3 fotos limpas — completando com originais')
      }
    } catch (err) {
      console.warn('[ml-publish] filtro visual de imagens indisponível:', String(err))
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
    // Um usuário pode ter várias assinaturas ativas ao mesmo tempo (upgrade,
    // cobrança recriada, migração). Pegar só a mais recente rebaixava quem
    // tinha Pro ativo mas uma linha Base criada depois. Vale sempre o MAIOR
    // plano ativo.
    const { data: activeSubs } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', user_id)
      .in('status', ['active', 'paid', 'approved', 'trialing'])

    const PLAN_RANK: Record<string, number> = { gratis: 0, base: 1, go: 1, plus: 2, pro: 2, business: 3 }
    const bestSubPlan = (activeSubs ?? [])
      .map((s) => normalizePlanName(s.plan))
      .sort((a, b) => (PLAN_RANK[b] ?? 0) - (PLAN_RANK[a] ?? 0))[0]

    const profilePlan = normalizePlanName(profileCd?.plano)
    const userPlan =
      (PLAN_RANK[profilePlan] ?? 0) > (PLAN_RANK[bestSubPlan ?? 'gratis'] ?? 0)
        ? profilePlan
        : (bestSubPlan ?? profilePlan)
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
        return json({ error: `Você atingiu o limite de ${productLimit} anúncios ativos do seu plano. Faça upgrade para publicar mais.` }, 403)
      }
    }

    // Teto de publicações novas no mês corrente.
    const monthlyLimit = MONTHLY_PUBLISH_LIMITS[userPlan]
    if (typeof monthlyLimit === 'number' && monthlyLimit > 0) {
      const monthlyQuery = await supabase
        .from('user_publications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user_id)
        .gte('created_at', startOfMonthISO())

      if (!monthlyQuery.error && (monthlyQuery.count ?? 0) >= monthlyLimit) {
        return json({
          error: `Você já publicou ${monthlyLimit} anúncios no Mercado Livre neste mês (limite do plano ${userPlan}). Faça upgrade para continuar publicando.`,
        }, 403)
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


    const productRecord = product as Record<string, unknown>

    // === CATEGORY (leaf only) ===
    // Prioridade:
    //   1) override_category_id no payload (seleção manual do usuário)
    //   2) legado: ml_category_id / category_id no productRecord
    //   3) predição automática (domain_discovery com fallback normalizado)
    // Fashion sem size_grid_id no payload → 409 CATEGORY_REQUIRES_MANUAL,
    // marcando o produto como needs_manual para revisão explícita. NUNCA
    // redirecionamos silenciosamente para MLB1051.
    const productRecordId = cleanText(productRecord.id) || catalogProductId
    const overrideCategoryRaw = cleanText(
      (productRecord.override_category_id as string | undefined) ??
      (productRecord.ml_category_id as string | undefined) ??
      (productRecord.category_id as string | undefined),
    )
    const providedSizeGridId = cleanText(
      (productRecord.size_grid_id as string | undefined) ??
      (productRecord.ml_size_grid_id as string | undefined),
    )
    const providedSizeGridRowId = cleanText(
      (productRecord.size_grid_row_id as string | undefined) ??
      (productRecord.ml_size_grid_row_id as string | undefined),
    )

    let categoryId: string
    let categoryStatusForRecord: 'auto' | 'manual' = 'auto'
    let prediction: PredictionResult | null = null

    if (overrideCategoryRaw && /^MLB\d+$/.test(overrideCategoryRaw)) {
      const leafId = (await isLeafCategory(overrideCategoryRaw))
        ? overrideCategoryRaw
        : await resolveLeafCategory(overrideCategoryRaw)
      categoryId = leafId
      categoryStatusForRecord = 'manual'
      console.log('[ml-publish] Categoria (override manual):', categoryId)
    } else {
      prediction = await predictCategory(title)
      categoryId = prediction.categoryId
      console.log(
        `[ml-publish] Categoria (auto/${prediction.source}${prediction.lowConfidence ? '/low_conf' : ''}):`,
        categoryId,
        `raw="${title.slice(0,60)}" norm="${prediction.normalizedTitle}" rawCat=${prediction.rawPrediction} normCat=${prediction.normalizedPrediction}`,
      )

      // Divergência entre raw e normalized (ambas folha, não-fashion, distintas):
      // seguimos com a previsão do título completo, que preserva mais contexto.
      // O seletor manual foi removido do frontend; devolver 409 aqui tornava
      // produtos válidos (especialmente AliExpress) impossíveis de publicar.
      if (prediction.lowConfidence && productRecordId) {
        try {
          await supabase
            .from('catalog_products')
            .update({
              ml_category_id: categoryId,
              ml_category_status: 'auto',
              updated_at: new Date().toISOString(),
            })
            .eq('id', productRecordId)
        } catch (persistErr) {
          console.error('[ml-publish] Falha ao gravar categoria automática (low_conf):', persistErr)
        }
        await logPrediction(supabase, {
          productId: productRecordId,
          userId: user_id,
          title,
          prediction,
          finalCategory: categoryId,
          finalStatus: 'auto',
          requiresSizeGrid: false,
        })
        console.warn(
          `[ml-publish] Previsões divergentes; seguindo automaticamente com ${categoryId} (${prediction.rawCategoryName ?? 'categoria do título completo'}).`,
        )
      }
    }

    // Carrega atributos da categoria (com cache) para checar SIZE_GRID e
    // reaproveitar a lista completa na montagem do payload abaixo.
    let categoryInfo = await fetchCategoryAttrsCached(categoryId)

    // Bloqueio de fashion sem grade: se a categoria exige SIZE_GRID_ID e o
    // payload não trouxer um `size_grid_id` explícito, gravamos o status
    // 'needs_manual' e devolvemos 409 para o frontend abrir o seletor.
    if (categoryInfo.requiresGrid && !providedSizeGridId) {
      const suggested = prediction ?? {
        categoryId,
        categoryName: '',
        rawPrediction: overrideCategoryRaw || null,
        normalizedPrediction: null,
        normalizedTitle: '',
        requiresSizeGrid: true,
        source: 'raw' as const,
      }
      console.warn(
        `[ml-publish] Categoria ${categoryId} exige SIZE_GRID_ID e o payload não trouxe size_grid_id — bloqueando com 409 CATEGORY_REQUIRES_MANUAL.`,
      )

      if (productRecordId) {
        try {
          await supabase
            .from('catalog_products')
            .update({
              ml_category_id: categoryId,
              ml_category_status: 'needs_manual',
              updated_at: new Date().toISOString(),
            })
            .eq('id', productRecordId)
        } catch (persistErr) {
          console.error('[ml-publish] Falha ao gravar ml_category_status=needs_manual:', persistErr)
        }
        await logPrediction(supabase, {
          productId: productRecordId,
          userId: user_id,
          title,
          prediction,
          finalCategory: categoryId,
          finalStatus: 'needs_manual',
          requiresSizeGrid: true,
        })
      }

      return json({
        error: 'Esta categoria exige uma grade de tamanho. Selecione a categoria e a grade manualmente para publicar.',
        code: 'CATEGORY_REQUIRES_MANUAL',
        predicted_category_id: categoryId,
        predicted_category_name: suggested.categoryName,
        requires_size_grid: true,
      }, 409)
    }

    // Compat: se veio size_grid_id/size_grid_row_id, injetamos como atributos
    // no productRecord.ml_attributes para o pipeline existente montar o item.
    if (providedSizeGridId) {
      const existingAttrs = Array.isArray(productRecord.ml_attributes)
        ? (productRecord.ml_attributes as MLAttribute[])
        : []
      const injected: MLAttribute[] = [
        { id: 'SIZE_GRID_ID', value_name: providedSizeGridId },
        ...(providedSizeGridRowId ? [{ id: 'SIZE_GRID_ROW_ID', value_name: providedSizeGridRowId }] : []),
      ]
      productRecord.ml_attributes = [
        ...existingAttrs.filter((a) => !['SIZE_GRID_ID', 'SIZE_GRID_ROW_ID'].includes(String(a.id))),
        ...injected,
      ]
    }

    const categoryAttrs = categoryInfo.attrs
    const categoryAttrIds = new Set(categoryAttrs.map((a) => cleanText(a.id)))


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
      if (id === 'GENDER') {
        const values = (attrDef.values as Array<{ id?: string; name?: string }> | undefined) ?? []
        mergeAttribute(allAttrs, { id, ...inferGenderValue(title, values) })
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

    // Quando o "Formato de venda" (SALE_FORMAT/UNIT) é enviado, o ML passa a
    // exigir "Unidades por kit" (UNITS_PER_PACK / UNITS_PER_PACKAGE) —
    // erro item.attribute.invalid_sale_units. Preenchemos com 1 sempre que a
    // categoria aceitar o atributo.
    const temFormatoDeVenda = allAttrs.some((a) => ['SALE_FORMAT', 'UNIT', 'SALE_UNIT'].includes(String(a.id)))
    if (temFormatoDeVenda) {
      for (const packId of ['UNITS_PER_PACK', 'UNITS_PER_PACKAGE']) {
        const aceitaNaCategoria = (categoryAttrs as Array<Record<string, unknown>>)
          .some((a) => String(a?.id ?? '') === packId)
        const jaTem = allAttrs.some((a) => String(a.id) === packId)
        if (aceitaNaCategoria && !jaTem) {
          mergeAttribute(allAttrs, { id: packId, value_name: '1' })
          console.log(`[ml-publish] ${packId}=1 adicionado (formato de venda preenchido)`)
        }
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

    // === VARIAÇÕES (Cor/Tamanho...) ===
    // Fonte: catalog_products.variants (o frontend pode mandar junto no payload).
    let variantsSource: unknown = productRecord.variants ?? null
    if (!variantsSource && productRecordId) {
      const { data: variantRow } = await supabase
        .from('catalog_products')
        .select('variants')
        .eq('id', productRecordId)
        .maybeSingle()
      variantsSource = variantRow?.variants ?? null
    }
    const mlVariations = buildMlVariations(
      variantsSource,
      categoryAttrs as unknown as Array<Record<string, unknown>>,
      product.price,
      Math.max(1, Math.floor(Number(product.available_quantity) || 1)),
      pictures,
    )
    if (mlVariations.length > 0) {
      console.log(`[ml-publish] Publicando com ${mlVariations.length} variações:`,
        JSON.stringify(mlVariations.map((v) => (v.attribute_combinations as Array<{ value_name: string }>).map((c) => c.value_name).join('/'))))

      // O ML rejeita (cause 146) quando o MESMO atributo aparece no item e na
      // variação. Tudo que define a variação (COLOR, SIZE...) sai do item.
      const variationAttrIds = new Set<string>()
      for (const v of mlVariations) {
        for (const c of (v.attribute_combinations as Array<{ id?: string }>) ?? []) {
          if (c?.id) variationAttrIds.add(String(c.id))
        }
      }
      if (variationAttrIds.size > 0) {
        for (let i = allAttrs.length - 1; i >= 0; i--) {
          if (variationAttrIds.has(String(allAttrs[i].id))) allAttrs.splice(i, 1)
        }
        console.log('[ml-publish] Atributos removidos do item (definidos na variação):', [...variationAttrIds])
      }
    }


    // === BUILD PAYLOAD ===
    const mlPayload = {
      title,
      // O novo modelo User Products do Mercado Livre exige family_name.
      // Mantemos title para contas/categorias ainda no modelo clássico.
      family_name: title,
      category_id: categoryId,
      price: product.price,
      currency_id: 'BRL',
      available_quantity: Math.max(1, Math.floor(Number(product.available_quantity) || 1)),
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
      // Com variações, o ML exige preço/estoque POR variação — enviar no item
      // inteiro causa erro. `variations` sobrepõe os campos acima.
      ...(mlVariations.length > 0 ? { variations: mlVariations.map(semMetadadosVelo) } : {}),

    }

    console.log('Payload:', JSON.stringify(mlPayload))
    let effectivePayload = mlPayload

    // === PUBLICAÇÃO VIA CATÁLOGO DO ML ===
    // Categorias como Celulares (MLB1055 / domínio MLB-CELLPHONES) são
    // "catalog-only": o ML exige atributos que não temos como preencher
    // (número de homologação Anatel, MODEL de lista fechada, CARRIER,
    // IS_DUAL_SIM...). Nessas categorias o caminho correto é casar o produto
    // com uma ficha do catálogo do ML (`catalog_product_id`) — os atributos
    // passam a vir da própria ficha e o anúncio é aceito.
    const CATALOG_ONLY_CATEGORIES = new Set(['MLB1055'])
    const requiresCatalogListing =
      CATALOG_ONLY_CATEGORIES.has(categoryId) ||
      categoryAttrs.some(a => /ANATEL/i.test(cleanText(a.id)))

    const normalize = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ')

    const findCatalogProductId = async (): Promise<string | null> => {
      const query = normalize(title).split(/\s+/).filter(Boolean).slice(0, 8).join(' ')
      if (!query) return null
      const url = `https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=${encodeURIComponent(query)}`
      try {
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } })
        const data = await res.json()
        if (!res.ok) {
          console.warn('[ml-publish] Busca no catálogo do ML falhou:', JSON.stringify(data).substring(0, 400))
          return null
        }
        const results = arrayFromUnknown((data as Record<string, unknown>)?.results) as Array<Record<string, unknown>>
        if (results.length === 0) {
          console.warn('[ml-publish] Nenhuma ficha de catálogo encontrada para:', query)
          return null
        }
        // Escolhe a ficha com maior sobreposição, mas nunca troca o modelo do
        // aparelho (ex.: Redmi A5 não pode casar com Redmi A3x). Tokens curtos
        // com números são relevantes para modelos e não podem ser descartados.
        const relevantTokens = (value: string) =>
          normalize(value).split(/\s+/).filter(t => t.length > 2 || /\d/.test(t))
        const titleTokens = new Set(relevantTokens(title))
        const extractRedmiModel = (value: string): string | null => {
          const match = normalize(value).match(
            /\b(?:xiaomi\s+)?redmi\s+((?:[a-z]+\s*)?\d+(?:\s*[a-z]+)?)\b/i,
          )
          return match?.[1]?.replace(/\s+/g, '') ?? null
        }
        const requiredModel = extractRedmiModel(title)
        let best: { id: string; score: number; name: string } | null = null
        for (const r of results) {
          const id = cleanText(r.id)
          const name = cleanText(r.name)
          if (!id) continue
          if (requiredModel) {
            const candidateModel = extractRedmiModel(name)
            if (candidateModel !== requiredModel) continue
          }
          const tokens = relevantTokens(name)
          const score = tokens.filter(t => titleTokens.has(t)).length
          if (!best || score > best.score) best = { id, score, name }
        }
        if (!best || best.score < 2) {
          console.warn('[ml-publish] Ficha de catálogo pouco confiável — ignorando.', JSON.stringify(best))
          return null
        }
        console.log(`[ml-publish] Ficha de catálogo escolhida: ${best.id} (${best.name}) score=${best.score}`)
        return best.id
      } catch (err) {
        console.error('[ml-publish] Erro na busca de catálogo:', err)
        return null
      }
    }

    let itemResponse: Response | null = null
    let itemData: any = null

    if (requiresCatalogListing) {
      console.log('[ml-publish] Categoria catalog-only detectada:', categoryId, '— tentando publicar via ficha de catálogo.')
      const mlCatalogProductId = await findCatalogProductId()
      if (mlCatalogProductId) {
        const catalogPayload = {
          title,
          family_name: title,
          catalog_product_id: mlCatalogProductId,
          catalog_listing: true,
          category_id: categoryId,
          price: product.price,
          currency_id: 'BRL',
          available_quantity: Math.max(1, Math.floor(Number(product.available_quantity) || 1)),
          buying_mode: 'buy_it_now',
          condition: 'new',
          listing_type_id: 'gold_special',
          // Celulares só são elegíveis a anúncio de catálogo quando declarados
          // desbloqueados (erro `cellphone_not_unlocked` sem este atributo).
          attributes: [{ id: 'CARRIER', value_name: 'Desbloqueado' }],
          shipping: mlPayload.shipping,
        }
        console.log('Payload (catálogo):', JSON.stringify(catalogPayload))
        itemResponse = await fetch('https://api.mercadolibre.com/items', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(catalogPayload),
        })
        itemData = await itemResponse.json()
        console.log('Item criado (catálogo):', JSON.stringify(itemData).substring(0, 800))
        if (itemResponse.ok && itemData?.id) {
          effectivePayload = catalogPayload as unknown as typeof mlPayload
        } else {
          console.warn('[ml-publish] Publicação por catálogo falhou — voltando ao fluxo normal.')
          itemResponse = null
          itemData = null
        }
      }
    }

    if (!itemResponse) {
      itemResponse = await fetch('https://api.mercadolibre.com/items', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mlPayload),
      })
      itemData = await itemResponse.json()
      console.log('Item criado:', JSON.stringify(itemData).substring(0, 800))
    }


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
      effectivePayload = payloadNoTitle as typeof mlPayload
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
      effectivePayload = payloadNoFn as typeof mlPayload
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

    // Contas migradas para o modelo User Products não aceitam `variations` no
    // mesmo POST: o ML devolve "The field variations is invalid with family
    // name" e, ao mesmo tempo, exige `family_name`. Nesse modelo as variações
    // não vão dentro do item — cada variação é um anúncio próprio que o ML
    // agrupa pelo mesmo `family_name`. Então:
    //   1) tentamos ainda enviar `variations` (contas clássicas aceitam);
    //   2) se o ML insistir no conflito, publicamos a 1ª variação como anúncio
    //      principal e as demais como irmãos do mesmo family_name (logo abaixo,
    //      depois que os atributos obrigatórios já foram acertados).
    let variacoesIrmas: Array<Record<string, unknown>> = []
    if (!itemResponse.ok && mlVariations.length > 0) {
      const msgVar = causeMessages(itemData)
      if (
        msgVar.includes('variations is invalid with family name') ||
        msgVar.includes('family_name') ||
        msgVar.includes('required_fields')
      ) {
        const base = mlPayload as Record<string, unknown>
        const { family_name: _fn, title: _tt, variations: _vv, ...withoutBoth } = base as any

        const tentativas: Array<{ label: string; payload: Record<string, unknown> }> = [
          // Modelo clássico: title + variações, sem family_name.
          { label: 'sem family_name (com variações)', payload: { ...withoutBoth, title: base.title, variations: mlVariations.map(semMetadadosVelo) } },
          // Modelo User Products: family_name + variações, sem title.
          { label: 'sem title (com variações)', payload: { ...withoutBoth, family_name: base.family_name, variations: mlVariations.map(semMetadadosVelo) } },
        ]

        for (const tentativa of tentativas) {
          if (itemResponse.ok) break
          console.warn(`[ml-publish] Reenviando ${tentativa.label}`)
          itemResponse = await fetch('https://api.mercadolibre.com/items', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(tentativa.payload),
          })
          itemData = await itemResponse.json()
          console.log(`Item criado (${tentativa.label}):`, JSON.stringify(itemData).substring(0, 800))
          if (itemResponse.ok) effectivePayload = tentativa.payload as typeof mlPayload
        }

        // Ainda barrado pelo conflito → modelo User Products: um anúncio por
        // variação, todos com o mesmo family_name.
        if (!itemResponse.ok && causeMessages(itemData).includes('variations is invalid with family name')) {
          console.warn('[ml-publish] Conta no modelo User Products — publicando uma variação por anúncio (mesmo family_name)')
          const comboAttrs = (v: Record<string, unknown>) =>
            ((v.attribute_combinations as Array<Record<string, unknown>>) ?? []).map((c) => ({
              id: String(c.id),
              ...(c.value_id ? { value_id: String(c.value_id) } : {}),
              ...(c.value_name ? { value_name: String(c.value_name) } : {}),
            })) as MLAttribute[]

          const payloadDaVariacao = (v: Record<string, unknown>) => ({
            ...withoutBoth,
            family_name: base.family_name,
            available_quantity: Math.max(1, Math.floor(Number(v.available_quantity) || 1)),
            price: Number(v.price) || (base.price as number),
            attributes: [...(withoutBoth.attributes as MLAttribute[]), ...comboAttrs(v)],
          })

          const [primeira, ...restantes] = mlVariations as Array<Record<string, unknown>>
          variacoesIrmas = restantes
          const primeiroPayload = payloadDaVariacao(primeira)
          effectivePayload = primeiroPayload as typeof mlPayload
          itemResponse = await fetch('https://api.mercadolibre.com/items', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(primeiroPayload),
          })
          itemData = await itemResponse.json()
          console.log('Item criado (1ª variação, modelo User Products):', JSON.stringify(itemData).substring(0, 800))
        }
      }
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
          ...effectivePayload,
          category_id: 'MLB1051',
          attributes: (effectivePayload.attributes as MLAttribute[]).filter((a) =>
            !['SIZE_GRID_ID', 'SIZE_GRID_ROW_ID', 'SIZE'].includes(String(a.id))
          ),
        }
        effectivePayload = fallbackPayload as typeof mlPayload
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

    // Rede de segurança para atributos exigidos pelo CATÁLOGO do ML
    // (missing_catalog_required) e por regras CONDICIONAIS
    // (missing_conditional_required — ex.: GTIN para certas categorias).
    // Esses casos não vêm marcados como `required` no endpoint de atributos
    // da categoria, então a montagem inicial não os inclui. Aqui lemos os
    // cause[] retornados pelo ML, preenchemos defaults sensatos e reenviamos.
    if (!itemResponse.ok) {
      const causeArr = arrayFromUnknown((itemData as Record<string, unknown>)?.cause)
      const missingAttrIds = new Set<string>()
      let hasInvalidTitleGender = false
      for (const c of causeArr) {
        if (!c || typeof c !== 'object') continue
        const cc = c as Record<string, unknown>
        const codeStr = cleanText(cc.code).toLowerCase()
        const msgStr  = cleanText(cc.message)
        const attrId  = cleanText(cc.attribute_id).toUpperCase()
        if (codeStr.includes('invalid.title.gender') || /title match the gender/i.test(msgStr)) {
          hasInvalidTitleGender = true
        }
        if (
          codeStr.includes('missing_catalog_required') ||
          codeStr.includes('missing_conditional_required') ||
          codeStr.includes('missing_required')
        ) {
          if (attrId) missingAttrIds.add(attrId)
          // Alguns causes trazem apenas message "The attributes [X] are required..."
          const bracketMatches = msgStr.match(/\[([A-Z0-9_,\s]+)\]/g) || []
          for (const bm of bracketMatches) {
            const inner = bm.slice(1, -1)
            for (const raw of inner.split(',')) {
              const id = raw.trim().toUpperCase()
              if (id && /^[A-Z][A-Z0-9_]*$/.test(id)) missingAttrIds.add(id)
            }
          }
          // Detecta "campo Cor" no texto em pt-BR
          if (/\bcor\b/i.test(msgStr)) missingAttrIds.add('COLOR')
          if (/\bgtin\b/i.test(msgStr) || /c[oó]digo universal/i.test(msgStr)) missingAttrIds.add('GTIN')
          if (/\bmodelo\b/i.test(msgStr) || /\bmodel\b/i.test(msgStr)) missingAttrIds.add('MODEL')
        }
      }

      if (hasInvalidTitleGender) missingAttrIds.add('GENDER')

      if (missingAttrIds.size > 0) {
        console.warn('[ml-publish] Atributos exigidos pelo catálogo/condicional faltando:', Array.from(missingAttrIds))
        const patched = [...(effectivePayload.attributes as MLAttribute[])]
        const has = (id: string) => patched.some(a => String(a.id).toUpperCase() === id)

        // Defaults por atributo conhecido. Priorizamos valores universalmente
        // aceitos pelo ML e que não geram penalização de qualidade.
        const defaults: Record<string, MLAttribute> = {
          GTIN:              { id: 'GTIN', value_name: 'Não aplicável' },
          COLOR:             { id: 'COLOR', value_name: 'Preto' },
          MAIN_COLOR:        { id: 'MAIN_COLOR', value_name: 'Preto' },
          SECONDARY_COLOR:   { id: 'SECONDARY_COLOR', value_name: 'Preto' },
          COLOR_FAMILY:      { id: 'COLOR_FAMILY', value_name: 'Preto' },
          GENDER:            { id: 'GENDER', value_name: 'Sem gênero' },
          AGE_GROUP:         { id: 'AGE_GROUP', value_name: 'Adultos' },
          ITEM_CONDITION:    { id: 'ITEM_CONDITION', value_name: 'Novo' },
          MPN:               { id: 'MPN', value_name: cleanText(productRecord.external_id) || 'N/D' },
          MANUFACTURER:      { id: 'MANUFACTURER', value_name: 'Genérica' },
          MODEL:             { id: 'MODEL', value_name: 'Não especificado' },
          LINE:              { id: 'LINE', value_name: 'N/D' },
          IS_KIT:            { id: 'IS_KIT', value_name: 'Não' },
          UNITS_PER_PACKAGE: { id: 'UNITS_PER_PACKAGE', value_name: '1' },
          ITEMS_PER_PACK:    { id: 'ITEMS_PER_PACK', value_name: '1' },
          PACKAGE_TYPE:      { id: 'PACKAGE_TYPE', value_name: 'Caixa' },
        }

        for (const id of missingAttrIds) {
          if (id === 'GENDER') {
            const genderDef = categoryAttrs.find(a => cleanText(a.id) === 'GENDER')
            const values = (genderDef?.values as Array<{ id?: string; name?: string }> | undefined) ?? []
            const inferred = inferGenderValue(title, values)
            const existingIndex = patched.findIndex(a => String(a.id).toUpperCase() === 'GENDER')
            const genderAttr = { id: 'GENDER', ...inferred }
            if (existingIndex >= 0) patched[existingIndex] = genderAttr
            else patched.push(genderAttr)
            continue
          }
          if (has(id)) continue
          const def = defaults[id]
          if (def) {
            const attrDef = categoryAttrs.find(a => cleanText(a.id).toUpperCase() === id) as Record<string, unknown> | undefined
            const resolved = attrDef
              ? resolveAgainstList(attrDef, {
                  ...(def.value_id ? { value_id: def.value_id } : {}),
                  ...(def.value_name ? { value_name: def.value_name } : {}),
                })
              : def
            patched.push({ id, ...resolved })
          } else {
            // Fallback genérico — melhor que travar o anúncio.
            patched.push({ id, value_name: 'N/D' })
          }
        }

        const retryPayload = { ...effectivePayload, attributes: patched }
        console.log('[ml-publish] Retry com atributos catálogo/condicional preenchidos:',
          patched.filter(a => missingAttrIds.has(String(a.id).toUpperCase()))
                 .map(a => `${a.id}=${a.value_id ?? a.value_name}`))
        itemResponse = await fetch('https://api.mercadolibre.com/items', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(retryPayload),
        })
        itemData = await itemResponse.json()
        console.log('Item criado (retry catálogo/condicional):', JSON.stringify(itemData).substring(0, 800))
      }
    }

    // Última tentativa: se o ML recusou por exigência de catálogo/Anatel em
    // uma categoria que não estava no mapa catalog-only, tenta casar com a
    // ficha do catálogo (mesmo caminho da publicação de celulares).
    if ((!itemResponse.ok || !itemData?.id) && !requiresCatalogListing) {
      const msg = causeMessages(itemData)
      if (/anatel|catalog_listing|catalog_product|homologa/i.test(msg)) {
        const lateCatalogId = await findCatalogProductId()
        if (lateCatalogId) {
          const latePayload = {
            title,
            family_name: title,
            catalog_product_id: lateCatalogId,
            catalog_listing: true,
            category_id: categoryId,
            price: product.price,
            currency_id: 'BRL',
            available_quantity: Math.max(1, Math.floor(Number(product.available_quantity) || 1)),
            buying_mode: 'buy_it_now',
            condition: 'new',
            listing_type_id: 'gold_special',
            attributes: [{ id: 'CARRIER', value_name: 'Desbloqueado' }],
            shipping: mlPayload.shipping,
          }
          console.warn('[ml-publish] Retry via ficha de catálogo após recusa do ML.')
          itemResponse = await fetch('https://api.mercadolibre.com/items', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(latePayload),
          })
          itemData = await itemResponse.json()
          console.log('Item criado (retry catálogo):', JSON.stringify(itemData).substring(0, 800))
        }
      }
    }

    if (!itemResponse.ok || !itemData?.id) {

      console.error('Erro ao criar produto:', JSON.stringify(itemData))
      const mapped = itemResponse.ok
        ? { message: 'Falha ao criar produto no Mercado Livre.' as string, code: undefined as string | undefined, seller_codes: undefined as string[] | undefined }
        : mapMLError(itemData)
      if (/anatel|homologa/i.test(causeMessages(itemData))) {
        mapped.message = 'O Mercado Livre exige o número de homologação Anatel para este produto e não encontramos uma ficha de catálogo compatível. Escolha outro produto ou publique manualmente pelo Mercado Livre.'
        mapped.code = 'ANATEL_REQUIRED'
      }

      // Registro para auditoria: permite ver se um bloqueio é isolado ou geral.
      try {
        await supabase.from('ml_publish_errors').insert({
          user_id,
          ml_user_id: itemData?.seller_id ? String(itemData.seller_id) : null,
          http_status: itemResponse.status,
          raw_response: itemData,
          cause: arrayFromUnknown(itemData?.cause),
          mapped_code: mapped.code ?? null,
          mapped_message: mapped.message,
          product_title: title,
          category_id: categoryId ?? null,
        })
      } catch (logErr) {
        console.error('[ml-publish] Falha ao registrar erro de publicação:', logErr)
      }

      await notifyUser(supabase, {
        user_id,
        type: 'publication_error',
        title: 'Erro de publicacao',
        message: `${title}: ${mapped.message}`,
        action_url: '/dashboard/produtos',
        metadata: {
          product_title: title,
          code: mapped.code ?? null,
          ml_response: itemData,
        },
      })
      return json({ error: mapped.message, code: mapped.code, seller_codes: mapped.seller_codes ?? null, details: itemData }, 400)
    }


    const itemId = itemData.id as string
    console.log('Item ID:', itemId)

    // Modelo User Products: as demais variações viram anúncios irmãos, com o
    // mesmo family_name (é assim que o ML agrupa as opções na vitrine).
    // Reaproveitamos os atributos já aceitos no anúncio principal, trocando só
    // a combinação da variação.
    if (variacoesIrmas.length > 0) {
      const attrsAceitos = ((effectivePayload as Record<string, unknown>).attributes as MLAttribute[]) ?? []
      const idsDaCombinacao = new Set(
        variacoesIrmas.flatMap((v) =>
          ((v.attribute_combinations as Array<Record<string, unknown>>) ?? []).map((c) => String(c.id).toUpperCase()),
        ),
      )
      const attrsBase = attrsAceitos.filter((a) => !idsDaCombinacao.has(String(a.id).toUpperCase()))

      for (const v of variacoesIrmas) {
        const combo = ((v.attribute_combinations as Array<Record<string, unknown>>) ?? []).map((c) => ({
          id: String(c.id),
          ...(c.value_id ? { value_id: String(c.value_id) } : {}),
          ...(c.value_name ? { value_name: String(c.value_name) } : {}),
        })) as MLAttribute[]
        const payloadIrmao = {
          ...(effectivePayload as Record<string, unknown>),
          available_quantity: Math.max(1, Math.floor(Number(v.available_quantity) || 1)),
          price: Number(v.price) || (effectivePayload as Record<string, unknown>).price,
          attributes: [...attrsBase, ...combo],
        }
        try {
          const resIrmao = await fetch('https://api.mercadolibre.com/items', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payloadIrmao),
          })
          const dataIrmao = await resIrmao.json()
          if (resIrmao.ok && dataIrmao?.id) {
            console.log('[ml-publish] Variação irmã publicada:', dataIrmao.id, JSON.stringify(combo))
          } else {
            console.warn('[ml-publish] Falha ao publicar variação irmã:', JSON.stringify(dataIrmao).substring(0, 500))
          }
        } catch (erroIrmao) {
          console.warn('[ml-publish] Erro ao publicar variação irmã:', erroIrmao)
        }
      }
    }

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
      } else {
        await notifyUser(supabase, {
          user_id,
          type: 'product_published',
          title: 'Produto publicado',
          message: `${title} ja esta ativo no Mercado Livre.`,
          action_url: '/dashboard/publicacoes',
          metadata: {
            ml_item_id: itemId,
            permalink: itemData.permalink,
            product_title: title,
          },
        })
      }
    } catch (pubErr) {
      console.error('Erro ao salvar publicação:', pubErr)
    }

    // Persistir categoria confirmada + status em catalog_products e log de predição.
    if (productRecordId) {
      try {
        await supabase
          .from('catalog_products')
          .update({
            ml_category_id: categoryId,
            ml_category_status: categoryStatusForRecord,
            ml_size_grid_id: providedSizeGridId || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', productRecordId)
      } catch (persistErr) {
        console.error('[ml-publish] Falha ao gravar categoria confirmada:', persistErr)
      }
      await logPrediction(supabase, {
        productId: productRecordId,
        userId: user_id,
        title,
        prediction,
        finalCategory: categoryId,
        finalStatus: categoryStatusForRecord,
        requiresSizeGrid: Boolean(providedSizeGridId),
      })
    }

    console.log('=== ml-publish SUCCESS ===', itemId)
    return json({ success: true, permalink: itemData.permalink, item_id: itemId })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('ml-publish error:', message)
    return json({ error: message }, 500)
  }
})
