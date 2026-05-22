import { Component, useEffect, useState, type ReactNode } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
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
import { useProfile } from "@/lib/profileContext";
import { supabase, isSupabaseEnabled } from "@/integrations/supabase/client";
import { attachReferralToCurrentUser } from "@/lib/affiliateFunnel";
import {
  ArrowLeft,
  ArrowLeftRight,
  BadgeDollarSign,
  Code2,
  CreditCard,
  FileText,
  Landmark,
  LayoutDashboard,
  Menu,
  MessageCircle,
  MessageSquare,
  Package,
  Settings,
  ShieldCheck,
  ShoppingCart,
  UserRound,
  Video,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";

const ADMIN_EMAILS = new Set(["xavierluisfelipe12@gmail.com"]);

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
  { test: (p) => p.startsWith("/dashboard/comissoes"), title: "Comissões" },
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
  const style = active ? { color: "#111111", backgroundColor: "#F4F4F2" } : { color: "rgba(17,17,17,0.46)" };
  const content = (
    <>
      <Icon size={19} strokeWidth={active ? 2 : 1.8} />
      <span className="max-w-full truncate">{label}</span>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={className} style={style} aria-current={active ? "page" : undefined}>
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
  onClick: () => void;
  badge?: string;
}) => (
  <Link
    to={to}
    onClick={onClick}
    className="flex min-h-12 items-center gap-3 rounded-2xl border border-black/[0.04] bg-[#FAFAFA] px-4 text-[14px] font-semibold text-[#111111] transition active:scale-[0.99]"
  >
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-black/62 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <Icon size={17} strokeWidth={1.8} />
    </span>
    <span className="min-w-0 flex-1 truncate">{label}</span>
    {badge && <span className="rounded-full bg-[#111111] px-2 py-1 text-[10px] font-bold text-white">{badge}</span>}
  </Link>
);

