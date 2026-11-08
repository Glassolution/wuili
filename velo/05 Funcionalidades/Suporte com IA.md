---
atualizado: 2026-11-08
fontes: [AGENTS.md, supabase/functions/AGENTS.md]
---
# Suporte com IA

- Cliente abre ticket (widget `SupportFloatingWidget`, telas de suporte). Gatilho no banco aciona `support-assistant` (Gemini com function calling).
- Respostas **fixas** para cancelamento (`ORIENTAR_CANCELAMENTO`) e reembolso dentro do prazo (`ORIENTAR_REEMBOLSO`); o chat não faz nem nega reembolso → [[Reembolso só pela Central de Ajuda]].
- Navegação: mapa verificado de páginas públicas (`_shared/supportNavigation.ts`) — perguntas só de "onde fica" não pedem diagnóstico nem humano.
- Escalonamento humano: `needs_human`; admin responde em `/admin/suporte` (`admin_reply`). Avisos internos: `support_messages.internal`.
- Não lido: calculado no banco → [[Não lido do suporte calculado no banco]].
- Lista admin: RPC paginada (abertos + 50 fechados), histórico só do ticket aberto, polling pausa com aba oculta.

Front: `src/lib/support.ts`, `supportUnread.ts`, `supportLinks.tsx`. Tabelas: [[Tabelas - Suporte e Central de Ajuda]].
