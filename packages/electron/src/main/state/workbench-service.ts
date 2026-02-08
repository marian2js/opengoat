import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import path from "node:path";
import { dialog } from "electron";
import {
  resolveGuidedAuth as resolveCliGuidedAuth,
  runGuidedAuth as runCliGuidedAuth
} from "@cli/onboard-guided-auth";
import {
  DEFAULT_AGENT_ID,
  normalizeAgentId,
  buildProviderFamilies,
  callOpenGoatGateway,
  loadDotEnv,
  selectProvidersForOnboarding,
  type OpenGoatService
} from "@opengoat/core";
import type {
  WorkbenchBootstrap,
  WorkbenchGatewayMode,
  WorkbenchGatewayStatus,
  WorkbenchAgent,
  WorkbenchAgentCreationResult,
  WorkbenchAgentDeletionResult,
  WorkbenchProviderSummary,
  WorkbenchGuidedAuthResult,
  WorkbenchMessage,
  WorkbenchOnboarding,
  WorkbenchProject,
  WorkbenchSendMessageResult,
  WorkbenchSession
} from "@shared/workbench";
import { WORKBENCH_GATEWAY_DEFAULT_TIMEOUT_MS } from "@shared/workbench";
import { WorkbenchStore } from "./workbench-store";

interface WorkbenchServiceDeps {
  opengoat: OpenGoatService;
  store: WorkbenchStore;
  loadDotEnvFn?: typeof loadDotEnv;
  resolveGuidedAuthFn?: typeof resolveCliGuidedAuth;
  runGuidedAuthFn?: typeof runCliGuidedAuth;
  callGatewayFn?: typeof callOpenGoatGateway;
}

export class WorkbenchService {
  private readonly opengoat: OpenGoatService;
  private readonly store: WorkbenchStore;
  private readonly loadDotEnvFn: typeof loadDotEnv;
  private readonly resolveGuidedAuthFn: typeof resolveCliGuidedAuth;
  private readonly runGuidedAuthFn: typeof runCliGuidedAuth;
  private readonly callGatewayFn: typeof callOpenGoatGateway;
  private remoteGatewayToken: string | undefined;
  private initializationPromise: Promise<void> | undefined;

  public constructor(deps: WorkbenchServiceDeps) {
    this.opengoat = deps.opengoat;
    this.store = deps.store;
    this.loadDotEnvFn = deps.loadDotEnvFn ?? loadDotEnv;
    this.resolveGuidedAuthFn = deps.resolveGuidedAuthFn ?? resolveCliGuidedAuth;
    this.runGuidedAuthFn = deps.runGuidedAuthFn ?? runCliGuidedAuth;
    this.callGatewayFn = deps.callGatewayFn ?? callOpenGoatGateway;
  }

  public async bootstrap(): Promise<WorkbenchBootstrap> {
    await this.ensureInitialized();
    const projects = await this.store.listProjects();
    return {
      homeDir: this.opengoat.getHomeDir(),
      projects,
      onboarding: await this.getOnboardingState(),
      providerSetupCompleted: await this.store.getProviderSetupCompleted()
    };
  }

