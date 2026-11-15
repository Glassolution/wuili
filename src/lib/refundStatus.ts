import { supabase } from "@/integrations/supabase/client";
import { getRefundMode, REFUNDABLE_SUBSCRIPTION_STATUSES, type RefundMode } from "./refundEligibility";
export type { RefundMode } from "./refundEligibility";

/*
 * Situação do cliente para reembolso/cancelamento: o que ele pode fazer agora.
 * Usado pela Gerenciar assinatura em Configurações.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas de reembolso ainda fora dos tipos gerados
const db = supabase as any;

export type RefundAssinatura = {
  id: string;
  plan: string | null;
  status: string | null;
  amount: number | null;
  provider: string | null;
  payment_method: string | null;
  purchase_kind: string | null;
  created_at: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
};

export type RefundStatus = { mode: RefundMode; assinatura: RefundAssinatura | null; windowException?: boolean };

const ehSandbox = (s: Pick<RefundAssinatura, "provider" | "payment_method">) =>
  String(s.provider ?? s.payment_method ?? "").toLowerCase() === "sandbox";

/**
 * Assinatura mais recente em vigor e o que dá para fazer com ela.
 * `sandbox` separa as assinaturas de teste dos admins das reais.
 */
export const fetchRefundStatus = async (userId: string, sandbox = false, verifyWindow = false): Promise<RefundStatus> => {
  const { data: assinaturas, error } = await db
    .from("subscriptions")
    .select("id, plan, status, amount, provider, payment_method, purchase_kind, created_at, current_period_end, cancel_at_period_end")
    .eq("user_id", userId)
    .in("status", REFUNDABLE_SUBSCRIPTION_STATUSES)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  const assinatura =
    ((assinaturas ?? []) as RefundAssinatura[]).find((s) => ehSandbox(s) === sandbox) ?? null;

  const { data: pedidos, error: erroPedidos } = await db
    .from("refund_requests")
    .select("subscription_id, status")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (erroPedidos) throw erroPedidos;
  const lista = (pedidos ?? []) as Array<{ subscription_id: string | null; status: string | null }>;

  // Navigation only: the authenticated server verifies identity and protected role.
  // Failure leaves the shortcut hidden; request-refund still checks every rule.
  let windowException = false;
  if (verifyWindow) {
    try {
      const { data, error } = await supabase.functions.invoke("refund-assistant", { body: { action: "start", sandbox } });
      windowException = !error && data?.facts?.windowException === true;
    } catch {
      windowException = false;
    }
  }
  return { mode: getRefundMode(assinatura, lista, Date.now(), { waiveWindow: windowException }), assinatura, windowException };
};
