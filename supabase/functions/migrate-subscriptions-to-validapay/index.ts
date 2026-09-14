// Migração de dados das assinaturas do Mercado Pago e do Stripe para a ValidaPay.
// IMPORTANTE: esta função NÃO cria cobranças, não altera o fluxo de pagamento do
// Mercado Pago nem do Stripe e não gera novo período de cobrança. Ela apenas
// reescreve os dados equivalentes apontando para a ValidaPay, preservando os
// identificadores originais (mp_payment_id / stripe_subscription_id) para que o
// estorno continue sendo executado no gateway em que a cobrança realmente ocorreu.
//
// Uso: POST { dry_run: true }  -> apenas o resumo (padrão)
//      POST { dry_run: false } -> grava de verdade
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const REFUND_WINDOW_DAYS = 7;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type SubscriptionRow = {
  id: string;
  user_id: string;
  plan: string | null;
  status: string | null;
  amount: number | null;
  provider: string | null;
  payment_method: string | null;
  mp_payment_id: string | null;
  mp_subscription_id: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  next_charge_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  migrated_to_validapay_at: string | null;
};

const normalizeStatus = (status: string | null): "active" | "cancelled" | "past_due" | "pending" => {
  const value = (status ?? "").toLowerCase();
  if (["active", "trialing", "authorized"].includes(value)) return "active";
  if (["past_due", "unpaid", "overdue"].includes(value)) return "past_due";
  if (["cancelled", "canceled", "refunded", "expired"].includes(value)) return "cancelled";
  return "pending";
};

const originOf = (row: SubscriptionRow): "mercado_pago" | "stripe" | null => {
  const provider = (row.provider ?? "").toLowerCase();
  if (provider === "stripe" || row.stripe_subscription_id) return "stripe";
  if (provider === "mercadopago" || provider === "mercado_pago" || row.mp_payment_id) {
    return "mercado_pago";
  }
  return null;
};

/** Data efetiva do pagamento original, na melhor fonte disponível. */
const paidAtOf = (row: SubscriptionRow): string | null =>
  row.current_period_start ?? row.updated_at ?? row.created_at ?? null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(
    authHeader.replace("Bearer ", ""),
  );
  if (claimsError || !claimsData?.claims) return json({ error: "Não autenticado" }, 401);

  const { data: isAdmin } = await admin.rpc("is_admin", {
    _user_id: claimsData.claims.sub as string,
  });
  if (!isAdmin) return json({ error: "Apenas administradores" }, 403);

  let body: { dry_run?: boolean; limit?: number } = {};
  try {
    body = await req.json();
  } catch {
    /* corpo vazio = dry-run */
  }
  const dryRun = body.dry_run !== false;
  const limit = Math.min(Math.max(Number(body.limit ?? 1000), 1), 5000);

  const { data: rows, error } = await admin
    .from("subscriptions")
    .select(
      "id,user_id,plan,status,amount,provider,payment_method,mp_payment_id,mp_subscription_id," +
        "stripe_subscription_id,stripe_customer_id,current_period_start,current_period_end," +
        "next_charge_at,created_at,updated_at,migrated_to_validapay_at",
    )
    .in("provider", ["mercadopago", "mercado_pago", "stripe"])
    .is("migrated_to_validapay_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("migrate-subscriptions: erro ao ler assinaturas", error);
    return json({ error: error.message }, 500);
  }

  const now = Date.now();
  const summary = {
    dry_run: dryRun,
    total_candidatas: rows?.length ?? 0,
    por_origem: { mercado_pago: 0, stripe: 0 },
    por_status: { active: 0, cancelled: 0, past_due: 0, pending: 0 } as Record<string, number>,
    reembolsaveis: 0,
    ignoradas: 0,
    migradas: 0,
    erros: [] as { subscription_id: string; message: string }[],
  };

  const preview: Record<string, unknown>[] = [];

  for (const row of (rows ?? []) as SubscriptionRow[]) {
    const origin = originOf(row);
    if (!origin) {
      summary.ignoradas += 1;
      continue;
    }

    const status = normalizeStatus(row.status);
    const paidAt = paidAtOf(row);
    const originPaymentId = origin === "stripe"
      ? row.stripe_subscription_id
      : (row.mp_payment_id ?? row.mp_subscription_id);

    // Janela de reembolso: só cobranças do Mercado Pago, com pagamento
    // identificado e dentro de 7 dias corridos da data do pagamento original.
    const refundableUntil = paidAt
      ? new Date(new Date(paidAt).getTime() + REFUND_WINDOW_DAYS * 86_400_000)
      : null;
    const refundable = origin === "mercado_pago" &&
      Boolean(row.mp_payment_id) &&
      Boolean(refundableUntil) &&
      refundableUntil!.getTime() > now;

    summary.por_origem[origin] += 1;
    summary.por_status[status] += 1;
    if (refundable) summary.reembolsaveis += 1;

    if (preview.length < 20) {
      preview.push({
        subscription_id: row.id,
        origem: origin,
        plano: row.plan,
        status,
        pago_em: paidAt,
        renovacao: row.current_period_end ?? row.next_charge_at,
        reembolsavel: refundable,
        reembolsavel_ate: refundableUntil?.toISOString() ?? null,
      });
    }

    if (dryRun) continue;

    // Grava: mesma assinatura passa a apontar para a ValidaPay, mantendo
    // plano, status e a MESMA data de renovação (sem novo período/cobrança).
    const migratedAt = new Date().toISOString();
    const { error: updateError } = await admin
      .from("subscriptions")
      .update({
        provider: "validapay",
        origin_provider: origin,
        origin_payment_id: originPaymentId,
        origin_paid_at: paidAt,
        refundable_until: refundable ? refundableUntil!.toISOString() : null,
        migrated_to_validapay_at: migratedAt,
        updated_at: migratedAt,
      })
      .eq("id", row.id)
      .is("migrated_to_validapay_at", null);

    if (updateError) {
      summary.erros.push({ subscription_id: row.id, message: updateError.message });
      continue;
    }

    const { error: auditError } = await admin.from("subscription_migrations").upsert(
      {
        subscription_id: row.id,
        user_id: row.user_id,
        origin_provider: origin,
        origin_payment_id: originPaymentId,
        origin_subscription_id: origin === "stripe"
          ? row.stripe_subscription_id
          : row.mp_subscription_id,
        plan: row.plan ?? "base",
        status,
        amount: Number(row.amount ?? 0),
        origin_paid_at: paidAt,
        current_period_end: row.current_period_end ?? row.next_charge_at,
        refundable,
        refundable_until: refundable ? refundableUntil!.toISOString() : null,
        notes: `migrado de ${origin} sem nova cobrança`,
        updated_at: migratedAt,
      },
      { onConflict: "subscription_id" },
    );

    if (auditError) {
      summary.erros.push({ subscription_id: row.id, message: auditError.message });
      continue;
    }

    summary.migradas += 1;
  }

  console.log("migrate-subscriptions-to-validapay", JSON.stringify(summary));
  return json({ ...summary, amostra: preview });
});
