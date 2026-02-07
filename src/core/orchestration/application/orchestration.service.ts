import { randomUUID } from "node:crypto";
import path from "node:path";
import type { AgentManifest, AgentManifestService } from "../../agents/index.js";
import { DEFAULT_AGENT_ID, normalizeAgentId } from "../../domain/agent-id.js";
import type { OpenGoatPaths } from "../../domain/opengoat-paths.js";
import { createNoopLogger, type Logger } from "../../logging/index.js";
import type { FileSystemPort } from "../../ports/file-system.port.js";
import type { PathPort } from "../../ports/path.port.js";
import type { AgentProviderBinding, ProviderExecutionResult, ProviderInvokeOptions, ProviderService } from "../../providers/index.js";
import { SessionService, type PreparedSessionRun, type SessionCompactionResult, type SessionRunInfo } from "../../sessions/index.js";
import type { SkillService } from "../../skills/index.js";
import type {
  OrchestrationAction,
  OrchestrationPlannerDecision,
  OrchestrationRunLedger,
  OrchestrationStepLog,
  OrchestrationTaskSessionPolicy
} from "../domain/loop.js";
import type { AgentRunTrace, OrchestrationRunResult, RoutingDecision } from "../domain/routing.js";
import { OrchestrationPlannerService } from "./orchestration-planner.service.js";
import { RoutingService } from "./routing.service.js";

interface OrchestrationServiceDeps {
  providerService: ProviderService;
  skillService: SkillService;
  agentManifestService: AgentManifestService;
  sessionService: SessionService;
  routingService?: RoutingService;
  plannerService?: OrchestrationPlannerService;
  fileSystem: FileSystemPort;
  pathPort: PathPort;
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

interface OrchestrationLoopResult {
  finalMessage: string;
  execution: ProviderExecutionResult & AgentProviderBinding;
  steps: OrchestrationStepLog[];
  sessionGraph: OrchestrationRunLedger["sessionGraph"];
  taskThreads: NonNullable<OrchestrationRunLedger["taskThreads"]>;
}

interface TaskThreadState {
  taskKey: string;
  agentId: string;
  providerId?: string;
  providerSessionId?: string;
  sessionKey?: string;
  sessionId?: string;
  createdStep: number;
  updatedStep: number;
  lastResponse?: string;
}

const MAX_ORCHESTRATION_STEPS = 12;
const MAX_DELEGATION_STEPS = 8;
const SHARED_NOTES_MAX_CHARS = 12_000;
const RECENT_EVENTS_WINDOW = 10;

export class OrchestrationService {
  private readonly providerService: ProviderService;
  private readonly skillService: SkillService;
  private readonly agentManifestService: AgentManifestService;
  private readonly sessionService: SessionService;
  private readonly routingService: RoutingService;
  private readonly plannerService: OrchestrationPlannerService;
  private readonly fileSystem: FileSystemPort;
  private readonly pathPort: PathPort;
  private readonly nowIso: () => string;
  private readonly logger: Logger;

