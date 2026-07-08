import { type ReactNode } from "react";
import { AdminSidebar, type AdminSidebarSection } from "@/components/admin/AdminSidebar";

type AdminSection = "dashboard" | "users" | "revenue" | "plans" | "commissions" | "support" | "refunds" | "settings";

type AdminShellProps = {
  active: AdminSection;
  userId: string;
  children: ReactNode;
};

const toSidebarSection = (active: AdminSection): AdminSidebarSection => {
  if (active === "commissions") return "commissions";
  if (active === "users") return "users";
  if (active === "support") return "support";
  return "dashboard";
};

export const AdminShell = ({ active, userId, children }: AdminShellProps) => (
  <div
    className="h-screen overflow-hidden bg-[#171714] text-white"
    style={{
      fontFamily:
        '"Hanken Grotesk", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}
  >
    <div className="flex h-full overflow-hidden">
      <AdminSidebar active={toSidebarSection(active)} userId={userId} />
      <main className="h-full min-w-0 flex-1 overflow-y-auto bg-[#f5f5f4] text-[#111111]">{children}</main>
    </div>
  </div>
);
