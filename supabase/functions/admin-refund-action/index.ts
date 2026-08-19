import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { refundCharge, ValidaPayError } from "../_shared/validapay.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData } = await userClient.auth.getClaims(token);
    const callerId = claimsData?.claims?.sub as string | undefined;
    if (!callerId) return json({ error: "Token inválido" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      console.error("admin-refund-action: caller sem papel admin", callerId);
      return json({ error: "Acesso restrito a administradores" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    let { refund_id } = body as { refund_id?: string | null };
    const { action, user_id, reason, reason_details } = body as {
      action?: string;
      user_id?: string | null;
      reason?: string | null;
      reason_details?: string | null;
    };
    if (!["approve", "reject"].includes(String(action))) {
      return json({ error: "action (approve|reject) obrigatório" }, 400);
    }

    if (!refund_id && action === "approve" && user_id) {
      const directUserId = String(user_id).trim();
      const REJECTED_STATUSES = ["rejected", "denied", "cancelled", "canceled"];
      const { data: previousRequests } = await admin
        .from("refund_requests")
        .select("*")
        .eq("user_id", directUserId)
        .order("requested_at", { ascending: false })
        .limit(20);
      const previous = previousRequests ?? [];
      const pending = previous.find((row) => String(row.status ?? "").toLowerCase() === "pending");
      const blocking = previous.find((row) => {
        const status = String(row.status ?? "").toLowerCase();
        return status !== "pending" && !REJECTED_STATUSES.includes(status);
      });

      if (blocking) {
        console.error("admin-refund-action: reembolso bloqueado", { directUserId, status: blocking.status });
        return json(
          {
            error: `Este cliente já possui um reembolso ${String(blocking.status).toLowerCase() === "processed" ? "concluído" : "em processo"} (solicitado em ${new Date(blocking.requested_at ?? blocking.created_at).toLocaleDateString("pt-BR")}). Não é possível reembolsar novamente.`,
          },
          409,
        );
      }

      if (pending) {
        refund_id = pending.id;
      } else {
        const { data: subscription } = await admin
          .from("subscriptions")
          .select("*")
          .eq("user_id", directUserId)
          .in("status", ["active", "paid", "approved", "authorized"])
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!subscription) {
          console.error("admin-refund-action: sem assinatura ativa", directUserId);
          return json({ error: "Nenhuma assinatura ativa encontrada para este cliente." }, 404);
        }

        const now = new Date().toISOString();
        const { data: created, error: createErr } = await admin
          .from("refund_requests")
          .insert({
            user_id: directUserId,
            subscription_id: subscription.id,
            payment_id: subscription.mp_payment_id,
            charge_id: subscription.validapay_charge_id,
            reason: reason || "Reembolso direto pelo suporte",
            reason_details:
              reason_details ||
              "Reembolso direto aprovado pelo suporte administrativo após confirmação manual.",
            status: "pending",
            refund_amount: Number(subscription.amount ?? 0),
            requested_at: now,
            automated: true,
            refund_kind: "admin_direct",
          })
          .select("*")
          .single();
        if (createErr) return json({ error: createErr.message }, 500);
        refund_id = created.id;
      }
    }

    if (!refund_id) {
      return json({ error: "refund_id ou user_id são obrigatórios para aprovar reembolso" }, 400);
    }

    const { data: refund } = await admin.from("refund_requests").select("*").eq("id", refund_id).maybeSingle();
    if (!refund) return json({ error: "Reembolso não encontrado" }, 404);
    if (refund.status !== "pending") return json({ error: "Pedido já processado" }, 400);

    if (action === "reject") {
      await admin.from("refund_requests").update({
        status: "rejected",
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", refund_id);
      await admin.from("notifications").insert({
        user_id: refund.user_id,
        title: "Reembolso recusado",
        message: "Após análise, seu pedido de reembolso foi recusado. Sua assinatura continua ativa.",
        type: "refund",
      });
      return json({ success: true, message: "Reembolso recusado." });
    }

    // approve
    const { data: sub } = await admin.from("subscriptions").select("*").eq("id", refund.subscription_id).maybeSingle();
    let providerResponse: Record<string, unknown> | null = null;
    let refundOk = true;
    let refundProcessing = false;

    if (sub?.validapay_charge_id) {
      // Estorno de cartão/Pix na ValidaPay (POST /v1/wallet/refunds)
      try {
        const result = await refundCharge(
          sub.validapay_charge_id,
          Number(refund.refund_amount ?? sub.amount),
          "CUSTOMER_REQUEST",
        ) as Record<string, unknown>;
        const st = String(result?.status ?? "").toUpperCase();
        refundProcessing = st === "PROCESSING";
        refundOk = st === "CONFIRMED" || st === "COMPLETED" || st === "SUCCESS" || refundProcessing || result?.success === true;
        providerResponse = { provider: "validapay", ...result };
      } catch (e) {
        const err = e as ValidaPayError;
        refundOk = false;
        providerResponse = { provider: "validapay", error: err.message, details: err.details ?? null };
        console.error("refund_logs", JSON.stringify({ origin: "admin-refund-action", outcome: "error", message: err.message }));
      }
    } else {
      const MP = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
      if (MP && sub?.mp_payment_id) {
        const r = await fetch(`https://api.mercadopago.com/v1/payments/${sub.mp_payment_id}/refunds`, {
          method: "POST",
          headers: { Authorization: `Bearer ${MP}`, "Content-Type": "application/json", "X-Idempotency-Key": `refund-${sub.id}-${Date.now()}` },
          body: JSON.stringify({}),
        });
        providerResponse = await r.json();
        refundOk = r.ok;
      }
    }

    await admin.from("refund_requests").update({
      status: refundOk ? "processed" : "rejected",
      provider_response: providerResponse,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", refund_id);

    if (refundOk && sub) {
      await admin.from("subscriptions").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", sub.id);
      const cooldownUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await admin.from("profiles").update({ plano: "gratis", refund_cooldown_until: cooldownUntil }).eq("user_id", refund.user_id);

      // Derrubar publicações ativas no ML
      try {
        const { data: integ } = await admin.from("user_integrations")
          .select("access_token").eq("user_id", refund.user_id).eq("platform", "mercadolivre").maybeSingle();
        const { data: pubs } = await admin.from("user_publications")
          .select("id, ml_item_id").eq("user_id", refund.user_id).eq("status", "active");
        if (integ?.access_token && pubs?.length) {
          for (const p of pubs) {
            try {
              await fetch(`https://api.mercadolibre.com/items/${p.ml_item_id}`, {
                method: "PUT",
                headers: { Authorization: `Bearer ${integ.access_token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ status: "paused" }),
              });
              await fetch(`https://api.mercadolibre.com/items/${p.ml_item_id}`, {
                method: "PUT",
                headers: { Authorization: `Bearer ${integ.access_token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ status: "closed" }),
              });
            } catch (e) { console.error("ml close", e); }
          }
        }
        await admin.from("user_publications")
          .update({ status: "closed", updated_at: new Date().toISOString() })
          .eq("user_id", refund.user_id).eq("status", "active");
      } catch (e) { console.error("derrubar pubs", e); }
    }

    await admin.from("notifications").insert({
      user_id: refund.user_id,
      title: refundOk ? "Reembolso aprovado" : "Falha ao processar reembolso",
      message: refundOk
        ? "Seu reembolso foi aprovado. O estorno foi enviado ao banco emissor do cartão e pode levar até 30 dias para aparecer na sua fatura (normalmente entra na próxima fatura)."
        : "Não foi possível processar o reembolso. Entre em contato com o suporte.",
      type: "refund",
    });

    return json({ success: refundOk, processing: refundProcessing, providerResponse });
  } catch (err) {
    console.error("admin-refund-action:", err);
    return json({ error: "Erro interno", message: String(err) }, 500);
  }
});
