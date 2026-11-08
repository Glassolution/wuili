import type { HelpArticle, HelpCategory } from "@/lib/helpCenter";

/*
  Busca da Central de Ajuda, feita no navegador sobre os artigos já carregados
  (são poucos e a página já baixa todos). Sem acento e sem diferença de
  maiúsculas; palavras curtas e muito comuns ("como", "minha") não contam.
  Cada termo casa pelo radical (5 primeiras letras), para "solicito" achar
  "solicitar". O título pesa mais que as palavras-chave, que pesam mais que o
  resumo e o corpo.
*/

const STOPWORDS = new Set([
  "como", "para", "pela", "pelo", "minha", "meu", "meus", "minhas", "que", "uma", "um", "com", "sem", "por",
  "dos", "das", "nos", "nas", "não", "nao", "mais", "esta", "este", "isso", "qual", "quais", "onde", "quando",
  "posso", "fazer", "faço", "faco", "the", "velo", "quero", "queria", "preciso", "gostaria", "ajuda", "consigo",
]);

/** Radicais que também valem pelo sinônimo (o artigo pode usar outra palavra). */
const SYNONYMS: Record<string, string[]> = {
  estor: ["reemb", "devol"],
  devol: ["reemb", "estor"],
  reemb: ["estor", "devol"],
  cobra: ["pagam", "fatur"],
  assin: ["plano"],
};

export const normalizeHelpText = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function helpSearchTerms(query: string): string[] {
  const words = normalizeHelpText(query)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word));
  return Array.from(new Set(words.map((word) => (word.length > 5 ? word.slice(0, 5) : word))));
}

export type HelpSearchHit = { article: HelpArticle; category: HelpCategory; score: number };

export function searchHelpArticles(
  entries: Array<{ article: HelpArticle; category: HelpCategory }>,
  query: string,
): HelpSearchHit[] {
  const terms = helpSearchTerms(query);
  if (!terms.length) return [];

  const docs = entries.map(({ article, category }) => ({
    article,
    category,
    title: normalizeHelpText(article.title),
    keywords: normalizeHelpText(article.keywords.join(" ")),
    summary: normalizeHelpText(`${article.summary ?? ""} ${category.title}`),
    content: normalizeHelpText(article.content),
  }));
  const scoreIn = (doc: (typeof docs)[number], t: string) =>
    (doc.title.includes(t) ? 4 : 0) + (doc.keywords.includes(t) ? 3 : 0) + (doc.summary.includes(t) ? 1.5 : 0) + (doc.content.includes(t) ? 1 : 0);
  // Sinônimo vale um pouco menos que a palavra exata.
  const termScore = (doc: (typeof docs)[number], term: string) =>
    Math.max(scoreIn(doc, term), ...(SYNONYMS[term] ?? []).map((t) => scoreIn(doc, t) * 0.9));
  // Palavra que aparece em quase todo artigo ("plano") pesa menos que uma rara ("estorno").
  const weight = Object.fromEntries(
    terms.map((term) => {
      const df = docs.filter((doc) => termScore(doc, term) > 0).length;
      return [term, Math.max(0.1, Math.log(docs.length / Math.max(1, df)))];
    }),
  );

  const hits: HelpSearchHit[] = [];
  for (const doc of docs) {
    const { article, category } = doc;
    let score = 0;
    let matched = 0;
    for (const term of terms) {
      const value = termScore(doc, term);
      if (value > 0) matched += 1;
      score += value * weight[term];
    }
    if (matched === 0) continue;
    hits.push({ article, category, score: score * (matched / terms.length), matched } as HelpSearchHit & { matched: number });
  }
  // Com várias palavras, fica só com quem cobre pelo menos metade delas;
  // se ninguém cobre, mostra os parciais (melhor que "nenhum resultado").
  const needed = Math.ceil(terms.length / 2);
  const strong = (hits as Array<HelpSearchHit & { matched: number }>).filter((h) => h.matched >= needed);
  return (strong.length ? strong : hits)
    .map(({ article, category, score }) => ({ article, category, score }))
    .sort((a, b) => b.score - a.score || a.article.title.localeCompare(b.article.title, "pt-BR"));
}
