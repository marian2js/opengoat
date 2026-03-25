import { useCallback, useEffect, useState } from "react";
import type { ActionSessionMeta } from "@/features/action-session/types";
import { getAllActionSessionMetas } from "@/features/action-session/lib/action-session-state";

export interface ActionSessionEntry {
  sessionId: string;
  actionId: string;
  actionTitle: string;
  state: ActionSessionMeta["state"];
  savedToBoard: boolean;
  startedAt: number;
}

const ACTIVE_STATES = new Set(["starting", "working", "needs-input"]);
const RECENT_STATES = new Set(["ready-to-review", "saved-to-board", "done"]);

/** Max age for recent sessions (24 hours) */
const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface UseActionSessionsResult {
  activeSessions: ActionSessionEntry[];
  recentSessions: ActionSessionEntry[];
  hasActiveWork: boolean;
  refresh: () => void;
}

/**
 * Reads action session metadata from localStorage and returns
 * active (in-progress) and recent (completed) sessions, sorted
 * by startedAt descending.
 */
export function useActionSessions(): UseActionSessionsResult {
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // Re-read on focus (user may return from action-session view)
  useEffect(() => {
    const onFocus = () => setRefreshKey((k) => k + 1);
    window.addEventListener("focus", onFocus);
    window.addEventListener("hashchange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("hashchange", onFocus);
    };
  }, []);

  const store = getAllActionSessionMetas();
  const now = Date.now();

  const entries: ActionSessionEntry[] = Object.entries(store).map(
    ([sessionId, meta]) => ({
      sessionId,
      actionId: meta.actionId,
      actionTitle: meta.actionTitle,
      state: meta.state,
      savedToBoard: meta.savedToBoard,
      startedAt: meta.startedAt,
    }),
  );

  // Sort by startedAt descending (newest first)
  entries.sort((a, b) => b.startedAt - a.startedAt);

  const activeSessions = entries.filter((e) => ACTIVE_STATES.has(e.state));
  const recentSessions = entries.filter(
    (e) =>
      RECENT_STATES.has(e.state) &&
      now - e.startedAt < RECENT_WINDOW_MS,
  );

  const hasActiveWork = activeSessions.length > 0 || recentSessions.length > 0;

  return { activeSessions, recentSessions, hasActiveWork, refresh };
}
