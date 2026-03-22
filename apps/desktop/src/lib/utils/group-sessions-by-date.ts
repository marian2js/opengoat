export interface DateGroup<T> {
  label: string;
  sessions: T[];
}

/**
 * Groups sessions into date buckets: Today, Yesterday, then individual dates
 * for the past 7 days, and "Earlier" for anything older.
 * Empty groups are omitted. Original order within each group is preserved.
 */
export function groupSessionsByDate<T extends { createdAt: string }>(
  sessions: T[],
  now: Date = new Date(),
): DateGroup<T>[] {
  if (sessions.length === 0) return [];

  const todayStart = startOfDay(now);
  const yesterdayStart = addDays(todayStart, -1);
  // Build per-day boundaries for 2–6 days ago
  const dayBoundaries: { start: Date; label: string }[] = [];
  for (let i = 2; i <= 6; i++) {
    const dayStart = addDays(todayStart, -i);
    dayBoundaries.push({ start: dayStart, label: formatDateLabel(dayStart) });
  }
  const earlierCutoff = addDays(todayStart, -7);

  const todayBucket: T[] = [];
  const yesterdayBucket: T[] = [];
  const dayBuckets: T[][] = dayBoundaries.map(() => []);
  const earlierBucket: T[] = [];

  for (const session of sessions) {
    const created = new Date(session.createdAt);
    if (created >= todayStart) {
      todayBucket.push(session);
    } else if (created >= yesterdayStart) {
      yesterdayBucket.push(session);
    } else if (created >= earlierCutoff) {
      // Find which per-day bucket it falls into
      let placed = false;
      for (let i = 0; i < dayBoundaries.length; i++) {
        const nextStart = i === 0 ? yesterdayStart : dayBoundaries[i - 1].start;
        if (created >= dayBoundaries[i].start && created < nextStart) {
          dayBuckets[i].push(session);
          placed = true;
          break;
        }
      }
      if (!placed) {
        earlierBucket.push(session);
      }
    } else {
      earlierBucket.push(session);
    }
  }

  const groups: DateGroup<T>[] = [];

  if (todayBucket.length > 0) {
    groups.push({ label: "Today", sessions: todayBucket });
  }
  if (yesterdayBucket.length > 0) {
    groups.push({ label: "Yesterday", sessions: yesterdayBucket });
  }
  for (let i = 0; i < dayBoundaries.length; i++) {
    if (dayBuckets[i].length > 0) {
      groups.push({ label: dayBoundaries[i].label, sessions: dayBuckets[i] });
    }
  }
  if (earlierBucket.length > 0) {
    groups.push({ label: "Earlier", sessions: earlierBucket });
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

/**
 * Format a date as "March 20" style label.
 */
function formatDateLabel(date: Date): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}
