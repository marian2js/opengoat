import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { OpenCodeProvider } from "./provider.js";

describe("opencode provider", () => {
  it("maps invoke options to opencode run", () => {
    const provider = new OpenCodeProvider();
    const invocation = provider.buildInvocation({
      message: "summarize the repository",
      model: "openai/gpt-5",
      passthroughArgs: ["--format", "default"]
    });

    expect(invocation.command).toBe("opencode");
    expect(invocation.args).toEqual([
      "run",
      "--model",
      "openai/gpt-5",
      "--format",
      "default",
      "summarize the repository"
    ]);
  });

  it("supports OPENCODE_MODEL as default model", () => {
    const provider = new OpenCodeProvider();
    const invocation = provider.buildInvocation(
      { message: "plan next steps" },
      { ...process.env, OPENCODE_MODEL: "anthropic/claude-sonnet-4" }
    );

    expect(invocation.command).toBe("opencode");
    expect(invocation.args).toEqual(["run", "--model", "anthropic/claude-sonnet-4", "plan next steps"]);
  });

  it("prepends system prompt for CLI providers", () => {
    const provider = new OpenCodeProvider();
    const invocation = provider.buildInvocation({
      message: "ping",
      systemPrompt: "You are an orchestrator."
    });

    expect(invocation.args[invocation.args.length - 1]).toBe(
      "You are an orchestrator.\n\n# User Message\nping"
    );
  });

  it("maps auth invocation", () => {
    const provider = new OpenCodeProvider();
    const invocation = provider.buildAuthInvocation({ passthroughArgs: ["https://api.openai.com/v1"] });

    expect(invocation.command).toBe("opencode");
    expect(invocation.args).toEqual(["auth", "login", "https://api.openai.com/v1"]);
  });

  it("supports command override with OPENCODE_CMD", () => {
    const provider = new OpenCodeProvider();
    const invocation = provider.buildInvocation(
      { message: "ping" },
      { ...process.env, OPENCODE_CMD: "opencode-beta" }
    );

    expect(invocation.command).toBe("opencode-beta");
  });

  it("passes provider session id through --session", () => {
    const provider = new OpenCodeProvider();
    const invocation = provider.buildInvocation({
      message: "continue this task",
      providerSessionId: "oc-session-123"
    });

    expect(invocation.args).toEqual(["run", "--session", "oc-session-123", "continue this task"]);
  });

  it("creates provider-managed OpenCode agent files idempotently", async () => {
    const provider = new OpenCodeProvider();
    const root = await mkdtemp(path.join(os.tmpdir(), "opengoat-opencode-provider-"));
    try {
      const configDir = path.join(root, "opencode-config");
      const first = await provider.createAgent({
        agentId: "research-analyst",
        displayName: "Research Analyst",
        workspaceDir: "/unused/workspace",
        internalConfigDir: "/unused/config",
        env: {
          OPENCODE_CONFIG_DIR: configDir
        }
      });

      expect(provider.capabilities.agentCreate).toBe(true);
      expect(first.code).toBe(0);
      expect(first.stdout).toContain("Created OpenCode agent");

      const agentPath = path.join(configDir, "agent", "research-analyst.md");
      const contents = await readFile(agentPath, "utf-8");
      expect(contents).toContain("mode: subagent");
      expect(contents).toContain("You are Research Analyst");

      const second = await provider.createAgent({
        agentId: "research-analyst",
        displayName: "Research Analyst",
        workspaceDir: "/unused/workspace",
        internalConfigDir: "/unused/config",
        env: {
          OPENCODE_CONFIG_DIR: configDir
        }
      });
      expect(second.code).toBe(0);
      expect(second.stdout).toContain("already exists");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
