const DEFAULT_AGENT_ID = "goat";

export function readOptionalString(
  params: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = params[key];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function readRequiredString(
  params: Record<string, unknown>,
  key: string,
): string {
  const value = readOptionalString(params, key);
  if (!value) {
    throw new Error(`Missing required parameter: ${key}`);
  }
  return value;
}

export function readOptionalBoolean(
  params: Record<string, unknown>,
  key: string,
): boolean | undefined {
  const value = params[key];
  return typeof value === "boolean" ? value : undefined;
}

export function readOptionalNumber(
  params: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = params[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

export function readOptionalStringArray(
  params: Record<string, unknown>,
  key: string,
): string[] | undefined {
  const value = params[key];
  if (!Array.isArray(value)) {
    return undefined;
  }

  const cleaned = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);

  return cleaned.length > 0 ? cleaned : undefined;
}

export function resolveAgentId(
  value: string | undefined,
  fallbackAgentId: string | undefined,
): string {
  const normalized = normalizeAgentId(value ?? "");
  if (normalized) {
    return normalized;
  }

  const normalizedFallback = normalizeAgentId(fallbackAgentId ?? "");
  if (normalizedFallback) {
    return normalizedFallback;
  }

  return DEFAULT_AGENT_ID;
}

export function normalizeNullableManagerId(value: string | undefined): string | null {
  const raw = value?.trim().toLowerCase();
  if (!raw || raw === "none" || raw === "null") {
    return null;
  }

  const normalized = normalizeAgentId(raw);
  if (!normalized) {
    throw new Error("managerId must be a valid agent id or 'none'.");
  }

  return normalized;
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function normalizeAgentId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
