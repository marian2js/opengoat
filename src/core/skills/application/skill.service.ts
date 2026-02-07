import os from "node:os";
import path from "node:path";
import { DEFAULT_AGENT_ID, normalizeAgentId } from "../../domain/agent-id.js";
import type { OpenGoatPaths } from "../../domain/opengoat-paths.js";
import type { FileSystemPort } from "../../ports/file-system.port.js";
import type { PathPort } from "../../ports/path.port.js";
import {
  type AgentSkillsConfig,
  type InstallSkillRequest,
  type InstallSkillResult,
  type ResolvedSkill,
  resolveSkillsConfig,
  type SkillsPromptResult
} from "../domain/skill.js";

interface SkillServiceDeps {
  fileSystem: FileSystemPort;
  pathPort: PathPort;
  pluginSkillDirsProvider?: (paths: OpenGoatPaths) => Promise<string[]>;
}

interface AgentConfigShape {
  runtime?: {
    skills?: AgentSkillsConfig;
  };
}

export class SkillService {
  private readonly fileSystem: FileSystemPort;
  private readonly pathPort: PathPort;
  private readonly pluginSkillDirsProvider?: (paths: OpenGoatPaths) => Promise<string[]>;

  public constructor(deps: SkillServiceDeps) {
    this.fileSystem = deps.fileSystem;
    this.pathPort = deps.pathPort;
    this.pluginSkillDirsProvider = deps.pluginSkillDirsProvider;
  }

  public async listSkills(
    paths: OpenGoatPaths,
    agentId = DEFAULT_AGENT_ID,
    runtimeConfig?: AgentSkillsConfig
  ): Promise<ResolvedSkill[]> {
    const normalizedAgentId = normalizeAgentId(agentId) || DEFAULT_AGENT_ID;
    const resolvedConfig = resolveSkillsConfig(
      runtimeConfig ?? (await this.readAgentSkillsConfig(paths, normalizedAgentId))
    );
    if (!resolvedConfig.enabled) {
      return [];
    }

    const discovered = await this.loadSkillsWithPrecedence(paths, normalizedAgentId, resolvedConfig);
    return [...discovered].sort((left, right) => left.id.localeCompare(right.id));
  }

  public async buildSkillsPrompt(
    paths: OpenGoatPaths,
    agentId = DEFAULT_AGENT_ID,
    runtimeConfig?: AgentSkillsConfig
  ): Promise<SkillsPromptResult> {
    const skills = await this.listSkills(paths, agentId, runtimeConfig);
    const resolvedConfig = resolveSkillsConfig(
      runtimeConfig ?? (await this.readAgentSkillsConfig(paths, normalizeAgentId(agentId) || DEFAULT_AGENT_ID))
    );
    if (!resolvedConfig.enabled) {
      return { prompt: "", skills: [] };
    }

    const selected: ResolvedSkill[] = [];
    let budgetUsed = 0;
    for (const skill of skills) {
      if (selected.length >= resolvedConfig.prompt.maxSkills) {
        break;
      }
      const content = resolvedConfig.prompt.includeContent
        ? clampText(skill.content, resolvedConfig.prompt.maxCharsPerSkill)
        : "";
      const estimatedChars =
        skill.name.length + skill.description.length + skill.skillFilePath.length + content.length + 150;
      if (budgetUsed + estimatedChars > resolvedConfig.prompt.maxTotalChars) {
        break;
      }
      budgetUsed += estimatedChars;
      selected.push({
        ...skill,
        content
      });
    }

    const lines: string[] = [
      "## Skills",
      "Before replying, inspect available skill summaries and decide whether one skill clearly applies.",
      "- If exactly one skill clearly applies, follow that skill.",
      "- If multiple skills could apply, choose the most specific.",
      "- If none apply, continue without using a skill.",
      "Self-install/update: create or edit `skills/<skill-id>/SKILL.md` in this workspace.",
      ""
    ];

    if (selected.length === 0) {
      lines.push("No installed skills were found for this agent.");
      return {
        prompt: lines.join("\n"),
        skills: []
      };
    }

    lines.push("<available_skills>");
    for (const skill of selected) {
      lines.push("  <skill>");
      lines.push(`    <id>${escapeXml(skill.id)}</id>`);
      lines.push(`    <name>${escapeXml(skill.name)}</name>`);
      lines.push(`    <description>${escapeXml(skill.description)}</description>`);
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
      skills: selected
    };
  }

