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

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2.5">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted/40">
          <ClipboardListIcon className="size-3 text-muted-foreground" />
        </div>
        <span className="text-[12px] font-medium text-muted-foreground">Board</span>
        <span className="rounded-full bg-muted/40 px-2 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground/70">
          {total}
        </span>
      </div>
      <a
        href="#board"
        className="group/link inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground/70 transition-colors hover:text-primary"
      >
        View
        <ArrowRightIcon className="size-3 transition-transform duration-150 group-hover/link:translate-x-0.5" />
      </a>
    </div>
  );
}
