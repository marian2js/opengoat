import path from "node:path";
import { homedir } from "node:os";
import { AgentManifestService } from "../../agents/application/agent-manifest.service.js";
import { AgentService } from "../../agents/application/agent.service.js";
import {
  BoardService,
  type BoardRecord,
  type BoardSummary,
  type CreateBoardOptions,
  type CreateTaskOptions,
  type TaskRecord,
  type UpdateBoardOptions,
} from "../../boards/index.js";
import { BootstrapService } from "../../bootstrap/application/bootstrap.service.js";
import { DEFAULT_AGENT_ID, normalizeAgentId } from "../../domain/agent-id.js";
import type {
  AgentCreationResult,
  AgentDeletionResult,
  AgentDescriptor,
  AgentInfo,
  AgentManagerUpdateResult,
  AgentReporteeSummary,
  CreateAgentOptions,
  DeleteAgentOptions,
} from "../../domain/agent.js";
import type { InitializationResult } from "../../domain/opengoat-paths.js";
import { createNoopLogger, type Logger } from "../../logging/index.js";
import {
  OrchestrationService,
  type OrchestrationRunOptions,
  type OrchestrationRunResult,
  type RoutingDecision,
} from "../../orchestration/index.js";
import type {
  CommandRunResult,
  CommandRunnerPort,
} from "../../ports/command-runner.port.js";
import type { FileSystemPort } from "../../ports/file-system.port.js";
import type { PathPort } from "../../ports/path.port.js";
import type { OpenGoatPathsProvider } from "../../ports/paths-provider.port.js";
import { ProviderService } from "../../providers/application/provider.service.js";
import type {
  AgentProviderBinding,
  OpenClawGatewayConfig,
  ProviderAuthOptions,
  ProviderExecutionResult,
  ProviderOnboardingSpec,
  ProviderRegistry,
  ProviderStoredConfig,
  ProviderSummary,
} from "../../providers/index.js";
import {
  ProviderCommandNotFoundError,
  createDefaultProviderRegistry,
} from "../../providers/index.js";
import {
  SessionService,
  type AgentLastAction,
  type SessionCompactionResult,
  type SessionHistoryResult,
  type SessionRemoveResult,
  type SessionRunInfo,
  type SessionSummary,
} from "../../sessions/index.js";
import {
  SkillService,
  type InstallSkillRequest,
  type InstallSkillResult,
  type ResolvedSkill,
} from "../../skills/index.js";

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
const OPENCLAW_DEFAULT_AGENT_ID = "main";

export interface RuntimeDefaultsSyncResult {
  ceoSyncCode?: number;
  ceoSynced: boolean;
  warnings: string[];
}

export interface TaskCronDispatchResult {
  kind: "todo" | "blocked" | "inactive";
  targetAgentId: string;
  sessionRef: string;
  taskId?: string;
  subjectAgentId?: string;
  ok: boolean;
  error?: string;
}

export interface TaskCronRunResult {
  ranAt: string;
  scannedTasks: number;
  todoTasks: number;
  blockedTasks: number;
  inactiveAgents: number;
  sent: number;
  failed: number;
  dispatches: TaskCronDispatchResult[];
}

export interface HardResetResult {
  homeDir: string;
  homeRemoved: boolean;
  deletedOpenClawAgents: string[];
  failedOpenClawAgents: Array<{
    agentId: string;
    reason: string;
  }>;
  removedOpenClawManagedSkillDirs: string[];
  warnings: string[];
}

export class OpenGoatService {
  private readonly fileSystem: FileSystemPort;
  private readonly pathPort: PathPort;
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
  private readonly nowIso: () => string;
  private openClawManagedSkillsDirCache?: string | null;

  public constructor(deps: OpenGoatServiceDeps) {
    const nowIso = deps.nowIso ?? (() => new Date().toISOString());
    const rootLogger = (deps.logger ?? createNoopLogger()).child({
      scope: "opengoat-service",
    });
    const providerRegistryFactory = deps.providerRegistry
      ? () => deps.providerRegistry as ProviderRegistry
      : () => createDefaultProviderRegistry();

    this.fileSystem = deps.fileSystem;
    this.pathPort = deps.pathPort;
    this.pathsProvider = deps.pathsProvider;
    this.nowIso = nowIso;
    this.agentService = new AgentService({
      fileSystem: deps.fileSystem,
      pathPort: deps.pathPort,
      nowIso,
    });
    this.agentManifestService = new AgentManifestService({
      fileSystem: deps.fileSystem,
      pathPort: deps.pathPort,
    });
    this.bootstrapService = new BootstrapService({
      fileSystem: deps.fileSystem,
      pathsProvider: deps.pathsProvider,
      agentService: this.agentService,
      nowIso,
    });
    this.skillService = new SkillService({
      fileSystem: deps.fileSystem,
      pathPort: deps.pathPort,
    });
    this.providerService = new ProviderService({
      fileSystem: deps.fileSystem,
      pathPort: deps.pathPort,
      providerRegistry: providerRegistryFactory,
      nowIso,
      logger: rootLogger.child({ scope: "provider" }),
    });
    this.sessionService = new SessionService({
      fileSystem: deps.fileSystem,
      pathPort: deps.pathPort,
      commandRunner: deps.commandRunner,
      nowIso,
      nowMs: () => Date.now(),
    });
    this.commandRunner = deps.commandRunner;
    this.orchestrationService = new OrchestrationService({
      providerService: this.providerService,
      agentManifestService: this.agentManifestService,
      sessionService: this.sessionService,
      fileSystem: deps.fileSystem,
      pathPort: deps.pathPort,
      nowIso,
      logger: rootLogger.child({ scope: "orchestration" }),
    });
    this.boardService = new BoardService({
      fileSystem: deps.fileSystem,
      pathPort: deps.pathPort,
      nowIso,
      agentManifestService: this.agentManifestService,
    });
  }

  public initialize(): Promise<InitializationResult> {
    return this.initializeWithDefaultBoards();
  }

