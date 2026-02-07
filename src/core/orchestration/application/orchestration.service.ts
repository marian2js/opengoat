import { randomUUID } from "node:crypto";
import path from "node:path";
import type { AgentManifest, AgentManifestService } from "../../agents/index.js";
import { DEFAULT_AGENT_ID, normalizeAgentId } from "../../domain/agent-id.js";
import type { OpenGoatPaths } from "../../domain/opengoat-paths.js";
import type { FileSystemPort } from "../../ports/file-system.port.js";
import type { PathPort } from "../../ports/path.port.js";
import type { AgentProviderBinding, ProviderExecutionResult, ProviderInvokeOptions, ProviderService } from "../../providers/index.js";
import { SessionService, type PreparedSessionRun, type SessionCompactionResult, type SessionRunInfo } from "../../sessions/index.js";
import type {
  OrchestrationAction,
  OrchestrationPlannerDecision,
  OrchestrationRunLedger,
  OrchestrationStepLog
} from "../domain/loop.js";
import type { AgentRunTrace, OrchestrationRunResult, RoutingDecision } from "../domain/routing.js";
import { OrchestrationPlannerService } from "./orchestration-planner.service.js";
import { RoutingService } from "./routing.service.js";

interface OrchestrationServiceDeps {
  providerService: ProviderService;
  agentManifestService: AgentManifestService;
  sessionService: SessionService;
  routingService?: RoutingService;
  plannerService?: OrchestrationPlannerService;
  fileSystem: FileSystemPort;
  pathPort: PathPort;
  nowIso: () => string;
}

interface AgentInvocationResult {
  execution: ProviderExecutionResult & AgentProviderBinding;
  session?: SessionRunInfo & {
    preRunCompactionApplied: boolean;
    postRunCompaction: SessionCompactionResult;
  };
}

interface OrchestrationLoopResult {
  finalMessage: string;
  execution: ProviderExecutionResult & AgentProviderBinding;
  steps: OrchestrationStepLog[];
  sessionGraph: OrchestrationRunLedger["sessionGraph"];
}

const MAX_ORCHESTRATION_STEPS = 12;
const MAX_DELEGATION_STEPS = 8;
const SHARED_NOTES_MAX_CHARS = 12_000;
const RECENT_EVENTS_WINDOW = 10;

export class OrchestrationService {
  private readonly providerService: ProviderService;
  private readonly agentManifestService: AgentManifestService;
  private readonly sessionService: SessionService;
  private readonly routingService: RoutingService;
  private readonly plannerService: OrchestrationPlannerService;
  private readonly fileSystem: FileSystemPort;
  private readonly pathPort: PathPort;
  private readonly nowIso: () => string;

  public constructor(deps: OrchestrationServiceDeps) {
    this.providerService = deps.providerService;
    this.agentManifestService = deps.agentManifestService;
    this.sessionService = deps.sessionService;
    this.routingService = deps.routingService ?? new RoutingService();
    this.plannerService = deps.plannerService ?? new OrchestrationPlannerService();
    this.fileSystem = deps.fileSystem;
    this.pathPort = deps.pathPort;
    this.nowIso = deps.nowIso;
  }

  public async routeMessage(
    paths: OpenGoatPaths,
    entryAgentId: string,
    message: string
  ): Promise<RoutingDecision> {
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
    options: ProviderInvokeOptions
  ): Promise<OrchestrationRunResult> {
    const runId = generateRunId();
    const startedAt = this.nowIso();
    const manifests = await this.agentManifestService.listManifests(paths);
    const resolvedEntryAgentId = resolveEntryAgentId(entryAgentId, manifests);

    if (resolvedEntryAgentId !== DEFAULT_AGENT_ID) {
      const direct = await this.invokeAgentWithSession(paths, resolvedEntryAgentId, {
        ...options,
        message: options.message
      });
      const completedAt = this.nowIso();
      const routing: RoutingDecision = {
        entryAgentId: resolvedEntryAgentId,
        targetAgentId: resolvedEntryAgentId,
        confidence: 1,
        reason: "Direct invocation of a non-orchestrator agent.",
        rewrittenMessage: options.message,
        candidates: []
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
        durationMs: 0,
        session: direct.session,
        orchestration: {
          mode: "single-agent",
          finalMessage: direct.execution.stdout,
          steps: [],
          sessionGraph: {
            nodes: [
              {
                agentId: resolvedEntryAgentId,
                sessionKey: direct.session?.sessionKey,
                sessionId: direct.session?.sessionId
              }
            ],
            edges: []
          }
        }
      });

      return {
        ...direct.execution,
        entryAgentId: resolvedEntryAgentId,
        routing,
        tracePath: trace.tracePath,
        session: direct.session,
        orchestration: trace.trace.orchestration
      };
    }

