import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useSpring } from "framer-motion";
import mascoteImg from "@/assets/mascote-velo-espiando.webp";

// Medidas tiradas da imagem recortada (mascote-velo-espiando.webp, 264x214).
const LARGURA = 100;
const ALTURA = 81;
// A parte de baixo dos dedos passa da borda reta do corpo: é o quanto "segura" a caixa.
const DEDOS = 6;
const OLHOS = [
  { x: 39.46, y: 59.15 },
  { x: 69.45, y: 51.52 },
];
const TAMANHO_OLHO = 7.6;
const DESVIO_MAXIMO = 1.8;

type Props = {
  focada: boolean;
  digitando: boolean;
  enviando: boolean;
  onClick: () => void;
};

/**
 * Mascote da Velo espiando por cima da caixa do Atlas, com as mãos na borda.
 * Os olhos são desenhados por cima da imagem para seguir o cursor e piscar.
 */
const AtlasMascote = ({ focada, digitando, enviando, onClick }: Props) => {
  const reduceMotion = useReducedMotion();
  const corpoRef = useRef<HTMLButtonElement>(null);
  const [piscando, setPiscando] = useState(false);
  const [pulo, setPulo] = useState(0);
  const olhoX = useSpring(0, { stiffness: 220, damping: 20 });
  const olhoY = useSpring(0, { stiffness: 220, damping: 20 });

  // Olhos seguem o cursor pela página; enquanto a pessoa escreve, olham para o texto.
  useEffect(() => {
    if (reduceMotion) return;
    if (digitando) {
      olhoX.set(-DESVIO_MAXIMO);
      olhoY.set(DESVIO_MAXIMO * 0.8);
      return;
    }
    let quadro = 0;
    const aoMover = (event: PointerEvent) => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => {
        const el = corpoRef.current;
        if (!el) return;
        const caixa = el.getBoundingClientRect();
        const dx = event.clientX - (caixa.left + caixa.width * 0.55);
        const dy = event.clientY - (caixa.top + caixa.height * 0.55);
        const distancia = Math.hypot(dx, dy) || 1;
        const forca = Math.min(distancia / 220, 1) * DESVIO_MAXIMO;
        olhoX.set((dx / distancia) * forca);
        olhoY.set((dy / distancia) * forca);
      });
    };
    window.addEventListener("pointermove", aoMover, { passive: true });
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener("pointermove", aoMover);
    };
  }, [reduceMotion, digitando, olhoX, olhoY]);

  // Pisca de vez em quando (às vezes duas vezes seguidas).
  useEffect(() => {
    if (reduceMotion) return;
    const timers: number[] = [];
    const piscar = (depois: number) => {
      timers.push(window.setTimeout(() => setPiscando(true), depois));
      timers.push(window.setTimeout(() => setPiscando(false), depois + 130));
    };
    const agendar = () => {
      const espera = 2600 + Math.random() * 3200;
      timers.push(
        window.setTimeout(() => {
          piscar(0);
          if (Math.random() < 0.25) piscar(260);
          agendar();
        }, espera),
      );
    };
    agendar();
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [reduceMotion]);

  // Altura do corpo: escondido até a entrada, espia mais com foco, pula ao clicar, balança enviando.
  const subida = focada || digitando ? -6 : 0;
  const animacaoCorpo = reduceMotion
    ? { y: 0 }
    : enviando
      ? { y: [subida, subida - 7, subida], transition: { duration: 0.7, repeat: Infinity, ease: "easeInOut" as const } }
      : { y: subida };

  return (
    // Janela com overflow escondido: o mascote "sai" de trás da borda da caixa.
    <div
      className="pointer-events-none absolute right-5 z-[2] overflow-hidden"
      style={{ bottom: `calc(100% - ${DEDOS}px)`, width: LARGURA, height: ALTURA + 30 }}
    >
      <motion.div
        className="absolute bottom-0 left-0"
        style={{ width: LARGURA, height: ALTURA }}
        initial={reduceMotion ? false : { y: ALTURA }}
        animate={animacaoCorpo}
        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 240, damping: 20, delay: 0.35 }}
      >
        <motion.button
          ref={corpoRef}
          key={pulo}
          type="button"
          onClick={() => {
            setPulo((n) => n + 1);
            onClick();
          }}
          aria-label="Falar com o Atlas"
          className="pointer-events-auto relative block h-full w-full cursor-pointer rounded-t-[60px] outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFA]/40"
          style={{ background: "transparent", boxShadow: "none" }}
          initial={reduceMotion || pulo === 0 ? false : { y: 0 }}
          animate={reduceMotion || pulo === 0 ? undefined : { y: [0, -12, 0], scaleY: [1, 1.04, 1] }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          whileHover={reduceMotion ? undefined : { y: -4 }}
        >
          <img
            src={mascoteImg}
            alt=""
            draggable={false}
            width={LARGURA}
            height={ALTURA}
            className="block h-full w-full select-none"
          />
          {OLHOS.map((olho, i) => (
            <motion.span
              key={i}
              aria-hidden="true"
              className="absolute rounded-full"
              style={{
                left: `${olho.x}%`,
                top: `${olho.y}%`,
                width: TAMANHO_OLHO,
                height: TAMANHO_OLHO,
                marginLeft: -TAMANHO_OLHO / 2,
                marginTop: -TAMANHO_OLHO / 2,
                x: olhoX,
                y: olhoY,
                background: "radial-gradient(circle at 38% 34%, #3A3A40 0%, #0A0A0C 55%, #000 100%)",
                boxShadow: "0 1px 1px rgba(0,0,20,0.35)",
              }}
              animate={{ scaleY: piscando ? 0.12 : 1 }}
              transition={{ duration: 0.07 }}
            >
              <span
                className="absolute rounded-full bg-white"
                style={{ width: 2.2, height: 2.2, right: 1.4, top: 1.2, opacity: piscando ? 0 : 0.95 }}
              />
            </motion.span>
          ))}
        </motion.button>
      </motion.div>
    </div>
  );
};

export default AtlasMascote;
