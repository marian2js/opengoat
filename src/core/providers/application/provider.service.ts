import { DEFAULT_BOOTSTRAP_MAX_CHARS, WorkspaceContextService } from "../../agents/index.js";
import { isDefaultAgentId } from "../../domain/agent-id.js";
import type { OpenGoatPaths } from "../../domain/opengoat-paths.js";
import { createNoopLogger, type Logger } from "../../logging/index.js";
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
  providerRegistry:
    | Promise<ProviderRegistry>
    | ProviderRegistry
    | (() => Promise<ProviderRegistry> | ProviderRegistry);
  workspaceContextService: WorkspaceContextService;
  skillService: SkillService;
  nowIso: () => string;
  logger?: Logger;
}

interface AgentConfigShape {
  displayName?: string;
  prompt?: {
    bootstrapFiles?: string[];
  };
  runtime?: {
    bootstrapMaxChars?: number;
    skills?: AgentSkillsConfig;
    workspaceAccess?: AgentWorkspaceAccess;
  };
  provider?: {
    id?: string;
    updatedAt?: string;
  };
  [key: string]: unknown;
}

type AgentWorkspaceAccess = "internal" | "external" | "auto";
type ResolvedWorkspaceAccess = Exclude<AgentWorkspaceAccess, "auto">;

export interface AgentRuntimeProfile {
  agentId: string;
  providerId: string;
  providerKind: "cli" | "http";
  workspaceAccess: ResolvedWorkspaceAccess;
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
  private readonly providerRegistryInput:
    | Promise<ProviderRegistry>
    | ProviderRegistry
    | (() => Promise<ProviderRegistry> | ProviderRegistry);
  private providerRegistryPromise?: Promise<ProviderRegistry>;
  private readonly workspaceContextService: WorkspaceContextService;
  private readonly skillService: SkillService;
  private readonly nowIso: () => string;
  private readonly logger: Logger;

  public constructor(deps: ProviderServiceDeps) {
    this.fileSystem = deps.fileSystem;
    this.pathPort = deps.pathPort;
    this.providerRegistryInput = deps.providerRegistry;
    this.workspaceContextService = deps.workspaceContextService;
    this.skillService = deps.skillService;
    this.nowIso = deps.nowIso;
    this.logger = (deps.logger ?? createNoopLogger()).child({ scope: "provider-service" });
  }

  public async listProviders(): Promise<ProviderSummary[]> {
    const registry = await this.getProviderRegistry();
    return listProviderSummaries(registry);
  }

  public async getProviderOnboarding(providerId: string): Promise<ProviderOnboardingSpec | undefined> {
    const registry = await this.getProviderRegistry();
    return registry.getProviderOnboarding(providerId);
  }

