import type { AgentIdentity } from "../domain/agent.js";
import { DEFAULT_AGENT_ID, isDefaultAgentId } from "../domain/agent-id.js";
import type { AgentsIndex, OpenGoatConfig } from "../domain/opengoat-paths.js";

export { DEFAULT_AGENT_ID } from "../domain/agent-id.js";

export interface AgentTemplateOptions {
  type?: "manager" | "individual";
  reportsTo?: string | null;
  skills?: string[];
  role?: string;
}

export function renderGlobalConfig(nowIso: string): OpenGoatConfig {
  return {
    schemaVersion: 1,
    defaultAgent: DEFAULT_AGENT_ID,
    createdAt: nowIso,
    updatedAt: nowIso
  };
}

export function renderAgentsIndex(nowIso: string, agents: string[]): AgentsIndex {
  return {
    schemaVersion: 1,
    agents,
    updatedAt: nowIso
  };
}

export function renderGlobalConfigMarkdown(): string {
  return [
    "# OpenGoat Home",
    "",
    "This directory stores OpenGoat organization state.",
    "",
    "- `config.json`: global organization settings",
    "- `agents.json`: registered agent ids",
    "- `agents/`: per-agent OpenGoat config + session store",
    "- `skills/`: optional OpenGoat compatibility skill store (created on first install)",
    "- `providers/`: OpenClaw runtime connectivity config",
    "- `runs/`: run traces (routing + execution history)",
    "",
    "OpenClaw owns runtime skill loading and workspace bootstrap markdown files."
  ].join("\n");
}

export function renderGoatAgentsMarkdown(): string {
  return [
    "# AGENTS.md - OpenGoat Goat Workspace",
    "",
    "This workspace is pre-seeded by OpenGoat so `goat` can run immediately without first-run bootstrap prompts.",
    "",
    "## Role",
    "",
    "- Agent id: `goat`",
    "- Role: Head of Organization",
    "- Runtime: OpenClaw",
    "",
    "## Operating Defaults",
    "",
    "- Coordinate work through direct reportees.",
    "- Keep plans explicit, actionable, and task-focused.",
    "- Summarize decisions and next steps clearly.",
    "",
    "## Notes",
    "",
    "- Keep this file and `SOUL.md` aligned when role/behavior changes.",
    "- `BOOTSTRAP.md` is intentionally removed for pre-seeded deployments."
  ].join("\n");
}

export function renderGoatSoulMarkdown(): string {
  return [
    "# SOUL.md - Goat",
    "",
    "You are `goat`, the OpenGoat head manager.",
    "",
    "## Core Behavior",
    "",
    "- Be pragmatic, direct, and delegation-first.",
    "- Route specialized work to reportees when possible.",
    "- Keep responses concise unless detail is requested.",
    "",
    "## Guardrails",
    "",
    "- Confirm destructive or external high-risk actions before execution.",
    "- Preserve user intent and repository conventions.",
    "- Prefer verifiable outcomes (tests, command output, file references)."
  ].join("\n");
}

export function renderInternalAgentConfig(
  agent: AgentIdentity,
  options: AgentTemplateOptions = {}
): Record<string, unknown> {
  const isGoat = isDefaultAgentId(agent.id);
  const type = options.type ?? (isGoat ? "manager" : "individual");
  const role = resolveAgentRole(agent.id, type, options.role ?? agent.role);
  const reportsTo =
    options.reportsTo === undefined ? (isGoat ? null : DEFAULT_AGENT_ID) : options.reportsTo;
  const assignedSkills = dedupe(options.skills ?? (type === "manager" ? ["manager"] : []));

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
      priority: type === "manager" ? 100 : 50
    },
    runtime: {
      adapter: "openclaw",
      mode: "organization",
      sessions: {
        mainKey: "main",
        contextMaxChars: 12_000,
        reset: {
          mode: "daily",
          atHour: 4
        },
        pruning: {
          enabled: true,
          maxMessages: 40,
          maxChars: 16_000,
          keepRecentMessages: 12
        },
        compaction: {
          enabled: true,
          triggerMessageCount: 80,
          triggerChars: 32_000,
          keepRecentMessages: 20,
          summaryMaxChars: 4_000
        }
      },
      skills: {
        enabled: true,
        includeWorkspace: false,
        includeManaged: true,
        assigned: assignedSkills,
        load: {
          extraDirs: []
        },
        prompt: {
          maxSkills: 12,
          maxCharsPerSkill: 6_000,
          maxTotalChars: 36_000,
          includeContent: true
        }
      }
    }
  };
}

export function resolveAgentRole(
  agentId: string,
  type: "manager" | "individual",
  rawRole?: string
): string {
  const explicitRole = rawRole?.trim();
  if (explicitRole) {
    return explicitRole;
  }

  if (isDefaultAgentId(agentId)) {
    return "Head of Organization";
  }

  return type === "manager" ? "Manager" : "Individual Contributor";
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
