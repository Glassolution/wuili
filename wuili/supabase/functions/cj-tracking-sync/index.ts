/**
 * cj-tracking-sync
 * ----------------
 * Polls CJ for tracking updates on all orders with fulfillment_status = 'processing'.
 * Updates tracking_code, status, and fulfillment_status in the orders table.
 * When a new tracking code is found, notifies the ML buyer via PUT /shipments/{id}.
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

function extractBalance(payload: unknown): number {
  const raw = payload as any;
  const data = raw?.data ?? raw;
  const candidates = [
    data?.balance,
    data?.availableBalance,
    data?.available_balance,
    data?.amount,
    data?.walletBalance,
    data?.accountBalance,
    Array.isArray(data) ? data[0]?.balance : undefined,
    Array.isArray(data) ? data[0]?.availableBalance : undefined,
  ];

  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return 0;
}

async function getCjBalance(cjToken: string): Promise<number> {
  const balanceRes = await fetch(
    "https://developers.cjdropshipping.com/api2.0/v1/account/balance",
    { headers: { "CJ-Access-Token": cjToken } }
  );
  const balanceData = await balanceRes.json().catch(() => null);

  if (!balanceRes.ok) {
    throw new Error(balanceData?.message ?? balanceData?.msg ?? `Erro ao consultar saldo CJ (${balanceRes.status})`);
  }

  return extractBalance(balanceData);
}

async function retryAwaitingPaymentOrders(
  adminClient: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceRoleKey: string,
  cjToken: string
): Promise<{ checked: number; retried: number; skipped: number }> {
  const { data: orders, error } = await adminClient
    .from("orders")
    .select("id, cost_price")
    .eq("status", "awaiting_payment")
    .eq("fulfillment_status", "awaiting_payment")
    .not("cj_variant_id", "is", null);

  if (error) throw error;
  if (!orders || orders.length === 0) return { checked: 0, retried: 0, skipped: 0 };

  let availableBalance = 0;
  try {
    availableBalance = await getCjBalance(cjToken);
  } catch (balanceErr) {
    console.warn("[cj-tracking-sync] balance check for awaiting_payment failed:", balanceErr);
    return { checked: orders.length, retried: 0, skipped: orders.length };
  }

  let retried = 0;
  let skipped = 0;

  for (const order of orders) {
    const estimatedCost = Number(order.cost_price ?? 0);
    if (estimatedCost > 0 && availableBalance < estimatedCost) {
      skipped++;
      continue;
    }

    try {
      const fulfillRes = await fetch(`${supabaseUrl}/functions/v1/cj-fulfill`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ order_id: order.id }),
      });
      const fulfillData = await fulfillRes.json().catch(() => ({}));

      if (fulfillRes.ok && fulfillData?.success !== false) {
        retried++;
        availableBalance = Math.max(availableBalance - estimatedCost, 0);
      } else {
        skipped++;
        console.warn("[cj-tracking-sync] retry fulfillment failed:", order.id, JSON.stringify(fulfillData));
      }
    } catch (fulfillErr) {
      skipped++;
      console.error("[cj-tracking-sync] retry fulfillment error:", order.id, fulfillErr);
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  return { checked: orders.length, retried, skipped };
}

// ── ML Token helpers ───────────────────────────────────────────────────────────

type MLIntegration = {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
};

async function refreshMLToken(
  adminClient: ReturnType<typeof createClient>,
  integration: MLIntegration
): Promise<string | null> {
  try {
    const res = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "refresh_token",
        client_id:     Deno.env.get("ML_CLIENT_ID")!,
        client_secret: Deno.env.get("ML_CLIENT_SECRET")!,
        refresh_token: integration.refresh_token,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!data?.access_token) return null;

    await adminClient
      .from("user_integrations")
      .update({
        access_token:  data.access_token,
        refresh_token: data.refresh_token ?? integration.refresh_token,
        expires_at:    new Date(Date.now() + (data.expires_in ?? 21600) * 1000).toISOString(),
        updated_at:    new Date().toISOString(),
      })
      .eq("user_id", integration.user_id)
      .eq("platform", "mercadolivre");

    return data.access_token as string;
  } catch (e) {
    console.error("[cj-tracking-sync] refreshMLToken error:", e);
    return null;
  }
}

// ── Send tracking code to ML buyer via shipment API ───────────────────────────

async function sendTrackingToML(
  adminClient: ReturnType<typeof createClient>,
  orderId: string,
  mlOrderId: string,
  userId: string,
  trackingNumber: string
): Promise<void> {
  try {
    // 1. Get ML integration for this user
    const { data: integration } = await adminClient
      .from("user_integrations")
      .select("access_token, refresh_token, expires_at")
      .eq("user_id", userId)
      .eq("platform", "mercadolivre")
      .maybeSingle();

    if (!integration?.access_token) {
      console.warn(`[cj-tracking-sync] no ML integration for user ${userId}, skipping ML notification`);
      return;
    }

    // 2. Refresh token if expired
    let accessToken: string = integration.access_token;
    if (new Date(integration.expires_at) <= new Date()) {
      const refreshed = await refreshMLToken(adminClient, { ...integration, user_id: userId });
      if (!refreshed) {
        console.warn(`[cj-tracking-sync] could not refresh ML token for user ${userId}`);
        return;
      }
      accessToken = refreshed;
    }

    // 3. Fetch ML order to get shipment ID
    const mlOrderRes = await fetch(`https://api.mercadolibre.com/orders/${mlOrderId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!mlOrderRes.ok) {
      console.warn(`[cj-tracking-sync] could not fetch ML order ${mlOrderId}: status ${mlOrderRes.status}`);
      return;
    }
    const mlOrder = await mlOrderRes.json().catch(() => null);
    const shipmentId = mlOrder?.shipping?.id;

    if (!shipmentId) {
      console.log(`[cj-tracking-sync] no shipmentId for ML order ${mlOrderId} (pickup or no shipping) — marking sent anyway`);
      await adminClient
        .from("orders")
        .update({ ml_tracking_sent: true, ml_tracking_sent_at: new Date().toISOString() })
        .eq("id", orderId);
      return;
    }

    // 4. Send tracking number to ML shipment
    const shipRes = await fetch(`https://api.mercadolibre.com/shipments/${shipmentId}`, {
      method: "PUT",
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tracking_number: trackingNumber,
        tracking_method: "CJ Dropshipping",
      }),
    });
    const shipData = await shipRes.json().catch(() => null);

    if (!shipRes.ok) {
      console.warn(
        `[cj-tracking-sync] ML shipment update failed for shipment ${shipmentId}:`,
        JSON.stringify(shipData)
      );
      // Don't mark as sent — will retry on next poll
      return;
    }

    // 5. Mark tracking as sent so we don't resend on future polls
    await adminClient
      .from("orders")
      .update({
        ml_tracking_sent:    true,
        ml_tracking_sent_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    console.log(
      `[cj-tracking-sync] tracking ${trackingNumber} sent to ML shipment ${shipmentId} for order ${orderId}`
    );
  } catch (e) {
    console.error(`[cj-tracking-sync] sendTrackingToML error for order ${orderId}:`, e);
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  // Hybrid deployment: DB may live on a different project than the functions
  const dbUrl = Deno.env.get("DB_URL") ?? supabaseUrl;
  const dbKey = Deno.env.get("DB_SERVICE_ROLE_KEY") ?? serviceRoleKey;
  const adminClient    = createClient(dbUrl, dbKey);

  try {
    // ── Get CJ token ─────────────────────────────────────────────────────────
    const authRes  = await fetch(`${supabaseUrl}/functions/v1/cj-auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
    });
    const authData = await authRes.json().catch(() => ({}));
    const cjToken: string | null = authData?.accessToken ?? null;

    if (!cjToken) {
      throw new Error("Falha ao obter token CJ: " + (authData?.error ?? "resposta inválida"));
    }

    const awaitingPayment = await retryAwaitingPaymentOrders(
      adminClient,
      supabaseUrl,
      serviceRoleKey,
      cjToken
    );

    // ── Fetch all orders in 'processing' state ────────────────────────────────
    const { data: orders, error: fetchErr } = await adminClient
      .from("orders")
      .select("id, cj_order_id, tracking_code, external_order_id, user_id, ml_tracking_sent")
      .eq("fulfillment_status", "processing")
      .not("cj_order_id", "is", null);

    if (fetchErr) throw fetchErr;
    if (!orders || orders.length === 0) {
      return new Response(
        JSON.stringify({ success: true, checked: 0, updated: 0, awaiting_payment: awaitingPayment }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[cj-tracking-sync] checking ${orders.length} orders`);

    let updated = 0;

    // ── Poll each order from CJ ───────────────────────────────────────────────
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

        const cjStatus:       string = (detail.data.orderStatus ?? "").toUpperCase();
        const trackingNumber: string =
          detail.data.trackingNumber ?? detail.data.logistics?.trackingNumber ?? "";
        const mapped = CJ_STATUS_MAP[cjStatus];

        const hasNewTracking = Boolean(trackingNumber && trackingNumber !== order.tracking_code);

        // Build update payload — only apply changes
        const patch: Record<string, string | null> = {};

        if (mapped && mapped.fulfillment !== "processing") {
          patch.fulfillment_status = mapped.fulfillment;
          patch.status             = mapped.status;
        }

        if (hasNewTracking) {
          patch.tracking_code = trackingNumber;
          // Mark as shipped the moment we receive a tracking code
          if (!mapped || mapped.fulfillment === "processing") {
            patch.fulfillment_status = "shipped";
            patch.status             = "shipped";
          }
        }

        if (Object.keys(patch).length === 0) {
          // No DB change needed — but check if we still owe ML a tracking notification
          if (order.tracking_code && !order.ml_tracking_sent && order.external_order_id && order.user_id) {
            console.log(`[cj-tracking-sync] retrying ML tracking notification for ${order.id}`);
            await sendTrackingToML(
              adminClient, order.id, order.external_order_id, order.user_id, order.tracking_code
            );
          }
          continue;
        }

        const { error: updateErr } = await adminClient
          .from("orders")
          .update(patch)
          .eq("id", order.id);

        if (updateErr) {
          console.error(`[cj-tracking-sync] update error for ${order.id}:`, updateErr.message);
        } else {
          updated++;
          console.log(`[cj-tracking-sync] updated ${order.id} →`, patch);

          // If a new tracking code was just saved, send it to the ML buyer
          if (hasNewTracking && order.external_order_id && order.user_id && !order.ml_tracking_sent) {
            await sendTrackingToML(
              adminClient, order.id, order.external_order_id, order.user_id, trackingNumber
            );
          }
        }

        // Small delay to avoid hammering the CJ API
        await new Promise((r) => setTimeout(r, 200));

      } catch (orderErr) {
        console.error(`[cj-tracking-sync] error for order ${order.id}:`, orderErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, checked: orders.length, updated, awaiting_payment: awaitingPayment }),
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
