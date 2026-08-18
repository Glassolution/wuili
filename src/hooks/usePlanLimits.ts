import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlan } from "@/hooks/usePlan";
import {
  PLAN_LIMITS,
  canConnectMarketplace,
  canCreateAgent,
  canCreateAutomation,
  canPublishProducts,
  canUseAdvancedAI,
  hasReachedLimit,
  remainingLimit,
} from "@/lib/planLimits";

type Usage = {
  connectedMarketplaces: number;
  publishedProducts: number;
  aiAgents: number;
  automations: number;
};

export const usePlanLimits = () => {
  const { user, loading: authLoading } = useAuth();
  const planState = usePlan();
  const [usage, setUsage] = useState<Usage>({
    connectedMarketplaces: 0,
    publishedProducts: 0,
    aiAgents: 0,
    automations: 0,
  });
  const [usageLoading, setUsageLoading] = useState(true);

  const fetchUsage = async () => {
    if (!user) {
      setUsage({
        connectedMarketplaces: 0,
        publishedProducts: 0,
        aiAgents: 0,
        automations: 0,
      });
      setUsageLoading(false);
      return;
    }

    setUsageLoading(true);

    try {
      const [integrationsResult, activePublicationsResult] = await Promise.all([
        supabase
          .from("user_integrations")
          .select("platform, access_token")
          .eq("user_id", user.id),
        supabase
          .from("user_publications" as any)
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .in("status", ["active", "published"]),
      ]);

      if (integrationsResult.error) {
        console.warn("[usePlanLimits] failed to load user_integrations", integrationsResult.error);
      }

      const connectedPlatforms = new Set(
        (integrationsResult.data ?? [])
          .filter((integration) => !!integration.access_token)
          .map((integration) => integration.platform)
      );

      let publishedProducts = activePublicationsResult.count ?? 0;
      if (activePublicationsResult.error) {
        const fallbackPublicationsResult = await supabase
          .from("user_publications" as any)
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);
        publishedProducts = fallbackPublicationsResult.count ?? 0;
      }

      setUsage({
        connectedMarketplaces: connectedPlatforms.size,
        publishedProducts,
        aiAgents: 0,
        automations: 0,
      });
    } catch (err) {
      // Sem isto, uma falha aqui virava uma promise rejeitada sem handler
      // (o efeito chama fetchUsage com `void`) — o uso ficava travado no
      // valor inicial (zeros) sem nenhum aviso no console.
      console.error("[usePlanLimits] failed to load usage", err);
    } finally {
      setUsageLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    void fetchUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  const limits = PLAN_LIMITS[planState.plan] ?? PLAN_LIMITS.gratis;

  return useMemo(() => {
    const loading = authLoading || planState.loading || usageLoading;
    const canPublish = canPublishProducts(planState.plan, usage);
    const productLimitReached = hasReachedLimit(usage.publishedProducts, limits.products);

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
      canPublishProducts: canPublish,
      canPublishToMarketplace: canPublish,
      canConnectMarketplace: canConnectMarketplace(planState.plan, usage),
      canCreateAutomation: canCreateAutomation(planState.plan, usage),
      canUseAdvancedAI: canUseAdvancedAI(planState.plan),
      canCreateAgent: canCreateAgent(planState.plan, usage),
      canUseAnalytics: limits.analytics !== "none",
      canUseMonitoring: limits.monitoring !== "none",
      canUseAutoReplies: limits.autoReplies !== "none",
      productLimitReached,
      publishedProductLimit: limits.products,
      remainingPublishedProducts: remainingLimit(usage.publishedProducts, limits.products),
      refreshUsage: fetchUsage,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, limits, planState.loading, planState.plan, planState.status, usage, usageLoading]);
};

export type UsePlanLimitsResult = ReturnType<typeof usePlanLimits>;
