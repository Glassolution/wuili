// =====================================================================
// Sanitização de conteúdo antes de publicar no Mercado Livre.
//
// Objetivo: evitar e-mails de "revisar anúncio por violação de diretrizes".
// Três eixos:
//   1. Imagens: nunca publicar arte de catálogo do fornecedor / marca d'água
//      / texto promocional sobreposto.
//   2. Descrição: remover qualquer HTML/DOM copiado do próprio Mercado Livre
//      e gerar texto próprio via IA a partir dos specs.
//   3. Título: remover termos proibidos, reticências de corte e marcas que
//      não vieram do atributo BRAND validado pela categoria.
// =====================================================================

const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions'
const AI_MODEL = 'google/gemini-3.6-flash'

async function callAI(
  messages: unknown[],
  opts: { maxTokens?: number; timeoutMs?: number } = {},
): Promise<string | null> {
  const key = Deno.env.get('LOVABLE_API_KEY')
  if (!key) return null
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 25000)
  try {
    const res = await fetch(AI_GATEWAY, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages,
        max_tokens: opts.maxTokens ?? 700,
      }),
      signal: ctrl.signal,
    })
    if (!res.ok) {
      console.warn('[ml-sanitizer] IA retornou', res.status, (await res.text()).slice(0, 300))
      return null
    }
    const data = await res.json()
    const text = data?.choices?.[0]?.message?.content
    return typeof text === 'string' ? text.trim() : null
  } catch (err) {
    console.warn('[ml-sanitizer] falha na IA:', String(err).slice(0, 200))
    return null
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------
// 1. FILTRO DE IMAGENS
// ---------------------------------------------------------------------

// Padrões de URL/nome de arquivo que denunciam arte de catálogo do fornecedor
// (C7Drop e similares) — banners, encartes, "arte pronta", combos promocionais.
const DIRTY_URL_PATTERNS: RegExp[] = [
  /c7drop/i,
  /\barte(s)?\b/i,
  /banner/i,
  /encarte/i,
  /promo(cao|cional|tion)?[-_./]/i,
  /oferta/i,
  /desconto/i,
  /black[-_]?friday/i,
  /combo/i,
  /capa[-_]?(post|feed|story)/i,
  /post[-_]?(feed|insta|story)/i,
  /story|stories/i,
  /divulga(cao|r)/i,
  /marca[-_]?dagua|watermark|marcadagua/i,
  /catalogo[-_]?(arte|post|banner)/i,
  /whatsapp|wa[-_]?image/i,
]

export function isSuspiciousImageUrl(url: string): boolean {
  const u = String(url ?? '')
  if (!u) return true
  const path = (() => {
    try { return decodeURIComponent(new URL(u).pathname) } catch { return u }
  })()
  return DIRTY_URL_PATTERNS.some((re) => re.test(path))
}

type VisionVerdict = { url: string; clean: boolean; reason?: string }

// Checagem visual via IA: detecta marca d'água, logo de loja, texto promocional
// sobreposto e arte de catálogo. Fail-open por imagem (se a IA falhar, mantém a
// decisão heurística), para não travar publicações por indisponibilidade.
async function visionCheck(url: string): Promise<VisionVerdict> {
  const raw = await callAI(
    [
      {
        role: 'system',
        content:
          'Você audita imagens de produto para o Mercado Livre. Responda APENAS com JSON: ' +
          '{"clean":true|false,"reason":"..."}. ' +
          'clean=false se a imagem tiver marca d\'água, logo/nome de loja ou fornecedor, ' +
          'texto promocional sobreposto (preço, "oferta", "frete grátis", "compre já"), ' +
          'selos, colagens/artes de catálogo, molduras ou banners. ' +
          'clean=true apenas para foto limpa do produto, sem texto e sem marca d\'água.',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Esta imagem pode ser publicada como foto de produto?' },
          { type: 'image_url', image_url: { url } },
        ],
      },
    ],
    { maxTokens: 120, timeoutMs: 20000 },
  )
  if (!raw) return { url, clean: true, reason: 'vision_unavailable' }
  try {
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
    return { url, clean: parsed?.clean !== false, reason: parsed?.reason }
  } catch {
    return { url, clean: true, reason: 'vision_unparsed' }
  }
}

export type ImageFilterResult = {
  clean: string[]
  rejected: { url: string; reason: string }[]
}

/**
 * Filtra imagens, removendo artes de catálogo/marca d'água/texto promocional.
 * Combina heurística de URL (barata, determinística) com checagem visual por IA.
 */
