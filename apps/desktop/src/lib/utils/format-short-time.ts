/**
 * Format an ISO date string as a compact timestamp for sidebar display.
 * - Same day as `now`: "2:15 PM"
 * - Older: "Mar 24"
 */
export function formatShortTime(
  isoDate: string,
  now: Date = new Date(),
): string {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";

  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
