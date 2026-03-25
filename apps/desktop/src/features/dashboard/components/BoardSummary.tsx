import { ClipboardListIcon, ArrowRightIcon, TargetIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { BoardCounts } from "@/features/dashboard/lib/compute-board-counts";

export interface ActiveObjectiveInfo {
  objectiveId: string;
  title: string;
}

export interface BoardSummaryProps {
  counts: BoardCounts;
  isLoading: boolean;
  isEmpty: boolean;
  activeObjective?: ActiveObjectiveInfo | null;
}

interface CountPill {
  label: string;
  value: number;
  className: string;
}

function getPills(counts: BoardCounts): CountPill[] {
  return [
    {
      label: "OPEN",
      value: counts.open,
      className: "bg-primary/10 text-primary",
    },
    {
      label: "BLOCKED",
      value: counts.blocked,
      className: "bg-destructive/10 text-destructive dark:bg-red-900/20 dark:text-red-400",
    },
    {
      label: "PENDING REVIEW",
      value: counts.pending,
      className: "bg-warning/10 text-warning dark:bg-amber-900/20 dark:text-amber-400",
    },
    {
      label: "DONE",
      value: counts.done,
      className: "bg-success/10 text-success dark:bg-green-900/20 dark:text-green-400",
    },
  ];
}

export function BoardSummary({ counts, isLoading, isEmpty, activeObjective }: BoardSummaryProps) {
  if (isLoading) {
    return (
      <div className="relative z-10 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-16" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return null;
  }

  const pills = getPills(counts);
  const total = counts.open + counts.blocked + counts.pending + counts.done;

  return (
    <div className="relative z-10 rounded-lg border border-border/30 bg-card/50 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <ClipboardListIcon className="size-3.5 text-primary" />
            <h2 className="section-label">Board</h2>
            <span className="rounded-full bg-muted/50 px-2 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
              {total}
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            {pills.map((pill) => (
              <span
                key={pill.label}
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] font-medium tracking-wider ${pill.className}`}
              >
                <span className="tabular-nums">{pill.value}</span>
                <span>{pill.label}</span>
              </span>
            ))}
          </div>
        </div>
        <a
          href="#board"
          className="group/link inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          View Board
          <ArrowRightIcon className="size-3 transition-transform group-hover/link:translate-x-0.5" />
        </a>
      </div>
      {activeObjective && (
        <div className="mt-2 flex items-center gap-2">
          <TargetIcon className="size-3 text-primary/60" />
          <a
            href={`#board?objective=${activeObjective.objectiveId}`}
            className="text-xs text-muted-foreground hover:text-primary transition-colors truncate"
          >
            {activeObjective.title}
          </a>
        </div>
      )}
    </div>
  );
}
