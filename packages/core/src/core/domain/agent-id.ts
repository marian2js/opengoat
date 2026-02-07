export const DEFAULT_AGENT_ID = "orchestrator";

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