const MobileDashboardChrome = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { foto } = useProfile();
  const { isStartMode, hasActivePlan } = useStartMode();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showStartModeModal, setShowStartModeModal] = useState(false);
  const metadataRole =
    (user?.app_metadata?.role as string | undefined) ??
    (user?.user_metadata?.role as string | undefined) ??
    null;
  const emailRole = user?.email && ADMIN_EMAILS.has(user.email.toLowerCase()) ? "admin" : null;
  const [resolvedRole, setResolvedRole] = useState<string | null>(emailRole ?? role ?? metadataRole);
  const routeMeta = mobileRoutes.find((r) => r.test(location.pathname)) ?? mobileRoutes[0];
  const isRootDashboard = location.pathname === "/dashboard";
  const displayName = user?.user_metadata?.full_name ?? user?.email ?? "Velo";
  const initials = displayName
    .split(/[\s._\-@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  useEffect(() => {
    setResolvedRole(emailRole ?? role ?? metadataRole);
  }, [emailRole, role, metadataRole]);

  useEffect(() => {
    if (!user || !isSupabaseEnabled) return;

    let cancelled = false;

    const resolveRole = async () => {
      const candidates = [emailRole, role, metadataRole].filter(Boolean) as string[];
      const [profileByUserId, userRole] = await Promise.allSettled([
        (supabase as any).from("profiles").select("role").eq("user_id", user.id).maybeSingle(),
        (supabase as any).from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
      ]);

      if (profileByUserId.status === "fulfilled" && profileByUserId.value?.data?.role) {
        candidates.push(profileByUserId.value.data.role);
      }
      if (userRole.status === "fulfilled" && userRole.value?.data?.role) {
        candidates.push(userRole.value.data.role);
      }

      const nextRole =
        candidates.includes("admin") ? "admin" :
        candidates.includes("influencer") ? "influencer" :
        candidates[0] ?? "user";

      if (!cancelled) setResolvedRole(nextRole);
    };

    void resolveRole();

    return () => {
      cancelled = true;
    };
  }, [user, emailRole, role, metadataRole]);

  const isAdmin = resolvedRole === "admin";
  const isInfluencer = resolvedRole === "influencer" || resolvedRole === "admin";
  const closeMenu = () => setMenuOpen(false);

  const drawerLinks = [
    { to: "/dashboard/publicacoes", label: "Publicações", icon: FileText },
    { to: "/dashboard/criar-video", label: "Vídeos", icon: Video },
    { to: "/dashboard/chat-fornecedores", label: "Chat", icon: MessageSquare },
    { to: "/dashboard/saldos", label: "Saldos", icon: Landmark },
    { to: "/dashboard/transacoes", label: "Transações", icon: ArrowLeftRight },
    { to: "/dashboard/pagamentos", label: "Pagamentos", icon: CreditCard },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#F6F6F4]">
      <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b border-black/[0.06] bg-white/96 px-4 backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-3">
          {!isRootDashboard ? (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#F4F4F2] text-[#111111]"
              aria-label="Voltar"
            >
              <ArrowLeft size={19} />
            </button>
          ) : (
            <MobileVeloMark />
          )}
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold leading-5 tracking-[-0.02em] text-[#111111]">{routeMeta.title}</p>
            <p className="truncate text-[11px] font-medium text-black/38">Velo mobile</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F4F4F2] [&_button]:!h-10 [&_button]:!w-10 [&_svg]:!h-[18px] [&_svg]:!w-[18px]">
            <NotificacoesPopover />
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#111111] text-white"
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      <main
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-4"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <PageErrorBoundary>{children}</PageErrorBoundary>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.06] bg-white/95 px-2 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-[480px] items-center gap-1">
          <MobileBottomItem to="/dashboard" label="Dashboard" icon={LayoutDashboard} active={location.pathname === "/dashboard"} />
          <MobileBottomItem to="/dashboard/produtos" label="Produtos" icon={Package} active={location.pathname.startsWith("/dashboard/produtos")} />
          <MobileBottomItem to="/dashboard/pedidos" label="Pedidos" icon={ShoppingCart} active={location.pathname.startsWith("/dashboard/pedidos")} />
          <MobileBottomItem
            to="/dashboard/saldos"
            label="Financeiro"
            icon={Wallet}
            active={
              location.pathname.startsWith("/dashboard/saldos") ||
              location.pathname.startsWith("/dashboard/transacoes") ||
              location.pathname.startsWith("/dashboard/pagamentos")
            }
          />
          <MobileBottomItem label="Perfil" icon={UserRound} active={menuOpen} onClick={() => setMenuOpen(true)} />
        </div>
      </nav>

      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/24 backdrop-blur-[2px]"
            aria-label="Fechar menu"
            onClick={closeMenu}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-hidden rounded-t-[32px] border border-black/[0.06] bg-white shadow-[0_-24px_80px_rgba(0,0,0,0.16)]">
            <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-black/12" />
            <div className="flex items-center justify-between px-5 pb-4 pt-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#C2185B] text-[13px] font-bold text-white">
                  {foto ? <img src={foto} alt="Avatar" className="h-full w-full object-cover" /> : initials || "VL"}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-[#111111]">{displayName}</p>
                  <p className="truncate text-[12px] font-medium text-black/40">{user?.email ?? "Conta Velo"}</p>
                </div>
              </div>
              <button type="button" onClick={closeMenu} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F4F4F2] text-[#111111]">
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[calc(82vh-112px)] overflow-y-auto px-4 pb-[calc(18px+env(safe-area-inset-bottom))]">
              <div className="grid gap-2.5">
                {drawerLinks.map((link) => (
                  <MobileDrawerLink key={link.to} {...link} onClick={closeMenu} />
                ))}

                {!hasActivePlan && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowStartModeModal(true);
                      setMenuOpen(false);
                    }}
                    className="flex min-h-12 items-center gap-3 rounded-2xl border border-[#FFA640]/20 bg-[#FFF4E2] px-4 text-[14px] font-semibold text-[#9A5A00]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#FFA640]">
                      <Code2 size={17} strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 flex-1 text-left">Start Mode</span>
                    <span className="h-5 w-9 rounded-full bg-[#111111] p-0.5">
                      <span className="block h-4 w-4 translate-x-4 rounded-full bg-white" />
                    </span>
                  </button>
                )}

                <a
                  href="https://wa.me/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-12 items-center gap-3 rounded-2xl border border-black/[0.04] bg-[#FAFAFA] px-4 text-[14px] font-semibold text-[#111111]"
                  onClick={closeMenu}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#25D366]">
                    <MessageCircle size={17} strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1">Suporte</span>
                </a>

                {isAdmin && <MobileDrawerLink to="/admin/dashboard" label="Painel Admin" icon={ShieldCheck} onClick={closeMenu} badge="Admin" />}
                {isInfluencer && <MobileDrawerLink to="/dashboard/comissoes" label="Painel de Comissão" icon={BadgeDollarSign} onClick={closeMenu} />}
                <MobileDrawerLink to="/dashboard/configuracoes" label="Perfil e configurações" icon={Settings} onClick={closeMenu} />
              </div>
            </div>
          </div>
        </div>
      )}

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
  const hasOnboarded = user ? hasCompletedStoreOnboarding(user.id) : false;

  useEffect(() => {
    if (!user?.id) return;
    void attachReferralToCurrentUser(user.id);
  }, [user?.id]);

  // Start Mode: ativo para usuários gratuitos, desativado para pagos
  const { isStartMode } = useStartMode();

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
    if (!user) return;
    if (!storesHydrated) return;
    if (stores.length !== 0) return;
    if (hasCompletedStoreOnboarding(user.id)) return;
    // Marcar como "visto" para não reaparecer a cada login/logout
    markStoreOnboardingCompleted(user.id);
  }, [user, storesHydrated, stores.length]);


  useEffect(() => {
    if (!user) {
      setStoresHydrated(false);
      return;
    }

    const localStores = readUserStores();
    if (localStores.length > 0) {
      setStores(localStores);
      setStoresHydrated(true);
      return;
    }

    let cancelled = false;

    const hydrateStoreFromProfile = async () => {
      if (!isSupabaseEnabled) {
        setStoresHydrated(true);
        return;
      }

      const buildStore = (profile: any): VeloStore | null => {
        const storeName = String(profile?.store_name || profile?.loja_nome || "").trim();
        const completed = Boolean(profile?.onboarding_completed || storeName);
        if (!completed) return null;

        return {
          id: `profile-${user.id}`,
          name: storeName || "Minha Loja",
          ownerName: String(profile?.display_name || profile?.nome || user.user_metadata?.full_name || user.email || "").trim(),
          cpf: String(profile?.cpf || ""),
          phone: String(profile?.whatsapp || profile?.phone || ""),
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
        const byUserId = await (supabase as any)
          .from("profiles")
          .select("store_name,loja_nome,display_name,nome,cpf,whatsapp,phone,onboarding_completed")
          .eq("user_id", user.id)
          .maybeSingle();

        let profile = byUserId.data;

        if (!profile) {
          const byId = await (supabase as any)
            .from("profiles")
            .select("store_name,loja_nome,display_name,nome,cpf,whatsapp,phone,onboarding_completed")
            .eq("id", user.id)
            .maybeSingle();
          profile = byId.data;
        }

        const restoredStore = buildStore(profile);
        if (!cancelled && restoredStore) {
          saveUserStores([restoredStore]);
          setStores([restoredStore]);
          markStoreOnboardingCompleted(user.id);
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
  }, [user?.id]);

  const persistCompletedStore = async (store: VeloStore) => {
    if (!user || !isSupabaseEnabled) return;

    const payload = {
      store_name: store.name,
      loja_nome: store.name,
      nome: store.ownerName,
      cpf: store.cpf,
      whatsapp: store.phone,
      onboarding_completed: true,
    };

    const updateByUserId = await (supabase as any)
      .from("profiles")
      .update(payload)
      .eq("user_id", user.id);

    if (updateByUserId.error) {
      const updateById = await (supabase as any)
        .from("profiles")
        .update(payload)
        .eq("id", user.id);

      if (updateById.error) {
        console.warn("[DashboardLayout] não foi possível salvar a loja no perfil:", updateById.error);
      }
    }
  };
  useEffect(() => {
    const params = new URLSearchParams(location.search);

    if (params.get("ml_connected") === "true") {
      toast.success("Mercado Livre conectado com sucesso!", {
        description: "Seus tokens foram salvos. Voce ja pode publicar anuncios.",
        duration: 5000,
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
      toast.error("Erro ao conectar Mercado Livre", { description: msg, duration: 6000 });
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
          backgroundColor: isStartMode ? "#FFA640" : "#F6F6F4",
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
            backgroundColor: "#F6F6F4",
            position: "relative",
            zIndex: 2,
            transition: "margin-top 280ms ease, border-radius 280ms ease, min-height 280ms ease",
          }}
        >
          <MobileDashboardChrome>
            <Outlet />
          </MobileDashboardChrome>
          {storesHydrated &&
            ((stores.length === 0 && !hasOnboarded) || (showStoreOnboarding && stores.length < MAX_STORES_PER_USER)) && (
            <FirstStoreOnboarding
              defaultName={user.user_metadata?.full_name ?? user.email}
              existingStores={stores}
              onComplete={(store) => {
                void persistCompletedStore(store);
                markStoreOnboardingCompleted(user.id);
                setStores(readUserStores());
                setShowStoreOnboarding(false);
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
        backgroundColor: isStartMode ? "#FFA640" : "#F4F4F5",
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
          backgroundColor: "#F4F4F5",
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
          <main className="flex min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-5 sm:p-6 lg:p-7" style={{ backgroundColor: "#F4F4F5" }}>
            <PageErrorBoundary>
              <Outlet />
            </PageErrorBoundary>
          </main>
        </div>
      </div>
      {storesHydrated &&
        ((stores.length === 0 && !hasOnboarded) || (showStoreOnboarding && stores.length < MAX_STORES_PER_USER)) && (
        <FirstStoreOnboarding
          defaultName={user.user_metadata?.full_name ?? user.email}
          existingStores={stores}
          onComplete={(store) => {
            void persistCompletedStore(store);
            markStoreOnboardingCompleted(user.id);
            setStores(readUserStores());
            setShowStoreOnboarding(false);
          }}
        />
      )}
    </div>
  );
};

const DashboardLayout = () => <DashboardLayoutInner />;

export default DashboardLayout;
