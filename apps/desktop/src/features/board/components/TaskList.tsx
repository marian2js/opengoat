import { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import type { TaskRecord } from "@opengoat/contracts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { ObjectiveChip } from "./ObjectiveChip";
import { RunChip } from "./RunChip";
import { ContextBadge } from "./ContextBadge";
import { ReviewIndicator } from "./ReviewIndicator";
import { formatRelativeTime } from "@/features/board/lib/format-relative-time";
import type { TaskGroup, ObjectiveMapEntry, RunMapEntry } from "@/features/board/lib/board-grouping";

// ---------------------------------------------------------------------------
// TaskRow (enriched)
// ---------------------------------------------------------------------------

interface TaskRowProps {
  task: TaskRecord;
  onSelect: (taskId: string) => void;
  objectiveMap: Map<string, ObjectiveMapEntry>;
  runMap: Map<string, RunMapEntry>;
}

function getTaskObjectiveId(task: TaskRecord): string | undefined {
  return task.objectiveId ?? (task.metadata?.objectiveId as string | undefined);
}

function getTaskRunId(task: TaskRecord): string | undefined {
  return task.runId ?? (task.metadata?.runId as string | undefined);
}

function TaskRow({ task, onSelect, objectiveMap, runMap }: TaskRowProps) {
  const objId = getTaskObjectiveId(task);
  const runId = getTaskRunId(task);
  const objective = objId ? objectiveMap.get(objId) : undefined;
  const run = runId ? runMap.get(runId) : undefined;
  const artifactCount = task.artifacts?.length ?? 0;
  const blockerCount = task.blockers?.length ?? 0;
  const isReview = task.status === "pending";

  return (
    <TableRow
      className="group/row cursor-pointer transition-colors hover:bg-primary/[0.03] dark:hover:bg-primary/[0.04]"
      onClick={() => onSelect(task.taskId)}
    >
      {/* Title + inline chips */}
      <TableCell className="max-w-[400px] text-[13px] font-medium text-foreground/90 group-hover/row:text-foreground">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <span className="truncate">{task.title}</span>
          {objective && <ObjectiveChip label={objective.title} />}
          {run && <RunChip label={run.playbookTitle ?? run.title} />}
        </div>
      </TableCell>

      {/* Status */}
      <TableCell>
        <TaskStatusBadge status={task.status} />
      </TableCell>

      {/* Context: artifact count, blocker count, review indicator */}
      <TableCell>
        <div className="flex items-center gap-1.5">
          <ContextBadge count={artifactCount} label="artifacts" />
          <ContextBadge count={blockerCount} variant="danger" label="blockers" />
          <ReviewIndicator show={isReview} />
        </div>
      </TableCell>

      {/* Updated */}
      <TableCell className="font-mono text-[11px] text-muted-foreground/70 tabular-nums">
        {formatRelativeTime(task.updatedAt)}
      </TableCell>

      {/* Owner */}
      <TableCell className="text-[13px] text-muted-foreground">
        {task.owner || "\u2014"}
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// GroupHeader
// ---------------------------------------------------------------------------

interface GroupHeaderProps {
  label: string;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
}

function GroupHeader({ label, count, isExpanded, onToggle }: GroupHeaderProps) {
  return (
    <TableRow
      className="cursor-pointer border-t border-border/40 bg-muted/20 transition-colors hover:bg-muted/40"
      onClick={onToggle}
    >
      <TableCell colSpan={5} className="py-1.5">
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDownIcon className="size-3.5 text-muted-foreground/60" />
          ) : (
            <ChevronRightIcon className="size-3.5 text-muted-foreground/60" />
          )}
          <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-foreground/80">
            {label}
          </span>
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground/50">
            {count}
          </span>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// TaskList
// ---------------------------------------------------------------------------

interface TaskListProps {
  tasks: TaskRecord[];
  groups?: TaskGroup[];
  onTaskSelect: (taskId: string) => void;
  objectiveMap?: Map<string, ObjectiveMapEntry>;
  runMap?: Map<string, RunMapEntry>;
}

const EMPTY_OBJ_MAP = new Map<string, ObjectiveMapEntry>();
const EMPTY_RUN_MAP = new Map<string, RunMapEntry>();

export function TaskList({
  tasks,
  groups,
  onTaskSelect,
  objectiveMap = EMPTY_OBJ_MAP,
  runMap = EMPTY_RUN_MAP,
}: TaskListProps) {
  const isGrouped = groups && groups.length > 0 && !(groups.length === 1 && groups[0]!.key === "__all__");

  return (
    <div className="flex-1 overflow-y-auto rounded-lg border border-border/50">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-border/50 bg-muted/30 hover:bg-muted/30">
            <TableHead className="w-[35%]">Title</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="w-[100px]">Context</TableHead>
            <TableHead className="w-[100px]">Updated</TableHead>
            <TableHead>Owner</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isGrouped ? (
            groups!.map((group) => (
              <GroupSection
                key={group.key}
                group={group}
                onTaskSelect={onTaskSelect}
                objectiveMap={objectiveMap}
                runMap={runMap}
              />
            ))
          ) : (
            (groups?.[0]?.tasks ?? tasks).map((task) => (
              <TaskRow
                key={task.taskId}
                task={task}
                onSelect={onTaskSelect}
                objectiveMap={objectiveMap}
                runMap={runMap}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GroupSection (collapsible group of rows)
// ---------------------------------------------------------------------------

function GroupSection({
  group,
  onTaskSelect,
  objectiveMap,
  runMap,
}: {
  group: TaskGroup;
  onTaskSelect: (taskId: string) => void;
  objectiveMap: Map<string, ObjectiveMapEntry>;
  runMap: Map<string, RunMapEntry>;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <>
      <GroupHeader
        label={group.label}
        count={group.tasks.length}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded((prev) => !prev)}
      />
      {isExpanded &&
        group.tasks.map((task) => (
          <TaskRow
            key={task.taskId}
            task={task}
            onSelect={onTaskSelect}
            objectiveMap={objectiveMap}
            runMap={runMap}
          />
        ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// TaskListSkeleton
// ---------------------------------------------------------------------------

export function TaskListSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto rounded-lg border border-border/50">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-border/50 bg-muted/30 hover:bg-muted/30">
            <TableHead className="w-[35%]">Title</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="w-[100px]">Context</TableHead>
            <TableHead className="w-[100px]">Updated</TableHead>
            <TableHead>Owner</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }, (_, i) => (
            <TableRow key={`skeleton-${i}`}>
              <TableCell>
                <Skeleton className="h-4 w-[200px]" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-[80px] rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-[60px]" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-[50px]" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-[70px]" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
