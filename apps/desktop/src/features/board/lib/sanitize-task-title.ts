import { stripMarkdown } from "../../dashboard/lib/strip-markdown";
import { normalizeQuotes } from "../../dashboard/lib/normalize-quotes";

/**
 * Conversational prefixes that AI agents commonly start sentences with.
 * Matched case-insensitively at the start of the title.
 */
const CONVERSATIONAL_PREFIX =
  /^(I'm |I'll |I will |I am |I have |I've |I don't |I can't |I still |I checked |Got it,?\s*|Let me |Here is |Here's |Here are |Sure,?\s*|OK,?\s*|Okay,?\s*|Alright,?\s*|Well,?\s*|So,?\s*|Hmm,?\s*)/i;

/**
 * Second-pass prefix for nested conversational fragments
 * e.g. after stripping "Sure," we might still have "let me" or "I'll".
 */
const NESTED_PREFIX =
  /^(I'm |I'll |I will |I am |I have |I've |I can |I don't |I can't |Let me |let me |Here is |Here's |Here are |here is |here's |here are )/i;

/**
 * Sanitizes a board task title by stripping AI conversational preamble,
 * removing markdown syntax, and truncating to a readable length.
 *
 * Returns a clean, action-oriented title suitable for display in the board.
 */
export function sanitizeTaskTitle(title: string): string {
  if (!title || !title.trim()) return "";

  // Strip markdown first, then normalize smart quotes for regex matching
  let clean = normalizeQuotes(stripMarkdown(title));

  // Strip outer conversational prefix
  clean = clean.replace(CONVERSATIONAL_PREFIX, "");

  // Strip nested conversational prefix (e.g. "Sure, let me..." → "...")
  clean = clean.replace(NESTED_PREFIX, "");

  // Remove leading articles after stripping ("a ", "the ", "an ")
  // Only after conversational prefix was stripped, to make titles more concise
  if (clean !== normalizeQuotes(stripMarkdown(title))) {
    clean = clean.replace(/^(a |an |the )/i, "");
  }

  // Capitalize first letter
  if (clean.length > 0) {
    clean = clean.charAt(0).toUpperCase() + clean.slice(1);
  }

  // Truncate at sentence boundary if too long
  if (clean.length > 80) {
    const sentenceEnd = clean.search(/[.!?]\s/);
    if (sentenceEnd >= 20 && sentenceEnd < 80) {
      clean = clean.slice(0, sentenceEnd + 1);
    } else {
      clean = `${clean.slice(0, 80)}...`;
    }
  }

  return clean.trim();
}
