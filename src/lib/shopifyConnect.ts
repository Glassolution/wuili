// Oferta de assinatura da Shopify. Trocar pelo link de parceiro/afiliado da Velo.
export const SHOPIFY_OFFER_URL = "https://www.shopify.com/br/precos";

/**
 * Normaliza o que o usuário colar no campo de conexão para o domínio que a
 * Shopify espera (`nomedaloja.myshopify.com`). Aceita:
 *  - https://admin.shopify.com/store/nomedaloja
 *  - nomedaloja.myshopify.com (com ou sem https:// e caminho)
 *  - nomedaloja
 * Retorna null quando não dá para extrair um domínio válido.
 */
export const parseShopDomain = (raw: string): string | null => {
  const value = raw.trim().toLowerCase();
  if (!value) return null;

  const handlePattern = /^[a-z0-9][a-z0-9-]*$/;

  const adminMatch = value.match(/admin\.shopify\.com\/store\/([a-z0-9][a-z0-9-]*)/);
  if (adminMatch) return `${adminMatch[1]}.myshopify.com`;

  const myshopifyMatch = value.match(/([a-z0-9][a-z0-9-]*)\.myshopify\.com/);
  if (myshopifyMatch) return `${myshopifyMatch[1]}.myshopify.com`;

  if (handlePattern.test(value)) return `${value}.myshopify.com`;

  return null;
};
