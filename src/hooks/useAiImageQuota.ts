import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

import { PLAN_LIMITS, normalizePlanName } from "@/lib/planLimits";
import { readAccessPlan } from "../../supabase/functions/_shared/subscriptionAccess";

/** Espelha o teto do plano grátis na edge function `generate-product-image`. */
export const LIMITE_MENSAL_GRATUITO = PLAN_LIMITS.gratis.aiImagesPerMonth ?? 3;

export type AiImageQuota = {
  /** null quando o plano não tem teto. */
  restantes: number | null;
  usadas: number;
  ilimitado: boolean;
  carregando: boolean;
};

const inicioDoMesISO = () => {
  const agora = new Date();
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1)).toISOString();
};

/**
 * Consumo de imagens com IA do mês corrente.
 *
 * Isto é só para exibição. Quem bloqueia de fato é a edge function, que roda com
 * service role — o cliente não consegue inserir nem apagar linhas de consumo.
 */
export const useAiImageQuota = () => {
  const { user } = useAuth();
  const [quota, setQuota] = useState<AiImageQuota>({
    restantes: null,
    usadas: 0,
    ilimitado: false,
    carregando: true,
  });

  const carregar = useCallback(async () => {
    if (!user?.id) {
      setQuota((atual) => ({ ...atual, carregando: false }));
      return;
    }

    const [accessPlan, consumo] = await Promise.all([
      readAccessPlan(supabase, user.id),
      supabase
        .from("ai_image_generations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", inicioDoMesISO()),
    ]);

    const plano = normalizePlanName(accessPlan);
    const limite = PLAN_LIMITS[plano].aiImagesPerMonth;
    const usadas = consumo.count ?? 0;

    setQuota({
      ilimitado: limite === null,
      usadas,
      restantes: limite === null ? null : Math.max(0, limite - usadas),
      carregando: false,
    });
  }, [user?.id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /** Aplica a cota devolvida pela edge function após uma geração. */
  const aplicarQuotaDoServidor = useCallback((valor: unknown) => {
    if (!valor || typeof valor !== "object") return;
    const bruto = valor as { restantes?: unknown; usadas?: unknown; ilimitado?: unknown };
    setQuota((atual) => ({
      ...atual,
      restantes: typeof bruto.restantes === "number" ? bruto.restantes : bruto.restantes === null ? null : atual.restantes,
      usadas: typeof bruto.usadas === "number" ? bruto.usadas : atual.usadas,
      ilimitado: typeof bruto.ilimitado === "boolean" ? bruto.ilimitado : atual.ilimitado,
      carregando: false,
    }));
  }, []);

  return { quota, recarregar: carregar, aplicarQuotaDoServidor };
};
