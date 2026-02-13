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
  renderBoardIndividualSkillMarkdown,
  renderBoardManagerSkillMarkdown,
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

interface WorkspaceSkillSyncResult {
  createdPaths: string[];
  skippedPaths: string[];
  removedPaths: string[];
}

interface RoleAssignmentSyncResult {
  updatedPaths: string[];
  skippedPaths: string[];
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
  ): Promise<CeoWorkspaceBootstrapResult> {
    const displayName = await this.readAgentDisplayName(paths, DEFAULT_AGENT_ID);
    const role = await this.readAgentRole(paths, DEFAULT_AGENT_ID);
    return this.ensureAgentWorkspaceBootstrap(paths, {
      agentId: DEFAULT_AGENT_ID,
      displayName,
      role,
    });
  }

  public async ensureAgentWorkspaceBootstrap(
    paths: OpenGoatPaths,
    input: AgentWorkspaceBootstrapInput,
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
    const createdPaths: string[] = [];
    const skippedPaths: string[] = [];
    const removedPaths: string[] = [];

    await this.ensureDirectory(workspaceDir, createdPaths, skippedPaths);

    await this.rewriteAgentsMarkdown(
      agentsPath,
      normalizedAgentId,
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
    );
    createdPaths.push(...workspaceSkillSync.createdPaths);
    skippedPaths.push(...workspaceSkillSync.skippedPaths);
    removedPaths.push(...workspaceSkillSync.removedPaths);

    if (await this.fileSystem.exists(bootstrapPath)) {
      await this.fileSystem.removeDir(bootstrapPath);
      removedPaths.push(bootstrapPath);
    } else {
      skippedPaths.push(bootstrapPath);
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
  ): Promise<WorkspaceSkillSyncResult> {
    const normalizedAgentId = normalizeAgentId(agentId);
    if (!normalizedAgentId) {
      throw new Error("Agent id cannot be empty.");
    }
    const type = await this.readAgentType(paths, normalizedAgentId);
    const requiredSkillIds =
      type === "manager" ? MANAGER_ROLE_SKILLS : INDIVIDUAL_ROLE_SKILLS;
    const managedRoleSkillIds = [
      ...new Set([...MANAGER_ROLE_SKILLS, ...INDIVIDUAL_ROLE_SKILLS]),
    ];
    const workspaceDir = this.pathPort.join(
      paths.workspacesDir,
      normalizedAgentId,
    );
    const skillsDir = this.pathPort.join(workspaceDir, "skills");
    const createdPaths: string[] = [];
    const skippedPaths: string[] = [];
    const removedPaths: string[] = [];

    await this.ensureDirectory(workspaceDir, createdPaths, skippedPaths);
    await this.ensureDirectory(skillsDir, createdPaths, skippedPaths);

    for (const skillId of requiredSkillIds) {
      const skillDir = this.pathPort.join(skillsDir, skillId);
      const skillFile = this.pathPort.join(skillDir, "SKILL.md");
      await this.ensureDirectory(skillDir, createdPaths, skippedPaths);
      await this.writeMarkdown(
        skillFile,
        this.renderWorkspaceSkill(skillId),
        createdPaths,
        skippedPaths,
        { overwrite: true },
      );
    }

    for (const skillId of managedRoleSkillIds) {
      if (requiredSkillIds.includes(skillId)) {
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
    const requiredSkillIds =
      type === "manager" ? MANAGER_ROLE_SKILLS : INDIVIDUAL_ROLE_SKILLS;
    const roleSkillIds = new Set<string>([
      ...MANAGER_ROLE_SKILLS,
      ...INDIVIDUAL_ROLE_SKILLS,
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
    _agentId: string,
    createdPaths: string[],
    skippedPaths: string[],
  ): Promise<void> {
    const exists = await this.fileSystem.exists(filePath);
    if (!exists) {
      skippedPaths.push(filePath);
      return;
    }

    const source = await this.fileSystem.readFile(filePath);
    const next = replaceFirstRunSection(source);
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

  private renderWorkspaceSkill(skillId: string): string {
    if (skillId === "board-manager") {
      return renderBoardManagerSkillMarkdown();
    }
    if (skillId === "board-individual") {
      return renderBoardIndividualSkillMarkdown();
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

const MANAGER_ROLE_SKILLS = ["board-manager"];
const INDIVIDUAL_ROLE_SKILLS = ["board-individual"];

function toAgentTemplateOptions(
  agentId: string,
  options: EnsureAgentOptions,
): AgentTemplateOptions {
  const type =
    options.type ?? (isDefaultAgentId(agentId) ? "manager" : "individual");
  const reportsTo = resolveReportsTo(agentId, options.reportsTo);
  const providedSkills = options.skills ?? [];
  const roleSkillIds = new Set([...MANAGER_ROLE_SKILLS, ...INDIVIDUAL_ROLE_SKILLS]);
  const skills = dedupe(providedSkills.filter((skillId) => !roleSkillIds.has(skillId)));
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

function replaceFirstRunSection(markdown: string): string {
  const lineBreak = markdown.includes("\r\n") ? "\r\n" : "\n";
  const lines = markdown.split(/\r?\n/);
  const hasTrailingLineBreak = /\r?\n$/.test(markdown);
  const kept: string[] = [];
  let skipping = false;
  let replaced = false;
  const replacementLines = [
    "## Your Role",
    "",
    "You are part of an organization run by AI agents. Read `ROLE.md` for details.",
    "",
  ];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!skipping && /^##\s+first run\s*$/i.test(trimmed)) {
      skipping = true;
      replaced = true;
      kept.push(...replacementLines);
      continue;
    }
    if (skipping) {
      if (/^##\s+/.test(trimmed)) {
        skipping = false;
        kept.push(line);
      }
      continue;
    }
    kept.push(line);
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
    `- For info about your level on the organiztion, run \`opengoat agent info ${profile.agentId}\`.`,
    "",
    "---",
    "",
    "_This file is yours to evolve. Update it as you learn your role and responsibilities in the organization._",
  ].join("\n");
}
