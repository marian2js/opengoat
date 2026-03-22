import { useState } from "react";
import { AlertCircleIcon, ListChecksIcon, SearchIcon } from "lucide-react";
import type { SidecarClient } from "@/lib/sidecar/client";
import { useTaskList } from "@/features/board/hooks/useTaskList";
import { useBoardFilters } from "@/features/board/hooks/useBoardFilters";
import { TaskList, TaskListSkeleton } from "./TaskList";
import { TaskDetailPanel } from "./TaskDetailPanel";
import { BoardToolbar } from "./BoardToolbar";

export interface BoardWorkspaceProps {
  agentId?: string | undefined;
  client: SidecarClient | null;
}

export function BoardWorkspace({
  agentId,
  client,
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
    />
  );
}

// ---------------------------------------------------------------------------
// Inner content – hooks are safe to call here (guard clause above)
// ---------------------------------------------------------------------------

function BoardContent({
  agentId,
  client,
}: {
  agentId: string;
  client: SidecarClient;
}) {
  const { tasks, isLoading, error, refresh } = useTaskList(agentId, client);
  const {
    filteredTasks,
    filter,
    sort,
    search,
    setFilter,
    setSort,
    setSearch,
  } = useBoardFilters(tasks);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-5 lg:p-6">
      {!isLoading && !error && tasks.length > 0 && (
        <div className="mb-4">
          <BoardToolbar
            filter={filter}
            sort={sort}
            search={search}
            onFilterChange={setFilter}
            onSortChange={setSort}
            onSearchChange={setSearch}
            onRefresh={refresh}
            totalCount={tasks.length}
            filteredCount={filteredTasks.length}
          />
        </div>
      )}

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
                Tasks will appear here when created through actions or
                chat.
              </p>
            </div>
          </div>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
          <div className="flex flex-col items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted/50">
              <SearchIcon className="size-6 text-muted-foreground/50" />
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <h3 className="text-sm font-medium text-foreground">
                No matching tasks
              </h3>
              <p className="max-w-[280px] text-center text-xs leading-relaxed text-muted-foreground/70">
                No tasks match your current filters. Try adjusting your filters
                or search query.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <TaskList
          tasks={filteredTasks}
          onTaskSelect={(id) => setSelectedTaskId(id)}
        />
      )}

      <TaskDetailPanel
        taskId={selectedTaskId}
        client={client}
        open={!!selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onTaskUpdated={refresh}
      />
    </div>
  );
}
