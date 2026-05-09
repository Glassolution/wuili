import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/lib/profileContext";
import { cn } from "@/lib/utils";
import {
  Home,
  LayoutDashboard,
  Users,
  Store,
  Package,
  FileText,
  ShoppingCart,
  Wallet,
  BarChart2,
  Video,
  MessageSquare,
  ShieldCheck,
  Percent,
  Settings,
  ChevronDown,
  ChevronRight,
  PanelLeft,
  Code2,
  MessageCircle,
  MoreHorizontal,
  LogOut,
  Moon,
  User,
} from "lucide-react";
import { useTheme } from "next-themes";

// ── Types ─────────────────────────────────────────────────────────────────────

type SubItem = { label: string; to: string };

type NavGroup =
  | { kind: "link";  to: string; icon: React.ElementType; label: string }
  | { kind: "group"; icon: React.ElementType; label: string; items: SubItem[] };

// ── Nav structure ─────────────────────────────────────────────────────────────

const nav: NavGroup[] = [
  { kind: "link", to: "/dashboard", icon: BarChart2, label: "Dashboard" },
  {
    kind: "group", icon: Store, label: "Sua Loja",
    items: [
      { label: "Produtos",    to: "/dashboard/produtos"    },
      { label: "Publicações", to: "/dashboard/publicacoes" },
      { label: "Pedidos",     to: "/dashboard/pedidos"     },
      { label: "Vídeos",      to: "/dashboard/criar-video" },
      { label: "Chat",        to: "/dashboard/chat-fornecedores" },
    ],
  },
  {
    kind: "group", icon: Wallet, label: "Financeiro",
    items: [
      { label: "Saldos",      to: "/dashboard/saldos"      },
      { label: "Transações",  to: "/dashboard/transacoes"  },
      { label: "Pagamentos",  to: "/dashboard/pagamentos"  },
    ],
  },
];

// ── Velo Mark (logo icon only) ────────────────────────────────────────────────

const VeloMark = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={{ flexShrink: 0 }}>
    <rect width="48" height="48" rx={8 * (48 / size)} fill="#0A0A0A" />
    <path d="M33 18 A11 11 0 1 0 33 30" stroke="#FFFFFF" strokeWidth={2 * (48 / size)} strokeLinecap="round" fill="none" />
    <path d="M30 26 L34 30 L38 26" stroke="#FFFFFF" strokeWidth={1.7 * (48 / size)} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

// ── Toggle Switch ─────────────────────────────────────────────────────────────

const ToggleSwitch = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
  <div
    onClick={onChange}
    className={cn(
      "relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200",
      checked ? "bg-[#111111]" : "bg-[#D1D5DB]"
    )}
  >
    <div
      className={cn(
        "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
        checked ? "translate-x-[18px]" : "translate-x-0.5"
      )}
    />
  </div>
);

// ── User Footer Dropdown ────────────────────────────────────────────────────────

interface UserFooterProps {
  nome: string;
  foto: string | null;
  iniciais: string;
  collapsed: boolean;
  onLogout: () => void;
}

