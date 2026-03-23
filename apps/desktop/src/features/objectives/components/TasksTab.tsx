import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { SidecarClient } from "@/lib/sidecar/client";
import { TaskList } from "@/features/board/components/TaskList";
import { useTaskList } from "@/features/board/hooks/useTaskList";

export interface TasksTabProps {
  agentId: string;
  objectiveId: string;
  client: SidecarClient;
  onTaskSelect?: (taskId: string) => void;
}

export function TasksTab({
  agentId,
  objectiveId,
  client,
  onTaskSelect,
}: TasksTabProps) {
  const { tasks, isLoading, error, refresh } = useTaskList(agentId, client);

  if (isLoading) {
    return (
      <div className="space-y-3 py-5">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-10">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={refresh}>
          Retry
        </Button>
      </div>
    );
  }

  // Filter tasks by objectiveId if metadata is present
  const filteredTasks = tasks.filter((task) => {
    if (!task.metadata) return false;
    try {
      const meta = typeof task.metadata === "string" ? JSON.parse(task.metadata) : task.metadata;
      return meta.objectiveId === objectiveId;
    } catch {
      return false;
    }
  });

  if (filteredTasks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10">
        <p className="text-sm text-muted-foreground">
          No tasks linked to this objective yet
        </p>
      </div>
    );
  }

  return (
    <div className="py-4">
      <TaskList
        tasks={filteredTasks}
        onTaskSelect={onTaskSelect ?? (() => {})}
      />
    </div>
  );
}
