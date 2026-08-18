import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
      const { data: subs } = await supabase
        .from("subscriptions")
        .select("plan, status")
        .eq("user_id", user.id)
        .in("status", ["active", "paid", "approved", "trialing"]);

      if (cancelled) return;

      const RANK: Record<PlanName, number> = {
        gratis: 0, base: 1, go: 1, pro: 2, business: 3,
      };
      const best = (subs ?? [])
        .map((s) => NORMALIZE[s.plan] ?? "gratis")
        .sort((a, b) => RANK[b] - RANK[a])[0];

      if (best && best !== "gratis") {
        setState({ plan: best, status: "active", loading: false });
        return;
      }

      // 2. Fall back to profile plano field
      const { data: profile } = await supabase
        .from("profiles")
        .select("plano")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      const plan = NORMALIZE[profile?.plano ?? "gratis"] ?? "gratis";
      setState({
        plan,
        status: plan === "gratis" ? "inactive" : "active",
        loading: false,
      });
    };

    fetchPlan();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return state;
};
