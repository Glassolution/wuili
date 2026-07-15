import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  PackageCheck,
  RefreshCcw,
  Settings,
  ShoppingBag,
  Sparkles,
  User,
  Users as UsersIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

export type AdminSubKey = "overview" | "reports" | "activity" | "workflow";

type Props = {
  activeSub?: AdminSubKey;
};

const panelSubs: { key: AdminSubKey; label: string; to?: string }[] = [
  { key: "overview", label: "Visão geral", to: "/admin/painel" },
  { key: "reports", label: "Relatórios & análises" },
  { key: "activity", label: "Atividade do time" },
  { key: "workflow", label: "Workflow" },
];

const VeloMark = () => (
  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-[#22C55E] text-white shadow-[0_8px_24px_rgba(34,197,94,0.18)]">
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3.5 5.5L7.75 10L3.5 14.5M9 5.5L13.25 10L9 14.5" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
);

export const AdminNewSidebar = ({ activeSub }: Props) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isMobile = useIsMobile();
  const [panelOpen, setPanelOpen] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const isCollapsed = collapsed || isMobile;

  const activeSection: "panel" | "users" | "commissions" | "support" | "refunds" | "aliexpress" | null = useMemo(() => {
    if (pathname.startsWith("/admin/usuarios")) return "users";
    if (pathname.startsWith("/admin/comissoes")) return "commissions";
    if (pathname.startsWith("/admin/suporte")) return "support";
    if (pathname.startsWith("/admin/reembolsos")) return "refunds";
    if (pathname.startsWith("/admin/aliexpress")) return "aliexpress";
    if (pathname.startsWith("/admin/painel")) return "panel";
    return null;
  }, [pathname]);

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col border-r border-white/[0.075] bg-[#0F0F10] transition-[width] duration-200",
        isCollapsed ? "w-[76px]" : "w-[260px]",
      )}
      style={{ fontFamily: '"Geist Sans", "Inter Variable", "Inter", ui-sans-serif, system-ui, sans-serif' }}
    >
      <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-white/[0.075] px-4">
        <Link to="/admin/painel" className="flex min-w-0 items-center gap-2.5 text-white no-underline">
          <VeloMark />
          {!isCollapsed && <span className="truncate text-[16px] font-semibold text-white">Velo</span>}
        </Link>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          title={isCollapsed ? "Expandir menu" : "Recolher menu"}
          className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.18] bg-transparent text-[#B7B7BD] transition hover:border-white/[0.28] hover:text-white md:flex"
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" strokeWidth={1.5} /> : <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />}
        </button>
      </div>

      <div className="px-4 pb-5 pt-4">
        <button
          type="button"
          onClick={() => navigate("/dashboard/atlas")}
          title="Sugestões da Aquas"
          className={cn(
            "flex h-10 w-full items-center justify-center gap-2 rounded-full border border-white/[0.17] bg-[#121214] text-[13px] font-medium text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] transition hover:border-white/[0.25] hover:bg-[#18181A]",
            isCollapsed && "px-0",
          )}
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#22C55E]" strokeWidth={1.5} />
          {!isCollapsed && "Sugestões da Aquas"}
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-4 text-[13px]">
        <button
          onClick={() => setPanelOpen((v) => !v)}
          title="Dashboard"
          className={cn(
            "flex h-10 w-full items-center gap-3 rounded-lg px-3 transition",
            activeSection === "panel" ? "text-white" : "text-[#8A8A8E] hover:bg-white/[0.04] hover:text-white",
            isCollapsed && "justify-center px-0",
          )}
        >
          <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-[#1A1A1A]", activeSection === "panel" && "text-white")}>
            <LayoutDashboard className="h-3.5 w-3.5" strokeWidth={1.5} />
          </span>
          {!isCollapsed && <span className="flex-1 text-left">Dashboard</span>}
          {!isCollapsed && <ChevronDown className={cn("h-3.5 w-3.5 text-[#65656B] transition-transform", panelOpen ? "rotate-0" : "-rotate-90")} />}
        </button>
        {panelOpen && !isCollapsed && (
          <div className="ml-[27px] space-y-0.5 border-l border-white/[0.08] py-1 pl-3">
            {panelSubs.map((s) => {
              const isActive = activeSub === s.key;
              const inner = (
                <div
                  className={cn(
                    "rounded-lg px-3 py-2 text-[12.5px] transition",
                    isActive ? "bg-[#ECECEF] font-medium text-[#111113]" : "text-[#77777E] hover:bg-white/[0.04] hover:text-white",
                  )}
                >
                  {s.label}
                </div>
              );
              return s.to ? (
                <Link key={s.key} to={s.to}>
                  {inner}
                </Link>
              ) : (
                <button key={s.key} className="w-full text-left">
                  {inner}
                </button>
              );
            })}
          </div>
        )}

        <SideItem icon={PackageCheck} label="Pedidos" to="/dashboard/pedidos" collapsed={isCollapsed} />
        <SideItem icon={FileText} label="Publicações" to="/dashboard/publicacoes" collapsed={isCollapsed} />
        <SideItem icon={Sparkles} label="Aquas" to="/dashboard/atlas" collapsed={isCollapsed} />
        <SideItem icon={LifeBuoy} label="Suporte" to="/admin/suporte" active={activeSection === "support"} collapsed={isCollapsed} />
        <SideItem icon={UsersIcon} label="Usuários & times" to="/admin/usuarios" active={activeSection === "users"} collapsed={isCollapsed} />
        <SideItem icon={DollarSign} label="Comissões" to="/admin/comissoes" active={activeSection === "commissions"} collapsed={isCollapsed} />
        <SideItem icon={RefreshCcw} label="Reembolsos" to="/admin/reembolsos" active={activeSection === "refunds"} collapsed={isCollapsed} />
      </nav>

      <div className="space-y-1 border-t border-white/[0.08] px-4 py-4 text-[13px]">
        <SideItem icon={Settings} label="Configurações" to="/dashboard/configuracoes" collapsed={isCollapsed} />
        <SideItem icon={User} label="Perfil" to="/dashboard/configuracoes" collapsed={isCollapsed} />
        <button
          onClick={() => navigate("/dashboard")}
          title="Voltar à Velo"
          className={cn("mt-2 flex h-9 w-full items-center gap-3 rounded-lg px-3 text-[12px] text-[#6F6F75] transition hover:bg-white/[0.04] hover:text-white", isCollapsed && "justify-center px-0")}
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          {!isCollapsed && "Voltar à Velo"}
        </button>
      </div>
    </aside>
  );
};

const SideItem = ({
  icon: Icon,
  label,
  active,
  to,
  collapsed,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  to?: string;
  collapsed?: boolean;
}) => {
  const inner = (
    <div
      title={label}
      className={cn(
        "flex h-10 items-center gap-3 rounded-lg px-3 transition",
        active ? "bg-white/[0.08] text-white" : "text-[#7A7A80] hover:bg-white/[0.04] hover:text-white",
        collapsed && "justify-center px-0",
      )}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-[#1A1A1A]">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
      </span>
      {!collapsed && <span>{label}</span>}
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : <button className="w-full text-left">{inner}</button>;
};

export default AdminNewSidebar;
