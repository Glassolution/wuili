import { useEffect, useMemo, useRef, useState, type ElementType } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Archive, ClipboardList, Compass, Copy, Home, Info, Search, Settings2, Sparkles, Users, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type NavItem = {
  label: string;
  icon: ElementType;
  to: string;
  end?: boolean;
};

const sidebarFont = '"Inter Variable", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const cleanPath = (value: string) => value.split("?")[0].replace(/\/$/, "");

const activePillClass =
  "border border-black/[0.08] bg-[linear-gradient(180deg,rgba(0,0,0,0.045)_0%,rgba(0,0,0,0.025)_100%)] text-[#000000] shadow-[0_1px_2px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.75)]";

const topNavItems: NavItem[] = [{ label: "Início", icon: Home, to: "/dashboard", end: true }];

const mainNavItems: NavItem[] = [
  { label: "Catálogo", icon: Compass, to: "/dashboard/catalogo" },
  { label: "Publicações", icon: Archive, to: "/dashboard/publicacoes" },
  { label: "Pedidos", icon: Copy, to: "/dashboard/pedidos" },
  { label: "Afiliados", icon: Users, to: "/dashboard/comissoes" },
  { label: "Relatórios", icon: ClipboardList, to: "/dashboard/relatorios" },
  { label: "Ajuda & Central", icon: Info, to: "/docs" },
  { label: "Configurações", icon: Settings2, to: "/dashboard/configuracoes" },
];

const searchRouteItems = [...topNavItems, ...mainNavItems];