  public constructor(deps: OrchestrationServiceDeps) {
    this.providerService = deps.providerService;
    this.skillService = deps.skillService;
    this.agentManifestService = deps.agentManifestService;
    this.sessionService = deps.sessionService;
    this.routingService = deps.routingService ?? new RoutingService();
    this.plannerService = deps.plannerService ?? new OrchestrationPlannerService();
    this.fileSystem = deps.fileSystem;
    this.pathPort = deps.pathPort;
    this.nowIso = deps.nowIso;
    this.logger = (deps.logger ?? createNoopLogger()).child({ scope: "orchestration-service" });
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
    const runLogger = this.logger.child({ runId });
    const startedAt = this.nowIso();
    const manifests = await this.agentManifestService.listManifests(paths);
    const resolvedEntryAgentId = resolveEntryAgentId(entryAgentId, manifests);
    runLogger.info("Starting agent run.", {
      entryAgentId,
      resolvedEntryAgentId
    });

    if (resolvedEntryAgentId !== DEFAULT_AGENT_ID) {
      runLogger.info("Running direct non-orchestrator invocation.", {
        targetAgentId: resolvedEntryAgentId
      });
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
                providerId: direct.execution.providerId,
                sessionKey: direct.session?.sessionKey,
                sessionId: direct.session?.sessionId,
                providerSessionId: direct.execution.providerSessionId
              }
            ],
            edges: []
          },
          taskThreads: []
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
    const loopResult = await this.runAiOrchestrationLoop(paths, runId, manifests, options, runLogger);
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
        sessionGraph: loopResult.sessionGraph,
        taskThreads: loopResult.taskThreads
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
    options: ProviderInvokeOptions,
    runLogger: Logger
  ): Promise<OrchestrationLoopResult> {
    const steps: OrchestrationStepLog[] = [];
    const sessionGraph: OrchestrationRunLedger["sessionGraph"] = {
      nodes: [],
      edges: []
    };
    const taskThreads = new Map<string, TaskThreadState>();
    const sharedNotes: string[] = [];
    const recentEvents: string[] = [];
    let delegationCount = 0;
    let finalMessage = "";
    let lastExecution: ProviderExecutionResult & AgentProviderBinding = await this.buildSyntheticExecution(paths, DEFAULT_AGENT_ID);
    runLogger.info("Starting orchestration loop.", {
      maxSteps: MAX_ORCHESTRATION_STEPS,
      maxDelegations: MAX_DELEGATION_STEPS
    });

    for (let step = 1; step <= MAX_ORCHESTRATION_STEPS; step += 1) {
      const stepLogger = runLogger.child({ step });
      const plannerPrompt = this.plannerService.buildPlannerPrompt({
        userMessage: options.message,
        step,
        maxSteps: MAX_ORCHESTRATION_STEPS,
        sharedNotes: clampText(sharedNotes.join("\n\n"), SHARED_NOTES_MAX_CHARS),
        recentEvents,
        agents: manifests,
        taskThreads: summarizeTaskThreads(taskThreads)
      });
      stepLogger.debug("Planner prompt payload.", {
        prompt: plannerPrompt
      });

      const plannerCall = await this.invokeAgentWithSession(paths, DEFAULT_AGENT_ID, {
        ...options,
        message: plannerPrompt,
        sessionRef: options.sessionRef,
        forceNewSession: step === 1 ? options.forceNewSession : false
      }, { silent: true });
      const plannerRawOutput = plannerCall.execution.stdout.trim() || plannerCall.execution.stderr.trim();
      stepLogger.debug("Planner raw output payload.", {
        output: plannerRawOutput
      });
      const plannerDecision = this.plannerService.parseDecision(
        plannerRawOutput,
        "I could not complete orchestration due to planner output parsing issues."
      );
      stepLogger.info("Planner decision parsed.", {
        actionType: plannerDecision.action.type,
        actionMode: plannerDecision.action.mode ?? "direct",
        rationale: plannerDecision.rationale
      });
      addSessionNode(sessionGraph, DEFAULT_AGENT_ID, plannerCall.session, plannerCall.execution);

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
        recentEvents,
        taskThreads,
        logger: stepLogger
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
        stepLogger.warn("Delegation safety limit reached.");
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
      sessionGraph,
      taskThreads: summarizeTaskThreads(taskThreads)
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
    taskThreads: Map<string, TaskThreadState>;
    logger: Logger;
  }): Promise<{
    finalMessage?: string;
    execution?: ProviderExecutionResult & AgentProviderBinding;
  }> {
    const action = params.action;

    if (action.type === "finish" || action.type === "respond_user") {
      const message = action.message.trim() || "Completed.";
      params.logger.info("Completing orchestration with direct response.", {
        actionType: action.type
      });
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
      params.logger.info("Reading workspace file for orchestration context.", {
        path: resolvedPath
      });
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
      params.logger.info("Writing workspace file for orchestration context.", {
        path: resolvedPath
      });
      await this.fileSystem.ensureDir(path.dirname(resolvedPath));
      await this.fileSystem.writeFile(resolvedPath, ensureTrailingNewline(action.content));
      params.stepLog.artifactIO = { writePath: resolvedPath };
      this.addRecentEvent(params.recentEvents, `Wrote file ${action.path}`);
      return {};
    }

    if (action.type === "install_skill") {
      const targetAgentId = normalizeAgentId(action.targetAgentId ?? DEFAULT_AGENT_ID) || DEFAULT_AGENT_ID;
      params.logger.info("Installing skill requested by orchestrator action.", {
        targetAgentId,
        skillName: action.skillName
      });
      const result = await this.skillService.installSkill(params.paths, {
        agentId: targetAgentId,
        skillName: action.skillName,
        sourcePath: action.sourcePath,
        description: action.description,
        content: action.content
      });

      params.stepLog.note = `Installed skill ${result.skillId} for ${result.agentId} (${result.source}).`;
      params.sharedNotes.push(
        `Skill installed: ${result.skillId} for ${result.agentId} from ${result.source} at ${result.installedPath}`
      );
      this.addRecentEvent(
        params.recentEvents,
        `Installed skill ${result.skillId} for ${result.agentId} (${result.source})`
      );
      return {};
    }

    const targetAgentId = normalizeAgentId(action.targetAgentId);
    const targetManifest = params.manifests.find((manifest) => manifest.agentId === targetAgentId);
    if (!targetManifest || !targetManifest.metadata.delegation.canReceive) {
      const note = `Invalid delegation target "${action.targetAgentId}".`;
      params.logger.warn("Invalid delegation target.", {
        requestedTargetAgentId: action.targetAgentId
      });
      params.sharedNotes.push(note);
      params.stepLog.note = note;
      this.addRecentEvent(params.recentEvents, note);
      return {};
    }

    const taskKey = resolveTaskKey(action.taskKey, targetAgentId, params.step);
    const requestedSessionPolicy = action.sessionPolicy ?? "auto";
    const existingThread = params.taskThreads.get(taskKey);
    const canReuseThread = Boolean(existingThread && existingThread.agentId === targetAgentId);
    const effectiveSessionPolicy: OrchestrationTaskSessionPolicy =
      requestedSessionPolicy === "reuse" ? (canReuseThread ? "reuse" : "new") : requestedSessionPolicy;
    const forceNewTaskSession = effectiveSessionPolicy === "new" || !canReuseThread;
    if (requestedSessionPolicy === "reuse" && !canReuseThread) {
      const note = `Requested reuse for task "${taskKey}" but no matching thread exists; creating a new session.`;
      params.sharedNotes.push(note);
      this.addRecentEvent(params.recentEvents, note);
      params.logger.warn("Requested task session reuse but no matching thread was found.", {
        taskKey,
        targetAgentId
      });
    }

    const targetRuntime = await this.providerService.getAgentRuntimeProfile(params.paths, targetAgentId);
    const mode = action.mode ?? "hybrid";
    params.logger.info("Delegating task to agent.", {
      fromAgentId: DEFAULT_AGENT_ID,
      toAgentId: targetAgentId,
      targetWorkspaceAccess: targetRuntime.workspaceAccess,
      mode,
      reason: action.reason,
      taskKey,
      sessionPolicy: effectiveSessionPolicy
    });
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
      exposeArtifactPath: targetRuntime.workspaceAccess === "internal",
      sharedNotes: params.sharedNotes
    });
    params.logger.debug("Delegation message payload.", {
      fromAgentId: DEFAULT_AGENT_ID,
      toAgentId: targetAgentId,
      taskKey,
      request: delegateMessage,
      mode,
      outboundPath
    });

    const providerSessionId =
      effectiveSessionPolicy !== "new" && existingThread?.agentId === targetAgentId
        ? existingThread.providerSessionId
        : undefined;
    const delegateCall = await this.invokeAgentWithSession(params.paths, targetAgentId, {
      message: delegateMessage,
      env: params.options.env,
      cwd: params.options.cwd,
      sessionRef: `agent:${targetAgentId}:task:${taskKey}`,
      forceNewSession: forceNewTaskSession,
      providerSessionId,
      forceNewProviderSession: forceNewTaskSession
    }, { silent: true });
    const responseText =
      delegateCall.execution.stdout.trim() ||
      (delegateCall.execution.stderr.trim() ? `[stderr] ${delegateCall.execution.stderr.trim()}` : "");
    params.logger.debug("Delegation response payload.", {
      fromAgentId: DEFAULT_AGENT_ID,
      toAgentId: targetAgentId,
      code: delegateCall.execution.code,
      providerId: delegateCall.execution.providerId,
      response: responseText
    });

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
      taskKey,
      sessionPolicy: effectiveSessionPolicy,
      request: delegateMessage,
      response: responseText,
      code: delegateCall.execution.code,
      providerId: delegateCall.execution.providerId,
      sessionKey: delegateCall.session?.sessionKey,
      sessionId: delegateCall.session?.sessionId,
      providerSessionId: delegateCall.execution.providerSessionId
    };

    addSessionNode(params.sessionGraph, targetAgentId, delegateCall.session, delegateCall.execution);
    upsertTaskThread(params.taskThreads, {
      taskKey,
      agentId: targetAgentId,
      createdStep: params.step,
      updatedStep: params.step,
      providerId: delegateCall.execution.providerId,
      providerSessionId: delegateCall.execution.providerSessionId,
      sessionKey: delegateCall.session?.sessionKey,
      sessionId: delegateCall.session?.sessionId,
      lastResponse: summarizeText(responseText || "(no response)")
    });
    params.sessionGraph.edges.push({
      fromAgentId: DEFAULT_AGENT_ID,
      toAgentId: targetAgentId,
      reason: action.reason || params.stepLog.plannerDecision.rationale
    });

    const note = `Delegated to ${targetAgentId} [task:${taskKey}]: ${summarizeText(responseText || "(no response)")}`;
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
    this.logger.debug("Preparing agent invocation with session context.", {
      agentId,
      message: options.message,
      sessionRef: options.sessionRef,
      forceNewSession: options.forceNewSession,
      disableSession: options.disableSession,
      providerSessionId: options.providerSessionId,
      forceNewProviderSession: options.forceNewProviderSession
    });
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
    this.logger.debug("Agent invocation execution returned.", {
      agentId,
      providerId: execution.providerId,
      code: execution.code,
      stdout: execution.stdout,
      stderr: execution.stderr,
      providerSessionId: execution.providerSessionId
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
  exposeArtifactPath: boolean;
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
  if ((params.mode === "artifacts" || params.mode === "hybrid") && params.outboundPath && params.exposeArtifactPath) {
    lines.push(`Coordination file: ${params.outboundPath}`, "You may use this markdown artifact for durable handoff context.", "");
  } else if (params.mode === "artifacts" || params.mode === "hybrid") {
    lines.push("Coordination artifacts are managed internally by the orchestrator.", "");
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
    | undefined,
  execution?: ProviderExecutionResult & AgentProviderBinding
): void {
  if (!session) {
    return;
  }

  const exists = graph.nodes.some(
    (node) =>
      node.agentId === agentId &&
      node.providerId === execution?.providerId &&
      node.sessionKey === session.sessionKey &&
      node.sessionId === session.sessionId &&
      node.providerSessionId === execution?.providerSessionId
  );
  if (exists) {
    return;
  }

  graph.nodes.push({
    agentId,
    providerId: execution?.providerId,
    sessionKey: session.sessionKey,
    sessionId: session.sessionId,
    providerSessionId: execution?.providerSessionId
  });
}

function resolveTaskKey(actionTaskKey: string | undefined, targetAgentId: string, step: number): string {
  const explicit = actionTaskKey?.trim().toLowerCase();
  if (explicit) {
    return explicit;
  }
  return `${targetAgentId}-step-${String(step).padStart(2, "0")}`;
}

function upsertTaskThread(threads: Map<string, TaskThreadState>, next: TaskThreadState): void {
  const existing = threads.get(next.taskKey);
  if (!existing) {
    threads.set(next.taskKey, next);
    return;
  }

  threads.set(next.taskKey, {
    ...existing,
    ...next,
    createdStep: existing.createdStep,
    updatedStep: next.updatedStep
  });
}

function summarizeTaskThreads(
  threads: Map<string, TaskThreadState>
): NonNullable<OrchestrationRunLedger["taskThreads"]> {
  return [...threads.values()]
    .sort((left, right) => left.createdStep - right.createdStep)
    .map((thread) => ({
      taskKey: thread.taskKey,
      agentId: thread.agentId,
      providerId: thread.providerId,
      providerSessionId: thread.providerSessionId,
      sessionKey: thread.sessionKey,
      sessionId: thread.sessionId,
      createdStep: thread.createdStep,
      updatedStep: thread.updatedStep,
      lastResponse: thread.lastResponse
    }));
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