    const startTime = Date.now();
    const loopResult = await this.runAiOrchestrationLoop(paths, runId, manifests, options);
    const durationMs = Date.now() - startTime;
    const completedAt = this.nowIso();
    const routing: RoutingDecision = {
      entryAgentId: DEFAULT_AGENT_ID,
      targetAgentId: DEFAULT_AGENT_ID,
      confidence: 0.9,
      reason: "AI orchestration loop executed by orchestrator.",
      rewrittenMessage: options.message,
      candidates: []
    };

    const trace = await this.buildAndWriteTrace({
      paths,
      runId,
      startedAt,
      completedAt,
      entryAgentId: DEFAULT_AGENT_ID,
      userMessage: options.message,
      routing,
      execution: loopResult.execution,
      durationMs,
      orchestration: {
        mode: "ai-loop",
        finalMessage: loopResult.finalMessage,
        steps: loopResult.steps,
        sessionGraph: loopResult.sessionGraph
      }
    });

    return {
      ...loopResult.execution,
      entryAgentId: DEFAULT_AGENT_ID,
      routing,
      tracePath: trace.tracePath,
      orchestration: trace.trace.orchestration
    };
  }

  private async runAiOrchestrationLoop(
    paths: OpenGoatPaths,
    runId: string,
    manifests: AgentManifest[],
    options: ProviderInvokeOptions
  ): Promise<OrchestrationLoopResult> {
    const steps: OrchestrationStepLog[] = [];
    const sessionGraph: OrchestrationRunLedger["sessionGraph"] = {
      nodes: [],
      edges: []
    };
    const sharedNotes: string[] = [];
    const recentEvents: string[] = [];
    let delegationCount = 0;
    let finalMessage = "";
    let lastExecution: ProviderExecutionResult & AgentProviderBinding = await this.buildSyntheticExecution(paths, DEFAULT_AGENT_ID);

    for (let step = 1; step <= MAX_ORCHESTRATION_STEPS; step += 1) {
      const plannerPrompt = this.plannerService.buildPlannerPrompt({
        userMessage: options.message,
        step,
        maxSteps: MAX_ORCHESTRATION_STEPS,
        sharedNotes: clampText(sharedNotes.join("\n\n"), SHARED_NOTES_MAX_CHARS),
        recentEvents,
        agents: manifests
      });

      const plannerCall = await this.invokeAgentWithSession(paths, DEFAULT_AGENT_ID, {
        ...options,
        message: plannerPrompt,
        sessionRef: options.sessionRef,
        forceNewSession: step === 1 ? options.forceNewSession : false
      }, { silent: true });
      const plannerRawOutput = plannerCall.execution.stdout.trim() || plannerCall.execution.stderr.trim();
      const plannerDecision = this.plannerService.parseDecision(
        plannerRawOutput,
        "I could not complete orchestration due to planner output parsing issues."
      );
      addSessionNode(sessionGraph, DEFAULT_AGENT_ID, plannerCall.session);

      const stepLog: OrchestrationStepLog = {
        step,
        timestamp: this.nowIso(),
        plannerRawOutput,
        plannerDecision
      };

      const actionResult = await this.executeAction({
        paths,
        runId,
        step,
        action: plannerDecision.action,
        manifests,
        options,
        sessionGraph,
        stepLog,
        sharedNotes,
        recentEvents
      });
      steps.push(stepLog);

      if (actionResult.finalMessage !== undefined) {
        finalMessage = actionResult.finalMessage;
        if (actionResult.execution) {
          lastExecution = actionResult.execution;
        }
        break;
      }

      if (actionResult.execution) {
        lastExecution = actionResult.execution;
      }

      if (plannerDecision.action.type === "delegate_to_agent") {
        delegationCount += 1;
      }
      if (delegationCount >= MAX_DELEGATION_STEPS) {
        finalMessage = "Stopped orchestration after reaching delegation safety limit.";
        break;
      }
    }

    if (!finalMessage) {
      finalMessage =
        sharedNotes.length > 0
          ? `Orchestration reached step limit.\n\nCurrent synthesis:\n${clampText(sharedNotes.join("\n\n"), 2000)}`
          : "Orchestration stopped at safety step limit without a final response.";
    }

    if (!lastExecution.stdout.trim()) {
      lastExecution = {
        ...lastExecution,
        code: 0,
        stdout: ensureTrailingNewline(finalMessage),
        stderr: lastExecution.stderr
      };
    }

    return {
      finalMessage,
      execution: lastExecution,
      steps,
      sessionGraph
    };
  }

  private async executeAction(params: {
    paths: OpenGoatPaths;
    runId: string;
    step: number;
    action: OrchestrationAction;
    manifests: AgentManifest[];
    options: ProviderInvokeOptions;
    sessionGraph: OrchestrationRunLedger["sessionGraph"];
    stepLog: OrchestrationStepLog;
    sharedNotes: string[];
    recentEvents: string[];
  }): Promise<{
    finalMessage?: string;
    execution?: ProviderExecutionResult & AgentProviderBinding;
  }> {
    const action = params.action;

    if (action.type === "finish" || action.type === "respond_user") {
      const message = action.message.trim() || "Completed.";
      params.stepLog.note = action.reason;
      this.addRecentEvent(params.recentEvents, `Step ${params.step}: ${action.type}`);
      return {
        finalMessage: message,
        execution: {
          ...(await this.buildSyntheticExecution(params.paths, DEFAULT_AGENT_ID)),
          code: 0,
          stdout: ensureTrailingNewline(message)
        }
      };
    }

    if (action.type === "read_workspace_file") {
      const resolvedPath = this.resolveWorkspacePath(params.paths, action.path);
      const exists = await this.fileSystem.exists(resolvedPath);
      const content = exists ? await this.fileSystem.readFile(resolvedPath) : `[MISSING] ${resolvedPath}`;
      params.sharedNotes.push(
        clampText(`Read ${action.path}:\n${content}`, 2500)
      );
      params.stepLog.artifactIO = { readPath: resolvedPath };
      this.addRecentEvent(params.recentEvents, `Read file ${action.path}`);
      return {};
    }

    if (action.type === "write_workspace_file") {
      const resolvedPath = this.resolveWorkspacePath(params.paths, action.path);
      await this.fileSystem.ensureDir(path.dirname(resolvedPath));
      await this.fileSystem.writeFile(resolvedPath, ensureTrailingNewline(action.content));
      params.stepLog.artifactIO = { writePath: resolvedPath };
      this.addRecentEvent(params.recentEvents, `Wrote file ${action.path}`);
      return {};
    }

    const targetAgentId = normalizeAgentId(action.targetAgentId);
    const targetManifest = params.manifests.find((manifest) => manifest.agentId === targetAgentId);
    if (!targetManifest || !targetManifest.metadata.delegation.canReceive) {
      const note = `Invalid delegation target "${action.targetAgentId}".`;
      params.sharedNotes.push(note);
      params.stepLog.note = note;
      this.addRecentEvent(params.recentEvents, note);
      return {};
    }

    const mode = action.mode ?? "hybrid";
    const handoffBaseDir = this.pathPort.join(
      params.paths.workspacesDir,
      DEFAULT_AGENT_ID,
      "coordination",
      params.runId
    );
    let outboundPath: string | undefined;
    if (mode === "artifacts" || mode === "hybrid") {
      await this.fileSystem.ensureDir(handoffBaseDir);
      outboundPath = this.pathPort.join(handoffBaseDir, `step-${String(params.step).padStart(2, "0")}-to-${targetAgentId}.md`);
      const handoffDocument = renderHandoffDocument({
        step: params.step,
        userMessage: params.options.message,
        delegateMessage: action.message,
        expectedOutput: action.expectedOutput,
        sharedNotes: params.sharedNotes
      });
      await this.fileSystem.writeFile(outboundPath, ensureTrailingNewline(handoffDocument));
      params.stepLog.artifactIO = {
        ...params.stepLog.artifactIO,
        writePath: outboundPath
      };
    }

    const delegateMessage = renderDelegateMessage({
      step: params.step,
      userMessage: params.options.message,
      delegateMessage: action.message,
      expectedOutput: action.expectedOutput,
      mode,
      outboundPath,
      sharedNotes: params.sharedNotes
    });

    const delegateCall = await this.invokeAgentWithSession(params.paths, targetAgentId, {
      message: delegateMessage,
      env: params.options.env,
      cwd: params.options.cwd,
      sessionRef: `agent:${targetAgentId}:delegation:${params.runId}`
    }, { silent: true });
    const responseText =
      delegateCall.execution.stdout.trim() ||
      (delegateCall.execution.stderr.trim() ? `[stderr] ${delegateCall.execution.stderr.trim()}` : "");

    let inboundPath: string | undefined;
    if (mode === "artifacts" || mode === "hybrid") {
      await this.fileSystem.ensureDir(handoffBaseDir);
      inboundPath = this.pathPort.join(handoffBaseDir, `step-${String(params.step).padStart(2, "0")}-from-${targetAgentId}.md`);
      await this.fileSystem.writeFile(inboundPath, ensureTrailingNewline(responseText || "(empty response)"));
      params.stepLog.artifactIO = {
        ...params.stepLog.artifactIO,
        readPath: inboundPath
      };
    }

    params.stepLog.agentCall = {
      targetAgentId,
      request: delegateMessage,
      response: responseText,
      code: delegateCall.execution.code,
      providerId: delegateCall.execution.providerId,
      sessionKey: delegateCall.session?.sessionKey,
      sessionId: delegateCall.session?.sessionId
    };

    addSessionNode(params.sessionGraph, targetAgentId, delegateCall.session);
    params.sessionGraph.edges.push({
      fromAgentId: DEFAULT_AGENT_ID,
      toAgentId: targetAgentId,
      reason: action.reason || params.stepLog.plannerDecision.rationale
    });

    const note = `Delegated to ${targetAgentId}: ${summarizeText(responseText || "(no response)")}`;
    params.sharedNotes.push(clampText(note, 2000));
    this.addRecentEvent(params.recentEvents, note);

    return {
      execution: delegateCall.execution
    };
  }

  private addRecentEvent(events: string[], value: string): void {
    events.push(summarizeText(value));
    while (events.length > RECENT_EVENTS_WINDOW) {
      events.shift();
    }
  }

  private resolveWorkspacePath(paths: OpenGoatPaths, requestedPath: string): string {
    const normalized = requestedPath.replace(/\\/g, "/").trim();
    const orchestratorWorkspace = this.pathPort.join(paths.workspacesDir, DEFAULT_AGENT_ID);
    const unsafeSegments = normalized.split("/").filter((segment) => segment === "..");
    if (unsafeSegments.length > 0) {
      return this.pathPort.join(orchestratorWorkspace, "coordination", "unsafe-path-blocked.md");
    }
    const relative = normalized.replace(/^\/+/, "");
    return this.pathPort.join(orchestratorWorkspace, relative || "coordination/context.md");
  }

  private async invokeAgentWithSession(
    paths: OpenGoatPaths,
    agentId: string,
    options: ProviderInvokeOptions,
    behavior: { silent?: boolean } = {}
  ): Promise<AgentInvocationResult> {
    const preparedSession = await this.sessionService.prepareRunSession(paths, agentId, {
      sessionRef: options.sessionRef,
      forceNew: options.forceNewSession,
      disableSession: options.disableSession,
      userMessage: options.message
    });
    const invokeOptions = sanitizeProviderInvokeOptions({
      ...options,
      sessionContext: preparedSession.enabled ? preparedSession.contextPrompt : undefined
    });
    if (behavior.silent) {
      delete invokeOptions.onStdout;
      delete invokeOptions.onStderr;
    }
    const execution = await this.providerService.invokeAgent(paths, agentId, invokeOptions);
    if (!preparedSession.enabled) {
      return {
        execution,
        session: undefined
      };
    }

    const assistantContent =
      execution.stdout.trim() ||
      (execution.stderr.trim()
        ? `[Provider error code ${execution.code}] ${execution.stderr.trim()}`
        : `[Provider exited with code ${execution.code}]`);
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
    const tracePath = await this.writeTrace(params.paths, trace);
    return { tracePath, trace };
  }

  private async buildSyntheticExecution(
    paths: OpenGoatPaths,
    agentId: string
  ): Promise<ProviderExecutionResult & AgentProviderBinding> {
    const binding = await this.providerService.getAgentProvider(paths, agentId);
    return {
      ...binding,
      code: 0,
      stdout: "",
      stderr: ""
    };
  }

  private async writeTrace(paths: OpenGoatPaths, trace: AgentRunTrace): Promise<string> {
    await this.fileSystem.ensureDir(paths.runsDir);
    const tracePath = this.pathPort.join(paths.runsDir, `${trace.runId}.json`);
    await this.fileSystem.writeFile(tracePath, `${JSON.stringify(trace, null, 2)}\n`);
    return tracePath;
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

function sanitizeProviderInvokeOptions(options: ProviderInvokeOptions): ProviderInvokeOptions {
  const sanitized: ProviderInvokeOptions = { ...options };
  delete sanitized.sessionRef;
  delete sanitized.forceNewSession;
  delete sanitized.disableSession;
  return sanitized;
}

function renderDelegateMessage(params: {
  step: number;
  userMessage: string;
  delegateMessage: string;
  expectedOutput?: string;
  mode: "direct" | "artifacts" | "hybrid";
  outboundPath?: string;
  sharedNotes: string[];
}): string {
  const lines = [
    `Delegation step: ${params.step}`,
    "",
    "Original user request:",
    params.userMessage,
    "",
    "Delegation instruction:",
    params.delegateMessage,
    ""
  ];
  if (params.expectedOutput?.trim()) {
    lines.push("Expected output:", params.expectedOutput.trim(), "");
  }
  if (params.sharedNotes.length > 0) {
    lines.push("Shared notes from previous steps:", clampText(params.sharedNotes.join("\n\n"), 4000), "");
  }
  if ((params.mode === "artifacts" || params.mode === "hybrid") && params.outboundPath) {
    lines.push(`Coordination file: ${params.outboundPath}`, "You may use this markdown artifact for durable handoff context.", "");
  }
  lines.push("Return a concise result for the orchestrator.");
  return lines.join("\n");
}

function renderHandoffDocument(params: {
  step: number;
  userMessage: string;
  delegateMessage: string;
  expectedOutput?: string;
  sharedNotes: string[];
}): string {
  return [
    `# Delegation Step ${params.step}`,
    "",
    "## User Request",
    params.userMessage,
    "",
    "## Delegation Instruction",
    params.delegateMessage,
    "",
    "## Expected Output",
    params.expectedOutput?.trim() || "(not specified)",
    "",
    "## Prior Notes",
    params.sharedNotes.length > 0 ? clampText(params.sharedNotes.join("\n\n"), 4000) : "(none)"
  ].join("\n");
}

function addSessionNode(
  graph: OrchestrationRunLedger["sessionGraph"],
  agentId: string,
  session:
    | (SessionRunInfo & {
        preRunCompactionApplied: boolean;
        postRunCompaction?: SessionCompactionResult;
      })
    | undefined
): void {
  if (!session) {
    return;
  }

  const exists = graph.nodes.some(
    (node) =>
      node.agentId === agentId &&
      node.sessionKey === session.sessionKey &&
      node.sessionId === session.sessionId
  );
  if (exists) {
    return;
  }

  graph.nodes.push({
    agentId,
    sessionKey: session.sessionKey,
    sessionId: session.sessionId
  });
}

function summarizeText(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= 180) {
    return normalized;
  }
  return `${normalized.slice(0, 177)}...`;
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function clampText(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }
  const head = value.slice(0, Math.floor(maxChars * 0.7));
  const tail = value.slice(-(maxChars - head.length - 20));
  return `${head}\n...[truncated]...\n${tail}`;
}
