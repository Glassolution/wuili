import { describe, expect, it } from "vitest";
import { bestAccessSubscription, resolveAccessPlan, subscriptionHasAccess, SUBSCRIPTION_GRACE_MS } from "./subscriptionAccess";
import { expiredProviderTarget, recentPaidCharges } from "../../supabase/functions/_shared/subscriptionAccessPolicy";
import { readAccessPlan } from "../../supabase/functions/_shared/subscriptionAccess";

const end = Date.parse("2026-11-20T18:25:00Z");
const monthly = { plan: "pro", status: "active", provider: "validapay", purchase_kind: "recurring", current_period_end: new Date(end).toISOString() };

describe("validade do plano", () => {
  it("a tolerância mensal é exatamente três dias", () => {
    expect(SUBSCRIPTION_GRACE_MS).toBe(259200000);
    expect(subscriptionHasAccess(monthly, end + 259200000)).toBe(true);
    expect(subscriptionHasAccess(monthly, end + 259200001)).toBe(false);
  });
  it("vitalício ativo nunca vence, inclusive com data antiga ou nula", () => {
    expect(subscriptionHasAccess({ ...monthly, purchase_kind: "lifetime" }, Date.parse("2036-11-23T00:00:00Z"))).toBe(true);
    expect(subscriptionHasAccess({ ...monthly, purchase_kind: "lifetime", current_period_end: null }, end)).toBe(true);
    expect(subscriptionHasAccess({ ...monthly, purchase_kind: "lifetime", status: "refunded" }, end)).toBe(false);
  });
  it.each(["expired", "past_due", "pending", "refunded", "cancelled"])("%s não libera plano", status => {
    expect(subscriptionHasAccess({ ...monthly, status }, end - 1)).toBe(false);
  });
  it("data mensal ausente/inválida não comprova acesso", () => {
    expect(subscriptionHasAccess({ ...monthly, current_period_end: null }, end)).toBe(false);
    expect(subscriptionHasAccess({ ...monthly, current_period_end: "invalid" }, end)).toBe(false);
  });
  it("mantém o maior plano válido, não o maior plano vencido", () => {
    expect(bestAccessSubscription([monthly, { ...monthly, plan: "base", purchase_kind: "lifetime" }], end + 259200001)?.plan).toBe("base");
    expect(bestAccessSubscription([{ ...monthly, plan: "base" }, monthly], end)?.plan).toBe("pro");
  });
  it("sandbox não concede acesso pago", () => {
    expect(subscriptionHasAccess({ ...monthly, provider: "sandbox", purchase_kind: "lifetime" }, end)).toBe(false);
  });
  it.each(["mercadopago", "stripe", "manual", "manual_admin"])("%s mantém acesso pelo status, sem data", provider => {
    expect(subscriptionHasAccess({ ...monthly, provider, current_period_end: "2000-01-01T00:00:00Z" }, end)).toBe(true);
    expect(subscriptionHasAccess({ ...monthly, provider, current_period_end: null }, end)).toBe(true);
    expect(subscriptionHasAccess({ ...monthly, provider, status: "expired" }, end)).toBe(false);
  });
  it("sem assinatura elegível o plano é gratis, sem fallback", () => {
    expect(resolveAccessPlan([], end)).toBe("gratis");
    expect(resolveAccessPlan([{ ...monthly, status: "expired" }], end)).toBe("gratis");
    expect(resolveAccessPlan([{ ...monthly, status: "past_due" }], end)).toBe("gratis");
  });
  it("fallback não resgata ValidaPay ACTIVE com período vencido", () => {
    expect(resolveAccessPlan([monthly], end + 259200001)).toBe("gratis");
  });
  it("um contrato válido continua prevalecendo sobre profiles.plano", () => {
    expect(resolveAccessPlan([monthly], end)).toBe("pro");
    expect(resolveAccessPlan([{ ...monthly, provider: "manual", plan: "base", current_period_end: null }], end)).toBe("base");
  });
  it("sandbox em status de acesso não habilita o fallback do perfil", () => {
    expect(resolveAccessPlan([{ ...monthly, provider: "sandbox" }], end)).toBe("gratis");
  });
  it("expired com perfil business retorna gratis e nunca consulta o perfil", async () => {
    const calls: string[] = [];
    const client = { from(table: string) {
      calls.push(table);
      return { select: () => ({ eq: () => table === "subscriptions"
        ? Promise.resolve({ data: [{ ...monthly, status: "expired" }], error: null })
        : { maybeSingle: async () => ({ data: { plano: "business" }, error: null }) } }) };
    } };
    expect(await readAccessPlan(client, "internal-user", end)).toBe("gratis");
    expect(calls).toEqual(["subscriptions"]);
  });
  it("falha na leitura de assinaturas não é confundida com ausência para usar fallback", async () => {
    const client = { from(table: string) {
      if (table !== "subscriptions") throw new Error("unexpected_profile_read");
      return { select: () => ({ eq: async () => ({ data: null, error: { message: "network_failed" } }) }) };
    } };
    await expect(readAccessPlan(client, "internal-user", end)).rejects.toThrow("subscription_access_read:network_failed");
  });
  it("cancelamento agendado preserva o período pago e sua tolerância", () => {
    expect(subscriptionHasAccess({ ...monthly, status: "cancel_scheduled" }, end + 259200000)).toBe(true);
  });
  it("o servidor não usa o plano em cache do perfil para liberar vencido", async () => {
    const tables: string[] = [];
    const client = { from(table: string) {
      tables.push(table);
      if (table !== "subscriptions") throw new Error("unexpected_table");
      return { select: () => ({ eq: async () => ({ data: [monthly], error: null }) }) };
    } };
    expect(await readAccessPlan(client, "internal-user", end + 259200001)).toBe("gratis");
    expect(tables).toEqual(["subscriptions"]);
  });
});

