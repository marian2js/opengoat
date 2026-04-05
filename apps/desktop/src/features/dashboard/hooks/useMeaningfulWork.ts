import type { RunRecord } from "@opengoat/contracts";
import type { UseActionSessionsResult } from "@/features/dashboard/hooks/useActionSessions";

export interface MeaningfulWorkItem {
  id: string;
  type: "run" | "session";
  title: string;
  status: string;
  updatedAt: number;
  sessionId?: string;
  actionId?: string;
  needsInput: boolean;
}

export interface UseMeaningfulWorkResult {
  items: MeaningfulWorkItem[];
  hasMeaningfulWork: boolean;
  isLoading: boolean;
}

const RUN_STATUS_LABEL: Record<string, string> = {
  running: "Working",
  waiting_review: "Needs input",
  blocked: "Blocked",
  draft: "Starting",
};

const CONTINUABLE_SESSION_STATES = new Set(["starting", "working", "needs-input"]);

/** 48 hours in milliseconds — runs older than this are considered stale */
const STALE_THRESHOLD_MS = 48 * 60 * 60 * 1000;

/**
 * Composes useRuns + useActionSessions results into a filtered list of
 * meaningful, user-owned work items suitable for the "Continue where you
 * left off" section.
 *
 * Filtering rules:
 * - Runs: only user-initiated (startedFrom "dashboard" or "chat"), exclude "action"
 * - Runs: exclude if updatedAt is older than 48 hours
 * - Sessions: only active states ("starting", "working", "needs-input")
 * - Sorted with needsInput first, then by recency
 * - Capped at 3 items
 */
export function useMeaningfulWork(
  runs: RunRecord[],
  runsLoading: boolean,
  actionSessions: UseActionSessionsResult,
): UseMeaningfulWorkResult {
  const now = Date.now();

  // Filter runs: user-initiated + not stale
  const meaningfulRuns: MeaningfulWorkItem[] = runs
    .filter((r) => {
      if (r.startedFrom === "action") return false;
      if (r.startedFrom !== "dashboard" && r.startedFrom !== "chat") return false;
      const updatedMs = new Date(r.updatedAt).getTime();
      return now - updatedMs < STALE_THRESHOLD_MS;
    })
    .map((r) => ({
      id: r.runId,
      type: "run" as const,
      title: r.title,
      status: RUN_STATUS_LABEL[r.status] ?? "Working",
      updatedAt: new Date(r.updatedAt).getTime(),
      sessionId: r.sessionId,
      needsInput: r.status === "waiting_review",
    }));

  // Filter sessions: only continuable active states
  const meaningfulSessions: MeaningfulWorkItem[] = actionSessions.activeSessions
    .filter((s) => CONTINUABLE_SESSION_STATES.has(s.state))
    .map((s) => ({
      id: s.sessionId,
      type: "session" as const,
      title: s.actionTitle,
      status: s.state === "needs-input" ? "Needs input" : s.state === "starting" ? "Starting" : "Working",
      updatedAt: s.startedAt,
      sessionId: s.sessionId,
      actionId: s.actionId,
      needsInput: s.state === "needs-input",
    }));

  // Merge, sort (needs-input first, then by recency), cap at 3
  const merged = [...meaningfulRuns, ...meaningfulSessions];
  merged.sort((a, b) => {
    if (a.needsInput !== b.needsInput) return a.needsInput ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });

  const items = merged.slice(0, 3);

  return {
    items,
    hasMeaningfulWork: items.length > 0,
    isLoading: runsLoading,
  };
}
