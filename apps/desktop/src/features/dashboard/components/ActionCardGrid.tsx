import { SparklesIcon } from "lucide-react";
import { starterActions } from "@/features/dashboard/data/actions";
import { ActionCardItem } from "@/features/dashboard/components/ActionCardItem";

export interface ActionCardGridProps {
  completedActions?: Set<string> | undefined;
  isLoading?: boolean | undefined;
  onActionClick?: ((actionId: string, prompt: string, label: string) => void) | undefined;
  onViewResults?: ((actionId: string) => void) | undefined;
}

export function ActionCardGrid({ completedActions, isLoading, onActionClick, onViewResults }: ActionCardGridProps) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-primary/8 p-1.5 text-primary">
          <SparklesIcon className="size-4" />
        </div>
        <h2 className="text-base font-semibold tracking-tight">
          What would you like to work on?
        </h2>
      </div>
      <div className="grid justify-items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {starterActions.map((card) => (
          <ActionCardItem
            key={card.id}
            card={card}
            isCompleted={completedActions?.has(card.id)}
            isLoading={isLoading}
            onClick={onActionClick}
            onViewResults={onViewResults}
          />
        ))}
      </div>
    </section>
  );
}
