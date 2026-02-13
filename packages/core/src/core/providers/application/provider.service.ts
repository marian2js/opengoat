import type { OpenGoatPaths } from "../../domain/opengoat-paths.js";
import { createNoopLogger, type Logger } from "../../logging/index.js";
import type { FileSystemPort } from "../../ports/file-system.port.js";
import type { PathPort } from "../../ports/path.port.js";
import {
  InvalidProviderConfigError,
  UnsupportedProviderActionError,
  type AgentProviderBinding,
  type ProviderAuthOptions,
  type ProviderCreateAgentOptions,
  type ProviderDeleteAgentOptions,
  type ProviderExecutionResult,
  type ProviderInvokeRuntimeContext,
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
  nowIso: () => string;
  logger?: Logger;
}

export interface AgentRuntimeProfile {
  agentId: string;
  providerId: string;
  providerKind: "cli" | "http";
  workspaceAccess: "internal";
}

export interface ProviderStoredConfig {
  schemaVersion: number;
  providerId: string;
  env: Record<string, string>;
  updatedAt: string;
}

export interface OpenClawGatewayConfig {
  mode: "local" | "external";
  gatewayUrl?: string;
  gatewayToken?: string;
  command?: string;
}

const OPENCLAW_PROVIDER_ID = "openclaw";

export class ProviderService {
  private readonly fileSystem: FileSystemPort;
  private readonly pathPort: PathPort;
  private readonly providerRegistryInput:
    | Promise<ProviderRegistry>
    | ProviderRegistry
    | (() => Promise<ProviderRegistry> | ProviderRegistry);
  private providerRegistryPromise?: Promise<ProviderRegistry>;
  private readonly nowIso: () => string;
  private readonly logger: Logger;

  public constructor(deps: ProviderServiceDeps) {
    this.fileSystem = deps.fileSystem;
    this.pathPort = deps.pathPort;
    this.providerRegistryInput = deps.providerRegistry;
    this.nowIso = deps.nowIso;
    this.logger = (deps.logger ?? createNoopLogger()).child({ scope: "provider-service" });
  }

  public async listProviders(): Promise<ProviderSummary[]> {
    const registry = await this.getProviderRegistry();
    const provider = registry.create(OPENCLAW_PROVIDER_ID);
    return [
      {
        id: provider.id,
        displayName: provider.displayName,
        kind: provider.kind,
        capabilities: provider.capabilities
      }
    ];
  }

  public async getProviderOnboarding(providerId: string): Promise<ProviderOnboardingSpec | undefined> {
    assertOpenClawProviderId(providerId);
    const registry = await this.getProviderRegistry();
    return registry.getProviderOnboarding(OPENCLAW_PROVIDER_ID);
  }

  public async invokeProviderAuth(
    paths: OpenGoatPaths,
    providerId: string,
    options: ProviderAuthOptions = {}
  ): Promise<ProviderExecutionResult> {
    assertOpenClawProviderId(providerId);
    const registry = await this.getProviderRegistry();
    const provider = registry.create(OPENCLAW_PROVIDER_ID);
    const env = await this.resolveProviderEnv(paths, options.env);
    this.logger.info("Invoking OpenClaw auth.");
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
    assertOpenClawProviderId(providerId);
    const configPath = this.getProviderConfigPath(paths);
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
    env: Record<string, string>,
    options: {
      replace?: boolean;
    } = {}
  ): Promise<ProviderStoredConfig> {
    assertOpenClawProviderId(providerId);
    const providerDir = this.pathPort.join(paths.providersDir, OPENCLAW_PROVIDER_ID);
    const configPath = this.getProviderConfigPath(paths);
    const existing = await this.getProviderConfig(paths, OPENCLAW_PROVIDER_ID);
    const replace = options.replace ?? false;

    const mergedEnv = sanitizeEnvMap({
      ...(replace ? {} : (existing?.env ?? {})),
      ...env
    });

    const next: ProviderStoredConfig = {
      schemaVersion: 1,
      providerId: OPENCLAW_PROVIDER_ID,
      env: mergedEnv,
      updatedAt: this.nowIso()
    };

    await this.fileSystem.ensureDir(providerDir);
    await this.fileSystem.writeFile(configPath, `${JSON.stringify(next, null, 2)}\n`);
    return next;
  }

