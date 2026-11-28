// Aviso de medição, nunca uma operação financeira. Nenhum corpo/PII é logado.
export type UtmifyAdmin = {
  // deno-lint-ignore no-explicit-any -- SDK structural query interface, shared by server clients and test doubles.
  from(table: string): any;
};
export type UtmifyInput = {
  subscriptionId: string;
  status: "paid" | "refunded";
  triggerSource: "webhook_first_purchase" | "webhook_renewal" | "refund" | "backfill" | "manual_test";
  approvedAt?: string | null;
  refundedAt?: string | null;
  cycleNumber?: number;
};
type Subscription = {
  id: string; user_id: string; plan: string; amount: number | string;
  payment_method: string | null; purchase_kind: string | null; created_at: string;
  status: string; provider: string; validapay_subscription_id?: string | null;
  validapay_charge_id?: string | null;
};
type Profile = {
  display_name?: string | null; email?: string | null;
  utm_source?: string | null; utm_medium?: string | null; utm_campaign?: string | null;
  utm_content?: string | null; utm_term?: string | null;
};
type Dependencies = {
  env: (name: string) => string | undefined;
  fetch: typeof fetch;
  now: () => number;
  timeoutMs?: number;
};
const ENDPOINT = "https://api.utmify.com.br/api-credentials/orders";
const DAY = 86_400_000;
const SUB_FIELDS = "id,user_id,plan,amount,payment_method,purchase_kind,created_at,status,provider,validapay_subscription_id,validapay_charge_id";
const PROFILE_FIELDS = "display_name,email,utm_source,utm_medium,utm_campaign,utm_content,utm_term";
export const utcUtmifyDate = (value: string) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("invalid_date");
  return date.toISOString().slice(0, 19).replace("T", " ");
};
export function utmifyTooOld(createdAt: string, status: UtmifyInput["status"], now: number) {
  const timestamp = Date.parse(createdAt);
  if (!Number.isFinite(timestamp) || timestamp > now) throw new Error("invalid_created_date");
  return now - timestamp > (status === "refunded" ? 45 : 7) * DAY;
}
export function safeUtm(value: unknown, personal: Array<string | null | undefined> = []): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  let text = value.trim();
  try { text = decodeURIComponent(text); } catch { /* Some campaign names are not URI encoded. */ }
  // Campaign IDs are allowed; emails, CPF/CNPJ, formatted phones and IPs are not.
  if (/@|\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b|\b\d{1,3}(?:\.\d{1,3}){3}\b|\+\d[\d\s()-]{8,}|\(\d{2}\)\s*\d{4,5}-?\d{4}|(?<!\d)\d{11}(?!\d)|(?<!\d)\d{14}(?!\d)/.test(text)) return null;
  if (personal.some(v => v && v.trim().length >= 3 && text.toLowerCase().includes(v.trim().toLowerCase()))) return null;
  return text.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 500) || null;
}
/** Fail closed: a social click alone does not establish a paid Meta campaign. */
export function utmifyIsMetaAds(profile: Profile): boolean {
  const source = safeUtm(profile.utm_source)?.toLowerCase();
  const medium = safeUtm(profile.utm_medium)?.toLowerCase();
  return ["fb", "facebook", "ig", "instagram", "meta", "metaads", "meta_ads"].includes(source ?? "")
    && ["paid", "paid_social", "paidsocial", "cpc", "ppc"].includes(medium ?? "")
    && safeUtm(profile.utm_campaign) !== null;
}
export function buildUtmifyBody(sub: Subscription, profile: Profile, input: UtmifyInput,
  config: { feePercent: number; feeCents?: string; isTest: boolean; now: number }) {
  const total = Math.round(Number(sub.amount) * 100);
  if (!Number.isSafeInteger(total) || total <= 0) throw new Error("invalid_amount");
  let fee: number;
  if (config.feeCents !== undefined) {
    if (!/^\d+$/.test(config.feeCents) || !Number.isSafeInteger(Number(config.feeCents))) throw new Error("invalid_fee");
    fee = Math.min(Number(config.feeCents), total);
  } else {
    if (!Number.isFinite(config.feePercent) || config.feePercent < 0 || config.feePercent > 100) throw new Error("invalid_fee");
    fee = Math.round(total * config.feePercent / 100);
  }
  if (!["pix", "credit_card"].includes(sub.payment_method ?? "")) throw new Error("invalid_payment_method");
  const email = profile.email?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("missing_customer_email");
  const name = profile.display_name?.trim().split(/\s+/)[0] || "Cliente Velo";
  const personal = [email, profile.display_name, name === "Cliente Velo" ? null : name];
  const trackingParameters = {
    src: null, sck: null,
    utm_source: safeUtm(profile.utm_source, personal),
    utm_campaign: safeUtm(profile.utm_campaign, personal),
    utm_medium: safeUtm(profile.utm_medium, personal),
    utm_content: safeUtm(profile.utm_content, personal),
    utm_term: safeUtm(profile.utm_term, personal),
  };
  const lifetime = sub.purchase_kind === "lifetime";
  const plan = sub.plan;
  const planName = plan.charAt(0).toUpperCase() + plan.slice(1);
  return {
    orderId: input.cycleNumber && input.cycleNumber > 1 ? `${sub.id}-c${input.cycleNumber}` : sub.id,
    platform: "Velo", paymentMethod: sub.payment_method, status: input.status,
    createdAt: utcUtmifyDate(sub.created_at),
    approvedDate: utcUtmifyDate(input.approvedAt ?? new Date(config.now).toISOString()),
    refundedAt: input.status === "refunded" ? utcUtmifyDate(input.refundedAt ?? new Date(config.now).toISOString()) : null,
    customer: { name, email, phone: null, document: null },
    products: [{ id: `velo_${plan}`, name: `Velo ${planName}`, planId: `${plan}_${lifetime ? "lifetime" : "monthly"}`,
      planName: `Velo ${planName} ${lifetime ? "Vitalício" : "Mensal"}`, quantity: 1, priceInCents: total }],
    trackingParameters,
    commission: { totalPriceInCents: total, gatewayFeeInCents: fee, userCommissionInCents: total - fee, currency: "BRL" },
    isTest: config.isTest,
  };
}