  public async getOnboardingState(): Promise<WorkbenchOnboarding> {
    await this.ensureInitialized();
    const activeProvider = await this.opengoat.getAgentProvider(DEFAULT_AGENT_ID);
    const allProviders = await this.opengoat.listProviders();
    const providers = selectProvidersForOnboarding(DEFAULT_AGENT_ID, allProviders);
    const families = buildProviderFamilies(providers);
    const gatewaySettings = await this.store.getGatewaySettings();
    const withOnboarding = await Promise.all(
      providers.map(async (provider) => {
        const onboarding = await this.opengoat.getProviderOnboarding(provider.id);
        const guidedAuth = this.resolveGuidedAuthFn(provider.id);
        const config = await this.opengoat.getProviderConfig(provider.id);
        const envFields = onboarding?.env ?? [];
        const configuredEnv = config?.env ?? {};
        const configuredEnvKeys = Object.keys(configuredEnv).sort((left, right) =>
          left.localeCompare(right)
        );
        const nonSecretKeys = new Set(
          envFields.filter((entry) => entry.secret !== true).map((entry) => entry.key)
        );
        const configuredEnvValues = Object.fromEntries(
          Object.entries(configuredEnv)
            .filter(([key, value]) => nonSecretKeys.has(key) && Boolean(value?.trim()))
            .map(([key, value]) => [key, value.trim()])
        );
        const missingRequiredEnv = envFields
          .filter((entry) => entry.required)
          .map((entry) => entry.key)
          .filter((key) => !(configuredEnv[key]?.trim()));

        return {
          id: provider.id,
          displayName: provider.displayName,
          kind: provider.kind,
          guidedAuth: guidedAuth
            ? {
                title: guidedAuth.title,
                description: guidedAuth.description
              }
            : undefined,
          envFields,
          configuredEnvKeys,
          configuredEnvValues,
          missingRequiredEnv,
          hasConfig: config !== null
        };
      })
    );

    const active = withOnboarding.find((provider) => provider.id === activeProvider.providerId);
    const needsOnboarding = !active || active.missingRequiredEnv.length > 0;

    return {
      activeProviderId: activeProvider.providerId,
      needsOnboarding,
      families,
      providers: withOnboarding,
      gateway: {
        mode: gatewaySettings.mode,
        remoteUrl: gatewaySettings.remoteUrl,
        timeoutMs: gatewaySettings.timeoutMs,
        hasAuthToken: Boolean(this.remoteGatewayToken)
      }
    };
  }

  public async submitOnboarding(input: {
    providerId: string;
    env: Record<string, string>;
  }): Promise<WorkbenchOnboarding> {
    await this.ensureInitialized();
    await this.opengoat.setProviderConfig(input.providerId, input.env);
    await this.opengoat.setAgentProvider(DEFAULT_AGENT_ID, input.providerId);
    await this.store.setProviderSetupCompleted(true);
    return this.getOnboardingState();
  }

  public async completeOnboarding(): Promise<void> {
    await this.store.setProviderSetupCompleted(true);
  }

  public async getGatewayStatus(): Promise<WorkbenchGatewayStatus> {
    const gatewaySettings = await this.store.getGatewaySettings();
    return {
      mode: gatewaySettings.mode,
      remoteUrl: gatewaySettings.remoteUrl,
      timeoutMs: gatewaySettings.timeoutMs,
      hasAuthToken: Boolean(this.remoteGatewayToken)
    };
  }

  public async updateGateway(input: {
    mode: WorkbenchGatewayMode;
    remoteUrl?: string;
    remoteToken?: string;
    timeoutMs?: number;
  }): Promise<WorkbenchGatewayStatus> {
    await this.applyGatewaySettings(input);
    return this.getGatewayStatus();
  }

  public async runOnboardingGuidedAuth(input: {
    providerId: string;
  }): Promise<WorkbenchGuidedAuthResult> {
    const providerId = input.providerId.trim().toLowerCase();
    const guidedAuth = this.resolveGuidedAuthFn(providerId);
    if (!guidedAuth) {
      throw new Error(`Guided auth is not available for provider "${providerId}".`);
    }

    const notes: string[] = [];
    const result = await this.runGuidedAuthFn(providerId, {
      prompter: createDesktopGuidedAuthPrompter(notes)
    });

    return {
      providerId,
      env: result.env,
      note: result.note,
      notes
    };
  }

  public async listAgents(): Promise<WorkbenchAgent[]> {
    await this.ensureInitialized();
    const agents = await this.opengoat.listAgents();
    const withProviders = await Promise.all(
      agents.map(async (agent) => {
        try {
          const binding = await this.opengoat.getAgentProvider(agent.id);
          return {
            ...agent,
            providerId: binding.providerId
          };
        } catch {
          return { ...agent };
        }
      })
    );
    return withProviders;
  }

  public async listAgentProviders(): Promise<WorkbenchProviderSummary[]> {
    await this.ensureInitialized();
    const providers = await this.opengoat.listProviders();
    return providers.map((provider) => ({
      id: provider.id,
      displayName: provider.displayName,
      kind: provider.kind
    }));
  }

