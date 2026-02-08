import { describe, expect, it, vi } from "vitest";
import { agentCommand } from "../../packages/cli/src/cli/commands/agent.command.js";
import { agentCreateCommand } from "../../packages/cli/src/cli/commands/agent-create.command.js";
import { agentDeleteCommand } from "../../packages/cli/src/cli/commands/agent-delete.command.js";
import { agentListCommand } from "../../packages/cli/src/cli/commands/agent-list.command.js";
import { initCommand } from "../../packages/cli/src/cli/commands/init.command.js";
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
    expect(createAgent).toHaveBeenCalledWith("Research Analyst", {
      providerId: undefined,
      createExternalAgent: undefined
    });
    expect(stdout.output()).toContain("Agent created: Research Analyst (research-analyst)");
  });

  it("agent create supports provider binding and optional external creation", async () => {
    const createAgent = vi.fn(async () => ({
      agent: {
        id: "research-analyst",
        displayName: "Research Analyst",
        workspaceDir: "/tmp/workspaces/research-analyst",
        internalConfigDir: "/tmp/agents/research-analyst"
      },
      createdPaths: ["a", "b"],
      skippedPaths: [],
      externalAgentCreation: {
        providerId: "openclaw",
        code: 0,
        stdout: "created",
        stderr: ""
      }
    }));

    const { context, stdout } = createContext({ createAgent });
    const code = await agentCreateCommand.run(
      ["Research", "Analyst", "--provider", "openclaw", "--create-external"],
      context
    );

    expect(code).toBe(0);
    expect(createAgent).toHaveBeenCalledWith("Research Analyst", {
      providerId: "openclaw",
      createExternalAgent: true
    });
    expect(stdout.output()).toContain("External agent creation (openclaw): code 0");
  });

  it("agent create supports disabling provider-side creation", async () => {
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
    const { context } = createContext({ createAgent });

    const code = await agentCreateCommand.run(
      ["Research", "Analyst", "--provider", "openclaw", "--no-create-external"],
      context
    );

    expect(code).toBe(0);
    expect(createAgent).toHaveBeenCalledWith("Research Analyst", {
      providerId: "openclaw",
      createExternalAgent: false
    });
  });

  it("agent create rejects conflicting external-create flags", async () => {
    const createAgent = vi.fn();
    const { context, stderr } = createContext({ createAgent });

    const code = await agentCreateCommand.run(
      ["Research", "--create-external", "--no-create-external"],
      context
    );

    expect(code).toBe(1);
    expect(createAgent).not.toHaveBeenCalled();
    expect(stderr.output()).toContain("Cannot combine --create-external with --no-create-external");
  });

  it("agent create rejects --set-default because orchestrator is always default", async () => {
    const createAgent = vi.fn();
    const { context, stderr } = createContext({ createAgent });

    const code = await agentCreateCommand.run(["Research", "--set-default"], context);

    expect(code).toBe(1);
    expect(createAgent).not.toHaveBeenCalled();
    expect(stderr.output()).toContain("Orchestrator is always the default agent");
  });

  it("agent delete validates usage", async () => {
    const deleteAgent = vi.fn();
    const { context, stderr } = createContext({ deleteAgent });

    const code = await agentDeleteCommand.run([], context);

    expect(code).toBe(1);
    expect(deleteAgent).not.toHaveBeenCalled();
    expect(stderr.output()).toContain("Usage: opengoat agent delete");
  });

  it("agent delete passes options to service and supports external deletion", async () => {
    const deleteAgent = vi.fn(async () => ({
      agentId: "research-analyst",
      existed: true,
      removedPaths: ["/tmp/workspaces/research-analyst", "/tmp/agents/research-analyst"],
      skippedPaths: [],
      externalAgentDeletion: {
        providerId: "openclaw",
        code: 0,
        stdout: "deleted",
        stderr: ""
      }
    }));
    const { context, stdout } = createContext({ deleteAgent });

    const code = await agentDeleteCommand.run(
      ["research-analyst", "--delete-external", "--provider", "openclaw"],
      context
    );

    expect(code).toBe(0);
    expect(deleteAgent).toHaveBeenCalledWith("research-analyst", {
      providerId: "openclaw",
      deleteExternalAgent: true
    });
    expect(stdout.output()).toContain("Agent deleted locally: research-analyst");
    expect(stdout.output()).toContain("External agent deletion (openclaw): code 0");
  });

  it("agent list prints empty state and non-empty rows", async () => {
    const listAgents = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: "orchestrator", displayName: "Orchestrator" },
        { id: "research", displayName: "research" }
      ]);

    const first = createContext({ listAgents });
    const firstCode = await agentListCommand.run([], first.context);

    expect(firstCode).toBe(0);
    expect(first.stdout.output()).toContain("No agents found. Run: opengoat onboard");

    const second = createContext({ listAgents });
    const secondCode = await agentListCommand.run([], second.context);

    expect(secondCode).toBe(0);
    expect(second.stdout.output()).toContain("orchestrator\n");
    expect(second.stdout.output()).toContain("research\n");
  });

  it("agent command defaults to orchestrator when agent id is omitted", async () => {
    const runAgent = vi.fn(async () => ({
      code: 0,
      stdout: "ok\n",
      stderr: "",
      agentId: "orchestrator",
      providerId: "codex"
    }));

    const { context } = createContext({ runAgent });

    const code = await agentCommand.run(["--message", "hello"], context);

    expect(code).toBe(0);
    expect(runAgent).toHaveBeenCalledWith(
      "orchestrator",
      expect.objectContaining({
        message: "hello"
      })
    );
  });

  it("agent command accepts explicit agent id and prints usage for --help", async () => {
    const runAgent = vi.fn(async () => ({
      code: 0,
      stdout: "",
      stderr: "",
      agentId: "research",
      providerId: "codex"
    }));

    const first = createContext({ runAgent });
    const firstCode = await agentCommand.run(["research", "--message", "hello"], first.context);
    expect(firstCode).toBe(0);
    expect(runAgent).toHaveBeenCalledWith(
      "research",
      expect.objectContaining({
        message: "hello"
      })
    );

    const second = createContext({ runAgent });
    const secondCode = await agentCommand.run(["--help"], second.context);
    expect(secondCode).toBe(0);
    expect(second.stdout.output()).toContain("Usage:");
    expect(second.stdout.output()).toContain("defaults to orchestrator");
  });

  it("agent command passes --cwd to service run options", async () => {
    const runAgent = vi.fn(async () => ({
      code: 0,
      stdout: "ok\n",
      stderr: "",
      agentId: "research",
      providerId: "codex"
    }));

    const { context } = createContext({ runAgent });
    const code = await agentCommand.run(
      ["research", "--message", "hello", "--cwd", "/tmp/project"],
      context
    );

    expect(code).toBe(0);
    expect(runAgent).toHaveBeenCalledWith(
      "research",
      expect.objectContaining({
        message: "hello",
        cwd: "/tmp/project"
      })
    );
  });
});
