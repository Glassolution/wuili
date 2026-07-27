import { useEffect, useMemo, useRef, useState, type CSSProperties, type ElementType } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Archive, BadgeCheck, ChevronDown, ChevronRight, ClipboardList, Copy, CreditCard, Gift, Home, Info, Lightbulb, LogOut, MessagesSquare, MoreVertical, Plus, Settings2, ShieldCheck, ShoppingCart, Sparkles, Tag, ToggleLeft, TrendingUp, Trophy, UserRound, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/lib/profileContext";
import { isSupabaseEnabled, supabase } from "@/integrations/supabase/client";
import { isAdminEmail } from "@/lib/adminAccess";
import SearchPalette from "@/components/dashboard/SearchPalette";
import InviteFriendModal from "@/components/dashboard/InviteFriendModal";

type NavItem = {
  label: string;
  icon: ElementType;
  to?: string;
  end?: boolean;
  dimmed?: boolean;
  children?: NavItem[];
};

const baseNavItems: NavItem[] = [
  { label: "Início", icon: Home, to: "/dashboard", end: true },
  {
    // Categoria expansível (como "Products" da referência): agrupa o catálogo
    // e as páginas de venda como sub-itens.
    label: "Produtos",
    icon: Tag,
    children: [
      { label: "Catálogo", icon: ShoppingCart, to: "/dashboard/catalogo" },
      { label: "Páginas de venda", icon: Sparkles, to: "/dashboard/minha-loja" },
    ],
  },
  { label: "Produtos em Alta", icon: TrendingUp, to: "/dashboard/produtos-em-alta" },
  { label: "Publicações", icon: Archive, to: "/dashboard/publicacoes" },
  { label: "Pedidos", icon: Copy, to: "/dashboard/pedidos" },
  { label: "Relatórios", icon: ClipboardList, to: "/dashboard/relatorios", dimmed: true },
  { label: "Comunidade e Ajuda", icon: Info, to: "/docs", dimmed: true },
  { label: "Configurações", icon: Settings2, to: "/dashboard/configuracoes", dimmed: true },
];

const affiliatesNavItem: NavItem = { label: "Afiliados", icon: Users, to: "/dashboard/comissoes", dimmed: true };

const normalizePath = (path: string) => path.split("?")[0].replace(/\/$/, "");

const tourTargetByLabel: Record<string, string> = {
  Início: "inicio",
  Catálogo: "catalogo",
  "Produtos em Alta": "produtos-em-alta",
  Publicações: "publicacoes",
  Pedidos: "pedidos",
  Relatórios: "relatorios",
  Configurações: "configuracoes",
  "Minha loja": "minha-loja",
  "Páginas de venda": "minha-loja",
};

type SidebarSubscription = {
  plan: string | null;
  status: string | null;
  is_trial: boolean | null;
  trial_ends_at: string | null;
  current_period_end?: string | null;
  next_charge_at?: string | null;
  created_at?: string | null;
};

const activeSubscriptionStatuses = new Set(["active", "paid", "approved", "trialing"]);
const TRIAL_DURATION_MS = 5 * 24 * 60 * 60 * 1000;

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

