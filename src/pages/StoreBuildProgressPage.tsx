import { useEffect, useMemo, useRef, useState } from "react";
import { Check, FileJson, Loader2 } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import type { ExampleProduct } from "@/pages/StartChoicePage";
import { useAuth } from "@/contexts/AuthContext";
import { markStoreFlowCompleted } from "@/lib/storeFlowCompletion";

type FlowState = { product: ExampleProduct; language: string; persona: string; salesAngle: string };
type OnboardingChoice = "store" | "sales-page" | "example";

const steps = [
  "Importando dados do produto...",
  "A IA está pesquisando o mercado...",
  "A IA está escrevendo o conteúdo de vendas...",
  "A IA está criando o tema da loja...",
  "Finalizando sua loja...",
];

// O código que a IA "escreve" no painel de baixo. As linhas marcadas com
// added: true entram destacadas em verde, como um diff.
type CodeLine = { text: string; added?: boolean };

const codeLines: CodeLine[] = [
  { text: '{' },
  { text: '  "loja": {' },
  { text: '    "slug": "caixa-de-som-bluetooth",' },
  { text: '    "idioma": "pt-BR",' },
  { text: '    "moeda": "BRL",' },
  { text: '    "publicado": false' },
  { text: '  },' },
  { text: '  "produto": {' },
  { text: '    "titulo": "Caixa de Som Bluetooth Portátil",', added: true },
  { text: '    "custo": 55.00,' },
  { text: '    "preco": 94.60,', added: true },
  { text: '    "margem": 72,' },
  { text: '    "estoque": true,' },
  { text: '    "imagens": ["01.jpg", "02.jpg", "03.jpg"]' },
  { text: '  },' },
  { text: '  "seo": {' },
  { text: '    "keywords": ["som", "bluetooth", "portatil"],', added: true },
  { text: '    "descricao": "Som potente e bateria de longa duracao."' },
  { text: '  },' },
  { text: '  "tema": {' },
  { text: '    "primaria": "#000000",', added: true },
  { text: '    "fonte": "Inter",' },
  { text: '    "layout": "vitrine"' },
  { text: '  },' },
  { text: '  "checkout": { "parcelas": 12, "frete": "gratis" }' },
  { text: '}' },
];

