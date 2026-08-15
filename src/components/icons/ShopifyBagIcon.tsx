import type { CSSProperties } from "react";

type ShopifyBagIconProps = {
  size?: number;
  className?: string;
  style?: CSSProperties;
  // Mantém a mesma assinatura dos ícones lucide usados na sidebar e no header
  // (ignorado aqui, pois o desenho é sólido e não traçado).
  strokeWidth?: number;
  "aria-hidden"?: boolean | "true" | "false";
};

// Logo oficial (public/shopify logo.png) recortado e com fundo transparente.
const MASK_URL = "/brand/shopify-bag-mask.png";

/**
 * Sacola da Shopify como máscara, para que o ícone assuma `currentColor` e
 * acompanhe a cor do item ativo/inativo da sidebar. O "S" e o vinco lateral são
 * vazados, então aparecem na cor do fundo, como no logo original.
 */
const ShopifyBagIcon = ({
  size = 17,
  className,
  style,
  strokeWidth: _strokeWidth,
  ...rest
}: ShopifyBagIconProps) => (
  <span
    className={className}
    {...rest}
    style={{
      display: "inline-block",
      width: size,
      height: size,
      backgroundColor: "currentColor",
      WebkitMaskImage: `url("${MASK_URL}")`,
      maskImage: `url("${MASK_URL}")`,
      WebkitMaskRepeat: "no-repeat",
      maskRepeat: "no-repeat",
      WebkitMaskPosition: "center",
      maskPosition: "center",
      WebkitMaskSize: "contain",
      maskSize: "contain",
      ...style,
    }}
  />
);

export default ShopifyBagIcon;
