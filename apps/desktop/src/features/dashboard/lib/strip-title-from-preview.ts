import { stripMarkdown } from "./strip-markdown";

/**
 * Strips the title prefix from a summary string so the preview body
 * does not echo the card heading. Returns plain text ready for display.
 */
export function stripTitleFromPreview(title: string, summary: string): string {
  if (!summary) return "";

  const stripped = stripMarkdown(summary);
  const normalizedTitle = title.replace(/\s+/g, " ").trim().toLowerCase();

  // Strip leading list numbering (e.g. "1) ", "2. ") to match cleanArtifactTitle behavior
  const withoutNumbering = stripped.replace(/^\d+[.)]\s+/, "");

  const normalizedStripped = withoutNumbering.replace(/\s+/g, " ").trim();
  const normalizedStrippedLower = normalizedStripped.toLowerCase();

  if (normalizedTitle && normalizedStrippedLower.startsWith(normalizedTitle)) {
    const remainder = normalizedStripped.slice(normalizedTitle.length).trim();
    // Remove leading punctuation like ": " after the title
    return remainder.replace(/^[:\-–—]\s*/, "").trim();
  }

  return stripped;
}
