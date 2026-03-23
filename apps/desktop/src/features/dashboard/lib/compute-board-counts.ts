import type { TaskRecord } from "@opengoat/contracts";

export interface BoardCounts {
  /** Tasks with status "todo" or "doing" */
  open: number;
  /** Tasks with status "doing" only */
  doing: number;
  /** Tasks with status "blocked" */
  blocked: number;
  /** Tasks with status "pending" */
  pending: number;
  /** Tasks with status "done" */
  done: number;
  /** Total number of tasks */
  total: number;
}

export function computeBoardCounts(tasks: TaskRecord[]): BoardCounts {
  let open = 0;
  let doing = 0;
  let blocked = 0;
  let pending = 0;
  let done = 0;

  for (const task of tasks) {
    switch (task.status) {
      case "todo":
        open++;
        break;
      case "doing":
        open++;
        doing++;
        break;
      case "blocked":
        blocked++;
        break;
      case "pending":
        pending++;
        break;
      case "done":
        done++;
        break;
    }
  }

  return { open, doing, blocked, pending, done, total: tasks.length };
}
