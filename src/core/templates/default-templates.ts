import type { AgentIdentity } from "../domain/agent.js";
import type { AgentsIndex, OpenGoatConfig } from "../domain/opengoat-paths.js";
import { DEFAULT_PROVIDER_ID } from "../providers/index.js";

export const DEFAULT_AGENT_ID = "orchestrator";

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
    "",
    "Only Markdown and JSON files are used for OpenGoat configuration and state."
  ].join("\n");
}

export function renderWorkspaceAgentsMarkdown(agent: AgentIdentity): string {
  return [
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
  return {
    schemaVersion: 1,
    id: agent.id,
    displayName: agent.displayName,
    provider: {
      id: DEFAULT_PROVIDER_ID
    },
    runtime: {
      mode: "orchestrated",
      contextBudgetTokens: 128_000
    },
    prompt: {
      bootstrapFiles: ["AGENTS.md", "CONTEXT.md"]
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
