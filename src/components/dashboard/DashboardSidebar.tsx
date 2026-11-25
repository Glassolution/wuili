import { useEffect, useMemo, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CreditCard, LogOut, Settings2, ShieldCheck, Sparkles, Trophy, UserRound } from "lucide-react";
// Hugeicons Stroke Rounded (traço 1.5), os mesmos ícones da referência "Mova".
import { ArrowUp01Icon, ChartIncreaseIcon, File01Icon, Folder01Icon, Home01Icon, MoreVerticalIcon, PlusSignIcon, ShoppingBag01Icon, SidebarLeftIcon, Store01Icon, TaskDone01Icon, UserGroupIcon } from "hugeicons-react";
import { useQuery } from "@tanstack/react-query";
import { fetchUserProjects, type UserProject } from "@/lib/userProjects";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/lib/profileContext";
import { isSupabaseEnabled, supabase } from "@/integrations/supabase/client";
import { isAdminEmail } from "@/lib/adminAccess";
import { AFFILIATE_APPLICATION_EVENT } from "@/pages/dashboard/AffiliateQuizPage";
import SearchPalette from "@/components/dashboard/SearchPalette";
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
  children?: NavItem[];
};

// Seção "Principal": telas do dia a dia, sem agrupamento (como "Main" da referência).
const mainNavItems: NavItem[] = [
  { id: "inicio", label: "Início", icon: Home01Icon, to: "/dashboard", end: true },
  { id: "pedidos", label: "Pedidos", icon: TaskDone01Icon, to: "/dashboard/pedidos" },
  { id: "publicacoes", label: "Publicações", icon: File01Icon, to: "/dashboard/publicacoes" },
  // Catálogo e Produtos em alta vieram do antigo "Espaço de trabalho" (24/11/2026).
  { id: "catalogo", label: "Catálogo", icon: ShoppingBag01Icon, to: "/dashboard/catalogo" },
  { id: "produtos-em-alta", label: "Produtos em alta", icon: ChartIncreaseIcon, to: "/dashboard/produtos-em-alta" },
  // Imagens com IA e Avatares saíram do menu (24/11/2026, a pedido do dono); as
  // rotas /dashboard/imagens-ia e /dashboard/avatares continuam funcionando.
  // { id: "cursos-ecommerce", label: "Cursos Ecommerce", icon: GraduationCap, to: "/dashboard/cursos-ecommerce" },
];

// Seção "Espaço de trabalho": cada workspace é um projeto (loja) da pessoa, com o
// logo e o nome dele. Ao abrir, mostra as pastas com as áreas da loja.
// Páginas com IA e Templates (antes no grupo Produtos) saíram do menu; as rotas
// /dashboard/paginas-com-ia e /dashboard/modelos continuam no ar.
const MAX_WORKSPACES = 5;
type PastaWorkspace = { id: string; label: string; to?: string };
const PASTAS_WORKSPACE: PastaWorkspace[] = [
  { id: "site", label: "Site" },
  { id: "produtos", label: "Produtos", to: "/dashboard/catalogo" },
  { id: "pedidos", label: "Pedidos", to: "/dashboard/pedidos" },
  { id: "agentes", label: "Agentes", to: "/dashboard/projetos" },
];
// Cores do logo de letra, para o workspace que ainda não tem logo da loja.
const CORES_WORKSPACE = ["#F0507A", "#3B82F6", "#0F5132", "#7C5CFA", "#F08A24", "#0E9F6E"];
const corDoWorkspace = (id: string) => {
  let soma = 0;
  for (const letra of id) soma = (soma + letra.charCodeAt(0)) % 9973;
  return CORES_WORKSPACE[soma % CORES_WORKSPACE.length];
};
const logoDoProjeto = (projeto: UserProject) => {
  const metadata = projeto.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const logo = (metadata as Record<string, unknown>).logoImage;
  return typeof logo === "string" && logo.trim() ? logo : null;
};
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
const storesNavItem: NavItem = { id: "lojas", label: "Lojas", icon: Store01Icon, to: "/dashboard/integracoes" };

const affiliatesNavItem: NavItem = { id: "afiliados", label: "Afiliados", icon: UserGroupIcon, to: "/dashboard/comissoes", dimmed: true };

const normalizePath = (path: string) => path.split("?")[0].replace(/\/$/, "");

