import { useCallback, useMemo } from "react";
import type { SidecarClient } from "@/lib/sidecar/client";
import { useTaskDetail } from "@/features/board/hooks/useTaskDetail";
import { useLinkedEntities } from "@/features/board/hooks/useLinkedEntities";
import { computeSuggestedAction } from "@/features/board/lib/suggested-action";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskStatusBadge } from "./TaskStatusBadge";
import {
  TaskBlockersSection,
  TaskArtifactsSection,
  TaskWorklogSection,
} from "./TaskDetailSections";
import { LinkedArtifactsSection } from "./LinkedArtifactsSection";
import { SuggestedNextAction } from "./SuggestedNextAction";
import { TaskQuickActions } from "./TaskQuickActions";
import { formatRelativeTime } from "@/features/board/lib/format-relative-time";
import { AlertCircleIcon, RefreshCwIcon, UserIcon, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

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

  const linked = useLinkedEntities(task, client);

  const suggestion = useMemo(
    () => (task ? computeSuggestedAction(task, linked.artifacts) : null),
    [task, linked.artifacts],
  );

  const handleStatusChange = useCallback(
    async (status: string, reason?: string) => {
      if (!taskId) return;
      await client.updateTaskStatus(taskId, status, reason, task?.owner);
      refresh();
      onTaskUpdated();
    },
    [taskId, client, refresh, onTaskUpdated, task],
  );

  const handleAddBlocker = useCallback(
    async (content: string) => {
      if (!taskId) return;
      await client.addTaskBlocker(taskId, content, task?.owner);
      refresh();
      onTaskUpdated();
    },
    [taskId, client, refresh, onTaskUpdated, task],
  );

  const handleAddArtifact = useCallback(
    async (content: string) => {
      if (!taskId) return;
      await client.addTaskArtifact(taskId, content, task?.owner);
      refresh();
      onTaskUpdated();
    },
    [taskId, client, refresh, onTaskUpdated, task],
  );

  const handleAddWorklog = useCallback(
    async (content: string) => {
      if (!taskId) return;
      await client.addTaskWorklog(taskId, content, task?.owner);
      refresh();
      onTaskUpdated();
    },
    [taskId, client, refresh, onTaskUpdated, task],
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="flex max-h-[85vh] flex-col sm:max-w-xl"
      >
        {isLoading ? (
          <PanelSkeleton />
        ) : error ? (
          <PanelError error={error} onRetry={refresh} />
        ) : task ? (
          <>
            <DialogHeader className="space-y-2">
              <div className="flex items-center gap-2.5">
                <TaskStatusBadge status={task.status} />
                {task.statusReason && (
                  <span className="text-xs text-muted-foreground">
                    &mdash; {task.statusReason}
                  </span>
                )}
              </div>
              <DialogTitle className="pr-8 text-lg leading-snug">
                {task.title}
              </DialogTitle>
              <DialogDescription asChild>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground/50">
                  <span className="inline-flex items-center gap-1">
                    <UserIcon className="size-3" />
                    {task.assignedTo || "Unassigned"}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                    Created {formatRelativeTime(task.createdAt)}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                    Updated {formatRelativeTime(task.updatedAt)}
                  </span>
                </div>
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 space-y-0 overflow-y-auto px-4 pb-4">
              {/* Description */}
              {task.description && (
                <div className="pb-4">
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/80">
                    {task.description}
                  </p>
                </div>
              )}

              {/* Only show sections that have data */}
              {linked.artifacts.length > 0 && <LinkedArtifactsSection artifacts={linked.artifacts} />}

              <TaskBlockersSection blockers={task.blockers} />
              <TaskArtifactsSection artifacts={task.artifacts} />
              <TaskWorklogSection worklog={task.worklog} />

              <SuggestedNextAction suggestion={suggestion} />
            </div>

            <DialogFooter>
              <TaskQuickActions
                currentStatus={task.status}
                onStatusChange={handleStatusChange}
                onAddBlocker={handleAddBlocker}
                onAddArtifact={handleAddArtifact}
                onAddWorklog={handleAddWorklog}
              />
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
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
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground">
      <div className="flex size-12 items-center justify-center rounded-xl bg-muted/50">
        <AlertCircleIcon className="size-6 text-destructive/50" />
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <p className="text-sm font-medium text-foreground">Failed to load task</p>
        <p className="max-w-[240px] text-center text-xs leading-relaxed text-muted-foreground/60">
          {error}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
      >
        <RefreshCwIcon className="size-3.5" />
        Try again
      </Button>
    </div>
  );
}
