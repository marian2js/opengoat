const LAST_VISITED_PREFIX = "opengoat:last-visited:";

export function getLastVisited(agentId: string): string | null {
  try {
    return localStorage.getItem(`${LAST_VISITED_PREFIX}${agentId}`);
  } catch {
    return null;
  }
}

export function setLastVisited(agentId: string): void {
  try {
    localStorage.setItem(
      `${LAST_VISITED_PREFIX}${agentId}`,
      new Date().toISOString(),
    );
  } catch {
    // Silently ignore localStorage errors
  }
}
