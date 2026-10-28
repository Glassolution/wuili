// Pagamentos únicos (vitalício) da ValidaPay não ficam ligados à sessão de checkout
// e não chegam pelo webhook. Por isso localizamos a cobrança paga pela lista de
// cobranças: tipo ONE_TIME, valor exato, email da conta e horário após o checkout.
import { validaPayFetch } from "./validapay.ts";
import { lifetimePaymentMatches, lifetimePeriod } from "./lifetimePlans.ts";

type Charge = {
  chargeId: string; createdAt: string; status: string; saleType?: string; type?: string;
  amount: number; paymentType?: string; customer?: { email?: string };
};

const norm = (e?: string | null) => (e ?? "").trim().toLowerCase();

export async function listRecentCharges(pages = 3): Promise<Charge[]> {
  const out: Charge[] = [];
  let lastKey: string | null = null;
  for (let i = 0; i < pages; i++) {
    const qs = `limit=100${lastKey ? `&lastKey=${encodeURIComponent(lastKey)}` : ""}`;
    // deno-lint-ignore no-explicit-any -- resposta da ValidaPay sem tipo oficial
    const data: any = await validaPayFetch(`/v1/charges?${qs}`, { method: "GET", scope: "checkouts/read pix.cob/read accounts/read" });
    out.push(...(data?.items ?? []));
    lastKey = data?.pagination?.hasMore ? data.pagination.lastKey : null;
    if (!lastKey) break;
  }
  return out;
}

/** Retorna a cobrança vitalícia paga desta compra, ou null. */
export function matchLifetimeCharge(
  sub: { amount: number | string; created_at: string },
  email: string | null,
  charges: Charge[],
  usedChargeIds: Set<string>,
): Charge | null {
  const start = new Date(sub.created_at).getTime() - 60_000;
  const end = start + 3 * 24 * 3600_000;
  const hits = charges.filter((c) =>
    c.status === "PAID" &&
    (c.saleType === "ONE_TIME" || String(c.type ?? "").startsWith("ONE_TIME")) &&
    lifetimePaymentMatches(Number(sub.amount), Number(c.amount)) &&
    norm(c.customer?.email) === norm(email) && norm(email) !== "" &&
    new Date(c.createdAt).getTime() >= start && new Date(c.createdAt).getTime() <= end &&
    !usedChargeIds.has(c.chargeId)
  ).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return hits[0] ?? null;
}

// deno-lint-ignore no-explicit-any -- cliente supabase admin
export async function recoverLifetimePurchases(admin: any, userId?: string) {
  let q = admin.from("subscriptions")
    .select("id,user_id,plan,amount,created_at,status")
    .eq("purchase_kind", "lifetime").in("status", ["pending", "expired"])
    .gte("created_at", new Date(Date.now() - 7 * 24 * 3600_000).toISOString())
    .order("created_at", { ascending: false });
  if (userId) q = q.eq("user_id", userId);
  const { data: subs } = await q;
  if (!subs?.length) return [];
  const charges = await listRecentCharges(userId ? 2 : 5);
  const { data: used } = await admin.from("subscriptions").select("validapay_charge_id").not("validapay_charge_id", "is", null)
    .in("validapay_charge_id", charges.map((c) => c.chargeId).slice(0, 500));
  const usedIds = new Set<string>((used ?? []).map((r: { validapay_charge_id: string }) => r.validapay_charge_id));
  const activated: { id: string; user_id: string; plan: string; chargeId: string }[] = [];
  const doneUsers = new Set<string>();
  for (const s of subs) {
    const key = `${s.user_id}:${s.plan}`;
    if (doneUsers.has(key)) continue;
    const { data: prof } = await admin.from("profiles").select("email").eq("user_id", s.user_id).maybeSingle();
    const { data: authUser } = await admin.auth.admin.getUserById(s.user_id);
    const emails = [prof?.email, authUser?.user?.email].filter(Boolean) as string[];
    let hit: Charge | null = null;
    for (const e of emails) { hit = matchLifetimeCharge(s, e, charges, usedIds); if (hit) break; }
    if (!hit) continue;
    const now = new Date().toISOString();
    const { error } = await admin.from("subscriptions").update({
      status: "active", provider: "validapay", validapay_charge_id: hit.chargeId,
      payment_method: hit.paymentType === "PIX" ? "pix" : "creditcard",
      current_period_start: now, ...lifetimePeriod, origin_paid_at: now, updated_at: now,
    }).eq("id", s.id).in("status", ["pending", "expired"]);
    if (error) { console.error("lifetime recover: update falhou", s.id, error.message); continue; }
    await admin.from("profiles").update({ plano: s.plan }).eq("user_id", s.user_id);
    usedIds.add(hit.chargeId);
    doneUsers.add(key);
    activated.push({ id: s.id, user_id: s.user_id, plan: s.plan, chargeId: hit.chargeId });
  }
  return activated;
}
