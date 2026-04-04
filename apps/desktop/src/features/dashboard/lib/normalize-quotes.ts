/**
 * Replaces Unicode smart/curly quotes with ASCII equivalents
 * so regex patterns using ' and " match consistently.
 */
export function normalizeQuotes(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201A]/g, "'") // ' ' ‚ → '
    .replace(/[\u201C\u201D\u201E]/g, '"'); // " " „ → "
}
