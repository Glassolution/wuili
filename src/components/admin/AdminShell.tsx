import { useCallback, useContext, useLayoutEffect, useState, type ReactNode } from "react";
import {
  BadgeDollarSign,
  BarChart3,
  Bot,
  FileSearch,
  LifeBuoy,
  type LucideIcon,
  MessagesSquare,
  PackageSearch,
  RefreshCcw,
  Settings2,
  ShoppingBag,
  Stethoscope,
  UsersRound,
} from "lucide-react";
import { AdminNewSidebar } from "@/components/admin/AdminNewSidebar";
import { AdminMobileNav } from "@/components/admin/AdminMobileNav";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { OldAdminShell } from "@/components/admin/OldAdminShell";
import SearchPalette from "@/components/dashboard/SearchPalette";
import { getAdminPanelStyle } from "@/lib/adminPanelStyle";
import { AdminSaleToast } from "@/components/admin/AdminSaleNotifications";
import { useAdminSaleWatcher } from "@/hooks/useAdminSaleWatcher";
import { ADMIN_PAGE_SCROLL_CLASS, AdminLayoutContext } from "@/components/admin/adminLayoutContext";
import { Activity } from "lucide-react";
import "@/styles/admin-theme.css";
import "@/styles/admin-dark.css";
import "@/styles/admin-dark-classes.css";

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
  | "diagnostics"
  | "tracking"
  | "automation"
  | "helpCenter"
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

export type AdminTheme = "light" | "dark";

const THEME_STORAGE_KEY = "velo:admin-theme";

/** Versão noturna é o padrão; "light" é a versão padrão (clara). */
const getStoredTheme = (): AdminTheme => {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
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
  diagnostics: "Consulta",
  tracking: "Rastreio",
  automation: "Automação BOT",
  helpCenter: "Central de ajuda",
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
  diagnostics: Stethoscope,
  tracking: Activity,
  automation: Bot,
  helpCenter: LifeBuoy,
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

/**
 * Moldura do admin: barra de cima, sidebar, tema, busca e navegação do
 * celular. `children` é a área de conteúdo à direita da sidebar.
 */
export const AdminFrame = ({ children }: { children: ReactNode }) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const [theme, setTheme] = useState<AdminTheme>(getStoredTheme);
  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // armazenamento bloqueado: o tema vale só nesta visita
      }
      return next;
    });
  }, []);

  // vendas (assinaturas pagas) em tempo real: som, aviso e valor no painel
  useAdminSaleWatcher(true);

  useLayoutEffect(() => {
    document.documentElement.classList.add("velo-admin-surface");
    return () => document.documentElement.classList.remove("velo-admin-surface");
  }, []);

  return (
    <div
      className="velo-admin-root admin-frame flex h-screen flex-col overflow-hidden max-md:h-[100dvh]"
      data-admin-theme={theme}
    >
      <AdminTopBar onOpenSearch={openSearch} theme={theme} onToggleTheme={toggleTheme} />
      <div className="admin-frame-body flex min-h-0 flex-1 overflow-hidden">
        <AdminNewSidebar />
        <div className="admin-shell-main relative min-w-0 flex-1">{children}</div>
      </div>

      <AdminSaleToast />
      <AdminMobileNav />
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} isAdmin />
    </div>
  );
};

export const AdminShell = ({ children, active, fullBleed = false, title, subtitle, actions }: AdminShellProps) => {
  const insideLayout = useContext(AdminLayoutContext);
  const [panelStyle] = useState(() => getAdminPanelStyle());

  const content = fullBleed ? (
    children
  ) : (
    <div className="min-h-full">
      <PageHeader active={active} title={title} subtitle={subtitle} actions={actions} />
      <div className="px-5 py-5 lg:px-7">{children}</div>
    </div>
  );

  // Dentro do AdminLayout a moldura já existe: a página entrega só o conteúdo.
  if (insideLayout) return <>{content}</>;

  if (panelStyle === "old") {
    return (
      <OldAdminShell active={active} userId="admin" fullBleed={fullBleed} title={title} subtitle={subtitle} actions={actions}>
        {children}
      </OldAdminShell>
    );
  }

  return (
    <AdminFrame>
      <main className={`h-full ${ADMIN_PAGE_SCROLL_CLASS}`}>{content}</main>
    </AdminFrame>
  );
};
