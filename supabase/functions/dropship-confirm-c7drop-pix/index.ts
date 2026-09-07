// Vendedor clicou em "Ja paguei" no Pix gerado pela C7Drop.
// Marca o pedido como pago para o bot finalizar o checkout no fornecedor.
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

type JsonRecord = Record<string, unknown>;
type Supabase = ReturnType<typeof createClient>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function isAdmin(admin: Supabase, userId: string) {
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
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Nao autorizado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("DB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const dbUrl = Deno.env.get("DB_URL") ?? supabaseUrl;
    if (!supabaseUrl || !anonKey || !serviceKey || !dbUrl) {
      return json({ error: "Configuracao do servidor incompleta" }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(dbUrl, serviceKey, { auth: { persistSession: false } });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Token invalido" }, 401);
    const requesterId = userData.user.id;

    const body = await req.json().catch(() => null) as JsonRecord | null;
    const orderId = stringValue(body?.order_id);
    if (!orderId) return json({ error: "Informe order_id" }, 400);

    const { data: order, error: orderError } = await admin
      .from("dropship_orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) return json({ error: orderError.message }, 500);
    if (!order) return json({ error: "Pedido nao encontrado" }, 404);

    const orderRow = order as JsonRecord;
    if (String(orderRow.user_id ?? "") !== requesterId && !(await isAdmin(admin, requesterId))) {
      return json({ error: "Acesso restrito ao dono do pedido ou admins" }, 403);
    }

    if (String(orderRow.payment_status ?? "").toLowerCase() === "paid") {
      return json({ ok: true, order: orderRow, already_confirmed: true });
    }

    if (!stringValue(orderRow.c7drop_pix_copy_paste)) {
      return json({ error: "O Pix da C7Drop ainda nao foi gerado pelo bot." }, 409);
    }

    const nowIso = new Date().toISOString();
    const metadata = record(orderRow.metadata);

    const { data: updated, error: updateError } = await admin
      .from("dropship_orders")
      .update({
        status: "pagamento_confirmado",
        payment_status: "paid",
        payment_method: "pix_c7drop",
        c7drop_payment_method: "pix_c7drop",
        updated_at: nowIso,
        metadata: {
          ...metadata,
          c7drop_pix: {
            ...record(metadata.c7drop_pix),
            confirmed_at: nowIso,
            confirmed_by: requesterId,
          },
        },
      })
      .eq("id", orderId)
      .select()
      .single();

    if (updateError) return json({ error: updateError.message }, 500);

    await admin.from("dropship_order_events").insert({
      order_id: orderId,
      event_type: "c7drop_pix_confirmed",
      previous_status: orderRow.status ?? null,
      new_status: "pagamento_confirmado",
      actor: "dropship-confirm-c7drop-pix",
      message: "Vendedor confirmou o pagamento do Pix da C7Drop.",
      metadata: { confirmed_by: requesterId },
    });

    return json({ ok: true, order: updated });
  } catch (err) {
    console.error("[dropship-confirm-c7drop-pix] erro:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
