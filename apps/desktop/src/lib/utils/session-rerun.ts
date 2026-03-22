/**
 * Detects which sessions are older re-runs of the same action.
 *
 * A session is considered a re-run if its title matches the pattern "Action title (N)"
 * where N is a number > 1. Among all re-runs of the same base action title, only the
 * most recent one (by updatedAt) retains full visual weight; older re-runs are
 * de-emphasized.
 */

/**
 * Returns true if the session label has a `(N)` suffix where N >= 2,
 * indicating it is a re-run of a previously executed action.
 */
export function isReRunLabel(label: string): boolean {
  const match = label.match(/\((\d+)\)\s*$/);
  if (!match) return false;
  return Number(match[1]) >= 2;
}

/**
 * Strips the `(N)` suffix from a label to get the base action title.
 */
export function getBaseTitle(label: string): string {
  return label.replace(/\s*\(\d+\)\s*$/, "").trim();
}

/**
 * Given an array of sessions, returns a Set of session IDs that should be
 * de-emphasized (older re-runs).
 *
 * A session is de-emphasized if:
 * - It has a `(N)` suffix with N >= 2
 * - It is NOT the most recent session (by updatedAt) sharing the same base title
 */
export function getDeEmphasizedSessionIds<
  T extends { id: string; label?: string | undefined; updatedAt: string },
>(sessions: T[]): Set<string> {
  // Track the most recent session per base title among re-runs
  const latestByBase = new Map<string, T>();

  for (const session of sessions) {
    const label = session.label ?? "";
    if (!isReRunLabel(label)) continue;

    const base = getBaseTitle(label);
    const existing = latestByBase.get(base);
    if (!existing || session.updatedAt > existing.updatedAt) {
      latestByBase.set(base, session);
    }
  }

  const deEmphasized = new Set<string>();
  for (const session of sessions) {
    const label = session.label ?? "";
    if (!isReRunLabel(label)) continue;

    const base = getBaseTitle(label);
    const latest = latestByBase.get(base);
    if (latest && latest.id !== session.id) {
      deEmphasized.add(session.id);
    }
  }

  return deEmphasized;
}