  public async invokeProviderAuth(
    paths: OpenGoatPaths,
    providerId: string,
    options: ProviderAuthOptions = {}
  ): Promise<ProviderExecutionResult> {
    const registry = await this.getProviderRegistry();
    const provider = registry.create(providerId);
    const env = await this.resolveProviderEnv(paths, provider.id, options.env);
    this.logger.info("Invoking provider auth.", {
      providerId: provider.id
    });
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
    const registry = await this.getProviderRegistry();
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
    const registry = await this.getProviderRegistry();
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
    const registry = await this.getProviderRegistry();
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
    const registry = await this.getProviderRegistry();
    const config = await this.readAgentConfig(paths, agentId);
    const binding = await this.getAgentProvider(paths, agentId, config);
    const provider = registry.create(binding.providerId);

    const workspaceDir = this.pathPort.join(paths.workspacesDir, agentId);
    const workspaceAccess = resolveWorkspaceAccess(agentId, config.runtime?.workspaceAccess, provider.kind);
    const contextSystemPrompt =
      workspaceAccess === "internal"
        ? await this.buildInternalWorkspacePrompt(
            paths,
            agentId,
            config,
            workspaceDir,
            options.skillsPromptOverride
          )
        : "";
    const sessionContext = options.sessionContext?.trim();
    const sessionContextPrompt = sessionContext ? ["## Session Context", sessionContext].join("\n") : "";
    const mergedSystemPrompt = [
      options.systemPrompt?.trim() || "",
      contextSystemPrompt,
      sessionContextPrompt
    ]
      .filter(Boolean)
      .join("\n\n");
    const resolvedCwd = resolveInvokeCwd(workspaceAccess, options.cwd, workspaceDir);
    const invokeOptions: ProviderInvokeOptions = {
      ...options,
      systemPrompt: mergedSystemPrompt || undefined,
      cwd: resolvedCwd,
      env: await this.resolveProviderEnv(paths, provider.id, options.env),
      agent: provider.capabilities.agent ? options.agent || agentId : options.agent
    };

    this.logger.info("Invoking provider for agent.", {
      agentId,
      providerId: provider.id,
      cwd: invokeOptions.cwd,
      workspaceAccess
    });
    this.logger.debug("Provider invoke request payload.", {
      agentId,
      providerId: provider.id,
      message: invokeOptions.message,
      systemPrompt: invokeOptions.systemPrompt,
      sessionRef: options.sessionRef,
      forceNewSession: options.forceNewSession,
      disableSession: options.disableSession,
      providerSessionId: options.providerSessionId,
      forceNewProviderSession: options.forceNewProviderSession,
      passthroughArgs: invokeOptions.passthroughArgs,
      model: invokeOptions.model
    });

    const result = await provider.invoke(invokeOptions);
    this.logger.info("Provider invocation completed.", {
      agentId,
      providerId: provider.id,
      code: result.code
    });
    this.logger.debug("Provider invoke response payload.", {
      agentId,
      providerId: provider.id,
      code: result.code,
      stdout: result.stdout,
      stderr: result.stderr,
      providerSessionId: result.providerSessionId
    });

    return {
      ...result,
      ...binding
    };
  }

  public async getAgentRuntimeProfile(paths: OpenGoatPaths, agentId: string): Promise<AgentRuntimeProfile> {
    const registry = await this.getProviderRegistry();
    const config = await this.readAgentConfig(paths, agentId);
    const binding = await this.getAgentProvider(paths, agentId, config);
    const provider = registry.create(binding.providerId);
    return {
      agentId,
      providerId: provider.id,
      providerKind: provider.kind,
      workspaceAccess: resolveWorkspaceAccess(agentId, config.runtime?.workspaceAccess, provider.kind)
    };
  }

  private async buildInternalWorkspacePrompt(
    paths: OpenGoatPaths,
    agentId: string,
    config: AgentConfigShape,
    workspaceDir: string,
    skillsPromptOverride?: string
  ): Promise<string> {
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
    const skillsPrompt =
      typeof skillsPromptOverride === "string" && skillsPromptOverride.trim().length > 0
        ? skillsPromptOverride.trim()
        : (await this.skillService.buildSkillsPrompt(paths, agentId, config.runtime?.skills)).prompt.trim();
    return [systemPrompt, skillsPrompt].filter(Boolean).join("\n\n");
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

  private getProviderRegistry(): Promise<ProviderRegistry> {
    if (!this.providerRegistryPromise) {
      this.providerRegistryPromise = this.resolveProviderRegistry(this.providerRegistryInput);
    }

    return this.providerRegistryPromise;
  }

  private resolveProviderRegistry(
    input:
      | Promise<ProviderRegistry>
      | ProviderRegistry
      | (() => Promise<ProviderRegistry> | ProviderRegistry)
  ): Promise<ProviderRegistry> {
    if (typeof input === "function") {
      return Promise.resolve(input());
    }

    return Promise.resolve(input);
  }
}

function resolveWorkspaceAccess(
  agentId: string,
  configuredAccess: AgentWorkspaceAccess | undefined,
  providerKind: "cli" | "http"
): ResolvedWorkspaceAccess {
  if (configuredAccess === "internal" || configuredAccess === "external") {
    return configuredAccess;
  }

  if (isDefaultAgentId(agentId)) {
    return "internal";
  }

  return providerKind === "http" ? "internal" : "external";
}

function resolveInvokeCwd(workspaceAccess: ResolvedWorkspaceAccess, requestedCwd: string | undefined, workspaceDir: string): string {
  if (workspaceAccess === "internal") {
    return requestedCwd || workspaceDir;
  }
  return requestedCwd || process.cwd();
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
