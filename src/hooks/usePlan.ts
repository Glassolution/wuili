import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { resolveAfter } from "@/lib/requestTimeout";

export type PlanName = "gratis" | "go" | "pro" | "business";

type PlanState = {
  plan: PlanName;
  status: "active" | "pending" | "inactive" | "cancelled";
  loading: boolean;
};

const NORMALIZE: Record<string, PlanName> = {
  gratis: "gratis",
  free: "gratis",
  go: "go",
  plus: "pro",
  pro: "pro",
  business: "business",
};

const DEFAULT_PLAN: PlanState = { plan: "gratis", status: "inactive", loading: false };

export const usePlan = (): PlanState => {
  const { user, loading: authLoading } = useAuth();

  const planQuery = useQuery({
    queryKey: ["user-plan", user?.id],
    enabled: !authLoading && !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    queryFn: async ({ signal }) => {
      const subResult = await Promise.race([
        supabase
          .from("subscriptions")
          .select("plan, status")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .abortSignal(signal)
          .maybeSingle(),
        resolveAfter(4500, { data: null, error: null } as any),
      ]);
      const sub = subResult.data;

      if (sub && sub.status === "active") {
        return {
          plan: NORMALIZE[sub.plan] ?? "gratis",
          status: "active",
          loading: false,
        } satisfies PlanState;
      }

      const profileResult = await Promise.race([
        supabase
          .from("profiles")
          .select("plano")
          .eq("user_id", user!.id)
          .abortSignal(signal)
          .maybeSingle(),
        resolveAfter(4500, { data: null, error: null } as any),
      ]);
      const profile = profileResult.data;

      const plan = NORMALIZE[profile?.plano ?? "gratis"] ?? "gratis";
      return {
        plan,
        status: plan === "gratis" ? "inactive" : "active",
        loading: false,
      } satisfies PlanState;
    },
  });

  if (authLoading) return { ...DEFAULT_PLAN, loading: true };
  if (!user) return DEFAULT_PLAN;
  if (planQuery.isLoading) return { ...DEFAULT_PLAN, loading: true };

  return planQuery.data ?? DEFAULT_PLAN;
};
