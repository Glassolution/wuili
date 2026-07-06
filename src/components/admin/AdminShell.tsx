import { type ElementType, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bell,
  HelpCircle,
  Home,
  LayoutDashboard,
  LifeBuoy,
  PackageSearch,
  Percent,
  Settings,
  ShieldCheck,
  Trash2,
  UserCircle,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type AdminSection = "dashboard" | "users" | "revenue" | "plans" | "commissions" | "support" | "refunds" | "settings";

type AdminShellProps = {
  active: AdminSection;
  userId: string;
  children: ReactNode;
};

export const AdminShell = ({ active, userId, children }: AdminShellProps) => {
  const { data: counts } = useQuery({
    queryKey: ["admin-pending-counts"],
    queryFn: async () => {
      const [{ count: refunds }, { count: tickets }] = await Promise.all([
        supabase.from("refund_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
      ]);
      return { refunds: refunds || 0, tickets: tickets || 0 };
    },
    refetchInterval: 10000,
  });

  const mainItems = [
    { icon: LayoutDashboard, label: "Dashboard", to: "/admin/painel", active: active === "dashboard" },
    { icon: Percent, label: "Comissões", to: "/admin/comissoes", active: active === "commissions" },
    { icon: Users, label: "Usuários", to: "/admin/usuarios", active: active === "users" },
    { icon: LifeBuoy, label: "Suporte", to: "/admin/suporte", active: active === "support", badge: counts?.tickets || 0 },
    { icon: Trash2, label: "Reembolsos", to: "/admin/reembolsos", active: active === "refunds", badge: counts?.refunds || 0 },
  ];

  const preferences = [
    { icon: UserCircle, label: "User Account", to: "/admin/usuarios" },
    { icon: Settings, label: "Settings", to: "/dashboard/configuracoes" },
    { icon: HelpCircle, label: "Help and support", to: "/admin/suporte" },
  ];

  return (
    <div
      className="h-screen overflow-hidden bg-[#111111] text-white"
      style={{
        fontFamily:
          '"Hanken Grotesk", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div className="flex h-full overflow-hidden bg-[#151515]">
        <aside className="hidden h-full w-[280px] shrink-0 overflow-y-auto border-r border-white/[0.07] bg-[#111111] md:flex md:flex-col">
          <div className="flex h-[74px] items-center justify-between border-b border-white/[0.06] px-7">
            <Link to="/admin/painel" className="flex items-center gap-3">
              <VeloMetricLogo />
              <span className="text-[19px] font-semibold tracking-[-0.04em]">VeloMetric</span>
            </Link>
            <span className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-white/10 bg-white/[0.03] text-white/70">
              <Home size={15} />
            </span>
          </div>

          <div className="flex-1 px-5 py-6">
            <nav className="space-y-8">
              <div className="space-y-2">
                <SideLink icon={PackageSearch} label="Inbox" to="/admin/painel" />
                <SideLink icon={Bell} label="Notifications" to="/admin/painel" />
              </div>

              <div>
                <p className="mb-3 px-2 text-[11px] font-medium uppercase tracking-[0.12em] text-white/58">Menu</p>
                <div className="space-y-1.5">
                  {mainItems.map((item) => (
                    <SideLink key={item.label} {...item} />
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-3 px-2 text-[11px] font-medium uppercase tracking-[0.12em] text-white/58">Preferences</p>
                <div className="space-y-1.5">
                  {preferences.map((item) => (
                    <SideLink key={item.label} {...item} />
                  ))}
                </div>
              </div>
            </nav>
          </div>

          <div className="space-y-5 border-t border-white/[0.06] p-5">
            <div className="rounded-[12px] border border-white/[0.08] bg-white/[0.035] p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black">
                  <ShieldCheck size={17} />
                </span>
                <div>
                  <p className="text-[13px] text-white/58">Admin ID</p>
                  <p className="text-[14px] font-semibold tracking-[-0.02em]">{userId.slice(0, 8).toUpperCase()}</p>
                </div>
              </div>
            </div>

            <Link
              to="/dashboard"
              className="flex items-center gap-2 rounded-[10px] px-2 py-2 text-[13px] font-medium text-white/54 transition hover:bg-white/[0.04] hover:text-white"
            >
              <ArrowLeft size={15} />
              Voltar à Velo
            </Link>
          </div>
        </aside>

        <main className="h-full min-w-0 flex-1 overflow-y-auto bg-[#171717]">{children}</main>
      </div>
    </div>
  );
};

const SideLink = ({
  to,
  label,
  icon: Icon,
  active = false,
  badge,
}: {
  to: string;
  label: string;
  icon: ElementType;
  active?: boolean;
  badge?: number;
}) => (
  <Link
    to={to}
    className={cn(
      "group flex min-h-9 items-center justify-between rounded-[8px] border px-3 text-[14px] transition duration-200",
      active
        ? "border-white/[0.10] bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]"
        : "border-transparent text-white/55 hover:border-white/[0.07] hover:bg-white/[0.035] hover:text-white"
    )}
  >
    <span className="flex items-center gap-2.5">
      <Icon size={15} strokeWidth={1.75} />
      {label}
    </span>
    {!!badge && (
      <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-black">
        {badge > 99 ? "99+" : badge}
      </span>
    )}
  </Link>
);

const VeloMetricLogo = () => (
  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white text-black shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
    <svg width="22" height="22" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path
        d="M33 18A11 11 0 1 0 33 30"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M30 26L34 30L38 26"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </span>
);
