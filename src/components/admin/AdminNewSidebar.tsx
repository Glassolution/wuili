import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  DollarSign,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  RefreshCcw,
  Settings,
  Sparkles,
  User,
  Users as UsersIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

export const AdminNewSidebar = ({ activeSub }: Props) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [panelOpen, setPanelOpen] = useState(true);

  const activeSection: "panel" | "users" | "commissions" | "support" | "refunds" | null = useMemo(() => {
    if (pathname.startsWith("/admin/usuarios")) return "users";
    if (pathname.startsWith("/admin/comissoes")) return "commissions";
    if (pathname.startsWith("/admin/suporte")) return "support";
    if (pathname.startsWith("/admin/reembolsos")) return "refunds";
    if (pathname.startsWith("/admin/painel")) return "panel";
    return null;
  }, [pathname]);

  return (
    <aside className="sticky top-0 flex h-screen w-[240px] shrink-0 flex-col bg-[#0F0F0F] px-3 py-4">
      <div className="mb-5 flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#22C55E]">
            <ChevronLeft className="h-4 w-4 rotate-180 text-black" strokeWidth={2.5} />
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-white">VeloMetric</span>
        </div>
        <button className="rounded-md p-1 text-white/40 hover:bg-white/5 hover:text-white/80">
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      <button className="mb-4 flex items-center justify-center gap-2 rounded-full bg-white/[0.04] py-2 text-[13px] font-medium text-white/80 transition hover:bg-white/[0.08]">
        <Sparkles className="h-3.5 w-3.5" />
        Sugestões da IA
      </button>

      <nav className="flex-1 space-y-1 text-[13px]">
        {/* Painel with collapsible subnav */}
        <button
          onClick={() => setPanelOpen((v) => !v)}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 transition",
            activeSection === "panel"
              ? "bg-white/[0.06] text-white"
              : "text-white/60 hover:bg-white/[0.04] hover:text-white",
          )}
        >
          <LayoutDashboard className="h-4 w-4" />
          <span className="flex-1 text-left">Painel</span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-white/40 transition-transform",
              panelOpen ? "rotate-0" : "-rotate-90",
            )}
          />
        </button>
        {panelOpen && (
          <div className="ml-6 space-y-0.5 py-1 pl-3">
            {panelSubs.map((s) => {
              const isActive = activeSub === s.key;
              const inner = (
                <div
                  className={cn(
                    "rounded-md px-2 py-1.5 text-[12.5px] transition",
                    isActive ? "text-white" : "text-white/45 hover:text-white/80",
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

        <SideItem icon={LifeBuoy} label="Suporte" to="/admin/suporte" active={activeSection === "support"} />
        <SideItem icon={UsersIcon} label="Usuários & times" to="/admin/usuarios" active={activeSection === "users"} />
        <SideItem icon={DollarSign} label="Comissões" to="/admin/comissoes" active={activeSection === "commissions"} />
        <SideItem icon={RefreshCcw} label="Reembolsos" to="/admin/reembolsos" active={activeSection === "refunds"} />
      </nav>

      <div className="space-y-1 pt-3 text-[13px]">
        <SideItem icon={Settings} label="Configurações" />
        <SideItem icon={FileText} label="Templates" />
        <SideItem icon={User} label="Perfil" />
        <button
          onClick={() => navigate("/dashboard")}
          className="mt-2 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] text-white/50 hover:bg-white/5 hover:text-white/80"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar a Velo
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
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  to?: string;
}) => {
  const inner = (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 transition",
        active
          ? "bg-white/[0.06] text-white"
          : "text-white/60 hover:bg-white/[0.04] hover:text-white",
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : <button className="w-full text-left">{inner}</button>;
};

export default AdminNewSidebar;
