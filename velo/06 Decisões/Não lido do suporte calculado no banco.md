---
data: 2026-11-06
fontes: [AGENTS.md]
---
# Não lido do suporte calculado no banco

**Decisão:** ticket não lido = existe mensagem não interna do cliente mais nova que `support_tickets.admin_last_seen_at` (ou qualquer uma se nulo), independente de IA. Calculado só no banco (`support_ticket_is_unread`), espelhado em `src/lib/supportUnread.ts` para testes. Só clique ou resposta do admin marcam como visto; a tela nunca abre ticket sozinha.
**Por quê:** a bolinha sumia sem o admin ter visto a mensagem.
