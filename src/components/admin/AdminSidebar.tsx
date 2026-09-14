import { type ElementType } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Headphones, LayoutDashboard, Percent, ShieldCheck, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type AdminSidebarSection = "dashboard" | "commissions" | "users" | "support";

type AdminSidebarProps = {
  active: AdminSidebarSection;
  userId?: string | null;
};

const navItems: Array<{ icon: ElementType; label: string; to: string; active: AdminSidebarSection }> = [
  { icon: LayoutDashboard, label: "Painel", to: "/admin/painel", active: "dashboard" },
  { icon: Percent, label: "Comissoes", to: "/admin/comissoes", active: "commissions" },
  { icon: Users, label: "Usuarios", to: "/admin/usuarios", active: "users" },
  { icon: Headphones, label: "Suporte", to: "/admin/suporte", active: "support" },
];

export const AdminSidebar = ({ active, userId }: AdminSidebarProps) => {
  const { data: openTickets = 0 } = useQuery({
    queryKey: ["admin-sidebar-open-support-tickets"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .eq("status", "open");

      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 30000,
  });

  return (
    <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-[#2A2926] bg-[#171714] p-4 text-white lg:flex">
      <Link to="/admin/painel" className="flex items-center gap-3 text-white no-underline">
        <VeloMark />
        <div className="min-w-0">
          <p className="truncate text-[18px] font-bold leading-5 tracking-[-0.065em] text-[#F2F1EC]">VeloMetric</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.24em] text-white">Admin</p>
        </div>
      </Link>

      <nav className="mt-10">
        <p className="mb-5 px-2 text-[11px] font-bold uppercase tracking-[0.20em] text-white/70">Monitoramento</p>
        <div className="space-y-2">
          {navItems.map((item) => (
            <AdminSidebarLink
              key={item.to}
              {...item}
              selected={active === item.active}
              badge={item.active === "support" ? openTickets : undefined}
            />
          ))}
        </div>
      </nav>

      <div className="mt-auto space-y-5 border-t border-[#2A2926] pt-5">
        <div className="rounded-[13px] bg-[#191918] p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.075),0_10px_30px_rgba(0,0,0,0.24)]">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black">
              <ShieldCheck size={17} />
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-white/58">Admin ID</p>
              <p className="truncate text-[13px] font-bold tracking-[-0.02em] text-white">
                {(userId || "VELOADMIN").slice(0, 8).toUpperCase()}
              </p>
            </div>
          </div>
        </div>

        <Link
          to="/dashboard"
          className="flex h-10 items-center gap-2 rounded-[10px] px-2 text-[13px] font-semibold text-white transition hover:bg-[#24231F]"
        >
          <ArrowLeft size={15} />
          Voltar a Velo
        </Link>
      </div>
    </aside>
  );
};

const AdminSidebarLink = ({
  icon: Icon,
  label,
  to,
  selected,
  badge,
}: {
  icon: ElementType;
  label: string;
  to: string;
  selected: boolean;
  badge?: number;
}) => (
  <Link
    to={to}
    className={cn(
      "flex h-10 items-center gap-3 rounded-[10px] px-3 text-[13px] font-bold tracking-[-0.02em] no-underline transition",
      selected ? "bg-[#2B2B29] text-white" : "text-white/84 hover:bg-[#24231F] hover:text-white"
    )}
  >
    <Icon size={16} strokeWidth={1.85} />
    <span className="min-w-0 flex-1">{label}</span>
    {typeof badge === "number" && badge > 0 ? (
      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-bold text-black">
        {badge > 99 ? "99+" : badge}
      </span>
    ) : null}
  </Link>
);

const VeloMark = () => (
  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-white text-black shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
    <svg width="22" height="22" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M33 18A11 11 0 1 0 33 30" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
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