describe("travas da conferência horária", () => {
  const now = Date.parse("2026-11-23T21:25:00Z");
  const expired = { ...monthly, current_period_end: "2026-10-01T00:00:00Z" };
  it("EXPIRED confirmado vira expired", () => {
    expect(expiredProviderTarget(expired, "EXPIRED", false, false, now)).toBe("expired");
  });
  it("DEFAULT confirmado vira past_due", () => {
    expect(expiredProviderTarget(expired, "DEFAULT", false, false, now)).toBe("past_due");
  });
  it("PAID em qualquer contrato nos últimos 35 dias protege a conta", () => {
    const paid = [{ chargeId: "charge-paid", status: "PAID", paidAt: "2026-10-19T21:25:00Z", subscription: { subscriptionId: "other-contract" } }];
    expect(recentPaidCharges(paid, ["old-contract", "other-contract"], [], now)).toHaveLength(1);
    expect(expiredProviderTarget(expired, "DEFAULT", true, false, now)).toBeNull();
    expect(recentPaidCharges([{ ...paid[0], paidAt: "2026-10-19T21:24:59Z" }], ["other-contract"], [], now)).toHaveLength(0);
  });
  it("pagamento em contrato ausente localmente protege pelo e-mail", () => {
    expect(recentPaidCharges([{ status: "PAID", paidAt: "2026-11-22T00:00:00Z", customer: { email: "TEST@example.com" } }], [], ["test@example.com"], now)).toHaveLength(1);
  });
  it("PAID sem data é protegido, não presumido antigo", () => {
    expect(recentPaidCharges([{ status: "PAID", subscription: { subscriptionId: "sub-test" } }], ["sub-test"], [], now)).toHaveLength(1);
  });
  it("conta vitalícia nunca entra na correção", () => {
    expect(expiredProviderTarget(expired, "EXPIRED", false, true, now)).toBeNull();
    expect(expiredProviderTarget({ ...expired, purchase_kind: "lifetime" }, "EXPIRED", false, false, now)).toBeNull();
  });
  it("não altera Mercado Pago, Stripe ou manuais", () => {
    for (const provider of ["mercadopago", "stripe", "manual", "manual_admin"]) {
      expect(expiredProviderTarget({ ...expired, provider }, "EXPIRED", false, false, now)).toBeNull();
    }
  });
  it("falha de API, contrato ativo ou desconhecido não revoga acesso", () => {
    for (const state of [undefined, "ACTIVE", "UNKNOWN"]) expect(expiredProviderTarget(expired, state, false, false, now)).toBeNull();
  });
});