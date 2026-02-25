import {
  basename,
  dirname,
  isAbsolute,
  resolve as resolvePath,
} from "node:path";
import {
  DEFAULT_AGENT_ID,
  isDefaultAgentId,
  normalizeAgentId,
} from "../../domain/agent-id.js";
import type {
  AgentCreationResult,
  AgentDeletionResult,
  AgentDescriptor,
  AgentIdentity,
  AgentManagerUpdateResult,
} from "../../domain/agent.js";
import type {
  AgentsIndex,
  OpenGoatPaths,
} from "../../domain/opengoat-paths.js";
import type { FileSystemPort } from "../../ports/file-system.port.js";
import type { PathPort } from "../../ports/path.port.js";
import {
  renderAgentsIndex,
  renderBoardsSkillMarkdown,
  renderCeoBootstrapMarkdown,
  renderCeoRoleMarkdown,
  renderInternalAgentConfig,
  resolveAgentRole,
  type AgentTemplateOptions,
} from "../../templates/default-templates.js";

interface AgentServiceDeps {
  fileSystem: FileSystemPort;
  pathPort: PathPort;
  nowIso: () => string;
}

interface EnsureAgentOptions {
  type?: "manager" | "individual";
  reportsTo?: string | null;
  skills?: string[];
  role?: string;
}

interface AgentConfigShape {
  id?: string;
  displayName?: string;
  role?: string;
  organization?: {
    type?: "manager" | "individual";
    reportsTo?: string | null;
  };
}

export interface CeoWorkspaceBootstrapResult {
  createdPaths: string[];
  skippedPaths: string[];
  removedPaths: string[];
}

export interface AgentWorkspaceBootstrapInput {
  agentId: string;
  displayName: string;
  role: string;
}

export interface AgentWorkspaceBootstrapOptions {
  syncBootstrapMarkdown?: boolean;
  keepFirstRunSection?: boolean;
  removeBootstrapMarkdownWhenDisabled?: boolean;
  roleSkillDirectories?: string[];
  managedRoleSkillDirectories?: string[];
  roleSkillIdsByType?: RoleSkillIdsByType;
  managedRoleSkillIds?: string[];
}

interface WorkspaceSkillSyncResult {
  createdPaths: string[];
  skippedPaths: string[];
  removedPaths: string[];
}

export interface WorkspaceRoleSkillSyncOptions {
  requiredSkillDirectories?: string[];
  managedSkillDirectories?: string[];
  roleSkillIdsByType?: RoleSkillIdsByType;
  managedRoleSkillIds?: string[];
}

export interface RoleSkillIdsByType {
  manager: string[];
  individual: string[];
}

interface RoleAssignmentSyncResult {
  updatedPaths: string[];
  skippedPaths: string[];
}

export interface WorkspaceCommandShimSyncResult {
  createdPaths: string[];
  skippedPaths: string[];
}

