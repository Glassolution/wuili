/**
 * Ícones da barra inferior do mobile.
 *
 * Feitos à mão em vez de vir de uma biblioteca: as famílias prontas (Lucide,
 * Phosphor) só têm contorno, e a barra precisa do par contorno/preenchido —
 * é o preenchimento que marca a aba ativa agora que o fundo azul saiu. Todos
 * compartilham a mesma grade 24×24, traço 1.5 e cantos arredondados, então o
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
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/**
 * Início — casa de telhado largo (a água passa das paredes) e porta recortada
 * no meio, como no desenho de referência. Preenchida, a porta vira um vão
 * (evenodd); em contorno, aparece como um retângulo.
 */
export const NavHomeIcon = ({ active = false, size = 23 }: MobileNavIconProps) => (
  <svg {...baseProps(size)}>
    <path
      d="M12 3.4 21.4 11h-2.4v9H5v-9H2.6zM10.2 14.8h3.6V20h-3.6z"
      fill={active ? "currentColor" : "none"}
      fillRule="evenodd"
      {...strokeProps}
    />
  </svg>
);

/**
 * Catálogo — caixa em perspectiva (três faces) com a fita no topo, como no
 * desenho de referência. Preenchida, as arestas internas viram linhas brancas
 * para a caixa não virar um hexágono chapado.
 */
export const NavCatalogIcon = ({ active = false, size = 23 }: MobileNavIconProps) => (
  <svg {...baseProps(size)}>
    <path
      d="M12 2.9 20.2 7.4v9.2L12 21.1l-8.2-4.5V7.4z"
      fill={active ? "currentColor" : "none"}
      {...strokeProps}
    />
    <path
      d="M3.9 7.5 12 12l8.1-4.5M12 12v9M7.9 5.15l8.2 4.6"
      {...strokeProps}
      stroke={active ? "#FFFFFF" : "currentColor"}
    />
  </svg>
);

/**
 * Pedidos — recibo da referência: topo liso com cantos arredondados, recortes
 * em U só na base, duas linhas de texto à esquerda (a de cima mais longa).
 * Preenchido, as linhas viram brancas.
 */
export const NavOrdersIcon = ({ active = false, size = 23 }: MobileNavIconProps) => (
  <svg {...baseProps(size)}>
    <path
      d="M6 20.8V6.1A1.9 1.9 0 0 1 7.9 4.2h8.2A1.9 1.9 0 0 1 18 6.1v14.7l-3-1.9-3 1.9-3-1.9z"
      fill={active ? "currentColor" : "none"}
      {...strokeProps}
    />
    <path
      d="M8.4 8.2h7M8.4 11.7h3.6"
      {...strokeProps}
      stroke={active ? "#FFFFFF" : "currentColor"}
    />
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

/**
 * Atlas — balão de conversa. Fica no círculo escuro do meio, então é só o
 * preenchimento branco: um chat reconhecível, sem cara de IA.
 */
export const NavAtlasIcon = ({ size = 22 }: MobileNavIconProps) => (
  <svg {...baseProps(size)}>
    <path
      fill="currentColor"
      d="M7.1 3.6h9.8A3.5 3.5 0 0 1 20.4 7.1v6.4a3.5 3.5 0 0 1-3.5 3.5h-3.4l-3.8 3.2c-.5.4-1.2.05-1.2-.55v-2.65H7.1A3.5 3.5 0 0 1 3.6 13.5V7.1A3.5 3.5 0 0 1 7.1 3.6z"
    />
  </svg>
);
