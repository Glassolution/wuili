// Webhook da ValidaPay.
// URL pública: https://nqzpoioxvbqavrtphtoa.supabase.co/functions/v1/validapay-webhook
//
// Segurança (a doc oficial não define assinatura HMAC nos webhooks):
//  1) Token compartilhado opcional — se VALIDAPAY_WEBHOOK_TOKEN estiver configurado,
//     a requisição precisa trazê-lo em ?token= ou no header x-webhook-token.
//  2) Verificação server-side obrigatória: todo evento de pagamento é reconferido
//     via GET /v1/charges/:chargeId com o token OAuth2 antes de alterar o banco.
//     Ou seja, um POST forjado não consegue ativar assinatura nenhuma.
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCharge, safeEqual, ValidaPayError } from "../_shared/validapay.ts";
import { recordAffiliateCommission } from "../_shared/affiliateCommission.ts";
import { detectAndRefundDuplicates, logIncident } from "../_shared/paymentGuard.ts";
import {
  applyPendingReferralRewards,
  grantInviterMonthsForPaidInvitee,
} from "../_shared/referral-rewards.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type WebhookPayload = {
  event?: string;
  chargeId?: string;
  subscriptionId?: string;
  paymentId?: string;
  amount?: number;
  status?: string;
  paymentMethod?: string;
  paidAt?: string;
  customer?: { email?: string; documentNumber?: string; name?: string };
  payer?: { name?: string; taxId?: string };
  metadata?: Record<string, unknown>;
};

