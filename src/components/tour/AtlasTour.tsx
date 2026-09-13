import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import AtlasAvatarIcon from "@/components/dashboard/AtlasAvatarIcon";

/*
  Tour de primeira visita, conduzido pelo próprio Atlas.

  O Atlas aparece ao lado de cada área com um balão de fala, e um recorte na
  tela destaca o que ele está explicando. O recorte e o Atlas deslizam de um
  alvo para o outro, então o tour lê como uma conversa andando pela tela e não
  como uma sequência de pop-ups.

  O último passo destaca o chat e oferece perguntas prontas. Todas acionam o
  guia de iniciante do Atlas (ver `isBeginnerTrigger` em
  supabase/functions/atlas-chat), que leva a pessoa até a primeira publicação.

  Cada passo tem uma rota: ao apontar uma seção da sidebar, o tour abre a
  página dela de verdade, e o escurecimento fica mais leve para a pessoa ver a
  tela trocando. Alvos são atributos `data-dashboard-tour` já presentes na
  marcação. Se um alvo não estiver na tela, o passo aparece centralizado — o
  tour nunca trava.
*/

type AtlasTourStep = {
  /** Valor do data-dashboard-tour a destacar. Ausente = passo centralizado. */
  target?: string;
  text: string;
  /** Arredondamento do recorte, casando com o formato do alvo. */
  radius?: number;
  /** Onde o Atlas fica em relação ao alvo. */
  placement?: "right" | "below";
  /** Página aberta durante o passo. */
  route: string;
};

const INICIO = "/dashboard";

const STEPS: AtlasTourStep[] = [
  {
    text: "Oi! Eu sou o Atlas, a inteligência artificial da Velo. Em menos de um minuto te mostro onde fica cada coisa — e no final a gente já começa a vender juntos.",
    route: INICIO,
  },
  {
    target: "home-primeiros-passos",
    text: "Esses são os seus primeiros passos: adicionar um produto do catálogo e escolher o visual da sua loja.",
    radius: 24,
    placement: "below",
    route: INICIO,
  },
  {
    target: "produtos",
    text: "Em Produtos fica o catálogo da Velo: itens de fornecedores brasileiros, com estoque ativo, prontos pra você anunciar.",
    radius: 10,
    placement: "right",
    route: "/dashboard/catalogo",
  },
  {
    target: "produtos-vencedores",
    text: "Em Produtos vencedores eu separo o que está vendendo mais agora. Assim você não precisa adivinhar o que funciona.",
    radius: 10,
    placement: "right",
    route: "/dashboard/produtos-em-alta",
  },
  {
    target: "publicacoes",
    text: "Tudo o que você publicar no Mercado Livre aparece em Publicações, pra acompanhar e ajustar quando quiser.",
    radius: 10,
    placement: "right",
    route: "/dashboard/publicacoes",
  },
  {
    target: "pedidos",
    text: "Quando a venda acontecer, o pedido chega aqui em Pedidos, com o status de cada entrega.",
    radius: 10,
    placement: "right",
    route: "/dashboard/pedidos",
  },
  {
    target: "imagens-ia",
    text: "Em Imagens com IA você cria fotos profissionais do seu produto em segundos, sem estúdio e sem fotógrafo.",
    radius: 10,
    placement: "right",
    route: "/dashboard/imagens-ia",
  },
  {
    target: "home-atlas-chat",
    text: "E eu fico sempre aqui. Escolho o produto com você, escrevo o anúncio e publico no Mercado Livre sem você sair da conversa. Me pergunta algo pra começar:",
    radius: 999,
    placement: "below",
    route: INICIO,
  },
];

/*
  Perguntas do passo final. Todas casam com o gatilho do guia de iniciante no
  atlas-chat ("ajuda … começar", "quero … começar", "primeira vez"). Mudou o
  texto? Confira se ainda aciona o guia, senão o Atlas responde solto.
*/
const PERGUNTAS_DO_TOUR = [
  "Me ajuda a começar e publicar meu primeiro produto",
  "É minha primeira vez vendendo, por onde eu começo?",
  "Quero começar escolhendo um produto que vende",
];

