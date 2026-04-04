import type { ArtifactRecord } from "../../artifacts/domain/artifact.js";

export interface ArtifactMatchResult {
  matched: Map<string, ArtifactRecord>;
  missing: string[];
}

/**
 * Tokenize a string into lowercase alphanumeric words.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/**
 * Matches actual artifacts against expected artifact names using fuzzy token overlap.
 * A match requires at least 50% of the expected name's tokens to appear in the artifact title.
 * Returns a map of matched expected names → artifact records, and a list of unmatched names.
 */
export function matchArtifactsToExpected(
  artifacts: ArtifactRecord[],
  expectedNames: string[],
): ArtifactMatchResult {
  const matched = new Map<string, ArtifactRecord>();
  const missing: string[] = [];

  // Track which artifacts have already been claimed to avoid double-matching
  const claimed = new Set<string>();

  for (const expectedName of expectedNames) {
    const expectedTokens = tokenize(expectedName);
    if (expectedTokens.length === 0) {
      matched.set(expectedName, undefined as unknown as ArtifactRecord);
      continue;
    }

    let bestArtifact: ArtifactRecord | null = null;
    let bestScore = 0;

    for (const artifact of artifacts) {
      if (claimed.has(artifact.artifactId)) continue;

      const titleTokens = new Set(tokenize(artifact.title));
      const overlap = expectedTokens.filter((t) => titleTokens.has(t)).length;
      const score = overlap / expectedTokens.length;

      if (score >= 0.5 && score > bestScore) {
        bestScore = score;
        bestArtifact = artifact;
      }
    }

    if (bestArtifact) {
      matched.set(expectedName, bestArtifact);
      claimed.add(bestArtifact.artifactId);
    } else {
      missing.push(expectedName);
    }
  }

  return { matched, missing };
}
