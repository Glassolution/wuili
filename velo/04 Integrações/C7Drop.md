---
atualizado: 2026-11-08
fontes: [supabase/functions/scrape-c7drop, _shared/c7dropBotDispatch.ts, dropship-worker]
---
# C7Drop

Fornecedor brasileiro único do catálogo atual.

## Catálogo (scraping)
- `scrape-c7drop` lê o catálogo público. Em **jul/2026 a C7 migrou de WooCommerce para Next.js + Prisma**; URLs `wp-content` antigas morreram (imagens antigas em `catalog_products.images` podem estar quebradas).
- Atualiza `cost_price`/estoque; `ml-sync-stock` repassa ao ML.
- ⚠️ Em ago/2026 não havia agendamento automático do scraper → [[Bugs conhecidos]].

## Compra (dropshipping)
- Venda no ML → `c7dropBotDispatch.ts` resolve o SKU e grava `dropship_orders`.
- SKU real: `catalog_products.variants[].sku`; slug: `external_id`; link: `product_url`. **Nunca** usar o `seller_sku` do ML como SKU da C7.
- Um **bot Node.js externo** (fora deste repo) compra na C7 e gera o Pix no checkout dela (45 min, até 3 renovações). Ele fala com o Supabase só via `dropship-worker` (header `x-worker-token` = `DROPSHIP_WORKER_TOKEN`).

Ver também: [[Pedidos e dropshipping]], [[Catálogo]].
