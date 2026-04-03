/**
 * Strips common markdown syntax from text, returning clean plain text
 * suitable for preview display in cards.
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/^\s*[-*+]\s+/gm, "")           // unordered list markers (before headings)
    .replace(/^\s*\d+\.\s+/gm, "")           // ordered list markers (before headings)
    .replace(/#{1,6}\s+/g, "")               // headings
    .replace(/\*\*(.+?)\*\*/g, "$1")         // bold
    .replace(/\*(.+?)\*/g, "$1")             // italic
    .replace(/__(.+?)__/g, "$1")             // bold alt
    .replace(/_(.+?)_/g, "$1")               // italic alt
    .replace(/~~(.+?)~~/g, "$1")             // strikethrough
    .replace(/`(.+?)`/g, "$1")               // inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
    .replace(/\n+/g, " ")                    // collapse newlines
    .replace(/\s+/g, " ")                    // collapse whitespace
    .trim();
}
