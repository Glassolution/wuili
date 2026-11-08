---
atualizado: 2026-11-08
fontes: [src/integrations/supabase/types.ts, AGENTS.md]
---
# Tabelas — Suporte e Central de Ajuda

## Suporte
- **`support_tickets`** — `status`, `category`, IA (`ai_active`, `ai_paused`), `needs_human*`, `admin_last_seen_at` (base do não lido → [[Não lido do suporte calculado no banco]]). Mensagem do cliente reabre ticket fechado (gatilho).
- **`support_messages`** — mensagens; `internal = true` fica oculta ao cliente.
- `support_ai_messages`, `support_escalations` — conversa com a IA e escalonamentos.
- RPCs: `admin_support_tickets_page`, `admin_support_unread_count`, `admin_mark_support_ticket_seen`, `close_stale_support_tickets`.

## Atlas e chats
`atlas_threads`, `atlas_messages`, `atlas_usage_logs` (cota) → [[Atlas]]. `conversations`/`messages` (chat antigo).

## Central de Ajuda
`help_categories`, `help_articles` (Markdown; marcador `[[formulario-reembolso]]`), view `help_center_documents`, RPC `search_help_articles`. Feed comunitário: `help_feed_posts`/`_comments`/`_likes`/`_tutorials`. `feature_suggestions` (sugestões).

Ver também: [[Suporte com IA]], [[Central de Ajuda]].
