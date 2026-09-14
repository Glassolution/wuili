import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { resetDashboardIntro } from "@/lib/dashboardIntro";

/**
 * Rearma a introdução do dashboard quando o usuário sai da conta, para que o próximo
 * login volte a exibi-la. Fica no topo da árvore porque a DashboardHomePage é
 * desmontada no logout e não conseguiria observar essa transição sozinha.
 */
const DashboardIntroSessionGuard = () => {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || user) return;
    resetDashboardIntro();
  }, [loading, user]);

  return null;
};

export default DashboardIntroSessionGuard;