  public async createAgent(input: {
    name: string;
    providerId?: string;
    createExternalAgent?: boolean;
  }): Promise<WorkbenchAgentCreationResult> {
    await this.ensureInitialized();
    const providerId = input.providerId?.trim();
    const createExternalAgent = Boolean(input.createExternalAgent);
    if (createExternalAgent && !providerId) {
      throw new Error("`--create-external` requires `--provider <id>`.");
    }

    const created = await this.opengoat.createAgent(input.name, {
      providerId,
      createExternalAgent
    });
    const binding = await this.opengoat.getAgentProvider(created.agent.id);
    return {
      ...created,
      agent: {
        ...created.agent,
        providerId: binding.providerId
      }
    };
  }

  public async deleteAgent(input: {
    agentId: string;
    providerId?: string;
    deleteExternalAgent?: boolean;
  }): Promise<WorkbenchAgentDeletionResult> {
    await this.ensureInitialized();
    const agentId = normalizeAgentId(input.agentId);
    if (!agentId) {
      throw new Error("Agent id cannot be empty.");
    }
    if (agentId === DEFAULT_AGENT_ID) {
      throw new Error("Cannot delete orchestrator. It is the immutable default entry agent.");
    }

    return this.opengoat.deleteAgent(agentId, {
      providerId: input.providerId?.trim() || undefined,
      deleteExternalAgent: Boolean(input.deleteExternalAgent)
    });
  }

  public listProjects(): Promise<WorkbenchProject[]> {
    return this.ensureInitialized().then(() => this.store.listProjects());
  }

  public async addProject(rawPath: string): Promise<WorkbenchProject> {
    const normalized = path.resolve(rawPath.trim());
    await assertDirectory(normalized);
    return this.store.addProject(normalized);
  }

  public renameProject(projectId: string, name: string): Promise<WorkbenchProject> {
    return this.store.renameProject(projectId, name);
  }

  public removeProject(projectId: string): Promise<void> {
    return this.store.removeProject(projectId);
  }

