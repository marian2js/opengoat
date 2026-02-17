import { describe, expect, it, vi } from "vitest";
import { agentAllReporteesCommand } from "../../packages/cli/src/cli/commands/agent-all-reportees.command.js";
import { agentCreateCommand } from "../../packages/cli/src/cli/commands/agent-create.command.js";
import { agentDeleteCommand } from "../../packages/cli/src/cli/commands/agent-delete.command.js";
import { agentDirectReporteesCommand } from "../../packages/cli/src/cli/commands/agent-direct-reportees.command.js";
import { agentInfoCommand } from "../../packages/cli/src/cli/commands/agent-info.command.js";
import { agentLastActionCommand } from "../../packages/cli/src/cli/commands/agent-last-action.command.js";
import { agentListCommand } from "../../packages/cli/src/cli/commands/agent-list.command.js";
import { agentSetManagerCommand } from "../../packages/cli/src/cli/commands/agent-set-manager.command.js";
import { agentCommand } from "../../packages/cli/src/cli/commands/agent.command.js";
import { initCommand } from "../../packages/cli/src/cli/commands/init.command.js";
import { createStreamCapture } from "../helpers/stream-capture.js";

function createContext(service: unknown) {
  const stdout = createStreamCapture();
  const stderr = createStreamCapture();

  return {
    context: {
      service: service as never,
      stdout: stdout.stream,
      stderr: stderr.stream,
    },
    stdout,
    stderr,
  };
}

