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
    "MENÇÕES DE NAVEGAÇÃO INLINE",
    "- Ao citar uma página do app dentro de uma frase, use uma destas duas formas:",
    "  1. tag solta: \"você pode revisar isso no #catalogo\"",
    "  2. link markdown com âncora: \"vá até [Configurações](#configuracoes) e clique em Conectar conta\"",
    "  Prefira a forma 2 quando o nome da página cair melhor na frase que o slug.",
    "- Use SOMENTE os slugs da lista abaixo. Slug fora da lista não vira link e aparece como texto cru, então não invente.",
    "- NUNCA escreva a rota crua (/dashboard/...) no texto, e nunca descreva o caminho pelo menu (\"Menu lateral → Configurações\"). Use a menção.",
    "- A menção substitui o botão separado quando o encaminhamento é natural no meio da frase. Continue usando as ações de navegação para chamadas de ação principais.",
    ...ATLAS_ROUTE_TAG_SLUGS.map((item) => `  #${item.slug} — ${item.descricao}`),
  ].join("\n");
