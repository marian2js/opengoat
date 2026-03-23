/**
 * Matches labels that look like raw UUIDs or UUID prefixes — the kind of
 * machine-generated strings that should never appear as user-facing titles.
 *
 * Patterns detected:
 * - Full UUID:  "f1a26b39-abcd-1234-5678-123456789abc"
 * - 8-char hex: "f1a26b39"
 * - Hex + date: "f1a26b39 (2026-03-22)"
 */
const UUID_FULL_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_SHORT_RE = /^[0-9a-f]{8}(?:\s*\(.*\))?$/i;

export function isUuidLikeLabel(label: string | undefined | null): boolean {
  if (!label) return false;
  const trimmed = label.trim();
  if (trimmed === "") return false;
  return UUID_FULL_RE.test(trimmed) || UUID_SHORT_RE.test(trimmed);
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDateLabel(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const month = MONTH_NAMES[d.getUTCMonth()];
  const day = d.getUTCDate();
  return `Chat \u2014 ${month} ${day}`;
}

/**
 * Returns a human-readable session label, replacing UUID-like or missing
 * labels with a date-based fallback derived from createdAt.
 *
 * Concise titles (<=40 chars) are returned as-is.
 * Longer titles are truncated with "…".
 */
export function humanizeSessionLabel(
  label: string | undefined | null,
  createdAt: string,
): string {
  const trimmed = label?.trim() ?? "";

  // Missing or UUID-like → date-based fallback
  if (trimmed === "" || isUuidLikeLabel(trimmed)) {
    return formatDateLabel(createdAt) ?? "New conversation";
  }

  // Concise labels pass through
  if (trimmed.length <= 40) {
    return trimmed;
  }

  // Truncate long labels
  return `${trimmed.slice(0, 37)}...`;
}
