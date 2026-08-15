/**
 * Menções de navegação inline do Atlas (`#pagina`).
 *
 * O Atlas pode citar uma página no meio do texto — "revise no #catalogo" — e o
 * frontend troca essa marcação por um link clicável. A lista abaixo é fechada de
 * propósito: um slug que não estiver aqui continua sendo texto comum, para o
 * modelo nunca produzir um link que leva a uma rota inexistente.
 *
 * Ao adicionar um slug aqui, replique em
 * `supabase/functions/_shared/atlas-route-tags.ts` — é de lá que sai a lista
 * enviada ao modelo no prompt. As duas precisam bater.
 */

export type AtlasRouteTag = {
  /** Rota real do app (react-router). */
  route: string;
  /** Nome exibido no link, sem o `#`. */
  label: string;
};

/** Slugs canônicos: um por página. */
export const ATLAS_ROUTE_TAGS: Record<string, AtlasRouteTag> = {
  inicio: { route: "/dashboard", label: "início" },
  catalogo: { route: "/dashboard/catalogo", label: "catálogo" },
  "produtos-em-alta": { route: "/dashboard/produtos-em-alta", label: "produtos em alta" },
  "paginas-com-ia": { route: "/dashboard/paginas-com-ia", label: "páginas com IA" },
  modelos: { route: "/dashboard/modelos", label: "templates" },
  publicacoes: { route: "/dashboard/publicacoes", label: "publicações" },
  "produtos-ml": { route: "/dashboard/produtos-ml", label: "produtos no Mercado Livre" },
  pedidos: { route: "/dashboard/pedidos", label: "pedidos" },
  "imagens-ia": { route: "/dashboard/imagens-ia", label: "imagens com IA" },
  tiktok: { route: "/dashboard/tiktok", label: "TikTok" },
  integracoes: { route: "/dashboard/integracoes", label: "integrações" },
  pagamentos: { route: "/dashboard/pagamentos", label: "pagamentos" },
  planos: { route: "/dashboard/planos", label: "planos" },
  saldos: { route: "/dashboard/saldos", label: "saldos" },
  transacoes: { route: "/dashboard/transacoes", label: "transações" },
  configuracoes: { route: "/dashboard/configuracoes", label: "configurações" },
  "chat-fornecedores": { route: "/dashboard/chat-fornecedores", label: "chat com fornecedores" },
  resultados: { route: "/dashboard/resultados", label: "resultados" },
};

/**
 * Apelidos: nomes que o modelo tende a escrever naturalmente e que apontam para
 * um slug canônico. Mantidos separados para a lista do prompt ficar enxuta.
 */
const TAG_ALIASES: Record<string, keyof typeof ATLAS_ROUTE_TAGS> = {
  produtos: "catalogo",
  produto: "catalogo",
  assinatura: "planos",
  plano: "planos",
  integracao: "integracoes",
  checkout: "pagamentos",
  pagamento: "pagamentos",
  faturamento: "pagamentos",
  publicacao: "publicacoes",
  pedido: "pedidos",
  imagens: "imagens-ia",
  configuracao: "configuracoes",
};

/** Resolve um slug (canônico ou apelido) para a rota; null se não existir. */
export const resolveAtlasRouteTag = (slug: string): AtlasRouteTag | null => {
  const key = slug.toLowerCase();
  if (key in ATLAS_ROUTE_TAGS) return ATLAS_ROUTE_TAGS[key];
  const alias = TAG_ALIASES[key];
  return alias ? ATLAS_ROUTE_TAGS[alias] : null;
};

/**
 * `#slug` precedido por início de linha, espaço ou pontuação de abertura. Exige
 * letra logo após o `#`, o que já descarta títulos markdown (`# Título`), e
 * recusa quando vem colado em palavra ou URL (`.../#ancora`).
 */
const TAG_PATTERN = /(^|[\s(["'*_])#([a-zA-Z][a-zA-Z0-9-]*)/g;

/**
 * Converte as menções válidas em links markdown, deixando as inválidas intactas.
 * Roda antes do ReactMarkdown: assim o link nasce como `<a>` e o texto ao redor
 * segue sendo markdown normal.
 */
export const linkifyAtlasRouteTags = (text: string): string => {
  if (!text.includes("#")) return text;

  // Trechos de codigo nao devem virar link. O sentinela usa um caractere de
  // controle para nao colidir com numeros soltos que o modelo escreva.
  const codeBlocks: string[] = [];
  const withoutCode = text.replace(/```[\s\S]*?```|`[^`\n]*`/g, (match) => {
    codeBlocks.push(match);
    return `\u0000${codeBlocks.length - 1}\u0000`;
  });

  const linked = withoutCode.replace(TAG_PATTERN, (match, prefix: string, slug: string) => {
    const tag = resolveAtlasRouteTag(slug);
    if (!tag) return match;
    return `${prefix}[#${slug}](${tag.route})`;
  });

  return linked.replace(/\u0000(\d+)\u0000/g, (_, index: string) => codeBlocks[Number(index)]);
};
