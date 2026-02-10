import type { OpenGoatPaths } from "../../domain/opengoat-paths.js";
import type { FileSystemPort } from "../../ports/file-system.port.js";
import type { PathPort } from "../../ports/path.port.js";
import {
  normalizeAgentManifestMetadata,
  parseAgentManifestMarkdown,
  type AgentManifest
} from "../domain/agent-manifest.js";

interface AgentManifestServiceDeps {
  fileSystem: FileSystemPort;
  pathPort: PathPort;
}

interface WorkspaceMetadataShape {
  displayName?: string;
}

export class AgentManifestService {
  private readonly fileSystem: FileSystemPort;
  private readonly pathPort: PathPort;

  public constructor(deps: AgentManifestServiceDeps) {
    this.fileSystem = deps.fileSystem;
    this.pathPort = deps.pathPort;
  }

  public async listManifests(paths: OpenGoatPaths): Promise<AgentManifest[]> {
    const agentIds = await this.fileSystem.listDirectories(paths.workspacesDir);
    const manifests = await Promise.all(agentIds.map((agentId) => this.getManifest(paths, agentId)));
    return manifests.sort((left, right) => left.agentId.localeCompare(right.agentId));
  }

  public async getManifest(paths: OpenGoatPaths, agentId: string): Promise<AgentManifest> {
    const workspaceDir = this.pathPort.join(paths.workspacesDir, agentId);
    const manifestPath = this.pathPort.join(workspaceDir, "AGENTS.md");
    const displayName = await this.readAgentDisplayName(workspaceDir, agentId);

    const exists = await this.fileSystem.exists(manifestPath);
    if (!exists) {
      const metadata = normalizeAgentManifestMetadata({
        agentId,
        displayName
      });
      return {
        agentId,
        filePath: manifestPath,
        workspaceDir,
        metadata,
        body: "",
        source: "derived"
      };
    }

    const markdown = await this.fileSystem.readFile(manifestPath);
    const parsed = parseAgentManifestMarkdown(markdown);
    const metadata = normalizeAgentManifestMetadata({
      agentId,
      displayName,
      metadata: parsed.data
    });

    return {
      agentId,
      filePath: manifestPath,
      workspaceDir,
      metadata,
      body: parsed.body,
      source: parsed.hasFrontMatter ? "frontmatter" : "derived"
    };
  }

  private async readAgentDisplayName(workspaceDir: string, agentId: string): Promise<string> {
    const workspaceMetadataPath = this.pathPort.join(workspaceDir, "workspace.json");
    const workspaceMetadata = await this.readJsonIfPresent<WorkspaceMetadataShape>(workspaceMetadataPath);
    return workspaceMetadata?.displayName?.trim() || agentId;
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
