import type { AgentIdentity } from "../domain/agent.js";
import { DEFAULT_AGENT_ID, isDefaultAgentId } from "../domain/agent-id.js";
import type { AgentsIndex, OpenGoatConfig } from "../domain/opengoat-paths.js";
import { DEFAULT_PROVIDER_ID } from "../providers/index.js";

export { DEFAULT_AGENT_ID } from "../domain/agent-id.js";

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
    "- `config.json`: global orchestrator settings",
    "- `agents.json`: registered agent ids",
    "- `workspaces/`: user-visible agent workspaces",
    "- `agents/`: internal per-agent configuration",
    "- `skills/`: managed shared skills (optional source for agent installs)",
    "- `providers/`: provider credentials and endpoint settings",
    "- `sessions/`: transient per-run orchestration working files",
    "- `runs/`: run traces (routing + execution history)",
    "",
    "Only Markdown and JSON files are used for OpenGoat configuration and state."
  ].join("\n");
}

export function renderWorkspaceAgentsMarkdown(agent: AgentIdentity, providerId = DEFAULT_PROVIDER_ID): string {
  const description =
    isDefaultAgentId(agent.id)
      ? "Primary orchestration agent that routes work to specialized agents."
      : `Specialized agent for ${agent.displayName}.`;
  const tags = isDefaultAgentId(agent.id) ? "orchestration, routing" : "specialized, delegated";
  const canDelegate = isDefaultAgentId(agent.id) ? "true" : "false";
  const priority = isDefaultAgentId(agent.id) ? "100" : "50";

  return [
    "---",
    `id: ${agent.id}`,
    `name: ${agent.displayName}`,
    `description: ${description}`,
    `provider: ${providerId}`,
    "discoverable: true",
    `tags: [${tags}]`,
    "delegation:",
    "  canReceive: true",
    `  canDelegate: ${canDelegate}`,
    `priority: ${priority}`,
    "---",
    "",
    `# ${agent.displayName} (OpenGoat Agent)`,
    "",
    "## Role",
    "You are an autonomous agent managed by OpenGoat.",
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

export function renderDefaultOrchestratorSkillMarkdown(): string {
  return [
    "---",
    "name: OpenGoat Skill",
    "description: Use the OpenGoat CLI to orchestrate agents, providers, sessions, skills, and plugins.",
    "user-invocable: true",
    "---",
    "",
    "# OpenGoat Skill",
    "",
    "## When to Use",
    "- Use this skill when the task requires OpenGoat platform operations.",
    "- Use it for agent lifecycle, provider setup, routing checks, and session inspection.",
    "",
    "## Command Playbook",
    "- Send message to default orchestrator: `opengoat agent --message \"<text>\"`",
    "- Send message to specific agent: `opengoat agent <agent-id> --message \"<text>\"`",
    "- Create agent: `opengoat agent create --name \"<name>\"`",
    "- List agents: `opengoat agent list`",
    "- Inspect/set provider: `opengoat agent provider get --agent <agent-id>` / `opengoat agent provider set --agent <agent-id> --provider <provider-id>`",
    "- List providers: `opengoat provider list`",
    "- Configure providers and credentials: `opengoat onboard`",
    "- Inspect routing: `opengoat route --message \"<text>\"`",
    "- Manage sessions: `opengoat session list|history|reset|compact ...`",
    "- Manage skills: `opengoat skill list|install ...`",
    "- Manage plugins: `opengoat plugin list|install|enable|disable|doctor ...`",
    "",
    "## Rules",
    "- Treat `orchestrator` as the default entry agent unless explicitly overridden.",
    "- Prefer non-destructive inspection commands before changing provider or plugin state.",
    "- After CLI actions, report what changed and where."
  ].join("\n");
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
  const workspaceAccess = isDefaultAgentId(agent.id) ? "internal" : "auto";
  return {
    schemaVersion: 1,
    id: agent.id,
    displayName: agent.displayName,
    provider: {
      id: DEFAULT_PROVIDER_ID
    },
    runtime: {
      mode: "orchestrated",
      workspaceAccess,
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
        },
        skills: {
          enabled: true,
          includeWorkspace: true,
          includeManaged: true,
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
