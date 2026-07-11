import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const userEmail = claimsData.claims.email as string;

    const body = await req.json();
    const { plan, payment_method, affiliate_ref, plan_price, trial } = body;

    if (!plan || !payment_method) {
      return new Response(JSON.stringify({ error: "plan e payment_method são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const MP_ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!MP_ACCESS_TOKEN) {
      throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado");
    }

    const plans: Record<string, { amount: number; description: string }> = {
      pro: { amount: 99.90, description: "Velo Pro" },
      business: { amount: 149.90, description: "Velo Business" },
    };

    const basePlan = plans[plan];
    if (!basePlan) {
      return new Response(JSON.stringify({ error: "Plano inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Trial pago de teste: cobra R$1,00 hoje e, no dia 5, passa a cobrar o valor do plano (R$99,90 Pro).
    // Trial só é permitido no plano Pro. Business vai direto no valor cheio.
    const isTrial = Boolean(trial) && plan === "pro";
    const TRIAL_AMOUNT = 29.9;
    const TRIAL_DAYS = 5;
    const selectedPlan = isTrial
      ? { amount: TRIAL_AMOUNT, description: "Velo — Trial de publicação (5 dias)" }
      : basePlan;

    // === COOLDOWN ANTI-ABUSO (pós-reembolso) ===
    {
      const dbUrl = Deno.env.get("DB_URL") ?? Deno.env.get("SUPABASE_URL")!;
      const dbKey = Deno.env.get("DB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminCd = createClient(dbUrl, dbKey);
      const { data: profCd } = await adminCd
        .from("profiles")
        .select("refund_cooldown_until")
        .eq("user_id", userId)
        .maybeSingle();
      if (profCd?.refund_cooldown_until && new Date(profCd.refund_cooldown_until) > new Date()) {
        const until = new Date(profCd.refund_cooldown_until).toLocaleDateString("pt-BR");
        return new Response(JSON.stringify({
          error: `Reembolso recente detectado. Você poderá assinar um novo plano a partir de ${until}.`,
          cooldown_until: profCd.refund_cooldown_until,
        }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Create Mercado Pago payment
    const cleanAffiliateRef =
      typeof affiliate_ref === "string"
        ? affiliate_ref.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32)
        : null;

    const mpPayload: Record<string, unknown> = {
      transaction_amount: selectedPlan.amount,
      description: selectedPlan.description,
      payment_method_id: payment_method === "pix" ? "pix" : undefined,
      payer: {
        email: userEmail,
      },
      external_reference: cleanAffiliateRef || undefined,
      metadata: {
        user_id: userId,
        plan: plan,
        affiliate_ref: cleanAffiliateRef || undefined,
        plan_price: typeof plan_price === "number" ? plan_price : selectedPlan.amount,
        is_trial: isTrial,
        trial_days: isTrial ? TRIAL_DAYS : undefined,
        post_trial_amount: isTrial ? basePlan.amount : undefined,
      },
    };

    // For credit card, we need token from frontend
    if (payment_method === "credit_card") {
      const { card_token, installments, issuer_id } = body;
      if (!card_token) {
        return new Response(JSON.stringify({ error: "card_token obrigatório para cartão" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      mpPayload.token = card_token;
      mpPayload.installments = installments || 1;
      mpPayload.issuer_id = issuer_id;
      delete mpPayload.payment_method_id;
    }

    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `${userId}-${plan}-${Date.now()}`,
      },
      body: JSON.stringify(mpPayload),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("MP error:", JSON.stringify(mpData));
      return new Response(JSON.stringify({ error: "Erro ao processar pagamento", details: mpData }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save subscription
    // Hybrid deployment: DB may live on a different project than the functions
    const dbUrl = Deno.env.get("DB_URL") ?? Deno.env.get("SUPABASE_URL")!;
    const dbKey = Deno.env.get("DB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(dbUrl, dbKey);

    const now = new Date();
    const periodEnd = new Date(now);
    if (isTrial) {
      periodEnd.setDate(periodEnd.getDate() + TRIAL_DAYS);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const subStatus = mpData.status === "approved" ? (isTrial ? "trialing" : "active") : "pending";

    // Se foi trial pago com cartão aprovado, salvar cliente + cartão no Mercado Pago
    // para permitir a cobrança automática do plano Pro no dia 5 (via mp-charge-trial).
    let savedCustomerId: string | null = null;
    let savedCardId: string | null = null;
    if (isTrial && payment_method === "credit_card" && mpData.status === "approved") {
      try {
        const searchResp = await fetch(
          `https://api.mercadopago.com/v1/customers/search?email=${encodeURIComponent(userEmail)}`,
          { headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` } },
        );
        const searchData = await searchResp.json();
        savedCustomerId = searchData?.results?.[0]?.id ?? null;
        if (!savedCustomerId) {
          const createResp = await fetch("https://api.mercadopago.com/v1/customers", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ email: userEmail }),
          });
          const createData = await createResp.json();
          savedCustomerId = createData?.id ?? null;
        }
        if (savedCustomerId && mpData.card?.id) {
          savedCardId = String(mpData.card.id);
        } else if (savedCustomerId && body?.card_token) {
          const cardResp = await fetch(
            `https://api.mercadopago.com/v1/customers/${savedCustomerId}/cards`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ token: body.card_token }),
            },
          );
          const cardData = await cardResp.json();
          savedCardId = cardData?.id ? String(cardData.id) : null;
        }
      } catch (e) {
        console.error("Falha ao salvar cartão MP para trial:", e);
      }
    }

    await adminClient.from("subscriptions").upsert({
      user_id: userId,
      plan: plan,
      status: subStatus,
      mp_payment_id: String(mpData.id),
      payment_method: payment_method,
      amount: selectedPlan.amount,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      is_trial: isTrial,
      trial_ends_at: isTrial ? periodEnd.toISOString() : null,
      next_charge_amount: isTrial ? basePlan.amount : null,
      next_charge_at: isTrial ? periodEnd.toISOString() : null,
      post_trial_plan: isTrial ? plan : null,
      mp_customer_id: savedCustomerId,
      mp_card_id: savedCardId,
      charge_attempts: 0,
      last_charge_attempt_at: null,
      last_dunning_email_at: null,
      updated_at: now.toISOString(),
    }, { onConflict: "user_id" });

    // Update profile plan if approved
    if (mpData.status === "approved") {
      await adminClient.from("profiles").update({ plano: plan }).eq("user_id", userId);
    }

    // Build response
    const result: Record<string, unknown> = {
      status: mpData.status,
      payment_id: mpData.id,
      plan: plan,
    };

    // PIX: return QR code data
    if (payment_method === "pix" && mpData.point_of_interaction?.transaction_data) {
      result.pix_qr_code = mpData.point_of_interaction.transaction_data.qr_code;
      result.pix_qr_code_base64 = mpData.point_of_interaction.transaction_data.qr_code_base64;
      result.pix_copy_paste = mpData.point_of_interaction.transaction_data.qr_code;
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Checkout error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
