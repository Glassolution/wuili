import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import NotificacoesPopover from "@/components/dashboard/NotificacoesPopover";
import {
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  CreditCard,
  LayoutGrid,
  Menu,
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
import BrandMark from "@/components/brand/BrandMark";

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
  "/dashboard": "Pagina inicial",
  "/dashboard/saldos": "Saldos",
  "/dashboard/transacoes": "Transacoes",
  "/dashboard/clientes": "Clientes",
  "/dashboard/catalogo": "Catalogo de Fornecedores",
  "/dashboard/pedidos": "Pedidos",
  "/dashboard/publicacoes": "Publicacoes",
  "/dashboard/payments": "Payments",
  "/dashboard/pagamentos": "Pagamentos",
  "/dashboard/relatorios": "Relatorios",
  "/dashboard/mais": "Mais",
  "/dashboard/ia": "IA de Produtos",
  "/dashboard/notificacoes": "Notificacoes",
  "/dashboard/configuracoes": "Configuracoes",
};

const mobileSections: MobileMenuSection[] = [
  {
    items: [
      { icon: LayoutGrid, label: "Pagina inicial", path: "/dashboard" },
      { icon: Wallet, label: "Saldos", path: "/dashboard/saldos" },
      { icon: ArrowLeftRight, label: "Transacoes", path: "/dashboard/transacoes" },
      { icon: Users, label: "Clientes", path: "/dashboard/clientes" },
      { icon: BookOpen, label: "Catalogo", path: "/dashboard/catalogo" },
      { icon: ShoppingCart, label: "Pedidos", path: "/dashboard/pedidos" },
      { icon: Star, label: "Publicacoes", path: "/dashboard/publicacoes" },
    ],
  },
  {
    title: "Produtos",
    items: [
      { icon: CreditCard, label: "Pagamentos", path: "/dashboard/pagamentos" },
      { icon: BarChart3, label: "Relatorios", path: "/dashboard/relatorios" },
      { icon: MoreHorizontal, label: "Mais", path: "/dashboard/mais" },
      { icon: Sparkles, label: "IA de Produtos", path: "/dashboard/ia" },
      { icon: Settings, label: "Configuracoes", path: "/dashboard/configuracoes" },
    ],
  },
];

const DashboardTopbar = () => {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const getMobileItemClassName = (active: boolean) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      active
        ? "bg-white/10 text-white"
        : "text-slate-400 hover:bg-white/6 hover:text-white"
    }`;

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 bg-[#0b0d1bcc]/80 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button className="text-white md:hidden" onClick={() => setMobileOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="hidden md:block">
            <div className="label-upper">Dashboard</div>
            <div className="mt-1 font-['Syne'] text-xl font-bold text-white">
              {pageTitles[location.pathname] || "Command Center"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-medium text-emerald-200 sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            Online
          </span>
          <NotificacoesPopover />
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute bottom-0 left-0 top-0 w-72 border-r border-white/10 bg-[#090b17] px-3 pb-4 pt-5">
            <div className="mb-5 flex items-center justify-between px-2">
              <BrandMark size="sm" showWordmark />
              <button onClick={() => setMobileOpen(false)} className="text-white"><X size={20} /></button>
            </div>
            {mobileSections.map((section) => (
              <div key={section.title || "principal"} className="mb-5 last:mb-0">
                {section.title && (
                  <p className="px-3 pb-2 pt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
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
