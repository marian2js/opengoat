/**
 * Returns a properly pluralized agent count string.
 */
export function formatAgentCount(count: number): string {
  return `${String(count)} ${count === 1 ? "agent" : "agents"} available`;
}

/**
 * Returns a properly pluralized task count string.
 */
export function formatTaskCount(count: number): string {
  return `${count} ${count === 1 ? "task" : "tasks"}`;
}

/**
 * Auth-action phrases and slug-style IDs → clean provider display names.
 */
const PROVIDER_NAME_MAP: Record<string, string> = {
  "Sign in with GitHub": "GitHub Copilot",
  "Use API key": "API Key",
  "github-copilot": "GitHub Copilot",
  "openai": "OpenAI",
  "anthropic": "Anthropic",
  "google": "Google",
};

/**
 * Convert a kebab-case slug to title case (e.g. "my-provider" → "My Provider").
 */
function formatProviderSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Cleans up provider names that read like auth actions
 * (e.g. "Sign in with GitHub") or raw slugs (e.g. "github-copilot")
 * into proper display labels.
 */
export function cleanProviderName(name: string): string {
  return PROVIDER_NAME_MAP[name] ?? (name.includes("-") ? formatProviderSlug(name) : name);
}
