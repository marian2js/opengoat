import { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon, CrosshairIcon } from "lucide-react";
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
import { ContextBadge } from "./ContextBadge";
import { ReviewIndicator } from "./ReviewIndicator";
import { formatRelativeTime } from "@/features/board/lib/format-relative-time";
import type { TaskGroup } from "@/features/board/lib/board-grouping";

// ---------------------------------------------------------------------------
// TaskRow (simplified)
// ---------------------------------------------------------------------------

interface TaskRowProps {
  task: TaskRecord;
  isLeading: boolean;
  onSelect: (taskId: string) => void;
  onSetLeadingTask?: (taskId: string) => void;
}

const STATUS_ACCENT: Record<string, string> = {
  todo: "before:bg-muted-foreground/30",
  doing: "before:bg-primary",
  pending: "before:bg-warning dark:before:bg-yellow-400",
  blocked: "before:bg-destructive dark:before:bg-red-400",
  done: "before:bg-success dark:before:bg-green-400",
};

function TaskRow({ task, isLeading, onSelect, onSetLeadingTask }: TaskRowProps) {
  const artifactCount = task.artifacts?.length ?? 0;
  const blockerCount = task.blockers?.length ?? 0;
  const isReview = task.status === "pending";
  const accent = STATUS_ACCENT[task.status] ?? "before:bg-muted-foreground/30";

  return (
    <TableRow
      className="group/row cursor-pointer border-border/20 transition-colors hover:bg-primary/[0.04] even:bg-muted/[0.03]"
      onClick={() => onSelect(task.taskId)}
    >
      {/* Title */}
      <TableCell className={`relative max-w-[400px] py-3 pl-5 text-[13px] font-medium text-foreground/85 group-hover/row:text-foreground before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:rounded-sm before:opacity-0 before:transition-opacity group-hover/row:before:opacity-100 ${accent}`}>
        <div className="flex items-center gap-1.5 overflow-hidden">
          {isLeading && (
            <CrosshairIcon className="size-3 shrink-0 text-primary" />
          )}
          <span className="truncate">{task.title}</span>
        </div>
      </TableCell>

      {/* Status */}
      <TableCell className="py-3">
        <TaskStatusBadge status={task.status} />
      </TableCell>

      {/* Context: output count, blocker count, review indicator */}
      <TableCell className="py-3">
        <div className="flex items-center gap-1.5">
          <ContextBadge count={artifactCount} label="outputs" />
          <ContextBadge count={blockerCount} variant="danger" label="blockers" />
          <ReviewIndicator show={isReview} />
        </div>
      </TableCell>

      {/* Updated */}
      <TableCell className="py-3 font-mono text-[11px] text-muted-foreground/60 tabular-nums">
        {formatRelativeTime(task.updatedAt)}
      </TableCell>

      {/* Lead action / Owner */}
      <TableCell className="py-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] text-muted-foreground/50 uppercase tracking-wider">
            {task.owner || "\u2014"}
          </span>
          {!isLeading && onSetLeadingTask && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSetLeadingTask(task.taskId);
              }}
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground/30 opacity-0 transition-all hover:bg-primary/10 hover:text-primary group-hover/row:opacity-100"
              title="Set as lead task"
            >
              <CrosshairIcon className="size-3" />
            </button>
          )}
        </div>
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

const GROUP_DOT_COLOR: Record<string, string> = {
  "in progress": "bg-primary",
  doing: "bg-primary",
  todo: "bg-muted-foreground/40",
  pending: "bg-warning dark:bg-yellow-400",
  blocked: "bg-destructive dark:bg-red-400",
  done: "bg-success dark:bg-green-400",
};

function GroupHeader({ label, count, isExpanded, onToggle }: GroupHeaderProps) {
  const dotColor = GROUP_DOT_COLOR[label.toLowerCase()] ?? "bg-muted-foreground/40";

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
          <span className={`size-2 shrink-0 rounded-full ${dotColor}`} />
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
  leadingTaskId?: string | null;
  onTaskSelect: (taskId: string) => void;
  onSetLeadingTask?: (taskId: string) => void;
}

export function TaskList({
  tasks,
  groups,
  leadingTaskId,
  onTaskSelect,
  onSetLeadingTask,
}: TaskListProps) {
  const isGrouped = groups && groups.length > 0 && !(groups.length === 1 && groups[0]!.key === "__all__");

  return (
    <div className="flex-1 overflow-y-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-border/30 bg-muted/30 hover:bg-muted/30 dark:border-white/[0.04] dark:bg-white/[0.02]">
            <TableHead className="w-[40%] py-2.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Title</TableHead>
            <TableHead className="w-[120px] py-2.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Status</TableHead>
            <TableHead className="w-[100px] py-2.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Context</TableHead>
            <TableHead className="w-[100px] py-2.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Updated</TableHead>
            <TableHead className="py-2.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Owner</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isGrouped ? (
            groups!.map((group) => (
              <GroupSection
                key={group.key}
                group={group}
                leadingTaskId={leadingTaskId}
                onTaskSelect={onTaskSelect}
                onSetLeadingTask={onSetLeadingTask}
              />
            ))
          ) : (
            (groups?.[0]?.tasks ?? tasks).map((task) => (
              <TaskRow
                key={task.taskId}
                task={task}
                isLeading={task.taskId === leadingTaskId}
                onSelect={onTaskSelect}
                onSetLeadingTask={onSetLeadingTask}
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
  leadingTaskId,
  onTaskSelect,
  onSetLeadingTask,
}: {
  group: TaskGroup;
  leadingTaskId?: string | null;
  onTaskSelect: (taskId: string) => void;
  onSetLeadingTask?: (taskId: string) => void;
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
            isLeading={task.taskId === leadingTaskId}
            onSelect={onTaskSelect}
            onSetLeadingTask={onSetLeadingTask}
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
    <div className="flex-1 overflow-y-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-border/30 bg-muted/30 hover:bg-muted/30 dark:border-white/[0.04] dark:bg-white/[0.02]">
            <TableHead className="w-[40%] py-2.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Title</TableHead>
            <TableHead className="w-[120px] py-2.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Status</TableHead>
            <TableHead className="w-[100px] py-2.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Context</TableHead>
            <TableHead className="w-[100px] py-2.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Updated</TableHead>
            <TableHead className="py-2.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Owner</TableHead>
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
