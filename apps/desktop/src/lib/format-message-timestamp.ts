/**
 * Format a message creation timestamp for display in chat.
 *
 * - Today: "3:46 PM"
 * - Yesterday: "Yesterday 3:46 PM"
 * - Older: "Mar 27 3:46 PM"
 */
export function formatMessageTimestamp(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const messageDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const timeStr = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (messageDay.getTime() === today.getTime()) {
    // Same day — time only
    return timeStr;
  }

  if (messageDay.getTime() === yesterday.getTime()) {
    return `Yesterday ${timeStr}`;
  }

  // Older — short month + day + time
  const monthDay = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return `${monthDay} ${timeStr}`;
}
