// CHECKOUT TRANSPARENTE DA VELO (ValidaPay).
// O cliente paga dentro do nosso domínio: nós coletamos os dados e chamamos
// POST /v1/charges (Pix ou cartão) via API. Nada de checkout hospedado —
// por isso a marca/logo da página é 100% nossa.
//
// Ações:
//  - action="create": cria a cobrança (pix => EMV + QR; cartão => aprovação na hora)
//  - action="status": consulta a cobrança e ativa a assinatura se já foi paga
//    (rede de segurança para quando o webhook atrasa)
//
// Dados de cartão NUNCA são gravados nem logados: são repassados direto ao
// gateway na mesma requisição e descartados.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  createTransparentCharge,
  isConfirmedPayment,
  lookupPaymentStatus,
  ValidaPayError,
} from "../_shared/validapay.ts";
import { validateCoupon } from "../_shared/coupons.ts";

const PRICE_ENV: Record<string, Record<string, string>> = {
  monthly: {
    base: "VALIDAPAY_PRICE_BASE",
    pro: "VALIDAPAY_PRICE_PRO",
    business: "VALIDAPAY_PRICE_BUSINESS",
  },
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

const onlyDigits = (v: unknown) => String(v ?? "").replace(/\D/g, "");

type Body = {
  action?: "create" | "status";
  plan?: string;
  cycle?: string;
  paymentMethod?: string;
  coupon?: string;
  affiliate_code?: string;
  chargeId?: string;
  installments?: number;
  customer?: { name?: string; email?: string; document?: string; phone?: string; cep?: string };
  card?: { number?: string; cvv?: string; name?: string; expiration?: string };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

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
    const userEmail = (claimsData.claims.email as string | undefined) ?? undefined;

    let body: Body = {};
    try {
      body = await req.json();
    } catch {
      /* corpo vazio */
    }

    // ---------------------------------------------------------------- STATUS
    if (body.action === "status") {
      const chargeId = String(body.chargeId ?? "").trim();
      if (!chargeId) return json({ error: "chargeId é obrigatório" }, 400);

      const { data: sub } = await admin
        .from("subscriptions")
        .select("id,plan,status,user_id")
        .eq("user_id", userId)
        .eq("validapay_charge_id", chargeId)
        .maybeSingle();
      if (!sub) return json({ error: "Cobrança não encontrada" }, 404);
      if (sub.status === "active") return json({ paid: true, plan: sub.plan });

      const info = await lookupPaymentStatus(chargeId);
      if (!isConfirmedPayment(info)) {
        return json({ paid: false, status: info?.status ?? "PENDING" });
      }

      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      await admin
        .from("subscriptions")
        .update({
          status: "active",
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("id", sub.id);
      await admin.from("profiles").update({ plano: sub.plan }).eq("user_id", userId);
      return json({ paid: true, plan: sub.plan });
    }

    // ---------------------------------------------------------------- CREATE
    const plan = String(body.plan ?? "").toLowerCase();
    const cycle = String(body.cycle ?? "monthly").toLowerCase() === "annual" ? "annual" : "monthly";
    const method = String(body.paymentMethod ?? "pix").toLowerCase() === "creditcard"
      ? "creditcard"
      : "pix";
    const priceEnv = PRICE_ENV[cycle][plan];
    if (!priceEnv) return json({ error: "Plano inválido. Use base, pro ou business." }, 400);
    const priceId = Deno.env.get(priceEnv);
    if (!priceId) return json({ error: `Preço do plano ${plan} (${cycle}) não configurado.` }, 500);

    const name = String(body.customer?.name ?? "").trim();
    const document = onlyDigits(body.customer?.document);
    const phone = onlyDigits(body.customer?.phone);
    const email = String(body.customer?.email ?? userEmail ?? "").trim();
    if (name.length < 3) return json({ error: "Informe seu nome completo." }, 400);
    if (document.length !== 11 && document.length !== 14) {
      return json({ error: "Informe um CPF ou CNPJ válido." }, 400);
    }
    if (!email) return json({ error: "Informe um e-mail válido." }, 400);

    if (method === "creditcard") {
      const number = onlyDigits(body.card?.number);
      const cvv = onlyDigits(body.card?.cvv);
      const expiration = String(body.card?.expiration ?? "").trim();
      if (number.length < 13 || cvv.length < 3 || !/^\d{2}\/\d{4}$/.test(expiration)) {
        return json({ error: "Dados do cartão incompletos ou inválidos." }, 400);
      }
    }

    // Afiliado (opcional)
    let affiliateCode: string | null = null;
    const rawAffiliate = String(body.affiliate_code ?? "").trim().toUpperCase();
    if (rawAffiliate && /^[A-Z0-9_-]{3,32}$/.test(rawAffiliate)) {
      const { data: affiliate } = await admin
        .from("affiliates")
        .select("code")
        .eq("code", rawAffiliate)
        .eq("is_active", true)
        .maybeSingle();
      affiliateCode = affiliate?.code ?? null;
    }

    const baseAmount = PLAN_AMOUNT[cycle][plan] ?? 0;
    const couponResult = body.coupon
      ? validateCoupon(String(body.coupon), plan, cycle, baseAmount)
      : null;
    const coupon = couponResult?.ok ? couponResult : null;

    // Antifraude: nunca abrir cobrança nova se já existe assinatura ativa.
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

    // Pendências recentes já pagas (webhook atrasado) => libera sem cobrar de novo.
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
        return json({
          alreadyActive: true,
          plan: p.plan,
          error: "Encontramos um pagamento seu já confirmado. Seu plano foi liberado — não é preciso pagar de novo.",
        }, 409);
      } catch (err) {
        console.error("transparent-charge: falha ao verificar pendência", String(err));
      }
    }

    const externalId = `velo-${userId.slice(0, 8)}-${plan}-${cycle}-${Date.now()}`;
    const payload: Record<string, unknown> = {
      paymentMethod: method,
      externalId,
      customer: {
        name,
        email,
        documentNumber: document,
        ...(phone ? { phone: `+55${phone}` } : {}),
        ...(body.customer?.cep ? { cep: onlyDigits(body.customer.cep) } : {}),
      },
      items: [{ priceId, quantity: 1 }],
      ...(coupon ? { couponCode: coupon.coupon.code } : {}),
      metadata: {
        user_id: userId,
        plan,
        cycle,
        source: "transparent_checkout",
        ...(affiliateCode ? { affiliate_code: affiliateCode } : {}),
        ...(coupon ? { coupon_code: coupon.coupon.code } : {}),
      },
      ...(method === "creditcard"
        ? {
            card: {
              number: onlyDigits(body.card?.number),
              cvv: onlyDigits(body.card?.cvv),
              name: String(body.card?.name ?? name).toUpperCase(),
              expiration: String(body.card?.expiration ?? "").trim(),
            },
            installments: Math.min(Math.max(Number(body.installments ?? 1) || 1, 1), 12),
            freeInstallments: 1,
            passFeesToCustomer: false,
          }
        : { expiration: new Date(Date.now() + 24 * 3600_000).toISOString().slice(0, 10) }),
    };

    const charge = await createTransparentCharge(payload);
    console.log("transparent-charge criada", {
      userId,
      plan,
      cycle,
      method,
      chargeId: charge.chargeId,
      status: charge.status,
    });

    const paidNow = ["PAID", "APPROVED", "CONFIRMED", "SUCCEEDED"].includes(charge.status);
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await admin.from("subscriptions").insert({
      user_id: userId,
      plan,
      status: paidNow ? "active" : "pending",
      provider: "validapay",
      payment_method: method === "creditcard" ? "credit_card" : "pix",
      amount: coupon ? coupon.total : baseAmount,
      ...(coupon ? { discount_percent: coupon.coupon.percentOff, original_amount: baseAmount } : {}),
      validapay_charge_id: charge.chargeId,
      ...(paidNow
        ? {
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
          }
        : {}),
    });

    if (paidNow) {
      await admin.from("profiles").update({ plano: plan }).eq("user_id", userId);
    }

    if (method === "creditcard" && !paidNow) {
      return json({
        error: "Pagamento não aprovado pelo banco emissor. Tente outro cartão ou pague com Pix.",
        chargeId: charge.chargeId,
        status: charge.status,
      }, 402);
    }

    return json({
      chargeId: charge.chargeId,
      status: charge.status,
      paid: paidNow,
      method,
      amount: coupon ? coupon.total : baseAmount,
      pix: charge.pix,
    });
  } catch (err) {
    const message = err instanceof ValidaPayError
      ? err.message
      : err instanceof Error
        ? err.message
        : String(err);
    console.error("validapay-transparent-charge erro", message);
    const status = err instanceof ValidaPayError && err.status === 402 ? 402 : 500;
    return json({ error: `Pagamento indisponível: ${message}` }, status);
  }
});
