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

// ── Icon helper — className="sidebar-icon" is what index.css targets for the draw-on animation ──
const IconSpan = ({
  icon: Icon,
  size = 18,
  strokeWidth = 1.5,
  color,
}: {
  icon: React.ElementType;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) => (
  <Icon size={size} strokeWidth={strokeWidth} className="sidebar-icon shrink-0" style={{ color }} />
);

// ── Nav row sub-components ────────────────────────────────────────────────────

const NavLinkRow = ({
  item,
  active,
  collapsed,
}: {
  item: Extract<NavGroup, { kind: "link" }>;
  active: boolean;
  collapsed: boolean;
}) => (
  <Link
    to={item.to}
    className={cn(
      "sidebar-item relative flex items-center transition-all duration-150",
      collapsed ? "group w-full h-[44px] justify-center p-0 m-0" : "rounded-2xl px-6",
      active && !collapsed ? "bg-[#111111] rounded-[12px]" : "",
      !active && !collapsed ? "hover:bg-muted" : ""
    )}
    title={collapsed ? item.label : undefined}
    style={{
      fontFamily: collapsed ? undefined : '"Inter Variable", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize: collapsed ? undefined : "15px",
      fontWeight: collapsed ? undefined : 500,
      lineHeight: collapsed ? undefined : "20px",
      letterSpacing: collapsed ? undefined : "-0.01em",
      height: collapsed ? undefined : "44px",
      gap: collapsed ? undefined : "12px",
    }}
  >
    {collapsed ? (
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-[12px] transition-colors duration-150", active ? "bg-[#111111]" : "group-hover:bg-muted")}>
        <IconSpan icon={item.icon} size={18} strokeWidth={1.5} color={active ? "#FFFFFF" : "#6B7280"} />
      </div>
    ) : (
      <>
        <IconSpan icon={item.icon} size={18} strokeWidth={1.5} color={active ? "#FFFFFF" : "#6B7280"} />
        <span style={{ color: active ? "#FFFFFF" : "#111111" }}>{item.label}</span>
      </>
    )}
  </Link>
);

const NavGroupRow = ({
  item,
  isOpen,
  collapsed,
  groupActiveCompact,
  onToggle,
}: {
  item: Extract<NavGroup, { kind: "group" }>;
  isOpen: boolean;
  collapsed: boolean;
  groupActiveCompact: boolean;
  onToggle: () => void;
  pathname: string;
}) => (
  <button
    onClick={onToggle}
    className={cn(
      "sidebar-item w-full relative flex items-center transition-all duration-150",
      collapsed ? "group h-[44px] justify-center p-0 m-0" : "rounded-2xl px-6",
      groupActiveCompact && !collapsed ? "bg-[#111111] rounded-[12px]" : "",
      !groupActiveCompact && !collapsed ? "hover:bg-muted" : ""
    )}
    title={collapsed ? item.label : undefined}
    style={{
      fontFamily: collapsed ? undefined : '"Inter Variable", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize: collapsed ? undefined : "15px",
      fontWeight: collapsed ? undefined : 500,
      lineHeight: collapsed ? undefined : "20px",
      letterSpacing: collapsed ? undefined : "-0.01em",
      height: collapsed ? undefined : "44px",
      gap: collapsed ? undefined : "12px",
    }}
  >
    {collapsed ? (
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-[12px] transition-colors duration-150", groupActiveCompact ? "bg-[#111111]" : "group-hover:bg-muted")}>
        <IconSpan icon={item.icon} size={18} strokeWidth={1.5} color={groupActiveCompact ? "#FFFFFF" : "#6B7280"} />
      </div>
    ) : (
      <>
        <IconSpan icon={item.icon} size={18} strokeWidth={1.5} color="#6B7280" />
        <span className="flex-1 text-left" style={{ color: "#111111" }}>{item.label}</span>
        <ChevronDown size={16} strokeWidth={1.5} className={cn("shrink-0 transition-transform duration-200", isOpen ? "rotate-180" : "rotate-0")} style={{ color: "#6B7280" }} />
      </>
    )}
  </button>
);

const subIconMap: Record<string, React.ElementType> = {
  Produtos: Package,
  Publicações: FileText,
  Pedidos: ShoppingCart,
  Vídeos: Video,
  Chat: MessageSquare,
};

const NavSubRow = ({ sub, subActive }: { sub: SubItem; subActive: boolean }) => {
  const SubIcon = subIconMap[sub.label];
  return (
    <Link
      to={sub.to}
      className={cn("sidebar-item relative flex items-center rounded-2xl pr-6 pl-8 transition-all duration-150", subActive ? "bg-[#111111]" : "hover:bg-muted")}
      style={{ fontFamily: '"Inter Variable", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: "15px", fontWeight: 500, lineHeight: "20px", letterSpacing: "-0.01em", height: "44px", gap: "12px" }}
    >
      {SubIcon && <IconSpan icon={SubIcon} size={18} strokeWidth={1.5} color={subActive ? "#FFFFFF" : "#6B7280"} />}
      <span style={{ color: subActive ? "#FFFFFF" : "#111111" }}>{sub.label}</span>
    </Link>
  );
};

const FooterLinkRow = ({
  to,
  icon,
  label,
  active,
  collapsed,
  size = 20,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
  collapsed: boolean;
  size?: number;
}) => {
  if (collapsed) {
    return (
      <Link to={to} className="sidebar-item group relative flex h-[44px] w-full items-center justify-center p-0 m-0 transition-all duration-150" title={label}>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-[12px] transition-colors duration-150", active ? "bg-[#111111]" : "group-hover:bg-muted")}>
          <IconSpan icon={icon} size={size} strokeWidth={1.5} color={active ? "#FFFFFF" : "#6B7280"} />
        </div>
      </Link>
    );
  }
  return (
    <Link
      to={to}
      className={cn("sidebar-item relative flex items-center gap-4 rounded-2xl px-6 py-3 transition-all duration-150", active ? "bg-[#111111]" : "hover:bg-muted")}
      style={{ fontFamily: '"Inter Variable", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: "15px", fontWeight: 500, lineHeight: "22px", letterSpacing: "-0.01em" }}
    >
      <IconSpan icon={icon} size={size} strokeWidth={1.5} color={active ? "#FFFFFF" : "#6B7280"} />
      <span style={{ color: active ? "#FFFFFF" : "#111111" }}>{label}</span>
    </Link>
  );
};

const FooterButtonRow = ({
  icon,
  label,
  color = "#6B7280",
  collapsed,
  onClick,
  children,
}: {
  icon: React.ElementType;
  label: string;
  color?: string;
  collapsed: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}) => {
  if (collapsed) {
    return (
      <button onClick={onClick} className="sidebar-item w-full h-[44px] flex items-center justify-center p-0 m-0" title={label}>
        <IconSpan icon={icon} size={20} strokeWidth={1.5} color={color} />
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className="sidebar-item relative flex w-full items-center gap-4 rounded-2xl px-6 py-3 transition-all duration-150 hover:bg-muted"
      style={{ fontFamily: '"Inter Variable", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: "15px", fontWeight: 500, lineHeight: "22px", letterSpacing: "-0.01em" }}
    >
      <IconSpan icon={icon} size={20} strokeWidth={1.5} color={color} />
      <span className="flex-1 text-left" style={{ color: "#111111" }}>{label}</span>
      {children}
    </button>
  );
};

const FooterAnchorRow = ({
  href,
  icon,
  label,
  color = "#6B7280",
  collapsed,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  color?: string;
  collapsed: boolean;
}) => {
  if (collapsed) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="sidebar-item w-full h-[44px] flex items-center justify-center p-0 m-0" title={label}>
        <IconSpan icon={icon} size={20} strokeWidth={1.5} color={color} />
      </a>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="sidebar-item relative flex items-center gap-4 rounded-2xl px-6 py-3 transition-all duration-150 hover:bg-muted"
      style={{ fontFamily: '"Inter Variable", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: "15px", fontWeight: 500, lineHeight: "22px", letterSpacing: "-0.01em" }}
    >
      <IconSpan icon={icon} size={20} strokeWidth={1.5} color={color} />
      <span className="whitespace-nowrap" style={{ color: "#111111" }}>{label}</span>
    </a>
  );
};

// ── Types ─────────────────────────────────────────────────────────────────────

type SubItem = { label: string; to: string };

type NavGroup =
  | { kind: "link";  to: string; icon: React.ElementType; label: string }
  | { kind: "group"; icon: React.ElementType; label: string; items: SubItem[] };

// ── Nav structure ─────────────────────────────────────────────────────────────

const nav: NavGroup[] = [
  { kind: "link", to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
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
        collapsed ? "px-0 py-3" : "px-5 py-3"
      )}
    >
      <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#E0E0E0] text-[11px] font-semibold text-[#111111]">
          {foto ? <img src={foto} alt="avatar" className="h-full w-full object-cover" /> : iniciais || "VL"}
        </span>
        {!collapsed && (
          <>
            <span 
              className="min-w-0 flex-1 truncate text-left" 
              style={{ 
                fontSize: "15px", 
                fontWeight: 600, 
                color: "#111111" 
              }}
            >
              {nome || "Velo"}
            </span>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex h-8 w-8 items-center justify-center rounded-2xl transition-colors duration-200 hover:bg-muted"
            >
              <MoreHorizontal size={18} strokeWidth={1.5} style={{ color: "#6B7280" }} />
            </button>
          </>
        )}
      </div>

      {!collapsed && isOpen && (
        <div className="absolute bottom-full left-5 right-5 mb-2 rounded-3xl bg-card p-2 shadow-card">
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
        collapsed ? "w-[64px] min-w-[64px]" : "w-[300px] min-w-[300px]"
      )}
    >
      {/* ── Header: Logo mark + Colapsar ─────────────────────────────────── */}
      <div className={cn("flex shrink-0 flex-col items-center", collapsed ? "px-2 pt-4 pb-2 gap-2" : "px-5 pt-4 pb-4")}>
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

      {/* Divisória 1 */}
      <div style={{ height: "1px", backgroundColor: "#DDE3EE", marginLeft: "20px", marginRight: "20px", marginTop: "22px", marginBottom: "0" }} />

      {/* ── Workspace Selector ─────────────────────────────────────────── */}
      {!collapsed && (
        <div style={{ margin: "22px 20px 0 20px" }}>
          <button style={{
            display: "flex",
            width: "100%",
            height: "56px",
            alignItems: "center",
            justifyContent: "space-between",
            borderRadius: "14px",
            border: "1px solid #E5E7EB",
            backgroundColor: "var(--card)",
            paddingLeft: "16px",
            paddingRight: "16px",
            textAlign: "left",
            transition: "background-color 0.2s",
            boxSizing: "border-box",
            cursor: "pointer"
          }}
          className="hover:bg-muted"
          >
            <span style={{ fontSize: "16px", fontWeight: 500, color: "var(--foreground)" }}>Velo</span>
            <ChevronDown size={14} strokeWidth={1.5} style={{ color: "#6B7280" }} />
          </button>
        </div>
      )}

      {/* Divisória 2 - Abaixo do seletor Velo */}
      {!collapsed && (
        <div style={{ height: "1px", backgroundColor: "#DDE3EE", marginLeft: "20px", marginRight: "20px", marginTop: "22px", marginBottom: "0" }} />
      )}

      {/* ── Nav items ────────────────────────────────────────────────────── */}
      <div
        className={cn(
          "flex flex-1 flex-col overflow-y-auto pb-4",
          collapsed ? "items-center gap-2 pt-2 px-0" : "gap-1 px-5"
        )}
        style={!collapsed ? { paddingTop: "22px" } : undefined}
      >
        {nav.map((item) => {
          if (item.kind === "link") {
            const active = isLinkActive(item.to);
            return (
              <NavLinkRow key={item.to} item={item} active={active} collapsed={collapsed} />
            );
          }

          const isOpen = openGroups[item.label] ?? false;
          const groupActiveCompact = collapsed && isGroupActive(item.items);

          return (
            <div key={item.label}>
              <NavGroupRow
                item={item}
                isOpen={isOpen}
                collapsed={collapsed}
                groupActiveCompact={groupActiveCompact}
                onToggle={() => toggleGroup(item.label)}
                pathname={location.pathname}
              />
              {!collapsed && isOpen && (
                <div className="mt-2 space-y-2 pl-4">
                  {item.items.map((sub) => (
                    <NavSubRow key={sub.to} sub={sub} subActive={location.pathname.startsWith(sub.to)} />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Admin + Comissões no modo compacto */}
        {collapsed && (
          <>
            {isAdmin && (
              <FooterLinkRow to="/admin/dashboard" icon={ShieldCheck} label="Admin" active={location.pathname.startsWith("/admin")} collapsed={collapsed} />
            )}
            {isInfluencer && (
              <FooterLinkRow to="/dashboard/comissoes" icon={Percent} label="Comissões" active={location.pathname.startsWith("/dashboard/comissoes")} collapsed={collapsed} />
            )}
          </>
        )}
      </div>

      {/* ── Footer items (Admin, Comissões, Dev Mode, Suporte) ─────────── */}
      {collapsed && (
        <div className="mt-auto flex flex-col items-center gap-2 px-0 pb-2">
          <FooterButtonRow icon={Code2} label="Dev Mode" color="#6B7280" collapsed={collapsed} onClick={toggleDevMode} />
          <FooterAnchorRow href="https://wa.me/" icon={MessageCircle} label="Suporte" color="#25D366" collapsed={collapsed} />
        </div>
      )}

      {!collapsed && <div className="flex flex-col gap-1 px-5 pb-4 mt-auto">
        {isAdmin && (
          <FooterLinkRow to="/admin/dashboard" icon={ShieldCheck} label="Admin" active={location.pathname.startsWith("/admin")} collapsed={collapsed} />
        )}
        {isInfluencer && (
          <FooterLinkRow to="/dashboard/comissoes" icon={Percent} label="Comissões" active={location.pathname.startsWith("/dashboard/comissoes")} collapsed={collapsed} />
        )}
        <FooterButtonRow icon={Code2} label="Dev Mode" color="#6B7280" collapsed={collapsed} onClick={toggleDevMode}>
          <ToggleSwitch checked={devMode} onChange={toggleDevMode} />
        </FooterButtonRow>
        <FooterAnchorRow href="https://wa.me/" icon={MessageCircle} label="Suporte" color="#25D366" collapsed={collapsed} />
      </div>}

      {/* Divisória 3 */}
      <div className={cn("shrink-0 mt-auto", collapsed ? "px-2" : "px-5")}>
        <div className="h-[1px] w-full" style={{ backgroundColor: "#DDE3EE" }} />
      </div>

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
