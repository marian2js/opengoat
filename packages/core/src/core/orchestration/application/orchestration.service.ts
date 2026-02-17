import { randomUUID } from "node:crypto";
import type { AgentManifestService } from "../../agents/index.js";
import { DEFAULT_AGENT_ID, normalizeAgentId } from "../../domain/agent-id.js";
import type { OpenGoatPaths } from "../../domain/opengoat-paths.js";
import { createNoopLogger, type Logger } from "../../logging/index.js";
import type {
  AgentRuntimeProfile,
  AgentProviderBinding,
  ProviderExecutionResult,
  ProviderInvokeOptions,
  ProviderService
} from "../../providers/index.js";
import { SessionService, type SessionCompactionResult, type SessionRunInfo } from "../../sessions/index.js";
import type { OrchestrationRunEvent, OrchestrationRunOptions } from "../domain/run-events.js";
import type { AgentRunTrace, OrchestrationRunResult, RoutingDecision } from "../domain/routing.js";
import { RoutingService } from "./routing.service.js";

interface OrchestrationServiceDeps {
  providerService: ProviderService;
  agentManifestService: AgentManifestService;
  sessionService: SessionService;
  routingService?: RoutingService;
  fileSystem: {
    ensureDir(path: string): Promise<void>;
    writeFile(path: string, content: string): Promise<void>;
  };
  pathPort: {
    join(...parts: string[]): string;
  };
  nowIso: () => string;
  logger?: Logger;
}

interface AgentInvocationResult {
  execution: ProviderExecutionResult & AgentProviderBinding;
  session?: SessionRunInfo & {
    preRunCompactionApplied: boolean;
    postRunCompaction: SessionCompactionResult;
  };
}

const OPENCLAW_PROVIDER_ID = "openclaw";
const DEFAULT_RUNTIME_PROFILE: AgentRuntimeProfile = {
  agentId: DEFAULT_AGENT_ID,
  providerId: OPENCLAW_PROVIDER_ID,
  providerKind: "cli",
  workspaceAccess: "provider-default",
  roleSkillDirectories: ["skills"]
};

export class OrchestrationService {
  private readonly providerService: ProviderService;
  private readonly agentManifestService: AgentManifestService;
  private readonly sessionService: SessionService;
  private readonly routingService: RoutingService;
  private readonly fileSystem: {
    ensureDir(path: string): Promise<void>;
    writeFile(path: string, content: string): Promise<void>;
  };
  private readonly pathPort: {
    join(...parts: string[]): string;
  };
  private readonly nowIso: () => string;
  private readonly logger: Logger;

  public constructor(deps: OrchestrationServiceDeps) {
    this.providerService = deps.providerService;
    this.agentManifestService = deps.agentManifestService;
    this.sessionService = deps.sessionService;
    this.routingService = deps.routingService ?? new RoutingService();
    this.fileSystem = deps.fileSystem;
    this.pathPort = deps.pathPort;
    this.nowIso = deps.nowIso;
    this.logger = (deps.logger ?? createNoopLogger()).child({ scope: "manager-runtime-service" });
  }

  public async routeMessage(paths: OpenGoatPaths, entryAgentId: string, message: string): Promise<RoutingDecision> {
    const manifests = await this.agentManifestService.listManifests(paths);
    const resolvedEntryAgentId = resolveEntryAgentId(entryAgentId, manifests);

    return this.routingService.decide({
      entryAgentId: resolvedEntryAgentId,
      message,
      manifests
    });
  }