export async function filterCleanImages(
  urls: string[],
  opts: { useVision?: boolean; max?: number } = {},
): Promise<ImageFilterResult> {
  const max = opts.max ?? 6
  const rejected: { url: string; reason: string }[] = []
  const candidates: string[] = []

  for (const url of urls) {
    if (isSuspiciousImageUrl(url)) {
      rejected.push({ url, reason: 'arte/banner do fornecedor detectado na URL' })
    } else {
      candidates.push(url)
    }
  }

  if (opts.useVision === false || candidates.length === 0) {
    return { clean: candidates.slice(0, max), rejected }
  }

  const verdicts = await Promise.all(candidates.slice(0, max + 4).map(visionCheck))
  const clean: string[] = []
  for (const v of verdicts) {
    if (v.clean) clean.push(v.url)
    else rejected.push({ url: v.url, reason: v.reason || 'marca d\'água ou texto promocional na imagem' })
  }
  return { clean: clean.slice(0, max), rejected }
}

// ---------------------------------------------------------------------
// 2. SANITIZAÇÃO DE DESCRIÇÃO
// ---------------------------------------------------------------------

/** Remove todo HTML/DOM (inclusive classes do Mercado Livre) e ruído de terceiros. */
export function stripMLHtml(input: string): string {
  let text = String(input ?? '')
  // Remove blocos inteiros que costumam vir do DOM do ML
  text = text.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')
  // Quebras de linha semânticas antes de remover tags
  text = text.replace(/<\s*(br|\/p|\/div|\/li|\/tr|\/h[1-6])\s*\/?>/gi, '\n')
  // Remove qualquer tag remanescente
  text = text.replace(/<[^>]*>/g, ' ')
  // Entidades HTML comuns
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
  // Nomes de classes do DOM do ML que sobrevivem como texto solto
  text = text.replace(/\b(ui-vpp|ui-pdp|andes|ui-search|poly-component)[-\w]*/gi, ' ')
  // Menções a marketplaces / dados fiscais copiados
  text = text
    .replace(/\bmercado\s*(livre|libre|pago|envios|shops)\b/gi, ' ')
    .replace(/\b(shopee|amazon|magalu|shein|aliexpress|c7\s*drop|c7drop)\b/gi, ' ')
    .replace(/\b(ean|gtin|ncm|sku|mpn|cnpj)\s*[:=]?\s*[\w.\-/]*/gi, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/gi, ' ')
    .replace(/\b(\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4})\b/g, ' ')
  // Espaços
  return text
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+|\s+$/g, '')
}

export function looksLikeMLDom(input: string): boolean {
  return /<[a-z][\s\S]*>/i.test(String(input ?? '')) ||
    /\b(ui-vpp|ui-pdp|andes-|ui-search)/i.test(String(input ?? ''))
}

export type DescriptionInput = {
  title: string
  categoryName?: string
  attributes?: { id: string; value_name?: string; value_id?: string }[]
  rawDescription?: string
}

/**
 * Gera descrição própria via IA a partir dos specs. O texto original só é
 * usado como referência factual já higienizada (nunca copiado).
 */
export async function buildSafeDescription(input: DescriptionInput): Promise<string> {
  const sanitizedSource = stripMLHtml(input.rawDescription ?? '').slice(0, 1500)
  const specs = (input.attributes ?? [])
    .map((a) => `${a.id}: ${a.value_name ?? a.value_id ?? ''}`)
    .filter((s) => !/:\s*(N\/D)?$/i.test(s))
    .slice(0, 25)
    .join('\n')

  const ai = await callAI([
    {
      role: 'system',
      content:
        'Você escreve descrições ORIGINAIS de produto para o Mercado Livre, em português do Brasil. ' +
        'Regras rígidas: nunca copie texto de terceiros; não use HTML nem markdown; ' +
        'não cite Mercado Livre, Shopee, Amazon, AliExpress, C7Drop ou qualquer loja/fornecedor; ' +
        'não invente certificações, garantias, prazos de entrega, EAN, NCM ou preços; ' +
        'não use termos como "original", "melhor preço", "promoção", "imperdível", "frete grátis"; ' +
        'não inclua links, telefones ou e-mails. ' +
        'Formato: 1 parágrafo curto de apresentação + 3 a 6 linhas de características iniciadas por "- ". ' +
        'Máximo 900 caracteres.',
    },
    {
      role: 'user',
      content:
        `Produto: ${input.title}\n` +
        (input.categoryName ? `Categoria: ${input.categoryName}\n` : '') +
        (specs ? `Especificações:\n${specs}\n` : '') +
        (sanitizedSource ? `Referência factual (apenas para extrair fatos, NÃO copiar):\n${sanitizedSource}` : ''),
    },
  ], { maxTokens: 600 })

  const fallback = () => {
    const lines = (input.attributes ?? [])
      .filter((a) => a.value_name && a.value_name !== 'N/D')
      .slice(0, 6)
      .map((a) => `- ${a.id.replace(/_/g, ' ').toLowerCase()}: ${a.value_name}`)
    return [
      `${input.title}.`,
      '',
      ...(lines.length ? lines : ['- Produto novo, pronta entrega.']),
    ].join('\n')
  }

  const text = stripMLHtml(ai ?? '')
  if (!text || text.length < 40) return fallback().slice(0, 900)
  return text.slice(0, 900)
}

