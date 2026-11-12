import { describe, expect, it } from 'vitest';
import { canAccessCatalogProduct, isAliExpressReference } from '../../supabase/functions/_shared/catalogSourcePolicy';

describe('AliExpress admin-only access', () => {
  it('recognizes AliExpress source and supplier links', () => {
    expect(isAliExpressReference({ source: 'AliExpress' })).toBe(true);
    expect(isAliExpressReference({ product_url: 'https://pt.aliexpress.com/item/123.html' })).toBe(true);
    expect(isAliExpressReference({ product_url: 'https://aliexpress.com.evil.test/item/1' })).toBe(false);
    expect(isAliExpressReference({ source: 'c7drop' })).toBe(false);
  });
  it('blocks a normal account when the server denies even without source in payload', async () => {
    const client = { rpc: async () => ({ data: false, error: null }) };
    expect(await canAccessCatalogProduct(client, 'normal-user', { id: '00000000-0000-0000-0000-000000000001' })).toBe(false);
  });
  it('allows an admin only when server authorization succeeds', async () => {
    const client = { rpc: async () => ({ data: true, error: null }) };
    expect(await canAccessCatalogProduct(client, 'admin-user', { source: 'aliexpress' })).toBe(true);
  });
  it('fails closed on permission lookup failure', async () => {
    const client = { rpc: async () => ({ data: null, error: new Error('unavailable') }) };
    expect(await canAccessCatalogProduct(client, 'normal-user', { source: 'aliexpress' })).toBe(false);
  });
});