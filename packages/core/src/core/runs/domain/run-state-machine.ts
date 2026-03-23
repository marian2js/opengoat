import type { RunStatus } from "./run.js";

export const VALID_TRANSITIONS: Record<RunStatus, RunStatus[]> = {
  draft: ["running"],
  running: ["waiting_review", "blocked", "completed", "cancelled"],
  waiting_review: ["running", "completed"],
  blocked: ["running", "cancelled"],
  completed: [],
  cancelled: [],
};

const TERMINAL_STATUSES: ReadonlySet<RunStatus> = new Set([
  "completed",
  "cancelled",
]);

export function validateTransition(from: RunStatus, to: RunStatus): void {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new Error(
      `Invalid status transition from "${from}" to "${to}"`,
    );
  }
}

export function getValidNextStatuses(from: RunStatus): RunStatus[] {
  return [...VALID_TRANSITIONS[from]];
}

export function isTerminalStatus(status: RunStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}
