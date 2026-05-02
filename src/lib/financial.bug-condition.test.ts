/**
 * Bug Condition Exploration Test
 * Property 1: Dados Financeiros Hardcoded Ignoram Pedidos Reais
 *
 * CRITICAL: This test MUST FAIL on unfixed code — failure confirms the bug exists.
 * DO NOT attempt to fix the test or the code when it fails.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "../..");

// ── Helpers ───────────────────────────────────────────────────────────────────

function readSrc(relPath: string): string {
  return readFileSync(resolve(ROOT, "src", relPath), "utf-8");
}

function srcExists(relPath: string): boolean {
  return existsSync(resolve(ROOT, "src", relPath));
}

// ── Bug Condition: financial.ts and useFinancialData do not exist ─────────────

describe("Bug Condition — Ausência de camada de lógica financeira", () => {
  it("src/lib/financial.ts NÃO deve existir (confirma bug: sem cálculo dinâmico)", () => {
    // This assertion FAILS when the bug is fixed (financial.ts is created).
    // On unfixed code it PASSES — but the overall suite fails on the assertions below.
    // We assert it does NOT exist to document the bug condition.
    const exists = srcExists("lib/financial.ts");
    // BUG CONDITION: file must NOT exist on unfixed code
    expect(exists).toBe(false);
  });

  it("src/hooks/useFinancialData.ts NÃO deve existir (confirma bug: sem hook de dados reais)", () => {
    const exists = srcExists("hooks/useFinancialData.ts");
    // BUG CONDITION: hook must NOT exist on unfixed code
    expect(exists).toBe(false);
  });
});

// ── Bug Condition 1: SaldosPage exibe R$ 20.520,32 hardcoded ─────────────────

describe("Bug Condition 1 — SaldosPage: receita hardcoded ignora pedidos reais", () => {
  const saldosSource = readSrc("pages/dashboard/SaldosPage.tsx");

  it("SaldosPage contém o valor hardcoded R$ 20.520,32", () => {
    // This confirms the bug: the page has a hardcoded value
    expect(saldosSource).toContain("R$ 20.520,32");
  });

  it("SaldosPage contém constante EARNING_DATA hardcoded", () => {
    expect(saldosSource).toContain("EARNING_DATA");
  });

  it("SaldosPage contém constante CASHFLOW_DATA hardcoded", () => {
    expect(saldosSource).toContain("CASHFLOW_DATA");
  });

  it("SaldosPage contém constante SPENDING_BREAKDOWN hardcoded", () => {
    expect(saldosSource).toContain("SPENDING_BREAKDOWN");
  });

  it("SaldosPage contém constante UPCOMING_BILLS hardcoded", () => {
    expect(saldosSource).toContain("UPCOMING_BILLS");
  });

  it("FALHA ESPERADA — SaldosPage com 3 pedidos paid (total=100 cada) deve exibir R$ 300,00, não R$ 20.520,32", () => {
    /**
     * Counterexample: 3 pedidos paid com total=100 cada → receita esperada = R$ 300,00
     * Mas SaldosPage exibe R$ 20.520,32 hardcoded.
     *
     * Para o código corrigido: SaldosPage deve usar useFinancialData() e exibir
     * a soma real dos pedidos. Este teste FALHA no código não corrigido porque
     * SaldosPage não usa useFinancialData — ela usa EARNING_DATA hardcoded.
     */
    const orders = [
      { id: "1", total: 100, cost: 0, fees: 0, status: "paid", created_at: new Date().toISOString() },
      { id: "2", total: 100, cost: 0, fees: 0, status: "paid", created_at: new Date().toISOString() },
      { id: "3", total: 100, cost: 0, fees: 0, status: "paid", created_at: new Date().toISOString() },
    ];

    // Expected: revenue = sum of total for paid orders = 300
    const expectedRevenue = orders
      .filter(o => ["paid", "approved", "completed"].includes(o.status))
      .reduce((sum, o) => sum + o.total, 0);

    expect(expectedRevenue).toBe(300);

    // BUG: SaldosPage does NOT use these orders — it uses EARNING_DATA hardcoded.
    // The page displays "R$ 20.520,32" regardless of real orders.
    // This assertion FAILS on unfixed code because useFinancialData does not exist:
    const usesFinancialData = saldosSource.includes("useFinancialData");
    expect(usesFinancialData).toBe(true); // FAILS: SaldosPage does not import useFinancialData
  });

  it("FALHA ESPERADA — Supabase retornando array vazio deve exibir R$ 0,00, não R$ 20.520,32", () => {
    /**
     * Counterexample: sem pedidos → receita esperada = R$ 0,00
     * Mas SaldosPage exibe R$ 20.520,32 hardcoded mesmo sem pedidos.
     */
    const emptyOrders: { total: number; status: string }[] = [];
    const revenueFromEmpty = emptyOrders
      .filter(o => ["paid", "approved", "completed"].includes(o.status))
      .reduce((sum, o) => sum + o.total, 0);

    expect(revenueFromEmpty).toBe(0);

    // BUG: SaldosPage still shows "R$ 20.520,32" even with zero orders
    // because it never queries Supabase for financial data.
    const usesFinancialData = saldosSource.includes("useFinancialData");
    expect(usesFinancialData).toBe(true); // FAILS: SaldosPage does not import useFinancialData
  });
});

