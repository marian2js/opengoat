import type { ArtifactService, BoardService, MemoryService, MessagingConnectionService, MessagingRouterService, ObjectiveService, OpenGoatPaths, PlaybookRegistryService, RunService, SignalService, SkillService, TelegramChannelService, WhatsAppChannelService } from "@opengoat/core";
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
  messagingConnectionService: MessagingConnectionService;
  messagingRouterService: MessagingRouterService;
  objectiveService: ObjectiveService;
  gatewaySupervisor: EmbeddedGatewaySupervisor;
  opengoatPaths: OpenGoatPaths;
  playbookRegistryService: PlaybookRegistryService;
  runService: RunService;
  signalService: SignalService;
  skillService: SkillService;
  telegramChannelService: TelegramChannelService;
  whatsappChannelService: WhatsAppChannelService;
  startedAt: number;
  version: string;
}
