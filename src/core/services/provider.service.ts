import type { OpenGoatPaths } from "../domain/opengoat-paths.js";
import type { FileSystemPort } from "../ports/file-system.port.js";
import type { PathPort } from "../ports/path.port.js";
import {
  AgentConfigNotFoundError,
  DEFAULT_PROVIDER_ID,
  listProviderSummaries,
  type AgentProviderBinding,
  type ProviderExecutionResult,
  type ProviderInvokeOptions,
  type ProviderSummary,
  type ProviderRegistry
} from "../providers/index.js";

interface ProviderServiceDeps {
  fileSystem: FileSystemPort;
  pathPort: PathPort;
  providerRegistry: Promise<ProviderRegistry> | ProviderRegistry;
  nowIso: () => string;
}

interface AgentConfigShape {
  provider?: {
    id?: string;
    updatedAt?: string;
  };
  [key: string]: unknown;
}

export class ProviderService {
  private readonly fileSystem: FileSystemPort;
  private readonly pathPort: PathPort;
  private readonly providerRegistry: Promise<ProviderRegistry>;
  private readonly nowIso: () => string;

  public constructor(deps: ProviderServiceDeps) {
    this.fileSystem = deps.fileSystem;
    this.pathPort = deps.pathPort;
    this.providerRegistry = Promise.resolve(deps.providerRegistry);
    this.nowIso = deps.nowIso;
  }

  public async listProviders(): Promise<ProviderSummary[]> {
    const registry = await this.providerRegistry;
    return listProviderSummaries(registry);
  }

  public async getAgentProvider(paths: OpenGoatPaths, agentId: string): Promise<AgentProviderBinding> {
    const registry = await this.providerRegistry;
    const config = await this.readAgentConfig(paths, agentId);
    const configuredProviderId = getConfiguredProviderId(config);

    // Validate at read time so invalid configs are surfaced early.
    const provider = registry.create(configuredProviderId);

    return {
      agentId,
      providerId: provider.id
    };
  }

  public async setAgentProvider(
    paths: OpenGoatPaths,
    agentId: string,
    providerId: string
  ): Promise<AgentProviderBinding> {
    const registry = await this.providerRegistry;
    const provider = registry.create(providerId);
    const configPath = this.getAgentConfigPath(paths, agentId);
    const config = await this.readAgentConfig(paths, agentId);

    config.provider = {
      id: provider.id,
      updatedAt: this.nowIso()
    };

    await this.fileSystem.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);

    return {
      agentId,
      providerId: provider.id
    };
  }

  public async invokeAgent(
    paths: OpenGoatPaths,
    agentId: string,
    options: ProviderInvokeOptions
  ): Promise<ProviderExecutionResult & AgentProviderBinding> {
    const registry = await this.providerRegistry;
    const binding = await this.getAgentProvider(paths, agentId);
    const provider = registry.create(binding.providerId);

    const result = await provider.invoke(options);

    return {
      ...result,
      ...binding
    };
  }

  private async readAgentConfig(paths: OpenGoatPaths, agentId: string): Promise<AgentConfigShape> {
    const configPath = this.getAgentConfigPath(paths, agentId);
    const exists = await this.fileSystem.exists(configPath);
    if (!exists) {
      throw new AgentConfigNotFoundError(agentId);
    }

    try {
      const raw = await this.fileSystem.readFile(configPath);
      const parsed = JSON.parse(raw) as unknown;

      if (!parsed || typeof parsed !== "object") {
        return {};
      }

      return parsed as AgentConfigShape;
    } catch {
      return {};
    }
  }

  private getAgentConfigPath(paths: OpenGoatPaths, agentId: string): string {
    return this.pathPort.join(paths.agentsDir, agentId, "config.json");
  }
}

function getConfiguredProviderId(config: AgentConfigShape): string {
  const providerId = config.provider?.id?.trim().toLowerCase();
  return providerId || DEFAULT_PROVIDER_ID;
}
