import { describe, expect, it } from "vitest";
import { needsProviderCancellation } from "./providerCancellationAuditPolicy";

const active = { subscriptionId: "sub_1", status: "ACTIVE", cancelAtPeriodEnd: false };
describe("auditoria de cancelamento no provedor", () => {
  it("reembolsado na Velo e ativo na ValidaPay precisa cancelar", () => {
    expect(needsProviderCancellation(active, { status: "refunded" })).toBe(true);
  });
  it("cancelado na Velo e ativo na ValidaPay precisa cancelar", () => {
    expect(needsProviderCancellation(active, { status: "cancelled" })).toBe(true);
  });
  it("já agendado na ValidaPay não precisa", () => {
    expect(needsProviderCancellation({ ...active, cancelAtPeriodEnd: true }, { status: "refunded" })).toBe(false);
  });
  it("assinatura ativa paga não é cancelada", () => {
    expect(needsProviderCancellation(active, { status: "active" })).toBe(false);
  });
  it("sem registro local não cancela sozinho", () => {
    expect(needsProviderCancellation(active, undefined)).toBe(false);
  });
});