const VeloSidebarLogo = () => (
  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-[#000000] text-white" aria-hidden="true">
    <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
      <path d="M33 18 A11 11 0 1 0 33 30" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M30 26 L34 30 L38 26" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
);

const SidebarNavItem = ({ item, active }: { item: NavItem; active?: boolean }) => {
  const Icon = item.icon;

  return (
    <Link
      to={item.to}
      className={`group flex h-[38px] w-full items-center gap-3 rounded-[10px] px-3 text-[14px] leading-none transition-colors ${
        active ? activePillClass : "text-[#4A4A4A] hover:bg-[#FAFAFA]"
      }`}
      aria-current={active ? "page" : undefined}
    >
      <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-[#000000]" : "text-[#6B6B6B]"}`} strokeWidth={1.5} aria-hidden="true" />
      <span className={`truncate ${active ? "font-medium text-[#000000]" : "font-normal text-[#4A4A4A]"}`}>{item.label}</span>
    </Link>
  );
};

const SidebarSearchButton = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="mx-4 mt-3 flex h-[40px] items-center gap-2 rounded-[10px] bg-[#F7F7F6] px-3 text-left transition-colors hover:bg-[#F3F2F0]"
    aria-label="Abrir busca rápida"
  >
    <Search className="h-[18px] w-[18px] shrink-0 text-[#6B6B6B]" strokeWidth={1.5} aria-hidden="true" />
    <span className="min-w-0 flex-1 truncate text-[14px] font-normal text-[#6B6B6B]">Buscar</span>
    <span className="rounded-[5px] bg-[#F3F2F0] px-1.5 py-1 text-[12px] font-medium leading-none text-[#6B6B6B]">⌘K</span>
  </button>
);

const SidebarUpgradeCard = ({ onClose, onUpgrade }: { onClose: () => void; onUpgrade: () => void }) => (
  <div className="mx-4 mb-3 rounded-[16px] bg-[#F3F2F0] p-4 text-[#000000]">
    <div className="flex items-start justify-between gap-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-white/70 text-[#000000]">
        <Sparkles className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden="true" />
      </div>
      <button
        type="button"
        onClick={onClose}
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[#999999] transition-colors hover:bg-black/[0.05] hover:text-[#000000]"
        aria-label="Ocultar card de upgrade"
      >
        <X className="h-[14px] w-[14px]" strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>

    <div className="mt-3">
      <p className="text-[14px] font-semibold leading-5">Upgrade para o Premium!</p>
      <p className="mt-1 text-[13px] leading-[1.4] text-[#6B6B6B]">Publique sem limites</p>
      <p className="text-[13px] leading-[1.4] text-[#6B6B6B]">Personalize sua marca</p>
    </div>

    <button
      type="button"
      onClick={onUpgrade}
      className="mt-3 flex h-10 w-full items-center justify-center rounded-full bg-[#000000] text-[14px] font-medium text-white transition-colors hover:bg-black/90"
    >
      Fazer upgrade
    </button>
  </div>
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
  items: NavItem[];
  onClose: () => void;
  onSelect: (item: NavItem) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timeout);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center bg-black/40 px-4 pt-[16vh] backdrop-blur-[2px]" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Fechar busca" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[560px] overflow-hidden rounded-[18px] border border-black/[0.08] bg-white text-[#000000] shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
        <div className="flex h-14 items-center gap-3 border-b border-[#E5E5E5] px-4">
          <Search className="h-[18px] w-[18px] shrink-0 text-[#6B6B6B]" strokeWidth={1.5} aria-hidden="true" />
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
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-normal text-[#000000] outline-none placeholder:text-[#8A8A8A]"
          />
          <span className="rounded-[5px] bg-[#F3F2F0] px-1.5 py-1 text-[11px] leading-none text-[#6B6B6B]">Esc</span>
        </div>

        <div className="max-h-[360px] overflow-y-auto p-2">
          {items.length === 0 ? (
            <div className="px-3 py-8 text-center text-[14px] text-[#8A8A8A]">Nenhuma página encontrada.</div>
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
                  className={`flex h-11 w-full items-center gap-3 rounded-[10px] px-3 text-left text-[14px] transition-colors ${
                    selected ? activePillClass : "text-[#4A4A4A] hover:bg-[#FAFAFA]"
                  }`}
                >
                  <Icon className={`h-[18px] w-[18px] shrink-0 ${selected ? "text-[#000000]" : "text-[#6B6B6B]"}`} strokeWidth={1.5} aria-hidden="true" />
                  <span className={selected ? "font-medium" : "font-normal"}>{item.label}</span>
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showUpgradeCard, setShowUpgradeCard] = useState(true);
  const profileEmail = user?.email || "conta@velo.app";

  const filteredSearchItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase("pt-BR");
    if (!normalizedQuery) return searchRouteItems;
    return searchRouteItems.filter((item) => item.label.toLocaleLowerCase("pt-BR").includes(normalizedQuery));
  }, [searchQuery]);

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

  const selectSearchItem = (item: NavItem) => {
    navigate(item.to);
    closeSearch();
  };

  return (
    <>
      <aside
        className="velo-dashboard-sidebar flex h-full min-h-0 w-[260px] shrink-0 flex-col border-r border-[#E5E5E5] bg-white text-[#4A4A4A]"
        style={{ fontFamily: sidebarFont }}
      >
        <header className="flex items-center gap-3 border-b border-[#E5E5E5] px-5 py-6">
          <Link to="/dashboard" className="flex min-w-0 items-center gap-3">
            <VeloSidebarLogo />
            <span className="truncate text-[16px] font-semibold leading-none text-[#000000]">Velo</span>
          </Link>
        </header>

        <SidebarSearchButton onClick={openSearch} />

        <nav className="px-4 pt-3" aria-label="Navegação inicial">
          {topNavItems.map((item) => (
            <SidebarNavItem key={item.label} item={item} active={isActive(item)} />
          ))}
        </nav>

        <div className="mx-4 mt-4 h-px bg-[#E5E5E5]" />

        <nav className="flex flex-col gap-1 px-4 pt-4" aria-label="Navegação principal">
          {mainNavItems.map((item) => (
            <SidebarNavItem key={item.label} item={item} active={isActive(item)} />
          ))}
        </nav>

        <div className="min-h-0 flex-1" />

        {showUpgradeCard ? (
          <SidebarUpgradeCard onClose={() => setShowUpgradeCard(false)} onUpgrade={() => navigate("/dashboard/planos")} />
        ) : null}

        <footer className="mx-4 mb-4 rounded-[14px] bg-[#F3F2F0] p-[10px_12px]">
          <button
            type="button"
            onClick={() => navigate("/dashboard/configuracoes")}
            className="flex w-full min-w-0 items-center gap-3 text-left"
            aria-label="Abrir perfil"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#E0E0E0] text-[12px] font-medium text-[#000000]">
              FX
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-semibold leading-5 text-[#000000]">Felipe Xavier</span>
              <span className="block truncate text-[12px] font-normal leading-4 text-[#8A8A8A]">{profileEmail}</span>
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