  public async runAgent(
    paths: OpenGoatPaths,
    entryAgentId: string,
    options: OrchestrationRunOptions
  ): Promise<OrchestrationRunResult> {
    const runId = generateRunId();
    const startedAt = this.nowIso();
    const manifests = await this.agentManifestService.listManifests(paths);
    const resolvedEntryAgentId = resolveEntryAgentId(entryAgentId, manifests);

    emitRunStatusEvent(options, {
      stage: "run_started",
      runId,
      timestamp: this.nowIso(),
      agentId: resolvedEntryAgentId
    });

    const sessionAgentId = resolvedEntryAgentId;
    const startedMs = Date.now();
    const direct = await this.invokeAgentWithSession(paths, resolvedEntryAgentId, options, {
      sessionAgentId,
      runId
    });
    const durationMs = Date.now() - startedMs;

    const completedAt = this.nowIso();
    const trace = await this.buildAndWriteTrace({
      paths,
      runId,
      startedAt,
      completedAt,
      entryAgentId: resolvedEntryAgentId,
      userMessage: options.message,
      execution: direct.execution,
      durationMs,
      session: direct.session
    });

    this.logger.info("Completed manager runtime invocation.", {
      runId,
      entryAgentId: resolvedEntryAgentId,
      code: direct.execution.code,
      durationMs
    });

    emitRunStatusEvent(options, {
      stage: "run_completed",
      runId,
      timestamp: this.nowIso(),
      agentId: resolvedEntryAgentId
    });

    return {
      ...direct.execution,
      entryAgentId: resolvedEntryAgentId,
      tracePath: trace.tracePath,
      session: direct.session
    };
  }

  private async invokeAgentWithSession(
    paths: OpenGoatPaths,
    agentId: string,
    options: OrchestrationRunOptions,
    behavior: { sessionAgentId?: string; runId?: string; step?: number } = {}
  ): Promise<AgentInvocationResult> {
    const sessionAgentId = normalizeAgentId(behavior.sessionAgentId ?? agentId) || DEFAULT_AGENT_ID;
    const runtimeProfile = await this.resolveAgentRuntimeProfile(paths, agentId);
    const preparedSession = await this.sessionService.prepareRunSession(paths, sessionAgentId, {
      sessionRef: options.sessionRef,
      forceNew: options.forceNewSession,
      disableSession: options.disableSession,
      userMessage: options.message
    });

    const invokeOptions = sanitizeProviderInvokeOptions(options);
    if (behavior.runId) {
      invokeOptions.idempotencyKey = behavior.runId;
    }
    if (preparedSession.enabled) {
      invokeOptions.providerSessionId = preparedSession.info.sessionId;
      const resolvedCwd = resolveInvocationCwd({
        requestedCwd: invokeOptions.cwd,
        workspacePath: preparedSession.info.workspacePath,
        workspaceAccess: runtimeProfile.workspaceAccess
      });
      if (resolvedCwd) {
        invokeOptions.cwd = resolvedCwd;
      } else {
        delete invokeOptions.cwd;
      }
    }

    const runtimeHooks = {
      onInvocationStarted: (event: {
        runId?: string;
        timestamp: string;
        step?: number;
        agentId: string;
        providerId: string;
      }) => {
        emitRunStatusEvent(options, {
          stage: "provider_invocation_started",
          runId: event.runId ?? behavior.runId ?? "unknown-run",
          timestamp: event.timestamp,
          step: event.step ?? behavior.step,
          agentId: event.agentId,
          providerId: event.providerId
        });
      },
      onInvocationCompleted: (event: {
        runId?: string;
        timestamp: string;
        step?: number;
        agentId: string;
        providerId: string;
        code: number;
      }) => {
        emitRunStatusEvent(options, {
          stage: "provider_invocation_completed",
          runId: event.runId ?? behavior.runId ?? "unknown-run",
          timestamp: event.timestamp,
          step: event.step ?? behavior.step,
          agentId: event.agentId,
          providerId: event.providerId,
          code: event.code
        });
      }
    };

    let execution = await this.providerService.invokeAgent(paths, agentId, invokeOptions, {
      runId: behavior.runId,
      step: behavior.step,
      hooks: runtimeHooks
    });
    execution = await this.repairMissingAgentRegistrationAndRetry({
      paths,
      agentId,
      invokeOptions,
      execution,
      runId: behavior.runId,
      step: behavior.step,
      hooks: runtimeHooks
    });

    if (!preparedSession.enabled) {
      return {
        execution,
        session: undefined
      };
    }

    const assistantContent =
      execution.stdout.trim() ||
      (execution.stderr.trim()
        ? `[Runtime error code ${execution.code}] ${execution.stderr.trim()}`
        : `[Runtime exited with code ${execution.code}]`);

    const postRunCompaction = await this.sessionService.recordAssistantReply(
      paths,
      preparedSession.info,
      assistantContent
    );

    return {
      execution,
      session: {
        ...preparedSession.info,
        preRunCompactionApplied: preparedSession.compactionApplied,
        postRunCompaction
      }
    };
  }

