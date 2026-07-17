import { useEffect, useState, type CSSProperties, type ElementType } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
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

type NavItem = {
  label: string;
  icon: ElementType;
  to: string;
  dimmed?: boolean;
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

const styles = {
  sidebar: {
    width: 248,
    height: "100%",
    minHeight: 0,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "visible",
    position: "relative",
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
    gap: 12,
    minWidth: 0,
    color: "#F2F1EC",
    textDecoration: "none",
  } satisfies CSSProperties,
  brandText: {
    fontFamily: '"Inter Variable", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: 18,
    lineHeight: "22px",
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
    cursor: "pointer",
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
  navBadge: {
    marginLeft: "auto",
    minWidth: 18,
    height: 18,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    padding: "0 6px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    color: "#FFFFFF",
    fontSize: 10.5,
    lineHeight: "10px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
  } satisfies CSSProperties,
  spacer: {
    minHeight: 0,
    flex: 1,
  } satisfies CSSProperties,
  backLink: {
    height: 32,
    display: "flex",
    alignItems: "center",
    gap: 9,
    boxSizing: "border-box",
    borderRadius: 10,
    padding: "0 10px",
    marginBottom: 10,
    border: 0,
    width: "100%",
    background: "transparent",
    color: "rgba(255,255,255,0.62)",
    fontSize: 12.5,
    fontWeight: 500,
    letterSpacing: "-0.02em",
    cursor: "pointer",
    textDecoration: "none",
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
    cursor: "pointer",
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

const VeloIconOnly = () => (
  <svg aria-hidden="true" width="30" height="30" viewBox="0 0 48 48" fill="none" style={{ flexShrink: 0 }}>
    <path d="M33 18 A11 11 0 1 0 33 30" stroke="#F2F1EC" strokeWidth="4" strokeLinecap="round" />
    <path d="M30 26 L34 30 L38 26" stroke="#F2F1EC" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SidebarNavLink = ({ item, active }: { item: NavItem; active: boolean }) => {
  const Icon = item.icon;
  const linkStyle: CSSProperties = {
    ...styles.navLinkBase,
    color: active ? "#FFFFFF" : item.dimmed ? "rgba(255,255,255,0.62)" : "#FFFFFF",
    background: active ? "#2A2925" : "transparent",
    fontWeight: active ? 650 : 500,
    boxShadow: active ? "0 10px 28px rgba(0,0,0,0.36), inset 0 1px 0 rgba(255,255,255,0.08)" : "none",
  };

  return (
    <Link to={item.to} aria-current={active ? "page" : undefined} style={linkStyle}>
      <Icon size={16} strokeWidth={1.65} aria-hidden="true" />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
      {item.badge ? (
        <span style={styles.navBadge} aria-label={`${item.badge} tickets abertos`}>
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

  const foto = (user?.user_metadata?.avatar_url as string | undefined) || (user?.user_metadata?.picture as string | undefined) || null;
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
    <aside className="velo-dashboard-sidebar" style={styles.sidebar}>
      <header style={styles.header}>
        <Link to="/admin/painel" style={styles.brand}>
          <VeloIconOnly />
          <span style={styles.brandText}>Velo</span>
        </Link>
      </header>

      <button type="button" aria-label="Buscar" style={styles.search} onClick={() => setSearchOpen(true)}>
        <Search size={15} strokeWidth={1.7} aria-hidden="true" />
        <span style={styles.searchText}>Buscar</span>
        <span style={styles.searchBadge}>/</span>
      </button>

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} isAdmin />

      <nav aria-label="Navegação do admin" style={styles.nav}>
        {navItems.map((item) => (
          <SidebarNavLink
            key={item.label}
            item={item.to === "/admin/suporte" ? { ...item, badge: openTickets } : item}
            active={isActive(item)}
          />
        ))}
      </nav>

      <div aria-hidden="true" style={styles.spacer} />

      <Link to="/dashboard" style={styles.backLink}>
        <ArrowLeft size={16} strokeWidth={1.65} aria-hidden="true" />
        <span>Voltar à Velo</span>
      </Link>

      <button
        type="button"
        aria-label="Abrir perfil"
        onClick={() => navigate("/dashboard/configuracoes")}
        style={styles.profileCard}
      >
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

export default AdminNewSidebar;
