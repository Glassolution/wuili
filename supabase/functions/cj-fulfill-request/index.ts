import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ success: false, error: "Nao autorizado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const internalSecret = Deno.env.get("INTERNAL_SECRET");
    const dbUrl = Deno.env.get("DB_URL") ?? supabaseUrl;
    const dbKey = Deno.env.get("DB_SERVICE_ROLE_KEY") ?? serviceRoleKey;

    if (!supabaseUrl || !anonKey || !serviceRoleKey || !internalSecret || !dbUrl || !dbKey) {
      return json({ success: false, error: "Configuracao do servidor incompleta" }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(dbUrl, dbKey);
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ success: false, error: "Token invalido" }, 401);

    const { order_id: orderId } = await req.json().catch(() => ({ order_id: null }));
    if (typeof orderId !== "string" || !orderId.trim()) {
      return json({ success: false, error: "order_id e obrigatorio" }, 400);
    }

    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .select("id,user_id")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !order) return json({ success: false, error: "Pedido nao encontrado" }, 404);
    if (order.user_id !== userData.user.id) return json({ success: false, error: "Acesso negado" }, 403);

    const fulfillResponse = await fetch(`${supabaseUrl}/functions/v1/cj-fulfill`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        "x-internal-secret": internalSecret,
      },
      body: JSON.stringify({ order_id: orderId }),
    });

    const payload = await fulfillResponse.json().catch(() => ({ success: false, error: "Resposta invalida" }));
    return json(payload, fulfillResponse.status);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cj-fulfill-request] error:", message);
    return json({ success: false, error: "Erro interno" }, 500);
  }
});
