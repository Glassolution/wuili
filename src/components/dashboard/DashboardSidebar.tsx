import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Archive, ClipboardList, Compass, Copy, Home, Info, Search, Settings2, Sparkles, Users, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type NavItem = {
  label: string;
  icon: typeof Home;
  to: string;
  end?: boolean;
};

const navItems: NavItem[] = [
  { label: "Início", icon: Home, to: "/dashboard", end: true },
  { label: "Catálogo", icon: Compass, to: "/dashboard/catalogo" },
  { label: "Publicações", icon: Archive, to: "/dashboard/publicacoes" },
  { label: "Pedidos", icon: Copy, to: "/dashboard/pedidos" },
  { label: "Afiliados", icon: Users, to: "/dashboard/comissoes" },
  { label: "Relatórios", icon: ClipboardList, to: "/dashboard/relatorios" },
  { label: "Ajuda & Central", icon: Info, to: "/docs" },
  { label: "Configurações", icon: Settings2, to: "/dashboard/configuracoes" },
];

const normalizePath = (path: string) => path.split("?")[0].replace(/\/$/, "");

const VeloSidebarLogo = () => (
  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[#000000] text-[#FFFFFF]" aria-hidden="true">
    <svg width="16" height="16" viewBox="0 0 48 48" fill="none">
      <path d="M33 18 A11 11 0 1 0 33 30" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M30 26 L34 30 L38 26" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
);

const SidebarNavLink = ({ item, active }: { item: NavItem; active: boolean }) => {
  const Icon = item.icon;

  return (
    <Link
      to={item.to}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-[10px] rounded-[10px] px-3 py-[9px] text-[14px] transition-colors ${
        active ? "bg-[#2C2C2C] font-medium text-[#FFFFFF]" : "bg-transparent font-normal text-[#4A4A4A] hover:bg-[#FAFAFA]"
      }`}
    >
      <Icon
        className={`h-[18px] w-[18px] shrink-0 ${active ? "fill-current text-[#FFFFFF]" : "text-[#4A4A4A]"}`}
        strokeWidth={1.5}
        aria-hidden="true"
      />
      <span className="truncate">{item.label}</span>
    </Link>
  );
};

const DashboardSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showUpgradeCard, setShowUpgradeCard] = useState(true);
  const profileEmail = user?.email || "conta@velo.app";

  const isActive = (item: NavItem) => {
    const currentPath = normalizePath(location.pathname);
    const itemPath = normalizePath(item.to);
    return item.end ? currentPath === itemPath : currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
  };

  return (
    <aside className="velo-dashboard-sidebar flex h-full min-h-0 w-[260px] shrink-0 flex-col gap-6 rounded-[16px] bg-[#FFFFFF] px-4 py-5 text-[#4A4A4A] [border-right:0.5px_solid_#E5E5E5]">
      <Link to="/dashboard" className="flex items-center gap-[10px]">
        <VeloSidebarLogo />
        <span className="truncate text-[16px] font-medium text-[#000000]">Velo</span>
      </Link>

      <button
        type="button"
        className="flex items-center gap-[10px] rounded-[10px] bg-[#F7F7F6] px-3 py-[10px] text-left"
        aria-label="Buscar"
      >
        <Search className="h-4 w-4 shrink-0 text-[#999999]" strokeWidth={1.5} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-[14px] font-normal text-[#999999]">Buscar</span>
        <span className="rounded-[5px] bg-[#EFEFEE] px-[6px] py-[2px] text-[11px] font-normal leading-none text-[#999999]">⌘K</span>
      </button>

      <nav className="flex flex-col gap-1" aria-label="Navegação principal">
        {navItems.map((item) => (
          <SidebarNavLink key={item.label} item={item} active={isActive(item)} />
        ))}
      </nav>

      <div className="min-h-0 flex-1" aria-hidden="true" />

      {showUpgradeCard ? (
        <section className="rounded-[16px] bg-[#F3F2F0] p-4" aria-label="Upgrade para Premium">
          <div className="flex items-center justify-between">
            <Sparkles className="h-[18px] w-[18px] text-[#000000]" strokeWidth={1.5} aria-hidden="true" />
            <button
              type="button"
              onClick={() => setShowUpgradeCard(false)}
              className="flex h-4 w-4 items-center justify-center text-[#999999]"
              aria-label="Ocultar card de upgrade"
            >
              <X className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>

          <p className="mt-[6px] text-[14px] font-medium text-[#000000]">Upgrade para o Premium!</p>
          <p className="mt-1 text-[13px] leading-[1.4] text-[#777777]">
            Publique sem limites
            <br />
            Personalize sua marca
          </p>

          <button
            type="button"
            onClick={() => navigate("/dashboard/planos")}
            className="mt-[10px] h-[38px] w-full rounded-full bg-[#000000] text-[13px] font-medium text-[#FFFFFF]"
          >
            Fazer upgrade
          </button>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => navigate("/dashboard/configuracoes")}
        className="flex min-w-0 items-center gap-[10px] rounded-[14px] bg-[#F3F2F0] px-3 py-[10px] text-left"
        aria-label="Abrir perfil"
      >
        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#E0E0E0] text-[12px] font-semibold text-[#333333]">
          FX
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold text-[#000000]">Felipe Xavier</span>
          <span className="block truncate whitespace-nowrap text-[11px] text-[#999999]">{profileEmail}</span>
        </span>
      </button>
    </aside>
  );
};

export default DashboardSidebar;
