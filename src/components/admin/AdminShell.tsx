import { type ReactNode } from "react";
import { AdminNewSidebar, type AdminSubKey } from "@/components/admin/AdminNewSidebar";

type AdminSection = "dashboard" | "users" | "revenue" | "plans" | "commissions" | "support" | "refunds" | "settings";

type AdminShellProps = {
  active: AdminSection;
  userId: string;
  children: ReactNode;
  fullBleed?: boolean;
};

const toActiveSub = (active: AdminSection): AdminSubKey | undefined =>
  active === "dashboard" ? "reports" : undefined;

export const AdminShell = ({ active, children, fullBleed = false }: AdminShellProps) => (
  <div
    className="h-screen overflow-hidden bg-[#121214] text-[#F4F4F5]"
    style={{
      fontFamily: '"Geist Sans", "Inter Variable", "Inter", ui-sans-serif, system-ui, sans-serif',
    }}
  >
    <div className="flex h-full overflow-hidden">
      <AdminNewSidebar activeSub={toActiveSub(active)} />
      <main className="h-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#121214]">
        {fullBleed ? (
          children
        ) : (
          <div className="min-h-full p-4 sm:p-5">
            <div className="min-h-[calc(100vh-40px)] rounded-2xl border border-white/[0.08] bg-[#0E0E10] p-5 sm:p-6">
              {children}
            </div>
          </div>
        )}
      </main>
    </div>
  </div>
);
