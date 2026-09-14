// Geração de comissão de afiliado (compartilhada entre provedores de pagamento).
//
// Regras:
//  - Ciclo 1  -> cycle_type = "first",   30% do valor efetivamente cobrado
//  - Ciclo >=2 -> cycle_type = "renewal", 20% do valor efetivamente cobrado
//
// Idempotência (webhooks NÃO garantem ordem nem entrega única):
//  1) `payment_id` tem índice único parcial: o mesmo pagamento só vira comissão uma vez,
//     não importa qual evento chegue primeiro (payment.success ou subscription.activated).
//  2) `(affiliate_code, subscriber_user_id, cycle_number)` tem índice único: o número do
//     ciclo é derivado do banco, então dois eventos concorrentes não criam ciclos duplicados
//     — o perdedor da corrida recalcula ou é descartado.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export const FIRST_CYCLE_RATE = 0.3;
export const RENEWAL_RATE = 0.2;

const UNIQUE_VIOLATION = "23505";

export type CommissionInput = {
  admin: SupabaseClient;
  /** Usuário que assinou (indicado). */
  subscriberUserId: string;
  /** Valor efetivamente cobrado neste evento (mensal ou anual). */
  amount: number;
  /** Identificador estável do pagamento/cobrança — chave de idempotência. */
  paymentKey: string | null;
  /** Código do afiliado, se conhecido pelo evento. */
  affiliateCode?: string | null;
  planName?: string | null;
  subscriptionId?: string | null;
  providerSubscriptionId?: string | null;
};

export type CommissionResult =
  | { status: "skipped"; reason: string }
  | { status: "duplicated"; reason: string }
  | { status: "created"; cycleNumber: number; cycleType: "first" | "renewal"; value: number };

const normalizeCode = (code?: string | null) => {
  const clean = String(code ?? "").trim().toUpperCase();
  return clean.length > 0 ? clean : null;
};

const firstDayOfMonth = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
};

/**
 * Descobre o afiliado do assinante. Prioriza o código vindo no evento; para
 * renovações (que normalmente não trazem metadata) reaproveita o código já
 * usado na primeira comissão daquele mesmo assinante.
 */
async function resolveAffiliateCode(
  admin: SupabaseClient,
  subscriberUserId: string,
  hinted?: string | null,
): Promise<string | null> {
  const hint = normalizeCode(hinted);
  if (hint) {
    const { data } = await admin
      .from("affiliates")
      .select("code,is_active")
      .eq("code", hint)
      .maybeSingle();
    if (data?.is_active) return data.code as string;
    console.warn("[affiliate] código informado não encontrado/inativo", hint);
  }

  const { data: previous } = await admin
    .from("affiliate_conversions")
    .select("affiliate_code")
    .eq("subscriber_user_id", subscriberUserId)
    .order("cycle_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  return normalizeCode(previous?.affiliate_code as string | undefined);
}

async function nextCycle(
  admin: SupabaseClient,
  affiliateCode: string,
  subscriberUserId: string,
) {
  const { data } = await admin
    .from("affiliate_conversions")
    .select("cycle_number")
    .eq("affiliate_code", affiliateCode)
    .eq("subscriber_user_id", subscriberUserId)
    .order("cycle_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  return Number(data?.cycle_number ?? 0) + 1;
}

export async function recordAffiliateCommission(
  input: CommissionInput,
): Promise<CommissionResult> {
  const { admin, subscriberUserId, paymentKey } = input;
  const amount = Number(input.amount ?? 0);

  if (!subscriberUserId) return { status: "skipped", reason: "sem_assinante" };
  if (!(amount > 0)) return { status: "skipped", reason: "valor_invalido" };

  const affiliateCode = await resolveAffiliateCode(admin, subscriberUserId, input.affiliateCode);
  if (!affiliateCode) return { status: "skipped", reason: "sem_afiliado" };

  // Guarda 1: esse pagamento já virou comissão? (protege contra eventos
  // duplicados ou fora de ordem que descrevem a MESMA cobrança)
  if (paymentKey) {
    const { data: existing } = await admin
      .from("affiliate_conversions")
      .select("id")
      .eq("payment_id", paymentKey)
      .maybeSingle();
    if (existing) return { status: "duplicated", reason: "pagamento_ja_creditado" };
  }

  // Guarda 2: número do ciclo derivado do banco, com retry em caso de corrida.
  for (let attempt = 0; attempt < 5; attempt++) {
    const cycleNumber = await nextCycle(admin, affiliateCode, subscriberUserId);
    const cycleType = cycleNumber === 1 ? "first" : "renewal";
    const rate = cycleNumber === 1 ? FIRST_CYCLE_RATE : RENEWAL_RATE;
    const commissionValue = Math.round(amount * rate * 100) / 100;

    const { error } = await admin.from("affiliate_conversions").insert({
      affiliate_code: affiliateCode,
      subscriber_user_id: subscriberUserId,
      subscription_id: input.subscriptionId ?? null,
      provider_subscription_id: input.providerSubscriptionId ?? null,
      plan_name: input.planName ?? null,
      plan_value: amount,
      commission_rate: rate,
      commission_value: commissionValue,
      status: "approved",
      payout_status: "pending",
      payment_id: paymentKey,
      cycle_type: cycleType,
      cycle_number: cycleNumber,
      reference_month: firstDayOfMonth(),
    });

    if (!error) {
      // Funil (métrica, não dinheiro): carimba a conversão no clique de origem.
      if (cycleNumber === 1) {
        const { error: funnelError } = await admin.rpc("rpc_affiliate_mark_converted", {
          p_affiliate_code: affiliateCode,
          p_user_id: subscriberUserId,
        });
        if (funnelError) {
          console.warn("[affiliate] falha ao carimbar funil", funnelError.message);
        }
      }

      console.log("[affiliate] comissão registrada", {
        affiliateCode,
        subscriberUserId,
        cycleNumber,
        cycleType,
        rate,
        commissionValue,
      });
      return { status: "created", cycleNumber, cycleType, value: commissionValue };
    }

    if (error.code !== UNIQUE_VIOLATION) {
      console.error("[affiliate] falha ao registrar comissão", error.message);
      return { status: "skipped", reason: `erro:${error.message}` };
    }

    // Conflito no payment_id -> outro evento (concorrente) já creditou este pagamento.
    if (error.message?.includes("payment_id")) {
      return { status: "duplicated", reason: "pagamento_ja_creditado" };
    }
    // Conflito no ciclo -> outro evento avançou o contador; recalcula e tenta de novo.
    console.warn("[affiliate] corrida no cycle_number, recalculando", { attempt, cycleNumber });
  }

  return { status: "skipped", reason: "conflito_de_ciclo_persistente" };
}
