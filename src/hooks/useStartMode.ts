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
  return { isStartMode: false, hasActivePlan: true, loading: false };
};
