import { AgentService } from "../../agents/application/agent.service.js";
import { DEFAULT_AGENT_ID, normalizeAgentId } from "../../domain/agent-id.js";
import type { AgentIdentity } from "../../domain/agent.js";
import type {
  InitializationResult,
  OpenGoatConfig,
} from "../../domain/opengoat-paths.js";
import type { FileSystemPort } from "../../ports/file-system.port.js";
import type { PathPort } from "../../ports/path.port.js";
import type { OpenGoatPathsProvider } from "../../ports/paths-provider.port.js";
import {
  listOrganizationMarkdownTemplates,
  renderAgentsIndex,
  renderGlobalConfig,
} from "../../templates/default-templates.js";

const DEFAULT_PRODUCT_MANAGER_AGENT: AgentIdentity = {
  id: "sage",
  displayName: "Sage",
};
const DEFAULT_PRODUCT_MANAGER_ROLE = "Product Manager";
const DEFAULT_PRODUCT_MANAGER_TYPE = "manager";

interface AgentConfigShape {
  role?: unknown;
  organization?: {
    type?: unknown;
    reportsTo?: unknown;
  };
}

interface BootstrapServiceDeps {
  fileSystem: FileSystemPort;
  pathPort: PathPort;
  pathsProvider: OpenGoatPathsProvider;
  agentService: AgentService;
  nowIso: () => string;
}

export class BootstrapService {
  private readonly fileSystem: FileSystemPort;
  private readonly pathPort: PathPort;
  private readonly pathsProvider: OpenGoatPathsProvider;
  private readonly agentService: AgentService;
  private readonly nowIso: () => string;

  public constructor(deps: BootstrapServiceDeps) {
    this.fileSystem = deps.fileSystem;
    this.pathPort = deps.pathPort;
    this.pathsProvider = deps.pathsProvider;
    this.agentService = deps.agentService;
    this.nowIso = deps.nowIso;
  }

