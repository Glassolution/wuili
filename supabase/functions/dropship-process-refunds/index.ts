import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { refundCharge, ValidaPayError } from "../_shared/validapay.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-worker-token, x-cron-token",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function isAdmin(admin: ReturnType<typeof createClient>, userId: string) {
  const { data } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  return !!data;
}

function refundSucceeded(providerResponse: Record<string, unknown>) {
  const status = String(providerResponse.status ?? "").toUpperCase();
  return providerResponse.success === true ||
    ["CONFIRMED", "COMPLETED", "SUCCESS", "SUCCEEDED"].includes(status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Metodo nao permitido" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("DB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const dbUrl = Deno.env.get("DB_URL") ?? supabaseUrl;
    const expectedToken = Deno.env.get("DROPSHIP_WORKER_TOKEN") ?? Deno.env.get("CRON_SECRET");

    if (!supabaseUrl || !anonKey || !serviceKey || !dbUrl) {
      return json({ error: "Configuracao do servidor incompleta" }, 500);
    }

    const admin = createClient(dbUrl, serviceKey, { auth: { persistSession: false } });
    const internalToken = req.headers.get("x-worker-token") ?? req.headers.get("x-cron-token");

    if (expectedToken && internalToken && internalToken === expectedToken) {
      // autorizado por token interno
    } else {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) return json({ error: "Nao autorizado" }, 401);
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userError } = await userClient.auth.getUser();
      if (userError || !userData.user) return json({ error: "Token invalido" }, 401);
      if (!(await isAdmin(admin, userData.user.id))) return json({ error: "Acesso restrito a admins" }, 403);
    }

    const { data: orders, error } = await admin
      .from("dropship_orders")
      .select("id,user_id,order_number,ml_order_id,payment_reference,refund_status,metadata")
      .eq("refund_required", true)
      .in("refund_status", ["pending", "failed"])
      .not("payment_reference", "is", null)
      .limit(50);

    if (error) return json({ error: error.message }, 500);

    let succeeded = 0;
    let requested = 0;
    let failed = 0;
    const results: Array<Record<string, unknown>> = [];

    for (const order of orders ?? []) {
      const orderId = String(order.id);
      const orderNumber = String(order.order_number ?? order.ml_order_id ?? orderId);
      const chargeId = String(order.payment_reference ?? "").trim();
      if (!chargeId) continue;

      try {
        await admin
          .from("dropship_orders")
          .update({
            refund_status: "requested",
            refund_requested_at: new Date().toISOString(),
            refund_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId);

        const providerResponse = await refundCharge(
          chargeId,
          undefined,
          "ORDER_CANCELLED",
        ) as Record<string, unknown>;
        const done = refundSucceeded(providerResponse);
        const nextStatus = done ? "succeeded" : "requested";
        const currentMetadata =
          order.metadata && typeof order.metadata === "object" && !Array.isArray(order.metadata)
            ? order.metadata as Record<string, unknown>
            : {};

        await admin
          .from("dropship_orders")
          .update({
            refund_status: nextStatus,
            refund_completed_at: done ? new Date().toISOString() : null,
            refund_error: null,
            metadata: {
              ...currentMetadata,
              dropship_refund: {
                charge_id: chargeId,
                provider_response: providerResponse,
                updated_at: new Date().toISOString(),
              },
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId);

        await admin.from("dropship_order_events").insert({
          order_id: orderId,
          event_type: done ? "refund_succeeded" : "refund_requested",
          actor: "dropship-process-refunds",
          message: done
            ? "Estorno dropship confirmado pela ValidaPay."
            : "Estorno dropship solicitado; aguardando confirmacao da ValidaPay.",
          metadata: { charge_id: chargeId, provider_response: providerResponse },
        });

        if (order.user_id) {
          await admin.from("notifications").insert({
            user_id: order.user_id,
            type: "refund",
            title: done ? "Estorno confirmado" : "Estorno solicitado",
            message: done
              ? `O estorno do pedido ${orderNumber} foi confirmado.`
              : `O estorno do pedido ${orderNumber} foi solicitado e esta em processamento.`,
            action_url: "/dashboard/pedidos",
            metadata: {
              dropship_order_id: orderId,
              ml_order_id: order.ml_order_id ?? null,
              event: done ? "dropship_refund_succeeded" : "dropship_refund_requested",
            },
          });
        }

        if (done) succeeded++;
        else requested++;
        results.push({ order_id: orderId, status: nextStatus });
      } catch (err) {
        const detail = err instanceof ValidaPayError
          ? `${err.status} ${err.message}`
          : err instanceof Error
            ? err.message
            : String(err);

        await admin
          .from("dropship_orders")
          .update({
            refund_status: "failed",
            refund_error: detail,
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId);

        await admin.from("dropship_order_events").insert({
          order_id: orderId,
          event_type: "refund_failed",
          actor: "dropship-process-refunds",
          message: `Falha ao estornar pedido dropship: ${detail}`,
          metadata: { charge_id: chargeId },
        });

        await admin.from("dropship_worker_alerts").insert({
          order_id: orderId,
          order_number: orderNumber,
          severity: "critical",
          code: "dropship_refund_failed",
          message: `Falha ao estornar pedido ${orderNumber}: ${detail}`,
          details: { charge_id: chargeId },
        });

        failed++;
        results.push({ order_id: orderId, status: "failed", error: detail });
      }
    }

    return json({
      ok: true,
      checked: orders?.length ?? 0,
      succeeded,
      requested,
      failed,
      results,
    });
  } catch (err) {
    console.error("dropship-process-refunds erro:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
