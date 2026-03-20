/**
 * Given a base label and a list of sessions, return a unique label.
 * If the base label is already taken, appends " (2)", " (3)", etc.
 */
export function deduplicateLabel(
  baseLabel: string,
  sessions: { label?: string | undefined }[],
): string {
  const existingLabels = new Set<string>();
  for (const s of sessions) {
    if (s.label) {
      existingLabels.add(s.label);
    }
  }

  if (!existingLabels.has(baseLabel)) {
    return baseLabel;
  }

  // Find the highest existing (N) suffix for this base label
  const escaped = baseLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escaped} \\((\\d+)\\)$`);
  let maxN = 1; // base label counts as (1)
  for (const label of existingLabels) {
    const match = label.match(pattern);
    if (match) {
      maxN = Math.max(maxN, Number(match[1]));
    }
  }

  return `${baseLabel} (${maxN + 1})`;
}
