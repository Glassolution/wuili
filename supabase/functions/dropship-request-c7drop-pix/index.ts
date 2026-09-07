// Coloca o pedido na fila do Pix direto da C7Drop.
// Nao usa ValidaPay: quem gera o Pix e o bot, dentro do checkout da C7Drop.
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

const PAID_PAYMENT_STATUSES = new Set(["paid", "approved", "confirmed", "pago", "confirmado"]);

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    const next = stringValue(value);
    if (next) return next;
  }
  return null;
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

    if (PAID_PAYMENT_STATUSES.has(String(orderRow.payment_status ?? "").toLowerCase())) {
      return json({ error: "Pedido ja esta pago; nao gere novo Pix." }, 409);
    }

    // Dados do comprador digitados no formulario prevalecem sobre o que ja
    // esta salvo; o bot usa isso no checkout da C7Drop.
    const documentDigits = String(body?.payer_document ?? "").replace(/\D/g, "");
    const phoneDigits = String(body?.buyer_phone ?? "").replace(/\D/g, "");
    const buyerName = firstString(body?.buyer_name, body?.payer_name);
    const buyerEmail = firstString(body?.buyer_email, body?.payer_email);

    const shippingAddress = record(orderRow.shipping_address);
    const addressBody = record(body?.address);
    const addressPatch: JsonRecord = {};
    for (const key of ["zip", "street", "number", "complement", "neighborhood", "city", "state"]) {
      const value = stringValue(addressBody[key]);
      if (value) addressPatch[key] = value;
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const metadata = record(orderRow.metadata);

    const patch: JsonRecord = {
      status: "pix_gerado",
      payment_status: "pending",
      payment_method: "pix_c7drop",
      c7drop_payment_method: "pix_c7drop",
      // Zera o Pix anterior para o bot gerar um novo no checkout da C7Drop.
      c7drop_pix_copy_paste: null,
      c7drop_pix_key: null,
      c7drop_pix_generated_at: null,
      c7drop_pix_expires_at: null,
      c7drop_pix_renewal_count: 0,
      payment_reference: null,
      error_detail: null,
      pix_gerado_at: nowIso,
      updated_at: nowIso,
      metadata: {
        ...metadata,
        c7drop_pix: {
          requested_at: nowIso,
          requested_by: requesterId,
          estimated_validity_minutes: 45,
          max_renewals: 3,
        },
      },
    };

    if (documentDigits.length === 11 || documentDigits.length === 14) patch.customer_document = documentDigits;
    if (buyerName) patch.customer_name = buyerName;
    if (buyerEmail) patch.customer_email = buyerEmail;
    if (phoneDigits.length >= 10) patch.customer_phone = phoneDigits;
    if (Object.keys(addressPatch).length > 0) {
      patch.shipping_address = { ...shippingAddress, ...addressPatch };
    }

    const { data: updated, error: updateError } = await admin
      .from("dropship_orders")
      .update(patch)
      .eq("id", orderId)
      .select()
      .single();

    if (updateError) return json({ error: updateError.message }, 500);

    await admin.from("dropship_order_events").insert({
      order_id: orderId,
      event_type: "c7drop_pix_requested",
      previous_status: orderRow.status ?? null,
      new_status: "pix_gerado",
      actor: "dropship-request-c7drop-pix",
      message: "Pix da C7Drop solicitado pelo vendedor; aguardando o bot montar o checkout.",
      metadata: { requested_by: requesterId },
    });

    return json({
      ok: true,
      order: updated,
      estimated_validity_minutes: 45,
      max_renewals: 3,
    });
  } catch (err) {
    console.error("[dropship-request-c7drop-pix] erro:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
