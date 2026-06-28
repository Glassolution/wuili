import { type ElementType } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Archive,
  Bell,
  ClipboardList,
  Compass,
  Copy,
  Home,
  Info,
  LayoutList,
  Search,
  Settings2,
  Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/lib/profileContext";

type NavItem = {
  label: string;
  icon: ElementType;
  to?: string;
  end?: boolean;
  onClick?: () => void;
};

const sidebarFont = '"Inter Variable", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const cleanPath = (value: string) => value.split("?")[0].replace(/\/$/, "");

const getInitials = (name: string, email?: string | null) => {
  const raw = (name || email || "Velo").trim();
  const parts = raw.split(/[\s._@-]+/).filter(Boolean);

  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
};

const navBase =
  "group relative flex h-9 w-full items-center gap-3 overflow-hidden rounded-[8px] px-3 text-left text-[14px] font-normal leading-none transition-colors duration-200";

const iconBase = "relative z-10 h-[18px] w-[18px] shrink-0 transition-colors duration-200";

const VeloSidebarLogo = () => (
  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-white text-black" aria-hidden="true">
    <svg width="17" height="17" viewBox="0 0 48 48" fill="none">
      <path d="M33 18 A11 11 0 1 0 33 30" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M30 26 L34 30 L38 26" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
);

const SidebarNavItem = ({ item, active }: { item: NavItem; active?: boolean }) => {
  const Icon = item.icon;
  const content = (
    <>
      <Icon
        aria-hidden="true"
        className={`${iconBase} ${active ? "text-white" : "text-[#8B8B8F] group-hover:text-white"}`}
        strokeWidth={1.5}
      />
      <span className={`relative z-10 truncate ${active ? "font-medium text-white" : "font-light text-[#B4B4B8] group-hover:text-white"}`}>
        {item.label}
      </span>
    </>
  );
  const className = `${navBase} ${
    active
      ? "border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.07)_0%,rgba(255,255,255,0.04)_100%)] text-white shadow-[0_1px_2px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)]"
      : "text-[#B4B4B8] hover:bg-white/[0.04]"
  }`;

  if (item.to) {
    return (
      <Link to={item.to} className={className} aria-current={active ? "page" : undefined}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={item.onClick} className={className}>
      {content}
    </button>
  );
};

const DashboardSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { nome, foto } = useProfile();

  const displayName = nome || user?.user_metadata?.full_name || user?.email || "Velo";
  const initials = getInitials(displayName, user?.email);
  const email = user?.email || "conta@velo.app";

  const utilityNav: NavItem[] = [
    { label: "Buscar", icon: Search, onClick: () => navigate("/dashboard/catalogo") },
    { label: "Início", icon: Home, to: "/dashboard", end: true },
    { label: "Modelos", icon: LayoutList, to: "/dashboard/produtos" },
    { label: "Notificações", icon: Bell, onClick: () => undefined },
  ];

  const mainNav: NavItem[] = [
    { label: "Catálogo", icon: Compass, to: "/dashboard/catalogo" },
    { label: "Publicações", icon: Archive, to: "/dashboard/publicacoes" },
    { label: "Pedidos", icon: Copy, to: "/dashboard/pedidos" },
    { label: "Afiliados", icon: Users, to: "/dashboard/comissoes" },
    { label: "Relatórios", icon: ClipboardList, to: "/dashboard/relatorios" },
    { label: "Ajuda & Central", icon: Info, to: "/docs" },
    { label: "Configurações", icon: Settings2, to: "/dashboard/configuracoes" },
  ];

  const isActive = (item: NavItem) => {
    if (!item.to) return false;

    const current = cleanPath(location.pathname);
    const target = cleanPath(item.to);

    return item.end ? current === target : current === target || current.startsWith(`${target}/`);
  };

  return (
    <aside
      className="velo-dashboard-sidebar flex h-full min-h-0 w-[260px] shrink-0 flex-col border-r border-white/[0.06] text-[#B4B4B8]"
      style={{
        fontFamily: sidebarFont,
        background: "linear-gradient(180deg, rgba(18,18,20,0.96) 0%, rgba(13,13,15,0.985) 54%, rgba(10,10,11,0.98) 100%)",
        backdropFilter: "blur(24px) saturate(130%)",
        WebkitBackdropFilter: "blur(24px) saturate(130%)",
      }}
    >
      <header className="flex items-center justify-between gap-4 px-4 pb-5 pt-[22px]">
        <Link to="/dashboard" className="flex min-w-0 items-center gap-3">
          <VeloSidebarLogo />
          <span className="truncate text-[16px] font-semibold leading-none text-white">Velo</span>
        </Link>

        <button
          type="button"
          onClick={() => navigate("/dashboard/configuracoes")}
          className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full border border-white/10 bg-white/[0.04] text-[11px] font-medium text-white"
          aria-label="Abrir perfil"
        >
          {foto ? <img src={foto} alt="" className="h-full w-full object-cover" /> : initials || "VL"}
        </button>
      </header>

      <div className="mx-4 h-px bg-white/[0.08]" />

      <nav className="flex flex-col gap-1 px-4 py-5" aria-label="Utilitários">
        {utilityNav.map((item) => (
          <SidebarNavItem key={item.label} item={item} active={isActive(item)} />
        ))}
      </nav>

      <div className="mx-4 h-px bg-white/[0.08]" />

      <nav className="flex flex-col gap-1 px-4 py-5" aria-label="Navegação principal">
        {mainNav.map((item) => (
          <SidebarNavItem key={item.label} item={item} active={isActive(item)} />
        ))}
      </nav>

      <div className="min-h-0 flex-1" />

      <footer className="m-3 rounded-[10px] bg-white/[0.04] p-3">
        <button
          type="button"
          onClick={() => navigate("/dashboard/configuracoes")}
          className="flex w-full min-w-0 items-center gap-3 text-left"
          aria-label="Abrir perfil"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-white/[0.08] text-[12px] font-medium text-white">
            {foto ? <img src={foto} alt="" className="h-full w-full object-cover" /> : initials || "VL"}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-medium leading-5 text-white">{displayName}</span>
            <span className="block truncate text-[12px] font-normal leading-4 text-[#8B8B8F]">{email}</span>
          </span>
        </button>
      </footer>
    </aside>
  );
};

export default DashboardSidebar;
