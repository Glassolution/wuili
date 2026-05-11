import { Component, useEffect, useState, type ReactNode } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import StartModeBanner from "@/components/dashboard/StartModeBanner";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

// ── Error Boundary ─────────────────────────────────────────────────────────
type EBState = { error: Error | null };

class PageErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): EBState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[PageErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-border bg-card p-12 text-center shadow-card">
          <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-red-50">
            <span className="text-2xl">⚠</span>
          </div>
          <div>
            <p className="font-['Manrope'] text-[15px] font-semibold text-foreground">
              Ocorreu um erro nesta página
            </p>
            <p className="mt-1 max-w-[400px] text-[12px] text-muted-foreground">
              {this.state.error.message}
            </p>
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            className="rounded-[14px] bg-[#111111] px-6 py-3 text-[13px] font-medium text-white transition-all duration-200 ease-out hover:bg-black/90"
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Layout inner (needs hooks) ─────────────────────────────────────────────
const DashboardLayoutInner = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  // Check if user is in Start Mode (free plan)
  const [isStartMode, setIsStartMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("velo-start-mode") !== "false";
    }
    return true;
  });

  // Listen to localStorage changes
  useEffect(() => {
    const handleStorageChange = () => {
      setIsStartMode(localStorage.getItem("velo-start-mode") !== "false");
    };

    window.addEventListener("storage", handleStorageChange);
    
    // Also check periodically in case of same-tab changes
    const interval = setInterval(handleStorageChange, 500);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, []);

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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-black border-t-transparent dark:border-white dark:border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div 
      className="dashboard-inter flex h-screen min-h-0 w-full max-w-full overflow-x-hidden flex-col" 
      style={{ 
        backgroundColor: isStartMode ? "#FFA640" : "#F4F4F5",
        paddingTop: 0,
        transition: "background-color 280ms ease"
      }}
    >
      {/* Start Mode Banner */}
      <StartModeBanner isStartMode={isStartMode} />
      
      {/* Main Dashboard Layout - Shell cinza com cantos arredondados */}
      <div 
        className="flex h-full min-h-0 w-full max-w-full overflow-x-hidden flex-1"
        style={{
          marginTop: isStartMode ? "48px" : "0",
          borderTopLeftRadius: isStartMode ? "32px" : "0",
          borderTopRightRadius: isStartMode ? "32px" : "0",
          overflow: "hidden",
          backgroundColor: "#F4F4F5",
          minHeight: isStartMode ? "calc(100vh - 48px)" : "100vh",
          position: "relative",
          zIndex: 2,
          transition: "margin-top 280ms ease, border-top-left-radius 280ms ease, border-top-right-radius 280ms ease, min-height 280ms ease"
        }}
      >
        {/* Sidebar - fora da moldura branca */}
        <div className="hidden h-full min-h-0 shrink-0 md:block">
          <DashboardSidebar />
        </div>
        
        {/* Área principal com header e conteúdo */}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {/* Header - no shell cinza */}
          <DashboardHeader />
          
          {/* Main content area - moldura branca arredondada */}
          <main className="flex min-h-0 flex-1 overflow-hidden" style={{ backgroundColor: "#F4F4F5", padding: "0 24px 24px 24px" }}>
            <div 
              className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white" 
              style={{ 
                borderRadius: "28px",
                overflow: "hidden",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
              }}
            >
              {/* Área rolável interna */}
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden" style={{ padding: "24px" }}>
                <div className="mx-auto w-full max-w-[1280px]">
                  <PageErrorBoundary>
                    <Outlet />
                  </PageErrorBoundary>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

const DashboardLayout = () => <DashboardLayoutInner />;

export default DashboardLayout;
