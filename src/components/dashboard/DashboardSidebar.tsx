import { useEffect, useMemo, useRef, useState, type CSSProperties, type ElementType } from "react";
import { flushSync } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Archive, ChevronRight, Image as ImageIcon, Copy, CreditCard, Gift, Grid2X2, Home, Info, Lightbulb, LogOut, MoreVertical, NotebookText, Settings2, ShieldCheck, ShoppingCart, Sparkles, Tag, TrendingUp, Trophy, UserRound, Users } from "lucide-react";
import ShopifyBagIcon from "@/components/icons/ShopifyBagIcon";
import TikTokIcon from "@/components/dashboard/TikTokIcon";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/lib/profileContext";
import { isSupabaseEnabled, supabase } from "@/integrations/supabase/client";
import { isAdminEmail } from "@/lib/adminAccess";
import { AFFILIATE_APPLICATION_EVENT } from "@/pages/dashboard/AffiliateQuizPage";
import SearchPalette from "@/components/dashboard/SearchPalette";
import InviteFriendModal from "@/components/dashboard/InviteFriendModal";
import { PremiumActionButton } from "@/components/PremiumActionButton";
import { useUpgradeModal } from "@/components/PlansUpgradeModal";
import { nomeDeExibicao } from "@/lib/nomeDeExibicao";
import { styles } from "@/components/dashboard/DashboardSidebar.styles";

type NavItem = {
  id: string;
  label: string;
  icon: ElementType;
  to?: string;
  end?: boolean;
  dimmed?: boolean;
  children?: NavItem[];
};

const baseNavItems: NavItem[] = [
  { id: "inicio", label: "Início", icon: Home, to: "/dashboard", end: true },
  {
    // Categoria expansível (como "Products" da referência): agrupa catálogo,
    // páginas com IA e modelos de produto.
    id: "produtos",
    label: "Produtos",
    icon: Tag,
    children: [
      { id: "catalogo", label: "Catálogo", icon: ShoppingCart, to: "/dashboard/catalogo" },
      { id: "paginas-com-ia", label: "Páginas com IA", icon: NotebookText, to: "/dashboard/paginas-com-ia" },
      { id: "modelos", label: "Templates", icon: Grid2X2, to: "/dashboard/modelos" },
    ],
  },
  {
    // Categoria "Produtos vencedores" (troféu, como "Winning Products"):
    // agrupa as ferramentas para encontrar e apresentar produtos.
    id: "produtos-vencedores",
    label: "Produtos vencedores",
    icon: Trophy,
    children: [
      { id: "produtos-em-alta", label: "Produtos em Alta", icon: TrendingUp, to: "/dashboard/produtos-em-alta" },
    ],
  },
  { id: "publicacoes", label: "Publicações", icon: Archive, to: "/dashboard/publicacoes" },
  { id: "pedidos", label: "Pedidos", icon: Copy, to: "/dashboard/pedidos" },
  { id: "imagens-ia", label: "Imagens com IA", icon: ImageIcon, to: "/dashboard/imagens-ia" },
  { id: "tiktok", label: "TikTok", icon: TikTokIcon, to: "/dashboard/tiktok" },
  // { id: "cursos-ecommerce", label: "Cursos Ecommerce", icon: GraduationCap, to: "/dashboard/cursos-ecommerce" },
];

// "Lojas": conectar/gerenciar lojas (Shopify, Mercado Livre) — leva à tela de
// integrações. Fora da navegação por enquanto: só administradores veem o item.
// A ROTA continua aberta de propósito — o callback do Mercado Pago devolve o
// usuário em /dashboard/integracoes, e bloqueá-la quebraria a conexão de
// pagamento de quem não é admin.
const storesNavItem: NavItem = { id: "lojas", label: "Lojas", icon: ShopifyBagIcon, to: "/dashboard/integracoes" };

const affiliatesNavItem: NavItem = { id: "afiliados", label: "Afiliados", icon: Users, to: "/dashboard/comissoes", dimmed: true };

const normalizePath = (path: string) => path.split("?")[0].replace(/\/$/, "");

