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
import { formatRelativeTime } from "@/features/board/lib/format-relative-time";

// ---------------------------------------------------------------------------
// TaskRow
// ---------------------------------------------------------------------------

interface TaskRowProps {
  task: TaskRecord;
  onSelect: (taskId: string) => void;
}

function TaskRow({ task, onSelect }: TaskRowProps) {
  return (
    <TableRow
      className="group/row cursor-pointer transition-colors hover:bg-primary/[0.03] dark:hover:bg-primary/[0.04]"
      onClick={() => onSelect(task.taskId)}
    >
      <TableCell className="max-w-[320px] truncate text-[13px] font-medium text-foreground/90 group-hover/row:text-foreground">
        {task.title}
      </TableCell>
      <TableCell>
        <TaskStatusBadge status={task.status} />
      </TableCell>
      <TableCell className="text-[13px] text-muted-foreground">
        {task.assignedTo || "\u2014"}
      </TableCell>
      <TableCell className="font-mono text-[11px] text-muted-foreground/70 tabular-nums">
        {formatRelativeTime(task.updatedAt)}
      </TableCell>
      <TableCell className="text-[13px] text-muted-foreground">
        {task.owner || "\u2014"}
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// TaskList
// ---------------------------------------------------------------------------

interface TaskListProps {
  tasks: TaskRecord[];
  onTaskSelect: (taskId: string) => void;
}

export function TaskList({ tasks, onTaskSelect }: TaskListProps) {
  return (
    <div className="flex-1 overflow-y-auto rounded-lg border border-border/50">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-border/50 bg-muted/30 hover:bg-muted/30">
            <TableHead className="w-[40%]">Title</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead>Assignee</TableHead>
            <TableHead className="w-[100px]">Updated</TableHead>
            <TableHead>Owner</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TaskRow key={task.taskId} task={task} onSelect={onTaskSelect} />
          ))}
        </TableBody>
      </Table>
    </div>
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
            <TableHead className="w-[40%]">Title</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead>Assignee</TableHead>
            <TableHead className="w-[100px]">Updated</TableHead>
            <TableHead>Owner</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }, (_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-[200px]" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-[80px] rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-[80px]" />
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
