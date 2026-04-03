import { CrosshairIcon, XIcon } from "lucide-react";
import type { TaskRecord } from "@opengoat/contracts";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { formatRelativeTime } from "@/features/board/lib/format-relative-time";

export interface LeadingTaskCardProps {
  task: TaskRecord;
  onSelect: (taskId: string) => void;
  onClear: () => void;
}

export function LeadingTaskCard({
  task,
  onSelect,
  onClear,
}: LeadingTaskCardProps) {
  return (
    <div className="group relative mb-4 rounded-xl border border-primary/15 bg-primary/[0.03] transition-colors hover:border-primary/25">
      {/* Accent bar */}
      <div className="absolute inset-y-0 left-0 w-[3px] rounded-l-xl bg-primary/60" />

      <button
        type="button"
        onClick={() => onSelect(task.taskId)}
        className="flex w-full items-start gap-4 px-5 py-4 text-left"
      >
        {/* Lead icon */}
        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/8">
          <CrosshairIcon className="size-3.5 text-primary" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Label + status */}
          <div className="mb-1.5 flex items-center gap-2.5">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-primary/70">
              Lead task
            </span>
            <TaskStatusBadge status={task.status} />
          </div>

          {/* Title */}
          <h3 className="truncate text-sm font-semibold text-foreground">
            {task.title}
          </h3>

          {/* Description preview + metadata */}
          <div className="mt-1 flex items-center gap-3">
            {task.description && (
              <p className="min-w-0 truncate text-xs text-muted-foreground/60">
                {task.description}
              </p>
            )}
          </div>
        </div>

        {/* Updated timestamp */}
        <span className="mt-1 shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground/40">
          {formatRelativeTime(task.updatedAt)}
        </span>
      </button>

      {/* Dismiss button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClear();
        }}
        className="absolute right-3 top-3 flex size-6 items-center justify-center rounded-md text-muted-foreground/30 opacity-0 transition-all hover:bg-muted/50 hover:text-muted-foreground group-hover:opacity-100"
        title="Remove lead task"
      >
        <XIcon className="size-3.5" />
      </button>
    </div>
  );
}
