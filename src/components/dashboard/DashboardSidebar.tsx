import { useState, type ElementType } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Archive,
  Bell,
  CircleHelp,
  ClipboardList,
  Compass,
  Home,
  LayoutTemplate,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/lib/profileContext";
import ProductScoutAI, { type AtlasResults } from "@/components/dashboard/ProductScoutAI";

type NavItem = {
  label: string;
  icon: ElementType;
  to?: string;
  end?: boolean;
  onClick?: () => void;
};

const sidebarFont = '"Inter Variable", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const logoSrc = "/velo-sidebar-logo.png";

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
  "group relative flex h-10 w-full items-center gap-3 overflow-hidden rounded-[9px] px-4 text-left text-[14.5px] font-normal leading-none transition-[background,color,box-shadow] duration-200";

const iconBase = "relative z-10 h-[19px] w-[19px] shrink-0 transition-colors duration-200";

const SidebarNavItem = ({ item, active }: { item: NavItem; active?: boolean }) => {
  const Icon = item.icon;
  const content = (
    <>
      <Icon
        aria-hidden="true"
        className={`${iconBase} ${active ? "text-white" : "text-[#9CA3AF] group-hover:text-[#E5E7EB]"}`}
        strokeWidth={1.5}
      />
      <span className={`relative z-10 truncate ${active ? "text-white" : "text-[#D1D5DB] group-hover:text-white"}`}>
        {item.label}
      </span>
    </>
  );
  const className = `${navBase} ${
    active
      ? "bg-white/[0.075] shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_1px_0_rgba(0,0,0,0.35)]"
      : "text-[#D1D5DB] hover:bg-white/[0.045]"
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
  const [atlasOpen, setAtlasOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const displayName = nome || user?.user_metadata?.full_name || user?.email || "Velo";
  const initials = getInitials(displayName, user?.email);

  const utilityNav: NavItem[] = [
    { label: "Buscar", icon: Search, onClick: () => navigate("/dashboard/catalogo") },
    { label: "Atlas AI", icon: Sparkles, onClick: () => setAtlasOpen(true) },
    { label: "Início", icon: Home, to: "/dashboard", end: true },
    { label: "Modelos", icon: LayoutTemplate, to: "/dashboard/produtos" },
    { label: "Notificações", icon: Bell, onClick: () => setNotificationsOpen((open) => !open) },
  ];

  const mainNav: NavItem[] = [
    { label: "Catálogo", icon: Compass, to: "/dashboard/catalogo" },
    { label: "Publicações", icon: Archive, to: "/dashboard/publicacoes" },
    { label: "Pedidos", icon: ShoppingBag, to: "/dashboard/pedidos" },
    { label: "Afiliados", icon: Users, to: "/dashboard/comissoes" },
    { label: "Relatórios", icon: ClipboardList, to: "/dashboard/relatorios" },
    { label: "Ajuda & Central", icon: CircleHelp, to: "/docs" },
    { label: "Configurações", icon: Settings, to: "/dashboard/configuracoes" },
  ];

  const isActive = (item: NavItem) => {
    if (!item.to) return false;

    const current = cleanPath(location.pathname);
    const target = cleanPath(item.to);

    return item.end ? current === target : current === target || current.startsWith(`${target}/`);
  };

  const handleAtlasResults = (_results: AtlasResults) => {
    setAtlasOpen(false);
  };

  return (
    <>
      <aside
        className="velo-dashboard-sidebar flex h-full min-h-0 w-[264px] shrink-0 flex-col border-r border-white/[0.06] px-[22px] py-[22px] text-[#D1D5DB]"
        style={{
          fontFamily: sidebarFont,
          background: "linear-gradient(180deg, rgba(18,18,20,0.96) 0%, rgba(13,13,15,0.985) 54%, rgba(10,10,11,0.98) 100%)",
          boxShadow: "inset -1px 0 0 rgba(255,255,255,0.035), 18px 0 42px rgba(0,0,0,0.18)",
          backdropFilter: "blur(24px) saturate(130%)",
          WebkitBackdropFilter: "blur(24px) saturate(130%)",
        }}
      >
        <header className="flex items-center justify-between gap-4 pb-[22px]">
          <Link to="/dashboard" className="flex min-w-0 items-center">
            <img
              src={logoSrc}
              alt="Velo"
              className="h-[31px] w-auto max-w-[92px] select-none object-contain"
              style={{ filter: "invert(1)", mixBlendMode: "screen" }}
              draggable={false}
            />
          </Link>

          <button
            type="button"
            onClick={() => navigate("/dashboard/configuracoes")}
            className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full border border-white/10 bg-white/[0.06] text-[11px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:bg-white/[0.09]"
            aria-label="Abrir perfil"
          >
            {foto ? <img src={foto} alt="" className="h-full w-full object-cover" /> : initials || "VL"}
          </button>
        </header>

        <div className="h-px bg-white/[0.12]" />

        <nav className="relative flex flex-col gap-[9px] py-[24px]" aria-label="Utilitários">
          {utilityNav.map((item) => (
            <SidebarNavItem key={item.label} item={item} active={isActive(item)} />
          ))}

          {notificationsOpen && (
            <div className="absolute left-0 right-0 top-[calc(100%-16px)] z-20 rounded-[12px] border border-white/[0.08] bg-[#18181A] p-3 text-[12px] leading-5 text-[#A1A1AA] shadow-[0_18px_38px_rgba(0,0,0,0.42)]">
              <p className="font-medium text-white">Notificações</p>
              <p className="mt-1">Tudo em dia por enquanto.</p>
            </div>
          )}
        </nav>

        <div className="h-px bg-white/[0.12]" />

        <nav className="flex flex-col gap-[9px] py-[26px]" aria-label="Navegação principal">
          {mainNav.map((item) => (
            <SidebarNavItem key={item.label} item={item} active={isActive(item)} />
          ))}
        </nav>
      </aside>

      <ProductScoutAI
        open={atlasOpen}
        onOpenChange={setAtlasOpen}
        onResults={handleAtlasResults}
        showTriggerButton={false}
      />
    </>
  );
};

export default DashboardSidebar;
