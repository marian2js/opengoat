import { stripMarkdown } from "./strip-markdown";
import { getArtifactTypeConfig } from "./artifact-type-config";

/**
 * Regex matching first-person conversational preamble that should not
 * appear as an artifact title. Case-insensitive.
 */
export const CONVERSATIONAL_PATTERN =
  /^(I |I'm |I'll |I've |I don't|I can't|I still|I checked|Got it|Let me|Here |Sure|OK |Okay|Well |So |Hmm)/i;

/**
 * Returns true if the given title looks like AI conversational preamble
 * rather than a descriptive deliverable name.
 */
export function isConversationalTitle(title: string): boolean {
  return CONVERSATIONAL_PATTERN.test(title.trim());
}

/**
 * Produces a clean display title for an artifact. Strips markdown,
 * detects conversational AI preamble, and falls back to a heading
 * extracted from content or to the humanized artifact type label.
 */
export function cleanArtifactTitle(
  artifact: { title: string; type: string; content?: string },
): string {
  const stripped = stripMarkdown(artifact.title);

  if (!isConversationalTitle(stripped)) {
    return stripped;
  }

  // Try to extract the first markdown heading from content
  if (artifact.content) {
    const headingMatch = artifact.content.match(/^#{1,6}\s+(.+)$/m);
    if (headingMatch) {
      return stripMarkdown(headingMatch[1].trim());
    }
  }

  // Fall back to the human-readable type label
  return getArtifactTypeConfig(artifact.type).label;
}
