// Rede de proteção financeira da Velo.
//
// Resolve três problemas estruturais:
//  1) Detectar pagamentos duplicados (mesmo cliente, mesmo plano, janela curta)
//     e devolver automaticamente a cobrança extra.
//  2) NUNCA derrubar o acesso do cliente quando existe outra cobrança válida
//     cobrindo o mesmo período.
//  3) Registrar ocorrências de forma auditável em `payment_incidents`.
//
// Nada aqui depende de intervenção manual do admin.
import { refundCharge, ValidaPayError } from "./validapay.ts";

// deno-lint-ignore no-explicit-any -- cliente Supabase tipado apenas em runtime
type Admin = any;

/** Janela em que dois pagamentos do MESMO plano são tratados como duplicidade. */
export const DUPLICATE_WINDOW_HOURS = 36;

export type SubscriptionRow = {
  id: string;
  user_id: string;
  plan: string | null;
  status: string | null;
  amount: number | null;
  provider: string | null;
  payment_method: string | null;
  validapay_charge_id: string | null;
  validapay_subscription_id: string | null;
  mp_payment_id: string | null;
  created_at: string;
  updated_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  duplicate_status?: string | null;
  duplicate_of_subscription_id?: string | null;
};

export type IncidentKind =
  | "webhook_failed"
  | "webhook_retry_exhausted"
  | "pending_recovered"
  | "duplicate_detected"
  | "duplicate_refunded"
  | "duplicate_refund_failed"
  | "refund_access_preserved";

/** Grava uma ocorrência auditável no painel admin (nunca lança exceção). */
export async function logIncident(
  admin: Admin,
  incident: {
    kind: IncidentKind;
    severity?: "info" | "warning" | "critical";
    userId?: string | null;
    subscriptionId?: string | null;
    relatedSubscriptionId?: string | null;
    chargeId?: string | null;
    amount?: number | null;
    message?: string;
    details?: Record<string, unknown>;
  },
) {
  try {
    await admin.from("payment_incidents").insert({
      kind: incident.kind,
      severity: incident.severity ?? "info",
      user_id: incident.userId ?? null,
      subscription_id: incident.subscriptionId ?? null,
      related_subscription_id: incident.relatedSubscriptionId ?? null,
      charge_id: incident.chargeId ?? null,
      amount: incident.amount ?? null,
      message: incident.message ?? null,
      details: incident.details ?? {},
    });
  } catch (err) {
    console.error("payment_incidents: falha ao registrar", incident.kind, String(err));
  }
}

const ACTIVE_STATUSES = ["active", "trialing", "cancel_scheduled"];

/**
 * Retorna as assinaturas que ainda garantem acesso ao cliente, ignorando uma
 * assinatura específica (a que está sendo estornada).
 */
export async function findOtherActiveSubscriptions(
  admin: Admin,
  userId: string,
  excludeSubscriptionId?: string | null,
): Promise<SubscriptionRow[]> {
  const { data } = await admin
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .in("status", ACTIVE_STATUSES)
    .order("current_period_end", { ascending: false });

  const rows = (data ?? []) as SubscriptionRow[];
  const now = Date.now();
  return rows.filter((s) => {
    if (excludeSubscriptionId && s.id === excludeSubscriptionId) return false;
    if (s.duplicate_status === "duplicate") return false;
    if (!s.current_period_end) return true;
    return new Date(s.current_period_end).getTime() > now;
  });
}

const hoursBetween = (a: string, b: string) =>
  Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 3_600_000;

const paidAt = (s: SubscriptionRow) => s.current_period_start ?? s.updated_at ?? s.created_at;

const chargeIdOf = (s: SubscriptionRow) => s.validapay_charge_id ?? s.mp_payment_id ?? null;

/**
 * Detecta cobranças duplicadas de um cliente e devolve as extras.
 *
 * Critério (propositalmente tolerante para não gerar falso positivo com
 * upgrade/troca de plano):
 *   - mesmo usuário
 *   - MESMO plano
 *   - mesmo valor (tolerância de R$ 0,50)
 *   - confirmadas dentro de DUPLICATE_WINDOW_HOURS uma da outra
 *
 * A assinatura mantida é a que tem o período de acesso mais longo (na prática,
 * a que efetivamente ativou o acesso). As demais são marcadas como duplicadas,
 * estornadas automaticamente e o cliente é notificado — sem esperar reclamação.
 */
export async function detectAndRefundDuplicates(
  admin: Admin,
  userId: string,
): Promise<{ checked: number; duplicates: number; refunded: number }> {
  const { data } = await admin
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .in("status", ACTIVE_STATUSES)
    .order("created_at", { ascending: true });

  const paid = ((data ?? []) as SubscriptionRow[]).filter(
    (s) => !!chargeIdOf(s) && s.duplicate_status !== "duplicate",
  );

  let duplicates = 0;
  let refunded = 0;
  if (paid.length < 2) return { checked: paid.length, duplicates, refunded };

  // Agrupa por plano + valor arredondado.
  const groups = new Map<string, SubscriptionRow[]>();
  for (const s of paid) {
    const key = `${(s.plan ?? "").toLowerCase()}|${Math.round(Number(s.amount ?? 0) * 2) / 2}`;
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue;

    // Só considera duplicata o que caiu dentro da janela curta.
    const anchor = group[0];
    const cluster = group.filter((s) => hoursBetween(paidAt(s), paidAt(anchor)) <= DUPLICATE_WINDOW_HOURS);
    if (cluster.length < 2) continue;

    // Mantém a assinatura com o período de acesso mais longo (a que está valendo).
    const keep = cluster.reduce((best, s) => {
      const bestEnd = best.current_period_end ? new Date(best.current_period_end).getTime() : 0;
      const end = s.current_period_end ? new Date(s.current_period_end).getTime() : 0;
      return end > bestEnd ? s : best;
    }, cluster[0]);

    for (const extra of cluster) {
      if (extra.id === keep.id) continue;
      duplicates++;
      const ok = await refundDuplicate(admin, extra, keep);
      if (ok) refunded++;
    }
  }

  return { checked: paid.length, duplicates, refunded };
}