type Rect = { top: number; left: number; width: number; height: number };

type AtlasTourProps = {
  open: boolean;
  /** Fechou sem perguntar nada (pulou ou chegou ao fim sem escolher). */
  onClose: () => void;
  /** Escolheu uma pergunta no passo final. */
  onAsk: (pergunta: string) => void;
};

const EASE = [0.22, 1, 0.36, 1] as const;
const BLUE = "#0B5FFF";
const INK = "#111111";
const MUTED = "#6B6B6B";
const PAD = 8;
const AVATAR = 48;
const BUBBLE_WIDTH = 340;
const GAP = 18;
const MARGIN = 16;
const SCRIM = "rgba(9, 14, 30, 0.52)";
// Mais leve quando o passo abriu outra página: o ponto é ver a tela mudando.
const SCRIM_PAGINA = "rgba(9, 14, 30, 0.3)";

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const sameRect = (a: Rect | null, b: Rect | null) =>
  a === b ||
  (!!a &&
    !!b &&
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5);

/** Texto "sendo falado": revela caractere a caractere; clicar mostra tudo. */
const useFala = (texto: string, ativo: boolean) => {
  const [visiveis, setVisiveis] = useState(ativo ? 0 : texto.length);
  useEffect(() => {
    if (!ativo) {
      setVisiveis(texto.length);
      return;
    }
    setVisiveis(0);
    let atual = 0;
    const timer = window.setInterval(() => {
      atual += 2;
      setVisiveis(Math.min(atual, texto.length));
      if (atual >= texto.length) window.clearInterval(timer);
    }, 22);
    return () => window.clearInterval(timer);
  }, [texto, ativo]);
  return { mostrado: texto.slice(0, visiveis), terminou: visiveis >= texto.length, pular: () => setVisiveis(texto.length) };
};

