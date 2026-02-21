import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { BOARD_MANAGER_SKILL_ID } from "../../agents/domain/agent-manifest.js";
import { DEFAULT_AGENT_ID, normalizeAgentId } from "../../domain/agent-id.js";
import type { OpenGoatPaths } from "../../domain/opengoat-paths.js";
import type { CommandRunnerPort } from "../../ports/command-runner.port.js";
import type { FileSystemPort } from "../../ports/file-system.port.js";
import type { PathPort } from "../../ports/path.port.js";
import {
  resolveSkillsConfig,
  type AgentSkillsConfig,
  type InstallSkillRequest,
  type InstallSkillResult,
  type ResolvedSkill,
  type SkillScope,
  type SkillsPromptResult,
} from "../domain/skill.js";

interface SkillServiceDeps {
  fileSystem: FileSystemPort;
  pathPort: PathPort;
  commandRunner?: CommandRunnerPort;
}

interface AgentSkillInstallOptions {
  workspaceDir?: string;
  workspaceSkillDirectories?: string[];
}

interface ResolvedInstallSource {
  sourceDir: string;
  source: "source-path" | "source-url";
  cleanup?: () => Promise<void>;
}

interface AgentConfigShape {
  organization?: {
    type?: "manager" | "individual";
    [key: string]: unknown;
  };
  runtime?: {
    skills?: AgentSkillsConfig;
  };
  [key: string]: unknown;
}

export class SkillService {
  private readonly fileSystem: FileSystemPort;
  private readonly pathPort: PathPort;
  private readonly commandRunner?: CommandRunnerPort;

  public constructor(deps: SkillServiceDeps) {
    this.fileSystem = deps.fileSystem;
    this.pathPort = deps.pathPort;
    this.commandRunner = deps.commandRunner;
  }

  public async listSkills(
    paths: OpenGoatPaths,
    agentId = DEFAULT_AGENT_ID,
    runtimeConfig?: AgentSkillsConfig,
  ): Promise<ResolvedSkill[]> {
    const normalizedAgentId = normalizeAgentId(agentId) || DEFAULT_AGENT_ID;
    const resolvedConfig = resolveSkillsConfig(
      runtimeConfig ??
        (await this.readAgentSkillsConfig(paths, normalizedAgentId)),
    );
    if (!resolvedConfig.enabled) {
      return [];
    }

    const discovered = await this.loadSkillsWithPrecedence(
      paths,
      resolvedConfig,
    );
    const assigned = new Set(resolvedConfig.assigned);
    const filtered =
      assigned.size > 0
        ? discovered.filter((skill) => assigned.has(skill.id))
        : discovered;
    return [...filtered].sort((left, right) => left.id.localeCompare(right.id));
  }

  public async listGlobalSkills(
    paths: OpenGoatPaths,
  ): Promise<ResolvedSkill[]> {
    const loaded = await this.loadSkillsFromDirectory(
      paths.skillsDir,
      "managed",
    );
    return loaded.sort((left, right) => left.id.localeCompare(right.id));
  }

