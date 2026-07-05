import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
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

    if (!user || !isSupabaseEnabled) return;

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
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (!user || !effectiveIsAdmin) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

export default AdminRoute;