describe("CLI commands", () => {
  it("init command prints initialization result", async () => {
    const initialize = vi.fn(async () => ({
      paths: { homeDir: "/tmp/opengoat" },
      defaultAgent: "ceo",
      createdPaths: ["/tmp/opengoat/config.json"],
      skippedPaths: [],
    }));

    const { context, stdout } = createContext({ initialize });
    const code = await initCommand.run([], context);

    expect(code).toBe(0);
    expect(initialize).toHaveBeenCalledOnce();
    expect(stdout.output()).toContain("OpenGoat home: /tmp/opengoat");
    expect(stdout.output()).toContain("Default agent: ceo");
  });

  it("agent create validates usage", async () => {
    const createAgent = vi.fn();
    const { context, stderr } = createContext({ createAgent });

    const code = await agentCreateCommand.run([], context);

    expect(code).toBe(1);
    expect(createAgent).not.toHaveBeenCalled();
    expect(stderr.output()).toContain("Usage: opengoat agent create");
  });

  it("agent create requires a value for --role", async () => {
    const createAgent = vi.fn();
    const { context, stderr } = createContext({ createAgent });

    const code = await agentCreateCommand.run(["Developer", "--role"], context);

    expect(code).toBe(1);
    expect(createAgent).not.toHaveBeenCalled();
    expect(stderr.output()).toContain("Missing value for --role.");
  });

  it("agent create passes type, reports-to, and skills", async () => {
    const createAgent = vi.fn(async () => ({
      agent: {
        id: "research-analyst",
        displayName: "Research Analyst",
        role: "Developer",
        workspaceDir: "/tmp/workspaces/research-analyst",
        internalConfigDir: "/tmp/agents/research-analyst",
      },
      createdPaths: ["a", "b"],
      skippedPaths: [],
      alreadyExisted: false,
      runtimeSync: {
        runtimeId: "openclaw",
        code: 0,
        stdout: "",
        stderr: "",
      },
    }));

    const { context, stdout } = createContext({ createAgent });
    const code = await agentCreateCommand.run(
      [
        "Research",
        "Analyst",
        "--individual",
        "--role",
        "Developer",
        "--reports-to",
        "ceo",
        "--skill",
        "research",
        "--skill",
        "docs",
      ],
      context,
    );

    expect(code).toBe(0);
    expect(createAgent).toHaveBeenCalledWith("Research Analyst", {
      type: "individual",
      reportsTo: "ceo",
      skills: ["docs", "research"],
      role: "Developer",
    });
    expect(stdout.output()).toContain(
      "Agent ready: Research Analyst (research-analyst)",
    );
    expect(stdout.output()).toContain("Role: Developer");
    expect(stdout.output()).toContain("OpenClaw sync: openclaw (code 0)");
  });

  it("agent create prints already-existed note", async () => {
    const createAgent = vi.fn(async () => ({
      agent: {
        id: "developer",
        displayName: "Developer",
        role: "Developer",
        workspaceDir: "/tmp/workspaces/developer",
        internalConfigDir: "/tmp/agents/developer",
      },
      createdPaths: [],
      skippedPaths: [],
      alreadyExisted: true,
      runtimeSync: {
        runtimeId: "openclaw",
        code: 0,
        stdout: "",
        stderr: "",
      },
    }));
    const { context, stdout } = createContext({ createAgent });

    const code = await agentCreateCommand.run(["Developer"], context);

    expect(code).toBe(0);
    expect(stdout.output()).toContain(
      "Local agent already existed; OpenClaw sync was still attempted.",
    );
    expect(stdout.output()).toContain("OpenClaw sync: openclaw (code 0)");
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
      removedPaths: [
        "/tmp/workspaces/research-analyst",
        "/tmp/agents/research-analyst",
      ],
      skippedPaths: [],
      runtimeSync: {
        runtimeId: "openclaw",
        code: 0,
        stdout: "",
        stderr: "",
      },
    }));
    const { context, stdout } = createContext({ deleteAgent });

    const code = await agentDeleteCommand.run(
      ["research-analyst", "--force"],
      context,
    );

    expect(code).toBe(0);
    expect(deleteAgent).toHaveBeenCalledWith("research-analyst", {
      force: true,
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
      previousReportsTo: "ceo",
      reportsTo: "cto",
      updatedPaths: [
        "/tmp/workspaces/engineer/AGENTS.md",
        "/tmp/agents/engineer/config.json",
      ],
    }));
    const { context, stdout } = createContext({ setAgentManager });

    const code = await agentSetManagerCommand.run(["engineer", "cto"], context);

    expect(code).toBe(0);
    expect(setAgentManager).toHaveBeenCalledWith("engineer", "cto");
    expect(stdout.output()).toContain("Updated manager: engineer");
    expect(stdout.output()).toContain("Previous reports-to: ceo");
    expect(stdout.output()).toContain("Current reports-to: cto");
  });

  it("agent info validates usage and prints organization details", async () => {
    const invalid = createContext({ getAgentInfo: vi.fn() });
    const invalidCode = await agentInfoCommand.run([], invalid.context);
    expect(invalidCode).toBe(1);
    expect(invalid.stderr.output()).toContain("Usage: opengoat agent info");

    const getAgentInfo = vi.fn(async () => ({
      id: "ceo",
      name: "CEO",
      role: "CEO",
      totalReportees: 3,
      directReportees: [
        {
          id: "cto",
          name: "CTO",
          role: "Chief Technology Officer",
          totalReportees: 1,
        },
        {
          id: "qa",
          name: "QA",
          role: "QA Engineer",
          totalReportees: 0,
        },
      ],
    }));
    const valid = createContext({ getAgentInfo });
    const validCode = await agentInfoCommand.run(["ceo"], valid.context);
    expect(validCode).toBe(0);
    expect(getAgentInfo).toHaveBeenCalledWith("ceo");
    expect(valid.stdout.output()).toContain("id: ceo");
    expect(valid.stdout.output()).toContain("name: CEO");
    expect(valid.stdout.output()).toContain("role: CEO");
    expect(valid.stdout.output()).toContain("total reportees: 3");
    expect(valid.stdout.output()).toContain(
      'direct reportees:\n- {id: "cto", name: "CTO"',
    );
    expect(valid.stdout.output()).toContain("total reportees: 0}");
  });

  it("agent direct-reportees validates usage and prints one id per line", async () => {
    const invalid = createContext({ listDirectReportees: vi.fn() });
    const invalidCode = await agentDirectReporteesCommand.run(
      [],
      invalid.context,
    );
    expect(invalidCode).toBe(1);
    expect(invalid.stderr.output()).toContain(
      "Usage: opengoat agent direct-reportees",
    );

    const listDirectReportees = vi.fn(async () => ["cto", "qa"]);
    const valid = createContext({ listDirectReportees });
    const validCode = await agentDirectReporteesCommand.run(
      ["ceo"],
      valid.context,
    );
    expect(validCode).toBe(0);
    expect(listDirectReportees).toHaveBeenCalledWith("ceo");
    expect(valid.stdout.output()).toBe("cto\nqa\n");
  });

  it("agent all-reportees validates usage and prints one id per line", async () => {
    const invalid = createContext({ listAllReportees: vi.fn() });
    const invalidCode = await agentAllReporteesCommand.run([], invalid.context);
    expect(invalidCode).toBe(1);
    expect(invalid.stderr.output()).toContain(
      "Usage: opengoat agent all-reportees",
    );

    const listAllReportees = vi.fn(async () => ["cto", "engineer", "qa"]);
    const valid = createContext({ listAllReportees });
    const validCode = await agentAllReporteesCommand.run(
      ["ceo"],
      valid.context,
    );
    expect(validCode).toBe(0);
    expect(listAllReportees).toHaveBeenCalledWith("ceo");
    expect(valid.stdout.output()).toBe("cto\nengineer\nqa\n");
  });

  it("agent list prints empty state and rows", async () => {
    const listAgents = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: "ceo", displayName: "CEO", role: "CEO" },
        { id: "research", displayName: "research", role: "Developer" },
      ]);

    const first = createContext({ listAgents });
    const firstCode = await agentListCommand.run([], first.context);
    expect(firstCode).toBe(0);
    expect(first.stdout.output()).toContain(
      "No agents found. Run: opengoat onboard",
    );

    const second = createContext({ listAgents });
    const secondCode = await agentListCommand.run([], second.context);
    expect(secondCode).toBe(0);
    expect(second.stdout.output()).toContain("ceo [CEO]\n");
    expect(second.stdout.output()).toContain("research [Developer]\n");
  });

  it("agent command defaults to ceo when agent id is omitted", async () => {
    const runAgent = vi.fn(async () => ({
      code: 0,
      stdout: "ok\n",
      stderr: "",
      agentId: "ceo",
      providerId: "openclaw",
    }));

    const { context, stderr } = createContext({ runAgent });
    const code = await agentCommand.run(["--message", "hello"], context);

    expect(code).toBe(0);
    expect(runAgent).toHaveBeenCalledWith(
      "ceo",
      expect.objectContaining({
        message: "hello",
      }),
    );
  });

  it("agent command accepts explicit agent id and prints usage for --help", async () => {
    const runAgent = vi.fn(async () => ({
      code: 0,
      stdout: "",
      stderr: "",
      agentId: "research",
      providerId: "openclaw",
    }));

    const first = createContext({ runAgent });
    const firstCode = await agentCommand.run(
      ["research", "--message", "hello"],
      first.context,
    );
    expect(firstCode).toBe(0);
    expect(runAgent).toHaveBeenCalledWith(
      "research",
      expect.objectContaining({
        message: "hello",
      }),
    );

    const second = createContext({ runAgent: vi.fn() });
    const secondCode = await agentCommand.run(["--help"], second.context);
    expect(secondCode).toBe(0);
    expect(second.stdout.output()).toContain("opengoat agent [agent-id]");
    expect(second.stdout.output()).toContain("agent-id defaults to ceo");
    expect(second.stdout.output()).toContain("agent last-action");
    expect(second.stdout.output()).toContain("agent info");
    expect(second.stdout.output()).toContain("agent direct-reportees");
    expect(second.stdout.output()).toContain("agent all-reportees");
  });

  it("agent command rejects removed --project-path option", async () => {
    const runAgent = vi.fn(async () => ({
      code: 0,
      stdout: "",
      stderr: "",
      agentId: "ceo",
      providerId: "openclaw",
    }));

    const { context, stderr } = createContext({ runAgent });
    const code = await agentCommand.run(
      ["--message", "check", "--project-path", "/tmp/project"],
      context,
    );

    expect(code).toBe(1);
    expect(runAgent).not.toHaveBeenCalled();
    expect(stderr.output()).toContain("Unknown option: --project-path");
  });

  it("agent last-action validates args and prints results", async () => {
    const invalid = createContext({ getAgentLastAction: vi.fn() });
    const invalidCode = await agentLastActionCommand.run(
      ["--unknown"],
      invalid.context,
    );
    expect(invalidCode).toBe(1);
    expect(invalid.stderr.output()).toContain("Unknown option: --unknown");

    const getAgentLastAction = vi.fn(async () => ({
      agentId: "developer",
      sessionKey: "agent:developer:main",
      sessionId: "session-1",
      transcriptPath: "/tmp/session-1.jsonl",
      timestamp: Date.parse("2026-02-10T10:00:00.000Z"),
    }));
    const valid = createContext({ getAgentLastAction });
    const validCode = await agentLastActionCommand.run(
      ["developer"],
      valid.context,
    );
    expect(validCode).toBe(0);
    expect(getAgentLastAction).toHaveBeenCalledWith("developer");
    expect(valid.stdout.output()).toContain(
      "Last AI action: 2026-02-10T10:00:00.000Z",
    );
    expect(valid.stdout.output()).toContain(
      "Session key: agent:developer:main",
    );
  });

  it("agent last-action supports --json and empty state", async () => {
    const getAgentLastAction = vi.fn(async () => null);
    const empty = createContext({ getAgentLastAction });
    const emptyCode = await agentLastActionCommand.run(["ceo"], empty.context);
    expect(emptyCode).toBe(0);
    expect(empty.stdout.output()).toContain(
      'No AI actions found for agent "ceo".',
    );

    const jsonResult = createContext({
      getAgentLastAction: vi.fn(async () => ({
        agentId: "ceo",
        sessionKey: "agent:ceo:main",
        sessionId: "session-2",
        transcriptPath: "/tmp/session-2.jsonl",
        timestamp: Date.parse("2026-02-10T10:05:00.000Z"),
      })),
    });
    const jsonCode = await agentLastActionCommand.run(
      ["--json"],
      jsonResult.context,
    );
    expect(jsonCode).toBe(0);
    expect(jsonResult.stdout.output()).toContain('"agentId": "ceo"');
    expect(jsonResult.stdout.output()).toContain(
      '"iso": "2026-02-10T10:05:00.000Z"',
    );
  });
});
