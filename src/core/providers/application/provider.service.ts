import { DEFAULT_BOOTSTRAP_MAX_CHARS, WorkspaceContextService } from "../../agents/index.js";
import type { OpenGoatPaths } from "../../domain/opengoat-paths.js";
import type { FileSystemPort } from "../../ports/file-system.port.js";
import type { PathPort } from "../../ports/path.port.js";
import type { AgentSkillsConfig, SkillService } from "../../skills/index.js";
import {
  AgentConfigNotFoundError,
  DEFAULT_PROVIDER_ID,
  InvalidAgentConfigError,
  InvalidProviderConfigError,
  listProviderSummaries,
  type AgentProviderBinding,
  type ProviderAuthOptions,
  type ProviderExecutionResult,
  type ProviderOnboardingSpec,
  type ProviderInvokeOptions,
  type ProviderSummary,
  type ProviderRegistry
} from "../index.js";

interface ProviderServiceDeps {
  fileSystem: FileSystemPort;
  pathPort: PathPort;
  providerRegistry: Promise<ProviderRegistry> | ProviderRegistry;
  workspaceContextService: WorkspaceContextService;
  skillService: SkillService;
  nowIso: () => string;
}

interface AgentConfigShape {
  displayName?: string;
  prompt?: {
    bootstrapFiles?: string[];
  };
  runtime?: {
    bootstrapMaxChars?: number;
    skills?: AgentSkillsConfig;
  };
  provider?: {
    id?: string;
    updatedAt?: string;
  };
  [key: string]: unknown;
}

export interface ProviderStoredConfig {
  schemaVersion: number;
  providerId: string;
  env: Record<string, string>;
  updatedAt: string;
}

export class ProviderService {
  private readonly fileSystem: FileSystemPort;
  private readonly pathPort: PathPort;
  private readonly providerRegistry: Promise<ProviderRegistry>;
  private readonly workspaceContextService: WorkspaceContextService;
  private readonly skillService: SkillService;
  private readonly nowIso: () => string;

  public constructor(deps: ProviderServiceDeps) {
    this.fileSystem = deps.fileSystem;
    this.pathPort = deps.pathPort;
    this.providerRegistry = Promise.resolve(deps.providerRegistry);
    this.workspaceContextService = deps.workspaceContextService;
    this.skillService = deps.skillService;
    this.nowIso = deps.nowIso;
  }

  public async listProviders(): Promise<ProviderSummary[]> {
    const registry = await this.providerRegistry;
    return listProviderSummaries(registry);
  }

  public async getProviderOnboarding(providerId: string): Promise<ProviderOnboardingSpec | undefined> {
    const registry = await this.providerRegistry;
    return registry.getProviderOnboarding(providerId);
  }

  public async invokeProviderAuth(
    paths: OpenGoatPaths,
    providerId: string,
    options: ProviderAuthOptions = {}
  ): Promise<ProviderExecutionResult> {
    const registry = await this.providerRegistry;
    const provider = registry.create(providerId);
    const env = await this.resolveProviderEnv(paths, provider.id, options.env);
    return provider.invokeAuth?.({
      ...options,
      env
    }) ?? {
      code: 1,
      stdout: "",
      stderr: `${provider.id} does not support auth\n`
    };
  }

  public async getProviderConfig(
    paths: OpenGoatPaths,
    providerId: string
  ): Promise<ProviderStoredConfig | null> {
    const configPath = this.getProviderConfigPath(paths, providerId);
    const exists = await this.fileSystem.exists(configPath);
    if (!exists) {
      return null;
    }

    const raw = await this.fileSystem.readFile(configPath);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      throw new InvalidProviderConfigError(providerId, configPath);
    }

    if (!isProviderStoredConfig(parsed)) {
      throw new InvalidProviderConfigError(providerId, configPath, "schema mismatch");
    }

