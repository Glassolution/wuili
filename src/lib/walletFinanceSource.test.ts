import { describe, expect, it } from "vitest";
import { shouldUseProviderStatement, type WalletFinanceSnapshot } from "./walletFinanceSource";

const snapshot = (
  metrics: Partial<WalletFinanceSnapshot["metrics"]>,
  statement_available?: boolean,
): WalletFinanceSnapshot => ({
  statement_available,
  metrics: { approved_sales: 0, gross_revenue: 0, costs: 0, ...metrics },
});

const EMPTY = snapshot({});

describe("shouldUseProviderStatement", () => {
  it("usa os eventos locais quando o extrato ainda não respondeu", () => {
    expect(shouldUseProviderStatement(undefined, snapshot({ approved_sales: 2, gross_revenue: 79.8 }))).toBe(false);
    expect(shouldUseProviderStatement(null, EMPTY)).toBe(false);
  });

  it("usa os eventos locais quando a Edge Function informa que não há extrato", () => {
    const provider = snapshot({}, false);
    const local = snapshot({ approved_sales: 2, gross_revenue: 79.8 });
    expect(shouldUseProviderStatement(provider, local)).toBe(false);
  });

  // Regressão: o extrato voltava vazio com 200 e zerava os cartões da Carteira
  // enquanto a tabela de atividade listava as cobranças confirmadas.
  it("usa os eventos locais quando o extrato volta vazio mas há cobranças confirmadas", () => {
    const provider = snapshot({});
    const local = snapshot({ approved_sales: 2, gross_revenue: 79.8, costs: 159.6 });
    expect(shouldUseProviderStatement(provider, local)).toBe(false);
  });

  it("aceita o extrato quando ele traz qualquer movimentação", () => {
    expect(shouldUseProviderStatement(snapshot({ gross_revenue: 39.9 }), EMPTY)).toBe(true);
    expect(shouldUseProviderStatement(snapshot({ approved_sales: 1 }), EMPTY)).toBe(true);
    expect(shouldUseProviderStatement(snapshot({ costs: 39.9 }), EMPTY)).toBe(true);
  });

  it("aceita o extrato vazio quando também não há eventos locais no período", () => {
    expect(shouldUseProviderStatement(EMPTY, EMPTY)).toBe(true);
  });

  it("prefere o extrato oficial quando as duas fontes têm dados", () => {
    const provider = snapshot({ approved_sales: 5, gross_revenue: 199.5 });
    const local = snapshot({ approved_sales: 2, gross_revenue: 79.8 });
    expect(shouldUseProviderStatement(provider, local)).toBe(true);
  });

  it("ignora valores negativos ou inválidos ao decidir se o extrato tem dados", () => {
    const provider = snapshot({ gross_revenue: Number.NaN, costs: -10 });
    const local = snapshot({ approved_sales: 3 });
    expect(shouldUseProviderStatement(provider, local)).toBe(false);
  });
});