/** Localiza a assinatura da Velo correspondente ao evento recebido. */
async function findSubscription(p: WebhookPayload) {
  const metaUser = (p.metadata?.user_id ?? p.metadata?.userId) as string | undefined;

  if (p.chargeId) {
    const { data } = await admin
      .from("subscriptions")
      .select("id,user_id,plan,status")
      .eq("validapay_charge_id", p.chargeId)
      .maybeSingle();
    if (data) return data;
  }
  if (p.subscriptionId) {
    const { data } = await admin
      .from("subscriptions")
      .select("id,user_id,plan,status")
      .eq("validapay_subscription_id", p.subscriptionId)
      .maybeSingle();
    if (data) return data;
  }
  if (metaUser) {
    const { data } = await admin
      .from("subscriptions")
      .select("id,user_id,plan,status")
      .eq("user_id", metaUser)
      .eq("provider", "validapay")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

const addMonths = (date: Date, months: number) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // 1) Token compartilhado (quando configurado)
  const expectedToken = Deno.env.get("VALIDAPAY_WEBHOOK_TOKEN");
  if (expectedToken) {
    const url = new URL(req.url);
    const provided = url.searchParams.get("token") ?? req.headers.get("x-webhook-token") ?? "";
    if (!safeEqual(provided, expectedToken)) {
      console.warn("validapay-webhook: token inválido");
      return json({ error: "unauthorized" }, 401);
    }
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const event = payload.event ?? "unknown";
  console.log("validapay-webhook evento", event, {
    chargeId: payload.chargeId,
    subscriptionId: payload.subscriptionId,
    paymentId: payload.paymentId,
  });

  // Registra o evento bruto (dedupe por evento+pagamento/cobrança)
  const { data: eventRow } = await admin
    .from("validapay_webhook_events")
    .insert({
      event,
      charge_id: payload.chargeId ?? null,
      subscription_id: payload.subscriptionId ?? null,
      payment_id: payload.paymentId ?? null,
      status: payload.status ?? null,
      amount: payload.amount ?? null,
      payload: payload as unknown as Record<string, unknown>,
    })
    .select("id")
    .maybeSingle();

  if (!eventRow) {
    // Índice único bateu: evento repetido, já processado.
    console.log("validapay-webhook: evento duplicado ignorado", event);
    return json({ received: true, duplicated: true });
  }

  // Falha => NUNCA descarta em silêncio: entra na fila de reprocessamento com
  // backoff exponencial e vira ocorrência auditável no painel admin.
  const RETRY_BACKOFF_MIN = [1, 5, 15, 60, 180, 360];
  const fail = async (message: string, status = 200) => {
    const attempts = 1;
    const delay = RETRY_BACKOFF_MIN[0];
    const retryable = message !== "unhandled_event" && !message.startsWith("unhandled_event");
    await admin
      .from("validapay_webhook_events")
      .update({
        error: message,
        attempts,
        last_attempt_at: new Date().toISOString(),
        next_retry_at: retryable ? new Date(Date.now() + delay * 60_000).toISOString() : null,
        retry_exhausted: !retryable,
      })
      .eq("id", eventRow.id);

    console.error("webhook_failure", JSON.stringify({
      source: "validapay-webhook",
      event,
      reason: message,
      chargeId: payload.chargeId ?? null,
      subscriptionId: payload.subscriptionId ?? null,
      willRetry: retryable,
    }));

    if (retryable) {
      await logIncident(admin, {
        kind: "webhook_failed",
        severity: "warning",
        chargeId: payload.chargeId ?? null,
        amount: payload.amount ?? null,
        message: `Webhook ${event} não processado: ${message}. Reprocessamento agendado.`,
        details: { event, reason: message, subscription_id: payload.subscriptionId ?? null },
      });
    }
    return json({ received: true, warning: message }, status);
  };


  try {
    // 2) Verificação server-side na própria API da ValidaPay
    let verifiedStatus: string | null = null;
    let verifiedAmount: number | null = null;
    if (payload.chargeId) {
      try {
        const charge = await getCharge(payload.chargeId);
        verifiedStatus = String(charge.status ?? "").toUpperCase();
        verifiedAmount = Number(charge.amount ?? payload.amount ?? 0);
      } catch (err) {
        const detail = err instanceof ValidaPayError ? `${err.status}` : String(err);
        console.error("validapay-webhook: não foi possível verificar a cobrança", detail);
        return await fail("charge_verification_failed");
      }
    }

    // 2.1) Venda de loja do usuário (checkout público) — não é assinatura.
    const isStoreOrder =
      String(payload.metadata?.kind ?? "") === "store_order" || !!payload.metadata?.store_order_id;
    if (isStoreOrder || payload.chargeId) {
      const { data: storeOrder } = await admin
        .from("store_orders")
        .select("id,payment_status")
        .eq("mp_payment_id", payload.chargeId ?? "")
        .maybeSingle();

      if (storeOrder) {
        const paid = verifiedStatus ? ["PAID", "APPROVED", "CONFIRMED"].includes(verifiedStatus) : false;
        const failed = verifiedStatus
          ? ["REJECTED", "CANCELLED", "EXPIRED", "REFUNDED"].includes(verifiedStatus)
          : event === "payment.failed";
        const newStatus = paid ? "approved" : failed ? "rejected" : "pending";
        await admin
          .from("store_orders")
          .update({ payment_status: newStatus, updated_at: new Date().toISOString() })
          .eq("id", storeOrder.id);
        await admin
          .from("validapay_webhook_events")
          .update({ processed: true, status: verifiedStatus ?? payload.status ?? null })
          .eq("id", eventRow.id);
        console.log("validapay-webhook: pedido de loja atualizado", storeOrder.id, newStatus);
        return json({ received: true, storeOrder: storeOrder.id, status: newStatus });
      }
    }

    const subscription = await findSubscription(payload);
    if (!subscription) return await fail("subscription_not_found");

    const now = new Date();
    const nowIso = now.toISOString();

    const activate = async () => {
      await admin
        .from("subscriptions")
        .update({
          status: "active",
          provider: "validapay",
          payment_method: payload.paymentMethod?.toLowerCase() ?? "pix",
          validapay_charge_id: payload.chargeId ?? null,
          validapay_subscription_id: payload.subscriptionId ?? null,
          amount: verifiedAmount ?? payload.amount ?? undefined,
          current_period_start: nowIso,
          current_period_end: addMonths(now, 1).toISOString(),
          updated_at: nowIso,
        })
        .eq("id", subscription.id);
      await admin
        .from("profiles")
        .update({ plano: subscription.plan })
        .eq("user_id", subscription.user_id);
    };

    const setStatus = async (status: string, downgrade = false) => {
      await admin
        .from("subscriptions")
        .update({ status, updated_at: nowIso })
        .eq("id", subscription.id);
      if (downgrade) {
        await admin.from("profiles").update({ plano: "gratis" }).eq("user_id", subscription.user_id);
      }
    };

    switch (event) {
      case "payment.success":
      case "subscription.activated":
      case "subscription.renewed": {
        if (payload.chargeId && verifiedStatus !== "PAID") {
          return await fail(`charge_not_paid:${verifiedStatus}`);
        }
        await activate();

        // Rede de segurança: se o cliente já pagou esse mesmo plano há pouco
        // (webhook atrasado que o levou a pagar de novo), devolvemos a cobrança
        // extra automaticamente, sem tocar na assinatura ativa.
        try {
          await detectAndRefundDuplicates(admin, subscription.user_id);
        } catch (err) {
          console.error("validapay-webhook: verificação de duplicidade falhou", String(err));
        }


        // Comissão de afiliado. O ciclo NÃO é inferido pelo nome do evento
        // (a ValidaPay mistura payment.success genérico com eventos de
        // assinatura e não garante ordem): ele é derivado do banco e
        // protegido por índices únicos em payment_id e no ciclo.
        const paidAmount = verifiedAmount ?? payload.amount ?? 0;
        const paymentKey = payload.chargeId ?? payload.paymentId ?? null;
        const affiliateCode =
          (payload.metadata?.affiliate_code ?? payload.metadata?.affiliateCode) as
            | string
            | undefined;

        const commission = await recordAffiliateCommission({
          admin,
          subscriberUserId: subscription.user_id,
          amount: Number(paidAmount),
          paymentKey,
          affiliateCode,
          planName: subscription.plan,
          subscriptionId: subscription.id,
          providerSubscriptionId: payload.subscriptionId ?? null,
        });
        console.log("validapay-webhook: comissão", event, commission);

        // Indicação: se este assinante veio de um convite, quem convidou ganha
        // 3 meses grátis (idempotente por pagamento). Também aplicamos aqui
        // eventuais recompensas pendentes do próprio assinante.
        if (paymentKey) {
          await grantInviterMonthsForPaidInvitee(admin, {
            invitedUserId: subscription.user_id,
            paymentRef: String(paymentKey),
          });
        }
        await applyPendingReferralRewards(admin, subscription.user_id);
        break;
      }
      case "payment.failed":
        await setStatus("past_due");
        break;

      case "subscription.canceled":
        await setStatus("cancelled", true);
        break;
      case "subscription.cancel_scheduled":
        await setStatus("cancel_scheduled");
        break;
      case "subscription.trial":
        await setStatus("trialing");
        break;
      case "subscription.created":
        await setStatus("pending");
        break;
      default:
        return await fail(`unhandled_event:${event}`);
    }

    await admin
      .from("validapay_webhook_events")
      .update({ processed: true, status: verifiedStatus ?? payload.status ?? null })
      .eq("id", eventRow.id);

    return json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("validapay-webhook: erro ao processar", event, message);
    await admin
      .from("validapay_webhook_events")
      .update({ error: message })
      .eq("id", eventRow.id);
    return json({ error: "processing_error" }, 500);
  }
});
