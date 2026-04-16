import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardTopbar from "@/components/dashboard/DashboardTopbar";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

const DashboardLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {

  useEffect(() => {
    const params = new URLSearchParams(location.search);

    if (params.get("ml_connected") === "true") {
      toast.success("Mercado Livre conectado com sucesso!", {
        description: "Seus tokens foram salvos. Voce ja pode publicar anuncios.",
        duration: 5000,
      });
      navigate(location.pathname, { replace: true });
    }

    if (params.get("ml_error")) {
      const errors: Record<string, string> = {
        missing_params: "Parametros ausentes na resposta do Mercado Livre.",
        token_failed: "Nao foi possivel obter o token. Tente novamente.",
        db_failed: "Erro ao salvar a integracao. Tente novamente.",
      };
      const msg = errors[params.get("ml_error")!] ?? "Erro desconhecido na integracao.";
      toast.error("Erro ao conectar Mercado Livre", { description: msg, duration: 6000 });
      navigate(location.pathname, { replace: true });
    }
  }, [location.search]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="dashboard-inter flex h-screen min-h-0 w-full max-w-full overflow-x-hidden bg-background">
      <div className="hidden h-full min-h-0 shrink-0 md:block" style={{ animation: "sidebarEntry 0.9s cubic-bezier(0.16,1,0.3,1) 0.3s both" }}>
        <DashboardSidebar />
      </div>
      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div style={{ animation: "topbarEntry 0.8s cubic-bezier(0.16,1,0.3,1) 0.5s both" }}>
          <DashboardTopbar />
        </div>
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
