// Reconciliação de pagamentos da Velo (cron a cada 5 min).
//
// Ataca a causa raiz do caso "webhook não chegou => cliente pagou duas vezes":
//  1) Reprocessa eventos de webhook que falharam (fila com backoff).
//  2) Verificação ativa: consulta na ValidaPay o status real de assinaturas
//     travadas em "pending" há mais de alguns minutos, em vez de esperar o
//     webhook, e ativa o acesso se o pagamento já foi confirmado no gateway.
//  3) Roda a detecção/estorno automático de cobranças duplicadas.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCharge, isConfirmedPayment, isPaidStatus, lookupPaymentStatus } from "../_shared/validapay.ts";
import { detectAndRefundDuplicates, logIncident } from "../_shared/paymentGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-cron",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** Verificamos ativamente cobranças pendentes com mais de 45s e menos de 3 dias. */
const PENDING_MIN_AGE_MS = 45_000;

const PENDING_MAX_AGE_MS = 3 * 24 * 3600_000;
const RETRY_BACKOFF_MIN = [1, 5, 15, 60, 180, 360];
const MAX_WEBHOOK_ATTEMPTS = RETRY_BACKOFF_MIN.length;

const addMonths = (d: Date, n: number) => {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  try {
    const bearer = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
    const isCron = req.headers.get("x-internal-cron") === "velo-payments";
    let isAdmin = !!bearer && bearer === serviceKey;

    if (!isAdmin && bearer) {
      try {
        const userClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: `Bearer ${bearer}` } } },
        );
        const { data: claimsData } = await userClient.auth.getClaims(bearer);
        const callerId = claimsData?.claims?.sub as string | undefined;
        if (callerId) {
          const { data: profile } = await admin
            .from("profiles").select("is_admin").eq("user_id", callerId).maybeSingle();
          isAdmin = !!profile?.is_admin;
        }
      } catch (_e) { /* token inválido */ }
    }
    if (!isAdmin && !isCron) return json({ error: "Não autorizado" }, 401);

    const nowIso = new Date().toISOString();
    const result = {
      webhooks_retried: 0,
      webhooks_recovered: 0,
      webhooks_exhausted: 0,
      pending_checked: 0,
      pending_recovered: 0,
      duplicates_refunded: 0,
    };
    const usersToAudit = new Set<string>();

    // ---------------------------------------------------------------
    // 1) Fila de reprocessamento de webhooks que falharam
    // ---------------------------------------------------------------
    const { data: failedEvents } = await admin
      .from("validapay_webhook_events")
      .select("id,event,charge_id,subscription_id,payment_id,amount,attempts,error")
      .eq("processed", false)
      .eq("retry_exhausted", false)
      .not("next_retry_at", "is", null)
      .lte("next_retry_at", nowIso)
      .order("created_at", { ascending: true })
      .limit(25);

    for (const ev of failedEvents ?? []) {
      result.webhooks_retried++;
      const attempts = Number(ev.attempts ?? 0) + 1;
      let recovered = false;

      try {
        const reference = ev.charge_id ?? ev.payment_id ?? ev.subscription_id;
        if (reference) {
          // Só cobrança real confirma pagamento (sessão de checkout não).
          const confirmed = ev.charge_id
            ? isPaidStatus(String((await getCharge(ev.charge_id)).status ?? "").toUpperCase())
            : isConfirmedPayment(await lookupPaymentStatus(reference));

          if (confirmed) {
            recovered = await activateFromReference(admin, {
              chargeId: ev.charge_id,
              subscriptionId: ev.subscription_id,
              amount: ev.amount ? Number(ev.amount) : null,
            }, usersToAudit);
          }
        }
      } catch (err) {
        console.error("payments-reconcile: retry falhou", ev.id, String(err));
      }

      if (recovered) {
        result.webhooks_recovered++;
        await admin.from("validapay_webhook_events")
          .update({ processed: true, error: null, attempts, last_attempt_at: nowIso, next_retry_at: null })
          .eq("id", ev.id);
      } else if (attempts >= MAX_WEBHOOK_ATTEMPTS) {
        result.webhooks_exhausted++;
        await admin.from("validapay_webhook_events")
          .update({ attempts, last_attempt_at: nowIso, next_retry_at: null, retry_exhausted: true })
          .eq("id", ev.id);
        await logIncident(admin, {
          kind: "webhook_retry_exhausted",
          severity: "critical",
          chargeId: ev.charge_id,
          amount: ev.amount ? Number(ev.amount) : null,
          message: `Webhook ${ev.event} falhou ${attempts}x (${ev.error}). Precisa de revisão manual.`,
          details: { webhook_event_id: ev.id },
        });
      } else {
        const delay = RETRY_BACKOFF_MIN[Math.min(attempts, RETRY_BACKOFF_MIN.length - 1)];
        await admin.from("validapay_webhook_events")
          .update({
            attempts,
            last_attempt_at: nowIso,
            next_retry_at: new Date(Date.now() + delay * 60_000).toISOString(),
          })
          .eq("id", ev.id);
      }
    }

    // ---------------------------------------------------------------
    // 2) Verificação ativa das assinaturas travadas em "pending"
    // ---------------------------------------------------------------
    const { data: pendings } = await admin
      .from("subscriptions")
      .select("id,user_id,plan,amount,validapay_charge_id,validapay_subscription_id,created_at")
      .eq("status", "pending")
      .lte("created_at", new Date(Date.now() - PENDING_MIN_AGE_MS).toISOString())
      .gte("created_at", new Date(Date.now() - PENDING_MAX_AGE_MS).toISOString())
      .order("created_at", { ascending: false })
      .limit(50);

    for (const sub of pendings ?? []) {
      const reference = sub.validapay_charge_id ?? sub.validapay_subscription_id;
      if (!reference) continue;
      result.pending_checked++;

      try {
        const info = await lookupPaymentStatus(reference);

        if (!isConfirmedPayment(info) || !info) continue;

        const now = new Date();
        await admin.from("subscriptions").update({
          status: "active",
          provider: "validapay",
          payment_method: (info.paymentMethod ?? "pix").toString().toLowerCase(),
          validapay_charge_id: info.chargeId ?? sub.validapay_charge_id,
          current_period_start: now.toISOString(),
          current_period_end: addMonths(now, 1).toISOString(),
          updated_at: now.toISOString(),
        }).eq("id", sub.id);
        await admin.from("profiles").update({ plano: sub.plan }).eq("user_id", sub.user_id);

        result.pending_recovered++;
        usersToAudit.add(sub.user_id);

        await logIncident(admin, {
          kind: "pending_recovered",
          severity: "warning",
          userId: sub.user_id,
          subscriptionId: sub.id,
          chargeId: info.chargeId ?? reference,
          amount: sub.amount ? Number(sub.amount) : null,
          message: "Pagamento confirmado no gateway mas o webhook não chegou. Acesso liberado pela verificação ativa.",
          details: { reference, gateway_status: info.status },
        });

        await admin.from("notifications").insert({
          user_id: sub.user_id,
          title: "Pagamento confirmado ✅",
          message: `Seu plano ${sub.plan} já está ativo. Obrigado!`,
          type: "subscription",
        });
      } catch (err) {
        console.error("payments-reconcile: verificação ativa falhou", sub.id, String(err));
      }
    }

    // ---------------------------------------------------------------
    // 3) Duplicidades (clientes tocados agora + últimos pagantes)
    // ---------------------------------------------------------------
    const { data: recent } = await admin
      .from("subscriptions")
      .select("user_id")
      .in("status", ["active", "trialing"])
      .gte("updated_at", new Date(Date.now() - 48 * 3600_000).toISOString())
      .limit(500);
    for (const r of recent ?? []) usersToAudit.add(r.user_id);

    for (const userId of usersToAudit) {
      try {
        const out = await detectAndRefundDuplicates(admin, userId);
        result.duplicates_refunded += out.refunded;
      } catch (err) {
        console.error("payments-reconcile: duplicidade falhou", userId, String(err));
      }
    }

    console.log("payments-reconcile:", JSON.stringify(result));
    return json({ ok: true, ...result });
  } catch (error) {
    console.error("payments-reconcile: erro fatal", String(error));
    return json({ error: "Falha na reconciliação de pagamentos" }, 500);
  }
});

