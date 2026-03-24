import { useCallback, useState } from "react";

const STORAGE_KEY = "opengoat:dismissedProposals";

function readDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed.filter((v): v is string => typeof v === "string"));
    return new Set();
  } catch {
    return new Set();
  }
}

function writeDismissed(ids: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // Ignore storage errors
  }
}

export interface UseDismissedProposalsResult {
  isDismissed: boolean;
  dismiss: () => void;
}

/**
 * Hook to manage per-session proposal dismissal.
 * Once dismissed, proposals won't reappear for this session.
 */
export function useDismissedProposals(sessionId: string): UseDismissedProposalsResult {
  const [isDismissed, setIsDismissed] = useState(() => readDismissed().has(sessionId));

  const dismiss = useCallback(() => {
    setIsDismissed(true);
    const ids = readDismissed();
    ids.add(sessionId);
    writeDismissed(ids);
  }, [sessionId]);

  return { isDismissed, dismiss };
}
