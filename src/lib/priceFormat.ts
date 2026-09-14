// Preço editado pelo dono no editor visual. Antes o preço só existia como texto
// dentro de `metadata.elementOverrides`, e o carrinho/checkout tentavam adivinhá-lo
// varrendo os overrides atrás de "R$ ..." e pegando o menor valor. Agora o editor
// grava também `metadata.price` (número), que é a fonte de verdade das telas de
// venda — o texto continua sendo salvo para o template renderizar igual.

/** Sempre com centavos: 30 -> "R$ 30,00". */
export const formatPriceBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

/**
 * Lê um preço digitado em pt-BR: vírgula é decimal, ponto é separador de milhar
 * ("R$ 1.299,9" -> 1299.9). Retorna null quando não há número reconhecível.
 */
export const parsePriceBRL = (text: string): number | null => {
  const match = text.match(/(\d[\d.]*(?:,\d{1,2})?)/);
  if (!match) return null;
  const value = Number(match[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
};

/**
 * Normaliza o que o dono digitou para o formato exibido no template, sempre com
 * centavos ("R$ 30" -> "R$ 30,00"). Retorna null quando o texto não tem preço.
 */
export const normalizePriceText = (text: string): { text: string; value: number } | null => {
  const value = parsePriceBRL(text);
  if (value === null) return null;
  return { text: formatPriceBRL(value), value };
};
