import { useLayoutEffect, useState, type ReactNode } from "react";
import {
  BadgeDollarSign,
  BarChart3,
  FileSearch,
  type LucideIcon,
  MessagesSquare,
  PackageSearch,
  RefreshCcw,
  Settings2,
  ShoppingBag,
  UsersRound,
} from "lucide-react";
import { AdminNewSidebar } from "@/components/admin/AdminNewSidebar";
import SearchPalette from "@/components/dashboard/SearchPalette";
import "@/styles/admin-theme.css";

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
  settings: "Integrações",
};

const SECTION_ICON: Record<AdminSection, LucideIcon> = {
  dashboard: BarChart3,
  users: UsersRound,
  sales: ShoppingBag,
  revenue: BarChart3,
  plans: PackageSearch,
  commissions: BadgeDollarSign,
  support: MessagesSquare,
  refunds: RefreshCcw,
  evidence: FileSearch,
  settings: Settings2,
};

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
}) => {
  const Icon = SECTION_ICON[active];
  return (
    <header className="px-5 pt-6 lg:px-7">
      <div className="min-w-0">
        <div className="admin-page-title">
          <Icon aria-hidden="true" />
          <h1>{title || SECTION_LABEL[active]}</h1>
        </div>
        {subtitle ? <p className="admin-kpi-subtitle mt-1.5 max-w-2xl">{subtitle}</p> : null}
      </div>
      {actions ? <div className="admin-header-actions mt-3 flex flex-wrap items-center">{actions}</div> : null}
    </header>
  );
};

export const AdminShell = ({ children, active, fullBleed = false, title, subtitle, actions }: AdminShellProps) => {
  const [searchOpen, setSearchOpen] = useState(false);

  useLayoutEffect(() => {
    document.documentElement.classList.add("velo-admin-surface");
    return () => document.documentElement.classList.remove("velo-admin-surface");
  }, []);

  return (
    <div className="velo-admin-root h-screen overflow-hidden">
      <div className="flex h-full overflow-hidden">
        <AdminNewSidebar onOpenSearch={() => setSearchOpen(true)} />

        <div className="admin-shell-main min-w-0 flex-1">
          <main className="admin-page-surface h-full min-w-0 overflow-y-auto overflow-x-hidden">
            {fullBleed ? (
              children
            ) : (
              <div className="min-h-full">
                <PageHeader active={active} title={title} subtitle={subtitle} actions={actions} />
                <div className="px-5 py-5 lg:px-7">{children}</div>
              </div>
            )}
          </main>
        </div>
      </div>

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} isAdmin />
    </div>
  );
};
