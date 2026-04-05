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
    <div className="rounded-xl border border-primary/10 bg-primary/[0.015] px-4 py-3.5 dark:border-primary/[0.06] dark:bg-primary/[0.02]">
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">
        BEST FIRST MOVE
      </span>
      <button
        type="button"
        onClick={() => onActionClick?.(recommendation.actionId)}
        className="group/move mt-2.5 flex w-full items-center gap-3 rounded-xl border border-primary/15 bg-primary/[0.03] px-4 py-3.5 text-left transition-all duration-100 ease-out hover:-translate-y-px hover:border-primary/25 hover:bg-primary/[0.06] hover:shadow-md dark:border-primary/10 dark:bg-primary/[0.03]"
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary transition-colors duration-100 group-hover/move:bg-primary group-hover/move:text-white">
          <ZapIcon className="size-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-[14px] font-semibold text-foreground">
            {recommendation.actionTitle}
          </span>
          <p className="mt-0.5 text-[12px] text-zinc-500 dark:text-zinc-400">
            with {recommendation.specialistName}
          </p>
        </div>
        <ArrowRightIcon className="size-4 text-primary/30 transition-all duration-100 group-hover/move:translate-x-0.5 group-hover/move:text-primary" />
      </button>
    </div>
  );
}
