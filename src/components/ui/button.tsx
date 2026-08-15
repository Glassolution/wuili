import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { PILOT_BLUE_BACKGROUND, getPremiumActionButtonStyle } from "@/components/PremiumActionButton";

const buttonVariants = cva(
  "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-[14px] px-5 text-[14px] font-medium transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Mesmo acabamento do "Botão Pilot" (o CTA "Criar minha loja grátis"):
        // brilho no topo, sombra de apoio e o hover que sobe 1px. O relevo vem
        // de getPremiumActionButtonStyle, aplicado no componente — aqui ficam só
        // o movimento e a classe que o catálogo usa para desligar tudo.
        default:
          "velo-premium-btn velo-prime-button text-white transition-all duration-200 ease-out hover:-translate-y-[1px] hover:brightness-105 active:translate-y-0",
        destructive:
          "bg-red-50 text-red-600 hover:bg-red-100",
        outline:
          "border border-border bg-white text-foreground hover:bg-muted",
        secondary:
          "bg-muted text-foreground hover:bg-muted/80",
        ghost:
          "h-11 bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
        link: "h-11 bg-transparent px-0 text-foreground underline-offset-4 hover:underline",
        // "Botão Pilot": mesmo desenho do CTA "Criar Página com IA" da home —
        // raio de 12px, texto medium, brilho forte no topo e hover que sobe 1px.
        // Só a cor muda: aqui o fundo é o escuro da marca, e o brilho vem de
        // getPremiumActionButtonStyle({ intensity: "strong" }), aplicado no
        // componente para o estilo ter uma fonte só.
        pilot:
          "velo-premium-btn velo-prime-button h-10 rounded-[12px] px-4 text-[13px] font-medium text-white transition-all duration-200 ease-out hover:-translate-y-[1px] hover:brightness-105 active:translate-y-0",
        // Variante azul do Pilot: mesmo desenho, na cor do CTA da home.
        pilotBlue:
          "velo-premium-btn velo-prime-button velo-prime-button--blue h-10 rounded-[12px] px-4 text-[13px] font-medium text-white transition-all duration-200 ease-out hover:-translate-y-[1px] hover:brightness-105 active:translate-y-0",
        // Par claro do Pilot: mesmo desenho e mesmo peso de texto, mantendo a
        // superfície branca.
        pilotLight:
          "h-10 rounded-[12px] border border-black/[0.12] bg-white px-4 text-[13px] font-medium text-[#252936] shadow-[0_7px_13px_rgba(15,23,42,0.10)] transition-all duration-200 ease-out hover:-translate-y-[1px] hover:bg-black hover:text-white active:translate-y-0",
      },
      size: {
        default: "",
        sm: "h-10 rounded-[12px] px-4 text-[13px]",
        lg: "h-12 rounded-[16px] px-6 text-[15px]",
        icon: "h-11 w-11 rounded-[14px] px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, style, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    // O brilho do Pilot mora em getPremiumActionButtonStyle() e é injetado aqui,
    // em vez de duplicado como classe: assim ajustar o reflexo continua sendo
    // mexer num arquivo só. `intensity: "strong"` é o mesmo do CTA da home.
    // `style` do chamador vem depois e pode sobrescrever.
    const pilotStyle =
      variant === "pilot"
        ? { ...getPremiumActionButtonStyle({ intensity: "strong" }), ...style }
        : variant === "pilotBlue"
          ? {
              ...getPremiumActionButtonStyle({
                background: PILOT_BLUE_BACKGROUND,
                intensity: "strong",
              }),
              ...style,
            }
          : variant === "default" || variant === undefined
            ? {
                ...getPremiumActionButtonStyle({ intensity: "strong" }),
                ...style,
              }
            : style;

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        style={pilotStyle}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
