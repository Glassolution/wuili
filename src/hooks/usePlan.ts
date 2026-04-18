import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type PlanName = "gratis" | "go" | "plus" | "pro";

type PlanState = {
  plan: PlanName;
  status: "active" | "pending" | "inactive" | "cancelled";
  loading: boolean;
};

const NORMALIZE: Record<string, PlanName> = {
  gratis: "gratis",
  free: "gratis",
  go: "go",
  plus: "plus",
  pro: "pro",
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
    (async () => {
      // Prefer the latest active subscription; fall back to profile.plano
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("plan, status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (sub && sub.status === "active") {
        setState({
          plan: NORMALIZE[sub.plan] ?? "gratis",
          status: "active",
          loading: false,
        });
        return;
      }

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
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return state;
};
