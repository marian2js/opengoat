import { ClipboardListIcon, ArrowRightIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { BoardCounts } from "@/features/dashboard/lib/compute-board-counts";

export interface BoardSummaryProps {
  counts: BoardCounts;
  isLoading: boolean;
  isEmpty: boolean;
}

export function BoardSummary({ counts, isLoading, isEmpty }: BoardSummaryProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2.5 py-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-8" />
        <Skeleton className="h-4 w-20" />
      </div>
    );
  }

  if (isEmpty) {
    return null;
  }

  const total = counts.open + counts.blocked + counts.pending + counts.done;

  // Build status segments for the mini progress bar
  const segments: { count: number; color: string; label: string }[] = [];
  if (counts.open > 0) segments.push({ count: counts.open, color: "bg-primary", label: "open" });
  if (counts.blocked > 0) segments.push({ count: counts.blocked, color: "bg-destructive", label: "blocked" });
  if (counts.pending > 0) segments.push({ count: counts.pending, color: "bg-amber-500", label: "pending" });
  if (counts.done > 0) segments.push({ count: counts.done, color: "bg-muted-foreground/30", label: "done" });

  return (
    <a
      href="#board"
      className="group/board flex items-center justify-between rounded-lg border border-border/30 px-4 py-3 transition-all duration-100 hover:border-border/50 hover:bg-muted/30 dark:border-white/[0.04] dark:hover:border-white/[0.08]"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/50">
          <ClipboardListIcon className="size-3.5 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium text-foreground/80">Board</span>
            <span className="rounded-full bg-muted/50 px-2 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground/70">
              {total}
            </span>
          </div>
          {/* Mini status bar */}
          {total > 0 && (
            <div className="flex h-1.5 w-32 overflow-hidden rounded-full bg-muted/30">
              {segments.map((seg) => (
                <div
                  key={seg.label}
                  className={`${seg.color} transition-all duration-300`}
                  style={{ width: `${(seg.count / total) * 100}%` }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {/* Status chips */}
        <div className="hidden items-center gap-2 sm:flex">
          {counts.open > 0 && (
            <span className="font-mono text-[10px] text-primary">
              {counts.open} open
            </span>
          )}
          {counts.blocked > 0 && (
            <span className="font-mono text-[10px] text-destructive">
              {counts.blocked} blocked
            </span>
          )}
          {counts.done > 0 && (
            <span className="font-mono text-[10px] text-muted-foreground/50">
              {counts.done} done
            </span>
          )}
        </div>
        <span className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground/70 transition-colors group-hover/board:text-primary">
          View
          <ArrowRightIcon className="size-3 transition-transform duration-150 group-hover/board:translate-x-0.5" />
        </span>
      </div>
    </a>
  );
}
