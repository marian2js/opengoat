/**
 * Extracts a session UUID from a contentRef string.
 *
 * Supported formats:
 * - `chat://SESSION_ID/INDEX`         → SESSION_ID
 * - `chat://SESSION_ID`               → SESSION_ID
 * - `session:SESSION_ID/message:MSG`  → SESSION_ID
 * - `session:SESSION_ID`              → SESSION_ID
 */
export function extractSessionId(contentRef: string): string | null {
  if (!contentRef) return null;

  // chat://SESSION_ID/INDEX or chat://SESSION_ID
  const chatMatch = contentRef.match(/^chat:\/\/([^/]+)/);
  if (chatMatch) return chatMatch[1]!;

  // session:SESSION_ID/message:MSG or session:SESSION_ID
  const sessionMatch = contentRef.match(/^session:([^/]+)/);
  if (sessionMatch) return sessionMatch[1]!;

  return null;
}
