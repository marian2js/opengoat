import type { DateGroup } from "./group-sessions-by-date";

/**
 * Collapses the detailed date groups from groupSessionsByDate into
 * simplified buckets: Today, Yesterday, This Week, Older.
 *
 * Day-specific labels (e.g. "March 23") are merged into "This Week".
 * "Earlier" is renamed to "Older".
 */
export function simplifyDateGroups<T>(groups: DateGroup<T>[]): DateGroup<T>[] {
  const result: DateGroup<T>[] = [];
  const thisWeekSessions: T[] = [];

  for (const group of groups) {
    if (group.label === "Today" || group.label === "Yesterday") {
      result.push(group);
    } else if (group.label === "Earlier") {
      // Flush any accumulated "This Week" sessions first
      if (thisWeekSessions.length > 0) {
        result.push({ label: "This Week", sessions: [...thisWeekSessions] });
        thisWeekSessions.length = 0;
      }
      result.push({ label: "Older", sessions: group.sessions });
    } else {
      // Day-specific label (e.g. "March 23") → merge into This Week
      thisWeekSessions.push(...group.sessions);
    }
  }

  // Flush remaining "This Week" sessions if no "Earlier" group followed
  if (thisWeekSessions.length > 0) {
    result.push({ label: "This Week", sessions: thisWeekSessions });
  }

  return result;
}
