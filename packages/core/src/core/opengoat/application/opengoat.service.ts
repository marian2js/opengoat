import { AgentManifestService } from "../../agents/application/agent-manifest.service.js";
import { AgentService } from "../../agents/application/agent.service.js";
import {
  BoardService,
  type CreateTaskOptions,
  type ListTasksOptions,
  type TaskRecord,
} from "../../boards/index.js";
import { BootstrapService } from "../../bootstrap/application/bootstrap.service.js";
import {
  DEFAULT_AGENT_ID,
  isDefaultAgentId,
  normalizeAgentId,
} from "../../domain/agent-id.js";
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
import { dirname, resolve as resolvePath } from "node:path";
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
import {
  assertAgentExists,
  buildBlockedTaskMessage,
  buildInactiveAgentMessage,
  buildNotificationSessionRef,
  buildPendingTaskMessage,
  buildReporteeStats,
  buildTodoTaskMessage,
  collectAllReportees,
  containsAgentNotFoundMessage,
  containsAlreadyExistsMessage,
  extractManagedSkillsDir,
  extractOpenClawAgentEntry,
  extractOpenClawAgents,
  isSpawnPermissionOrMissing,
  pathIsWithin,
  pathMatches,
  prepareOpenClawCommandEnv,
  resolveInactiveAgentNotificationTarget,
  resolveInactiveMinutes,
  resolveMaxParallelFlows,
  toErrorMessage,
  type OpenClawAgentPathEntry,
} from "./opengoat.service.helpers.js";

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
const OPENCLAW_AGENT_SANDBOX_MODE = "off";
const OPENCLAW_AGENT_TOOLS_ALLOW_ALL_JSON = "[\"*\"]";
const OPENCLAW_OPENGOAT_PLUGIN_ID = "openclaw-plugin";
const OPENCLAW_OPENGOAT_PLUGIN_ROOT_ID = "opengoat-plugin";
const OPENCLAW_OPENGOAT_PLUGIN_LEGACY_PACK_ID = "openclaw-plugin-pack";
const OPENCLAW_OPENGOAT_PLUGIN_FALLBACK_ID = "workspace";

export interface RuntimeDefaultsSyncResult {
  ceoSyncCode?: number;
  ceoSynced: boolean;
  warnings: string[];
}

export interface TaskCronDispatchResult {
  kind: "todo" | "pending" | "blocked" | "inactive";
  targetAgentId: string;
  sessionRef: string;
  taskId?: string;
  subjectAgentId?: string;
  message?: string;
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

export type InactiveAgentNotificationTarget = "all-managers" | "ceo-only";

interface InactiveAgentCandidate {
  managerAgentId: string;
  subjectAgentId: string;
  subjectName: string;
  role: string;
  directReporteesCount: number;
  indirectReporteesCount: number;
  lastActionTimestamp?: number;
}

interface TaskStatusDispatchSummary {
  dispatches: TaskCronDispatchResult[];
  todoTasks: number;
  pendingTasks: number;
  blockedTasks: number;
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
      pathPort: deps.pathPort,
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
    return this.initializeRuntimeDefaults();
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
    await this.addWorkspaceAgentCandidates(
      paths,
      candidateOpenClawAgentIds,
      warnings,
    );

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
    let localAgents: AgentDescriptor[] = [];

