import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlan, type PlanName } from "@/hooks/usePlan";
import { resolveAfter } from "@/lib/requestTimeout";

type PlanLimits = {
  marketplaces: number | null;
  advancedReports: boolean;
  prioritySupport: boolean;
  dedicatedSupport: boolean;
  apiAccess: boolean;
};

type Usage = {
  connectedMarketplaces: number;
};

const LIMITS: Record<PlanName, PlanLimits> = {
  gratis: {
    marketplaces: 1,
    advancedReports: false,
    prioritySupport: false,
    dedicatedSupport: false,
    apiAccess: false,
  },
  go: {
    marketplaces: 1,
    advancedReports: false,
    prioritySupport: false,
    dedicatedSupport: false,
    apiAccess: false,
  },
  pro: {
    marketplaces: 2,
    advancedReports: true,
    prioritySupport: true,
    dedicatedSupport: false,
    apiAccess: false,
  },
  business: {
    marketplaces: null,
    advancedReports: true,
    prioritySupport: true,
    dedicatedSupport: true,
    apiAccess: true,
  },
};

const hasReachedLimit = (used: number, limit: number | null) =>
  typeof limit === "number" && used >= limit;

export const usePlanLimits = () => {
  const { user, loading: authLoading } = useAuth();
  const planState = usePlan();

  const usageQuery = useQuery({
    queryKey: ["plan-usage", user?.id],
    enabled: !authLoading && !!user,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    queryFn: async ({ signal }) => {
      const integrationsResult = await Promise.race([
        supabase
          .from("user_integrations")
          .select("platform, access_token")
          .eq("user_id", user!.id)
          .abortSignal(signal),
        resolveAfter(4500, { data: [], error: null } as any),
      ]);

      const connectedPlatforms = new Set(
        (integrationsResult.data ?? [])
          .filter((integration) => !!integration.access_token)
          .map((integration) => integration.platform)
      );

      return {
        connectedMarketplaces: connectedPlatforms.size,
      } satisfies Usage;
    },
  });

  const limits = LIMITS[planState.plan] ?? LIMITS.gratis;
  const usage = usageQuery.data ?? { connectedMarketplaces: 0 };

  return useMemo(() => {
    const loading = authLoading || planState.loading || usageQuery.isLoading;

    return {
      plan: planState.plan,
      planStatus: planState.status,
      limits,
      usage,
      loading,
      isFree: planState.plan === "gratis" || planState.plan === "go",
      hasAdvancedReports: limits.advancedReports,
      hasPrioritySupport: limits.prioritySupport,
      hasDedicatedSupport: limits.dedicatedSupport,
      hasApiAccess: limits.apiAccess,
      canPublishToMarketplace: planState.plan === "pro" || planState.plan === "business",
      canConnectMarketplace: !hasReachedLimit(usage.connectedMarketplaces, limits.marketplaces),
      refreshUsage: usageQuery.refetch,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, limits, planState.loading, planState.plan, planState.status, usage, usageQuery.isLoading, usageQuery.refetch]);
};

export type UsePlanLimitsResult = ReturnType<typeof usePlanLimits>;
