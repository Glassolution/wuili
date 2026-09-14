// Estorno de comissão de afiliado quando o assinante é reembolsado.
//
// Regras:
//  - O estorno é POR CICLO: apenas a comissão do ciclo cujo pagamento foi
//    devolvido é cancelada. Ciclos anteriores permanecem intactos.
//  - Identificação do ciclo:
//      1) match exato por `payment_id` (chargeId ValidaPay ou payment_id MP);
//      2) fallback: maior `cycle_number` da assinatura (subscription_id ou
//         provider_subscription_id) ainda não estornado;
//      3) último fallback: maior `cycle_number` do assinante.
//  - Comissão ainda pendente de repasse -> status 'refunded', payout_status
//    continua 'pending' (nunca será paga).
//  - Comissão JÁ PAGA -> status 'refunded', payout_status permanece 'paid'
//    (registro histórico). Vira débito abatido do próximo repasse.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type ReverseCommissionInput = {
  admin: SupabaseClient;
  /** Usuário que foi reembolsado (assinante indicado). */
  subscriberUserId?: string | null;
  /** Id do pagamento/cobrança devolvido (chargeId ValidaPay ou payment_id MP). */
  paymentKey?: string | null;
  /** Id interno da assinatura em public.subscriptions. */
  subscriptionId?: string | null;
  /** Id da assinatura no provedor. */
  providerSubscriptionId?: string | null;
  /** Origem do estorno (para log). */
  origin?: string;
};

export type ReverseCommissionResult =
  | { status: "skipped"; reason: string }
  | { status: "already_refunded"; conversionId: string }
  | {
      status: "reversed";
      conversionId: string;
      cycleNumber: number;
      value: number;
      /** true quando a comissão já havia sido repassada -> vira débito. */
      becameDebt: boolean;
    };

type ConversionRow = {
  id: string;
  cycle_number: number;
  commission_value: number | string | null;
  payout_status: string | null;
  status: string | null;
  refunded_at: string | null;
};

const SELECT_COLS = "id,cycle_number,commission_value,payout_status,status,refunded_at";

async function findConversion(
  input: ReverseCommissionInput,
): Promise<ConversionRow | null> {
  const { admin, paymentKey, subscriptionId, providerSubscriptionId, subscriberUserId } = input;

  // 1) match exato pelo pagamento devolvido
  if (paymentKey) {
    const { data } = await admin
      .from("affiliate_conversions")
      .select(SELECT_COLS)
      .eq("payment_id", String(paymentKey))
      .maybeSingle();
    if (data) return data as ConversionRow;
  }

  // 2) último ciclo da assinatura
  for (const [column, value] of [
    ["subscription_id", subscriptionId],
    ["provider_subscription_id", providerSubscriptionId],
  ] as const) {
    if (!value) continue;
    const { data } = await admin
      .from("affiliate_conversions")
      .select(SELECT_COLS)
      .eq(column, String(value))
      .is("refunded_at", null)
      .order("cycle_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as ConversionRow;
  }

  // 3) último ciclo do assinante
  if (subscriberUserId) {
    const { data } = await admin
      .from("affiliate_conversions")
      .select(SELECT_COLS)
      .eq("subscriber_user_id", subscriberUserId)
      .is("refunded_at", null)
      .order("cycle_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as ConversionRow;
  }

  return null;
}

export async function reverseAffiliateCommission(
  input: ReverseCommissionInput,
): Promise<ReverseCommissionResult> {
  try {
    const conversion = await findConversion(input);
    if (!conversion) return { status: "skipped", reason: "comissao_nao_encontrada" };

    if (conversion.refunded_at || conversion.status === "refunded") {
      return { status: "already_refunded", conversionId: conversion.id };
    }

    const becameDebt = conversion.payout_status === "paid";

    const { error } = await input.admin
      .from("affiliate_conversions")
      .update({
        status: "refunded",
        refunded_at: new Date().toISOString(),
        // payout_status é preservado de propósito: se já foi pago, o valor vira
        // débito abatido do próximo repasse (não some do histórico).
      })
      .eq("id", conversion.id)
      .is("refunded_at", null);

    if (error) {
      console.error("[affiliate] falha ao estornar comissão", error.message);
      return { status: "skipped", reason: `erro:${error.message}` };
    }

    const value = Number(conversion.commission_value ?? 0);
    console.log("[affiliate] comissão estornada", {
      origin: input.origin ?? "desconhecida",
      conversionId: conversion.id,
      cycleNumber: conversion.cycle_number,
      value,
      becameDebt,
    });

    return {
      status: "reversed",
      conversionId: conversion.id,
      cycleNumber: Number(conversion.cycle_number ?? 0),
      value,
      becameDebt,
    };
  } catch (e) {
    console.error("[affiliate] erro inesperado no estorno", e);
    return { status: "skipped", reason: "excecao" };
  }
}
