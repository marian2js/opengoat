import type { ArtifactService, BoardService, MemoryService, ObjectiveService, OpenGoatPaths, PlaybookRegistryService, RunService, SignalService, SkillService } from "@opengoat/core";
import type { SidecarConfig } from "../config.ts";
import type { RuntimeProviderAuthService } from "../auth/service.ts";
import type { RuntimeAuthSessionManager } from "../auth/sessions.ts";
import type { EmbeddedGatewayClient } from "../internal-gateway/gateway-client.ts";
import type { EmbeddedGatewaySupervisor } from "../internal-gateway/supervisor.ts";

export interface SidecarRuntime {
  artifactService: ArtifactService;
  authSessions: RuntimeAuthSessionManager;
  authService: RuntimeProviderAuthService;
  boardService: BoardService;
  config: SidecarConfig;
  embeddedGateway: EmbeddedGatewayClient;
  memoryService: MemoryService;
  objectiveService: ObjectiveService;
  gatewaySupervisor: EmbeddedGatewaySupervisor;
  opengoatPaths: OpenGoatPaths;
  playbookRegistryService: PlaybookRegistryService;
  runService: RunService;
  signalService: SignalService;
  skillService: SkillService;
  startedAt: number;
  version: string;
}
