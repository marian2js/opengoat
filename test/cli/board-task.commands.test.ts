import { describe, expect, it, vi } from "vitest";
import { boardCommand } from "../../packages/cli/src/cli/commands/board.command.js";
import { taskCommand } from "../../packages/cli/src/cli/commands/task.command.js";
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

describe("board/task CLI commands", () => {
  it("board create forwards actor", async () => {
    const initialize = vi.fn(async () => ({ defaultAgent: "goat" }));
    const createBoard = vi.fn(async () => ({
      boardId: "core-planning-1234abcd",
      title: "Core Planning",
      createdAt: "2026-02-10T00:00:00.000Z",
      owner: "goat"
    }));

    const { context, stdout } = createContext({ initialize, createBoard });

    const code = await boardCommand.run(["create", "Core", "Planning", "--as", "goat"], context);

    expect(code).toBe(0);
    expect(initialize).toHaveBeenCalledOnce();
    expect(createBoard).toHaveBeenCalledWith("goat", {
      title: "Core Planning"
    });
    expect(stdout.output()).toContain("Board created: Core Planning (core-planning-1234abcd)");
  });

  it("board update requires at least one change", async () => {
    const initialize = vi.fn(async () => ({ defaultAgent: "goat" }));
    const updateBoard = vi.fn();

    const { context, stderr } = createContext({ initialize, updateBoard });

    const code = await boardCommand.run(["update", "board-1"], context);

    expect(code).toBe(1);
    expect(updateBoard).not.toHaveBeenCalled();
    expect(stderr.output()).toContain("Specify --title.");
  });

  it("task create forwards actor assignment and metadata", async () => {
    const initialize = vi.fn(async () => ({ defaultAgent: "goat" }));
    const createTask = vi.fn(async () => ({
      taskId: "task-1234abcd",
      boardId: "delivery-board",
      createdAt: "2026-02-10T00:00:00.000Z",
      workspace: "~",
      owner: "goat",
      assignedTo: "cto",
      title: "Define API",
      description: "Draft API contract",
      status: "doing",
      blockers: [],
      artifacts: [],
      worklog: []
    }));

    const { context, stdout } = createContext({ initialize, createTask });

    const code = await taskCommand.run(
      [
        "create",
        "delivery-board",
        "--as",
        "goat",
        "--assign",
        "cto",
        "--title",
        "Define API",
        "--description",
        "Draft API contract",
        "--status",
        "doing"
      ],
      context
    );

    expect(code).toBe(0);
    expect(createTask).toHaveBeenCalledWith("goat", "delivery-board", {
      title: "Define API",
      description: "Draft API contract",
      workspace: undefined,
      assignedTo: "cto",
      status: "doing"
    });
    expect(stdout.output()).toContain("Task created: Define API (task-1234abcd)");
    expect(stdout.output()).toContain("Workspace: ~");
  });

  it("task status forwards actor and new status", async () => {
    const initialize = vi.fn(async () => ({ defaultAgent: "goat" }));
    const updateTaskStatus = vi.fn(async () => ({
      taskId: "task-1234abcd",
      boardId: "delivery-board",
      createdAt: "2026-02-10T00:00:00.000Z",
      workspace: "~",
      owner: "goat",
      assignedTo: "cto",
      title: "Define API",
      description: "Draft API contract",
      status: "Doing",
      blockers: [],
      artifacts: [],
      worklog: []
    }));

    const { context, stdout } = createContext({ initialize, updateTaskStatus });

    const code = await taskCommand.run(["status", "task-1234abcd", "Doing", "--as", "cto"], context);

    expect(code).toBe(0);
    expect(updateTaskStatus).toHaveBeenCalledWith("cto", "task-1234abcd", "Doing");
    expect(stdout.output()).toContain("Status: Doing");
  });

  it("task blocker add forwards content", async () => {
    const initialize = vi.fn(async () => ({ defaultAgent: "goat" }));
    const addTaskBlocker = vi.fn(async () => ({
      taskId: "task-1234abcd",
      boardId: "delivery-board",
      createdAt: "2026-02-10T00:00:00.000Z",
      workspace: "~",
      owner: "goat",
      assignedTo: "cto",
      title: "Define API",
      description: "Draft API contract",
      status: "Doing",
      blockers: ["Waiting for auth token"],
      artifacts: [],
      worklog: []
    }));

    const { context, stdout } = createContext({ initialize, addTaskBlocker });

    const code = await taskCommand.run(
      ["blocker", "add", "task-1234abcd", "Waiting", "for", "auth", "token", "--as", "cto"],
      context
    );

    expect(code).toBe(0);
    expect(addTaskBlocker).toHaveBeenCalledWith("cto", "task-1234abcd", "Waiting for auth token");
    expect(stdout.output()).toContain("Blockers: 1");
  });

  it("task cron --once runs one cycle", async () => {
    const initialize = vi.fn(async () => ({ defaultAgent: "goat" }));
    const runTaskCronCycle = vi.fn(async () => ({
      ranAt: "2026-02-10T00:00:00.000Z",
      scannedTasks: 4,
      todoTasks: 2,
      blockedTasks: 1,
      inactiveAgents: 1,
      sent: 4,
      failed: 0,
      dispatches: []
    }));

    const { context, stdout } = createContext({ initialize, runTaskCronCycle });
    const code = await taskCommand.run(["cron", "--once", "--inactive-minutes", "45"], context);

    expect(code).toBe(0);
    expect(runTaskCronCycle).toHaveBeenCalledWith({ inactiveMinutes: 45 });
    expect(stdout.output()).toContain("[task-cron] ran=2026-02-10T00:00:00.000Z");
  });

  it("task create forwards custom workspace", async () => {
    const initialize = vi.fn(async () => ({ defaultAgent: "goat" }));
    const createTask = vi.fn(async () => ({
      taskId: "task-9",
      boardId: "delivery-board",
      createdAt: "2026-02-10T00:00:00.000Z",
      workspace: "/repo/service",
      owner: "goat",
      assignedTo: "goat",
      title: "Review API",
      description: "Review details",
      status: "todo",
      blockers: [],
      artifacts: [],
      worklog: []
    }));

    const { context } = createContext({ initialize, createTask });
    const code = await taskCommand.run(
      [
        "create",
        "delivery-board",
        "--title",
        "Review API",
        "--description",
        "Review details",
        "--workspace",
        "/repo/service"
      ],
      context
    );

    expect(code).toBe(0);
    expect(createTask).toHaveBeenCalledWith("goat", "delivery-board", {
      title: "Review API",
      description: "Review details",
      workspace: "/repo/service",
      assignedTo: undefined,
      status: undefined
    });
  });

  it("task create allows omitting board id", async () => {
    const initialize = vi.fn(async () => ({ defaultAgent: "goat" }));
    const createTask = vi.fn(async () => ({
      taskId: "task-11",
      boardId: "goat-board",
      createdAt: "2026-02-10T00:00:00.000Z",
      workspace: "~",
      owner: "goat",
      assignedTo: "goat",
      title: "Backlog Grooming",
      description: "Sort next tasks",
      status: "todo",
      blockers: [],
      artifacts: [],
      worklog: []
    }));

    const { context } = createContext({ initialize, createTask });
    const code = await taskCommand.run(
      [
        "create",
        "--title",
        "Backlog Grooming",
        "--description",
        "Sort next tasks"
      ],
      context
    );

    expect(code).toBe(0);
    expect(createTask).toHaveBeenCalledWith("goat", undefined, {
      title: "Backlog Grooming",
      description: "Sort next tasks",
      workspace: undefined,
      assignedTo: undefined,
      status: undefined
    });
  });
});
