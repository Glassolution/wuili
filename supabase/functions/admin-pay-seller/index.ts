// Repasse Pix (ValidaPay) de uma venda de loja para a chave Pix do vendedor.
// Somente admins. O dinheiro sai da carteira ValidaPay da Velo.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { sendPixPayout, ValidaPayError } from "../_shared/validapay.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: claimsError } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsError || !claims?.claims) return json({ error: "Não autenticado" }, 401);
    const userId = claims.claims.sub as string;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: isAdmin } = await admin.rpc("is_admin", { _user_id: userId });
    if (!isAdmin) return json({ error: "Acesso restrito" }, 403);

    const body = (await req.json().catch(() => ({}))) as { order_id?: string };
    const orderId = String(body.order_id ?? "");
    if (!orderId) return json({ error: "order_id obrigatório" }, 400);

    const { data: order } = await admin
      .from("store_orders")
      .select("id,user_id,total,payment_status,product_title")
      .eq("id", orderId)
      .maybeSingle();
    if (!order) return json({ error: "Pedido não encontrado" }, 404);
    if (!["approved", "paid", "accredited"].includes(String(order.payment_status ?? "").toLowerCase())) {
      return json({ error: "Pedido ainda não foi pago" }, 400);
    }

    const { data: seller } = await admin
      .from("profiles")
      .select("pix_key,pix_key_type,display_name")
      .eq("user_id", order.user_id)
      .maybeSingle();
    if (!seller?.pix_key) return json({ error: "Vendedor ainda não cadastrou a chave Pix." }, 400);

    const amount = Number(order.total ?? 0);
    if (!(amount > 0)) return json({ error: "Valor inválido" }, 400);

    const payout = await sendPixPayout({
      pixKey: seller.pix_key,
      amount,
      description: `Repasse Velo - ${order.product_title ?? "venda"}`.slice(0, 140),
      externalReference: `payout_${order.id}`,
    });

    console.log("admin-pay-seller: repasse enviado", { orderId, amount, sellerId: order.user_id });
    return json({ ok: true, amount, payout });
  } catch (err) {
    const message = err instanceof ValidaPayError
      ? err.message
      : err instanceof Error
      ? err.message
      : String(err);
    console.error("admin-pay-seller erro", message);
    return json({ error: `Falha no repasse: ${message}` }, 500);
  }
});
