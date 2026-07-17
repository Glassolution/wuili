import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ArrowUpRight, FlaskConical, PackageOpen, Store } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import StoreMockupPreview from "@/components/onboarding/StoreMockupPreview";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isAdminEmail } from "@/lib/adminAccess";

export type ExampleProduct = {
  id: string;
  title: string;
  price: number;
  imageUrl: string;
};

const VeloWordmark = () => (
  <Link to="/" className="inline-flex items-center gap-2 text-[#111827]" aria-label="Velo">
    <svg width="24" height="24" viewBox="0 0 48 48" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M33 18 A11 11 0 1 0 33 30" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M30 26 L34 30 L38 26" stroke="currentColor" strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <span className="text-[15px] font-bold tracking-[-0.04em]">Velo</span>
  </Link>
);

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

const feedbackCards = [
  {
    name: "Marina Alves",
    role: "Primeira loja no ar",
    quote: "Montei minha vitrine em poucos minutos e entendi exatamente o próximo passo.",
  },
  {
    name: "Rafael Costa",
    role: "Produtos importados",
    quote: "A escolha inicial ficou simples. Parece que a loja já nasce pronta para vender.",
  },
  {
    name: "Bianca Moura",
    role: "Catálogo Velo",
    quote: "Gostei porque não precisei pensar em tudo do zero. O fluxo me guiou.",
  },
  {
    name: "Lucas Mendes",
    role: "Setup rápido",
    quote: "Visual limpo, direto e com cara profissional desde o primeiro clique.",
  },
];

const StartChoicePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role, loading } = useAuth();
  const justSignedUp = (location.state as { justSignedUp?: boolean } | null)?.justSignedUp === true;
  // null = ainda decidindo (aguardando o auth carregar) para não piscar a tela errada.
  const [showWelcome, setShowWelcome] = useState<boolean | null>(null);
  const [welcomeReady, setWelcomeReady] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [selectedPath, setSelectedPath] = useState<"store" | "sales-page" | "example" | null>(null);
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

  const continueToSelection = () => {
    if (!selectedPath) return;
    navigate("/onboarding/escolher-produto", { state: { onboardingChoice: selectedPath } });
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

            @keyframes veloFeedbackMarquee {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
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
              className="velo-welcome-button relative -mt-1 flex h-[52px] w-full max-w-[440px] items-center justify-center overflow-hidden rounded-[12px] bg-black text-[15px] font-semibold text-white shadow-[0_16px_40px_rgba(0,0,0,0.16)] transition hover:-translate-y-0.5 hover:bg-[#202020] disabled:cursor-not-allowed disabled:bg-black/70 disabled:text-white/75 disabled:hover:translate-y-0"
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
  <main
    className="min-h-screen bg-[#fbfbfc] text-[#111827]"
    style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
  >
    <style>
      {`
        @keyframes veloFeedbackMarquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}
    </style>
    <div className="grid min-h-screen lg:grid-cols-[55%_45%]">
      <section className="relative flex min-h-screen flex-col overflow-hidden px-6 py-6 sm:px-9 lg:px-14 lg:py-7 xl:px-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_34%_35%,rgba(0,0,0,0.035),transparent_34%)]" />
        <header className="relative z-10 flex min-h-7 items-center">
          <VeloWordmark />
          <div
            className="absolute right-0 hidden w-[38%] max-w-[250px] sm:block"
            role="progressbar"
            aria-label="Progresso da configuração"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={18}
          >
            <div className="h-[4px] overflow-hidden rounded-full bg-[#e5e8ef]">
              <div className="h-full w-[18%] rounded-full bg-black" />
            </div>
          </div>
        </header>

        <div className="relative z-10 mx-auto mt-12 w-full max-w-[700px] pb-40 sm:mt-14 lg:mt-9 xl:mt-10">
          <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.18em] text-[#697083]">Seu primeiro passo</p>
          <h1 className="max-w-[500px] text-[28px] font-semibold leading-[1.08] tracking-[-0.045em] text-[#121827] sm:text-[31px] lg:text-[33px]">
            Como você quer começar?
          </h1>
          <p className="mt-3 max-w-[500px] text-[13px] font-normal leading-[1.55] text-[#687086] sm:text-[13.5px]">
            Escolha o caminho que combina com o seu momento. Você pode montar sua loja completa ou criar uma página de vendas focada em um produto.
          </p>

          <div className="mt-8 w-full max-w-[650px]">
            <div className="grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setSelectedPath("store")}
                aria-pressed={selectedPath === "store"}
                className={`group relative min-h-[178px] rounded-[20px] border bg-white p-5 text-left shadow-[0_18px_50px_rgba(15,23,42,0.07)] outline-none transition duration-200 hover:-translate-y-0.5 hover:border-black/30 hover:shadow-[0_22px_60px_rgba(15,23,42,0.1)] focus-visible:ring-4 focus-visible:ring-black/10 ${
                  selectedPath === "store" ? "border-black ring-1 ring-black" : "border-[#dfe4ed]"
                }`}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-black text-white shadow-[0_14px_34px_rgba(0,0,0,0.16)]">
                  <Store size={19} strokeWidth={1.8} />
                </span>
                <span className="mt-14 flex items-end justify-between gap-4">
                  <span>
                    <span className="block text-[15px] font-semibold tracking-[-0.035em] text-[#111827]">Criar minha loja</span>
                    <span className="mt-2 block max-w-[210px] text-[12.5px] leading-5 text-[#687086]">
                      Monte sua loja com produtos selecionados do catálogo Velo.
                    </span>
                  </span>
                  <ArrowUpRight size={18} className="shrink-0 text-[#9aa2b5] transition group-hover:text-black" />
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPath("sales-page")}
                aria-pressed={selectedPath === "sales-page"}
                className={`group relative min-h-[178px] rounded-[20px] border bg-white p-5 text-left shadow-[0_18px_50px_rgba(15,23,42,0.07)] outline-none transition duration-200 hover:-translate-y-0.5 hover:border-black/30 hover:shadow-[0_22px_60px_rgba(15,23,42,0.1)] focus-visible:ring-4 focus-visible:ring-black/10 ${
                  selectedPath === "sales-page" ? "border-black ring-1 ring-black" : "border-[#dfe4ed]"
                }`}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-black text-white shadow-[0_14px_34px_rgba(0,0,0,0.16)]">
                  <PackageOpen size={19} strokeWidth={1.8} />
                </span>
                <span className="mt-14 flex items-end justify-between gap-4">
                  <span>
                    <span className="block text-[15px] font-semibold tracking-[-0.035em] text-[#111827]">Criar página de vendas</span>
                    <span className="mt-2 block max-w-[210px] text-[12.5px] leading-5 text-[#687086]">
                      Personalize uma oferta focada em um produto e prepare sua página para vender.
                    </span>
                  </span>
                  <ArrowUpRight size={18} className="shrink-0 text-[#9aa2b5] transition group-hover:text-black" />
                </span>
              </button>
            </div>

            {isAdmin ? (
              <>
                <div className="my-5 flex items-center gap-4 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9aa2b5]">
                  <span className="h-px flex-1 bg-[#e1e5ed]" />
                  ou
                  <span className="h-px flex-1 bg-[#e1e5ed]" />
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedPath("example")}
                  aria-pressed={selectedPath === "example"}
                  className={`group flex min-h-[88px] w-full items-center gap-5 rounded-[20px] border bg-white p-5 text-left shadow-[0_18px_50px_rgba(15,23,42,0.07)] outline-none transition duration-200 hover:-translate-y-0.5 hover:border-black/30 hover:shadow-[0_22px_60px_rgba(15,23,42,0.1)] focus-visible:ring-4 focus-visible:ring-black/10 ${
                    selectedPath === "example" ? "border-black ring-1 ring-black" : "border-[#dfe4ed]"
                  }`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-black text-white shadow-[0_14px_34px_rgba(0,0,0,0.16)]">
                    <FlaskConical size={19} strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold tracking-[-0.035em] text-[#111827]">Testar com produto de exemplo</span>
                    <span className="mt-1 block truncate text-[12.5px] leading-5 text-[#687086]">
                      Veja como funciona antes de importar seus próprios produtos.
                    </span>
                  </span>
                  <ArrowUpRight size={18} className="shrink-0 text-[#9aa2b5] transition group-hover:text-black" />
                </button>
              </>
            ) : null}
          </div>
        </div>

        <div className="absolute inset-x-6 bottom-8 z-20 flex justify-center sm:inset-x-9 lg:inset-x-14 xl:inset-x-20">
          <button
            type="button"
            onClick={continueToSelection}
            disabled={!selectedPath}
            className="flex h-12 w-full max-w-[520px] items-center justify-center rounded-[14px] bg-black text-[14px] font-semibold text-white shadow-[0_18px_45px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 hover:bg-[#202020] disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-[#d8dde8] disabled:text-[#8b94a6] disabled:shadow-none"
          >
            Continuar
          </button>
        </div>
      </section>

      <aside className="relative hidden min-h-screen items-center justify-center overflow-hidden border-l border-[#edf0f5] bg-white lg:flex">
        <div className="pointer-events-none absolute left-0 right-0 top-0 z-[2] overflow-hidden bg-white py-6">
          <div className="flex w-max gap-3 [animation:veloFeedbackMarquee_22s_linear_infinite]">
            {[...feedbackCards, ...feedbackCards].map((feedback, index) => (
              <div
                key={`${feedback.name}-${index}`}
                className="w-[230px] rounded-[18px] bg-[#1a1a1a] px-4 py-3 text-white shadow-none ring-1 ring-black/5"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-black text-black">
                    {feedback.name
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-semibold leading-tight">{feedback.name}</p>
                    <p className="truncate text-[10px] text-white/55">{feedback.role}</p>
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-white/72">“{feedback.quote}”</p>
              </div>
            ))}
          </div>
        </div>
        <StoreMockupPreview className="relative z-10 scale-[0.84]" />
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-[2] flex h-[168px] items-end overflow-hidden bg-white pb-7 pt-12">
          <div className="flex w-max gap-3 [animation:veloFeedbackMarquee_24s_linear_infinite_reverse]">
            {[...feedbackCards, ...feedbackCards].map((feedback, index) => (
              <div
                key={`bottom-${feedback.name}-${index}`}
                className="w-[230px] rounded-[18px] bg-[#1a1a1a] px-4 py-3 text-white shadow-none ring-1 ring-black/5"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-black text-[#1a1a1a]">
                    {feedback.name
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-semibold leading-tight">{feedback.name}</p>
                    <p className="truncate text-[10px] text-white/55">{feedback.role}</p>
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-white/72">“{feedback.quote}”</p>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  </main>
  );
};

export default StartChoicePage;
