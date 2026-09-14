// Filtros e classificação compartilhados entre scrapers de catálogo (b2drop, c7drop, …).
// Mantenha esta lista como fonte única — qualquer scraper deve importar daqui.

export const BLOCKLIST: string[] = [
  "vibrador",
  "erotico",
  "sexual",
  "libido",
  "afrodisiaco",
  "penis",
  "vagina",
  "bdsm",
  "lingerie sensual",
];

export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function isBlocked(title: string): boolean {
  const haystack = stripAccents(title).toLowerCase();
  return BLOCKLIST.some((w) => haystack.includes(w));
}

// "Anúncios em Massa - Amazon/Shopee/Mercado Livre/BLING..." são pacotes de
// anúncios prontos que a C7 Drop vende como se fossem produtos no WooCommerce.
// Não são produtos físicos — devem ser ignorados pelo catálogo do Velo.
export function isFakeAdProduct(title: string, productUrl?: string | null): boolean {
  const t = stripAccents(title).toLowerCase().trim();
  if (t.startsWith("anuncios em massa") || t.startsWith("anuncio em massa")) return true;
  if (productUrl && /\/anuncios?-em-massa/i.test(productUrl)) return true;
  return false;
}

// ============================================================================
// CELULARES / SMARTPHONES (domínio MLB-CELLPHONES / categoria MLB1055)
// ----------------------------------------------------------------------------
// O Mercado Livre exige, para essa categoria, número de homologação da Anatel,
// GTIN, modelo, cor, operadora e dual SIM — atributos que o fluxo automático da
// Velo não tem como preencher. Publicar sempre falha, então o aparelho não pode
// nem aparecer no catálogo (mesma política dos produtos com menos de 3 fotos).
// Acessórios (capa, película, carregador, fone, suporte…) continuam liberados.
// ============================================================================

const CELLPHONE_KEYWORDS: string[] = [
  "smartphone",
  "smart phone",
  "aparelho celular",
  "telefone celular",
  "iphone 1",
  "iphone x",
  "apple iphone",
  "galaxy a",
  "galaxy s",
  "galaxy m",
  "galaxy z",
  "redmi note",
  "redmi 1",
  "redmi a",
  "poco x",
  "poco m",
  "poco f",
  "poco c",
  "moto g",
  "moto e",
  "moto edge",
  "realme c",
  "realme note",
  "infinix",
  "tecno spark",
  "xiaomi 1",
  "note 13",
  "note 14",
];

// Palavras que indicam ACESSÓRIO de celular — não são o aparelho em si.
const CELLPHONE_ACCESSORY_KEYWORDS: string[] = [
  "capa",
  "capinha",
  "case",
  "pelicula",
  "protetor",
  "suporte",
  "carregador",
  "cabo",
  "fone",
  "headset",
  "earbud",
  "power bank",
  "bateria",
  "adaptador",
  "chip",
  "cartao",
  "caneta",
  "teclado",
  "tripe",
  "ring light",
  "lente",
  "porta celular",
  "bolsa",
  "pochete",
  "smartwatch",
  "relogio",
  "estabilizador",
  "gimbal",
  "kit",
  "pop socket",
  "popsocket",
  "anel",
  "espelho",
  "controle",
  "gamepad",
  "joystick",
  "caixa de som",
  "caixinha",
  "mixer",
  "impressora",
  "localizador",
  "rastreador",
  "smart tag",
  "chave",
  "microfone",
  "projetor",
  "mouse",
  "hub",
  "dock",
  "brinquedo",
  "carrinho",
  "limpador",
  "cooler",
  "selfie",
];

const CELLPHONE_CATEGORIES = new Set([
  "celulares e smartphones",
  "celulares",
  "smartphones",
  "celulares e telefones",
]);

/**
 * Detecta se o produto é um aparelho celular/smartphone (MLB1055).
 * Acessórios são explicitamente liberados.
 */
export function isCellphoneProduct(
  title: string,
  category?: string | null,
): boolean {
  const t = stripAccents(String(title ?? "")).toLowerCase();
  const c = stripAccents(String(category ?? "")).toLowerCase().trim();

  const accessory = CELLPHONE_ACCESSORY_KEYWORDS.some((k) => t.includes(k));
  if (accessory) return false;

  if (CELLPHONE_CATEGORIES.has(c)) return true;
  return CELLPHONE_KEYWORDS.some((k) => t.includes(k));
}