  private async repairMissingAgentRegistrationAndRetry(params: {
    paths: OpenGoatPaths;
    agentId: string;
    invokeOptions: ProviderInvokeOptions;
    execution: ProviderExecutionResult & AgentProviderBinding;
    runId?: string;
    step?: number;
    hooks: {
      onInvocationStarted: (event: {
        runId?: string;
        timestamp: string;
        step?: number;
        agentId: string;
        providerId: string;
      }) => void;
      onInvocationCompleted: (event: {
        runId?: string;
        timestamp: string;
        step?: number;
        agentId: string;
        providerId: string;
        code: number;
      }) => void;
    };
  }): Promise<ProviderExecutionResult & AgentProviderBinding> {
    if (params.execution.providerId !== OPENCLAW_PROVIDER_ID) {
      return params.execution;
    }

    if (!containsMissingAgentMessage(params.execution.stdout, params.execution.stderr)) {
      return params.execution;
    }

    let manifest:
      | {
          agentId: string;
          workspaceDir: string;
          metadata: { name: string };
        }
      | undefined;

    try {
      const fetched = await this.agentManifestService.getManifest(params.paths, params.agentId);
      manifest = {
        agentId: fetched.agentId,
        workspaceDir: fetched.workspaceDir,
        metadata: {
          name: fetched.metadata.name
        }
      };
    } catch (error) {
      this.logger.warn("OpenClaw missing-agent auto-repair skipped: local manifest unavailable.", {
        agentId: params.agentId,
        error: toErrorMessage(error)
      });
      return params.execution;
    }

    const internalConfigDir = this.pathPort.join(params.paths.agentsDir, manifest.agentId);
    const displayName = manifest.metadata.name?.trim() || manifest.agentId;

    const repair = await this.providerService.createProviderAgent(params.paths, manifest.agentId, {
      displayName,
      workspaceDir: manifest.workspaceDir,
      internalConfigDir
    });

    if (repair.code !== 0 && !containsAlreadyExistsMessage(repair.stdout, repair.stderr)) {
      this.logger.warn("OpenClaw missing-agent auto-repair failed.", {
        agentId: manifest.agentId,
        code: repair.code,
        stderr: repair.stderr.trim() || undefined,
        stdout: repair.stdout.trim() || undefined
      });
      return params.execution;
    }

    this.logger.warn("OpenClaw missing-agent auto-repair succeeded; retrying invocation.", {
      agentId: manifest.agentId,
      code: repair.code
    });

    const retried = await this.providerService.invokeAgent(params.paths, params.agentId, params.invokeOptions, {
      runId: params.runId,
      step: params.step,
      hooks: params.hooks
    });

    if (!containsMissingAgentMessage(retried.stdout, retried.stderr)) {
      return retried;
    }

    const restarted = await this.providerService.restartLocalGateway(params.paths, params.invokeOptions.env);
    if (!restarted) {
      return retried;
    }

    this.logger.warn("OpenClaw missing-agent retry still failed; retried after gateway restart.", {
      agentId: manifest.agentId
    });

    return this.providerService.invokeAgent(params.paths, params.agentId, params.invokeOptions, {
      runId: params.runId,
      step: params.step,
      hooks: params.hooks
    });
  }

  private async resolveAgentRuntimeProfile(
    paths: OpenGoatPaths,
    agentId: string
  ): Promise<AgentRuntimeProfile> {
    const runtimeProvider = this.providerService as ProviderService & {
      getAgentRuntimeProfile?: (paths: OpenGoatPaths, agentId: string) => Promise<AgentRuntimeProfile>;
    };
    if (typeof runtimeProvider.getAgentRuntimeProfile !== "function") {
      return {
        ...DEFAULT_RUNTIME_PROFILE,
        agentId: normalizeAgentId(agentId) || DEFAULT_AGENT_ID
      };
    }
    return runtimeProvider.getAgentRuntimeProfile(paths, agentId);
  }