  public async initialize(): Promise<InitializationResult> {
    const paths = this.pathsProvider.getPaths();
    const createdPaths: string[] = [];
    const skippedPaths: string[] = [];
    const globalConfigExisted = await this.fileSystem.exists(
      paths.globalConfigJsonPath,
    );

    await this.ensureDirectory(paths.homeDir, createdPaths, skippedPaths);
    await this.ensureDirectory(paths.workspacesDir, createdPaths, skippedPaths);
    await this.ensureDirectory(
      paths.organizationDir,
      createdPaths,
      skippedPaths,
    );
    await this.ensureDirectory(paths.agentsDir, createdPaths, skippedPaths);
    await this.ensureDirectory(paths.providersDir, createdPaths, skippedPaths);
    await this.ensureDirectory(paths.runsDir, createdPaths, skippedPaths);
    await this.ensureOrganizationMarkdownFiles(
      paths.organizationDir,
      createdPaths,
      skippedPaths,
    );

    const now = this.nowIso();
    const defaultAgent = await this.ensureGlobalConfig(
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

    const goatResult = await this.agentService.ensureAgent(paths, {
      id: DEFAULT_AGENT_ID,
      displayName: "Goat",
    }, {
      type: "manager",
      reportsTo: null,
      role: "co-founder",
    });
    const goatWorkspaceBootstrapResult = goatResult.alreadyExisted
      ? {
          createdPaths: [],
          skippedPaths: [],
          removedPaths: [],
        }
      : await this.agentService.ensureCeoWorkspaceBootstrap(paths, {
          syncBootstrapMarkdown: !globalConfigExisted,
        });
    const goatWorkspaceTemplateSync =
      await this.agentService.syncAgentWorkspaceTemplateAssets(
        paths,
        DEFAULT_AGENT_ID,
        {
          includeBootstrapMarkdown: !globalConfigExisted,
        },
      );
    const productManagerResult = await this.agentService.ensureAgent(
      paths,
      DEFAULT_PRODUCT_MANAGER_AGENT,
      {
        type: DEFAULT_PRODUCT_MANAGER_TYPE,
        reportsTo: DEFAULT_AGENT_ID,
        role: DEFAULT_PRODUCT_MANAGER_ROLE,
      },
    );
    const productManagerConfigRepairResult =
      await this.repairProductManagerAgentConfig(paths);
    const productManagerWorkspaceBootstrapResult =
      productManagerResult.alreadyExisted
        ? {
            createdPaths: [],
            skippedPaths: [],
            removedPaths: [],
          }
        : await this.agentService.ensureAgentWorkspaceBootstrap(
            paths,
            {
              agentId: DEFAULT_PRODUCT_MANAGER_AGENT.id,
              displayName: DEFAULT_PRODUCT_MANAGER_AGENT.displayName,
              role: DEFAULT_PRODUCT_MANAGER_ROLE,
            },
            {
              syncBootstrapMarkdown: false,
            },
          );
    const productManagerWorkspaceTemplateSync =
      await this.agentService.syncAgentWorkspaceTemplateAssets(
        paths,
        DEFAULT_PRODUCT_MANAGER_AGENT.id,
      );
    const productManagerRoleSkillSync =
      await this.agentService.ensureAgentWorkspaceRoleSkills(
        paths,
        DEFAULT_PRODUCT_MANAGER_AGENT.id,
      );
    const workspaceReporteesSync =
      await this.agentService.syncWorkspaceReporteeLinks(paths);

    createdPaths.push(...goatResult.createdPaths);
    skippedPaths.push(...goatResult.skippedPaths);
    createdPaths.push(...goatWorkspaceBootstrapResult.createdPaths);
    skippedPaths.push(...goatWorkspaceBootstrapResult.skippedPaths);
    skippedPaths.push(...goatWorkspaceBootstrapResult.removedPaths);
    createdPaths.push(...goatWorkspaceTemplateSync.createdPaths);
    skippedPaths.push(...goatWorkspaceTemplateSync.skippedPaths);
    createdPaths.push(...productManagerResult.createdPaths);
    skippedPaths.push(...productManagerResult.skippedPaths);
    createdPaths.push(...productManagerConfigRepairResult.updatedPaths);
    skippedPaths.push(...productManagerConfigRepairResult.skippedPaths);
    createdPaths.push(...productManagerWorkspaceBootstrapResult.createdPaths);
    skippedPaths.push(...productManagerWorkspaceBootstrapResult.skippedPaths);
    skippedPaths.push(...productManagerWorkspaceBootstrapResult.removedPaths);
    createdPaths.push(...productManagerWorkspaceTemplateSync.createdPaths);
    skippedPaths.push(...productManagerWorkspaceTemplateSync.skippedPaths);
    createdPaths.push(...productManagerRoleSkillSync.createdPaths);
    skippedPaths.push(...productManagerRoleSkillSync.skippedPaths);
    skippedPaths.push(...productManagerRoleSkillSync.removedPaths);
    createdPaths.push(...workspaceReporteesSync.createdPaths);
    skippedPaths.push(...workspaceReporteesSync.skippedPaths);
    skippedPaths.push(...workspaceReporteesSync.removedPaths);

    return {
      paths,
      createdPaths,
      skippedPaths,
      defaultAgent,
    };
  }

  private async ensureGlobalConfig(
    globalConfigJsonPath: string,
    now: string,
    createdPaths: string[],
    skippedPaths: string[],
  ): Promise<string> {
    const exists = await this.fileSystem.exists(globalConfigJsonPath);
    if (!exists) {
      const created = renderGlobalConfig(now);
      await this.fileSystem.writeFile(
        globalConfigJsonPath,
        `${JSON.stringify(created, null, 2)}\n`,
      );
      createdPaths.push(globalConfigJsonPath);
      return created.defaultAgent;
    }

    const current = await this.readJsonIfPresent<OpenGoatConfig>(
      globalConfigJsonPath,
    );
    const normalizedDefaultAgent = normalizeAgentId(current?.defaultAgent ?? "");
    if (current && normalizedDefaultAgent) {
      if (
        current.schemaVersion === 1 &&
        current.defaultAgent === normalizedDefaultAgent &&
        typeof current.createdAt === "string" &&
        current.createdAt.trim() &&
        typeof current.updatedAt === "string" &&
        current.updatedAt.trim()
      ) {
        skippedPaths.push(globalConfigJsonPath);
        return normalizedDefaultAgent;
      }

      const repairedCurrent: OpenGoatConfig = {
        schemaVersion: 1,
        defaultAgent: normalizedDefaultAgent,
        createdAt: current.createdAt ?? now,
        updatedAt: now,
      };
      await this.fileSystem.writeFile(
        globalConfigJsonPath,
        `${JSON.stringify(repairedCurrent, null, 2)}\n`,
      );
      skippedPaths.push(globalConfigJsonPath);
      return repairedCurrent.defaultAgent;
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
    return repaired.defaultAgent;
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
          renderAgentsIndex(now, [DEFAULT_AGENT_ID, DEFAULT_PRODUCT_MANAGER_AGENT.id]),
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
    const mergedAgents = dedupe([
      ...(current?.agents ?? []),
      DEFAULT_AGENT_ID,
      DEFAULT_PRODUCT_MANAGER_AGENT.id,
    ]);
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

  private async ensureOrganizationMarkdownFiles(
    organizationDir: string,
    createdPaths: string[],
    skippedPaths: string[],
  ): Promise<void> {
    const templates = listOrganizationMarkdownTemplates();
    for (const template of templates) {
      const filePath = this.pathPort.join(organizationDir, template.fileName);
      const parentSegments = template.fileName
        .split(/[\\/]/)
        .slice(0, -1)
        .filter(Boolean);
      if (parentSegments.length > 0) {
        await this.fileSystem.ensureDir(
          this.pathPort.join(organizationDir, ...parentSegments),
        );
      }
      const exists = await this.fileSystem.exists(filePath);
      if (exists) {
        skippedPaths.push(filePath);
        continue;
      }
      const markdown = template.content.endsWith("\n")
        ? template.content
        : `${template.content}\n`;
      await this.fileSystem.writeFile(filePath, markdown);
      createdPaths.push(filePath);
    }
  }

  private async repairProductManagerAgentConfig(paths: {
    agentsDir: string;
  }): Promise<{ updatedPaths: string[]; skippedPaths: string[] }> {
    const configPath = this.pathPort.join(
      paths.agentsDir,
      DEFAULT_PRODUCT_MANAGER_AGENT.id,
      "config.json",
    );
    const config = await this.readJsonIfPresent<AgentConfigShape>(configPath);
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      return {
        updatedPaths: [],
        skippedPaths: [configPath],
      };
    }

    const organization =
      config.organization && typeof config.organization === "object"
        ? config.organization
        : {};
    const currentType =
      typeof organization.type === "string" ? organization.type.trim() : "";
    const currentReportsTo =
      typeof organization.reportsTo === "string"
        ? normalizeAgentId(organization.reportsTo)
        : null;
    const currentRole =
      typeof config.role === "string" ? config.role.trim() : "";
    const requiresUpdate =
      currentType !== DEFAULT_PRODUCT_MANAGER_TYPE ||
      currentReportsTo !== DEFAULT_AGENT_ID ||
      !currentRole;
    if (!requiresUpdate) {
      return {
        updatedPaths: [],
        skippedPaths: [configPath],
      };
    }

    const nextConfig: AgentConfigShape = {
      ...config,
      role: currentRole || DEFAULT_PRODUCT_MANAGER_ROLE,
      organization: {
        ...organization,
        type: DEFAULT_PRODUCT_MANAGER_TYPE,
        reportsTo: DEFAULT_AGENT_ID,
      },
    };
    await this.fileSystem.writeFile(
      configPath,
      `${JSON.stringify(nextConfig, null, 2)}\n`,
    );
    return {
      updatedPaths: [configPath],
      skippedPaths: [],
    };
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