  public async hardReset(): Promise<HardResetResult> {
    const paths = this.pathsProvider.getPaths();
    const warnings: string[] = [];
    const deletedOpenClawAgents: string[] = [];
    const failedOpenClawAgents: Array<{
      agentId: string;
      reason: string;
    }> = [];
    const removedOpenClawManagedSkillDirs: string[] = [];
    const candidateOpenClawAgentIds = new Set<string>();

    const localAgents = await this.agentService.listAgents(paths);
    for (const agent of localAgents) {
      if (agent.id === OPENCLAW_DEFAULT_AGENT_ID) {
        continue;
      }
      candidateOpenClawAgentIds.add(agent.id);
    }

    try {
      const openClawAgents = await this.listOpenClawAgents(paths);
      for (const entry of openClawAgents) {
        if (
          entry.id !== OPENCLAW_DEFAULT_AGENT_ID &&
          (pathIsWithin(paths.homeDir, entry.workspace) ||
            pathIsWithin(paths.homeDir, entry.agentDir))
        ) {
          candidateOpenClawAgentIds.add(entry.id);
        }
      }
    } catch (error) {
      warnings.push(
        `OpenClaw agent discovery failed: ${toErrorMessage(error)}`,
      );
    }

    for (const agentId of [...candidateOpenClawAgentIds].sort((left, right) =>
      left.localeCompare(right),
    )) {
      if (agentId === OPENCLAW_DEFAULT_AGENT_ID) {
        continue;
      }
      try {
        const deleted = await this.providerService.deleteProviderAgent(
          paths,
          agentId,
          { providerId: OPENCLAW_PROVIDER_ID },
        );
        if (
          deleted.code === 0 ||
          containsAgentNotFoundMessage(deleted.stdout, deleted.stderr)
        ) {
          deletedOpenClawAgents.push(agentId);
          continue;
        }
        const failureReason = deleted.stderr.trim() || deleted.stdout.trim();
        if (!failureReason) {
          warnings.push(
            `OpenClaw delete for "${agentId}" failed with code ${deleted.code}.`,
          );
          continue;
        }
        failedOpenClawAgents.push({
          agentId,
          reason: failureReason,
        });
      } catch (error) {
        if (error instanceof ProviderCommandNotFoundError) {
          deletedOpenClawAgents.push(agentId);
          continue;
        }
        failedOpenClawAgents.push({
          agentId,
          reason: toErrorMessage(error),
        });
      }
    }

    try {
      const managedSkillsCleanup = await this.removeOpenClawManagedRoleSkills(
        paths,
      );
      removedOpenClawManagedSkillDirs.push(
        ...managedSkillsCleanup.removedPaths,
      );
    } catch (error) {
      warnings.push(
        `OpenClaw managed skills cleanup failed: ${toErrorMessage(error)}`,
      );
    }

    await this.fileSystem.removeDir(paths.homeDir);
    this.openClawManagedSkillsDirCache = undefined;
    const homeRemoved = !(await this.fileSystem.exists(paths.homeDir));

    return {
      homeDir: paths.homeDir,
      homeRemoved,
      deletedOpenClawAgents,
      failedOpenClawAgents,
      removedOpenClawManagedSkillDirs,
      warnings,
    };
  }

  public async syncRuntimeDefaults(): Promise<RuntimeDefaultsSyncResult> {
    const paths = this.pathsProvider.getPaths();
    const warnings: string[] = [];
    let ceoSynced = false;
    let ceoSyncCode: number | undefined;

    let ceoDescriptor = (await this.agentService.listAgents(paths)).find(
      (agent) => agent.id === DEFAULT_AGENT_ID,
    );
    if (!ceoDescriptor) {
      const created = await this.agentService.ensureAgent(
        paths,
        {
          id: DEFAULT_AGENT_ID,
          displayName: "CEO",
        },
        {
          type: "manager",
          reportsTo: null,
          role: "CEO",
        },
      );
      ceoDescriptor = created.agent;
    }

    try {
      await this.syncOpenClawRoleSkills(paths, DEFAULT_AGENT_ID);
    } catch (error) {
      warnings.push(
        `OpenClaw role skill assignment sync for "ceo" failed: ${toErrorMessage(
          error,
        )}`,
      );
    }

    try {
      const ceoSync = await this.providerService.createProviderAgent(
        paths,
        DEFAULT_AGENT_ID,
        {
          providerId: OPENCLAW_PROVIDER_ID,
          displayName: ceoDescriptor.displayName,
          workspaceDir: ceoDescriptor.workspaceDir,
          internalConfigDir: ceoDescriptor.internalConfigDir,
        },
      );
      ceoSyncCode = ceoSync.code;
      ceoSynced =
        ceoSync.code === 0 ||
        containsAlreadyExistsMessage(ceoSync.stdout, ceoSync.stderr);
      if (!ceoSynced) {
        warnings.push(
          `OpenClaw sync for "ceo" failed (code ${ceoSync.code}). ${(
            ceoSync.stderr || ceoSync.stdout
          ).trim()}`,
        );
      }
    } catch (error) {
      warnings.push(`OpenClaw sync for "ceo" failed: ${toErrorMessage(error)}`);
    }

    if (ceoSynced) {
      try {
        await this.ensureOpenClawAgentLocation(paths, {
          agentId: DEFAULT_AGENT_ID,
          displayName: ceoDescriptor.displayName,
          workspaceDir: ceoDescriptor.workspaceDir,
          internalConfigDir: ceoDescriptor.internalConfigDir,
        });
      } catch (error) {
        warnings.push(
          `OpenClaw ceo location sync failed: ${toErrorMessage(error)}`,
        );
      }
    }

    try {
      await this.agentService.ensureCeoWorkspaceBootstrap(paths);
    } catch (error) {
      warnings.push(
        `OpenGoat workspace bootstrap for "ceo" failed: ${toErrorMessage(
          error,
        )}`,
      );
    }

    try {
      await this.boardService.ensureDefaultBoardForAgent(
        paths,
        DEFAULT_AGENT_ID,
      );
    } catch (error) {
      warnings.push(
        `Default board ensure for "ceo" failed: ${toErrorMessage(error)}`,
      );
    }

    return {
      ceoSyncCode,
      ceoSynced,
      warnings,
    };
  }

