import type {
  AgentManagerUpdateResult,
  AgentCreationResult,
  AgentDeletionResult,
  AgentDescriptor,
  CreateAgentOptions,
  DeleteAgentOptions
} from "../../domain/agent.js";
import { DEFAULT_AGENT_ID, normalizeAgentId } from "../../domain/agent-id.js";
import type { InitializationResult } from "../../domain/opengoat-paths.js";
import { createNoopLogger, type Logger } from "../../logging/index.js";
import type { FileSystemPort } from "../../ports/file-system.port.js";
import type { CommandRunResult, CommandRunnerPort } from "../../ports/command-runner.port.js";
import type { PathPort } from "../../ports/path.port.js";
import type { OpenGoatPathsProvider } from "../../ports/paths-provider.port.js";
import type {
  AgentProviderBinding,
  OpenClawGatewayConfig,
  ProviderAuthOptions,
  ProviderExecutionResult,
  ProviderOnboardingSpec,
  ProviderRegistry,
  ProviderStoredConfig,
  ProviderSummary
} from "../../providers/index.js";
import { createDefaultProviderRegistry } from "../../providers/index.js";
import { AgentManifestService } from "../../agents/application/agent-manifest.service.js";
import { AgentService } from "../../agents/application/agent.service.js";
import { BootstrapService } from "../../bootstrap/application/bootstrap.service.js";
import {
  BoardService,
  type BoardRecord,
  type BoardSummary,
  type CreateBoardOptions,
  type CreateTaskOptions,
  type TaskRecord,
  type UpdateBoardOptions
} from "../../boards/index.js";
import {
  OrchestrationService,
  type OrchestrationRunOptions,
  type OrchestrationRunResult,
  type RoutingDecision
} from "../../orchestration/index.js";
import { ProviderService } from "../../providers/application/provider.service.js";
import { SkillService, type InstallSkillRequest, type InstallSkillResult, type ResolvedSkill } from "../../skills/index.js";
import {
  SessionService,
  type AgentLastAction,
  type SessionCompactionResult,
  type SessionHistoryResult,
  type SessionRemoveResult,
  type SessionRunInfo,
  type SessionSummary
} from "../../sessions/index.js";

interface OpenGoatServiceDeps {
  fileSystem: FileSystemPort;
  pathPort: PathPort;
  pathsProvider: OpenGoatPathsProvider;
  nowIso?: () => string;
  providerRegistry?: ProviderRegistry;
  commandRunner?: CommandRunnerPort;
  logger?: Logger;
}

const OPENCLAW_PROVIDER_ID = "openclaw";

export interface RuntimeDefaultsSyncResult {
  goatSyncCode?: number;
  goatSynced: boolean;
  warnings: string[];
}

export class OpenGoatService {
  private readonly pathsProvider: OpenGoatPathsProvider;
  private readonly agentService: AgentService;
  private readonly agentManifestService: AgentManifestService;
  private readonly bootstrapService: BootstrapService;
  private readonly providerService: ProviderService;
  private readonly skillService: SkillService;
  private readonly sessionService: SessionService;
  private readonly orchestrationService: OrchestrationService;
  private readonly boardService: BoardService;
  private readonly commandRunner?: CommandRunnerPort;

  public constructor(deps: OpenGoatServiceDeps) {
    const nowIso = deps.nowIso ?? (() => new Date().toISOString());
    const rootLogger = (deps.logger ?? createNoopLogger()).child({ scope: "opengoat-service" });
    const providerRegistryFactory = deps.providerRegistry
      ? () => deps.providerRegistry as ProviderRegistry
      : () => createDefaultProviderRegistry();

    this.pathsProvider = deps.pathsProvider;
    this.agentService = new AgentService({
      fileSystem: deps.fileSystem,
      pathPort: deps.pathPort,
      nowIso
    });
    this.agentManifestService = new AgentManifestService({
      fileSystem: deps.fileSystem,
      pathPort: deps.pathPort
    });
    this.bootstrapService = new BootstrapService({
      fileSystem: deps.fileSystem,
      pathsProvider: deps.pathsProvider,
      agentService: this.agentService,
      nowIso
    });
    this.skillService = new SkillService({
      fileSystem: deps.fileSystem,
      pathPort: deps.pathPort
    });
    this.providerService = new ProviderService({
      fileSystem: deps.fileSystem,
      pathPort: deps.pathPort,
      providerRegistry: providerRegistryFactory,
      skillService: this.skillService,
      nowIso,
      logger: rootLogger.child({ scope: "provider" })
    });
    this.sessionService = new SessionService({
      fileSystem: deps.fileSystem,
      pathPort: deps.pathPort,
      commandRunner: deps.commandRunner,
      nowIso,
      nowMs: () => Date.now()
    });
    this.commandRunner = deps.commandRunner;
    this.orchestrationService = new OrchestrationService({
      providerService: this.providerService,
      agentManifestService: this.agentManifestService,
      sessionService: this.sessionService,
      fileSystem: deps.fileSystem,
      pathPort: deps.pathPort,
      nowIso,
      logger: rootLogger.child({ scope: "orchestration" })
    });
    this.boardService = new BoardService({
      fileSystem: deps.fileSystem,
      pathPort: deps.pathPort,
      nowIso,
      agentManifestService: this.agentManifestService
    });
  }

