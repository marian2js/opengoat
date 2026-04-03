import {
  TargetIcon,
  PlayIcon,
  ArrowRightIcon,
  RefreshCwIcon,
  ClipboardListIcon,
  FileCheckIcon,
  ActivityIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Objective } from "@/features/dashboard/types/objective";

export interface ActiveObjectiveSectionProps {
  objective: Objective;
  isLoading: boolean;
  openTaskCount: number;
  onOpenObjective?: () => void;
  onSwitchObjective?: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted/50 text-muted-foreground",
  active: "bg-primary/10 text-primary",
  paused: "bg-warning/10 text-warning",
  completed: "bg-success/10 text-success dark:bg-green-900/20 dark:text-green-400",
  abandoned: "bg-destructive/10 text-destructive",
};

export function ActiveObjectiveSection({
  objective,
  isLoading,
  openTaskCount,
  onOpenObjective,
  onSwitchObjective,
}: ActiveObjectiveSectionProps) {
  if (isLoading) {
    return (
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Skeleton className="size-3.5" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-32 w-full rounded-xl" />
      </section>
    );
  }

  const statusStyle = STATUS_STYLES[objective.status] ?? STATUS_STYLES.draft;

  return (
    <section className="flex flex-col gap-4">
      {/* Section label */}
      <div className="flex items-center gap-2.5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/8">
          <TargetIcon className="size-3.5 text-primary" />
        </div>
        <h2 className="section-label">Active Objective</h2>
      </div>

      {/* Objective card */}
      <Card className="border-primary/20 bg-card/80">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`font-mono text-[10px] uppercase tracking-wider ${statusStyle}`}
            >
              {objective.status}
            </Badge>
            {objective.goalType ? (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                {objective.goalType}
              </Badge>
            ) : null}
          </div>
          <CardTitle className="font-display text-lg font-bold leading-snug tracking-tight">
            {objective.title}
          </CardTitle>
          {objective.whyNow ? (
            <p className="text-sm text-muted-foreground/80">{objective.whyNow}</p>
          ) : null}
          {objective.summary ? (
            <p className="text-sm text-muted-foreground/70 line-clamp-2">{objective.summary}</p>
          ) : null}
        </CardHeader>

        <CardContent className="pt-0">
          {/* Stats row */}
          <div className="flex items-center gap-4 border-t border-border/30 pt-3">
            <div className="flex items-center gap-1.5">
              <ActivityIcon className="size-3 text-muted-foreground/50" />
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                0 runs
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <ClipboardListIcon className="size-3 text-muted-foreground/50" />
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {openTaskCount} {openTaskCount === 1 ? 'task' : 'tasks'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <FileCheckIcon className="size-3 text-muted-foreground/50" />
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                0 artifacts
              </span>
            </div>
          </div>

          {/* Quick actions */}
          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              className="gap-1.5"
              onClick={onOpenObjective}
            >
              <ArrowRightIcon className="size-3.5" />
              Open objective
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              disabled
            >
              <PlayIcon className="size-3.5" />
              Resume work
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={onSwitchObjective}
            >
              <RefreshCwIcon className="size-3.5" />
              Switch objective
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
