/**
 * Slugs de navegação inline (`#pagina`) que o Atlas pode usar no meio do texto.
 *
 * Esta lista existe só para o prompt: é o que o modelo pode escrever. Quem
 * valida e transforma em link é o frontend, em `src/lib/atlasRouteTags.ts` —
 * um slug fora da lista de lá vira texto comum, nunca link quebrado.
 *
 * As duas listas precisam bater. Ao mexer aqui, mexa lá também.
 */
export const ATLAS_ROUTE_TAG_SLUGS: { slug: string; descricao: string }[] = [
  { slug: "catalogo", descricao: "catálogo de produtos da Velo" },
  { slug: "produtos-em-alta", descricao: "produtos vencedores / em alta" },
  { slug: "paginas-com-ia", descricao: "criação de páginas de venda com IA" },
  { slug: "modelos", descricao: "templates de página" },
  { slug: "publicacoes", descricao: "anúncios publicados e seus status" },
  { slug: "produtos-ml", descricao: "produtos sincronizados do Mercado Livre" },
  { slug: "pedidos", descricao: "pedidos e vendas" },
  { slug: "imagens-ia", descricao: "geração de imagens de produto com IA" },
  { slug: "tiktok", descricao: "influencers de IA para TikTok e Instagram" },
  { slug: "integracoes", descricao: "conectar Mercado Livre e outras contas" },
  { slug: "pagamentos", descricao: "meios de pagamento e checkout" },
  { slug: "planos", descricao: "planos e assinatura" },
  { slug: "saldos", descricao: "saldos" },
  { slug: "transacoes", descricao: "transações" },
  { slug: "configuracoes", descricao: "configurações da conta" },
  { slug: "chat-fornecedores", descricao: "chat com fornecedores" },
  { slug: "resultados", descricao: "resultados e performance" },
  { slug: "inicio", descricao: "tela inicial do painel" },
];

export const atlasRouteTagPromptSection = () =>
  [
    "MENÇÕES DE NAVEGAÇÃO INLINE (#pagina)",
    "- Ao citar uma página do app dentro de uma frase, escreva a menção como #slug, sem colchetes e sem markdown. Exemplo: \"você pode revisar isso no #catalogo\" ou \"depois de conectar, confirme seu plano em #planos\".",
    "- Use SOMENTE os slugs da lista abaixo. Slug fora da lista não vira link e aparece como texto cru para o usuário, então não invente.",
    "- A menção substitui a necessidade de um botão separado quando o encaminhamento é natural no meio da frase. Continue usando as ações de navegação para chamadas de ação principais.",
    "- Nunca escreva a rota crua (/dashboard/...) no texto; use a menção.",
    ...ATLAS_ROUTE_TAG_SLUGS.map((item) => `  #${item.slug} — ${item.descricao}`),
  ].join("\n");
