import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getRefundMode, type RefundMode, type RefundSubscription } from "./refundEligibility";
export type { RefundMode } from "./refundEligibility";

/*
 * Situação do cliente para reembolso/cancelamento: o que ele pode fazer agora.
 * Usado pelo cartão do chat de suporte e pela área de reembolso.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas de reembolso ainda fora dos tipos gerados
const db = supabase as any;

type Assinatura = RefundSubscription;

export type RefundStatus = { mode: RefundMode; assinatura: Assinatura | null };

/** O que a pessoa pode fazer agora: pedir reembolso, só cancelar, ou nada. */
export const fetchRefundStatus = async (userId: string): Promise<RefundStatus> => {
  const { data: assinatura } = await db
    .from("subscriptions")
    .select("id, created_at, amount, current_period_end, cancel_at_period_end")
    .eq("user_id", userId)
    .in("status", ["active", "paid", "approved", "authorized"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: pedidos } = await db
    .from("refund_requests")
    .select("subscription_id, status")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  const lista = (pedidos ?? []) as Array<{ subscription_id: string | null; status: string | null }>;

  return { mode: getRefundMode(assinatura, lista), assinatura };
};

export const useRefundStatus = (userId: string | null | undefined, enabled: boolean) => {
  const [status, setStatus] = useState<RefundStatus | null>(null);
  const refresh = useCallback(async () => {
    if (!userId) return null;
    try {
      const next = await fetchRefundStatus(userId);
      setStatus(next);
      return next;
    } catch (error) {
      console.error("refund status", error);
      return null;
    }
  }, [userId]);

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

  return { status, refresh };
};

/** Texto do botão do cartão no chat, conforme a situação. */
export const refundCardAction = (mode: RefundMode | undefined) => {
  if (mode === "cancelamento") return { label: "Cancelar renovação", enabled: true };
  if (mode === "em_analise") return { label: "Pedido em análise", enabled: false };
  if (mode === "aprovado") return { label: "Reembolso aprovado", enabled: false };
  if (mode === "cancelado") return { label: "Plano já cancelado", enabled: false };
  if (mode === "sem_assinatura") return { label: "Nenhuma assinatura ativa", enabled: false };
  return { label: "Pedir reembolso", enabled: true };
};
