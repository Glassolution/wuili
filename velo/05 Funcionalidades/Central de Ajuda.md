---
atualizado: 2026-11-08
fontes: [AGENTS.md, vercel.json]
---
# Central de Ajuda

- Rotas: `/ajuda`, `/ajuda/:categoria`, `/ajuda/:categoria/:artigo` (`HelpCenterPage`, `src/components/help-center/`) e `/ajuda/reembolso` (atendimento de reembolso). Casca comum (cabeçalho, noindex, botão de suporte): `HelpCenterShell`. `/dashboard/ajuda` redireciona.
- **Escondida de propósito:** nenhum botão/link no app (menus, Configurações, Pedidos); a IA nunca manda link dela. Não indexada (meta robots + `X-Robots-Tag` no `vercel.json`).
- Início (`HelpCenterView` → `HomePage`): grade de 3 colunas, ícone azul de 64px (Phosphor fill), título 20px, descrição 14,5px. Só aparece coleção com artigo publicado; a quantidade de cards vem do banco.
- Conteúdo em `help_categories`/`help_articles` (Markdown), editável em `/admin/central-de-ajuda`. Busca: `src/lib/helpCenterSearch.ts` + `search_help_articles`.
- Artigo de reembolso (`pedir-reembolso`) com link discreto no texto para o atendimento de reembolso (marcadores antigos no `EMBEDS` do `HelpArticleNote` viram uma frase simples) → [[Cancelamento e reembolso]].
- Coleções novas (Catálogo e produtos, Ferramentas de IA, Aprenda a vender) aguardam migration → [[Migrations pendentes]].
- Feed comunitário (`help_feed_*`) e guias (`src/pages/help/guides.ts`).

Ver também: [[Tabelas - Suporte e Central de Ajuda]], [[Suporte com IA]].
