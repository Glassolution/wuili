---
atualizado: 2026-11-08
fontes: [supabase/functions/]
---
# Edge Functions (mapa por domínio)

Pasta `supabase/functions/<nome>/index.ts`. Regras: `supabase/functions/AGENTS.md`. Helpers → [[Módulos compartilhados]].

## Mercado Livre → [[Mercado Livre]]
- Conta: `ml-connect`, `ml-callback` (salva token), `ml-account-info`, `ml-seller-status`, `ml-seller-readiness-refresh`, `ml-setup-webhook`
- Anúncios: `ml-publish`, `ml-update-listing`, `ml-delete-listing`, `ml-item-details`, `ml-search`, `ml-sync-listings-status`, `ml-sync-stock` (estoque e custo C7), `auto-publish-pending`
- Pedidos: `ml-orders-webhook-v2` (ack rápido → fila), `ml-webhook-processor` (cron 1 min), `ml-orders-webhook` (antigo), `ml-sync-orders`, `ml-retry-shipping-labels`, `ml-backfill-*`
- Conformidade/ajustes: `ml-compliance-*`, `ml-catalog-*`, `ml-fix-*`, `ml-audit-variations`, `ml-republish-legacy-shipping`, `cleanup-ml-duplicates`

## Pagamentos e assinatura → [[ValidaPay]]
`validapay-checkout`, `validapay-webhook`, `subscription-sync-self`, `expire-pending-charges`, `payments-reconcile` (cron 5 min), `validapay-cancel-sweep`, `validapay-refund-status`, `validapay-audit-subscriptions`, `validapay-diag`, `validapay-overdue-check` (**temporária**, nov/2026, apagar depois), `cancel-subscription`, `regularize-subscriptions`, `regularization-expire`, `lembrete-planos`, `migrate-subscriptions-to-validapay`

## Reembolso → [[Cancelamento e reembolso]]
`request-refund`, `admin-refund-action`, `check-pending-refunds` (cron 30 min), `process-refund`, `admin-refund-post-cancel`, `admin-cancel-subscription`

## Pedidos/dropshipping → [[Pedidos e dropshipping]]
`dropship-worker` (ponte do bot Node), `dropship-worker-control`, `dropship-request-c7drop-pix`, `dropship-confirm-c7drop-pix`, `dropship-request-payment-retry`, `dropship-expire-pending-payments`, `dropship-process-refunds`, `dropship-watch-pending-labels`, `c7drop-account`

## Catálogo → [[Catálogo]]
`catalog`, `scrape-c7drop`, `scrape-b2drop` (antigo), `get-curated-products`, `sync-trending-products`, `img-proxy`, `landing-stats`

## Suporte e IA → [[Suporte com IA]], [[Atlas]]
`support-assistant`, `support-chat`, `atlas-chat`, `atlas-search`, `chat`, `generate-*` (imagem, banner, personagem, página de vendas, relatório), `ai-page-create`, `ai-page-status`

## Admin → [[Painel admin]]
`admin-users`, `admin-user-*`, `admin-list-profiles`, `admin-overview`, `admin-wallet-finance`, `admin-pay-seller`, `admin-frete-check`, `admin-sandbox-subscription`

## Outros
E-mail: `send-*-email` → [[E-mail]] · Medição: `tiktok-events` → [[Pixels e medição]] · Afiliados: `create-referral`, `accept-referral` → [[Afiliados]] · Conta: `delete-account`, `auth-email-exists`, `get-user-details` · `mcp` (gerado de `src/lib/mcp/`) → [[MCP somente leitura]] · Legado: `cj-*`, `mp-*`, `stripe-webhook`, `aliexpress-*`, `shopify-*`, `tiktok-shop-*`, `create-checkout-session` → [[Integrações legadas]]
