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
} from "../../packages/core/src/core/templates/default-templates.js";

describe("default templates", () => {
  it("renders the global config payload", () => {
    const config = renderGlobalConfig("2026-02-06T00:00:00.000Z");

    expect(config).toEqual({
      schemaVersion: 1,
      defaultAgent: "goat",
      createdAt: "2026-02-06T00:00:00.000Z",
      updatedAt: "2026-02-06T00:00:00.000Z"
    });
  });

  it("renders agents index payload", () => {
    const index = renderAgentsIndex("2026-02-06T00:00:00.000Z", ["goat", "research"]);

    expect(index.schemaVersion).toBe(1);
    expect(index.agents).toEqual(["goat", "research"]);
    expect(index.updatedAt).toBe("2026-02-06T00:00:00.000Z");
  });

  it("renders workspace and internal markdown/json templates", () => {
    const identity = { id: "goat", displayName: "Goat" };

    const agentsMarkdown = renderWorkspaceAgentsMarkdown(identity);
    expect(agentsMarkdown).toContain("# Goat (OpenGoat Agent)");
    expect(agentsMarkdown).toContain("Record important decisions in `CONTEXT.md`.");

    const contextMarkdown = renderWorkspaceContextMarkdown(identity);
    expect(contextMarkdown).toContain("# Context (Goat)");

    expect(renderWorkspaceIdentityMarkdown(identity)).toContain("- id: goat");
    expect(renderWorkspaceHeartbeatMarkdown()).toContain("HEARTBEAT_OK");
    expect(renderWorkspaceBootstrapMarkdown(identity)).toContain("First-run checklist:");

    const metadata = renderWorkspaceMetadata(identity);
    expect(metadata).toEqual({
      schemaVersion: 1,
      id: "goat",
      displayName: "Goat",
      kind: "workspace",
      createdBy: "opengoat"
    });

    const internalConfig = renderInternalAgentConfig(identity) as {
      prompt: { bootstrapFiles: string[] };
      runtime: { contextBudgetTokens: number; bootstrapMaxChars: number; adapter: string };
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
    expect(internalConfig.runtime.adapter).toBe("openclaw");

    const internalMemory = renderInternalAgentMemoryMarkdown(identity);
    expect(internalMemory).toContain("# Internal Memory (Goat)");

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
