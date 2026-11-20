// Auditoria provedor x Velo: acha contratos que a ValidaPay ainda vai renovar
// (ACTIVE e sem cancelAtPeriodEnd) mas que na Velo já estão reembolsados ou
// cancelados, e os coloca na fila durável de cancelamento. Só cancela a
// renovação; nunca estorna nem cobra. Contratos sem registro local ou expirados
// viram incidente para revisão humana, sem ação automática.
import { validaPayFetch } from "./validapay.ts";

// deno-lint-ignore no-explicit-any -- cliente Supabase admin sem tipos gerados nas edge functions
type Admin = any;

import { needsProviderCancellation, type ProviderSub } from "./providerCancellationAuditPolicy.ts";

async function listActiveProviderSubscriptions(): Promise<ProviderSub[]> {
  const out = new Map<string, ProviderSub>();
  let key: string | undefined;
  for (let page = 0; page < 50; page++) {
    const qs = new URLSearchParams({ status: "ACTIVE", limit: "100" });
    if (key) qs.set("lastKey", key);
    // deno-lint-ignore no-explicit-any -- resposta paginada da ValidaPay sem schema publicado
    const data = await validaPayFetch<any>(`/v1/subscriptions?${qs}`, { method: "GET", scope: "subscriptions/read" });
    const items: ProviderSub[] = data?.items ?? [];
    for (const i of items) out.set(i.subscriptionId, i);
    key = data?.pagination?.lastKey;
    if (!key || !items.length) break;
  }
  return [...out.values()];
}

export async function auditProviderCancellations(admin: Admin) {
  const result = { provider_active: 0, enqueued: 0, reopened: 0, review: 0 };
  const active = (await listActiveProviderSubscriptions()).filter((s) => !s.cancelAtPeriodEnd);
  result.provider_active = active.length;
  const ids = active.map((s) => s.subscriptionId);
  const locals = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await admin.from("subscriptions")
      .select("id,user_id,status,purchase_kind,provider,validapay_subscription_id")
      .in("validapay_subscription_id", ids.slice(i, i + 200));
    if (error) throw new Error(`audit_local_read:${error.message}`);
    for (const r of data ?? []) locals.set(r.validapay_subscription_id, r);
  }
  for (const p of active) {
    // deno-lint-ignore no-explicit-any -- linha de subscriptions
    const local = locals.get(p.subscriptionId) as any;
    if (needsProviderCancellation(p, local)) {
      const { data: job } = await admin.from("provider_cancellation_requests")
        .select("state").eq("subscription_id", local.id).maybeSingle();
      if (!job) {
        await admin.from("provider_cancellation_requests").insert({
          subscription_id: local.id, user_id: local.user_id, provider_subscription_id: p.subscriptionId,
          reason: "Auditoria automática: cancelado na Velo e ainda ativo na ValidaPay", state: "pending",
        });
        result.enqueued++;
      } else if (job.state === "confirmed") {
        // Confirmação local não bate com o provedor: tenta de novo.
        await admin.from("provider_cancellation_requests").update({
          state: "pending", next_retry_at: new Date().toISOString(), attempts: 0, confirmed_at: null,
          last_error: "Auditoria: ValidaPay ainda ativa após confirmação",
        }).eq("subscription_id", local.id);
        result.reopened++;
      } else if (job.state === "failed") {
        await logReview(admin, p, local, "Cancelamento falhou e o contrato continua ativo na ValidaPay");
        result.review++;
      }
    } else if (!local || local.status === "expired") {
      await logReview(admin, p, local, local ? "Expirada na Velo, ativa na ValidaPay" : "Ativa na ValidaPay sem assinatura na Velo (conta excluída?)");
      result.review++;
    }
  }
  return result;
}

// deno-lint-ignore no-explicit-any -- linha de subscriptions opcional
async function logReview(admin: Admin, p: ProviderSub, local: any, message: string) {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data: dup } = await admin.from("payment_incidents").select("id")
    .eq("kind", "provider_active_after_cancel").gte("created_at", since)
    .contains("details", { provider_subscription_id: p.subscriptionId }).limit(1);
  if (dup?.length) return;
  await admin.from("payment_incidents").insert({
    kind: "provider_active_after_cancel", severity: "critical",
    user_id: local?.user_id ?? null, subscription_id: local?.id ?? null, message,
    details: { provider_subscription_id: p.subscriptionId, next_charge: p.nextCycleChargeDate ?? null,
      email: p.customer?.email ?? null, review_required: true, money_moved: false },
  });
}
