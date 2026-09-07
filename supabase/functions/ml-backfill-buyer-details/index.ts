/**
 * ml-backfill-buyer-details
 * -------------------------
 * Preenche CPF, telefone e e-mail reais do comprador nos pedidos já gravados
 * em `dropship_orders`. Sem esses dados o bot da C7Drop para no checkout com
 * `required_c7drop_form_value_missing`.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { fetchBuyerDetails } from "../_shared/mlBuyerDetails.ts";
import { getMlAccessToken } from "../_shared/mlShippingLabel.ts";

const BATCH_LIMIT = 60;

// deno-lint-ignore no-explicit-any -- payload cru do pedido do ML
type Json = any;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: { ...corsHeaders, "Access-Control-Allow-Headers": "authorization, content-type, x-worker-token, x-cron-token" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  const workerToken = Deno.env.get("DROPSHIP_WORKER_TOKEN");
  const cronToken = Deno.env.get("CRON_SECRET");
  const headerToken = req.headers.get("x-worker-token") ?? req.headers.get("x-cron-token");
  let authorized = Boolean(headerToken && (headerToken === workerToken || headerToken === cronToken));

  if (!authorized) {
    const bearer = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const { data: userData } = await supabase.auth.getUser(bearer);
    if (userData?.user) {
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .eq("role", "admin")
        .maybeSingle();
      authorized = Boolean(role);
    }
  }

  if (!authorized) {
    return new Response(JSON.stringify({ error: "nao_autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Number(body?.limit ?? BATCH_LIMIT) || BATCH_LIMIT, 200);
  const dryRun = body?.dry_run === true;

  // Modo diagnóstico: inspeciona quais campos o ML devolve para um pedido.
  if (body?.probe) {
    const mlOrderId = String(body.probe);
    const { data: dropship } = await supabase
      .from("dropship_orders")
      .select("user_id")
      .eq("ml_order_id", mlOrderId)
      .maybeSingle();
    const { data: order } = await supabase
      .from("orders")
      .select("raw, shipment_id")
      .eq("ml_order_id", mlOrderId)
      .maybeSingle();

    const token = await getMlAccessToken(supabase, String(dropship?.user_id ?? ""));
    const probe: Json = { ml_order_id: mlOrderId, tem_token: Boolean(token) };
    const raw = order?.raw as Json;
    const shipmentId = order?.shipment_id ?? raw?.shipping?.id ?? null;
    probe.shipment_id = shipmentId ? String(shipmentId) : null;

    if (token) {
      for (
        const [nome, url] of [
          ["billing_info", `https://api.mercadolibre.com/orders/${mlOrderId}/billing_info`],
          ["order", `https://api.mercadolibre.com/orders/${mlOrderId}`],
          ...(shipmentId
            ? [["shipment", `https://api.mercadolibre.com/shipments/${shipmentId}`] as const]
            : []),
        ] as [string, string][]
      ) {
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            "x-format-new": "true",
            Accept: "application/json",
          },
        });
        const text = await res.text();
        let parsed: Json = null;
        try {
          parsed = JSON.parse(text);
        } catch { /* corpo nao-JSON */ }
        probe[nome] = nome === "shipment" && parsed
          ? { status: res.status, destination: parsed.destination, receiver_phone_raw: parsed?.receiver_address?.receiver_phone ?? null }
          : { status: res.status, corpo: text.slice(0, 1200) };
      }
    }

    return new Response(JSON.stringify(probe), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: pendentes, error } = await supabase
    .from("dropship_orders")
    .select("id, ml_order_id, user_id, customer_document, customer_phone, customer_email")
    .eq("source", "mercadolivre")
    .not("ml_order_id", "is", null)
    .is("customer_document", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let atualizados = 0;
  let semDados = 0;
  const amostra: Json[] = [];

  for (const pedido of pendentes ?? []) {
    const { data: order } = await supabase
      .from("orders")
      .select("raw, shipment_id")
      .eq("ml_order_id", String(pedido.ml_order_id))
      .maybeSingle();

    const details = await fetchBuyerDetails(supabase, {
      mlOrderId: String(pedido.ml_order_id),
      userId: String(pedido.user_id),
      mlOrder: (order?.raw as Json) ?? null,
      shipmentId: order?.shipment_id ? String(order.shipment_id) : null,
    });

    if (amostra.length < 3) {
      amostra.push({
        ml_order_id: pedido.ml_order_id,
        tem_documento: Boolean(details.document),
        tem_telefone: Boolean(details.phone),
        tem_email: Boolean(details.email),
      });
    }

    if (!details.document && !details.phone && !details.email) {
      semDados++;
      continue;
    }

    if (!dryRun) {
      await supabase
        .from("dropship_orders")
        .update({
          ...(details.document ? { customer_document: details.document } : {}),
          ...(details.phone ? { customer_phone: details.phone } : {}),
          ...(details.email ? { customer_email: details.email } : {}),
          ...(details.name ? { customer_name: details.name } : {}),
          ...(details.receiverAddress ? { shipping_address: details.receiverAddress } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", pedido.id);
    }
    atualizados++;
  }

  const resultado = {
    analisados: pendentes?.length ?? 0,
    atualizados,
    sem_dados_no_ml: semDados,
    dry_run: dryRun,
    amostra,
  };
  console.log("[backfill-buyer]", JSON.stringify(resultado));

  return new Response(JSON.stringify(resultado), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
