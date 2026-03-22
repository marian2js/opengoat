import type { TaskRecord } from "@opengoat/contracts";

const STATUS_PRIORITY: Record<string, number> = {
  doing: 0,
  todo: 1,
  blocked: 2,
  pending: 3,
  done: 4,
};

/**
 * Sort tasks by status priority (doing first, done last),
 * then by updatedAt descending within each status group.
 * Returns a new sorted array without mutating the input.
 */
export function sortTasksByStatus(tasks: TaskRecord[]): TaskRecord[] {
  return [...tasks].sort((a, b) => {
    const priorityA = STATUS_PRIORITY[a.status] ?? 5;
    const priorityB = STATUS_PRIORITY[b.status] ?? 5;
    if (priorityA !== priorityB) return priorityA - priorityB;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}
