import { useMemo } from "react";
import { LightbulbIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  extractOpportunities,
  type WorkspaceFiles,
} from "@/features/dashboard/data/opportunities";
import { OpportunityCard } from "@/features/dashboard/components/OpportunityCard";

export interface OpportunitySectionProps {
  completedActions?: Set<string> | undefined;
  files: WorkspaceFiles | null;
  isLoading: boolean;
  onActionClick?: ((actionId: string, prompt: string, label: string) => void) | undefined;
  onViewResults?: ((actionId: string) => void) | undefined;
}

function OpportunitySkeleton() {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Skeleton className="size-7 rounded-lg" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-lg border border-border/50 bg-card/60 px-4 py-3"
          >
            <div className="flex items-start justify-between gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-16 rounded-full" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function OpportunitySection({
  completedActions,
  files,
  isLoading,
  onActionClick,
  onViewResults,
}: OpportunitySectionProps) {
  const opportunities = useMemo(
    () => (files ? extractOpportunities(files) : []),
    [files],
  );

  if (isLoading) {
    return <OpportunitySkeleton />;
  }

  if (opportunities.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <LightbulbIcon className="size-3.5 text-primary" />
        <h2 className="section-label">Insights</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {opportunities.map((opp) => (
          <OpportunityCard
            key={opp.id}
            completedActions={completedActions}
            opportunity={opp}
            onActionClick={onActionClick}
            onViewResults={onViewResults}
          />
        ))}
      </div>
    </section>
  );
}
