import type {
  AgentCreationResult,
  AgentDescriptor,
  AgentIdentity
} from "../../domain/agent.js";
import { isDefaultAgentId, normalizeAgentId } from "../../domain/agent-id.js";
import type { AgentsIndex, OpenGoatPaths } from "../../domain/opengoat-paths.js";
import type { FileSystemPort } from "../../ports/file-system.port.js";
import type { PathPort } from "../../ports/path.port.js";
import {
  renderAgentsIndex,
  renderInternalAgentConfig,
  renderInternalAgentMemoryMarkdown,
  renderInternalAgentState,
  renderWorkspaceAgentsMarkdown,
  renderWorkspaceBootstrapMarkdown,
  renderWorkspaceContextMarkdown,
  renderWorkspaceHeartbeatMarkdown,
  renderWorkspaceIdentityMarkdown,
  renderDefaultOrchestratorSkillMarkdown,
  renderWorkspaceSoulMarkdown,
  renderWorkspaceToolsMarkdown,
  renderWorkspaceUserMarkdown,
  renderWorkspaceMetadata
} from "../../templates/default-templates.js";

interface AgentServiceDeps {
  fileSystem: FileSystemPort;
  pathPort: PathPort;
  nowIso: () => string;
}

export class AgentService {
  private readonly fileSystem: FileSystemPort;
  private readonly pathPort: PathPort;
  private readonly nowIso: () => string;

  public constructor(deps: AgentServiceDeps) {
    this.fileSystem = deps.fileSystem;
    this.pathPort = deps.pathPort;
    this.nowIso = deps.nowIso;
  }

  public normalizeAgentName(rawName: string): AgentIdentity {
    const displayName = rawName.trim();
    if (!displayName) {
      throw new Error("Agent name cannot be empty.");
    }

    const id = normalizeAgentId(displayName);

    if (!id) {
      throw new Error("Agent name must contain at least one alphanumeric character.");
    }

    return { id, displayName };
  }

  public async ensureAgent(
    paths: OpenGoatPaths,
    identity: AgentIdentity
  ): Promise<AgentCreationResult> {
    const workspaceDir = this.pathPort.join(paths.workspacesDir, identity.id);
    const workspaceSkillsDir = this.pathPort.join(workspaceDir, "skills");
    const internalConfigDir = this.pathPort.join(paths.agentsDir, identity.id);
    const sessionsDir = this.pathPort.join(internalConfigDir, "sessions");

    const createdPaths: string[] = [];
    const skippedPaths: string[] = [];

    await this.ensureDirectory(workspaceDir, createdPaths, skippedPaths);
    await this.ensureDirectory(workspaceSkillsDir, createdPaths, skippedPaths);
    await this.ensureDirectory(internalConfigDir, createdPaths, skippedPaths);
    await this.ensureDirectory(sessionsDir, createdPaths, skippedPaths);

    const shouldCreateBootstrapFile = await this.isBrandNewWorkspace(workspaceDir);

    await this.writeJsonIfMissing(
      this.pathPort.join(workspaceDir, "workspace.json"),
      renderWorkspaceMetadata(identity),
      createdPaths,
      skippedPaths
    );
    await this.writeMarkdownIfMissing(
      this.pathPort.join(workspaceDir, "AGENTS.md"),
      renderWorkspaceAgentsMarkdown(identity),
      createdPaths,
      skippedPaths
    );
    await this.writeMarkdownIfMissing(
      this.pathPort.join(workspaceDir, "CONTEXT.md"),
      renderWorkspaceContextMarkdown(identity),
      createdPaths,
      skippedPaths
    );
    await this.writeMarkdownIfMissing(
      this.pathPort.join(workspaceDir, "SOUL.md"),
      renderWorkspaceSoulMarkdown(identity),
      createdPaths,
      skippedPaths
    );
    await this.writeMarkdownIfMissing(
      this.pathPort.join(workspaceDir, "TOOLS.md"),
      renderWorkspaceToolsMarkdown(),
      createdPaths,
      skippedPaths
    );
    await this.writeMarkdownIfMissing(
      this.pathPort.join(workspaceDir, "IDENTITY.md"),
      renderWorkspaceIdentityMarkdown(identity),
      createdPaths,
      skippedPaths
    );
    await this.writeMarkdownIfMissing(
      this.pathPort.join(workspaceDir, "USER.md"),
      renderWorkspaceUserMarkdown(),
      createdPaths,
      skippedPaths
    );
    await this.writeMarkdownIfMissing(
      this.pathPort.join(workspaceDir, "HEARTBEAT.md"),
      renderWorkspaceHeartbeatMarkdown(),
      createdPaths,
      skippedPaths
    );
    if (shouldCreateBootstrapFile) {
      await this.writeMarkdownIfMissing(
        this.pathPort.join(workspaceDir, "BOOTSTRAP.md"),
        renderWorkspaceBootstrapMarkdown(identity),
        createdPaths,
        skippedPaths
      );
    }
    if (isDefaultAgentId(identity.id)) {
      const orchestratorSkillDir = this.pathPort.join(workspaceSkillsDir, "opengoat-skill");
      await this.ensureDirectory(orchestratorSkillDir, createdPaths, skippedPaths);
      await this.writeMarkdownIfMissing(
        this.pathPort.join(orchestratorSkillDir, "SKILL.md"),
        renderDefaultOrchestratorSkillMarkdown(),
        createdPaths,
        skippedPaths
      );
    }

    await this.writeJsonIfMissing(
      this.pathPort.join(internalConfigDir, "config.json"),
      renderInternalAgentConfig(identity),
      createdPaths,
      skippedPaths
    );
    await this.writeJsonIfMissing(
      this.pathPort.join(internalConfigDir, "state.json"),
      renderInternalAgentState(),
      createdPaths,
      skippedPaths
    );
    await this.writeMarkdownIfMissing(
      this.pathPort.join(internalConfigDir, "memory.md"),
      renderInternalAgentMemoryMarkdown(identity),
      createdPaths,
      skippedPaths
    );
    await this.writeJsonIfMissing(
      this.pathPort.join(sessionsDir, "sessions.json"),
      {
        schemaVersion: 1,
        sessions: {}
      },
      createdPaths,
      skippedPaths
    );

    const existingIndex = await this.readJsonIfPresent<AgentsIndex>(paths.agentsIndexJsonPath);
    const agents = dedupe([...(existingIndex?.agents ?? []), identity.id]);
    const nextIndex = renderAgentsIndex(this.nowIso(), agents);
    await this.fileSystem.writeFile(paths.agentsIndexJsonPath, toJson(nextIndex));

    return {
      agent: {
        ...identity,
        workspaceDir,
        internalConfigDir
      },
      createdPaths,
      skippedPaths
    };
  }

