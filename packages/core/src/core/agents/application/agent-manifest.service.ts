import { normalizeAgentId } from "../../domain/agent-id.js";
import type { OpenGoatPaths } from "../../domain/opengoat-paths.js";
import type { FileSystemPort } from "../../ports/file-system.port.js";
import type { PathPort } from "../../ports/path.port.js";
import {
  normalizeAgentManifestMetadata,
  type AgentManifest
} from "../domain/agent-manifest.js";

interface AgentManifestServiceDeps {
  fileSystem: FileSystemPort;
  pathPort: PathPort;
}

interface AgentConfigShape {
  displayName?: string;
  description?: string;
  organization?: {
    type?: "manager" | "individual";
    reportsTo?: string | null;
    discoverable?: boolean;
    tags?: string[];
    priority?: number;
    delegation?: {
      canReceive?: boolean;
      canDelegate?: boolean;
    };
  };
  runtime?: {
    skills?: {
      assigned?: string[];
    };
  };
}

export class AgentManifestService {
  private readonly fileSystem: FileSystemPort;
  private readonly pathPort: PathPort;

  public constructor(deps: AgentManifestServiceDeps) {
    this.fileSystem = deps.fileSystem;
    this.pathPort = deps.pathPort;
  }

  public async listManifests(paths: OpenGoatPaths): Promise<AgentManifest[]> {
    const agentIds = await this.fileSystem.listDirectories(paths.agentsDir);
    const manifests = await Promise.all(agentIds.map((agentId) => this.getManifest(paths, agentId)));
    return manifests.sort((left, right) => left.agentId.localeCompare(right.agentId));
  }

  public async getManifest(paths: OpenGoatPaths, rawAgentId: string): Promise<AgentManifest> {
    const agentId = normalizeAgentId(rawAgentId) || rawAgentId.trim().toLowerCase();
    const workspaceDir = this.pathPort.join(paths.workspacesDir, agentId);
    const configPath = this.pathPort.join(paths.agentsDir, agentId, "config.json");
    const config = await this.readJsonIfPresent<AgentConfigShape>(configPath);

    const displayName = config?.displayName?.trim() || agentId;
    const assignedSkills = Array.isArray(config?.runtime?.skills?.assigned)
      ? config.runtime?.skills?.assigned ?? []
      : [];

    const metadata = normalizeAgentManifestMetadata({
      agentId,
      displayName,
      metadata: {
        id: agentId,
        name: displayName,
        description: config?.description,
        type: config?.organization?.type,
        reportsTo: normalizeReportsTo(config?.organization?.reportsTo),
        discoverable: config?.organization?.discoverable,
        tags: config?.organization?.tags,
        skills: assignedSkills,
        delegation: {
          canReceive: config?.organization?.delegation?.canReceive ?? false,
          canDelegate: config?.organization?.delegation?.canDelegate ?? false
        },
        priority: config?.organization?.priority
      }
    });

    return {
      agentId,
      filePath: configPath,
      workspaceDir,
      metadata,
      body: "",
      source: config ? "config" : "derived"
    };
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

function normalizeReportsTo(value: string | null | undefined): string | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = normalizeAgentId(value);
  return normalized || null;
}
