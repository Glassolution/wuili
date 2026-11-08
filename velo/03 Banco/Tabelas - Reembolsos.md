---
atualizado: 2026-11-08
fontes: [src/integrations/supabase/types.ts, supabase/migrations/20261107120000_refund_help_center.sql]
---
# Tabelas — Reembolsos

- **`refund_requests`** — pedido de reembolso da assinatura: `subscription_id`, `charge_id`, `status`, `reason`, `refund_amount`, `refund_kind`, `keep_access`, `provider_response`, `processed_at`.
  - **Cliente não grava** (nem INSERT direto): só `request-refund` com service role.
  - A migration pendente acrescenta: resposta do admin, quem analisou, origem (`help_center`/`settings`/`admin`) e quando o cliente confirmou o fim do acesso.
- **`refund_request_events`** — histórico (created, status, response, note interna). Preenchida por **gatilho** + `admin-refund-action`. ⚠️ **Só existe após a migration pendente** → [[Migrations pendentes]].
- `refund_identity_blocks` — mesma pessoa (e-mail/Pix) já reembolsada em outra conta.
- `profiles.refund_cooldown_until` → [[Cooldown de reembolso]].

Ver também: [[Cancelamento e reembolso]].