  public async pickAndAddProject(): Promise<WorkbenchProject | null> {
    const selection = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      title: "Select a project folder"
    });

    if (selection.canceled || selection.filePaths.length === 0) {
      return null;
    }

    const first = selection.filePaths[0];
    if (!first) {
      return null;
    }

    return this.addProject(first);
  }

  public async createSession(projectId: string, title?: string): Promise<WorkbenchSession> {
    const sessionTitle = normalizeSessionTitle(title);
    return this.store.createSession(projectId, sessionTitle);
  }

  public listSessions(projectId: string): Promise<WorkbenchSession[]> {
    return this.store.listSessions(projectId);
  }

  public renameSession(projectId: string, sessionId: string, title: string): Promise<WorkbenchSession> {
    return this.store.renameSession(projectId, sessionId, normalizeSessionTitle(title));
  }

  public removeSession(projectId: string, sessionId: string): Promise<void> {
    return this.store.removeSession(projectId, sessionId);
  }

  public listMessages(projectId: string, sessionId: string): Promise<WorkbenchMessage[]> {
    return this.store.listMessages(projectId, sessionId);
  }

  public async sendMessage(params: {
    projectId: string;
    sessionId: string;
    message: string;
  }): Promise<WorkbenchSendMessageResult> {
    const message = params.message.trim();
    if (!message) {
      throw new Error("Message cannot be empty.");
    }

    const project = await this.store.getProject(params.projectId);
    const session = await this.store.getSession(params.projectId, params.sessionId);

    await this.store.appendMessage(project.id, session.id, {
      role: "user",
      content: message
    });

    const run = await this.executeOrchestratorRun({
      message,
      sessionRef: session.sessionKey,
      cwd: project.rootPath
    });
    if (run.code !== 0) {
      const details = (run.stderr || run.stdout || "No provider error details were returned.").trim();
      throw new Error(
        `Orchestrator provider failed (${run.providerId}, code ${run.code}). ${details}`
      );
    }

    const assistantContent = (run.stdout || run.stderr || "No response was returned.").trim();
    const persistedSession = await this.store.appendMessage(project.id, session.id, {
      role: "assistant",
      content: assistantContent,
      tracePath: run.tracePath,
      providerId: run.providerId
    });

    const latest = persistedSession.messages[persistedSession.messages.length - 1];
    if (!latest) {
      throw new Error("Assistant response could not be stored.");
    }

    return {
      session: persistedSession,
      reply: latest,
      tracePath: run.tracePath,
      providerId: run.providerId
    };
  }

  private async executeOrchestratorRun(input: {
    message: string;
    sessionRef: string;
    cwd: string;
  }): Promise<{
    code: number;
    stdout: string;
    stderr: string;
    providerId: string;
    tracePath?: string;
  }> {
    const gatewaySettings = await this.store.getGatewaySettings();
    if (gatewaySettings.mode !== "remote") {
      const providerBinding = await this.opengoat.getAgentProvider(DEFAULT_AGENT_ID);
      const providerConfig = await this.opengoat.getProviderConfig(providerBinding.providerId);
      const providerConfigKeys = Object.keys(providerConfig?.env ?? {});
      const run = await this.opengoat.runAgent("orchestrator", {
        message: input.message,
        sessionRef: input.sessionRef,
        cwd: input.cwd,
        env: await this.buildInvocationEnv(input.cwd, providerConfigKeys)
      });
      return {
        code: run.code,
        stdout: run.stdout,
        stderr: run.stderr,
        providerId: run.providerId,
        tracePath: run.tracePath
      };
    }

    const remoteUrl = gatewaySettings.remoteUrl?.trim();
    if (!remoteUrl) {
      throw new Error(
        "Remote gateway mode is enabled, but no gateway URL is configured. Open Provider Setup and add a remote gateway URL, or switch back to local runtime."
      );
    }

    const gatewayCall = await this.callGatewayFn<{
      runId?: string;
      result?: unknown;
    }>({
      url: remoteUrl,
      token: this.remoteGatewayToken,
      timeoutMs: gatewaySettings.timeoutMs,
      method: "agent.run",
      clientId: "opengoat-desktop",
      clientDisplayName: "OpenGoat Desktop",
      clientVersion: process.env.npm_package_version ?? "dev",
      platform: process.platform,
      mode: "operator-desktop",
      params: {
        idempotencyKey: randomUUID(),
        agentId: "orchestrator",
        message: input.message,
        sessionRef: input.sessionRef,
        cwd: input.cwd
      }
    });

    return parseGatewayRunResult(gatewayCall.payload);
  }

  private async applyGatewaySettings(input?: {
    mode: WorkbenchGatewayMode;
    remoteUrl?: string;
    remoteToken?: string;
    timeoutMs?: number;
  }): Promise<void> {
    if (!input) {
      return;
    }

    const mode: WorkbenchGatewayMode = input.mode === "remote" ? "remote" : "local";
    const timeoutMs = normalizeGatewayTimeoutMs(input.timeoutMs);
    const remoteUrl = input.remoteUrl?.trim() || undefined;

    await this.store.setGatewaySettings({
      mode,
      remoteUrl,
      timeoutMs
    });

    if (mode === "local") {
      this.remoteGatewayToken = undefined;
      return;
    }

    if (typeof input.remoteToken === "string") {
      const token = input.remoteToken.trim();
      this.remoteGatewayToken = token || undefined;
    }
  }

  private async buildInvocationEnv(
    projectRootPath: string,
    providerConfigKeys: string[] = []
  ): Promise<NodeJS.ProcessEnv> {
    const env: NodeJS.ProcessEnv = { ...process.env };

    for (const cwd of collectDotEnvDirectories(projectRootPath)) {
      await this.loadDotEnvFn({ cwd, env });
    }

    for (const key of providerConfigKeys) {
      if (key in env) {
        delete env[key];
      }
    }

    return env;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initializationPromise) {
      this.initializationPromise = this.opengoat.initialize().then(() => undefined);
    }

    try {
      await this.initializationPromise;
    } catch (error) {
      this.initializationPromise = undefined;
      throw error;
    }
  }
}

async function assertDirectory(targetPath: string): Promise<void> {
  const metadata = await stat(targetPath);
  if (!metadata.isDirectory()) {
    throw new Error(`Not a directory: ${targetPath}`);
  }
}

function normalizeSessionTitle(input?: string): string {
  const value = input?.trim();
  if (!value) {
    return "New session";
  }
  if (value.length <= 120) {
    return value;
  }
  return `${value.slice(0, 117)}...`;
}

