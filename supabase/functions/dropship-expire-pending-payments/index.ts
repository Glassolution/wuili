import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { isConfirmedPayment, lookupPaymentStatus } from "../_shared/validapay.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-worker-token, x-cron-token",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function isAdmin(admin: ReturnType<typeof createClient>, userId: string) {
  const { data } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  return !!data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Metodo nao permitido" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    const internalToken = req.headers.get("x-worker-token") ?? req.headers.get("x-cron-token");
    const expectedToken = Deno.env.get("DROPSHIP_WORKER_TOKEN") ?? Deno.env.get("CRON_SECRET");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("DB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const dbUrl = Deno.env.get("DB_URL") ?? supabaseUrl;

    if (!supabaseUrl || !anonKey || !serviceKey || !dbUrl) {
      return json({ error: "Configuracao do servidor incompleta" }, 500);
    }

    const admin = createClient(dbUrl, serviceKey, { auth: { persistSession: false } });

    if (expectedToken && internalToken && internalToken === expectedToken) {
      // autorizado por token interno
    } else {
      if (!authHeader?.startsWith("Bearer ")) return json({ error: "Nao autorizado" }, 401);
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userError } = await userClient.auth.getUser();
      if (userError || !userData.user) return json({ error: "Token invalido" }, 401);
      if (!(await isAdmin(admin, userData.user.id))) return json({ error: "Acesso restrito a admins" }, 403);
    }

    const now = new Date().toISOString();
    const { data: orders, error } = await admin
      .from("dropship_orders")
      .select("id,status,payment_status,payment_reference,pix_expires_at,payment_retry_expires_at,c7drop_cart_ref,metadata")
      .in("status", ["pix_gerado", "reservando_fornecedor", "reservado_aguardando_pagamento"])
      .eq("payment_status", "pending")
      .or(`pix_expires_at.lte.${now},payment_retry_expires_at.lte.${now}`)
      .limit(100);

    if (error) return json({ error: error.message }, 500);

    let expired = 0;
    let keptPaid = 0;
    const failures: Array<{ order_id: string; error: string }> = [];

    for (const order of orders ?? []) {
      const orderId = String(order.id);
      const reference = stringValue(order.payment_reference);

      if (reference) {
        try {
          const info = await lookupPaymentStatus(reference);
          if (isConfirmedPayment(info)) {
            await admin
              .from("dropship_orders")
              .update({
                status: "pagamento_confirmado",
                payment_status: "paid",
                updated_at: new Date().toISOString(),
              })
              .eq("id", orderId);
            await admin.from("dropship_order_events").insert({
              order_id: orderId,
              event_type: "payment_confirmed",
              previous_status: order.status,
              new_status: "pagamento_confirmado",
              actor: "dropship-expire-pending-payments",
              message: "Pagamento confirmado durante a checagem de expiração.",
              metadata: { payment_reference: reference },
            });
            keptPaid++;
            continue;
          }
        } catch (err) {
          failures.push({ order_id: orderId, error: err instanceof Error ? err.message : String(err) });
        }
      }

      const hadCart = !!stringValue(order.c7drop_cart_ref) || ["reservando_fornecedor", "reservado_aguardando_pagamento"].includes(String(order.status));
      const nextStatus = hadCart ? "cancelamento_pendente" : "expirado";
      const message = hadCart
        ? "Pix expirado sem pagamento; bot deve remover a reserva/carrinho na C7Drop."
        : "Pix expirado sem pagamento antes da reserva no fornecedor.";

      const { error: updateError } = await admin
        .from("dropship_orders")
        .update({
          status: nextStatus,
          cancel_reason: message,
          error_detail: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (updateError) {
        failures.push({ order_id: orderId, error: updateError.message });
        continue;
      }

      await admin.from("dropship_order_events").insert({
        order_id: orderId,
        event_type: "payment_expired",
        previous_status: order.status,
        new_status: nextStatus,
        actor: "dropship-expire-pending-payments",
        message,
        metadata: { payment_reference: reference, had_cart: hadCart },
      });
      expired++;
    }

    return json({ ok: true, checked: orders?.length ?? 0, expired, kept_paid: keptPaid, failures });
  } catch (err) {
    console.error("dropship-expire-pending-payments erro:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
