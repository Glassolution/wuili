import { getCharge, validaPayFetch } from "./validapay.ts";
import { providerCancellationConfirmed } from "./subscriptionLifecyclePolicy.ts";
import { syncPaidProfile, type LifecycleAdmin } from "./subscriptionLifecycle.ts";

export type CourtesyInput = {
  subscription_id?: string; charge_id?: string; user_id?: string; amount?: number;
  reason?: string; dry_run?: boolean;
  confirmation?: { user_id?: string; amount?: number; reason?: string };
};

export function courtesyConfirmationMatches(body: CourtesyInput): boolean {
  return Boolean(body.subscription_id && body.charge_id && body.user_id && body.reason?.trim() &&
    Number(body.amount) > 0 && body.confirmation?.user_id === body.user_id &&
    body.confirmation?.amount === body.amount && body.confirmation?.reason === body.reason);
}

export async function adminCourtesyRefund(admin: LifecycleAdmin, body: CourtesyInput) {
  if (!courtesyConfirmationMatches(body)) return { success: false, error: "Confirme cliente, assinatura, cobrança, valor e motivo." };
  const { data: sub, error: subError } = await admin.from("subscriptions").select("*").eq("id", body.subscription_id).maybeSingle();
  if (subError) throw new Error(`courtesy_subscription_read:${subError.message}`);
  if (!sub || sub.user_id !== body.user_id || sub.validapay_charge_id !== body.charge_id ||
    sub.provider !== "validapay" || sub.purchase_kind === "lifetime" || Number(sub.amount) !== body.amount) {
    return { success: false, error: "Cobrança não corresponde à assinatura e ao valor confirmados." };
  }
  const { data: linked, error: linkError } = await admin.from("validapay_webhook_events").select("id")
    .eq("charge_id", body.charge_id).eq("subscription_id", sub.validapay_subscription_id).limit(1);
  if (linkError) throw new Error(`courtesy_charge_link:${linkError.message}`);
  if (!linked?.length) return { success: false, error: "Vínculo da cobrança com o contrato não comprovado." };
  const { data: existing, error: existingError } = await admin.from("refund_requests").select("id,status,provider_response")
    .eq("charge_id", body.charge_id).in("status", ["pending", "processing", "processed", "approved"]).limit(1);
  if (existingError) throw new Error(`courtesy_prior_read:${existingError.message}`);
  if (existing?.length) return { success: false, requires_manual_review: true, existing: existing[0], error: "Cobrança já possui operação; não será reenviada." };
  const charge = await getCharge(String(body.charge_id));
  if (charge.chargeId !== body.charge_id || !["PAID", "APPROVED", "CONFIRMED"].includes(charge.status.toUpperCase()) ||
    Number(charge.amount) !== body.amount) return { success: false, error: "Pagamento ou valor não confirmado na ValidaPay." };
  if (body.dry_run !== false) return { success: true, dry_run: true, eligible: true, amount: charge.amount, charge_status: charge.status };

  // The durable charge key prevents resubmission even if the provider response is lost.
  const { error: reserveError } = await admin.from("post_cancel_refund_operations").insert({
    charge_id: body.charge_id, subscription_id: sub.id, user_id: sub.user_id, amount: body.amount, reason: body.reason,
  });
  if (reserveError?.code === "23505") return { success: false, requires_manual_review: true, error: "Operação já reservada; não será reenviada." };
  if (reserveError) throw new Error(`courtesy_reserve:${reserveError.message}`);
  const { data: refund, error: createError } = await admin.from("refund_requests").insert({
    user_id: sub.user_id, subscription_id: sub.id, charge_id: body.charge_id, reason: body.reason,
    reason_details: body.reason, refund_amount: body.amount, refund_kind: "admin_courtesy",
    status: "processing", keep_access: false, automated: false,
  }).select("id").single();
  if (createError || !refund) throw new Error(`courtesy_request:${createError?.message}`);
  const { error: operationError } = await admin.from("post_cancel_refund_operations").update({
    refund_request_id: refund.id, state: "processing", updated_at: new Date().toISOString(),
  }).eq("charge_id", body.charge_id);
  if (operationError) throw new Error(`courtesy_link:${operationError.message}`);

  let provider: Record<string, unknown>;
  try {
    provider = await validaPayFetch<Record<string, unknown>>("/v1/wallet/refunds", {
      method: "POST", scope: "wallet/write wallet/read", retryUnauthorized: false,
      body: JSON.stringify({ chargeId: body.charge_id, amount: body.amount, reason: "CUSTOMER_REQUEST" }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await admin.from("refund_requests").update({ provider_response: { status: "UNKNOWN", error: message, requires_manual_review: true } }).eq("id", refund.id);
    await admin.from("post_cancel_refund_operations").update({ state: "uncertain" }).eq("charge_id", body.charge_id);
    return { success: false, refund_request_id: refund.id, requires_manual_review: true, error: message };
  }
  const status = String(provider.status ?? "").toUpperCase();
  const confirmed = ["CONFIRMED", "COMPLETED", "SUCCESS"].includes(status);
  const accepted = confirmed || status === "PROCESSING";
  const now = new Date().toISOString();
  const { error: saveError } = await admin.from("refund_requests").update({
    status: confirmed ? "processed" : "processing", provider_response: { provider: "validapay", chargeId: body.charge_id, ...provider },
    processed_at: confirmed ? now : null, updated_at: now,
  }).eq("id", refund.id);
  if (saveError) throw new Error(`courtesy_outcome_save:${saveError.message}`);
  const { error: outcomeError } = await admin.from("post_cancel_refund_operations").update({
    state: confirmed ? "confirmed" : accepted ? "processing" : "uncertain", updated_at: now,
  }).eq("charge_id", body.charge_id);
  if (outcomeError) throw new Error(`courtesy_operation_save:${outcomeError.message}`);
  if (!accepted) return { success: false, refund_request_id: refund.id, provider, requires_manual_review: true };

  const { error: terminateError } = await admin.from("subscriptions").update({
    status: "refunded", cancel_at_period_end: true, cancelled_at: sub.cancelled_at ?? now,
    cancellation_reason: body.reason, updated_at: now,
  }).eq("id", sub.id);
  if (terminateError) throw new Error(`courtesy_access_end:${terminateError.message}`);
  // Courtesy does not write cooldowns, identity blocks or Mercado Livre listings.
  await syncPaidProfile(admin, sub.user_id);
  let cancellation: unknown;
  try {
    const path = `/v1/subscriptions/${encodeURIComponent(sub.validapay_subscription_id)}`;
    const options = { scope: "checkouts/write checkouts/read subscriptions/write subscriptions/read accounts/read", retryUnauthorized: false };
    cancellation = await validaPayFetch(path, { ...options, method: "DELETE" });
    if (!providerCancellationConfirmed(cancellation)) cancellation = await validaPayFetch(path, { ...options, method: "GET" });
    if (!providerCancellationConfirmed(cancellation)) throw new Error("provider_cancellation_unconfirmed");
    const confirmedAt = new Date().toISOString();
    const { error: cancelSaveError } = await admin.from("subscriptions").update({ provider_cancelled_at: confirmedAt }).eq("id", sub.id);
    if (cancelSaveError) throw new Error(`courtesy_cancel_save:${cancelSaveError.message}`);
    const { error: jobError } = await admin.from("provider_cancellation_requests").update({
      state: "confirmed", confirmed_at: confirmedAt, next_retry_at: null, lease_until: null, updated_at: confirmedAt,
    }).eq("subscription_id", sub.id);
    if (jobError) throw new Error(`courtesy_cancel_job_save:${jobError.message}`);
    return { success: true, refund_request_id: refund.id, provider, provider_cancelled: true, cancellation };
  } catch (error) {
    // No new retry job: an administrator must review a failed courtesy cancellation.
    return { success: false, refund_request_id: refund.id, provider, provider_cancelled: false,
      cancellation_error: error instanceof Error ? error.message : String(error), cancellation,
      requires_manual_review: true, access_ended: true };
  }
}