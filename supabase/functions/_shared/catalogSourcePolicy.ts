export const CATALOG_ACCESS_ERROR = 'Produto indisponível para esta conta.'

export function isAliExpressReference(product: Record<string, unknown>): boolean {
  if (String(product.source ?? '').trim().toLowerCase() === 'aliexpress') return true
  return ['product_url', 'cj_product_url', 'supplier_url'].some(key => {
    if (typeof product[key] !== 'string') return false
    try {
      const host = new URL(product[key]).hostname.toLowerCase()
      return host === 'aliexpress.com' || host.endsWith('.aliexpress.com') ||
        host === 'aliexpress.us' || host.endsWith('.aliexpress.us')
    } catch { return false }
  })
}

// Structural interface keeps this guard independent of Supabase client versions.
interface AccessClient {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>
}

export async function canAccessCatalogProduct(
  client: AccessClient, userId: string, product: Record<string, unknown>,
): Promise<boolean> {
  const ids = ['id', 'catalog_product_id', 'cj_product_id'].map(k => product[k])
    .filter((id): id is string => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id))
  const images = Array.isArray(product.images) ? product.images.filter((v): v is string => typeof v === 'string') : []
  const { data, error } = await client.rpc('catalog_payload_access_allowed', {
    p_user: userId, p_ids: ids, p_images: images,
    p_restricted_reference: isAliExpressReference(product),
  })
  return !error && data === true
}