  public async buildSkillsPrompt(
    paths: OpenGoatPaths,
    agentId = DEFAULT_AGENT_ID,
    runtimeConfig?: AgentSkillsConfig,
  ): Promise<SkillsPromptResult> {
    const skills = await this.listSkills(paths, agentId, runtimeConfig);
    const resolvedConfig = resolveSkillsConfig(
      runtimeConfig ??
        (await this.readAgentSkillsConfig(
          paths,
          normalizeAgentId(agentId) || DEFAULT_AGENT_ID,
        )),
    );
    if (!resolvedConfig.enabled) {
      return { prompt: "", skills: [] };
    }

    const selected: ResolvedSkill[] = [];
    let budgetUsed = 0;
    for (const skill of skills.filter(
      (entry) => entry.frontmatter.disableModelInvocation !== true,
    )) {
      if (selected.length >= resolvedConfig.prompt.maxSkills) {
        break;
      }
      const content = resolvedConfig.prompt.includeContent
        ? clampText(skill.content, resolvedConfig.prompt.maxCharsPerSkill)
        : "";
      const estimatedChars =
        skill.name.length +
        skill.description.length +
        skill.skillFilePath.length +
        content.length +
        150;
      if (budgetUsed + estimatedChars > resolvedConfig.prompt.maxTotalChars) {
        break;
      }
      budgetUsed += estimatedChars;
      selected.push({
        ...skill,
        content,
      });
    }

    const lines: string[] = [
      "## Skills",
      "Before replying, inspect available skill summaries and decide whether one skill clearly applies.",
      "- If exactly one skill clearly applies, follow that skill.",
      "- If multiple skills could apply, choose the most specific.",
      "- If none apply, continue without using a skill.",
      "Skill definitions are centralized under the global skills store.",
      "",
    ];

    if (selected.length === 0) {
      lines.push("No installed skills were found for this agent.");
      return {
        prompt: lines.join("\n"),
        skills: [],
      };
    }

    lines.push("<available_skills>");
    for (const skill of selected) {
      lines.push("  <skill>");
      lines.push(`    <id>${escapeXml(skill.id)}</id>`);
      lines.push(`    <name>${escapeXml(skill.name)}</name>`);
      lines.push(
        `    <description>${escapeXml(skill.description)}</description>`,
      );
      lines.push(`    <location>${escapeXml(skill.skillFilePath)}</location>`);
      lines.push(`    <source>${skill.source}</source>`);
      if (resolvedConfig.prompt.includeContent && skill.content.trim()) {
        lines.push("    <content>");
        lines.push(indentMultiline(skill.content, 6));
        lines.push("    </content>");
      }
      lines.push("  </skill>");
    }
    lines.push("</available_skills>");

    return {
      prompt: lines.join("\n"),
      skills: selected,
    };
  }

  public async installSkill(
    paths: OpenGoatPaths,
    request: InstallSkillRequest,
    options: AgentSkillInstallOptions = {},
  ): Promise<InstallSkillResult> {
    const hasSourcePath = Boolean(request.sourcePath?.trim());
    const hasSourceUrl = Boolean(request.sourceUrl?.trim());
    if (hasSourcePath && hasSourceUrl) {
      throw new Error("Use either sourcePath or sourceUrl, not both.");
    }

    const scope: SkillScope = request.scope === "global" ? "global" : "agent";
    const normalizedAgentId =
      normalizeAgentId(request.agentId ?? DEFAULT_AGENT_ID) || DEFAULT_AGENT_ID;
    const requestedSkillName =
      request.skillName?.trim() || request.sourceSkillName?.trim();
    const skillId = normalizeAgentId(requestedSkillName ?? "");
    if (!skillId) {
      throw new Error(
        "Skill name must contain at least one alphanumeric character.",
      );
    }

    const baseDir = paths.skillsDir;
    const targetDir = this.pathPort.join(baseDir, skillId);
    const targetSkillFile = this.pathPort.join(targetDir, "SKILL.md");
    const replaced = await this.fileSystem.exists(targetDir);

    await this.fileSystem.ensureDir(baseDir);

    let workspaceInstallPaths: string[] = [];

    if (hasSourcePath || hasSourceUrl) {
      let resolvedSource: ResolvedInstallSource | undefined;
      try {
        resolvedSource = hasSourcePath
          ? await this.resolveInstallSourceFromPath(
              request.sourcePath?.trim() ?? "",
            )
          : await this.resolveInstallSourceFromUrl(
              paths,
              request.sourceUrl?.trim() ?? "",
              request.sourceSkillName,
              skillId,
            );

        await this.fileSystem.removeDir(targetDir);
        await this.fileSystem.copyDir(resolvedSource.sourceDir, targetDir);
      } finally {
        if (resolvedSource?.cleanup) {
          await resolvedSource.cleanup();
        }
      }

      if (scope === "agent") {
        workspaceInstallPaths = await this.installSkillForAgent(
          paths,
          normalizedAgentId,
          skillId,
          options,
        );
      }

      return {
        scope,
        agentId: scope === "agent" ? normalizedAgentId : undefined,
        assignedAgentIds: scope === "agent" ? [normalizedAgentId] : undefined,
        skillId,
        skillName: requestedSkillName ?? skillId,
        source: hasSourcePath ? "source-path" : "source-url",
        installedPath: targetSkillFile,
        workspaceInstallPaths,
        replaced,
      };
    }

    let source: InstallSkillResult["source"] = "generated";
    const existingGlobalSkill = this.pathPort.join(
      paths.skillsDir,
      skillId,
      "SKILL.md",
    );
    if (
      scope === "agent" &&
      (await this.fileSystem.exists(existingGlobalSkill))
    ) {
      source = "managed";
    } else {
      const description =
        request.description?.trim() ||
        `Skill instructions for ${requestedSkillName ?? skillId}.`;
      const content =
        request.content?.trim() ||
        renderSkillMarkdown({ skillId, description });
      await this.fileSystem.ensureDir(targetDir);
      await this.fileSystem.writeFile(
        targetSkillFile,
        ensureTrailingNewline(content),
      );
      source = "generated";
    }

    if (scope === "agent") {
      workspaceInstallPaths = await this.installSkillForAgent(
        paths,
        normalizedAgentId,
        skillId,
        options,
      );
    }

    return {
      scope,
      agentId: scope === "agent" ? normalizedAgentId : undefined,
      assignedAgentIds: scope === "agent" ? [normalizedAgentId] : undefined,
      skillId,
      skillName: requestedSkillName ?? skillId,
      source,
      installedPath: targetSkillFile,
      workspaceInstallPaths,
      replaced,
    };
  }

