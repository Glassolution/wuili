import { Bell, Menu } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Package, ShoppingCart, Rocket, BarChart3, Settings, X } from "lucide-react";

const pageTitles: Record<string, string> = {
  "/dashboard": "Visão Geral",
  "/dashboard/catalogo": "Catálogo de Fornecedores",
  "/dashboard/pedidos": "Pedidos Recebidos",
  "/dashboard/publicacoes": "Publicações",
  "/dashboard/relatorios": "Relatórios",
  "/dashboard/configuracoes": "Configurações",
};

const mobileMenu = [
  { icon: Home, label: "Visão Geral", path: "/dashboard" },
  { icon: Package, label: "Catálogo", path: "/dashboard/catalogo" },
  { icon: ShoppingCart, label: "Pedidos", path: "/dashboard/pedidos" },
  { icon: Rocket, label: "Publicações", path: "/dashboard/publicacoes" },
  { icon: BarChart3, label: "Relatórios", path: "/dashboard/relatorios" },
  { icon: Settings, label: "Configurações", path: "/dashboard/configuracoes" },
];

const DashboardTopbar = () => {
  const location = useLocation();
  const title = pageTitles[location.pathname] || "Dashboard";
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <header className="h-14 bg-background border-b border-border flex items-center justify-between px-6 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button className="md:hidden" onClick={() => setMobileOpen(true)}>
            <Menu size={20} />
          </button>
          <h1 className="text-lg font-bold">{title}</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-success">
            <span className="w-2 h-2 rounded-full bg-success" />
            Online
          </span>
          <button className="relative">
            <Bell size={18} className="text-muted-foreground" />
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-destructive text-primary-foreground text-[9px] font-bold flex items-center justify-center">3</span>
          </button>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
            TD
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-foreground/30" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-background p-4 space-y-1">
            <div className="flex items-center justify-between mb-6">
              <span className="text-xl font-black">Wuili</span>
              <button onClick={() => setMobileOpen(false)}><X size={20} /></button>
            </div>
            {mobileMenu.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === item.path
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default DashboardTopbar;
