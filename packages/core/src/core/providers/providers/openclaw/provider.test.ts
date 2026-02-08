import { describe, expect, it } from "vitest";
import { OpenClawProvider } from "./provider.js";

describe("openclaw provider", () => {
  it("maps invoke options", () => {
    const provider = new OpenClawProvider();
    const invocation = provider.buildInvocation({
      message: "ship",
      agent: "builder",
      model: "gpt-5",
      passthroughArgs: ["--full-auto"]
    });

    expect(invocation.command).toBe("openclaw");
    expect(invocation.args).toEqual([
      "agent",
      "builder",
      "--model",
      "gpt-5",
      "--full-auto",
      "--message",
      "ship"
    ]);
  });

  it("maps auth invocation with and without passthrough args", () => {
    const provider = new OpenClawProvider();

    const defaultInvocation = provider.buildAuthInvocation({});
    expect(defaultInvocation.command).toBe("openclaw");
    expect(defaultInvocation.args).toEqual(["onboard"]);

    const passthroughInvocation = provider.buildAuthInvocation({
      passthroughArgs: ["--provider", "openai-codex"]
    });
    expect(passthroughInvocation.args).toEqual([
      "models",
      "auth",
      "login",
      "--provider",
      "openai-codex"
    ]);
  });

  it("passes provider session id through --session-id", () => {
    const provider = new OpenClawProvider();
    const invocation = provider.buildInvocation({
      message: "continue",
      providerSessionId: "claw-session-7"
    });

    expect(invocation.args).toEqual(["agent", "--session-id", "claw-session-7", "--message", "continue"]);
  });

  it("maps external agent creation invocation to top-level agents add command", () => {
    const provider = new OpenClawProvider();
    const invocation = provider.buildCreateAgentInvocation({
      agentId: "research-analyst",
      displayName: "Research Analyst",
      workspaceDir: "/tmp/workspaces/research-analyst",
      internalConfigDir: "/tmp/agents/research-analyst"
    });

    expect(provider.capabilities.agentCreate).toBe(true);
    expect(invocation.command).toBe("openclaw");
    expect(invocation.args).toEqual([
      "agents",
      "add",
      "research-analyst",
      "--workspace",
      "/tmp/workspaces/research-analyst",
      "--agent-dir",
      "/tmp/agents/research-analyst",
      "--non-interactive"
    ]);
  });

  it("passes configured OpenClaw model when creating external agents", () => {
    const provider = new OpenClawProvider();
    const invocation = provider.buildCreateAgentInvocation({
      agentId: "research-analyst",
      displayName: "Research Analyst",
      workspaceDir: "/tmp/workspaces/research-analyst",
      internalConfigDir: "/tmp/agents/research-analyst",
      env: {
        OPENGOAT_OPENCLAW_MODEL: "openai-codex"
      }
    });

    expect(invocation.args).toEqual([
      "agents",
      "add",
      "research-analyst",
      "--workspace",
      "/tmp/workspaces/research-analyst",
      "--agent-dir",
      "/tmp/agents/research-analyst",
      "--non-interactive",
      "--model",
      "openai-codex"
    ]);
  });
});
