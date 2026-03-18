export const DEFAULT_AGENT_ID = "goat";

export function normalizeAgentId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isDefaultAgentId(agentId: string): boolean {
  return normalizeAgentId(agentId) === DEFAULT_AGENT_ID;
}

/**
 * Derives a project ID from a URL by extracting the base domain name.
 *
 * Examples:
 *   "https://www.myapp.com"   → "myapp"
 *   "https://myapp.com"       → "myapp"
 *   "myapp.com"               → "myapp"
 *   "https://sub.myapp.co.uk" → "sub"
 *   "localhost:3000"           → "localhost"
 */
export function projectUrlToProjectId(url: string): string {
  let hostname: string;
  try {
    const withProtocol = url.includes("://") ? url : `https://${url}`;
    hostname = new URL(withProtocol).hostname;
  } catch {
    hostname = url.split("/")[0] ?? url;
  }

  // Strip www. prefix
  hostname = hostname.replace(/^www\./i, "");

  // Take the first label (base domain before the first dot)
  const baseName = hostname.split(".")[0] ?? hostname;

  const normalized = normalizeAgentId(baseName);
  return normalized || "project";
}

/**
 * Ensures a unique project ID by appending `-2`, `-3`, etc. if the base
 * ID already exists in the given set.
 */
export function deriveUniqueProjectId(
  baseId: string,
  existingIds: Set<string>,
): string {
  if (!existingIds.has(baseId)) {
    return baseId;
  }

  let counter = 2;
  while (existingIds.has(`${baseId}-${String(counter)}`)) {
    counter++;
  }

  return `${baseId}-${String(counter)}`;
}
