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
  const heroActions = starterActions.slice(0, 3);
  const remainingActions = starterActions.slice(3);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/8">
          <SparklesIcon className="size-3 text-primary" />
        </div>
        <h2 className="section-label">Quick Actions</h2>
      </div>

      {/* Hero row — top 3 actions in a prominent row */}
      <div className="grid gap-3 sm:grid-cols-3">
        {heroActions.map((card) => (
          <ActionCardItem
            key={card.id}
            card={card}
            isCompleted={completedActions?.has(card.id)}
            isHero
            isLoading={isLoading}
            specialistId={card.specialistId}
            specialistName={specialists ? getSpecialistName(specialists, card.specialistId) : undefined}
            onClick={onActionClick}
            onViewResults={onViewResults}
          />
        ))}
      </div>

      {/* Remaining actions — standard 2-col grid */}
      {remainingActions.length > 0 ? (
        <div className="grid justify-items-stretch gap-3 sm:grid-cols-2 sm:[&>:last-child:nth-child(2n+1)]:col-span-full">
          {remainingActions.map((card) => (
            <ActionCardItem
              key={card.id}
              card={card}
              isCompleted={completedActions?.has(card.id)}
              isLoading={isLoading}
              specialistId={card.specialistId}
              specialistName={specialists ? getSpecialistName(specialists, card.specialistId) : undefined}
              onClick={onActionClick}
              onViewResults={onViewResults}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
