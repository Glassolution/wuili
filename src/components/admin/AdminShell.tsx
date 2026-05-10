import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  CircleDollarSign,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  RefreshCcw,
  Search,
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
    { key: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard, to: "/admin/dashboard" },
    { key: "users" as const, label: "Usuários", icon: Users, to: "/admin/usuarios" },
    { key: "revenue" as const, label: "Receita", icon: CircleDollarSign, to: "/admin/dashboard#receita" },
    { key: "plans" as const, label: "Planos", icon: CreditCard, to: "/admin/dashboard#planos" },
    { key: "refunds" as const, label: "Reembolsos", icon: RefreshCcw, to: "/admin/reembolsos", badge: counts?.refunds || 0 },
    { key: "support" as const, label: "Suporte", icon: LifeBuoy, to: "/admin/suporte", badge: counts?.tickets || 0 },
  ];

  return (
    <div className="min-h-screen bg-[#F6F6F6] font-sans text-neutral-900">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-4 py-5 md:px-8 md:py-7">
        {/* Topbar */}
        <header className="flex flex-wrap items-center gap-4">
          {/* Logo */}
          <Link
            to="/admin/dashboard"
            className="flex h-12 items-center gap-2 rounded-full bg-white px-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] ring-1 ring-black/[0.04]"
          >
            <VeloLogo size="sm" variant="dark" />
            <span className="ml-1 rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white">
              ADMIN
            </span>
          </Link>

          {/* Nav pill */}
          <nav className="flex h-12 items-center gap-1 rounded-full bg-white px-2 shadow-[0_1px_2px_rgba(0,0,0,0.03)] ring-1 ring-black/[0.04]">
            {adminMenu.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.key;
              const badge = (item as any).badge as number | undefined;
              return (
                <Link
                  key={item.key}
                  to={item.to}
                  className={cn(
                    "group relative flex h-9 items-center gap-2 rounded-full px-4 text-[13px] font-medium transition-all duration-200",
                    isActive
                      ? "bg-neutral-900 text-white shadow-sm"
                      : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                  )}
                >
                  <Icon size={15} strokeWidth={1.75} />
                  <span className="hidden md:inline">{item.label}</span>
                  {badge ? (
                    <span className="ml-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          {/* Search */}
          <div className="hidden flex-1 lg:flex lg:min-w-[260px]">
            <div className="flex h-12 w-full items-center gap-3 rounded-full bg-white px-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] ring-1 ring-black/[0.04]">
              <Search size={16} className="text-neutral-400" strokeWidth={1.75} />
              <input
                type="text"
                placeholder="Buscar..."
                className="flex-1 bg-transparent text-[13px] text-neutral-700 placeholder:text-neutral-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Right cluster */}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-900 text-white transition hover:bg-neutral-800"
              aria-label="Notificações"
            >
              <Bell size={16} strokeWidth={1.75} />
            </button>
            <Link
              to="/dashboard/configuracoes"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-neutral-600 shadow-[0_1px_2px_rgba(0,0,0,0.03)] ring-1 ring-black/[0.04] transition hover:text-neutral-900"
              aria-label="Configurações"
            >
              <Settings size={16} strokeWidth={1.75} />
            </Link>
            <Link
              to="/dashboard"
              className="flex h-11 items-center gap-2 rounded-full bg-white px-4 text-[13px] font-medium text-neutral-600 shadow-[0_1px_2px_rgba(0,0,0,0.03)] ring-1 ring-black/[0.04] transition hover:text-neutral-900"
            >
              <ShieldCheck size={15} strokeWidth={1.75} />
              <span className="hidden sm:inline">Voltar</span>
            </Link>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-200 text-[11px] font-semibold text-neutral-700">
              {userId.slice(0, 2).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
};
