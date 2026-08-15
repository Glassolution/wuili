// Filtros de faixa de preço e avaliação do catálogo.
//
// Estes filtros existiam só como enfeite: o dropdown trocava o rótulo e o valor
// nunca chegava à consulta. Definir as faixas como dados (em vez de if/else
// espalhado) permite testar as bordas e aplicá-las direto na query do Supabase.

/**
 * Faixas de preço em BRL, comparadas contra `catalog_products.cost_price` —
 * o mesmo campo que o card exibe. `min` é exclusivo e `max` é inclusivo, para
 * que as faixas particionem a reta sem sobreposição nem buraco: um produto de
 * exatamente R$ 50 cai só em "Até R$ 50".
 */
export type PriceRange = { min?: number; max?: number };

export const PRICE_OPTIONS = [
  "Todos os preços",
  "Até R$ 50",
  "R$ 50-150",
  "Acima de R$ 150",
] as const;

export type PriceOption = (typeof PRICE_OPTIONS)[number];

export const PRICE_RANGES: Record<PriceOption, PriceRange> = {
  "Todos os preços": {},
  "Até R$ 50": { max: 50 },
  "R$ 50-150": { min: 50, max: 150 },
  "Acima de R$ 150": { min: 150 },
};

export const RATING_OPTIONS = ["Todas", "4+ estrelas", "4.5+ estrelas"] as const;

export type RatingOption = (typeof RATING_OPTIONS)[number];

/** Nota mínima exigida; `null` quando a opção não filtra nada. */
export const RATING_THRESHOLDS: Record<RatingOption, number | null> = {
  Todas: null,
  "4+ estrelas": 4,
  "4.5+ estrelas": 4.5,
};

/** Retorna a faixa a aplicar, ou `null` quando não há filtro de preço. */
export function priceRangeFor(option: PriceOption): PriceRange | null {
  const range = PRICE_RANGES[option];
  if (!range) return null;
  return range.min === undefined && range.max === undefined ? null : range;
}

/** Retorna a nota mínima a aplicar, ou `null` quando não há filtro. */
export function ratingThresholdFor(option: RatingOption): number | null {
  return RATING_THRESHOLDS[option] ?? null;
}

/**
 * Espelha em memória a regra aplicada na query, para os testes conseguirem
 * verificar as bordas sem subir um banco.
 */
export function matchesPriceRange(price: number, option: PriceOption): boolean {
  const range = priceRangeFor(option);
  if (!range) return true;
  if (range.min !== undefined && price <= range.min) return false;
  if (range.max !== undefined && price > range.max) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Nota exibida no card
//
// ATENÇÃO: a nota mostrada no catálogo NÃO vem do banco. `catalog_products.rating`
// é 0 em 825 dos 830 produtos (a C7 Drop não devolve avgRating), então o card
// exibe um valor derivado do id do produto. O filtro de avaliação opera sobre
// esse mesmo valor para não contradizer o que está na tela.
//
// Consequência da fórmula: o resultado cai sempre em [4.0, 5.0] (o toFixed(1)
// arredonda 4.95–4.99 para 5.0), logo "4+ estrelas" casa com todo o catálogo.
// Só "4.5+ estrelas" separa de fato.
// ---------------------------------------------------------------------------

/** Menor nota que a fórmula consegue produzir. */
export const MIN_DISPLAY_RATING = 4;

/** Hash determinístico do id — fonte dos números exibidos no card. */
export function catalogMetricsHash(productId: string): number {
  let hash = 0;
  for (let index = 0; index < productId.length; index += 1) {
    hash = (hash * 31 + productId.charCodeAt(index)) % 10000;
  }
  return hash;
}

/** Nota que o card mostra para este produto. */
export function displayRatingFor(productId: string): number {
  return Number((MIN_DISPLAY_RATING + (catalogMetricsHash(productId) % 100) / 100).toFixed(1));
}

/** Quantidade de "vendidos" que o card mostra para este produto. */
export function displayOrdersCountFor(productId: string): number {
  return 50 + (catalogMetricsHash(productId) % 1950);
}

/**
 * `true` quando a opção não descarta nenhum produto — permite manter a consulta
 * paginada normal em vez do caminho mais caro de filtrar por id.
 */
export function isRatingFilterNoop(option: RatingOption): boolean {
  const threshold = ratingThresholdFor(option);
  return threshold === null || threshold <= MIN_DISPLAY_RATING;
}

/** Aplica o filtro de avaliação sobre a nota exibida. */
export function matchesDisplayRating(productId: string, option: RatingOption): boolean {
  const threshold = ratingThresholdFor(option);
  if (threshold === null) return true;
  return displayRatingFor(productId) >= threshold;
}
