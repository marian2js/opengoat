import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useEffect, useState, type ReactElement } from "react";
import {
  formatAbsoluteTime,
  formatRelativeTime,
  resolveTaskUpdatedAt,
  taskStatusLabel,
  taskStatusPillClasses,
} from "./utils";

interface TasksPageAgent {
  id: string;
  displayName: string;
}

interface TasksPageTask {
  taskId: string;
  title: string;
  createdAt: string;
  updatedAt?: string;
  assignedTo: string;
  status: string;
}

interface TasksPageWorkspace {
  taskWorkspaceId: string;
  title: string;
  tasks: TasksPageTask[];
}

interface TasksPageProps {
  selectedTaskWorkspace: TasksPageWorkspace | null;
  missingTaskWorkspaceId: string;
  taskActorId: string;
  agents: TasksPageAgent[];
  onTaskActorChange: (nextTaskActorId: string) => void;
  hasSelectedTasks: boolean;
  selectedTaskIdsCount: number;
  onDeleteSelectedTasks: () => void;
  isMutating: boolean;
  isLoading: boolean;
  selectAllCheckboxState: boolean | "indeterminate";
  onToggleSelectAllTasks: (checked: boolean) => void;
  selectedTaskIdSet: Set<string>;
  onToggleTaskSelection: (taskId: string, checked: boolean) => void;
  onOpenTaskDetails: (taskId: string) => void;
}

export function TasksPage({
  selectedTaskWorkspace,
  missingTaskWorkspaceId,
  taskActorId,
  agents,
  onTaskActorChange,
  hasSelectedTasks,
  selectedTaskIdsCount,
  onDeleteSelectedTasks,
  isMutating,
  isLoading,
  selectAllCheckboxState,
  onToggleSelectAllTasks,
  selectedTaskIdSet,
  onToggleTaskSelection,
  onOpenTaskDetails,
}: TasksPageProps): ReactElement {
  const [referenceTimestampMs, setReferenceTimestampMs] = useState(() =>
    Date.now(),
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setReferenceTimestampMs(Date.now());
    }, 60_000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  if (!selectedTaskWorkspace) {
    return (
      <p className="text-sm text-muted-foreground">{`No task workspace was found for id ${missingTaskWorkspaceId}.`}</p>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border/80 bg-card/40 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-2xl font-semibold tracking-tight">
              {selectedTaskWorkspace.title}
            </h2>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label
                className="text-[11px] uppercase tracking-wide text-muted-foreground"
                htmlFor="taskWorkspaceTaskActor"
              >
                Act As
              </label>
              <select
                id="taskWorkspaceTaskActor"
                className="h-9 min-w-[220px] rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                value={taskActorId}
                onChange={(event) => {
                  onTaskActorChange(event.target.value);
                }}
              >
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.displayName} ({agent.id})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-border/80 bg-card/25">
        <div className="border-b border-border/70 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Tasks</p>
              <p className="text-xs text-muted-foreground">
                Select tasks to delete in bulk or open one for full details.
              </p>
            </div>

            {hasSelectedTasks ? (
              <Button
                variant="destructive"
                size="sm"
                className="h-8 px-3"
                disabled={isMutating || isLoading}
                onClick={onDeleteSelectedTasks}
              >
                {`Delete ${selectedTaskIdsCount}`}
              </Button>
            ) : null}
          </div>
        </div>

        {selectedTaskWorkspace.tasks.length === 0 ? (
          <div className="px-4 py-8">
            <p className="text-sm text-muted-foreground">
              No tasks yet. Ask the CEO to start planning, or create tasks
              manually.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-border/70 bg-accent/25 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="w-12 px-3 py-2 font-medium">
                    <Checkbox
                      checked={selectAllCheckboxState}
                      onCheckedChange={(checked) => {
                        onToggleSelectAllTasks(checked === true);
                      }}
                      aria-label="Select all tasks"
                    />
                  </th>
                  <th className="px-4 py-2 font-medium">Task</th>
                  <th className="px-4 py-2 font-medium">Assignee</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {selectedTaskWorkspace.tasks.map((task) => {
                  const updatedAt = resolveTaskUpdatedAt(
                    task.updatedAt,
                    task.createdAt,
                  );
                  return (
                    <tr
                      key={task.taskId}
                      className={cn(
                        "transition-colors hover:bg-accent/20",
                        selectedTaskIdSet.has(task.taskId) && "bg-accent/10",
                      )}
                    >
                      <td className="px-3 py-3">
                        <Checkbox
                          checked={selectedTaskIdSet.has(task.taskId)}
                          onCheckedChange={(checked) => {
                            onToggleTaskSelection(
                              task.taskId,
                              checked === true,
                            );
                          }}
                          aria-label={`Select task ${task.title}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="group text-left"
                          onClick={() => {
                            onOpenTaskDetails(task.taskId);
                          }}
                        >
                          <span className="block font-medium text-foreground group-hover:underline">
                            {task.title}
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{`@${task.assignedTo}`}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            taskStatusPillClasses(task.status),
                          )}
                        >
                          {taskStatusLabel(task.status)}
                        </span>
                      </td>
                      <td
                        className="px-4 py-3 text-sm text-muted-foreground"
                        title={formatAbsoluteTime(updatedAt)}
                      >
                        {formatRelativeTime(updatedAt, referenceTimestampMs)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
