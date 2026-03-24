import { useCallback, useState } from "react";

const STORAGE_KEY = "opengoat:dismissedMemories";

type DismissedMap = Record<string, string[]>;

function readDismissedMap(): DismissedMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as DismissedMap;
    }
    return {};
  } catch {
    return {};
  }
}

function writeDismissedMap(map: DismissedMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage errors
  }
}

export interface UseDismissedMemoriesResult {
  dismissedIds: Set<string>;
  dismiss: (candidateId: string) => void;
}

/**
 * Hook to manage per-candidate memory dismissal within a session.
 * Allows individual memory chips to be dismissed independently.
 */
export function useDismissedMemories(sessionId: string): UseDismissedMemoriesResult {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    const map = readDismissedMap();
    const ids = map[sessionId];
    return new Set(Array.isArray(ids) ? ids : []);
  });

  const dismiss = useCallback(
    (candidateId: string) => {
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.add(candidateId);
        const map = readDismissedMap();
        map[sessionId] = [...next];
        writeDismissedMap(map);
        return next;
      });
    },
    [sessionId],
  );

  return { dismissedIds, dismiss };
}
