import { randomUUID } from "node:crypto";
import type { AgentManifestService } from "../../agents/index.js";
import { DEFAULT_AGENT_ID, normalizeAgentId } from "../../domain/agent-id.js";
import type { OpenGoatPaths } from "../../domain/opengoat-paths.js";
import { createNoopLogger, type Logger } from "../../logging/index.js";
import type {
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

    const routing: RoutingDecision = {
      entryAgentId: resolvedEntryAgentId,
      targetAgentId: resolvedEntryAgentId,
      confidence: 1,
      reason: "Direct OpenClaw runtime invocation.",
      rewrittenMessage: options.message,
      candidates: []
    };

    const completedAt = this.nowIso();
    const orchestration: OrchestrationRunResult["orchestration"] = {
      mode: "single-agent",
      steps: [],
      finalMessage: direct.execution.stdout,
      sessionGraph: {
        nodes: [
          {
            agentId: resolvedEntryAgentId,
            providerId: direct.execution.providerId,
            sessionKey: direct.session?.sessionKey,
            sessionId: direct.session?.sessionId,
            providerSessionId: direct.execution.providerSessionId
          }
        ],
        edges: []
      }
    };

    const trace = await this.buildAndWriteTrace({
      paths,
      runId,
      startedAt,
      completedAt,
      entryAgentId: resolvedEntryAgentId,
      userMessage: options.message,
      routing,
      execution: direct.execution,
      durationMs,
      session: direct.session,
      orchestration
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
      routing,
      tracePath: trace.tracePath,
      session: direct.session,
      orchestration
    };
  }

  private async invokeAgentWithSession(
    paths: OpenGoatPaths,
    agentId: string,
    options: OrchestrationRunOptions,
    behavior: { sessionAgentId?: string; runId?: string; step?: number } = {}
  ): Promise<AgentInvocationResult> {
    const sessionAgentId = normalizeAgentId(behavior.sessionAgentId ?? agentId) || DEFAULT_AGENT_ID;
    const preparedSession = await this.sessionService.prepareRunSession(paths, sessionAgentId, {
      sessionRef: options.sessionRef,
      forceNew: options.forceNewSession,
      disableSession: options.disableSession,
      projectPath: options.cwd,
      userMessage: options.message
    });

    const invokeOptions = sanitizeProviderInvokeOptions(options);
    if (preparedSession.enabled) {
      invokeOptions.providerSessionId = preparedSession.info.sessionId;
      invokeOptions.cwd = resolveInvocationCwd(invokeOptions.cwd, preparedSession.info.projectPath);
      const projectContextPrompt = buildProjectContextSystemPrompt(preparedSession.info);
      if (projectContextPrompt) {
        invokeOptions.systemPrompt = mergeSystemPrompts(invokeOptions.systemPrompt, projectContextPrompt);
      }
    }

    const execution = await this.providerService.invokeAgent(paths, agentId, invokeOptions, {
      runId: behavior.runId,
      step: behavior.step,
      hooks: {
        onInvocationStarted: (event) => {
          emitRunStatusEvent(options, {
            stage: "provider_invocation_started",
            runId: event.runId ?? behavior.runId ?? "unknown-run",
            timestamp: event.timestamp,
            step: event.step ?? behavior.step,
            agentId: event.agentId,
            providerId: event.providerId
          });
        },
        onInvocationCompleted: (event) => {
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
      }
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

  private async buildAndWriteTrace(params: {
    paths: OpenGoatPaths;
    runId: string;
    startedAt: string;
    completedAt: string;
    entryAgentId: string;
    userMessage: string;
    routing: RoutingDecision;
    execution: ProviderExecutionResult & AgentProviderBinding;
    durationMs: number;
    session?: SessionRunInfo & {
      preRunCompactionApplied: boolean;
      postRunCompaction: SessionCompactionResult;
    };
    orchestration?: OrchestrationRunResult["orchestration"];
  }): Promise<{ tracePath: string; trace: AgentRunTrace }> {
    const trace: AgentRunTrace = {
      schemaVersion: 2,
      runId: params.runId,
      startedAt: params.startedAt,
      completedAt: params.completedAt,
      entryAgentId: params.entryAgentId,
      userMessage: params.userMessage,
      routing: params.routing,
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
      },
      orchestration: params.orchestration
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

function resolveInvocationCwd(requestedCwd: string | undefined, sessionProjectPath: string): string {
  const normalizedRequested = requestedCwd?.trim();
  if (normalizedRequested) {
    return normalizedRequested;
  }
  return sessionProjectPath;
}

function buildProjectContextSystemPrompt(session: SessionRunInfo): string | undefined {
  const projectPath = session.projectPath.trim();
  const workspacePath = session.workspacePath.trim();
  if (!projectPath || projectPath === workspacePath) {
    return undefined;
  }

  return [
    "OpenGoat session context:",
    `Session project path: ${projectPath}`,
    `Agent workspace path: ${workspacePath}`,
    "Use the session project path for project files. Prefer absolute paths under that directory or `cd` into it before running commands.",
    "Avoid creating task files in the agent workspace unless the user explicitly asks for it."
  ].join("\n");
}

function mergeSystemPrompts(current: string | undefined, extra: string): string {
  const normalizedCurrent = current?.trim();
  if (!normalizedCurrent) {
    return extra;
  }
  return `${normalizedCurrent}\n\n${extra}`;
}
