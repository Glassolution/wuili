---
atualizado: 2026-11-08
fontes: [supabase/functions/send-*, _shared/transactional-email-templates.ts]
---
# E-mail

Resend (`RESEND_API_KEY`). Funções: `send-verification-email`, `send-new-support-ticket-email`, `send-ticket-reply-email`, `send-project-invite-email`; também enviam `request-refund`, `regularize-subscriptions`, `create-referral`. Templates em `_shared/transactional-email-templates.ts` e `regularization-email.ts`. Pasta `emails/` na raiz = previews.

Doc antiga: `RESEND_INTEGRATION.md` (mai/2026).
