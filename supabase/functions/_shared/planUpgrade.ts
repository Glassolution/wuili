import { validaPayFetch, getCharge, isPaidStatus } from "./validapay.ts";
import { upgradeDifference, sameBillingDate, upgradePaymentMatches, UPGRADE_MONTHLY_PRICES } from "./planUpgradePolicy.ts";
import { hasTerminatingRefund, type LifecycleAdmin } from "./subscriptionLifecycle.ts";

type Item = { itemId: string; priceId: string; type: string; status: string; amount: number; quantity: number };
type Contract = { subscriptionId: string; status: string; interval: string; cancelAtPeriodEnd: boolean;
  nextCycleChargeDate: string; nextCycleAmount: number; paymentType: string; items: Item[] };
type Upgrade = { id: string; user_id: string; subscription_id: string; provider_subscription_id: string;
  from_plan: string; to_plan: string; amount: number; recurring_amount: number; period_start: string | null;
  period_end: string; next_charge_date: string; provider_item_id: string; target_price_id: string;
  difference_price_id: string | null; charge_id: string | null; state: string; expires_at: string;
  provider_response: Record<string, unknown> | null };
type Mutation = { success?: boolean; settlement?: string; item?: Item;
  amounts?: { chargeTotal?: number }; charge?: { chargeId?: string }; chargeId?: string;
  payment?: { pix?: { emv?: string; qrCode?: string }; boleto?: { url?: string } } };
const contractPath = (id: string) => `/v1/subscriptions/${encodeURIComponent(id)}`;
async function contract(id: string): Promise<Contract> {
  const raw = await validaPayFetch<Contract | { data: Contract }>(contractPath(id), { scope: "subscriptions/read" });
  return "data" in raw ? raw.data : raw;
}
async function save(admin: LifecycleAdmin, id: string, patch: Record<string, unknown>) {
  const { error } = await admin.from("plan_upgrade_requests").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).neq("state", "completed");
  if (error) throw new Error(error.message);
}
function result(r: Upgrade) {
  return { upgrade: true, id: r.id, fromPlan: r.from_plan, toPlan: r.to_plan, amount: Number(r.amount),
    recurringAmount: Number(r.recurring_amount), nextChargeDate: r.next_charge_date, state: r.state,
    payment: r.provider_response?.payment ?? null };
}
export async function quoteUpgrade(admin: LifecycleAdmin, userId: string, plan: string, cycle: string) {
  const { data, error } = await admin.from("subscriptions").select("*").eq("user_id", userId)
    .eq("status", "active").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const paid = (data ?? []).filter((s: { is_trial?: boolean; current_period_end?: string; purchase_kind?: string }) =>
    !s.is_trial && (s.purchase_kind === "lifetime" || Date.parse(s.current_period_end ?? "") > Date.now()));
  if (!paid.length) return { upgrade: false };
  const sub = paid.sort((a: { plan: string }, b: { plan: string }) =>
    (UPGRADE_MONTHLY_PRICES[b.plan] ?? 0) - (UPGRADE_MONTHLY_PRICES[a.plan] ?? 0))[0];
  if ((UPGRADE_MONTHLY_PRICES[plan] ?? 0) <= (UPGRADE_MONTHLY_PRICES[sub.plan] ?? 0)) return { upgrade: false };
  if (cycle !== "monthly" || sub.purchase_kind === "lifetime") throw new Error("A troca entre mensal e vitalício não está disponível neste upgrade.");
  if (paid.length !== 1 || sub.provider !== "validapay" || !sub.validapay_subscription_id?.startsWith("sub_") ||
    sub.cancel_at_period_end || sub.cancelled_at || await hasTerminatingRefund(admin, sub.id)) {
    throw new Error("Não foi possível confirmar um único contrato ativo para o upgrade. Fale com o suporte; nenhuma cobrança foi feita.");
  }
  await admin.from("plan_upgrade_requests").update({ state: "expired" }).eq("subscription_id", sub.id)
    .eq("state", "quoted").lt("expires_at", new Date().toISOString());
  const { data: open, error: openError } = await admin.from("plan_upgrade_requests").select("*")
    .eq("subscription_id", sub.id).not("state", "in", "(completed,expired)").maybeSingle();
  if (openError) throw new Error(openError.message);
  if (open) {
    if (open.to_plan !== plan) throw new Error("Já existe um upgrade em andamento. Conclua ou aguarde a revisão antes de trocar novamente.");
    return result(open);
  }
  const provider = await contract(sub.validapay_subscription_id);
  const items = provider.items.filter(i => i.type === "RECURRING" && i.status === "ACTIVE");
  const item = items[0];
  const target = Deno.env.get(`VALIDAPAY_PRICE_${plan.toUpperCase()}`);
  if (!target || provider.status !== "ACTIVE" || provider.interval !== "MONTHLY" || provider.cancelAtPeriodEnd ||
    items.length !== 1 || !item || item.quantity !== 1 || Number(item.amount) !== UPGRADE_MONTHLY_PRICES[sub.plan] ||
    !provider.nextCycleChargeDate || Date.parse(provider.nextCycleChargeDate) <= Date.now()) {
    throw new Error("Contrato indisponível para upgrade seguro; nenhuma cobrança foi feita.");
  }
  const amount = upgradeDifference(sub.plan, plan);
  const row = { user_id: userId, subscription_id: sub.id, provider_subscription_id: provider.subscriptionId,
    from_plan: sub.plan, to_plan: plan, amount, recurring_amount: UPGRADE_MONTHLY_PRICES[plan],
    period_start: sub.current_period_start, period_end: sub.current_period_end,
    next_charge_date: provider.nextCycleChargeDate, provider_item_id: item.itemId, target_price_id: target };
  const { data: created, error: createError } = await admin.from("plan_upgrade_requests").insert(row).select("*").single();
  if (createError) throw new Error("Já existe uma solicitação em andamento. Tente consultar novamente.");
  return result(created);
}

