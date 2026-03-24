import { ArrowRightIcon, PlayCircleIcon, ClipboardListIcon, EyeIcon } from "lucide-react";
import type { RunRecord } from "@opengoat/contracts";
import type { ArtifactRecord } from "@opengoat/contracts";
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
    <section className="rounded-lg border bg-card/90 p-4">
      {/* Section label */}
      <div className="mb-3 flex items-center gap-2">
        <PlayCircleIcon className="size-3.5 text-primary" />
        <h2 className="section-label">Now working on</h2>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-primary">
          {status}
        </span>
      </div>

      {/* Run title and metadata */}
      <div className="mb-3">
        <h3 className="text-sm font-medium text-foreground">{latestRun.title}</h3>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground/60">
          {formatRelativeTime(latestRun.updatedAt)}
        </span>
      </div>

      {/* Pending question indicator */}
      {isWaiting && (
        <div className="mb-3 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Waiting for your input to continue
          </p>
        </div>
      )}

      {/* Latest output preview */}
      {latestArtifact && (
        <div className="mb-3 rounded-md border border-border/30 px-3 py-2">
          <p className="text-xs text-muted-foreground">Latest output</p>
          <p className="truncate text-sm text-foreground">{latestArtifact.title}</p>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex flex-wrap items-center gap-2">
        {latestRun.sessionId && onResumeRun && (
          <button
            type="button"
            onClick={() => onResumeRun(latestRun.sessionId!)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Continue
            <ArrowRightIcon className="size-3" />
          </button>
        )}
        {latestArtifact && (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
          >
            <EyeIcon className="size-3" />
            Review
          </button>
        )}
        <a
          href="#board"
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
        >
          <ClipboardListIcon className="size-3" />
          Open Board
        </a>
      </div>

      {/* Other active runs */}
      {runs.length > 1 && (
        <div className="mt-3 border-t border-border/30 pt-2">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
            {runs.length - 1} more active {runs.length - 1 === 1 ? "job" : "jobs"}
          </p>
          <div className="flex flex-col gap-1">
            {runs.slice(1, 4).map((run) => (
              <div key={run.runId} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="size-1.5 rounded-full bg-primary/40" />
                <span className="truncate">{run.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