// Decodifica entidades HTML comuns (&#8211;, &amp;, &quot;, &#215;, etc.)
// que vêm cruas da WooCommerce Store API.
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ndash: "–", mdash: "—", hellip: "…", laquo: "«", raquo: "»",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", times: "×", divide: "÷",
};

export function decodeHtmlEntities(input: string): string {
  if (!input) return input;
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
      const code = parseInt(h, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&#(\d+);/g, (_, d) => {
      const code = parseInt(d, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&([a-zA-Z]+);/g, (m, name) => NAMED_ENTITIES[name] ?? m);
}

// ORDEM IMPORTA — primeira correspondência vence.
export const CATEGORY_KEYWORDS: Array<{ category: string; keywords: string[] }> = [
  { category: "Automotivo", keywords: ["carplay", "android auto", "automotivo", "encosto de cabeca", "turbina universal", "escapamento", "banco de carro", "para-brisa", "para brisa", "limpador parabrisa", "som automotivo", "camera veicular", "camera ré", "camera de re", "pneu", "calota", "carregador veicular", "suporte veicular", "capa de banco", "tapete carro", "tapete automotivo"] },
  { category: "Eletrônicos", keywords: ["fone", "bluetooth", "carregador", "cabo", "lanterna", "camera", "drone", "projetor", "caixa de som", "microfone", "ventilador eletrico", "ventilador", "umidificador", "gimbal", "mouse", "teclado", "controle", "joystick", "power bank", "hd externo", "ssd", "case hd", "endoscop", "borescopio"] },
  { category: "Casa", keywords: ["organizador", "cesto", "sapateira", "suporte", "dispenser", "panela", "frigideira", "talher", "chaleira", "moedor", "aspirador", "esfregao", "mangueira", "porta-temperos", "porta temperos", "tabua", "descascador", "vaporizador", "limpador a vapor", "kit pia", "esponja", "rodo", "ralo", "aquecedor"] },
  { category: "Moda", keywords: ["bolsa", "mochila", "short", "calca", "capa de chuva", "luva", "meia-calca", "meia calca", "necessaire"] },
  { category: "Bijuterias", keywords: ["colar", "pulseira", "anel", "brinco", "porta-joias", "porta joias", "kit colares"] },
  { category: "Decoração", keywords: ["luminaria", "cortina de led", "vela", "quadro", "enfeite", "astronauta"] },
  { category: "Beleza", keywords: ["serum", "mousse facial", "esfoliante", "mascara facial", "creme", "body splash", "gloss", "locao", "protetor termico", "escova alisadora", "massageador facial"] },
  { category: "Bebê e Infantil", keywords: ["infantil", "bebe", "mictorio", "mamadeira", "dosador de leite", "brinquedo", "beyblade", "boneco", "mini blocos de montar"] },
  { category: "Saúde e Bem-estar", keywords: ["ortopedica", "joelheira", "cotoveleira", "tornozeleira", "monitor de pressao", "oximetro", "monitor fetal", "raspador de pe", "medidor de glicose", "glicose", "acido urico"] },
  { category: "Esporte e Fitness", keywords: ["yoga", "elastico de exercicio", "hand grip", "faixa elastica", "hip resistance"] },
  { category: "Pet", keywords: ["pet", "escova para pets", "racao", "capa banco pet"] },
];

export function inferCategory(title: string): string {
  const haystack = stripAccents(title).toLowerCase();
  for (const { category, keywords } of CATEGORY_KEYWORDS) {
    if (keywords.some((k) => haystack.includes(k))) return category;
  }
  return "Outros";
}

// Marcas conhecidas usadas na detecção automática a partir do título do produto.
// Ordem importa: nomes compostos primeiro para evitar match parcial.
export const KNOWN_BRANDS: string[] = [
  "Xiaomi", "JBL", "Samsung", "Apple", "Motorola", "LG", "Philips", "Panasonic",
  "Sony", "Lenovo", "Multilaser", "Elgin", "Britânia", "Britania", "Mondial",
  "Electrolux", "Philco", "Cadence", "Arno", "Oster", "Nike", "Adidas", "Puma",
  "Havaianas", "Tramontina", "Fischer", "Black+Decker", "Black & Decker",
  "Bosch", "Makita", "DeWalt", "Vonder", "Nautika", "Intelbras", "TP-Link",
  "Xtrad", "Kaisi", "Baseus", "Ugreen", "Anker", "Redmi", "Realme", "Positivo",
  "Havit", "Logitech", "HP", "Dell", "Asus", "Acer", "Razer", "Kingston",
  "SanDisk", "Toshiba", "Seagate", "Western Digital", "WD",
];

/**
 * Detecta a marca do produto a partir do título comparando com uma lista de
 * marcas conhecidas. Retorna null quando nenhuma marca é reconhecida (o chamador
 * decide se aplica o fallback "Genérica" exigido pelo Mercado Livre).
 */
export function detectBrand(title: string): string | null {
  if (!title) return null;
  const haystack = stripAccents(title).toLowerCase();
  for (const brand of KNOWN_BRANDS) {
    const needle = stripAccents(brand).toLowerCase();
    // \b não funciona bem com "Black+Decker" — fazemos match tolerante.
    const re = new RegExp(`(^|[^a-z0-9])${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i");
    if (re.test(haystack)) return brand;
  }
  return null;
}

// Extrai variações reais do produto a partir dos atributos do WooCommerce.
// A C7 Drop expõe um atributo "Compra" (Atacado/Dropshipping/Grupo Vip) que
// NÃO é variação de produto — é a modalidade comercial de compra do lojista.
// Também descartamos atributos vazios e nomes de marca/modelo (já gravados em
// colunas próprias). Retorna [] quando o produto não tem variação real.
const VARIANT_BLOCKED_NAMES = new Set([
  "compra",
  "marca",
  "brand",
  "modelo",
  "model",
]);

export function extractVariantOptions(
  attributes: Array<{ name?: string; taxonomy?: string; terms?: Array<{ name?: string }> }> | undefined,
): Array<{ name: string; options: string[] }> {
  if (!Array.isArray(attributes)) return [];
  const result: Array<{ name: string; options: string[] }> = [];
  for (const attr of attributes) {
    const rawName = String(attr?.name ?? attr?.taxonomy ?? "").trim();
    if (!rawName) continue;
    const norm = stripAccents(rawName).toLowerCase().replace(/^pa_/, "");
    if (VARIANT_BLOCKED_NAMES.has(norm)) continue;
    const options = (attr?.terms ?? [])
      .map((t) => (t?.name ?? "").trim())
      .filter((s) => s.length > 0);
    if (options.length === 0) continue;
    result.push({ name: rawName, options });
  }
  return result;
}

/**
 * Tenta extrair o modelo de um atributo WooCommerce cujo nome bata com
 * "Modelo"/"Model". Retorna null quando não encontrado. NÃO inventa um valor —
 * o Mercado Livre valida algumas categorias e recusa strings genéricas.
 */
export function extractAttribute(
  attributes: Array<{ name?: string; taxonomy?: string; terms?: Array<{ name?: string }> }> | undefined,
  wantedNames: string[],
): string | null {
  if (!Array.isArray(attributes)) return null;
  const wanted = wantedNames.map((n) => stripAccents(n).toLowerCase());
  for (const attr of attributes) {
    const n = stripAccents(String(attr?.name ?? attr?.taxonomy ?? "")).toLowerCase();
    if (wanted.some((w) => n === w || n.endsWith(w))) {
      const val = attr?.terms?.[0]?.name;
      if (val && typeof val === "string" && val.trim().length > 0) return val.trim();
    }
  }
  return null;
}

/**
 * Mínimo de fotos distintas exigido para um produto aparecer no catálogo.
 * O Mercado Livre recusa anúncios com menos de 3 imagens, então produtos com
 * galeria incompleta são bloqueados na origem (também há trigger no banco).
 */
export const MIN_PRODUCT_IMAGES = 3;

export function countDistinctImages(images: unknown): number {
  if (!Array.isArray(images)) return 0;
  const set = new Set<string>();
  for (const img of images) {
    const url = typeof img === "string" ? img.trim() : "";
    if (url) set.add(url);
  }
  return set.size;
}

export function hasEnoughImages(images: unknown): boolean {
  return countDistinctImages(images) >= MIN_PRODUCT_IMAGES;
}
