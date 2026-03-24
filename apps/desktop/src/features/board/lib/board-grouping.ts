import type { TaskRecord } from "@opengoat/contracts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BoardGrouping = "none" | "status";

export interface TaskGroup {
  key: string;
  label: string;
  tasks: TaskRecord[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const GROUPING_OPTIONS: { value: BoardGrouping; label: string }[] = [
  { value: "none", label: "No Grouping" },
  { value: "status", label: "By Status" },
];

// Status priority for ordering status groups
const STATUS_ORDER: { key: string; label: string }[] = [
  { key: "doing", label: "IN PROGRESS" },
  { key: "todo", label: "TODO" },
  { key: "blocked", label: "BLOCKED" },
  { key: "pending", label: "PENDING" },
  { key: "done", label: "DONE" },
];

// ---------------------------------------------------------------------------
// Grouping functions
// ---------------------------------------------------------------------------

function groupByStatus(tasks: TaskRecord[]): TaskGroup[] {
  const buckets = new Map<string, TaskRecord[]>();
  for (const task of tasks) {
    const key = task.status;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(task);
  }

  // Return in STATUS_ORDER, omitting empty groups
  const groups: TaskGroup[] = [];
  for (const { key, label } of STATUS_ORDER) {
    const bucket = buckets.get(key);
    if (bucket && bucket.length > 0) {
      groups.push({ key, label, tasks: bucket });
    }
  }

  // Any unknown statuses go at the end
  for (const [key, bucket] of buckets) {
    if (!STATUS_ORDER.some((s) => s.key === key)) {
      groups.push({ key, label: key.toUpperCase(), tasks: bucket });
    }
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Main grouping function
// ---------------------------------------------------------------------------

export function groupTasks(
  tasks: TaskRecord[],
  grouping: BoardGrouping,
): TaskGroup[] {
  if (grouping === "none") {
    return [{ key: "__all__", label: "All Tasks", tasks }];
  }

  switch (grouping) {
    case "status":
      return groupByStatus(tasks);
    default:
      return [{ key: "__all__", label: "All Tasks", tasks }];
  }
}
