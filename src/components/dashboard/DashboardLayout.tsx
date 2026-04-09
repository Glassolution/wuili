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
    <div className="flex h-screen min-h-0 w-full max-w-full overflow-x-hidden bg-[#0f1117]">
      <div className="hidden h-full min-h-0 shrink-0 md:block">
        <DashboardSidebar />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {!fullscreen && (
          <DashboardTopbar />
        )}
        <main className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden ${fullscreen ? "p-0" : "p-4 md:p-8"}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;