import { randomUUID } from "node:crypto";
import type { AgentManifestService } from "../../agents/index.js";
import type { OpenGoatPaths } from "../../domain/opengoat-paths.js";
import type { FileSystemPort } from "../../ports/file-system.port.js";
import type { PathPort } from "../../ports/path.port.js";
import type { ProviderInvokeOptions, ProviderService } from "../../providers/index.js";
import type { AgentRunTrace, OrchestrationRunResult, RoutingDecision } from "../domain/routing.js";
import { RoutingService } from "./routing.service.js";

interface OrchestrationServiceDeps {
  providerService: ProviderService;
  agentManifestService: AgentManifestService;
  routingService?: RoutingService;
  fileSystem: FileSystemPort;
  pathPort: PathPort;
  nowIso: () => string;
}

export class OrchestrationService {
  private readonly providerService: ProviderService;
  private readonly agentManifestService: AgentManifestService;
  private readonly routingService: RoutingService;
  private readonly fileSystem: FileSystemPort;
  private readonly pathPort: PathPort;
  private readonly nowIso: () => string;

  public constructor(deps: OrchestrationServiceDeps) {
    this.providerService = deps.providerService;
    this.agentManifestService = deps.agentManifestService;
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
    const runtimeOptions: ProviderInvokeOptions = {
      ...options,
      message: routing.rewrittenMessage
    };

    const startTime = Date.now();
    const execution = await this.providerService.invokeAgent(paths, targetAgentId, runtimeOptions);
    const durationMs = Date.now() - startTime;
    const completedAt = this.nowIso();
    const runId = generateRunId();

    const trace: AgentRunTrace = {
      schemaVersion: 1,
      runId,
      startedAt,
      completedAt,
      entryAgentId: routing.entryAgentId,
      userMessage: options.message,
      routing,
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
      tracePath
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
  const normalizedEntryAgentId = normalizeAgentId(entryAgentId) || "orchestrator";
  if (manifests.some((manifest) => manifest.agentId === normalizedEntryAgentId)) {
    return normalizedEntryAgentId;
  }

  if (manifests.some((manifest) => manifest.agentId === "orchestrator")) {
    return "orchestrator";
  }

  return manifests[0]?.agentId || normalizedEntryAgentId;
}

function normalizeAgentId(agentId: string): string {
  return agentId.trim().toLowerCase();
}