  public initialize(): Promise<InitializationResult> {
    return this.bootstrapService.initialize();
  }

  public async syncRuntimeDefaults(): Promise<RuntimeDefaultsSyncResult> {
    const paths = this.pathsProvider.getPaths();
    const warnings: string[] = [];
    let goatSynced = false;
    let goatSyncCode: number | undefined;

    let goatDescriptor = (await this.agentService.listAgents(paths)).find((agent) => agent.id === DEFAULT_AGENT_ID);
    if (!goatDescriptor) {
      const created = await this.agentService.ensureAgent(
        paths,
        {
          id: DEFAULT_AGENT_ID,
          displayName: "Goat"
        },
        {
          type: "manager",
          reportsTo: null,
          skills: ["manager"],
          role: "Head of Organization"
        }
      );
      goatDescriptor = created.agent;
    }

    try {
      const goatSync = await this.providerService.createProviderAgent(paths, DEFAULT_AGENT_ID, {
        providerId: OPENCLAW_PROVIDER_ID,
        displayName: goatDescriptor.displayName,
        workspaceDir: goatDescriptor.workspaceDir,
        internalConfigDir: goatDescriptor.internalConfigDir
      });
      goatSyncCode = goatSync.code;
      goatSynced = goatSync.code === 0 || containsAlreadyExistsMessage(goatSync.stdout, goatSync.stderr);
      if (!goatSynced) {
        warnings.push(
          `OpenClaw sync for "goat" failed (code ${goatSync.code}). ${(goatSync.stderr || goatSync.stdout).trim()}`
        );
      }
    } catch (error) {
      warnings.push(`OpenClaw sync for "goat" failed: ${toErrorMessage(error)}`);
    }

    return {
      goatSyncCode,
      goatSynced,
      warnings
    };
  }

  public async createAgent(rawName: string, options: CreateAgentOptions = {}): Promise<AgentCreationResult> {
    const identity = this.agentService.normalizeAgentName(rawName);
    const paths = this.pathsProvider.getPaths();
    const created = await this.agentService.ensureAgent(paths, identity, {
      type: options.type,
      reportsTo: options.reportsTo,
      skills: options.skills,
      role: options.role
    });

    const runtimeSync = await this.providerService.createProviderAgent(paths, created.agent.id, {
      providerId: OPENCLAW_PROVIDER_ID,
      displayName: created.agent.displayName,
      workspaceDir: created.agent.workspaceDir,
      internalConfigDir: created.agent.internalConfigDir
    });

    if (runtimeSync.code !== 0 && !containsAlreadyExistsMessage(runtimeSync.stdout, runtimeSync.stderr)) {
      if (!created.alreadyExisted) {
        await this.agentService.removeAgent(paths, created.agent.id);
      }
      throw new Error(
        `OpenClaw agent creation failed for "${created.agent.id}" (exit ${runtimeSync.code}). ${
          runtimeSync.stderr.trim() || runtimeSync.stdout.trim() || ""
        }`.trim()
      );
    }

    return {
      ...created,
      runtimeSync: {
        runtimeId: runtimeSync.providerId,
        code: runtimeSync.code,
        stdout: runtimeSync.stdout,
        stderr: runtimeSync.stderr
      }
    };
  }

  public async deleteAgent(rawAgentId: string, options: DeleteAgentOptions = {}): Promise<AgentDeletionResult> {
    const paths = this.pathsProvider.getPaths();
    const agentId = normalizeAgentId(rawAgentId);
    if (!agentId) {
      throw new Error("Agent id cannot be empty.");
    }

    const existing = (await this.agentService.listAgents(paths)).find((entry) => entry.id === agentId);
    if (!existing) {
      return this.agentService.removeAgent(paths, agentId);
    }

    const runtimeSync = await this.providerService.deleteProviderAgent(paths, agentId, {
      providerId: OPENCLAW_PROVIDER_ID
    });
    if (runtimeSync.code !== 0 && !options.force) {
      throw new Error(
        `OpenClaw agent deletion failed for "${agentId}" (exit ${runtimeSync.code}). ${
          runtimeSync.stderr.trim() || runtimeSync.stdout.trim() || ""
        }`.trim()
      );
    }

    const removed = await this.agentService.removeAgent(paths, agentId);
    return {
      ...removed,
      runtimeSync: {
        runtimeId: runtimeSync.providerId,
        code: runtimeSync.code,
        stdout: runtimeSync.stdout,
        stderr: runtimeSync.stderr
      }
    };
  }

