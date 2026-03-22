import type { BoardService, OpenGoatPaths, SkillService } from "@opengoat/core";
import type { SidecarConfig } from "../config.ts";
import type { RuntimeProviderAuthService } from "../auth/service.ts";
import type { RuntimeAuthSessionManager } from "../auth/sessions.ts";
import type { EmbeddedGatewayClient } from "../internal-gateway/gateway-client.ts";
import type { EmbeddedGatewaySupervisor } from "../internal-gateway/supervisor.ts";

export interface SidecarRuntime {
  authSessions: RuntimeAuthSessionManager;
  authService: RuntimeProviderAuthService;
  boardService: BoardService;
  config: SidecarConfig;
  embeddedGateway: EmbeddedGatewayClient;
  gatewaySupervisor: EmbeddedGatewaySupervisor;
  opengoatPaths: OpenGoatPaths;
  skillService: SkillService;
  startedAt: number;
  version: string;
}
