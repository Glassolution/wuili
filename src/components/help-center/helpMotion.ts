import type { Transition, Variants } from "framer-motion";

/*
  Movimento da Central de Ajuda. Curto e discreto: entradas de até ~0,5s com
  curva que desacelera no fim, deslocamentos de poucos pixels, nada que pisque.
  Quem pede "reduzir movimento" no sistema recebe só o fade (MotionConfig
  reducedMotion="user" nos componentes).
*/

export const EASE_OUT: Transition["ease"] = [0.22, 1, 0.36, 1];

/** Contêiner que solta os filhos em cascata. */
export const stagger = (gap = 0.06, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
});

/** Filho padrão da cascata: sobe alguns pixels enquanto aparece. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.4, ease: EASE_OUT } },
};

/** Revelação ao rolar: seções longas da nota entram quando chegam na tela. */
export const revealOnScroll = {
  initial: { opacity: 0, y: 14 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "0px 0px -60px 0px" },
  transition: { duration: 0.5, ease: EASE_OUT },
} as const;
