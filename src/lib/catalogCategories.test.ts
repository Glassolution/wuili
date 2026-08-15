import { describe, expect, it } from "vitest";
import {
  CATALOG_CATEGORIES,
  SUPPLIER_CATEGORIES_BY_KEY,
  categoryKeyForSupplierCategory,
  supplierCategoriesCovered,
  supplierCategoriesFor,
  type CatalogCategoryKey,
} from "./catalogCategories";

// Snapshot dos valores distintos realmente presentes em catalog_products.category
// (830 produtos ativos e com estoque, coletados via a Edge Function `catalog`).
// Serve de âncora: se o fornecedor introduzir uma categoria nova, atualize esta
// lista junto com o mapeamento.
const SUPPLIER_CATEGORIES_IN_DB = [
  "Casa e Utensílios Domésticos",
  "Produtos diversos",
  "Informática",
  "Brinquedos",
  "Ferramentas",
  "Beleza e Cuidado Pessoal",
  "Câmeras",
  "Relogios e Smartwatchs",
  "Caixas de Som",
  "Iluminação",
  "Salão & Barbearia",
  "Fora de Estoque",
  "Papelaria",
  "Fones de Ouvido",
  "Umidificadores & Ventiladores",
  "Carregadores & Power Banks",
  "Mais vendidos",
  "Copa do Mundo",
  "Media Streaming",
  "Ring Light & Suportes",
  "Promoções do Mês",
  "Celulares e Smartphones",
  "Anúncios em Massa",
  "Garrafas, Copos e Canecas",
  "Materiais de Pesca",
  "Games",
  "Outros",
  "Maquiagem",
];

// "Anúncios em Massa" são pacotes de anúncios que a C7 Drop vende como produto —
// isFakeAdProduct() deveria barrá-los na coleta, então não recebem categoria do
// Velo de propósito.
const INTENTIONALLY_UNMAPPED = ["Anúncios em Massa"];

describe("catalogCategories", () => {
  it("cobre todas as categorias que o fornecedor entrega hoje", () => {
    const covered = supplierCategoriesCovered();
    const orphans = SUPPLIER_CATEGORIES_IN_DB.filter(
      (name) => !covered.has(name) && !INTENTIONALLY_UNMAPPED.includes(name),
    );
    expect(orphans).toEqual([]);
  });

  it("não expõe categoria de UI sem nenhum produto possível", () => {
    for (const { key, label } of CATALOG_CATEGORIES) {
      if (key === "todos") continue;
      const names = SUPPLIER_CATEGORIES_BY_KEY[key];
      const reachable = names.filter((name) => SUPPLIER_CATEGORIES_IN_DB.includes(name));
      expect(reachable.length, `categoria "${label}" não casaria com nenhum produto`).toBeGreaterThan(0);
    }
  });

  it('não aplica filtro para "todos"', () => {
    expect(supplierCategoriesFor("todos")).toBeNull();
  });

  it("traduz a chave da UI para os nomes crus usados no .in()", () => {
    expect(supplierCategoriesFor("casa")).toContain("Casa e Utensílios Domésticos");
    expect(supplierCategoriesFor("eletronicos")).toContain("Fones de Ouvido");
    expect(supplierCategoriesFor("bebe")).toContain("Brinquedos");
  });

  it("faz o caminho inverso do nome cru para a categoria do Velo", () => {
    expect(categoryKeyForSupplierCategory("Casa e Utensílios Domésticos")).toBe("casa");
    expect(categoryKeyForSupplierCategory("Salão & Barbearia")).toBe("beleza");
    expect(categoryKeyForSupplierCategory("Iluminação")).toBe("decoracao");
    expect(categoryKeyForSupplierCategory("  Ferramentas  ")).toBe("ferramentas");
    expect(categoryKeyForSupplierCategory(null)).toBeNull();
    expect(categoryKeyForSupplierCategory("Categoria Inexistente")).toBeNull();
  });

  it("mantém cada nome cru em uma única categoria do Velo", () => {
    const seen = new Map<string, CatalogCategoryKey>();
    for (const key of Object.keys(SUPPLIER_CATEGORIES_BY_KEY) as CatalogCategoryKey[]) {
      for (const name of SUPPLIER_CATEGORIES_BY_KEY[key]) {
        expect(seen.has(name), `"${name}" duplicado em ${seen.get(name)} e ${key}`).toBe(false);
        seen.set(name, key);
      }
    }
  });
});