  public async createAgent(
    rawName: string,
    options: CreateAgentOptions = {},
  ): Promise<AgentCreationResult> {
    const identity = this.agentService.normalizeAgentName(rawName);
    const paths = this.pathsProvider.getPaths();
    const created = await this.agentService.ensureAgent(paths, identity, {
      type: options.type,
      reportsTo: options.reportsTo,
      skills: options.skills,
      role: options.role,
    });
    try {
      const workspaceSkillSync = await this.syncOpenClawRoleSkills(
        paths,
        created.agent.id,
      );
      created.createdPaths.push(...workspaceSkillSync.createdPaths);
      created.skippedPaths.push(...workspaceSkillSync.skippedPaths);
      created.skippedPaths.push(...workspaceSkillSync.removedPaths);
    } catch (error) {
      if (!created.alreadyExisted) {
        await this.agentService.removeAgent(paths, created.agent.id);
      }
      throw new Error(
        `Failed to sync OpenClaw role skills for "${
          created.agent.id
        }". ${toErrorMessage(error)}`,
      );
    }

    const runtimeSync = await this.providerService.createProviderAgent(
      paths,
      created.agent.id,
      {
        providerId: OPENCLAW_PROVIDER_ID,
        displayName: created.agent.displayName,
        workspaceDir: created.agent.workspaceDir,
        internalConfigDir: created.agent.internalConfigDir,
      },
    );

    if (
      runtimeSync.code !== 0 &&
      !containsAlreadyExistsMessage(runtimeSync.stdout, runtimeSync.stderr)
    ) {
      if (!created.alreadyExisted) {
        await this.agentService.removeAgent(paths, created.agent.id);
      }
      throw new Error(
        `OpenClaw agent creation failed for "${created.agent.id}" (exit ${
          runtimeSync.code
        }). ${
          runtimeSync.stderr.trim() || runtimeSync.stdout.trim() || ""
        }`.trim(),
      );
    }
    try {
      await this.ensureOpenClawAgentLocation(paths, {
        agentId: created.agent.id,
        displayName: created.agent.displayName,
        workspaceDir: created.agent.workspaceDir,
        internalConfigDir: created.agent.internalConfigDir,
      });
    } catch (error) {
      if (!created.alreadyExisted) {
        await this.agentService.removeAgent(paths, created.agent.id);
      }
      throw new Error(
        `OpenClaw agent location sync failed for "${
          created.agent.id
        }". ${toErrorMessage(error)}`,
      );
    }
    try {
      const workspaceBootstrap =
        await this.agentService.ensureAgentWorkspaceBootstrap(paths, {
          agentId: created.agent.id,
          displayName: created.agent.displayName,
          role:
            options.role?.trim() ??
            (created.alreadyExisted ? created.agent.role : ""),
        });
      created.createdPaths.push(...workspaceBootstrap.createdPaths);
      created.skippedPaths.push(...workspaceBootstrap.skippedPaths);
      created.skippedPaths.push(...workspaceBootstrap.removedPaths);
    } catch (error) {
      if (!created.alreadyExisted) {
        await this.agentService.removeAgent(paths, created.agent.id);
      }
      throw new Error(
        `Failed to update workspace bootstrap for "${
          created.agent.id
        }". ${toErrorMessage(error)}`,
      );
    }

    await this.boardService.ensureDefaultBoardForAgent(paths, created.agent.id);

    return {
      ...created,
      runtimeSync: {
        runtimeId: runtimeSync.providerId,
        code: runtimeSync.code,
        stdout: runtimeSync.stdout,
        stderr: runtimeSync.stderr,
      },
    };
  }

  public async deleteAgent(
    rawAgentId: string,
    options: DeleteAgentOptions = {},
  ): Promise<AgentDeletionResult> {
    const paths = this.pathsProvider.getPaths();
    const agentId = normalizeAgentId(rawAgentId);
    if (!agentId) {
      throw new Error("Agent id cannot be empty.");
    }

    const existing = (await this.agentService.listAgents(paths)).find(
      (entry) => entry.id === agentId,
    );
    if (!existing) {
      return this.agentService.removeAgent(paths, agentId);
    }

    const runtimeSync = await this.providerService.deleteProviderAgent(
      paths,
      agentId,
      {
        providerId: OPENCLAW_PROVIDER_ID,
      },
    );
    if (runtimeSync.code !== 0 && !options.force) {
      throw new Error(
        `OpenClaw agent deletion failed for "${agentId}" (exit ${
          runtimeSync.code
        }). ${
          runtimeSync.stderr.trim() || runtimeSync.stdout.trim() || ""
        }`.trim(),
      );
    }

    const removed = await this.agentService.removeAgent(paths, agentId);
    return {
      ...removed,
      runtimeSync: {
        runtimeId: runtimeSync.providerId,
        code: runtimeSync.code,
        stdout: runtimeSync.stdout,
        stderr: runtimeSync.stderr,
      },
    };
  }

  public async setAgentManager(
    rawAgentId: string,
    rawReportsTo: string | null,
  ): Promise<AgentManagerUpdateResult> {
    const paths = this.pathsProvider.getPaths();
    const updated = await this.agentService.setAgentManager(
      paths,
      rawAgentId,
      rawReportsTo,
    );
    await this.syncOpenClawRoleSkills(paths, updated.agentId);
    if (updated.previousReportsTo) {
      await this.syncOpenClawRoleSkills(paths, updated.previousReportsTo);
    }
    if (updated.reportsTo) {
      await this.syncOpenClawRoleSkills(paths, updated.reportsTo);
    }
    return updated;
  }

  public async listAgents(): Promise<AgentDescriptor[]> {
    const paths = this.pathsProvider.getPaths();
    return this.agentService.listAgents(paths);
  }

  public async listDirectReportees(rawAgentId: string): Promise<string[]> {
    const agentId = normalizeAgentId(rawAgentId);
    if (!agentId) {
      throw new Error("Agent id cannot be empty.");
    }

    const paths = this.pathsProvider.getPaths();
    const manifests = await this.agentManifestService.listManifests(paths);
    assertAgentExists(manifests, agentId);

    return manifests
      .filter((manifest) => manifest.metadata.reportsTo === agentId)
      .map((manifest) => manifest.agentId)
      .sort((left, right) => left.localeCompare(right));
  }

  public async listAllReportees(rawAgentId: string): Promise<string[]> {
    const agentId = normalizeAgentId(rawAgentId);
    if (!agentId) {
      throw new Error("Agent id cannot be empty.");
    }

    const paths = this.pathsProvider.getPaths();
    const manifests = await this.agentManifestService.listManifests(paths);
    assertAgentExists(manifests, agentId);

    return collectAllReportees(manifests, agentId);
  }

  public async getAgentInfo(rawAgentId: string): Promise<AgentInfo> {
    const agentId = normalizeAgentId(rawAgentId);
    if (!agentId) {
      throw new Error("Agent id cannot be empty.");
    }

    const paths = this.pathsProvider.getPaths();
    const [agents, manifests] = await Promise.all([
      this.agentService.listAgents(paths),
      this.agentManifestService.listManifests(paths),
    ]);

    const descriptorsById = new Map(agents.map((agent) => [agent.id, agent]));
    const agent = descriptorsById.get(agentId);
    if (!agent) {
      throw new Error(`Agent "${agentId}" does not exist.`);
    }

    const totalReportees = collectAllReportees(manifests, agentId).length;
    const directReportees: AgentReporteeSummary[] = manifests
      .filter((manifest) => manifest.metadata.reportsTo === agentId)
      .map((manifest) => {
        const descriptor = descriptorsById.get(manifest.agentId);
        const name =
          descriptor?.displayName?.trim() ||
          manifest.metadata.name ||
          manifest.agentId;
        const role =
          descriptor?.role?.trim() || manifest.metadata.description || "Agent";
        return {
          id: manifest.agentId,
          name,
          role,
          totalReportees: collectAllReportees(manifests, manifest.agentId)
            .length,
        };
      })
      .sort((left, right) => left.id.localeCompare(right.id));

    return {
      id: agent.id,
      name: agent.displayName,
      role: agent.role,
      totalReportees,
      directReportees,
    };
  }

