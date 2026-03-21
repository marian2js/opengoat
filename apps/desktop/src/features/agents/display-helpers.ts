/**
 * Returns a properly pluralized agent count string.
 */
export function formatAgentCount(count: number): string {
  return `${String(count)} ${count === 1 ? "agent" : "agents"} available`;
}

/**
 * Auth-action phrases → clean provider display names.
 */
const PROVIDER_NAME_MAP: Record<string, string> = {
  "Sign in with GitHub": "GitHub Copilot",
  "Use API key": "API Key",
};

/**
 * Cleans up provider names that read like auth actions
 * (e.g. "Sign in with GitHub") into proper display labels.
 */
export function cleanProviderName(name: string): string {
  return PROVIDER_NAME_MAP[name] ?? name;
}
