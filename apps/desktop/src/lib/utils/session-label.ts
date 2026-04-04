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

/**
 * Returns a human-readable session label, replacing UUID-like or missing
 * labels with "New chat" instead of a date-based fallback.
 *
 * Concise titles (<=55 chars) are returned as-is.
 * Longer titles are truncated with "…".
 */
export function humanizeSessionLabel(
  label: string | undefined | null,
  _createdAt: string,
): string {
  const trimmed = label?.trim() ?? "";

  // Missing or UUID-like → "New chat" (no more generic date labels)
  if (trimmed === "" || isUuidLikeLabel(trimmed)) {
    return "New chat";
  }

  // Concise labels pass through
  if (trimmed.length <= 55) {
    return trimmed;
  }

  // Truncate long labels
  return `${trimmed.slice(0, 52)}...`;
}

/**
 * Truncate a session label for the gateway API which rejects labels
 * exceeding ~60-80 characters. Uses a single "…" character so the
 * truncated label clearly indicates there's more text.
 *
 * The full (untruncated) string should still be used for objective titles
 * or anywhere the gateway limit doesn't apply.
 */
export function truncateSessionLabel(label: string, maxLength = 60): string {
  if (label.length <= maxLength) return label;
  return `${label.slice(0, maxLength - 1)}…`;
}
