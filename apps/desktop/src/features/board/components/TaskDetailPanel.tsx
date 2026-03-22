import { useCallback } from "react";
import type { SidecarClient } from "@/lib/sidecar/client";
import { useTaskDetail } from "@/features/board/hooks/useTaskDetail";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskStatusBadge } from "./TaskStatusBadge";
import {
  TaskBlockersSection,
  TaskArtifactsSection,
  TaskWorklogSection,
} from "./TaskDetailSections";
import { TaskQuickActions } from "./TaskQuickActions";
import { formatRelativeTime } from "@/features/board/lib/format-relative-time";
import { AlertCircleIcon, UserIcon, CalendarIcon } from "lucide-react";

interface TaskDetailPanelProps {
  taskId: string | null;
  client: SidecarClient;
  open: boolean;
  onClose: () => void;
  onTaskUpdated: () => void;
}

export function TaskDetailPanel({
  taskId,
  client,
  open,
  onClose,
  onTaskUpdated,
}: TaskDetailPanelProps) {
  const { task, isLoading, error, refresh } = useTaskDetail(
    open ? taskId : null,
    client,
  );

  const handleStatusChange = useCallback(
    async (status: string, reason?: string) => {
      if (!taskId) return;
      await client.updateTaskStatus(taskId, status, reason);
      refresh();
      onTaskUpdated();
    },
    [taskId, client, refresh, onTaskUpdated],
  );

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="flex flex-col sm:max-w-lg"
      >
        {isLoading ? (
          <PanelSkeleton />
        ) : error ? (
          <PanelError error={error} onRetry={refresh} />
        ) : task ? (
          <>
            <SheetHeader className="space-y-3">
              <SheetTitle className="pr-8 leading-snug">
                {task.title}
              </SheetTitle>
              <SheetDescription asChild>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <TaskStatusBadge status={task.status} />
                    {task.statusReason && (
                      <span className="text-xs text-muted-foreground">
                        {task.statusReason}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <UserIcon className="size-3" />
                      {task.assignedTo || "Unassigned"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarIcon className="size-3" />
                      Created {formatRelativeTime(task.createdAt)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarIcon className="size-3" />
                      Updated {formatRelativeTime(task.updatedAt)}
                    </span>
                  </div>
                </div>
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
              {/* Description */}
              <div className="border-t pt-4">
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Description
                </h4>
                {task.description ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {task.description}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground/60">
                    No description
                  </p>
                )}
              </div>

              <TaskBlockersSection blockers={task.blockers} />
              <TaskArtifactsSection artifacts={task.artifacts} />
              <TaskWorklogSection worklog={task.worklog} />
            </div>

            <SheetFooter className="border-t pt-3">
              <TaskQuickActions
                currentStatus={task.status}
                onStatusChange={handleStatusChange}
              />
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-5 w-24 rounded-full" />
      <div className="flex gap-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="mt-2 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <Skeleton className="mt-4 h-px w-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function PanelError({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
      <AlertCircleIcon className="size-8 text-destructive/50" />
      <p className="text-sm">Failed to load task</p>
      <p className="max-w-[240px] text-center text-xs text-muted-foreground/60">
        {error}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="text-xs text-primary underline-offset-4 hover:underline"
      >
        Try again
      </button>
    </div>
  );
}
