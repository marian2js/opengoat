import type { OpenGoatPaths } from "../../domain/opengoat-paths.js";
import { normalizeAgentId } from "../../domain/agent-id.js";
import { createNoopLogger, type Logger } from "../../logging/index.js";
import type { FileSystemPort } from "../../ports/file-system.port.js";
import type { PathPort } from "../../ports/path.port.js";
import { executeCommand } from "../command-executor.js";
import {
  callOpenClawGatewayRpc,
  resolveGatewayAgentCallTimeoutMs,
} from "../openclaw-gateway-rpc.js";
import {
  AgentConfigNotFoundError,
  InvalidAgentConfigError,
  InvalidProviderConfigError,
  ProviderCommandNotFoundError,
  UnsupportedProviderActionError,
  type AgentProviderBinding,
  type Provider,
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

export interface OpenClawAgentConfigEntry {
  id: string;
  name?: string;
  workspace: string;
  agentDir: string;
}

export interface OpenClawGatewayConfigSnapshot {
  config: Record<string, unknown>;
  hash?: string;
}

const OPENCLAW_PROVIDER_ID = "openclaw";
const AGENT_CONFIG_FILE_NAME = "config.json";
const PROVIDER_SESSION_BINDINGS_SCHEMA_VERSION = 1;

interface ProviderSessionBindingsShape {
  schemaVersion: number;
  providerId: string;
  agentId: string;
  updatedAt: string;
  bindings: Record<string, string>;
}

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
    return registry.listProviders().map((provider) => ({
      id: provider.id,
      displayName: provider.displayName,
      kind: provider.kind,
      capabilities: provider.capabilities
    }));
  }

  public async getProviderOnboarding(providerId: string): Promise<ProviderOnboardingSpec | undefined> {
    const normalizedProviderId = normalizeProviderId(providerId);
    const registry = await this.getProviderRegistry();
    return registry.getProviderOnboarding(normalizedProviderId);
  }

  public async invokeProviderAuth(
    paths: OpenGoatPaths,
    providerId: string,
    options: ProviderAuthOptions = {}
  ): Promise<ProviderExecutionResult> {
    const normalizedProviderId = normalizeProviderId(providerId);
    const registry = await this.getProviderRegistry();
    const provider = registry.create(normalizedProviderId);
    const env = await this.resolveProviderEnv(paths, normalizedProviderId, options.env);
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
    const normalizedProviderId = normalizeProviderId(providerId);
    const configPath = this.getProviderConfigPath(paths, normalizedProviderId);
    const exists = await this.fileSystem.exists(configPath);
    if (!exists) {
      return null;
    }

    const raw = await this.fileSystem.readFile(configPath);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      throw new InvalidProviderConfigError(normalizedProviderId, configPath);
    }

    if (!isProviderStoredConfig(parsed)) {
      throw new InvalidProviderConfigError(normalizedProviderId, configPath, "schema mismatch");
    }

    if (parsed.providerId.trim().toLowerCase() !== normalizedProviderId) {
      throw new InvalidProviderConfigError(
        normalizedProviderId,
        configPath,
        `provider id mismatch (found "${parsed.providerId}")`,
      );
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
    const normalizedProviderId = normalizeProviderId(providerId);
    const providerDir = this.pathPort.join(paths.providersDir, normalizedProviderId);
    const configPath = this.getProviderConfigPath(paths, normalizedProviderId);
    const existing = await this.getProviderConfig(paths, normalizedProviderId);
    const replace = options.replace ?? false;

    const mergedEnv = sanitizeEnvMap({
      ...(replace ? {} : (existing?.env ?? {})),
      ...env
    });

    const next: ProviderStoredConfig = {
      schemaVersion: 1,
      providerId: normalizedProviderId,
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
    const env = await this.resolveProviderEnv(paths, OPENCLAW_PROVIDER_ID, inputEnv);
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
    paths: OpenGoatPaths,
    agentId: string,
  ): Promise<AgentProviderBinding> {
    const normalizedAgentId = normalizeAgentIdentity(agentId);
    const providerId = await this.resolveAgentProviderId(paths, normalizedAgentId);
    return {
      agentId: normalizedAgentId,
      providerId,
    };
  }

  public async setAgentProvider(
    paths: OpenGoatPaths,
    agentId: string,
    providerId: string,
  ): Promise<AgentProviderBinding> {
    const normalizedAgentId = normalizeAgentIdentity(agentId);
    const normalizedProviderId = normalizeProviderId(providerId);
    await this.assertProviderExists(normalizedProviderId);

    if (
      normalizedAgentId === "ceo" &&
      normalizedProviderId !== OPENCLAW_PROVIDER_ID
    ) {
      throw new Error("ceo provider is fixed to \"openclaw\".");
    }

    const configPath = this.pathPort.join(
      paths.agentsDir,
      normalizedAgentId,
      AGENT_CONFIG_FILE_NAME,
    );
    const config = await this.readAgentConfig(configPath, normalizedAgentId);
    const runtime = asRecord(config.runtime);
    const currentProvider = asRecord(runtime.provider);
    runtime.provider = {
      ...currentProvider,
      id: normalizedProviderId,
    };
    if ("adapter" in runtime) {
      delete runtime.adapter;
    }
    config.runtime = runtime;
    await this.fileSystem.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);

    return {
      agentId: normalizedAgentId,
      providerId: normalizedProviderId,
    };
  }

  public async invokeAgent(
    paths: OpenGoatPaths,
    agentId: string,
    options: ProviderInvokeOptions,
    runtimeContext: ProviderInvokeRuntimeContext = {}
  ): Promise<ProviderExecutionResult & AgentProviderBinding> {
    const normalizedAgentId = normalizeAgentIdentity(agentId);
    const binding = await this.getAgentProvider(paths, normalizedAgentId);
    const registry = await this.getProviderRegistry();
    const provider = registry.create(binding.providerId);
    const mergedSystemPrompt = options.systemPrompt?.trim();
    const env = await this.resolveProviderEnv(paths, provider.id, options.env);
    const providerSessionAlias = options.providerSessionId?.trim();
    const mappedProviderSessionId = await this.resolveProviderSessionIdAlias(
      paths,
      provider.id,
      normalizedAgentId,
      providerSessionAlias,
    );

    const invokeOptions: ProviderInvokeOptions = {
      ...options,
      systemPrompt: mergedSystemPrompt || undefined,
      cwd: options.cwd,
      env,
      providerSessionId: mappedProviderSessionId,
      agent: provider.capabilities.agent
        ? options.agent || normalizedAgentId
        : options.agent
    };

    this.logger.info("Invoking provider for agent.", {
      agentId: normalizedAgentId,
      providerId: provider.id,
      cwd: invokeOptions.cwd
    });

    runtimeContext.hooks?.onInvocationStarted?.({
      runId: runtimeContext.runId,
      timestamp: this.nowIso(),
      step: runtimeContext.step,
      agentId: normalizedAgentId,
      providerId: provider.id
    });

    let result: ProviderExecutionResult;
    try {
      result = await provider.invoke(invokeOptions);
      if (provider.id === OPENCLAW_PROVIDER_ID) {
        result = await this.retryGatewayInvocationOnUvCwdFailure(
          paths,
          provider,
          invokeOptions,
          result,
        );
      }
    } catch (error) {
      if (
        error instanceof ProviderCommandNotFoundError &&
        provider.id === OPENCLAW_PROVIDER_ID
      ) {
        result = await this.invokeAgentViaGateway(normalizedAgentId, invokeOptions, env);
      } else {
        throw error;
      }
    }
    await this.persistProviderSessionIdAlias(
      paths,
      provider.id,
      normalizedAgentId,
      providerSessionAlias,
      result.providerSessionId,
    );

    runtimeContext.hooks?.onInvocationCompleted?.({
      runId: runtimeContext.runId,
      timestamp: this.nowIso(),
      step: runtimeContext.step,
      agentId: normalizedAgentId,
      providerId: provider.id,
      code: result.code
    });

    return {
      ...result,
      agentId: normalizedAgentId,
      providerId: provider.id
    };
  }

  public async createProviderAgent(
    paths: OpenGoatPaths,
    agentId: string,
    options: Omit<ProviderCreateAgentOptions, "agentId"> & { providerId?: string }
  ): Promise<ProviderExecutionResult & AgentProviderBinding> {
    const normalizedAgentId = normalizeAgentIdentity(agentId);
    const requestedProviderId = options.providerId?.trim()
      ? normalizeProviderId(options.providerId)
      : OPENCLAW_PROVIDER_ID;
    const registry = await this.getProviderRegistry();
    const provider = registry.create(requestedProviderId);
    if (!provider.capabilities.agentCreate || !provider.createAgent) {
      throw new UnsupportedProviderActionError(provider.id, "create_agent");
    }
    const env = await this.resolveProviderEnv(paths, provider.id, options.env);

    let result: ProviderExecutionResult;
    try {
      result = await provider.createAgent({
        agentId: normalizedAgentId,
        displayName: options.displayName,
        workspaceDir: options.workspaceDir,
        internalConfigDir: options.internalConfigDir,
        cwd: options.cwd,
        env,
        onStdout: options.onStdout,
        onStderr: options.onStderr
      });
    } catch (error) {
      if (
        error instanceof ProviderCommandNotFoundError &&
        provider.id === OPENCLAW_PROVIDER_ID
      ) {
        result = await this.createProviderAgentViaGateway(normalizedAgentId, {
          displayName: options.displayName,
          workspaceDir: options.workspaceDir,
          internalConfigDir: options.internalConfigDir,
          env,
        });
      } else {
        throw error;
      }
    }

    return {
      ...result,
      agentId: normalizedAgentId,
      providerId: provider.id
    };
  }

  public async deleteProviderAgent(
    paths: OpenGoatPaths,
    agentId: string,
    options: Omit<ProviderDeleteAgentOptions, "agentId"> & { providerId?: string }
  ): Promise<ProviderExecutionResult & AgentProviderBinding> {
    const normalizedAgentId = normalizeAgentIdentity(agentId);
    const requestedProviderId = options.providerId?.trim()
      ? normalizeProviderId(options.providerId)
      : OPENCLAW_PROVIDER_ID;
    const registry = await this.getProviderRegistry();
    const provider = registry.create(requestedProviderId);
    if (!provider.capabilities.agentDelete || !provider.deleteAgent) {
      throw new UnsupportedProviderActionError(provider.id, "delete_agent");
    }
    const env = await this.resolveProviderEnv(paths, provider.id, options.env);

    let result: ProviderExecutionResult;
    try {
      result = await provider.deleteAgent({
        agentId: normalizedAgentId,
        cwd: options.cwd,
        env,
        onStdout: options.onStdout,
        onStderr: options.onStderr
      });
    } catch (error) {
      if (
        error instanceof ProviderCommandNotFoundError &&
        provider.id === OPENCLAW_PROVIDER_ID
      ) {
        result = await this.deleteProviderAgentViaGateway(normalizedAgentId, env);
      } else {
        throw error;
      }
    }

    return {
      ...result,
      agentId: normalizedAgentId,
      providerId: provider.id
    };
  }

  public async listOpenClawAgentsViaGateway(
    paths: OpenGoatPaths,
    inputEnv?: NodeJS.ProcessEnv,
  ): Promise<OpenClawAgentConfigEntry[]> {
    const env = await this.resolveProviderEnv(paths, OPENCLAW_PROVIDER_ID, inputEnv);
    const payload = await this.callGatewayMethod(env, "config.get", {});
    const parsed = parseGatewayConfigPayload(payload);
    if (!parsed) {
      return [];
    }

    return readGatewayAgentsList(parsed);
  }

  public async getOpenClawSkillsStatusViaGateway(
    paths: OpenGoatPaths,
    inputEnv?: NodeJS.ProcessEnv,
  ): Promise<Record<string, unknown>> {
    const env = await this.resolveProviderEnv(paths, OPENCLAW_PROVIDER_ID, inputEnv);
    const payload = await this.callGatewayMethod(env, "skills.status", {});
    return asRecord(payload);
  }

  public async syncOpenClawAgentExecutionPoliciesViaGateway(
    paths: OpenGoatPaths,
    rawAgentIds: string[],
    inputEnv?: NodeJS.ProcessEnv,
  ): Promise<string[]> {
    const env = await this.resolveProviderEnv(paths, OPENCLAW_PROVIDER_ID, inputEnv);
    const warnings: string[] = [];
    const normalizedAgentIds = [
      ...new Set(
        rawAgentIds
          .map((agentId) => normalizeAgentId(agentId))
          .filter((agentId): agentId is string => Boolean(agentId)),
      ),
    ];
    if (normalizedAgentIds.length === 0) {
      return warnings;
    }

    const snapshot = await this.getOpenClawConfigViaGateway(paths, env);
    const root = snapshot.config;
    const agents = asRecord(root.agents);
    const list = Array.isArray(agents.list) ? [...agents.list] : [];
    const indexById = new Map<string, number>();
    for (let index = 0; index < list.length; index += 1) {
      const entry = asRecord(list[index]);
      const id = normalizeAgentId(String(entry.id ?? ""));
      if (!id || indexById.has(id)) {
        continue;
      }
      indexById.set(id, index);
    }

    let changed = false;
    for (const agentId of normalizedAgentIds) {
      const index = indexById.get(agentId);
      if (index === undefined) {
        warnings.push(
          `OpenClaw gateway policy sync skipped for "${agentId}" because no agents.list entry was found.`,
        );
        continue;
      }

      const current = asRecord(list[index]);
      const next: Record<string, unknown> = {
        ...current,
      };

      if (readAgentSandboxMode(current) !== "off") {
        next.sandbox = {
          ...asRecord(current.sandbox),
          mode: "off",
        };
        changed = true;
      }

      if (!hasAgentToolsAllowAll(current)) {
        next.tools = {
          ...asRecord(current.tools),
          allow: ["*"],
        };
        changed = true;
      }

      list[index] = next;
    }

    if (!changed) {
      return warnings;
    }

    const nextRoot: Record<string, unknown> = {
      ...root,
      agents: {
        ...agents,
        list,
      },
    };

    await this.applyOpenClawConfigViaGateway(
      paths,
      nextRoot,
      snapshot.hash,
      env,
    );
    return warnings;
  }

  public async getAgentRuntimeProfile(paths: OpenGoatPaths, agentId: string): Promise<AgentRuntimeProfile> {
    const normalizedAgentId = normalizeAgentIdentity(agentId);
    const providerId = await this.resolveAgentProviderId(paths, normalizedAgentId);
    const registry = await this.getProviderRegistry();
    const provider = registry.create(providerId);
    return {
      agentId: normalizedAgentId,
      providerId: provider.id,
      providerKind: provider.kind,
      workspaceAccess: "internal"
    };
  }

  public async restartLocalGateway(
    paths: OpenGoatPaths,
    inputEnv?: NodeJS.ProcessEnv
  ): Promise<boolean> {
    const env = await this.resolveProviderEnv(paths, OPENCLAW_PROVIDER_ID, inputEnv);
    const gatewayConfig = await this.getOpenClawGatewayConfig(paths, env);
    if (gatewayConfig.mode !== "local") {
      return false;
    }

    const command = gatewayConfig.command?.trim() || "openclaw";
    const args = [
      ...extractOpenClawGlobalArgs(env.OPENCLAW_ARGUMENTS),
      "gateway",
      "restart",
      "--json"
    ];
    const restartResult = await executeCommand({
      command,
      args,
      cwd: paths.homeDir,
      env
    });
    if (restartResult.code !== 0) {
      this.logger.warn("OpenClaw gateway restart failed.", {
        code: restartResult.code,
        stderr: restartResult.stderr.trim() || undefined,
        stdout: restartResult.stdout.trim() || undefined
      });
      return false;
    }

    this.logger.warn("OpenClaw gateway restarted.");
    return true;
  }

  private async invokeAgentViaGateway(
    fallbackAgentId: string,
    invokeOptions: ProviderInvokeOptions,
    env: NodeJS.ProcessEnv,
  ): Promise<ProviderExecutionResult> {
    const agentId = (invokeOptions.agent || fallbackAgentId).trim();
    const payload = await this.callGatewayMethod(
      env,
      "agent",
      buildGatewayAgentParams({
        message: invokeOptions.message,
        agentId,
        model: invokeOptions.model,
        providerSessionId: invokeOptions.providerSessionId,
        idempotencyKey: invokeOptions.idempotencyKey,
      }),
      {
        expectFinal: true,
        timeoutMs: resolveGatewayAgentCallTimeoutMs(),
      },
    );
    const normalized = normalizeGatewayAgentPayload(payload);
    return {
      code: 0,
      stdout: normalized.stdout,
      stderr: "",
      providerSessionId: normalized.providerSessionId,
    };
  }

  private async createProviderAgentViaGateway(
    agentId: string,
    options: {
      displayName: string;
      workspaceDir: string;
      internalConfigDir: string;
      env: NodeJS.ProcessEnv;
    },
  ): Promise<ProviderExecutionResult> {
    const payload = await this.callGatewayMethod(options.env, "config.get", {});
    const configPayload = asRecord(payload);
    const rawConfig = parseGatewayConfigPayload(configPayload);
    if (!rawConfig) {
      throw new Error("OpenClaw gateway config.get did not return valid JSON.");
    }

    const root = asRecord(rawConfig);
    const agents = asRecord(root.agents);
    const list = Array.isArray(agents.list) ? [...agents.list] : [];
    const normalizedTarget = normalizeAgentId(agentId);
    if (!normalizedTarget) {
      throw new Error("Agent id cannot be empty.");
    }

    const index = list.findIndex((entry) => {
      const id = normalizeAgentId(asRecord(entry).id as string);
      return id === normalizedTarget;
    });
    const nextEntry: Record<string, unknown> = {
      ...(index >= 0 ? asRecord(list[index]) : {}),
      id: normalizedTarget,
      name: options.displayName,
      workspace: options.workspaceDir,
      agentDir: options.internalConfigDir,
      sandbox: {
        mode: "off",
      },
      tools: {
        allow: ["*"],
      },
    };
    if (index >= 0) {
      list[index] = nextEntry;
    } else {
      list.push(nextEntry);
    }

    const nextRoot: Record<string, unknown> = {
      ...root,
      agents: {
        ...agents,
        list,
      },
    };
    const applyParams: Record<string, unknown> = {
      raw: `${JSON.stringify(nextRoot, null, 2)}\n`,
    };
    const hash = configPayload.hash;
    if (typeof hash === "string" && hash.trim().length > 0) {
      applyParams.baseHash = hash.trim();
    }
    await this.callGatewayMethod(options.env, "config.apply", applyParams);

    return {
      code: 0,
      stdout: "created via OpenClaw gateway config.apply",
      stderr: "",
    };
  }

  private async deleteProviderAgentViaGateway(
    agentId: string,
    env: NodeJS.ProcessEnv,
  ): Promise<ProviderExecutionResult> {
    const normalizedTarget = normalizeAgentId(agentId);
    if (!normalizedTarget) {
      throw new Error("Agent id cannot be empty.");
    }

    const payload = await this.callGatewayMethod(env, "config.get", {});
    const configPayload = asRecord(payload);
    const rawConfig = parseGatewayConfigPayload(configPayload);
    if (!rawConfig) {
      throw new Error("OpenClaw gateway config.get did not return valid JSON.");
    }

    const root = asRecord(rawConfig);
    const agents = asRecord(root.agents);
    const list = Array.isArray(agents.list) ? [...agents.list] : [];
    const nextList = list.filter((entry) => {
      const id = normalizeAgentId(asRecord(entry).id as string);
      return id !== normalizedTarget;
    });

    if (nextList.length === list.length) {
      return {
        code: 0,
        stdout: "agent already absent in OpenClaw config",
        stderr: "",
      };
    }

    const nextRoot: Record<string, unknown> = {
      ...root,
      agents: {
        ...agents,
        list: nextList,
      },
    };
    const applyParams: Record<string, unknown> = {
      raw: `${JSON.stringify(nextRoot, null, 2)}\n`,
    };
    const hash = configPayload.hash;
    if (typeof hash === "string" && hash.trim().length > 0) {
      applyParams.baseHash = hash.trim();
    }
    await this.callGatewayMethod(env, "config.apply", applyParams);

    return {
      code: 0,
      stdout: "deleted via OpenClaw gateway config.apply",
      stderr: "",
    };
  }

  private async callGatewayMethod(
    env: NodeJS.ProcessEnv,
    method: string,
    params: unknown,
    options: {
      expectFinal?: boolean;
      timeoutMs?: number;
    } = {},
  ): Promise<unknown> {
    return callOpenClawGatewayRpc({
      env,
      method,
      params,
      options,
    });
  }

  private async getOpenClawConfigViaGateway(
    paths: OpenGoatPaths,
    inputEnv?: NodeJS.ProcessEnv,
  ): Promise<OpenClawGatewayConfigSnapshot> {
    const env = await this.resolveProviderEnv(paths, OPENCLAW_PROVIDER_ID, inputEnv);
    const payload = await this.callGatewayMethod(env, "config.get", {});
    const record = asRecord(payload);
    const config = parseGatewayConfigPayload(record);
    if (!config) {
      throw new Error("OpenClaw gateway config.get did not return valid JSON.");
    }
    const hash = record.hash;
    return {
      config,
      hash:
        typeof hash === "string" && hash.trim().length > 0
          ? hash.trim()
          : undefined,
    };
  }

  private async applyOpenClawConfigViaGateway(
    paths: OpenGoatPaths,
    config: Record<string, unknown>,
    baseHash?: string,
    inputEnv?: NodeJS.ProcessEnv,
  ): Promise<void> {
    const env = await this.resolveProviderEnv(paths, OPENCLAW_PROVIDER_ID, inputEnv);
    const params: Record<string, unknown> = {
      raw: `${JSON.stringify(config, null, 2)}\n`,
    };
    if (typeof baseHash === "string" && baseHash.trim().length > 0) {
      params.baseHash = baseHash.trim();
    }
    await this.callGatewayMethod(env, "config.apply", params);
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

  private async resolveAgentProviderId(
    paths: OpenGoatPaths,
    agentId: string,
  ): Promise<string> {
    if (agentId === "ceo") {
      return OPENCLAW_PROVIDER_ID;
    }

    const configPath = this.pathPort.join(
      paths.agentsDir,
      agentId,
      AGENT_CONFIG_FILE_NAME,
    );
    const config = await this.readAgentConfig(configPath, agentId);
    const runtime = asRecord(config.runtime);
    const provider = asRecord(runtime.provider);
    const explicitProviderId = readOptionalString(provider.id);
    if (explicitProviderId) {
      return this.assertProviderExists(explicitProviderId);
    }

    const legacyProviderId = readOptionalString(runtime.adapter);
    if (legacyProviderId) {
      return this.assertProviderExists(legacyProviderId);
    }

    return OPENCLAW_PROVIDER_ID;
  }

  private async assertProviderExists(rawProviderId: string): Promise<string> {
    const providerId = normalizeProviderId(rawProviderId);
    const registry = await this.getProviderRegistry();
    registry.create(providerId);
    return providerId;
  }

  private async readAgentConfig(
    configPath: string,
    agentId: string,
  ): Promise<Record<string, unknown>> {
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
      throw new InvalidAgentConfigError(agentId, configPath, "schema mismatch");
    }

    return parsed as Record<string, unknown>;
  }

  private async resolveProviderSessionIdAlias(
    paths: OpenGoatPaths,
    providerId: string,
    agentId: string,
    providerSessionAlias: string | undefined,
  ): Promise<string | undefined> {
    const alias = providerSessionAlias?.trim();
    if (!alias) {
      return undefined;
    }
    if (providerId === OPENCLAW_PROVIDER_ID) {
      return alias;
    }

    const bindings = await this.readProviderSessionBindings(paths, providerId, agentId);
    const mapped = bindings.bindings[alias]?.trim();
    return mapped || undefined;
  }

  private async persistProviderSessionIdAlias(
    paths: OpenGoatPaths,
    providerId: string,
    agentId: string,
    providerSessionAlias: string | undefined,
    providerSessionId: string | undefined,
  ): Promise<void> {
    if (providerId === OPENCLAW_PROVIDER_ID) {
      return;
    }

    const alias = providerSessionAlias?.trim();
    const resolvedProviderSessionId = providerSessionId?.trim();
    if (!alias || !resolvedProviderSessionId) {
      return;
    }

    const bindings = await this.readProviderSessionBindings(paths, providerId, agentId);
    if (bindings.bindings[alias] === resolvedProviderSessionId) {
      return;
    }

    bindings.bindings[alias] = resolvedProviderSessionId;
    bindings.updatedAt = this.nowIso();
    await this.writeProviderSessionBindings(paths, providerId, agentId, bindings);
  }

  private async readProviderSessionBindings(
    paths: OpenGoatPaths,
    providerId: string,
    agentId: string,
  ): Promise<ProviderSessionBindingsShape> {
    const normalizedProviderId = normalizeProviderId(providerId);
    const normalizedAgentId = normalizeAgentIdentity(agentId);
    const bindingsPath = this.getProviderSessionBindingsPath(
      paths,
      normalizedProviderId,
      normalizedAgentId,
    );
    const exists = await this.fileSystem.exists(bindingsPath);
    if (!exists) {
      return createProviderSessionBindingsShape({
        providerId: normalizedProviderId,
        agentId: normalizedAgentId,
        updatedAt: this.nowIso(),
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(await this.fileSystem.readFile(bindingsPath)) as unknown;
    } catch {
      return createProviderSessionBindingsShape({
        providerId: normalizedProviderId,
        agentId: normalizedAgentId,
        updatedAt: this.nowIso(),
      });
    }

    if (!isProviderSessionBindingsShape(parsed, normalizedProviderId, normalizedAgentId)) {
      return createProviderSessionBindingsShape({
        providerId: normalizedProviderId,
        agentId: normalizedAgentId,
        updatedAt: this.nowIso(),
      });
    }

    return parsed;
  }

  private async writeProviderSessionBindings(
    paths: OpenGoatPaths,
    providerId: string,
    agentId: string,
    bindings: ProviderSessionBindingsShape,
  ): Promise<void> {
    const bindingsDir = this.pathPort.join(paths.providersDir, providerId, "sessions");
    const bindingsPath = this.getProviderSessionBindingsPath(paths, providerId, agentId);
    await this.fileSystem.ensureDir(bindingsDir);
    await this.fileSystem.writeFile(bindingsPath, `${JSON.stringify(bindings, null, 2)}\n`);
  }

  private getProviderSessionBindingsPath(
    paths: OpenGoatPaths,
    providerId: string,
    agentId: string,
  ): string {
    return this.pathPort.join(paths.providersDir, providerId, "sessions", `${agentId}.json`);
  }

  private async retryGatewayInvocationOnUvCwdFailure(
    paths: OpenGoatPaths,
    provider: Provider,
    invokeOptions: ProviderInvokeOptions,
    result: ProviderExecutionResult
  ): Promise<ProviderExecutionResult> {
    if (!isGatewayUvCwdFailure(result)) {
      return result;
    }

    const restarted = await this.restartLocalGateway(paths, invokeOptions.env);
    if (!restarted) {
      return result;
    }

    this.logger.warn("OpenClaw gateway restarted after uv_cwd error; retrying provider invocation.");
    return provider.invoke(invokeOptions);
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

function isGatewayUvCwdFailure(result: ProviderExecutionResult): boolean {
  if (result.code === 0) {
    return false;
  }
  const details = `${result.stderr}\n${result.stdout}`.toLowerCase();
  return details.includes("process.cwd failed") && details.includes("uv_cwd");
}

function extractOpenClawGlobalArgs(raw: string | undefined): string[] {
  const parts = (raw ?? "")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const result: string[] = [];

  for (let index = 0; index < parts.length; index += 1) {
    const token = parts[index];
    if (!token) {
      continue;
    }

    if (token === "--remote" || token === "--token") {
      const next = parts[index + 1];
      if (next && !next.startsWith("--")) {
        index += 1;
      }
      continue;
    }

    result.push(token);
  }

  return result;
}

function buildGatewayAgentParams(options: {
  message: string;
  agentId: string;
  model?: string;
  providerSessionId?: string;
  idempotencyKey?: string;
}): Record<string, unknown> {
  const idempotencyKey =
    options.idempotencyKey?.trim() || `opengoat-${Date.now()}-${Math.random()}`;
  const params: Record<string, unknown> = {
    message: options.message,
    agentId: options.agentId,
    idempotencyKey,
  };
  if (options.model?.trim()) {
    params.model = options.model.trim();
  }
  if (options.providerSessionId?.trim()) {
    params.sessionId = options.providerSessionId.trim();
    params.sessionKey = buildOpenClawSessionKey(
      options.agentId,
      options.providerSessionId.trim(),
    );
  }
  return params;
}

function buildOpenClawSessionKey(
  agentId: string,
  providerSessionId: string,
): string {
  if (providerSessionId.includes(":")) {
    return providerSessionId.toLowerCase();
  }
  return `agent:${normalizeSessionSegment(agentId) || "main"}:${normalizeSessionSegment(providerSessionId) || "main"}`;
}

function normalizeSessionSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeGatewayAgentPayload(payload: unknown): {
  stdout: string;
  providerSessionId?: string;
} {
  const record = asRecord(payload);
  const payloads = Array.isArray(record.payloads) ? record.payloads : [];
  const chunks: string[] = [];

  for (const payloadEntry of payloads) {
    const entry = asRecord(payloadEntry);
    const text = entry.text;
    if (typeof text === "string" && text.trim().length > 0) {
      chunks.push(text.trim());
    }
  }

  const sessionId = asRecord(asRecord(record.meta).agentMeta).sessionId;
  return {
    stdout: chunks.join("\n\n").trim(),
    providerSessionId:
      typeof sessionId === "string" && sessionId.trim().length > 0
        ? sessionId.trim()
        : undefined,
  };
}

function parseGatewayConfigPayload(
  payload: unknown,
): Record<string, unknown> | undefined {
  const record = asRecord(payload);
  const raw = record.raw;
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return undefined;
  }

  const parsed = parseLooseJson(raw);
  if (!parsed) {
    return undefined;
  }

  return parsed;
}

function readGatewayAgentsList(
  config: Record<string, unknown>,
): OpenClawAgentConfigEntry[] {
  const agents = asRecord(config.agents);
  const list = Array.isArray(agents.list) ? agents.list : [];
  const entries: OpenClawAgentConfigEntry[] = [];

  for (const entry of list) {
    const record = asRecord(entry);
    const id = normalizeAgentId(String(record.id ?? ""));
    if (!id) {
      continue;
    }
    entries.push({
      id,
      name:
        typeof record.name === "string" && record.name.trim().length > 0
          ? record.name.trim()
          : undefined,
      workspace:
        typeof record.workspace === "string" ? record.workspace : "",
      agentDir:
        typeof record.agentDir === "string" ? record.agentDir : "",
    });
  }

  return entries;
}

function readAgentSandboxMode(entry: Record<string, unknown>): string | undefined {
  const sandbox = asRecord(entry.sandbox);
  const mode = sandbox.mode;
  if (typeof mode !== "string") {
    return undefined;
  }
  const normalized = mode.trim();
  return normalized.length > 0 ? normalized : undefined;
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

function parseLooseJson(raw: string): Record<string, unknown> | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return asRecord(parsed);
  } catch {
    // continue
  }

  const starts = [
    trimmed.indexOf("{"),
    trimmed.lastIndexOf("{"),
    trimmed.indexOf("["),
    trimmed.lastIndexOf("["),
  ].filter((value, index, arr) => value >= 0 && arr.indexOf(value) === index);
  for (const start of starts) {
    const candidate = trimmed.slice(start).trim();
    if (!candidate) {
      continue;
    }
    try {
      const parsed = JSON.parse(candidate) as unknown;
      return asRecord(parsed);
    } catch {
      // keep trying
    }
  }

  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function normalizeProviderId(providerId: string): string {
  const normalized = providerId.trim().toLowerCase();
  if (!normalized) {
    throw new Error("Provider id cannot be empty.");
  }
  return normalized;
}

function normalizeAgentIdentity(agentId: string): string {
  const normalized = normalizeAgentId(agentId);
  if (!normalized) {
    throw new Error("Agent id cannot be empty.");
  }
  return normalized;
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function isProviderSessionBindingsShape(
  value: unknown,
  providerId: string,
  agentId: string,
): value is ProviderSessionBindingsShape {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as {
    schemaVersion?: unknown;
    providerId?: unknown;
    agentId?: unknown;
    updatedAt?: unknown;
    bindings?: unknown;
  };

  if (record.schemaVersion !== PROVIDER_SESSION_BINDINGS_SCHEMA_VERSION) {
    return false;
  }
  if (record.providerId !== providerId || record.agentId !== agentId) {
    return false;
  }
  if (typeof record.updatedAt !== "string" || !record.updatedAt.trim()) {
    return false;
  }
  if (!record.bindings || typeof record.bindings !== "object" || Array.isArray(record.bindings)) {
    return false;
  }

  return true;
}

function createProviderSessionBindingsShape(params: {
  providerId: string;
  agentId: string;
  updatedAt: string;
}): ProviderSessionBindingsShape {
  return {
    schemaVersion: PROVIDER_SESSION_BINDINGS_SCHEMA_VERSION,
    providerId: params.providerId,
    agentId: params.agentId,
    updatedAt: params.updatedAt,
    bindings: {},
  };
}
