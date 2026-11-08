---
atualizado: 2026-11-08
fontes: [AGENTS.md, vercel.json]
---
# Central de Ajuda

- Rotas: `/ajuda`, `/ajuda/:categoria`, `/ajuda/:categoria/:artigo` (`HelpCenterPage`, `src/components/help-center/`). `/dashboard/ajuda` redireciona.
- **Escondida de propósito:** nenhum botão/link no app (menus, Configurações, Pedidos); a IA nunca manda link dela. Não indexada (meta robots + `X-Robots-Tag` no `vercel.json`).
- Conteúdo em `help_categories`/`help_articles` (Markdown), editável em `/admin/central-de-ajuda`. Busca: `src/lib/helpCenterSearch.ts` + `search_help_articles`.
- Artigo de reembolso com formulário embutido → [[Cancelamento e reembolso]].
- Coleções novas (Catálogo e produtos, Ferramentas de IA, Aprenda a vender) aguardam migration → [[Migrations pendentes]].
- Feed comunitário (`help_feed_*`) e guias (`src/pages/help/guides.ts`).

Ver também: [[Tabelas - Suporte e Central de Ajuda]], [[Suporte com IA]].
