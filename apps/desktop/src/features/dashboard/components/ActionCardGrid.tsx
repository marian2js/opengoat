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
        <SparklesIcon className="size-3.5 text-primary" />
        <h2 className="section-label">
          Quick Actions
        </h2>
      </div>
      <div className="grid justify-items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3 sm:[&>:last-child:nth-child(2n+1)]:col-span-full xl:[&>:last-child:nth-child(2n+1)]:col-auto xl:[&>:last-child:nth-child(3n+1)]:col-span-full">
        {starterActions.map((card, index) => (
          <ActionCardItem
            key={card.id}
            card={card}
            isCompleted={completedActions?.has(card.id)}
            isHero={index < 3}
            isLoading={isLoading}
            onClick={onActionClick}
            onViewResults={onViewResults}
          />
        ))}
      </div>
    </section>
  );
}