export async function finishUpgrade(admin: LifecycleAdmin, r: Upgrade): Promise<void> {
  const { data: fresh, error: freshError } = await admin.from("plan_upgrade_requests").select("*").eq("id", r.id).single();
  if (freshError) throw new Error(freshError.message);
  r = fresh;
  if (r.state === "completed") return;
  if (!["awaiting_payment", "paid", "replacing"].includes(r.state)) return;
  if (!r.charge_id) throw new Error("Cobrança ainda não identificada; não repita o pagamento.");
  const payment = await getCharge(r.charge_id);
  if (!isPaidStatus(payment.status)) return;
  if (!upgradePaymentMatches(Number(r.amount), Number(payment.amount))) {
    await save(admin, r.id, { state: "review", error: "upgrade_amount_mismatch" });
    throw new Error("Valor divergente: upgrade encaminhado para revisão.");
  }
  const { data: sub, error } = await admin.from("subscriptions").select("*").eq("id", r.subscription_id).single();
  if (error || sub.status !== "active" || sub.cancelled_at || sub.cancel_at_period_end ||
    sub.plan !== r.from_plan || sub.current_period_start !== r.period_start || sub.current_period_end !== r.period_end ||
    await hasTerminatingRefund(admin, r.subscription_id)) {
    await save(admin, r.id, { state: "review", error: "subscription_changed" });
    throw new Error("A assinatura mudou durante o upgrade; revisão necessária.");
  }
  let current = await contract(r.provider_subscription_id);
  if (!sameBillingDate(current.nextCycleChargeDate, r.next_charge_date) || current.cancelAtPeriodEnd || current.status !== "ACTIVE") {
    await save(admin, r.id, { state: "review", error: "billing_cycle_changed" });
    throw new Error("A renovação mudou durante o upgrade; revisão necessária.");
  }
  const alreadyReplaced = current.items.some(i => i.priceId === r.target_price_id && i.status === "ACTIVE");
  if (!alreadyReplaced) {
    const { data: reserved, error: reserveError } = await admin.from("plan_upgrade_requests")
      .update({ state: "replacing", updated_at: new Date().toISOString() }).eq("id", r.id)
      .in("state", ["awaiting_payment", "paid"]).select("id").maybeSingle();
    if (reserveError) throw new Error(reserveError.message);
    if (!reserved) return; // Never resend an uncertain replacement.
    await validaPayFetch(`${contractPath(r.provider_subscription_id)}/items/${encodeURIComponent(r.provider_item_id)}`, {
      method: "PUT", scope: "subscriptions/write", retryUnauthorized: false,
      body: JSON.stringify({ priceId: r.target_price_id, quantity: 1, prorata: { enabled: false }, dryRun: false }),
    });
    current = await contract(r.provider_subscription_id);
  }
  const recurring = current.items.filter(i => i.type === "RECURRING" && i.status === "ACTIVE");
  if (recurring.length !== 1 || recurring[0]?.priceId !== r.target_price_id ||
    !sameBillingDate(current.nextCycleChargeDate, r.next_charge_date) || Number(current.nextCycleAmount) !== Number(r.recurring_amount)) {
    await save(admin, r.id, { state: "review", error: "replacement_not_confirmed" });
    throw new Error("A substituição do plano precisa de revisão; não pague novamente.");
  }
  const { error: stateError } = await admin.from("plan_upgrade_requests").update({ state: "replacing" })
    .eq("id", r.id).in("state", ["awaiting_payment", "paid", "replacing"]);
  if (stateError) throw new Error(stateError.message);
  const { error: completeError } = await admin.rpc("complete_plan_upgrade", { p_id: r.id });
  if (completeError) throw new Error(completeError.message);
}

