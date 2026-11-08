---
fontes: [supabase/functions/ml-orders-webhook-v2, ml-webhook-processor]
---
# Webhook ML com fila

**Decisão:** `ml-orders-webhook-v2` só valida, deduplica e grava em `ml_webhook_queue` (resposta rápida); `ml-webhook-processor` (pg_cron, 1 min) + `waitUntil` processam via `_shared/mlWebhookQueue.ts`.
**Por quê:** o ML exige resposta rápida e reenvia; processar no caminho crítico causava timeouts e duplicidade.