  public async assignInstalledSkillToAgent(
    paths: OpenGoatPaths,
    agentId: string,
    skillId: string,
    options: AgentSkillInstallOptions = {},
  ): Promise<string[]> {
    const normalizedAgentId = normalizeAgentId(agentId) || DEFAULT_AGENT_ID;
    const normalizedSkillId = normalizeAgentId(skillId);
    if (!normalizedSkillId) {
      throw new Error(
        "Skill id must contain at least one alphanumeric character.",
      );
    }

    const sourceSkillFile = this.pathPort.join(
      paths.skillsDir,
      normalizedSkillId,
      "SKILL.md",
    );
    if (!(await this.fileSystem.exists(sourceSkillFile))) {
      throw new Error(
        `Skill "${normalizedSkillId}" is not installed in global storage.`,
      );
    }

    return this.installSkillForAgent(
      paths,
      normalizedAgentId,
      normalizedSkillId,
      options,
    );
  }

  private async installSkillForAgent(
    paths: OpenGoatPaths,
    agentId: string,
    skillId: string,
    options: AgentSkillInstallOptions,
  ): Promise<string[]> {
    await this.assignSkillToAgent(paths, agentId, skillId);
    await this.reconcileRoleSkillsIfNeeded(paths, agentId, skillId);
    return this.syncSkillToWorkspace(paths, agentId, skillId, options);
  }

  private async syncSkillToWorkspace(
    paths: OpenGoatPaths,
    agentId: string,
    skillId: string,
    options: AgentSkillInstallOptions,
  ): Promise<string[]> {
    const workspaceDir =
      options.workspaceDir?.trim() ||
      this.pathPort.join(paths.workspacesDir, agentId);
    const normalizedDirectories = normalizeWorkspaceSkillDirectories(
      options.workspaceSkillDirectories,
    );
    if (normalizedDirectories.length === 0) {
      return [];
    }

    const sourceSkillDir = this.pathPort.join(paths.skillsDir, skillId);
    if (!(await this.fileSystem.exists(sourceSkillDir))) {
      return [];
    }

    const installedPaths: string[] = [];
    for (const relativeSkillsDir of normalizedDirectories) {
      const skillsDir = this.pathPort.join(workspaceDir, relativeSkillsDir);
      const targetSkillDir = this.pathPort.join(skillsDir, skillId);
      await this.fileSystem.ensureDir(skillsDir);
      await this.fileSystem.removeDir(targetSkillDir);
      await this.fileSystem.copyDir(sourceSkillDir, targetSkillDir);
      installedPaths.push(this.pathPort.join(targetSkillDir, "SKILL.md"));
    }

    return installedPaths;
  }

  private async resolveInstallSourceFromPath(
    sourcePathInput: string,
  ): Promise<ResolvedInstallSource> {
    const sourcePath = resolveUserPath(sourcePathInput);
    const sourceSkillFile =
      sourcePath.toLowerCase().endsWith("/skill.md") ||
      sourcePath.toLowerCase().endsWith("\\skill.md")
        ? sourcePath
        : this.pathPort.join(sourcePath, "SKILL.md");
    const sourceFileExists = await this.fileSystem.exists(sourceSkillFile);
    if (!sourceFileExists) {
      throw new Error(`Source skill not found: ${sourceSkillFile}`);
    }
    const sourceDir =
      sourceSkillFile === sourcePath ? path.dirname(sourcePath) : sourcePath;
    return {
      sourceDir,
      source: "source-path",
    };
  }

