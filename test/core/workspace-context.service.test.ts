import { describe, expect, it } from "vitest";
import { WorkspaceContextService } from "../../src/core/agents/index.js";
import { NodeFileSystem } from "../../src/platform/node/node-file-system.js";
import { NodePathPort } from "../../src/platform/node/node-path.port.js";

describe("WorkspaceContextService", () => {
  it("builds missing markers and truncates large files", () => {
    const service = createService();
    const warnings: string[] = [];

    const contextFiles = service.buildContextFiles(
      [
        {
          name: "AGENTS.md",
          path: "/tmp/AGENTS.md",
          missing: true
        },
        {
          name: "TOOLS.md",
          path: "/tmp/TOOLS.md",
          missing: false,
          content: `HEAD-${"a".repeat(1200)}${"b".repeat(700)}-TAIL`
        }
      ],
      {
        maxChars: 200,
        warn: (message) => warnings.push(message)
      }
    );

    expect(contextFiles[0]).toEqual({
      path: "AGENTS.md",
      content: "[MISSING] Expected at: /tmp/AGENTS.md"
    });
    expect(contextFiles[1]?.content).toContain("[...truncated, read TOOLS.md for full content...]");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("TOOLS.md");
  });

  it("renders system prompt with project context and SOUL guidance", () => {
    const service = createService();

    const prompt = service.buildSystemPrompt({
      agentId: "orchestrator",
      displayName: "Orchestrator",
      workspaceDir: "/tmp/workspace",
      nowIso: "2026-02-06T00:00:00.000Z",
      contextFiles: [
        { path: "AGENTS.md", content: "agent instructions" },
        { path: "SOUL.md", content: "persona rules" }
      ]
    });

    expect(prompt).toContain("# OpenGoat System Prompt");
    expect(prompt).toContain("# Project Context");
    expect(prompt).toContain("## AGENTS.md");
    expect(prompt).toContain("agent instructions");
    expect(prompt).toContain("If SOUL.md is present");
    expect(prompt).toContain("2026-02-06T00:00:00.000Z");
  });
});

function createService(): WorkspaceContextService {
  return new WorkspaceContextService({
    fileSystem: new NodeFileSystem(),
    pathPort: new NodePathPort()
  });
}

