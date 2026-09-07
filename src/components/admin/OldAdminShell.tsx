import { useLayoutEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  BadgeDollarSign,
  Bot,
  FileSearch,
  LayoutDashboard,
  Menu,
  MessagesSquare,
  PackageSearch,
  RefreshCcw,
  ShoppingBag,
  type LucideIcon,
  UsersRound,
  X,
} from "lucide-react";
import { OldAdminNewSidebar } from "@/components/admin/OldAdminNewSidebar";

type AdminSection =
  | "dashboard"
  | "users"
  | "sales"
  | "revenue"
  | "plans"
  | "commissions"
  | "support"
  | "refunds"
  | "evidence"
  | "automation"
  | "settings";

type AdminShellProps = {
  active: AdminSection;
  userId: string;
  children: ReactNode;
  fullBleed?: boolean;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
};

const SECTION_LABEL: Record<AdminSection, string> = {
  dashboard: "Painel",
  users: "Usuários",
  sales: "Vendas",
  revenue: "Receita",
  plans: "Planos",
  commissions: "Afiliados",
  support: "Suporte",
  refunds: "Reembolsos",
  evidence: "Evidências",
  automation: "Automação BOT",
  settings: "Integrações",
};

const MOBILE_NAV_ITEMS: Array<{ section: AdminSection; label: string; to: string; icon: LucideIcon }> = [
  { section: "dashboard", label: "Painel", to: "/admin/painel", icon: LayoutDashboard },
  { section: "support", label: "Suporte", to: "/admin/suporte", icon: MessagesSquare },
  { section: "users", label: "Usuários", to: "/admin/usuarios", icon: UsersRound },
  { section: "sales", label: "Vendas", to: "/admin/vendas", icon: ShoppingBag },
  { section: "commissions", label: "Afiliados", to: "/admin/comissoes", icon: BadgeDollarSign },
  { section: "refunds", label: "Reembolsos", to: "/admin/reembolsos", icon: RefreshCcw },
  { section: "evidence", label: "Evidências", to: "/admin/evidencias", icon: FileSearch },
  { section: "automation", label: "Automação BOT", to: "/admin/automacao-bot", icon: Bot },
  { section: "settings", label: "AliExpress", to: "/admin/aliexpress", icon: PackageSearch },
];

const PageHeader = ({
  active,
  title,
  subtitle,
  actions,
}: {
  active: AdminSection;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}) => (
  <header className="flex flex-col gap-4 border-b border-[#eeeeeb] bg-white px-4 py-5 sm:px-6 md:flex-row md:items-end md:justify-between md:px-8 md:py-7">
    <div className="min-w-0">
      <p className="text-[10px] font-medium text-[#8c8c87]">Admin / {SECTION_LABEL[active]}</p>
      {title ? <h1 className="mt-3 text-[22px] font-semibold tracking-[-0.04em] text-[#171715] sm:text-[25px]">{title}</h1> : null}
      {subtitle ? <p className="mt-2 max-w-2xl text-[12px] leading-5 text-[#777772]">{subtitle}</p> : null}
    </div>
    {actions ? <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
  </header>
);

const OldAdminMobileBar = ({ onOpenMenu }: { active: AdminSection; onOpenMenu: () => void }) => {
  return (
    <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-[#e7e7e3] bg-white px-4 md:hidden">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Abrir menu do admin"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#ddddda] bg-white text-[#20201e] shadow-[0_1px_2px_rgba(20,20,16,0.06)]"
      >
        <Menu size={19} strokeWidth={2} />
      </button>
      <Link to="/admin/painel" className="flex min-w-0 items-center gap-2 text-[#11110f] no-underline" aria-label="Velo Admin">
        <img src="/logo.png" alt="" className="h-7 w-7 shrink-0 object-contain" />
        <span className="truncate text-[14px] font-semibold tracking-[-0.025em]">Velo Admin</span>
      </Link>
    </header>
  );
};

const OldAdminMobileDrawer = ({ active, open, onClose }: { active: AdminSection; open: boolean; onClose: () => void }) => {
  const { pathname } = useLocation();

  return (
    <div className={`fixed inset-0 z-[80] md:hidden ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <button
        type="button"
        aria-label="Fechar menu"
        onClick={onClose}
        className={`absolute inset-0 bg-black/35 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
      />
      <aside
        className={`absolute bottom-0 left-0 top-0 flex w-[82vw] max-w-[320px] flex-col border-r border-[#e3e3df] bg-[#f6f6f4] px-4 py-4 shadow-[18px_0_45px_rgba(15,23,42,0.2)] transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between">
          <Link to="/admin/painel" onClick={onClose} className="flex min-w-0 items-center gap-2 text-[#11110f] no-underline" aria-label="Velo Admin">
            <img src="/logo.png" alt="" className="h-8 w-8 shrink-0 object-contain" />
            <span className="truncate text-[15px] font-semibold tracking-[-0.025em]">Velo Admin</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu do admin"
            className="grid h-9 w-9 place-items-center rounded-full border border-[#deded9] bg-white text-[#343431]"
          >
            <X size={17} />
          </button>
        </div>

        <nav aria-label="Navegação do admin" className="mt-6 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          {MOBILE_NAV_ITEMS.map((item) => {
            const target = item.to.replace(/\/$/, "");
            const current = active === item.section || pathname === target || pathname.startsWith(`${target}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onClose}
                aria-current={current ? "page" : undefined}
                className={`flex h-11 items-center gap-3 rounded-[11px] px-3 text-[13px] font-semibold no-underline transition ${
                  current
                    ? "bg-[#20201e] text-white shadow-[0_8px_22px_rgba(25,25,20,0.12)]"
                    : "text-[#5f5f59] hover:bg-white hover:text-[#20201e]"
                }`}
              >
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-[8px] ${current ? "bg-white/12 text-white" : "bg-white text-[#777771]"}`}>
                  <Icon size={15.5} strokeWidth={1.8} />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Link
          to="/dashboard"
          onClick={onClose}
          className="mt-4 flex h-11 items-center justify-center gap-2 rounded-[11px] border border-[#deded9] bg-white text-[12px] font-semibold text-[#4f4f49] no-underline"
        >
          <ArrowLeft size={14} />
          Voltar à Velo
        </Link>
      </aside>
    </div>
  );
};

export const OldAdminShell = ({ children, active, fullBleed = false, title, subtitle, actions }: AdminShellProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useLayoutEffect(() => {
    document.documentElement.classList.add("velo-admin-surface");
    return () => document.documentElement.classList.remove("velo-admin-surface");
  }, []);

  return (
    <div
      className="h-screen overflow-hidden bg-white text-[#171715]"
      style={{
        fontFamily:
          '"Inter Variable", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div className="flex h-full flex-col overflow-hidden md:flex-row">
        <OldAdminMobileBar active={active} onOpenMenu={() => setMobileMenuOpen(true)} />
        <OldAdminNewSidebar />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-white">
          {fullBleed ? (
            children
          ) : (
            <div className="min-h-full">
              <PageHeader active={active} title={title} subtitle={subtitle} actions={actions} />
              <div className="px-4 py-5 sm:px-6 md:px-8 md:py-7">{children}</div>
            </div>
          )}
        </main>
      </div>
      <OldAdminMobileDrawer active={active} open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
    </div>
  );
};