  private async resolveInstallSourceFromUrl(
    paths: OpenGoatPaths,
    sourceUrl: string,
    sourceSkillName: string | undefined,
    fallbackSkillId: string,
  ): Promise<ResolvedInstallSource> {
    if (!this.commandRunner) {
      throw new Error(
        "Installing skills from URL requires a configured command runner.",
      );
    }

    const resolvedUrl = sourceUrl.trim();
    if (!resolvedUrl) {
      throw new Error("sourceUrl cannot be empty.");
    }

    const tempRoot = this.pathPort.join(
      paths.homeDir,
      ".tmp",
      "skill-installs",
      randomUUID(),
    );
    const cloneDir = this.pathPort.join(tempRoot, "repo");
    await this.fileSystem.ensureDir(tempRoot);

    const cloneSource = stripGitHubTreePath(resolvedUrl);
    const cloneResult = await this.commandRunner.run({
      command: "git",
      args: ["clone", "--depth", "1", cloneSource, cloneDir],
      cwd: paths.homeDir,
    });
    if (cloneResult.code !== 0) {
      throw new Error(
        `Unable to clone skill source URL "${resolvedUrl}". ${
          cloneResult.stderr.trim() || cloneResult.stdout.trim() || ""
        }`.trim(),
      );
    }

    const pathHint = resolveGitHubTreePathHint(resolvedUrl);
    const skillHint = sourceSkillName?.trim() || fallbackSkillId;
    const resolvedSkillDir = await this.resolveRepositorySkillDirectory(
      cloneDir,
      skillHint,
      pathHint,
    );

    return {
      sourceDir: resolvedSkillDir,
      source: "source-url",
      cleanup: async () => {
        await this.fileSystem.removeDir(tempRoot);
      },
    };
  }

  private async resolveRepositorySkillDirectory(
    repositoryDir: string,
    skillHint: string,
    pathHint?: string,
  ): Promise<string> {
    const normalizedSkillHint = normalizeAgentId(skillHint);
    const normalizedPathHint = normalizeRelativeDirectory(pathHint);

    if (normalizedPathHint) {
      const hinted = this.pathPort.join(repositoryDir, normalizedPathHint);
      const hintedSkillFile = this.pathPort.join(hinted, "SKILL.md");
      if (await this.fileSystem.exists(hintedSkillFile)) {
        return hinted;
      }
    }

    if (normalizedSkillHint) {
      const candidateRelativePaths = [
        normalizedSkillHint,
        `skills/${normalizedSkillHint}`,
        `.claude/skills/${normalizedSkillHint}`,
        ".claude-plugin/skills/" + normalizedSkillHint,
        ".agents/skills/" + normalizedSkillHint,
        ".agent/skills/" + normalizedSkillHint,
        ".cursor/skills/" + normalizedSkillHint,
        ".copilot/skills/" + normalizedSkillHint,
        ".opencode/skills/" + normalizedSkillHint,
        ".gemini/skills/" + normalizedSkillHint,
      ];
      for (const relativeCandidate of candidateRelativePaths) {
        const candidate = this.pathPort.join(repositoryDir, relativeCandidate);
        const candidateSkillFile = this.pathPort.join(candidate, "SKILL.md");
        if (await this.fileSystem.exists(candidateSkillFile)) {
          return candidate;
        }
      }
    }

    const discovered = await this.discoverSkillDirectories(repositoryDir, 0, 7);
    if (normalizedSkillHint) {
      const matched = discovered.find((directoryPath) => {
        const relativePath = path
          .relative(repositoryDir, directoryPath)
          .replace(/\\/g, "/");
        const directoryName = path.basename(directoryPath).trim();
        return (
          normalizeAgentId(directoryName) === normalizedSkillHint ||
          normalizeAgentId(relativePath) === normalizedSkillHint
        );
      });
      if (matched) {
        return matched;
      }
    }

    if (discovered.length === 1) {
      return discovered[0] as string;
    }

    if (discovered.length === 0) {
      throw new Error(
        "No valid SKILL.md definitions were found in the source URL.",
      );
    }

    const available = discovered
      .slice(0, 10)
      .map((directoryPath) => path.relative(repositoryDir, directoryPath))
      .join(", ");
    throw new Error(
      `Multiple skills were found in the source URL. Specify sourceSkillName. Available candidates: ${available}`,
    );
  }

