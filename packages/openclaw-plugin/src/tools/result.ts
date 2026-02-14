import type { OpenClawToolResultLike } from "../openclaw-types.js";

export function jsonResult(payload: unknown): OpenClawToolResultLike {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
    details: payload,
  };
}

export function successResult(payload: Record<string, unknown> = {}): OpenClawToolResultLike {
  return jsonResult({ ok: true, ...payload });
}

export function errorResult(error: unknown): OpenClawToolResultLike {
  return jsonResult({
    ok: false,
    error: formatError(error),
  });
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