export default function AtlasTour({ open, onClose, onAsk }: AtlasTourProps) {
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState(() => ({
    w: typeof window === "undefined" ? 1440 : window.innerWidth,
    h: typeof window === "undefined" ? 900 : window.innerHeight,
  }));
  const rectRef = useRef<Rect | null>(null);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const { mostrado, terminou, pular } = useFala(current.text, open && !reduce);

  useLayoutEffect(() => {
    if (open) setStep(0);
  }, [open]);

  // Leva a pessoa até a página do passo atual.
  useEffect(() => {
    if (open && pathname !== current.route) navigate(current.route);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- navega só quando o passo muda
  }, [open, step]);

  // Pulou no meio do caminho: volta para o Início, onde o tour começou.
  const sair = useCallback(() => {
    if (pathname !== INICIO) navigate(INICIO);
    onClose();
  }, [navigate, onClose, pathname]);

  // Acompanha o alvo a cada quadro: cobre scroll, resize, submenu abrindo e
  // conteúdo que termina de carregar, sem depender de cada evento em separado.
  useEffect(() => {
    if (!open) return;
    let frame = 0;
    const tick = () => {
      const el = current.target
        ? document.querySelector<HTMLElement>(`[data-dashboard-tour="${current.target}"]`)
        : null;
      const r = el?.getBoundingClientRect();
      const next = r && r.width > 0 && r.height > 0 ? { top: r.top, left: r.left, width: r.width, height: r.height } : null;
      if (!sameRect(next, rectRef.current)) {
        rectRef.current = next;
        setRect(next);
      }
      setViewport((v) => (v.w === window.innerWidth && v.h === window.innerHeight ? v : { w: window.innerWidth, h: window.innerHeight }));
      frame = window.requestAnimationFrame(tick);
    };
    tick();
    return () => window.cancelAnimationFrame(frame);
  }, [open, current.target]);

  const next = useCallback(() => {
    if (isLast) {
      sair();
      return;
    }
    setStep((v) => v + 1);
  }, [isLast, sair]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // No último passo a pessoa pode estar digitando no chat: as setas e o
      // Enter são dela, não do tour.
      const alvo = e.target as HTMLElement | null;
      if (alvo?.closest("input, textarea, [contenteditable='true']")) return;
      if (e.key === "Escape") sair();
      if ((e.key === "ArrowRight" || e.key === "Enter") && !isLast) next();
      if (e.key === "ArrowLeft") setStep((v) => Math.max(0, v - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, sair, next, isLast]);

  if (!open || typeof document === "undefined") return null;

  // ── Recorte ────────────────────────────────────────────────────────────────
  const hole = rect
    ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
    : { top: viewport.h / 2, left: viewport.w / 2, width: 0, height: 0 };
  const radius = rect ? Math.min(current.radius ?? 12, (hole.height / 2) | 0) : 0;

  // ── Posição do Atlas + balão ───────────────────────────────────────────────
  const groupWidth = AVATAR + 12 + BUBBLE_WIDTH;
  const estimatedHeight = isLast ? 300 : 200;
  let groupPos: { top: number; left: number };
  if (!rect) {
    groupPos = { top: viewport.h / 2 - estimatedHeight / 2, left: viewport.w / 2 - groupWidth / 2 };
  } else if (current.placement === "right") {
    groupPos = {
      top: clamp(rect.top + rect.height / 2 - AVATAR / 2 - 6, MARGIN, viewport.h - estimatedHeight - MARGIN),
      left: hole.left + hole.width + GAP,
    };
  } else {
    const below = hole.top + hole.height + GAP;
    const fitsBelow = below + estimatedHeight < viewport.h - MARGIN;
    groupPos = {
      top: fitsBelow ? below : Math.max(MARGIN, hole.top - estimatedHeight - GAP),
      left: rect.left + rect.width / 2 - groupWidth / 2,
    };
  }
  groupPos.left = clamp(groupPos.left, MARGIN, viewport.w - groupWidth - MARGIN);

  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 170, damping: 26, mass: 0.9 };

  // Áreas que bloqueiam clique em volta do recorte. No último passo o recorte
  // fica clicável: a pessoa pode tocar no chat e escrever a própria pergunta.
  const blockers: CSSProperties[] = rect
    ? [
        { top: 0, left: 0, right: 0, height: Math.max(0, hole.top) },
        { top: hole.top + hole.height, left: 0, right: 0, bottom: 0 },
        { top: hole.top, left: 0, width: Math.max(0, hole.left), height: hole.height },
        { top: hole.top, left: hole.left + hole.width, right: 0, height: hole.height },
        ...(isLast ? [] : [{ top: hole.top, left: hole.left, width: hole.width, height: hole.height }]),
      ]
    : [{ inset: 0 }];

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[150]"
      role="dialog"
      aria-modal="true"
      aria-label="Tour da Velo com o Atlas"
      data-velo-flat-buttons=""
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduce ? 0.001 : 0.5, ease: "easeOut" }}
      style={{ fontFamily: '"Inter", system-ui, -apple-system, sans-serif' }}
    >
      {blockers.map((style, i) => (
        <div key={i} className="absolute" style={style} />
      ))}

      {/* Recorte: um retângulo transparente com uma sombra que cobre o resto
          da tela. Animar a posição dele desliza o destaque entre os alvos. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute"
        initial={false}
        animate={{
          top: hole.top,
          left: hole.left,
          width: hole.width,
          height: hole.height,
          borderRadius: radius,
          boxShadow: `0 0 0 9999px ${current.route === INICIO ? SCRIM : SCRIM_PAGINA}`,
        }}
        transition={{ ...spring, boxShadow: { duration: 0.5, ease: EASE } }}
        style={{ boxShadow: `0 0 0 9999px ${SCRIM}` }}
      >
        {rect ? (
          <motion.span
            key={step}
            className="absolute inset-0"
            style={{ borderRadius: "inherit", boxShadow: "0 0 0 2px rgba(255,255,255,0.9), 0 0 0 7px rgba(11,95,255,0.28)" }}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: reduce ? 0 : 0.25 }}
          />
        ) : null}
      </motion.div>

      {/* Atlas + balão de fala. */}
      <motion.div
        className="absolute flex items-start gap-3"
        initial={reduce ? false : { opacity: 0, y: 12, top: groupPos.top, left: groupPos.left }}
        animate={{ opacity: 1, y: 0, top: groupPos.top, left: groupPos.left }}
        transition={{ ...spring, opacity: { duration: 0.4 }, y: { duration: 0.6, ease: EASE } }}
        style={{ width: groupWidth }}
      >
        <motion.span
          key={`avatar-${step}`}
          className="grid shrink-0 place-items-center rounded-full bg-white"
          style={{ width: AVATAR, height: AVATAR, boxShadow: "0 10px 30px rgba(9,14,30,0.28)" }}
          initial={reduce ? false : { scale: 0.92 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 16 }}
        >
          <AtlasAvatarIcon size={30} />
        </motion.span>

        <div
          className="relative rounded-[20px] bg-white px-5 pb-4 pt-4"
          style={{ width: BUBBLE_WIDTH, boxShadow: "0 24px 60px rgba(9,14,30,0.30)" }}
          onClick={() => !terminou && pular()}
        >
          {/* Rabinho do balão, apontando para o Atlas. */}
          <span
            aria-hidden="true"
            className="absolute -left-[5px] top-[18px] h-3 w-3 rotate-45 rounded-[2px] bg-white"
          />

          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold" style={{ color: INK }}>
              Atlas <span className="font-normal" style={{ color: MUTED }}>· IA da Velo</span>
            </span>
            <span className="flex items-center gap-1" aria-label={`Passo ${step + 1} de ${STEPS.length}`}>
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className="h-[4px] rounded-full transition-all duration-300"
                  style={{ width: i === step ? 14 : 4, background: i <= step ? BLUE : "rgba(17,17,17,0.14)" }}
                />
              ))}
            </span>
          </div>

          {/* A altura é reservada pelo texto completo (invisível), para o balão
              não crescer enquanto o Atlas "fala". */}
          <p className="relative mt-2 text-[14px] leading-[1.5]" style={{ color: INK }} aria-live="polite">
            <span className="invisible">{current.text}</span>
            <span className="absolute inset-0">{mostrado}</span>
          </p>

          <AnimatePresence initial={false}>
            {isLast && terminou ? (
              <motion.div
                key="perguntas"
                className="mt-3 flex flex-col gap-2"
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE }}
              >
                {PERGUNTAS_DO_TOUR.map((pergunta, i) => (
                  <motion.button
                    key={pergunta}
                    type="button"
                    onClick={() => onAsk(pergunta)}
                    initial={reduce ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: reduce ? 0 : 0.08 * i, ease: EASE }}
                    whileTap={reduce ? undefined : { scale: 0.98 }}
                    className={`group flex items-center justify-between gap-3 rounded-[14px] px-3.5 py-2.5 text-left text-[13px] font-medium transition-colors duration-200 ${
                      i === 0
                        ? "bg-[#0B5FFF] text-white hover:bg-[#0A52DD]"
                        : "bg-[#F3F4F7] text-[#111111] hover:bg-[#E9EBF1]"
                    }`}
                  >
                    {pergunta}
                    <ArrowRight
                      size={15}
                      strokeWidth={2}
                      className="shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
                    />
                  </motion.button>
                ))}
                <p className="mt-0.5 text-center text-[12px]" style={{ color: MUTED }}>
                  ou escreva sua própria pergunta no chat
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={sair}
              className="rounded-full px-1 py-1 text-[13px] font-medium transition-colors hover:text-[#111111]"
              style={{ color: MUTED }}
            >
              {isLast ? "Agora não" : "Pular tour"}
            </button>
            {!isLast ? (
              <div className="flex items-center gap-1">
                {step > 0 ? (
                  <button
                    type="button"
                    onClick={() => setStep((v) => Math.max(0, v - 1))}
                    className="h-9 rounded-full px-3 text-[13px] font-medium transition-colors hover:bg-black/[0.05]"
                    style={{ color: MUTED }}
                  >
                    Voltar
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={next}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#0B5FFF] px-4 text-[13px] font-medium text-white transition-colors duration-200 hover:bg-[#0A52DD]"
                >
                  {step === 0 ? "Bora lá" : "Próximo"}
                  <ArrowRight size={14} strokeWidth={2} />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
