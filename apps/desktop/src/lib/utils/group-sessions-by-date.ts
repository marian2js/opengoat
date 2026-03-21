export interface DateGroup<T> {
  label: string;
  sessions: T[];
}

const DATE_GROUP_LABELS = [
  "Today",
  "Yesterday",
  "This Week",
  "This Month",
  "Older",
] as const;

/**
 * Groups sessions into date buckets: Today, Yesterday, This Week, This Month, Older.
 * Empty groups are omitted. Original order within each group is preserved.
 */
export function groupSessionsByDate<T extends { createdAt: string }>(
  sessions: T[],
  now: Date = new Date(),
): DateGroup<T>[] {
  if (sessions.length === 0) return [];

  const todayStart = startOfDay(now);
  const yesterdayStart = addDays(todayStart, -1);
  const weekStart = addDays(todayStart, -todayStart.getDay()); // Sunday of this week
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const buckets: T[][] = [[], [], [], [], []];

  for (const session of sessions) {
    const created = new Date(session.createdAt);
    if (created >= todayStart) {
      buckets[0].push(session);
    } else if (created >= yesterdayStart) {
      buckets[1].push(session);
    } else if (created >= weekStart) {
      buckets[2].push(session);
    } else if (created >= monthStart) {
      buckets[3].push(session);
    } else {
      buckets[4].push(session);
    }
  }

  const groups: DateGroup<T>[] = [];
  for (let i = 0; i < DATE_GROUP_LABELS.length; i++) {
    if (buckets[i].length > 0) {
      groups.push({ label: DATE_GROUP_LABELS[i], sessions: buckets[i] });
    }
  }

  return groups;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