    return parsed;
  }

  public async setProviderConfig(
    paths: OpenGoatPaths,
    providerId: string,
    env: Record<string, string>
  ): Promise<ProviderStoredConfig> {
    const registry = await this.providerRegistry;
    const provider = registry.create(providerId);
    const providerDir = this.pathPort.join(paths.providersDir, provider.id);
    const configPath = this.getProviderConfigPath(paths, provider.id);
    const existing = await this.getProviderConfig(paths, provider.id);

    const mergedEnv = sanitizeEnvMap({
      ...(existing?.env ?? {}),
      ...env
    });

    const next: ProviderStoredConfig = {
      schemaVersion: 1,
      providerId: provider.id,
      env: mergedEnv,
      updatedAt: this.nowIso()
    };

    await this.fileSystem.ensureDir(providerDir);
    await this.fileSystem.writeFile(configPath, `${JSON.stringify(next, null, 2)}\n`);
    return next;
  }

  public async getAgentProvider(
    paths: OpenGoatPaths,
    agentId: string,
    configOverride?: AgentConfigShape
  ): Promise<AgentProviderBinding> {
    const registry = await this.providerRegistry;
    const config = configOverride ?? (await this.readAgentConfig(paths, agentId));
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
    const config = await this.readAgentConfig(paths, agentId);
    const binding = await this.getAgentProvider(paths, agentId, config);
    const provider = registry.create(binding.providerId);

    const workspaceDir = this.pathPort.join(paths.workspacesDir, agentId);
    const bootstrapFiles = await this.workspaceContextService.loadWorkspaceBootstrapFiles(
      workspaceDir,
      this.workspaceContextService.resolveBootstrapFileNames(config.prompt?.bootstrapFiles)
    );
    const contextFiles = this.workspaceContextService.buildContextFiles(bootstrapFiles, {
      maxChars: resolveBootstrapMaxChars(config.runtime?.bootstrapMaxChars)
    });
    const systemPrompt = this.workspaceContextService.buildSystemPrompt({
      agentId,
      displayName: config.displayName?.trim() || agentId,
      workspaceDir,
      nowIso: this.nowIso(),
      contextFiles
    });
    const skillsPrompt = await this.skillService.buildSkillsPrompt(paths, agentId, config.runtime?.skills);
    const sessionContext = options.sessionContext?.trim();
    const mergedSystemPrompt = [
      systemPrompt,
      skillsPrompt.prompt.trim(),
      sessionContext ? ["## Session Context", sessionContext].join("\n") : ""
    ]
      .filter(Boolean)
      .join("\n\n");

    const invokeOptions: ProviderInvokeOptions = {
      ...options,
      systemPrompt: mergedSystemPrompt,
      cwd: options.cwd || workspaceDir,
      env: await this.resolveProviderEnv(paths, provider.id, options.env),
      agent: provider.capabilities.agent ? options.agent || agentId : options.agent
    };

    const result = await provider.invoke(invokeOptions);

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

    const raw = await this.fileSystem.readFile(configPath);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      throw new InvalidAgentConfigError(agentId, configPath);
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new InvalidAgentConfigError(agentId, configPath, "expected JSON object");
    }

    return parsed as AgentConfigShape;
  }

  private getAgentConfigPath(paths: OpenGoatPaths, agentId: string): string {
    return this.pathPort.join(paths.agentsDir, agentId, "config.json");
  }

  private getProviderConfigPath(paths: OpenGoatPaths, providerId: string): string {
    return this.pathPort.join(paths.providersDir, providerId, "config.json");
  }

  private async resolveProviderEnv(
    paths: OpenGoatPaths,
    providerId: string,
    inputEnv: NodeJS.ProcessEnv | undefined
  ): Promise<NodeJS.ProcessEnv> {
    const config = await this.getProviderConfig(paths, providerId);
    return {
      ...(config?.env ?? {}),
      ...(inputEnv ?? process.env)
    };
  }
}

function getConfiguredProviderId(config: AgentConfigShape): string {
  const providerId = config.provider?.id?.trim().toLowerCase();
  return providerId || DEFAULT_PROVIDER_ID;
}

function resolveBootstrapMaxChars(raw: number | undefined): number {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw);
  }

  return DEFAULT_BOOTSTRAP_MAX_CHARS;
}

function isProviderStoredConfig(value: unknown): value is ProviderStoredConfig {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as {
    schemaVersion?: unknown;
    providerId?: unknown;
    env?: unknown;
    updatedAt?: unknown;
  };

  if (record.schemaVersion !== 1) {
    return false;
  }

  if (typeof record.providerId !== "string" || !record.providerId.trim()) {
    return false;
  }

  if (typeof record.updatedAt !== "string" || !record.updatedAt.trim()) {
    return false;
  }

  if (typeof record.env !== "object" || record.env === null) {
    return false;
  }

  return true;
}

function sanitizeEnvMap(input: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    const normalizedKey = key.trim();
    const normalizedValue = String(value).trim();
    if (!normalizedKey || !normalizedValue) {
      continue;
    }
    sanitized[normalizedKey] = normalizedValue;
  }
  return sanitized;
}
