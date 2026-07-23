import { type ReactNode } from "react";
import { AdminNewSidebar } from "@/components/admin/AdminNewSidebar";

type AdminSection = "dashboard" | "users" | "revenue" | "plans" | "commissions" | "support" | "refunds" | "settings";

type AdminShellProps = {
  active: AdminSection;
  userId: string;
  children: ReactNode;
  /** Página edge-to-edge (ex.: Dashboard) — sem o card emoldurado e sem header. */
  fullBleed?: boolean;
  /** Título grande da página (parte do bloco breadcrumb → título → conteúdo). */
  title?: string;
  /** Subtítulo/descrição cinza abaixo do título. */
  subtitle?: string;
  /** Ações à direita do título (busca, botões, badges…). */
  actions?: ReactNode;
};

// Rótulo de cada seção para o breadcrumb — derivado do `active` que cada página
// já passa.
const SECTION_LABEL: Record<AdminSection, string> = {
  dashboard: "Dashboard",
  users: "Usuários & times",
  revenue: "Receita",
  plans: "Planos",
  commissions: "Comissões",
  support: "Suporte",
  refunds: "Reembolsos",
  settings: "AliExpress",
};

// Breadcrumb: bem pequeno, cinza apagado e com tracking levemente aumentado.
const Breadcrumb = ({ active }: { active: AdminSection }) => (
  <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[11px] tracking-[0.02em]">
    <span className="text-white/30">Admin</span>
    <span className="text-white/20" aria-hidden="true">
      /
    </span>
    <span className="text-white/45">{SECTION_LABEL[active]}</span>
  </nav>
);

// Bloco de header da página: breadcrumb → título grande → subtítulo, com bastante
// respiro vertical entre eles. As ações ficam à direita do título.
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
  <div className="px-8 pt-8 sm:px-10 sm:pt-10">
    <Breadcrumb active={active} />
    {title ? (
      <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className="text-[38px] font-bold leading-[1.05] tracking-[-0.03em] text-white sm:text-[44px]">
            {title}
          </h1>
          {subtitle ? <p className="mt-3 max-w-[560px] text-[14px] leading-relaxed text-white/50">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    ) : null}
  </div>
);

export const AdminShell = ({ children, active, fullBleed = false, title, subtitle, actions }: AdminShellProps) => (
  <div
    className="h-screen overflow-hidden bg-[#0A0A0B] text-[#F5F5F5]"
    style={{
      fontFamily:
        '"Inter Variable", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}
  >
    <div className="flex h-full overflow-hidden">
      <AdminNewSidebar />
      <main className="h-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#0A0A0B]">
        {fullBleed ? (
          <>
            {/* Dashboard controla o próprio topo; só o breadcrumb vem do shell. */}
            <div className="px-8 pt-8 sm:px-10 sm:pt-10">
              <Breadcrumb active={active} />
            </div>
            {children}
          </>
        ) : (
          <div className="min-h-full p-3 sm:p-4">
            <div className="min-h-[calc(100vh-32px)] overflow-hidden rounded-[20px] border border-white/[0.07] bg-[#0B0B0C]">
              {/* Header (breadcrumb + título) é do shell; o corpo mantém o
                  padding próprio da página, então injetamos espaço abaixo do
                  header e deixamos o conteúdo fluir. */}
              <PageHeader active={active} title={title} subtitle={subtitle} actions={actions} />
              {/* Corpo: o shell é o único dono do padding (as páginas não
                  devem mais aplicar padding externo próprio). */}
              <div className="px-6 pb-8 pt-7 sm:px-9">{children}</div>
            </div>
          </div>
        )}
      </main>
    </div>
  </div>
);
