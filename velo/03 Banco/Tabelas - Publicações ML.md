---
atualizado: 2026-11-08
fontes: [src/integrations/supabase/types.ts, AGENTS.md]
---
# Tabelas — Publicações no Mercado Livre

- **`user_publications`** — anúncio publicado: `ml_item_id`, `catalog_product_id` (vínculo → [[Vínculo anúncio-catálogo]]), `price`, `cost_price`, `status`, `paused_reason`, variações (`variation_group_id`…), dimensões/peso, `stock_synced_at`. Colunas `cj_*` são legado.
- **`pending_publications`** — rascunhos que esperam a conta ML liberar após pagamento (`payload`, `reason`, lembretes 1d/3d) → [[Pagamento antes da conta de vendedor]].
- **`ml_seller_readiness`** — aptidão real de vendedor (`can_list`, `codes`, `mercadoenvios`) → [[ME2 não bloqueia publicação]].
- **`ml_publish_errors`** — erros e avisos internos (ex.: `SHIPPING_WITHOUT_ME2`).
- `ml_webhook_queue` — fila de notificações do ML → [[Webhook ML com fila]].
- `ml_oauth_states`, `ml_api_cache`, `ml_api_circuit` (circuit breaker), `ml_category_prediction_log`, `ml_compliance_fixes`, `ml_dimension_fixes`, `ml_image_vision_cache`, `ml_republication_log`.
- Views: `ml_orders_view`, `v_ml_category_predictions_last_30d`.

Ver também: [[Publicação no Mercado Livre]], [[Mercado Livre]].