// Transição do "sliding highlight" (pill do item ativo) e do submenu.
const PILL_EASE = [0.4, 0, 0.2, 1] as const;

// Hover/foco dos itens (inline styles não fazem :hover, então injetamos CSS).
const NAV_CSS = `
.velo-dashboard-sidebar.velo-fonte-inter, .velo-dashboard-sidebar.velo-fonte-inter * { font-feature-settings: normal !important; }
.velo-nav-item, .velo-nav-sub { transition: background-color 150ms ease-out, color 150ms ease-out; }
.velo-nav-item:hover:not([data-active="true"]) { background-color: #EFEFF1; }
.velo-nav-sub:hover:not([data-active="true"]) { background-color: #EFEFF1; }
.velo-nav-add { transition: color 150ms ease-out; }
.velo-nav-add:hover { color: #3F3F46; }
.velo-side-toggle { transition: background-color 150ms ease-out, color 150ms ease-out; }
.velo-side-toggle:hover { background-color: #EFEFF1; color: #0B0D12; }
.velo-nav-item:focus-visible, .velo-nav-sub:focus-visible, .velo-nav-add:focus-visible, .velo-side-toggle:focus-visible, .velo-side-card:focus-visible { outline: none; box-shadow: 0 0 0 2px #2F5BEA33, inset 0 0 0 1px #2F5BEA; }
.velo-side-card { transition: border-color 150ms ease-out, background-color 150ms ease-out; }
.velo-side-card:hover { border-color: #DEDEE1; background-color: #FFFFFF; }
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
  "Produtos em alta": "produtos-em-alta",
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
    style={{ width: 28, height: 28, objectFit: "contain", flexShrink: 0, display: "block" }}
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
      boxShadow: "0 1px 2px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)",
    }}
  />
);

// Logo redondo do workspace: o logo da loja (metadata.logoImage) ou, sem ele,
// a inicial do nome num círculo colorido, como os logos da referência.
const LogoWorkspace = ({ projeto }: { projeto: UserProject }) => {
  const [falhou, setFalhou] = useState(false);
  const logo = falhou ? null : logoDoProjeto(projeto);
  const base: CSSProperties = { width: 20, height: 20, flexShrink: 0, borderRadius: 999, overflow: "hidden" };
  if (logo) {
    return (
      <img
        src={logo}
        alt=""
        aria-hidden="true"
        draggable={false}
        onError={() => setFalhou(true)}
        style={{ ...base, objectFit: "cover", background: "#FFFFFF", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)" }}
      />
    );
  }
  const inicial = (projeto.nome || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      aria-hidden="true"
      style={{
        ...base,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: corDoWorkspace(projeto.id),
        color: "#FFFFFF",
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      {inicial}
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
    color: active ? "#18181B" : "#3F3F46",
    fontWeight: active ? 500 : 400,
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
      {leading ?? (
        <Icon
          className="velo-nav-ico"
          size={sub ? 16 : 18}
          strokeWidth={1.5}
          color={sub ? "#71717A" : "#52525B"}
          aria-hidden="true"
        />
      )}
      {recolhida ? null : <span style={rotuloStyle}>{item.label}</span>}
    </Link>
  );
};

// Grupo do "Espaço de trabalho": logo colorido + nome; ao clicar abre/fecha os
// subitens logo abaixo, recuados e com ícone de pasta (como na referência).
const SidebarCategory = ({
  item,
  logo,
  open,
  childActive,
  onOpenChange,
  reduce,
  recolhida,
  children,
}: {
  item: { id: string; label: string };
  logo: ReactNode;
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
    color: "#3F3F46",
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
        {logo}
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

  const [openCategories, setOpenCategories] = useState<Set<string>>(() => new Set());
  const [recolhida, setRecolhida] = useState(lerRecolhida);
  const [espacoAberto, setEspacoAberto] = useState(true);
  // Mesma leitura da Início e da página Projetos (RPC get_user_projects), sem consulta nova.
  const projetosQuery = useQuery({
    queryKey: ["home-projetos-da-loja", user?.id],
    enabled: Boolean(user?.id),
    staleTime: 60_000,
    queryFn: fetchUserProjects,
  });
  const projetosOrdenados = useMemo(
    () =>
      [...(projetosQuery.data ?? [])].sort(
        (a, b) => new Date(b.updated_at ?? b.created_at).getTime() - new Date(a.updated_at ?? a.created_at).getTime(),
      ),
    [projetosQuery.data],
  );
  const workspaces = projetosOrdenados.slice(0, MAX_WORKSPACES);
  // O workspace mais recente já vem aberto, uma vez, quando a lista chega.
  const primeiroAberto = useRef(false);
  useEffect(() => {
    if (primeiroAberto.current || workspaces.length === 0) return;
    primeiroAberto.current = true;
    setOpenCategories((atual) => new Set(atual).add(workspaces[0].id));
  }, [workspaces]);
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

  const setCategoryOpen = (id: string, isOpen: boolean) =>
    setOpenCategories((current) => {
      const next = new Set(current);
      if (isOpen) next.add(id);
      else next.delete(id);
      return next;
    });

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
      className="velo-dashboard-sidebar velo-fonte-inter"
      data-recolhida={recolhida ? "true" : "false"}
      style={{
        ...styles.sidebar,
        width: recolhida ? 72 : styles.sidebar.width,
        ...(recolhida ? { padding: "0 12px 16px" } : null),
      }}
    >
      <style>{NAV_CSS}</style>
      {/* Topo: marca e botão de recolher, com filete embaixo (como na referência). */}
      <header style={{ ...styles.header, justifyContent: recolhida ? "center" : "space-between", ...(recolhida ? { padding: "0 14px" } : null) }}>
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
          <SidebarLeftIcon size={18} strokeWidth={1.5} color="#A1A1AA" aria-hidden="true" />
        </button>
      </header>

      {/* Barra de busca removida da sidebar. A paleta de busca continua
          acessível pelo atalho de teclado "/". */}
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} isAdmin={isAdmin} />

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
                  <ArrowUp01Icon
                    size={14}
                    strokeWidth={1.5}
                    color="#A1A1AA"
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
              {workspaces.map((projeto) => (
                <SidebarCategory
                  key={projeto.id}
                  item={{ id: `workspace-${projeto.id}`, label: projeto.nome }}
                  logo={<LogoWorkspace projeto={projeto} />}
                  open={openCategories.has(projeto.id)}
                  childActive={false}
                  onOpenChange={(aberto) => {
                    if (recolhida) {
                      abrirProjeto(projeto);
                      return;
                    }
                    setCategoryOpen(projeto.id, aberto);
                  }}
                  reduce={reduce}
                  recolhida={recolhida}
                >
                  {PASTAS_WORKSPACE.map((pasta) => (
                    <button
                      key={pasta.id}
                      type="button"
                      onClick={() => (pasta.to ? navigate(pasta.to) : abrirProjeto(projeto))}
                      className="velo-nav-sub"
                      title={`${pasta.label} · ${projeto.nome}`}
                      style={{ ...styles.navSubLinkBase, width: "100%", border: 0, background: "transparent", cursor: "pointer", textAlign: "left", color: "#3F3F46" }}
                    >
                      <Folder01Icon className="velo-nav-ico" size={18} strokeWidth={1.5} color="#52525B" aria-hidden="true" />
                      <span style={rotuloStyle}>{pasta.label}</span>
                    </button>
                  ))}
                </SidebarCategory>
              ))}

              {recolhida ? null : (
                <>
                  {projetosOrdenados.length > MAX_WORKSPACES && (
                    <button type="button" onClick={() => navigate("/dashboard/minha-loja")} className="velo-nav-add" style={styles.navAdd}>
                      <Folder01Icon size={16} strokeWidth={1.5} aria-hidden="true" />
                      Ver todos os projetos
                    </button>
                  )}
                  {/* Cria um workspace (projeto) pelo criador que já existe, com nome e logo. */}
                  <button
                    type="button"
                    onClick={() => navigate("/dashboard/minha-loja", { state: { abrirCriacao: true } })}
                    className="velo-nav-add"
                    style={styles.navAdd}
                  >
                    <PlusSignIcon size={16} strokeWidth={1.5} aria-hidden="true" />
                    Adicionar workspace
                  </button>
                </>
              )}
            </>
          )}

          {/* Seção "Suporte" (Comunidade e Ajuda, Indique e ganhe) saiu da sidebar por
              enquanto (24/11/2026): vai para outro lugar. /dashboard/comunidade segue no ar. */}
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
                  <MoreVerticalIcon size={16} strokeWidth={1.5} color="#A1A1AA" />
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
