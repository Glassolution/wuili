import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLAN_AMOUNT: Record<string, Record<string, number>> = {
  monthly: { base: 39.9, pro: 79.8, business: 159.6 },
  annual: { base: 430.92, pro: 861.84, business: 1723.68 },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const addBillingPeriod = (cycle: "monthly" | "annual") => {
  const date = new Date();
  if (cycle === "annual") date.setFullYear(date.getFullYear() + 1);
  else date.setMonth(date.getMonth() + 1);
  return date.toISOString();
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsError || !claimsData?.claims) return json({ error: "Não autenticado" }, 401);

    const userId = claimsData.claims.sub as string;
    const body = await req.json().catch(() => ({}));
    const plan = String(body?.plan ?? "").toLowerCase();
    const cycle = String(body?.cycle ?? "monthly").toLowerCase() === "annual" ? "annual" : "monthly";

    if (!PLAN_AMOUNT[cycle][plan]) {
      return json({ error: "Plano inválido. Use base, pro ou business." }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: profile } = await admin
      .from("profiles")
      .select("is_admin")
      .eq("user_id", userId)
      .maybeSingle();
    let isAdmin = profile?.is_admin === true;

    if (!isAdmin) {
      const { data: role } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      isAdmin = role?.role === "admin";
    }

    if (!isAdmin) return json({ error: "Sandbox disponível apenas para administradores." }, 403);

    const now = new Date().toISOString();
    const periodEnd = addBillingPeriod(cycle);
    const sandboxId = `sandbox_${crypto.randomUUID()}`;
    const amount = PLAN_AMOUNT[cycle][plan];

    await admin
      .from("subscriptions")
      .update({
        status: "cancelled",
        cancel_at_period_end: true,
        cancelled_at: now,
        cancellation_reason: "Sandbox renovado",
        updated_at: now,
      })
      .eq("user_id", userId)
      .eq("provider", "sandbox")
      .in("status", ["active", "paid", "approved", "trialing"]);

    const { data: subscription, error: insertError } = await admin
      .from("subscriptions")
      .insert({
        user_id: userId,
        plan,
        status: "active",
        amount,
        original_amount: amount,
        next_charge_amount: amount,
        provider: "sandbox",
        payment_method: "sandbox",
        mp_payment_id: sandboxId,
        validapay_charge_id: sandboxId,
        validapay_subscription_id: sandboxId,
        origin_provider: "sandbox",
        origin_payment_id: sandboxId,
        origin_paid_at: now,
        current_period_start: now,
        current_period_end: periodEnd,
        next_charge_at: periodEnd,
        refundable_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        cancel_at_period_end: false,
        is_trial: false,
        updated_at: now,
      })
      .select("*")
      .single();

    if (insertError) return json({ error: insertError.message }, 500);

    return json({
      success: true,
      subscription,
      message: "Assinatura sandbox ativada sem cobrança.",
    });
  } catch (err) {
    console.error("admin-sandbox-subscription error:", err);
    return json({ error: "Erro interno", message: String(err) }, 500);
  }
});
