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
  Landmark,
  ArrowLeftRight,
  CreditCard,
} from "lucide-react";
import { useTheme } from "next-themes";
import StartModeModal from "./StartModeModal";
import { useStartMode } from "@/hooks/useStartMode";

// ── Icon helper — className="sidebar-icon" is what index.css targets for the draw-on animation ──
const IconSpan = ({
  icon: Icon,
  size = 17,
  strokeWidth = 1.8,
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
      "sidebar-item relative flex items-center transition-all duration-200",
      collapsed ? "group w-full h-[44px] justify-center p-0 m-0" : "px-4",
      active && !collapsed ? "bg-[#111111] shadow-sm" : "",
      !active && !collapsed ? "hover:bg-black/[0.02]" : ""
    )}
    title={collapsed ? item.label : undefined}
    style={{
      fontFamily: collapsed ? undefined : '"Inter Variable", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize: collapsed ? undefined : "15px",
      fontWeight: collapsed ? undefined : 500,
      lineHeight: collapsed ? undefined : "19px",
      letterSpacing: collapsed ? undefined : "-0.02em",
      height: collapsed ? undefined : "44px",
      gap: collapsed ? undefined : "12px",
      borderRadius: collapsed ? undefined : "12px",
      flexShrink: 0,
    }}
  >
    {collapsed ? (
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-[12px] transition-colors duration-200", active ? "bg-[#111111] shadow-sm" : "group-hover:bg-black/[0.02]")}>
        <IconSpan icon={item.icon} size={17} strokeWidth={1.8} color={active ? "#FFFFFF" : "#6B7280"} />
      </div>
    ) : (
      <>
        <IconSpan icon={item.icon} size={17} strokeWidth={1.8} color={active ? "#FFFFFF" : "#6B7280"} />
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
      "sidebar-item w-full relative flex items-center transition-all duration-200",
      collapsed ? "group h-[44px] justify-center p-0 m-0" : "px-4",
      groupActiveCompact && !collapsed ? "bg-[#111111] shadow-sm" : "",
      !groupActiveCompact && !collapsed ? "hover:bg-black/[0.02]" : ""
    )}
    title={collapsed ? item.label : undefined}
    style={{
      fontFamily: collapsed ? undefined : '"Inter Variable", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize: collapsed ? undefined : "15px",
      fontWeight: collapsed ? undefined : 500,
      lineHeight: collapsed ? undefined : "19px",
      letterSpacing: collapsed ? undefined : "-0.02em",
      height: collapsed ? undefined : "44px",
      gap: collapsed ? undefined : "12px",
      borderRadius: collapsed ? undefined : "12px",
      flexShrink: 0,
    }}
  >
    {collapsed ? (
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-[12px] transition-colors duration-200", groupActiveCompact ? "bg-[#111111] shadow-sm" : "group-hover:bg-black/[0.02]")}>
        <IconSpan icon={item.icon} size={17} strokeWidth={1.8} color={groupActiveCompact ? "#FFFFFF" : "#6B7280"} />
      </div>
    ) : (
      <>
        <IconSpan icon={item.icon} size={17} strokeWidth={1.8} color="#6B7280" />
        <span className="flex-1 text-left" style={{ color: "#111111" }}>{item.label}</span>
        <ChevronDown size={14} strokeWidth={1.8} className={cn("shrink-0 transition-transform duration-200", isOpen ? "rotate-180" : "rotate-0")} style={{ color: "#6B7280" }} />
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
  Saldos: Landmark,
  Transações: ArrowLeftRight,
  Pagamentos: CreditCard,
};

const NavSubRow = ({ sub, subActive }: { sub: SubItem; subActive: boolean }) => {
  const SubIcon = subIconMap[sub.label];
  return (
    <Link
      to={sub.to}
      className={cn("sidebar-item relative flex items-center transition-all duration-200", subActive ? "bg-[#111111] shadow-sm" : "hover:bg-black/[0.02]")}
      style={{ 
        fontFamily: '"Inter Variable", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', 
        fontSize: "14px", 
        fontWeight: 500, 
        lineHeight: "18px", 
        letterSpacing: "-0.02em", 
        height: "40px", 
        gap: "10px",
        paddingLeft: "44px",
        paddingRight: "16px",
        borderRadius: "10px",
        flexShrink: 0,
      }}
    >
      {SubIcon && <IconSpan icon={SubIcon} size={16} strokeWidth={1.8} color={subActive ? "#FFFFFF" : "#6B7280"} />}
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
  size = 17,
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
      <Link to={to} className="sidebar-item group relative flex h-[36px] w-full items-center justify-center p-0 m-0 transition-all duration-150" title={label}>
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-[10px] transition-colors duration-150", active ? "bg-[#111111]" : "group-hover:bg-muted")}>
          <IconSpan icon={icon} size={size} strokeWidth={1.6} color={active ? "#FFFFFF" : "#6B7280"} />
        </div>
      </Link>
    );
  }
  return (
    <Link
      to={to}
      className={cn("sidebar-item relative flex items-center transition-all duration-150", active ? "bg-[#111111]" : "hover:bg-muted")}
      style={{ 
        fontFamily: '"Inter Variable", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', 
        fontSize: "15px", 
        fontWeight: 500, 
        lineHeight: "18px", 
        letterSpacing: "-0.01em",
        height: "40px",
        gap: "10px",
        paddingLeft: "14px",
        paddingRight: "14px",
        borderRadius: "10px"
      }}
    >
      <IconSpan icon={icon} size={size} strokeWidth={1.6} color={active ? "#FFFFFF" : "#6B7280"} />
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
      <button onClick={onClick} className="sidebar-item w-full h-[40px] flex items-center justify-center p-0 m-0" title={label}>
        <IconSpan icon={icon} size={17} strokeWidth={1.8} color={color} />
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className="sidebar-item relative flex w-full items-center transition-all duration-150 hover:bg-black/[0.02]"
      style={{ 
        fontFamily: '"Inter Variable", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', 
        fontSize: "15px", 
        fontWeight: 500, 
        lineHeight: "19px", 
        letterSpacing: "-0.02em",
        height: "40px",
        gap: "10px",
        paddingLeft: "14px",
        paddingRight: "14px",
        borderRadius: "10px"
      }}
    >
      <IconSpan icon={icon} size={17} strokeWidth={1.8} color={color} />
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
      <a href={href} target="_blank" rel="noopener noreferrer" className="sidebar-item w-full h-[40px] flex items-center justify-center p-0 m-0" title={label}>
        <IconSpan icon={icon} size={17} strokeWidth={1.8} color={color} />
      </a>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="sidebar-item relative flex items-center transition-all duration-150 hover:bg-black/[0.02]"
      style={{ 
        fontFamily: '"Inter Variable", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', 
        fontSize: "15px", 
        fontWeight: 500, 
        lineHeight: "19px", 
        letterSpacing: "-0.02em",
        height: "40px",
        gap: "10px",
        paddingLeft: "14px",
        paddingRight: "14px",
        borderRadius: "10px"
      }}
    >
      <IconSpan icon={icon} size={17} strokeWidth={1.8} color={color} />
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
      "relative shrink-0 cursor-pointer rounded-full transition-colors duration-200",
      checked ? "bg-[#111111]" : "bg-[#D1D5DB]"
    )}
    style={{ height: "24px", width: "42px" }}
  >
    <div
      className={cn(
        "absolute top-0.5 rounded-full bg-white shadow-sm transition-transform duration-200",
        checked ? "translate-x-[20px]" : "translate-x-0.5"
      )}
      style={{ height: "20px", width: "20px" }}
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

  if (collapsed) {
    return (
      <div className="relative shrink-0 px-0" style={{ paddingTop: "8px", paddingBottom: "14px" }}>
        <div className="flex items-center justify-center">
          <span 
            className="flex shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold text-white"
            style={{ 
              width: "36px",
              height: "36px",
              backgroundColor: "#C2185B" 
            }}
          >
            {foto ? <img src={foto} alt="avatar" className="h-full w-full object-cover" /> : iniciais || "VL"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative shrink-0"
      style={{ padding: "8px 16px 14px 16px" }}
    >
      <div 
        className="flex items-center w-full"
        style={{ 
          height: "48px",
          minHeight: "48px",
          gap: "12px",
          padding: "0 6px",
          flexShrink: 0,
          overflow: "hidden"
        }}
      >
        <span 
          className="flex shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold text-white"
          style={{ 
            width: "36px",
            height: "36px",
            backgroundColor: "#C2185B",
            flexShrink: 0
          }}
        >
          {foto ? <img src={foto} alt="avatar" className="h-full w-full object-cover" /> : iniciais || "VL"}
        </span>
        <div className="min-w-0 flex-1">
          <div 
            style={{ 
              fontFamily: '"Inter Variable", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              fontSize: "15px", 
              fontWeight: 500, 
              color: "#111111",
              lineHeight: "19px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
          >
            {nome || "Velo"}
          </div>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex shrink-0 items-center justify-center rounded-xl transition-colors duration-200 hover:bg-muted"
          style={{ width: "26px", height: "26px", flexShrink: 0 }}
        >
          <MoreHorizontal size={16} strokeWidth={1.6} style={{ color: "#8A8FA3" }} />
        </button>
      </div>

      {isOpen && (
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

  // Start Mode: controlado pelo plano real do usuário (não localStorage)
  const { isStartMode: startMode, hasActivePlan } = useStartMode();

  const [showStartModeModal, setShowStartModeModal] = useState(false);

  const toggleStartMode = () => {
    // Usuários gratuitos não podem desligar o Start Mode — mostrar modal explicativo
    if (!hasActivePlan) {
      setShowStartModeModal(true);
    }
    // Usuários pagos nunca chegam aqui pois startMode já é false para eles
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
        "flex shrink-0 flex-col text-foreground transition-[width] duration-200 ease-out",
        collapsed ? "w-[64px] min-w-[64px]" : "w-[268px] min-w-[268px]"
      )}
      style={{
        height: startMode ? "calc(100vh - 48px)" : "100vh",
        transition: "height 280ms ease, width 200ms ease-out",
        overflow: "hidden",
        backgroundColor: "#F4F4F5",
        borderRight: "none"
      }}
    >
      {/* ── Header: Logo mark + Colapsar ─────────────────────────────────── */}
      <div className={cn("flex shrink-0 flex-col items-center", collapsed ? "px-2 pt-4 pb-2 gap-2" : "px-5 pt-4 pb-3")}>
        {!collapsed ? (
          <div className="flex w-full items-center justify-between">
            <Link to="/?home=1" className="flex items-center">
              <VeloMark size={26} />
            </Link>
            <button
              onClick={() => setCollapsed(true)}
              className="flex h-7 w-7 items-center justify-center rounded-xl text-[#6B7280] transition-colors duration-200 hover:bg-muted hover:text-foreground"
              title="Colapsar"
            >
              <PanelLeft size={17} strokeWidth={1.5} />
            </button>
          </div>
        ) : (
          <div className="flex w-full flex-col items-center gap-2">
            <Link to="/?home=1" className="flex items-center justify-center">
              <VeloMark size={26} />
            </Link>
            <button
              onClick={() => setCollapsed(false)}
              className="flex w-full items-center justify-center py-2 text-[#6B7280] transition-colors duration-200 hover:text-foreground"
              title="Expandir"
            >
              <PanelLeft size={19} strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>

      {/* Divisória 1 */}
      <div style={{ height: "1px", backgroundColor: "#DDE3EE", margin: "12px 16px" }} />

      {/* ── Workspace Selector ─────────────────────────────────────────── */}
      {!collapsed && (
        <div style={{ margin: "8px 16px 0 16px" }}>
          <button style={{
            display: "flex",
            width: "100%",
            height: "44px",
            alignItems: "center",
            justifyContent: "space-between",
            borderRadius: "12px",
            border: "1px solid rgba(0,0,0,0.08)",
            backgroundColor: "#FFFFFF",
            paddingLeft: "14px",
            paddingRight: "14px",
            textAlign: "left",
            transition: "background-color 0.15s ease",
            boxSizing: "border-box",
            cursor: "pointer"
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F9FAFB")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#FFFFFF")}
          >
            <span style={{ 
              fontSize: "15px", 
              fontWeight: 600, 
              color: "#111111",
              letterSpacing: "-0.02em"
            }}>Velo</span>
            <ChevronDown size={17} strokeWidth={2} style={{ color: "#6B7280" }} />
          </button>
        </div>
      )}

      {/* Divisória 2 - Abaixo do seletor Velo */}
      {!collapsed && (
        <div style={{ height: "1px", backgroundColor: "#DDE3EE", margin: "12px 16px" }} />
      )}

      {/* ── Nav items ────────────────────────────────────────────────────── */}
      <div
        className={cn(
          "flex flex-1 flex-col overflow-y-auto",
          collapsed ? "items-center gap-1.5 pt-2 px-0" : "gap-1.5 px-4"
        )}
        style={!collapsed ? { paddingTop: "8px", paddingBottom: "8px", minHeight: 0 } : { minHeight: 0 }}
      >
        {nav.map((item) => {
          if (item.kind === "link") {
            const active = isLinkActive(item.to);
            return (
              <div key={item.to} style={{ flexShrink: 0 }}>
                <NavLinkRow item={item} active={active} collapsed={collapsed} />
              </div>
            );
          }

          const isOpen = openGroups[item.label] ?? false;
          const groupActiveCompact = collapsed && isGroupActive(item.items);

          return (
            <div key={item.label} style={{ flexShrink: 0 }}>
              <NavGroupRow
                item={item}
                isOpen={isOpen}
                collapsed={collapsed}
                groupActiveCompact={groupActiveCompact}
                onToggle={() => toggleGroup(item.label)}
                pathname={location.pathname}
              />
              {!collapsed && isOpen && (
                <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "6px", paddingLeft: "0" }}>
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
      {collapsed && (
        <div className="flex flex-col items-center gap-1.5 px-0 pb-1" style={{ flexShrink: 0 }}>
          {/* Start Mode: só aparece para usuários gratuitos */}
          {!hasActivePlan && (
            <FooterButtonRow icon={Code2} label="Start Mode" color="#FFA640" collapsed={collapsed} onClick={toggleStartMode} />
          )}
          <FooterAnchorRow href="https://wa.me/" icon={MessageCircle} label="Suporte" color="#25D366" collapsed={collapsed} />
        </div>
      )}

      {!collapsed && <div className="flex flex-col" style={{ paddingLeft: "16px", paddingRight: "16px", paddingBottom: "0", gap: "6px", flexShrink: 0 }}>
        {isAdmin && (
          <FooterLinkRow to="/admin/dashboard" icon={ShieldCheck} label="Admin" active={location.pathname.startsWith("/admin")} collapsed={collapsed} />
        )}
        {isInfluencer && (
          <FooterLinkRow to="/dashboard/comissoes" icon={Percent} label="Comissões" active={location.pathname.startsWith("/dashboard/comissoes")} collapsed={collapsed} />
        )}
        {/* Start Mode: só aparece para usuários gratuitos */}
        {!hasActivePlan && (
          <FooterButtonRow icon={Code2} label="Start Mode" color="#FFA640" collapsed={collapsed} onClick={toggleStartMode}>
            {/* Toggle sempre ligado para gratuitos — clicar abre modal explicativo */}
            <ToggleSwitch checked={true} onChange={toggleStartMode} />
          </FooterButtonRow>
        )}
        <FooterAnchorRow href="https://wa.me/" icon={MessageCircle} label="Suporte" color="#25D366" collapsed={collapsed} />
      </div>}

      {/* Divisória 3 - Acima da conta do usuário */}
      <div className={cn("shrink-0", collapsed ? "px-2" : "px-4")} style={{ margin: "12px 0" }}>
        <div className="h-[1px] w-full" style={{ backgroundColor: "#DDE3EE" }} />
      </div>

      {/* ── Footer - Conta do Usuário ───────────────────────────────────────────────────────── */}
      <UserFooter
        nome={nome}
        foto={foto}
        iniciais={iniciais}
        collapsed={collapsed}
        onLogout={handleSignOut}
      />

      {/* Modal Start Mode */}
      <StartModeModal
        isOpen={showStartModeModal}
        onClose={() => setShowStartModeModal(false)}
      />
    </nav>
  );
};

export default DashboardSidebar;
