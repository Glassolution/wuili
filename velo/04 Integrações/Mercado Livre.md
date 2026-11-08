---
atualizado: 2026-11-08
fontes: [CLAUDE.md §7, AGENTS.md, supabase/functions/ml-*]
---
# Mercado Livre

Canal principal de venda. App ML: Client ID `5831446135077053`; redirect `https://nqzpoioxvbqavrtphtoa.supabase.co/functions/v1/ml-callback`. Há um **app novo do DevCenter**; tokens emitidos pelo app antigo falham no refresh.

## Conexão (OAuth)
`ml-connect` → ML → `ml-callback` grava em `user_integrations` (token, `ml_user_id`, `ml_nickname`) e limpa `refresh_failed_at`. Front: `src/lib/mercadoLivreOAuth.ts`, `mlConexao.ts`, `mlOauthRetorno.ts`.
- Refresh que falha com `invalid_grant` → marca token morto → [[Token ML morto não é renovado]].
- Apelido revisto a cada 7 dias por `ml-account-info`.

## Publicação → [[Publicação no Mercado Livre]]
`ml-publish` (limites do plano, conformidade, variações, categoria, dimensões). Mercado Envios: **não bloqueia** → [[ME2 não bloqueia publicação]].

## Vendas
Webhook `ml-orders-webhook-v2` só valida e enfileira; `ml-webhook-processor` (cron 1 min) processa → [[Webhook ML com fila]] → cria `dropship_orders` → [[Pedidos e dropshipping]].

## Sincronização
`ml-sync-stock` (estoque e aumento de custo da C7, preservando margem; pausa em falhas), `ml-sync-listings-status`, `ml-sync-orders`, `ml-retry-shipping-labels`.

## Cuidados
- Circuit breaker e cache: `ml_api_circuit`, `ml_api_cache`.
- `SELLER_SKU` do anúncio = código do catálogo (não é o SKU da C7) → [[Vínculo anúncio-catálogo]].
- `_shared/mlClient.ts`, `mlSellerToken.ts` antes de chamar a API direto.

Tabelas: [[Tabelas - Publicações ML]].
