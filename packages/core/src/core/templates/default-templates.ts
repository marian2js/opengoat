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
    "- `skills/`: centralized skill definitions",
    "- `providers/`: OpenClaw runtime connectivity config",
    "- `runs/`: run traces (routing + execution history)",
    "",
    "OpenClaw remains the source for agent workspace bootstrap markdown files."
  ].join("\n");
}

export function renderDefaultManagerSkillMarkdown(): string {
  return [
    "---",
    "name: Manager",
    "description: Lead OpenGoat agents as a manager in the organization.",
    "user-invocable: true",
    "---",
    "",
    "# Manager",
    "",
    "## Mission",
    "- Lead your direct reportees to complete user goals.",
    "- Message only direct reportees.",
    "",
    "## Command Playbook",
    "- Send message to the default manager (CEO): `opengoat agent --message \"<text>\"`",
    "- Send message to specific agent: `opengoat agent <agent-id> --message \"<text>\"`",
    "- Create agent: `opengoat agent create <name>`",
    "- List agents: `opengoat agent list`",
    "- Configure OpenClaw gateway: `opengoat onboard`",
    "- Inspect routing: `opengoat route --message \"<text>\"`",
    "- Manage sessions: `opengoat session list|history|reset|compact ...`",
    "- Manage skills: `opengoat skill list|install ...`",
    "",
    "## Rules",
    "- Treat `goat` as the default entry manager unless explicitly overridden.",
    "- Message only direct reportees.",
    "- After CLI actions, report what changed and where."
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
