import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  CircleDollarSign,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  RefreshCcw,
  Settings,
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

  const adminMenu = [
    { key: "dashboard" as const, label: "Visão Geral", icon: LayoutDashboard, to: "/admin/dashboard" },
    { key: "users" as const, label: "Usuários", icon: Users, to: "/admin/usuarios" },
    { key: "revenue" as const, label: "Receita", icon: CircleDollarSign, to: "/admin/dashboard#receita" },
    { key: "plans" as const, label: "Planos", icon: CreditCard, to: "/admin/dashboard#planos" },
    { key: "refunds" as const, label: "Reembolsos", icon: RefreshCcw, to: "/admin/reembolsos", badge: counts?.refunds || 0 },
    { key: "support" as const, label: "Suporte", icon: LifeBuoy, to: "/admin/suporte", badge: counts?.tickets || 0 },
    { key: "settings" as const, label: "Configurações", icon: Settings, to: "/dashboard/configuracoes" },
  ];

  return (
  <div className="min-h-screen bg-black p-3 text-white md:p-5">
    <div className="mx-auto grid min-h-[calc(100vh-24px)] max-w-[1500px] gap-5 overflow-hidden rounded-[26px] border border-[#181818] bg-black p-3 md:min-h-[calc(100vh-40px)] md:grid-cols-[260px_minmax(0,1fr)] md:p-4">
      <aside className="flex flex-col rounded-[22px] border border-[#333] bg-[#0a0a0a] p-5">
        <div className="flex items-center justify-between">
          <VeloLogo size="sm" variant="light" />
          <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-black">Admin</span>
        </div>
        <div className="mt-4 rounded-full bg-[#1a1a1a] px-3 py-1.5 text-[11px] font-semibold text-white/60">
          ID: {userId.slice(0, 8).toUpperCase()}
        </div>
        <div className="my-8 h-px bg-[#333]" />

        <nav className="flex flex-1 flex-col gap-2">
          {adminMenu.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.key;
            const badge = (item as any).badge as number | undefined;
            return (
              <Link
                key={item.key}
                to={item.to}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-xl px-3 py-3 text-[14px] font-semibold transition",
                  isActive ? "bg-white text-black" : "text-white/65 hover:bg-[#1a1a1a] hover:text-white"
                )}
              >
                <span className="flex items-center gap-3">
                  <Icon size={17} />
                  <span>{item.label}</span>
                </span>
                {badge ? (
                  <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                    {badge > 99 ? "99+" : badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <Link
          to="/dashboard"
          className="mt-8 flex items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-semibold text-white/55 transition hover:bg-[#1a1a1a] hover:text-white"
        >
          <ShieldCheck size={17} />
          Voltar à Velo
        </Link>
      </aside>

      <main className="min-w-0 overflow-hidden rounded-[22px] bg-black p-2 md:p-5">{children}</main>
    </div>
  </div>
  );
};