// Transição do "sliding highlight" (pill do item ativo) e do submenu.
const PILL_EASE = [0.4, 0, 0.2, 1] as const;

// Hover/foco dos itens (inline styles não fazem :hover, então injetamos CSS).
const NAV_CSS = `
.velo-nav-item, .velo-nav-sub { transition: background-color 150ms ease-out, color 150ms ease-out; }
.velo-nav-item:hover:not([data-active="true"]) { background-color: rgba(10,10,10,0.05); }
.velo-nav-sub:hover:not([data-active="true"]) { background-color: rgba(10,10,10,0.045); }
.velo-nav-ico { transition: transform 150ms ease-out; }
.velo-nav-item:hover .velo-nav-ico, .velo-nav-sub:hover .velo-nav-ico { transform: scale(1.09); }
.velo-settings-row { transition: background-color 140ms ease-out; }
.velo-settings-row:hover { background-color: rgba(10,10,10,0.05); }
.velo-profile-menu-row { transition: background-color 140ms ease-out, transform 140ms ease-out; }
.velo-profile-menu-row:hover { background-color: rgba(10,10,10,0.045); }
.velo-sidebar-scroll {
  overflow-y: scroll;
  scrollbar-width: thin;
  scrollbar-color: rgba(10,10,10,0.26) transparent;
}
.velo-sidebar-scroll::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.velo-sidebar-scroll::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 999px;
}
.velo-sidebar-scroll::-webkit-scrollbar-thumb {
  background: rgba(10,10,10,0.26);
  border-radius: 999px;
}
.velo-sidebar-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(10,10,10,0.32);
}
.velo-collapsible {
  display: grid;
  grid-template-rows: 0fr;
  min-height: 0;
  margin: 0;
  padding: 0;
  overflow: hidden;
  transition: grid-template-rows 300ms ease-out;
}
.velo-collapsible[data-state="open"] { grid-template-rows: 1fr; }
.velo-collapsible-inner {
  min-height: 0;
  overflow: hidden;
}
@media (prefers-reduced-motion: reduce) {
  .velo-nav-item, .velo-nav-sub, .velo-nav-ico, .velo-collapsible-chevron { transition: none; }
  .velo-collapsible { transition: none; }
}
`;

