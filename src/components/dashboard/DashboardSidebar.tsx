import { useEffect, useMemo, useRef, useState, type CSSProperties, type ElementType } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Archive, BadgeCheck, ChevronDown, ChevronUp, ClipboardList, Copy, CreditCard, Home, Info, LogOut, MessagesSquare, Plus, Search, Settings2, ShieldCheck, ShoppingCart, Sparkles, ToggleLeft, Users, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/lib/profileContext";
import { isSupabaseEnabled, supabase } from "@/integrations/supabase/client";
import { isAdminEmail } from "@/lib/adminAccess";
import SearchPalette from "@/components/dashboard/SearchPalette";

type NavItem = {
  label: string;
  icon: ElementType;
  to: string;
  end?: boolean;
  dimmed?: boolean;
};

const baseNavItems: NavItem[] = [
  { label: "Início", icon: Home, to: "/dashboard", end: true },
  { label: "Catálogo", icon: ShoppingCart, to: "/dashboard/catalogo" },
  { label: "Publicações", icon: Archive, to: "/dashboard/publicacoes" },
  { label: "Pedidos", icon: Copy, to: "/dashboard/pedidos" },
  { label: "Relatórios", icon: ClipboardList, to: "/dashboard/relatorios", dimmed: true },
  { label: "Ajuda & Central", icon: Info, to: "/docs", dimmed: true },
  { label: "Configurações", icon: Settings2, to: "/dashboard/configuracoes", dimmed: true },
];

const affiliatesNavItem: NavItem = { label: "Afiliados", icon: Users, to: "/dashboard/comissoes", dimmed: true };

const normalizePath = (path: string) => path.split("?")[0].replace(/\/$/, "");

type SidebarSubscription = {
  plan: string | null;
  status: string | null;
  is_trial: boolean | null;
  trial_ends_at: string | null;
};

const activeSubscriptionStatuses = new Set(["active", "paid", "approved"]);

