import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-[14px] px-5 text-[14px] font-medium transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[#111111] text-white shadow-[0_1px_2px_rgba(0,0,0,0.06)] hover:bg-black/90",
        destructive:
          "bg-red-50 text-red-600 hover:bg-red-100",
        outline:
          "border border-border bg-white text-foreground hover:bg-muted",
        secondary:
          "bg-muted text-foreground hover:bg-muted/80",
        ghost:
          "h-11 bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
        link: "h-11 bg-transparent px-0 text-foreground underline-offset-4 hover:underline",
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
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
