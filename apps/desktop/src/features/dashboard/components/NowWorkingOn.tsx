import { ArrowRightIcon, LayoutDashboardIcon, PlayCircleIcon } from "lucide-react";
import type { RunRecord } from "@opengoat/contracts";
import type { ArtifactRecord } from "@opengoat/contracts";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime } from "@/features/board/lib/format-relative-time";

export interface NowWorkingOnProps {
  runs: RunRecord[];
  latestArtifact?: ArtifactRecord | null;
  onResumeRun?: (sessionId: string) => void;
}

const statusLabel: Record<string, string> = {
  running: "Working",
  waiting_review: "Needs input",
  blocked: "Blocked",
  draft: "Starting",
};

export function NowWorkingOn({ runs, latestArtifact, onResumeRun }: NowWorkingOnProps) {
  if (runs.length === 0) return null;

  const latestRun = runs[0]!;
  const status = statusLabel[latestRun.status] ?? "Working";
  const isWaiting = latestRun.status === "waiting_review";

  return (
    <section className="rounded-xl border border-border/20 bg-card p-5 shadow-sm">
      {/* Section label */}
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/8">
          <PlayCircleIcon className="size-3 text-primary" />
        </div>
        <h2 className="section-label">Now working on</h2>
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-primary">
          {status}
        </span>
      </div>

      {/* Run title and metadata */}
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-foreground">{latestRun.title}</h3>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground/40">
          {formatRelativeTime(latestRun.updatedAt)}
        </span>
      </div>

      {/* Pending question indicator */}
      {isWaiting && (
        <div className="mb-3.5 rounded-lg border border-amber-500/15 bg-amber-500/5 px-3.5 py-2.5">
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
            Waiting for your input to continue
          </p>
        </div>
      )}

      {/* Latest output preview */}
      {latestArtifact && (
        <div className="mb-3.5 rounded-lg border border-border/20 bg-muted/30 px-3.5 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">Latest output</p>
          <p className="truncate text-sm text-foreground">{latestArtifact.title}</p>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex items-center gap-2">
        {latestRun.sessionId && onResumeRun && (
          <button
            type="button"
            onClick={() => onResumeRun(latestRun.sessionId!)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Continue
            <ArrowRightIcon className="size-3" />
          </button>
        )}
        <a
          href="#board"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/30 px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <LayoutDashboardIcon className="size-3" />
          Open Board
        </a>
      </div>

      {/* Other active runs */}
      {runs.length > 1 && (
        <div className="mt-4 border-t border-border/15 pt-3">
          <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/40">
            {runs.length - 1} more active {runs.length - 1 === 1 ? "job" : "jobs"}
          </p>
          <div className="flex flex-col gap-1.5">
            {runs.slice(1, 4).map((run) => (
              <div key={run.runId} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="size-1.5 rounded-full bg-primary/30" />
                <span className="truncate">{run.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function NowWorkingOnSkeleton() {
  return (
    <section className="animate-pulse rounded-lg border bg-card/90 p-4">
      {/* Header: icon + label + status badge */}
      <div className="mb-3 flex items-center gap-2.5">
        <Skeleton className="size-7 rounded-md" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-4 w-16 rounded-full" />
      </div>
      {/* Title + timestamp */}
      <div className="mb-3 space-y-1.5">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-2.5 w-20" />
      </div>
      {/* Action buttons placeholder */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-24 rounded-md" />
        <Skeleton className="h-7 w-20 rounded-md" />
      </div>
    </section>
  );
}
