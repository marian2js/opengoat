import type { AgentIdentity } from "../domain/agent.js";
import { DEFAULT_AGENT_ID, isDefaultAgentId } from "../domain/agent-id.js";
import type { AgentsIndex, OpenGoatConfig } from "../domain/opengoat-paths.js";

export { DEFAULT_AGENT_ID } from "../domain/agent-id.js";

export interface AgentTemplateOptions {
  type?: "manager" | "individual";
  reportsTo?: string | null;
  skills?: string[];
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
    "This directory is OpenGoat runtime state.",
    "",
    "- `config.json`: global organization settings",
    "- `agents.json`: registered agent ids",
    "- `workspaces/`: user-visible agent workspaces",
    "- `agents/`: internal per-agent configuration",
    "- `skills/`: centralized skill definitions",
    "- `providers/`: runtime gateway settings (OpenClaw)",
    "- `sessions/`: transient per-run coordination working files",
    "- `runs/`: run traces (routing + execution history)",
    "",
    "Only Markdown and JSON files are used for OpenGoat configuration and state."
  ].join("\n");
}

export function renderWorkspaceAgentsMarkdown(agent: AgentIdentity, options: AgentTemplateOptions = {}): string {
  const isGoat = isDefaultAgentId(agent.id);
  const type = options.type ?? (isGoat ? "manager" : "individual");
  const reportsTo = options.reportsTo === undefined ? (isGoat ? null : DEFAULT_AGENT_ID) : options.reportsTo;
  const skills = dedupe(options.skills ?? (isGoat ? ["manager"] : []));
  const description =
    type === "manager"
      ? `Manager agent responsible for leading direct reports.`
      : `Specialized OpenClaw agent for ${agent.displayName}.`;
  const tags = type === "manager" ? "manager, leadership" : "specialized, delegated";
  const canDelegate = type === "manager" ? "true" : "false";
  const priority = type === "manager" ? "100" : "50";
  const reportsToValue = reportsTo ? reportsTo : "null";

  return [
    "---",
    `id: ${agent.id}`,
    `name: ${agent.displayName}`,
    `description: ${description}`,
    `type: ${type}`,
    `reportsTo: ${reportsToValue}`,
    "discoverable: true",
    `tags: [${tags}]`,
    `skills: [${skills.join(", ")}]`,
    "delegation:",
    "  canReceive: true",
    `  canDelegate: ${canDelegate}`,
    `priority: ${priority}`,
    "---",
    "",
    `# ${agent.displayName} (OpenGoat Agent)`,
    "",
    "## Role",
    type === "manager"
      ? "You are an OpenGoat manager. Message only your direct reportees."
      : "You are an autonomous OpenClaw-backed specialist managed by OpenGoat.",
    "",
    "## Runtime",
    "- Every OpenGoat agent maps 1:1 to an OpenClaw agent.",
    "- OpenGoat is the source of truth for agent definitions and hierarchy.",
    "",
    "## Workspace Contract",
    "- The workspace is your writable environment.",
    "- Keep durable user-facing guidance in Markdown files.",
    "- Keep structured settings in JSON files.",
    "",
    "## Operational Rules",
    "- Prefer explicit planning before major actions.",
    "- Keep logs concise and actionable.",
    "- Record important decisions in `CONTEXT.md`.",
    "",
    "## Memory",
    "Use `CONTEXT.md` for rolling context and handoff notes."
  ].join("\n");
}

export function renderWorkspaceContextMarkdown(agent: AgentIdentity): string {
  return [
    `# Context (${agent.displayName})`,
    "",
    "- Created by OpenGoat during workspace bootstrap.",
    "- Use this file to capture current goals, constraints, and pending work."
  ].join("\n");
}

export function renderWorkspaceSoulMarkdown(agent: AgentIdentity): string {
  return [
    `# Soul (${agent.displayName})`,
    "",
    "- Define tone, style, and non-negotiable guardrails here.",
    "- Keep this file concise and stable across runs."
  ].join("\n");
}

export function renderWorkspaceToolsMarkdown(): string {
  return [
    "# Tools",
    "",
    "- Document local tool conventions and execution preferences.",
    "- This file is guidance only; it does not grant tool permissions."
  ].join("\n");
}

export function renderWorkspaceIdentityMarkdown(agent: AgentIdentity): string {
  return [
    "# Identity",
    "",
    `- id: ${agent.id}`,
    `- displayName: ${agent.displayName}`,
    "- role: OpenGoat agent"
  ].join("\n");
}

export function renderWorkspaceUserMarkdown(): string {
  return [
    "# User",
    "",
    "- Capture durable user preferences here.",
    "- Avoid secrets; reference secure storage instead."
  ].join("\n");
}

export function renderWorkspaceHeartbeatMarkdown(): string {
  return [
    "# Heartbeat",
    "",
    "Read this file when asked to perform heartbeat checks.",
    "If nothing needs attention, return HEARTBEAT_OK."
  ].join("\n");
}

export function renderWorkspaceBootstrapMarkdown(agent: AgentIdentity): string {
  return [
    `# Bootstrap (${agent.displayName})`,
    "",
    "First-run checklist:",
    "- Review AGENTS.md, SOUL.md, and IDENTITY.md.",
    "- Confirm USER.md and CONTEXT.md reflect current goals.",
    "- Delete this file after the bootstrap ritual is complete."
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

export function renderDefaultOrchestratorSkillMarkdown(): string {
  return renderDefaultManagerSkillMarkdown();
}

export function renderWorkspaceMetadata(agent: AgentIdentity): Record<string, unknown> {
  return {
    schemaVersion: 1,
    id: agent.id,
    displayName: agent.displayName,
    kind: "workspace",
    createdBy: "opengoat"
  };
}

export function renderInternalAgentConfig(agent: AgentIdentity): Record<string, unknown> {
  const isGoat = isDefaultAgentId(agent.id);
  return {
    schemaVersion: 2,
    id: agent.id,
    displayName: agent.displayName,
    organization: {
      type: isGoat ? "manager" : "individual",
      reportsTo: isGoat ? null : DEFAULT_AGENT_ID
    },
    runtime: {
      adapter: "openclaw",
      mode: "organization",
      contextBudgetTokens: 128_000,
      bootstrapMaxChars: 20_000,
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
        assigned: isGoat ? ["manager"] : [],
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
    },
    prompt: {
      bootstrapFiles: [
        "AGENTS.md",
        "SOUL.md",
        "TOOLS.md",
        "IDENTITY.md",
        "USER.md",
        "HEARTBEAT.md",
        "CONTEXT.md",
        "BOOTSTRAP.md",
        "MEMORY.md",
        "memory.md"
      ]
    }
  };
}

export function renderInternalAgentMemoryMarkdown(agent: AgentIdentity): string {
  return [
    `# Internal Memory (${agent.displayName})`,
    "",
    "This file is for OpenGoat internal memory and diagnostic notes.",
    "It should remain machine-writable and human-readable."
  ].join("\n");
}

export function renderInternalAgentState(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    status: "idle",
    lastRunAt: null
  };
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
