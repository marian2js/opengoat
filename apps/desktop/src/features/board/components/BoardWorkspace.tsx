import { AlertCircleIcon, ListChecksIcon, RefreshCwIcon } from "lucide-react";
import type { SidecarClient } from "@/lib/sidecar/client";
import { useTaskList } from "@/features/board/hooks/useTaskList";
import { TaskList, TaskListSkeleton } from "./TaskList";

export interface BoardWorkspaceProps {
  agentId?: string | undefined;
  client: SidecarClient | null;
  onTaskSelect?: (taskId: string) => void;
}

export function BoardWorkspace({
  agentId,
  client,
  onTaskSelect,
}: BoardWorkspaceProps) {
  if (!agentId || !client) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <ListChecksIcon className="size-8 text-muted-foreground/30" />
          <p className="text-sm">No project selected</p>
        </div>
      </div>
    );
  }

  return (
    <BoardContent
      agentId={agentId}
      client={client}
      onTaskSelect={onTaskSelect}
    />
  );
}

// ---------------------------------------------------------------------------
// Inner content – hooks are safe to call here (guard clause above)
// ---------------------------------------------------------------------------

function BoardContent({
  agentId,
  client,
  onTaskSelect,
}: {
  agentId: string;
  client: SidecarClient;
  onTaskSelect?: (taskId: string) => void;
}) {
  const { tasks, isLoading, error, refresh } = useTaskList(agentId, client);

  const handleTaskSelect = (taskId: string) => {
    onTaskSelect?.(taskId);
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-5 lg:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Board</h2>
        <button
          type="button"
          onClick={refresh}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Refresh tasks"
        >
          <RefreshCwIcon className="size-4" />
        </button>
      </div>

      {isLoading ? (
        <TaskListSkeleton />
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
          <AlertCircleIcon className="size-8 text-destructive/50" />
          <p className="text-sm">Failed to load tasks</p>
          <button
            type="button"
            onClick={refresh}
            className="text-xs text-primary underline-offset-4 hover:underline"
          >
            Try again
          </button>
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
          <div className="flex flex-col items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted/50">
              <ListChecksIcon className="size-6 text-muted-foreground/50" />
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <h3 className="text-sm font-medium text-foreground">
                No tasks yet
              </h3>
              <p className="max-w-[280px] text-center text-xs leading-relaxed text-muted-foreground/70">
                No tasks yet. Tasks will appear here when created through
                actions or chat.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <TaskList tasks={tasks} onTaskSelect={handleTaskSelect} />
      )}
    </div>
  );
}
