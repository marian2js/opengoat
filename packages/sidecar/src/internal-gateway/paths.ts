import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { resolveOpengoatConfigDir } from "@opengoat/core";

export interface EmbeddedGatewayPaths {
  configDir: string;
  configPath: string;
  deviceIdentityPath: string;
  logsDir: string;
  metadataPath: string;
  oauthDir: string;
  rootDir: string;
  stateDir: string;
  tokenPath: string;
  workspacesDir: string;
}

export function resolveEmbeddedGatewayPaths(
  env: NodeJS.ProcessEnv = process.env,
): EmbeddedGatewayPaths {
  const configDir = resolveOpengoatConfigDir(env);
  const rootDir = join(configDir, "runtime", "agents");
  const stateDir = join(rootDir, "state");

  return {
    configDir,
    configPath: join(rootDir, "openclaw.json"),
    deviceIdentityPath: join(rootDir, "identity", "device.json"),
    logsDir: join(rootDir, "logs"),
    metadataPath: join(rootDir, "agent-metadata.json"),
    oauthDir: join(rootDir, "oauth"),
    rootDir,
    stateDir,
    tokenPath: join(rootDir, "gateway-token"),
    workspacesDir: join(rootDir, "workspaces"),
  };
}

export async function ensureEmbeddedGatewayDirectories(
  paths: EmbeddedGatewayPaths,
): Promise<void> {
  await Promise.all([
    mkdir(paths.configDir, { recursive: true, mode: 0o700 }),
    mkdir(paths.rootDir, { recursive: true, mode: 0o700 }),
    mkdir(paths.logsDir, { recursive: true, mode: 0o700 }),
    mkdir(paths.oauthDir, { recursive: true, mode: 0o700 }),
    mkdir(paths.stateDir, { recursive: true, mode: 0o700 }),
    mkdir(paths.workspacesDir, { recursive: true, mode: 0o700 }),
  ]);
}

export function resolveGatewayAgentDir(paths: EmbeddedGatewayPaths, agentId: string): string {
  return join(paths.stateDir, "agents", agentId, "agent");
}

export function resolveGatewaySessionsDir(paths: EmbeddedGatewayPaths, agentId: string): string {
  return join(paths.stateDir, "agents", agentId, "sessions");
}

export function resolveGatewaySessionFile(
  paths: EmbeddedGatewayPaths,
  agentId: string,
  sessionId: string,
): string {
  return join(resolveGatewaySessionsDir(paths, agentId), `${sessionId}.jsonl`);
}
