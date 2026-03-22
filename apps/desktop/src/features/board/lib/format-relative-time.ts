const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * Format an ISO date string as a human-readable relative time.
 * Returns "just now", "5m ago", "2h ago", "3d ago", or a formatted date for older timestamps.
 */
export function formatRelativeTime(isoString: string): string {
  const diffSeconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);

  if (diffSeconds < MINUTE) return "just now";
  if (diffSeconds < HOUR) return `${Math.floor(diffSeconds / MINUTE)}m ago`;
  if (diffSeconds < DAY) return `${Math.floor(diffSeconds / HOUR)}h ago`;
  if (diffSeconds < WEEK) return `${Math.floor(diffSeconds / DAY)}d ago`;

  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