  public listProviders(): Promise<ProviderSummary[]> {
    return this.providerService.listProviders();
  }

  public getProviderOnboarding(
    providerId: string,
  ): Promise<ProviderOnboardingSpec | undefined> {
    return this.providerService.getProviderOnboarding(providerId);
  }

  public async getProviderConfig(
    providerId: string,
  ): Promise<ProviderStoredConfig | null> {
    const paths = this.pathsProvider.getPaths();
    return this.providerService.getProviderConfig(paths, providerId);
  }

  public async setProviderConfig(
    providerId: string,
    env: Record<string, string>,
  ): Promise<ProviderStoredConfig> {
    const paths = this.pathsProvider.getPaths();
    return this.providerService.setProviderConfig(paths, providerId, env);
  }

  public async authenticateProvider(
    providerId: string,
    options: ProviderAuthOptions = {},
  ): Promise<ProviderExecutionResult> {
    const paths = this.pathsProvider.getPaths();
    return this.providerService.invokeProviderAuth(paths, providerId, options);
  }

  public async getAgentProvider(
    agentId: string,
  ): Promise<AgentProviderBinding> {
    const paths = this.pathsProvider.getPaths();
    return this.providerService.getAgentProvider(paths, agentId);
  }

  public async setAgentProvider(
    agentId: string,
    providerId: string,
  ): Promise<AgentProviderBinding> {
    const paths = this.pathsProvider.getPaths();
    return this.providerService.setAgentProvider(paths, agentId, providerId);
  }

  public async getOpenClawGatewayConfig(): Promise<OpenClawGatewayConfig> {
    const paths = this.pathsProvider.getPaths();
    return this.providerService.getOpenClawGatewayConfig(paths);
  }

  public async setOpenClawGatewayConfig(
    config: OpenClawGatewayConfig,
  ): Promise<OpenClawGatewayConfig> {
    const paths = this.pathsProvider.getPaths();
    return this.providerService.setOpenClawGatewayConfig(paths, config);
  }

  public async routeMessage(
    agentId: string,
    message: string,
  ): Promise<RoutingDecision> {
    const paths = this.pathsProvider.getPaths();
    return this.orchestrationService.routeMessage(paths, agentId, message);
  }

  public async runAgent(
    agentId: string,
    options: OrchestrationRunOptions,
  ): Promise<OrchestrationRunResult> {
    const paths = this.pathsProvider.getPaths();
    return this.orchestrationService.runAgent(paths, agentId, options);
  }

