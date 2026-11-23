import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { readAccessPlan } from "../../supabase/functions/_shared/subscriptionAccess";

export type PlanName = "gratis" | "go" | "base" | "pro" | "business";

type PlanState = {
  plan: PlanName;
  status: "active" | "pending" | "inactive" | "cancelled";
  loading: boolean;
};

const NORMALIZE: Record<string, PlanName> = {
  gratis: "gratis",
  free: "gratis",
  go: "go",
  base: "base",
  plus: "pro",
  pro: "pro",
  business: "business",
};

export const usePlan = (): PlanState => {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<PlanState>({
    plan: "gratis",
    status: "inactive",
    loading: true,
  });

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setState({ plan: "gratis", status: "inactive", loading: false });
      return;
    }

    let cancelled = false;

    const fetchPlan = async () => {
      // 1. Check active subscription first.
      // O Mercado Pago grava a assinatura com status "active", mas também
      // "paid"/"approved" (pagamento confirmado) e "trialing" (em teste). Se
      // filtrássemos só por "active", um cliente que pagou (ex.: plano Base) mas
      // cuja linha ficou em "paid"/"approved"/"trialing" cairia no fallback e
      // seria tratado como "gratis" — perdendo o direito de publicar a loja.
      // Mesmo conjunto usado em DashboardSidebar/PreviewPage/Admin.
      // Pode haver mais de uma assinatura ativa (upgrade, cobrança recriada,
      // migração). Vale sempre o MAIOR plano ativo — pegar a mais recente
      // rebaixava quem tinha Pro ativo com uma linha Base criada depois.
      try {
        const best = NORMALIZE[await readAccessPlan(supabase, user.id)] ?? "gratis";
        if (!cancelled) setState({ plan: best, status: best === "gratis" ? "inactive" : "active", loading: false });
      } catch (error) {
        console.warn("[usePlan] failed to load access plan", error);
        if (!cancelled) setState(current => ({ ...current, loading: false }));
      }
    };

    void fetchPlan();
    const interval = window.setInterval(() => { void fetchPlan(); }, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [user, authLoading]);

  return state;
};
