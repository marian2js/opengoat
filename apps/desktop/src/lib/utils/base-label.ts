/**
 * Strip trailing dedup number suffixes like " (2)", " (16)" from session labels.
 * Used to detect duplicate action session names that differ only by their
 * sequential number — so timestamps can be shown for disambiguation.
 */
const DEDUP_SUFFIX_RE = /\s*\(\d+\)$/;

export function baseLabel(label: string): string {
  return label.replace(DEDUP_SUFFIX_RE, "");
}
