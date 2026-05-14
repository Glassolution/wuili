import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, isSupabaseEnabled } from "@/integrations/supabase/client";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: string[];
  redirectTo?: string;
}

const ADMIN_EMAILS = new Set(["xavierluisfelipe12@gmail.com"]);

const ProtectedRoute = ({ children, allowedRoles, redirectTo = "/dashboard" }: ProtectedRouteProps) => {
  const { user, loading, role } = useAuth();
  const metadataRole =
    (user?.app_metadata?.role as string | undefined) ??
    (user?.user_metadata?.role as string | undefined) ??
    null;
  const emailRole = user?.email && ADMIN_EMAILS.has(user.email.toLowerCase()) ? "admin" : null;
  const initialRole = useMemo(
    () => emailRole ?? role ?? metadataRole ?? null,
    [emailRole, role, metadataRole]
  );
  const [resolvedRole, setResolvedRole] = useState<string | null>(initialRole);
  const [roleLoading, setRoleLoading] = useState(false);

  useEffect(() => {
    setResolvedRole(initialRole);
  }, [initialRole]);

  useEffect(() => {
    if (!user || !allowedRoles?.length || !isSupabaseEnabled) return;

    let cancelled = false;
    setRoleLoading(true);

    const resolveRole = async () => {
      const candidates = [emailRole, role, metadataRole].filter(Boolean) as string[];

      const [profileByUserId, profileById, userRole] = await Promise.allSettled([
        (supabase as any)
          .from("profiles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle(),
        (supabase as any)
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle(),
        (supabase as any)
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      for (const result of [profileByUserId, profileById, userRole]) {
        if (result.status === "fulfilled" && result.value?.data?.role) {
          candidates.push(result.value.data.role);
        }
      }

      const nextRole =
        candidates.includes("admin") ? "admin" :
        candidates.includes("influencer") ? "influencer" :
        candidates[0] ?? "user";

      if (!cancelled) {
        setResolvedRole(nextRole);
        setRoleLoading(false);
      }
    };

    void resolveRole().catch((error) => {
      console.error("[ProtectedRoute] erro ao resolver role:", error);
      if (!cancelled) setRoleLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [allowedRoles, emailRole, metadataRole, role, user]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-black border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles?.length && isSupabaseEnabled && roleLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-black border-t-transparent" />
      </div>
    );
  }

  if (allowedRoles && (!resolvedRole || !allowedRoles.includes(resolvedRole))) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
