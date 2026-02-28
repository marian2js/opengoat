import { readdirSync, readFileSync } from "node:fs";
import { DEFAULT_AGENT_ID, isDefaultAgentId, normalizeAgentId } from "../domain/agent-id.js";
import type { AgentIdentity } from "../domain/agent.js";
import type { AgentsIndex, OpenGoatConfig } from "../domain/opengoat-paths.js";

export { DEFAULT_AGENT_ID } from "../domain/agent-id.js";

export interface AgentTemplateOptions {
  type?: "manager" | "individual";
  reportsTo?: string | null;
  skills?: string[];
  role?: string;
}

export interface OrganizationMarkdownTemplate {
  fileName: string;
  content: string;
}

export interface AgentWorkspaceTemplate {
  fileName: string;
  content: string;
}

const ROLE_SKILLS: Record<"manager" | "individual", string[]> = {
  manager: [],
  individual: [],
};

export function renderGlobalConfig(nowIso: string): OpenGoatConfig {
  return {
    schemaVersion: 1,
    defaultAgent: DEFAULT_AGENT_ID,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export function renderAgentsIndex(
  nowIso: string,
  agents: string[],
): AgentsIndex {
  return {
    schemaVersion: 1,
    agents,
    updatedAt: nowIso,
  };
}

export function renderCeoRoleMarkdown(): string {
  return readTemplateContent("agents/goat/ROLE.md");
}

export function renderCeoBootstrapMarkdown(): string {
  return readTemplateContent("agents/goat/BOOTSTRAP.md");
}

export function renderBoardsSkillMarkdown(
  skillId: string,
  agentId: string,
): string {
  const resolvedAgentId = normalizeAgentId(agentId) || DEFAULT_AGENT_ID;
  const normalizedSkillId = skillId.trim().toLowerCase();
  const templatePath =
    normalizedSkillId === "og-board-manager"
      ? "skills/og-board-manager/SKILL.md"
      : normalizedSkillId === "og-board-individual"
        ? "skills/og-board-individual/SKILL.md"
        : "skills/og-boards/SKILL.md";
  return readTemplateContent(templatePath).replaceAll("<me>", resolvedAgentId);
}

export function listOrganizationMarkdownTemplates(): OrganizationMarkdownTemplate[] {
  return discoverOrganizationMarkdownTemplates();
}

export function listAgentWorkspaceTemplates(
  rawAgentId: string,
): AgentWorkspaceTemplate[] {
  const agentId = normalizeAgentId(rawAgentId);
  if (!agentId) {
    return [];
  }

  let fileNames: string[];
  try {
    fileNames = listTemplateFileNames(
      new URL(`./assets/agents/${agentId}/`, import.meta.url),
    );
  } catch (error) {
    if (isNotFoundError(error)) {
      return [];
    }
    throw error;
  }

  return fileNames.map((fileName) => ({
    fileName,
    content: readTemplateContent(`agents/${agentId}/${fileName}`),
  }));
}

export function renderInternalAgentConfig(
  agent: AgentIdentity,
  options: AgentTemplateOptions = {},
): Record<string, unknown> {
  const isCeo = isDefaultAgentId(agent.id);
  const type = options.type ?? (isCeo ? "manager" : "individual");
  const role = resolveAgentRole(agent.id, type, options.role ?? agent.role);
  const reportsTo =
    options.reportsTo === undefined
      ? isCeo
        ? null
        : DEFAULT_AGENT_ID
      : options.reportsTo;
  const assignedSkills = dedupe(options.skills ?? ROLE_SKILLS[type]);

  return {
    schemaVersion: 2,
    id: agent.id,
    displayName: agent.displayName,
    role,
    description:
      type === "manager"
        ? `${role} coordinating direct reports.`
        : `${role} OpenClaw agent for ${agent.displayName}.`,
    organization: {
      type,
      reportsTo,
      discoverable: true,
      tags: type === "manager" ? ["manager", "leadership"] : ["specialized"],
      priority: type === "manager" ? 100 : 50,
    },
    runtime: {
      provider: {
        id: "openclaw",
      },
      mode: "organization",
      sessions: {
        mainKey: "main",
        contextMaxChars: 12_000,
        reset: {
          mode: "daily",
          atHour: 4,
        },
        pruning: {
          enabled: true,
          maxMessages: 40,
          maxChars: 16_000,
          keepRecentMessages: 12,
        },
        compaction: {
          enabled: true,
          triggerMessageCount: 80,
          triggerChars: 32_000,
          keepRecentMessages: 20,
          summaryMaxChars: 4_000,
        },
      },
      skills: {
        enabled: true,
        includeWorkspace: false,
        includeManaged: true,
        assigned: assignedSkills,
        load: {
          extraDirs: [],
        },
        prompt: {
          maxSkills: 12,
          maxCharsPerSkill: 6_000,
          maxTotalChars: 36_000,
          includeContent: true,
        },
      },
    },
  };
}

export function resolveAgentRole(
  agentId: string,
  type: "manager" | "individual",
  rawRole?: string,
): string {
  const explicitRole = rawRole?.trim();
  if (explicitRole) {
    return explicitRole;
  }

  if (isDefaultAgentId(agentId)) {
    return "co-founder";
  }

  return type === "manager" ? "Manager" : "Team Member";
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

const templateContentCache = new Map<string, string>();

function readTemplateContent(relativePath: string): string {
  const cached = templateContentCache.get(relativePath);
  if (cached) {
    return cached;
  }

  const content = readFileSync(
    new URL(`./assets/${relativePath}`, import.meta.url),
    "utf-8",
  )
    .replace(/\r\n/g, "\n")
    .trimEnd();
  templateContentCache.set(relativePath, content);
  return content;
}

function discoverOrganizationMarkdownTemplates(): OrganizationMarkdownTemplate[] {
  let fileNames: string[];
  try {
    fileNames = listTemplateFileNames(
      new URL("./assets/organization/", import.meta.url),
    );
  } catch (error) {
    if (isNotFoundError(error)) {
      return [];
    }
    throw error;
  }

  return fileNames
    .filter((fileName) => isMarkdownFile(fileName))
    .map((fileName) => ({
      fileName,
      content: readTemplateContent(`organization/${fileName}`),
    }));
}

function isMarkdownFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".md");
}

function listTemplateFileNames(
  directory: URL,
  relativePrefix = "",
): string[] {
  const entries = readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  const fileNames: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      fileNames.push(
        ...listTemplateFileNames(
          new URL(`${entry.name}/`, directory),
          `${relativePrefix}${entry.name}/`,
        ),
      );
      continue;
    }

    if (entry.isFile()) {
      fileNames.push(`${relativePrefix}${entry.name}`);
    }
  }

  return fileNames;
}

function isNotFoundError(error: unknown): error is NodeJS.ErrnoException {
  if (!error || typeof error !== "object") {
    return false;
  }

  return (error as NodeJS.ErrnoException).code === "ENOENT";
}