  private async buildAndWriteTrace(params: {
    paths: OpenGoatPaths;
    runId: string;
    startedAt: string;
    completedAt: string;
    entryAgentId: string;
    userMessage: string;
    execution: ProviderExecutionResult & AgentProviderBinding;
    durationMs: number;
    session?: SessionRunInfo & {
      preRunCompactionApplied: boolean;
      postRunCompaction: SessionCompactionResult;
    };
  }): Promise<{ tracePath: string; trace: AgentRunTrace }> {
    const trace: AgentRunTrace = {
      schemaVersion: 2,
      runId: params.runId,
      startedAt: params.startedAt,
      completedAt: params.completedAt,
      entryAgentId: params.entryAgentId,
      userMessage: params.userMessage,
      session: params.session
        ? {
            ...params.session,
            postRunCompactionApplied: params.session.postRunCompaction?.applied ?? false,
            postRunCompactionSummary: params.session.postRunCompaction?.summary
          }
        : undefined,
      execution: {
        agentId: params.execution.agentId,
        providerId: params.execution.providerId,
        code: params.execution.code,
        stdout: params.execution.stdout,
        stderr: params.execution.stderr,
        durationMs: params.durationMs
      }
    };

    await this.fileSystem.ensureDir(params.paths.runsDir);
    const tracePath = this.pathPort.join(params.paths.runsDir, `${trace.runId}.json`);
    await this.fileSystem.writeFile(tracePath, `${JSON.stringify(trace, null, 2)}\n`);
    return { tracePath, trace };
  }
}

function generateRunId(): string {
  return randomUUID().toLowerCase();
}

function resolveEntryAgentId(entryAgentId: string, manifests: Array<{ agentId: string }>): string {
  const normalizedEntryAgentId = normalizeAgentId(entryAgentId) || DEFAULT_AGENT_ID;
  if (manifests.some((manifest) => manifest.agentId === normalizedEntryAgentId)) {
    return normalizedEntryAgentId;
  }

  if (manifests.some((manifest) => manifest.agentId === DEFAULT_AGENT_ID)) {
    return DEFAULT_AGENT_ID;
  }

  return manifests[0]?.agentId || normalizedEntryAgentId;
}

function emitRunStatusEvent(options: OrchestrationRunOptions, event: OrchestrationRunEvent): void {
  options.hooks?.onEvent?.(event);
}

function sanitizeProviderInvokeOptions(options: OrchestrationRunOptions): ProviderInvokeOptions {
  const sanitized: ProviderInvokeOptions = { ...options };
  delete sanitized.sessionRef;
  delete sanitized.forceNewSession;
  delete sanitized.disableSession;
  delete (sanitized as ProviderInvokeOptions & { hooks?: unknown }).hooks;
  return sanitized;
}

function resolveInvocationCwd(params: {
  requestedCwd: string | undefined;
  workspacePath: string;
  workspaceAccess: AgentRuntimeProfile["workspaceAccess"];
}): string | undefined {
  if (params.workspaceAccess === "provider-default") {
    return undefined;
  }

  if (params.workspaceAccess === "agent-workspace") {
    const workspacePath = params.workspacePath.trim();
    if (workspacePath) {
      return workspacePath;
    }
    const normalizedRequested = params.requestedCwd?.trim();
    return normalizedRequested || undefined;
  }

  return params.requestedCwd?.trim() || undefined;
}

function containsMissingAgentMessage(stdout: string, stderr: string): boolean {
  return /\b(not found|does not exist|no such agent|unknown agent|could not find|no agent found|not exist)\b/i.test(
    `${stdout}\n${stderr}`
  );
}

function containsAlreadyExistsMessage(stdout: string, stderr: string): boolean {
  return /\balready exists?\b/i.test(`${stdout}\n${stderr}`);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
