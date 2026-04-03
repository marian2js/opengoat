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
    <div className="relative z-10 rounded-xl border border-border/20 bg-card/60 px-5 py-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/8">
              <ClipboardListIcon className="size-3 text-primary" />
            </div>
            <h2 className="section-label">Board</h2>
            <span className="rounded-full bg-muted/40 px-2 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground/70">
              {total}
            </span>
          </div>
          <div className="hidden items-center gap-1.5 sm:flex">
            {pills.filter((pill) => pill.value > 0).map((pill) => (
              <span
                key={pill.label}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-medium tracking-wider ${pill.className}`}
              >
                <span className="tabular-nums">{pill.value}</span>
                <span>{pill.label}</span>
              </span>
            ))}
          </div>
        </div>
        <a
          href="#board"
          className="group/link inline-flex items-center gap-1 text-xs font-medium text-muted-foreground/70 transition-colors hover:text-primary"
        >
          View Board
          <ArrowRightIcon className="size-3 transition-transform duration-150 group-hover/link:translate-x-0.5" />
        </a>
      </div>
      {activeObjective && (
        <div className="mt-2.5 flex items-center gap-2">
          <TargetIcon className="size-3 text-primary/50" />
          <a
            href={`#board?objective=${activeObjective.objectiveId}`}
            className="truncate text-xs text-muted-foreground transition-colors hover:text-primary"
          >
            {activeObjective.title}
          </a>
        </div>
      )}
    </div>
  );
}
