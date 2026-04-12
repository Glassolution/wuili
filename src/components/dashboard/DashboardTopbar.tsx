import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

import NotificacoesPopover from "@/components/dashboard/NotificacoesPopover";
import {
  Menu, Search, ChevronRight, X, type LucideIcon,
  LayoutGrid, ShoppingCart, BookOpen, Star, Users,
  BarChart3, Settings, MessageCircle, Wallet, ArrowLeftRight, CreditCard,
  Monitor, MessageSquare,
} from "lucide-react";

const pageTitles: Record<string, string> = {
  "/dashboard": "Início",
  "/dashboard/saldos": "Saldos",
  "/dashboard/transacoes": "Transações",
  "/dashboard/clientes": "Clientes",
  "/dashboard/produtos": "Produtos",
  "/dashboard/dropshipping": "Produtos",
  "/dashboard/pedidos": "Pedidos",
  "/dashboard/publicacoes": "Publicações",
  "/dashboard/pagamentos": "Pagamentos",
  "/dashboard/relatorios": "Relatórios",
  "/dashboard/ia": "Chat IA",
  "/dashboard/configuracoes": "Configurações",
};

type MobileMenuItem = { icon: LucideIcon; label: string; path: string };

const mobileItems: MobileMenuItem[] = [
  { icon: LayoutGrid, label: "Início", path: "/dashboard" },
  { icon: ShoppingCart, label: "Pedidos", path: "/dashboard/pedidos" },
  { icon: BookOpen, label: "Produtos", path: "/dashboard/produtos" },
  { icon: BookOpen, label: "Dropshipping", path: "/dashboard/dropshipping" },
  { icon: Star, label: "Publicações", path: "/dashboard/publicacoes" },
  { icon: Users, label: "Clientes", path: "/dashboard/clientes" },
  { icon: Wallet, label: "Saldos", path: "/dashboard/saldos" },
  { icon: ArrowLeftRight, label: "Transações", path: "/dashboard/transacoes" },
  { icon: CreditCard, label: "Pagamentos", path: "/dashboard/pagamentos" },
  { icon: BarChart3, label: "Relatórios", path: "/dashboard/relatorios" },
  { icon: MessageCircle, label: "Chat IA", path: "/dashboard/ia" },
  { icon: Settings, label: "Configurações", path: "/dashboard/configuracoes" },
];

const DashboardTopbar = () => {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pageTitle = pageTitles[location.pathname] || "Dashboard";

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-background px-4">
        {/* Mobile menu */}
        <button className="md:hidden text-muted-foreground" onClick={() => setMobileOpen(true)}>
          <Menu size={20} />
        </button>

        {/* Breadcrumb — store name style like reference */}
        <div className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
          <span className="font-semibold text-foreground">Velo</span>
          <ChevronRight size={13} />
          <span>{pageTitle}</span>
        </div>

        {/* Search — centered */}
        <div className="flex flex-1 justify-center">
          <div className="relative w-full max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              className="w-full rounded-xl border border-border bg-muted/50 py-2 pl-8 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              placeholder="Search or Press '/' for commands"
            />
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3 shrink-0">
          <button className="text-muted-foreground hover:text-foreground transition-colors" title="Monitor">
            <Monitor size={18} />
          </button>
          <button className="text-muted-foreground hover:text-foreground transition-colors" title="Mensagens">
            <MessageSquare size={18} />
          </button>
          <NotificacoesPopover />
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold cursor-pointer">
            Fik
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-foreground/30" onClick={() => setMobileOpen(false)} />
          <div className="absolute bottom-0 left-0 top-0 w-64 border-r border-border bg-background px-3 pb-4 pt-5">
            <div className="mb-5 flex items-center justify-between px-2">
              <span className="text-lg font-black">Velo</span>
              <button onClick={() => setMobileOpen(false)}><X size={20} /></button>
            </div>
            <div className="space-y-1">
              {mobileItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <item.icon size={16} className="shrink-0" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DashboardTopbar;
