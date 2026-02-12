import { readFileSync } from "node:fs";
import { DEFAULT_AGENT_ID, isDefaultAgentId } from "../domain/agent-id.js";
import type { AgentIdentity } from "../domain/agent.js";
import type { AgentsIndex, OpenGoatConfig } from "../domain/opengoat-paths.js";

export { DEFAULT_AGENT_ID } from "../domain/agent-id.js";

export interface AgentTemplateOptions {
  type?: "manager" | "individual";
  reportsTo?: string | null;
  skills?: string[];
  role?: string;
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

export function renderCeoAgentsMarkdown(): string {
  return readMarkdownTemplate("ceo/AGENTS.md");
}

export function renderCeoSoulMarkdown(): string {
  return readMarkdownTemplate("ceo/SOUL.md");
}

export function renderBoardManagerSkillMarkdown(): string {
  return readMarkdownTemplate("skills/board-manager/SKILL.md");
}

export function renderBoardIndividualSkillMarkdown(): string {
  return readMarkdownTemplate("skills/board-individual/SKILL.md");
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
      adapter: "openclaw",
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
    return "CEO";
  }

  return type === "manager" ? "Manager" : "Individual Contributor";
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

const markdownTemplateCache = new Map<string, string>();

function readMarkdownTemplate(relativePath: string): string {
  const cached = markdownTemplateCache.get(relativePath);
  if (cached) {
    return cached;
  }

  const content = readFileSync(
    new URL(`./assets/${relativePath}`, import.meta.url),
    "utf-8",
  )
    .replace(/\r\n/g, "\n")
    .trimEnd();
  markdownTemplateCache.set(relativePath, content);
  return content;
}