  private async discoverSkillDirectories(
    rootDir: string,
    depth: number,
    maxDepth: number,
  ): Promise<string[]> {
    if (depth > maxDepth) {
      return [];
    }

    const skillFile = this.pathPort.join(rootDir, "SKILL.md");
    const found: string[] = [];
    if (await this.fileSystem.exists(skillFile)) {
      found.push(rootDir);
    }

    const childDirectories = await this.fileSystem.listDirectories(rootDir);
    for (const childDirectory of childDirectories) {
      if (!childDirectory || childDirectory.startsWith(".git")) {
        continue;
      }
      const childPath = this.pathPort.join(rootDir, childDirectory);
      const nested = await this.discoverSkillDirectories(
        childPath,
        depth + 1,
        maxDepth,
      );
      found.push(...nested);
    }

    return dedupe(found).sort((left, right) => left.localeCompare(right));
  }

  private async loadSkillsWithPrecedence(
    paths: OpenGoatPaths,
    config: ReturnType<typeof resolveSkillsConfig>,
  ): Promise<ResolvedSkill[]> {
    const extraDirs = config.load.extraDirs.map(resolveUserPath);
    const sources: Array<{
      source: ResolvedSkill["source"];
      dir: string;
      enabled: boolean;
    }> = [
      {
        source: "managed",
        dir: paths.skillsDir,
        enabled: config.includeManaged,
      },
      ...extraDirs.map((dir) => ({
        source: "extra" as const,
        dir,
        enabled: true,
      })),
    ];

    const merged = new Map<string, ResolvedSkill>();
    for (const sourceEntry of sources) {
      if (!sourceEntry.enabled) {
        continue;
      }
      const loaded = await this.loadSkillsFromDirectory(
        sourceEntry.dir,
        sourceEntry.source,
      );
      for (const skill of loaded) {
        merged.set(skill.id, skill);
      }
    }

    return [...merged.values()];
  }

  private async loadSkillsFromDirectory(
    baseDir: string,
    source: ResolvedSkill["source"],
  ): Promise<ResolvedSkill[]> {
    const skillDirs = await this.fileSystem.listDirectories(baseDir);
    const loaded: ResolvedSkill[] = [];

    for (const directoryName of skillDirs) {
      const skillDir = this.pathPort.join(baseDir, directoryName);
      const skillFilePath = this.pathPort.join(skillDir, "SKILL.md");
      const exists = await this.fileSystem.exists(skillFilePath);
      if (!exists) {
        continue;
      }

      let raw = "";
      try {
        raw = await this.fileSystem.readFile(skillFilePath);
      } catch {
        continue;
      }

      const parsed = parseSkillMarkdown(raw);
      if (parsed.frontmatter.enabled === false) {
        continue;
      }

      const id =
        normalizeAgentId(parsed.frontmatter.name ?? directoryName) ||
        normalizeAgentId(directoryName);
      if (!id) {
        continue;
      }

      loaded.push({
        id,
        name: parsed.frontmatter.name ?? humanizeSkillName(directoryName),
        description:
          parsed.frontmatter.description ?? summarizeSkillBody(parsed.body),
        source,
        skillDir,
        skillFilePath,
        content: parsed.body.trim(),
        frontmatter: parsed.frontmatter,
      });
    }

    return loaded;
  }

  private async readAgentSkillsConfig(
    paths: OpenGoatPaths,
    agentId: string,
  ): Promise<AgentSkillsConfig | undefined> {
    const configPath = this.pathPort.join(
      paths.agentsDir,
      agentId,
      "config.json",
    );
    if (!(await this.fileSystem.exists(configPath))) {
      return undefined;
    }

    try {
      const raw = await this.fileSystem.readFile(configPath);
      const parsed = JSON.parse(raw) as AgentConfigShape;
      return parsed.runtime?.skills;
    } catch {
      return undefined;
    }
  }