// ── Bug Condition 2: DashboardHomePage usa SALES_WEEKLY hardcoded ─────────────

describe("Bug Condition 2 — DashboardHomePage: chartData usa SALES_WEEKLY hardcoded", () => {
  const homeSource = readSrc("pages/dashboard/DashboardHomePage.tsx");

  it("DashboardHomePage contém constante SALES_WEEKLY hardcoded", () => {
    expect(homeSource).toContain("SALES_WEEKLY");
  });

  it("DashboardHomePage contém constante SALES_DAILY hardcoded", () => {
    expect(homeSource).toContain("SALES_DAILY");
  });

  it("DashboardHomePage contém constante SALES_MONTHLY hardcoded", () => {
    expect(homeSource).toContain("SALES_MONTHLY");
  });

  it("FALHA ESPERADA — DashboardHomePage com pedidos reais deve usar getSalesAnalytics, não SALES_WEEKLY", () => {
    /**
     * Counterexample: DashboardHomePage recebe pedidos reais mas chartData
     * ainda seleciona entre SALES_DAILY/WEEKLY/MONTHLY hardcoded.
     *
     * Para o código corrigido: chartData deve ser calculado via getSalesAnalytics(period, orders).
     * Este teste FALHA no código não corrigido porque DashboardHomePage não usa getSalesAnalytics.
     */
    const usesSalesAnalytics = homeSource.includes("getSalesAnalytics");
    expect(usesSalesAnalytics).toBe(true); // FAILS: DashboardHomePage uses hardcoded SALES_WEEKLY
  });
});

// ── Bug Condition 3: ReportsPage usa mockStats.totalRevenue ───────────────────

describe("Bug Condition 3 — ReportsPage: exibe mockStats.totalRevenue em vez da soma real", () => {
  const reportsSource = readSrc("pages/dashboard/ReportsPage.tsx");

  it("ReportsPage importa mockData.ts", () => {
    expect(reportsSource).toContain("mockData");
  });

  it("ReportsPage usa mockStats", () => {
    expect(reportsSource).toContain("mockStats");
  });

  it("ReportsPage usa mockOrders", () => {
    expect(reportsSource).toContain("mockOrders");
  });

  it("FALHA ESPERADA — ReportsPage deve usar useFinancialData em vez de mockStats", () => {
    /**
     * Counterexample: ReportsPage exibe mockStats.totalRevenue (valor fixo derivado
     * de mockOrders) em vez de calcular a soma real dos pedidos do Supabase.
     *
     * Para o código corrigido: ReportsPage deve importar useFinancialData e
     * usar summary.revenue para KPIs.
     * Este teste FALHA no código não corrigido porque ReportsPage importa mockData.ts.
     */
    const usesFinancialData = reportsSource.includes("useFinancialData");
    expect(usesFinancialData).toBe(true); // FAILS: ReportsPage uses mockStats from mockData.ts
  });
});
