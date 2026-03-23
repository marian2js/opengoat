import type { TaskRecord } from "@opengoat/contracts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BoardGrouping = "none" | "status" | "objective" | "playbook";

export interface TaskGroup {
  key: string;
  label: string;
  tasks: TaskRecord[];
}

export interface ObjectiveMapEntry {
  title: string;
  status: string;
}

export interface RunMapEntry {
  title: string;
  playbookId?: string;
  playbookTitle?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const GROUPING_OPTIONS: { value: BoardGrouping; label: string }[] = [
  { value: "none", label: "No Grouping" },
  { value: "status", label: "By Status" },
  { value: "objective", label: "By Objective" },
  { value: "playbook", label: "By Playbook" },
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
// Linkage helpers — same as board-filters.ts
// ---------------------------------------------------------------------------

function getTaskObjectiveId(task: TaskRecord): string | undefined {
  return task.objectiveId ?? (task.metadata?.objectiveId as string | undefined);
}

function getTaskRunId(task: TaskRecord): string | undefined {
  return task.runId ?? (task.metadata?.runId as string | undefined);
}

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

function groupByObjective(
  tasks: TaskRecord[],
  objectiveMap: Map<string, ObjectiveMapEntry>,
): TaskGroup[] {
  const buckets = new Map<string, TaskRecord[]>();
  const noObjective: TaskRecord[] = [];

  for (const task of tasks) {
    const objId = getTaskObjectiveId(task);
    if (!objId) {
      noObjective.push(task);
    } else {
      if (!buckets.has(objId)) buckets.set(objId, []);
      buckets.get(objId)!.push(task);
    }
  }

  const groups: TaskGroup[] = [];
  for (const [key, bucket] of buckets) {
    const entry = objectiveMap.get(key);
    const label = entry?.title ?? "Unknown Objective";
    groups.push({ key, label, tasks: bucket });
  }

  if (noObjective.length > 0) {
    groups.push({ key: "__none__", label: "No Objective", tasks: noObjective });
  }

  return groups;
}

function groupByPlaybook(
  tasks: TaskRecord[],
  runMap: Map<string, RunMapEntry>,
): TaskGroup[] {
  const buckets = new Map<string, { label: string; tasks: TaskRecord[] }>();
  const noPlaybook: TaskRecord[] = [];

  for (const task of tasks) {
    const runId = getTaskRunId(task);
    if (!runId) {
      noPlaybook.push(task);
      continue;
    }

    const run = runMap.get(runId);
    if (!run) {
      noPlaybook.push(task);
      continue;
    }

    // Group by playbookId if available, otherwise by run itself
    const key = run.playbookId ?? `run:${runId}`;
    const label = run.playbookTitle ?? run.title;

    if (!buckets.has(key)) {
      buckets.set(key, { label, tasks: [] });
    }
    buckets.get(key)!.tasks.push(task);
  }

  const groups: TaskGroup[] = [];
  for (const [key, bucket] of buckets) {
    groups.push({ key, label: bucket.label, tasks: bucket.tasks });
  }

  if (noPlaybook.length > 0) {
    groups.push({ key: "__none__", label: "No Playbook", tasks: noPlaybook });
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Main grouping function
// ---------------------------------------------------------------------------

export function groupTasks(
  tasks: TaskRecord[],
  grouping: BoardGrouping,
  objectiveMap: Map<string, ObjectiveMapEntry>,
  runMap: Map<string, RunMapEntry>,
): TaskGroup[] {
  if (grouping === "none") {
    return [{ key: "__all__", label: "All Tasks", tasks }];
  }

  switch (grouping) {
    case "status":
      return groupByStatus(tasks);
    case "objective":
      return groupByObjective(tasks, objectiveMap);
    case "playbook":
      return groupByPlaybook(tasks, runMap);
    default:
      return [{ key: "__all__", label: "All Tasks", tasks }];
  }
}