/** Errors are internal fixed codes only; never persist provider messages or buyer data. */
export async function sendUtmifyOrder(admin: UtmifyAdmin, input: UtmifyInput, injected?: Dependencies) {
  const deps = injected ?? { env: (name: string) => Deno.env.get(name), fetch, now: Date.now };
  const now = deps.now();
  const isTest = deps.env("UTMIFY_TEST_MODE") === "true";
  const orderId = input.cycleNumber && input.cycleNumber > 1 ? `${input.subscriptionId}-c${input.cycleNumber}` : input.subscriptionId;
  const row: Record<string, unknown> = { subscription_id: input.subscriptionId, order_id: orderId,
    utmify_status: input.status, trigger_source: input.triggerSource, is_test: isTest, ok: false };
  const record = async (result: string, error: string | null = null, status: number | null = null, ok = false) => {
    try {
      const { error: saveError } = await admin.from("utmify_order_events").insert({ ...row, result, error,
        http_status: status, ok, sent_at: ok ? new Date(now).toISOString() : null });
      if (saveError) console.error("utmify_event_write_failed");
    } catch { console.error("utmify_event_write_failed"); }
    return { result, ok, httpStatus: status };
  };
  try {
    const { data: sub, error: subError } = await admin.from("subscriptions").select(SUB_FIELDS).eq("id", input.subscriptionId).maybeSingle();
    if (subError || !sub) return await record("failed", "subscription_read_failed");
    if (sub.provider !== "validapay") return await record("failed", "unsupported_provider");
    const total = Math.round(Number(sub.amount) * 100);
    row.payment_method = ["pix", "credit_card"].includes(sub.payment_method) ? sub.payment_method : null;
    row.total_cents = Number.isSafeInteger(total) ? total : null;
    if (deps.env("UTMIFY_ENABLED") !== "true") return await record("skipped_disabled");
    if (input.triggerSource === "webhook_renewal" && deps.env("UTMIFY_SEND_RENEWALS") !== "true") return await record("skipped_disabled", "renewals_disabled");
    if (input.cycleNumber !== undefined && (!Number.isInteger(input.cycleNumber) || input.cycleNumber < 1)) return await record("failed", "invalid_cycle");
    if (input.triggerSource === "webhook_renewal" && (!input.cycleNumber || input.cycleNumber <= 1)) return await record("failed", "missing_renewal_cycle");
    if (input.triggerSource === "webhook_first_purchase" && (input.cycleNumber ?? 1) > 1) return await record("failed", "not_first_purchase");
    const { data: previous, error: priorError } = await admin.from("utmify_order_events").select("ok,error,result")
      .eq("order_id", orderId).eq("utmify_status", input.status).eq("is_test", false);
    if (priorError) return await record("failed", "duplicate_read_failed");
    if (previous?.some((event: { ok: boolean }) => event.ok)) return await record("skipped_duplicate");
    if (!isTest && previous?.some((event: { error: string | null }) => ["delivery_uncertain", "prior_delivery_uncertain"].includes(event.error ?? ""))) {
      return await record("failed", "prior_delivery_uncertain");
    }
    if (utmifyTooOld(sub.created_at, input.status, now)) return await record("skipped_too_old");
    if (input.status === "paid" && !["active", "paid", "approved", "cancel_scheduled"].includes(sub.status)) return await record("failed", "payment_not_confirmed");
    if (input.status === "refunded" && sub.status !== "refunded") return await record("failed", "refund_not_confirmed");
    // Historical/refund dates must be verified, never fabricated from the current clock.
    if (["backfill", "refund"].includes(input.triggerSource) && !input.approvedAt) return await record("failed", "missing_paid_date");
    if (input.status === "refunded" && !input.refundedAt) return await record("failed", "missing_refund_date");
    const token = deps.env("UTMIFY_API_TOKEN");
    if (!token) return await record("failed", "missing_api_token");
    const { data: profile, error: profileError } = await admin.from("profiles").select(PROFILE_FIELDS).eq("user_id", sub.user_id).maybeSingle();
    if (profileError || !profile) return await record("failed", "profile_read_failed");
    if (!utmifyIsMetaAds(profile)) return await record("skipped_non_meta_ads");
    let body: ReturnType<typeof buildUtmifyBody>;
    try {
      body = buildUtmifyBody(sub, profile, input, { feePercent: Number(deps.env("UTMIFY_GATEWAY_FEE_PERCENT") ?? 0),
        feeCents: deps.env("UTMIFY_GATEWAY_FEE_CENTS"), isTest, now });
    } catch (error) {
      const allowed = ["invalid_amount", "invalid_fee", "invalid_payment_method", "missing_customer_email", "invalid_date"];
      return await record("failed", error instanceof Error && allowed.includes(error.message) ? error.message : "invalid_order");
    }
    Object.assign(row, body.trackingParameters);
    delete row.src;
    delete row.sck;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const response = await Promise.race([
        (async () => {
          const res = await deps.fetch(ENDPOINT, { method: "POST", headers: { "x-api-token": token, "Content-Type": "application/json" },
            body: JSON.stringify(body), signal: controller.signal });
          // Discard body: error responses can echo credentials or buyer data.
          if (res.body) await res.body.cancel();
          return res;
        })(),
        new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("timeout")); }, deps.timeoutMs ?? 5000); }),
      ]);
      return await record(response.ok ? "sent" : "failed", response.ok ? null : response.status >= 500 ? "delivery_uncertain" : `utmify_http_${response.status}`,
        response.status, response.ok);
    } catch {
      return await record("failed", "delivery_uncertain");
    } finally { if (timer !== undefined) clearTimeout(timer); }
  } catch { return await record("failed", "internal_error"); }
}

