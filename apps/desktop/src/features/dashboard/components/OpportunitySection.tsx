import { useMemo } from "react";
import { LightbulbIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  extractOpportunities,
  type WorkspaceFiles,
} from "@/features/dashboard/data/opportunities";
import { OpportunityCard } from "@/features/dashboard/components/OpportunityCard";

export interface OpportunitySectionProps {
  files: WorkspaceFiles | null;
  isLoading: boolean;
  onActionClick?: ((actionId: string, prompt: string, label: string) => void) | undefined;
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
  files,
  isLoading,
  onActionClick,
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
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-primary/8 p-1.5 text-primary">
          <LightbulbIcon className="size-4" />
        </div>
        <h2 className="text-sm font-semibold tracking-tight">Insights</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {opportunities.map((opp) => (
          <OpportunityCard
            key={opp.id}
            opportunity={opp}
            onActionClick={onActionClick}
          />
        ))}
      </div>
    </section>
  );
}
