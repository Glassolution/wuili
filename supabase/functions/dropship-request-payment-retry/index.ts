import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { createPixCharge, ValidaPayError } from "../_shared/validapay.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const PAID_PAYMENT_STATUSES = new Set(["paid", "approved", "confirmed", "pago", "confirmado"]);

type Supabase = ReturnType<typeof createClient>;
type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function digits(value: unknown): string | null {
  const onlyDigits = String(value ?? "").replace(/\D/g, "");
  return onlyDigits.length >= 11 ? onlyDigits : null;
}

function pickNested(source: JsonRecord, path: string[]): unknown {
  let current: unknown = source;
  for (const key of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return null;
    current = (current as JsonRecord)[key];
  }
  return current;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    const next = stringValue(value);
    if (next) return next;
  }
  return null;
}

function resolveAmount(order: JsonRecord) {
  const metadata = record(order.metadata);
  const worker = record(metadata.worker);
  const supplierPayment = record(worker.supplier_payment);

  const supplierAmount = numberValue(supplierPayment.amount);
  if (supplierAmount) return supplierAmount;

  const product = numberValue(order.preco_produto) ?? numberValue(worker.preco_produto);
  const shipping = numberValue(order.frete_real) ?? numberValue(worker.frete_real);
  if (product || shipping) return Number(((product ?? 0) + (shipping ?? 0)).toFixed(2));

  return numberValue(order.total_amount) ?? numberValue(order.preco_ml);
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
    const requesterIsAdmin = await isAdmin(admin, requesterId);

    const body = await req.json().catch(() => null) as JsonRecord | null;
    const orderId = stringValue(body?.order_id);
    const expiresInHours = Math.max(1, Math.min(72, Number(body?.expires_in_hours ?? 8) || 8));
    if (!orderId) return json({ error: "Informe order_id" }, 400);

    const { data: order, error: orderError } = await admin
      .from("dropship_orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) return json({ error: orderError.message }, 500);
    if (!order) return json({ error: "Pedido nao encontrado" }, 404);

    const orderRow = order as JsonRecord;
    if (!requesterIsAdmin && String(orderRow.user_id ?? "") !== requesterId) {
      return json({ error: "Acesso restrito ao dono do pedido ou admins" }, 403);
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("email,cpf,whatsapp")
      .eq("user_id", requesterId)
      .maybeSingle();

    if (PAID_PAYMENT_STATUSES.has(String(orderRow.payment_status ?? "").toLowerCase())) {
      return json({ error: "Pedido ja esta pago; nao gere novo Pix." }, 409);
    }

    const amount = resolveAmount(orderRow);
    if (!amount) return json({ error: "Pedido sem valor para gerar Pix." }, 400);

    const metadata = record(orderRow.metadata);
    const shippingAddress = record(orderRow.shipping_address);
    const payerDocument = digits(
      firstString(
        body?.payer_document,
        orderRow.customer_document,
        pickNested(shippingAddress, ["document"]),
        pickNested(shippingAddress, ["cpf"]),
        pickNested(shippingAddress, ["receiver_document"]),
        pickNested(shippingAddress, ["receiverDocument"]),
        pickNested(metadata, ["customer", "document"]),
        pickNested(metadata, ["payer", "document"]),
        profile?.cpf,
      ),
    );

    if (!payerDocument) {
      return json({ error: "Falta CPF/CNPJ do pagador para gerar o Pix." }, 400);
    }

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();
    const retryCount = Number(orderRow.payment_retry_count ?? 0) || 0;
    const externalReference = `dropship-${orderId}-${retryCount + 1}`;

    const charge = await createPixCharge({
      amount,
      description: `Pedido dropship ${String(orderRow.order_number ?? orderRow.ml_order_id ?? orderId)}`,
      merchantName: "Velo",
      externalReference,
      expiresInSeconds: expiresInHours * 60 * 60,
      payer: {
        name: firstString(body?.payer_name, orderRow.customer_name) ?? "Cliente Velo",
        email: firstString(body?.payer_email, orderRow.customer_email, profile?.email) ?? "cliente@velo.com.br",
        document: payerDocument,
      },
      metadata: {
        kind: "dropship_order",
        dropship_order_id: orderId,
        order_id: orderId,
        ml_order_id: orderRow.ml_order_id ?? null,
        expires_in_hours: expiresInHours,
      },
    });

    const nextMetadata = {
      ...metadata,
      validapay: {
        ...record(metadata.validapay),
        charge_id: charge.chargeId,
        external_reference: externalReference,
        amount,
        status: charge.status,
        expires_at: expiresAt,
        retry_count: retryCount + 1,
        updated_at: now,
      },
    };

    const patch = {
      status: "pix_gerado",
      payment_status: "pending",
      payment_method: "pix",
      payment_reference: charge.chargeId,
      pix_gerado_at: now,
      pix_expires_at: expiresAt,
      payment_retry_requested_at: now,
      payment_retry_expires_at: expiresAt,
      payment_retry_count: retryCount + 1,
      metadata: nextMetadata,
      updated_at: now,
    };

    const { error: updateError } = await admin
      .from("dropship_orders")
      .update(patch)
      .eq("id", orderId);

    if (updateError) return json({ error: updateError.message }, 500);

    await admin.from("dropship_order_events").insert({
      order_id: orderId,
      event_type: expiresInHours > 8 ? "payment_requested" : "payment_retry_requested",
      previous_status: orderRow.status ?? null,
      new_status: "pix_gerado",
      actor: requesterIsAdmin ? "admin" : "seller",
      message: `Pix solicitado com janela de ${expiresInHours}h.`,
      metadata: {
        amount,
        charge_id: charge.chargeId,
        expires_at: expiresAt,
      },
    });

    return json({
      ok: true,
      order_id: orderId,
      payment_id: charge.chargeId,
      status: "pix_gerado",
      pix_qr_code: charge.qrCode,
      pix_qr_code_base64: charge.qrCodeBase64,
      expires_at: expiresAt,
    });
  } catch (err) {
    if (err instanceof ValidaPayError) {
      return json({ error: err.message, details: err.details }, err.status || 400);
    }
    console.error("dropship-request-payment-retry erro:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
