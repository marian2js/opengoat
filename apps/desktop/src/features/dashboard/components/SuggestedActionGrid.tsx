import { WandSparklesIcon } from "lucide-react";
import type { SpecialistAgent } from "@opengoat/contracts";
import type { ActionCard } from "@/features/dashboard/data/actions";
import { ActionCardItem } from "@/features/dashboard/components/ActionCardItem";
import { getSpecialistName } from "@/features/dashboard/hooks/useSpecialistRoster";

export interface SuggestedActionGridProps {
  actions: ActionCard[];
  completedActions?: Set<string> | undefined;
  isGenerating?: boolean | undefined;
  isActionLoading?: boolean | undefined;
  specialists?: SpecialistAgent[] | undefined;
  onActionClick?: ((actionId: string, prompt: string, label: string) => void) | undefined;
  onViewResults?: ((actionId: string) => void) | undefined;
}

function SuggestedSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-[140px] animate-pulse rounded-xl border border-primary/10 bg-primary/[0.03]"
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
  specialists,
  onActionClick,
  onViewResults,
}: SuggestedActionGridProps) {
  // Don't render anything if no actions and not loading
  if (actions.length === 0 && !isGenerating) return null;

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-primary/10 bg-primary/[0.02] p-4">
      <div className="flex items-center gap-2.5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/8">
          <WandSparklesIcon className="size-3.5 text-primary" />
        </div>
        <h2 className="section-label">
          Suggested Actions
        </h2>
        <span className="rounded-full border border-primary/20 bg-primary/8 px-1.5 py-px font-mono text-[9px] font-semibold uppercase tracking-wider text-primary">
          AI
        </span>
      </div>
      {isGenerating ? (
        <SuggestedSkeleton />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 sm:[&>:last-child:nth-child(2n+1)]:col-span-full xl:[&>:last-child:nth-child(2n+1)]:col-auto xl:[&>:last-child:nth-child(3n+1)]:col-span-full">
          {actions.map((card) => (
            <ActionCardItem
              key={card.id}
              card={card}
              isCompleted={completedActions?.has(card.id)}
              isLoading={isActionLoading}
              variant="secondary"
              specialistId={card.specialistId}
              specialistName={specialists ? getSpecialistName(specialists, card.specialistId) : undefined}
              onClick={onActionClick}
              onViewResults={onViewResults}
            />
          ))}
        </div>
      )}
    </section>
  );
}
