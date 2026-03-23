import { formatCountBadge } from "./row-badges-helpers";
import { cn } from "@/lib/utils";

interface ContextBadgeProps {
  count: number;
  variant?: "default" | "danger";
  label?: string;
}

export function ContextBadge({ count, variant = "default", label }: ContextBadgeProps) {
  const formatted = formatCountBadge(count);
  if (!formatted) return null;

  return (
    <span
      className={cn(
        "inline-flex size-5 items-center justify-center rounded-full font-mono text-[10px] font-medium tabular-nums",
        variant === "danger"
          ? "bg-destructive/10 text-destructive dark:bg-red-900/20 dark:text-red-400"
          : "bg-muted text-muted-foreground",
      )}
      title={label ? `${formatted} ${label}` : formatted}
    >
      {formatted}
    </span>
  );
}
