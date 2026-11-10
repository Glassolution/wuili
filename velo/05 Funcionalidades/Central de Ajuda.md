---
atualizado: 2026-11-09
fontes: [AGENTS.md, vercel.json]
---
# Central de Ajuda

- Rotas: `/ajuda`, `/ajuda/:categoria`, `/ajuda/:categoria/:artigo` (`HelpCenterPage`, `src/components/help-center/`) e `/ajuda/reembolso` (atendimento de reembolso). Casca comum (cabeçalho, noindex, botão de suporte): `HelpCenterShell`. `/dashboard/ajuda` redireciona.
- **Escondida de propósito:** nenhum botão/link no app (menus, Configurações, Pedidos); a IA nunca manda link dela. Não indexada (meta robots + `X-Robots-Tag` no `vercel.json`).
- Início (`HelpCenterView` → `HomePage`): grade de 3 colunas, ícone azul de 64px (Phosphor fill), título 20px, descrição 14,5px. Só aparece coleção com artigo publicado; a quantidade de cards vem do banco.
- Conteúdo em `help_categories`/`help_articles` (Markdown), editável em `/admin/central-de-ajuda`. Busca: `src/lib/helpCenterSearch.ts` + `search_help_articles`.
- Artigo de reembolso (`pedir-reembolso`) com link discreto no texto para o atendimento de reembolso (marcadores antigos no `EMBEDS` do `HelpArticleNote` viram uma frase simples) → [[Cancelamento e reembolso]].
- 9 coleções e 71 artigos publicados (09/11). As coleções Catálogo e produtos, Ferramentas de IA e Aprenda a vender já estão aplicadas (migration 0049).
- Atualização de 09/11 (conteúdo gravado direto no banco, sem migration): `onde-fica-cada-pagina` reescrito com o menu conferido no código; `varias-contas-ml` aponta para **Configurações → Integrações**; `produto-sumiu-do-catalogo` ganhou as causas além de estoque (fotos, homologação, fornecedora mudou o produto); `endereco-cadastro` diz que não precisa do endereço do fornecedor; `cancelar-assinatura` avisa da cobrança automática.
- Artigos novos: `renovacao-automatica`, `quanto-custa-vender`, `validacao-de-fotos`, `checklist-primeira-venda`, `glossario`, `novidades-velo`.
- **Renovação: cartão renova, Pix não.** Nenhum assinante antigo pago no Pix teve o período passado de um mês (0 de 2.844) e todos os eventos de renovação da ValidaPay são de contas de cartão — por isso `renovacao-automatica` separa os dois e o aviso em `cancelar-assinatura` fala em "pagos no cartão".
- Feed comunitário (`help_feed_*`) e guias (`src/pages/help/guides.ts`).

Ver também: [[Tabelas - Suporte e Central de Ajuda]], [[Suporte com IA]].