  private async assignSkillToAgent(
    paths: OpenGoatPaths,
    agentId: string,
    skillId: string,
  ): Promise<void> {
    const configPath = this.pathPort.join(
      paths.agentsDir,
      agentId,
      "config.json",
    );
    if (!(await this.fileSystem.exists(configPath))) {
      return;
    }

    const raw = await this.fileSystem.readFile(configPath);
    const parsed = JSON.parse(raw) as AgentConfigShape;
    const runtimeRecord =
      parsed.runtime &&
      typeof parsed.runtime === "object" &&
      !Array.isArray(parsed.runtime)
        ? (parsed.runtime as Record<string, unknown>)
        : {};
    const skillsRecord =
      runtimeRecord.skills &&
      typeof runtimeRecord.skills === "object" &&
      !Array.isArray(runtimeRecord.skills)
        ? (runtimeRecord.skills as Record<string, unknown>)
        : {};
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
    if (!assigned.includes(skillId)) {
      assigned.push(skillId);
    }

    skillsRecord.assigned = assigned;
    runtimeRecord.skills = skillsRecord;
    parsed.runtime = runtimeRecord as AgentConfigShape["runtime"];
    await this.fileSystem.writeFile(
      configPath,
      `${JSON.stringify(parsed, null, 2)}\n`,
    );
  }

  private async reconcileRoleSkillsIfNeeded(
    paths: OpenGoatPaths,
    agentId: string,
    skillId: string,
  ): Promise<void> {
    const normalizedSkill = skillId.trim().toLowerCase();
    if (!ROLE_SKILL_IDS.has(normalizedSkill)) {
      return;
    }

    const configPath = this.pathPort.join(
      paths.agentsDir,
      agentId,
      "config.json",
    );
    if (!(await this.fileSystem.exists(configPath))) {
      return;
    }

    const raw = await this.fileSystem.readFile(configPath);
    const parsed = JSON.parse(raw) as AgentConfigShape;
    const organizationRecord =
      parsed.organization &&
      typeof parsed.organization === "object" &&
      !Array.isArray(parsed.organization)
        ? (parsed.organization as Record<string, unknown>)
        : {};
    const runtimeRecord =
      parsed.runtime &&
      typeof parsed.runtime === "object" &&
      !Array.isArray(parsed.runtime)
        ? (parsed.runtime as Record<string, unknown>)
        : {};
    const skillsRecord =
      runtimeRecord.skills &&
      typeof runtimeRecord.skills === "object" &&
      !Array.isArray(runtimeRecord.skills)
        ? (runtimeRecord.skills as Record<string, unknown>)
        : {};
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

    if (
      normalizedSkill === BOARD_MANAGER_SKILL_ID ||
      normalizedSkill === LEGACY_BOARD_MANAGER_SKILL_ID
    ) {
      organizationRecord.type = "manager";
    } else if (
      normalizedSkill === BOARD_INDIVIDUAL_SKILL_ID ||
      normalizedSkill === LEGACY_BOARD_INDIVIDUAL_SKILL_ID
    ) {
      organizationRecord.type = "individual";
    }

    // Role skills live in OpenClaw workspace skill folders, not local assigned metadata.
    skillsRecord.assigned = assigned.filter(
      (entry) => !ROLE_SKILL_IDS.has(entry),
    );

    runtimeRecord.skills = skillsRecord;
    parsed.runtime = runtimeRecord as AgentConfigShape["runtime"];
    parsed.organization =
      organizationRecord as AgentConfigShape["organization"];
    await this.fileSystem.writeFile(
      configPath,
      `${JSON.stringify(parsed, null, 2)}\n`,
    );
  }
}

const BOARD_INDIVIDUAL_SKILL_ID = "og-board-individual";
const BOARDS_SKILL_ID = "og-boards";
const LEGACY_BOARD_MANAGER_SKILL_ID = "board-manager";
const LEGACY_BOARD_INDIVIDUAL_SKILL_ID = "board-individual";
const ROLE_SKILL_IDS = new Set([
  BOARDS_SKILL_ID,
  BOARD_MANAGER_SKILL_ID,
  BOARD_INDIVIDUAL_SKILL_ID,
  LEGACY_BOARD_MANAGER_SKILL_ID,
  LEGACY_BOARD_INDIVIDUAL_SKILL_ID,
]);

function renderSkillMarkdown(params: {
  skillId: string;
  description: string;
}): string {
  return [
    "---",
    `name: ${humanizeSkillName(params.skillId)}`,
    `description: ${params.description}`,
    "---",
    "",
    `# ${humanizeSkillName(params.skillId)}`,
    "",
    "## When to Use",
    "- Describe when this skill should be applied.",
    "",
    "## Instructions",
    "- Add explicit step-by-step guidance here.",
    "",
    "## Constraints",
    "- Add constraints and safety checks here.",
  ].join("\n");
}

