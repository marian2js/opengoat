import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ClaudeProvider } from "./provider.js";

describe("claude provider", () => {
  it("maps invoke options including agent/model", () => {
    const provider = new ClaudeProvider();
    const invocation = provider.buildInvocation({
      message: "implement feature",
      agent: "planner",
      model: "sonnet",
      passthroughArgs: ["--max-tokens", "2048"]
    });

    expect(invocation.command).toBe("claude");
    expect(invocation.args).toEqual([
      "--print",
      "--agent",
      "planner",
      "--model",
      "sonnet",
      "--max-tokens",
      "2048",
      "implement feature"
    ]);
  });

  it("maps auth invocation", () => {
    const provider = new ClaudeProvider();
    const invocation = provider.buildAuthInvocation({ passthroughArgs: ["--help"] });

    expect(invocation.command).toBe("claude");
    expect(invocation.args).toEqual(["setup-token", "--help"]);
  });

  it("creates provider-managed Claude agent files idempotently", async () => {
    const provider = new ClaudeProvider();
    const root = await mkdtemp(path.join(os.tmpdir(), "opengoat-claude-provider-"));
    try {
      const first = await provider.createAgent({
        agentId: "research-analyst",
        displayName: "Research Analyst",
        workspaceDir: "/unused/workspace",
        internalConfigDir: "/unused/config",
        env: {
          HOME: root
        }
      });
      expect(provider.capabilities.agentCreate).toBe(true);
      expect(first.code).toBe(0);
      expect(first.stdout).toContain("Created Claude agent");

      const agentPath = path.join(root, ".claude", "agents", "research-analyst.md");
      const contents = await readFile(agentPath, "utf-8");
      expect(contents).toContain('name: "research-analyst"');
      expect(contents).toContain("You are Research Analyst");

      const second = await provider.createAgent({
        agentId: "research-analyst",
        displayName: "Research Analyst",
        workspaceDir: "/unused/workspace",
        internalConfigDir: "/unused/config",
        env: {
          HOME: root
        }
      });
      expect(second.code).toBe(0);
      expect(second.stdout).toContain("already exists");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
