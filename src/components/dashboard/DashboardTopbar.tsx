import { Menu } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import NotificacoesPopover from "@/components/dashboard/NotificacoesPopover";import {
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  CreditCard,
  LayoutGrid,
  MoreHorizontal,
  Settings,
  ShoppingCart,
  Sparkles,
  Star,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";

type MobileMenuItem = {
  icon: LucideIcon;
  label: string;
  path: string;
};

type MobileMenuSection = {
  title?: string;
  items: MobileMenuItem[];
};

const pageTitles: Record<string, string> = {
  "/dashboard": "Página inicial",
  "/dashboard/saldos": "Saldos",
  "/dashboard/transacoes": "Transações",
  "/dashboard/clientes": "Clientes",
  "/dashboard/catalogo": "Catálogo de Fornecedores",
  "/dashboard/pedidos": "Pedidos",
  "/dashboard/publicacoes": "Publicações",
  "/dashboard/payments": "Payments",
  "/dashboard/pagamentos": "Pagamentos",
  "/dashboard/relatorios": "Relatórios",
  "/dashboard/mais": "Mais",
  "/dashboard/ia": "IA de Produtos",
  "/dashboard/notificacoes": "Notificações",
  "/dashboard/configuracoes": "Configurações",
};

const mobileSections: MobileMenuSection[] = [
  {
    items: [
      { icon: LayoutGrid, label: "Página inicial", path: "/dashboard" },
      { icon: Wallet, label: "Saldos", path: "/dashboard/saldos" },
      { icon: ArrowLeftRight, label: "Transações", path: "/dashboard/transacoes" },
      { icon: Users, label: "Clientes", path: "/dashboard/clientes" },
      { icon: BookOpen, label: "Catálogo", path: "/dashboard/catalogo" },
      { icon: ShoppingCart, label: "Pedidos", path: "/dashboard/pedidos" },
      { icon: Star, label: "Publicações", path: "/dashboard/publicacoes" },
    ],
  },
  {
    title: "Produtos",
    items: [
      { icon: CreditCard, label: "Pagamentos", path: "/dashboard/pagamentos" },
      { icon: BarChart3, label: "Relatórios", path: "/dashboard/relatorios" },
      { icon: MoreHorizontal, label: "Mais", path: "/dashboard/mais" },
      { icon: Sparkles, label: "IA de Produtos", path: "/dashboard/ia" },
      { icon: Settings, label: "Configurações", path: "/dashboard/configuracoes" },
    ],
  },
];

const DashboardTopbar = () => {
  const location = useLocation();
  const title = pageTitles[location.pathname] || "Dashboard";
  const [mobileOpen, setMobileOpen] = useState(false);

  const getMobileItemClassName = (active: boolean) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      active
        ? "bg-accent text-accent-foreground"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    }`;

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
          <NotificacoesPopover />
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
            TD
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-foreground/30" onClick={() => setMobileOpen(false)} />
          <div className="absolute bottom-0 left-0 top-0 w-64 border-r border-border bg-background px-3 pb-4 pt-5">
            <div className="mb-5 flex items-center justify-between px-2">
              <span className="text-lg font-black tracking-tight">Wuili</span>
              <button onClick={() => setMobileOpen(false)}><X size={20} /></button>
            </div>
            {mobileSections.map((section) => (
              <div key={section.title || "principal"} className="mb-5 last:mb-0">
                {section.title && (
                  <p className="px-3 pb-2 pt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
                    {section.title}
                  </p>
                )}
                <div className="space-y-1">
                  {section.items.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileOpen(false)}
                      className={getMobileItemClassName(location.pathname === item.path)}
                    >
                      <item.icon size={17} className="shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default DashboardTopbar;
