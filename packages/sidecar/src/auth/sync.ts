import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_AGENT_ID } from "@opengoat/core";
import type { EmbeddedGatewayPaths } from "../internal-gateway/paths.ts";
import { resolveGatewayAgentDir } from "../internal-gateway/paths.ts";
import type { AgentMetadataStoreService } from "../internal-gateway/metadata-store.ts";

const AUTH_PROFILES_FILE = "auth-profiles.json";

/**
 * Copy auth-profiles.json from the default agent dir to a specific agent.
 *
 * The auth service writes credentials to DEFAULT_AGENT_ID's agent dir, but
 * OpenClaw resolves auth per-agent. Call this after creating a new agent.
 */
export function syncAuthProfilesToAgent(paths: EmbeddedGatewayPaths, targetAgentId: string): void {
  const sourceDir = resolveGatewayAgentDir(paths, DEFAULT_AGENT_ID);
  const sourcePath = join(sourceDir, AUTH_PROFILES_FILE);

  if (!existsSync(sourcePath)) {
    return;
  }

  const targetDir = resolveGatewayAgentDir(paths, targetAgentId);
  mkdirSync(targetDir, { recursive: true });
  copyFileSync(sourcePath, join(targetDir, AUTH_PROFILES_FILE));
}

/**
 * Sync auth-profiles.json from the default agent dir to ALL registered agents.
 *
 * Call this after a provider is connected or updated so every agent has the
 * latest credentials.
 */
export async function syncAuthProfilesToAllAgents(
  metadataStore: AgentMetadataStoreService,
  paths: EmbeddedGatewayPaths,
): Promise<void> {
  const sourceDir = resolveGatewayAgentDir(paths, DEFAULT_AGENT_ID);
  const sourcePath = join(sourceDir, AUTH_PROFILES_FILE);

  if (!existsSync(sourcePath)) {
    return;
  }

  const catalog = await metadataStore.listCatalog();
  for (const agent of catalog.agents) {
    if (agent.id === DEFAULT_AGENT_ID) {
      continue;
    }
    const targetDir = resolveGatewayAgentDir(paths, agent.id);
    mkdirSync(targetDir, { recursive: true });
    copyFileSync(sourcePath, join(targetDir, AUTH_PROFILES_FILE));
  }
}
