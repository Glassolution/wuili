---
atualizado: 2026-11-08
fontes: [supabase/functions/dropship-*, _shared/c7dropBotDispatch.ts]
---
# Pedidos e dropshipping

1. Venda no ML → webhook → fila → `dropship_orders` (via `c7dropBotDispatch.ts`) → [[Webhook ML com fila]]
2. Sem vínculo com o catálogo → `catalogLink.ts` tenta resolver; sem SKU → `needs_manual_sku` → [[Vínculo anúncio-catálogo]]
3. Seller paga o fornecedor: Pix gerado **pelo bot dentro do checkout da C7Drop** (`dropship-request-c7drop-pix` / `-confirm-`), não pela ValidaPay. Retentativa: `dropship-request-payment-retry`; expiração: `dropship-expire-pending-payments`.
4. Etiqueta ML: `ml-retry-shipping-labels`, `dropship-watch-pending-labels`.
5. Bot Node externo opera via `dropship-worker` (lista pedidos, recebe comandos/heartbeats). Controle no admin: `/admin/automacao-bot`.
6. Rastreio: `/admin/rastreio`. Cancelamentos ML tratados (migration `20261017030000_fix_dropship_ml_cancellations`).

Telas: `/dashboard/pedidos`, `/dashboard/orders/:id` (`OrdersPage`, `OrderDetailPage`, `MobileOrdersView`).

Tabelas: [[Tabelas - Pedidos e dropshipping]]. Fornecedor: [[C7Drop]].
