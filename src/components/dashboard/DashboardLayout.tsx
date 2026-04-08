import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardTopbar from "@/components/dashboard/DashboardTopbar";

const DashboardLayout = () => {
  const location = useLocation();
  const navigate  = useNavigate();
  const fullscreen = location.pathname === "/dashboard/ia";

  // Toast de sucesso / erro do OAuth do Mercado Livre
  useEffect(() => {
    const params = new URLSearchParams(location.search);

    if (params.get("ml_connected") === "true") {
      toast.success("Mercado Livre conectado com sucesso! ✅", {
        description: "Seus tokens foram salvos. Você já pode publicar anúncios.",
        duration: 5000,
      });
      // Remove o query param sem recarregar a página
      navigate(location.pathname, { replace: true });
    }

    if (params.get("ml_error")) {
      const errors: Record<string, string> = {
        missing_params: "Parâmetros ausentes na resposta do Mercado Livre.",
        token_failed:   "Não foi possível obter o token. Tente novamente.",
        db_failed:      "Erro ao salvar a integração. Tente novamente.",
      };
      const msg = errors[params.get("ml_error")!] ?? "Erro desconhecido na integração.";
      toast.error("Erro ao conectar Mercado Livre", { description: msg, duration: 6000 });
      navigate(location.pathname, { replace: true });
    }
  }, [location.search]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex h-screen min-h-0 w-full max-w-full overflow-x-hidden bg-background">
      <style>{`
        @keyframes sidebarEntry {
          from { opacity: 0; transform: translateX(-100%); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes topbarEntry {
          from { opacity: 0; transform: translateY(-20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        className="hidden h-full min-h-0 shrink-0 md:block"
        style={{ animation: "sidebarEntry 0.9s cubic-bezier(0.16,1,0.3,1) 0.3s both" }}
      >
        <DashboardSidebar />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {!fullscreen && (
          <div style={{ animation: "topbarEntry 0.8s cubic-bezier(0.16,1,0.3,1) 0.5s both" }}>
            <DashboardTopbar />
          </div>
        )}
        <main className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden ${fullscreen ? "p-0" : "p-4 md:p-8"}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
