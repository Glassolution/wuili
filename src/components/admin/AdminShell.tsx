import { type ReactNode } from "react";
import { AdminNewSidebar } from "@/components/admin/AdminNewSidebar";

type AdminSection = "dashboard" | "users" | "revenue" | "plans" | "commissions" | "support" | "refunds" | "settings";

type AdminShellProps = {
  active: AdminSection;
  userId: string;
  children: ReactNode;
  fullBleed?: boolean;
};

export const AdminShell = ({ children, fullBleed = false }: AdminShellProps) => (
  <div
    className="h-screen overflow-hidden bg-[#0A0A0B] text-[#F5F5F5]"
    style={{
      fontFamily: '"Geist Sans", "Inter Variable", "Inter", ui-sans-serif, system-ui, sans-serif',
    }}
  >
    <div className="flex h-full overflow-hidden">
      <AdminNewSidebar />
      <main className="h-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#0A0A0B]">
        {fullBleed ? (
          children
        ) : (
          <div className="min-h-full p-4 sm:p-5">
            <div className="min-h-[calc(100vh-40px)] rounded-2xl border border-[#242425] bg-[#0A0A0B] p-5 sm:p-6">
              {children}
            </div>
          </div>
        )}
      </main>
    </div>
  </div>
);
