import { describe, expect, it } from "vitest";
import {
  renderAgentsIndex,
  renderGlobalConfig,
  renderGlobalConfigMarkdown,
  renderInternalAgentConfig,
  renderInternalAgentMemoryMarkdown,
  renderInternalAgentState,
  renderWorkspaceAgentsMarkdown,
  renderWorkspaceBootstrapMarkdown,
  renderWorkspaceContextMarkdown,
  renderWorkspaceHeartbeatMarkdown,
  renderWorkspaceIdentityMarkdown,
  renderWorkspaceMetadata
} from "../../src/core/templates/default-templates.js";

describe("default templates", () => {
  it("renders the global config payload", () => {
    const config = renderGlobalConfig("2026-02-06T00:00:00.000Z");

    expect(config).toEqual({
      schemaVersion: 1,
      defaultAgent: "orchestrator",
      createdAt: "2026-02-06T00:00:00.000Z",
      updatedAt: "2026-02-06T00:00:00.000Z"
    });
  });

  it("renders agents index payload", () => {
    const index = renderAgentsIndex("2026-02-06T00:00:00.000Z", ["orchestrator", "research"]);

    expect(index.schemaVersion).toBe(1);
    expect(index.agents).toEqual(["orchestrator", "research"]);
    expect(index.updatedAt).toBe("2026-02-06T00:00:00.000Z");
  });

  it("renders workspace and internal markdown/json templates", () => {
    const identity = { id: "orchestrator", displayName: "Orchestrator" };

    const agentsMarkdown = renderWorkspaceAgentsMarkdown(identity);
    expect(agentsMarkdown).toContain("# Orchestrator (OpenGoat Agent)");
    expect(agentsMarkdown).toContain("Record important decisions in `CONTEXT.md`.");

    const contextMarkdown = renderWorkspaceContextMarkdown(identity);
    expect(contextMarkdown).toContain("# Context (Orchestrator)");

    expect(renderWorkspaceIdentityMarkdown(identity)).toContain("- id: orchestrator");
    expect(renderWorkspaceHeartbeatMarkdown()).toContain("HEARTBEAT_OK");
    expect(renderWorkspaceBootstrapMarkdown(identity)).toContain("First-run checklist:");

    const metadata = renderWorkspaceMetadata(identity);
    expect(metadata).toEqual({
      schemaVersion: 1,
      id: "orchestrator",
      displayName: "Orchestrator",
      kind: "workspace",
      createdBy: "opengoat"
    });

    const internalConfig = renderInternalAgentConfig(identity) as {
      prompt: { bootstrapFiles: string[] };
      runtime: { contextBudgetTokens: number; bootstrapMaxChars: number };
      provider: { id: string };
    };
    expect(internalConfig.prompt.bootstrapFiles).toEqual([
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
    ]);
    expect(internalConfig.runtime.contextBudgetTokens).toBe(128_000);
    expect(internalConfig.runtime.bootstrapMaxChars).toBe(20_000);
    expect(internalConfig.provider.id).toBe("codex");

    const internalMemory = renderInternalAgentMemoryMarkdown(identity);
    expect(internalMemory).toContain("# Internal Memory (Orchestrator)");

    expect(renderInternalAgentState()).toEqual({
      schemaVersion: 1,
      status: "idle",
      lastRunAt: null
    });
  });

  it("renders human-readable global config markdown", () => {
    const markdown = renderGlobalConfigMarkdown();

    expect(markdown).toContain("# OpenGoat Home");
    expect(markdown).toContain("`config.json`");
    expect(markdown).toContain("`workspaces/`");
    expect(markdown).toContain("Markdown and JSON");
  });
});