// Realce de sintaxe JSON: chave, string, número, booleano e pontuação.
const TOKEN_PATTERN = /("(?:[^"\\]|\\.)*"\s*:)|("(?:[^"\\]|\\.)*")|(\b\d+(?:\.\d+)?\b)|(\btrue\b|\bfalse\b|\bnull\b)/g;

const TOKEN_COLORS = { key: "#9cdcfe", string: "#ce9178", number: "#b5cea8", literal: "#569cd6" };

const highlightJson = (line: string) => {
  const parts: { text: string; color?: string }[] = [];
  let lastIndex = 0;
  for (const match of line.matchAll(TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) parts.push({ text: line.slice(lastIndex, index) });
    const color = match[1] ? TOKEN_COLORS.key : match[2] ? TOKEN_COLORS.string : match[3] ? TOKEN_COLORS.number : TOKEN_COLORS.literal;
    parts.push({ text: match[0], color });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < line.length) parts.push({ text: line.slice(lastIndex) });
  return parts;
};

// Uma duração por etapa, com aceleração/desaceleração dentro de cada uma: a
// barra respira em vez de subir em velocidade constante. A pausa cai junto da
// virada de etapa, quando o check aparece.
const STEP_DURATIONS_MS = [2400, 2800, 3200, 2400, 2200];
const TOTAL_DURATION_MS = STEP_DURATIONS_MS.reduce((sum, value) => sum + value, 0);

const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

// Precisa bater com a duração de veloScreenLeave.
const LEAVE_DURATION_MS = 420;

// Progresso real de 0 a 100 — antes parava em 95 e a tela dizia "pronto" com o
// círculo incompleto.
const getProgressAt = (elapsed: number) => {
  let stepStart = 0;
  for (let index = 0; index < STEP_DURATIONS_MS.length; index += 1) {
    const duration = STEP_DURATIONS_MS[index];
    if (elapsed < stepStart + duration) {
      const stepFraction = easeInOutSine((elapsed - stepStart) / duration);
      return ((index + stepFraction) / STEP_DURATIONS_MS.length) * 100;
    }
    stepStart += duration;
  }
  return 100;
};

const VISIBLE_CODE_LINES = 8;
const CODE_TEXT = codeLines.map((line) => line.text).join("\n");

// Painel que "digita" o código. A velocidade varia por caractere e pausa mais
// na quebra de linha — digitação em ritmo constante entrega que é um loop.
const AiCodePanel = () => {
  const [typed, setTyped] = useState(0);
  const typedRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;

    const tick = () => {
      if (cancelled) return;
      const next = typedRef.current + 1;
      if (next > CODE_TEXT.length) {
        typedRef.current = 0;
        setTyped(0);
        timer = window.setTimeout(tick, 1100);
        return;
      }
      typedRef.current = next;
      setTyped(next);
      const justTyped = CODE_TEXT[next - 1];
      timer = window.setTimeout(tick, justTyped === "\n" ? 110 + Math.random() * 140 : 9 + Math.random() * 26);
    };

    timer = window.setTimeout(tick, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const revealedLines = CODE_TEXT.slice(0, typed).split("\n");
  const caretLineIndex = revealedLines.length - 1;
  const windowStart = Math.max(0, caretLineIndex - VISIBLE_CODE_LINES + 1);
  const windowLines = revealedLines.slice(windowStart);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-4">
      <div className="mx-auto w-full max-w-[940px] overflow-hidden rounded-t-[12px] border border-b-0 border-[#333] bg-[#1e1e1e] shadow-[0_-22px_70px_rgba(15,23,42,0.22)]">
        <div className="flex items-center gap-2 border-b border-[#333] bg-[#252526] px-3.5 py-2">
          <FileJson size={12} className="text-[#519aba]" />
          <span className="text-[10.5px] font-medium text-[#cfcfcf]">loja.config.json</span>
          <span className="ml-auto flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[#8b8b8b]">
            <Loader2 size={10} className="animate-spin" />
            A IA está escrevendo
          </span>
        </div>

        <div className="py-2 font-mono text-[11.5px] leading-[19px]" style={{ height: VISIBLE_CODE_LINES * 19 + 16 }}>
          {windowLines.map((line, index) => {
            const lineIndex = windowStart + index;
            const isAdded = codeLines[lineIndex]?.added;
            const isCaretLine = lineIndex === caretLineIndex;
            return (
              <div
                key={lineIndex}
                className={`flex gap-3 px-3 ${isAdded ? "bg-[rgba(46,160,67,0.16)] shadow-[inset_2px_0_0_#2ea043]" : ""}`}
              >
                <span className={`w-7 shrink-0 select-none text-right ${isAdded ? "text-[#4ec26f]" : "text-[#6e7681]"}`}>
                  {lineIndex + 1}
                </span>
                <span className="whitespace-pre text-[#d4d4d4]">
                  {highlightJson(line).map((part, partIndex) => (
                    <span key={partIndex} style={part.color ? { color: part.color } : undefined}>{part.text}</span>
                  ))}
                  {isCaretLine ? (
                    <span className="ml-[1px] inline-block h-[13px] w-[7px] translate-y-[2px] bg-[#d4d4d4] [animation:veloCaretBlink_1s_step-end_infinite]" />
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

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
  const [progress, setProgress] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const elapsed = now - startedAt;
      if (elapsed >= TOTAL_DURATION_MS) {
        setProgress(100);
        return;
      }
      setProgress(getProgressAt(elapsed));
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const ready = progress >= 100;

  // Precisa ficar acima do return condicional: hook depois de early return roda
  // fora de ordem se `flow` deixar de ser nulo entre renders.
  useEffect(() => {
    if (ready && flow && user?.id) markStoreFlowCompleted(user.id, flow);
  }, [ready, flow, user?.id]);

  if (!flow) return <Navigate to="/comecar" replace />;

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

  const completedCount = ready ? steps.length : Math.min(steps.length - 1, Math.floor(progress / (100 / steps.length)));
  const activeIndex = Math.min(steps.length - 1, completedCount);
  const displayProgress = Math.round(progress);
  const circumference = 2 * Math.PI * 78;
  const arcAngle = (progress / 100) * Math.PI * 2;

  return (
    <main className={`relative flex min-h-screen items-center justify-center overflow-hidden bg-[#fbfbfc] px-6 pt-12 text-[#101522] ${ready ? "pb-12" : "pb-[236px]"}`} style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      <style>
        {`
          @keyframes veloRingBreathe {
            0%, 100% { opacity: .55; transform: scale(1); }
            50% { opacity: .9; transform: scale(1.04); }
          }

          /* Manchas de cor que derivam devagar: dão vida ao fundo sem competir
             com o conteúdo no centro. */
          @keyframes veloAuroraA {
            0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
            50% { transform: translate3d(70px, 50px, 0) scale(1.14); }
          }

          @keyframes veloAuroraB {
            0%, 100% { transform: translate3d(0, 0, 0) scale(1.06); }
            50% { transform: translate3d(-60px, 70px, 0) scale(1); }
          }

          @keyframes veloAuroraC {
            0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
            50% { transform: translate3d(50px, -60px, 0) scale(1.12); }
          }

          @keyframes veloTickSpin {
            to { transform: rotate(360deg); }
          }

          @keyframes veloCaretBlink {
            0%, 45% { opacity: 1; }
            55%, 100% { opacity: 0; }
          }

          /* Saída da tela: o conteúdo recua e some antes de entrar no editor. */
          @keyframes veloScreenLeave {
            0% { opacity: 1; transform: scale(1); }
            100% { opacity: 0; transform: scale(.965); }
          }

          @media (prefers-reduced-motion: reduce) {
            .velo-aurora, .velo-ring-glow, .velo-ring-ticks { animation: none !important; }
          }
        `}
      </style>

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(160deg,#fafafb_0%,#eeeff2_46%,#f7f7f8_100%)]" />
      <div className="velo-aurora pointer-events-none absolute -left-[14%] -top-[12%] h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(15,23,42,0.16),transparent_66%)] blur-3xl [animation:veloAuroraA_17s_ease-in-out_infinite]" />
      <div className="velo-aurora pointer-events-none absolute -right-[12%] top-[8%] h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(15,23,42,0.11),transparent_66%)] blur-3xl [animation:veloAuroraB_21s_ease-in-out_infinite]" />
      <div className="velo-aurora pointer-events-none absolute -bottom-[18%] left-[26%] h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(15,23,42,0.13),transparent_66%)] blur-3xl [animation:veloAuroraC_19s_ease-in-out_infinite]" />

      <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle,rgba(15,23,42,0.13)_1px,transparent_1.2px)] [background-position:2px_2px] [background-size:32px_32px] [mask-image:radial-gradient(circle_at_50%_45%,transparent_16%,black_38%,black_62%,transparent_88%)]" />

      {/* Clareia o miolo para o anel e os textos ficarem legíveis sobre a cor. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_46%,rgba(255,255,255,0.92),rgba(255,255,255,0.5)_30%,transparent_58%)]" />
      <section
        className="relative z-10 flex w-full max-w-[380px] flex-col items-center text-center"
        style={leaving ? { animation: `veloScreenLeave ${LEAVE_DURATION_MS}ms cubic-bezier(.4,0,.6,1) forwards` } : undefined}
      >
        <div className="relative flex h-[180px] w-[180px] items-center justify-center rounded-full">
          {!ready ? (
            <div className="velo-ring-glow pointer-events-none absolute inset-[-18px] rounded-full bg-[radial-gradient(circle,rgba(15,23,42,0.16),transparent_68%)] [animation:veloRingBreathe_2.6s_ease-in-out_infinite]" />
          ) : null}
          <svg viewBox="0 0 180 180" className="absolute inset-0 -rotate-90">
            <defs>
              {/* Preto com variação de tom: dá volume ao anel sem sair da
                  paleta preto e branco. */}
              <linearGradient id="veloRingGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#000000" />
                <stop offset="50%" stopColor="#3f4654" />
                <stop offset="100%" stopColor="#0a0a0c" />
              </linearGradient>
              <filter id="veloRingGlowFilter" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3.4" result="blurred" />
                <feMerge>
                  <feMergeNode in="blurred" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <circle cx="90" cy="90" r="78" fill="#fff" stroke="#e8ecf3" strokeWidth="8" />
            {/* Marcações internas girando devagar: dão movimento ao anel mesmo
                quando o progresso desacelera na virada de etapa. */}
            <circle
              cx="90" cy="90" r="66" fill="none" stroke="#dbe2ee" strokeWidth="1.5" strokeDasharray="1 7"
              className="velo-ring-ticks"
              style={{ transformOrigin: "90px 90px", animation: ready ? undefined : "veloTickSpin 24s linear infinite" }}
            />
            <circle
              cx="90" cy="90" r="78" fill="none" stroke="url(#veloRingGradient)" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress / 100)}
              filter="url(#veloRingGlowFilter)"
            />
            {/* Ponto luminoso na ponta do arco, como uma cabeça de cometa. */}
            {!ready && progress > 1 ? (
              <circle cx={90 + 78 * Math.cos(arcAngle)} cy={90 + 78 * Math.sin(arcAngle)} r="4.5" fill="#fff" stroke="url(#veloRingGradient)" strokeWidth="3" filter="url(#veloRingGlowFilter)" />
            ) : null}
          </svg>
          <div className="relative">
            <strong className="block text-[46px] font-bold leading-none tracking-[-0.06em] tabular-nums text-[#101522]">{displayProgress}</strong>
            <span className="mt-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b94a6]">Completo</span>
          </div>
        </div>

        <h1 className="mt-14 text-[30px] font-semibold tracking-[-0.04em] text-[#101522]">{ready ? "A sua loja está pronta!" : "Preparando sua loja IA"}</h1>
        <p className="mt-3 text-[16px] font-medium text-[#687086]">{ready ? "Tudo foi preparado para você." : steps[activeIndex]}</p>
        {ready ? <button type="button" onClick={finishOnboarding} className="mt-10 h-12 w-full rounded-[7px] bg-black text-[14px] font-semibold text-white transition hover:bg-[#202020]">{sessionStorage.getItem("velo-onboarding-choice") === "sales-page" ? "Editar minha página" : "Ir para o painel"}</button> : null}

        {!ready ? (
          <div className="mt-12 w-full space-y-4 text-left">
            {steps.map((step, index) => {
              const done = index < completedCount;
              const active = index === activeIndex;
              const stepProgress = done ? 100 : active ? Math.min(100, (progress % (100 / steps.length)) * steps.length) : 0;
              return (
                <div key={step} className={done || active ? "opacity-100" : "opacity-35"}>
                  <div className="flex items-center justify-between gap-3 text-[12px] font-medium text-[#2b3140]"><span className="truncate">{step}</span>{done ? <Check size={15} className="text-[#101522]" /> : active ? <Loader2 size={14} className="animate-spin text-[#697083]" /> : null}</div>
                  <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-[#e4e8ef]"><div className="h-full rounded-full bg-[#0b1220]" style={{ width: `${stepProgress}%` }} /></div>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      {!ready ? <AiCodePanel /> : null}
    </main>
  );
};

export default StoreBuildProgressPage;