export async function confirmUpgrade(admin: LifecycleAdmin, userId: string, id: string, amount: number) {
  const { data: r, error } = await admin.from("plan_upgrade_requests").select("*").eq("id", id).eq("user_id", userId).single();
  if (error || !r) throw new Error("Upgrade não encontrado.");
  if (Number(r.amount) !== amount) throw new Error("O valor mudou. Confira novamente antes de confirmar.");
  if (r.state === "quoted") {
    if (Date.parse(r.expires_at) < Date.now()) throw new Error("A cotação expirou. Selecione o plano novamente.");
    const current = await contract(r.provider_subscription_id);
    const { data: sub, error: subError } = await admin.from("subscriptions").select("*").eq("id", r.subscription_id).single();
    if (subError || !sub || sub.status !== "active" || sub.cancelled_at || sub.cancel_at_period_end ||
      sub.plan !== r.from_plan || sub.current_period_start !== r.period_start || sub.current_period_end !== r.period_end ||
      await hasTerminatingRefund(admin, r.subscription_id)) throw new Error("A assinatura mudou. Nenhuma cobrança foi feita.");
    const activeItems = current.items.filter(i => i.type === "RECURRING" && i.status === "ACTIVE");
    if (activeItems.length !== 1 || activeItems[0]?.itemId !== r.provider_item_id) throw new Error("O contrato mudou. Confira novamente.");
    if (!sameBillingDate(current.nextCycleChargeDate, r.next_charge_date) || current.status !== "ACTIVE" || current.cancelAtPeriodEnd) {
      throw new Error("A assinatura mudou. Nenhuma cobrança foi feita.");
    }
    // Validate no-prorata replacement without changing the contract or charging.
    const preview = await validaPayFetch<Mutation>(`${contractPath(r.provider_subscription_id)}/items/${encodeURIComponent(r.provider_item_id)}`, {
      method: "PUT", scope: "subscriptions/write", body: JSON.stringify({ priceId: r.target_price_id, quantity: 1,
        prorata: { enabled: false }, dryRun: true }),
    });
    if (Number(preview.amounts?.chargeTotal) !== 0) throw new Error("A ValidaPay não confirmou troca sem cobrança extra.");
    const { data: reserved, error: reserveError } = await admin.from("plan_upgrade_requests")
      .update({ state: "charging", updated_at: new Date().toISOString() }).eq("id", r.id).eq("state", "quoted")
      .select("id").maybeSingle();
    if (reserveError) throw new Error(reserveError.message);
    if (reserved) {
      try {
        const productRaw = await validaPayFetch<{ prices?: { id?: string; priceId?: string }[]; data?: { prices?: { id?: string; priceId?: string }[] } }>("/v1/products", {
          method: "POST", scope: "products/write", retryUnauthorized: false,
          body: JSON.stringify({ name: `Upgrade Velo ${r.from_plan} → ${r.to_plan}`, type: "ONE_TIME", isActive: true,
            metadata: { velo_upgrade_id: r.id }, prices: [{ title: "Diferença de upgrade", amount: Number(r.amount), currency: "BRL", recurrenceType: "ONE_TIME" }] }),
        });
        const price = (productRaw.data ?? productRaw).prices?.[0];
        const priceId = price?.priceId ?? price?.id;
        if (!priceId) throw new Error("Preço avulso não confirmado.");
        await save(admin, r.id, { difference_price_id: priceId });
        const added = await validaPayFetch<Mutation>(`${contractPath(r.provider_subscription_id)}/items`, {
          method: "POST", scope: "subscriptions/write", retryUnauthorized: false,
          body: JSON.stringify({ priceId, type: "ONE_TIME", quantity: 1, dryRun: false }),
        });
        const chargeId = added.charge?.chargeId ?? added.chargeId;
        if (!chargeId || Number(added.amounts?.chargeTotal) !== Number(r.amount)) {
          await save(admin, r.id, { state: "review", provider_response: added, charge_id: chargeId ?? null, error: "charge_not_confirmed" });
          throw new Error("A cobrança precisa de revisão. Não confirme novamente.");
        }
        await save(admin, r.id, { state: "awaiting_payment", charge_id: chargeId, provider_response: added });
      } catch (error) {
        await save(admin, r.id, { error: String(error) }); // Keep reservation; never blindly retry money operations.
        throw error;
      }
    }
  }
  const { data: latest } = await admin.from("plan_upgrade_requests").select("*").eq("id", id).single();
  if (latest && ["awaiting_payment", "paid", "replacing"].includes(latest.state)) await finishUpgrade(admin, latest);
  const { data: final } = await admin.from("plan_upgrade_requests").select("*").eq("id", id).single();
  return result(final ?? latest ?? r);
}