  public async setAgentManager(rawAgentId: string, rawReportsTo: string | null): Promise<AgentManagerUpdateResult> {
    const paths = this.pathsProvider.getPaths();
    return this.agentService.setAgentManager(paths, rawAgentId, rawReportsTo);
  }

  public async listAgents(): Promise<AgentDescriptor[]> {
    const paths = this.pathsProvider.getPaths();
    return this.agentService.listAgents(paths);
  }

  public listProviders(): Promise<ProviderSummary[]> {
    return this.providerService.listProviders();
  }

  public getProviderOnboarding(providerId: string): Promise<ProviderOnboardingSpec | undefined> {
    return this.providerService.getProviderOnboarding(providerId);
  }

  public async getProviderConfig(providerId: string): Promise<ProviderStoredConfig | null> {
    const paths = this.pathsProvider.getPaths();
    return this.providerService.getProviderConfig(paths, providerId);
  }

  public async setProviderConfig(providerId: string, env: Record<string, string>): Promise<ProviderStoredConfig> {
    const paths = this.pathsProvider.getPaths();
    return this.providerService.setProviderConfig(paths, providerId, env);
  }

  public async authenticateProvider(
    providerId: string,
    options: ProviderAuthOptions = {}
  ): Promise<ProviderExecutionResult> {
    const paths = this.pathsProvider.getPaths();
    return this.providerService.invokeProviderAuth(paths, providerId, options);
  }

  public async getAgentProvider(agentId: string): Promise<AgentProviderBinding> {
    const paths = this.pathsProvider.getPaths();
    return this.providerService.getAgentProvider(paths, agentId);
  }

  public async setAgentProvider(agentId: string, providerId: string): Promise<AgentProviderBinding> {
    const paths = this.pathsProvider.getPaths();
    return this.providerService.setAgentProvider(paths, agentId, providerId);
  }

  public async getOpenClawGatewayConfig(): Promise<OpenClawGatewayConfig> {
    const paths = this.pathsProvider.getPaths();
    return this.providerService.getOpenClawGatewayConfig(paths);
  }

  public async setOpenClawGatewayConfig(config: OpenClawGatewayConfig): Promise<OpenClawGatewayConfig> {
    const paths = this.pathsProvider.getPaths();
    return this.providerService.setOpenClawGatewayConfig(paths, config);
  }

  public async routeMessage(agentId: string, message: string): Promise<RoutingDecision> {
    const paths = this.pathsProvider.getPaths();
    return this.orchestrationService.routeMessage(paths, agentId, message);
  }

  public async runAgent(
    agentId: string,
    options: OrchestrationRunOptions
  ): Promise<OrchestrationRunResult> {
    const paths = this.pathsProvider.getPaths();
    return this.orchestrationService.runAgent(paths, agentId, options);
  }

  public async createBoard(actorId: string, options: CreateBoardOptions): Promise<BoardSummary> {
    const paths = this.pathsProvider.getPaths();
    return this.boardService.createBoard(paths, actorId, options);
  }

  public async listBoards(): Promise<BoardSummary[]> {
    const paths = this.pathsProvider.getPaths();
    return this.boardService.listBoards(paths);
  }

  public async getBoard(boardId: string): Promise<BoardRecord> {
    const paths = this.pathsProvider.getPaths();
    return this.boardService.getBoard(paths, boardId);
  }

  public async updateBoard(actorId: string, boardId: string, options: UpdateBoardOptions): Promise<BoardSummary> {
    const paths = this.pathsProvider.getPaths();
    return this.boardService.updateBoard(paths, actorId, boardId, options);
  }

  public async createTask(actorId: string, boardId: string, options: CreateTaskOptions): Promise<TaskRecord> {
    const paths = this.pathsProvider.getPaths();
    return this.boardService.createTask(paths, actorId, boardId, options);
  }

  public async listTasks(boardId: string): Promise<TaskRecord[]> {
    const paths = this.pathsProvider.getPaths();
    return this.boardService.listTasks(paths, boardId);
  }

