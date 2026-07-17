import type { Variants } from "framer-motion";

// Easing único do fluxo (mesma curva usada nas transições de CSS: --vf-ease).
export const FLOW_EASE = [0.16, 1, 0.3, 1] as const;

// Entrada de cada etapa: fade + slide horizontal sutil (translateX 16px → 0).
// Aplicado na coluna de conteúdo de cada tela, dando a sensação de que a nova
// etapa "desliza" ao avançar.
export const screenEnter = {
  initial: { opacity: 0, x: 16 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.35, ease: FLOW_EASE },
  },
} as const;

// Lista de opções (idioma, persona, ângulo): stagger sutil — cada item entra
// com translateY(8px) → 0 + fade, com atraso incremental de 40ms.
export const listStagger: Variants = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.04, delayChildren: 0.05 },
  },
};

export const listItem: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: FLOW_EASE },
  },
};
