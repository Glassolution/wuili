---
atualizado: 2026-11-08
---
# Migrations pendentes

Migrations que estão no repositório e **ainda não foram aplicadas** no Supabase. Quem aplica é a Lovable, pela pasta `drizzle/migrations/`.

| Migration | O que faz | Depende dela |
|---|---|---|
| `20261107120000_refund_help_center.sql` | Fecha INSERT direto do cliente em `refund_requests`; acrescenta campos da análise (resposta, quem analisou, origem, confirmação de fim de acesso); cria `refund_request_events` + gatilho; reescreve artigos de reembolso/cancelamento (artigo `pedir-reembolso` ganha o texto longo, com link discreto para `/ajuda/reembolso`; o endereço não muda) | Novo fluxo de [[Cancelamento e reembolso]], atendimento `/ajuda/reembolso`, `request-refund` (`access_end_acknowledged`), `admin-refund-action` |

⚠️ **Como aplicar (08/11):** a Lovable cria `drizzle/migrations/0050_refund_help_center.sql` copiando a `20261107120000` → prompt pronto em `PROMPT_LOVABLE_REEMBOLSO.md`. É compatível com a `0045`: só repete o `DROP POLICY IF EXISTS`; nenhuma tela grava em `refund_requests` pelo navegador, então o `REVOKE` não quebra nada.

**Já aplicada:** coleções novas da Central (`20261108120000`) entraram como `drizzle/migrations/0049_help_center_new_collections.sql` (Lovable, 08/11).

Também pendente de deploy junto (lista completa no prompt): `refund-assistant` (nova), `request-refund`, `admin-refund-action`, `support-assistant`, `cancel-subscription`, `atlas-chat`, funções de e-mail de assinatura e a nova `validapay-overdue-check`.

Quando aplicar: remova a linha daqui, atualize [[Tabelas - Reembolsos]] e [[Próximos passos]].
