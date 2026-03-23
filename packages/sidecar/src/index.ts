import { serve } from "@hono/node-server";
import {
  AgentManifestService,
  ArtifactService,
  BoardService,
  BUILTIN_PLAYBOOKS,
  NodeCommandRunner,
  NodeFileSystem,
  NodeOpenGoatPathsProvider,
  NodePathPort,
  ObjectiveService,
  PlaybookRegistryService,
  RunService,
  SkillService,
} from "@opengoat/core";
import packageJson from "../package.json" with { type: "json" };
import { RuntimeProviderAuthService } from "./auth/service.ts";
import { RuntimeAuthSessionManager } from "./auth/sessions.ts";
import { syncAuthProfilesToAllAgents } from "./auth/sync.ts";
import { loadSidecarConfig, type SidecarConfig } from "./config.ts";
import { EmbeddedGatewayClient } from "./internal-gateway/gateway-client.ts";
import { AgentMetadataStoreService } from "./internal-gateway/metadata-store.ts";
import { EmbeddedGatewaySupervisor } from "./internal-gateway/supervisor.ts";

import { sidecarLogger } from "./logger.ts";
import { createSidecarApp } from "./server/app.ts";

export interface SidecarServerHandle {
  close(): Promise<void>;
}

export { RuntimeProviderAuthService } from "./auth/service.ts";
export { RuntimeAuthSessionManager } from "./auth/sessions.ts";
export {
  ensureEmbeddedGatewayDirectories,
  resolveEmbeddedGatewayPaths,
  type EmbeddedGatewayPaths,
} from "./internal-gateway/paths.ts";
export { EmbeddedGatewaySupervisor } from "./internal-gateway/supervisor.ts";
export { AgentMetadataStoreService } from "./internal-gateway/metadata-store.ts";
export { EmbeddedGatewayClient } from "./internal-gateway/gateway-client.ts";
export { syncAuthProfilesToAgent } from "./auth/sync.ts";

export async function startSidecarServer(
  config: SidecarConfig = loadSidecarConfig(),
): Promise<SidecarServerHandle> {
  const gatewaySupervisor = new EmbeddedGatewaySupervisor(process.env);
  await gatewaySupervisor.start();
  process.env.OPENCLAW_CONFIG_PATH = gatewaySupervisor.paths.configPath;
  process.env.OPENCLAW_OAUTH_DIR = gatewaySupervisor.paths.oauthDir;
  process.env.OPENCLAW_STATE_DIR = gatewaySupervisor.paths.stateDir;
  const metadataStore = new AgentMetadataStoreService(gatewaySupervisor.paths);
  const authService = new RuntimeProviderAuthService(gatewaySupervisor.paths, process.env);
  const embeddedGateway = new EmbeddedGatewayClient({
    authService,
    metadataStore,
    paths: gatewaySupervisor.paths,
    target: gatewaySupervisor.connection,
  });
  const opengoatPaths = new NodeOpenGoatPathsProvider().getPaths();
  const fileSystem = new NodeFileSystem();
  const pathPort = new NodePathPort();
  const skillService = new SkillService({
    fileSystem,
    pathPort,
    commandRunner: new NodeCommandRunner(),
  });
  const agentManifestService = new AgentManifestService({ fileSystem, pathPort });
  const boardService = new BoardService({
    fileSystem,
    pathPort,
    nowIso: () => new Date().toISOString(),
    agentManifestService,
  });

  const objectiveService = new ObjectiveService({
    fileSystem,
    pathPort,
    nowIso: () => new Date().toISOString(),
  });

  const runService = new RunService({
    fileSystem,
    pathPort,
    nowIso: () => new Date().toISOString(),
  });

  const artifactService = new ArtifactService({
    fileSystem,
    pathPort,
    nowIso: () => new Date().toISOString(),
  });

  const playbookRegistryService = new PlaybookRegistryService([...BUILTIN_PLAYBOOKS]);

  const runtime = {
    artifactService,
    authService,
    authSessions: new RuntimeAuthSessionManager(() => authService, {
      onAuthComplete: () => {
        void syncAuthProfilesToAllAgents(metadataStore, gatewaySupervisor.paths);
      },
    }),
    boardService,
    config,
    embeddedGateway,
    gatewaySupervisor,
    objectiveService,
    opengoatPaths,
    playbookRegistryService,
    runService,
    skillService,
    startedAt: Date.now(),
    version: packageJson.version,
  };
  const app = createSidecarApp(runtime);

  const server = serve(
    {
      fetch: app.fetch,
      hostname: config.hostname,
      port: config.port,
    },
    (info) => {
      sidecarLogger.info(
        `listening on http://${info.address}:${String(info.port)} as ${config.username}`,
      );
    },
  );

  return {
    async close() {
      server.close();
      await gatewaySupervisor.stop();
    },
  };
}