  public async getTask(taskId: string): Promise<TaskRecord> {
    const paths = this.pathsProvider.getPaths();
    return this.boardService.getTask(paths, taskId);
  }

  public async updateTaskStatus(actorId: string, taskId: string, status: string): Promise<TaskRecord> {
    const paths = this.pathsProvider.getPaths();
    return this.boardService.updateTaskStatus(paths, actorId, taskId, status);
  }

  public async addTaskBlocker(actorId: string, taskId: string, blocker: string): Promise<TaskRecord> {
    const paths = this.pathsProvider.getPaths();
    return this.boardService.addTaskBlocker(paths, actorId, taskId, blocker);
  }

  public async addTaskArtifact(actorId: string, taskId: string, content: string): Promise<TaskRecord> {
    const paths = this.pathsProvider.getPaths();
    return this.boardService.addTaskArtifact(paths, actorId, taskId, content);
  }

  public async addTaskWorklog(actorId: string, taskId: string, content: string): Promise<TaskRecord> {
    const paths = this.pathsProvider.getPaths();
    return this.boardService.addTaskWorklog(paths, actorId, taskId, content);
  }

  public async listSkills(agentId = DEFAULT_AGENT_ID): Promise<ResolvedSkill[]> {
    const paths = this.pathsProvider.getPaths();
    return this.skillService.listSkills(paths, agentId);
  }

  public async listGlobalSkills(): Promise<ResolvedSkill[]> {
    const paths = this.pathsProvider.getPaths();
    return this.skillService.listGlobalSkills(paths);
  }

  public async installSkill(request: InstallSkillRequest): Promise<InstallSkillResult> {
    const paths = this.pathsProvider.getPaths();
    return this.skillService.installSkill(paths, request);
  }

  public async runOpenClaw(args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): Promise<CommandRunResult> {
    if (!this.commandRunner) {
      throw new Error("OpenClaw passthrough is unavailable: command runner was not configured.");
    }

    const sanitized = args.map((value) => value.trim()).filter(Boolean);
    if (sanitized.length === 0) {
      throw new Error("OpenClaw passthrough requires at least one argument.");
    }

    return this.commandRunner.run({
      command: process.env.OPENGOAT_OPENCLAW_CMD?.trim() || "openclaw",
      args: sanitized,
      cwd: options.cwd,
      env: options.env
    });
  }

  public async listSessions(agentId = DEFAULT_AGENT_ID, options: { activeMinutes?: number } = {}): Promise<SessionSummary[]> {
    const paths = this.pathsProvider.getPaths();
    return this.sessionService.listSessions(paths, agentId, options);
  }

  public async getAgentLastAction(agentId = DEFAULT_AGENT_ID): Promise<AgentLastAction | null> {
    const paths = this.pathsProvider.getPaths();
    return this.sessionService.getLastAgentAction(paths, agentId);
  }

  public async getSessionHistory(
    agentId = DEFAULT_AGENT_ID,
    options: { sessionRef?: string; limit?: number; includeCompaction?: boolean } = {}
  ): Promise<SessionHistoryResult> {
    const paths = this.pathsProvider.getPaths();
    return this.sessionService.getSessionHistory(paths, agentId, options);
  }

  public async resetSession(agentId = DEFAULT_AGENT_ID, sessionRef?: string): Promise<SessionRunInfo> {
    const paths = this.pathsProvider.getPaths();
    return this.sessionService.resetSession(paths, agentId, sessionRef);
  }

  public async compactSession(agentId = DEFAULT_AGENT_ID, sessionRef?: string): Promise<SessionCompactionResult> {
    const paths = this.pathsProvider.getPaths();
    return this.sessionService.compactSession(paths, agentId, sessionRef);
  }

  public async renameSession(
    agentId = DEFAULT_AGENT_ID,
    title = "",
    sessionRef?: string
  ): Promise<SessionSummary> {
    const paths = this.pathsProvider.getPaths();
    return this.sessionService.renameSession(paths, agentId, title, sessionRef);
  }

  public async removeSession(agentId = DEFAULT_AGENT_ID, sessionRef?: string): Promise<SessionRemoveResult> {
    const paths = this.pathsProvider.getPaths();
    return this.sessionService.removeSession(paths, agentId, sessionRef);
  }

  public getHomeDir(): string {
    return this.pathsProvider.getPaths().homeDir;
  }

  public getPaths() {
    return this.pathsProvider.getPaths();
  }
}

function containsAlreadyExistsMessage(stdout: string, stderr: string): boolean {
  const text = `${stdout}\n${stderr}`.toLowerCase();
  return text.includes("already exists") || text.includes("exists");
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
