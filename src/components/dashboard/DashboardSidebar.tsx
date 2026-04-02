import { Link, useLocation } from "react-router-dom";
import { Home, Package, ShoppingCart, Rocket, BarChart3, Settings } from "lucide-react";

const menuItems = [
  { icon: Home, label: "Visão Geral", path: "/dashboard" },
  { icon: Package, label: "Catálogo", path: "/dashboard/catalogo" },
  { icon: ShoppingCart, label: "Pedidos", path: "/dashboard/pedidos" },
  { icon: Rocket, label: "Publicações", path: "/dashboard/publicacoes" },
  { icon: BarChart3, label: "Relatórios", path: "/dashboard/relatorios" },
];

const DashboardSidebar = () => {
  const location = useLocation();

  return (
    <aside className="hidden md:flex flex-col w-56 border-r border-border bg-background fixed top-0 left-0 h-full z-40">
      <div className="p-6">
        <Link to="/" className="text-xl font-black text-foreground">Wuili</Link>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {menuItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? "bg-accent text-accent-foreground font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border">
        <Link
          to="/dashboard/configuracoes"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
            location.pathname === "/dashboard/configuracoes"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <Settings size={18} />
          Configurações
        </Link>
        <div className="flex items-center gap-3 px-3 py-3 mt-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
            TD
          </div>
          <div>
            <p className="text-sm font-medium">TrendStore</p>
            <p className="text-xs text-muted-foreground">Plano Pro</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