  public async getOpenClawGatewayConfig(
    paths: OpenGoatPaths,
    inputEnv?: NodeJS.ProcessEnv
  ): Promise<OpenClawGatewayConfig> {
    const env = await this.resolveProviderEnv(paths, inputEnv);
    const explicitMode = env.OPENGOAT_OPENCLAW_GATEWAY_MODE?.trim().toLowerCase();
    const parsedArgs = parseOpenClawArguments(env.OPENCLAW_ARGUMENTS ?? "");

    const mode: "local" | "external" =
      explicitMode === "external" || parsedArgs.remoteUrl || parsedArgs.token ? "external" : "local";

    return {
      mode,
      gatewayUrl: env.OPENCLAW_GATEWAY_URL?.trim() || parsedArgs.remoteUrl,
      gatewayToken: env.OPENCLAW_GATEWAY_PASSWORD?.trim() || parsedArgs.token,
      command: env.OPENCLAW_CMD?.trim() || "openclaw"
    };
  }

  public async setOpenClawGatewayConfig(paths: OpenGoatPaths, config: OpenClawGatewayConfig): Promise<OpenClawGatewayConfig> {
    const current = await this.getProviderConfig(paths, OPENCLAW_PROVIDER_ID);
    const nextEnv: Record<string, string> = {
      ...(current?.env ?? {})
    };

    delete nextEnv.OPENCLAW_ARGUMENTS;
    delete nextEnv.OPENCLAW_GATEWAY_URL;
    delete nextEnv.OPENCLAW_GATEWAY_PASSWORD;

    if (config.mode === "external") {
      const gatewayUrl = config.gatewayUrl?.trim();
      const gatewayToken = config.gatewayToken?.trim();
      if (!gatewayUrl || !gatewayToken) {
        throw new Error("External gateway mode requires gatewayUrl and gatewayToken.");
      }
      nextEnv.OPENGOAT_OPENCLAW_GATEWAY_MODE = "external";
      nextEnv.OPENCLAW_GATEWAY_URL = gatewayUrl;
      nextEnv.OPENCLAW_GATEWAY_PASSWORD = gatewayToken;
      nextEnv.OPENCLAW_ARGUMENTS = `--remote ${gatewayUrl} --token ${gatewayToken}`;
    } else {
      nextEnv.OPENGOAT_OPENCLAW_GATEWAY_MODE = "local";
    }

    await this.setProviderConfig(paths, OPENCLAW_PROVIDER_ID, nextEnv, { replace: true });
    return this.getOpenClawGatewayConfig(paths);
  }

  public async getAgentProvider(
    _paths: OpenGoatPaths,
    agentId: string
  ): Promise<AgentProviderBinding> {
    return {
      agentId,
      providerId: OPENCLAW_PROVIDER_ID
    };
  }

  public async setAgentProvider(
    _paths: OpenGoatPaths,
    agentId: string,
    providerId: string
  ): Promise<AgentProviderBinding> {
    assertOpenClawProviderId(providerId);
    return {
      agentId,
      providerId: OPENCLAW_PROVIDER_ID
    };
  }

  public async invokeAgent(
    paths: OpenGoatPaths,
    agentId: string,
    options: ProviderInvokeOptions,
    runtimeContext: ProviderInvokeRuntimeContext = {}
  ): Promise<ProviderExecutionResult & AgentProviderBinding> {
    const registry = await this.getProviderRegistry();
    const provider = registry.create(OPENCLAW_PROVIDER_ID);
    const mergedSystemPrompt = options.systemPrompt?.trim();

    const invokeOptions: ProviderInvokeOptions = {
      ...options,
      systemPrompt: mergedSystemPrompt || undefined,
      cwd: options.cwd,
      env: await this.resolveProviderEnv(paths, options.env),
      agent: provider.capabilities.agent ? options.agent || agentId : options.agent
    };

    this.logger.info("Invoking OpenClaw for agent.", {
      agentId,
      cwd: invokeOptions.cwd
    });

    runtimeContext.hooks?.onInvocationStarted?.({
      runId: runtimeContext.runId,
      timestamp: this.nowIso(),
      step: runtimeContext.step,
      agentId,
      providerId: provider.id
    });

    const result = await provider.invoke(invokeOptions);

    runtimeContext.hooks?.onInvocationCompleted?.({
      runId: runtimeContext.runId,
      timestamp: this.nowIso(),
      step: runtimeContext.step,
      agentId,
      providerId: provider.id,
      code: result.code
    });

    return {
      ...result,
      agentId,
      providerId: provider.id
    };
  }

