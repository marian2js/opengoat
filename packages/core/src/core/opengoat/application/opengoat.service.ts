import type {
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
  ProviderExecutionResult,
  ProviderAuthOptions,
  ProviderInvokeOptions,
  ProviderOnboardingSpec,
  ProviderRegistry,
  ProviderStoredConfig,
  ProviderSummary
} from "../../providers/index.js";
import { createDefaultProviderRegistry } from "../../providers/index.js";
import { AgentManifestService } from "../../agents/application/agent-manifest.service.js";
import { AgentService } from "../../agents/application/agent.service.js";
import { WorkspaceContextService } from "../../agents/application/workspace-context.service.js";
import { BootstrapService } from "../../bootstrap/application/bootstrap.service.js";
import { OrchestrationService, type OrchestrationRunResult, type RoutingDecision } from "../../orchestration/index.js";
import { ProviderService } from "../../providers/application/provider.service.js";
import { SkillService, type InstallSkillRequest, type InstallSkillResult, type ResolvedSkill } from "../../skills/index.js";
import {
  PluginService,
  type OpenClawPluginInfoRecord,
  type OpenClawPluginListReport,
  type PluginInstallRequest,
  type PluginInstallResult
} from "../../plugins/index.js";
import {
  SessionService,
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
  pluginService?: PluginService;
  logger?: Logger;
}