  public async installSkill(paths: OpenGoatPaths, request: InstallSkillRequest): Promise<InstallSkillResult> {
    const normalizedAgentId = normalizeAgentId(request.agentId ?? DEFAULT_AGENT_ID) || DEFAULT_AGENT_ID;
    const skillId = normalizeAgentId(request.skillName);
    if (!skillId) {
      throw new Error("Skill name must contain at least one alphanumeric character.");
    }

    const workspaceSkillsDir = this.pathPort.join(paths.workspacesDir, normalizedAgentId, "skills");
    const targetDir = this.pathPort.join(workspaceSkillsDir, skillId);
    const targetSkillFile = this.pathPort.join(targetDir, "SKILL.md");
    const replaced = await this.fileSystem.exists(targetDir);

    await this.fileSystem.ensureDir(workspaceSkillsDir);

    if (request.sourcePath?.trim()) {
      const sourcePath = resolveUserPath(request.sourcePath.trim());
      const sourceSkillFile =
        sourcePath.toLowerCase().endsWith("/skill.md") || sourcePath.toLowerCase().endsWith("\\skill.md")
          ? sourcePath
          : this.pathPort.join(sourcePath, "SKILL.md");
      const sourceFileExists = await this.fileSystem.exists(sourceSkillFile);
      if (!sourceFileExists) {
        throw new Error(`Source skill not found: ${sourceSkillFile}`);
      }
      const sourceDir = sourceSkillFile === sourcePath ? path.dirname(sourcePath) : sourcePath;

      await this.fileSystem.removeDir(targetDir);
      await this.fileSystem.copyDir(sourceDir, targetDir);

      return {
        agentId: normalizedAgentId,
        skillId,
        skillName: request.skillName.trim(),
        source: "source-path",
        installedPath: targetSkillFile,
        replaced
      };
    }

    const managedDir = this.pathPort.join(paths.skillsDir, skillId);
    const managedSkillFile = this.pathPort.join(managedDir, "SKILL.md");
    if (await this.fileSystem.exists(managedSkillFile)) {
      await this.fileSystem.removeDir(targetDir);
      await this.fileSystem.copyDir(managedDir, targetDir);
      return {
        agentId: normalizedAgentId,
        skillId,
        skillName: request.skillName.trim(),
        source: "managed",
        installedPath: targetSkillFile,
        replaced
      };
    }

    const description = request.description?.trim() || `Skill instructions for ${request.skillName.trim()}.`;
    const content = request.content?.trim() || renderSkillMarkdown({ skillId, description });
    await this.fileSystem.ensureDir(targetDir);
    await this.fileSystem.writeFile(targetSkillFile, ensureTrailingNewline(content));

    return {
      agentId: normalizedAgentId,
      skillId,
      skillName: request.skillName.trim(),
      source: "generated",
      installedPath: targetSkillFile,
      replaced
    };
  }

  private async loadSkillsWithPrecedence(
    paths: OpenGoatPaths,
    agentId: string,
    config: ReturnType<typeof resolveSkillsConfig>
  ): Promise<ResolvedSkill[]> {
    const workspaceSkillsDir = this.pathPort.join(paths.workspacesDir, agentId, "skills");
    const pluginDirs = await this.resolvePluginSkillDirs(paths);
    const extraDirs = config.load.extraDirs.map(resolveUserPath);
    const sources: Array<{ source: ResolvedSkill["source"]; dir: string; enabled: boolean }> = [
      { source: "managed", dir: paths.skillsDir, enabled: config.includeManaged },
      ...pluginDirs.map((dir) => ({ source: "plugin" as const, dir, enabled: true })),
      ...extraDirs.map((dir) => ({ source: "extra" as const, dir, enabled: true })),
      { source: "workspace", dir: workspaceSkillsDir, enabled: config.includeWorkspace }
    ];

    const merged = new Map<string, ResolvedSkill>();
    for (const sourceEntry of sources) {
      if (!sourceEntry.enabled) {
        continue;
      }
      const loaded = await this.loadSkillsFromDirectory(sourceEntry.dir, sourceEntry.source);
      for (const skill of loaded) {
        merged.set(skill.id, skill);
      }
    }

    return [...merged.values()];
  }

  private async loadSkillsFromDirectory(baseDir: string, source: ResolvedSkill["source"]): Promise<ResolvedSkill[]> {
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

      const id = normalizeAgentId(parsed.frontmatter.name ?? directoryName) || normalizeAgentId(directoryName);
      if (!id) {
        continue;
      }

      loaded.push({
        id,
        name: parsed.frontmatter.name ?? humanizeSkillName(directoryName),
        description: parsed.frontmatter.description ?? summarizeSkillBody(parsed.body),
        source,
        skillDir,
        skillFilePath,
        content: parsed.body.trim(),
        frontmatter: parsed.frontmatter
      });
    }

    return loaded;
  }

  private async readAgentSkillsConfig(paths: OpenGoatPaths, agentId: string): Promise<AgentSkillsConfig | undefined> {
    const configPath = this.pathPort.join(paths.agentsDir, agentId, "config.json");
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

  private async resolvePluginSkillDirs(paths: OpenGoatPaths): Promise<string[]> {
    if (!this.pluginSkillDirsProvider) {
      return [];
    }

    try {
      const loaded = await this.pluginSkillDirsProvider(paths);
      return loaded.map((entry) => entry.trim()).filter(Boolean);
    } catch {
      return [];
    }
  }
}

function renderSkillMarkdown(params: { skillId: string; description: string }): string {
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
    "- Add constraints and safety checks here."
  ].join("\n");
}

function parseSkillMarkdown(content: string): {
  frontmatter: {
    name?: string;
    description?: string;
    enabled?: boolean;
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