const getTrialEndsAt = (subscription: SidebarSubscription | null) => {
  if (!subscription) return null;
  const status = String(subscription.status ?? "").toLowerCase();
  const isTrial = subscription.is_trial === true || status === "trialing";
  if (!isTrial) return null;

  if (subscription.trial_ends_at) return subscription.trial_ends_at;
  if (subscription.next_charge_at) return subscription.next_charge_at;
  if (subscription.current_period_end) return subscription.current_period_end;
  if (subscription.created_at && subscription.plan === "pro") {
    return new Date(new Date(subscription.created_at).getTime() + TRIAL_DURATION_MS).toISOString();
  }

  return null;
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
    width: 276,
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
    border: "1px solid #E5E7EB",
    background: "#F9FAFB",
    color: "#0A0A0A",
    boxShadow: "none",
  } satisfies CSSProperties,
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingTop: 4,
    paddingBottom: 6,
  } satisfies CSSProperties,
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
    color: "#0A0A0A",
    textDecoration: "none",
  } satisfies CSSProperties,
  brandText: {
    fontFamily: '"Inter Variable", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: 24,
    lineHeight: "28px",
    fontWeight: 700,
    letterSpacing: "-0.05em",
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
    background: "#F1F1F3",
    color: "#4B5563",
    textAlign: "left",
    boxShadow: "inset 0 0 0 1px rgba(10,10,10,0.06)",
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
    background: "#E4E4E7",
    color: "#4B5563",
    fontSize: 15,
    lineHeight: "15px",
    fontWeight: 650,
  } satisfies CSSProperties,
  nav: {
    marginTop: 16,
    marginBottom: 22,
    // Ocupa o espaço restante e rola internamente se os itens não couberem,
    // mantendo o cluster de baixo (upgrade + cards + perfil) sempre visível.
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 3,
  } satisfies CSSProperties,
  navLinkBase: {
    height: 36,
    display: "flex",
    alignItems: "center",
    gap: 9,
    boxSizing: "border-box",
    borderRadius: 10,
    padding: "0 11px",
    textDecoration: "none",
    fontSize: 14,
    lineHeight: "18px",
    letterSpacing: "-0.02em",
  } satisfies CSSProperties,
  // Sub-itens de uma categoria: recuados, com linha vertical à esquerda, um
  // pouco menores que os itens de topo (como na referência).
  subWrap: {
    marginLeft: 16,
    paddingLeft: 12,
    borderLeft: "1.5px solid rgba(10,10,10,0.10)",
    marginTop: 3,
    marginBottom: 3,
    display: "flex",
    flexDirection: "column",
    gap: 3,
  } satisfies CSSProperties,
  navSubLinkBase: {
    height: 33,
    display: "flex",
    alignItems: "center",
    gap: 9,
    boxSizing: "border-box",
    borderRadius: 9,
    padding: "0 10px",
    textDecoration: "none",
    fontSize: 13.5,
    lineHeight: "17px",
    letterSpacing: "-0.02em",
  } satisfies CSSProperties,
  spacer: {
    minHeight: 0,
    flex: 1,
  } satisfies CSSProperties,
  upgradeCard: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 16,
    padding: "18px 16px 16px",
    marginBottom: 12,
    background: "linear-gradient(180deg, #CBC8F9 0%, #EFEEFC 100%)",
    color: "#0A0A0A",
    boxShadow: "none",
    textAlign: "center",
  } satisfies CSSProperties,
  // Ícone "herói" centralizado no topo do card (sem chip), como na referência.
  upgradeIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 8px",
    color: "#1A1A1A",
  } satisfies CSSProperties,
  upgradeTitle: {
    margin: "0",
    color: "#0A0A0A",
    fontSize: 15,
    lineHeight: "19px",
    fontWeight: 700,
    letterSpacing: "-0.03em",
  } satisfies CSSProperties,
  upgradeCopy: {
    margin: "6px 0 0",
    color: "rgba(10,10,10,0.6)",
    fontSize: 12,
    lineHeight: "16px",
    fontWeight: 500,
  } satisfies CSSProperties,
  upgradeButton: {
    marginTop: 14,
    width: "100%",
    height: 38,
    border: 0,
    borderRadius: 10,
    background: "#121827",
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: 650,
    boxShadow: "none",
  } satisfies CSSProperties,
  // Blocos promocionais adaptados à Velo (estilo dos cards da referência):
  // ícone colorido à esquerda + título/subtítulo à direita, fundo tonalizado.
  promoCard: {
    width: "100%",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    gap: 10,
    border: 0,
    borderRadius: 12,
    padding: "10px 11px",
    marginBottom: 8,
    textAlign: "left",
    cursor: "pointer",
  } satisfies CSSProperties,
  promoIcon: {
    width: 34,
    height: 34,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  } satisfies CSSProperties,
  promoTitle: {
    display: "block",
    fontSize: 13,
    lineHeight: "17px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    color: "#0A0A0A",
  } satisfies CSSProperties,
  promoSub: {
    display: "block",
    marginTop: 1,
    fontSize: 11.5,
    lineHeight: "15px",
    fontWeight: 500,
    color: "rgba(10,10,10,0.55)",
  } satisfies CSSProperties,
  profileCard: {
    width: "100%",
    minWidth: 0,
    minHeight: 52,
    display: "flex",
    alignItems: "center",
    gap: 11,
    boxSizing: "border-box",
    border: 0,
    borderRadius: 14,
    padding: "10px 12px",
    background: "transparent",
    color: "#0A0A0A",
    textAlign: "left",
    boxShadow: "inset 0 0 0 1px rgba(10,10,10,0.08)",
  } satisfies CSSProperties,
  avatar: {
    width: 34,
    height: 34,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 999,
    background: "#E4E4E7",
    color: "#4B5563",
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
    color: "#0A0A0A",
    fontSize: 13,
    lineHeight: "17px",
    fontWeight: 600,
    letterSpacing: "-0.025em",
  } satisfies CSSProperties,
  profileEmail: {
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    marginTop: 2,
    color: "rgba(10,10,10,0.55)",
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
    color: "rgba(10,10,10,0.5)",
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
    border: "1px solid rgba(10,10,10,0.08)",
    background: "#FFFFFF",
    boxShadow: "0 14px 30px rgba(10,10,10,0.14)",
    zIndex: 80,
  } satisfies CSSProperties,
  profilePanelCard: {
    overflow: "hidden",
    borderRadius: 15,
    border: "1px solid rgba(10,10,10,0.06)",
    background: "#FFFFFF",
    boxShadow: "inset 0 1px 0 rgba(10,10,10,0.02)",
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
    color: "#1A1A1A",
    textAlign: "left",
  } satisfies CSSProperties,
  profilePanelRowActive: {
    background: "rgba(10,10,10,0.06)",
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
    color: "rgba(10,10,10,0.8)",
  } satisfies CSSProperties,
  profilePanelDivider: {
    height: 1,
    margin: "3px 0",
    background: "rgba(10,10,10,0.08)",
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
    background: "rgba(74,51,245,0.1)",
    color: "#4A33F5",
    boxShadow: "inset 0 0 0 1px rgba(74,51,245,0.14)",
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
    background: "rgba(10,10,10,0.06)",
    color: "rgba(10,10,10,0.6)",
  } satisfies CSSProperties,
  profilePanelCircleButton: {
    width: 16,
    height: 16,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    background: "rgba(10,10,10,0.06)",
    color: "rgba(10,10,10,0.6)",
    boxShadow: "inset 0 0 0 1px rgba(10,10,10,0.06)",
  } satisfies CSSProperties,
};

