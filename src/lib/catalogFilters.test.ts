import { describe, expect, it } from "vitest";
import {
  MIN_DISPLAY_RATING,
  PRICE_OPTIONS,
  RATING_OPTIONS,
  displayRatingFor,
  isRatingFilterNoop,
  matchesDisplayRating,
  matchesPriceRange,
  priceRangeFor,
  ratingThresholdFor,
  type PriceOption,
} from "./catalogFilters";

describe("catalogFilters — faixa de preço", () => {
  it('não filtra em "Todos os preços"', () => {
    expect(priceRangeFor("Todos os preços")).toBeNull();
    expect(matchesPriceRange(0, "Todos os preços")).toBe(true);
    expect(matchesPriceRange(9999, "Todos os preços")).toBe(true);
  });

  it("trata as bordas sem sobreposição entre faixas", () => {
    // Exatamente R$ 50 pertence só a "Até R$ 50"
    expect(matchesPriceRange(50, "Até R$ 50")).toBe(true);
    expect(matchesPriceRange(50, "R$ 50-150")).toBe(false);

    // Exatamente R$ 150 pertence só a "R$ 50-150"
    expect(matchesPriceRange(150, "R$ 50-150")).toBe(true);
    expect(matchesPriceRange(150, "Acima de R$ 150")).toBe(false);

    expect(matchesPriceRange(50.01, "R$ 50-150")).toBe(true);
    expect(matchesPriceRange(150.01, "Acima de R$ 150")).toBe(true);
  });

  it("cobre toda a reta: todo preço cai em exatamente uma faixa", () => {
    const faixas = PRICE_OPTIONS.filter((o) => o !== "Todos os preços") as PriceOption[];
    for (const price of [0, 1, 25, 49.99, 50, 50.01, 100, 149.99, 150, 150.01, 1000]) {
      const hits = faixas.filter((option) => matchesPriceRange(price, option));
      expect(hits, `R$ ${price} casou com ${hits.length} faixas`).toHaveLength(1);
    }
  });

  it("expõe min exclusivo e max inclusivo para a query", () => {
    expect(priceRangeFor("Até R$ 50")).toEqual({ max: 50 });
    expect(priceRangeFor("R$ 50-150")).toEqual({ min: 50, max: 150 });
    expect(priceRangeFor("Acima de R$ 150")).toEqual({ min: 150 });
  });
});

describe("catalogFilters — avaliação", () => {
  it('não filtra em "Todas"', () => {
    expect(ratingThresholdFor("Todas")).toBeNull();
  });

  it("devolve a nota mínima de cada opção", () => {
    expect(ratingThresholdFor("4+ estrelas")).toBe(4);
    expect(ratingThresholdFor("4.5+ estrelas")).toBe(4.5);
  });

  it("mantém todas as opções da UI mapeadas", () => {
    for (const option of RATING_OPTIONS) {
      expect(() => ratingThresholdFor(option)).not.toThrow();
    }
  });

  // toFixed(1) arredonda 4.95–4.99 para 5.0, então o teto real é 5.0.
  it("gera a nota exibida sempre dentro de [4.0, 5.0]", () => {
    const ids = Array.from({ length: 500 }, (_, i) => `produto-${i}-${i * 7919}`);
    for (const id of ids) {
      const nota = displayRatingFor(id);
      expect(nota).toBeGreaterThanOrEqual(MIN_DISPLAY_RATING);
      expect(nota).toBeLessThanOrEqual(5);
    }
  });

  it("é determinística: o mesmo id sempre dá a mesma nota", () => {
    const id = "a3f9c1e2-0b44-4d77-9c31-77e2b5d8a001";
    expect(displayRatingFor(id)).toBe(displayRatingFor(id));
  });

  it('trata "4+ estrelas" como no-op — a fórmula nunca produz menos que 4.0', () => {
    expect(isRatingFilterNoop("Todas")).toBe(true);
    expect(isRatingFilterNoop("4+ estrelas")).toBe(true);
    expect(isRatingFilterNoop("4.5+ estrelas")).toBe(false);

    const ids = Array.from({ length: 200 }, (_, i) => `p-${i}`);
    expect(ids.every((id) => matchesDisplayRating(id, "4+ estrelas"))).toBe(true);
  });

  it('"4.5+ estrelas" separa de fato o catálogo', () => {
    const ids = Array.from({ length: 400 }, (_, i) => `produto-${i}-${i * 31}`);
    const passam = ids.filter((id) => matchesDisplayRating(id, "4.5+ estrelas"));
    expect(passam.length).toBeGreaterThan(0);
    expect(passam.length).toBeLessThan(ids.length);
    for (const id of passam) {
      expect(displayRatingFor(id)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("o filtro usa exatamente a nota que o card exibe", () => {
    const id = "7c2e1a09-5b3d-4e88-a112-9f0c3d4e5b6a";
    const notaNoCard = displayRatingFor(id);
    expect(matchesDisplayRating(id, "4.5+ estrelas")).toBe(notaNoCard >= 4.5);
  });
});
