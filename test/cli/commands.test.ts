import { describe, expect, it, vi } from "vitest";
import { agentCreateCommand } from "../../src/apps/cli/commands/agent-create.command.js";
import { agentListCommand } from "../../src/apps/cli/commands/agent-list.command.js";
import { initCommand } from "../../src/apps/cli/commands/init.command.js";
import { createStreamCapture } from "../helpers/stream-capture.js";

function createContext(service: unknown) {
  const stdout = createStreamCapture();
  const stderr = createStreamCapture();

  return {
    context: {
      service: service as never,
      stdout: stdout.stream,
      stderr: stderr.stream
    },
    stdout,
    stderr
  };
}

describe("CLI commands", () => {
  it("init command prints initialization result", async () => {
    const initialize = vi.fn(async () => ({
      paths: { homeDir: "/tmp/opengoat" },
      defaultAgent: "orchestrator",
      createdPaths: ["/tmp/opengoat/config.json"],
      skippedPaths: []
    }));

    const { context, stdout } = createContext({ initialize });
    const code = await initCommand.run([], context);

    expect(code).toBe(0);
    expect(initialize).toHaveBeenCalledOnce();
    expect(stdout.output()).toContain("OpenGoat home: /tmp/opengoat");
    expect(stdout.output()).toContain("Default agent: orchestrator");
  });

  it("agent create validates usage", async () => {
    const createAgent = vi.fn();
    const { context, stderr } = createContext({ createAgent });

    const code = await agentCreateCommand.run([], context);

    expect(code).toBe(1);
    expect(createAgent).not.toHaveBeenCalled();
    expect(stderr.output()).toContain("Usage: opengoat agent create");
  });

  it("agent create passes agent name to service", async () => {
    const createAgent = vi.fn(async () => ({
      agent: {
        id: "research-analyst",
        displayName: "Research Analyst",
        workspaceDir: "/tmp/workspaces/research-analyst",
        internalConfigDir: "/tmp/agents/research-analyst"
      },
      createdPaths: ["a", "b"],
      skippedPaths: []
    }));

    const { context, stdout } = createContext({ createAgent });

    const code = await agentCreateCommand.run(["Research", "Analyst"], context);

    expect(code).toBe(0);
    expect(createAgent).toHaveBeenCalledWith("Research Analyst");
    expect(stdout.output()).toContain("Agent created: Research Analyst (research-analyst)");
  });

  it("agent create rejects --set-default because orchestrator is always default", async () => {
    const createAgent = vi.fn();
    const { context, stderr } = createContext({ createAgent });

    const code = await agentCreateCommand.run(["Research", "--set-default"], context);

    expect(code).toBe(1);
    expect(createAgent).not.toHaveBeenCalled();
    expect(stderr.output()).toContain("Orchestrator is always the default agent");
  });

  it("agent list prints empty state and non-empty rows", async () => {
    const listAgents = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: "orchestrator", displayName: "Orchestrator" },
        { id: "research", displayName: "Research" }
      ]);

    const first = createContext({ listAgents });
    const firstCode = await agentListCommand.run([], first.context);

    expect(firstCode).toBe(0);
    expect(first.stdout.output()).toContain("No agents found. Run: opengoat init");

    const second = createContext({ listAgents });
    const secondCode = await agentListCommand.run([], second.context);

    expect(secondCode).toBe(0);
    expect(second.stdout.output()).toContain("orchestrator\tOrchestrator");
    expect(second.stdout.output()).toContain("research\tResearch");
  });
});
