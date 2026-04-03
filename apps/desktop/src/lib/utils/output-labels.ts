/**
 * Utilities for human-readable output labels and relative time formatting.
 */

/**
 * Converts an artifact title or type into a human-readable label.
 * - Already-readable titles (contain spaces) are returned as-is.
 * - Snake_case types like "hero_rewrite" become "Hero Rewrite".
 * - Kebab-case types like "launch-pack" become "Launch Pack".
 */
export function humanizeOutputLabel(title: string): string {
  if (!title) return "Output";

  // If the title already contains spaces, it's likely human-readable
  if (title.includes(" ")) return title;

  // Convert snake_case or kebab-case to Title Case
  return title
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Formats a date string into a relative time string like "2 hours ago".
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (diffMs < 0) return "just now";

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
