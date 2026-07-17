import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Globe, ShoppingBag, Sparkles } from "lucide-react";
import type { ExampleProduct } from "@/pages/StartChoicePage";
import { useAuth } from "@/contexts/AuthContext";
import { markStoreFlowCompleted } from "@/lib/storeFlowCompletion";

type FlowState = { product: ExampleProduct; language: string; persona: string; salesAngle: string };
type OnboardingChoice = "store" | "sales-page" | "example";

const FONT_STACK = 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif';

const formatBRL = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Frases curtas que passam durante o loading. Trocam sozinhas, dando a sensação
// de trabalho sem prender o usuário numa lista longa de etapas.
const loadingPhrases = [
  "Importando seu produto",
  "Escrevendo o conteúdo de vendas",
  "Montando o tema da loja",
];

// Loading enxuto: ~2,4s no total. Precisa bater com a soma abaixo.
const PHRASE_DURATION_MS = 800;
const LOADING_DURATION_MS = loadingPhrases.length * PHRASE_DURATION_MS;

// Precisa bater com a duração de veloScreenLeave.
const LEAVE_DURATION_MS = 420;

// Leque de 5 cards. rotate/lift montam um arco suave (centro mais alto); z faz
// o card central ficar por cima na sobreposição. Sombra leve em camadas dentro
// de cada card — nunca uma sombra pesada única sob o grupo.
type FanCard = { label: string; rotate: number; lift: number; z: number; body: React.ReactNode };

const StoreBuildProgressPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const flow = useMemo<FlowState | null>(() => {
    const state = location.state as Partial<FlowState> | null;
    let product = state?.product; let language = state?.language; let persona = state?.persona; let salesAngle = state?.salesAngle;
    try {
      if (!product) { const value = sessionStorage.getItem("velo-example-product"); product = value ? JSON.parse(value) as ExampleProduct : undefined; }
      language ||= sessionStorage.getItem("velo-store-language") || undefined;
      persona ||= sessionStorage.getItem("velo-customer-persona") || undefined;
      salesAngle ||= sessionStorage.getItem("velo-sales-angle") || undefined;
    } catch { return null; }
    return product && language && persona && salesAngle ? { product, language, persona, salesAngle } : null;
  }, [location.state]);

  const [ready, setReady] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const phraseTimer = window.setInterval(() => {
      setPhraseIndex((index) => Math.min(loadingPhrases.length - 1, index + 1));
    }, PHRASE_DURATION_MS);
    const readyTimer = window.setTimeout(() => setReady(true), LOADING_DURATION_MS);
    return () => {
      window.clearInterval(phraseTimer);
      window.clearTimeout(readyTimer);
    };
  }, []);

  // Precisa ficar acima do return condicional: hook depois de early return roda
  // fora de ordem se `flow` deixar de ser nulo entre renders.
  useEffect(() => {
    if (ready && flow && user?.id) markStoreFlowCompleted(user.id, flow);
  }, [ready, flow, user?.id]);

  if (!flow) return <Navigate to="/comecar" replace />;

  const product = flow.product;
  const isSalesPage = sessionStorage.getItem("velo-onboarding-choice") === "sales-page";
  const primaryLabel = isSalesPage ? "Ver a minha página" : "Ver a minha loja";

  const goToNextScreen = () => {
    const onboardingChoice = sessionStorage.getItem("velo-onboarding-choice") as OnboardingChoice | null;
    if (onboardingChoice === "sales-page") {
      navigate("/minha-loja/editor", { replace: true, state: flow });
      return;
    }

    try {
      sessionStorage.setItem("velo-dashboard-store-tour", "1");
    } catch {
      // O redirecionamento não deve falhar por indisponibilidade do storage.
    }
    navigate("/dashboard?tour=loja", { replace: true });
  };

  // Deixa a tela sair antes de navegar, senão o editor aparece de estalo.
  const finishOnboarding = () => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(goToNextScreen, LEAVE_DURATION_MS);
  };

  // Sombra leve em camadas, aplicada por card (não sob o grupo).
  const cardShadow = "0 4px 12px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.06)";

  const cards: FanCard[] = [
    {
      label: "Template",
      rotate: -4,
      lift: 0,
      z: 1,
      body: (
        <div className="mt-2 overflow-hidden rounded-[8px] border border-black/[0.06]">
          <div className="flex items-center gap-1 bg-[#f6f6f8] px-2 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#dcdce1]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#dcdce1]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#dcdce1]" />
          </div>
          <div className="space-y-1.5 p-2">
            <div className="aspect-[16/10] rounded-[5px] bg-[linear-gradient(135deg,#eef1fb,#f3edfb)]" />
            <div className="h-1.5 w-full rounded-full bg-black/[0.08]" />
            <div className="h-1.5 w-2/3 rounded-full bg-black/[0.08]" />
            <div className="mt-1 h-3 w-12 rounded-[3px] bg-[#0a0a0a]" />
          </div>
        </div>
      ),
    },
    {
      label: "Produto",
      rotate: -2,
      lift: -4,
      z: 2,
      body: (
        <div className="relative mt-2 aspect-square overflow-hidden rounded-[8px] bg-[#f1f1f0]">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-[linear-gradient(135deg,#eef1fb,#f3edfb)]" />
          )}
          <span className="absolute bottom-1.5 left-1.5 rounded-full bg-white/95 px-2 py-0.5 text-[9px] font-semibold text-[#0a0a0a] shadow-sm">
            {formatBRL(product.price)}
          </span>
        </div>
      ),
    },
    {
      label: "Design",
      rotate: 0,
      lift: -8,
      z: 3,
      body: (
        <div className="mt-3 flex flex-1 flex-col items-center justify-center gap-3">
          <div className="flex items-center gap-2">
            <span className="h-5 w-5 rounded-full bg-[#0a0a0a]" />
            <span className="h-5 w-5 rounded-full border border-black/10 bg-white" />
            <span className="h-5 w-5 rounded-full bg-[#6d5cf5]" />
          </div>
          <span className="text-[26px] font-bold leading-none tracking-tight text-[#0a0a0a]">Aa</span>
          <span className="text-[10px] font-medium text-[#9ca3af]">Inter · Vitrine</span>
        </div>
      ),
    },
    {
      label: "Domínio",
      rotate: 2,
      lift: -4,
      z: 2,
      body: (
        <div className="mt-3 flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f3f4f6] text-[#0a0a0a]">
            <Globe size={17} strokeWidth={1.5} />
          </span>
          <span className="text-[11px] font-semibold leading-tight text-[#0a0a0a]">
            minhaloja<span className="font-normal text-[#9ca3af]">.velo.app</span>
          </span>
          <span className="rounded-full bg-[#eafbef] px-2 py-0.5 text-[9px] font-semibold text-[#1a8f43]">Grátis</span>
        </div>
      ),
    },
    {
      label: "Publicar",
      rotate: 4,
      lift: 0,
      z: 1,
      body: (
        <div className="mt-3 flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ffe600] text-[#2d3277]">
            <ShoppingBag size={17} strokeWidth={1.5} />
          </span>
          <span className="text-[11px] font-semibold leading-tight text-[#0a0a0a]">Mercado Livre</span>
          <span className="rounded-full bg-[#eafbef] px-2 py-0.5 text-[9px] font-semibold text-[#1a8f43]">Pronto</span>
        </div>
      ),
    },
  ];

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[linear-gradient(135deg,#c7d2f5_0%,#e4e8fb_100%)] px-4 py-10 text-[#0a0a0a]"
      style={{ fontFamily: FONT_STACK }}
    >
      <style>
        {`
          @keyframes veloSpin { to { transform: rotate(360deg); } }
          @keyframes veloPhraseIn { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0); } }
          @keyframes veloUp { 0% { opacity: 0; transform: translateY(14px); } 100% { opacity: 1; transform: translateY(0); } }
          @keyframes veloCardUp { 0% { opacity: 0; transform: translateY(26px); } 100% { opacity: 1; transform: translateY(0); } }
          @keyframes veloScreenLeave { 0% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(.98); } }
          @media (prefers-reduced-motion: reduce) { .velo-spin { animation: none !important; } }
        `}
      </style>

      {!ready ? (
        /* ── Loading curto e minimalista sobre o fundo gradiente ──────── */
        <section className="relative z-10 flex flex-col items-center text-center">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <svg viewBox="0 0 64 64" className="velo-spin absolute inset-0 h-full w-full [animation:veloSpin_.9s_linear_infinite]">
              <circle cx="32" cy="32" r="28" fill="none" stroke="#ffffff" strokeWidth="4" opacity="0.6" />
              <circle cx="32" cy="32" r="28" fill="none" stroke="#0a0a0a" strokeWidth="4" strokeLinecap="round" strokeDasharray="176" strokeDashoffset="128" />
            </svg>
          </div>
          <h1 className="mt-9 text-[22px] font-semibold tracking-[-0.02em]">Preparando sua loja</h1>
          <p key={phraseIndex} className="mt-2 text-[15px] font-medium text-[#6b7280] [animation:veloPhraseIn_.4s_ease]">
            {loadingPhrases[phraseIndex]}
          </p>
        </section>
      ) : (
        /* ── Card branco flutuante com todo o conteúdo ────────────────── */
        <section
          className="relative z-10 w-full max-w-[1000px] rounded-[32px] bg-white px-6 py-14 shadow-[0_24px_64px_rgba(0,0,0,0.10),0_2px_8px_rgba(0,0,0,0.04)] sm:px-12 sm:py-16"
          style={leaving ? { animation: `veloScreenLeave ${LEAVE_DURATION_MS}ms cubic-bezier(.4,0,.6,1) forwards` } : undefined}
        >
          <div className="flex flex-col items-center text-center">
            {/* Badge — cinza neutro, não roxo */}
            <div className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-3.5 py-1.5 text-[13px] font-medium text-[#6b7280] shadow-[0_1px_2px_rgba(0,0,0,0.04)] [animation:veloUp_.5s_ease_both]">
              <Sparkles size={16} strokeWidth={1.5} className="text-[#4b5563]" /> Criada com IA
            </div>

            {/* Heading */}
            <h1 className="mt-6 text-[34px] font-semibold leading-[1.1] tracking-[-0.02em] text-[#0a0a0a] [animation:veloUp_.5s_ease_.06s_both]">
              A sua loja está pronta.
            </h1>

            {/* Subheading */}
            <p className="mt-4 max-w-[560px] text-[16px] leading-[1.6] text-[#6b7280] [animation:veloUp_.5s_ease_.12s_both]">
              Montei uma vitrine minimalista em preto e branco, com foco total no produto.
              Template, conteúdo de vendas e design já estão prontos — é só revisar e publicar.
            </p>

            {/* Leque de 5 cards */}
            <div className="mt-14 flex items-start justify-center">
              {cards.map((card, index) => (
                <div
                  key={card.label}
                  style={{
                    marginLeft: index === 0 ? 0 : -12,
                    zIndex: card.z,
                    animation: `veloCardUp .55s cubic-bezier(.16,1,.3,1) ${0.2 + index * 0.07}s both`,
                  }}
                >
                  <div
                    className="flex h-[190px] w-[150px] flex-col rounded-[12px] border border-black/[0.06] bg-white px-3.5 py-3 text-left transition-transform duration-300 will-change-transform"
                    style={{
                      transform: `rotate(${card.rotate}deg) translateY(${card.lift}px)`,
                      boxShadow: cardShadow,
                    }}
                    onMouseEnter={(event) => { event.currentTarget.style.transform = `rotate(${card.rotate}deg) translateY(${card.lift - 12}px)`; }}
                    onMouseLeave={(event) => { event.currentTarget.style.transform = `rotate(${card.rotate}deg) translateY(${card.lift}px)`; }}
                  >
                    <span className="text-[12px] font-medium text-[#6b7280]">{card.label}</span>
                    {card.body}
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="mt-14 flex flex-col items-center gap-3.5 [animation:veloUp_.5s_ease_.5s_both]">
              <button
                type="button"
                onClick={finishOnboarding}
                className="group flex h-12 items-center gap-2 rounded-[12px] bg-[#0a0a0a] px-7 text-[15px] font-semibold text-white transition hover:bg-[#1f1f1f]"
              >
                {primaryLabel}
                <ArrowRight size={17} strokeWidth={1.5} className="transition-transform group-hover:translate-x-0.5" />
              </button>
              <button
                type="button"
                onClick={finishOnboarding}
                className="text-[13.5px] font-medium text-[#6b7280] transition hover:text-[#0a0a0a]"
              >
                Ver depois
              </button>
            </div>

            {/* Dica de atalho / instrução */}
            <p className="mt-10 text-[13px] text-[#9ca3af]">
              Tudo pode ser ajustado depois no editor, quando quiser.
            </p>

            {/* Rodapé dentro do card */}
            <div className="mt-8 flex flex-col items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#0a0a0a]">
                <Sparkles size={12} strokeWidth={1.5} className="text-[#0a0a0a]" />
              </span>
              <div className="text-[13px] text-[#9ca3af]">
                Central de ajuda <span className="px-1">·</span> Suporte <span className="px-1">·</span> Termos
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  );
};

export default StoreBuildProgressPage;