  public async createBoard(
    actorId: string,
    options: CreateBoardOptions,
  ): Promise<BoardSummary> {
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

  public async updateBoard(
    actorId: string,
    boardId: string,
    options: UpdateBoardOptions,
  ): Promise<BoardSummary> {
    const paths = this.pathsProvider.getPaths();
    return this.boardService.updateBoard(paths, actorId, boardId, options);
  }

  public async createTask(
    actorId: string,
    boardId: string | null | undefined,
    options: CreateTaskOptions,
  ): Promise<TaskRecord> {
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

  public async updateTaskStatus(
    actorId: string,
    taskId: string,
    status: string,
    reason?: string,
  ): Promise<TaskRecord> {
    const paths = this.pathsProvider.getPaths();
    return this.boardService.updateTaskStatus(
      paths,
      actorId,
      taskId,
      status,
      reason,
    );
  }

  public async addTaskBlocker(
    actorId: string,
    taskId: string,
    blocker: string,
  ): Promise<TaskRecord> {
    const paths = this.pathsProvider.getPaths();
    return this.boardService.addTaskBlocker(paths, actorId, taskId, blocker);
  }

  public async addTaskArtifact(
    actorId: string,
    taskId: string,
    content: string,
  ): Promise<TaskRecord> {
    const paths = this.pathsProvider.getPaths();
    return this.boardService.addTaskArtifact(paths, actorId, taskId, content);
  }

  public async addTaskWorklog(
    actorId: string,
    taskId: string,
    content: string,
  ): Promise<TaskRecord> {
    const paths = this.pathsProvider.getPaths();
    return this.boardService.addTaskWorklog(paths, actorId, taskId, content);
  }

  public async runTaskCronCycle(
    options: { inactiveMinutes?: number } = {},
  ): Promise<TaskCronRunResult> {
    const paths = this.pathsProvider.getPaths();
    const ranAt = this.resolveNowIso();
    const manifests = await this.agentManifestService.listManifests(paths);
    const manifestsById = new Map(
      manifests.map((manifest) => [manifest.agentId, manifest]),
    );
    const inactiveMinutes = resolveInactiveMinutes(options.inactiveMinutes);
    const inactiveCandidates = await this.collectInactiveAgents(
      paths,
      manifests,
      inactiveMinutes,
    );

    const boards = await this.boardService.listBoards(paths);
    const dispatches: TaskCronDispatchResult[] = [];
    let scannedTasks = 0;
    let todoTasks = 0;
    let blockedTasks = 0;

    for (const board of boards) {
      const tasks = await this.boardService.listTasks(paths, board.boardId);
      scannedTasks += tasks.length;

      for (const task of tasks) {
        if (task.status !== "todo" && task.status !== "blocked") {
          continue;
        }

        if (task.status === "todo") {
          todoTasks += 1;
          const targetAgentId = task.assignedTo;
          const sessionRef = buildTaskSessionRef(targetAgentId, task.taskId);
          const message = buildTodoTaskMessage({
            boardId: board.boardId,
            boardTitle: board.title,
            task,
          });
          const result = await this.dispatchAutomationMessage(
            paths,
            targetAgentId,
            sessionRef,
            message,
          );
          dispatches.push({
            kind: "todo",
            targetAgentId,
            sessionRef,
            taskId: task.taskId,
            ok: result.ok,
            error: result.error,
          });
          continue;
        }

        blockedTasks += 1;
        const assigneeManifest = manifestsById.get(task.assignedTo);
        const managerAgentId =
          normalizeAgentId(assigneeManifest?.metadata.reportsTo ?? "") ||
          DEFAULT_AGENT_ID;
        const sessionRef = buildTaskSessionRef(managerAgentId, task.taskId);
        const message = buildBlockedTaskMessage({
          boardId: board.boardId,
          boardTitle: board.title,
          task,
        });
        const result = await this.dispatchAutomationMessage(
          paths,
          managerAgentId,
          sessionRef,
          message,
        );
        dispatches.push({
          kind: "blocked",
          targetAgentId: managerAgentId,
          sessionRef,
          taskId: task.taskId,
          ok: result.ok,
          error: result.error,
        });
      }
    }

    for (const candidate of inactiveCandidates) {
      const sessionRef = buildInactiveSessionRef(
        candidate.managerAgentId,
        candidate.subjectAgentId,
      );
      const message = buildInactiveAgentMessage({
        managerAgentId: candidate.managerAgentId,
        subjectAgentId: candidate.subjectAgentId,
        subjectName: candidate.subjectName,
        role: candidate.role,
        inactiveMinutes,
        lastActionTimestamp: candidate.lastActionTimestamp,
      });
      const result = await this.dispatchAutomationMessage(
        paths,
        candidate.managerAgentId,
        sessionRef,
        message,
      );
      dispatches.push({
        kind: "inactive",
        targetAgentId: candidate.managerAgentId,
        sessionRef,
        subjectAgentId: candidate.subjectAgentId,
        ok: result.ok,
        error: result.error,
      });
    }

    const failed = dispatches.filter((entry) => !entry.ok).length;
    return {
      ranAt,
      scannedTasks,
      todoTasks,
      blockedTasks,
      inactiveAgents: inactiveCandidates.length,
      sent: dispatches.length - failed,
      failed,
      dispatches,
    };
  }

  public async listSkills(
    agentId = DEFAULT_AGENT_ID,
  ): Promise<ResolvedSkill[]> {
    const paths = this.pathsProvider.getPaths();
    return this.skillService.listSkills(paths, agentId);
  }

  public async listGlobalSkills(): Promise<ResolvedSkill[]> {
    const paths = this.pathsProvider.getPaths();
    return this.skillService.listGlobalSkills(paths);
  }

  public async installSkill(
    request: InstallSkillRequest,
  ): Promise<InstallSkillResult> {
    const paths = this.pathsProvider.getPaths();
    const result = await this.skillService.installSkill(paths, request);
    if (result.scope === "agent" && result.agentId) {
      await this.syncOpenClawRoleSkills(paths, result.agentId);
      await this.boardService.ensureDefaultBoardForAgent(paths, result.agentId);
    }
    return result;
  }

  public async runOpenClaw(
    args: string[],
    options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
  ): Promise<CommandRunResult> {
    if (!this.commandRunner) {
      throw new Error(
        "OpenClaw passthrough is unavailable: command runner was not configured.",
      );
    }

    const sanitized = args.map((value) => value.trim()).filter(Boolean);
    if (sanitized.length === 0) {
      throw new Error("OpenClaw passthrough requires at least one argument.");
    }

    const executionEnv = prepareOpenClawCommandEnv(
      options.env ?? process.env,
    );
    const command =
      executionEnv.OPENGOAT_OPENCLAW_CMD?.trim() ||
      executionEnv.OPENCLAW_CMD?.trim() ||
      process.env.OPENGOAT_OPENCLAW_CMD?.trim() ||
      process.env.OPENCLAW_CMD?.trim() ||
      "openclaw";

    try {
      return await this.commandRunner.run({
        command,
        args: sanitized,
        cwd: options.cwd,
        env: executionEnv,
      });
    } catch (error) {
      if (isSpawnPermissionOrMissing(error)) {
        throw new ProviderCommandNotFoundError(OPENCLAW_PROVIDER_ID, command);
      }
      throw error;
    }
  }

  public async listSessions(
    agentId = DEFAULT_AGENT_ID,
    options: { activeMinutes?: number } = {},
  ): Promise<SessionSummary[]> {
    const paths = this.pathsProvider.getPaths();
    return this.sessionService.listSessions(paths, agentId, options);
  }

  public async prepareSession(
    agentId = DEFAULT_AGENT_ID,
    options: {
      sessionRef?: string;
      projectPath?: string;
      forceNew?: boolean;
    } = {},
  ): Promise<SessionRunInfo> {
    const paths = this.pathsProvider.getPaths();
    const prepared = await this.sessionService.prepareRunSession(
      paths,
      agentId,
      {
        sessionRef: options.sessionRef,
        projectPath: options.projectPath,
        forceNew: options.forceNew,
        userMessage: "",
      },
    );

    if (!prepared.enabled) {
      throw new Error("Session preparation was disabled.");
    }

    return prepared.info;
  }

  public async getAgentLastAction(
    agentId = DEFAULT_AGENT_ID,
  ): Promise<AgentLastAction | null> {
    const paths = this.pathsProvider.getPaths();
    return this.sessionService.getLastAgentAction(paths, agentId);
  }

  public async getSessionHistory(
    agentId = DEFAULT_AGENT_ID,
    options: {
      sessionRef?: string;
      limit?: number;
      includeCompaction?: boolean;
    } = {},
  ): Promise<SessionHistoryResult> {
    const paths = this.pathsProvider.getPaths();
    return this.sessionService.getSessionHistory(paths, agentId, options);
  }

  public async resetSession(
    agentId = DEFAULT_AGENT_ID,
    sessionRef?: string,
  ): Promise<SessionRunInfo> {
    const paths = this.pathsProvider.getPaths();
    return this.sessionService.resetSession(paths, agentId, sessionRef);
  }

  public async compactSession(
    agentId = DEFAULT_AGENT_ID,
    sessionRef?: string,
  ): Promise<SessionCompactionResult> {
    const paths = this.pathsProvider.getPaths();
    return this.sessionService.compactSession(paths, agentId, sessionRef);
  }

  public async renameSession(
    agentId = DEFAULT_AGENT_ID,
    title = "",
    sessionRef?: string,
  ): Promise<SessionSummary> {
    const paths = this.pathsProvider.getPaths();
    return this.sessionService.renameSession(paths, agentId, title, sessionRef);
  }

  public async removeSession(
    agentId = DEFAULT_AGENT_ID,
    sessionRef?: string,
  ): Promise<SessionRemoveResult> {
    const paths = this.pathsProvider.getPaths();
    return this.sessionService.removeSession(paths, agentId, sessionRef);
  }

  public getHomeDir(): string {
    return this.pathsProvider.getPaths().homeDir;
  }

  public getPaths() {
    return this.pathsProvider.getPaths();
  }

  private async dispatchAutomationMessage(
    paths: ReturnType<OpenGoatPathsProvider["getPaths"]>,
    agentId: string,
    sessionRef: string,
    message: string,
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      const result = await this.orchestrationService.runAgent(paths, agentId, {
        message,
        sessionRef,
        env: process.env,
      });
      if (result.code !== 0) {
        return {
          ok: false,
          error: (
            result.stderr ||
            result.stdout ||
            `Runtime exited with code ${result.code}.`
          ).trim(),
        };
      }
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: toErrorMessage(error),
      };
    }
  }

