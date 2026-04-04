/**
 * Regex matching conversational preamble patterns that should not
 * appear as artifact titles. Case-insensitive, anchored to start.
 */
const CONVERSATIONAL_PATTERN =
  /^(I |I'm |I'll |I've |I don't|I can't|I can |I still|I checked|Got it|Let me|Here |Here'|Sure|OK |Okay|Well |So |Hmm|Based on |According to |After reviewing |After analyzing |Looking at |From the |From my |Given |Pulling |Checking |Reviewing |Analyzing |To help |In order to |For this |For your |As requested|Absolutely|Assuming |Saved |Short answer)/i;

/**
 * Normalizes Unicode smart/curly quotes to ASCII equivalents
 * so pattern matching works consistently.
 */
function normalizeQuotes(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201A]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"');
}

/**
 * Strips common inline markdown formatting from text (bold, italic, code, links).
 */
function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

/**
 * Returns true if the given title looks like conversational AI preamble
 * rather than a descriptive artifact name.
 */
export function isConversationalTitle(title: string): boolean {
  return CONVERSATIONAL_PATTERN.test(normalizeQuotes(title.trim()));
}

/**
 * Produces a clean artifact title from a section heading.
 *
 * 1. Strips inline markdown from the heading.
 * 2. If the heading is conversational preamble, extracts the first
 *    non-conversational markdown heading from the section content.
 * 3. Falls back to a humanized artifact type label.
 */
export function cleanSectionTitle(
  heading: string,
  content: string,
  artifactType: string,
): string {
  const stripped = stripInlineMarkdown(heading);

  if (!isConversationalTitle(stripped)) {
    return stripped;
  }

  // Try to extract the first markdown heading from content
  const headingRegex = /^#{1,6}\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(content)) !== null) {
    const candidate = stripInlineMarkdown(match[1].trim());
    if (!isConversationalTitle(candidate)) {
      return candidate;
    }
  }

  // Fallback: humanized artifact type
  return artifactType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
