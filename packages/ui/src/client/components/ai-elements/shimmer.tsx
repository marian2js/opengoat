"use client";

import type { CSSProperties, ElementType } from "react";

import { cn } from "@/lib/utils";
import { memo } from "react";

export interface ShimmerProps {
  children: string;
  as?: ElementType;
  className?: string;
  duration?: number;
  spread?: number;
}

const ShimmerComponent = ({
  children,
  as: Component = "p",
  className,
  duration = 2,
  spread = 2,
}: ShimmerProps) => {
  const dynamicSpread = Math.max(8, (children.length || 1) * spread);

  return (
    <Component
      className={cn("opengoat-ai-shimmer", className)}
      style={
        {
          "--opengoat-shimmer-duration": `${duration}s`,
          "--opengoat-shimmer-spread": `${dynamicSpread}px`,
        } as CSSProperties
      }
    >
      {children}
    </Component>
  );
};

export const Shimmer = memo(ShimmerComponent);
