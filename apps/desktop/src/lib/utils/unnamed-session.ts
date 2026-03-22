const UNNAMED_PATTERNS = [
  "new conversation",
  "untitled chat",
  "untitled",
];

/**
 * Returns true if a session label is a default/unnamed placeholder.
 * These sessions should be visually de-emphasized in the sidebar.
 */
export function isUnnamedSession(label: string | undefined): boolean {
  if (!label) return true;
  const trimmed = label.trim().toLowerCase();
  if (trimmed === "") return true;
  return UNNAMED_PATTERNS.includes(trimmed);
}