/** Ativa a assinatura correspondente a uma cobrança já confirmada no gateway. */
async function activateFromReference(
  // deno-lint-ignore no-explicit-any -- cliente Supabase tipado em runtime
  admin: any,
  ref: { chargeId: string | null; subscriptionId: string | null; amount: number | null },
  usersToAudit: Set<string>,
): Promise<boolean> {
  let query = admin.from("subscriptions").select("id,user_id,plan,status").limit(1);
  if (ref.chargeId) query = query.eq("validapay_charge_id", ref.chargeId);
  else if (ref.subscriptionId) query = query.eq("validapay_subscription_id", ref.subscriptionId);
  else return false;

  const { data } = await query.order("created_at", { ascending: false });
  const sub = data?.[0];
  if (!sub) return false;

  if (sub.status !== "active") {
    const now = new Date();
    await admin.from("subscriptions").update({
      status: "active",
      provider: "validapay",
      validapay_charge_id: ref.chargeId ?? undefined,
      current_period_start: now.toISOString(),
      current_period_end: addMonths(now, 1).toISOString(),
      updated_at: now.toISOString(),
    }).eq("id", sub.id);
    await admin.from("profiles").update({ plano: sub.plan }).eq("user_id", sub.user_id);
  }
  usersToAudit.add(sub.user_id);
  return true;
}