const tourTargetByLabel: Record<string, string> = {
  Início: "inicio",
  Catálogo: "catalogo",
  "Produtos em Alta": "produtos-em-alta",
  Publicações: "publicacoes",
  Pedidos: "pedidos",
  "Imagens com IA": "imagens-ia",
  "Cursos Ecommerce": "cursos-ecommerce",
  Configurações: "configuracoes",
  "Minha loja": "minha-loja",
  "Páginas com IA": "paginas-com-ia",
  TikTok: "tiktok",
  Templates: "modelos",
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

// Logo oficial da Velo (public/logo.png): a cesta azul com o "C", gerada a partir
// de "public/logo original.png" com o fundo branco removido e recortada na borda da
// arte — por isso ela preenche a caixa inteira (object-contain) em vez de flutuar
// numa margem vazia.
const VeloIconOnly = () => (
  <img
    aria-hidden="true"
    src="/logo.png"
    alt=""
    // 38px mantém a presença da marca sem deixar o topo mais pesado que a referência.
    style={{ width: 38, height: 38, objectFit: "contain", flexShrink: 0, display: "block" }}
  />
);

// Pill de fundo do item ativo. Com layoutId compartilhado, o framer desliza o
// mesmo elemento entre os itens ao trocar de página (sliding highlight).
const ActivePill = ({ sub, reduce }: { sub?: boolean; reduce: boolean }) => (
  <motion.span
    layoutId={sub ? undefined : "navActivePill"}
    aria-hidden="true"
    initial={sub ? { opacity: 0 } : false}
    animate={sub ? { opacity: 1 } : undefined}
    exit={sub ? { opacity: 0 } : undefined}
    transition={reduce ? { duration: 0 } : { duration: 0.24, ease: PILL_EASE }}
    style={{
      position: "absolute",
      inset: 0,
      zIndex: -1,
      borderRadius: sub ? 8 : 8,
      background: sub ? "rgba(37,99,235,0.10)" : "linear-gradient(90deg, #4F7FFF, #1D4ED8)",
      boxShadow: sub ? "none" : "0 1px 2px rgba(0,0,0,0.08)",
    }}
  />
);

const SidebarNavLink = ({ item, active, sub = false, reduce }: { item: NavItem; active: boolean; sub?: boolean; reduce: boolean }) => {
  const Icon = item.icon;
  const linkStyle: CSSProperties = {
    ...(sub ? styles.navSubLinkBase : styles.navLinkBase),
    position: "relative",
    isolation: "isolate",
    color: active ? (sub ? "#1D4ED8" : "#FFFFFF") : "#0A0A0A",
  };

  return (
    <Link
      to={item.to!}
      aria-current={active ? "page" : undefined}
      data-active={active ? "true" : "false"}
      data-dashboard-tour={tourTargetByLabel[item.label]}
      className={sub ? "velo-nav-sub" : "velo-nav-item"}
      style={linkStyle}
    >
      {active ? <ActivePill sub={sub} reduce={reduce} /> : null}
      <Icon className="velo-nav-ico" size={sub ? 15 : 18} strokeWidth={sub ? 1.9 : 2} aria-hidden="true" />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
    </Link>
  );
};

// Item pai expansível (categoria). Mesmo layout dos demais (ícone + label com
// gap fixo, à esquerda); o chevron vai para a direita com margin-left:auto e
// rotaciona ao abrir. Fica com o pill roxo quando algum filho é a rota ativa.
const SidebarCategory = ({
  item,
  open,
  childActive,
  onOpenChange,
  isActive,
  reduce,
}: {
  item: NavItem;
  open: boolean;
  childActive: boolean;
  onOpenChange: (open: boolean) => void;
  isActive: (i: NavItem) => boolean;
  reduce: boolean;
}) => {
  const Icon = item.icon;
  const submenuId = `sidebar-submenu-${item.id}`;
  const btnStyle: CSSProperties = {
    ...styles.navLinkBase,
    width: "100%",
    border: 0,
    cursor: "pointer",
    textAlign: "left",
    position: "relative",
    isolation: "isolate",
    color: childActive ? "#FFFFFF" : "#0A0A0A",
    justifyContent: "space-between",
  };

  return (
    // O submenu fica sempre no DOM e é colapsado por CSS Grid (0fr -> 1fr).
    // Assim ele continua no fluxo normal: quando abre, empurra naturalmente
    // todos os itens abaixo e o card de upgrade em vez de sobrepor.
    <div>
      <button
        type="button"
        data-active={childActive ? "true" : "false"}
        aria-expanded={open}
        aria-controls={submenuId}
        className="velo-nav-item"
        onClick={() => onOpenChange(!open)}
        style={btnStyle}
      >
        {childActive ? <ActivePill reduce={reduce} /> : null}
        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <Icon className="velo-nav-ico" size={18} strokeWidth={2} aria-hidden="true" />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
        </span>
        <ChevronRight
          size={16}
          strokeWidth={1.75}
          aria-hidden="true"
          className="velo-collapsible-chevron"
          style={{
            flexShrink: 0,
            opacity: 0.75,
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            transition: reduce ? "none" : "transform 280ms ease-out",
          }}
        />
      </button>
      <div id={submenuId} className="velo-collapsible" data-state={open ? "open" : "closed"}>
        <div className="velo-collapsible-inner">
          <div style={styles.subWrap}>
            {item.children!.map((child) => (
              <SidebarNavLink key={child.id} item={child} active={isActive(child)} sub reduce={reduce} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const DashboardSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const upgradeModal = useUpgradeModal();
  const { user, signOut, role } = useAuth();
  const { nome, foto } = useProfile();
  const reduce = !!useReducedMotion();
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
  // "Afiliados" só aparece depois que o usuário envia a solicitação.
  const [hasAffiliateApplication, setHasAffiliateApplication] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  // Exibição usa só os dois primeiros nomes; o valor completo continua salvo.
  const profileName = nomeDeExibicao(
    nome || (user?.user_metadata?.full_name as string | undefined),
    user?.email,
  );
  const profileEmail = user?.email || "conta@velo.app";
  const initials = getInitials(profileName, user?.email);
  const metadataRole =
    (user?.app_metadata?.role as string | undefined) ??
    (user?.user_metadata?.role as string | undefined) ??
    null;

  const [openCategories, setOpenCategories] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setProfileMenuOpen(false);
  }, [location.pathname, location.search]);

  const visibleNavItems = useMemo(() => {
    const items = [...baseNavItems];
    if (isAdmin || hasAffiliateApplication) {
      // Ancorado pelo vizinho, e não por índice fixo: reordenar baseNavItems não
      // deve arrastar "Afiliados" para outro ponto da lista sem querer.
      const afterPedidos = items.findIndex((item) => item.id === "pedidos") + 1;
      items.splice(afterPedidos || items.length, 0, affiliatesNavItem);
    }
    if (isAdmin) {
      items.push(storesNavItem);
      // "Editar minha loja (beta)" removido da sidebar; o fluxo principal começa em /comecar.
    }
    return items;
  }, [hasAffiliateApplication, isAdmin]);

  const isActive = (item: NavItem) => {
    if (!item.to) return false;
    const currentPath = normalizePath(location.pathname);
    const itemPath = normalizePath(item.to);
    return item.end ? currentPath === itemPath : currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
  };

  const isChildActive = (item: NavItem) => !!item.children?.some(isActive);
  const setCategoryOpen = (id: string, isOpen: boolean) =>
    setOpenCategories((current) => {
      const next = new Set(current);
      if (isOpen) next.add(id);
      else next.delete(id);
      return next;
    });

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
    if (activeCat) {
      setOpenCategories((current) => {
        if (current.has(activeCat.id)) return current;
        const next = new Set(current);
        next.add(activeCat.id);
        return next;
      });
    }
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
      const [hasRoleResult, userRole] = await Promise.allSettled([
        supabase.rpc("is_admin", { _user_id: user.id }),
        supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
      ]);

      if (!active) return;

      const roleCandidates = [role, metadataRole, isAdminEmail(user.email) ? "admin" : null];

      if (hasRoleResult.status === "fulfilled" && hasRoleResult.value.data === true) {
        roleCandidates.push("admin");
      }
      if (userRole.status === "fulfilled" && userRole.value?.data?.role) {
        roleCandidates.push(String(userRole.value.data.role));
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

  // Libera o item "Afiliados" assim que existe uma solicitação enviada (ou uma
  // conta de afiliado já ativa). O evento cobre o envio feito no mesmo carregamento.
  useEffect(() => {
    if (!user?.id || !isSupabaseEnabled) {
      setHasAffiliateApplication(false);
      return;
    }

    let active = true;

    const resolveAffiliateApplication = async () => {
      const [applicationResult, affiliateResult] = await Promise.allSettled([
        supabase.from("affiliate_applications").select("agreed_terms").eq("user_id", user.id).maybeSingle(),
        supabase.from("affiliates").select("is_active").eq("user_id", user.id).maybeSingle(),
      ]);

      if (!active) return;

      const applied = applicationResult.status === "fulfilled" && applicationResult.value?.data?.agreed_terms === true;
      const isActiveAffiliate = affiliateResult.status === "fulfilled" && affiliateResult.value?.data?.is_active === true;
      setHasAffiliateApplication(applied || isActiveAffiliate);
    };

    void resolveAffiliateApplication();

    const handleApplicationSent = () => setHasAffiliateApplication(true);
    window.addEventListener(AFFILIATE_APPLICATION_EVENT, handleApplicationSent);

    return () => {
      active = false;
      window.removeEventListener(AFFILIATE_APPLICATION_EVENT, handleApplicationSent);
    };
  }, [user?.id]);

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

  useEffect(() => {
    setProfileMenuOpen(false);
  }, [location.pathname, location.search]);

  const planLabel = plan === "business" ? "BUSINESS" : plan === "pro" || plan === "plus" ? "PRO" : plan === "base" ? "BASE" : plan === "go" ? "GO" : "GRATIS";
  const normalizedPlan = plan === "plus" ? "pro" : plan;
  const trialTimeLeft = formatTrialTimeLeft(getTrialEndsAt(subscription), now);
  const showUpgradeCard = Boolean(trialTimeLeft) || !["base", "pro", "business"].includes(normalizedPlan);

  const closeProfileMenuNow = () => {
    flushSync(() => setProfileMenuOpen(false));
  };

  const handlePanelNavigate = (to: string) => {
    closeProfileMenuNow();
    navigate(to);
  };

  const handleSignOut = async () => {
    closeProfileMenuNow();
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <aside className="velo-dashboard-sidebar" style={styles.sidebar}>
      <style>{NAV_CSS}</style>
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

      <div className="velo-sidebar-scroll" style={styles.scrollArea}>
        <nav aria-label="Navegação principal" style={styles.nav}>
          {visibleNavItems.map((item) =>
            item.children ? (
              <SidebarCategory
                key={item.id}
                item={item}
                open={openCategories.has(item.id)}
                childActive={isChildActive(item)}
                onOpenChange={(nextOpen) => setCategoryOpen(item.id, nextOpen)}
                isActive={isActive}
                reduce={reduce}
              />
            ) : (
              <SidebarNavLink key={item.id} item={item} active={isActive(item)} reduce={reduce} />
            ),
          )}
        </nav>

      {/* Bloco inferior: segue a navegação no mesmo fluxo, evitando o vão
          artificial entre os links e o card de upgrade. */}
      <div style={styles.footer}>
        {showUpgradeCard && (
          <section aria-label={trialTimeLeft ? "Tempo restante do trial" : "Upgrade para Premium"} style={styles.upgradeCard}>
            <span style={styles.upgradeIcon} aria-hidden="true">
              <Trophy size={20} strokeWidth={2} />
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
            <PremiumActionButton type="button" onClick={() => upgradeModal.open()} style={styles.upgradeButton}>
              Fazer upgrade
            </PremiumActionButton>
          </section>
        )}
      </div>
      </div>

      {/* Daqui para baixo nada rola: é o rodapé âncora da sidebar. */}
      <div style={styles.fixedBottom}>
        {/* Linha "Feature Requests" da referência, adaptada à Velo como
            "Sugestões" (ideias e dicas da comunidade). */}
        <button
          type="button"
          onClick={() => navigate("/dashboard/sugestoes")}
          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", border: 0, background: "transparent", padding: "6px 9px", marginBottom: 7, cursor: "pointer", textAlign: "left", color: "#0A0A0A", borderRadius: 8 }}
        >
          <Lightbulb size={17} strokeWidth={2} aria-hidden="true" />
          <span style={{ fontSize: 14, lineHeight: "19px", fontWeight: 500, letterSpacing: "-0.02em" }}>Sugestões</span>
        </button>

        {/* "Comunidade e Ajuda" movido da lista principal para cá, logo abaixo de
            "Sugestões" e antes dos cards promocionais. Mesmo estilo de "Sugestões". */}
        <button
          type="button"
          onClick={() => navigate("/docs")}
          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", border: 0, background: "transparent", padding: "6px 9px", marginBottom: 7, cursor: "pointer", textAlign: "left", color: "#0A0A0A", borderRadius: 8 }}
        >
          <Info size={17} strokeWidth={2} aria-hidden="true" />
          <span style={{ fontSize: 14, lineHeight: "19px", fontWeight: 500, letterSpacing: "-0.02em" }}>Comunidade e Ajuda</span>
        </button>

        {/* Blocos finais ancorados no rodapé da sidebar, como na referência. */}
        <div style={styles.footerBottom}>
          <button type="button" onClick={() => setInviteOpen(true)} style={{ ...styles.promoCard, background: "#E8EFFF" }}>
            <span style={{ ...styles.promoIcon, background: "#D6E4FF", color: "#2563EB" }} aria-hidden="true">
              <Gift size={20} strokeWidth={2} />
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ ...styles.promoTitle, fontSize: 14, fontWeight: 500 }}>Indique e ganhe</span>
              <span style={styles.promoSub}>Ganhe 30% na primeira venda</span>
            </span>
          </button>

          <button type="button" onClick={() => navigate("/dashboard/paginas-com-ia")} style={{ ...styles.promoCard, background: "#E7F5EC" }}>
            <span style={{ ...styles.promoIcon, background: "#D6EEDF", color: "#16A34A" }} aria-hidden="true">
              <Sparkles size={20} strokeWidth={2} />
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ ...styles.promoTitle, fontSize: 14, fontWeight: 500 }}>Páginas com IA</span>
              <span style={styles.promoSub}>Crie páginas em minutos</span>
            </span>
          </button>

          <div ref={profileMenuRef} style={styles.profileWrap}>
          <button
            type="button"
            aria-label="Abrir configurações da conta"
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

        <AnimatePresence>
          {profileMenuOpen ? (
            <motion.div
              key="profile-side-panel"
              style={styles.profileSidePanel}
              role="menu"
              aria-label="Opções da conta"
              initial={reduce ? false : { opacity: 0, x: -8, scale: 0.985 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, x: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: -6, scale: 0.99 }}
              transition={reduce ? { duration: 0 } : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <button
                className="velo-profile-menu-row"
                type="button"
                role="menuitem"
                onClick={() => handlePanelNavigate("/dashboard/configuracoes")}
                style={styles.profileMenuRow}
              >
                <span style={styles.profileMenuRowLeft}>
                  <Settings2 size={15} strokeWidth={2} style={styles.profileMenuIcon} />
                  <span style={styles.profileMenuLabel}>Configurações</span>
                </span>
              </button>

              <button
                className="velo-profile-menu-row"
                type="button"
                role="menuitem"
                onClick={() => handlePanelNavigate("/dashboard/configuracoes?tab=Plano")}
                style={styles.profileMenuRow}
              >
                <span style={styles.profileMenuRowLeft}>
                  <CreditCard size={15} strokeWidth={1.9} style={styles.profileMenuIcon} />
                  <span style={styles.profileMenuLabel}>Assinatura</span>
                </span>
                <span style={plan === "gratis" ? styles.profilePanelMutedBadge : styles.profilePanelBadge}>
                  {plan !== "gratis" ? <Sparkles size={10} strokeWidth={2.2} /> : null}
                  {planLabel}
                </span>
              </button>

              <button
                className="velo-profile-menu-row"
                type="button"
                role="menuitem"
                onClick={() => handlePanelNavigate("/docs")}
                style={styles.profileMenuRow}
              >
                <span style={styles.profileMenuRowLeft}>
                  <Info size={15} strokeWidth={2} style={styles.profileMenuIcon} />
                  <span style={styles.profileMenuLabel}>Central de ajuda</span>
                </span>
              </button>

              {isAdmin ? (
                <button
                  className="velo-profile-menu-row"
                  type="button"
                  role="menuitem"
                  onClick={() => handlePanelNavigate("/admin/painel")}
                  style={styles.profileMenuRow}
                >
                  <span style={styles.profileMenuRowLeft}>
                    <ShieldCheck size={15} strokeWidth={2} style={styles.profileMenuIcon} />
                    <span style={styles.profileMenuLabel}>Painel Admin</span>
                  </span>
                </button>
              ) : null}

              <div style={styles.profileMenuDivider} />

              <button
                className="velo-profile-menu-row"
                type="button"
                role="menuitem"
                onClick={() => void handleSignOut()}
                style={styles.profileMenuRow}
              >
                <span style={styles.profileMenuRowLeft}>
                  <LogOut size={15} strokeWidth={2} style={{ ...styles.profileMenuIcon, color: "#DC2626" }} />
                  <span style={{ ...styles.profileMenuLabel, color: "#DC2626" }}>Sair</span>
                </span>
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
