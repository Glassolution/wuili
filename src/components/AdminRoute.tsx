import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { VeloLoadingScreen } from "@/components/ui/velo-loading-screen";
import { useAuth } from "@/contexts/AuthContext";
import { isSupabaseEnabled, supabase } from "@/integrations/supabase/client";
import { isAdminEmail } from "@/lib/adminAccess";

const AdminRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading, role } = useAuth();
  const metadataRole =
    (user?.app_metadata?.role as string | undefined) ??
    (user?.user_metadata?.role as string | undefined) ??
    null;
  const emailRole = isAdminEmail(user?.email) ? "admin" : null;
  const initialAdmin = useMemo(
    () => role === "admin" || metadataRole === "admin" || emailRole === "admin",
    [emailRole, metadataRole, role]
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
      const [hasRoleResult, profileByUserId, profileById, userRole] = await Promise.allSettled([
        supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
        (supabase as any).from("profiles").select("role").eq("user_id", user.id).maybeSingle(),
        (supabase as any).from("profiles").select("role").eq("id", user.id).maybeSingle(),
        (supabase as any).from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
      ]);

      if (!active) return;

      const candidates = [role, metadataRole, emailRole].filter(Boolean) as string[];
      if (hasRoleResult.status === "fulfilled" && hasRoleResult.value.data === true) {
        candidates.push("admin");
      }
      for (const result of [profileByUserId, profileById, userRole]) {
        if (result.status === "fulfilled" && result.value?.data?.role) {
          candidates.push(String(result.value.data.role));
        }
      }

      setIsAdmin(candidates.includes("admin"));
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
  }, [emailRole, initialAdmin, metadataRole, role, user]);

  if (loading || roleLoading) {
    return <VeloLoadingScreen message="Carregando painel..." />;
  }

  if (!user || !effectiveIsAdmin) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

export default AdminRoute;
