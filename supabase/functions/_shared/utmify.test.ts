import { strict as assert } from "node:assert";
import { buildUtmifyBody, safeUtm, scheduleUtmifyTask, sendUtmifyOrder, utmifyHistoricalEvidence, utmifyIsMetaAds, utmifyTooOld, utmifyWebhookInput } from "./utmify.ts";

const now = Date.parse("2026-11-27T22:00:00Z");
const day = 86_400_000;
const sub = { id: "test-subscription", user_id: "test-user", provider: "validapay", plan: "base", amount: 39.90,
  payment_method: "pix", purchase_kind: "monthly", created_at: "2026-11-27T21:00:00Z", status: "active", validapay_subscription_id: "test-contract" };
const profile = { display_name: "Pessoa Exemplo", email: "pessoa@example.invalid", utm_source: "FB", utm_medium: "paid", utm_campaign: "Campanha|1234567890123456" };
const input = { subscriptionId: sub.id, status: "paid" as const, triggerSource: "webhook_first_purchase" as const, approvedAt: "2026-11-27T21:01:00Z" };

function fixture(settings: { enabled?: boolean; test?: boolean; renewals?: boolean; response?: number; networkFail?: boolean; hang?: boolean; bodyHang?: boolean; token?: boolean } = {}) {
  const tables: Record<string, Array<Record<string, unknown>>> = { subscriptions: [{ ...sub }], profiles: [{ ...profile, user_id: sub.user_id }], utmify_order_events: [], validapay_webhook_events: [] };
  const requests: RequestInit[] = [];
  const failures = new Set<string>();
  const admin = { from(table: string) {
    const filters: Array<(row: Record<string, unknown>) => boolean> = [];
    let inserted: Record<string, unknown> | null = null;
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters.push(row => row[key] === value); return query; },
      is: (key: string, value: unknown) => { filters.push(row => row[key] === value); return query; },
      in: (key: string, value: unknown[]) => { filters.push(row => value.includes(row[key])); return query; },
      order: () => query, limit: () => query,
      insert: (row: Record<string, unknown>) => { inserted = row; return query; },
      maybeSingle: async () => ({ data: tables[table]?.find(row => filters.every(f => f(row))), error: failures.has(table) ? { message: "private data deliberately withheld" } : null }),
      then: (resolve: (value: unknown) => unknown) => {
        if (inserted && !failures.has(table)) tables[table].push(inserted);
        return Promise.resolve({ data: tables[table]?.filter(row => filters.every(f => f(row))) ?? [],
          error: failures.has(table) ? { message: "private data deliberately withheld" } : null }).then(resolve);
      },
    };
    return query;
  } };
  const env: Record<string, string | undefined> = { UTMIFY_ENABLED: settings.enabled === false ? undefined : "true",
    UTMIFY_TEST_MODE: settings.test === false ? "false" : "true", UTMIFY_API_TOKEN: settings.token === false ? undefined : "simulation-only",
    UTMIFY_SEND_RENEWALS: settings.renewals ? "true" : undefined };
  const deps = { env: (name: string) => env[name], now: () => now, timeoutMs: 10,
    fetch: (async (_url: RequestInfo | URL, init?: RequestInit) => {
      requests.push(init ?? {});
      if (settings.networkFail) throw new Error("never log provider echoes");
      if (settings.hang) return await new Promise<Response>(() => {});
      if (settings.bodyHang) return { ok: true, status: 200, body: { cancel: () => new Promise<void>(() => {}) } } as unknown as Response;
      return new Response("ignored provider body", { status: settings.response ?? 200 });
    }) as typeof fetch };
  return { admin, tables, requests, deps, env, failures };
}

