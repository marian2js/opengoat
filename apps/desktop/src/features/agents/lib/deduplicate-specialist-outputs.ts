import type { ArtifactRecord } from "@opengoat/contracts";
import { cleanArtifactTitle } from "../../dashboard/lib/clean-artifact-title";

/**
 * Deduplicates artifacts by case-insensitive cleaned title,
 * keeping the most recent entry for each unique title.
 * Preserves the order of first occurrences.
 */
export function deduplicateSpecialistOutputs(
  artifacts: ArtifactRecord[],
): ArtifactRecord[] {
  const seen = new Map<string, ArtifactRecord>();

  for (const artifact of artifacts) {
    const key = cleanArtifactTitle(artifact).toLowerCase();
    const existing = seen.get(key);
    if (!existing || new Date(artifact.createdAt) > new Date(existing.createdAt)) {
      seen.set(key, artifact);
    }
  }

  // Preserve original order of first occurrences
  const dedupedSet = new Set(seen.values());
  return artifacts.filter((a) => dedupedSet.has(a));
}
