import { useEffect, useMemo, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Archive, ChevronUp, Image as ImageIcon, ClipboardList, CreditCard, Folder, FolderOpen, Gift, Grid2X2, Home, Info, LogOut, MoreVertical, NotebookText, PanelLeft, Plus, ScanFace, Settings2, ShieldCheck, ShoppingCart, Store, Sparkles, Tag, TrendingUp, Trophy, UserRound, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchUserProjects, type UserProject } from "@/lib/userProjects";
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
import { ABRIR_BUSCA_EVENT } from "@/lib/abrirBusca";
import { useSandboxMode } from "@/lib/sandboxMode";
import { bestAccessSubscription, resolveAccessPlan } from "@/lib/subscriptionAccess";

type NavItem = {
  id: string;
  label: string;
  icon: ElementType;
  to?: string;
  end?: boolean;
  dimmed?: boolean;
  /** Cor do logo redondo dos grupos do "Espaço de trabalho". */
  cor?: string;
  children?: NavItem[];
};

// Seção "Principal": telas do dia a dia, sem agrupamento (como "Main" da referência).
const mainNavItems: NavItem[] = [
  { id: "inicio", label: "Início", icon: Home, to: "/dashboard", end: true },
  { id: "pedidos", label: "Pedidos", icon: ClipboardList, to: "/dashboard/pedidos" },
  { id: "publicacoes", label: "Publicações", icon: Archive, to: "/dashboard/publicacoes" },
  { id: "imagens-ia", label: "Imagens com IA", icon: ImageIcon, to: "/dashboard/imagens-ia" },
  { id: "avatares", label: "Avatares", icon: ScanFace, to: "/dashboard/avatares" },
  // { id: "cursos-ecommerce", label: "Cursos Ecommerce", icon: GraduationCap, to: "/dashboard/cursos-ecommerce" },
];

// Seção "Espaço de trabalho": grupos com logo colorido e subitens (como os
// workspaces da referência). Os subitens de Projetos são os projetos reais.
const produtosGroup: NavItem = {
  id: "produtos",
  label: "Produtos",
  icon: Tag,
  cor: "#2F5BEA",
  children: [
    { id: "catalogo", label: "Catálogo", icon: ShoppingCart, to: "/dashboard/catalogo" },
    { id: "paginas-com-ia", label: "Páginas com IA", icon: NotebookText, to: "/dashboard/paginas-com-ia" },
    { id: "modelos", label: "Templates", icon: Grid2X2, to: "/dashboard/modelos" },
  ],
};
const vencedoresGroup: NavItem = {
  id: "produtos-vencedores",
  label: "Produtos vencedores",
  icon: Trophy,
  cor: "#F08A24",
  children: [{ id: "produtos-em-alta", label: "Produtos em Alta", icon: TrendingUp, to: "/dashboard/produtos-em-alta" }],
};
const projetosItem: NavItem = { id: "projetos", label: "Projetos", icon: FolderOpen, to: "/dashboard/projetos", cor: "#0E9F6E" };

// Quantos projetos aparecem como subitens; o resto fica na página Projetos.
const MAX_PROJETOS_NA_SIDEBAR = 3;
const SIDEBAR_RECOLHIDA_KEY = "velo:sidebar:recolhida";
const lerRecolhida = () => {
  try {
    return window.localStorage.getItem(SIDEBAR_RECOLHIDA_KEY) === "1";
  } catch {
    return false;
  }
};

// "Lojas": conectar/gerenciar lojas (Shopify, Mercado Livre) — leva à tela de
// integrações. Fora da navegação por enquanto: só administradores veem o item.
// A ROTA continua aberta de propósito — o callback do Mercado Pago devolve o
// usuário em /dashboard/integracoes, e bloqueá-la quebraria a conexão de
// pagamento de quem não é admin.
const storesNavItem: NavItem = { id: "lojas", label: "Lojas", icon: Store, to: "/dashboard/integracoes" };

const affiliatesNavItem: NavItem = { id: "afiliados", label: "Afiliados", icon: Users, to: "/dashboard/comissoes", dimmed: true };

const normalizePath = (path: string) => path.split("?")[0].replace(/\/$/, "");