export interface WorkspaceReporteeLinksSyncResult {
  createdPaths: string[];
  skippedPaths: string[];
  removedPaths: string[];
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
      throw new Error(
        "Agent name must contain at least one alphanumeric character.",
      );
    }

    return { id, displayName };
  }

  public async ensureAgent(
    paths: OpenGoatPaths,
    identity: AgentIdentity,
    options: EnsureAgentOptions = {},
  ): Promise<AgentCreationResult> {
    const workspaceDir = this.pathPort.join(paths.workspacesDir, identity.id);
    const internalConfigDir = this.pathPort.join(paths.agentsDir, identity.id);
    const configPath = this.pathPort.join(internalConfigDir, "config.json");
    const templateOptions = toAgentTemplateOptions(identity.id, options);

    const createdPaths: string[] = [];
    const skippedPaths: string[] = [];

    const configExisted = await this.fileSystem.exists(configPath);

    await this.ensureDirectory(internalConfigDir, createdPaths, skippedPaths);

    await this.writeJsonIfMissing(
      configPath,
      renderInternalAgentConfig(identity, templateOptions),
      createdPaths,
      skippedPaths,
    );
    const role = await this.readAgentRole(paths, identity.id);

    const existingIndex = await this.readJsonIfPresent<AgentsIndex>(
      paths.agentsIndexJsonPath,
    );
    const agents = dedupe([...(existingIndex?.agents ?? []), identity.id]);
    const nextIndex = renderAgentsIndex(this.nowIso(), agents);
    await this.fileSystem.writeFile(
      paths.agentsIndexJsonPath,
      toJson(nextIndex),
    );

    return {
      agent: {
        ...identity,
        role,
        workspaceDir,
        internalConfigDir,
      },
      alreadyExisted: configExisted,
      createdPaths,
      skippedPaths,
    };
  }

  public async listAgents(paths: OpenGoatPaths): Promise<AgentDescriptor[]> {
    const ids = await this.fileSystem.listDirectories(paths.agentsDir);
    const descriptors: AgentDescriptor[] = [];

    for (const id of ids) {
      const workspaceDir = this.pathPort.join(paths.workspacesDir, id);
      const internalConfigDir = this.pathPort.join(paths.agentsDir, id);
      const displayName = await this.readAgentDisplayName(paths, id);
      const role = await this.readAgentRole(paths, id);
      descriptors.push({
        id,
        displayName,
        role,
        workspaceDir,
        internalConfigDir,
      });
    }

    return descriptors.sort((left, right) => left.id.localeCompare(right.id));
  }

  public async ensureCeoWorkspaceBootstrap(
    paths: OpenGoatPaths,
    options: AgentWorkspaceBootstrapOptions = {
      syncBootstrapMarkdown: true,
    },
  ): Promise<CeoWorkspaceBootstrapResult> {
    const displayName = await this.readAgentDisplayName(
      paths,
      DEFAULT_AGENT_ID,
    );
    const role = await this.readAgentRole(paths, DEFAULT_AGENT_ID);
    return this.ensureAgentWorkspaceBootstrap(
      paths,
      {
        agentId: DEFAULT_AGENT_ID,
        displayName,
        role,
      },
      options,
    );
  }

  public async ensureAgentWorkspaceBootstrap(
    paths: OpenGoatPaths,
    input: AgentWorkspaceBootstrapInput,
    options: AgentWorkspaceBootstrapOptions = {},
  ): Promise<CeoWorkspaceBootstrapResult> {
    const normalizedAgentId = normalizeAgentId(input.agentId);
    if (!normalizedAgentId) {
      throw new Error("Agent id cannot be empty.");
    }
    const workspaceDir = this.pathPort.join(
      paths.workspacesDir,
      normalizedAgentId,
    );
    const agentsPath = this.pathPort.join(workspaceDir, "AGENTS.md");
    const rolePath = this.pathPort.join(workspaceDir, "ROLE.md");
    const bootstrapPath = this.pathPort.join(workspaceDir, "BOOTSTRAP.md");
    const userPath = this.pathPort.join(workspaceDir, "USER.md");
    const createdPaths: string[] = [];
    const skippedPaths: string[] = [];
    const removedPaths: string[] = [];

    await this.ensureDirectory(workspaceDir, createdPaths, skippedPaths);
    await this.writeOpenGoatWorkspaceShim(
      workspaceDir,
      createdPaths,
      skippedPaths,
    );
    await this.ensureWorkspaceOrganizationSymlink(
      workspaceDir,
      paths.organizationDir,
      createdPaths,
      skippedPaths,
      removedPaths,
    );

    await this.rewriteAgentsMarkdown(
      agentsPath,
      {
        keepFirstRunSection:
          options.keepFirstRunSection ?? isDefaultAgentId(normalizedAgentId),
      },
      createdPaths,
      skippedPaths,
    );
    await this.writeRoleMarkdown(
      rolePath,
      {
        agentId: normalizedAgentId,
        displayName: input.displayName.trim() || normalizedAgentId,
        role: input.role.trim(),
      },
      createdPaths,
      skippedPaths,
    );
    const workspaceSkillSync = await this.ensureAgentWorkspaceRoleSkills(
      paths,
      normalizedAgentId,
      {
        requiredSkillDirectories: options.roleSkillDirectories,
        managedSkillDirectories: options.managedRoleSkillDirectories,
        roleSkillIdsByType: options.roleSkillIdsByType,
        managedRoleSkillIds: options.managedRoleSkillIds,
      },
    );
    createdPaths.push(...workspaceSkillSync.createdPaths);
    skippedPaths.push(...workspaceSkillSync.skippedPaths);
    removedPaths.push(...workspaceSkillSync.removedPaths);

    if (isDefaultAgentId(normalizedAgentId) && options.syncBootstrapMarkdown) {
      await this.writeBootstrapMarkdown(
        bootstrapPath,
        createdPaths,
        skippedPaths,
      );
    } else if (isDefaultAgentId(normalizedAgentId)) {
      if (options.removeBootstrapMarkdownWhenDisabled) {
        await this.removePathIfExists(
          bootstrapPath,
          removedPaths,
          skippedPaths,
        );
      } else {
        skippedPaths.push(bootstrapPath);
      }
    } else {
      await this.removePathIfExists(bootstrapPath, removedPaths, skippedPaths);
    }
    await this.removePathIfExists(userPath, removedPaths, skippedPaths);

    return {
      createdPaths,
      skippedPaths,
      removedPaths,
    };
  }

  public async ensureAgentWorkspaceCommandShim(
    paths: OpenGoatPaths,
    rawAgentId: string,
  ): Promise<WorkspaceCommandShimSyncResult> {
    const agentId = normalizeAgentId(rawAgentId);
    if (!agentId) {
      throw new Error("Agent id cannot be empty.");
    }

    const workspaceDir = this.pathPort.join(paths.workspacesDir, agentId);
    const createdPaths: string[] = [];
    const skippedPaths: string[] = [];
    await this.ensureDirectory(workspaceDir, createdPaths, skippedPaths);
    await this.writeOpenGoatWorkspaceShim(
      workspaceDir,
      createdPaths,
      skippedPaths,
    );
    await this.ensureWorkspaceOrganizationSymlink(
      workspaceDir,
      paths.organizationDir,
      createdPaths,
      skippedPaths,
    );
    return {
      createdPaths,
      skippedPaths,
    };
  }

  public async syncWorkspaceReporteeLinks(
    paths: OpenGoatPaths,
  ): Promise<WorkspaceReporteeLinksSyncResult> {
    const createdPaths: string[] = [];
    const skippedPaths: string[] = [];
    const removedPaths: string[] = [];
    const knownAgents = dedupe(
      await this.fileSystem.listDirectories(paths.agentsDir),
    );
    const directReporteesByManager = new Map<string, string[]>();
    const configuredManagerIds = new Set<string>();
    const directManagerByAgent = new Map<string, string | null>();

    for (const agentId of knownAgents) {
      if (
        isDefaultAgentId(agentId) ||
        (await this.readAgentConfiguredType(paths, agentId)) === "manager"
      ) {
        configuredManagerIds.add(agentId);
      }
      const reportsTo = await this.readAgentReportsTo(paths, agentId);
      directManagerByAgent.set(agentId, reportsTo);
      if (reportsTo) {
        const currentReportees = directReporteesByManager.get(reportsTo) ?? [];
        currentReportees.push(agentId);
        directReporteesByManager.set(reportsTo, currentReportees);
      }
    }

    const managerCandidates = new Set<string>(configuredManagerIds);
    for (const managerId of directReporteesByManager.keys()) {
      managerCandidates.add(managerId);
    }

    for (const agentId of knownAgents) {
      const workspaceDir = this.pathPort.join(paths.workspacesDir, agentId);
      const managerLinkPath = this.pathPort.join(workspaceDir, "manager");
      const reporteesDir = this.pathPort.join(workspaceDir, "reportees");
      const directReportees = dedupe(
        directReporteesByManager.get(agentId) ?? [],
      );
      const managerId = directManagerByAgent.get(agentId) ?? null;
      const expectedReportees = new Set(directReportees);
      const isManager = managerCandidates.has(agentId);
      const reporteesDirExists = await this.fileSystem.exists(reporteesDir);

      await this.ensureDirectory(workspaceDir, createdPaths, skippedPaths);
      if (managerId) {
        await this.ensureWorkspaceSymlink(
          this.pathPort.join(paths.workspacesDir, managerId),
          managerLinkPath,
          createdPaths,
          skippedPaths,
          removedPaths,
        );
      } else {
        await this.removeWorkspaceSymlinkIfPresent(
          managerLinkPath,
          removedPaths,
          skippedPaths,
        );
      }
      if (isManager) {
        await this.ensureDirectory(reporteesDir, createdPaths, skippedPaths);
      } else if (!reporteesDirExists) {
        skippedPaths.push(reporteesDir);
        continue;
      }

      for (const reporteeId of directReportees) {
        await this.ensureWorkspaceSymlink(
          this.pathPort.join(paths.workspacesDir, reporteeId),
          this.pathPort.join(reporteesDir, reporteeId),
          createdPaths,
          skippedPaths,
          removedPaths,
        );
      }

      for (const entryName of await this.fileSystem.listEntries(reporteesDir)) {
        if (expectedReportees.has(entryName)) {
          continue;
        }

        const entryPath = this.pathPort.join(reporteesDir, entryName);
        const staleSymlinkTarget = await this.fileSystem.readSymbolicLink(
          entryPath,
        );
        if (staleSymlinkTarget === null) {
          skippedPaths.push(entryPath);
          continue;
        }

        await this.fileSystem.removeDir(entryPath);
        removedPaths.push(entryPath);
      }
    }

    return {
      createdPaths,
      skippedPaths,
      removedPaths,
    };
  }

  public async ensureAgentWorkspaceRoleSkills(
    paths: OpenGoatPaths,
    agentId: string,
    options: WorkspaceRoleSkillSyncOptions = {},
  ): Promise<WorkspaceSkillSyncResult> {
    const normalizedAgentId = normalizeAgentId(agentId);
    if (!normalizedAgentId) {
      throw new Error("Agent id cannot be empty.");
    }
    const type = await this.readAgentType(paths, normalizedAgentId);
    const roleSkillIdsByType = resolveRoleSkillIdsByType(
      options.roleSkillIdsByType,
    );
    const requiredSkillIds =
      type === "manager"
        ? roleSkillIdsByType.manager
        : roleSkillIdsByType.individual;
    const managedRoleSkillIds = dedupeRoleSkillIds([
      ...roleSkillIdsByType.manager,
      ...roleSkillIdsByType.individual,
      ...(options.managedRoleSkillIds ?? []),
      ...STATIC_ROLE_SKILL_IDS,
    ]);
    const requiredSkillDirectories = resolveRoleSkillDirectories(
      options.requiredSkillDirectories,
    );
    const managedSkillDirectories = resolveRoleSkillDirectories([
      ...(options.managedSkillDirectories ?? []),
      ...requiredSkillDirectories,
    ]);
    const requiredSkillDirectorySet = new Set(requiredSkillDirectories);
    const workspaceDir = this.pathPort.join(
      paths.workspacesDir,
      normalizedAgentId,
    );
    const createdPaths: string[] = [];
    const skippedPaths: string[] = [];
    const removedPaths: string[] = [];

    await this.ensureDirectory(workspaceDir, createdPaths, skippedPaths);

    for (const relativeSkillsDir of requiredSkillDirectories) {
      const skillsDir = this.pathPort.join(workspaceDir, relativeSkillsDir);
      await this.ensureDirectory(skillsDir, createdPaths, skippedPaths);

      for (const skillId of requiredSkillIds) {
        const skillDir = this.pathPort.join(skillsDir, skillId);
        const skillFile = this.pathPort.join(skillDir, "SKILL.md");
        await this.ensureDirectory(skillDir, createdPaths, skippedPaths);
        await this.writeMarkdown(
          skillFile,
          this.renderWorkspaceSkill(skillId, normalizedAgentId),
          createdPaths,
          skippedPaths,
          { overwrite: true },
        );
      }
    }

    for (const relativeSkillsDir of managedSkillDirectories) {
      const skillsDir = this.pathPort.join(workspaceDir, relativeSkillsDir);
      const shouldKeepRoleSkillsInDirectory =
        requiredSkillDirectorySet.has(relativeSkillsDir);

      for (const skillId of managedRoleSkillIds) {
        const shouldExist =
          shouldKeepRoleSkillsInDirectory && requiredSkillIds.includes(skillId);
        if (shouldExist) {
          continue;
        }

        const staleSkillDir = this.pathPort.join(skillsDir, skillId);
        if (await this.fileSystem.exists(staleSkillDir)) {
          await this.fileSystem.removeDir(staleSkillDir);
          removedPaths.push(staleSkillDir);
        } else {
          skippedPaths.push(staleSkillDir);
        }
      }
    }

    return {
      createdPaths,
      skippedPaths,
      removedPaths,
    };
  }

  public async syncAgentRoleAssignments(
    paths: OpenGoatPaths,
    agentId: string,
  ): Promise<RoleAssignmentSyncResult> {
    const normalizedAgentId = normalizeAgentId(agentId);
    if (!normalizedAgentId) {
      throw new Error("Agent id cannot be empty.");
    }
    const configPath = this.pathPort.join(
      paths.agentsDir,
      normalizedAgentId,
      "config.json",
    );
    const config = await this.readJsonIfPresent<Record<string, unknown>>(
      configPath,
    );
    if (!config) {
      return {
        updatedPaths: [],
        skippedPaths: [configPath],
      };
    }

    const type = await this.readAgentType(paths, normalizedAgentId);
    const roleSkillIdsByType = resolveRoleSkillIdsByType();
    const requiredSkillIds =
      type === "manager"
        ? roleSkillIdsByType.manager
        : roleSkillIdsByType.individual;
    const roleSkillIds = new Set<string>([
      ...roleSkillIdsByType.manager,
      ...roleSkillIdsByType.individual,
      ...STATIC_ROLE_SKILL_IDS,
    ]);
    const runtimeRecord = toObject(config.runtime);
    const skillsRecord = toObject(runtimeRecord.skills);
    const assignedRaw = Array.isArray(skillsRecord.assigned)
      ? skillsRecord.assigned
      : [];
    const assigned = [
      ...new Set(
        assignedRaw
          .map((value) => String(value).trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    const preserved = assigned.filter((skillId) => !roleSkillIds.has(skillId));
    const nextAssigned = [...new Set([...preserved, ...requiredSkillIds])];

    if (sameStringArray(assigned, nextAssigned)) {
      return {
        updatedPaths: [],
        skippedPaths: [configPath],
      };
    }

    skillsRecord.assigned = nextAssigned;
    runtimeRecord.skills = skillsRecord;
    config.runtime = runtimeRecord;
    await this.fileSystem.writeFile(configPath, toJson(config));
    return {
      updatedPaths: [configPath],
      skippedPaths: [],
    };
  }

  public async removeAgent(
    paths: OpenGoatPaths,
    rawAgentId: string,
  ): Promise<AgentDeletionResult> {
    const agentId = normalizeAgentId(rawAgentId);
    if (!agentId) {
      throw new Error("Agent id cannot be empty.");
    }
    if (isDefaultAgentId(agentId)) {
      throw new Error(
        "Cannot delete ceo. It is the immutable default entry agent.",
      );
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

    const internalConfigExists = await this.fileSystem.exists(
      internalConfigDir,
    );
    if (internalConfigExists) {
      await this.fileSystem.removeDir(internalConfigDir);
      removedPaths.push(internalConfigDir);
    } else {
      skippedPaths.push(internalConfigDir);
    }

    const index = await this.readJsonIfPresent<AgentsIndex>(
      paths.agentsIndexJsonPath,
    );
    if (index) {
      const filtered = dedupe(index.agents.filter((id) => id !== agentId));
      const nextIndex = renderAgentsIndex(this.nowIso(), filtered);
      await this.fileSystem.writeFile(
        paths.agentsIndexJsonPath,
        toJson(nextIndex),
      );
    }

    return {
      agentId,
      existed: workspaceExists || internalConfigExists,
      removedPaths,
      skippedPaths,
    };
  }

  public async setAgentManager(
    paths: OpenGoatPaths,
    rawAgentId: string,
    rawReportsTo: string | null | undefined,
  ): Promise<AgentManagerUpdateResult> {
    const agentId = normalizeAgentId(rawAgentId);
    if (!agentId) {
      throw new Error("Agent id cannot be empty.");
    }

    const explicitReportsTo =
      rawReportsTo === null || rawReportsTo === undefined
        ? null
        : normalizeAgentId(rawReportsTo);
    if (explicitReportsTo === agentId) {
      throw new Error(`Agent "${agentId}" cannot report to itself.`);
    }
    if (isDefaultAgentId(agentId) && explicitReportsTo) {
      throw new Error(
        "ceo is the head of the organization and cannot report to another agent.",
      );
    }
    const reportsTo = resolveReportsTo(agentId, rawReportsTo);

    const knownAgents = await this.fileSystem.listDirectories(paths.agentsDir);
    if (!knownAgents.includes(agentId)) {
      throw new Error(`Agent "${agentId}" does not exist.`);
    }
    if (reportsTo && !knownAgents.includes(reportsTo)) {
      throw new Error(`Manager "${reportsTo}" does not exist.`);
    }

    await this.assertNoReportingCycle(paths, agentId, reportsTo, knownAgents);

    const configPath = this.pathPort.join(
      paths.agentsDir,
      agentId,
      "config.json",
    );
    const displayName = await this.readAgentDisplayName(paths, agentId);
    const role = await this.readAgentRole(paths, agentId);
    const existingConfig =
      (await this.readJsonIfPresent<Record<string, unknown>>(configPath)) ??
      (renderInternalAgentConfig({ id: agentId, displayName, role }) as Record<
        string,
        unknown
      >);
    const existingOrganization = toObject(existingConfig.organization);

    const previousReportsTo = normalizeReportsToValue(
      existingOrganization.reportsTo,
    );
    const nextOrganization: Record<string, unknown> = {
      ...existingOrganization,
      reportsTo,
    };

    if (typeof existingOrganization.type !== "string") {
      nextOrganization.type = isDefaultAgentId(agentId)
        ? "manager"
        : "individual";
    }

    const nextConfig = {
      ...existingConfig,
      organization: nextOrganization,
    };

    await this.fileSystem.writeFile(configPath, toJson(nextConfig));

    return {
      agentId,
      previousReportsTo: previousReportsTo ?? null,
      reportsTo,
      updatedPaths: [configPath],
    };
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

  private async removePathIfExists(
    filePath: string,
    removedPaths: string[],
    skippedPaths: string[],
  ): Promise<void> {
    const exists = await this.fileSystem.exists(filePath);
    if (!exists) {
      skippedPaths.push(filePath);
      return;
    }
    await this.fileSystem.removeDir(filePath);
    removedPaths.push(filePath);
  }

  private async writeJsonIfMissing(
    filePath: string,
    payload: unknown,
    createdPaths: string[],
    skippedPaths: string[],
  ): Promise<void> {
    const exists = await this.fileSystem.exists(filePath);
    if (exists) {
      skippedPaths.push(filePath);
      return;
    }

    await this.fileSystem.writeFile(filePath, toJson(payload));
    createdPaths.push(filePath);
  }

  private async writeMarkdown(
    filePath: string,
    content: string,
    createdPaths: string[],
    skippedPaths: string[],
    options: { overwrite?: boolean } = {},
  ): Promise<void> {
    const exists = await this.fileSystem.exists(filePath);
    if (exists && !options.overwrite) {
      skippedPaths.push(filePath);
      return;
    }

    const markdown = content.endsWith("\n") ? content : `${content}\n`;
    await this.fileSystem.writeFile(filePath, markdown);
    if (exists) {
      skippedPaths.push(filePath);
      return;
    }
    createdPaths.push(filePath);
  }

  private async rewriteAgentsMarkdown(
    filePath: string,
    options: { keepFirstRunSection: boolean },
    createdPaths: string[],
    skippedPaths: string[],
  ): Promise<void> {
    const exists = await this.fileSystem.exists(filePath);
    if (!exists) {
      skippedPaths.push(filePath);
      return;
    }

    const source = await this.fileSystem.readFile(filePath);
    if (hasOrganizationSectionHeading(source)) {
      skippedPaths.push(filePath);
      return;
    }
    const next = normalizeAgentsMarkdown(source, options);
    if (source === next) {
      skippedPaths.push(filePath);
      return;
    }

    await this.fileSystem.writeFile(filePath, next);
    skippedPaths.push(filePath);
  }

  private async writeRoleMarkdown(
    filePath: string,
    profile: {
      agentId: string;
      displayName: string;
      role: string;
    },
    createdPaths: string[],
    skippedPaths: string[],
  ): Promise<void> {
    await this.writeMarkdown(
      filePath,
      renderRoleMarkdown(profile),
      createdPaths,
      skippedPaths,
      { overwrite: true },
    );
  }

  private async writeBootstrapMarkdown(
    filePath: string,
    createdPaths: string[],
    skippedPaths: string[],
  ): Promise<void> {
    await this.writeMarkdown(
      filePath,
      renderCeoBootstrapMarkdown(),
      createdPaths,
      skippedPaths,
      { overwrite: true },
    );
  }

  private async writeOpenGoatWorkspaceShim(
    workspaceDir: string,
    createdPaths: string[],
    skippedPaths: string[],
  ): Promise<void> {
    const shimPath = this.pathPort.join(workspaceDir, "opengoat");
    await this.writeMarkdown(
      shimPath,
      renderOpenGoatWorkspaceShim(),
      createdPaths,
      skippedPaths,
      { overwrite: true },
    );
  }

  private async ensureWorkspaceOrganizationSymlink(
    workspaceDir: string,
    organizationDir: string,
    createdPaths: string[],
    skippedPaths: string[],
    removedPaths?: string[],
  ): Promise<void> {
    await this.ensureWorkspaceSymlink(
      organizationDir,
      this.pathPort.join(workspaceDir, "organization"),
      createdPaths,
      skippedPaths,
      removedPaths,
    );
  }

  private async ensureWorkspaceSymlink(
    targetPath: string,
    linkPath: string,
    createdPaths: string[],
    skippedPaths: string[],
    removedPaths?: string[],
  ): Promise<void> {
    const desiredTarget = resolvePath(targetPath);
    const existingSymlinkTarget = await this.fileSystem.readSymbolicLink(
      linkPath,
    );
    if (existingSymlinkTarget !== null) {
      const resolvedExistingTarget = resolvePath(
        dirname(linkPath),
        existingSymlinkTarget,
      );
      if (resolvedExistingTarget === desiredTarget) {
        skippedPaths.push(linkPath);
        return;
      }
      await this.fileSystem.removeDir(linkPath);
      removedPaths?.push(linkPath);
    } else if (await this.fileSystem.exists(linkPath)) {
      // Do not overwrite user-managed files/directories.
      skippedPaths.push(linkPath);
      return;
    }

    await this.fileSystem.createSymbolicLink(desiredTarget, linkPath);
    createdPaths.push(linkPath);
  }

  private async removeWorkspaceSymlinkIfPresent(
    linkPath: string,
    removedPaths: string[],
    skippedPaths: string[],
  ): Promise<void> {
    const existingSymlinkTarget = await this.fileSystem.readSymbolicLink(
      linkPath,
    );
    if (existingSymlinkTarget !== null) {
      await this.fileSystem.removeDir(linkPath);
      removedPaths.push(linkPath);
      return;
    }
    skippedPaths.push(linkPath);
  }

  private async readAgentConfiguredType(
    paths: OpenGoatPaths,
    agentId: string,
  ): Promise<"manager" | "individual" | undefined> {
    const configPath = this.pathPort.join(
      paths.agentsDir,
      agentId,
      "config.json",
    );
    const config = await this.readJsonIfPresent<AgentConfigShape>(configPath);
    return config?.organization?.type;
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

  private async readAgentDisplayName(
    paths: OpenGoatPaths,
    agentId: string,
  ): Promise<string> {
    const configPath = this.pathPort.join(
      paths.agentsDir,
      agentId,
      "config.json",
    );
    const config = await this.readJsonIfPresent<AgentConfigShape>(configPath);
    return config?.displayName?.trim() || agentId;
  }

  private async readAgentRole(
    paths: OpenGoatPaths,
    agentId: string,
  ): Promise<string> {
    const configPath = this.pathPort.join(
      paths.agentsDir,
      agentId,
      "config.json",
    );
    const config = await this.readJsonIfPresent<AgentConfigShape>(configPath);
    const type =
      config?.organization?.type ??
      (isDefaultAgentId(agentId) ? "manager" : "individual");
    return resolveAgentRole(agentId, type, config?.role);
  }

  private async readAgentType(
    paths: OpenGoatPaths,
    agentId: string,
  ): Promise<"manager" | "individual"> {
    const configPath = this.pathPort.join(
      paths.agentsDir,
      agentId,
      "config.json",
    );
    const config = await this.readJsonIfPresent<AgentConfigShape>(configPath);
    const type = config?.organization?.type;
    const hasDirectReportees = await this.hasDirectReportees(paths, agentId);
    if (type === "manager") {
      return type;
    }
    if (type === "individual") {
      return hasDirectReportees ? "manager" : "individual";
    }
    if (isDefaultAgentId(agentId)) {
      return "manager";
    }
    return hasDirectReportees ? "manager" : "individual";
  }

  private renderWorkspaceSkill(skillId: string, agentId: string): string {
    if (
      skillId === "og-boards" ||
      skillId === "og-board-manager" ||
      skillId === "og-board-individual"
    ) {
      return renderBoardsSkillMarkdown(skillId, agentId);
    }
    throw new Error(`Unsupported workspace skill id: ${skillId}`);
  }

  private async assertNoReportingCycle(
    paths: OpenGoatPaths,
    agentId: string,
    reportsTo: string | null,
    knownAgentIds: string[],
  ): Promise<void> {
    if (!reportsTo) {
      return;
    }

    const reportsToByAgent = new Map<string, string | null>();
    await Promise.all(
      knownAgentIds.map(async (candidateAgentId) => {
        reportsToByAgent.set(
          candidateAgentId,
          await this.readAgentReportsTo(paths, candidateAgentId),
        );
      }),
    );

    reportsToByAgent.set(agentId, reportsTo);
    const visited = new Set<string>([agentId]);
    let cursor: string | null = reportsTo;

    while (cursor) {
      if (visited.has(cursor)) {
        throw new Error(
          `Cannot set "${agentId}" to report to "${reportsTo}" because it would create a cycle.`,
        );
      }
      visited.add(cursor);
      cursor = reportsToByAgent.get(cursor) ?? null;
    }
  }

  private async readAgentReportsTo(
    paths: OpenGoatPaths,
    agentId: string,
  ): Promise<string | null> {
    const configPath = this.pathPort.join(
      paths.agentsDir,
      agentId,
      "config.json",
    );
    const config = await this.readJsonIfPresent<AgentConfigShape>(configPath);
    const reportsTo = normalizeReportsToValue(config?.organization?.reportsTo);

    if (isDefaultAgentId(agentId)) {
      return null;
    }

    if (reportsTo === undefined) {
      return DEFAULT_AGENT_ID;
    }

    return reportsTo;
  }

  private async hasDirectReportees(
    paths: OpenGoatPaths,
    managerAgentId: string,
  ): Promise<boolean> {
    const normalizedManagerId = normalizeAgentId(managerAgentId);
    if (!normalizedManagerId) {
      return false;
    }

    const knownAgents = await this.fileSystem.listDirectories(paths.agentsDir);
    for (const agentId of knownAgents) {
      if (agentId === normalizedManagerId) {
        continue;
      }
      const reportsTo = await this.readAgentReportsTo(paths, agentId);
      if (reportsTo === normalizedManagerId) {
        return true;
      }
    }

    return false;
  }
}

const MANAGER_ROLE_SKILLS = ["og-board-manager"];
const INDIVIDUAL_ROLE_SKILLS = ["og-board-individual"];
const SHARED_ROLE_SKILLS = ["og-boards"];
const LEGACY_MANAGER_ROLE_SKILLS = ["board-manager"];
const LEGACY_INDIVIDUAL_ROLE_SKILLS = ["board-individual"];
const STATIC_ROLE_SKILL_IDS = [
  ...MANAGER_ROLE_SKILLS,
  ...INDIVIDUAL_ROLE_SKILLS,
  ...SHARED_ROLE_SKILLS,
  ...LEGACY_MANAGER_ROLE_SKILLS,
  ...LEGACY_INDIVIDUAL_ROLE_SKILLS,
];
const DEFAULT_WORKSPACE_SKILL_DIRECTORY = "skills";

function toAgentTemplateOptions(
  agentId: string,
  options: EnsureAgentOptions,
): AgentTemplateOptions {
  const type =
    options.type ?? (isDefaultAgentId(agentId) ? "manager" : "individual");
  const reportsTo = resolveReportsTo(agentId, options.reportsTo);
  const providedSkills = options.skills ?? [];
  const roleSkillIds = new Set([...STATIC_ROLE_SKILL_IDS]);
  const skills = dedupe(
    providedSkills.filter((skillId) => !roleSkillIds.has(skillId)),
  );
  const role = resolveAgentRole(agentId, type, options.role);
  return {
    type,
    reportsTo,
    skills,
    role,
  };
}

function resolveReportsTo(
  agentId: string,
  reportsTo: string | null | undefined,
): string | null {
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

function normalizeReportsToValue(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = normalizeAgentId(value);
  if (!normalized) {
    return null;
  }
  return normalized;
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function resolveRoleSkillIdsByType(
  input?: RoleSkillIdsByType,
): RoleSkillIdsByType {
  const manager = dedupeRoleSkillIds(input?.manager ?? MANAGER_ROLE_SKILLS);
  const individual = dedupeRoleSkillIds(
    input?.individual ?? INDIVIDUAL_ROLE_SKILLS,
  );
  return {
    manager: manager.length > 0 ? manager : [...MANAGER_ROLE_SKILLS],
    individual:
      individual.length > 0 ? individual : [...INDIVIDUAL_ROLE_SKILLS],
  };
}

function dedupeRoleSkillIds(values: string[]): string[] {
  const deduped: string[] = [];
  for (const value of values) {
    const normalized = value.trim().toLowerCase();
    if (!normalized || deduped.includes(normalized)) {
      continue;
    }
    deduped.push(normalized);
  }
  return deduped;
}

function resolveRoleSkillDirectories(input?: string[]): string[] {
  const candidates =
    input && input.length > 0 ? input : [DEFAULT_WORKSPACE_SKILL_DIRECTORY];
  const directories: string[] = [];
  for (const candidate of candidates) {
    const normalized = normalizeRoleSkillDirectory(candidate);
    if (!normalized || directories.includes(normalized)) {
      continue;
    }
    directories.push(normalized);
  }
  return directories.length > 0
    ? directories
    : [DEFAULT_WORKSPACE_SKILL_DIRECTORY];
}

function normalizeRoleSkillDirectory(rawDirectory: string): string | null {
  const trimmed = rawDirectory.trim().replace(/\\/g, "/");
  if (!trimmed) {
    return null;
  }
  const parts = trimmed
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part !== ".");
  if (parts.length === 0 || parts.includes("..")) {
    return null;
  }
  return parts.join("/");
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

function sameStringArray(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

function normalizeAgentsMarkdown(
  markdown: string,
  options: { keepFirstRunSection: boolean },
): string {
  const withFirstRunApplied = options.keepFirstRunSection
    ? markdown
    : rewriteSecondLevelSection(markdown, /^##\s+first run\s*$/i, null);
  return rewriteSecondLevelSection(
    withFirstRunApplied,
    /^##\s+every session\s*$/i,
    EVERY_SESSION_SECTION_LINES,
    {
      consumeFollowingHeadingPatterns: [
        /^##\s+the organization\s*$/i,
        /^##\s+repositories\s*$/i,
      ],
    },
  );
}

function hasOrganizationSectionHeading(markdown: string): boolean {
  return /the organization/i.test(markdown);
}

function rewriteSecondLevelSection(
  markdown: string,
  headingPattern: RegExp,
  replacementLines: string[] | null,
  options: {
    consumeFollowingHeadingPatterns?: RegExp[];
  } = {},
): string {
  const lineBreak = markdown.includes("\r\n") ? "\r\n" : "\n";
  const lines = markdown.split(/\r?\n/);
  const hasTrailingLineBreak = /\r?\n$/.test(markdown);
  const kept: string[] = [];
  let index = 0;
  let replaced = false;
  const consumeFollowingHeadingPatterns =
    options.consumeFollowingHeadingPatterns ?? [];

  while (index < lines.length) {
    const line = lines[index];
    if (line === undefined) {
      index += 1;
      continue;
    }
    const trimmed = line.trim();
    if (headingPattern.test(trimmed)) {
      replaced = true;
      if (replacementLines) {
        kept.push(...replacementLines);
      }
      index += 1;
      while (index < lines.length) {
        const nextLine = lines[index];
        const nextTrimmed = nextLine?.trim() ?? "";
        const isSecondLevelHeading = /^##\s+/.test(nextTrimmed);
        const shouldConsumeFollowingHeading =
          isSecondLevelHeading &&
          (headingPattern.test(nextTrimmed) ||
            consumeFollowingHeadingPatterns.some((pattern) =>
              pattern.test(nextTrimmed),
            ));
        if (isSecondLevelHeading && !shouldConsumeFollowingHeading) {
          break;
        }
        index += 1;
      }
      continue;
    }
    kept.push(line);
    index += 1;
  }

  if (!replaced) {
    return markdown;
  }

  let next = kept.join(lineBreak);
  if (hasTrailingLineBreak && !next.endsWith(lineBreak)) {
    next = `${next}${lineBreak}`;
  }
  return next;
}

const EVERY_SESSION_SECTION_LINES = [
  "## Every Session",
  "",
  "Before doing anything else:",
  "",
  "1. Read `SOUL.md` — this is who you are",
  "2. Read `ROLE.md` — this is your role in the organization",
  "3. Read `memory/YYYY-MM-DD.md` (today + yesterday) for recent context",
  "4. **If in MAIN SESSION**: Also read `MEMORY.md`",
  "",
  "Use OpenGoat tools directly (`opengoat_*`). Do not rely on shell CLI commands.",
  "",
  "Don't ask permission. Just do it.",
  "",
  "## The Organization",
  "",
  "You are part of an organization run by AI agents. You have access to the organization's context and wiki on the `organization` folder",
  "",
  "## Repositories",
  "",
  "If you need to use a repo, clone it or copy it into a new folder on your workspace `./<repo>`.",
  "",
];

function renderRoleMarkdown(profile: {
  agentId: string;
  displayName: string;
  role: string;
}): string {
  if (isDefaultAgentId(profile.agentId)) {
    return renderCeoRoleMarkdown();
  }

  return [
    "# ROLE.md - Your position in the organization",
    "",
    "You are part of an organization fully run by AI agents.",
    "",
    `- Your id: ${profile.agentId} (agent id)`,
    `- Your name: ${profile.displayName}`,
    `- Role: ${profile.role}`,
    `- For info about your level on the organization, call tool \`opengoat_agent_info\` with \`{"agentId":"${profile.agentId}"}\`.`,
    "- Use OpenGoat tools directly (`opengoat_*`), not shell CLI commands.",
    "- To delegate and coordinate work, use `og-*` skills.",
    "- Organization context is available in the `organization` folder - read them",
    "- You can view and edit the wiki in `organization/wiki`",
    "- If you need to use a repo, clone it or copy it into a new folder on your workspace `./<repo>`",
    "",
    "---",
    "",
    "_This file is yours to evolve. Update it as you learn your role and responsibilities in the organization._",
  ].join("\n");
}

function renderOpenGoatWorkspaceShim(): string {
  const cliEntrypoint = resolveOpenGoatCliEntrypoint();
  if (!cliEntrypoint) {
    return ["#!/usr/bin/env sh", "set -eu", "", 'exec opengoat "$@"'].join(
      "\n",
    );
  }

  return [
    "#!/usr/bin/env sh",
    "set -eu",
    "",
    `exec ${quoteForShell(process.execPath)} ${quoteForShell(
      cliEntrypoint,
    )} "$@"`,
  ].join("\n");
}

function resolveOpenGoatCliEntrypoint(): string | undefined {
  const explicit = process.env.OPENGOAT_CLI_ENTRYPOINT?.trim();
  if (explicit) {
    return normalizeEntrypointPath(explicit);
  }

  const argvEntrypoint = process.argv[1]?.trim();
  if (!argvEntrypoint) {
    return undefined;
  }

  const normalizedBasename = basename(argvEntrypoint).toLowerCase();
  if (!isLikelyOpenGoatEntrypointName(normalizedBasename)) {
    return undefined;
  }

  return normalizeEntrypointPath(argvEntrypoint);
}

function normalizeEntrypointPath(value: string): string {
  if (isAbsolute(value)) {
    return value;
  }
  return resolvePath(process.cwd(), value);
}

function isLikelyOpenGoatEntrypointName(value: string): boolean {
  return (
    value === "opengoat" || value === "opengoat.js" || value === "opengoat.mjs"
  );
}

function quoteForShell(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}
