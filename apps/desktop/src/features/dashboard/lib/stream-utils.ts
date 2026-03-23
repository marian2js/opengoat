/**
 * Reads the UI Message Stream (SSE) response and collects the full text.
 *
 * The sidecar streams using SSE format:
 *   `data: {"type":"start","messageId":"..."}\n`
 *   `data: {"type":"text-delta","delta":"chunk","id":"..."}\n`
 *   `data: {"type":"text-end","id":"..."}\n`
 *   `data: {"type":"finish","finishReason":"stop"}\n`
 *
 * We extract `delta` values from `text-delta` events and concatenate them.
 */
export async function collectStreamText(response: Response): Promise<string> {
  const body = response.body;
  if (!body) return "";

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);

        // SSE data lines: `data: {...}`
        if (line.startsWith("data: ")) {
          try {
            const payload = JSON.parse(line.slice(6)) as Record<string, unknown>;
            if (payload.type === "text-delta" && typeof payload.delta === "string") {
              result += payload.delta;
            }
          } catch {
            // Malformed SSE event — skip
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return result;
}
