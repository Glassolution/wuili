import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { VeloLoadingScreen } from "@/components/ui/velo-loading-screen";
import { useAuth } from "@/contexts/AuthContext";
import { isSupabaseEnabled, supabase } from "@/integrations/supabase/client";

const AdminRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading, role } = useAuth();
  const initialAdmin = useMemo(
    () => role === "admin",
    [role]
  );
  const [isAdmin, setIsAdmin] = useState(initialAdmin);
  const [roleLoading, setRoleLoading] = useState(false);
  const effectiveIsAdmin = isAdmin || initialAdmin;

  useEffect(() => {
    setIsAdmin(initialAdmin);

    // A sessão já traz a permissão para a maioria dos acessos ao admin. Não
    // repete a consulta remota em cada troca de página, pois isso desmontava o
    // painel inteiro e exibia uma tela de carregamento entre as abas.
    if (!user || !isSupabaseEnabled || initialAdmin) {
      setRoleLoading(false);
      return;
    }

    let active = true;
    setRoleLoading(true);

    const resolveAdminRole = async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user.id);

      if (!active) return;

      setIsAdmin(!error && (data ?? []).some((item) => item.role === "admin"));
      setRoleLoading(false);
    };

    void resolveAdminRole().catch((error) => {
      console.error("[AdminRoute] erro ao resolver role admin:", error);
      if (active) {
        setIsAdmin(initialAdmin);
        setRoleLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [initialAdmin, role, user]);

  if (loading || roleLoading) {
    return <VeloLoadingScreen message="Carregando painel..." />;
  }

  if (!user || !effectiveIsAdmin) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

export default AdminRoute;
