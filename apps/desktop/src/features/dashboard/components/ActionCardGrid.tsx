import type { SpecialistAgent } from "@opengoat/contracts";
import { SparklesIcon } from "lucide-react";
import { starterActions } from "@/features/dashboard/data/actions";
import { ActionCardItem } from "@/features/dashboard/components/ActionCardItem";
import { getSpecialistName } from "@/features/dashboard/hooks/useSpecialistRoster";

export interface ActionCardGridProps {
  completedActions?: Set<string> | undefined;
  isLoading?: boolean | undefined;
  specialists?: SpecialistAgent[] | undefined;
  onActionClick?: ((actionId: string, prompt: string, label: string) => void) | undefined;
  onViewResults?: ((actionId: string) => void) | undefined;
}

export function ActionCardGrid({ completedActions, isLoading, specialists, onActionClick, onViewResults }: ActionCardGridProps) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/8">
          <SparklesIcon className="size-3 text-primary" />
        </div>
        <h2 className="section-label">Quick Actions</h2>
      </div>
      <div className="grid justify-items-stretch gap-3 sm:grid-cols-2 sm:[&>:last-child:nth-child(2n+1)]:col-span-full">
        {starterActions.map((card, index) => (
          <ActionCardItem
            key={card.id}
            card={card}
            isCompleted={completedActions?.has(card.id)}
            isHero={index < 3}
            isLoading={isLoading}
            specialistName={specialists ? getSpecialistName(specialists, card.specialistId) : undefined}
            onClick={onActionClick}
            onViewResults={onViewResults}
          />
        ))}
      </div>
    </section>
  );
}
