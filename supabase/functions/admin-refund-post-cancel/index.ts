// Estorna cobranças de renovação que ocorreram DEPOIS do cancelamento.
// Uso: POST { dry_run?: boolean, subscription_ids?: string[] } — restrito a admins.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getCharge, validaPayFetch } from "../_shared/validapay.ts";
import { refundExecutionRequested, renewalAfterTermination } from "../_shared/subscriptionLifecyclePolicy.ts";
import { requestProviderCancellation } from "../_shared/providerCancellation.ts";
import { finalizeConfirmedRefund } from "../_shared/confirmedRefundLifecycle.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// deno-lint-ignore no-explicit-any -- payload do gateway não é tipado
type Any = any;

const PAID = ["PAID", "CONFIRMED", "APPROVED", "COMPLETED", "SETTLED"];


type ChargeItem = {
  chargeId: string;
  subscriptionId?: string | null;
  status?: string | null;
  amount?: number | null;
  createdAt?: string | null;
  paymentType?: string | null;
  email?: string | null;
};

/**
 * A ValidaPay ignora o filtro ?subscriptionId no /v1/charges, então varremos as
 * páginas mais recentes e filtramos localmente.
 */
async function listRecentCharges(sinceIso: string, maxPages = 40): Promise<ChargeItem[]> {
  const since = new Date(sinceIso).getTime();
  const out: ChargeItem[] = [];
  let lastKey: string | null = null;
  for (let page = 0; page < maxPages; page++) {
    const qs = new URLSearchParams({ limit: "100" });
    if (lastKey) qs.set("lastKey", lastKey);
    const data = await validaPayFetch<Any>(`/v1/charges?${qs.toString()}`, {
      method: "GET",
      scope: "checkouts/read pix.cob/read accounts/read wallet/read",
    });
    const items: Any[] = data?.items ?? [];
    if (!items.length) break;
    for (const it of items) {
      out.push({
        chargeId: String(it.chargeId ?? it.id),
        subscriptionId: it.subscriptionId ?? null,
        status: it.status ?? null,
        amount: it.amount ?? null,
        createdAt: it.createdAt ?? null,
        paymentType: it.paymentType ?? null,
        email: it.email ?? null,
      });
    }
    const oldest = items[items.length - 1]?.createdAt;
    if (oldest && new Date(oldest).getTime() < since) break;
    lastKey = data?.pagination?.lastKey ?? null;
    if (!lastKey || data?.pagination?.hasMore === false) break;
  }
  return out;
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    const callerId = claims?.claims?.sub as string | undefined;
    if (!callerId) return json({ error: "Token inválido" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Acesso restrito a administradores" }, 403);

    const body = await req.json().catch(() => ({})) as {
      dry_run?: boolean;
      subscription_ids?: string[];
      inspect_email?: string;
      inspect_subscription?: string;
      refund_charge_id?: string;
      refund_subscription_id?: string;
      cancel_subscription_id?: string;
      confirmation?: { user_id: string; amount: number; reason: string };
    };
    const dryRun = body.dry_run !== false;
    if (body.dry_run === false && !body.refund_charge_id && !body.cancel_subscription_id) return json({ error: "Estorno em massa desativado. Confirme cliente, valor e motivo de uma cobrança específica." }, 400);

    if (body.cancel_subscription_id) {
      if (!body.confirmation?.user_id || !body.confirmation.reason?.trim()) return json({ error: "Confirme cliente e motivo do cancelamento pontual." }, 400);
      const { data: sub, error } = await admin.from("subscriptions").select("*").eq("id", body.cancel_subscription_id)
        .eq("user_id", body.confirmation.user_id).maybeSingle();
      if (error) throw new Error(`cancellation_subscription_read:${error.message}`);
      if (!sub || sub.provider !== "validapay" || sub.purchase_kind === "lifetime" ||
        !["cancelled", "refunded", "refunded_duplicate"].includes(sub.status)) {
        return json({ error: "Cancelamento pontual permitido somente no contrato antigo já encerrado/reembolsado." }, 400);
      }
      if (dryRun) return json({ ok: true, dry_run: true, subscription_id: sub.id, contract: sub.validapay_subscription_id });
      const confirmed = await requestProviderCancellation(admin, sub, body.confirmation.reason);
      return json({ ok: confirmed, provider_cancelled: confirmed, subscription_id: sub.id });
    }

    // Modo diagnóstico: lista cobranças do gateway por e-mail/assinatura.
    if (body.inspect_email || body.inspect_subscription) {
      const all = await listRecentCharges(
        new Date(Date.now() - 60 * 86400_000).toISOString(),
        90,
      );
      const match = all.filter((c) =>
        (body.inspect_email && String(c.email ?? "").toLowerCase() === body.inspect_email.toLowerCase()) ||
        (body.inspect_subscription && c.subscriptionId === body.inspect_subscription)
      );
      let subscription: unknown = null;
      if (body.inspect_subscription) {
        try {
          subscription = await validaPayFetch(
            `/v1/subscriptions/${encodeURIComponent(body.inspect_subscription)}`,
            { method: "GET", scope: "checkouts/read accounts/read" },
          );
        } catch (e) {
          subscription = { error: String(e) };
        }
      }
      return json({ ok: true, scanned: all.length, matches: match, subscription });
    }

    // Estorno pontual de uma cobrança específica já identificada.
    if (body.refund_charge_id) {
      const chargeId = body.refund_charge_id;
      if (!body.refund_subscription_id || !body.confirmation?.user_id || !body.confirmation.reason?.trim() || !(body.confirmation.amount > 0)) {
        return json({ error: "Confirme assinatura, cliente, valor e motivo antes do estorno." }, 400);
      }
      const { data: sub } = body.refund_subscription_id
        ? await admin.from("subscriptions").select("*").eq("id", body.refund_subscription_id).maybeSingle()
        : { data: null as Any };
      if (!sub || sub.user_id !== body.confirmation.user_id || sub.provider !== "validapay" || sub.purchase_kind === "lifetime") return json({ error: "Cliente/assinatura não corresponde ao contrato recorrente." }, 400);
      const { data: terminatingRefunds, error: terminationError } = await admin.from("refund_requests")
        .select("status,keep_access,processed_at").eq("subscription_id", sub.id).eq("keep_access", false)
        .in("status", ["processed", "refunded_by_mp"]);
      if (terminationError) throw new Error(`refund_termination_read:${terminationError.message}`);
      const verifiedCharge = await getCharge(chargeId);
      if (verifiedCharge.chargeId !== chargeId || !PAID.includes(String(verifiedCharge.status).toUpperCase()) || Number(verifiedCharge.amount) !== body.confirmation.amount ||
        !renewalAfterTermination(verifiedCharge.paidAt ?? null, sub.cancelled_at, terminatingRefunds ?? [])) {
        return json({ error: "Cobrança, valor ou data não comprovam pagamento posterior ao cancelamento." }, 400);
      }
      const { data: linked, error: linkedError } = await admin.from("validapay_webhook_events").select("id")
        .eq("charge_id", chargeId).eq("subscription_id", sub.validapay_subscription_id).limit(1);
      if (linkedError) throw new Error(`refund_charge_link:${linkedError.message}`);
      if (!linked?.length) return json({ error: "Vínculo da cobrança com este contrato precisa de revisão." }, 400);
      const { data: prior, error: priorError } = await admin
        .from("refund_requests").select("id,status").eq("charge_id", chargeId)
        .in("status", ["processed", "pending", "processing", "approved"]).maybeSingle();
      if (priorError) throw new Error(`refund_prior_read:${priorError.message}`);
      if (prior) return json({ ok: true, skipped: "operacao_existente_nao_reenviada", charge_id: chargeId });

      if (!refundExecutionRequested(body)) return json({ ok: true, dry_run: true, eligible: true, charge_id: chargeId,
        subscription_id: sub.id, amount: body.confirmation.amount });
      // Durable reservation happens before the provider call. Uncertain outcomes cannot be retried blindly.
      const { error: reserveError } = await admin.from("post_cancel_refund_operations").insert({
        charge_id: chargeId, subscription_id: sub.id, user_id: sub.user_id,
        amount: body.confirmation.amount, reason: body.confirmation.reason,
      });
      if (reserveError?.code === "23505") return json({ ok: true, skipped: "operacao_ja_reservada", charge_id: chargeId });
      if (reserveError) throw new Error(`refund_reservation:${reserveError.message}`);
      const { data: refundRequest, error: requestError } = await admin.from("refund_requests").insert({
        user_id: sub.user_id, subscription_id: sub.id, charge_id: chargeId,
        reason: "Cobrança indevida após cancelamento", reason_details: body.confirmation.reason,
        status: "pending", refund_amount: body.confirmation.amount, refund_kind: "post_cancel_charge",
        keep_access: true, automated: false,
      }).select("id").single();
      if (requestError || !refundRequest) throw new Error(`refund_request_reservation:${requestError?.message}`);
      const { error: linkError } = await admin.from("post_cancel_refund_operations").update({
        refund_request_id: refundRequest.id, state: "processing", updated_at: new Date().toISOString(),
      }).eq("charge_id", chargeId);
      if (linkError) throw new Error(`refund_operation_link:${linkError.message}`);
      let providerResponse: Record<string, unknown>;
      let state = "uncertain";
      try {
        const result = await validaPayFetch<Record<string, unknown>>("/v1/wallet/refunds", {
          method: "POST", scope: "wallet/write wallet/read", retryUnauthorized: false,
          body: JSON.stringify({ chargeId, amount: body.confirmation.amount, reason: "CUSTOMER_REQUEST" }),
        });
        const status = String(result.status ?? "").toUpperCase();
        state = ["CONFIRMED", "COMPLETED", "SUCCESS"].includes(status) ? "confirmed"
          : ["PROCESSING", "PENDING", "IN_PROCESS"].includes(status) ? "processing" : "uncertain";
        providerResponse = { provider: "validapay", chargeId, ...result };
      } catch (err) {
        providerResponse = { provider: "validapay", chargeId, status: "UNKNOWN",
          error: err instanceof Error ? err.message : String(err), requires_manual_review: true };
      }
      const now = new Date().toISOString();
      const { error: refundSaveError } = await admin.from("refund_requests").update({
        status: state === "confirmed" ? "processed" : "processing", provider_response: providerResponse,
        processed_at: state === "confirmed" ? now : null, updated_at: now,
      }).eq("id", refundRequest.id);
      if (refundSaveError) throw new Error(`refund_outcome_save:${refundSaveError.message}`);
      const { error: outcomeError } = await admin.from("post_cancel_refund_operations")
        .update({ state, updated_at: now }).eq("charge_id", chargeId);
      if (outcomeError) throw new Error(`refund_operation_outcome:${outcomeError.message}`);
      const providerCancelled = await requestProviderCancellation(admin, sub, body.confirmation.reason);
      if (state === "confirmed" && providerCancelled) await finalizeConfirmedRefund(admin, {
        subscription_id: sub.id, user_id: sub.user_id, keep_access: true, charge_id: chargeId,
      });
      return json({ ok: state !== "uncertain", processing: state !== "confirmed", charge_id: chargeId,
        provider: providerResponse, provider_cancelled: providerCancelled });
    }


    // Complete stored history, no provider mutation or N+1 contract reads.
    const { data: rows, error: historyError } = await admin.rpc("admin_post_cancel_renewals");
    if (historyError) throw new Error(`post_cancel_history:${historyError.message}`);
    const results = (rows ?? []).filter((row: { subscription_id: string }) =>
      !body.subscription_ids?.length || body.subscription_ids.includes(row.subscription_id));
    return json({ ok: true, dry_run: true, count: results.length,
      results: results.map((row: Record<string, unknown>) => ({ ...row,
        target_charge: row.charge_id, target_amount: row.amount,
        skipped: row.refund_recorded ? "ja_estornada" : null,
        provider_balance_verified: false,
      })) });
  } catch (err) {
    console.error("admin-refund-post-cancel", err);
    return json({ error: "Erro interno", message: String(err) }, 500);
  }
});
