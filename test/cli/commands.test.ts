import { describe, expect, it, vi } from "vitest";
import { agentCommand } from "../../packages/cli/src/cli/commands/agent.command.js";
import { agentCreateCommand } from "../../packages/cli/src/cli/commands/agent-create.command.js";
import { agentDeleteCommand } from "../../packages/cli/src/cli/commands/agent-delete.command.js";
import { agentListCommand } from "../../packages/cli/src/cli/commands/agent-list.command.js";
import { agentSetManagerCommand } from "../../packages/cli/src/cli/commands/agent-set-manager.command.js";
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
      defaultAgent: "goat",
      createdPaths: ["/tmp/opengoat/config.json"],
      skippedPaths: []
    }));

    const { context, stdout } = createContext({ initialize });
    const code = await initCommand.run([], context);

    expect(code).toBe(0);
    expect(initialize).toHaveBeenCalledOnce();
    expect(stdout.output()).toContain("OpenGoat home: /tmp/opengoat");
    expect(stdout.output()).toContain("Default agent: goat");
  });

  it("agent create validates usage", async () => {
    const createAgent = vi.fn();
    const { context, stderr } = createContext({ createAgent });

    const code = await agentCreateCommand.run([], context);

    expect(code).toBe(1);
    expect(createAgent).not.toHaveBeenCalled();
    expect(stderr.output()).toContain("Usage: opengoat agent create");
  });

  it("agent create passes type, reports-to, and skills", async () => {
    const createAgent = vi.fn(async () => ({
      agent: {
        id: "research-analyst",
        displayName: "Research Analyst",
        workspaceDir: "/tmp/workspaces/research-analyst",
        internalConfigDir: "/tmp/agents/research-analyst"
      },
      createdPaths: ["a", "b"],
      skippedPaths: [],
      alreadyExisted: false,
      runtimeSync: {
        runtimeId: "openclaw",
        code: 0,
        stdout: "",
        stderr: ""
      }
    }));

    const { context, stdout } = createContext({ createAgent });
    const code = await agentCreateCommand.run(
      ["Research", "Analyst", "--individual", "--reports-to", "goat", "--skill", "research", "--skill", "docs"],
      context
    );

    expect(code).toBe(0);
    expect(createAgent).toHaveBeenCalledWith("Research Analyst", {
      type: "individual",
      reportsTo: "goat",
      skills: ["docs", "research"]
    });
    expect(stdout.output()).toContain("Agent ready: Research Analyst (research-analyst)");
    expect(stdout.output()).toContain("OpenClaw sync: openclaw (code 0)");
  });

  it("agent create prints already-existed note", async () => {
    const createAgent = vi.fn(async () => ({
      agent: {
        id: "developer",
        displayName: "Developer",
        workspaceDir: "/tmp/workspaces/developer",
        internalConfigDir: "/tmp/agents/developer"
      },
      createdPaths: [],
      skippedPaths: [],
      alreadyExisted: true
    }));
    const { context, stdout } = createContext({ createAgent });

    const code = await agentCreateCommand.run(["Developer"], context);

    expect(code).toBe(0);
    expect(stdout.output()).toContain("Local agent already existed; OpenClaw sync skipped.");
  });

  it("agent delete validates usage", async () => {
    const deleteAgent = vi.fn();
    const { context, stderr } = createContext({ deleteAgent });

    const code = await agentDeleteCommand.run([], context);

    expect(code).toBe(1);
    expect(deleteAgent).not.toHaveBeenCalled();
    expect(stderr.output()).toContain("Usage: opengoat agent delete");
  });

  it("agent delete passes --force and prints runtime sync", async () => {
    const deleteAgent = vi.fn(async () => ({
      agentId: "research-analyst",
      existed: true,
      removedPaths: ["/tmp/workspaces/research-analyst", "/tmp/agents/research-analyst"],
      skippedPaths: [],
      runtimeSync: {
        runtimeId: "openclaw",
        code: 0,
        stdout: "",
        stderr: ""
      }
    }));
    const { context, stdout } = createContext({ deleteAgent });

    const code = await agentDeleteCommand.run(["research-analyst", "--force"], context);

    expect(code).toBe(0);
    expect(deleteAgent).toHaveBeenCalledWith("research-analyst", {
      force: true
    });
    expect(stdout.output()).toContain("Agent deleted: research-analyst");
    expect(stdout.output()).toContain("OpenClaw sync: openclaw (code 0)");
    expect(stdout.output()).toContain("Removed paths: 2");
  });

  it("agent set-manager validates usage", async () => {
    const setAgentManager = vi.fn();
    const { context, stderr } = createContext({ setAgentManager });

    const code = await agentSetManagerCommand.run([], context);

    expect(code).toBe(1);
    expect(setAgentManager).not.toHaveBeenCalled();
    expect(stderr.output()).toContain("Usage: opengoat agent set-manager");
  });

  it("agent set-manager updates reports-to relationship", async () => {
    const setAgentManager = vi.fn(async () => ({
      agentId: "engineer",
      previousReportsTo: "goat",
      reportsTo: "cto",
      updatedPaths: ["/tmp/workspaces/engineer/AGENTS.md", "/tmp/agents/engineer/config.json"]
    }));
    const { context, stdout } = createContext({ setAgentManager });

    const code = await agentSetManagerCommand.run(["engineer", "cto"], context);

    expect(code).toBe(0);
    expect(setAgentManager).toHaveBeenCalledWith("engineer", "cto");
    expect(stdout.output()).toContain("Updated manager: engineer");
    expect(stdout.output()).toContain("Previous reports-to: goat");
    expect(stdout.output()).toContain("Current reports-to: cto");
  });

  it("agent list prints empty state and rows", async () => {
    const listAgents = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: "goat", displayName: "Goat" },
        { id: "research", displayName: "research" }
      ]);

    const first = createContext({ listAgents });
    const firstCode = await agentListCommand.run([], first.context);
    expect(firstCode).toBe(0);
    expect(first.stdout.output()).toContain("No agents found. Run: opengoat onboard");

    const second = createContext({ listAgents });
    const secondCode = await agentListCommand.run([], second.context);
    expect(secondCode).toBe(0);
    expect(second.stdout.output()).toContain("goat\n");
    expect(second.stdout.output()).toContain("research\n");
  });

  it("agent command defaults to goat when agent id is omitted", async () => {
    const runAgent = vi.fn(async () => ({
      code: 0,
      stdout: "ok\n",
      stderr: "",
      agentId: "goat",
      providerId: "openclaw"
    }));

    const { context } = createContext({ runAgent });
    const code = await agentCommand.run(["--message", "hello"], context);

    expect(code).toBe(0);
    expect(runAgent).toHaveBeenCalledWith(
      "goat",
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
      providerId: "openclaw"
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

    const second = createContext({ runAgent: vi.fn() });
    const secondCode = await agentCommand.run(["--help"], second.context);
    expect(secondCode).toBe(0);
    expect(second.stdout.output()).toContain("opengoat agent [agent-id]");
    expect(second.stdout.output()).toContain("agent-id defaults to goat");
  });

  it("agent command passes --cwd to service run options", async () => {
    const runAgent = vi.fn(async () => ({
      code: 0,
      stdout: "",
      stderr: "",
      agentId: "goat",
      providerId: "openclaw"
    }));

    const { context } = createContext({ runAgent });
    const code = await agentCommand.run(
      ["--message", "check", "--cwd", "/tmp/project"],
      context
    );

    expect(code).toBe(0);
    expect(runAgent).toHaveBeenCalledWith(
      "goat",
      expect.objectContaining({
        cwd: "/tmp/project"
      })
    );
  });
});
