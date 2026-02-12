import { AgentService } from "../../agents/application/agent.service.js";
import { DEFAULT_AGENT_ID } from "../../domain/agent-id.js";
import type { AgentIdentity } from "../../domain/agent.js";
import type {
  InitializationResult,
  OpenGoatConfig,
} from "../../domain/opengoat-paths.js";
import type { FileSystemPort } from "../../ports/file-system.port.js";
import type { OpenGoatPathsProvider } from "../../ports/paths-provider.port.js";
import {
  renderAgentsIndex,
  renderGlobalConfig,
} from "../../templates/default-templates.js";

interface BootstrapServiceDeps {
  fileSystem: FileSystemPort;
  pathsProvider: OpenGoatPathsProvider;
  agentService: AgentService;
  nowIso: () => string;
}

export class BootstrapService {
  private readonly fileSystem: FileSystemPort;
  private readonly pathsProvider: OpenGoatPathsProvider;
  private readonly agentService: AgentService;
  private readonly nowIso: () => string;

  public constructor(deps: BootstrapServiceDeps) {
    this.fileSystem = deps.fileSystem;
    this.pathsProvider = deps.pathsProvider;
    this.agentService = deps.agentService;
    this.nowIso = deps.nowIso;
  }

  public async initialize(): Promise<InitializationResult> {
    const paths = this.pathsProvider.getPaths();
    const createdPaths: string[] = [];
    const skippedPaths: string[] = [];

    await this.ensureDirectory(paths.homeDir, createdPaths, skippedPaths);
    await this.ensureDirectory(paths.workspacesDir, createdPaths, skippedPaths);
    await this.ensureDirectory(paths.agentsDir, createdPaths, skippedPaths);
    await this.ensureDirectory(paths.providersDir, createdPaths, skippedPaths);
    await this.ensureDirectory(paths.runsDir, createdPaths, skippedPaths);

    const now = this.nowIso();
    await this.ensureGlobalConfig(
      paths.globalConfigJsonPath,
      now,
      createdPaths,
      skippedPaths,
    );
    await this.ensureAgentsIndex(
      paths.agentsIndexJsonPath,
      now,
      createdPaths,
      skippedPaths,
    );

    const ceo: AgentIdentity = {
      id: DEFAULT_AGENT_ID,
      displayName: "CEO",
    };

    const agentResult = await this.agentService.ensureAgent(paths, ceo, {
      type: "manager",
      reportsTo: null,
      role: "CEO",
    });
    const workspaceBootstrapResult =
      await this.agentService.ensureCeoWorkspaceBootstrap(paths);

    createdPaths.push(...agentResult.createdPaths);
    skippedPaths.push(...agentResult.skippedPaths);
    createdPaths.push(...workspaceBootstrapResult.createdPaths);
    skippedPaths.push(...workspaceBootstrapResult.skippedPaths);
    skippedPaths.push(...workspaceBootstrapResult.removedPaths);

    return {
      paths,
      createdPaths,
      skippedPaths,
      defaultAgent: DEFAULT_AGENT_ID,
    };
  }

  private async ensureGlobalConfig(
    globalConfigJsonPath: string,
    now: string,
    createdPaths: string[],
    skippedPaths: string[],
  ): Promise<void> {
    const exists = await this.fileSystem.exists(globalConfigJsonPath);
    if (!exists) {
      await this.fileSystem.writeFile(
        globalConfigJsonPath,
        `${JSON.stringify(renderGlobalConfig(now), null, 2)}\n`,
      );
      createdPaths.push(globalConfigJsonPath);
      return;
    }

    const current = await this.readJsonIfPresent<OpenGoatConfig>(
      globalConfigJsonPath,
    );
    if (current && current.defaultAgent === DEFAULT_AGENT_ID) {
      skippedPaths.push(globalConfigJsonPath);
      return;
    }

    const repaired: OpenGoatConfig = {
      schemaVersion: 1,
      defaultAgent: DEFAULT_AGENT_ID,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    };

    await this.fileSystem.writeFile(
      globalConfigJsonPath,
      `${JSON.stringify(repaired, null, 2)}\n`,
    );
    skippedPaths.push(globalConfigJsonPath);
  }

  private async ensureAgentsIndex(
    agentsIndexJsonPath: string,
    now: string,
    createdPaths: string[],
    skippedPaths: string[],
  ): Promise<void> {
    const exists = await this.fileSystem.exists(agentsIndexJsonPath);
    if (!exists) {
      await this.fileSystem.writeFile(
        agentsIndexJsonPath,
        `${JSON.stringify(
          renderAgentsIndex(now, [DEFAULT_AGENT_ID]),
          null,
          2,
        )}\n`,
      );
      createdPaths.push(agentsIndexJsonPath);
      return;
    }

    const current = await this.readJsonIfPresent<{ agents?: string[] }>(
      agentsIndexJsonPath,
    );
    const mergedAgents = dedupe([...(current?.agents ?? []), DEFAULT_AGENT_ID]);
    await this.fileSystem.writeFile(
      agentsIndexJsonPath,
      `${JSON.stringify(renderAgentsIndex(now, mergedAgents), null, 2)}\n`,
    );
    skippedPaths.push(agentsIndexJsonPath);
  }

  private async ensureDirectory(
    directoryPath: string,
    createdPaths: string[],
    skippedPaths: string[],
  ): Promise<void> {
    const existed = await this.fileSystem.exists(directoryPath);
    await this.fileSystem.ensureDir(directoryPath);
    if (existed) {
      skippedPaths.push(directoryPath);
      return;
    }
    createdPaths.push(directoryPath);
  }

  private async readJsonIfPresent<T>(filePath: string): Promise<T | null> {
    try {
      const raw = await this.fileSystem.readFile(filePath);
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
