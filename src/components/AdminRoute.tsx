import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type AdminRoleParams =
  | { _role: string }
  | { role: string }
  | { _user_id: string; _role: string }
  | { user_id: string; role: string };

type AdminRoleClient = {
  rpc: (fn: "has_role", params: AdminRoleParams) => Promise<{ data: boolean | null; error: unknown }>;
  from: (table: "profiles") => {
    select: (columns: "role") => {
      or: (filters: string) => {
        maybeSingle: () => Promise<{ data: { role?: string } | null; error: unknown }>;
      };
    };
  };
};

async function checkAdminAccess(userId: string) {
  const adminClient = supabase as unknown as AdminRoleClient;
  const roleChecks = [
    { _role: "admin" },
    { role: "admin" },
    { _user_id: userId, _role: "admin" },
    { user_id: userId, role: "admin" },
  ] satisfies AdminRoleParams[];

  for (const params of roleChecks) {
    const { data, error } = await adminClient.rpc("has_role", params);
    if (!error && data === true) return true;
  }

  const { data, error } = await adminClient
    .from("profiles")
    .select("role")
    .or(`id.eq.${userId},user_id.eq.${userId}`)
    .maybeSingle();

  if (error) return false;
  return data?.role === "admin";
}

const AdminRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();

  const { data: isAdmin = false, isLoading: loadingRole } = useQuery({
    queryKey: ["admin-route-access", user?.id],
    enabled: !!user?.id,
    queryFn: () => checkAdminAccess(user!.id),
  });

  if (loading || loadingRole) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (!user || !isAdmin) return <Navigate to="/" replace />;

  return <>{children}</>;
};

export default AdminRoute;