const formatTrialTimeLeft = (endsAt: string | null, now: Date) => {
  if (!endsAt) return null;
  const diff = new Date(endsAt).getTime() - now.getTime();
  if (diff <= 0) return null;

  const totalHours = Math.ceil(diff / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (days <= 0) return `${hours}h`;
  if (hours <= 0) return `${days}d`;
  return `${days}d ${hours}h`;
};

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
  profileWrap: {
    position: "relative",
  } satisfies CSSProperties,
  profilePanel: {
    position: "absolute",
    left: "calc(100% + 6px)",
    bottom: 0,
    width: 214,
    boxSizing: "border-box",
    borderRadius: 18,
    padding: 4,
    border: "1px solid rgba(255,255,255,0.05)",
    background: "linear-gradient(180deg, #121212 0%, #09090A 100%)",
    boxShadow: "0 14px 30px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.03)",
    zIndex: 80,
  } satisfies CSSProperties,
  profilePanelCard: {
    overflow: "hidden",
    borderRadius: 15,
    border: "1px solid rgba(255,255,255,0.05)",
    background: "linear-gradient(180deg, #131314 0%, #0C0C0D 100%)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.025)",
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", sans-serif',
  } satisfies CSSProperties,
  profilePanelBody: {
    padding: "7px 6px 4px",
  } satisfies CSSProperties,
  profilePanelRow: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 7,
    boxSizing: "border-box",
    border: 0,
    minHeight: 40,
    borderRadius: 11,
    padding: "8px 10px",
    background: "transparent",
    color: "#F3F3F2",
    textAlign: "left",
  } satisfies CSSProperties,
  profilePanelRowActive: {
    background: "rgba(255,255,255,0.11)",
  } satisfies CSSProperties,
  profilePanelRowLeft: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: 8,
  } satisfies CSSProperties,
  profilePanelRowLabel: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: 10.5,
    lineHeight: "14px",
    fontWeight: 500,
    letterSpacing: "-0.015em",
  } satisfies CSSProperties,
  profilePanelIcon: {
    width: 14,
    height: 14,
    flexShrink: 0,
    color: "rgba(255,255,255,0.9)",
  } satisfies CSSProperties,
  profilePanelDivider: {
    height: 1,
    margin: "3px 0",
    background: "rgba(255,255,255,0.08)",
  } satisfies CSSProperties,
  profilePanelFooter: {
    padding: "1px 6px 6px",
  } satisfies CSSProperties,
  profilePanelBadge: {
    height: 16,
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    padding: "0 6px",
    fontSize: 8,
    lineHeight: "9px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    background: "rgba(255,255,255,0.1)",
    color: "#FAFAF9",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
  } satisfies CSSProperties,
  profilePanelMutedBadge: {
    height: 16,
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "0 6px",
    fontSize: 8,
    lineHeight: "9px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.72)",
  } satisfies CSSProperties,
  profilePanelCircleButton: {
    width: 16,
    height: 16,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.72)",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
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
  <svg aria-hidden="true" width="30" height="30" viewBox="0 0 48 48" fill="none" style={{ flexShrink: 0 }}>
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
  const { user, signOut, role } = useAuth();
  const { nome, foto } = useProfile();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [plan, setPlan] = useState("gratis");
  const [subscription, setSubscription] = useState<SidebarSubscription | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileName = nome || user?.user_metadata?.full_name || user?.email || "Usuario";
  const profileEmail = user?.email || "conta@velo.app";
  const initials = getInitials(profileName, user?.email);
  const metadataRole =
    (user?.app_metadata?.role as string | undefined) ??
    (user?.user_metadata?.role as string | undefined) ??
    null;

  const visibleNavItems = useMemo(() => {
    const items = [...baseNavItems];
    if (isAdmin) {
      items.splice(4, 0, affiliatesNavItem);
    }
    return items;
  }, [isAdmin]);

  const isActive = (item: NavItem) => {
    const currentPath = normalizePath(location.pathname);
    const itemPath = normalizePath(item.to);
    return item.end ? currentPath === itemPath : currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
  };

  useEffect(() => {
    setProfileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "/") return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (target?.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      event.preventDefault();
      setSearchOpen(true);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!user) return;

    let active = true;

    Promise.all([
      supabase.from("profiles").select("plano").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("subscriptions")
        .select("plan,status,is_trial,trial_ends_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]).then(([profileResult, subscriptionResult]) => {
        if (!active) return;

        const currentSubscription = subscriptionResult.data as SidebarSubscription | null;
        setSubscription(currentSubscription);

        if (currentSubscription?.plan && activeSubscriptionStatuses.has(String(currentSubscription.status))) {
          setPlan(String(currentSubscription.plan));
          return;
        }

        if (profileResult.data?.plano) setPlan(String(profileResult.data.plano));
      });

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!subscription?.is_trial || !subscription.trial_ends_at) return;
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, [subscription?.is_trial, subscription?.trial_ends_at]);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }

    const hasAdminRole = role === "admin" || metadataRole === "admin" || isAdminEmail(user.email);
    setIsAdmin(hasAdminRole);

    if (!isSupabaseEnabled) return;

    let active = true;

    const resolveAdminRole = async () => {
      const [hasRoleResult, profileByUserId, profileById, userRole] = await Promise.allSettled([
        supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
        (supabase as any).from("profiles").select("role").eq("user_id", user.id).maybeSingle(),
        (supabase as any).from("profiles").select("role").eq("id", user.id).maybeSingle(),
        (supabase as any).from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
      ]);

      if (!active) return;

      const roleCandidates = [role, metadataRole, isAdminEmail(user.email) ? "admin" : null];

      if (hasRoleResult.status === "fulfilled" && hasRoleResult.value.data === true) {
        roleCandidates.push("admin");
      }
      for (const result of [profileByUserId, profileById, userRole]) {
        if (result.status === "fulfilled" && result.value?.data?.role) {
          roleCandidates.push(String(result.value.data.role));
        }
      }

      setIsAdmin(roleCandidates.includes("admin"));
    };

    void resolveAdminRole().catch((error) => {
      console.error("[DashboardSidebar] erro ao resolver permissao admin:", error);
      if (active) setIsAdmin(hasAdminRole);
    });

    return () => {
      active = false;
    };
  }, [metadataRole, role, user]);

  useEffect(() => {
    if (!profileMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileMenuOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [profileMenuOpen]);

  const planLabel = plan === "business" ? "BUSINESS" : plan === "pro" ? "PRO" : plan === "go" ? "GO" : "GRATIS";
  const normalizedPlan = plan === "plus" ? "pro" : plan;
  const trialTimeLeft = subscription?.is_trial ? formatTrialTimeLeft(subscription.trial_ends_at, now) : null;
  const showUpgradeCard = Boolean(trialTimeLeft) || !["pro", "business"].includes(normalizedPlan);

  const handlePanelNavigate = (to: string) => {
    setProfileMenuOpen(false);
    navigate(to);
  };

  const handleSignOut = async () => {
    setProfileMenuOpen(false);
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <aside className="velo-dashboard-sidebar" style={styles.sidebar}>
      <header style={styles.header}>
        <Link to="/dashboard" style={styles.brand}>
          <VeloIconOnly />
          <span style={styles.brandText}>Velo</span>
        </Link>
      </header>

      <button type="button" aria-label="Buscar" style={styles.search} onClick={() => setSearchOpen(true)}>
        <Search size={15} strokeWidth={1.7} aria-hidden="true" />
        <span style={styles.searchText}>Buscar</span>
        <span style={styles.searchBadge}>/</span>
      </button>

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} isAdmin={isAdmin} />

      <nav aria-label="Navegação principal" style={styles.nav}>
        {visibleNavItems.map((item) => (
          <SidebarNavLink key={item.label} item={item} active={isActive(item)} />
        ))}
      </nav>

      <div aria-hidden="true" style={styles.spacer} />

      {showUpgradeCard && (
        <section aria-label={trialTimeLeft ? "Tempo restante do trial" : "Upgrade para Premium"} style={styles.upgradeCard}>
          <div style={styles.upgradeTop}>
            <span style={styles.upgradeIcon} aria-hidden="true">
              <SignatureUpgradeIcon />
            </span>
            {!trialTimeLeft && (
              <button type="button" aria-label="Fechar upgrade" style={styles.upgradeClose}>
                <X size={15} strokeWidth={1.8} />
              </button>
            )}
          </div>
          <p style={styles.upgradeTitle}>{trialTimeLeft ? "Trial ativo" : "Upgrade para o Premium!"}</p>
          <p style={styles.upgradeCopy}>
            {trialTimeLeft ? (
              <>
                Termina em
                <br />
                {trialTimeLeft}
              </>
            ) : (
              <>
                Publique sem limites
                <br />
                Personalize sua marca
              </>
            )}
          </p>
          <button type="button" onClick={() => navigate("/dashboard/planos")} style={styles.upgradeButton}>
            Fazer upgrade
          </button>
        </section>
      )}

      <div ref={profileMenuRef} style={styles.profileWrap}>
        <button
          type="button"
          aria-label="Abrir perfil"
          aria-haspopup="menu"
          aria-expanded={profileMenuOpen}
          onClick={() => setProfileMenuOpen((current) => !current)}
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

        {profileMenuOpen ? (
          <div style={styles.profilePanel} role="menu" aria-label="Menu de perfil">
            <div style={styles.profilePanelCard}>
              <div style={styles.profilePanelBody}>
                <button
                  type="button"
                  onClick={() => handlePanelNavigate("/dashboard/configuracoes")}
                  style={{ ...styles.profilePanelRow, ...styles.profilePanelRowActive }}
                >
                  <span style={styles.profilePanelRowLeft}>
                    <BadgeCheck size={15} strokeWidth={2.1} style={styles.profilePanelIcon} />
                    <span style={styles.profilePanelRowLabel}>Perfil</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePanelNavigate("/docs")}
                  style={styles.profilePanelRow}
                >
                  <span style={styles.profilePanelRowLeft}>
                    <MessagesSquare size={15} strokeWidth={2.05} style={styles.profilePanelIcon} />
                    <span style={styles.profilePanelRowLabel}>Comunidade</span>
                  </span>
                  <span style={styles.profilePanelCircleButton}>
                    <Plus size={12} strokeWidth={2.2} />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePanelNavigate("/dashboard/planos")}
                  style={styles.profilePanelRow}
                >
                  <span style={styles.profilePanelRowLeft}>
                    <CreditCard size={16} strokeWidth={1.9} style={styles.profilePanelIcon} />
                    <span style={styles.profilePanelRowLabel}>Assinatura</span>
                  </span>
                  <span style={plan === "gratis" ? styles.profilePanelMutedBadge : styles.profilePanelBadge}>
                    {plan !== "gratis" ? <Sparkles size={12} strokeWidth={2.2} /> : null}
                    {planLabel}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePanelNavigate("/dashboard/configuracoes")}
                  style={styles.profilePanelRow}
                >
                  <span style={styles.profilePanelRowLeft}>
                    <ToggleLeft size={16} strokeWidth={2.05} style={styles.profilePanelIcon} />
                    <span style={styles.profilePanelRowLabel}>Configurações</span>
                  </span>
                </button>

                {isAdmin ? (
                  <button
                    type="button"
                    onClick={() => handlePanelNavigate("/admin/painel")}
                    style={styles.profilePanelRow}
                  >
                    <span style={styles.profilePanelRowLeft}>
                      <ShieldCheck size={16} strokeWidth={2.05} style={styles.profilePanelIcon} />
                      <span style={styles.profilePanelRowLabel}>Painel Admin</span>
                    </span>
                  </button>
                ) : null}
              </div>

              <div style={styles.profilePanelDivider} />

              <div style={styles.profilePanelFooter}>
                <button
                  type="button"
                  onClick={() => handlePanelNavigate("/docs")}
                  style={styles.profilePanelRow}
                >
                  <span style={styles.profilePanelRowLeft}>
                    <Info size={15} strokeWidth={2.05} style={styles.profilePanelIcon} />
                    <span style={styles.profilePanelRowLabel}>Central de ajuda</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  style={styles.profilePanelRow}
                >
                  <span style={styles.profilePanelRowLeft}>
                    <LogOut size={15} strokeWidth={2.05} style={styles.profilePanelIcon} />
                    <span style={styles.profilePanelRowLabel}>Sair</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
};

export default DashboardSidebar;
