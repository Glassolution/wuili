import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { User } from "@supabase/supabase-js";
import { ArrowUpRight, FlaskConical, Rocket, ShoppingCart, Store } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { VeloLogo } from "@/components/VeloLogo";
import StoreMockupPreview from "@/components/onboarding/StoreMockupPreview";
import { listItem, listStagger, screenEnter } from "@/components/onboarding/flowMotion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isAdminEmail } from "@/lib/adminAccess";
import { usePlan } from "@/hooks/usePlan";
import { toast } from "sonner";

export type ExampleProduct = {
  id: string;
  title: string;
  price: number;
  imageUrl: string;
};

const VeloIconLink = () => (
  <Link to="/" className="inline-flex items-center justify-center text-[#111827]" aria-label="Velo">
    <svg width="42" height="42" viewBox="0 0 48 48" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M33 18 A11 11 0 1 0 33 30" stroke="currentColor" strokeWidth="3.7" strokeLinecap="round" />
      <path d="M30 26 L34 30 L38 26" stroke="currentColor" strokeWidth="3.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </Link>
);

const WELCOME_ANIMATION_MS = 2800;

// A tela "Cadastro concluído / Bem-vindo" só deve aparecer no primeiro acesso
// logo após o cadastro. Quem já tem conta e está apenas fazendo login não pode
// vê-la novamente. Consideramos "cadastro recente" quando o último login ocorreu
// a até 10 minutos da criação da conta (mesma heurística do DashboardLayout).
const isFreshSignup = (user: User | null): boolean => {
  if (!user) return false;
  const createdAt = new Date(user.created_at).getTime();
  const lastSignInAt = new Date(user.last_sign_in_at ?? "").getTime();
  return (
    Number.isFinite(createdAt) &&
    Number.isFinite(lastSignInAt) &&
    Math.abs(lastSignInAt - createdAt) <= 10 * 60 * 1000
  );
};

const StartChoicePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role, loading } = useAuth();
  const justSignedUp = (location.state as { justSignedUp?: boolean } | null)?.justSignedUp === true;
  // null = ainda decidindo (aguardando o auth carregar) para não piscar a tela errada.
  const [showWelcome, setShowWelcome] = useState<boolean | null>(null);
  const [welcomeReady, setWelcomeReady] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const metadataRole =
    (user?.app_metadata?.role as string | undefined) ??
    (user?.user_metadata?.role as string | undefined);
  const isAdmin = role === "admin" || metadataRole === "admin" || isAdminEmail(user?.email);

  // Decide o destino assim que o auth terminar de carregar.
  // - Cadastro recém-concluído (signup ou primeiro acesso): mostra o fluxo de onboarding.
  // - Quem já tem conta e apenas fez login: vai direto ao dashboard, pulando o cadastro.
  //   (Admins mantêm acesso a esta tela para testes internos.)
  useEffect(() => {
    if (loading || showWelcome !== null) return;
    const fresh = justSignedUp || isFreshSignup(user);
    if (!fresh && !isAdmin) {
      navigate("/dashboard", { replace: true });
      return;
    }
    setShowWelcome(fresh);
  }, [loading, user, justSignedUp, isAdmin, showWelcome, navigate]);

  useEffect(() => {
    if (!showWelcome) return;
    setWelcomeReady(false);
    const timer = window.setTimeout(() => setWelcomeReady(true), WELCOME_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [showWelcome]);

  useEffect(() => {
    let mounted = true;

    const loadUserName = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user || !mounted) return;

      const metadataName =
        typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : typeof user.user_metadata?.name === "string"
            ? user.user_metadata.name
            : "";

      const fallbackName = metadataName || user.email?.split("@")[0] || "";

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!mounted) return;
      setDisplayName((profile?.display_name || fallbackName).trim());
    };

    loadUserName();

    return () => {
      mounted = false;
    };
  }, []);

  const { plan: currentPlan } = usePlan();
  const isFreePlan = !isAdmin && (currentPlan === "gratis" || currentPlan === "go");

  const goToPath = (path: "store" | "sales-page" | "catalog" | "example") => {
    // Ir ao catálogo é apenas navegação: não cria loja nem página, então não
    // passa pelo bloqueio de plano nem pelo fluxo de escolha de produto.
    if (path === "catalog") {
      sessionStorage.setItem("velo-onboarding-choice", path);
      navigate("/dashboard/catalogo");
      return;
    }
    // Usuários gratuitos podem CRIAR páginas de vendas — a cobrança acontece
    // no momento de publicar. Apenas a criação de LOJA COMPLETA fica bloqueada.
    if (isFreePlan && path !== "sales-page") {
      toast.error("Assine um plano pago para criar sua loja completa.");
      navigate("/dashboard/planos");
      return;
    }
    sessionStorage.setItem("velo-onboarding-choice", path);
    navigate("/onboarding/escolher-produto", { state: { onboardingChoice: path } });
  };

  // Enquanto o auth carrega ainda não sabemos se é cadastro recente; evitamos
  // renderizar a tela errada mostrando apenas um fundo branco neutro.
  if (loading || showWelcome === null) {
    return <main className="min-h-screen bg-white" />;
  }

  if (showWelcome) {
    return (
      <main
        className="min-h-screen overflow-hidden bg-white text-[#111827]"
        style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
      >
        <style>
          {`
            @keyframes veloLogoIntro {
              0% { opacity: 0; transform: translateY(-18px) scale(.92); filter: blur(8px); }
              70% { opacity: 1; transform: translateY(2px) scale(1.02); filter: blur(0); }
              100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
            }

            @keyframes veloTextLift {
              0% { opacity: 0; transform: translateY(22px); filter: blur(10px); }
              100% { opacity: 1; transform: translateY(0); filter: blur(0); }
            }

            @keyframes veloHeroReveal {
              0% { opacity: 0; transform: translateY(34px) scale(.94); clip-path: inset(0 46% 0 46%); filter: blur(12px); }
              48% { opacity: 1; clip-path: inset(0 18% 0 18%); filter: blur(5px); }
              100% { opacity: 1; transform: translateY(0) scale(1); clip-path: inset(0 0 0 0); filter: blur(0); }
            }

            @keyframes veloSoftGlow {
              0%, 100% { opacity: .18; transform: scale(.92); }
              50% { opacity: .46; transform: scale(1.08); }
            }

            @keyframes veloButtonIntro {
              0% { opacity: 0; transform: translateY(18px) scale(.98); filter: blur(6px); }
              100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
            }

            @keyframes veloCooldownFill {
              0% { transform: scaleX(0); }
              100% { transform: scaleX(1); }
            }

            .velo-welcome-logo {
              opacity: 0;
              animation: veloLogoIntro 760ms cubic-bezier(.2,.85,.2,1) 90ms forwards;
            }

            .velo-welcome-kicker {
              opacity: 0;
              animation: veloTextLift 760ms cubic-bezier(.2,.85,.2,1) 640ms forwards;
            }

            .velo-welcome-title {
              opacity: 0;
              animation: veloTextLift 840ms cubic-bezier(.16,1,.3,1) 840ms forwards;
            }

            .velo-welcome-copy {
              opacity: 0;
              animation: veloTextLift 760ms cubic-bezier(.2,.85,.2,1) 1060ms forwards;
            }

            .velo-welcome-hero {
              opacity: 0;
              animation: veloHeroReveal 1180ms cubic-bezier(.16,1,.3,1) 1320ms forwards;
            }

            .velo-welcome-button {
              opacity: 0;
              animation: veloButtonIntro 720ms cubic-bezier(.2,.85,.2,1) 2140ms forwards;
            }

            .velo-welcome-glow {
              animation: veloSoftGlow 2400ms ease-in-out 900ms infinite;
            }

            .velo-button-cooldown {
              transform-origin: left center;
              animation: veloCooldownFill ${WELCOME_ANIMATION_MS}ms linear forwards;
            }
          `}
        </style>
        <section className="flex min-h-screen flex-col items-center px-6 pb-8 pt-6">
          <div className="velo-welcome-logo">
            <VeloIconLink />
          </div>

          <div className="mt-[82px] flex w-full max-w-[820px] flex-col items-center text-center">
            <p className="velo-welcome-kicker text-[10px] font-bold uppercase tracking-[0.22em] text-[#777d89]">
              Cadastro concluído
            </p>
            <h1 className="velo-welcome-title mt-4 text-[26px] font-semibold tracking-[-0.045em] text-black sm:text-[31px]">
              Bem-vindo{displayName ? `, ${displayName}` : ""}!
            </h1>
            <p className="velo-welcome-copy mt-3 max-w-[390px] text-[12px] font-medium leading-5 text-[#7a8190]">
              Sua conta foi criada com sucesso. Agora vamos configurar seu primeiro caminho de venda.
            </p>

            <div className="relative mt-0 w-full max-w-[660px]">
              <div className="velo-welcome-glow pointer-events-none absolute inset-x-10 bottom-7 h-16 rounded-full bg-black/10 blur-3xl" />
              <img
                src="/assets/onboarding-welcome-hero.png"
                alt="Boas-vindas à Velo"
                className="velo-welcome-hero relative z-10 w-full object-contain"
              />
            </div>

            <button
              type="button"
              onClick={() => welcomeReady && setShowWelcome(false)}
              disabled={!welcomeReady}
              className="velo-welcome-button relative mt-8 flex h-[52px] w-full max-w-[440px] items-center justify-center overflow-hidden rounded-[12px] bg-black text-[15px] font-semibold text-white shadow-[0_16px_40px_rgba(0,0,0,0.16)] transition hover:-translate-y-0.5 hover:bg-[#202020] disabled:cursor-not-allowed disabled:bg-black/70 disabled:text-white/75 disabled:hover:translate-y-0"
            >
              {!welcomeReady ? <span className="velo-button-cooldown absolute inset-y-0 left-0 w-full bg-white/12" /> : null}
              <span className="relative z-10">Continuar</span>
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
  <main className="velo-flow min-h-screen">
    <div className="grid min-h-screen lg:grid-cols-[55%_45%]">
      <section className="relative flex min-h-screen flex-col items-center overflow-hidden px-6 py-7 sm:px-9 lg:px-12">
        <Link to="/" className="absolute left-6 top-7 sm:left-9 lg:left-12" aria-label="Velo">
          <VeloLogo size="sm" variant="light" />
        </Link>

        <div
          className="absolute left-1/2 top-7 w-[210px] -translate-x-1/2"
          role="progressbar"
          aria-label="Progresso da configuração"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={18}
        >
          <div className="h-[5px] w-[210px] overflow-hidden rounded-[1px] bg-white/10">
            <div className="h-full bg-white transition-all duration-300" style={{ width: "18%" }} />
          </div>
        </div>

        <motion.div {...screenEnter} className="mt-[76px] w-full max-w-[580px]">
          <h1 className="vf-headline text-[24px] font-medium leading-[30px] tracking-[-0.6px]">Como você quer começar?</h1>
          <p className="vf-subhead mt-2 text-[18px] font-normal leading-[28px]">Escolha o caminho que combina com o seu momento — nós cuidamos do resto.</p>

          <motion.div variants={listStagger} initial="initial" animate="animate" className="mt-11">
            <div className="grid grid-cols-3 gap-2">
              <motion.div
                variants={listItem}
                aria-disabled="true"
                data-disabled="true"
                className="vf-card relative flex min-h-[218px] cursor-not-allowed flex-col items-center justify-center gap-2 rounded-[10px] px-[10px] py-12 text-center"
              >
                <span className="absolute right-3 top-3 rounded-full bg-[var(--vf-nested)] px-2 py-[3px] text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--vf-text-3)]">
                  Em breve
                </span>
                <span className="flex h-12 w-12 items-center justify-center rounded-[7px] bg-[var(--vf-nested)] text-[var(--vf-text-3)]">
                  <Store size={22} strokeWidth={1.8} />
                </span>
                <span className="text-[16px] font-medium leading-[20px] text-[var(--vf-text-2)]">
                  Criar minha loja
                </span>
              </motion.div>

              <motion.button
                variants={listItem}
                type="button"
                onClick={() => goToPath("sales-page")}
                className="vf-card flex min-h-[218px] flex-col items-center justify-center gap-2 rounded-[10px] px-[10px] py-12 text-center outline-none focus-visible:border-[var(--vf-border-hover)]"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-[7px] bg-[#2563EB] text-white">
                  <Rocket size={22} strokeWidth={1.8} />
                </span>
                <span className="text-[16px] font-medium leading-[20px] text-[var(--vf-text-1)]">
                  Criar página de vendas
                </span>
              </motion.button>

              <motion.button
                variants={listItem}
                type="button"
                onClick={() => goToPath("catalog")}
                className="vf-card flex min-h-[218px] flex-col items-center justify-center gap-2 rounded-[10px] px-[10px] py-12 text-center outline-none focus-visible:border-[var(--vf-border-hover)]"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-[7px] bg-[#7C3AED] text-white">
                  <ShoppingCart size={22} strokeWidth={1.8} />
                </span>
                <span className="text-[16px] font-medium leading-[20px] text-[var(--vf-text-1)]">
                  Ir direto para o catálogo
                </span>
              </motion.button>
            </div>

            {isAdmin ? (
              <>
                <div className="my-2 flex items-center gap-4">
                  <span className="h-px flex-1 bg-[var(--vf-border)]" />
                  <span className="text-[14px] font-medium text-[var(--vf-text-3)]">ou</span>
                  <span className="h-px flex-1 bg-[var(--vf-border)]" />
                </div>

                <motion.button
                  variants={listItem}
                  type="button"
                  onClick={() => goToPath("example")}
                  className="vf-card group flex min-h-[90px] w-full items-center gap-4 rounded-[10px] px-6 py-4 text-left outline-none focus-visible:border-[var(--vf-border-hover)]"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[7px] bg-[#F59E0B] text-white">
                    <FlaskConical size={22} strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-medium leading-[20px] text-[var(--vf-text-1)]">
                      Testar um produto de exemplo
                    </span>
                    <span className="mt-1 block text-[12.5px] leading-5 text-[var(--vf-text-2)]">
                      Descubra como a Velo funciona
                    </span>
                  </span>
                  <ArrowUpRight size={18} className="shrink-0 text-[var(--vf-text-3)] transition group-hover:text-[var(--vf-text-1)]" />
                </motion.button>
              </>
            ) : null}
          </motion.div>
        </motion.div>
      </section>

      <aside className="relative hidden min-h-screen items-center justify-center overflow-hidden border-l border-[var(--vf-border)] bg-[var(--vf-panel-side)] lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: "radial-gradient(circle, rgb(255,255,255) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <StoreMockupPreview className="relative z-10 scale-[0.84]" />
      </aside>
    </div>
  </main>
  );
};

export default StartChoicePage;
