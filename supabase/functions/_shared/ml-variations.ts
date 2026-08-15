// Mapeamento de variações do catálogo (C7Drop/AliExpress) para o formato
// `variations[]` do Mercado Livre.
//
// Regras da Fase 1 (aprovadas no plano):
//  - só publicamos variações quando existe UMA única dimensão real
//    (ex.: só "Cor" ou só "Tamanho"). 2+ dimensões → item simples, porque o
//    fornecedor não entrega o vínculo entre as dimensões (Cor x Tamanho) e um
//    produto cartesiano inventaria combinações que não existem em estoque.
//  - tiers internos do fornecedor ("Compra", "Kit", "Promoção") nunca viram
//    variação no ML.
//  - valor sem correspondência na lista fechada do ML vai como `value_name`
//    livre; se o ML rejeitar, removemos só aquela variação.

export type RawVariant = {
  name?: string | null
  value?: string | null
  value_id?: string | null
  stock?: number | null
  sku?: string | null
  cost_price?: number | null
  [key: string]: unknown
}

export type MLVariation = {
  attribute_combinations: Array<{ id: string; value_id?: string; value_name?: string }>
  available_quantity: number
  price: number
  attributes?: Array<{ id: string; value_name: string }>
}

export type CategoryAttrDef = Record<string, unknown>