const UserFooter = ({ nome, foto, iniciais, collapsed, onLogout }: UserFooterProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative shrink-0",
        collapsed ? "px-0 py-3" : "px-3 py-3"
      )}
    >
      <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#E0E0E0] text-[11px] font-semibold text-[#111111]">
          {foto ? <img src={foto} alt="avatar" className="h-full w-full object-cover" /> : iniciais || "VL"}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold text-[#111111]">
              {nome || "Velo"}
            </span>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex h-8 w-8 items-center justify-center rounded-2xl text-[#B0B0B0] transition-colors duration-200 hover:bg-muted hover:text-foreground"
            >
              <MoreHorizontal size={18} strokeWidth={1.2} />
            </button>
          </>
        )}
      </div>

      {!collapsed && isOpen && (
        <div className="absolute bottom-full left-3 right-3 mb-2 rounded-3xl bg-card p-2 shadow-card">
          <button
            onClick={() => { navigate("/dashboard/perfil"); setIsOpen(false); }}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors duration-200 hover:bg-muted"
          >
            <User size={18} strokeWidth={1.2} className="shrink-0 text-foreground" />
            <span className="text-[13px] text-foreground">Perfil</span>
          </button>
          <button
            onClick={() => { navigate("/dashboard/configuracoes"); setIsOpen(false); }}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors duration-200 hover:bg-muted"
          >
            <Settings size={18} strokeWidth={1.2} className="shrink-0 text-foreground" />
            <span className="text-[13px] text-foreground">Configurações</span>
          </button>
          <div className="flex w-full items-center gap-3 rounded-2xl px-3 py-3">
            <Moon size={18} strokeWidth={1.2} className="shrink-0 text-foreground" />
            <span className="min-w-0 flex-1 text-[13px] text-foreground">Modo escuro</span>
            <ToggleSwitch
              checked={theme === "dark"}
              onChange={() => setTheme(theme === "dark" ? "light" : "dark")}
            />
          </div>

          <button
            onClick={() => { onLogout(); setIsOpen(false); }}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors duration-200 hover:bg-muted"
          >
            <LogOut size={18} strokeWidth={1.2} className="shrink-0 text-[#EF4444]" />
            <span className="text-[13px] text-[#EF4444]">Sair</span>
          </button>
        </div>
      )}
    </div>
  );
};

// ── Component ─────────────────────────────────────────────────────────────────

const DashboardSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { foto } = useProfile();
  const { user, signOut, role } = useAuth();
  const nome = user?.user_metadata?.full_name ?? user?.email ?? "Usuário";

  const [collapsed, setCollapsed] = useState(false);

  const [devMode, setDevMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("velo-dev-mode") === "true";
    }
    return false;
  });

  const toggleDevMode = () => {
    const next = !devMode;
    setDevMode(next);
    localStorage.setItem("velo-dev-mode", String(next));
  };

  const isAdmin = role === "admin";
  const isInfluencer = role === "influencer" || role === "admin";

  // Track which groups are open
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    nav.forEach((g) => {
      if (g.kind === "group") {
        if (g.items.some((i) => location.pathname.startsWith(i.to))) {
          init[g.label] = true;
        }
      }
    });
    return init;
  });

  const toggleGroup = (label: string) =>
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const iniciais = nome
    .split(/[\s._\-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  const isLinkActive = (to: string) =>
    to === "/dashboard"
      ? location.pathname === "/dashboard"
      : location.pathname.startsWith(to);

  const isGroupActive = (items: SubItem[]) =>
    items.some((i) => location.pathname.startsWith(i.to));

  return (
    <nav
      className={cn(
        "flex h-screen shrink-0 flex-col bg-sidebar text-foreground transition-[width] duration-200 ease-out",
        collapsed ? "w-[64px] min-w-[64px]" : "w-[280px] min-w-[280px]"
      )}
    >
      {/* ── Header: Logo mark + Colapsar ─────────────────────────────────── */}
      <div className={cn("flex shrink-0 flex-col items-center", collapsed ? "px-2 pt-4 pb-2 gap-2" : "px-4 pt-4 pb-4")}>
        {!collapsed ? (
          <div className="flex w-full items-center justify-between">
            <Link to="/?home=1" className="flex items-center">
              <VeloMark size={28} />
            </Link>
            <button
              onClick={() => setCollapsed(true)}
              className="flex h-8 w-8 items-center justify-center rounded-2xl text-[#6B7280] transition-colors duration-200 hover:bg-muted hover:text-foreground"
              title="Colapsar"
            >
              <PanelLeft size={18} strokeWidth={1.5} />
            </button>
          </div>
        ) : (
          <div className="flex w-full flex-col items-center gap-2">
            <Link to="/?home=1" className="flex items-center justify-center">
              <VeloMark size={28} />
            </Link>
            <button
              onClick={() => setCollapsed(false)}
              className="flex w-full items-center justify-center py-2 text-[#6B7280] transition-colors duration-200 hover:text-foreground"
              title="Expandir"
            >
              <PanelLeft size={20} strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>

      {/* ── Workspace Selector ─────────────────────────────────────────── */}
      {!collapsed && (
        <div className="shrink-0 px-4 pb-6">
          <button className="flex w-full h-10 items-center justify-between rounded-[12px] border border-[#E5E7EB] bg-card px-4 text-left transition-colors duration-200 hover:bg-muted">
            <span className="text-[14px] font-semibold text-foreground">Velo</span>
            <ChevronDown size={14} strokeWidth={1.5} className="text-[#6B7280]" />
          </button>
        </div>
      )}

      {/* ── Nav items ────────────────────────────────────────────────────── */}
      <div
        className={cn(
          "flex flex-1 flex-col overflow-y-auto pb-4",
          collapsed ? "items-center gap-2 pt-2 px-0" : "gap-1 px-3"
        )}
      >
        {nav.map((item) => {
          if (item.kind === "link") {
            const active = isLinkActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "sidebar-item",
                  "relative flex items-center transition-all duration-150",
                  collapsed
                    ? "group w-full h-[44px] flex items-center justify-center p-0 m-0"
                    : "gap-4 rounded-2xl px-6 py-3 text-[14px]",
                  active
                    ? !collapsed
                      ? "bg-[#111111] rounded-[12px] font-medium text-white"
                      : "font-medium text-white"
                    : !collapsed
                      ? "font-normal text-[#6B7280] hover:bg-muted hover:text-foreground"
                      : "font-normal text-[#6B7280]"
                )}
                title={collapsed ? item.label : undefined}
              >
                {collapsed ? (
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-[12px] transition-colors duration-150",
                      active ? "bg-[#111111]" : "group-hover:bg-muted"
                    )}
                  >
                    <item.icon
                      size={20}
                      strokeWidth={1.5}
                      className={cn("sidebar-icon shrink-0", active ? "text-white" : "text-[#6B7280]")}
                    />
                  </div>
                ) : (
                  <item.icon
                    size={18}
                    strokeWidth={1.5}
                    className={cn("sidebar-icon shrink-0", active ? "text-white" : "text-[#6B7280]")}
                  />
                )}
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          }

          const isOpen = openGroups[item.label] ?? false;
          const groupActiveCompact = collapsed && isGroupActive(item.items);

          return (
            <div key={item.label}>
              <button
                onClick={() => toggleGroup(item.label)}
                className={cn(
                  "sidebar-item",
                  "w-full relative flex items-center transition-all duration-150",
                  collapsed
                    ? "group w-full h-[44px] flex items-center justify-center p-0 m-0"
                    : "gap-4 rounded-2xl px-6 py-3 text-[14px]",
                  groupActiveCompact
                    ? !collapsed
                      ? "bg-[#111111] rounded-[12px] font-medium text-white"
                      : "font-medium text-white"
                    : !collapsed
                      ? "font-normal text-[#6B7280] hover:bg-muted hover:text-foreground"
                      : "font-normal text-[#6B7280]"
                )}
                title={collapsed ? item.label : undefined}
              >
                {collapsed ? (
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-[12px] transition-colors duration-150",
                      groupActiveCompact ? "bg-[#111111]" : "group-hover:bg-muted"
                    )}
                  >
                    <item.icon
                      size={20}
                      strokeWidth={1.5}
                      className={cn("sidebar-icon shrink-0", groupActiveCompact ? "text-white" : "text-[#6B7280]")}
                    />
                  </div>
                ) : (
                  <item.icon
                    size={18}
                    strokeWidth={1.5}
                    className={cn("sidebar-icon shrink-0 text-[#6B7280]")}
                  />
                )}
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown
                      size={16}
                      strokeWidth={1.5}
                      className={cn(
                        "shrink-0 transition-transform duration-200",
                        isOpen ? "rotate-180" : "rotate-0",
                        "text-[#6B7280]"
                      )}
                    />
                  </>
                )}
              </button>

              {!collapsed && isOpen && (
                <div className="mt-2 space-y-2 pl-4">
                  {item.items.map((sub) => {
                    const subActive = location.pathname.startsWith(sub.to);
                    return (
                      <Link
                        key={sub.to}
                        to={sub.to}
                        className={cn(
                          "relative flex items-center gap-4 rounded-2xl py-3 pr-6 text-[14px] transition-all duration-150",
                          "pl-8",
                          subActive
                            ? "bg-[#111111] font-medium text-white tracking-[0.01em]"
                            : "font-normal text-[#6B7280] hover:bg-muted hover:text-foreground tracking-[0.01em]"
                        )}
                      >
                        {item.label === "Sua Loja" ? (
                          sub.label === "Produtos" ? (
                            <Package size={16} strokeWidth={1.5} className={cn("shrink-0", subActive ? "text-white" : "text-[#6B7280]")} />
                          ) : sub.label === "Publicações" ? (
                            <FileText size={16} strokeWidth={1.5} className={cn("shrink-0", subActive ? "text-white" : "text-[#6B7280]")} />
                          ) : sub.label === "Pedidos" ? (
                            <ShoppingCart size={16} strokeWidth={1.5} className={cn("shrink-0", subActive ? "text-white" : "text-[#6B7280]")} />
                          ) : sub.label === "Vídeos" ? (
                            <Video size={16} strokeWidth={1.5} className={cn("shrink-0", subActive ? "text-white" : "text-[#6B7280]")} />
                          ) : sub.label === "Chat" ? (
                            <MessageSquare size={16} strokeWidth={1.5} className={cn("shrink-0", subActive ? "text-white" : "text-[#6B7280]")} />
                          ) : null
                        ) : null}
                        <span>{sub.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Admin + Comissões aparecem no modo compacto (somente ícones) */}
        {collapsed && (
          <>
            {isAdmin && (
              <Link
                to="/admin/dashboard"
                className={cn(
                  "sidebar-item",
                  "relative flex items-center transition-all duration-150",
                  "group w-full h-[44px] flex items-center justify-center p-0 m-0",
                  location.pathname.startsWith("/admin")
                    ? "font-medium text-white"
                    : "font-light text-[#B0B0B0]"
                )}
                title="Admin"
              >
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-[12px] transition-colors duration-150",
                    location.pathname.startsWith("/admin") ? "bg-[#111111]" : "group-hover:bg-muted"
                  )}
                >
                  <ShieldCheck
                    size={20}
                    strokeWidth={1.2}
                    className={cn(
                      "sidebar-icon shrink-0",
                      location.pathname.startsWith("/admin") ? "text-white" : "text-[#B0B0B0]"
                    )}
                  />
                </div>
              </Link>
            )}

            {isInfluencer && (
              <Link
                to="/dashboard/comissoes"
                className={cn(
                  "sidebar-item",
                  "relative flex items-center transition-all duration-150",
                  "group w-full h-[44px] flex items-center justify-center p-0 m-0",
                  location.pathname.startsWith("/dashboard/comissoes")
                    ? "font-medium text-white"
                    : "font-light text-[#B0B0B0]"
                )}
                title="Comissões"
              >
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-[12px] transition-colors duration-150",
                    location.pathname.startsWith("/dashboard/comissoes") ? "bg-[#111111]" : "group-hover:bg-muted"
                  )}
                >
                  <Percent
                    size={20}
                    strokeWidth={1.2}
                    className={cn(
                      "sidebar-icon shrink-0",
                      location.pathname.startsWith("/dashboard/comissoes") ? "text-white" : "text-[#B0B0B0]"
                    )}
                  />
                </div>
              </Link>
            )}
          </>
        )}
      </div>

      {/* ── Footer items (Admin, Comissões, Dev Mode, Suporte) ─────────── */}
      {collapsed && (
        <div className="mt-auto flex flex-col items-center gap-2 px-0 pb-2">
          <button
            onClick={toggleDevMode}
            className="sidebar-item w-full h-[44px] flex items-center justify-center p-0 m-0"
            title="Dev Mode"
          >
            <Code2 size={20} strokeWidth={1.5} className="sidebar-icon shrink-0 text-[#6B7280]" />
          </button>

          <a
            href="https://wa.me/"
            target="_blank"
            rel="noopener noreferrer"
            className="sidebar-item w-full h-[44px] flex items-center justify-center p-0 m-0"
            title="Suporte"
          >
            <MessageCircle size={20} strokeWidth={1.2} className="sidebar-icon shrink-0 text-[#25D366]" />
          </a>
        </div>
      )}

      {!collapsed && <div className="flex flex-col gap-1 px-3 pb-4 mt-auto">
        {/* Admin - só para admin */}
        {isAdmin && (
          <Link
            to="/admin/dashboard"
            className={cn(
              "sidebar-item",
              "relative flex items-center transition-all duration-150",
              collapsed
                ? "h-10 w-10 justify-center rounded-2xl mx-auto"
                : "gap-4 rounded-2xl px-6 py-3 text-[14px]",
              location.pathname.startsWith("/admin")
                ? "bg-[#111111] rounded-[12px] font-medium text-white"
                : "font-normal text-[#6B7280] hover:bg-muted hover:text-foreground"
            )}
            title={collapsed ? "Admin" : undefined}
          >
            <ShieldCheck size={collapsed ? 20 : 18} strokeWidth={1.5} className={cn("sidebar-icon shrink-0", location.pathname.startsWith("/admin") ? "text-white" : "text-[#6B7280]")} />
            {!collapsed && <span>Admin</span>}
          </Link>
        )}

        {/* Comissões - para admin e influencer */}
        {isInfluencer && (
          <Link
            to="/dashboard/comissoes"
            className={cn(
              "sidebar-item",
              "relative flex items-center transition-all duration-150",
              collapsed
                ? "h-10 w-10 justify-center rounded-2xl mx-auto"
                : "gap-4 rounded-2xl px-6 py-3 text-[14px]",
              location.pathname.startsWith("/dashboard/comissoes")
                ? "bg-[#111111] rounded-[12px] font-medium text-white"
                : "font-normal text-[#6B7280] hover:bg-muted hover:text-foreground"
            )}
            title={collapsed ? "Comissões" : undefined}
          >
            <Percent size={collapsed ? 20 : 18} strokeWidth={1.5} className={cn("sidebar-icon shrink-0", location.pathname.startsWith("/dashboard/comissoes") ? "text-white" : "text-[#6B7280]")} />
            {!collapsed && <span>Comissões</span>}
          </Link>
        )}

        {/* Dev Mode, Suporte (expandido only) */}
        {!collapsed && (
          <>
            <button
              onClick={toggleDevMode}
              className={cn(
                "relative flex w-full items-center gap-4 rounded-2xl px-6 py-3 text-[14px] font-normal text-[#6B7280] transition-all duration-200 ease-out hover:bg-muted hover:text-foreground"
              )}
            >
              <Code2 size={18} strokeWidth={1.5} className="shrink-0 text-[#6B7280]" />
              <span className="flex-1 text-left">Dev Mode</span>
              <ToggleSwitch checked={devMode} onChange={toggleDevMode} />
            </button>
            <a
              href="https://wa.me/"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "relative flex items-center gap-4 rounded-2xl px-6 py-3 text-[14px] font-normal text-[#6B7280] transition-all duration-200 ease-out hover:bg-muted hover:text-foreground"
              )}
            >
              <MessageCircle size={18} strokeWidth={1.5} className="shrink-0 text-[#25D366]" />
              <span className="whitespace-nowrap">Suporte</span>
            </a>
          </>
        )}
      </div>}

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <UserFooter
        nome={nome}
        foto={foto}
        iniciais={iniciais}
        collapsed={collapsed}
        onLogout={handleSignOut}
      />
    </nav>
  );
};

export default DashboardSidebar;