  private resolveNowIso(): string {
    return this.nowIso();
  }

  private async initializeWithDefaultBoards(): Promise<InitializationResult> {
    const initialization = await this.bootstrapService.initialize();
    const paths = this.pathsProvider.getPaths();
    await this.boardService.ensureDefaultBoardsForManagers(paths);
    try {
      await this.syncRuntimeDefaults();
    } catch {
      // Startup remains functional even if OpenClaw CLI/runtime is unavailable.
    }
    return initialization;
  }

  private resolveNowMs(): number {
    return Date.now();
  }

  private async syncOpenClawRoleSkills(
    paths: ReturnType<OpenGoatPathsProvider["getPaths"]>,
    rawAgentId: string,
  ): Promise<{
    createdPaths: string[];
    skippedPaths: string[];
    removedPaths: string[];
  }> {
    const agentId = normalizeAgentId(rawAgentId);
    if (!agentId) {
      throw new Error("Agent id cannot be empty.");
    }

    const createdPaths: string[] = [];
    const skippedPaths: string[] = [];
    const removedPaths: string[] = [];
    const managedSkillsSync = await this.removeOpenClawManagedRoleSkills(paths);
    createdPaths.push(...managedSkillsSync.createdPaths);
    skippedPaths.push(...managedSkillsSync.skippedPaths);
    removedPaths.push(...managedSkillsSync.removedPaths);
    const syncedAgents = new Set<string>();

    const syncAgent = async (targetAgentId: string): Promise<void> => {
      if (syncedAgents.has(targetAgentId)) {
        return;
      }
      syncedAgents.add(targetAgentId);
      const sync = await this.agentService.ensureAgentWorkspaceRoleSkills(
        paths,
        targetAgentId,
      );
      createdPaths.push(...sync.createdPaths);
      skippedPaths.push(...sync.skippedPaths);
      removedPaths.push(...sync.removedPaths);
    };

    await syncAgent(agentId);

    const manifest = await this.agentManifestService.getManifest(
      paths,
      agentId,
    );
    const managerAgentId = normalizeAgentId(manifest.metadata.reportsTo ?? "");
    if (managerAgentId) {
      await syncAgent(managerAgentId);
    }

    return {
      createdPaths,
      skippedPaths,
      removedPaths,
    };
  }

  private async removeOpenClawManagedRoleSkills(
    paths: ReturnType<OpenGoatPathsProvider["getPaths"]>,
  ): Promise<{
    createdPaths: string[];
    skippedPaths: string[];
    removedPaths: string[];
  }> {
    if (!this.commandRunner) {
      return {
        createdPaths: [],
        skippedPaths: ["openclaw-managed-skills:command-runner-unavailable"],
        removedPaths: [],
      };
    }

    const managedSkillsDir = await this.resolveOpenClawManagedSkillsDir(paths);
    if (!managedSkillsDir) {
      return {
        createdPaths: [],
        skippedPaths: ["openclaw-managed-skills:unresolved"],
        removedPaths: [],
      };
    }

    const skippedPaths: string[] = [];
    const removedPaths: string[] = [];
    for (const legacySkillId of [
      "board-manager",
      "board-individual",
      "og-board-manager",
      "og-board-individual",
      "manager",
      "board-user",
    ]) {
      const legacyDir = this.pathPort.join(managedSkillsDir, legacySkillId);
      if (!(await this.fileSystem.exists(legacyDir))) {
        skippedPaths.push(legacyDir);
        continue;
      }
      await this.fileSystem.removeDir(legacyDir);
      removedPaths.push(legacyDir);
    }

    return {
      createdPaths: [],
      skippedPaths,
      removedPaths,
    };
  }

  private async resolveOpenClawManagedSkillsDir(
    paths: ReturnType<OpenGoatPathsProvider["getPaths"]>,
  ): Promise<string | null> {
    if (this.openClawManagedSkillsDirCache !== undefined) {
      return this.openClawManagedSkillsDirCache;
    }

    const providerConfig = await this.providerService.getProviderConfig(
      paths,
      OPENCLAW_PROVIDER_ID,
    );
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ...(providerConfig?.env ?? {}),
    };
    const skillsList = await this.runOpenClaw(["skills", "list", "--json"], {
      env,
    });
    if (skillsList.code !== 0) {
      throw new Error(
        `OpenClaw skills list failed (exit ${skillsList.code}). ${
          skillsList.stderr.trim() || skillsList.stdout.trim() || ""
        }`.trim(),
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(skillsList.stdout);
    } catch {
      throw new Error(
        "OpenClaw skills list returned non-JSON output; cannot resolve managed skills directory.",
      );
    }

    const managedSkillsDir = extractManagedSkillsDir(parsed);
    this.openClawManagedSkillsDirCache = managedSkillsDir;
    return managedSkillsDir;
  }