Deno.test("Meta Ads accepts paid Facebook and Instagram campaigns only", () => {
  assert.equal(utmifyIsMetaAds({ utm_source: "facebook", utm_medium: "paid", utm_campaign: "Velo modelos 03" }), true);
  assert.equal(utmifyIsMetaAds({ utm_source: "ig", utm_medium: "paid", utm_campaign: "120253368471660351" }), true);
  for (const attribution of [{}, { utm_source: "chatgpt.com" },
    { utm_source: "google", utm_medium: "cpc", utm_campaign: "Velo" },
    { utm_source: "facebook", utm_medium: "organic", utm_campaign: "Velo" },
    { utm_source: "ig", utm_medium: "paid" },
    { utm_source: "facebook", utm_campaign: "Velo" }]) assert.equal(utmifyIsMetaAds(attribution), false);
});
Deno.test("non Meta purchases are skipped without outbound request or financial changes", async () => {
  for (const source of [null, "chatgpt.com", "google", "tiktok"]) {
    const f = fixture({ test: false });
    f.tables.profiles[0].utm_source = source;
    const before = JSON.stringify({ subscriptions: f.tables.subscriptions, profiles: f.tables.profiles });
    assert.equal((await sendUtmifyOrder(f.admin, input, f.deps)).result, "skipped_non_meta_ads");
    assert.equal(f.requests.length, 0);
    assert.equal(JSON.stringify({ subscriptions: f.tables.subscriptions, profiles: f.tables.profiles }), before);
  }
});
Deno.test("refund and manual paths cannot bypass Meta Ads attribution", async () => {
  for (const triggerSource of ["refund", "backfill", "manual_test"] as const) {
    const f = fixture({ test: false });
    f.tables.profiles[0].utm_source = "chatgpt.com";
    f.tables.subscriptions[0].status = "refunded";
    assert.equal((await sendUtmifyOrder(f.admin, { ...input, status: "refunded", triggerSource, refundedAt: input.approvedAt }, f.deps)).result, "skipped_non_meta_ads");
    assert.equal(f.requests.length, 0);
  }
});
Deno.test("official body uses centavos, UTC, minimal customer and exact fee", () => {
  const body = buildUtmifyBody(sub, profile, { ...input, approvedAt: "2026-11-27T18:01:00-03:00" }, { feePercent: 3, isTest: true, now });
  assert.equal(body.orderId, sub.id);
  assert.equal(body.createdAt, "2026-11-27 21:00:00");
  assert.equal(body.approvedDate, "2026-11-27 21:01:00");
  assert.deepEqual(body.customer, { name: "Pessoa", email: "pessoa@example.invalid", phone: null, document: null });
  assert.deepEqual(body.commission, { totalPriceInCents: 3990, gatewayFeeInCents: 120, userCommissionInCents: 3870, currency: "BRL" });
  assert.equal(body.products[0].planId, "base_monthly");
  assert.equal(body.refundedAt, null);
  assert.equal(body.isTest, true);
});
Deno.test("lifetime uses single-purchase product and 8990 cents", () => {
  const body = buildUtmifyBody({ ...sub, amount: 89.90, purchase_kind: "lifetime" }, profile, input, { feePercent: 0, isTest: true, now });
  assert.equal(body.products[0].planId, "base_lifetime");
  assert.equal(body.products[0].priceInCents, 8990);
});
Deno.test("fixed fee 67 overrides percent for Base 3990 and commission 3923", async () => {
  const f = fixture();
  f.env.UTMIFY_GATEWAY_FEE_CENTS = "67";
  f.env.UTMIFY_GATEWAY_FEE_PERCENT = "3";
  assert.equal((await sendUtmifyOrder(f.admin, input, f.deps)).result, "sent");
  const body = JSON.parse(String(f.requests[0].body));
  assert.deepEqual(body.commission, { totalPriceInCents: 3990, gatewayFeeInCents: 67, userCommissionInCents: 3923, currency: "BRL" });
});
Deno.test("absent fixed fee falls back to default percent zero", async () => {
  const f = fixture();
  await sendUtmifyOrder(f.admin, input, f.deps);
  assert.deepEqual(JSON.parse(String(f.requests[0].body)).commission,
    { totalPriceInCents: 3990, gatewayFeeInCents: 0, userCommissionInCents: 3990, currency: "BRL" });
});
Deno.test("invalid fixed fee records failed invalid_fee without sending", async () => {
  for (const fee of ["-1", "67.5", "invalid", "", "Infinity", "9007199254740992"]) {
    const f = fixture(); f.env.UTMIFY_GATEWAY_FEE_CENTS = fee;
    assert.equal((await sendUtmifyOrder(f.admin, input, f.deps)).result, "failed");
    assert.equal(f.tables.utmify_order_events[0].error, "invalid_fee");
    assert.equal(f.requests.length, 0);
  }
});
Deno.test("fixed fee above total is capped and commission never becomes negative", () => {
  const body = buildUtmifyBody(sub, profile, input, { feePercent: 0, feeCents: "5000", isTest: true, now });
  assert.deepEqual(body.commission, { totalPriceInCents: 3990, gatewayFeeInCents: 3990, userCommissionInCents: 0, currency: "BRL" });
});
Deno.test("zero fixed fee is valid and overrides percent", () => {
  const body = buildUtmifyBody(sub, profile, input, { feePercent: 3, feeCents: "0", isTest: true, now });
  assert.equal(body.commission.gatewayFeeInCents, 0);
  assert.equal(body.commission.userCommissionInCents, 3990);
});
Deno.test("paid accepts exactly 7 days, rejects 7 days plus 1ms", () => {
  assert.equal(utmifyTooOld(new Date(now - 7 * day).toISOString(), "paid", now), false);
  assert.equal(utmifyTooOld(new Date(now - 7 * day - 1).toISOString(), "paid", now), true);
});
Deno.test("refunded accepts exactly 45 days, rejects 45 days plus 1ms", () => {
  assert.equal(utmifyTooOld(new Date(now - 45 * day).toISOString(), "refunded", now), false);
  assert.equal(utmifyTooOld(new Date(now - 45 * day - 1).toISOString(), "refunded", now), true);
});
Deno.test("disabled means no request but one skipped_disabled event", async () => {
  const f = fixture({ enabled: false });
  assert.equal((await sendUtmifyOrder(f.admin, input, f.deps)).result, "skipped_disabled");
  assert.equal(f.requests.length, 0);
  assert.equal(f.tables.utmify_order_events.length, 1);
});
Deno.test("test success does not suppress next real send", async () => {
  const f = fixture();
  await sendUtmifyOrder(f.admin, input, f.deps);
  f.env.UTMIFY_TEST_MODE = "false";
  await sendUtmifyOrder(f.admin, input, f.deps);
  assert.equal(f.requests.length, 2);
  assert.equal(f.tables.utmify_order_events[0].is_test, true);
  assert.equal(f.tables.utmify_order_events[1].is_test, false);
});
Deno.test("real success deduplicates same order/status even in test mode", async () => {
  const f = fixture({ test: false });
  await sendUtmifyOrder(f.admin, input, f.deps);
  f.env.UTMIFY_TEST_MODE = "true";
  assert.equal((await sendUtmifyOrder(f.admin, input, f.deps)).result, "skipped_duplicate");
  assert.equal(f.requests.length, 1);
});
Deno.test("timeout is failed and does not retry an uncertain real delivery", async () => {
  const f = fixture({ test: false, hang: true });
  assert.equal((await sendUtmifyOrder(f.admin, input, f.deps)).ok, false);
  assert.equal(f.tables.utmify_order_events[0].error, "delivery_uncertain");
  await sendUtmifyOrder(f.admin, input, f.deps);
  assert.equal(f.requests.length, 1);
});
Deno.test("response-body handling is also bounded by timeout", async () => {
  const f = fixture({ bodyHang: true });
  assert.equal((await sendUtmifyOrder(f.admin, input, f.deps)).ok, false);
  assert.equal(f.tables.utmify_order_events[0].error, "delivery_uncertain");
});
Deno.test("HTTP errors record only safe codes, not response bodies or customer", async () => {
  const f = fixture({ response: 400 });
  await sendUtmifyOrder(f.admin, input, f.deps);
  const row = f.tables.utmify_order_events[0];
  assert.equal(row.http_status, 400);
  assert.equal(row.error, "utmify_http_400");
  const saved = JSON.stringify(row);
  assert.equal(saved.includes(profile.email), false);
  assert.equal(saved.includes("simulation-only"), false);
  assert.equal(saved.includes("Pessoa"), false);
});
Deno.test("network failure cannot mutate subscriptions/profiles", async () => {
  const f = fixture({ networkFail: true });
  const before = JSON.stringify({ subscriptions: f.tables.subscriptions, profiles: f.tables.profiles });
  await sendUtmifyOrder(f.admin, input, f.deps);
  assert.equal(JSON.stringify({ subscriptions: f.tables.subscriptions, profiles: f.tables.profiles }), before);
});
Deno.test("log failure never escapes the notification", async () => {
  const f = fixture({ enabled: false });
  f.failures.add("utmify_order_events");
  assert.equal((await sendUtmifyOrder(f.admin, input, f.deps)).result, "skipped_disabled");
});
Deno.test("failed duplicate lookup fails closed without request", async () => {
  const f = fixture(); f.failures.add("utmify_order_events");
  assert.equal((await sendUtmifyOrder(f.admin, input, f.deps)).ok, false);
  assert.equal(f.requests.length, 0);
});
Deno.test("renewals disabled by default, invalid cycle never becomes new sale", async () => {
  const f = fixture();
  await sendUtmifyOrder(f.admin, { ...input, triggerSource: "webhook_renewal", cycleNumber: 2 }, f.deps);
  assert.equal(f.requests.length, 0);
  f.env.UTMIFY_SEND_RENEWALS = "true";
  await sendUtmifyOrder(f.admin, { ...input, triggerSource: "webhook_renewal" }, f.deps);
  assert.equal(f.requests.length, 0);
  await sendUtmifyOrder(f.admin, { ...input, triggerSource: "webhook_first_purchase", cycleNumber: 2 }, f.deps);
  assert.equal(f.requests.length, 0);
});
Deno.test("old paid/refund requests are skipped before fetch", async () => {
  const f = fixture(); f.tables.subscriptions[0].created_at = new Date(now - 8 * day).toISOString();
  assert.equal((await sendUtmifyOrder(f.admin, input, f.deps)).result, "skipped_too_old");
  f.tables.subscriptions[0].created_at = new Date(now - 46 * day).toISOString();
  assert.equal((await sendUtmifyOrder(f.admin, { ...input, status: "refunded" }, f.deps)).result, "skipped_too_old");
  assert.equal(f.requests.length, 0);
});
Deno.test("pending local state is never a paid/refunded confirmation", async () => {
  const f = fixture(); f.tables.subscriptions[0].status = "pending";
  assert.equal((await sendUtmifyOrder(f.admin, input, f.deps)).ok, false);
  assert.equal((await sendUtmifyOrder(f.admin, { ...input, status: "refunded", refundedAt: new Date(now).toISOString() }, f.deps)).ok, false);
  assert.equal(f.requests.length, 0);
});
Deno.test("backfill requires historical paid date, no now fallback", async () => {
  const f = fixture();
  assert.equal((await sendUtmifyOrder(f.admin, { ...input, triggerSource: "backfill", approvedAt: null }, f.deps)).ok, false);
  assert.equal(f.requests.length, 0);
});
Deno.test("privacy filter removes email CPF phone IP and personal names but keeps campaign IDs", () => {
  for (const raw of ["pessoa%40example.invalid", "123.456.789-01", "+55 11 99999-9999", "192.168.1.1", "contato=11999999999"]) assert.equal(safeUtm(raw), null);
  assert.equal(safeUtm("Campanha Pessoa", ["Pessoa"]), null);
  assert.equal(safeUtm("Campanha|1234567890123456"), "Campanha|1234567890123456");
});
Deno.test("webhook selection sends only new purchases when renewals are off", () => {
  const selection = { subscriptionId: sub.id, wasActiveBefore: false, cancelAtPeriodEnd: false, event: "payment.success", approvedAt: input.approvedAt, sendRenewals: false };
  assert.equal(utmifyWebhookInput(selection)?.triggerSource, "webhook_first_purchase");
  assert.equal(utmifyWebhookInput({ ...selection, wasActiveBefore: true }), null);
  assert.equal(utmifyWebhookInput({ ...selection, event: "subscription.renewed" }), null);
  assert.equal(utmifyWebhookInput({ ...selection, cycleNumber: 2 }), null);
  assert.equal(utmifyWebhookInput({ ...selection, cancelAtPeriodEnd: true }), null);
});
Deno.test("history rejects renewal or missing payment date instead of inventing first payment", async () => {
  const f = fixture();
  f.tables.validapay_webhook_events.push({ subscription_id: sub.validapay_subscription_id, processed: true, status: "PAID", error: null, event: "payment.success", charge_id: "test-charge", payload: { currentCycle: { cycleNumber: 2, paidAt: input.approvedAt } } });
  assert.equal(await utmifyHistoricalEvidence(f.admin, sub), null);
  f.tables.validapay_webhook_events[0].payload = { currentCycle: { cycleNumber: 1, paidAt: input.approvedAt } };
  assert.deepEqual(await utmifyHistoricalEvidence(f.admin, sub), { chargeId: "test-charge", approvedAt: input.approvedAt });
  f.tables.validapay_webhook_events[0].payload = {};
  assert.equal(await utmifyHistoricalEvidence(f.admin, sub), null);
});
Deno.test("background failure is isolated and no runtime means no work", async () => {
  const global = globalThis as typeof globalThis & { EdgeRuntime?: { waitUntil(task: Promise<unknown>): void } };
  const previous = global.EdgeRuntime;
  let called = false;
  let pending: Promise<unknown> | undefined;
  try {
    delete global.EdgeRuntime;
    scheduleUtmifyTask(async () => { called = true; });
    assert.equal(called, false);
    global.EdgeRuntime = { waitUntil: task => { pending = task; } };
    scheduleUtmifyTask(async () => { called = true; throw new Error("discarded"); });
    await pending;
    assert.equal(called, true);
  } finally { if (previous) global.EdgeRuntime = previous; else delete global.EdgeRuntime; }
});