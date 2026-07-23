import { useEffect, useState, type ElementType } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronDown,
  DollarSign,
  Headset,
  LayoutDashboard,
  RefreshCcw,
  Search,
  ShoppingBag,
  Users as UsersIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import SearchPalette from "@/components/dashboard/SearchPalette";

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar do admin — reconstruída do zero com as proporções da referência
// (Polar). Diferenças-chave em relação à versão anterior:
//  • Largura 272px (antes 248) e mais respiro horizontal interno.
//  • Fundo neutro near-black com divisória sutil à direita (antes um card
//    quente #171714 emoldurado).
//  • Nav items 40px de altura, ícones 18px em cinza apagado (antes 32px / 16px
//    brancos), texto 14px; item ativo com fundo sutil translúcido, sem sombra.
//  • Card de usuário mais arredondado e com padding maior.
//  • Busca no rodapé como caixa "bordada" (estilo docs), não um box inset.
// ─────────────────────────────────────────────────────────────────────────────

type NavItem = {
  label: string;
  icon: ElementType;
  to: string;
  badge?: number;
};

const navItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/admin/painel" },
  { label: "Suporte", icon: Headset, to: "/admin/suporte" },
  { label: "Usuários & times", icon: UsersIcon, to: "/admin/usuarios" },
  { label: "Comissões", icon: DollarSign, to: "/admin/comissoes" },
  { label: "Reembolsos", icon: RefreshCcw, to: "/admin/reembolsos" },
  { label: "AliExpress", icon: ShoppingBag, to: "/admin/aliexpress" },
];

const getInitials = (name: string, email?: string | null) => {
  const raw = (name || email || "Velo").trim();
  const parts = raw.split(/[\s._@-]+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
};

const VeloIconOnly = () => (
  <svg aria-hidden="true" width="26" height="26" viewBox="0 0 48 48" fill="none" style={{ flexShrink: 0 }}>
    <path d="M33 18 A11 11 0 1 0 33 30" stroke="#F2F1EC" strokeWidth="4" strokeLinecap="round" />
    <path d="M30 26 L34 30 L38 26" stroke="#F2F1EC" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SidebarNavLink = ({ item, active }: { item: NavItem; active: boolean }) => {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      aria-current={active ? "page" : undefined}
      className={`group flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] tracking-[-0.005em] transition-colors ${
        active
          ? "bg-white/[0.045] font-normal text-white"
          : "font-normal text-white/55 hover:bg-white/[0.03] hover:text-white/85"
      }`}
    >
      <Icon
        size={15}
        strokeWidth={1.5}
        aria-hidden="true"
        className={active ? "text-white/85" : "text-white/40 group-hover:text-white/65"}
      />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.badge ? (
        <span
          aria-label={`${item.badge} tickets abertos`}
          className="ml-auto inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-white/[0.08] px-1.5 text-[10px] font-medium text-white/70"
        >
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      ) : null}
    </Link>
  );
};

export const AdminNewSidebar = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [searchOpen, setSearchOpen] = useState(false);

  const { data: openTickets = 0 } = useQuery({
    queryKey: ["admin-open-tickets-count"],
    enabled: !!user?.id,
    queryFn: async () => {
      // support_tickets ainda não está nos tipos gerados do Supabase, por isso o cast.
      const { count, error } = await (supabase as any)
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .eq("status", "open");
      if (error) throw error;
      return (count as number) ?? 0;
    },
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel("admin-sidebar-tickets")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => {
        void qc.invalidateQueries({ queryKey: ["admin-open-tickets-count"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc, user?.id]);

  const foto =
    (user?.user_metadata?.avatar_url as string | undefined) ||
    (user?.user_metadata?.picture as string | undefined) ||
    null;
  const profileName =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    (user?.email ? user.email.split("@")[0] : "Usuário");
  const profileEmail = user?.email || "conta@velo.app";
  const initials = getInitials(profileName, user?.email);

  const isActive = (item: NavItem) => {
    const target = item.to.replace(/\/$/, "");
    return pathname === target || pathname.startsWith(`${target}/`);
  };

  return (
    <aside
      className="velo-dashboard-sidebar flex h-full w-[272px] shrink-0 flex-col border-r border-white/[0.06] bg-[#0A0A0B] px-4 py-5"
      style={{
        fontFamily:
          '"Inter Variable", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* 1. Marca */}
      <Link to="/admin/painel" className="flex items-center gap-2.5 px-2 text-[#F2F1EC] no-underline">
        <VeloIconOnly />
        <span className="text-[19px] font-bold leading-none tracking-[-0.05em]">Velo</span>
      </Link>

      {/* 2. Seletor de usuário/workspace — card arredondado com padding generoso */}
      <button
        type="button"
        aria-label="Abrir perfil"
        onClick={() => navigate("/dashboard/configuracoes")}
        className="mt-6 flex w-full items-center gap-2.5 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-2.5 py-2.5 text-left transition-colors hover:bg-white/[0.05]"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/[0.08] text-[11px] font-bold text-white">
          {foto ? <img src={foto} alt="" className="h-full w-full object-cover" /> : initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold leading-tight text-white">{profileName}</span>
          <span className="mt-0.5 block truncate text-[11.5px] leading-tight text-white/45">{profileEmail}</span>
        </span>
        <ChevronDown size={16} strokeWidth={1.7} aria-hidden="true" className="shrink-0 text-white/40" />
      </button>

      {/* 3. Navegação */}
      <nav aria-label="Navegação do admin" className="mt-7 flex flex-col gap-1">
        {navItems.map((item) => (
          <SidebarNavLink
            key={item.label}
            item={item.to === "/admin/suporte" ? { ...item, badge: openTickets } : item}
            active={isActive(item)}
          />
        ))}
      </nav>

      <div aria-hidden="true" className="min-h-0 flex-1" />

      {/* 4. Retorno secundário */}
      <Link
        to="/dashboard"
        className="mb-2 flex h-9 items-center gap-2.5 rounded-[10px] px-3 text-[13px] font-medium text-white/55 no-underline transition-colors hover:bg-white/[0.035] hover:text-white/85"
      >
        <ArrowLeft size={16} strokeWidth={1.65} aria-hidden="true" />
        <span>Voltar à Velo</span>
      </Link>

      {/* 5. Busca fixada no rodapé (caixa bordada, estilo docs da referência) */}
      <button
        type="button"
        aria-label="Buscar"
        onClick={() => setSearchOpen(true)}
        className="flex h-11 w-full items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 text-left transition-colors hover:bg-white/[0.045]"
      >
        <Search size={16} strokeWidth={1.7} aria-hidden="true" className="text-white/45" />
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-white/70">Buscar</span>
        <span className="grid h-6 w-6 place-items-center rounded-md bg-white/[0.07] text-[13px] font-medium text-white/55">
          /
        </span>
      </button>

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} isAdmin />
    </aside>
  );
};

export default AdminNewSidebar;
