---
atualizado: 2026-11-08
---
# Migrations pendentes

Arquivos que existem no repositório (ainda **não commitados**) e **não foram aplicados** no Supabase. Aplicar só com aprovação do dono.

| Migration | O que faz | Depende dela |
|---|---|---|
| `20261107120000_refund_help_center.sql` | Fecha INSERT direto do cliente em `refund_requests`; acrescenta campos da análise (resposta, quem analisou, origem, confirmação de fim de acesso); cria `refund_request_events` + gatilho; reescreve artigos de reembolso/cancelamento (artigo `como-solicitar-reembolso` com `[[formulario-reembolso]]`) | Novo fluxo de [[Cancelamento e reembolso]], `RefundRequestForm`, `request-refund` (`access_end_acknowledged`), `admin-refund-action` |
| `20261108120000_help_center_new_collections.sql` | Três coleções novas na [[Central de Ajuda]]: Catálogo e produtos, Ferramentas de IA, Aprenda a vender (idempotente) | Conteúdo da Central |

⚠️ **Atenção (08/11):** as duas estão em `supabase/migrations/`, mas a pasta ativa da Lovable é `drizzle/migrations/` → [[Banco de dados]]. E a `drizzle/migrations/0045_refund_requests_single_pending_and_server_only_insert.sql` (já na `main`) **já remove o INSERT do cliente** e cria índice de um pedido pendente por cliente — sobrepõe a parte 1 da `20261107120000`. Revisar antes de aplicar.

Também pendente de deploy junto: funções alteradas na mesma leva (`request-refund`, `admin-refund-action`, `support-assistant`) e a nova `validapay-overdue-check`.

Quando aplicar: remova a linha daqui, atualize [[Tabelas - Reembolsos]] e [[Próximos passos]].