  public async listAgents(paths: OpenGoatPaths): Promise<AgentDescriptor[]> {
    const ids = await this.fileSystem.listDirectories(paths.workspacesDir);
    const descriptors: AgentDescriptor[] = [];

    for (const id of ids) {
      const workspaceDir = this.pathPort.join(paths.workspacesDir, id);
      const internalConfigDir = this.pathPort.join(paths.agentsDir, id);
      const metadataPath = this.pathPort.join(workspaceDir, "workspace.json");

      const metadata = await this.readJsonIfPresent<{ displayName?: string }>(metadataPath);
      descriptors.push({
        id,
        displayName: metadata?.displayName ?? id,
        workspaceDir,
        internalConfigDir
      });
    }

    return descriptors.sort((left, right) => left.id.localeCompare(right.id));
  }

  private async isBrandNewWorkspace(workspaceDir: string): Promise<boolean> {
    const firstRunFiles = [
      "AGENTS.md",
      "CONTEXT.md",
      "SOUL.md",
      "TOOLS.md",
      "IDENTITY.md",
      "USER.md",
      "HEARTBEAT.md"
    ];

    const existence = await Promise.all(
      firstRunFiles.map((fileName) => this.fileSystem.exists(this.pathPort.join(workspaceDir, fileName)))
    );

    return existence.every((value) => !value);
  }

  private async ensureDirectory(
    directoryPath: string,
    createdPaths: string[],
    skippedPaths: string[]
  ): Promise<void> {
    const existed = await this.fileSystem.exists(directoryPath);
    await this.fileSystem.ensureDir(directoryPath);
    if (existed) {
      skippedPaths.push(directoryPath);
      return;
    }
    createdPaths.push(directoryPath);
  }

  private async writeJsonIfMissing(
    filePath: string,
    payload: unknown,
    createdPaths: string[],
    skippedPaths: string[]
  ): Promise<void> {
    const exists = await this.fileSystem.exists(filePath);
    if (exists) {
      skippedPaths.push(filePath);
      return;
    }

    await this.fileSystem.writeFile(filePath, toJson(payload));
    createdPaths.push(filePath);
  }

  private async writeMarkdownIfMissing(
    filePath: string,
    content: string,
    createdPaths: string[],
    skippedPaths: string[]
  ): Promise<void> {
    const exists = await this.fileSystem.exists(filePath);
    if (exists) {
      skippedPaths.push(filePath);
      return;
    }

    const markdown = content.endsWith("\n") ? content : `${content}\n`;
    await this.fileSystem.writeFile(filePath, markdown);
    createdPaths.push(filePath);
  }

  private async readJsonIfPresent<T>(filePath: string): Promise<T | null> {
    const exists = await this.fileSystem.exists(filePath);
    if (!exists) {
      return null;
    }

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

function toJson(payload: unknown): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}
