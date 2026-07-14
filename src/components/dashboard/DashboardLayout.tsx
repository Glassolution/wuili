import { Component, useEffect, useState, type ReactNode } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { veloToast } from "@/components/ui/velo-toast";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import StartModeBanner from "@/components/dashboard/StartModeBanner";
import StartModeModal from "@/components/dashboard/StartModeModal";
import NotificacoesPopover from "@/components/dashboard/NotificacoesPopover";
import FirstStoreOnboarding, {
  MAX_STORES_PER_USER,
  hasCompletedStoreOnboarding,
  markStoreOnboardingCompleted,
  readUserStores,
  saveUserStores,
  START_STORE_ONBOARDING_EVENT,
  STORES_CHANGED_EVENT,
  type VeloStore,
} from "@/components/dashboard/FirstStoreOnboarding";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { useStartMode } from "@/hooks/useStartMode";
import { useIsMobile } from "@/hooks/use-mobile";
import { useOnlinePresence } from "@/hooks/useOnlinePresence";
import { useActivityTracker } from "@/hooks/useActivityTracker";
import { usePlan } from "@/hooks/usePlan";
import { useProfile } from "@/lib/profileContext";
import { supabase, isSupabaseEnabled } from "@/integrations/supabase/client";
import { attachReferralToCurrentUser } from "@/lib/affiliateFunnel";
import {
  ArrowLeft,
  ArrowLeftRight,
  Archive,
  BadgeDollarSign,
  ClipboardList,
  Code2,
  Copy,
  CreditCard,
  Heart,
  Headphones,
  HelpCircle,
  Home,
  Landmark,
  MessageSquare,
  Settings,
  Search,
  ShieldCheck,
  ShoppingCart,
  TrendingUp,
  UserRound,
  Video,
  type LucideIcon,
} from "lucide-react";

const ADMIN_EMAILS = new Set(["xavierluisfelipe12@gmail.com"]);
const AFFILIATE_EMAILS = new Set(["engelmannmatheus64@gmail.com"]);

type MobileRouteMeta = {
  test: (pathname: string) => boolean;
  title: string;
};

const mobileRoutes: MobileRouteMeta[] = [
  { test: (p) => p === "/dashboard", title: "Dashboard" },
  { test: (p) => p.startsWith("/dashboard/produtos"), title: "Produtos" },
  { test: (p) => p.startsWith("/dashboard/pedidos"), title: "Pedidos" },
  { test: (p) => p.startsWith("/dashboard/saldos"), title: "Financeiro" },
  { test: (p) => p.startsWith("/dashboard/transacoes"), title: "Transações" },
  { test: (p) => p.startsWith("/dashboard/pagamentos"), title: "Pagamentos" },
  { test: (p) => p.startsWith("/dashboard/publicacoes"), title: "Publicações" },
  { test: (p) => p.startsWith("/dashboard/criar-video"), title: "Vídeos" },
  { test: (p) => p.startsWith("/dashboard/chat-fornecedores"), title: "Chat" },
  { test: (p) => p.startsWith("/dashboard/integracoes"), title: "Integrações" },
  { test: (p) => p.startsWith("/dashboard/comissoes"), title: "Comissões" },
  { test: (p) => p.startsWith("/dashboard/relatorios"), title: "Relatórios" },
  { test: (p) => p.startsWith("/dashboard/resultados"), title: "Resultados" },
  { test: (p) => p.startsWith("/dashboard/minha-conta"), title: "Minha Conta" },
  { test: (p) => p.startsWith("/dashboard/configuracoes"), title: "Perfil" },
];

// ── Error Boundary ─────────────────────────────────────────────────────────
type EBState = { error: Error | null };

class PageErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): EBState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[PageErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-border bg-card p-12 text-center shadow-card">
          <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-red-50">
            <span className="text-2xl">⚠</span>
          </div>
          <div>
            <p className="font-['Manrope'] text-[15px] font-semibold text-foreground">
              Ocorreu um erro nesta página
            </p>
            <p className="mt-1 max-w-[400px] text-[12px] text-muted-foreground">
              {this.state.error.message}
            </p>
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            className="rounded-[14px] bg-[#111111] px-6 py-3 text-[13px] font-medium text-white transition-all duration-200 ease-out hover:bg-black/90"
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const MobileVeloMark = () => (
  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#111111] text-white shadow-[0_8px_20px_rgba(0,0,0,0.10)]">
    <svg width="18" height="18" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M33 18 A11 11 0 1 0 33 30" stroke="currentColor" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M30 26 L34 30 L38 26" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  </span>
);

const MobileBottomItem = ({
  to,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  to?: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  onClick?: () => void;
}) => {
  const className =
    "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-semibold transition";
  const style = active ? { color: "#111111", backgroundColor: "#F1F1F1" } : { color: "rgba(17,17,17,0.66)" };
  const content = (
    <>
      <Icon size={19} strokeWidth={active ? 2 : 1.8} />
      <span className="max-w-full truncate">{label}</span>
    </>
  );

  if (to) {
    return (
      <Link to={to} onClick={onClick} className={className} style={style} aria-current={active ? "page" : undefined}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className} style={style}>
      {content}
    </button>
  );
};

const MobileDrawerLink = ({
  to,
  label,
  icon: Icon,
  onClick,
  badge,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  badge?: string;
}) => (
  <Link
    to={to}
    onClick={onClick}
    className="flex min-h-14 items-center gap-4 border-b border-black/[0.06] px-1 text-[15px] font-semibold text-[#111111] transition active:bg-black/[0.03]"
  >
    <span className="flex h-10 w-10 shrink-0 items-center justify-center text-[#111111]">
      <Icon size={22} strokeWidth={1.7} />
    </span>
    <span className="min-w-0 flex-1 truncate">{label}</span>
    {badge && <span className="rounded-full bg-[#111111] px-2 py-1 text-[10px] font-bold text-white">{badge}</span>}
  </Link>
);

const MobileAccountPage = ({
  displayName,
  foto,
  initials,
  planLabel,
  planLoading,
  isAdmin,
}: {
  displayName: string;
  foto?: string | null;
  initials: string;
  planLabel: string;
  planLoading: boolean;
  isAdmin: boolean;
}) => (
  <section className="-mx-4 -mt-4 min-h-screen bg-white pb-8">
    <div className="bg-[#111111] px-5 pb-6 pt-6 text-white">
      <div className="mb-6">
        <span className="text-[24px] font-bold tracking-[-0.04em]">Velo</span>
      </div>
      <Link to="/dashboard/configuracoes" className="flex min-w-0 items-center gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/80 bg-white text-[18px] font-bold text-[#111111] shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
          {foto ? <img src={foto} alt="Avatar" className="h-full w-full object-cover" /> : initials || "VL"}
        </span>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-[21px] font-bold tracking-[-0.03em]">{displayName}</p>
            {!planLoading && (
              <span className="shrink-0 rounded-full border border-white/20 bg-white/12 px-2 py-1 text-[9px] font-black uppercase leading-none text-white/85">
                {planLabel}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[13px] font-medium text-white/75">Meu perfil ›</p>
        </div>
      </Link>
      <Link to="/dashboard/configuracoes" className="mt-6 flex h-14 items-center justify-between rounded-2xl bg-white px-4 text-[#111111] shadow-[0_10px_25px_rgba(0,0,0,0.10)]">
        <div>
          <p className="text-[13px] font-bold">Sua conta Velo</p>
          <p className="text-[11px] text-black/50">Plano, loja e preferências</p>
        </div>
        <span className="text-[20px]">›</span>
      </Link>
    </div>

    <div className="px-5 pb-6">
      <div>
        <MobileDrawerLink to="/dashboard" label="Início" icon={Home} />
        <MobileDrawerLink to="/dashboard/configuracoes?tab=Suporte" label="Suporte" icon={Headphones} />
        <MobileDrawerLink to="/dashboard/publicacoes" label="Publicações" icon={Archive} />
        <MobileDrawerLink to="/colecoes" label="Coleções" icon={Copy} />
        <MobileDrawerLink to="/dashboard/relatorios" label="Relatórios" icon={ClipboardList} />
        <MobileDrawerLink to="/docs" label="Ajuda & Central" icon={HelpCircle} />
        {isAdmin && (
          <MobileDrawerLink to="/admin/painel" label="Painel Admin" icon={ShieldCheck} badge="Admin" />
        )}
      </div>

      <div className="pt-0">
        <MobileDrawerLink to="/dashboard/configuracoes" label="Configurações" icon={Settings} />
      </div>
    </div>
  </section>
);

const MobileDashboardChrome = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { plan, loading: planLoading } = usePlan();
  const { foto } = useProfile();
  const isStartMode = false;
  const hasActivePlan = true;
  const [showStartModeModal, setShowStartModeModal] = useState(false);
  const metadataRole =
    (user?.app_metadata?.role as string | undefined) ??
    (user?.user_metadata?.role as string | undefined) ??
    null;
  const emailRole = user?.email && ADMIN_EMAILS.has(user.email.toLowerCase()) ? "admin" : null;
  const emailAffiliateRole = user?.email && AFFILIATE_EMAILS.has(user.email.toLowerCase()) ? "affiliate" : null;
  const [resolvedRole, setResolvedRole] = useState<string | null>(emailRole ?? emailAffiliateRole ?? role ?? metadataRole);
  const mobileTab = new URLSearchParams(location.search).get("tab");
  const routeMeta =
    location.pathname.startsWith("/dashboard/configuracoes") && mobileTab === "Suporte"
      ? { title: "Suporte" }
      : mobileRoutes.find((r) => r.test(location.pathname)) ?? mobileRoutes[0];
  const isRootDashboard = location.pathname === "/dashboard";
  const isAccountPage = location.pathname === "/dashboard/minha-conta";
  const isCatalogProductDetail = /^\/dashboard\/catalogo\/[^/]+$/.test(location.pathname);
  const displayName = user?.user_metadata?.full_name ?? user?.email ?? "Velo";
  const initials = displayName
    .split(/[\s._\-@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const planLabel = {
    gratis: "Grátis",
    go: "Go",
    pro: "Pro",
    business: "Business",
  }[plan] ?? "Grátis";

  useEffect(() => {
    setResolvedRole(emailRole ?? emailAffiliateRole ?? role ?? metadataRole);
  }, [emailAffiliateRole, emailRole, role, metadataRole]);

  useEffect(() => {
    if (!user || !isSupabaseEnabled) return;

    let cancelled = false;

    const resolveRole = async () => {
      const candidates = [emailRole, emailAffiliateRole, role, metadataRole].filter(Boolean) as string[];
      const [profileByUserId, userRole, affiliateRecord] = await Promise.allSettled([
        (supabase as any).from("profiles").select("role").eq("user_id", user.id).maybeSingle(),
        (supabase as any).from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
        (supabase as any).from("affiliates").select("user_id").eq("user_id", user.id).maybeSingle(),
      ]);

      if (profileByUserId.status === "fulfilled" && profileByUserId.value?.data?.role) {
        candidates.push(profileByUserId.value.data.role);
      }
      if (userRole.status === "fulfilled" && userRole.value?.data?.role) {
        candidates.push(userRole.value.data.role);
      }
      if (affiliateRecord.status === "fulfilled" && affiliateRecord.value?.data?.user_id) {
        candidates.push("affiliate");
      }

      const nextRole =
        candidates.includes("admin") ? "admin" :
        candidates.includes("affiliate") ? "affiliate" :
        candidates.includes("influencer") ? "influencer" :
        candidates[0] ?? "user";

      if (!cancelled) setResolvedRole(nextRole);
    };

    void resolveRole();

    return () => {
      cancelled = true;
    };
  }, [user, emailAffiliateRole, emailRole, role, metadataRole]);

  const isAdmin = resolvedRole === "admin";
  const canAccessCommissions = resolvedRole === "influencer" || resolvedRole === "affiliate" || resolvedRole === "admin";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      {!isRootDashboard && !isAccountPage && (
        <header
          className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-[#050505] px-4 backdrop-blur-xl"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white"
              aria-label="Voltar"
            >
              <ArrowLeft size={19} />
            </button>
            {isCatalogProductDetail ? (
              <button
                type="button"
                onClick={() => navigate("/dashboard/catalogo")}
                className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full bg-white px-3 text-left text-[#5F6670]"
              >
                <Search size={16} strokeWidth={2} className="shrink-0 text-[#3E454D]" />
                <span className="truncate text-[13px] font-semibold">Buscar na Velo</span>
              </button>
            ) : (
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold leading-5 tracking-[-0.02em] text-white">{routeMeta.title}</p>
                <p className="truncate text-[11px] font-medium text-white">Velo mobile</p>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white [&_button]:!flex [&_button]:!h-10 [&_button]:!w-10 [&_button]:!items-center [&_button]:!justify-center [&_button]:!text-white [&_svg]:!h-[18px] [&_svg]:!w-[18px] [&_svg]:!text-white"
            >
              <NotificacoesPopover />
            </div>
          </div>
        </header>
      )}

      <main
        className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-[calc(96px+env(safe-area-inset-bottom))] ${
          isRootDashboard ? "px-0 pt-0" : "px-4 pt-4"
        }`}
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <PageErrorBoundary>
          {isAccountPage ? (
            <MobileAccountPage
              displayName={displayName}
              foto={foto}
              initials={initials}
              planLabel={planLabel}
              planLoading={planLoading}
              isAdmin={isAdmin}
            />
          ) : (
            children
          )}
        </PageErrorBoundary>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.08] bg-white/95 px-2 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-[480px] items-center gap-1">
          <MobileBottomItem to="/dashboard" label="Início" icon={Home} active={location.pathname === "/dashboard"} />
          <MobileBottomItem to="/dashboard/pedidos" label="Pedidos" icon={ShoppingCart} active={location.pathname.startsWith("/dashboard/pedidos")} />
          <MobileBottomItem to="/dashboard/resultados" label="Resultados" icon={TrendingUp} active={location.pathname.startsWith("/dashboard/resultados")} />
          <MobileBottomItem to="/dashboard/minha-conta" label="Minha Conta" icon={UserRound} active={isAccountPage || location.pathname === "/colecoes" || location.pathname.startsWith("/dashboard/configuracoes")} />
        </div>
      </nav>

      <StartModeModal isOpen={showStartModeModal} onClose={() => setShowStartModeModal(false)} />
    </div>
  );
};

// ── Layout inner (needs hooks) ─────────────────────────────────────────────
const DashboardLayoutInner = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const isMobile = useIsMobile();
  const [stores, setStores] = useState<VeloStore[]>(() => readUserStores());
  const [storesHydrated, setStoresHydrated] = useState(false);
  const [showStoreOnboarding, setShowStoreOnboarding] = useState(false);
  const [shouldAutoShowStoreOnboarding, setShouldAutoShowStoreOnboarding] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    void attachReferralToCurrentUser(user.id);
  }, [user?.id]);

  // Broadcast presence on shared realtime channel (used by admin panel to count live users).
  useOnlinePresence(user?.id ?? null);
  useActivityTracker(user?.id ?? null);

  const isStartMode = false;

  useEffect(() => {
    const syncStores = () => setStores(readUserStores());
    const startStoreOnboarding = () => setShowStoreOnboarding(true);
    syncStores();
    window.addEventListener(STORES_CHANGED_EVENT, syncStores);
    window.addEventListener("storage", syncStores);
    window.addEventListener(START_STORE_ONBOARDING_EVENT, startStoreOnboarding);
    return () => {
      window.removeEventListener(STORES_CHANGED_EVENT, syncStores);
      window.removeEventListener("storage", syncStores);
      window.removeEventListener(START_STORE_ONBOARDING_EVENT, startStoreOnboarding);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      setStoresHydrated(false);
      setShouldAutoShowStoreOnboarding(false);
      return;
    }

    const localStores = readUserStores();
    if (localStores.length > 0) {
      setStores(localStores);
      setShouldAutoShowStoreOnboarding(false);
      setStoresHydrated(true);
      return;
    }

    let cancelled = false;

    const hydrateStoreFromProfile = async () => {
      if (!isSupabaseEnabled) {
        setStoresHydrated(true);
        return;
      }

      const buildStore = (profile: {
        store_name: string | null;
        loja_nome: string | null;
        display_name: string | null;
        whatsapp: string | null;
        onboarding_completed: boolean;
      } | null): VeloStore | null => {
        const storeName = String(profile?.store_name || profile?.loja_nome || "").trim();
        const completed = Boolean(profile?.onboarding_completed || storeName);
        if (!completed) return null;

        return {
          id: `profile-${user.id}`,
          name: storeName || "Minha Loja",
          ownerName: String(profile?.display_name || user.user_metadata?.full_name || user.email || "").trim(),
          cpf: "",
          phone: String(profile?.whatsapp || ""),
          source: "Perfil salvo",
          businessType: "Loja online",
          goal: "Publicar produtos",
          productLimit: 30,
          publishedProducts: 0,
          createdAt: new Date().toISOString(),
          isActive: true,
        };
      };

      try {
        const byUserId = await supabase
          .from("profiles")
          .select("store_name,loja_nome,display_name,whatsapp,onboarding_completed")
          .eq("user_id", user.id)
          .maybeSingle();

        let profile = byUserId.data;

        if (!profile) {
          const byId = await supabase
            .from("profiles")
            .select("store_name,loja_nome,display_name,whatsapp,onboarding_completed")
            .eq("id", user.id)
            .maybeSingle();
          profile = byId.data;
        }

        const restoredStore = buildStore(profile);
        if (!cancelled && restoredStore) {
          saveUserStores([restoredStore]);
          setStores([restoredStore]);
          markStoreOnboardingCompleted(user.id);
          setShouldAutoShowStoreOnboarding(false);
        } else if (!cancelled) {
          const createdAt = new Date(user.created_at).getTime();
          const lastSignInAt = new Date(user.last_sign_in_at || "").getTime();
          const isFirstSignIn =
            Number.isFinite(createdAt) &&
            Number.isFinite(lastSignInAt) &&
            Math.abs(lastSignInAt - createdAt) <= 10 * 60 * 1000;
          const explicitlyPending = user.user_metadata?.velo_onboarding_pending === true;
          const alreadyHandled = hasCompletedStoreOnboarding(user.id);
          const shouldShow = !alreadyHandled && (explicitlyPending || isFirstSignIn);

          setShouldAutoShowStoreOnboarding(shouldShow);
          if (!shouldShow) markStoreOnboardingCompleted(user.id);
        }
      } catch (error) {
        console.warn("[DashboardLayout] não foi possível restaurar a loja salva:", error);
      } finally {
        if (!cancelled) setStoresHydrated(true);
      }
    };

    void hydrateStoreFromProfile();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const persistCompletedStore = async (store: VeloStore) => {
    if (!user || !isSupabaseEnabled) return;

    const payload = {
      store_name: store.name,
      loja_nome: store.name,
      display_name: store.ownerName,
      whatsapp: store.phone,
      onboarding_completed: true,
    };

    const updateByUserId = await supabase
      .from("profiles")
      .update(payload)
      .eq("user_id", user.id);

    if (updateByUserId.error) {
      const updateById = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", user.id);

      if (updateById.error) {
        console.warn("[DashboardLayout] não foi possível salvar a loja no perfil:", updateById.error);
      }
    }

    const { error: metadataError } = await supabase.auth.updateUser({
      data: { velo_onboarding_pending: false },
    });
    if (metadataError) {
      console.warn("[DashboardLayout] não foi possível concluir o primeiro acesso no Auth:", metadataError);
    }
  };
  useEffect(() => {
    const params = new URLSearchParams(location.search);

    if (params.get("ml_connected") === "true") {
      veloToast.success("Mercado Livre conectado com sucesso!", {
        action: { label: "Ver", onClick: () => navigate("/dashboard/configuracoes") },
      });
      navigate(location.pathname, { replace: true });
    }

    if (params.get("ml_error")) {
      const errors: Record<string, string> = {
        missing_params: "Parametros ausentes na resposta do Mercado Livre.",
        token_failed: "Nao foi possivel obter o token. Tente novamente.",
        db_failed: "Erro ao salvar a integracao. Tente novamente.",
      };
      const msg = errors[params.get("ml_error")!] ?? "Erro desconhecido na integracao.";
      veloToast.error(`Erro ao conectar Mercado Livre: ${msg}`);
      navigate(location.pathname, { replace: true });
    }
  }, [location.search]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-black border-t-transparent dark:border-white dark:border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (isMobile) {
    return (
      <div
        className="dashboard-inter flex h-screen min-h-0 w-full max-w-full overflow-x-hidden flex-col"
        style={{
          background: isStartMode ? "#FFA640" : "linear-gradient(135deg, #F7F6F4 0%, #EFEDEA 48%, #E8E7E4 100%)",
          transition: "background-color 280ms ease",
        }}
      >
        <StartModeBanner isStartMode={isStartMode} />
        <div
          className="flex min-h-0 w-full flex-1 overflow-hidden"
          style={{
            marginTop: isStartMode ? "48px" : "0",
            minHeight: isStartMode ? "calc(100vh - 48px)" : "100vh",
            borderTopLeftRadius: isStartMode ? "24px" : "0",
            borderTopRightRadius: isStartMode ? "24px" : "0",
            background: "transparent",
            position: "relative",
            zIndex: 2,
            transition: "margin-top 280ms ease, border-radius 280ms ease, min-height 280ms ease",
          }}
        >
          <MobileDashboardChrome>
            <Outlet />
          </MobileDashboardChrome>
          {storesHydrated &&
            ((stores.length === 0 && shouldAutoShowStoreOnboarding) || (showStoreOnboarding && stores.length < MAX_STORES_PER_USER)) && (
            <FirstStoreOnboarding
              defaultName={user.user_metadata?.full_name ?? user.email}
              existingStores={stores}
              onComplete={(store) => {
                void persistCompletedStore(store);
                markStoreOnboardingCompleted(user.id);
                setShouldAutoShowStoreOnboarding(false);
                setStores(readUserStores());
                setShowStoreOnboarding(false);
                veloToast.success("Loja criada com sucesso.", {
                  action: { label: "Ver", onClick: () => navigate("/dashboard/configuracoes?tab=Minhas%20Lojas") },
                });
              }}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div 
      className="dashboard-inter flex h-screen min-h-0 w-full max-w-full overflow-x-hidden flex-col" 
      style={{ 
        background: isStartMode ? "#FFA640" : "linear-gradient(135deg, #F7F6F4 0%, #EFEDEA 48%, #E8E7E4 100%)",
        paddingTop: 0,
        transition: "background-color 280ms ease"
      }}
    >
      {/* Start Mode Banner */}
      <StartModeBanner isStartMode={isStartMode} />
      
      {/* Main Dashboard Layout - Shell cinza com cantos arredondados */}
      <div 
        className="flex h-full min-h-0 w-full max-w-full overflow-x-hidden flex-1"
        style={{
          marginTop: isStartMode ? "48px" : "0",
          borderTopLeftRadius: isStartMode ? "32px" : "0",
          borderTopRightRadius: isStartMode ? "32px" : "0",
          overflow: "hidden",
          background: "transparent",
          minHeight: isStartMode ? "calc(100vh - 48px)" : "100vh",
          position: "relative",
          zIndex: 2,
          transition: "margin-top 280ms ease, border-top-left-radius 280ms ease, border-top-right-radius 280ms ease, min-height 280ms ease"
        }}
      >
        {/* Sidebar - fora da moldura branca */}
        <div className="hidden h-full min-h-0 shrink-0 md:block">
          <DashboardSidebar />
        </div>
        
        {/* Área principal com header e conteúdo */}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {/* Header - no shell cinza */}
          <DashboardHeader />
          {/* Main content area - sem moldura externa */}
          <main className="flex flex-col min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-5 sm:p-6 lg:p-7" style={{ background: "transparent" }}>
            <PageErrorBoundary>
              <Outlet />
            </PageErrorBoundary>
          </main>
        </div>
      </div>
      {storesHydrated &&
        ((stores.length === 0 && shouldAutoShowStoreOnboarding) || (showStoreOnboarding && stores.length < MAX_STORES_PER_USER)) && (
        <FirstStoreOnboarding
          defaultName={user.user_metadata?.full_name ?? user.email}
          existingStores={stores}
          onComplete={(store) => {
            void persistCompletedStore(store);
            markStoreOnboardingCompleted(user.id);
            setShouldAutoShowStoreOnboarding(false);
            setStores(readUserStores());
            setShowStoreOnboarding(false);
            veloToast.success("Loja criada com sucesso.", {
              action: { label: "Ver", onClick: () => navigate("/dashboard/configuracoes?tab=Minhas%20Lojas") },
            });
          }}
        />
      )}
    </div>
  );
};

const DashboardLayout = () => <DashboardLayoutInner />;

export default DashboardLayout;
