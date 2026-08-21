/**
 * Ícones da barra inferior do mobile.
 *
 * Feitos à mão em vez de vir de uma biblioteca: as famílias prontas (Lucide,
 * Phosphor) só têm contorno, e a barra precisa do par contorno/preenchido —
 * é o preenchimento que marca a aba ativa agora que o fundo azul saiu. Todos
 * compartilham a mesma grade 24×24, traço 1.7 e cantos arredondados, então o
 * conjunto lê como um só desenho.
 */

export type MobileNavIconProps = {
  active?: boolean;
  size?: number;
};

const baseProps = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  xmlns: "http://www.w3.org/2000/svg",
  "aria-hidden": true,
});

const strokeProps = {
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Início — casa com telhado contínuo e porta recortada quando preenchida. */
export const NavHomeIcon = ({ active = false, size = 23 }: MobileNavIconProps) => (
  <svg {...baseProps(size)}>
    <path
      d="M3.7 10.2 12 3.7l8.3 6.5v8.1a2 2 0 0 1-2 2h-2.9v-5.1a1.4 1.4 0 0 0-1.4-1.4h-4a1.4 1.4 0 0 0-1.4 1.4v5.1H5.7a2 2 0 0 1-2-2z"
      fill={active ? "currentColor" : "none"}
      {...strokeProps}
    />
  </svg>
);

/** Pedidos — sacola de compra: alça em arco e corpo levemente trapezoidal. */
export const NavOrdersIcon = ({ active = false, size = 23 }: MobileNavIconProps) => (
  <svg {...baseProps(size)}>
    <path
      d="M5.6 8.3h12.8l-.9 10.4a2 2 0 0 1-2 1.8H8.5a2 2 0 0 1-2-1.8z"
      fill={active ? "currentColor" : "none"}
      {...strokeProps}
    />
    <path d="M9.1 8.3V7a2.9 2.9 0 0 1 5.8 0v1.3" {...strokeProps} />
  </svg>
);

/** Resultados — três barras crescentes; preenchem juntas na aba ativa. */
export const NavResultsIcon = ({ active = false, size = 23 }: MobileNavIconProps) => (
  <svg {...baseProps(size)}>
    <rect
      x="3.6"
      y="13.4"
      width="4.4"
      height="6.8"
      rx="1.5"
      fill={active ? "currentColor" : "none"}
      {...strokeProps}
    />
    <rect
      x="9.8"
      y="9.2"
      width="4.4"
      height="11"
      rx="1.5"
      fill={active ? "currentColor" : "none"}
      {...strokeProps}
    />
    <rect
      x="16"
      y="4.4"
      width="4.4"
      height="15.8"
      rx="1.5"
      fill={active ? "currentColor" : "none"}
      {...strokeProps}
    />
  </svg>
);

/** Minha Conta — busto simples, o mesmo recorte do avatar da referência. */
export const NavAccountIcon = ({ active = false, size = 23 }: MobileNavIconProps) => (
  <svg {...baseProps(size)}>
    <circle cx="12" cy="8.1" r="3.5" fill={active ? "currentColor" : "none"} {...strokeProps} />
    <path
      d="M4.9 20.3c0-3.7 3.2-5.9 7.1-5.9s7.1 2.2 7.1 5.9"
      fill={active ? "currentColor" : "none"}
      {...strokeProps}
    />
  </svg>
);
