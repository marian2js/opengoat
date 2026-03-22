import type { TaskRecord } from "@opengoat/contracts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BoardFilter = "all" | "open" | "blocked" | "pending" | "done";
export type BoardSort = "updated" | "status" | "newest" | "oldest";

// ---------------------------------------------------------------------------
// Filter mapping
// ---------------------------------------------------------------------------

const FILTER_STATUSES: Record<BoardFilter, string[] | null> = {
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
// Pipeline: filter → search → sort
// ---------------------------------------------------------------------------

export function applyBoardFilters(
  tasks: TaskRecord[],
  filter: BoardFilter,
  sort: BoardSort,
  search: string,
): TaskRecord[] {
  // 1. Filter by status
  const allowedStatuses = FILTER_STATUSES[filter];
  let result = allowedStatuses
    ? tasks.filter((t) => allowedStatuses.includes(t.status))
    : tasks;

  // 2. Search by title (case-insensitive substring)
  if (search.trim()) {
    const query = search.toLowerCase();
    result = result.filter((t) => t.title.toLowerCase().includes(query));
  }

  // 3. Sort
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

export const FILTER_OPTIONS: { value: BoardFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "blocked", label: "Blocked" },
  { value: "pending", label: "Pending" },
  { value: "done", label: "Done" },
];
