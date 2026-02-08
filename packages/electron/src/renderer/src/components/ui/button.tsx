import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[transform,background-color,color,border-color,box-shadow,opacity] duration-200 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 outline-none focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "border border-transparent bg-[linear-gradient(180deg,hsl(163_80%_51%),hsl(161_72%_42%))] text-primary-foreground shadow-[0_10px_24px_hsl(162_78%_42%_/_0.3)] hover:brightness-[1.04]",
        glow: "border border-primary/30 bg-[linear-gradient(135deg,hsl(163_80%_51%),hsl(161_74%_44%))] text-primary-foreground shadow-[0_0_24px_hsl(162_78%_49%_/_0.35),0_12px_28px_hsl(162_78%_42%_/_0.25)] hover:shadow-[0_0_36px_hsl(162_78%_49%_/_0.45),0_16px_32px_hsl(162_78%_42%_/_0.3)] hover:brightness-[1.05] transition-all",
        destructive:
          "border border-destructive/30 bg-destructive/85 text-white shadow-[0_10px_24px_hsl(0_72%_40%_/_0.28)] hover:bg-destructive/95 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        outline:
          "border border-border/80 bg-[color-mix(in_oklab,var(--surface)_82%,transparent)] text-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%_/_0.03)] hover:border-border hover:bg-[color-mix(in_oklab,var(--surface)_88%,transparent)]",
        secondary:
          "border border-border/70 bg-secondary/80 text-secondary-foreground hover:bg-secondary",
        ghost:
          "text-foreground/80 hover:bg-accent/70 hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
