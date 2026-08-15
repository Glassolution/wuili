import { useLayoutEffect, type ReactNode } from "react";
import { AdminNewSidebar } from "@/components/admin/AdminNewSidebar";

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
  commissions: "Comissões",
  support: "Suporte",
  refunds: "Reembolsos",
  evidence: "Evidências",
  settings: "Integrações",
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
}) => (
  <header className="flex flex-col gap-4 border-b border-[#eeeeeb] bg-white px-8 py-7 md:flex-row md:items-end md:justify-between">
    <div className="min-w-0">
      <p className="text-[10px] font-medium text-[#8c8c87]">Admin / {SECTION_LABEL[active]}</p>
      {title ? <h1 className="mt-3 text-[25px] font-semibold tracking-[-0.04em] text-[#171715]">{title}</h1> : null}
      {subtitle ? <p className="mt-2 max-w-2xl text-[12px] leading-5 text-[#777772]">{subtitle}</p> : null}
    </div>
    {actions ? <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
  </header>
);

export const AdminShell = ({ children, active, fullBleed = false, title, subtitle, actions }: AdminShellProps) => {
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
      <div className="flex h-full overflow-hidden">
        <AdminNewSidebar />
        <main className="h-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-white">
          {fullBleed ? (
            children
          ) : (
            <div className="min-h-full">
              <PageHeader active={active} title={title} subtitle={subtitle} actions={actions} />
              <div className="px-8 py-7">{children}</div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
