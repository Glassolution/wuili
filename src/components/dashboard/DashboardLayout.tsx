import { Component, Suspense, useEffect, useState, type ReactNode } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { veloToast } from "@/components/ui/velo-toast";
import { lerRetornoMl, limparRetornoMl } from "@/lib/mlOauthRetorno";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import StartModeBanner from "@/components/dashboard/StartModeBanner";
import FreePlanBanner from "@/components/dashboard/FreePlanBanner";
import StartModeModal from "@/components/dashboard/StartModeModal";
import InviteFriendModal from "@/components/dashboard/InviteFriendModal";
import NotificacoesPopover from "@/components/dashboard/NotificacoesPopover";
import AtlasDockPanel from "@/components/dashboard/AtlasDockPanel";
import SupportFloatingWidget from "@/components/dashboard/SupportFloatingWidget";
import { useAtlasChat } from "@/contexts/AtlasChatContext";
import NotificationBannerStack from "@/components/dashboard/NotificationBannerStack";
import OnboardingModal, {
  markOnboardingSeen,
  shouldShowOnboarding,
} from "@/components/onboarding/OnboardingModal";
import AtlasProductShowcase from "@/components/dashboard/AtlasProductShowcase";
import { CHAVE_RESPOSTAS_DO_QUIZ } from "@/lib/perfilDoQuiz";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useOnlinePresence } from "@/hooks/useOnlinePresence";
import { useActivityTracker } from "@/hooks/useActivityTracker";
import { usePlan } from "@/hooks/usePlan";
import { useProfile } from "@/lib/profileContext";
import { supabase, isSupabaseEnabled } from "@/integrations/supabase/client";
import { attachReferralToCurrentUser } from "@/lib/affiliateFunnel";
import { isChunkLoadError, recoverFromChunkLoadError } from "@/lib/chunkRecovery";
import { Image as ImageIcon,
  ArrowLeft,
  Archive,
  Copy,
  Headphones,
  HelpCircle,
  Home,
  LogOut,
  Search,
  Settings,
  ShieldCheck,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import AtlasAvatarIcon from "@/components/dashboard/AtlasAvatarIcon";
import {
  NavAccountIcon,
  NavHomeIcon,
  NavOrdersIcon,
  NavResultsIcon,
  type MobileNavIconProps,
} from "@/components/dashboard/MobileNavIcons";

/**
 * Conteúdo das páginas do dashboard.
 * Mantém o shell (sidebar/header/Atlas) montado e troca só o miolo, sem loader
 * de tela cheia: a página nova apenas entra com uma animação suave.
 */
const PageOutlet = () => {
  const { pathname } = useLocation();
  return (
    <Suspense fallback={<div aria-hidden className="min-h-[1px] w-full" />}>
      <div key={pathname} className="animate-fade-in flex min-h-0 w-full flex-1 flex-col">
        <Outlet />
      </div>
    </Suspense>
  );
};

const ADMIN_EMAILS = new Set(["xavierluisfelipe12@gmail.com"]);
const AFFILIATE_EMAILS = new Set(["engelmannmatheus64@gmail.com"]);

type MobileRouteMeta = {
  test: (pathname: string) => boolean;
  title: string;
};

const mobileRoutes: MobileRouteMeta[] = [
  { test: (p) => p === "/dashboard", title: "Dashboard" },
  { test: (p) => p.startsWith("/dashboard/paginas-com-ia"), title: "Páginas com IA" },
  { test: (p) => p.startsWith("/dashboard/modelos"), title: "Templates" },
  { test: (p) => p.startsWith("/dashboard/produtos"), title: "Produtos" },
  { test: (p) => p.startsWith("/dashboard/pedidos"), title: "Pedidos" },
  { test: (p) => p.startsWith("/dashboard/saldos"), title: "Financeiro" },
  { test: (p) => p.startsWith("/dashboard/transacoes"), title: "Transações" },
  { test: (p) => p.startsWith("/dashboard/pagamentos"), title: "Pagamentos" },
  { test: (p) => p.startsWith("/dashboard/publicacoes"), title: "Publicações" },
  { test: (p) => p.startsWith("/dashboard/criar-video"), title: "Vídeos" },
  { test: (p) => p.startsWith("/dashboard/chat-fornecedores"), title: "Chat" },
  { test: (p) => p.startsWith("/dashboard/integracoes"), title: "Lojas" },
  { test: (p) => p.startsWith("/dashboard/tiktok"), title: "TikTok" },
  { test: (p) => p.startsWith("/dashboard/personagem-video"), title: "Personagem em vídeo" },
  { test: (p) => p.startsWith("/dashboard/comissoes"), title: "Comissões" },
  { test: (p) => p.startsWith("/dashboard/imagens-ia"), title: "Imagens com IA" },
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
    recoverFromChunkLoadError(error);
  }

  render() {
    if (this.state.error) {
      const chunkLoadFailed = isChunkLoadError(this.state.error);
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
              {chunkLoadFailed ? "Não foi possível carregar a versão mais recente. Atualize a página para continuar." : this.state.error.message}
            </p>
          </div>
          <button
            onClick={() => chunkLoadFailed ? window.location.reload() : this.setState({ error: null })}
            className="rounded-[14px] bg-[#111111] px-6 py-3 text-[13px] font-medium text-white transition-all duration-200 ease-out hover:bg-black/90"
          >
            {chunkLoadFailed ? "Atualizar página" : "Tentar novamente"}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Item da barra inferior do mobile.
 *
 * Sem fundo na aba ativa: o retângulo azul competia com o próprio ícone. Quem
 * marca a seleção agora é o desenho, que passa de contorno a preenchido.
 */
const MobileBottomItem = ({
  to,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  to?: string;
  label: string;
  icon: (props: MobileNavIconProps) => JSX.Element;
  active: boolean;
  onClick?: () => void;
}) => {
  const className =
    "flex min-w-0 flex-1 flex-col items-center justify-center gap-1.5 px-1 py-2 text-[10px] transition-transform duration-200 active:scale-95";
  const style = active
    ? { color: "#2563EB", fontWeight: 700 }
    : { color: "rgba(17,17,17,0.45)", fontWeight: 600 };
  const content = (
    <>
      <Icon active={active} />
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

/**
 * Botão central do Atlas.
 *
 * Disco elevado que rompe a borda da barra, o gesto que os apps usam para a
 * ação principal. A pílula com texto dentro parecia banner de anúncio e não
 * dizia que ali mora o assistente; aqui o desenho fala por si e o rótulo
 * "Atlas" fica na mesma linha dos outros, mantendo o ritmo da barra.
 */
const MobileAtlasButton = ({ active }: { active: boolean }) => (
  <Link
    to="/dashboard/atlas"
    aria-label="Abrir o Atlas"
    aria-current={active ? "page" : undefined}
    className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5 px-1 py-2 text-[10px] transition-transform duration-200 active:scale-95"
    style={{ color: active ? "#2563EB" : "rgba(17,17,17,0.45)", fontWeight: active ? 700 : 600 }}
  >
    <span
      className="-mt-[26px] flex h-[46px] w-[46px] items-center justify-center rounded-full"
      style={{
        background: "linear-gradient(135deg, #2563EB 0%, #1E3A8A 100%)",
        // O anel branco recorta a barra e faz o disco flutuar sobre ela.
        boxShadow: "0 0 0 4px #FFFFFF, 0 8px 20px rgba(37,99,235,0.45)",
      }}
    >
      <AtlasAvatarIcon size={24} />
    </span>
    <span className="max-w-full truncate">Atlas</span>
  </Link>
);

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

const MobileDrawerButton = ({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="flex min-h-14 w-full items-center gap-4 border-b border-black/[0.06] px-1 text-left text-[15px] font-semibold text-[#111111] transition active:bg-black/[0.03]"
  >
    <span className="flex h-10 w-10 shrink-0 items-center justify-center text-[#111111]">
      <Icon size={22} strokeWidth={1.7} />
    </span>
    <span className="min-w-0 flex-1 truncate">{label}</span>
  </button>
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
}) => {
  const [inviteOpen, setInviteOpen] = useState(false);

  // Permite abrir o modal de convite a partir de qualquer tela do dashboard.
  useEffect(() => {
    const open = () => setInviteOpen(true);
    window.addEventListener("velo:open-invite-modal", open);
    return () => window.removeEventListener("velo:open-invite-modal", open);
  }, []);
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
  <section className="-mx-4 -mt-4 min-h-screen bg-white pb-8">
    <div className="bg-[#111111] px-5 pb-6 pt-6 text-white">
      <div className="mb-6">
        <span className="text-[24px] font-bold tracking-[-0.04em]">Velo</span>
      </div>
      <Link to="/dashboard/configuracoes" className="flex min-w-0 items-center gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/80 bg-white text-[18px] font-bold text-[#111111] shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
          {foto ? <img src={foto} alt="Avatar" className="h-full w-full object-cover" /> : initials}
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
      <div className="mt-6 flex h-14 items-center rounded-2xl bg-white px-4 text-[#111111] shadow-[0_10px_25px_rgba(0,0,0,0.10)]">
        <div>
          <p className="text-[13px] font-bold">Sua conta Velo</p>
          <p className="text-[11px] text-black/50">Seu plano e sua loja, do seu jeito.</p>
        </div>
      </div>
    </div>

    <div className="px-5 pb-6">
      <div>
        <MobileDrawerLink to="/dashboard" label="Início" icon={Home} />
        <MobileDrawerLink to="/dashboard/configuracoes?tab=Suporte" label="Suporte" icon={Headphones} />
        <MobileDrawerLink to="/dashboard/publicacoes" label="Publicações" icon={Archive} />
        <MobileDrawerLink to="/colecoes" label="Coleções" icon={Copy} />
        <MobileDrawerLink to="/dashboard/imagens-ia" label="Imagens com IA" icon={ImageIcon} />
        <MobileDrawerButton label="Convidar amigo" icon={UserPlus} onClick={() => setInviteOpen(true)} />
        <MobileDrawerLink to="/docs" label="Ajuda & Central" icon={HelpCircle} />
        {isAdmin && (
          <MobileDrawerLink to="/admin/painel" label="Painel Admin" icon={ShieldCheck} badge="Admin" />
        )}
      </div>

      <div className="pt-0">
        <MobileDrawerLink to="/dashboard/configuracoes" label="Configurações" icon={Settings} />
      </div>

      <div className="pt-0">
        <button
          type="button"
          onClick={handleSignOut}
          className="flex min-h-14 w-full items-center gap-4 border-b border-black/[0.06] px-1 text-left text-[15px] font-semibold text-[#DC2626] transition active:bg-[#DC2626]/[0.06]"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center text-[#DC2626]">
            <LogOut size={22} strokeWidth={1.7} />
          </span>
          <span className="min-w-0 flex-1 truncate">Sair</span>
        </button>
      </div>
    </div>

    <InviteFriendModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
  </section>
  );
};

const MobileDashboardChrome = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { plan, loading: planLoading } = usePlan();
  const { foto } = useProfile();
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
  const isModelsRoute = location.pathname.startsWith("/dashboard/modelos");
  // O Atlas no mobile é tela cheia, no formato de um app de chat: sem a faixa
  // azul em cima nem a barra de abas embaixo, que roubavam duas faixas da
  // conversa e deixavam dois cabeçalhos empilhados.
  const isAtlasRoute = location.pathname.startsWith("/dashboard/atlas");
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
      const [userRole, affiliateRecord] = await Promise.allSettled([
        supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
        supabase.from("affiliates").select("user_id").eq("user_id", user.id).maybeSingle(),
      ]);

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

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      {/*
        Barra de marca, no lugar do preto #050505 que havia antes: é a faixa da cor da
        marca com a logo e os ícones bare, como no cabeçalho da referência. Os ícones
        perderam a pastilha `bg-white/10` — sobre a cor cheia ela virava ruído.
      */}
      {!isRootDashboard && !isAccountPage && !isModelsRoute && !isAtlasRoute && (
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between bg-[#2563EB] px-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {isCatalogProductDetail ? (
              /*
                Na ficha do produto a barra mostra a marca, e não o título da rota: o nome
                do produto já é o primeiro texto abaixo da foto, e repetir os dois deixava
                a mesma frase duas vezes na mesma dobra. O "voltar" desta tela é o botão
                flutuante sobre a foto — mesma divisão da referência.
              */
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="flex items-center gap-2 transition-opacity active:opacity-70"
                aria-label="Ir para o início"
              >
                <img src="/icones/velo-cesta-branca.png" alt="" aria-hidden="true" className="h-7 w-7 shrink-0 object-contain" />
                <span className="text-[19px] font-bold leading-none tracking-[-0.05em] text-white">Velo</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-colors active:bg-white/15"
                  aria-label="Voltar"
                >
                  <ArrowLeft size={20} />
                </button>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold leading-5 tracking-[-0.02em] text-white">{routeMeta.title}</p>
                  <p className="truncate text-[11px] font-medium text-white/70">Velo mobile</p>
                </div>
              </>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            {isCatalogProductDetail && (
              <button
                type="button"
                onClick={() => navigate("/dashboard/catalogo")}
                className="flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors active:bg-white/15"
                aria-label="Buscar no catálogo"
              >
                <Search size={20} strokeWidth={2} />
              </button>
            )}
            <div
              className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full text-white [&_button]:!flex [&_button]:!h-10 [&_button]:!w-10 [&_button]:!items-center [&_button]:!justify-center [&_button]:!text-white [&_svg]:!h-[20px] [&_svg]:!w-[20px] [&_svg]:!text-white"
            >
              <NotificacoesPopover />
            </div>
          </div>
        </header>
      )}

      <main
        className={`min-h-0 flex-1 overflow-x-hidden ${
          isAtlasRoute
            ? "flex overflow-hidden p-0"
            : `overflow-y-auto pb-[calc(96px+env(safe-area-inset-bottom))] ${isRootDashboard ? "px-0 pt-0" : "px-4 pt-4"}`
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

      <nav
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.08] bg-white/95 px-2 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] backdrop-blur-xl md:hidden ${
          isAtlasRoute ? "hidden" : ""
        }`}
      >
        {/* items-end: o disco do Atlas sobe, mas os rótulos ficam na mesma linha. */}
        <div className="mx-auto flex max-w-[480px] items-end gap-1">
          <MobileBottomItem to="/dashboard" label="Início" icon={NavHomeIcon} active={location.pathname === "/dashboard"} />
          <MobileBottomItem to="/dashboard/pedidos" label="Pedidos" icon={NavOrdersIcon} active={location.pathname.startsWith("/dashboard/pedidos")} />
          <MobileAtlasButton active={location.pathname.startsWith("/dashboard/atlas")} />
          <MobileBottomItem to="/dashboard/resultados" label="Resultados" icon={NavResultsIcon} active={location.pathname.startsWith("/dashboard/resultados")} />
          <MobileBottomItem to="/dashboard/minha-conta" label="Minha Conta" icon={NavAccountIcon} active={isAccountPage || location.pathname === "/colecoes" || location.pathname.startsWith("/dashboard/configuracoes")} />
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
  const { aberto: atlasAberto } = useAtlasChat();
  const isMobile = useIsMobile();
  // Exibição do novo onboarding em modal — gating próprio, independente do
  // estado de loja/perfil no Supabase. Abre no primeiro acesso após o cadastro
  // e não reaparece depois de concluído (flag em localStorage por usuário).
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setShowOnboarding(false);
      return;
    }
    setShowOnboarding(shouldShowOnboarding(user));
  }, [user]);

  // Chamado ao concluir o onboarding.
  const handleOnboardingComplete = (respostas: Record<string, string>) => {
    if (!user?.id) return;
    markOnboardingSeen(user.id);
    // Limpa a flag durável no Supabase Auth: `velo_onboarding_pending` é gravada
    // no cadastro e persiste no servidor. Sem isto, `isFreshSignup` continuaria
    // verdadeiro para sempre e o modal reapareceria em qualquer navegador/
    // dispositivo onde o marcador de localStorage não existe.
    //
    // As respostas do quiz vão junto: são elas que a vitrine do guia usa para
    // recomendar produtos. Antes eram descartadas ao fechar o modal.
    void supabase.auth.updateUser({
      data: { velo_onboarding_pending: false, [CHAVE_RESPOSTAS_DO_QUIZ]: respostas },
    });
    setShowOnboarding(false);
  };

  useEffect(() => {
    if (!user?.id) return;
    void attachReferralToCurrentUser(user.id);
  }, [user?.id]);

  // Broadcast presence on shared realtime channel (used by admin panel to count live users).
  useOnlinePresence(user?.id ?? null);
  useActivityTracker(user?.id ?? null);

  const isStartMode = false;
  const { plan: currentPlan, loading: planLoading } = usePlan();
  const showFreePlanBanner = !planLoading && currentPlan === "gratis";
  // A barra do topo (nome da tela + sino) some em quase tudo: cada página já
  // abre com o próprio título e a seta de voltar, e os dois cabeçalhos
  // empilhados só repetiam a mesma informação. Sobra nas telas de conta —
  // assinatura e configurações —, que não têm cabeçalho próprio.
  const HEADER_ROUTES = [
    "/dashboard/configuracoes",
    "/dashboard/planos",
    "/dashboard/pagamentos",
    "/dashboard/assinatura",
  ];
  const showDesktopHeader = HEADER_ROUTES.some(
    (rota) => location.pathname === rota || location.pathname.startsWith(`${rota}/`),
  );
  const isCatalogRoute = location.pathname.startsWith("/dashboard/catalogo");
  const isCatalogProductDetailRoute = /^\/dashboard\/catalogo\/[^/]+$/.test(location.pathname);
  // Configurações usa layout sem moldura, então o fundo da área principal é branco.
  const isSettingsRoute = location.pathname.startsWith("/dashboard/configuracoes");
  // Imagens com IA usa um cinza neutro em vez do bege do `body`: o painel da tela
  // é quase branco e, sobre bege, a diferença de temperatura ficava evidente.
  const isAiImagesRoute = location.pathname.startsWith("/dashboard/imagens-ia");
  const showSupportWidget =
    location.pathname !== "/dashboard" &&
    location.pathname !== "/colecoes" &&
    !location.pathname.startsWith("/dashboard/atlas") &&
    // Na ficha do produto a bolha cobria o botão de publicar, que é a ação da tela.
    !isCatalogProductDetailRoute;

  useEffect(() => {
    const params = new URLSearchParams(location.search);

    if (params.get("ml_connected") === "true") {
      const retorno = lerRetornoMl();

      // Quem começou pelo chat do Atlas volta pela própria conversa: o
      // AtlasChatProvider cuida da restauração, então aqui não mexemos na URL.
      if (retorno?.origem === "atlas") return;

      veloToast.success("Mercado Livre conectado com sucesso!", {
        action: { label: "Ver", onClick: () => navigate("/dashboard/configuracoes") },
      });
      // Avisa a aba de origem (Configurações) que a conexão terminou.
      try {
        const canal = new BroadcastChannel("velo-ml");
        canal.postMessage({ tipo: "ml-conectado" });
        canal.close();
      } catch {
        /* navegador sem BroadcastChannel: apenas ignora */
      }

      // Veio de Configurações em outra aba: fecha esta e devolve o foco.
      if (retorno?.origem === "config" && window.opener && window.opener !== window) {
        limparRetornoMl();
        window.close();
        return;
      }
      limparRetornoMl();
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

  // Aba original: recebe o aviso da aba que concluiu o OAuth do Mercado Livre.
  useEffect(() => {
    let canal: BroadcastChannel | null = null;
    try {
      canal = new BroadcastChannel("velo-ml");
    } catch {
      return;
    }
    canal.onmessage = (evento) => {
      if (evento.data?.tipo !== "ml-conectado") return;
      veloToast.success("Mercado Livre conectado! Pode continuar por aqui.");
      window.dispatchEvent(new CustomEvent("velo:ml-conectado"));
    };
    return () => canal?.close();
  }, []);


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
              <PageOutlet />
          </MobileDashboardChrome>
        </div>
        <NotificationBannerStack />
        {showSupportWidget && !atlasAberto && <SupportFloatingWidget />}
        {showOnboarding && <OnboardingModal onComplete={handleOnboardingComplete} />}
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
          {/* Aviso de plano gratuito — só acima da coluna de conteúdo, à direita
              da sidebar (a sidebar continua ocupando a altura total). */}
          <FreePlanBanner isVisible={showFreePlanBanner} />
          {/* Header - no shell cinza */}
          {showDesktopHeader && <DashboardHeader />}
          {/* Main content area - sem moldura externa */}
          {/* Duas colunas: conteúdo à esquerda e o Atlas ancorado à direita. O
              painel fica FORA do <main>, então a navegação troca só o conteúdo e
              a conversa permanece na tela. */}
          <div className="relative flex min-h-0 flex-1 overflow-hidden">
            <main
              data-dashboard-tour="dashboard-main"
              className="flex min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden p-5 sm:p-6 lg:p-7"
              style={{
                background: isCatalogRoute || isSettingsRoute
                  ? "#FFFFFF"
                  : isAiImagesRoute
                    ? "#F4F4F6"
                    : "transparent",
              }}
            >
              <PageErrorBoundary>
                <PageOutlet />
              </PageErrorBoundary>
            </main>

            <AtlasDockPanel />
          </div>
        </div>
      </div>
      {showOnboarding && <OnboardingModal onComplete={handleOnboardingComplete} />}
      {/* Fica no layout, e não numa página: a vitrine é chamada do chat e
          precisa aparecer por cima de qualquer rota. */}
      <AtlasProductShowcase />
      <NotificationBannerStack />
      {showSupportWidget && !atlasAberto && <SupportFloatingWidget />}
    </div>
  );
};

const DashboardLayout = () => <DashboardLayoutInner />;

export default DashboardLayout;