  public async createProviderAgent(
    paths: OpenGoatPaths,
    agentId: string,
    options: Omit<ProviderCreateAgentOptions, "agentId"> & { providerId?: string }
  ): Promise<ProviderExecutionResult & AgentProviderBinding> {
    if (options.providerId) {
      assertOpenClawProviderId(options.providerId);
    }

    const registry = await this.getProviderRegistry();
    const provider = registry.create(OPENCLAW_PROVIDER_ID);
    if (!provider.capabilities.agentCreate || !provider.createAgent) {
      throw new UnsupportedProviderActionError(provider.id, "create_agent");
    }

    const result = await provider.createAgent({
      agentId,
      displayName: options.displayName,
      workspaceDir: options.workspaceDir,
      internalConfigDir: options.internalConfigDir,
      cwd: options.cwd,
      env: await this.resolveProviderEnv(paths, options.env),
      onStdout: options.onStdout,
      onStderr: options.onStderr
    });

    return {
      ...result,
      agentId,
      providerId: provider.id
    };
  }

  public async deleteProviderAgent(
    paths: OpenGoatPaths,
    agentId: string,
    options: Omit<ProviderDeleteAgentOptions, "agentId"> & { providerId?: string }
  ): Promise<ProviderExecutionResult & AgentProviderBinding> {
    if (options.providerId) {
      assertOpenClawProviderId(options.providerId);
    }

    const registry = await this.getProviderRegistry();
    const provider = registry.create(OPENCLAW_PROVIDER_ID);
    if (!provider.capabilities.agentDelete || !provider.deleteAgent) {
      throw new UnsupportedProviderActionError(provider.id, "delete_agent");
    }

    const result = await provider.deleteAgent({
      agentId,
      cwd: options.cwd,
      env: await this.resolveProviderEnv(paths, options.env),
      onStdout: options.onStdout,
      onStderr: options.onStderr
    });

    return {
      ...result,
      agentId,
      providerId: provider.id
    };
  }

  public async getAgentRuntimeProfile(_paths: OpenGoatPaths, agentId: string): Promise<AgentRuntimeProfile> {
    const registry = await this.getProviderRegistry();
    const provider = registry.create(OPENCLAW_PROVIDER_ID);
    return {
      agentId,
      providerId: provider.id,
      providerKind: provider.kind,
      workspaceAccess: "internal"
    };
  }

  private getProviderConfigPath(paths: OpenGoatPaths): string {
    return this.pathPort.join(paths.providersDir, OPENCLAW_PROVIDER_ID, "config.json");
  }

  private async resolveProviderEnv(
    paths: OpenGoatPaths,
    inputEnv: NodeJS.ProcessEnv | undefined
  ): Promise<NodeJS.ProcessEnv> {
    const config = await this.getProviderConfig(paths, OPENCLAW_PROVIDER_ID);
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

function parseOpenClawArguments(raw: string): { remoteUrl?: string; token?: string } {
  const parts = raw
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const remoteIndex = parts.findIndex((part) => part === "--remote");
  const tokenIndex = parts.findIndex((part) => part === "--token");

  return {
    remoteUrl: remoteIndex >= 0 ? parts[remoteIndex + 1] : undefined,
    token: tokenIndex >= 0 ? parts[tokenIndex + 1] : undefined
  };
}

function assertOpenClawProviderId(providerId: string): void {
  if (providerId.trim().toLowerCase() !== OPENCLAW_PROVIDER_ID) {
    throw new Error(`Only \"${OPENCLAW_PROVIDER_ID}\" is supported in this OpenGoat version.`);
  }
}
