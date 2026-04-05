import { ArrowRightIcon, ZapIcon } from "lucide-react";
import type { HeroRecommendation } from "@/features/dashboard/lib/hero-recommendation";

export interface HeroRecommendedMoveProps {
  recommendation: HeroRecommendation | null;
  onActionClick?: (actionId: string) => void;
}

export function HeroRecommendedMove({
  recommendation,
  onActionClick,
}: HeroRecommendedMoveProps) {
  if (!recommendation) return null;

  return (
    <div>
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">
        BEST FIRST MOVE
      </span>
      <button
        type="button"
        onClick={() => onActionClick?.(recommendation.actionId)}
        className="group/move mt-2 flex w-full items-center gap-3 rounded-lg border border-border/40 bg-card/60 px-4 py-3 text-left transition-all duration-100 hover:border-primary/25 hover:bg-primary/[0.04] dark:border-white/[0.06] dark:bg-white/[0.02] dark:hover:border-primary/20 dark:hover:bg-primary/[0.04]"
      >
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors duration-100 group-hover/move:bg-primary group-hover/move:text-white">
          <ZapIcon className="size-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-[14px] font-medium text-foreground">
            {recommendation.actionTitle}
          </span>
          <span className="ml-2 text-[13px] text-zinc-500 dark:text-zinc-400">
            with {recommendation.specialistName}
          </span>
        </div>
        <ArrowRightIcon className="size-4 text-muted-foreground/30 transition-all duration-100 group-hover/move:translate-x-0.5 group-hover/move:text-primary" />
      </button>
    </div>
  );
}