type BackgroundRuntime = { waitUntil(task: Promise<unknown>): void };
export function scheduleUtmifyTask(work: () => Promise<unknown>) {
  try {
    const runtime = (globalThis as typeof globalThis & { EdgeRuntime?: BackgroundRuntime }).EdgeRuntime;
    if (!runtime?.waitUntil) { console.error("utmify_background_unavailable"); return; }
    runtime.waitUntil(Promise.resolve().then(work).catch(() => console.error("utmify_background_failed")));
  } catch { console.error("utmify_background_failed"); }
}

export function utmifyWebhookInput(i: { subscriptionId: string; wasActiveBefore: boolean; cancelAtPeriodEnd: boolean;
  event: string; approvedAt: string | null; cycleNumber?: number; sendRenewals: boolean }): UtmifyInput | null {
  const renewal = i.event === "subscription.renewed" || (i.cycleNumber ?? 1) > 1;
  if (i.cancelAtPeriodEnd) return null;
  if (renewal) return i.sendRenewals && i.wasActiveBefore && i.cycleNumber && i.cycleNumber > 1
    ? { subscriptionId: i.subscriptionId, status: "paid", triggerSource: "webhook_renewal", approvedAt: i.approvedAt, cycleNumber: i.cycleNumber } : null;
  return i.wasActiveBefore ? null : { subscriptionId: i.subscriptionId, status: "paid", triggerSource: "webhook_first_purchase", approvedAt: i.approvedAt };
}

