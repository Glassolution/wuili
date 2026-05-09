import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

type FulfillRequest = {
  order_id?: string;
};

// ── Notification helper ───────────────────────────────────────────────────────

async function createNotification(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  type: string,
  title: string,
  message: string,
  actionUrl?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminClient as any).from("notifications").insert({
      user_id:  userId,
      type,
      title,
      message,
      action_url: actionUrl ?? null,
      read:     false,
      metadata: metadata ?? null,
    });
  } catch (e) {
    console.error("[cj-fulfill] createNotification error:", e);
  }
}

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

async function getCjBalance(cjAccessToken: string): Promise<number> {
  const balanceRes = await fetch(
    "https://developers.cjdropshipping.com/api2.0/v1/account/balance",
    { headers: { "CJ-Access-Token": cjAccessToken } }
  );
  const balanceData = await balanceRes.json().catch(() => null);

  if (!balanceRes.ok) {
    throw new Error(balanceData?.message ?? balanceData?.msg ?? `Erro ao consultar saldo CJ (${balanceRes.status})`);
  }

  return extractBalance(balanceData);
}

async function markAwaitingPayment(
  adminClient: ReturnType<typeof createClient>,
  order: any,
  orderId: string,
  availableBalance: number,
  estimatedCost: number
): Promise<void> {
  const message =
    `Saldo CJ insuficiente. Disponível: $${availableBalance.toFixed(2)}. ` +
    `Necessário: $${estimatedCost.toFixed(2)}`;

  await adminClient
    .from("orders")
    .update({
      status: "awaiting_payment",
      fulfillment_status: "awaiting_payment",
      fulfillment_error: message,
    })
    .eq("id", orderId);

  await createNotification(
    adminClient,
    order.user_id,
    "warning",
    "Saldo insuficiente na CJ",
    "Você tem um pedido aguardando envio. Recarregue sua conta na CJ Dropshipping para processar automaticamente.",
    "https://cjdropshipping.com/wallet.html",
    { order_id: orderId, required: estimatedCost, available: availableBalance }
  );
}

// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Método não permitido" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const internalSecret = Deno.env.get("INTERNAL_SECRET");
    const requestSecret = req.headers.get("x-internal-secret");
    if (!internalSecret || requestSecret !== internalSecret) {
      return new Response(JSON.stringify({ success: false, error: "Acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { order_id }: FulfillRequest = await req.json();
    if (!order_id) {
      return new Response(JSON.stringify({ success: false, error: "order_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl    = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados");
    }

    // Hybrid deployment: DB may live on a different project than the functions
    const dbUrl = Deno.env.get("DB_URL") ?? supabaseUrl;
    const dbKey = Deno.env.get("DB_SERVICE_ROLE_KEY") ?? serviceRoleKey;
    const adminClient = createClient(dbUrl, dbKey);

    // ── Get fresh CJ access token via cj-auth (auto-caches + auto-refreshes) ─
    const authRes = await fetch(`${supabaseUrl}/functions/v1/cj-auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${serviceRoleKey}`,
        "x-internal-secret": internalSecret,
      },
    });
    const authData = await authRes.json().catch(() => ({}));
    const cjAccessToken: string | null = authData?.accessToken ?? null;

    if (!cjAccessToken) {
      const message = "Falha ao obter token CJ: " + (authData?.error ?? "resposta inválida");
      await adminClient.from("orders")
        .update({ fulfillment_status: "error", fulfillment_error: message })
        .eq("id", order_id);
      return new Response(JSON.stringify({ success: false, error: message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Load order ────────────────────────────────────────────────────────────
    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .maybeSingle();

    if (orderError || !order) {
      const message = orderError?.message ?? "Pedido não encontrado";
      await adminClient
        .from("orders")
        .update({ fulfillment_status: "error", fulfillment_error: message })
        .eq("id", order_id);
      return new Response(JSON.stringify({ success: false, error: message }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!order.cj_variant_id) {
      const message = "Pedido sem cj_variant_id";
      await adminClient
        .from("orders")
        .update({ fulfillment_status: "error", fulfillment_error: message })
        .eq("id", order_id);
      return new Response(JSON.stringify({ success: false, error: message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Check CJ wallet balance before placing order ───────────────────────
    try {
      const availableBalance = await getCjBalance(cjAccessToken);
      const estimatedCost    = Number(order.cost_price ?? 0);

      if (estimatedCost > 0 && availableBalance < estimatedCost) {
        await markAwaitingPayment(adminClient, order, order_id, availableBalance, estimatedCost);

        return new Response(JSON.stringify({ success: false, error: "Saldo insuficiente na CJ", awaiting_payment: true }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (balanceErr) {
      // Balance check is best-effort; don't abort fulfillment on API failure
      console.warn("[cj-fulfill] balance check failed (non-blocking):", balanceErr);
    }

    // ── Build CJ order payload ────────────────────────────────────────────────
    const cjPayload = {
      orderNumber:          order.id,
      shippingZip:          order.buyer_zip          ?? "",
      shippingCountry:      "BR",
      shippingAddress:      order.buyer_address       ?? "",
      shippingCity:         order.buyer_city          ?? "",
      shippingProvince:     order.buyer_state         ?? "",
      shippingCustomerName: order.buyer_name          ?? "",
      shippingPhone:        order.buyer_phone         ?? "",
      products: [
        {
          vid:      order.cj_variant_id,
          quantity: 1,
        },
      ],
    };

    // ── Create order in CJ ────────────────────────────────────────────────────
    const cjRes  = await fetch(
      "https://developers.cjdropshipping.com/api2.0/v1/shopping/order/createOrderV2",
      {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${cjAccessToken}`,
        },
        body: JSON.stringify(cjPayload),
      }
    );

    const cjJson    = await cjRes.json().catch(() => null);
    const cjOrderId = cjJson?.data?.orderId ?? cjJson?.orderId ?? null;

    if (!cjRes.ok || !cjOrderId) {
      const message =
        cjJson?.message ??
        cjJson?.msg     ??
        `Erro CJ (${cjRes.status})`;

      await adminClient
        .from("orders")
        .update({ fulfillment_status: "error", fulfillment_error: message })
        .eq("id", order_id);

      // Notify the seller about the fulfillment failure
      await createNotification(
        adminClient,
        order.user_id,
        "fulfillment_error",
        "Erro ao processar pedido",
        `O pedido ${order.external_order_id ?? order_id} não pôde ser enviado para a CJ: ` +
          `${message}. Acesse Clientes → Entregas para reenviar.`,
        undefined,
        { order_id, error: message }
      );

      return new Response(JSON.stringify({ success: false, error: message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Mark order as processing ──────────────────────────────────────────────
    const { error: updateError } = await adminClient
      .from("orders")
      .update({
        cj_order_id:        String(cjOrderId),
        status:             "processing",
        fulfillment_status: "processing",
        fulfillment_error:  null,
        fulfilled_at:       new Date().toISOString(),
      })
      .eq("id", order_id);

    if (updateError) {
      throw updateError;
    }

    return new Response(JSON.stringify({ success: true, cj_order_id: String(cjOrderId) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    console.error("[cj-fulfill] error:", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
