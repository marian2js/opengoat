import type { AgentCreationResult, AgentDescriptor } from "../domain/agent.js";
import type { InitializationResult } from "../domain/opengoat-paths.js";
import type { FileSystemPort } from "../ports/file-system.port.js";
import type { PathPort } from "../ports/path.port.js";
import type { OpenGoatPathsProvider } from "../ports/paths-provider.port.js";
import type {
  AgentProviderBinding,
  ProviderExecutionResult,
  ProviderInvokeOptions,
  ProviderRegistry,
  ProviderSummary
} from "../providers/index.js";
import { createDefaultProviderRegistry } from "../providers/index.js";
import { AgentService } from "./agent.service.js";
import { BootstrapService } from "./bootstrap.service.js";
import { ProviderService } from "./provider.service.js";

interface OpenGoatServiceDeps {
  fileSystem: FileSystemPort;
  pathPort: PathPort;
  pathsProvider: OpenGoatPathsProvider;
  nowIso?: () => string;
  providerRegistry?: ProviderRegistry;
}

export class OpenGoatService {
  private readonly pathsProvider: OpenGoatPathsProvider;
  private readonly agentService: AgentService;
  private readonly bootstrapService: BootstrapService;
  private readonly providerService: ProviderService;

  public constructor(deps: OpenGoatServiceDeps) {
    const nowIso = deps.nowIso ?? (() => new Date().toISOString());
    const providerRegistryPromise = deps.providerRegistry
      ? Promise.resolve(deps.providerRegistry)
      : createDefaultProviderRegistry();

    this.pathsProvider = deps.pathsProvider;
    this.agentService = new AgentService({
      fileSystem: deps.fileSystem,
      pathPort: deps.pathPort,
      nowIso
    });
    this.bootstrapService = new BootstrapService({
      fileSystem: deps.fileSystem,
      pathsProvider: deps.pathsProvider,
      agentService: this.agentService,
      nowIso
    });
    this.providerService = new ProviderService({
      fileSystem: deps.fileSystem,
      pathPort: deps.pathPort,
      providerRegistry: providerRegistryPromise,
      nowIso
    });
  }

  public initialize(): Promise<InitializationResult> {
    return this.bootstrapService.initialize();
  }

  public async createAgent(rawName: string): Promise<AgentCreationResult> {
    const identity = this.agentService.normalizeAgentName(rawName);
    const paths = this.pathsProvider.getPaths();
    return this.agentService.ensureAgent(paths, identity);
  }

  public async listAgents(): Promise<AgentDescriptor[]> {
    const paths = this.pathsProvider.getPaths();
    return this.agentService.listAgents(paths);
  }

  public listProviders(): Promise<ProviderSummary[]> {
    return this.providerService.listProviders();
  }

  public async getAgentProvider(agentId: string): Promise<AgentProviderBinding> {
    const paths = this.pathsProvider.getPaths();
    return this.providerService.getAgentProvider(paths, agentId);
  }

  public async setAgentProvider(agentId: string, providerId: string): Promise<AgentProviderBinding> {
    const paths = this.pathsProvider.getPaths();
    return this.providerService.setAgentProvider(paths, agentId, providerId);
  }

  public async runAgent(
    agentId: string,
    options: ProviderInvokeOptions
  ): Promise<ProviderExecutionResult & AgentProviderBinding> {
    const paths = this.pathsProvider.getPaths();
    return this.providerService.invokeAgent(paths, agentId, options);
  }

  public getHomeDir(): string {
    return this.pathsProvider.getPaths().homeDir;
  }
}
