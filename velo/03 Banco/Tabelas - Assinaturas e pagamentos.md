---
atualizado: 2026-11-08
fontes: [src/integrations/supabase/types.ts, AGENTS.md]
---
# Tabelas — Assinaturas e pagamentos

- **`subscriptions`** — uma linha por contrato. `plan`, `status`, `provider` (ValidaPay; MP/Stripe legado), `amount`, períodos (`current_period_*`), `is_trial`, **`purchase_kind`** (vitalício, definido pelo servidor), `cancel_at_period_end`, `provider_cancelled_at`, `refundable_until`, ids do gateway (`validapay_*`, `mp_*`, `stripe_*`), duplicidade (`duplicate_*`), `lifetime_match_source`.
- `validapay_webhook_events` — eventos recebidos (fila de reprocessamento com backoff).
- **`payment_incidents`** — incidentes (ex.: cobrança após cancelamento), só revisão manual.
- `provider_cancellation_requests` — pedidos duráveis de cancelamento no gateway → [[Cancelamento confirmado no provedor]].
- `post_cancel_refund_operations` — estornos pontuais pós-cancelamento (com reserva).
- `subscription_migrations` — migração MP → ValidaPay.
- `seller_mp_accounts` — Mercado Pago de sellers (legado).
- Proteção no banco impede reativar contrato terminal e adicionar validade a vitalício.

Ver também: [[Assinatura e checkout]], [[ValidaPay]].
