---
atualizado: 2026-11-08
fontes: [src/integrations/supabase/types.ts, supabase/migrations/]
---
# Banco de dados (visão geral)

Postgres do Supabase, projeto `nqzpoioxvbqavrtphtoa`. ~90 tabelas em `public`.

## Regras
- **RLS em todas as tabelas.** Revise as policies existentes antes de mudar esquema.
- Admin: `user_roles` (enum `app_role`: admin, moderator, user, influencer) + função `is_admin()`. `profiles.is_admin` também existe (legado).
- Escrita sensível (pagamento, reembolso) só pelo servidor com service role; o cliente lê pelas policies.
- **Migrations: duas pastas.** A ativa desde meados de out/2026 é **`drizzle/migrations/NNNN_nome.sql`** (Lovable Cloud, `drizzle.config.ts`; 0000–0048 em 08/11). `supabase/migrations/` (~262, timestamp) é o histórico anterior, parado desde 16/10. Migration nova → próximo número em `drizzle/migrations/`. Aplicar **só com aprovação** → [[Migrations pendentes]].
- Esquema de referência: `src/integrations/supabase/types.ts` (Tables, Views, Functions). Para achar colunas: procure `      <tabela>: {` nesse arquivo em vez de abrir migrations.
- Jobs: `pg_cron` chama Edge Functions (`cron_tokens` guarda os tokens); `job_locks` evita execução dupla.

## Domínios
| Domínio | Nota |
|---|---|
| Perfis, papéis, integrações, eventos | [[Tabelas - Usuários e acesso]] |
| Produtos e fornecedores | [[Tabelas - Catálogo]] |
| Anúncios e operação no ML | [[Tabelas - Publicações ML]] |
| Vendas e compra no fornecedor | [[Tabelas - Pedidos e dropshipping]] |
| Planos, cobranças, incidentes | [[Tabelas - Assinaturas e pagamentos]] |
| Pedidos de reembolso | [[Tabelas - Reembolsos]] |
| Tickets, IA, artigos | [[Tabelas - Suporte e Central de Ajuda]] |
| Afiliados, lojas, IA criativa, legado | [[Tabelas - Afiliados, lojas e outros]] |

## RPCs úteis (amostra)
`is_admin`, `user_has_active_paid_plan`, `user_has_base_plan`, `resolve_catalog_product_for_listing`, `admin_users_page`/`admin_users_counts`, `admin_support_tickets_page`, `support_ticket_is_unread`, `search_help_articles`, `rpc_landing_stats`, `rpc_admin_*` (funis e relatórios), `rpc_affiliate_*`.
