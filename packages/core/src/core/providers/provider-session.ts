import type { ProviderExecutionResult } from "./types.js";

const SESSION_ID_PATTERNS: RegExp[] = [
  /"sessionID"\s*:\s*"([^"\s]+)"/i,
  /"sessionId"\s*:\s*"([^"\s]+)"/i,
  /"chatId"\s*:\s*"([^"\s]+)"/i,
  /\bsession(?:\s+id)?\s*[:=]\s*([a-z0-9][a-z0-9._-]{5,})\b/i,
  /\bchat(?:\s+id)?\s*[:=]\s*([a-z0-9][a-z0-9._-]{5,})\b/i
];

const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;

export function attachProviderSessionId(
  result: ProviderExecutionResult,
  fallbackProviderSessionId?: string
): ProviderExecutionResult {
  const explicit = fallbackProviderSessionId?.trim();
  if (explicit) {
    return {
      ...result,
      providerSessionId: explicit
    };
  }

  const discovered = extractProviderSessionId([result.stdout, result.stderr].join("\n"));
  if (!discovered) {
    return result;
  }

  return {
    ...result,
    providerSessionId: discovered
  };
}

export function extractProviderSessionId(raw: string): string | undefined {
  const input = raw.trim();
  if (!input) {
    return undefined;
  }

  for (const pattern of SESSION_ID_PATTERNS) {
    const match = pattern.exec(input);
    const candidate = match?.[1]?.trim();
    if (candidate) {
      return candidate;
    }
  }

  const uuid = UUID_PATTERN.exec(input)?.[0]?.trim();
  if (uuid) {
    return uuid;
  }

  return undefined;
}
