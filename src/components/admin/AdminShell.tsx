import { type ReactNode } from "react";
import { AdminNewSidebar, type AdminSubKey } from "@/components/admin/AdminNewSidebar";

type AdminSection = "dashboard" | "users" | "revenue" | "plans" | "commissions" | "support" | "refunds" | "settings";

type AdminShellProps = {
  active: AdminSection;
  userId: string;
  children: ReactNode;
};

const toActiveSub = (active: AdminSection): AdminSubKey | undefined =>
  active === "dashboard" ? "overview" : undefined;

export const AdminShell = ({ active, children }: AdminShellProps) => (
  <div
    className="h-screen overflow-hidden bg-[#0F0F0F] text-white"
    style={{
      fontFamily:
        '"Hanken Grotesk", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}
  >
    <div className="flex h-full overflow-hidden">
      <AdminNewSidebar activeSub={toActiveSub(active)} />
      <main className="h-full min-w-0 flex-1 overflow-y-auto bg-[#f5f5f4] text-[#111111]">{children}</main>
    </div>
  </div>
);