  private async listOpenClawAgents(
    paths: ReturnType<OpenGoatPathsProvider["getPaths"]>,
  ): Promise<OpenClawAgentPathEntry[]> {
    if (!this.commandRunner) {
      return [];
    }

    const env = await this.resolveOpenClawEnv(paths);
    const listed = await this.runOpenClaw(["agents", "list", "--json"], {
      env,
    });
    if (listed.code !== 0) {
      throw new Error(
        `OpenClaw agents list failed (exit ${listed.code}). ${
          listed.stderr.trim() || listed.stdout.trim() || ""
        }`.trim(),
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(listed.stdout);
    } catch {
      throw new Error(
        "OpenClaw agents list returned non-JSON output; cannot inspect agents.",
      );
    }

    return extractOpenClawAgents(parsed);
  }

  private async ensureOpenClawAgentLocation(
    paths: ReturnType<OpenGoatPathsProvider["getPaths"]>,
    params: {
      agentId: string;
      displayName: string;
      workspaceDir: string;
      internalConfigDir: string;
    },
  ): Promise<void> {
    if (!this.commandRunner) {
      return;
    }

    const env = await this.resolveOpenClawEnv(paths);
    const listed = await this.runOpenClaw(["agents", "list", "--json"], {
      env,
    });
    if (listed.code !== 0) {
      throw new Error(
        `OpenClaw agents list failed (exit ${listed.code}). ${
          listed.stderr.trim() || listed.stdout.trim() || ""
        }`.trim(),
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(listed.stdout);
    } catch {
      throw new Error(
        "OpenClaw agents list returned non-JSON output; cannot verify agent location.",
      );
    }

    const entry = extractOpenClawAgentEntry(parsed, params.agentId);
    if (!entry) {
      return;
    }
    if (
      pathMatches(entry.workspace, params.workspaceDir) &&
      pathMatches(entry.agentDir, params.internalConfigDir)
    ) {
      return;
    }

    const deleted = await this.providerService.deleteProviderAgent(
      paths,
      params.agentId,
      { providerId: OPENCLAW_PROVIDER_ID },
    );
    if (deleted.code !== 0) {
      throw new Error(
        `OpenClaw agent location repair failed deleting "${
          params.agentId
        }" (exit ${deleted.code}). ${
          deleted.stderr.trim() || deleted.stdout.trim() || ""
        }`.trim(),
      );
    }

    const recreated = await this.providerService.createProviderAgent(
      paths,
      params.agentId,
      {
        providerId: OPENCLAW_PROVIDER_ID,
        displayName: params.displayName,
        workspaceDir: params.workspaceDir,
        internalConfigDir: params.internalConfigDir,
      },
    );
    if (
      recreated.code !== 0 &&
      !containsAlreadyExistsMessage(recreated.stdout, recreated.stderr)
    ) {
      throw new Error(
        `OpenClaw agent location repair failed creating "${
          params.agentId
        }" (exit ${recreated.code}). ${
          recreated.stderr.trim() || recreated.stdout.trim() || ""
        }`.trim(),
      );
    }
  }

  private async resolveOpenClawEnv(
    paths: ReturnType<OpenGoatPathsProvider["getPaths"]>,
  ): Promise<NodeJS.ProcessEnv> {
    const providerConfig = await this.providerService.getProviderConfig(
      paths,
      OPENCLAW_PROVIDER_ID,
    );
    return {
      ...(providerConfig?.env ?? {}),
      ...process.env,
    };
  }

  private async collectInactiveAgents(
    paths: ReturnType<OpenGoatPathsProvider["getPaths"]>,
    manifests: Awaited<ReturnType<AgentManifestService["listManifests"]>>,
    inactiveMinutes: number,
  ): Promise<
    Array<{
      managerAgentId: string;
      subjectAgentId: string;
      subjectName: string;
      role: string;
      lastActionTimestamp?: number;
    }>
  > {
    const nowMs = this.resolveNowMs();
    const inactiveCutoffMs = nowMs - inactiveMinutes * 60_000;
    const inactive: Array<{
      managerAgentId: string;
      subjectAgentId: string;
      subjectName: string;
      role: string;
      lastActionTimestamp?: number;
    }> = [];

    for (const manifest of manifests) {
      const managerAgentId = normalizeAgentId(
        manifest.metadata.reportsTo ?? "",
      );
      if (!managerAgentId) {
        continue;
      }

      const lastAction = await this.sessionService.getLastAgentAction(
        paths,
        manifest.agentId,
      );
      if (lastAction && lastAction.timestamp >= inactiveCutoffMs) {
        continue;
      }

      inactive.push({
        managerAgentId,
        subjectAgentId: manifest.agentId,
        subjectName: manifest.metadata.name,
        role: manifest.metadata.description,
        lastActionTimestamp: lastAction?.timestamp,
      });
    }

    return inactive;
  }
}

function containsAlreadyExistsMessage(stdout: string, stderr: string): boolean {
  const text = `${stdout}\n${stderr}`.toLowerCase();
  return /\balready exists?\b/.test(text);
}

function containsAgentNotFoundMessage(stdout: string, stderr: string): boolean {
  const text = `${stdout}\n${stderr}`.toLowerCase();
  return /\b(not found|does not exist|no such agent|unknown agent|could not find|no agent found|not exist)\b/.test(
    text,
  );
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function resolveInactiveMinutes(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 30;
  }
  return Math.floor(value);
}

function extractManagedSkillsDir(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const record = payload as { managedSkillsDir?: unknown };
  if (typeof record.managedSkillsDir !== "string") {
    return null;
  }

  const managedSkillsDir = record.managedSkillsDir.trim();
  return managedSkillsDir || null;
}

type OpenClawAgentPathEntry = {
  id: string;
  workspace: string;
  agentDir: string;
};

function extractOpenClawAgents(payload: unknown): OpenClawAgentPathEntry[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  const entries: OpenClawAgentPathEntry[] = [];
  for (const entry of payload) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }
    const record = entry as {
      id?: unknown;
      workspace?: unknown;
      agentDir?: unknown;
    };
    const id = normalizeAgentId(String(record.id ?? ""));
    if (!id) {
      continue;
    }
    entries.push({
      id,
      workspace: typeof record.workspace === "string" ? record.workspace : "",
      agentDir: typeof record.agentDir === "string" ? record.agentDir : "",
    });
  }

  return entries;
}

function extractOpenClawAgentEntry(
  payload: unknown,
  agentId: string,
): { workspace: string; agentDir: string } | null {
  const normalizedAgentId = normalizeAgentId(agentId);
  if (!normalizedAgentId) {
    return null;
  }

  for (const entry of extractOpenClawAgents(payload)) {
    if (entry.id !== normalizedAgentId) {
      continue;
    }
    return {
      workspace: entry.workspace,
      agentDir: entry.agentDir,
    };
  }

  return null;
}

function pathMatches(left: string, right: string): boolean {
  const leftNormalized = normalizePathForCompare(left);
  const rightNormalized = normalizePathForCompare(right);
  if (!leftNormalized || !rightNormalized) {
    return false;
  }
  return leftNormalized === rightNormalized;
}

