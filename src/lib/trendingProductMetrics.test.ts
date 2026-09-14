import { describe, expect, it } from "vitest";
import {
  getTrendingDisplayScore,
  getTrendingDisplayMetrics,
  MAX_TRENDING_RATING,
  MIN_TRENDING_MONTHLY_SALES,
  MIN_TRENDING_RATING,
  MIN_TRENDING_REVIEWS,
} from "./trendingProductMetrics";

describe("trendingProductMetrics", () => {
  it("replaces the old 10 sales floor with stable catalog-based demand", () => {
    const metrics = getTrendingDisplayMetrics({
      id: "product-1",
      title: "Fone De Ouvido Bluetooth",
      category: "Fones de Ouvido",
      suggested_price: 96,
      cost_price: 42,
      margin_percent: 56,
      orders_count: 10,
      rating: 5,
      stock_quantity: 180,
      images: ["a.jpg", "b.jpg", "c.jpg", "d.jpg"],
    });

    expect(metrics.monthlySales).toBeGreaterThanOrEqual(MIN_TRENDING_MONTHLY_SALES);
    expect(metrics.monthlySales).not.toBe(10);
    expect(metrics.rating).toBeLessThanOrEqual(MAX_TRENDING_RATING);
    expect(metrics.estimatedSales).toBe(true);
  });

  it("lifts empty or weak ratings to a credible minimum with enough reviews", () => {
    const emptyRating = getTrendingDisplayMetrics({
      id: "product-2",
      title: "Kit Manicure Tesoura Alicate",
      category: "Maquiagem",
      suggested_price: 50,
      cost_price: 18,
      margin_percent: 64,
      orders_count: 0,
      rating: null,
      stock_quantity: 90,
      images: ["a.jpg", "b.jpg", "c.jpg"],
    });

    const weakRating = getTrendingDisplayMetrics({
      id: "product-3",
      title: "Alto-falante Altomex caixa",
      category: "Caixas de Som",
      suggested_price: 34,
      cost_price: 14,
      margin_percent: 58,
      orders_count: 8,
      rating: 1,
      stock_quantity: 220,
      images: ["a.jpg", "b.jpg", "c.jpg", "d.jpg"],
    });

    expect(emptyRating.rating).toBeGreaterThanOrEqual(MIN_TRENDING_RATING);
    expect(weakRating.rating).toBeGreaterThanOrEqual(MIN_TRENDING_RATING);
    expect(emptyRating.reviewsCount).toBeGreaterThanOrEqual(MIN_TRENDING_REVIEWS);
    expect(weakRating.reviewsCount).toBeGreaterThanOrEqual(MIN_TRENDING_REVIEWS);
  });

  it("caps perfect source ratings at 4.8", () => {
    const metrics = getTrendingDisplayMetrics({
      id: "product-4",
      title: "Megafone Amplificador Professor",
      category: "Produtos diversos",
      suggested_price: 100,
      cost_price: 45,
      margin_percent: 55,
      orders_count: 269,
      rating: 5,
      stock_quantity: 120,
      images: ["a.jpg", "b.jpg", "c.jpg"],
    });

    expect(metrics.rating).toBe(MAX_TRENDING_RATING);
  });

  it("orders Ranking Velo by combined demand, margin, rating and social proof", () => {
    const weakDemand = {
      id: "product-5",
      title: "Item com poucas vendas",
      category: "Casa",
      suggested_price: 80,
      cost_price: 38,
      margin_percent: 52,
      orders_count: 42,
      rating: 4.8,
      stock_quantity: 90,
      images: ["a.jpg", "b.jpg", "c.jpg"],
    };
    const strongerDemand = {
      id: "product-6",
      title: "Item com demanda melhor",
      category: "Casa",
      suggested_price: 80,
      cost_price: 38,
      margin_percent: 52,
      orders_count: 360,
      rating: 4.7,
      stock_quantity: 90,
      images: ["a.jpg", "b.jpg", "c.jpg"],
    };

    expect(getTrendingDisplayScore(strongerDemand)).toBeGreaterThan(getTrendingDisplayScore(weakDemand));
  });
});
