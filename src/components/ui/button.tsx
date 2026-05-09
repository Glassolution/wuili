import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[100px] font-medium transition-all duration-[120ms] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0A0A0A] focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-40 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[#0A0A0A] text-white shadow-[0_1px_2px_rgba(0,0,0,0.10)] hover:opacity-[0.85] hover:scale-[0.98]",
        destructive:
          "bg-[#FEF2F2] text-[#DC2626] hover:bg-[#FEE2E2]",
        outline:
          "border-[1.5px] border-[#E5E5E5] bg-transparent text-[#0A0A0A] hover:border-[#0A0A0A] hover:bg-[#F5F5F5]",
        secondary:
          "bg-[#F5F5F5] text-[#0A0A0A] hover:bg-[#EBEBEB]",
        ghost:
          "rounded-[8px] bg-transparent text-[#737373] hover:bg-[#F5F5F5] hover:text-[#0A0A0A]",
        link: "rounded-none text-[#0A0A0A] underline-offset-4 hover:underline",
      },
      size: {
        default: "px-[22px] py-[11px] text-[14px]",
        sm: "px-4 py-2 text-[13px]",
        lg: "px-7 py-[14px] text-[15px]",
        icon: "h-9 w-9 rounded-[8px]",
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