export async function readUpgrade(admin: LifecycleAdmin, userId: string, id: string) {
  const { data, error } = await admin.from("plan_upgrade_requests").select("*").eq("id", id).eq("user_id", userId).single();
  if (error || !data) throw new Error("Upgrade não encontrado.");
  if (["awaiting_payment", "paid", "replacing"].includes(data.state)) await finishUpgrade(admin, data);
  const { data: final } = await admin.from("plan_upgrade_requests").select("*").eq("id", id).eq("user_id", userId).single();
  return result(final ?? data);
}

/** Intercept only upgrade charges; never run the recurring activation path for them. */
export async function handleUpgradePayment(admin: LifecycleAdmin, chargeId: string | null, providerId?: string | null) {
  const { data: rows, error } = await admin.from("plan_upgrade_requests").select("*")
    .eq(chargeId ? "charge_id" : "provider_subscription_id", chargeId ?? providerId ?? "").limit(1);
  if (error) throw new Error(error.message);
  const r = rows?.[0];
  if (r && chargeId) {
    if (r.state !== "completed") await finishUpgrade(admin, r);
    return true;
  }
  if (providerId) {
    const { data: busy, error: busyError } = await admin.from("plan_upgrade_requests").select("id")
      .eq("provider_subscription_id", providerId).eq("state", "charging").limit(1);
    if (busyError) throw new Error(busyError.message);
    if (busy?.length) throw new Error("upgrade_charge_registration_pending");
  }
  return false;
}
export async function recoverUpgrades(admin: LifecycleAdmin) {
  const { data, error } = await admin.from("plan_upgrade_requests").select("*")
    .in("state", ["awaiting_payment", "paid", "replacing"]).order("updated_at").limit(10);
  if (error) throw new Error(error.message);
  for (const r of data ?? []) {
    try { await finishUpgrade(admin, r); } catch (error) { await save(admin, r.id, { error: String(error) }); }
  }
}