import { LightbulbIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Objective } from "@/features/dashboard/types/objective";

export interface OverviewTabProps {
  objective: Objective | null;
  isLoading: boolean;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="section-label mb-2 font-mono text-[10px] font-medium uppercase tracking-wider text-primary">
      {children}
    </h3>
  );
}

function SectionBlock({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <p className="text-sm leading-relaxed text-foreground/80">{value}</p>
    </div>
  );
}

export function OverviewTab({ objective, isLoading }: OverviewTabProps) {
  if (isLoading || !objective) {
    return (
      <div className="space-y-6 py-5">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 py-5">
      {/* Summary */}
      <SectionBlock label="Summary" value={objective.summary} />

      {/* Why Now */}
      <SectionBlock label="Why Now" value={objective.whyNow} />

      {/* Success Definition */}
      <SectionBlock
        label="Success Definition"
        value={objective.successDefinition}
      />

      {/* Constraints */}
      <SectionBlock label="Constraints" value={objective.constraints} />

      {/* Timeframe */}
      <SectionBlock label="Timeframe" value={objective.timeframe} />

      {/* Already Tried */}
      <SectionBlock label="Already Tried" value={objective.alreadyTried} />

      {/* Avoid */}
      <SectionBlock label="Avoid" value={objective.avoid} />

      {/* Suggested Next Move — placeholder */}
      <Card className="border-primary/15 bg-primary/[0.02]">
        <CardContent className="flex items-start gap-3 py-4">
          <div className="rounded-md bg-primary/10 p-1.5">
            <LightbulbIcon className="size-4 text-primary" />
          </div>
          <div className="flex-1">
            <h4 className="section-label mb-1 font-mono text-[10px] font-medium uppercase tracking-wider text-primary">
              Suggested Next Move
            </h4>
            <p className="text-sm text-muted-foreground">
              AI-powered suggestions will appear here based on your objective
              progress, active runs, and available signals.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
