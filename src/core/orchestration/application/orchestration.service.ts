import { randomUUID } from "node:crypto";
import type { AgentManifestService } from "../../agents/index.js";
import { DEFAULT_AGENT_ID, normalizeAgentId } from "../../domain/agent-id.js";
import type { OpenGoatPaths } from "../../domain/opengoat-paths.js";
import type { FileSystemPort } from "../../ports/file-system.port.js";
import type { PathPort } from "../../ports/path.port.js";
import type { ProviderInvokeOptions, ProviderService } from "../../providers/index.js";
import { SessionService } from "../../sessions/index.js";
import type { AgentRunTrace, OrchestrationRunResult, RoutingDecision } from "../domain/routing.js";
import { RoutingService } from "./routing.service.js";

interface OrchestrationServiceDeps {
  providerService: ProviderService;
  agentManifestService: AgentManifestService;
  sessionService: SessionService;
  routingService?: RoutingService;
  fileSystem: FileSystemPort;
  pathPort: PathPort;
  nowIso: () => string;
}

export class OrchestrationService {
  private readonly providerService: ProviderService;
  private readonly agentManifestService: AgentManifestService;
  private readonly sessionService: SessionService;
  private readonly routingService: RoutingService;
  private readonly fileSystem: FileSystemPort;
  private readonly pathPort: PathPort;
  private readonly nowIso: () => string;

  public constructor(deps: OrchestrationServiceDeps) {
    this.providerService = deps.providerService;
    this.agentManifestService = deps.agentManifestService;
    this.sessionService = deps.sessionService;
    this.routingService = deps.routingService ?? new RoutingService();
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
    const startedAt = this.nowIso();
    const routing = await this.routeMessage(paths, entryAgentId, options.message);
    const targetAgentId = routing.targetAgentId;
    const preparedSession = await this.sessionService.prepareRunSession(paths, targetAgentId, {
      sessionRef: options.sessionRef,
      forceNew: options.forceNewSession,
      disableSession: options.disableSession,
      userMessage: routing.rewrittenMessage
    });
    const runtimeOptions = sanitizeProviderInvokeOptions({
      ...options,
      message: routing.rewrittenMessage,
      sessionContext: preparedSession.enabled ? preparedSession.contextPrompt : undefined
    });

    const startTime = Date.now();
    const execution = await this.providerService.invokeAgent(paths, targetAgentId, runtimeOptions);
    const durationMs = Date.now() - startTime;
    const completedAt = this.nowIso();
    const runId = generateRunId();
    const assistantContent =
      execution.stdout.trim() ||
      (execution.stderr.trim()
        ? `[Provider error code ${execution.code}] ${execution.stderr.trim()}`
        : `[Provider exited with code ${execution.code}]`);
    const postRunCompaction = preparedSession.enabled
      ? await this.sessionService.recordAssistantReply(paths, preparedSession.info, assistantContent)
      : undefined;

    const trace: AgentRunTrace = {
      schemaVersion: 1,
      runId,
      startedAt,
      completedAt,
      entryAgentId: routing.entryAgentId,
      userMessage: options.message,
      routing,
      session: preparedSession.enabled
        ? {
            ...preparedSession.info,
            preRunCompactionApplied: preparedSession.compactionApplied,
            postRunCompactionApplied: postRunCompaction?.applied ?? false,
            postRunCompactionSummary: postRunCompaction?.summary
          }
        : undefined,
      execution: {
        agentId: execution.agentId,
        providerId: execution.providerId,
        code: execution.code,
        stdout: execution.stdout,
        stderr: execution.stderr,
        durationMs
      }
    };

    const tracePath = await this.writeTrace(paths, trace);

    return {
      ...execution,
      entryAgentId: routing.entryAgentId,
      routing,
      tracePath,
      session:
        preparedSession.enabled && postRunCompaction
          ? {
              ...preparedSession.info,
              preRunCompactionApplied: preparedSession.compactionApplied,
              postRunCompaction
            }
          : undefined
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
