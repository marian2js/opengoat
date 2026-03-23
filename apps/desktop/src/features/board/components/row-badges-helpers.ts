/**
 * Truncate a label to maxLen characters, appending "…" if truncated.
 */
export function truncateLabel(label: string, maxLen: number): string {
  if (!label || label.length <= maxLen) return label;
  return label.slice(0, maxLen) + "…";
}

/**
 * Format a count for display as a compact badge.
 * Returns null for 0 (badge should be hidden), "99+" for >= 100.
 */
export function formatCountBadge(count: number): string | null {
  if (count <= 0) return null;
  if (count >= 100) return "99+";
  return String(count);
}
