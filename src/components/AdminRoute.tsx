import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";

const ADMIN_EMAILS = new Set(["xavierluisfelipe12@gmail.com"]);

const AdminRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading, role } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  const isAdmin = role === "admin" || (!!user?.email && ADMIN_EMAILS.has(user.email.toLowerCase()));

  if (!user || !isAdmin) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

export default AdminRoute;