/** Estorna UMA cobrança duplicada preservando integralmente o acesso do cliente. */
async function refundDuplicate(
  admin: Admin,
  extra: SubscriptionRow,
  keep: SubscriptionRow,
): Promise<boolean> {
  const chargeId = chargeIdOf(extra);
  const amount = Number(extra.amount ?? 0);

  // Marca antes de estornar: se o estorno falhar, a duplicidade continua visível.
  await admin
    .from("subscriptions")
    .update({
      duplicate_status: "duplicate",
      duplicate_of_subscription_id: keep.id,
      duplicate_detected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", extra.id);

  await logIncident(admin, {
    kind: "duplicate_detected",
    severity: "warning",
    userId: extra.user_id,
    subscriptionId: extra.id,
    relatedSubscriptionId: keep.id,
    chargeId,
    amount,
    message: `Cobrança duplicada detectada (plano ${extra.plan}). Assinatura mantida: ${keep.id}.`,
    details: { extra_charge: chargeId, kept_charge: chargeIdOf(keep) },
  });

  // Já existe pedido de reembolso para essa cobrança? Não duplica.
  const { data: existing } = await admin
    .from("refund_requests")
    .select("id,status")
    .eq("subscription_id", extra.id)
    .maybeSingle();
  if (existing && existing.status === "processed") return true;

  let providerResponse: unknown = null;
  let refundOk = false;

  if (extra.validapay_charge_id) {
    try {
      providerResponse = await refundCharge(extra.validapay_charge_id, amount, "DUPLICATE_PAYMENT");
      refundOk = true;
    } catch (error) {
      const err = error as ValidaPayError;
      providerResponse = { provider: "validapay", error: err.message, details: err.details };
      console.error("paymentGuard: falha ao estornar duplicata", extra.id, err.message);
    }
  } else {
    providerResponse = { error: "sem_charge_id_validapay", provider: extra.provider };
  }

  const nowIso = new Date().toISOString();
  const refundPayload = {
    user_id: extra.user_id,
    subscription_id: extra.id,
    payment_id: chargeId,
    charge_id: chargeId,
    reason: "Cobrança duplicada",
    reason_details:
      "Detectamos dois pagamentos do mesmo plano em um curto intervalo. Esta é a cobrança extra — o acesso do cliente segue ativo pela outra cobrança.",
    refund_amount: amount,
    refund_kind: "duplicate",
    keep_access: true,
    automated: true,
    status: refundOk ? "processed" : "pending",
    provider_response: providerResponse as Record<string, unknown>,
    processed_at: refundOk ? nowIso : null,
    updated_at: nowIso,
  };

  if (existing) {
    await admin.from("refund_requests").update(refundPayload).eq("id", existing.id);
  } else {
    await admin.from("refund_requests").insert(refundPayload);
  }

  // A assinatura duplicada sai do ar como cobrança, mas o acesso vem da `keep`.
  await admin
    .from("subscriptions")
    .update({
      status: refundOk ? "refunded_duplicate" : extra.status,
      duplicate_status: "duplicate",
      updated_at: nowIso,
    })
    .eq("id", extra.id);

  // Garante que o acesso da assinatura mantida continua intacto.
  await admin.from("profiles").update({ plano: keep.plan }).eq("user_id", extra.user_id);

  await admin.from("notifications").insert({
    user_id: extra.user_id,
    title: refundOk ? "Cobrança duplicada devolvida" : "Cobrança duplicada identificada",
    message: refundOk
      ? `Identificamos que o pagamento do plano ${keep.plan} foi feito duas vezes e já devolvemos ${formatBRL(amount)} automaticamente. Seu acesso continua ativo normalmente.`
      : `Identificamos um pagamento duplicado de ${formatBRL(amount)}. Já estamos processando a devolução — seu acesso continua ativo normalmente.`,
    type: "refund",
  });

  await logIncident(admin, {
    kind: refundOk ? "duplicate_refunded" : "duplicate_refund_failed",
    severity: refundOk ? "info" : "critical",
    userId: extra.user_id,
    subscriptionId: extra.id,
    relatedSubscriptionId: keep.id,
    chargeId,
    amount,
    message: refundOk
      ? "Cobrança duplicada estornada automaticamente. Acesso preservado."
      : "Falha ao estornar cobrança duplicada — precisa de ação manual no painel.",
    details: { providerResponse },
  });

  return refundOk;
}

const formatBRL = (v: number) => `R$ ${Number(v || 0).toFixed(2).replace(".", ",")}`;
