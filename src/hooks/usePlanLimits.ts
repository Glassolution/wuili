import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlan, type PlanName } from "@/hooks/usePlan";

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
  const [usage, setUsage] = useState<Usage>({ connectedMarketplaces: 0 });
  const [usageLoading, setUsageLoading] = useState(true);

  const fetchUsage = async () => {
    if (!user) {
      setUsage({ connectedMarketplaces: 0 });
      setUsageLoading(false);
      return;
    }

    setUsageLoading(true);

    try {
      const integrationsResult = await supabase
        .from("user_integrations")
        .select("platform, access_token")
        .eq("user_id", user.id);

      const connectedPlatforms = new Set(
        (integrationsResult.data ?? [])
          .filter((integration) => !!integration.access_token)
          .map((integration) => integration.platform)
      );

      setUsage({
        connectedMarketplaces: connectedPlatforms.size,
      });
    } finally {
      setUsageLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    void fetchUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  const limits = LIMITS[planState.plan] ?? LIMITS.gratis;

  return useMemo(() => {
    const loading = authLoading || planState.loading || usageLoading;

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
      refreshUsage: fetchUsage,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, limits, planState.loading, planState.plan, planState.status, usage, usageLoading]);
};

export type UsePlanLimitsResult = ReturnType<typeof usePlanLimits>;