// Logo em "badge" (ícone de app), maior e com efeito glossy: brilho no canto
// superior (shine radial) + realce interno no topo e sombra interna na base
// (profundidade 3D) + drop shadow neutro. Sem glow roxo externo.
const VeloIconOnly = () => (
  <span
    aria-hidden="true"
    style={{
      position: "relative",
      overflow: "hidden",
      width: 48,
      height: 48,
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 14,
      background: "linear-gradient(150deg, #7A6CFF 0%, #5B4BF3 48%, #4A33F5 100%)",
      boxShadow:
        "inset 0 1.5px 0 rgba(255,255,255,0.5), inset 0 -3px 6px rgba(43,26,158,0.45), 0 6px 14px rgba(0,0,0,0.20)",
    }}
  >
    <span
      style={{
        position: "absolute",
        inset: 0,
        background:
          "radial-gradient(120% 85% at 26% 12%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 55%)",
        pointerEvents: "none",
      }}
    />
    <svg width="26" height="26" viewBox="0 0 48 48" fill="none" style={{ position: "relative" }}>
      <path d="M33 18 A11 11 0 1 0 33 30" stroke="#FFFFFF" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M30 26 L34 30 L38 26" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
);

const SidebarNavLink = ({ item, active, sub = false }: { item: NavItem; active: boolean; sub?: boolean }) => {
  const Icon = item.icon;
  const linkStyle: CSSProperties = {
    ...(sub ? styles.navSubLinkBase : styles.navLinkBase),
    color: active ? (sub ? "#4A33F5" : "#FFFFFF") : "#0A0A0A",
    background: active
      ? sub
        ? "rgba(74,51,245,0.09)"
        : "linear-gradient(90deg, #6558F6, #4A33F5)"
      : "transparent",
    fontWeight: active ? 600 : 500,
    boxShadow: active && !sub ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
  };

  return (
    <Link to={item.to!} aria-current={active ? "page" : undefined} data-dashboard-tour={tourTargetByLabel[item.label]} style={linkStyle}>
      <Icon size={sub ? 16 : 17} strokeWidth={1.25} fill="none" aria-hidden="true" />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
    </Link>
  );
};

