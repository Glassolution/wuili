---
data: 2026-11-06
fontes: [AGENTS.md, roadmap.md]
---
# Admin paginado no servidor

**Decisão:** Usuários e Suporte do admin usam RPCs com checagem de papel e paginação/contagem em SQL (`admin_users_page`, `admin_users_counts`, `admin_support_tickets_page`); uma única regra SQL de segmento para página e contadores.
**Por quê:** a tela de Usuários levava 40 s (erro 546) → 4,3 s; Suporte baixava todas as mensagens.