function collectDotEnvDirectories(projectRootPath: string): string[] {
  const cwd = process.cwd();
  const candidates = [
    projectRootPath,
    cwd,
    path.resolve(cwd, ".."),
    path.resolve(cwd, "../..")
  ];
  const seen = new Set<string>();
  const resolved: string[] = [];

  for (const candidate of candidates) {
    const normalized = path.resolve(candidate);
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    resolved.push(normalized);
  }

  return resolved;
}

function normalizeGatewayTimeoutMs(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return WORKBENCH_GATEWAY_DEFAULT_TIMEOUT_MS;
  }
  return Math.max(1000, Math.min(120_000, Math.floor(value ?? WORKBENCH_GATEWAY_DEFAULT_TIMEOUT_MS)));
}

function parseGatewayRunResult(payload: unknown): {
  code: number;
  stdout: string;
  stderr: string;
  providerId: string;
  tracePath?: string;
} {
  const payloadRecord = toRecord(payload);
  if (!payloadRecord) {
    throw new Error("Remote gateway returned an invalid response payload.");
  }

  const resultRecord = toRecord(payloadRecord.result) ?? payloadRecord;
  const code = resultRecord.code;
  if (typeof code !== "number" || !Number.isFinite(code)) {
    throw new Error("Remote gateway response is missing result.code.");
  }

  const stdout = typeof resultRecord.stdout === "string" ? resultRecord.stdout : "";
  const stderr = typeof resultRecord.stderr === "string" ? resultRecord.stderr : "";
  const providerId = typeof resultRecord.providerId === "string" && resultRecord.providerId.trim()
    ? resultRecord.providerId
    : "remote-gateway";
  const tracePath = typeof resultRecord.tracePath === "string" && resultRecord.tracePath.trim()
    ? resultRecord.tracePath
    : undefined;

  return {
    code,
    stdout,
    stderr,
    providerId,
    tracePath
  };
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function createDesktopGuidedAuthPrompter(notes: string[]): {
  intro: (message: string) => Promise<void>;
  outro: (message: string) => Promise<void>;
  note: (message: string, title?: string) => Promise<void>;
  select: <T>(message: string, options: Array<{ value: T; label: string; hint?: string }>, initialValue?: T) => Promise<T>;
  text: (options: {
    message: string;
    initialValue?: string;
    placeholder?: string;
    required?: boolean;
    secret?: boolean;
  }) => Promise<string>;
  confirm: (options: { message: string; initialValue?: boolean }) => Promise<boolean>;
  progress: (initialMessage: string) => { update: (message: string) => void; stop: (message?: string) => void };
} {
  return {
    async intro(message: string): Promise<void> {
      notes.push(message);
    },
    async outro(message: string): Promise<void> {
      notes.push(message);
    },
    async note(message: string, title?: string): Promise<void> {
      notes.push(title ? `${title}: ${message}` : message);
    },
    async select<T>(
      message: string,
      options: Array<{ value: T; label: string; hint?: string }>,
      initialValue?: T
    ): Promise<T> {
      const selected = initialValue ?? options[0]?.value;
      if (selected === undefined) {
        throw new Error(`Guided auth could not auto-select an option for: ${message}`);
      }
      return selected;
    },
    async text(options: {
      message: string;
      initialValue?: string;
      placeholder?: string;
      required?: boolean;
      secret?: boolean;
    }): Promise<string> {
      const value = options.initialValue?.trim();
      if (value) {
        return value;
      }
      if (options.required) {
        throw new Error(
          `Guided auth requires manual input for "${options.message}". ` +
            "Use CLI onboarding for this provider or configure env vars first."
        );
      }
      return "";
    },
    async confirm(options: { message: string; initialValue?: boolean }): Promise<boolean> {
      return options.initialValue ?? true;
    },
    progress(initialMessage: string): { update: (message: string) => void; stop: (message?: string) => void } {
      notes.push(initialMessage);
      return {
        update(message: string): void {
          notes.push(message);
        },
        stop(message?: string): void {
          if (message) {
            notes.push(message);
          }
        }
      };
    }
  };
}