function parseSkillMarkdown(content: string): {
  frontmatter: {
    name?: string;
    description?: string;
    enabled?: boolean;
    userInvocable?: boolean;
    disableModelInvocation?: boolean;
  };
  body: string;
} {
  const lines = content.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") {
    return { frontmatter: {}, body: content };
  }

  let index = 1;
  const frontmatterLines: string[] = [];
  while (index < lines.length && lines[index]?.trim() !== "---") {
    frontmatterLines.push(lines[index] ?? "");
    index += 1;
  }

  if (index >= lines.length) {
    return { frontmatter: {}, body: content };
  }

  const frontmatter: {
    name?: string;
    description?: string;
    enabled?: boolean;
    userInvocable?: boolean;
    disableModelInvocation?: boolean;
  } = {};
  for (const line of frontmatterLines) {
    const separator = line.indexOf(":");
    if (separator <= 0) {
      continue;
    }
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === "name" && value) {
      frontmatter.name = value;
      continue;
    }
    if (key === "description" && value) {
      frontmatter.description = value;
      continue;
    }
    if (key === "enabled") {
      const normalized = value.toLowerCase();
      if (normalized === "true") {
        frontmatter.enabled = true;
      } else if (normalized === "false") {
        frontmatter.enabled = false;
      }
      continue;
    }
    if (key === "user-invocable" || key === "user_invocable") {
      const normalized = value.toLowerCase();
      if (normalized === "true") {
        frontmatter.userInvocable = true;
      } else if (normalized === "false") {
        frontmatter.userInvocable = false;
      }
      continue;
    }
    if (
      key === "disable-model-invocation" ||
      key === "disable_model_invocation"
    ) {
      const normalized = value.toLowerCase();
      if (normalized === "true") {
        frontmatter.disableModelInvocation = true;
      } else if (normalized === "false") {
        frontmatter.disableModelInvocation = false;
      }
    }
  }

  const body = lines.slice(index + 1).join("\n");
  return { frontmatter, body };
}

function summarizeSkillBody(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) {
    return "No description provided.";
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const descriptive =
    lines.find((line) => !line.startsWith("#")) ??
    lines[0] ??
    "No description provided.";

  return clampText(descriptive, 180);
}

function humanizeSkillName(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function clampText(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, Math.max(1, maxChars - 3))}...`;
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function resolveUserPath(value: string): string {
  if (value === "~") {
    return os.homedir();
  }
  if (value.startsWith("~/")) {
    return path.join(os.homedir(), value.slice(2));
  }
  return path.resolve(value);
}

function normalizeWorkspaceSkillDirectories(
  input: string[] | undefined,
): string[] {
  if (!Array.isArray(input) || input.length === 0) {
    return [];
  }

  const directories: string[] = [];
  for (const candidate of input) {
    const normalized = normalizeRelativeDirectory(candidate);
    if (!normalized || directories.includes(normalized)) {
      continue;
    }
    directories.push(normalized);
  }
  return directories;
}

function normalizeRelativeDirectory(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
  if (!normalized || normalized.startsWith("..")) {
    return null;
  }

  const parts = normalized
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0 || parts.includes("..")) {
    return null;
  }

  return parts.join("/");
}

function stripGitHubTreePath(sourceUrl: string): string {
  try {
    const parsed = new URL(sourceUrl);
    if (parsed.hostname !== "github.com") {
      return sourceUrl;
    }

    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length >= 4 && segments[2] === "tree") {
      const owner = segments[0];
      const repo = segments[1]?.replace(/\.git$/i, "");
      if (owner && repo) {
        return `https://github.com/${owner}/${repo}.git`;
      }
    }
    return sourceUrl;
  } catch {
    return sourceUrl;
  }
}

function resolveGitHubTreePathHint(sourceUrl: string): string | undefined {
  try {
    const parsed = new URL(sourceUrl);
    if (parsed.hostname !== "github.com") {
      return undefined;
    }
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length <= 4 || segments[2] !== "tree") {
      return undefined;
    }
    const relativeSegments = segments.slice(4);
    if (relativeSegments.length === 0) {
      return undefined;
    }
    return relativeSegments.join("/");
  } catch {
    return undefined;
  }
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function indentMultiline(value: string, spaces: number): string {
  const indent = " ".repeat(Math.max(0, spaces));
  return value
    .split(/\r?\n/)
    .map((line) => `${indent}${line}`)
    .join("\n");
}