// Item pai expansível (categoria). Abre/fecha os sub-itens ao clicar; fica com
// o pill roxo quando algum filho é a rota ativa, como na referência.
const SidebarCategory = ({
  item,
  open,
  childActive,
  onToggle,
  isActive,
}: {
  item: NavItem;
  open: boolean;
  childActive: boolean;
  onToggle: () => void;
  isActive: (i: NavItem) => boolean;
}) => {
  const Icon = item.icon;
  const Chevron = open ? ChevronDown : ChevronRight;
  const btnStyle: CSSProperties = {
    ...styles.navLinkBase,
    width: "100%",
    border: 0,
    cursor: "pointer",
    color: childActive ? "#FFFFFF" : "#0A0A0A",
    background: childActive ? "linear-gradient(90deg, #6558F6, #4A33F5)" : "transparent",
    fontWeight: childActive ? 600 : 500,
    boxShadow: childActive ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
  };

  return (
    <>
      <button type="button" onClick={onToggle} aria-expanded={open} style={btnStyle}>
        <Icon size={17} strokeWidth={1.25} fill="none" aria-hidden="true" />
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
        <Chevron size={16} strokeWidth={1.75} aria-hidden="true" style={{ flexShrink: 0, opacity: 0.8 }} />
      </button>
      {open ? (
        <div style={styles.subWrap}>
          {item.children!.map((child) => (
            <SidebarNavLink key={child.label} item={child} active={isActive(child)} sub />
          ))}
        </div>
      ) : null}
    </>
  );
};

const DashboardSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, role } = useAuth();
  const { nome, foto } = useProfile();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  // Evita ícone quebrado/circulo vazio quando a foto do perfil não existe ou
  // falha ao carregar (ex.: URL de storage inválida). Nesses casos cai para o
  // ícone genérico de usuário em vez de depender de um asset externo.
  const [avatarFailed, setAvatarFailed] = useState(false);
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

  // Categoria expansível atualmente aberta (ex.: "Produtos").
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  const visibleNavItems = useMemo(() => {
    const items = [...baseNavItems];
    if (isAdmin) {
      items.splice(4, 0, affiliatesNavItem);
      // "Editar minha loja (beta)" removido da sidebar; o fluxo principal começa em /comecar.
    }
    return items;
  }, [isAdmin]);

  const isActive = (item: NavItem) => {
    if (!item.to) return false;
    const currentPath = normalizePath(location.pathname);
    const itemPath = normalizePath(item.to);
    return item.end ? currentPath === itemPath : currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
  };

  const isChildActive = (item: NavItem) => !!item.children?.some(isActive);
  const toggleCategory = (label: string) => setOpenCategory((cur) => (cur === label ? null : label));

  // Abre automaticamente a categoria que contém a rota ativa.
  useEffect(() => {
    const currentPath = normalizePath(location.pathname);
    const activeCat = baseNavItems.find((i) =>
      i.children?.some((c) => {
        if (!c.to) return false;
        const p = normalizePath(c.to);
        return currentPath === p || currentPath.startsWith(`${p}/`);
      }),
    );
    if (activeCat) setOpenCategory(activeCat.label);
  }, [location.pathname]);

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
        .select("plan,status,is_trial,trial_ends_at,current_period_end,next_charge_at,updated_at,created_at")
        .eq("user_id", user.id)
         .in("status", Array.from(activeSubscriptionStatuses))
        .order("updated_at", { ascending: false, nullsFirst: false })
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
    const trialEndsAt = getTrialEndsAt(subscription);
    if (!trialEndsAt) return;
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, [subscription]);

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
        supabase.rpc("is_admin", { _user_id: user.id }),
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

  const planLabel = plan === "business" ? "BUSINESS" : plan === "pro" || plan === "plus" ? "PRO" : plan === "base" ? "BASE" : plan === "go" ? "GO" : "GRATIS";
  const normalizedPlan = plan === "plus" ? "pro" : plan;
  const trialTimeLeft = formatTrialTimeLeft(getTrialEndsAt(subscription), now);
  const showUpgradeCard = Boolean(trialTimeLeft) || !["base", "pro", "business"].includes(normalizedPlan);

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

      {/* Barra de busca removida da sidebar. A paleta de busca continua
          acessível pelo atalho de teclado "/". */}
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} isAdmin={isAdmin} />
      <InviteFriendModal open={inviteOpen} onClose={() => setInviteOpen(false)} />

      <nav aria-label="Navegação principal" style={styles.nav}>
        {visibleNavItems.map((item) =>
          item.children ? (
            <SidebarCategory
              key={item.label}
              item={item}
              open={openCategory === item.label}
              childActive={isChildActive(item)}
              onToggle={() => toggleCategory(item.label)}
              isActive={isActive}
            />
          ) : (
            <SidebarNavLink key={item.label} item={item} active={isActive(item)} />
          ),
        )}
      </nav>

      {showUpgradeCard && (
        <section aria-label={trialTimeLeft ? "Tempo restante do trial" : "Upgrade para Premium"} style={styles.upgradeCard}>
          <span style={styles.upgradeIcon} aria-hidden="true">
            <Trophy size={28} strokeWidth={1.75} />
          </span>
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

      {/* Linha "Feature Requests" da referência, adaptada à Velo como
          "Sugestões" (leva à comunidade/ajuda, onde vão feedbacks). */}
      <button
        type="button"
        onClick={() => navigate("/docs")}
        style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", border: 0, background: "transparent", padding: "6px 12px", marginBottom: 8, cursor: "pointer", textAlign: "left", color: "#0A0A0A" }}
      >
        <Lightbulb size={18} strokeWidth={1.5} aria-hidden="true" />
        <span style={{ fontSize: 14, fontWeight: 500, letterSpacing: "-0.02em" }}>Sugestões</span>
      </button>

      {/* Blocos adaptados à Velo no estilo da referência (equivalentes ao
          "Refer & Earn" e ao card verde de loja). O bloco "FREE AI Shopify
          Store" da referência não se aplica (Velo é Mercado Livre), então virou
          "Páginas de venda com IA", um recurso real da Velo. */}
      <button type="button" onClick={() => setInviteOpen(true)} style={{ ...styles.promoCard, background: "#ECEAFB" }}>
        <span style={{ ...styles.promoIcon, background: "#DFDBFA", color: "#5B4FF6" }} aria-hidden="true">
          <Gift size={17} strokeWidth={2} />
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={styles.promoTitle}>Indique e ganhe</span>
          <span style={styles.promoSub}>Ganhe 15% em cada indicação</span>
        </span>
      </button>

      <button type="button" onClick={() => navigate("/dashboard/minha-loja")} style={{ ...styles.promoCard, background: "#E7F5EC" }}>
        <span style={{ ...styles.promoIcon, background: "#D6EEDF", color: "#16A34A" }} aria-hidden="true">
          <Sparkles size={17} strokeWidth={2} />
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={styles.promoTitle}>Páginas de venda com IA</span>
          <span style={styles.promoSub}>Crie sua loja em minutos</span>
        </span>
      </button>

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
            {foto && !avatarFailed ? (
              <img
                src={foto}
                alt=""
                onError={() => setAvatarFailed(true)}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <UserRound size={17} strokeWidth={1.9} color="rgba(10,10,10,0.55)" />
            )}
          </span>
          <span style={styles.profileText}>
            <span style={styles.profileName}>{profileName}</span>
            <span style={styles.profileEmail}>{profileEmail}</span>
          </span>
          <span aria-hidden="true" style={styles.profileChevrons}>
            <MoreVertical size={16} strokeWidth={2} />
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
