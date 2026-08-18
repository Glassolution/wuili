// Cria uma sessão de checkout da ValidaPay (assinatura recorrente) para o usuário logado.
// A sessão é de uso único e retorna a URL hospedada da ValidaPay.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createCheckoutSession, isConfirmedPayment, lookupPaymentStatus, ValidaPayError } from "../_shared/validapay.ts";
import { validateCoupon } from "../_shared/coupons.ts";

const PRICE_ENV: Record<string, Record<string, string>> = {
  monthly: {
    base: "VALIDAPAY_PRICE_BASE",
    pro: "VALIDAPAY_PRICE_PRO",
    business: "VALIDAPAY_PRICE_BUSINESS",
  },
  // Anual = mensal x 12 (preços cadastrados na ValidaPay).
  annual: {
    base: "VALIDAPAY_PRICE_BASE_ANNUAL",
    pro: "VALIDAPAY_PRICE_PRO_ANNUAL",
    business: "VALIDAPAY_PRICE_BUSINESS_ANNUAL",
  },
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
    const email = claimsData.claims.email as string | undefined;

    let body: { plan?: string; cycle?: string; affiliate_code?: string; coupon?: string } = {};
    try {
      body = await req.json();
    } catch {
      /* corpo vazio */
    }
    const plan = String(body.plan ?? "").toLowerCase();
    const cycle = String(body.cycle ?? "monthly").toLowerCase() === "annual" ? "annual" : "monthly";
    const priceEnv = PRICE_ENV[cycle][plan];
    if (!priceEnv) return json({ error: "Plano inválido. Use base, pro ou business." }, 400);

    // Código de indicação é OPCIONAL: quem não veio de afiliado simplesmente
    // não envia nada e o checkout segue normalmente.
    let affiliateCode: string | null = null;
    const rawAffiliate = String(body.affiliate_code ?? "").trim().toUpperCase();
    if (rawAffiliate && /^[A-Z0-9_-]{3,32}$/.test(rawAffiliate)) {
      // RLS em `affiliates` só deixa o dono ver o próprio registro; o comprador
      // precisa validar o código de OUTRA pessoa, então essa consulta pontual
      // (uma coluna, filtrada por código) usa service role. O resto segue no
      // client do usuário.
      const affiliateLookup = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { persistSession: false } },
      );
      const { data: affiliate } = await affiliateLookup
        .from("affiliates")
        .select("code")
        .eq("code", rawAffiliate)
        .eq("is_active", true)
        .maybeSingle();
      affiliateCode = affiliate?.code ?? null;
      if (!affiliateCode) {
        console.warn("validapay-checkout: código de afiliado ignorado", rawAffiliate);
      }
    }


    const priceId = Deno.env.get(priceEnv);
    if (!priceId) {
      return json(
        { error: `Preço do plano ${plan} (${cycle}) não configurado (${priceEnv}).` },
        500,
      );
    }

    // Cupom promocional (validação definitiva no servidor). Um cupom inválido
    // para o plano/ciclo escolhido é simplesmente ignorado — nunca bloqueia a compra.
    const baseAmount = PLAN_AMOUNT[cycle][plan] ?? 0;
    const couponResult = body.coupon
      ? validateCoupon(String(body.coupon), plan, cycle, baseAmount)
      : null;
    const coupon = couponResult?.ok ? couponResult : null;
    if (body.coupon && !coupon) {
      console.warn("validapay-checkout: cupom ignorado", body.coupon, plan, cycle);
    }


    const origin = req.headers.get("origin") ?? Deno.env.get("APP_URL") ?? "https://www.velods.com.br";

    // A ValidaPay mantém este caminho como a marca fixa do checkout. O arquivo
    // é uma composição branca com a logo atual, sobrepondo a arte antiga.
    const logoUrl =
      "https://nqzpoioxvbqavrtphtoa.supabase.co/storage/v1/object/public/assets/branding%2Fvalidapay-logo.png";

    const basePayload: Record<string, unknown> = {
      priceId,
      // A ValidaPay coleta os dados pessoais e a forma de pagamento uma única vez.
      items: [{ priceId, quantity: 1 }],
      companyName: "Velo",
      logoUrl,
      companyLogoUrl: logoUrl,
      logo: logoUrl,
      // Identidade Velo: botão preto, mas textos escuros para manter a leitura nítida.
      primaryColor: "#000000",
      secondaryColor: "#FFFFFF",
      fontColor: "#111827",
      successUrl: `${origin}/assinatura/confirmada?plan=${plan}&cycle=${cycle}`,
      failureUrl: `${origin}/dashboard/planos?checkout=falha`,
      // "Voltar para a Velo" no checkout hospedado — enviamos os nomes
      // aceitos pela API para garantir que o link de retorno apareça.
      cancelUrl: `${origin}/dashboard/planos?checkout=cancelado`,
      backUrl: `${origin}/dashboard/planos?checkout=cancelado`,
      returnUrl: `${origin}/dashboard/planos?checkout=cancelado`,
      companyUrl: `${origin}/dashboard/planos`,
      websiteUrl: `${origin}/dashboard/planos`,
      metadata: {
        user_id: userId,
        plan,
        cycle,
        ...(affiliateCode ? { affiliate_code: affiliateCode } : {}),
        ...(coupon ? { coupon_code: coupon.coupon.code } : {}),
      },
      // Desconto só na 1ª cobrança (fromCycle/toCycle = 1).
      ...(coupon
        ? {
            discounts: [
              {
                type: "PERCENTAGE",
                value: coupon.coupon.percentOff,
                fromCycle: 1,
                toCycle: 1,
                durationMonths: 1,
              },
            ],
          }
        : {}),

    };

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Antifraude de cobrança dupla: antes de abrir um novo checkout, confirmamos
    // no gateway se alguma tentativa recente do próprio usuário já foi paga.
    // Sem isso, um webhook atrasado fazia o cliente pagar duas vezes.
    const { data: activeNow } = await admin
      .from("subscriptions")
      .select("plan")
      .eq("user_id", userId)
      .in("status", ["active", "trialing"])
      .limit(1)
      .maybeSingle();
    if (activeNow) {
      await admin.from("profiles").update({ plano: activeNow.plan }).eq("user_id", userId);
      return json({ alreadyActive: true, plan: activeNow.plan, error: "Sua assinatura já está ativa." }, 409);
    }

    const { data: recentPendings } = await admin
      .from("subscriptions")
      .select("id,plan,validapay_charge_id,validapay_subscription_id")
      .eq("user_id", userId)
      .eq("status", "pending")
      .gte("created_at", new Date(Date.now() - 24 * 3600_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(5);

    for (const p of recentPendings ?? []) {
      const reference = p.validapay_charge_id ?? p.validapay_subscription_id;
      if (!reference) continue;
      try {
        const info = await lookupPaymentStatus(reference);
        if (!isConfirmedPayment(info) || !info) continue;

        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        await admin.from("subscriptions").update({
          status: "active",
          provider: "validapay",
          payment_method: (info.paymentMethod ?? "pix").toString().toLowerCase(),
          validapay_charge_id: info.chargeId ?? p.validapay_charge_id,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          updated_at: now.toISOString(),
        }).eq("id", p.id);
        await admin.from("profiles").update({ plano: p.plan }).eq("user_id", userId);
        console.log("validapay-checkout: pagamento anterior já pago, checkout bloqueado", { userId, plan: p.plan });
        return json({ alreadyActive: true, plan: p.plan, error: "Encontramos um pagamento seu já confirmado. Seu plano foi liberado — não é preciso pagar de novo." }, 409);
      } catch (err) {
        console.error("validapay-checkout: falha ao verificar pendência", String(err));
      }
    }

    // A API usa `creditcard` (sem underscore). O valor anterior `credit_card`
    // era ignorado pelo checkout hospedado, por isso apenas o Pix aparecia.
    const session = await createCheckoutSession({
      ...basePayload,
      allowedPaymentMethods: ["pix", "creditcard"],
      maxInstallments: 12,
      freeInstallments: 1,
      passFeesToCustomer: false,
    });

    await admin.from("subscriptions").insert({
      user_id: userId,
      plan,
      status: "pending",
      provider: "validapay",
      payment_method: "pix",
      // `amount` guarda o valor efetivamente cobrado na 1ª cobrança.
      amount: coupon ? coupon.total : baseAmount,
      ...(coupon
        ? { discount_percent: coupon.coupon.percentOff, original_amount: baseAmount }
        : {}),
      validapay_subscription_id: session.id,
    });

    console.log("validapay-checkout: sessão criada", { userId, plan, cycle, sessionId: session.id });
    return json({ url: session.url, sessionId: session.id });
  } catch (err) {
    const message = err instanceof ValidaPayError
      ? `${err.message}`
      : err instanceof Error
        ? err.message
        : String(err);
    console.error("validapay-checkout erro", message);
    return json({ error: `Checkout indisponível: ${message}` }, 500);
  }
});
