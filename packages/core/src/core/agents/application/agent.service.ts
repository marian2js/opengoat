import type {
  AgentManagerUpdateResult,
  AgentDeletionResult,
  AgentCreationResult,
  AgentDescriptor,
  AgentIdentity
} from "../../domain/agent.js";
import { DEFAULT_AGENT_ID, isDefaultAgentId, normalizeAgentId } from "../../domain/agent-id.js";
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
  type AgentTemplateOptions,
  renderWorkspaceSoulMarkdown,
  renderWorkspaceToolsMarkdown,
  renderWorkspaceUserMarkdown,
  renderWorkspaceMetadata
} from "../../templates/default-templates.js";
import {
  formatAgentManifestMarkdown,
  normalizeAgentManifestMetadata,
  parseAgentManifestMarkdown
} from "../domain/agent-manifest.js";

interface AgentServiceDeps {
  fileSystem: FileSystemPort;
  pathPort: PathPort;
  nowIso: () => string;
}

interface EnsureAgentOptions {
  type?: "manager" | "individual";
  reportsTo?: string | null;
  skills?: string[];
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
    identity: AgentIdentity,
    options: EnsureAgentOptions = {}
  ): Promise<AgentCreationResult> {
    const workspaceDir = this.pathPort.join(paths.workspacesDir, identity.id);
    const internalConfigDir = this.pathPort.join(paths.agentsDir, identity.id);
    const sessionsDir = this.pathPort.join(internalConfigDir, "sessions");
    const templateOptions = toAgentTemplateOptions(identity.id, options);

    const createdPaths: string[] = [];
    const skippedPaths: string[] = [];
    const workspaceExisted = await this.fileSystem.exists(workspaceDir);

    await this.ensureDirectory(workspaceDir, createdPaths, skippedPaths);
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
      renderWorkspaceAgentsMarkdown(identity, templateOptions),
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
    const internalConfig = renderInternalAgentConfig(identity) as {
      organization?: { type?: string; reportsTo?: string | null };
      runtime?: { skills?: { assigned?: string[] } };
    };
    if (internalConfig.organization) {
      const resolvedType = templateOptions.type ?? internalConfig.organization.type;
      if (resolvedType) {
        internalConfig.organization.type = resolvedType;
      }
      internalConfig.organization.reportsTo = templateOptions.reportsTo;
    }
    if (internalConfig.runtime?.skills) {
      internalConfig.runtime.skills.assigned = templateOptions.skills;
    }
    await this.writeJsonIfMissing(
      this.pathPort.join(internalConfigDir, "config.json"),
      internalConfig,
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
      alreadyExisted: workspaceExisted,
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

  public async removeAgent(paths: OpenGoatPaths, rawAgentId: string): Promise<AgentDeletionResult> {
    const agentId = normalizeAgentId(rawAgentId);
    if (!agentId) {
      throw new Error("Agent id cannot be empty.");
    }
    if (isDefaultAgentId(agentId)) {
      throw new Error("Cannot delete goat. It is the immutable default entry agent.");
    }

    const workspaceDir = this.pathPort.join(paths.workspacesDir, agentId);
    const internalConfigDir = this.pathPort.join(paths.agentsDir, agentId);
    const removedPaths: string[] = [];
    const skippedPaths: string[] = [];

    const workspaceExists = await this.fileSystem.exists(workspaceDir);
    if (workspaceExists) {
      await this.fileSystem.removeDir(workspaceDir);
      removedPaths.push(workspaceDir);
    } else {
      skippedPaths.push(workspaceDir);
    }

    const internalConfigExists = await this.fileSystem.exists(internalConfigDir);
    if (internalConfigExists) {
      await this.fileSystem.removeDir(internalConfigDir);
      removedPaths.push(internalConfigDir);
    } else {
      skippedPaths.push(internalConfigDir);
    }

    const index = await this.readJsonIfPresent<AgentsIndex>(paths.agentsIndexJsonPath);
    if (index) {
      const filtered = dedupe(index.agents.filter((id) => id !== agentId));
      const nextIndex = renderAgentsIndex(this.nowIso(), filtered);
      await this.fileSystem.writeFile(paths.agentsIndexJsonPath, toJson(nextIndex));
    }

    return {
      agentId,
      existed: workspaceExists || internalConfigExists,
      removedPaths,
      skippedPaths
    };
  }

  public async setAgentManager(
    paths: OpenGoatPaths,
    rawAgentId: string,
    rawReportsTo: string | null | undefined
  ): Promise<AgentManagerUpdateResult> {
    const agentId = normalizeAgentId(rawAgentId);
    if (!agentId) {
      throw new Error("Agent id cannot be empty.");
    }

    const explicitReportsTo = rawReportsTo === null || rawReportsTo === undefined ? null : normalizeAgentId(rawReportsTo);
    if (explicitReportsTo === agentId) {
      throw new Error(`Agent "${agentId}" cannot report to itself.`);
    }
    if (isDefaultAgentId(agentId) && explicitReportsTo) {
      throw new Error("goat is the head of the organization and cannot report to another agent.");
    }
    const reportsTo = resolveReportsTo(agentId, rawReportsTo);

    const knownAgents = await this.fileSystem.listDirectories(paths.workspacesDir);
    if (!knownAgents.includes(agentId)) {
      throw new Error(`Agent "${agentId}" does not exist.`);
    }
    if (reportsTo && !knownAgents.includes(reportsTo)) {
      throw new Error(`Manager "${reportsTo}" does not exist.`);
    }

    await this.assertNoReportingCycle(paths, agentId, reportsTo, knownAgents);

    const workspaceDir = this.pathPort.join(paths.workspacesDir, agentId);
    const agentsPath = this.pathPort.join(workspaceDir, "AGENTS.md");
    const displayName = await this.readDisplayName(workspaceDir, agentId);

    const manifestRaw = await this.readFileIfPresent(agentsPath);
    const parsedManifest = parseAgentManifestMarkdown(manifestRaw ?? "");
    const currentMetadata = normalizeAgentManifestMetadata({
      agentId,
      displayName,
      metadata: parsedManifest.data
    });
    const normalizedMetadata = normalizeAgentManifestMetadata({
      agentId,
      displayName,
      metadata: {
        ...parsedManifest.data,
        reportsTo
      }
    });
    const nextManifestMarkdown = formatAgentManifestMarkdown(normalizedMetadata, parsedManifest.body);
    await this.fileSystem.writeFile(agentsPath, nextManifestMarkdown);

    const configPath = this.pathPort.join(paths.agentsDir, agentId, "config.json");
    const existingConfig = (await this.readJsonIfPresent<Record<string, unknown>>(configPath)) ?? {};
    const existingOrganization = toObject(existingConfig.organization);
    const nextOrganization: Record<string, unknown> = {
      ...existingOrganization,
      reportsTo: normalizedMetadata.reportsTo
    };
    if (normalizedMetadata.type) {
      nextOrganization.type = normalizedMetadata.type;
    }
    const nextConfig = {
      ...existingConfig,
      organization: nextOrganization
    };
    await this.fileSystem.writeFile(configPath, toJson(nextConfig));

    return {
      agentId,
      previousReportsTo: currentMetadata.reportsTo,
      reportsTo: normalizedMetadata.reportsTo,
      updatedPaths: [agentsPath, configPath]
    };
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

  private async readFileIfPresent(filePath: string): Promise<string | null> {
    const exists = await this.fileSystem.exists(filePath);
    if (!exists) {
      return null;
    }
    return this.fileSystem.readFile(filePath);
  }

  private async readDisplayName(workspaceDir: string, fallbackAgentId: string): Promise<string> {
    const metadataPath = this.pathPort.join(workspaceDir, "workspace.json");
    const metadata = await this.readJsonIfPresent<{ displayName?: string }>(metadataPath);
    return metadata?.displayName?.trim() || fallbackAgentId;
  }

  private async assertNoReportingCycle(
    paths: OpenGoatPaths,
    agentId: string,
    reportsTo: string | null,
    knownAgentIds: string[]
  ): Promise<void> {
    if (!reportsTo) {
      return;
    }

    const reportsToByAgent = new Map<string, string | null>();
    await Promise.all(
      knownAgentIds.map(async (candidateAgentId) => {
        const workspaceDir = this.pathPort.join(paths.workspacesDir, candidateAgentId);
        const agentsPath = this.pathPort.join(workspaceDir, "AGENTS.md");
        const displayName = await this.readDisplayName(workspaceDir, candidateAgentId);
        const markdown = await this.readFileIfPresent(agentsPath);
        const parsed = parseAgentManifestMarkdown(markdown ?? "");
        const normalized = normalizeAgentManifestMetadata({
          agentId: candidateAgentId,
          displayName,
          metadata: parsed.data
        });
        reportsToByAgent.set(candidateAgentId, normalized.reportsTo);
      })
    );

    reportsToByAgent.set(agentId, reportsTo);
    const visited = new Set<string>([agentId]);
    let cursor: string | null = reportsTo;

    while (cursor) {
      if (visited.has(cursor)) {
        throw new Error(`Cannot set "${agentId}" to report to "${reportsTo}" because it would create a cycle.`);
      }
      visited.add(cursor);
      cursor = reportsToByAgent.get(cursor) ?? null;
    }
  }
}

function toAgentTemplateOptions(agentId: string, options: EnsureAgentOptions): AgentTemplateOptions {
  const type = options.type ?? (isDefaultAgentId(agentId) ? "manager" : "individual");
  const reportsTo = resolveReportsTo(agentId, options.reportsTo);
  const skills = dedupe(options.skills ?? (type === "manager" ? ["manager"] : []));
  return {
    type,
    reportsTo,
    skills
  };
}

function resolveReportsTo(agentId: string, reportsTo: string | null | undefined): string | null {
  if (isDefaultAgentId(agentId)) {
    return null;
  }

  if (reportsTo === null || reportsTo === undefined) {
    return DEFAULT_AGENT_ID;
  }

  const normalized = normalizeAgentId(reportsTo);
  if (!normalized || normalized === agentId) {
    return DEFAULT_AGENT_ID;
  }

  return normalized;
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function toJson(payload: unknown): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function toObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}
