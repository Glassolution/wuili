---
atualizado: 2026-11-08
fontes: [src/integrations/supabase/types.ts, supabase/functions/_shared/c7dropBotDispatch.ts]
---
# Tabelas — Pedidos e dropshipping

- **`dropship_orders`** — integração central com o bot: pedido do ML (`ml_order_id`), comprador, endereço, `sku_c7drop`, `c7drop_product_url`, etiqueta ML (`etiqueta_ml_url`), Pix da C7 (`c7drop_pix_*`, 45 min, até 3 renovações), `payment_status`, `status`, rastreio, flags `needs_manual_sku`/`needs_shipping_label`.
- `dropship_order_events` — histórico do pedido.
- `dropship_worker_settings`/`_commands`/`_heartbeats`/`_alerts` — controle do bot Node externo.
- `c7drop_user_accounts` — conta C7 por usuário.
- **`orders`** — pedidos (modelo anterior, com `cj_*` legado, `profit`, `fulfillment_status`). Verifique qual tabela a tela usa antes de mexer.
- `store_orders` — pedidos das lojas próprias → [[Lojas públicas e páginas de venda]].

Ver também: [[Pedidos e dropshipping]], [[C7Drop]].
