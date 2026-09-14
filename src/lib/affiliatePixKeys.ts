/** Chave Pix cadastrada pelo afiliado em `affiliate_applications.pix_keys`. */
export type AffiliatePixKey = { type: string; value: string };

/** Normaliza o jsonb `[{type, value}]` vindo do formulário, descartando entradas vazias. */
export const parseAffiliatePixKeys = (raw: unknown): AffiliatePixKey[] => {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      const entry = item as { type?: unknown; value?: unknown } | null;
      return {
        type: String(entry?.type ?? "").trim(),
        value: String(entry?.value ?? "").trim(),
      };
    })
    .filter((item) => item.value.length > 0);
};

/**
 * Chave efetivamente usada no saque.
 *
 * Mantém a escolha do afiliado enquanto ela existir; com uma única chave cadastrada
 * não há o que escolher, então ela já vale como selecionada. Com várias, a escolha
 * precisa ser explícita — é dinheiro indo para uma conta específica.
 */
export const resolveSelectedPixKey = (
  keys: AffiliatePixKey[],
  currentValue: string | null,
): AffiliatePixKey | null => {
  const chosen = keys.find((item) => item.value === currentValue);
  if (chosen) return chosen;
  if (keys.length === 1) return keys[0];
  return null;
};
