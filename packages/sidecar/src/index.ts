import { serve } from "@hono/node-server";
import packageJson from "../package.json" with { type: "json" };
import { RuntimeProviderAuthService } from "./auth/service.ts";
import { RuntimeAuthSessionManager } from "./auth/sessions.ts";
import { loadSidecarConfig, type SidecarConfig } from "./config.ts";
import { EmbeddedGatewayClient } from "./internal-gateway/gateway-client.ts";
import { AgentMetadataStoreService } from "./internal-gateway/metadata-store.ts";
import { EmbeddedGatewaySupervisor } from "./internal-gateway/supervisor.ts";

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
  const runtime = {
    authService,
    authSessions: new RuntimeAuthSessionManager(() => authService),
    config,
    embeddedGateway,
    gatewaySupervisor,
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
      const port = String(info.port);
      console.error(
        `[sidecar] listening on http://${info.address}:${port} as ${config.username}`,
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
