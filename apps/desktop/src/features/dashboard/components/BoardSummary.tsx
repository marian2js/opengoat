import { ClipboardListIcon, ArrowRightIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { BoardCounts } from "@/features/dashboard/lib/compute-board-counts";

export interface BoardSummaryProps {
  counts: BoardCounts;
  isLoading: boolean;
  isEmpty: boolean;
  onNavigateToBoard?: (() => void) | undefined;
}

interface CountPill {
  label: string;
  value: number;
  className: string;
}

function getPills(counts: BoardCounts): CountPill[] {
  return [
    {
      label: "Open",
      value: counts.open,
      className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    },
    {
      label: "Blocked",
      value: counts.blocked,
      className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    },
    {
      label: "Done",
      value: counts.done,
      className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    },
  ];
}

export function BoardSummary({ counts, isLoading, isEmpty, onNavigateToBoard }: BoardSummaryProps) {
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
    return (
      <div className="relative z-10 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <ClipboardListIcon className="size-4 text-muted-foreground" />
              <span>Board</span>
            </div>
            <span className="text-sm text-muted-foreground">
              No active tasks — tasks will appear here when created through actions or chat.
            </span>
          </div>
          <button
            type="button"
            onClick={onNavigateToBoard}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            View Board
            <ArrowRightIcon className="size-3" />
          </button>
        </div>
      </div>
    );
  }

  const pills = getPills(counts);

  return (
    <div className="relative z-10 py-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <ClipboardListIcon className="size-4 text-muted-foreground" />
            <span>Board</span>
          </div>
          <div className="flex items-center gap-2">
            {pills.map((pill) => (
              <span
                key={pill.label}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${pill.className}`}
              >
                <span className="tabular-nums">{pill.value}</span>
                <span>{pill.label}</span>
              </span>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={onNavigateToBoard}
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          View Board
          <ArrowRightIcon className="size-3" />
        </button>
      </div>
    </div>
  );
}
