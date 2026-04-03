import { Link, useLocation } from "react-router-dom";
import {
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  ChevronUp,
  CreditCard,
  LayoutGrid,
  MessageCircle,
  Settings,
  ShoppingCart,
  Star,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { useProfile } from "@/lib/profileContext";
type SidebarItem = {
  icon: LucideIcon;
  label: string;
  path: string;
};

const mainItems: SidebarItem[] = [
  { icon: LayoutGrid, label: "Página inicial", path: "/dashboard" },
  { icon: ShoppingCart, label: "Pedidos", path: "/dashboard/pedidos" },
  { icon: BookOpen, label: "Catálogo", path: "/dashboard/catalogo" },
  { icon: Star, label: "Publicações", path: "/dashboard/publicacoes" },
  { icon: Users, label: "Clientes", path: "/dashboard/clientes" },
  { icon: Wallet, label: "Saldos", path: "/dashboard/saldos" },
  { icon: ArrowLeftRight, label: "Transações", path: "/dashboard/transacoes" },
  { icon: CreditCard, label: "Pagamentos", path: "/dashboard/pagamentos" },
  { icon: BarChart3, label: "Relatórios", path: "/dashboard/relatorios" },
];

const DashboardSidebar = () => {
  const location = useLocation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { nome, foto } = useProfile();

  const iniciais = nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-full w-56 flex-col border-r border-border bg-background md:flex">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 pb-4 pt-6">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-black">
          W
        </div>
        <Link to="/" className="text-lg font-black tracking-tight text-foreground">Wuili</Link>
      </div>

      <nav className="flex-1 px-3 pb-4 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {/* IA de Produtos */}
        <div className="mb-4">
          <Link
            to="/dashboard/ia"
            className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition-all ${
              location.pathname === "/dashboard/ia"
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-primary/10 text-primary hover:bg-primary/20"
            }`}
          >
            <MessageCircle size={17} className="shrink-0" />
            <span>IA de Produtos</span>
          </Link>
        </div>

        {/* Main items */}
        <div className="space-y-0.5">
          {mainItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors ${
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary" />
                )}
                <item.icon size={17} className="shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3 space-y-1">
        <Link
          to="/dashboard/configuracoes"
          className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            location.pathname === "/dashboard/configuracoes"
              ? "text-muted-foreground bg-muted"
              : "text-muted-foreground/60 hover:bg-muted hover:text-muted-foreground"
          }`}
        >
          <Settings size={15} className="shrink-0" />
          Configurações
        </Link>

        {/* User card with dropdown */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted transition-colors"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground overflow-hidden">
              {foto ? <img src={foto} alt="avatar" className="w-full h-full object-cover" /> : iniciais}
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-foreground leading-tight">{nome}</p>
              <p className="text-xs text-muted-foreground">Plano Pro</p>
            </div>
            <ChevronUp
              size={14}
              className={`text-muted-foreground transition-transform ${userMenuOpen ? "" : "rotate-180"}`}
            />
          </button>

          {userMenuOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-1 rounded-xl border border-border bg-background shadow-lg overflow-hidden">
              <Link to="/dashboard/configuracoes" onClick={() => setUserMenuOpen(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors">
                Perfil
              </Link>
              <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-destructive hover:bg-muted transition-colors">
                Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
