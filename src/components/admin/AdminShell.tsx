import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  ShieldCheck,
  Users,
} from "lucide-react";
import { VeloLogo } from "@/components/VeloLogo";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type AdminSection = "dashboard" | "users" | "revenue" | "plans" | "support" | "refunds" | "settings";

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

  const railItems = [
    { icon: LayoutDashboard, label: "Dashboard", to: "/admin/dashboard", active: active === "dashboard" },
    { icon: FileText, label: "Relatórios", to: "/admin/dashboard#receita", active: active === "revenue" || active === "plans" },
    { icon: Users, label: "Usuários", to: "/admin/usuarios", active: active === "users" },
    { icon: LifeBuoy, label: "Suporte", to: "/admin/suporte", active: active === "support" },
  ];

  return (
    <div
      className="min-h-screen overflow-hidden bg-[#F4F3F1] text-[#1d1d1b]"
      style={{
        fontFamily: '"Inter Tight", "Inter Variable", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        backgroundImage:
          "radial-gradient(circle at 14% 12%, rgba(255,255,255,0.72), transparent 24%), linear-gradient(90deg, rgba(0,0,0,0.018) 0, transparent 22%)",
      }}
    >
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-[66px_236px_minmax(0,1fr)]">
        <aside className="hidden border-r border-black/[0.035] bg-[#F0EEEB]/78 px-3 py-8 backdrop-blur-xl md:flex md:flex-col md:items-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-[0_8px_22px_rgba(0,0,0,0.045)]">
            <VeloLogo size="sm" variant="dark" />
          </div>

          <nav className="mt-9 flex flex-col gap-4">
            {railItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  title={item.label}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border transition duration-200",
                    item.active
                      ? "border-[#22221f] bg-[#22221f] text-white shadow-[0_8px_18px_rgba(0,0,0,0.10)]"
                      : "border-black/[0.035] bg-white text-black/48 shadow-[0_6px_18px_rgba(0,0,0,0.035)] hover:text-[#22221f]"
                  )}
                >
                  <Icon size={17} strokeWidth={1.75} />
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto flex h-9 w-9 items-center justify-center rounded-full bg-[#D21F5B] text-[11px] font-semibold text-white">
            AD
          </div>
        </aside>

        <aside className="hidden overflow-y-auto border-r border-black/[0.045] bg-[#F7F5F2]/72 px-6 py-7 backdrop-blur-xl md:block">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#22221f] shadow-[0_6px_18px_rgba(0,0,0,0.035)]">
              <ShieldCheck size={14} strokeWidth={1.8} />
            </span>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-black/34">Velo Admin</p>
              <p className="mt-0.5 text-[12px] font-medium text-black/44">ID {userId.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>

          <div className="mt-8 space-y-7">
            <div>
              <p className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-black/30">Sales list</p>
              <TreeLink active={active === "dashboard"} to="/admin/dashboard" label="Dashboard" />
              <TreeLink to="/admin/dashboard#receita" label="Revenue" />
              <TreeLink to="/admin/dashboard#planos" label="Plans" />
              <TreeLink to="/admin/usuarios" label="Users" />
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-black/30">Reports</p>
                <span className="h-px w-9 bg-black/[0.08]" />
              </div>
              <TreeLink to="/admin/dashboard#analytics" label="Analytics" />
              <TreeLink to="/admin/reembolsos" label="Reembolsos" badge={counts?.refunds || 0} />
              <TreeLink to="/admin/suporte" label="Suporte" badge={counts?.tickets || 0} />
              <TreeLink to="/dashboard/configuracoes" label="Configurações" />
            </div>
          </div>

          <Link
            to="/dashboard"
            className="mt-11 flex items-center gap-2 text-[12px] font-medium text-black/42 transition hover:text-[#22221f]"
          >
            <ArrowLeft size={14} />
            Voltar à Velo
          </Link>
        </aside>

        <main className="min-w-0 overflow-y-auto px-4 py-5 md:px-7 md:py-7">{children}</main>
      </div>
    </div>
  );
};

const TreeLink = ({ to, label, active = false, badge }: { to: string; label: string; active?: boolean; badge?: number }) => (
  <Link
    to={to}
    className={cn(
      "group relative ml-1 flex min-h-8 items-center justify-between border-l border-black/[0.085] pl-4 text-[13px] font-semibold transition",
      active ? "text-[#22221f]" : "text-black/52 hover:text-[#22221f]"
    )}
  >
    <span className="absolute -left-[4px] top-3.5 h-2 w-2 rounded-full border border-black/[0.10] bg-[#F7F5F2] transition group-hover:bg-[#22221f]" />
    <span>{label}</span>
    {!!badge && (
      <span className="ml-3 inline-flex min-w-5 items-center justify-center rounded-full bg-[#D21F5B] px-1.5 py-0.5 text-[10px] font-bold text-white">
        {badge > 99 ? "99+" : badge}
      </span>
    )}
  </Link>
);
