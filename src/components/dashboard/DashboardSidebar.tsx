import type { CSSProperties, ElementType } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Archive, ChevronDown, ChevronUp, ClipboardList, Copy, Home, Info, Search, Settings2, ShoppingCart, Users, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/lib/profileContext";

type NavItem = {
  label: string;
  icon: ElementType;
  to: string;
  end?: boolean;
  dimmed?: boolean;
};

const navItems: NavItem[] = [
  { label: "Início", icon: Home, to: "/dashboard", end: true },
  { label: "Catálogo", icon: ShoppingCart, to: "/dashboard/catalogo" },
  { label: "Publicações", icon: Archive, to: "/dashboard/publicacoes" },
  { label: "Pedidos", icon: Copy, to: "/dashboard/pedidos" },
  { label: "Afiliados", icon: Users, to: "/dashboard/comissoes", dimmed: true },
  { label: "Relatórios", icon: ClipboardList, to: "/dashboard/relatorios", dimmed: true },
  { label: "Ajuda & Central", icon: Info, to: "/docs", dimmed: true },
  { label: "Configurações", icon: Settings2, to: "/dashboard/configuracoes", dimmed: true },
];

const normalizePath = (path: string) => path.split("?")[0].replace(/\/$/, "");

const getInitials = (name: string, email?: string | null) => {
  const raw = (name || email || "Velo").trim();
  const parts = raw.split(/[\s._@-]+/).filter(Boolean);

  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
};

const styles = {
  sidebar: {
    width: 248,
    height: "100%",
    minHeight: 0,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxSizing: "border-box",
    padding: "18px 16px",
    borderRadius: 0,
    border: "1px solid #2A2926",
    background: "#171714",
    color: "#FFFFFF",
    boxShadow: "inset 1px 1px 0 rgba(255,255,255,0.05)",
  } satisfies CSSProperties,
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  } satisfies CSSProperties,
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
    color: "#F2F1EC",
    textDecoration: "none",
  } satisfies CSSProperties,
  brandText: {
    fontFamily: '"Inter Variable", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: 20,
    lineHeight: "24px",
    fontWeight: 700,
    letterSpacing: "-0.065em",
  } satisfies CSSProperties,
  search: {
    marginTop: 22,
    height: 36,
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 8,
    boxSizing: "border-box",
    border: 0,
    borderRadius: 11,
    padding: "0 10px",
    background: "#070706",
    color: "#FFFFFF",
    textAlign: "left",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04), 0 10px 24px rgba(0,0,0,0.22)",
  } satisfies CSSProperties,
  searchText: {
    minWidth: 0,
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: 14,
    lineHeight: "18px",
    fontWeight: 600,
    letterSpacing: "-0.03em",
  } satisfies CSSProperties,
  searchBadge: {
    width: 24,
    height: 24,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    background: "#24231F",
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: "15px",
    fontWeight: 650,
  } satisfies CSSProperties,
  nav: {
    marginTop: 22,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  } satisfies CSSProperties,
  navLinkBase: {
    height: 32,
    display: "flex",
    alignItems: "center",
    gap: 9,
    boxSizing: "border-box",
    borderRadius: 10,
    padding: "0 10px",
    textDecoration: "none",
    fontSize: 13,
    lineHeight: "16px",
    letterSpacing: "-0.02em",
  } satisfies CSSProperties,
  spacer: {
    minHeight: 0,
    flex: 1,
  } satisfies CSSProperties,
  upgradeCard: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 13,
    padding: 10,
    marginBottom: 10,
    background: "#191918",
    color: "#FFFFFF",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.075), 0 10px 30px rgba(0,0,0,0.24)",
  } satisfies CSSProperties,
  upgradeTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  } satisfies CSSProperties,
  upgradeIcon: {
    width: 35,
    height: 35,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    background: "#141413",
    color: "#FFFFFF",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12), 0 8px 18px rgba(0,0,0,0.18)",
  } satisfies CSSProperties,
  upgradeClose: {
    width: 18,
    height: 18,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    border: 0,
    background: "transparent",
    color: "rgba(255,255,255,0.45)",
  } satisfies CSSProperties,
  upgradeTitle: {
    margin: "12px 0 0",
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: "17px",
    fontWeight: 650,
    letterSpacing: "-0.03em",
  } satisfies CSSProperties,
  upgradeCopy: {
    margin: "7px 0 0",
    color: "rgba(255,255,255,0.56)",
    fontSize: 11,
    lineHeight: "15px",
    fontWeight: 500,
  } satisfies CSSProperties,
  upgradeButton: {
    marginTop: 12,
    width: "100%",
    height: 32,
    border: 0,
    borderRadius: 9,
    background: "#2B2B29",
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: 650,
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
  } satisfies CSSProperties,
  profileCard: {
    width: "100%",
    minWidth: 0,
    minHeight: 52,
    display: "flex",
    alignItems: "center",
    gap: 10,
    boxSizing: "border-box",
    border: 0,
    borderRadius: 14,
    padding: "8px 10px",
    background: "#20201D",
    color: "#FFFFFF",
    textAlign: "left",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08), 0 8px 24px rgba(0,0,0,0.22)",
  } satisfies CSSProperties,
  avatar: {
    width: 32,
    height: 32,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 999,
    background: "#30302C",
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "-0.02em",
  } satisfies CSSProperties,
  profileText: {
    minWidth: 0,
    flex: 1,
  } satisfies CSSProperties,
  profileName: {
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: "16px",
    fontWeight: 650,
    letterSpacing: "-0.025em",
  } satisfies CSSProperties,
  profileEmail: {
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    marginTop: 2,
    color: "rgba(255,255,255,0.62)",
    fontSize: 11,
    lineHeight: "14px",
    fontWeight: 500,
  } satisfies CSSProperties,
  profileChevrons: {
    width: 16,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    color: "rgba(255,255,255,0.5)",
  } satisfies CSSProperties,
};

