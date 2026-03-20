/**
 * Persistence module for action card → session ID mapping.
 * Tracks which action cards have been executed and links to their most recent session.
 * Stored in localStorage as a JSON object: Record<actionId, sessionId>.
 */

const ACTION_MAP_KEY = "opengoat:actionMap";

/** In-memory cache hydrated from localStorage on module load. */
const actionMap = new Map<string, string>();

// Hydrate from localStorage
try {
  const stored = localStorage.getItem(ACTION_MAP_KEY);
  if (stored) {
    const parsed: unknown = JSON.parse(stored);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof key === "string" && typeof value === "string") {
          actionMap.set(key, value);
        }
      }
    }
  }
} catch {
  // Ignore corrupt localStorage
}

function persist(): void {
  try {
    const obj: Record<string, string> = {};
    for (const [key, value] of actionMap) {
      obj[key] = value;
    }
    localStorage.setItem(ACTION_MAP_KEY, JSON.stringify(obj));
  } catch {
    // Ignore storage errors
  }
}

/** Upsert a mapping from actionId to sessionId. */
export function setActionMapping(actionId: string, sessionId: string): void {
  actionMap.set(actionId, sessionId);
  persist();
}

/** Get the session ID for an action, or null if never executed. */
export function getActionMapping(actionId: string): string | null {
  return actionMap.get(actionId) ?? null;
}

/** Get the set of all action IDs that have been executed. */
export function getCompletedActionIds(): Set<string> {
  return new Set(actionMap.keys());
}
