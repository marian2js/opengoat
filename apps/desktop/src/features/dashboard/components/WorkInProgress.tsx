import { PlayCircleIcon, ArrowRightIcon } from "lucide-react";
import type { RunRecord } from "@opengoat/contracts";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime } from "@/features/board/lib/format-relative-time";

export interface WorkInProgressProps {
  runs: RunRecord[];
  isLoading: boolean;
  isEmpty: boolean;
  onResumeRun?: ((sessionId: string) => void) | undefined;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  running: { label: "RUNNING", className: "bg-primary/10 text-primary" },
  waiting_review: {
    label: "REVIEW",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  blocked: {
    label: "BLOCKED",
    className:
      "bg-destructive/10 text-destructive dark:bg-red-900/20 dark:text-red-400",
  },
  draft: {
    label: "DRAFT",
    className: "bg-muted/50 text-muted-foreground",
  },
};

export function WorkInProgress({
  runs,
  isLoading,
  isEmpty,
  onResumeRun,
}: WorkInProgressProps) {
  if (isEmpty && !isLoading) return null;

  if (isLoading) {
    return (
      <div className="py-5">
        <div className="flex items-center gap-2 mb-3">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </div>
    );
  }

  return (
    <div className="py-5">
      {/* Section header */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/8">
          <PlayCircleIcon className="size-3.5 text-primary" />
        </div>
        <h2 className="section-label">Work in Progress</h2>
        <span className="rounded-full bg-muted/50 px-2 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
          {runs.length}
        </span>
      </div>

      {/* Run list */}
      <div className="flex flex-col gap-1">
        {runs.map((run) => {
          const config = statusConfig[run.status] ?? statusConfig["draft"]!;
          return (
            <div
              key={run.runId}
              className="group flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/30"
            >
              {/* Status badge */}
              <span
                className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-medium tracking-wider ${config.className}`}
              >
                {config.label}
              </span>

              {/* Title */}
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {run.title}
              </span>

              {/* Phase */}
              {run.phase ? (
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                  {run.phase}
                </span>
              ) : null}

              {/* Playbook ID */}
              {run.playbookId ? (
                <span className="hidden shrink-0 rounded bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground lg:inline">
                  {run.playbookId}
                </span>
              ) : null}

              {/* Relative time */}
              <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground/60">
                {formatRelativeTime(run.updatedAt)}
              </span>

              {/* Resume button */}
              {run.sessionId && onResumeRun ? (
                <button
                  type="button"
                  onClick={() => onResumeRun(run.sessionId!)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary opacity-0 transition-all hover:bg-primary/10 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                >
                  Resume
                  <ArrowRightIcon className="size-3" />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
