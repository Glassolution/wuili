---
atualizado: 2026-11-08
fontes: [src/integrations/supabase/types.ts]
---
# Tabelas — Catálogo

- **`catalog_products`** — catálogo Velo, vindo **só** do scraping [[C7Drop]]. Colunas-chave: `title`, `cost_price`, `suggested_price`, `margin_percent`, `stock_quantity` (0 = nunca mostrar), `is_active`, `is_blocked`, `images`, `variants` (`variants[].sku` = SKU real na C7), `external_id` (slug na C7), `product_url`, `source`, categoria ML (`ml_category_id`, `ml_category_status`), conformidade (`ml_compliance_*`, `ml_vision_*`).
- **`catalog_image_analysis_results`** — evidência append-only da análise de imagens (respostas brutas e falhas técnicas); gravar antes de avançar o lote → [[Validação de imagens do catálogo]]. (Criada em drizzle `0048`, pode não estar no `types.ts` local.)
- `category_mapping` — categoria → categoria ML.
- `collections`, `collection_products` — coleções curadas (`/colecoes`).
- `user_products` — produtos importados pelo usuário.
- `trending_products_real`/`_staging`/`_history` — "produtos em alta".
- `suppliers`, `supplier_products` — fornecedores/chat com fornecedores (pouco usado).
- `cj_token_cache` — **legada, não usar** → [[CJ Dropshipping descontinuada]].

Ver também: [[Catálogo]], [[Banco de dados]].