function pathIsWithin(containerPath: string, candidatePath: string): boolean {
  const normalizedContainer = normalizePathForCompare(containerPath);
  const normalizedCandidate = normalizePathForCompare(candidatePath);
  if (!normalizedContainer || !normalizedCandidate) {
    return false;
  }
  const relative = path.relative(normalizedContainer, normalizedCandidate);
  if (!relative) {
    return true;
  }
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

function normalizePathForCompare(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const resolved = path.resolve(trimmed);
  if (process.platform === "win32") {
    return resolved.toLowerCase();
  }
  return resolved;
}

function buildTaskSessionRef(agentId: string, taskId: string): string {
  const normalizedAgentId = normalizeAgentId(agentId) || DEFAULT_AGENT_ID;
  const normalizedTaskId = normalizeAgentId(taskId) || "task";
  return `agent:${normalizedAgentId}:agent_${normalizedAgentId}_task_${normalizedTaskId}`;
}

function buildInactiveSessionRef(
  managerAgentId: string,
  subjectAgentId: string,
): string {
  const manager = normalizeAgentId(managerAgentId) || DEFAULT_AGENT_ID;
  const subject = normalizeAgentId(subjectAgentId) || "agent";
  return `agent:${manager}:agent_${manager}_inactive_${subject}`;
}

function buildTodoTaskMessage(params: {
  boardId: string;
  boardTitle: string;
  task: TaskRecord;
}): string {
  const blockers =
    params.task.blockers.length > 0 ? params.task.blockers.join("; ") : "None";
  const artifacts =
    params.task.artifacts.length > 0
      ? params.task.artifacts
          .map(
            (entry) =>
              `- ${entry.createdAt} @${entry.createdBy}: ${entry.content}`,
          )
          .join("\n")
      : "- None";
  const worklog =
    params.task.worklog.length > 0
      ? params.task.worklog
          .map(
            (entry) =>
              `- ${entry.createdAt} @${entry.createdBy}: ${entry.content}`,
          )
          .join("\n")
      : "- None";

  return [
    `Task #${params.task.taskId} is assigned to you and currently in TODO. Please work on it now.`,
    "",
    `Board: ${params.boardTitle} (${params.boardId})`,
    `Task ID: ${params.task.taskId}`,
    `Title: ${params.task.title}`,
    `Description: ${params.task.description}`,
    `Project: ${params.task.project}`,
    `Status: ${params.task.status}`,
    `Owner: @${params.task.owner}`,
    `Assigned to: @${params.task.assignedTo}`,
    `Created at: ${params.task.createdAt}`,
    `Blockers: ${blockers}`,
    "Artifacts:",
    artifacts,
    "Worklog:",
    worklog,
  ].join("\n");
}

function buildBlockedTaskMessage(params: {
  boardId: string;
  boardTitle: string;
  task: TaskRecord;
}): string {
  const blockerReason =
    params.task.blockers.length > 0
      ? params.task.blockers.join("; ")
      : params.task.statusReason?.trim() || "no blocker details were provided";
  const artifacts =
    params.task.artifacts.length > 0
      ? params.task.artifacts
          .map(
            (entry) =>
              `- ${entry.createdAt} @${entry.createdBy}: ${entry.content}`,
          )
          .join("\n")
      : "- None";
  const worklog =
    params.task.worklog.length > 0
      ? params.task.worklog
          .map(
            (entry) =>
              `- ${entry.createdAt} @${entry.createdBy}: ${entry.content}`,
          )
          .join("\n")
      : "- None";

  return [
    `Task #${params.task.taskId}, assigned to your reportee "@${params.task.assignedTo}" is blocked because of ${blockerReason}. Help unblocking it.`,
    "",
    `Board: ${params.boardTitle} (${params.boardId})`,
    `Task ID: ${params.task.taskId}`,
    `Title: ${params.task.title}`,
    `Description: ${params.task.description}`,
    `Project: ${params.task.project}`,
    `Status: ${params.task.status}`,
    `Owner: @${params.task.owner}`,
    `Assigned to: @${params.task.assignedTo}`,
    `Created at: ${params.task.createdAt}`,
    "Artifacts:",
    artifacts,
    "Worklog:",
    worklog,
  ].join("\n");
}

function buildInactiveAgentMessage(params: {
  managerAgentId: string;
  subjectAgentId: string;
  subjectName: string;
  role: string;
  inactiveMinutes: number;
  lastActionTimestamp?: number;
}): string {
  const lastAction =
    typeof params.lastActionTimestamp === "number" &&
    Number.isFinite(params.lastActionTimestamp)
      ? new Date(params.lastActionTimestamp).toISOString()
      : "No recorded assistant actions yet";
  return [
    `Your reportee "@${params.subjectAgentId}" (${params.subjectName}) has no activity in the last ${params.inactiveMinutes} minutes.`,
    `Role: ${params.role}`,
    `Last action: ${lastAction}`,
    `Manager: @${params.managerAgentId}`,
    "Please check in and unblock progress.",
  ].join("\n");
}

type AgentReportNode = {
  agentId: string;
  metadata: {
    reportsTo: string | null;
  };
};

function assertAgentExists(
  manifests: AgentReportNode[],
  agentId: string,
): void {
  if (manifests.some((manifest) => manifest.agentId === agentId)) {
    return;
  }
  throw new Error(`Agent "${agentId}" does not exist.`);
}

function collectAllReportees(
  manifests: AgentReportNode[],
  managerAgentId: string,
): string[] {
  const byManager = new Map<string, string[]>();
  for (const manifest of manifests) {
    const reportsTo = manifest.metadata.reportsTo;
    if (!reportsTo) {
      continue;
    }
    const reportees = byManager.get(reportsTo) ?? [];
    reportees.push(manifest.agentId);
    byManager.set(reportsTo, reportees);
  }

  const visited = new Set<string>();
  const queue = [...(byManager.get(managerAgentId) ?? [])];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || current === managerAgentId || visited.has(current)) {
      continue;
    }
    visited.add(current);
    queue.push(...(byManager.get(current) ?? []));
  }

  return [...visited].sort((left, right) => left.localeCompare(right));
}

function prepareOpenClawCommandEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const mergedPath = dedupePathEntries([
    ...resolvePreferredOpenClawCommandPaths(env),
    ...(env.PATH?.split(path.delimiter) ?? []),
  ]);

  return {
    ...env,
    PATH: mergedPath.join(path.delimiter),
  };
}

function resolvePreferredOpenClawCommandPaths(env: NodeJS.ProcessEnv): string[] {
  const homeDir = homedir();
  const preferredPaths: string[] = [
    path.dirname(process.execPath),
    path.join(homeDir, ".npm-global", "bin"),
    path.join(homeDir, ".npm", "bin"),
    path.join(homeDir, ".local", "bin"),
    path.join(homeDir, ".volta", "bin"),
    path.join(homeDir, ".fnm", "current", "bin"),
    path.join(homeDir, ".asdf", "shims"),
    path.join(homeDir, "bin"),
  ];

  const npmPrefixCandidates = dedupePathEntries([
    env.npm_config_prefix ?? "",
    env.NPM_CONFIG_PREFIX ?? "",
    process.env.npm_config_prefix ?? "",
    process.env.NPM_CONFIG_PREFIX ?? "",
  ]);
  for (const prefix of npmPrefixCandidates) {
    preferredPaths.push(path.join(prefix, "bin"));
  }

  if (process.platform === "darwin") {
    preferredPaths.push(
      "/opt/homebrew/bin",
      "/opt/homebrew/opt/node@22/bin",
      "/usr/local/opt/node@22/bin",
    );
  }

  return preferredPaths;
}

function dedupePathEntries(entries: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const rawEntry of entries) {
    const entry = rawEntry.trim();
    if (!entry || seen.has(entry)) {
      continue;
    }
    seen.add(entry);
    deduped.push(entry);
  }
  return deduped;
}

function isSpawnPermissionOrMissing(
  error: unknown,
): error is NodeJS.ErrnoException {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (((error as NodeJS.ErrnoException).code ?? "") === "ENOENT" ||
      ((error as NodeJS.ErrnoException).code ?? "") === "EACCES")
  );
}