const SignatureUpgradeIcon = () => (
  <svg width="23" height="23" viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <path
      d="M5.2 19.2C8.4 14.8 11.2 7.7 10.4 6.5C9.6 5.4 7.2 12.2 7 17.2C6.8 22.1 12.8 8.4 14.1 9.9C15.3 11.3 11.6 18.5 13.2 18.8C14.8 19.1 17.7 13.1 19.5 13.9C20.9 14.5 18.8 17.6 16.7 18.5C20.1 17.7 22.3 18.4 23.8 19.3"
      stroke="#F2F1EC"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M18.8 7.1H23.8" stroke="#F2F1EC" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const VeloIconOnly = () => (
  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 48 48" fill="none" style={{ flexShrink: 0 }}>
    <path d="M33 18 A11 11 0 1 0 33 30" stroke="#F2F1EC" strokeWidth="4" strokeLinecap="round" />
    <path d="M30 26 L34 30 L38 26" stroke="#F2F1EC" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SidebarNavLink = ({ item, active }: { item: NavItem; active: boolean }) => {
  const Icon = item.icon;
  const inactiveColor = "#FFFFFF";
  const linkStyle: CSSProperties = {
    ...styles.navLinkBase,
    color: active ? "#FFFFFF" : inactiveColor,
    background: active ? "#2A2925" : "transparent",
    fontWeight: active ? 650 : 500,
    boxShadow: active ? "0 10px 28px rgba(0,0,0,0.36), inset 0 1px 0 rgba(255,255,255,0.08)" : "none",
  };

  return (
    <Link to={item.to} aria-current={active ? "page" : undefined} style={linkStyle}>
      <Icon size={16} strokeWidth={1.65} fill={active ? "currentColor" : "none"} aria-hidden="true" />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
    </Link>
  );
};

const DashboardSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { nome, foto } = useProfile();
  const profileName = nome || user?.user_metadata?.full_name || user?.email || "Usuario";
  const profileEmail = user?.email || "conta@velo.app";
  const initials = getInitials(profileName, user?.email);

  const isActive = (item: NavItem) => {
    const currentPath = normalizePath(location.pathname);
    const itemPath = normalizePath(item.to);
    return item.end ? currentPath === itemPath : currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
  };

  return (
    <aside className="velo-dashboard-sidebar" style={styles.sidebar}>
      <header style={styles.header}>
        <Link to="/dashboard" style={styles.brand}>
          <VeloIconOnly />
          <span style={styles.brandText}>Velo</span>
        </Link>
      </header>

      <button type="button" aria-label="Buscar" style={styles.search}>
        <Search size={15} strokeWidth={1.7} aria-hidden="true" />
        <span style={styles.searchText}>Buscar</span>
        <span style={styles.searchBadge}>/</span>
      </button>

      <nav aria-label="Navegação principal" style={styles.nav}>
        {navItems.map((item) => (
          <SidebarNavLink key={item.label} item={item} active={isActive(item)} />
        ))}
      </nav>

      <div aria-hidden="true" style={styles.spacer} />

      <section aria-label="Upgrade para Premium" style={styles.upgradeCard}>
        <div style={styles.upgradeTop}>
          <span style={styles.upgradeIcon} aria-hidden="true">
            <SignatureUpgradeIcon />
          </span>
          <button type="button" aria-label="Fechar upgrade" style={styles.upgradeClose}>
            <X size={15} strokeWidth={1.8} />
          </button>
        </div>
        <p style={styles.upgradeTitle}>Upgrade para o Premium!</p>
        <p style={styles.upgradeCopy}>
          Publique sem limites
          <br />
          Personalize sua marca
        </p>
        <button type="button" onClick={() => navigate("/dashboard/planos")} style={styles.upgradeButton}>
          Fazer upgrade
        </button>
      </section>

      <button type="button" aria-label="Abrir perfil" onClick={() => navigate("/dashboard/configuracoes")} style={styles.profileCard}>
        <span style={styles.avatar}>
          {foto ? <img src={foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
        </span>
        <span style={styles.profileText}>
          <span style={styles.profileName}>{profileName}</span>
          <span style={styles.profileEmail}>{profileEmail}</span>
        </span>
        <span aria-hidden="true" style={styles.profileChevrons}>
          <ChevronUp size={14} strokeWidth={1.8} />
          <ChevronDown size={14} strokeWidth={1.8} />
        </span>
      </button>
    </aside>
  );
};

export default DashboardSidebar;
