// Reconsulta estornos que ficaram em PROCESSING na ValidaPay.
// A ValidaPay não envia webhook para conclusão de estorno, então rodamos
// este job a cada 30 minutos via pg_cron.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getRefundStatus, ValidaPayError } from "../_shared/validapay.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Estorno de cartão pode levar até 30 dias (prazo do emissor). Depois disso,
// paramos de reconsultar e sinalizamos revisão manual.
const MAX_DAYS_PROCESSING = 30;

type ProviderResponse = Record<string, unknown> & {
  refundId?: string;
  id?: string;
  status?: string;
  chargeId?: string;
  createdAt?: string;
  paymentType?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  try {
    // Autorização: chamada interna (service role / cron) ou usuário admin.
    // Chamadas do cron usam a anon key + header x-internal-cron; nesse caso o
    // job roda mas a resposta traz apenas contadores (sem dados de reembolso).
    const authHeader = req.headers.get("Authorization") ?? "";
    const bearer = authHeader.replace("Bearer ", "").trim();
    const isCron = req.headers.get("x-internal-cron") === "velo-refunds";
    let isAdmin = !!bearer && bearer === serviceKey;

    if (!isAdmin && bearer) {
      try {
        const userClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: `Bearer ${bearer}` } } },
        );
        const { data: claimsData } = await userClient.auth.getClaims(bearer);
        const callerId = claimsData?.claims?.sub as string | undefined;
        if (callerId) {
          const { data: roleRow } = await admin
            .from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();
          isAdmin = !!roleRow;
        }
      } catch (_e) { /* token inválido/expirado */ }
    }
    if (!isAdmin && !isCron) return json({ error: "Não autorizado" }, 401);


    // 1) Estornos ainda em PROCESSING
    const { data: rows, error } = await admin
      .from("refund_requests")
      .select("id, user_id, subscription_id, status, provider_response, processed_at, created_at")
      .eq("status", "processed")
      .order("processed_at", { ascending: true })
      .limit(200);
    if (error) throw error;

    const pending = (rows ?? []).filter((r) => {
      const pr = (r.provider_response ?? {}) as ProviderResponse;
      const st = String(pr.status ?? "").toUpperCase();
      return st === "PROCESSING" && !!(pr.refundId ?? pr.id);
    });

    const results: Array<Record<string, unknown>> = [];

    for (const row of pending) {
      const pr = (row.provider_response ?? {}) as ProviderResponse;
      const refundId = String(pr.refundId ?? pr.id);
      const startedAt = new Date(
        String(pr.createdAt ?? row.processed_at ?? row.created_at),
      ).getTime();
      const daysElapsed = (Date.now() - startedAt) / 86_400_000;

      let statusResp: ProviderResponse | null = null;
      let fetchError: string | null = null;
      try {
        statusResp = (await getRefundStatus(refundId)) as ProviderResponse;
      } catch (e) {
        const err = e as ValidaPayError;
        fetchError = `${err.status ?? ""} ${err.message}`.trim();
      }

      const raw = (Array.isArray((statusResp as { data?: unknown })?.data)
        ? ((statusResp as { data: ProviderResponse[] }).data[0] ?? {})
        : statusResp ?? {}) as ProviderResponse;
      const newStatus = String(raw.status ?? "").toUpperCase();

      const baseUpdate = {
        ...pr,
        refundId,
        last_checked_at: new Date().toISOString(),
        provider_status_response: raw,
      } as Record<string, unknown>;

      if (newStatus === "CONFIRMED" || newStatus === "COMPLETED" || newStatus === "SUCCESS") {
        await admin.from("refund_requests").update({
          status: "processed",
          provider_response: { ...baseUpdate, status: "CONFIRMED", confirmed_at: new Date().toISOString() },
          updated_at: new Date().toISOString(),
        }).eq("id", row.id);

        if (row.subscription_id) {
          await admin.from("subscriptions")
            .update({ status: "cancelled", updated_at: new Date().toISOString() })
            .eq("id", row.subscription_id);
        }
        results.push({ id: row.id, refundId, outcome: "confirmed" });
        console.log("refund_logs", JSON.stringify({ origin: "check-pending-refunds", outcome: "confirmed", refundId }));
        continue;
      }

      if (newStatus === "FAILED" || newStatus === "CANCELLED" || newStatus === "REJECTED") {
        const reason = String(raw.reason ?? raw.message ?? raw.error ?? "Estorno recusado pela ValidaPay");
        await admin.from("refund_requests").update({
          status: "pending",
          processed_at: null,
          provider_response: {
            ...baseUpdate,
            status: "FAILED",
            failure_reason: reason,
            needs_manual_action: true,
            failed_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        }).eq("id", row.id);

        await admin.from("notifications").insert({
          user_id: row.user_id,
          title: "Reembolso em análise",
          message: "Houve uma falha ao concluir seu estorno no banco. Nossa equipe já foi avisada e vai reprocessar.",
          type: "refund",
        });

        results.push({ id: row.id, refundId, outcome: "failed", reason });
        console.error("refund_logs", JSON.stringify({ origin: "check-pending-refunds", outcome: "failed", refundId, reason }));
        continue;
      }

      // Ainda processando (ou erro de consulta): checa o limite de 30 dias.
      if (daysElapsed > MAX_DAYS_PROCESSING) {
        await admin.from("refund_requests").update({
          status: "pending",
          processed_at: null,
          provider_response: {
            ...baseUpdate,
            status: "FAILED",
            failure_reason: `Estorno permaneceu em PROCESSING por mais de ${MAX_DAYS_PROCESSING} dias. Verifique no painel da ValidaPay.`,
            needs_manual_action: true,
            timed_out_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        }).eq("id", row.id);
        results.push({ id: row.id, refundId, outcome: "timeout_manual_review", daysElapsed });
        console.error("refund_logs", JSON.stringify({ origin: "check-pending-refunds", outcome: "timeout", refundId, daysElapsed }));
        continue;
      }

      await admin.from("refund_requests").update({
        provider_response: baseUpdate,
        updated_at: new Date().toISOString(),
      }).eq("id", row.id);

      results.push({
        id: row.id,
        refundId,
        outcome: fetchError ? "check_error" : "processing",
        status: newStatus || null,
        error: fetchError,
        daysElapsed: Number(daysElapsed.toFixed(2)),
      });
    }

    const { data: dropshipRows, error: dropshipError } = await admin
      .from("dropship_orders")
      .select("id,user_id,order_number,ml_order_id,metadata,refund_requested_at,refund_status")
      .eq("refund_required", true)
      .eq("refund_status", "requested")
      .order("refund_requested_at", { ascending: true })
      .limit(200);
    if (dropshipError) throw dropshipError;

    const dropshipResults: Array<Record<string, unknown>> = [];

    for (const order of dropshipRows ?? []) {
      const metadata = order.metadata && typeof order.metadata === "object" && !Array.isArray(order.metadata)
        ? order.metadata as Record<string, unknown>
        : {};
      const dropshipRefund = metadata.dropship_refund && typeof metadata.dropship_refund === "object" && !Array.isArray(metadata.dropship_refund)
        ? metadata.dropship_refund as Record<string, unknown>
        : {};
      const providerResponse = dropshipRefund.provider_response && typeof dropshipRefund.provider_response === "object" && !Array.isArray(dropshipRefund.provider_response)
        ? dropshipRefund.provider_response as ProviderResponse
        : {};
      const refundId = String(providerResponse.refundId ?? providerResponse.id ?? "").trim();
      if (!refundId) continue;

      let statusResp: ProviderResponse | null = null;
      let fetchError: string | null = null;
      try {
        statusResp = (await getRefundStatus(refundId)) as ProviderResponse;
      } catch (e) {
        const err = e as ValidaPayError;
        fetchError = `${err.status ?? ""} ${err.message}`.trim();
      }

      const raw = (Array.isArray((statusResp as { data?: unknown })?.data)
        ? ((statusResp as { data: ProviderResponse[] }).data[0] ?? {})
        : statusResp ?? {}) as ProviderResponse;
      const newStatus = String(raw.status ?? "").toUpperCase();
      const mergedMetadata = {
        ...metadata,
        dropship_refund: {
          ...dropshipRefund,
          provider_status_response: raw,
          last_checked_at: new Date().toISOString(),
        },
      };

      if (["CONFIRMED", "COMPLETED", "SUCCESS"].includes(newStatus)) {
        await admin.from("dropship_orders").update({
          refund_status: "succeeded",
          refund_completed_at: new Date().toISOString(),
          metadata: mergedMetadata,
          updated_at: new Date().toISOString(),
        }).eq("id", order.id);
        await admin.from("dropship_order_events").insert({
          order_id: order.id,
          event_type: "refund_succeeded",
          actor: "check-pending-refunds",
          message: "Estorno dropship confirmado pela ValidaPay.",
          metadata: { refund_id: refundId, provider_response: raw },
        });
        dropshipResults.push({ id: order.id, refundId, outcome: "confirmed" });
        continue;
      }

      if (["FAILED", "CANCELLED", "REJECTED"].includes(newStatus)) {
        const reason = String(raw.reason ?? raw.message ?? raw.error ?? "Estorno recusado pela ValidaPay");
        await admin.from("dropship_orders").update({
          refund_status: "failed",
          refund_error: reason,
          metadata: mergedMetadata,
          updated_at: new Date().toISOString(),
        }).eq("id", order.id);
        await admin.from("dropship_worker_alerts").insert({
          order_id: order.id,
          order_number: order.order_number ?? order.ml_order_id ?? order.id,
          severity: "critical",
          code: "dropship_refund_failed",
          message: `Falha ao confirmar estorno do pedido ${order.order_number ?? order.ml_order_id ?? order.id}: ${reason}`,
          details: { refund_id: refundId, provider_response: raw },
        });
        dropshipResults.push({ id: order.id, refundId, outcome: "failed", reason });
        continue;
      }

      await admin.from("dropship_orders").update({
        metadata: mergedMetadata,
        updated_at: new Date().toISOString(),
      }).eq("id", order.id);
      dropshipResults.push({
        id: order.id,
        refundId,
        outcome: fetchError ? "check_error" : "processing",
        status: newStatus || null,
        error: fetchError,
      });
    }

    return json(
      isAdmin
        ? { success: true, checked: pending.length, results, dropship_checked: dropshipRows?.length ?? 0, dropship_results: dropshipResults }
        : { success: true, checked: pending.length, dropship_checked: dropshipRows?.length ?? 0 },
    );
  } catch (err) {
    console.error("check-pending-refunds error", err);
    return json({ error: "Erro interno", message: String(err) }, 500);
  }
});
