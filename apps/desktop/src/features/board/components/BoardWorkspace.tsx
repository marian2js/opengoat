import { useCallback, useMemo, useState } from "react";
import { AlertCircleIcon, LayoutDashboardIcon, ListChecksIcon, MessageSquareIcon, RefreshCwIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SidecarClient } from "@/lib/sidecar/client";
import { useTaskList } from "@/features/board/hooks/useTaskList";
import { useLeadingTask } from "@/features/board/hooks/useLeadingTask";
import { useBoardFilters } from "@/features/board/hooks/useBoardFilters";
import { getGhostTasks } from "@/features/board/lib/ghost-tasks";
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

  const ghostTasks = useMemo(
    () => getGhostTasks(filteredTasks.length),
    [filteredTasks.length],
  );

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
        <div className="overflow-hidden rounded-lg border border-border/50 shadow-sm dark:border-white/[0.08] dark:shadow-none">
          <TaskListSkeleton />
        </div>
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
          <div className="flex flex-col items-center gap-5">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/8 ring-1 ring-primary/10">
              <ListChecksIcon className="size-6 text-primary/60" />
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <h3 className="font-display text-[15px] font-bold tracking-tight text-foreground">
                No tasks yet
              </h3>
              <p className="max-w-[300px] text-center text-[13px] leading-relaxed text-muted-foreground/70">
                Tasks appear here when specialists create follow-up items from actions or chat conversations.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild size="sm">
                <a href="#dashboard">
                  <LayoutDashboardIcon data-icon="inline-start" className="size-3.5" />
                  Go to Dashboard
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href="#chat">
                  <MessageSquareIcon data-icon="inline-start" className="size-3.5" />
                  Start a Chat
                </a>
              </Button>
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
        <>
          <div className="overflow-hidden rounded-lg border border-border/50 shadow-sm dark:border-white/[0.08] dark:shadow-none">
            <TaskList
              tasks={filteredTasks}
              groups={groupedTasks}
              ghostTasks={ghostTasks}
              leadingTaskId={leadingTask?.taskId ?? null}
              onTaskSelect={(id) => setSelectedTaskId(id)}
              onSetLeadingTask={handleSetLeadingTask}
            />
          </div>
          {filteredTasks.length <= 3 && (
            <div className="mt-6 flex items-start gap-3 rounded-lg border border-primary/10 bg-primary/[0.02] px-4 py-3.5 dark:border-primary/[0.06] dark:bg-primary/[0.015]">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/8 ring-1 ring-primary/10">
                <ListChecksIcon className="size-4 text-primary/70" />
              </div>
              <div className="space-y-1">
                <p className="text-[12px] font-medium text-foreground/80">
                  Your follow-up tasks appear here
                </p>
                <p className="text-[11px] leading-relaxed text-muted-foreground/60">
                  As you run marketing jobs, follow-up tasks appear here for review and action. Run a job from the dashboard or ask a specialist in chat.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Button asChild size="xs">
                    <a href="#dashboard">
                      Go to Dashboard
                    </a>
                  </Button>
                  <Button asChild variant="ghost" size="xs">
                    <a href="#chat">
                      Start a Chat
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
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
