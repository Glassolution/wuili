import { Link, useLocation } from "react-router-dom";
import {
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  CreditCard,
  FileText,
  LayoutGrid,
  MoreHorizontal,
  Settings,
  ShoppingCart,
  Star,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

type SidebarItem = {
  icon: LucideIcon;
  label: string;
  path: string;
};

type SidebarSection = {
  title?: string;
  items: SidebarItem[];
};

const sections: SidebarSection[] = [
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
      { icon: CreditCard, label: "Payments", path: "/dashboard/payments" },
      { icon: FileText, label: "Billing", path: "/dashboard/billing" },
      { icon: BarChart3, label: "Relatórios", path: "/dashboard/relatorios" },
      { icon: MoreHorizontal, label: "Mais", path: "/dashboard/mais" },
    ],
  },
];

const DashboardSidebar = () => {
  const location = useLocation();

  const getItemClassName = (active: boolean) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors ${
      active
        ? "bg-accent text-accent-foreground"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    }`;

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-full w-56 flex-col border-r border-border bg-background md:flex">
      <div className="px-5 pb-4 pt-6">
        <Link to="/" className="text-lg font-black tracking-tight text-foreground">Wuili</Link>
      </div>

      <nav className="flex-1 px-3 pb-4">
        {sections.map((section) => (
          <div key={section.title || "principal"} className="mb-5 last:mb-0">
            {section.title && (
              <p className="px-3 pb-2 pt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
                {section.title}
              </p>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const active = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={getItemClassName(active)}
                  >
                    <item.icon size={17} className="shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <Link
          to="/dashboard/configuracoes"
          className={getItemClassName(location.pathname === "/dashboard/configuracoes")}
        >
          <Settings size={17} className="shrink-0" />
          Configurações
        </Link>
        <div className="mt-3 flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            TD
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">TrendStore</p>
            <p className="text-xs text-muted-foreground">Plano Pro</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
