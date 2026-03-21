import { WandSparklesIcon } from "lucide-react";
import type { ActionCard } from "@/features/dashboard/data/actions";
import { ActionCardItem } from "@/features/dashboard/components/ActionCardItem";

export interface SuggestedActionGridProps {
  actions: ActionCard[];
  completedActions?: Set<string> | undefined;
  isGenerating?: boolean | undefined;
  isActionLoading?: boolean | undefined;
  onActionClick?: ((actionId: string, prompt: string, label: string) => void) | undefined;
  onViewResults?: ((actionId: string) => void) | undefined;
}

function SuggestedSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-[140px] animate-pulse rounded-xl border border-border/40 bg-muted/30"
        />
      ))}
    </div>
  );
}

export function SuggestedActionGrid({
  actions,
  completedActions,
  isGenerating,
  isActionLoading,
  onActionClick,
  onViewResults,
}: SuggestedActionGridProps) {
  // Don't render anything if no actions and not loading
  if (actions.length === 0 && !isGenerating) return null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-violet-500/10 p-1.5 text-violet-600 dark:text-violet-400">
          <WandSparklesIcon className="size-4" />
        </div>
        <h2 className="text-sm font-semibold tracking-tight">
          Suggested for you
        </h2>
        <span className="rounded-full border border-violet-500/20 bg-violet-500/8 px-2 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-400">
          AI
        </span>
      </div>
      {isGenerating ? (
        <SuggestedSkeleton />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {actions.map((card) => (
            <ActionCardItem
              key={card.id}
              card={card}
              isCompleted={completedActions?.has(card.id)}
              isLoading={isActionLoading}
              onClick={onActionClick}
              onViewResults={onViewResults}
            />
          ))}
        </div>
      )}
    </section>
  );
}
