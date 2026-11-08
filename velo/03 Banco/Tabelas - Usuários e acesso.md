---
atualizado: 2026-11-08
fontes: [src/integrations/supabase/types.ts]
---
# Tabelas — Usuários e acesso

- **`profiles`** — um por usuário (`user_id`). Nome, `plano`, onboarding/quiz (`nicho`, `objetivo`, `experiencia`…), loja, Pix (`pix_key`), origem do anúncio (`utm_*`, `ttclid`, `tiktok_ttp`, `signup_source`), **`refund_cooldown_until`** ([[Cooldown de reembolso]]). Tem colunas antigas de token AliExpress (legado).
- **`user_roles`** — papel do usuário (`app_role`). Base do `is_admin()`.
- **`user_integrations`** — tokens OAuth por `platform` (ML, Shopee…): `access_token`, `refresh_token`, `expires_at`, `ml_user_id`, `ml_nickname`, **`refresh_failed_at`** ([[Token ML morto não é renovado]]). Nunca expor (nem no MCP).
- **`notifications`** — avisos in-app.
- Medição: `user_sessions`, `user_page_views`, `landing_events`, `mobile_home_events` → [[Pixels e medição]].
- Infra: `cron_tokens`, `job_locks`.

Ver também: [[Banco de dados]], [[Landing e cadastro]].
