import { useEffect, useMemo, useRef, useState, type ElementType } from "react";
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

type SearchRouteItem = {
  label: string;
  icon: ElementType;
  to: string;
  end?: boolean;
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
  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-[#111111] text-white" aria-hidden="true">
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
        className={`${iconBase} ${active ? "text-[#111111]" : "text-[#737378] group-hover:text-[#111111]"}`}
        strokeWidth={1.5}
      />
      <span className={`relative z-10 truncate ${active ? "font-medium text-[#111111]" : "font-light text-[#55555A] group-hover:text-[#111111]"}`}>
        {item.label}
      </span>
    </>
  );
  const className = `${navBase} ${
    active
      ? "border border-black/[0.08] bg-[linear-gradient(180deg,rgba(0,0,0,0.045)_0%,rgba(0,0,0,0.025)_100%)] text-[#111111] shadow-[0_1px_2px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.75)]"
      : "text-[#55555A] hover:bg-black/[0.035]"
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

const SidebarSearchButton = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex h-9 w-full items-center rounded-[8px] bg-black/[0.035] text-left transition-colors hover:bg-black/[0.055]"
    aria-label="Abrir busca rápida"
  >
    <Search className="ml-2.5 h-4 w-4 shrink-0 text-[#8B8B8F]" strokeWidth={1.5} aria-hidden="true" />
    <span className="ml-3 min-w-0 flex-1 truncate text-[14px] font-normal leading-none text-[#8B8B8F]">Buscar</span>
    <span className="mr-2 rounded-[4px] bg-black/[0.05] px-1.5 py-1 text-[11px] font-normal leading-none text-[#8B8B8F]">
      ⌘K
    </span>
  </button>
);

const SearchCommandModal = ({
  open,
  query,
  setQuery,
  selectedIndex,
  setSelectedIndex,
  items,
  onClose,
  onSelect,
}: {
  open: boolean;
  query: string;
  setQuery: (value: string) => void;
  selectedIndex: number;
  setSelectedIndex: (value: number) => void;
  items: SearchRouteItem[];
  onClose: () => void;
  onSelect: (item: SearchRouteItem) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timeout);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center bg-black/55 px-4 pt-[16vh] backdrop-blur-[2px]" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Fechar busca" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[560px] overflow-hidden rounded-[18px] border border-white/[0.08] bg-[#111113] text-white shadow-[0_24px_80px_rgba(0,0,0,0.36)]">
        <div className="flex h-14 items-center gap-3 border-b border-white/[0.08] px-4">
          <Search className="h-[18px] w-[18px] shrink-0 text-[#8B8B8F]" strokeWidth={1.5} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setSelectedIndex(items.length === 0 ? 0 : (selectedIndex + 1) % items.length);
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setSelectedIndex(items.length === 0 ? 0 : (selectedIndex - 1 + items.length) % items.length);
              }
              if (event.key === "Enter" && items[selectedIndex]) {
                event.preventDefault();
                onSelect(items[selectedIndex]);
              }
              if (event.key === "Escape") {
                event.preventDefault();
                onClose();
              }
            }}
            placeholder="Buscar página..."
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-normal text-white outline-none placeholder:text-[#8B8B8F]"
          />
          <span className="rounded-[4px] bg-white/[0.08] px-1.5 py-1 text-[11px] leading-none text-[#8B8B8F]">Esc</span>
        </div>

        <div className="max-h-[360px] overflow-y-auto p-2">
          {items.length === 0 ? (
            <div className="px-3 py-8 text-center text-[14px] text-[#8B8B8F]">Nenhuma página encontrada.</div>
          ) : (
            items.map((item, index) => {
              const Icon = item.icon;
              const selected = index === selectedIndex;

              return (
                <button
                  key={item.to}
                  type="button"
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => onSelect(item)}
                  className={`flex h-11 w-full items-center gap-3 rounded-[8px] px-3 text-left text-[14px] transition-colors ${
                    selected
                      ? "border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.07)_0%,rgba(255,255,255,0.04)_100%)] text-white shadow-[0_1px_2px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)]"
                      : "text-[#B4B4B8] hover:bg-white/[0.04]"
                  }`}
                >
                  <Icon className={`h-[18px] w-[18px] shrink-0 ${selected ? "text-white" : "text-[#8B8B8F]"}`} strokeWidth={1.5} aria-hidden="true" />
                  <span className={selected ? "font-medium" : "font-light"}>{item.label}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

const DashboardSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { nome, foto } = useProfile();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const displayName = nome || user?.user_metadata?.full_name || user?.email || "Velo";
  const initials = getInitials(displayName, user?.email);
  const email = user?.email || "conta@velo.app";

  const utilityNav: NavItem[] = [
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

  const searchRouteItems: SearchRouteItem[] = [
    { label: "Início", icon: Home, to: "/dashboard", end: true },
    ...mainNav.map((item) => ({
      label: item.label,
      icon: item.icon,
      to: item.to || "/dashboard",
      end: item.end,
    })),
  ];

  const filteredSearchItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase("pt-BR");
    if (!normalizedQuery) return searchRouteItems;
    return searchRouteItems.filter((item) => item.label.toLocaleLowerCase("pt-BR").includes(normalizedQuery));
  }, [searchQuery, searchRouteItems]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        setSearchQuery("");
        setSelectedIndex(0);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const isActive = (item: NavItem) => {
    if (!item.to) return false;

    const current = cleanPath(location.pathname);
    const target = cleanPath(item.to);

    return item.end ? current === target : current === target || current.startsWith(`${target}/`);
  };

  const openSearch = () => {
    setSearchOpen(true);
    setSearchQuery("");
    setSelectedIndex(0);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
    setSelectedIndex(0);
  };

  const selectSearchItem = (item: SearchRouteItem) => {
    navigate(item.to);
    closeSearch();
  };

  return (
    <>
      <aside
        className="velo-dashboard-sidebar flex h-full min-h-0 w-[260px] shrink-0 flex-col border-r border-black/[0.06] text-[#55555A]"
        style={{
          fontFamily: sidebarFont,
          background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,250,250,0.985) 54%, rgba(247,247,247,0.98) 100%)",
          backdropFilter: "blur(24px) saturate(130%)",
          WebkitBackdropFilter: "blur(24px) saturate(130%)",
        }}
      >
        <header className="flex items-center justify-between gap-4 px-4 pb-5 pt-[22px]">
          <Link to="/dashboard" className="flex min-w-0 items-center gap-3">
            <VeloSidebarLogo />
            <span className="truncate text-[16px] font-semibold leading-none text-[#111111]">Velo</span>
          </Link>
        </header>

        <div className="mx-4 h-px bg-black/[0.08]" />

        <nav className="flex flex-col gap-1 px-4 py-5" aria-label="Utilitários">
          <div className="mb-2">
            <SidebarSearchButton onClick={openSearch} />
          </div>
          {utilityNav.map((item) => (
            <SidebarNavItem key={item.label} item={item} active={isActive(item)} />
          ))}
        </nav>

        <div className="mx-4 h-px bg-black/[0.08]" />

        <nav className="flex flex-col gap-1 px-4 py-5" aria-label="Navegação principal">
          {mainNav.map((item) => (
            <SidebarNavItem key={item.label} item={item} active={isActive(item)} />
          ))}
        </nav>

        <div className="min-h-0 flex-1" />

        <footer className="m-3 rounded-[10px] bg-black/[0.04] p-3">
          <button
            type="button"
            onClick={() => navigate("/dashboard/configuracoes")}
            className="flex w-full min-w-0 items-center gap-3 text-left"
            aria-label="Abrir perfil"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-black/[0.08] text-[12px] font-medium text-[#111111]">
              {foto ? <img src={foto} alt="" className="h-full w-full object-cover" /> : initials || "VL"}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-medium leading-5 text-[#111111]">{displayName}</span>
              <span className="block truncate text-[12px] font-normal leading-4 text-[#737378]">{email}</span>
            </span>
          </button>
        </footer>
      </aside>

      <SearchCommandModal
        open={searchOpen}
        query={searchQuery}
        setQuery={setSearchQuery}
        selectedIndex={selectedIndex}
        setSelectedIndex={setSelectedIndex}
        items={filteredSearchItems}
        onClose={closeSearch}
        onSelect={selectSearchItem}
      />
    </>
  );
};

export default DashboardSidebar;
