import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/*
 * Situação do cliente para reembolso/cancelamento: o que ele pode fazer agora.
 * Usado pelo cartão do chat de suporte e pela área de reembolso.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas de reembolso ainda fora dos tipos gerados
const db = supabase as any;

const JANELA_REEMBOLSO_DIAS = 7;

export type RefundMode = "reembolso" | "cancelamento" | "em_analise" | "aprovado" | "cancelado" | "sem_assinatura";

type Assinatura = {
  id: string;
  created_at: string;
  amount: number | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
};

export type RefundStatus = { mode: RefundMode; assinatura: Assinatura | null };

/** O que a pessoa pode fazer agora: pedir reembolso, só cancelar, ou nada. */
export const fetchRefundStatus = async (userId: string): Promise<RefundStatus> => {
  const { data: assinatura } = await db
    .from("subscriptions")
    .select("id, created_at, amount, current_period_end, cancel_at_period_end")
    .eq("user_id", userId)
    .in("status", ["active", "paid", "approved", "authorized"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: pedidos } = await db
    .from("refund_requests")
    .select("subscription_id, status")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  const lista = (pedidos ?? []) as Array<{ subscription_id: string | null; status: string | null }>;

  if (lista.some((p) => p.status === "pending")) return { mode: "em_analise", assinatura };
  if (!assinatura) return { mode: "sem_assinatura", assinatura: null };
  if (lista.some((p) => p.status === "processed" && p.subscription_id === assinatura.id)) {
    return { mode: "aprovado", assinatura };
  }
  if (assinatura.cancel_at_period_end) return { mode: "cancelado", assinatura };

  const dias = (Date.now() - new Date(assinatura.created_at).getTime()) / 86_400_000;
  // reembolso já usado em outra assinatura: o servidor recusa um segundo pedido
  const jaReembolsou = lista.some((p) => p.status === "processed");
  return { mode: dias <= JANELA_REEMBOLSO_DIAS && !jaReembolsou ? "reembolso" : "cancelamento", assinatura };
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
  if (mode === "cancelamento") return { label: "Cancelar plano", enabled: true };
  if (mode === "em_analise") return { label: "Pedido em análise", enabled: false };
  if (mode === "aprovado") return { label: "Reembolso aprovado", enabled: false };
  if (mode === "cancelado") return { label: "Plano já cancelado", enabled: false };
  if (mode === "sem_assinatura") return { label: "Nenhuma assinatura ativa", enabled: false };
  return { label: "Pedir reembolso", enabled: true };
};
