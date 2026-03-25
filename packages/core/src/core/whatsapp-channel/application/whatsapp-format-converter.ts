const DEFAULT_MAX_CHUNK_LENGTH = 2000;
const MAX_CHUNKS = 3;

/**
 * Split a long message into WhatsApp-friendly chunks.
 * Splits at paragraph boundaries first, then sentence boundaries.
 * Adds numbered markers (1/N) when multiple chunks are produced.
 * For very long outputs (>3 chunks), caps and suggests desktop.
 */
export function chunkMessage(
  text: string,
  maxLen: number = DEFAULT_MAX_CHUNK_LENGTH,
): string[] {
  if (!text || text.length <= maxLen) {
    return [text];
  }

  // Try paragraph splits first
  let chunks = splitAtBoundaries(text, maxLen, "\n\n");
  if (chunks.length === 1 && chunks[0]!.length > maxLen) {
    // Fall back to sentence splits
    chunks = splitAtBoundaries(text, maxLen, ". ");
  }
  if (chunks.length === 1 && chunks[0]!.length > maxLen) {
    // Hard split as last resort
    chunks = hardSplit(text, maxLen);
  }

  // Cap at MAX_CHUNKS + 1 (last being a desktop pointer)
  if (chunks.length > MAX_CHUNKS) {
    const kept = chunks.slice(0, MAX_CHUNKS);
    kept.push(
      "… Output truncated. View the full response in OpenGoat desktop.",
    );
    chunks = kept;
  }

  // Add numbered markers
  if (chunks.length > 1) {
    const total = chunks.length;
    chunks = chunks.map((chunk, i) => `(${i + 1}/${total}) ${chunk}`);
  }

  return chunks;
}

function splitAtBoundaries(
  text: string,
  maxLen: number,
  separator: string,
): string[] {
  const parts = text.split(separator);
  const chunks: string[] = [];
  let current = "";

  for (const part of parts) {
    const candidate = current
      ? `${current}${separator}${part}`
      : part;

    if (candidate.length > maxLen && current) {
      chunks.push(current);
      current = part;
    } else {
      current = candidate;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.length > 0 ? chunks : [text];
}

function hardSplit(text: string, maxLen: number): string[] {
  const chunks: string[] = [];
  let offset = 0;
  while (offset < text.length) {
    chunks.push(text.slice(offset, offset + maxLen));
    offset += maxLen;
  }
  return chunks;
}

/**
 * Light formatting cleanup for WhatsApp.
 * Strips unsupported Markdown (headers, links) while keeping bold/italic.
 */
export function formatForWhatsApp(text: string): string {
  let result = text;

  // Strip Markdown headers (## Heading → Heading)
  result = result.replace(/^#{1,6}\s+/gm, "");

  // Convert Markdown links [text](url) → text (url)
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");

  // Convert **bold** to *bold* (WhatsApp uses single * for bold)
  result = result.replace(/\*\*(.+?)\*\*/g, "*$1*");

  return result;
}

/**
 * Returns a placeholder text for media messages.
 */
export function createMediaPlaceholder(mediaType: string): string {
  return `[${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} media message — open WhatsApp to view]`;
}
