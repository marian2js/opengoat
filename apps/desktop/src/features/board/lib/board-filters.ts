import type { TaskRecord } from "@opengoat/contracts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StatusFilter = "all" | "open" | "blocked" | "pending" | "done";
export type BoardSort = "updated" | "status" | "newest" | "oldest";
export type SourceTypeFilter = "chat" | "playbook" | "action" | "manual";

/** @deprecated Use StatusFilter instead */
export type BoardFilter = StatusFilter;

export interface BoardFilterState {
  status: StatusFilter;
  objectiveId: string | null;
  runId: string | null;
  sourceType: SourceTypeFilter | null;
  stale: boolean;
  readyForReview: boolean;
}

export const DEFAULT_FILTER_STATE: BoardFilterState = {
  status: "all",
  objectiveId: null,
  runId: null,
  sourceType: null,
  stale: false,
  readyForReview: false,
};

// ---------------------------------------------------------------------------
// Filter mapping
// ---------------------------------------------------------------------------

const FILTER_STATUSES: Record<StatusFilter, string[] | null> = {
  all: null, // null = include everything
  open: ["todo", "doing"],
  blocked: ["blocked"],
  pending: ["pending"],
  done: ["done"],
};

// ---------------------------------------------------------------------------
// Sort comparators
// ---------------------------------------------------------------------------

const STATUS_PRIORITY: Record<string, number> = {
  doing: 0,
  todo: 1,
  blocked: 2,
  pending: 3,
  done: 4,
};

function compareByUpdatedDesc(a: TaskRecord, b: TaskRecord): number {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

function compareByStatus(a: TaskRecord, b: TaskRecord): number {
  const pa = STATUS_PRIORITY[a.status] ?? 5;
  const pb = STATUS_PRIORITY[b.status] ?? 5;
  if (pa !== pb) return pa - pb;
  return compareByUpdatedDesc(a, b);
}

function compareByNewest(a: TaskRecord, b: TaskRecord): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function compareByOldest(a: TaskRecord, b: TaskRecord): number {
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

const SORT_COMPARATORS: Record<BoardSort, (a: TaskRecord, b: TaskRecord) => number> = {
  updated: compareByUpdatedDesc,
  status: compareByStatus,
  newest: compareByNewest,
  oldest: compareByOldest,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STALE_THRESHOLD_DAYS = 7;

export function isStale(
  task: TaskRecord,
  thresholdDays: number = STALE_THRESHOLD_DAYS,
  now: Date = new Date(),
): boolean {
  const updatedMs = new Date(task.updatedAt).getTime();
  const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
  return now.getTime() - updatedMs > thresholdMs;
}

export function isReadyForReview(task: TaskRecord): boolean {
  return task.status === "pending";
}

// ---------------------------------------------------------------------------
// Linkage helpers — extract objectiveId/runId/sourceType from task
// ---------------------------------------------------------------------------

function getTaskObjectiveId(task: TaskRecord): string | undefined {
  return task.objectiveId ?? (task.metadata?.objectiveId as string | undefined);
}

function getTaskRunId(task: TaskRecord): string | undefined {
  return task.runId ?? (task.metadata?.runId as string | undefined);
}

function getTaskSourceType(task: TaskRecord): string | undefined {
  return task.sourceType ?? (task.metadata?.sourceType as string | undefined);
}

// ---------------------------------------------------------------------------
// Pipeline: status → objective → run → sourceType → stale → readyForReview → search → sort
// ---------------------------------------------------------------------------

export function applyBoardFilters(
  tasks: TaskRecord[],
  filterState: BoardFilterState,
  sort: BoardSort,
  search: string,
  now?: Date,
): TaskRecord[] {
  let result = tasks;

  // 1. Filter by status
  const allowedStatuses = FILTER_STATUSES[filterState.status];
  if (allowedStatuses) {
    result = result.filter((t) => allowedStatuses.includes(t.status));
  }

  // 2. Filter by objectiveId
  if (filterState.objectiveId) {
    const objId = filterState.objectiveId;
    result = result.filter((t) => getTaskObjectiveId(t) === objId);
  }

  // 3. Filter by runId
  if (filterState.runId) {
    const rId = filterState.runId;
    result = result.filter((t) => getTaskRunId(t) === rId);
  }

  // 4. Filter by sourceType
  if (filterState.sourceType) {
    const st = filterState.sourceType;
    result = result.filter((t) => getTaskSourceType(t) === st);
  }

  // 5. Filter by stale flag
  if (filterState.stale) {
    result = result.filter((t) => isStale(t, STALE_THRESHOLD_DAYS, now));
  }

  // 6. Filter by readyForReview flag
  if (filterState.readyForReview) {
    result = result.filter((t) => isReadyForReview(t));
  }

  // 7. Search by title (case-insensitive substring)
  if (search.trim()) {
    const query = search.toLowerCase();
    result = result.filter((t) => t.title.toLowerCase().includes(query));
  }

  // 8. Sort
  const comparator = SORT_COMPARATORS[sort];
  result = [...result].sort(comparator);

  return result;
}

// ---------------------------------------------------------------------------
// Sort option labels (for UI)
// ---------------------------------------------------------------------------

export const SORT_OPTIONS: { value: BoardSort; label: string }[] = [
  { value: "updated", label: "Most Recently Updated" },
  { value: "status", label: "Status" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
];

export const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "blocked", label: "Blocked" },
  { value: "pending", label: "Pending" },
  { value: "done", label: "Done" },
];

export const SOURCE_TYPE_OPTIONS: { value: SourceTypeFilter; label: string }[] = [
  { value: "chat", label: "Chat" },
  { value: "playbook", label: "Playbook" },
  { value: "action", label: "Action" },
  { value: "manual", label: "Manual" },
];
