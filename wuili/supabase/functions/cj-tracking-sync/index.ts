/**
 * cj-tracking-sync
 * ----------------
 * Polls CJ for tracking updates on all orders with fulfillment_status = 'processing'.
 * Updates tracking_code, status, and fulfillment_status in the orders table.
 *
 * Schedule via Supabase Cron (pg_cron) every 2 hours:
 *   SELECT cron.schedule(
 *     'cj-tracking-sync',
 *     '0 * /2 * * *',
 *     $$
 *       SELECT net.http_post(
 *         url      := 'https://<project>.supabase.co/functions/v1/cj-tracking-sync',
 *         headers  := '{"Authorization":"Bearer <service_role_key>","Content-Type":"application/json"}'::jsonb,
 *         body     := '{}'::jsonb
 *       )
 *     $$
 *   );
 *
 * Can also be called manually via POST with no body.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// CJ order status → internal status mapping
const CJ_STATUS_MAP: Record<string, { status: string; fulfillment: string }> = {
  "CREATED":    { status: "processing", fulfillment: "processing" },
  "IN_PROCESS": { status: "processing", fulfillment: "processing" },
  "SHIPPED":    { status: "shipped",    fulfillment: "shipped"    },
  "TRANSIT":    { status: "shipped",    fulfillment: "shipped"    },
  "DELIVERED":  { status: "delivered",  fulfillment: "delivered"  },
  "CANCELLED":  { status: "cancelled",  fulfillment: "error"      },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient    = createClient(supabaseUrl, serviceRoleKey);

  try {
    // ── Get CJ token ───────────────────────────────────────────────────────
    const authRes  = await fetch(`${supabaseUrl}/functions/v1/cj-auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
    });
    const authData = await authRes.json().catch(() => ({}));
    const cjToken: string | null = authData?.accessToken ?? null;

    if (!cjToken) {
      throw new Error("Falha ao obter token CJ: " + (authData?.error ?? "resposta inválida"));
    }

    // ── Fetch all orders in 'processing' state ─────────────────────────────
    const { data: orders, error: fetchErr } = await adminClient
      .from("orders")
      .select("id, cj_order_id, tracking_code")
      .eq("fulfillment_status", "processing")
      .not("cj_order_id", "is", null);

    if (fetchErr) throw fetchErr;
    if (!orders || orders.length === 0) {
      return new Response(
        JSON.stringify({ success: true, checked: 0, updated: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[cj-tracking-sync] checking ${orders.length} orders`);

    let updated = 0;

    // ── Poll each order from CJ ────────────────────────────────────────────
    for (const order of orders) {
      try {
        const detailRes = await fetch(
          `https://developers.cjdropshipping.com/api2.0/v1/shopping/order/getOrderDetail?orderId=${order.cj_order_id}`,
          { headers: { "CJ-Access-Token": cjToken } }
        );

        const detail = await detailRes.json().catch(() => null);
        if (!detailRes.ok || !detail?.data) {
          console.warn(`[cj-tracking-sync] no detail for cj_order_id=${order.cj_order_id}`);
          continue;
        }

        const cjStatus:      string = (detail.data.orderStatus ?? "").toUpperCase();
        const trackingNumber: string = detail.data.trackingNumber ?? detail.data.logistics?.trackingNumber ?? "";
        const mapped = CJ_STATUS_MAP[cjStatus];

        // Build update payload — only apply changes
        const patch: Record<string, string | null> = {};

        if (mapped && mapped.fulfillment !== "processing") {
          patch.fulfillment_status = mapped.fulfillment;
          patch.status             = mapped.status;
        }

        if (trackingNumber && trackingNumber !== order.tracking_code) {
          patch.tracking_code      = trackingNumber;
          // Mark as shipped once we have a tracking code
          if (!mapped || mapped.fulfillment === "processing") {
            patch.fulfillment_status = "shipped";
            patch.status             = "shipped";
          }
        }

        if (Object.keys(patch).length === 0) continue;

        const { error: updateErr } = await adminClient
          .from("orders")
          .update(patch)
          .eq("id", order.id);

        if (updateErr) {
          console.error(`[cj-tracking-sync] update error for ${order.id}:`, updateErr.message);
        } else {
          updated++;
          console.log(`[cj-tracking-sync] updated ${order.id} →`, patch);
        }

        // Small delay to avoid hammering the CJ API
        await new Promise((r) => setTimeout(r, 200));

      } catch (orderErr) {
        console.error(`[cj-tracking-sync] error for order ${order.id}:`, orderErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, checked: orders.length, updated }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[cj-tracking-sync] fatal error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