function norm(value: unknown): string {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

// Tiers de compra/atacado do fornecedor — não são característica do produto.
const IGNORED_DIMENSIONS = new Set([
  'compra', 'compras', 'kit', 'kits', 'promocao', 'oferta', 'lote', 'atacado', 'pacote',
])

// Dimensão do fornecedor → atributo do Mercado Livre.
const DIMENSION_TO_ML_ATTR: Array<{ attr: string; synonyms: string[] }> = [
  { attr: 'COLOR', synonyms: ['cor', 'cores', 'color', 'colour', 'cor principal'] },
  { attr: 'SIZE', synonyms: ['tamanho', 'tam', 'size', 'medida', 'numeracao'] },
  { attr: 'CAPACITY', synonyms: ['capacidade', 'armazenamento', 'memoria', 'capacity'] },
  { attr: 'VOLTAGE', synonyms: ['voltagem', 'tensao', 'volts', 'voltage'] },
  { attr: 'MODEL', synonyms: ['modelo', 'model'] },
  { attr: 'FLAVOR', synonyms: ['sabor'] },
  { attr: 'PACKAGE_UNITS', synonyms: ['quantidade', 'unidades'] },
]

export type DetectedDimension = {
  name: string
  values: string[]
  variants: RawVariant[]
}

export type DetectResult = {
  supported: boolean
  reason: string
  dimension: DetectedDimension | null
  allDimensions: DetectedDimension[]
}

export function parseVariants(raw: unknown): RawVariant[] {
  let value = raw
  if (typeof value === 'string') {
    try { value = JSON.parse(value) } catch { return [] }
  }
  if (!Array.isArray(value)) return []
  return value.filter((v) => v && typeof v === 'object') as RawVariant[]
}

export function detectDimensions(raw: unknown): DetectResult {
  const variants = parseVariants(raw)
  if (variants.length === 0) {
    return { supported: false, reason: 'sem_variacoes', dimension: null, allDimensions: [] }
  }

  const byName = new Map<string, DetectedDimension>()
  for (const v of variants) {
    const name = String(v.name ?? '').trim()
    const value = String(v.value ?? '').trim()
    if (!name || !value) continue
    if (IGNORED_DIMENSIONS.has(norm(name))) continue
    const key = norm(name)
    const entry = byName.get(key) ?? { name, values: [], variants: [] }
    // valores duplicados (mesma cor em SKUs diferentes) contam uma vez só
    if (!entry.values.some((existing) => norm(existing) === norm(value))) {
      entry.values.push(value)
      entry.variants.push(v)
    }
    byName.set(key, entry)
  }

  const all = Array.from(byName.values())
  const real = all.filter((d) => d.values.length >= 2)

  if (real.length === 0) {
    return { supported: false, reason: 'sem_dimensao_com_2_valores', dimension: null, allDimensions: all }
  }
  if (real.length > 1) {
    return { supported: false, reason: 'multiplas_dimensoes', dimension: null, allDimensions: all }
  }
  return { supported: true, reason: 'ok', dimension: real[0], allDimensions: all }
}

// Atributos da categoria que aceitam variação (`tags.allow_variations`).
export function getVariationAttributes(categoryAttrs: CategoryAttrDef[]): CategoryAttrDef[] {
  return (categoryAttrs ?? []).filter((a) => {
    const tags = (a?.tags as Record<string, unknown> | undefined) ?? {}
    return Boolean(tags.allow_variations)
  })
}

// Casa a dimensão do fornecedor com um atributo de variação da categoria.
export function matchVariationAttribute(
  dimensionName: string,
  variationAttrs: CategoryAttrDef[],
): CategoryAttrDef | null {
  const n = norm(dimensionName)
  const mapped = DIMENSION_TO_ML_ATTR.find((m) => m.synonyms.includes(n))?.attr

  if (mapped) {
    const byId = variationAttrs.find((a) => String(a.id ?? '').toUpperCase() === mapped)
    if (byId) return byId
    // COLOR nem sempre existe; algumas categorias usam MAIN_COLOR.
    if (mapped === 'COLOR') {
      const alt = variationAttrs.find((a) => ['MAIN_COLOR', 'COLOR_FAMILY'].includes(String(a.id ?? '').toUpperCase()))
      if (alt) return alt
    }
  }

  // Fallback: nome do atributo no ML bate com o nome da dimensão.
  const byName = variationAttrs.find((a) => norm(a.name) === n)
  return byName ?? null
}

// Resolve o valor contra a lista fechada da categoria. Sem match → value_name livre.
export function resolveValueId(
  value: string,
  attrDef: CategoryAttrDef | null,
): { value_id?: string; value_name?: string } {
  const values = (attrDef?.values as Array<{ id?: string; name?: string }> | undefined) ?? []
  if (values.length === 0) return { value_name: value }
  const n = norm(value)
  const exact = values.find((v) => norm(v.name) === n)
  if (exact?.id) return { value_id: exact.id, value_name: exact.name }
  const partial = values.find((v) => {
    const vn = norm(v.name)
    return vn && (vn.includes(n) || n.includes(vn))
  })
  if (partial?.id) return { value_id: partial.id, value_name: partial.name }
  return { value_name: value }
}

export type BuildResult = {
  variations: MLVariation[]
  attributeId: string | null
  dimensionName: string | null
  reason: string
  // valor original do fornecedor por índice de variação (para logs/remoção)
  sourceValues: string[]
}

export function buildVariations(params: {
  rawVariants: unknown
  categoryAttrs: CategoryAttrDef[]
  price: number
  quantityPerVariation?: number
}): BuildResult {
  const empty: BuildResult = {
    variations: [], attributeId: null, dimensionName: null, reason: 'nao_aplicavel', sourceValues: [],
  }

  const detected = detectDimensions(params.rawVariants)
  if (!detected.supported || !detected.dimension) {
    return { ...empty, reason: detected.reason }
  }

  const variationAttrs = getVariationAttributes(params.categoryAttrs)
  if (variationAttrs.length === 0) {
    return { ...empty, reason: 'categoria_sem_variacoes' }
  }

  const attrDef = matchVariationAttribute(detected.dimension.name, variationAttrs)
  if (!attrDef) {
    return { ...empty, reason: 'atributo_nao_suportado_pela_categoria' }
  }

  const attributeId = String(attrDef.id ?? '')
  const qty = Math.max(1, params.quantityPerVariation ?? 10)
  const variations: MLVariation[] = []
  const sourceValues: string[] = []

  for (const v of detected.dimension.variants) {
    const value = String(v.value ?? '').trim()
    if (!value) continue
    const resolved = resolveValueId(value, attrDef)
    variations.push({
      attribute_combinations: [{ id: attributeId, ...resolved }],
      available_quantity: qty,
      price: params.price,
    })
    sourceValues.push(value)
  }

  if (variations.length < 2) {
    return { ...empty, reason: 'menos_de_2_variacoes_validas' }
  }

  return {
    variations,
    attributeId,
    dimensionName: detected.dimension.name,
    reason: 'ok',
    sourceValues,
  }
}

// Dado o corpo de erro do ML, descobre quais valores de variação foram
// rejeitados (para remover só aquelas combinações e republicar o resto).
export function findRejectedVariationValues(errorBody: unknown, sourceValues: string[]): string[] {
  const text = norm(JSON.stringify(errorBody ?? {}))
  if (!text) return []
  const rejected: string[] = []
  for (const value of sourceValues) {
    const n = norm(value)
    if (n.length >= 2 && text.includes(n)) rejected.push(value)
  }
  return rejected
}

export function isVariationRelatedError(errorBody: unknown): boolean {
  const text = norm(JSON.stringify(errorBody ?? {}))
  return (
    text.includes('variation') ||
    text.includes('attribute_combination') ||
    text.includes('combinations')
  )
}

// Depois de publicar, o ML normaliza os valores livres e devolve value_id.
// Guardamos esse aprendizado no nosso catálogo (`variants[].value_id`).
export function mergeNormalizedValueIds(
  rawVariants: unknown,
  normalized: Array<{ name: string; value_name: string; value_id: string | null }>,
): RawVariant[] {
  const variants = parseVariants(rawVariants)
  if (variants.length === 0 || normalized.length === 0) return variants
  return variants.map((v) => {
    const value = String(v.value ?? '')
    const hit = normalized.find((n) => norm(n.value_name) === norm(value))
    if (!hit?.value_id) return v
    return { ...v, value_id: hit.value_id, ml_value_name: hit.value_name }
  })
}

// ===== Abordagem A: um item SIMPLES por variação =====
// Guarda de "dimensão real": só publicamos N anúncios quando a dimensão é
// claramente uma característica do produto (Cor, Tamanho, Voltagem,
// Capacidade), com no mínimo 2 e no máximo 6 valores. Tiers internos do
// fornecedor ("Compra: Dropshipping", "Kit", ...) nunca passam.
export const REAL_DIMENSION_ATTRS = ['COLOR', 'SIZE', 'VOLTAGE', 'CAPACITY'] as const

export const MIN_VARIATION_VALUES = 2
export const MAX_VARIATION_VALUES = 6

export type DimensionGuardResult = {
  ok: boolean
  reason: string
  attributeId: string | null
  name: string | null
  values: string[]
  allDimensions: Array<{ name: string; values: string[] }>
}

export function selectPublishableDimension(rawVariants: unknown): DimensionGuardResult {
  const detected = detectDimensions(rawVariants)
  const allDimensions = detected.allDimensions.map((d) => ({ name: d.name, values: d.values }))
  const base = { ok: false, attributeId: null, name: null, values: [] as string[], allDimensions }

  if (!detected.supported || !detected.dimension) {
    return { ...base, reason: detected.reason }
  }

  const dim = detected.dimension
  const mapped = DIMENSION_TO_ML_ATTR.find((m) => m.synonyms.includes(norm(dim.name)))?.attr ?? null
  if (!mapped || !REAL_DIMENSION_ATTRS.includes(mapped as typeof REAL_DIMENSION_ATTRS[number])) {
    return { ...base, reason: 'dimensao_nao_permitida', name: dim.name, values: dim.values }
  }

  // valores únicos, sem vazios e sem tiers escondidos no próprio valor
  const values: string[] = []
  for (const v of dim.values) {
    const clean = String(v ?? '').trim()
    if (!clean) continue
    if (IGNORED_DIMENSIONS.has(norm(clean))) continue
    if (values.some((e) => norm(e) === norm(clean))) continue
    values.push(clean)
  }

  if (values.length < MIN_VARIATION_VALUES) {
    return { ...base, reason: 'menos_de_2_valores', name: dim.name, values }
  }
  if (values.length > MAX_VARIATION_VALUES) {
    return { ...base, reason: 'mais_de_6_valores', name: dim.name, values }
  }

  return { ok: true, reason: 'ok', attributeId: mapped, name: dim.name, values, allDimensions }
}
