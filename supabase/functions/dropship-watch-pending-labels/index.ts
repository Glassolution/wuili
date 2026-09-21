import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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

    const threshold = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: orders, error } = await admin
      .from("dropship_orders")
      .select("id,user_id,order_number,ml_order_id,created_at")
      .eq("needs_shipping_label", true)
      .is("etiqueta_ml_url", null)
      .is("shipping_label_wait_alerted_at", null)
      .lte("created_at", threshold)
      .limit(100);

    if (error) return json({ error: error.message }, 500);

    let alerted = 0;
    const failures: Array<{ order_id: string; error: string }> = [];

    for (const order of orders ?? []) {
      const orderId = String(order.id);
      const orderNumber = String(order.order_number ?? order.ml_order_id ?? orderId);
      const message =
        `Pedido ${orderNumber} esta aguardando etiqueta do Mercado Livre ha mais de 1h. ` +
        "A compra no C7Drop foi pausada ate a etiqueta ficar disponivel.";

      const { error: updateError } = await admin
        .from("dropship_orders")
        .update({
          shipping_label_wait_alerted_at: new Date().toISOString(),
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
        event_type: "shipping_label_wait_alerted",
        actor: "dropship-watch-pending-labels",
        message,
        metadata: { waited_hours: 1 },
      });

      await admin.from("dropship_worker_alerts").insert({
        order_id: orderId,
        order_number: orderNumber,
        severity: "warning",
        code: "shipping_label_pending_1h",
        message,
        details: { ml_order_id: order.ml_order_id ?? null, created_at: order.created_at ?? null },
      });

      if (order.user_id) {
        await admin.from("notifications").insert({
          user_id: order.user_id,
          type: "warning",
          title: "Etiqueta do Mercado Livre pendente",
          message,
          action_url: "/dashboard/pedidos",
          metadata: {
            dropship_order_id: orderId,
            ml_order_id: order.ml_order_id ?? null,
            event: "shipping_label_pending_1h",
          },
        });
      }

      alerted++;
    }

    return json({ ok: true, checked: orders?.length ?? 0, alerted, failures });
  } catch (err) {
    console.error("dropship-watch-pending-labels erro:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