export class OpenGoatService {
  private readonly pathsProvider: OpenGoatPathsProvider;
  private readonly agentService: AgentService;
  private readonly agentManifestService: AgentManifestService;
  private readonly bootstrapService: BootstrapService;
  private readonly providerService: ProviderService;
  private readonly pluginService: PluginService;
  private readonly skillService: SkillService;
  private readonly sessionService: SessionService;
  private readonly orchestrationService: OrchestrationService;

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
    const workspaceContextService = new WorkspaceContextService({
      fileSystem: deps.fileSystem,
      pathPort: deps.pathPort
    });
    this.pluginService =
      deps.pluginService ??
      new PluginService({
        fileSystem: deps.fileSystem,
        pathPort: deps.pathPort,
        commandRunner: deps.commandRunner
      });
    this.skillService = new SkillService({
      fileSystem: deps.fileSystem,
      pathPort: deps.pathPort,
      pluginSkillDirsProvider: (paths) => this.pluginService.resolvePluginSkillDirectories(paths)
    });
    this.providerService = new ProviderService({
      fileSystem: deps.fileSystem,
      pathPort: deps.pathPort,
      providerRegistry: providerRegistryFactory,
      workspaceContextService,
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
    this.orchestrationService = new OrchestrationService({
      providerService: this.providerService,
      skillService: this.skillService,
      agentManifestService: this.agentManifestService,
      sessionService: this.sessionService,
      commandRunner: deps.commandRunner,
      fileSystem: deps.fileSystem,
      pathPort: deps.pathPort,
      nowIso,
      logger: rootLogger.child({ scope: "orchestration" })
    });
  }

  public initialize(): Promise<InitializationResult> {
    return this.bootstrapService.initialize();
  }

  public async createAgent(rawName: string, options: CreateAgentOptions = {}): Promise<AgentCreationResult> {
    const requestedProviderId = options.providerId?.trim();
    if (requestedProviderId && options.createExternalAgent === true) {
      const supportsRequestedProvider = await this.providerSupportsExternalAgentCreation(
        requestedProviderId
      );
      if (!supportsRequestedProvider) {
        throw new Error(
          `Provider "${requestedProviderId}" does not support external agent creation.`
        );
      }
    }

    const identity = this.agentService.normalizeAgentName(rawName);
    const paths = this.pathsProvider.getPaths();
    const created = await this.agentService.ensureAgent(paths, identity);
    let binding: AgentProviderBinding | undefined;

    if (requestedProviderId) {
      binding = await this.providerService.setAgentProvider(paths, created.agent.id, requestedProviderId);
      await this.agentManifestService.syncManifestProvider(paths, created.agent.id, binding.providerId);
    }

    const shouldCreateExternalAgentByDefault = Boolean(requestedProviderId)
      ? options.createExternalAgent !== false
      : false;
    const shouldCreateExternalAgentExplicitlyWithoutProvider =
      !requestedProviderId && options.createExternalAgent === true;
    if (!shouldCreateExternalAgentByDefault && !shouldCreateExternalAgentExplicitlyWithoutProvider) {
      return created;
    }

    const resolvedBinding =
      binding ?? (await this.providerService.getAgentProvider(paths, created.agent.id));
    const supportsExternalAgentCreation = await this.providerSupportsExternalAgentCreation(
      resolvedBinding.providerId
    );
    if (options.createExternalAgent === true && !supportsExternalAgentCreation) {
      throw new Error(
        `Provider "${resolvedBinding.providerId}" does not support external agent creation.`
      );
    }
    if (!supportsExternalAgentCreation) {
      return created;
    }

    const externalAgentCreation = await this.providerService.createProviderAgent(paths, created.agent.id, {
      providerId: resolvedBinding.providerId,
      displayName: created.agent.displayName,
      workspaceDir: created.agent.workspaceDir,
      internalConfigDir: created.agent.internalConfigDir
    });

    return {
      ...created,
      externalAgentCreation: {
        providerId: externalAgentCreation.providerId,
        code: externalAgentCreation.code,
        stdout: externalAgentCreation.stdout,
        stderr: externalAgentCreation.stderr
      }
    };
  }

  private async providerSupportsExternalAgentCreation(providerId: string): Promise<boolean> {
    const providers = await this.providerService.listProviders();
    const provider = providers.find((entry) => entry.id === providerId);
    return Boolean(provider?.capabilities.agentCreate);
  }

  public async deleteAgent(rawAgentId: string, options: DeleteAgentOptions = {}): Promise<AgentDeletionResult> {
    const paths = this.pathsProvider.getPaths();
    const agentId = normalizeAgentId(rawAgentId);
    if (!agentId) {
      throw new Error("Agent id cannot be empty.");
    }

    let externalProviderId = options.providerId?.trim().toLowerCase();
    if (options.deleteExternalAgent && !externalProviderId) {
      const binding = await this.providerService.getAgentProvider(paths, agentId);
      externalProviderId = binding.providerId;
    }

    const removed = await this.agentService.removeAgent(paths, agentId);
    if (!options.deleteExternalAgent) {
      return removed;
    }

    const externalAgentDeletion = await this.providerService.deleteProviderAgent(paths, agentId, {
      providerId: externalProviderId
    });

    return {
      ...removed,
      externalAgentDeletion: {
        providerId: externalAgentDeletion.providerId,
        code: externalAgentDeletion.code,
        stdout: externalAgentDeletion.stdout,
        stderr: externalAgentDeletion.stderr
      }
    };
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
    const binding = await this.providerService.setAgentProvider(paths, agentId, providerId);
    await this.agentManifestService.syncManifestProvider(paths, binding.agentId, binding.providerId);
    return binding;
  }

  public async routeMessage(agentId: string, message: string): Promise<RoutingDecision> {
    const paths = this.pathsProvider.getPaths();
    return this.orchestrationService.routeMessage(paths, agentId, message);
  }

  public async runAgent(
    agentId: string,
    options: ProviderInvokeOptions
  ): Promise<OrchestrationRunResult> {
    const paths = this.pathsProvider.getPaths();
    return this.orchestrationService.runAgent(paths, agentId, options);
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

  public async listPlugins(options: {
    enabledOnly?: boolean;
    verbose?: boolean;
    includeBundled?: boolean;
  } = {}): Promise<OpenClawPluginListReport> {
    const paths = this.pathsProvider.getPaths();
    return this.pluginService.listPlugins(paths, options);
  }

  public async getPluginInfo(pluginId: string): Promise<OpenClawPluginInfoRecord> {
    const paths = this.pathsProvider.getPaths();
    return this.pluginService.getPluginInfo(paths, pluginId);
  }

  public async installPlugin(request: PluginInstallRequest): Promise<PluginInstallResult> {
    const paths = this.pathsProvider.getPaths();
    return this.pluginService.installPlugin(paths, request);
  }

  public async enablePlugin(pluginId: string): Promise<void> {
    const paths = this.pathsProvider.getPaths();
    await this.pluginService.enablePlugin(paths, pluginId);
  }

  public async disablePlugin(pluginId: string): Promise<void> {
    const paths = this.pathsProvider.getPaths();
    await this.pluginService.disablePlugin(paths, pluginId);
  }

  public async pluginDoctor(): Promise<CommandRunResult> {
    const paths = this.pathsProvider.getPaths();
    return this.pluginService.doctor(paths);
  }

  public async listSessions(agentId = DEFAULT_AGENT_ID, options: { activeMinutes?: number } = {}): Promise<SessionSummary[]> {
    const paths = this.pathsProvider.getPaths();
    return this.sessionService.listSessions(paths, agentId, options);
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
