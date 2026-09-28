import { supabase } from "@/integrations/supabase/client";

/*
  Central de Ajuda: categorias + artigos em Markdown (tabelas help_categories e
  help_articles). O mesmo formato alimenta a página pública, o admin e, depois,
  o assistente de suporte por IA — que deve ler a view help_center_documents ou
  chamar a RPC search_help_articles, nunca raspar a página.
*/

export type HelpArticleStatus = "draft" | "published";

export type HelpCategory = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  icon: string | null;
  section: string;
  featured: boolean;
  position: number;
};

export type HelpArticle = {
  id: string;
  category_id: string;
  slug: string;
  title: string;
  summary: string | null;
  content: string;
  keywords: string[];
  status: HelpArticleStatus;
  position: number;
  published_at: string | null;
  updated_at: string;
};

export type HelpCategoryInput = Omit<HelpCategory, "id">;
export type HelpArticleInput = Omit<HelpArticle, "id" | "published_at" | "updated_at">;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas novas ainda não constam em types.ts (gerado pelo Lovable Cloud)
const sb = supabase as any;

const CATEGORY_COLUMNS = "id, slug, title, description, icon, section, featured, position";
const ARTICLE_COLUMNS =
  "id, category_id, slug, title, summary, content, keywords, status, position, published_at, updated_at";

export const helpCenterKeys = {
  all: ["help-center"] as const,
  public: ["help-center", "public"] as const,
  admin: ["help-center", "admin"] as const,
};

const byPosition = <T extends { position: number; title: string }>(a: T, b: T) =>
  a.position - b.position || a.title.localeCompare(b.title, "pt-BR");

/**
 * Lê categorias e artigos. Sem login (ou sem ser admin) o RLS já devolve só os
 * artigos publicados; o filtro explícito evita que o admin veja rascunhos na
 * página pública.
 */
export async function fetchHelpCenter({ includeDrafts = false } = {}) {
  let articlesQuery = sb.from("help_articles").select(ARTICLE_COLUMNS);
  if (!includeDrafts) articlesQuery = articlesQuery.eq("status", "published");

  const [categoriesRes, articlesRes] = await Promise.all([
    sb.from("help_categories").select(CATEGORY_COLUMNS),
    articlesQuery,
  ]);
  if (categoriesRes.error) throw categoriesRes.error;
  if (articlesRes.error) throw articlesRes.error;

  const categories = ((categoriesRes.data ?? []) as HelpCategory[]).sort(byPosition);
  const articles = ((articlesRes.data ?? []) as HelpArticle[])
    .map((article) => ({ ...article, keywords: article.keywords ?? [] }))
    .sort(byPosition);
  return { categories, articles };
}

export async function saveHelpCategory(input: HelpCategoryInput, id?: string) {
  const query = id
    ? sb.from("help_categories").update(input).eq("id", id)
    : sb.from("help_categories").insert(input);
  const { error } = await query;
  if (error) throw error;
}

export async function deleteHelpCategory(id: string) {
  const { error } = await sb.from("help_categories").delete().eq("id", id);
  if (error) throw error;
}

export async function saveHelpArticle(input: HelpArticleInput, userId: string | undefined, id?: string) {
  const query = id
    ? sb.from("help_articles").update({ ...input, updated_by: userId ?? null }).eq("id", id)
    : sb.from("help_articles").insert({ ...input, created_by: userId ?? null, updated_by: userId ?? null });
  const { error } = await query;
  if (error) throw error;
}

export async function setHelpArticleStatus(id: string, status: HelpArticleStatus, userId: string | undefined) {
  const { error } = await sb.from("help_articles").update({ status, updated_by: userId ?? null }).eq("id", id);
  if (error) throw error;
}

export async function deleteHelpArticle(id: string) {
  const { error } = await sb.from("help_articles").delete().eq("id", id);
  if (error) throw error;
}

/** Troca a posição de dois itens da mesma tabela (setas de ordenar no admin). */
export async function swapHelpPositions(
  table: "help_categories" | "help_articles",
  a: { id: string; position: number },
  b: { id: string; position: number },
) {
  // Posições iguais não trocariam nada; afasta uma delas para a ordem mudar.
  const posA = a.position === b.position ? b.position + 1 : b.position;
  const posB = a.position;
  const [first, second] = await Promise.all([
    sb.from(table).update({ position: posA }).eq("id", a.id),
    sb.from(table).update({ position: posB }).eq("id", b.id),
  ]);
  if (first.error) throw first.error;
  if (second.error) throw second.error;
}

/** "Anúncio pausado!" → "anuncio-pausado" */
export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export const isValidSlug = (value: string) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value);

/** Busca local (instantânea) sobre o que já foi carregado na página. */
export function matchesHelpQuery(article: HelpArticle, category: HelpCategory | undefined, query: string) {
  const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = normalize(
    [article.title, article.summary ?? "", article.content, article.keywords.join(" "), category?.title ?? ""].join(" "),
  );
  return terms.every((term) => haystack.includes(term));
}

export const helpArticlePath = (base: string, category: HelpCategory, article: HelpArticle) =>
  `${base}/${category.slug}/${article.slug}`;

/** Tradução de erros do Postgres mais comuns no admin. */
export function helpCenterErrorMessage(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  if (code === "23505") return "Já existe um item com esse endereço (slug). Escolha outro.";
  if (code === "23503") return "Essa categoria ainda tem artigos. Mova ou exclua os artigos antes.";
  if (code === "23514") return "Algum campo está em formato inválido. Confira o endereço (slug) e o título.";
  if (code === "42501") return "Sem permissão. Apenas administradores podem alterar a Central de Ajuda.";
  return "Não foi possível salvar. Tente novamente.";
}
