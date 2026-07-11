// mp-charge-trial
// Cron diário (03:00 BRT) que cobra automaticamente o cartão salvo do trial:
//  - No dia 5: usuários com is_trial=true, status='trialing' e next_charge_at <= now()
//  - Retry: usuários com status='suspended_payment_pending' (todos os dias)
// Sucesso => status='active', is_trial=false, plano do post_trial_plan aplicado.
// Falha  => status='suspended_payment_pending' e e-mail via Resend (rate limit 3 dias).
// Idempotência: last_charge_attempt_at impede duas tentativas no mesmo dia.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sameUtcDay(a: Date, b: Date) {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

async function sendDunningEmail(to: string, appUrl: string) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY ausente — pulando envio de e-mail de falha.");
    return { skipped: true };
  }
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#0F172A">
      <h2 style="color:#00C2A8">Não conseguimos cobrar seu cartão 😕</h2>
      <p>Seu período de teste da Velo terminou e a cobrança da sua assinatura Pro (R$ 99,90) não foi autorizada.</p>
      <p>Sua conta foi <strong>suspensa temporariamente</strong>. Para reativar, atualize sua forma de pagamento:</p>
      <p style="margin:24px 0">
        <a href="${appUrl}/dashboard/planos"
           style="background:#00C2A8;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">
          Atualizar pagamento
        </a>
      </p>
      <p style="color:#64748B;font-size:13px">Vamos tentar cobrar novamente todos os dias enquanto o problema não for resolvido.</p>
    </div>
  `;
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Velo <noreply@velods.com.br>",
      to,
      subject: "Falha na cobrança da sua assinatura Velo",
      html,
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    console.error("Resend erro:", resp.status, txt);
    return { sent: false, error: txt };
  }
  return { sent: true };
}

async function chargeSavedCard(params: {
  accessToken: string;
  amount: number;
  customerId: string;
  cardId: string;
  payerEmail: string;
  subscriptionRowId: string;
}) {
  const { accessToken, amount, customerId, cardId, payerEmail, subscriptionRowId } = params;
  const idem = `charge-trial-${subscriptionRowId}-${new Date().toISOString().slice(0, 10)}`;
  const resp = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": idem,
    },
    body: JSON.stringify({
      transaction_amount: amount,
      description: "Velo Pro — assinatura mensal",
      installments: 1,
      payer: { type: "customer", id: customerId, email: payerEmail },
      token: undefined,
      // Cobrança com cartão salvo do customer:
      payment_method_id: undefined,
      capture: true,
      binary_mode: true,
      metadata: { subscription_id: subscriptionRowId, kind: "trial_recurring" },
      // MP aceita cobrar cartão salvo passando customer + card:
      // https://www.mercadopago.com.br/developers/pt/docs/checkout-api/customer-management
      // (via customer.card_id no payload de payment)
      // @ts-ignore
      card_id: cardId,
    }),
  });
  const data = await resp.json();
  return { ok: resp.ok, status: resp.status, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const MP_ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const appUrl = Deno.env.get("APP_URL") ?? "https://wuili.lovable.app";

    if (!MP_ACCESS_TOKEN || !supabaseUrl || !serviceKey) {
      return json({ error: "Configuração ausente." }, 500);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const now = new Date();
    const nowIso = now.toISOString();

    // Selecionar candidatos:
    // (a) Trial vencido (dia 5) esperando cobrança
    // (b) Já suspensos por falha de pagamento (retry diário)
    const { data: candidates, error: qErr } = await admin
      .from("subscriptions")
      .select(
        "id,user_id,plan,post_trial_plan,next_charge_amount,next_charge_at,mp_customer_id,mp_card_id,status,is_trial,last_charge_attempt_at,last_dunning_email_at,charge_attempts",
      )
      .or(
        `and(is_trial.eq.true,status.eq.trialing,next_charge_at.lte.${nowIso}),status.eq.suspended_payment_pending`,
      )
      .limit(500);

    if (qErr) {
      console.error("Query candidates failed:", qErr);
      return json({ error: "Falha ao consultar candidatos." }, 500);
    }

    if (!candidates || candidates.length === 0) {
      return json({ processed: 0, message: "Nenhum candidato hoje." });
    }

    const results: Array<Record<string, unknown>> = [];

    for (const sub of candidates) {
      const rowId = sub.id as string;

      // Idempotência: se já tentamos hoje, pular.
      if (sub.last_charge_attempt_at && sameUtcDay(new Date(sub.last_charge_attempt_at), now)) {
        results.push({ id: rowId, skipped: "já tentado hoje" });
        continue;
      }

      const amount = Number(sub.next_charge_amount ?? 99.9);
      const targetPlan = (sub.post_trial_plan as string) || (sub.plan as string) || "pro";
      const customerId = sub.mp_customer_id as string | null;
      const cardId = sub.mp_card_id as string | null;

      // Registra a tentativa ANTES de cobrar (idempotência forte)
      await admin
        .from("subscriptions")
        .update({
          last_charge_attempt_at: nowIso,
          charge_attempts: (sub.charge_attempts ?? 0) + 1,
          updated_at: nowIso,
        })
        .eq("id", rowId);

      if (!customerId || !cardId) {
        // Sem cartão salvo — vai direto para suspenso e avisa por e-mail.
        await admin
          .from("subscriptions")
          .update({ status: "suspended_payment_pending", is_trial: false, updated_at: nowIso })
          .eq("id", rowId);

        try {
          const { data: userData } = await admin.auth.admin.getUserById(sub.user_id as string);
          const email = userData?.user?.email;
          if (email) {
            const lastEmail = sub.last_dunning_email_at ? new Date(sub.last_dunning_email_at) : null;
            const canSend = !lastEmail || now.getTime() - lastEmail.getTime() > 3 * 24 * 3600 * 1000;
            if (canSend) {
              await sendDunningEmail(email, appUrl);
              await admin
                .from("subscriptions")
                .update({ last_dunning_email_at: nowIso })
                .eq("id", rowId);
            }
          }
        } catch (e) {
          console.error("Falha no aviso de cartão ausente:", e);
        }
        results.push({ id: rowId, suspended: "sem cartão salvo" });
        continue;
      }

      // Buscar e-mail do payer
      const { data: userData } = await admin.auth.admin.getUserById(sub.user_id as string);
      const payerEmail = userData?.user?.email;
      if (!payerEmail) {
        results.push({ id: rowId, skipped: "sem email" });
        continue;
      }

      // Tentar cobrar
      try {
        const charge = await chargeSavedCard({
          accessToken: MP_ACCESS_TOKEN,
          amount,
          customerId,
          cardId,
          payerEmail,
          subscriptionRowId: rowId,
        });

        const approved = charge.ok && charge.data?.status === "approved";

        if (approved) {
          const start = new Date();
          const end = new Date(start);
          end.setMonth(end.getMonth() + 1);

          await admin
            .from("subscriptions")
            .update({
              plan: targetPlan,
              status: "active",
              is_trial: false,
              trial_ends_at: null,
              next_charge_amount: null,
              next_charge_at: end.toISOString(),
              post_trial_plan: null,
              amount,
              mp_payment_id: String(charge.data.id ?? ""),
              current_period_start: start.toISOString(),
              current_period_end: end.toISOString(),
              charge_attempts: 0,
              updated_at: new Date().toISOString(),
            })
            .eq("id", rowId);

          await admin
            .from("profiles")
            .update({ plano: targetPlan })
            .eq("user_id", sub.user_id as string);

          await admin.from("notifications").insert({
            user_id: sub.user_id,
            title: "Assinatura Pro ativada ✅",
            message: `Cobrança de R$ ${amount.toFixed(2).replace(".", ",")} aprovada.`,
            type: "billing",
            metadata: { subscription_id: rowId, mp_payment_id: charge.data?.id },
          });

          results.push({ id: rowId, charged: true, mp_payment_id: charge.data?.id });
        } else {
          // Falha: manter/marcar como suspenso
          await admin
            .from("subscriptions")
            .update({
              status: "suspended_payment_pending",
              is_trial: false,
              updated_at: new Date().toISOString(),
            })
            .eq("id", rowId);

          const lastEmail = sub.last_dunning_email_at ? new Date(sub.last_dunning_email_at) : null;
          const canSend = !lastEmail || now.getTime() - lastEmail.getTime() > 3 * 24 * 3600 * 1000;
          if (canSend) {
            await sendDunningEmail(payerEmail, appUrl);
            await admin
              .from("subscriptions")
              .update({ last_dunning_email_at: new Date().toISOString() })
              .eq("id", rowId);
          }

          results.push({
            id: rowId,
            failed: true,
            mp_status: charge.data?.status,
            detail: charge.data?.status_detail ?? charge.data?.message,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("Erro cobrança:", rowId, message);
        await admin
          .from("subscriptions")
          .update({ status: "suspended_payment_pending", is_trial: false, updated_at: new Date().toISOString() })
          .eq("id", rowId);
        results.push({ id: rowId, error: message });
      }
    }

    return json({ processed: results.length, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("mp-charge-trial error:", message);
    return json({ error: message }, 500);
  }
});