// Transição do "sliding highlight" (pill do item ativo) e do submenu.
const PILL_EASE = [0.4, 0, 0.2, 1] as const;

// Hover/foco dos itens (inline styles não fazem :hover, então injetamos CSS).
const NAV_CSS = `
.velo-nav-item, .velo-nav-sub { transition: background-color 150ms ease-out, color 150ms ease-out; }
.velo-nav-item:hover:not([data-active="true"]) { background-color: #EFEFF1; color: #0B0D12; }
.velo-nav-sub:hover:not([data-active="true"]) { background-color: #EFEFF1; color: #0B0D12; }
.velo-nav-add { transition: color 150ms ease-out; }
.velo-nav-add:hover { color: #0B0D12; }
.velo-side-toggle { transition: background-color 150ms ease-out, color 150ms ease-out; }
.velo-side-toggle:hover { background-color: #EFEFF1; color: #0B0D12; }
.velo-nav-item:focus-visible, .velo-nav-sub:focus-visible, .velo-nav-add:focus-visible, .velo-side-toggle:focus-visible, .velo-side-card:focus-visible { outline: none; box-shadow: 0 0 0 2px #2F5BEA33, inset 0 0 0 1px #2F5BEA; }
.velo-side-card { transition: border-color 150ms ease-out, background-color 150ms ease-out; }
.velo-side-card:hover { border-color: #DCE0E7; background-color: #FFFFFF; }
.velo-nav-ico { transition: transform 150ms ease-out; }

.velo-settings-row { transition: background-color 140ms ease-out; }
.velo-settings-row:hover { background-color: rgba(10,10,10,0.05); }
.velo-profile-menu-row { transition: background-color 140ms ease-out, transform 140ms ease-out; }
.velo-profile-menu-row:hover { background-color: rgba(10,10,10,0.045); }
.velo-sidebar-scroll {
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}
/* Barra de rolagem some até o mouse passar pela sidebar (a referência não mostra). */
.velo-sidebar-scroll:hover { scrollbar-color: rgba(10,10,10,0.18) transparent; }
.velo-sidebar-scroll::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.velo-sidebar-scroll::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 999px;
}
.velo-sidebar-scroll::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 999px;
}
.velo-sidebar-scroll:hover::-webkit-scrollbar-thumb { background: rgba(10,10,10,0.18); }
.velo-sidebar-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(10,10,10,0.28);
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
  Projetos: "projetos",
  Catálogo: "catalogo",
  "Produtos em Alta": "produtos-em-alta",
  Publicações: "publicacoes",
  Pedidos: "pedidos",
  "Imagens com IA": "imagens-ia",
  "Cursos Ecommerce": "cursos-ecommerce",
  Configurações: "configuracoes",
  "Minha loja": "minha-loja",
  "Páginas com IA": "paginas-com-ia",
  Avatares: "avatares",
  Templates: "modelos",
};

type SidebarSubscription = {
  plan: string | null;
  status: string | null;
  provider?: string | null;
  is_trial: boolean | null;
  trial_ends_at: string | null;
  current_period_end?: string | null;
  purchase_kind?: string | null;
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
      borderRadius: 10,
      background: "#FFFFFF",
      boxShadow: "0 1px 2px rgba(16,24,40,0.06), 0 0 0 1px rgba(16,24,40,0.05)",
    }}
  />
);

// Logo redondo colorido dos grupos do "Espaço de trabalho".
const LogoGrupo = ({ item }: { item: NavItem }) => {
  const Icon = item.icon;
  return (
    <span
      aria-hidden="true"
      style={{
        width: 20,
        height: 20,
        flexShrink: 0,
        borderRadius: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: item.cor,
        color: "#FFFFFF",
      }}
    >
      <Icon size={11} strokeWidth={2.2} />
    </span>
  );
};

const rotuloStyle: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

const SidebarNavLink = ({
  item,
  active,
  sub = false,
  reduce,
  recolhida = false,
  leading,
}: {
  item: NavItem;
  active: boolean;
  sub?: boolean;
  reduce: boolean;
  recolhida?: boolean;
  leading?: ReactNode;
}) => {
  const Icon = item.icon;
  const linkStyle: CSSProperties = {
    ...(sub ? styles.navSubLinkBase : styles.navLinkBase),
    position: "relative",
    isolation: "isolate",
    color: active ? "#0B0D12" : "#2B2F36",
    ...(recolhida ? { justifyContent: "center", padding: 0 } : null),
  };

  return (
    <Link
      to={item.to!}
      aria-current={active ? "page" : undefined}
      aria-label={recolhida ? item.label : undefined}
      title={recolhida ? item.label : undefined}
      data-active={active ? "true" : "false"}
      data-dashboard-tour={tourTargetByLabel[item.label]}
      className={sub ? "velo-nav-sub" : "velo-nav-item"}
      style={linkStyle}
    >
      {active ? <ActivePill sub={sub} reduce={reduce} /> : null}
      {leading ?? <Icon className="velo-nav-ico" size={sub ? 17 : 18} strokeWidth={1.5} aria-hidden="true" />}
      {recolhida ? null : <span style={rotuloStyle}>{item.label}</span>}
    </Link>
  );
};

// Grupo do "Espaço de trabalho": logo colorido + nome; ao clicar abre/fecha os
// subitens logo abaixo, recuados e com ícone de pasta (como na referência).
const SidebarCategory = ({
  item,
  open,
  childActive,
  onOpenChange,
  reduce,
  recolhida,
  children,
}: {
  item: NavItem;
  open: boolean;
  childActive: boolean;
  onOpenChange: (open: boolean) => void;
  reduce: boolean;
  recolhida: boolean;
  children: ReactNode;
}) => {
  const submenuId = `sidebar-submenu-${item.id}`;
  const btnStyle: CSSProperties = {
    ...styles.navLinkBase,
    width: "100%",
    border: 0,
    cursor: "pointer",
    textAlign: "left",
    position: "relative",
    isolation: "isolate",
    color: "#2B2F36",
    background: "transparent",
    ...(recolhida ? { justifyContent: "center", padding: 0 } : null),
  };

  return (
    // O submenu fica sempre no DOM e é colapsado por CSS Grid (0fr -> 1fr),
    // empurrando os itens de baixo em vez de sobrepor.
    <div>
      <button
        type="button"
        data-active={recolhida && childActive ? "true" : "false"}
        aria-expanded={recolhida ? undefined : open}
        aria-controls={recolhida ? undefined : submenuId}
        aria-label={recolhida ? item.label : undefined}
        title={recolhida ? item.label : undefined}
        data-dashboard-tour={item.id}
        className="velo-nav-item"
        onClick={() => onOpenChange(!open)}
        style={btnStyle}
      >
        {recolhida && childActive ? <ActivePill reduce={reduce} /> : null}
        <LogoGrupo item={item} />
        {recolhida ? null : <span style={rotuloStyle}>{item.label}</span>}
      </button>
      {recolhida ? null : (
        <div id={submenuId} className="velo-collapsible" data-state={open ? "open" : "closed"}>
          <div className="velo-collapsible-inner">
            <div style={styles.subWrap}>{children}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const SectionLabel = ({ children, action }: { children: ReactNode; action?: ReactNode }) => (
  <div style={styles.sectionLabel}>
    <span>{children}</span>
    {action}
  </div>
);

const DashboardSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const upgradeModal = useUpgradeModal();
  const { user, signOut, role } = useAuth();
  const { nome, foto } = useProfile();
  const [sandboxEnabled] = useSandboxMode(user?.id ?? user?.email ?? null);
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
  const metadataRole =
    (user?.app_metadata?.role as string | undefined) ??
    (user?.user_metadata?.role as string | undefined) ??
    null;
  const sandboxIdentityEnabled =
    sandboxEnabled && (role === "admin" || metadataRole === "admin" || isAdminEmail(user?.email));
  const visibleProfileName = sandboxIdentityEnabled ? "Conta Sandbox" : profileName;
  const visibleProfileEmail = sandboxIdentityEnabled ? "sandbox@velo.test" : profileEmail;

  const [openCategories, setOpenCategories] = useState<Set<string>>(() => new Set(["projetos"]));
  const [recolhida, setRecolhida] = useState(lerRecolhida);
  const [espacoAberto, setEspacoAberto] = useState(true);
  // Mesma leitura da Início e da página Projetos (RPC get_user_projects), sem consulta nova.
  const projetosQuery = useQuery({
    queryKey: ["home-projetos-da-loja", user?.id],
    enabled: Boolean(user?.id),
    staleTime: 60_000,
    queryFn: fetchUserProjects,
  });
  const projetosRecentes = useMemo(
    () =>
      [...(projetosQuery.data ?? [])]
        .sort((a, b) => new Date(b.updated_at ?? b.created_at).getTime() - new Date(a.updated_at ?? a.created_at).getTime())
        .slice(0, MAX_PROJETOS_NA_SIDEBAR),
    [projetosQuery.data],
  );
  const alternarRecolhida = () =>
    setRecolhida((atual) => {
      const proxima = !atual;
      try {
        window.localStorage.setItem(SIDEBAR_RECOLHIDA_KEY, proxima ? "1" : "0");
      } catch {
        // Sem armazenamento: vale só nesta visita.
      }
      return proxima;
    });
  const abrirProjeto = (projeto: UserProject) =>
    navigate(`/minha-loja/editor/${projeto.id}`, { state: { projectId: projeto.id, sourceId: projeto.source_id } });

  useEffect(() => {
    setProfileMenuOpen(false);
  }, [location.pathname, location.search]);

  const visibleNavItems = useMemo(() => {
    const items = [...mainNavItems];
    if (isAdmin || hasAffiliateApplication) {
      // Ancorado pelo vizinho, e não por índice fixo: reordenar a lista não
      // deve arrastar "Afiliados" para outro ponto sem querer.
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
    const activeCat = [produtosGroup, vencedoresGroup].find((i) =>
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
    const abrirBusca = () => setSearchOpen(true);
    window.addEventListener("keydown", handler);
    window.addEventListener(ABRIR_BUSCA_EVENT, abrirBusca);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener(ABRIR_BUSCA_EVENT, abrirBusca);
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    let active = true;

    supabase
        .from("subscriptions")
        .select("plan,status,provider,purchase_kind,is_trial,trial_ends_at,current_period_end,next_charge_at,updated_at,created_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .then((subscriptionResult) => {
        if (!active) return;
        if (subscriptionResult.error) return;

        const subscriptions = (subscriptionResult.data ?? []) as SidebarSubscription[];
        const currentSubscription = bestAccessSubscription(subscriptions) ?? null;
        setSubscription(currentSubscription);

        if (active) setPlan(resolveAccessPlan(subscriptions));
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
  const profileMenuPlanLabel = sandboxIdentityEnabled ? "SANDBOX" : planLabel;
  const profileMenuPlanStyle =
    sandboxIdentityEnabled ? styles.profilePanelSandboxBadge : plan === "gratis" ? styles.profilePanelMutedBadge : styles.profilePanelBadge;
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
    <aside
      className="velo-dashboard-sidebar"
      data-recolhida={recolhida ? "true" : "false"}
      style={{ ...styles.sidebar, width: recolhida ? 72 : styles.sidebar.width, ...(recolhida ? { padding: "0 12px 16px" } : null) }}
    >
      <style>{NAV_CSS}</style>
      {/* Topo: marca e botão de recolher, com filete embaixo (como na referência). */}
      <header style={{ ...styles.header, justifyContent: recolhida ? "center" : "space-between", ...(recolhida ? { margin: "0 -12px", padding: "0 14px 0 22px" } : null) }}>
        {recolhida ? null : (
          <Link to="/dashboard" style={styles.brand}>
            <VeloIconOnly />
            <span style={styles.brandText}>Velo</span>
          </Link>
        )}
        <button
          type="button"
          onClick={alternarRecolhida}
          aria-label={recolhida ? "Expandir barra lateral" : "Recolher barra lateral"}
          title={recolhida ? "Expandir" : "Recolher"}
          className="velo-side-toggle"
          style={styles.collapseButton}
        >
          <PanelLeft size={18} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </header>

      {/* Barra de busca removida da sidebar. A paleta de busca continua
          acessível pelo atalho de teclado "/". */}
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} isAdmin={isAdmin} />
      <InviteFriendModal open={inviteOpen} onClose={() => setInviteOpen(false)} />

      <div className="velo-sidebar-scroll" style={styles.scrollArea}>
        <nav aria-label="Navegação principal" style={styles.nav}>
          {recolhida ? null : <SectionLabel>Principal</SectionLabel>}
          {visibleNavItems.map((item) => (
            <SidebarNavLink key={item.id} item={item} active={isActive(item)} reduce={reduce} recolhida={recolhida} />
          ))}

          <div style={styles.sectionDivider} />

          {recolhida ? null : (
            <SectionLabel
              action={
                <button
                  type="button"
                  onClick={() => setEspacoAberto((aberto) => !aberto)}
                  aria-label={espacoAberto ? "Recolher espaço de trabalho" : "Mostrar espaço de trabalho"}
                  aria-expanded={espacoAberto}
                  className="velo-side-toggle"
                  style={styles.sectionToggle}
                >
                  <ChevronUp
                    size={15}
                    strokeWidth={1.75}
                    aria-hidden="true"
                    style={{ transform: espacoAberto ? "none" : "rotate(180deg)", transition: reduce ? "none" : "transform 200ms ease-out" }}
                  />
                </button>
              }
            >
              Espaço de trabalho
            </SectionLabel>
          )}
          {(espacoAberto || recolhida) && (
            <>
              <SidebarCategory
                item={projetosItem}
                open={openCategories.has("projetos")}
                childActive={isActive(projetosItem)}
                onOpenChange={(aberto) => {
                  if (recolhida) {
                    navigate("/dashboard/projetos");
                    return;
                  }
                  setCategoryOpen("projetos", aberto);
                }}
                reduce={reduce}
                recolhida={recolhida}
              >
                <SidebarNavLink
                  item={{ id: "projetos-todos", label: "Todos os projetos", icon: Folder, to: "/dashboard/projetos" }}
                  active={isActive(projetosItem)}
                  sub
                  reduce={reduce}
                />
                {projetosRecentes.map((projeto) => (
                  <button
                    key={projeto.id}
                    type="button"
                    onClick={() => abrirProjeto(projeto)}
                    className="velo-nav-sub"
                    title={projeto.nome}
                    style={{ ...styles.navSubLinkBase, width: "100%", border: 0, background: "transparent", cursor: "pointer", textAlign: "left", color: "#2B2F36" }}
                  >
                    <Folder className="velo-nav-ico" size={17} strokeWidth={1.5} aria-hidden="true" />
                    <span style={rotuloStyle}>{projeto.nome}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => navigate("/dashboard/minha-loja")}
                  className="velo-nav-add"
                  style={styles.navAdd}
                >
                  <Plus size={15} strokeWidth={1.6} aria-hidden="true" />
                  Novo projeto
                </button>
              </SidebarCategory>

              {[produtosGroup, vencedoresGroup].map((grupo) => (
                <SidebarCategory
                  key={grupo.id}
                  item={grupo}
                  open={openCategories.has(grupo.id)}
                  childActive={isChildActive(grupo)}
                  onOpenChange={(aberto) => {
                    if (recolhida) {
                      navigate(grupo.children![0].to!);
                      return;
                    }
                    setCategoryOpen(grupo.id, aberto);
                  }}
                  reduce={reduce}
                  recolhida={recolhida}
                >
                  {grupo.children!.map((child) => (
                    <SidebarNavLink key={child.id} item={child} active={isActive(child)} sub reduce={reduce} />
                  ))}
                </SidebarCategory>
              ))}
            </>
          )}

          <div style={styles.sectionDivider} />

          {recolhida ? null : <SectionLabel>Suporte</SectionLabel>}
          {/* A Central de Ajuda (/ajuda) não aparece em menus: só por link direto. */}
          <SidebarNavLink
            item={{ id: "comunidade", label: "Comunidade e Ajuda", icon: Info, to: "/dashboard/comunidade" }}
            active={isActive({ id: "comunidade", label: "", icon: Info, to: "/dashboard/comunidade" })}
            reduce={reduce}
            recolhida={recolhida}
          />
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="velo-nav-item"
            aria-label={recolhida ? "Indique e ganhe" : undefined}
            title={recolhida ? "Indique e ganhe" : "Ganhe 30% na primeira venda"}
            style={{ ...styles.navLinkBase, width: "100%", border: 0, background: "transparent", cursor: "pointer", textAlign: "left", color: "#2B2F36", ...(recolhida ? { justifyContent: "center", padding: 0 } : null) }}
          >
            <Gift className="velo-nav-ico" size={18} strokeWidth={1.5} aria-hidden="true" />
            {recolhida ? null : <span style={rotuloStyle}>Indique e ganhe</span>}
          </button>
        </nav>

      {/* Bloco inferior: segue a navegação no mesmo fluxo, evitando o vão
          artificial entre os links e o card de upgrade. */}
      <div style={styles.footer}>
        {showUpgradeCard && !recolhida && (
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

      {/* Daqui para baixo nada rola: é o rodapé âncora da sidebar (conta). */}
      <div style={styles.fixedBottom}>
        <div style={styles.footerBottom}>
          <div ref={profileMenuRef} style={styles.profileWrap}>
          <button
            type="button"
            aria-label="Abrir configurações da conta"
            aria-haspopup="menu"
            aria-expanded={profileMenuOpen}
            onClick={() => setProfileMenuOpen((current) => !current)}
            className="velo-side-card"
            title={recolhida ? visibleProfileName : undefined}
            style={{ ...styles.profileCard, ...(recolhida ? { justifyContent: "center", padding: 8, minHeight: 48 } : null) }}
          >
            <span style={styles.avatar}>
              {foto && !avatarFailed && !sandboxIdentityEnabled ? (
                <img
                  src={foto}
                  alt=""
                  onError={() => setAvatarFailed(true)}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                sandboxIdentityEnabled ? (
                  <ShieldCheck size={17} strokeWidth={1.9} color="#2563EB" />
                ) : (
                  <UserRound size={17} strokeWidth={1.9} color="rgba(10,10,10,0.55)" />
                )
              )}
            </span>
            {recolhida ? null : (
              <>
                <span style={styles.profileText}>
                  <span style={styles.profileName}>{visibleProfileName}</span>
                  <span style={styles.profileEmail}>{visibleProfileEmail}</span>
                </span>
                <span aria-hidden="true" style={styles.profileChevrons}>
                  <MoreVertical size={16} strokeWidth={2} />
                </span>
              </>
            )}
          </button>

        <AnimatePresence>
          {profileMenuOpen ? (
            <motion.div
              key="profile-side-panel"
              style={{ ...styles.profileSidePanel, left: recolhida ? 82 : styles.profileSidePanel.left }}
              role="menu"
              aria-label="Opções da conta"
              initial={reduce ? false : { opacity: 0, x: -8, scale: 0.985 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, x: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: -6, scale: 0.99 }}
              transition={reduce ? { duration: 0 } : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <div style={styles.profileMenuIdentity} aria-hidden="true">
                <span style={{ ...styles.profileMenuAvatar, ...(sandboxIdentityEnabled ? styles.profileMenuSandboxAvatar : null) }}>
                  {sandboxIdentityEnabled ? (
                    <ShieldCheck size={15} strokeWidth={2.1} color="#FFFFFF" />
                  ) : foto && !avatarFailed ? (
                    <img
                      src={foto}
                      alt=""
                      onError={() => setAvatarFailed(true)}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <UserRound size={15} strokeWidth={1.9} color="rgba(10,10,10,0.55)" />
                  )}
                </span>
                <span style={styles.profileMenuIdentityText}>
                  <span style={styles.profileMenuIdentityName}>{visibleProfileName}</span>
                  <span style={styles.profileMenuIdentityEmail}>{visibleProfileEmail}</span>
                </span>
              </div>

              <div style={styles.profileMenuDivider} />

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
                <span style={profileMenuPlanStyle}>
                  {sandboxIdentityEnabled || plan !== "gratis" ? <Sparkles size={10} strokeWidth={2.2} /> : null}
                  {profileMenuPlanLabel}
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
