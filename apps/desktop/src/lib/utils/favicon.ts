/**
 * Shared favicon utilities for resolving project domain and favicon sources.
 */

/**
 * Derive a display domain from an agent's description (project URL) or ID.
 * Returns the hostname without `www.` prefix.
 */
export function resolveDomain(agent: {
  id: string;
  name: string;
  description?: string | undefined;
}): string {
  const rawUrl = agent.description?.trim();
  if (rawUrl) {
    try {
      const url = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
      return url.hostname.replace(/^www\./, "");
    } catch {
      return rawUrl;
    }
  }

  // Fallback: derive domain from agent ID (e.g. "bullaware-main" → "bullaware.com")
  const projectId = agent.id.replace(/-main$/, "");
  if (projectId && projectId !== agent.id) {
    return `${projectId}.com`;
  }

  return agent.name;
}

/**
 * Build an ordered list of favicon URLs to try for a given domain.
 * Each source is attempted in order; the component falls back on error.
 */
export function buildFaviconSources(domain: string): string[] {
  const encoded = encodeURIComponent(domain);
  return [
    `https://${domain}/favicon.ico`,
    `https://www.google.com/s2/favicons?domain=${encoded}&sz=32`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
  ];
}
