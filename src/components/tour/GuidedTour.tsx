import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { TOUR_STEPS, type TourStep } from "./tourSteps";

type Rect = { top: number; left: number; width: number; height: number };

type GuidedTourProps = {
  open: boolean;
  /** Chamado ao concluir ou fechar — em ambos os casos o tour não reabre sozinho. */
  onClose: () => void;
  /** Sobrescreve os passos. Usado para exercitar o motor fora do dashboard. */
  steps?: TourStep[];
};

// Folga entre o recorte do spotlight e a borda do elemento destacado.
const SPOTLIGHT_PADDING = 8;
const CARD_WIDTH = 340;
const CARD_GAP = 14;
const VIEWPORT_MARGIN = 16;

// Mesma paleta escura dos modais de onboarding/criação de projeto.
const cardStyle: CSSProperties = {
  background: "#1E1E1E",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 24px 64px rgba(0,0,0,0.55)",
};

const primaryButtonStyle: CSSProperties = {
  background: "linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 15%), #2A2A2A",
  border: "1px solid rgba(255,255,255,0.14)",
  boxShadow: "0 4px 12px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.10)",
  textShadow: "0 1px 2px rgba(0,0,0,0.40)",
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export default function GuidedTour({ open, onClose, steps = TOUR_STEPS }: GuidedTourProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const reduce = useReducedMotion();

  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  // Enquanto a rota do passo não terminou de montar, não medimos o alvo — isso
  // evita o card "pular" de uma posição antiga para a nova.
  const [measured, setMeasured] = useState(false);
  const rafRef = useRef<number | null>(null);

  const current = steps[step];
  const isLast = step === steps.length - 1;
  const Icon = current.icon;

  // Precisa ser layout effect (e declarado ANTES da medição): efeitos de layout
  // rodam antes dos passivos, então um `useEffect` aqui zeraria o `measured`
  // logo depois de a medição tê-lo ligado, deixando o tour escuro para sempre.
  useLayoutEffect(() => {
    if (open) {
      setStep(0);
      setRect(null);
      setMeasured(false);
    }
  }, [open]);

  // Leva o usuário até a rota do passo atual antes de tentar medir o alvo.
  useEffect(() => {
    if (!open) return;
    if (location.pathname !== current.route) {
      setMeasured(false);
      navigate(current.route);
    }
  }, [open, current.route, location.pathname, navigate]);

  // Mede o alvo (e remede em scroll/resize). Tenta por ~2s antes de desistir e
  // cair no modo centralizado, cobrindo telas que carregam dados de forma async.
  useLayoutEffect(() => {
    if (!open) return;
    if (location.pathname !== current.route) return;

    let cancelled = false;
    let attempts = 0;

    const measure = () => {
      if (cancelled) return;
      if (!current.target) {
        setRect(null);
        setMeasured(true);
        return;
      }
      const el = document.querySelector<HTMLElement>(`[data-dashboard-tour="${current.target}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
          const after = el.getBoundingClientRect();
          setRect({ top: after.top, left: after.left, width: after.width, height: after.height });
          setMeasured(true);
          return;
        }
      }
      attempts += 1;
      if (attempts < 40) {
        rafRef.current = window.setTimeout(measure, 50) as unknown as number;
      } else {
        // Alvo não existe nesta tela — mostra o passo centralizado.
        setRect(null);
        setMeasured(true);
      }
    };

    measure();

    const onViewportChange = () => {
      if (!current.target) return;
      const el = document.querySelector<HTMLElement>(`[data-dashboard-tour="${current.target}"]`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    window.addEventListener("scroll", onViewportChange, true);
    window.addEventListener("resize", onViewportChange);

    return () => {
      cancelled = true;
      if (rafRef.current) window.clearTimeout(rafRef.current);
      window.removeEventListener("scroll", onViewportChange, true);
      window.removeEventListener("resize", onViewportChange);
    };
  }, [open, step, current.target, current.route, location.pathname, reduce]);

  const handleNext = useCallback(() => {
    if (isLast) {
      onClose();
      return;
    }
    setMeasured(false);
    setStep((v) => v + 1);
  }, [isLast, onClose]);

  const handleBack = useCallback(() => {
    setMeasured(false);
    setStep((v) => Math.max(0, v - 1));
  }, []);

  // Setas e Esc controlam o tour pelo teclado.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === "Enter") handleNext();
      if (e.key === "ArrowLeft") handleBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, handleNext, handleBack]);

  if (!open || typeof document === "undefined") return null;

  // Posição do card: abaixo do alvo por padrão, acima quando não couber; sempre
  // preso dentro da viewport.
  let cardPos: CSSProperties;
  if (rect) {
    const below = rect.top + rect.height + CARD_GAP;
    const fitsBelow = below + 200 < window.innerHeight;
    const top = fitsBelow ? below : Math.max(VIEWPORT_MARGIN, rect.top - 200 - CARD_GAP);
    const left = clamp(
      rect.left + rect.width / 2 - CARD_WIDTH / 2,
      VIEWPORT_MARGIN,
      window.innerWidth - CARD_WIDTH - VIEWPORT_MARGIN,
    );
    cardPos = { top, left, width: CARD_WIDTH };
  } else {
    cardPos = {
      top: "50%",
      left: "50%",
      width: CARD_WIDTH,
      transform: "translate(-50%, -50%)",
    };
  }

  return createPortal(
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true" aria-label="Tour guiado da Velo">
      {/* Escurecimento com recorte no alvo. Usamos 4 retângulos em vez de um
          box-shadow gigante para o recorte acompanhar o scroll sem serrilhar. */}
      <AnimatePresence>
        <motion.div
          key="scrim"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0"
          onClick={onClose}
        >
          {rect && measured ? (
            <>
              <div className="absolute left-0 right-0 top-0 bg-black/70" style={{ height: Math.max(0, rect.top - SPOTLIGHT_PADDING) }} />
              <div
                className="absolute left-0 bg-black/70"
                style={{
                  top: Math.max(0, rect.top - SPOTLIGHT_PADDING),
                  height: rect.height + SPOTLIGHT_PADDING * 2,
                  width: Math.max(0, rect.left - SPOTLIGHT_PADDING),
                }}
              />
              <div
                className="absolute right-0 bg-black/70"
                style={{
                  top: Math.max(0, rect.top - SPOTLIGHT_PADDING),
                  height: rect.height + SPOTLIGHT_PADDING * 2,
                  left: rect.left + rect.width + SPOTLIGHT_PADDING,
                }}
              />
              <div
                className="absolute bottom-0 left-0 right-0 bg-black/70"
                style={{ top: rect.top + rect.height + SPOTLIGHT_PADDING }}
              />
              {/* Anel em volta do elemento destacado. */}
              <div
                className="pointer-events-none absolute rounded-[10px] ring-2 ring-white/70"
                style={{
                  top: rect.top - SPOTLIGHT_PADDING,
                  left: rect.left - SPOTLIGHT_PADDING,
                  width: rect.width + SPOTLIGHT_PADDING * 2,
                  height: rect.height + SPOTLIGHT_PADDING * 2,
                }}
              />
            </>
          ) : (
            <div className="absolute inset-0 bg-black/70" />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Card do passo. */}
      <AnimatePresence mode="wait">
        {measured ? (
          <motion.div
            key={step}
            initial={reduce ? false : { opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: reduce ? 0.001 : 0.24, ease: [0.22, 1, 0.36, 1] }}
            style={{ ...cardStyle, ...cardPos, position: "absolute" }}
            className="rounded-[16px] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-white/[0.08] bg-white/[0.07] text-white">
                <Icon size={17} strokeWidth={1.7} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[15px] font-semibold text-white">{current.title}</h3>
                <p className="mt-1 text-[13px] leading-[19px] text-[#8A8A8A]">{current.description}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Sair do tour"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] text-[#6B6B6B] transition-colors hover:bg-white/10 hover:text-white"
              >
                <X size={16} strokeWidth={1.9} />
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-[12.5px] font-medium text-[#6B6B6B]">
                {step + 1} de {steps.length}
              </span>
              <div className="flex items-center gap-2">
                {step > 0 ? (
                  <button
                    type="button"
                    onClick={handleBack}
                    className="inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-medium text-white/60 transition-colors hover:text-white"
                  >
                    <ArrowLeft size={15} strokeWidth={1.9} />
                    Voltar
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleNext}
                  style={primaryButtonStyle}
                  className="inline-flex h-9 items-center gap-1.5 rounded-[10px] px-4 text-[13.5px] font-medium text-white"
                >
                  {isLast ? "Concluir" : "Próximo"}
                  {isLast ? <Check size={15} strokeWidth={2} /> : <ArrowRight size={15} strokeWidth={2} />}
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
