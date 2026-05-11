/**
 * useStartMode
 *
 * Centraliza a lógica do Start Mode:
 * - Usuários GRATUITOS (gratis / go / sem assinatura ativa) → Start Mode ATIVO automaticamente
 * - Usuários PAGOS (pro / business com status active) → Start Mode DESATIVADO automaticamente
 *
 * Usuários gratuitos NÃO podem desligar o Start Mode manualmente.
 * Usuários pagos nunca entram no Start Mode.
 */

import { useEffect, useMemo } from "react";
import { usePlan } from "@/hooks/usePlan";

/** Planos que são considerados "pagos" e desativam o Start Mode */
const PAID_PLANS = new Set(["pro", "business"]);

export type UseStartModeResult = {
  /** Se o Start Mode está ativo agora */
  isStartMode: boolean;
  /** Se o usuário tem plano pago (pode sair do Start Mode) */
  hasActivePlan: boolean;
  /** Se ainda está carregando o plano do servidor */
  loading: boolean;
};

export const useStartMode = (): UseStartModeResult => {
  const { plan, status, loading } = usePlan();

  const hasActivePlan = useMemo(
    () => status === "active" && PAID_PLANS.has(plan),
    [plan, status]
  );

  // Start Mode ativo quando: ainda carregando (evita flash) OU usuário não tem plano pago
  const isStartMode = loading ? false : !hasActivePlan;

  // Sincroniza o localStorage para que DashboardLayout e Sidebar leiam o mesmo valor
  // sem precisar de polling — a fonte da verdade é o banco, não o localStorage
  useEffect(() => {
    if (loading) return;
    // Grava no localStorage para compatibilidade com código legado que ainda lê de lá
    localStorage.setItem("velo-start-mode", String(isStartMode));
    // Dispara evento para que outros listeners (DashboardLayout) atualizem
    window.dispatchEvent(new Event("storage"));
  }, [isStartMode, loading]);

  return { isStartMode, hasActivePlan, loading };
};
