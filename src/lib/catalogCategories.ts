// Fonte única das categorias do catálogo Velo.
//
// PROBLEMA QUE ESTE ARQUIVO RESOLVE
// `catalog_products.category` guarda o nome CRU da categoria que vem da API do
// fornecedor (C7 Drop) — ex.: "Casa e Utensílios Domésticos", "Ring Light &
// Suportes", "Produtos diversos". Os filtros da UI usavam slugs ("casa",
// "eletronicos") comparados com `.eq()`, que é exato e sensível a caixa/acento.
// Nenhum produto batia e todo filtro caía em "Nenhum produto encontrado".
//
// A solução é traduzir cada categoria do Velo para a LISTA de nomes crus do
// fornecedor que pertencem a ela e filtrar com `.in()`.
//
// MANUTENÇÃO: se o fornecedor criar uma categoria nova, ela cai em "Outros" na
// visão do usuário só se estiver listada em OTHER_SUPPLIER_CATEGORIES; caso
// contrário fica acessível apenas em "Todos os produtos". Para descobrir nomes
// novos, rode um `select distinct category from catalog_products`.
// Espelho em Deno: supabase/functions/catalog/index.ts — manter em sincronia.

export type CatalogCategoryKey =
  | "todos"
  | "casa"
  | "eletronicos"
  | "ferramentas"
  | "bebe"
  | "beleza"
  | "decoracao"
  | "outros";

export const CATALOG_CATEGORIES: Array<{
  key: CatalogCategoryKey;
  label: string;
  shortLabel: string;
}> = [
  { key: "todos", label: "Todos os produtos", shortLabel: "Todos" },
  { key: "casa", label: "Casa", shortLabel: "Casa" },
  { key: "eletronicos", label: "Eletrônicos", shortLabel: "Eletrônicos" },
  { key: "ferramentas", label: "Ferramentas", shortLabel: "Ferramentas" },
  { key: "bebe", label: "Bebê e Infantil", shortLabel: "Bebê" },
  { key: "beleza", label: "Beleza", shortLabel: "Beleza" },
  { key: "decoracao", label: "Decoração", shortLabel: "Decoração" },
  { key: "outros", label: "Outros", shortLabel: "Outros" },
];

// Categorias do fornecedor que não formam um grupo próprio (curadorias,
// sazonais e sobras). Ficam todas sob "Outros".
const OTHER_SUPPLIER_CATEGORIES = [
  "Produtos diversos",
  "Outros",
  "Papelaria",
  "Mais vendidos",
  "Promoções do Mês",
  "Copa do Mundo",
  "Materiais de Pesca",
  "Fora de Estoque",
];

/**
 * Nomes crus de `catalog_products.category` que compõem cada categoria do Velo.
 * `todos` é vazio de propósito: significa "não aplicar filtro de categoria".
 *
 * Cada lista inclui também o próprio label do Velo, para que o filtro continue
 * funcionando caso os dados sejam normalizados no futuro (por scraper ou
 * backfill) sem exigir mudança aqui.
 */
export const SUPPLIER_CATEGORIES_BY_KEY: Record<CatalogCategoryKey, string[]> = {
  todos: [],
  casa: ["Casa", "Casa e Utensílios Domésticos", "Garrafas, Copos e Canecas"],
  eletronicos: [
    "Eletrônicos",
    "Informática",
    "Câmeras",
    "Relogios e Smartwatchs",
    "Caixas de Som",
    "Fones de Ouvido",
    "Umidificadores & Ventiladores",
    "Carregadores & Power Banks",
    "Media Streaming",
    "Ring Light & Suportes",
    "Celulares e Smartphones",
    "Games",
  ],
  ferramentas: ["Ferramentas"],
  bebe: ["Bebê e Infantil", "Brinquedos"],
  beleza: ["Beleza", "Beleza e Cuidado Pessoal", "Salão & Barbearia", "Maquiagem"],
  decoracao: ["Decoração", "Iluminação"],
  outros: OTHER_SUPPLIER_CATEGORIES,
};

/**
 * Categorias que o fornecedor entrega mas que não foram atribuídas a nenhum
 * grupo — usada por testes para garantir que nada fique órfão silenciosamente.
 */
export function supplierCategoriesCovered(): Set<string> {
  const covered = new Set<string>();
  for (const key of Object.keys(SUPPLIER_CATEGORIES_BY_KEY) as CatalogCategoryKey[]) {
    for (const name of SUPPLIER_CATEGORIES_BY_KEY[key]) covered.add(name);
  }
  return covered;
}

/**
 * Traduz a chave de UI para os valores de `category` a usar em `.in()`.
 * Retorna `null` quando não há filtro a aplicar ("todos" ou chave desconhecida).
 */
export function supplierCategoriesFor(key: CatalogCategoryKey): string[] | null {
  const names = SUPPLIER_CATEGORIES_BY_KEY[key];
  return names && names.length > 0 ? names : null;
}

const KEY_BY_SUPPLIER_CATEGORY: Map<string, CatalogCategoryKey> = (() => {
  const map = new Map<string, CatalogCategoryKey>();
  for (const key of Object.keys(SUPPLIER_CATEGORIES_BY_KEY) as CatalogCategoryKey[]) {
    if (key === "todos") continue;
    for (const name of SUPPLIER_CATEGORIES_BY_KEY[key]) map.set(name, key);
  }
  return map;
})();

/**
 * Caminho inverso: dado o `category` cru de um produto, devolve a categoria do
 * Velo à qual ele pertence. Retorna `null` para nomes ainda não mapeados — eles
 * seguem visíveis em "Todos os produtos", só não entram em nenhum grupo.
 */
export function categoryKeyForSupplierCategory(
  raw: string | null | undefined,
): CatalogCategoryKey | null {
  if (!raw) return null;
  return KEY_BY_SUPPLIER_CATEGORY.get(raw.trim()) ?? null;
}
