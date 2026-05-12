import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  Plus,
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
      className="min-h-screen overflow-hidden bg-[#F3F2EF] text-[#161616]"
      style={{
        fontFamily: '"Inter Tight", "Inter Variable", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        backgroundImage:
          "radial-gradient(circle at 18% 12%, rgba(255,255,255,0.9), transparent 28%), radial-gradient(circle at 88% 0%, rgba(0,0,0,0.045), transparent 22%)",
      }}
    >
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-[88px_290px_minmax(0,1fr)]">
        <aside className="hidden border-r border-black/[0.04] bg-white/35 px-5 py-9 backdrop-blur-xl md:flex md:flex-col md:items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
            <VeloLogo size="sm" variant="dark" />
          </div>

          <nav className="mt-12 flex flex-col gap-5">
            {railItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  title={item.label}
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-full border transition duration-300",
                    item.active
                      ? "border-[#111111] bg-[#111111] text-white shadow-[0_16px_40px_rgba(0,0,0,0.18)]"
                      : "border-black/[0.04] bg-white text-black/55 shadow-[0_8px_24px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 hover:text-[#111111]"
                  )}
                >
                  <Icon size={21} strokeWidth={1.7} />
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#D21F5B] text-[13px] font-semibold text-white">
            AD
          </div>
        </aside>

        <aside className="hidden overflow-y-auto border-r border-black/[0.05] bg-[#F8F7F5]/75 px-7 py-8 backdrop-blur-xl md:block">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#111111] text-white">
              <ShieldCheck size={16} />
            </span>
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-black/35">Velo Admin</p>
              <p className="mt-0.5 text-[13px] font-medium text-black/55">ID {userId.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>

          <div className="mt-10 space-y-7">
            <div>
              <p className="mb-3 text-[12px] font-semibold text-black/35">Sales list</p>
              <TreeLink active={active === "dashboard"} to="/admin/dashboard" label="Dashboard" />
              <TreeLink to="/admin/dashboard#receita" label="Revenue" />
              <TreeLink to="/admin/dashboard#planos" label="Plans" />
              <TreeLink to="/admin/usuarios" label="Users" badge={active === "users" ? undefined : 0} />
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[12px] font-semibold text-black/35">Reports</p>
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-black/40 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
                  <Plus size={14} />
                </span>
              </div>
              <TreeLink to="/admin/dashboard#analytics" label="Analytics" />
              <TreeLink to="/admin/reembolsos" label="Reembolsos" badge={counts?.refunds || 0} />
              <TreeLink to="/admin/suporte" label="Suporte" badge={counts?.tickets || 0} />
              <TreeLink to="/dashboard/configuracoes" label="Configurações" />
            </div>
          </div>

          <Link
            to="/dashboard"
            className="mt-12 flex items-center gap-2 text-[13px] font-medium text-black/45 transition hover:text-[#111111]"
          >
            <ArrowLeft size={15} />
            Voltar à Velo
          </Link>
        </aside>

        <main className="min-w-0 overflow-y-auto px-4 py-5 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
};

const TreeLink = ({ to, label, active = false, badge }: { to: string; label: string; active?: boolean; badge?: number }) => (
  <Link
    to={to}
    className={cn(
      "group relative ml-1 flex min-h-9 items-center justify-between border-l border-black/[0.10] pl-5 text-[15px] font-semibold transition",
      active ? "text-[#111111]" : "text-black/58 hover:text-[#111111]"
    )}
  >
    <span className="absolute -left-[5px] top-4 h-2.5 w-2.5 rounded-full border border-black/[0.10] bg-[#F8F7F5] transition group-hover:bg-[#111111]" />
    <span>{label}</span>
    {!!badge && (
      <span className="ml-3 inline-flex min-w-6 items-center justify-center rounded-full bg-[#111111] px-1.5 py-0.5 text-[10px] font-bold text-white">
        {badge > 99 ? "99+" : badge}
      </span>
    )}
  </Link>
);