    const ceoExists = (await this.agentService.listAgents(paths)).some(
      (agent) => agent.id === DEFAULT_AGENT_ID,
    );
    if (!ceoExists) {
      await this.agentService.ensureAgent(
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

    let openClawAgentEntriesById:
      | Map<string, OpenClawAgentPathEntry>
      | undefined;
    try {
      openClawAgentEntriesById = new Map(
        (await this.listOpenClawAgents(paths)).map((entry) => [entry.id, entry]),
      );
    } catch (error) {
      warnings.push(
        `OpenClaw startup inventory check failed: ${toErrorMessage(error)}`,
      );
    }

    try {
      localAgents = await this.agentService.listAgents(paths);
      for (const agent of localAgents) {
        const sync = await this.syncOpenClawAgentRegistration(paths, {
          descriptor: agent,
          existingEntry: openClawAgentEntriesById?.get(agent.id),
        });
        warnings.push(...sync.warnings);
        if (agent.id === DEFAULT_AGENT_ID) {
          ceoSynced = sync.synced;
          ceoSyncCode = sync.code;
        }
      }
    } catch (error) {
      warnings.push(
        `OpenClaw startup sync failed: ${toErrorMessage(error)}`,
      );
    }

    try {
      warnings.push(
        ...(await this.syncOpenClawAgentExecutionPolicies(
          paths,
          localAgents.map((agent) => agent.id),
        )),
      );
    } catch (error) {
      warnings.push(
        `OpenClaw agent policy sync failed: ${toErrorMessage(error)}`,
      );
    }

    try {
      warnings.push(...(await this.ensureOpenGoatPluginToolsRegistered(paths)));
    } catch (error) {
      warnings.push(
        `OpenClaw plugin tool sync failed: ${toErrorMessage(error)}`,
      );
    }

    try {
      const agents = await this.agentService.listAgents(paths);
      for (const agent of agents) {
        await this.agentService.ensureAgentWorkspaceCommandShim(
          paths,
          agent.id,
        );
      }
    } catch (error) {
      warnings.push(
        `OpenGoat workspace command shim sync failed: ${toErrorMessage(error)}`,
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
    const managerAgentId = resolveCreateAgentManagerId(
      identity.id,
      options.reportsTo,
    );
    if (managerAgentId) {
      await this.assertManagerSupportsReportees(managerAgentId);
    }
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
    await this.syncOpenClawAgentExecutionPolicies(paths, [created.agent.id]);
    try {
      const workspaceBootstrap =
        await this.agentService.ensureAgentWorkspaceBootstrap(paths, {
          agentId: created.agent.id,
          displayName: created.agent.displayName,
          role:
            options.role?.trim() ??
            (created.alreadyExisted ? created.agent.role : ""),
        }, {
          syncBootstrapMarkdown: false,
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
    const reporteeStats = buildReporteeStats(manifests);

    const descriptorsById = new Map(agents.map((agent) => [agent.id, agent]));
    const agent = descriptorsById.get(agentId);
    if (!agent) {
      throw new Error(`Agent "${agentId}" does not exist.`);
    }

    const totalReportees = reporteeStats.totalByManager.get(agentId) ?? 0;
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
          totalReportees:
            reporteeStats.totalByManager.get(manifest.agentId) ?? 0,
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
    const binding = await this.providerService.setAgentProvider(
      paths,
      agentId,
      providerId,
    );
    await this.ensureAgentProviderRoleSkills(paths, binding.agentId);
    return binding;
  }

  public async getOpenClawGatewayConfig(): Promise<OpenClawGatewayConfig> {
    const paths = this.pathsProvider.getPaths();
    return this.providerService.getOpenClawGatewayConfig(paths, process.env);
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

  public async createTask(
    actorId: string,
    options: CreateTaskOptions,
  ): Promise<TaskRecord> {
    const paths = this.pathsProvider.getPaths();
    return this.boardService.createTask(paths, actorId, options);
  }

  public async listTasks(
    options: ListTasksOptions = {},
  ): Promise<TaskRecord[]> {
    const paths = this.pathsProvider.getPaths();
    return this.boardService.listTasks(paths, options);
  }

  public async listLatestTasks(
    options: { assignee?: string; limit?: number } = {},
  ): Promise<TaskRecord[]> {
    const paths = this.pathsProvider.getPaths();
    return this.boardService.listLatestTasks(paths, options);
  }

  public async listLatestTasksPage(
    options: {
      assignee?: string;
      owner?: string;
      status?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{
    tasks: TaskRecord[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const paths = this.pathsProvider.getPaths();
    return this.boardService.listLatestTasksPage(paths, options);
  }

  public async getTask(taskId: string): Promise<TaskRecord> {
    const paths = this.pathsProvider.getPaths();
    return this.boardService.getTask(paths, taskId);
  }

  public async deleteTasks(
    actorId: string,
    taskIds: string[],
  ): Promise<{ deletedTaskIds: string[]; deletedCount: number }> {
    const paths = this.pathsProvider.getPaths();
    return this.boardService.deleteTasks(paths, actorId, taskIds);
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

  private async assertManagerSupportsReportees(
    managerAgentId: string,
  ): Promise<void> {
    const paths = this.pathsProvider.getPaths();
    const agents = await this.agentService.listAgents(paths);
    if (!agents.some((agent) => agent.id === managerAgentId)) {
      return;
    }

    const managerBinding = await this.providerService.getAgentProvider(
      paths,
      managerAgentId,
    );
    const providers = await this.providerService.listProviders();
    const provider = providers.find(
      (candidate) => candidate.id === managerBinding.providerId,
    );
    if (!provider) {
      throw new Error(
        `Provider "${managerBinding.providerId}" is not available for manager "${managerAgentId}".`,
      );
    }

    if (!provider.capabilities.reportees) {
      throw new Error(
        `Cannot assign "${managerAgentId}" as manager because provider "${provider.displayName}" does not support reportees.`,
      );
    }
  }

  public async runTaskCronCycle(
    options: {
      inactiveMinutes?: number;
      notificationTarget?: InactiveAgentNotificationTarget;
      notifyInactiveAgents?: boolean;
      maxParallelFlows?: number;
    } = {},
  ): Promise<TaskCronRunResult> {
    const paths = this.pathsProvider.getPaths();
    const ranAt = this.resolveNowIso();
    const manifests = await this.agentManifestService.listManifests(paths);
    const inactiveMinutes = resolveInactiveMinutes(options.inactiveMinutes);
    const notificationTarget = resolveInactiveAgentNotificationTarget(
      options.notificationTarget,
    );
    const notifyInactiveAgents = options.notifyInactiveAgents ?? true;
    const maxParallelFlows = resolveMaxParallelFlows(options.maxParallelFlows);
    const inactiveCandidates = notifyInactiveAgents
      ? await this.collectInactiveAgents(
          paths,
          manifests,
          inactiveMinutes,
          notificationTarget,
        )
      : [];

    const tasks = await this.boardService.listTasks(paths, { limit: 10_000 });
    const pendingTaskIds = new Set(
      await this.boardService.listPendingTaskIdsOlderThan(
        paths,
        inactiveMinutes,
      ),
    );
    const taskStatusDispatch = await this.dispatchTaskStatusAutomations(
      paths,
      tasks,
      manifests,
      pendingTaskIds,
      inactiveMinutes,
      ranAt,
      maxParallelFlows,
    );
    const inactiveDispatches = await this.dispatchInactiveAgentAutomations(
      paths,
      inactiveCandidates,
      inactiveMinutes,
      ranAt,
      maxParallelFlows,
    );
    const dispatches = [
      ...taskStatusDispatch.dispatches,
      ...inactiveDispatches,
    ];

    const failed = dispatches.filter((entry) => !entry.ok).length;
    return {
      ranAt,
      scannedTasks: tasks.length,
      todoTasks: taskStatusDispatch.todoTasks,
      blockedTasks: taskStatusDispatch.blockedTasks,
      inactiveAgents: inactiveCandidates.length,
      sent: dispatches.length - failed,
      failed,
      dispatches,
    };
  }

  private async dispatchTaskStatusAutomations(
    paths: ReturnType<OpenGoatPathsProvider["getPaths"]>,
    tasks: TaskRecord[],
    manifests: Awaited<ReturnType<AgentManifestService["listManifests"]>>,
    pendingTaskIds: Set<string>,
    pendingMinutes: number,
    notificationTimestamp: string,
    maxParallelFlows: number,
  ): Promise<TaskStatusDispatchSummary> {
    const manifestsById = new Map(
      manifests.map((manifest) => [manifest.agentId, manifest]),
    );
    const requests: Array<{
      kind: "todo" | "pending" | "blocked";
      targetAgentId: string;
      sessionRef: string;
      taskId: string;
      message: string;
    }> = [];
    let todoTasks = 0;
    let pendingTasks = 0;
    let blockedTasks = 0;

    for (const task of tasks) {
      if (task.status === "todo") {
        todoTasks += 1;
        const targetAgentId = task.assignedTo;
        const sessionRef = buildNotificationSessionRef(targetAgentId);
        const message = buildTodoTaskMessage({
          task,
          notificationTimestamp,
        });
        requests.push({
          kind: "todo",
          targetAgentId,
          sessionRef,
          taskId: task.taskId,
          message,
        });
        continue;
      }

      if (task.status === "pending") {
        if (!pendingTaskIds.has(task.taskId)) {
          continue;
        }
        pendingTasks += 1;
        const targetAgentId = task.assignedTo;
        const sessionRef = buildNotificationSessionRef(targetAgentId);
        const message = buildPendingTaskMessage({
          task,
          pendingMinutes,
          notificationTimestamp,
        });
        requests.push({
          kind: "pending",
          targetAgentId,
          sessionRef,
          taskId: task.taskId,
          message,
        });
        continue;
      }

      if (task.status === "blocked") {
        blockedTasks += 1;
        const assigneeManifest = manifestsById.get(task.assignedTo);
        const managerAgentId =
          normalizeAgentId(assigneeManifest?.metadata.reportsTo ?? "") ||
          DEFAULT_AGENT_ID;
        const sessionRef = buildNotificationSessionRef(managerAgentId);
        const message = buildBlockedTaskMessage({
          task,
          notificationTimestamp,
        });
        requests.push({
          kind: "blocked",
          targetAgentId: managerAgentId,
          sessionRef,
          taskId: task.taskId,
          message,
        });
      }
    }

    const dispatches = await runWithConcurrencyByKey(
      requests,
      maxParallelFlows,
      (request) => normalizeAgentId(request.targetAgentId) || DEFAULT_AGENT_ID,
      async (request) => {
        const result = await this.dispatchAutomationMessage(
          paths,
          request.targetAgentId,
          request.sessionRef,
          request.message,
        );
        return {
          kind: request.kind,
          targetAgentId: request.targetAgentId,
          sessionRef: request.sessionRef,
          taskId: request.taskId,
          message: request.message,
          ok: result.ok,
          error: result.error,
        };
      },
    );

    return {
      dispatches,
      todoTasks,
      pendingTasks,
      blockedTasks,
    };
  }

  private async dispatchInactiveAgentAutomations(
    paths: ReturnType<OpenGoatPathsProvider["getPaths"]>,
    inactiveCandidates: InactiveAgentCandidate[],
    inactiveMinutes: number,
    notificationTimestamp: string,
    maxParallelFlows = 1,
  ): Promise<TaskCronDispatchResult[]> {
    return runWithConcurrencyByKey(
      inactiveCandidates,
      maxParallelFlows,
      (candidate) =>
        normalizeAgentId(candidate.managerAgentId) || DEFAULT_AGENT_ID,
      async (candidate) => {
        const sessionRef = buildNotificationSessionRef(
          candidate.managerAgentId,
        );
        const message = buildInactiveAgentMessage({
          managerAgentId: candidate.managerAgentId,
          subjectAgentId: candidate.subjectAgentId,
          subjectName: candidate.subjectName,
          role: candidate.role,
          directReporteesCount: candidate.directReporteesCount,
          indirectReporteesCount: candidate.indirectReporteesCount,
          inactiveMinutes,
          notificationTimestamp,
          lastActionTimestamp: candidate.lastActionTimestamp,
        });
        const result = await this.dispatchAutomationMessage(
          paths,
          candidate.managerAgentId,
          sessionRef,
          message,
        );
        return {
          kind: "inactive",
          targetAgentId: candidate.managerAgentId,
          sessionRef,
          subjectAgentId: candidate.subjectAgentId,
          message,
          ok: result.ok,
          error: result.error,
        };
      },
    );
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

    const executionEnv = prepareOpenClawCommandEnv(options.env ?? process.env);
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
      forceNew?: boolean;
    } = {},
  ): Promise<SessionRunInfo> {
    const paths = this.pathsProvider.getPaths();
    const prepared = await this.sessionService.prepareRunSession(
      paths,
      agentId,
      {
        sessionRef: options.sessionRef,
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
    options: { cwd?: string; disableSession?: boolean } = {},
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      const result = await this.orchestrationService.runAgent(paths, agentId, {
        message,
        sessionRef,
        disableSession: options.disableSession ?? false,
        cwd: options.cwd,
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

  private async initializeRuntimeDefaults(): Promise<InitializationResult> {
    const initialization = await this.bootstrapService.initialize();
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
      const sync = await this.ensureAgentProviderRoleSkills(
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
      "og-boards",
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

  private async ensureAgentProviderRoleSkills(
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
    const runtimeProfile = await this.providerService.getAgentRuntimeProfile(
      paths,
      agentId,
    );
    const managedRoleSkillDirectories =
      await this.providerService.listProviderRoleSkillDirectories();
    return this.agentService.ensureAgentWorkspaceRoleSkills(paths, agentId, {
      requiredSkillDirectories: runtimeProfile.roleSkillDirectories,
      managedSkillDirectories: managedRoleSkillDirectories,
    });
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
    try {
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

      const parsed = parseLooseJson(skillsList.stdout);
      if (parsed === undefined) {
        throw new Error(
          "OpenClaw skills list returned non-JSON output; cannot resolve managed skills directory.",
        );
      }

      const managedSkillsDir = extractManagedSkillsDir(parsed);
      this.openClawManagedSkillsDirCache = managedSkillsDir;
      return managedSkillsDir;
    } catch (error) {
      if (!(error instanceof ProviderCommandNotFoundError)) {
        throw error;
      }
    }

    const skillsStatus = await this.providerService.getOpenClawSkillsStatusViaGateway(
      paths,
      env,
    );
    const managedSkillsDir = extractManagedSkillsDir(skillsStatus);
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
    try {
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

      const parsed = parseLooseJson(listed.stdout);
      if (parsed === undefined) {
        throw new Error(
          "OpenClaw agents list returned non-JSON output; cannot inspect agents.",
        );
      }

      return extractOpenClawAgents(parsed);
    } catch (error) {
      if (!(error instanceof ProviderCommandNotFoundError)) {
        throw error;
      }
    }

    const entries = await this.providerService.listOpenClawAgentsViaGateway(
      paths,
      env,
    );
    return entries.map((entry) => ({
      id: entry.id,
      workspace: entry.workspace,
      agentDir: entry.agentDir,
    }));
  }

  private async addWorkspaceAgentCandidates(
    paths: ReturnType<OpenGoatPathsProvider["getPaths"]>,
    candidates: Set<string>,
    warnings: string[],
  ): Promise<void> {
    try {
      const workspaceDirs = await this.fileSystem.listDirectories(
        paths.workspacesDir,
      );
      for (const workspaceDir of workspaceDirs) {
        const workspaceAgentId = normalizeAgentId(workspaceDir);
        if (
          workspaceAgentId &&
          workspaceAgentId !== OPENCLAW_DEFAULT_AGENT_ID
        ) {
          candidates.add(workspaceAgentId);
        }
      }
    } catch (error) {
      warnings.push(
        `Workspace fallback discovery failed: ${toErrorMessage(error)}`,
      );
    }
  }

  private async syncOpenClawAgentRegistration(
    paths: ReturnType<OpenGoatPathsProvider["getPaths"]>,
    params: {
      descriptor: AgentDescriptor;
      existingEntry?: OpenClawAgentPathEntry;
    },
  ): Promise<{
    synced: boolean;
    code?: number;
    warnings: string[];
  }> {
    const warnings: string[] = [];

    if (
      params.existingEntry &&
      pathMatches(params.existingEntry.workspace, params.descriptor.workspaceDir) &&
      pathMatches(params.existingEntry.agentDir, params.descriptor.internalConfigDir)
    ) {
      return {
        synced: true,
        code: 0,
        warnings,
      };
    }

    let runtimeSync:
      | Awaited<ReturnType<ProviderService["createProviderAgent"]>>
      | undefined;
    try {
      runtimeSync = await this.providerService.createProviderAgent(
        paths,
        params.descriptor.id,
        {
          providerId: OPENCLAW_PROVIDER_ID,
          displayName: params.descriptor.displayName,
          workspaceDir: params.descriptor.workspaceDir,
          internalConfigDir: params.descriptor.internalConfigDir,
        },
      );
    } catch (error) {
      warnings.push(
        `OpenClaw sync for "${params.descriptor.id}" failed: ${toErrorMessage(
          error,
        )}`,
      );
      return {
        synced: false,
        warnings,
      };
    }

    const synced =
      runtimeSync.code === 0 ||
      containsAlreadyExistsMessage(runtimeSync.stdout, runtimeSync.stderr);
    if (!synced) {
      warnings.push(
        `OpenClaw sync for "${params.descriptor.id}" failed (code ${
          runtimeSync.code
        }). ${(runtimeSync.stderr || runtimeSync.stdout).trim()}`,
      );
      return {
        synced,
        code: runtimeSync.code,
        warnings,
      };
    }

    try {
      await this.ensureOpenClawAgentLocation(
        paths,
        {
          agentId: params.descriptor.id,
          displayName: params.descriptor.displayName,
          workspaceDir: params.descriptor.workspaceDir,
          internalConfigDir: params.descriptor.internalConfigDir,
        },
        params.existingEntry,
      );
    } catch (error) {
      warnings.push(
        `OpenClaw location sync for "${
          params.descriptor.id
        }" failed: ${toErrorMessage(error)}`,
      );
    }

    return {
      synced,
      code: runtimeSync.code,
      warnings,
    };
  }

  private async ensureOpenClawAgentLocation(
    paths: ReturnType<OpenGoatPathsProvider["getPaths"]>,
    params: {
      agentId: string;
      displayName: string;
      workspaceDir: string;
      internalConfigDir: string;
    },
    existingEntry?: {
      workspace: string;
      agentDir: string;
    },
  ): Promise<void> {
    if (!this.commandRunner) {
      return;
    }

    const entry =
      existingEntry ??
      (await this.listOpenClawAgents(paths)).find(
        (candidate) => candidate.id === normalizeAgentId(params.agentId),
      );
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

  private async syncOpenClawAgentExecutionPolicies(
    paths: ReturnType<OpenGoatPathsProvider["getPaths"]>,
    rawAgentIds: string[],
  ): Promise<string[]> {
    if (!this.commandRunner) {
      return [];
    }

    const agentIds = [
      ...new Set(
        rawAgentIds
          .map((agentId) => normalizeAgentId(agentId))
          .filter((agentId): agentId is string => Boolean(agentId)),
      ),
    ];
    if (agentIds.length === 0) {
      return [];
    }

    const warnings: string[] = [];
    const env = await this.resolveOpenClawEnv(paths);
    let entries: unknown[];
    try {
      const listResult = await this.runOpenClaw(
        ["config", "get", "agents.list"],
        {
          env,
        },
      );

      if (listResult.code !== 0) {
        warnings.push(
          `OpenClaw config read failed (agents.list, code ${listResult.code}). ${
            listResult.stderr.trim() || listResult.stdout.trim() || ""
          }`.trim(),
        );
        return warnings;
      }

      const parsed = parseLooseJson(listResult.stdout);
      if (parsed === undefined) {
        warnings.push(
          "OpenClaw config read returned non-JSON for agents.list; skipping sandbox/tools policy sync.",
        );
        return warnings;
      }

      if (!Array.isArray(parsed)) {
        warnings.push(
          "OpenClaw config agents.list is not an array; skipping sandbox/tools policy sync.",
        );
        return warnings;
      }

      entries = parsed;
    } catch (error) {
      if (!(error instanceof ProviderCommandNotFoundError)) {
        throw error;
      }
      return this.providerService.syncOpenClawAgentExecutionPoliciesViaGateway(
        paths,
        agentIds,
        env,
      );
    }

    const indexById = new Map<string, number>();
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      if (!entry) {
        continue;
      }
      const id = normalizeAgentConfigEntryId(entry);
      if (!id || indexById.has(id)) {
        continue;
      }
      indexById.set(id, index);
    }

    for (const agentId of agentIds) {
      const index = indexById.get(agentId);
      if (index === undefined) {
        warnings.push(
          `OpenClaw config policy sync skipped for "${agentId}" because no agents.list entry was found.`,
        );
        continue;
      }

      const entry = asRecord(entries[index]);
      if (readAgentSandboxMode(entry) !== OPENCLAW_AGENT_SANDBOX_MODE) {
        const sandboxSet = await this.runOpenClaw(
          ["config", "set", `agents.list[${index}].sandbox.mode`, OPENCLAW_AGENT_SANDBOX_MODE],
          { env },
        );
        if (sandboxSet.code !== 0) {
          warnings.push(
            `OpenClaw sandbox policy sync failed for "${agentId}" (code ${sandboxSet.code}). ${
              sandboxSet.stderr.trim() || sandboxSet.stdout.trim() || ""
            }`.trim(),
          );
        }
      }

      if (!hasAgentToolsAllowAll(entry)) {
        const toolsSet = await this.runOpenClaw(
          ["config", "set", `agents.list[${index}].tools.allow`, OPENCLAW_AGENT_TOOLS_ALLOW_ALL_JSON],
          { env },
        );
        if (toolsSet.code !== 0) {
          warnings.push(
            `OpenClaw tools policy sync failed for "${agentId}" (code ${toolsSet.code}). ${
              toolsSet.stderr.trim() || toolsSet.stdout.trim() || ""
            }`.trim(),
          );
        }
      }
    }

    return warnings;
  }

  private async ensureOpenGoatPluginToolsRegistered(
    paths: ReturnType<OpenGoatPathsProvider["getPaths"]>,
  ): Promise<string[]> {
    if (!this.commandRunner) {
      return [];
    }

    const warnings: string[] = [];
    const env = await this.resolveOpenClawEnv(paths);
    const pluginSourcePath = await this.resolveOpenGoatPluginSourcePath();
    if (!pluginSourcePath) {
      warnings.push(
        "OpenClaw OpenGoat plugin source path was not found; OpenGoat tools may be unavailable to agents.",
      );
      return warnings;
    }

    warnings.push(
      ...(await this.configureOpenClawPluginSourcePath(env, pluginSourcePath)),
    );
    return warnings;
  }

  private async resolveOpenGoatPluginSourcePath(): Promise<string | undefined> {
    const explicit = process.env.OPENGOAT_OPENCLAW_PLUGIN_PATH?.trim();
    const argvEntry = process.argv[1]?.trim();
    const argvDir = argvEntry ? dirname(resolvePath(argvEntry)) : undefined;
    const argvPathCandidates = argvDir
      ? collectPluginPathCandidatesFromArgvDir(argvDir)
      : [];
    const candidates = dedupeStrings([
      explicit,
      ...argvPathCandidates,
      resolvePath(process.cwd(), "packages", "openclaw-plugin"),
      resolvePath(process.cwd(), "dist", "openclaw-plugin"),
      resolvePath(process.cwd(), "node_modules", "@opengoat", "openclaw-plugin"),
      argvDir ? resolvePath(argvDir, "..", "dist", "openclaw-plugin") : undefined,
      argvDir
        ? resolvePath(argvDir, "..", "node_modules", "@opengoat", "openclaw-plugin")
        : undefined,
      argvDir
        ? resolvePath(argvDir, "..", "..", "@opengoat", "openclaw-plugin")
        : undefined,
    ]);

    for (const candidate of candidates) {
      const pluginManifestPath = this.pathPort.join(
        candidate,
        "openclaw.plugin.json",
      );
      if (await this.fileSystem.exists(pluginManifestPath)) {
        return candidate;
      }
    }

    return undefined;
  }

  private async configureOpenClawPluginSourcePath(
    env: NodeJS.ProcessEnv,
    pluginSourcePath: string,
  ): Promise<string[]> {
    const warnings: string[] = [];

    const currentPathsResult = await this.runOpenClaw(
      ["config", "get", "plugins.load.paths"],
      { env },
    );
    const currentPaths =
      currentPathsResult.code === 0
        ? readStringArray(parseLooseJson(currentPathsResult.stdout))
        : [];
    const mergedPaths = await this.mergePluginLoadPaths(
      pluginSourcePath,
      currentPaths,
    );

    if (!samePathList(currentPaths, mergedPaths)) {
      const setPaths = await this.runOpenClaw(
        ["config", "set", "plugins.load.paths", JSON.stringify(mergedPaths)],
        { env },
      );
      if (setPaths.code !== 0) {
        warnings.push(
          `OpenClaw plugin source path update failed (code ${setPaths.code}). ${
            setPaths.stderr.trim() || setPaths.stdout.trim() || ""
          }`.trim(),
        );
      }
    }

    const pluginIds = [
      OPENCLAW_OPENGOAT_PLUGIN_ID,
      OPENCLAW_OPENGOAT_PLUGIN_ROOT_ID,
      OPENCLAW_OPENGOAT_PLUGIN_LEGACY_PACK_ID,
      OPENCLAW_OPENGOAT_PLUGIN_FALLBACK_ID,
    ];
    const enableFailures: string[] = [];
    let pluginEnabled = false;
    let enabledPluginId: string | undefined;

    for (const pluginId of pluginIds) {
      const enablePlugin = await this.runOpenClaw(
        ["config", "set", `plugins.entries.${pluginId}.enabled`, "true"],
        { env },
      );
      if (enablePlugin.code === 0) {
        pluginEnabled = true;
        enabledPluginId = pluginId;
        break;
      }

      const message =
        enablePlugin.stderr.trim() || enablePlugin.stdout.trim() || "";
      if (isPluginNotFoundMessage(message)) {
        continue;
      }

      enableFailures.push(
        `OpenClaw plugin enable failed for "${pluginId}" (code ${enablePlugin.code}). ${message}`.trim(),
      );
    }

    if (!pluginEnabled) {
      if (enableFailures.length === 0) {
        warnings.push(
          `OpenClaw plugin enable failed: no matching plugin id was found (${pluginIds.join(
            ", ",
          )}).`,
        );
      } else {
        warnings.push(...enableFailures);
      }
    }

    if (enabledPluginId) {
      const idsToDisable = pluginIds.filter((pluginId) => pluginId !== enabledPluginId);
      for (const pluginId of idsToDisable) {
        const disablePlugin = await this.runOpenClaw(
          ["config", "set", `plugins.entries.${pluginId}.enabled`, "false"],
          { env },
        );
        if (disablePlugin.code === 0) {
          continue;
        }

        const message =
          disablePlugin.stderr.trim() || disablePlugin.stdout.trim() || "";
        if (isPluginNotFoundMessage(message)) {
          continue;
        }

        warnings.push(
          `OpenClaw plugin cleanup failed for "${pluginId}" (code ${disablePlugin.code}). ${message}`.trim(),
        );
      }
    }

    return warnings;
  }

  private async mergePluginLoadPaths(
    pluginSourcePath: string,
    currentPaths: string[],
  ): Promise<string[]> {
    const merged = dedupeStrings([pluginSourcePath, ...currentPaths]);
    const normalizedPluginSource = resolvePath(pluginSourcePath);
    const filtered: string[] = [];

    for (const candidate of merged) {
      const normalizedCandidate = resolvePath(candidate);
      if (pathMatches(normalizedCandidate, normalizedPluginSource)) {
        filtered.push(candidate);
        continue;
      }

      const manifestId = await this.readPluginManifestId(candidate);
      if (
        manifestId &&
        isOpenGoatPluginId(manifestId)
      ) {
        continue;
      }

      filtered.push(candidate);
    }

    return dedupeStrings(filtered);
  }

  private async readPluginManifestId(path: string): Promise<string | undefined> {
    const manifestPath = this.pathPort.join(path, "openclaw.plugin.json");
    if (!(await this.fileSystem.exists(manifestPath))) {
      return undefined;
    }

    try {
      const raw = await this.fileSystem.readFile(manifestPath);
      const parsed = parseLooseJson(raw);
      const id = asRecord(parsed).id;
      if (typeof id === "string" && id.trim().length > 0) {
        return id.trim();
      }
    } catch {
      // Ignore malformed manifests when cleaning up load paths.
    }

    return undefined;
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
    notificationTarget: InactiveAgentNotificationTarget,
  ): Promise<InactiveAgentCandidate[]> {
    const nowMs = this.resolveNowMs();
    const inactiveCutoffMs = nowMs - inactiveMinutes * 60_000;
    const reporteeStats = buildReporteeStats(manifests);
    const inactive: InactiveAgentCandidate[] = [];

    for (const manifest of manifests) {
      const managerAgentId = normalizeAgentId(
        manifest.metadata.reportsTo ?? "",
      );
      if (!managerAgentId) {
        continue;
      }
      if (
        notificationTarget === "ceo-only" &&
        managerAgentId !== DEFAULT_AGENT_ID
      ) {
        continue;
      }

      const lastAction = await this.sessionService.getLastAgentAction(
        paths,
        manifest.agentId,
      );
      if (lastAction && lastAction.timestamp >= inactiveCutoffMs) {
        continue;
      }
      const directReporteesCount =
        reporteeStats.directByManager.get(manifest.agentId) ?? 0;
      const totalReporteesCount =
        reporteeStats.totalByManager.get(manifest.agentId) ?? 0;
      const indirectReporteesCount = Math.max(
        0,
        totalReporteesCount - directReporteesCount,
      );

      inactive.push({
        managerAgentId,
        subjectAgentId: manifest.agentId,
        subjectName: manifest.metadata.name,
        role: manifest.metadata.description,
        directReporteesCount,
        indirectReporteesCount,
        lastActionTimestamp: lastAction?.timestamp,
      });
    }

    return inactive;
  }

}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function normalizeAgentConfigEntryId(value: unknown): string | undefined {
  const entry = asRecord(value);
  const id = entry.id;
  if (typeof id !== "string") {
    return undefined;
  }
  return normalizeAgentId(id);
}

function readAgentSandboxMode(entry: Record<string, unknown>): string | undefined {
  const sandbox = asRecord(entry.sandbox);
  const mode = sandbox.mode;
  if (typeof mode !== "string") {
    return undefined;
  }
  const trimmed = mode.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function hasAgentToolsAllowAll(entry: Record<string, unknown>): boolean {
  const tools = asRecord(entry.tools);
  const allow = tools.allow;
  if (!Array.isArray(allow)) {
    return false;
  }

  return allow.some(
    (value) => typeof value === "string" && value.trim() === "*",
  );
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
}

async function runWithConcurrency<T, R>(
  items: T[],
  rawConcurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const concurrency = Math.max(1, Math.floor(rawConcurrency));
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const runWorker = async (): Promise<void> => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) {
        return;
      }

      results[currentIndex] = await worker(items[currentIndex]!, currentIndex);
    }
  };

  const workerCount = Math.min(concurrency, items.length);
  const workers = Array.from({ length: workerCount }, () => runWorker());
  await Promise.all(workers);
  return results;
}

async function runWithConcurrencyByKey<T, R>(
  items: T[],
  rawConcurrency: number,
  resolveKey: (item: T, index: number) => string,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const grouped = new Map<string, Array<{ item: T; index: number }>>();
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]!;
    const key = resolveKey(item, index).trim().toLowerCase() || "default";
    const bucket = grouped.get(key) ?? [];
    bucket.push({ item, index });
    grouped.set(key, bucket);
  }

  const results = new Array<R>(items.length);
  await runWithConcurrency(
    [...grouped.values()],
    rawConcurrency,
    async (entries): Promise<void> => {
      for (const entry of entries) {
        results[entry.index] = await worker(entry.item, entry.index);
      }
    },
  );

  return results;
}

function parseLooseJson(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    // continue
  }

  const starts = dedupeNumbers([
    trimmed.indexOf("{"),
    trimmed.indexOf("["),
    trimmed.lastIndexOf("{"),
    trimmed.lastIndexOf("["),
  ]).filter((index) => index >= 0);

  for (const startIndex of starts) {
    const candidate = trimmed.slice(startIndex).trim();
    if (!candidate) {
      continue;
    }
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // keep trying candidates
    }
  }

  return undefined;
}

function dedupeNumbers(values: number[]): number[] {
  return [...new Set(values)];
}

function resolveCreateAgentManagerId(
  agentId: string,
  reportsTo: string | null | undefined,
): string | null {
  const normalizedAgentId = normalizeAgentId(agentId);
  if (isDefaultAgentId(normalizedAgentId)) {
    return null;
  }

  if (reportsTo === null || reportsTo === undefined) {
    return DEFAULT_AGENT_ID;
  }

  const normalizedManagerId = normalizeAgentId(reportsTo);
  if (!normalizedManagerId || normalizedManagerId === normalizedAgentId) {
    return DEFAULT_AGENT_ID;
  }

  return normalizedManagerId;
}

function collectPluginPathCandidatesFromArgvDir(argvDir: string): string[] {
  const maxDepth = 8;
  const candidates: Array<string | undefined> = [];
  let currentDir = argvDir;

  for (let depth = 0; depth < maxDepth; depth += 1) {
    candidates.push(resolvePath(currentDir, "packages", "openclaw-plugin"));
    candidates.push(resolvePath(currentDir, "openclaw-plugin"));

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  return dedupeStrings(candidates);
}

function dedupeStrings(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    deduped.push(trimmed);
  }
  return deduped;
}

function samePathList(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index];
    const rightValue = right[index];
    if (!leftValue || !rightValue || !pathMatches(leftValue, rightValue)) {
      return false;
    }
  }

  return true;
}

function isOpenGoatPluginId(pluginId: string): boolean {
  return [
    OPENCLAW_OPENGOAT_PLUGIN_ID,
    OPENCLAW_OPENGOAT_PLUGIN_ROOT_ID,
    OPENCLAW_OPENGOAT_PLUGIN_LEGACY_PACK_ID,
    OPENCLAW_OPENGOAT_PLUGIN_FALLBACK_ID,
  ].includes(pluginId.trim().toLowerCase());
}

function isPluginNotFoundMessage(message: string): boolean {
  return message.toLowerCase().includes("plugin not found");
}
