import { useEffect, useState } from "react";
import { supabase, isSupabaseEnabled } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const SUSPENDED_STATUSES = ["pending_regularization", "cancelled_unpaid"];

export type AccountSuspension = {
  suspended: boolean;
  status: string | null;
  plan: string | null;
  loading: boolean;
};

/**
 * Contas ativadas indevidamente pela falha do gateway ficam em
 * "pending_regularization" (e depois "cancelled_unpaid"). Enquanto isso o
 * acesso à plataforma fica pausado — o cadastro e o histórico permanecem.
 */
export const useAccountSuspension = (): AccountSuspension => {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<AccountSuspension>({
    suspended: false,
    status: null,
    plan: null,
    loading: true,
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isSupabaseEnabled) {
      setState({ suspended: false, status: null, plan: null, loading: false });
      return;
    }

    let cancelled = false;

    void (async () => {
      const [{ data }, { data: activeSub }] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("status, plan")
          .eq("user_id", user.id)
          .in("status", SUSPENDED_STATUSES)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        // Quem regularizou (ou assinou de novo) tem assinatura ativa: libera na hora.
        supabase
          .from("subscriptions")
          .select("id")
          .eq("user_id", user.id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle(),
      ]);

      if (cancelled) return;
      setState({
        suspended: !!data && !activeSub,
        status: data?.status ?? null,
        plan: data?.plan ?? null,
        loading: false,
      });
    })().catch(() => {
      if (!cancelled) setState({ suspended: false, status: null, plan: null, loading: false });
    });

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return state;
};