// ---------------------------------------------------------------------
// 3. SANITIZAÇÃO DE TÍTULO
// ---------------------------------------------------------------------

const FORBIDDEN_TITLE_TERMS: RegExp[] = [
  /\boriginal(is)?\b/gi,
  /\bpromo(c|ç)(a|ã)o\b/gi,
  /\bpromo\b/gi,
  /\bmelhor\s+pre(c|ç)o\b/gi,
  /\bmenor\s+pre(c|ç)o\b/gi,
  /\bimperd(i|í)vel\b/gi,
  /\bfrete\s+gr(a|á)tis\b/gi,
  /\benvio\s+(imediato|r(a|á)pido)\b/gi,
  /\bpronta\s+entrega\b/gi,
  /\bem\s+oferta\b/gi,
  /\boferta\b/gi,
  /\bdesconto\b/gi,
  /\bliquida(c|ç)(a|ã)o\b/gi,
  /\bqueima\s+de\s+estoque\b/gi,
  /\bblack\s*friday\b/gi,
  /\b12x\b/gi,
  /\bpre(c|ç)o\s+de\s+f(a|á)brica\b/gi,
  /\bgarantia\s+vital(i|í)cia\b/gi,
  /\b100%\b/gi,
  /\bmais\s+vendido\b/gi,
  /\bl(a|á)ncamento\b/gi,
  /\bnovo\s+lacrado\b/gi,
  /\bmercado\s*(livre|pago|envios)\b/gi,
  /\b(shopee|amazon|aliexpress|magalu|shein|c7\s*drop|c7drop)\b/gi,
  /\bfull\b/gi,
  /[⭐★🔥✅🎁💥🚀]/g,
]

export type TitleSanitizeResult = {
  title: string
  removedTerms: string[]
}

/**
 * Sanitiza o título:
 * - remove termos proibidos/promocionais e emojis
 * - remove reticências de corte
 * - remove a marca do texto copiado; só reinsere se `validatedBrand` vier do
 *   atributo BRAND validado pela categoria
 */
export function sanitizeTitle(
  rawTitle: string,
  opts: { validatedBrand?: string | null; maxLength?: number } = {},
): TitleSanitizeResult {
  const maxLength = opts.maxLength ?? 60
  const removedTerms: string[] = []
  let title = String(rawTitle ?? '')

  // HTML/entidades eventualmente copiadas
  title = stripMLHtml(title)

  // Reticências de corte (…, ..., .. no fim ou soltas)
  title = title.replace(/\u2026/g, ' ').replace(/\.{2,}/g, ' ')

  for (const re of FORBIDDEN_TITLE_TERMS) {
    const found = title.match(re)
    if (found) {
      removedTerms.push(...found.map((f) => f.trim()).filter(Boolean))
      title = title.replace(re, ' ')
    }
  }

  // Marca: remove qualquer ocorrência e reinsere só se validada.
  const brand = String(opts.validatedBrand ?? '').trim()
  if (brand) {
    const esc = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    title = title.replace(new RegExp(`\\b${esc}\\b`, 'gi'), ' ')
  }

  // Ruído estrutural
  title = title
    .replace(/[|/\\]+/g, ' ')
    .replace(/\s*[-–—]\s*$/g, '')
    .replace(/\(\s*\)|\[\s*\]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()

  if (brand) {
    title = `${brand} ${title}`.replace(/\s{2,}/g, ' ').trim()
  }

  if (title.length > maxLength) {
    // Corta em fronteira de palavra, SEM reticências.
    const cut = title.slice(0, maxLength)
    const lastSpace = cut.lastIndexOf(' ')
    title = (lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trim()
  }

  title = title.replace(/[\s\-–—,;:]+$/g, '').trim()

  return { title, removedTerms: [...new Set(removedTerms)] }
}