/** First confirmed webhook evidence; no current time or renewal is substituted. */
export async function utmifyHistoricalEvidence(admin: UtmifyAdmin, sub: Subscription) {
  if (!sub.validapay_subscription_id) return null; // ONE_TIME without webhook needs separately verified evidence.
  const { data, error } = await admin.from("validapay_webhook_events").select("charge_id,payload,created_at")
    .eq("subscription_id", sub.validapay_subscription_id).eq("processed", true).eq("status", "PAID").is("error", null)
    .in("event", ["payment.success", "subscription.activated", "subscription.renewed", "oneoff.payment.success"])
    .order("created_at", { ascending: true }).limit(1);
  if (error) throw new Error("historical_payment_read_failed");
  const first = data?.[0];
  if (!first?.charge_id) return null;
  const payload = first.payload ?? {};
  const cycle = payload.currentCycle?.cycleNumber ?? payload.currentCycleNumber;
  if (cycle !== undefined && cycle !== 1) return null;
  const paidAt = payload.currentCycle?.paidAt ?? payload.paidAt;
  if (typeof paidAt !== "string" || !Number.isFinite(Date.parse(paidAt))) return null;
  const age = Date.parse(paidAt) - Date.parse(sub.created_at);
  if (age < 0 || age > 7 * DAY) return null;
  return { chargeId: first.charge_id as string, approvedAt: paidAt };
}

/** Only confirmed refunds of the original purchase, never a keep-access renewal refund. */
export async function sendUtmifyConfirmedRefund(admin: UtmifyAdmin, sub: Subscription,
  refund: { charge_id?: string | null; keep_access?: boolean | null }, refundedAt: string) {
  if (refund.keep_access === true || sub.provider !== "validapay" || !refund.charge_id) return;
  const evidence = await utmifyHistoricalEvidence(admin, sub);
  if (!evidence || evidence.chargeId !== refund.charge_id) return;
  return sendUtmifyOrder(admin, { subscriptionId: sub.id, status: "refunded", triggerSource: "refund",
    approvedAt: evidence.approvedAt, refundedAt });
}