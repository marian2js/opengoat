const TELEGRAM_MAX_LENGTH = 4000;
const DESKTOP_REDIRECT_MESSAGE =
  "… View the full version in OpenGoat desktop.";

/**
 * Format LLM output for Telegram.
 * - Truncates excessively long responses with desktop redirect
 * - Strips unsupported Markdown (tables, HTML tags)
 * - Ensures Telegram-compatible formatting
 */
export function formatForTelegram(text: string): string {
  let result = text;

  // Strip HTML tags (Telegram Markdown mode doesn't support them)
  result = result.replace(/<[^>]+>/g, "");

  // Strip Markdown tables (Telegram doesn't render them)
  result = result.replace(
    /\|[^\n]+\|\n\|[-:\s|]+\|(\n\|[^\n]+\|)*/g,
    "(table — view in desktop app)",
  );

  // Truncate if too long
  if (result.length > TELEGRAM_MAX_LENGTH) {
    result =
      result.slice(0, TELEGRAM_MAX_LENGTH - DESKTOP_REDIRECT_MESSAGE.length - 2) +
      "\n\n" +
      DESKTOP_REDIRECT_MESSAGE;
  }

  return result;
}
