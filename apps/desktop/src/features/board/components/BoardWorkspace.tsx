import { useCallback, useState } from "react";
import { AlertCircleIcon, ListChecksIcon, RefreshCwIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SidecarClient } from "@/lib/sidecar/client";
import { useTaskList } from "@/features/board/hooks/useTaskList";
import { useLeadingTask } from "@/features/board/hooks/useLeadingTask";
import { useBoardFilters } from "@/features/board/hooks/useBoardFilters";
import { TaskList, TaskListSkeleton } from "./TaskList";
import { TaskDetailPanel } from "./TaskDetailPanel";
import { LeadingTaskCard } from "./LeadingTaskCard";
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
    leadingTask,
    setLeadingTask,
    clearLeadingTask,
    refresh: refreshLeading,
  } = useLeadingTask(client);
  const {
    filteredTasks,
    groupedTasks,
    grouping,
    filterState,
    filter,
    sort,
    search,
    setFilter,
    setSort,
    setSearch,
    setGrouping,
    setSourceTypeFilter,
    setStaleFilter,
    clearFilters,
    activeFilterCount,
  } = useBoardFilters(tasks);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const handleSetLeadingTask = useCallback(
    async (taskId: string) => {
      try {
        await setLeadingTask(taskId);
      } catch (err) {
        console.error("Failed to set leading task:", err);
      }
    },
    [setLeadingTask],
  );

  const handleClearLeadingTask = useCallback(async () => {
    try {
      await clearLeadingTask();
    } catch (err) {
      console.error("Failed to clear leading task:", err);
    }
  }, [clearLeadingTask]);

  const handleTaskUpdated = useCallback(() => {
    refresh();
    refreshLeading();
  }, [refresh, refreshLeading]);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-5 lg:p-6">
      {!isLoading && !error && tasks.length > 0 && (
        <div className="mb-4">
          <BoardToolbar
            filter={filter}
            sort={sort}
            search={search}
            grouping={grouping}
            sourceType={filterState.sourceType}
            stale={filterState.stale}
            activeFilterCount={activeFilterCount}
            onFilterChange={setFilter}
            onSortChange={setSort}
            onSearchChange={setSearch}
            onGroupingChange={setGrouping}
            onSourceTypeChange={setSourceTypeFilter}
            onStaleChange={setStaleFilter}
            onClearFilters={clearFilters}
            onRefresh={refresh}
            totalCount={tasks.length}
            filteredCount={filteredTasks.length}
          />
        </div>
      )}

      {/* Leading task card */}
      {!isLoading && leadingTask && (
        <LeadingTaskCard
          task={leadingTask}
          onSelect={(id) => setSelectedTaskId(id)}
          onClear={handleClearLeadingTask}
        />
      )}

      {isLoading ? (
        <TaskListSkeleton />
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground">
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted/50">
            <AlertCircleIcon className="size-6 text-destructive/50" />
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <p className="text-sm font-medium text-foreground">Failed to load tasks</p>
            <p className="max-w-[280px] text-center text-xs leading-relaxed text-muted-foreground/70">
              Something went wrong while loading your tasks.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
          >
            <RefreshCwIcon className="size-3.5" />
            Try again
          </Button>
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
          groups={groupedTasks}
          leadingTaskId={leadingTask?.taskId ?? null}
          onTaskSelect={(id) => setSelectedTaskId(id)}
          onSetLeadingTask={handleSetLeadingTask}
        />
      )}

      <TaskDetailPanel
        taskId={selectedTaskId}
        client={client}
        open={!!selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onTaskUpdated={handleTaskUpdated}
      />
    </div>
  );
}
