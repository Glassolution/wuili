---
atualizado: 2026-11-08
fontes: [supabase/functions/atlas-chat, src/contexts/AtlasChatContext.tsx]
---
# Atlas

Assistente conversacional do painel (`/dashboard/atlas`), via Lovable AI Gateway. Sugere próximos passos da tela e tem botão que inicia o OAuth do ML direto do chat.

- Funções: `atlas-chat`, `atlas-search` (widget de busca de produto, ex-falha de autenticação corrigida em ago/2026).
- Base e roteamento: `_shared/atlas-knowledge.ts`, `atlas-faq.ts`, `atlas-router.ts`, `atlas-context.ts`; cota diária por plano em `atlas-quota.ts` → [[Planos e preços]].
- Tabelas: `atlas_threads`, `atlas_messages`, `atlas_usage_logs`.
- Front: `src/contexts/AtlasChatContext.tsx`, `src/lib/atlasHistory.ts`, `atlasRouteTags.ts`.

Diferente do [[Suporte com IA]] (tickets). Ver também: [[IA e modelos]].
