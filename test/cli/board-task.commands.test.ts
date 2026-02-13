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
    const initialize = vi.fn(async () => ({ defaultAgent: "ceo" }));
    const createBoard = vi.fn(async () => ({
      boardId: "core-planning-1234abcd",
      title: "Core Planning",
      createdAt: "2026-02-10T00:00:00.000Z",
      owner: "ceo"
    }));

    const { context, stdout } = createContext({ initialize, createBoard });

    const code = await boardCommand.run(["create", "Core", "Planning", "--owner", "ceo"], context);

    expect(code).toBe(0);
    expect(initialize).toHaveBeenCalledOnce();
    expect(createBoard).toHaveBeenCalledWith("ceo", {
      title: "Core Planning"
    });
    expect(stdout.output()).toContain("Board created: Core Planning (core-planning-1234abcd)");
  });

  it("board update requires at least one change", async () => {
    const initialize = vi.fn(async () => ({ defaultAgent: "ceo" }));
    const updateBoard = vi.fn();

    const { context, stderr } = createContext({ initialize, updateBoard });

    const code = await boardCommand.run(["update", "board-1"], context);

    expect(code).toBe(1);
    expect(updateBoard).not.toHaveBeenCalled();
    expect(stderr.output()).toContain("Specify --title.");
  });

  it("board list filters by owner", async () => {
    const initialize = vi.fn(async () => ({ defaultAgent: "ceo" }));
    const listBoards = vi.fn(async () => [
      {
        boardId: "ceo-board",
        title: "CEO Board",
        createdAt: "2026-02-10T00:00:00.000Z",
        owner: "ceo"
      },
      {
        boardId: "cto-board",
        title: "CTO Board",
        createdAt: "2026-02-10T00:00:00.000Z",
        owner: "cto"
      }
    ]);

    const { context, stdout } = createContext({ initialize, listBoards });
    const code = await boardCommand.run(["list", "--owner", "ceo"], context);

    expect(code).toBe(0);
    expect(listBoards).toHaveBeenCalledOnce();
    expect(stdout.output()).toContain("ceo-board");
    expect(stdout.output()).not.toContain("cto-board");
  });

  it("task create forwards actor assignment and metadata", async () => {
    const initialize = vi.fn(async () => ({ defaultAgent: "ceo" }));
    const createTask = vi.fn(async () => ({
      taskId: "task-1234abcd",
      boardId: "delivery-board",
      createdAt: "2026-02-10T00:00:00.000Z",
      project: "~",
      owner: "ceo",
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
        "--owner",
        "ceo",
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
    expect(createTask).toHaveBeenCalledWith("ceo", "delivery-board", {
      title: "Define API",
      description: "Draft API contract",
      project: undefined,
      assignedTo: "cto",
      status: "doing"
    });
    expect(stdout.output()).toContain("Task created: Define API (task-1234abcd)");
    expect(stdout.output()).toContain("Project: ~");
  });

  it("task status forwards actor and new status", async () => {
    const initialize = vi.fn(async () => ({ defaultAgent: "ceo" }));
    const updateTaskStatus = vi.fn(async () => ({
      taskId: "task-1234abcd",
      boardId: "delivery-board",
      createdAt: "2026-02-10T00:00:00.000Z",
      project: "~",
      owner: "ceo",
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
    expect(updateTaskStatus).toHaveBeenCalledWith("cto", "task-1234abcd", "Doing", undefined);
    expect(stdout.output()).toContain("Status: Doing");
  });

  it("task status forwards reason for blocked/pending statuses", async () => {
    const initialize = vi.fn(async () => ({ defaultAgent: "ceo" }));
    const updateTaskStatus = vi.fn(async () => ({
      taskId: "task-1234abcd",
      boardId: "delivery-board",
      createdAt: "2026-02-10T00:00:00.000Z",
      project: "~",
      owner: "ceo",
      assignedTo: "cto",
      title: "Define API",
      description: "Draft API contract",
      status: "blocked",
      statusReason: "Waiting for DB migration",
      blockers: [],
      artifacts: [],
      worklog: []
    }));

    const { context, stdout } = createContext({ initialize, updateTaskStatus });
    const code = await taskCommand.run(
      ["status", "task-1234abcd", "blocked", "--reason", "Waiting for DB migration", "--as", "cto"],
      context
    );

    expect(code).toBe(0);
    expect(updateTaskStatus).toHaveBeenCalledWith("cto", "task-1234abcd", "blocked", "Waiting for DB migration");
    expect(stdout.output()).toContain("Reason: Waiting for DB migration");
  });

  it("task status requires reason when status is pending or blocked", async () => {
    const initialize = vi.fn(async () => ({ defaultAgent: "ceo" }));
    const updateTaskStatus = vi.fn();
    const { context, stderr } = createContext({ initialize, updateTaskStatus });

    const code = await taskCommand.run(["status", "task-1234abcd", "pending", "--as", "cto"], context);

    expect(code).toBe(1);
    expect(updateTaskStatus).not.toHaveBeenCalled();
    expect(stderr.output()).toContain("--reason is required when status is pending.");
  });

  it("task blocker add forwards content", async () => {
    const initialize = vi.fn(async () => ({ defaultAgent: "ceo" }));
    const addTaskBlocker = vi.fn(async () => ({
      taskId: "task-1234abcd",
      boardId: "delivery-board",
      createdAt: "2026-02-10T00:00:00.000Z",
      project: "~",
      owner: "ceo",
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
    const initialize = vi.fn(async () => ({ defaultAgent: "ceo" }));
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

  it("task create forwards custom project", async () => {
    const initialize = vi.fn(async () => ({ defaultAgent: "ceo" }));
    const createTask = vi.fn(async () => ({
      taskId: "task-9",
      boardId: "delivery-board",
      createdAt: "2026-02-10T00:00:00.000Z",
      project: "/repo/service",
      owner: "ceo",
      assignedTo: "ceo",
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
        "--project",
        "/repo/service"
      ],
      context
    );

    expect(code).toBe(0);
    expect(createTask).toHaveBeenCalledWith("ceo", "delivery-board", {
      title: "Review API",
      description: "Review details",
      project: "/repo/service",
      assignedTo: undefined,
      status: undefined
    });
  });

  it("task create allows omitting board id", async () => {
    const initialize = vi.fn(async () => ({ defaultAgent: "ceo" }));
    const createTask = vi.fn(async () => ({
      taskId: "task-11",
      boardId: "ceo-board",
      createdAt: "2026-02-10T00:00:00.000Z",
      project: "~",
      owner: "ceo",
      assignedTo: "ceo",
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
    expect(createTask).toHaveBeenCalledWith("ceo", undefined, {
      title: "Backlog Grooming",
      description: "Sort next tasks",
      project: undefined,
      assignedTo: undefined,
      status: undefined
    });
  });

  it("task list filters by assignee across all boards", async () => {
    const initialize = vi.fn(async () => ({ defaultAgent: "ceo" }));
    const listBoards = vi.fn(async () => [
      {
        boardId: "ceo-board",
        title: "CEO Board",
        createdAt: "2026-02-10T00:00:00.000Z",
        owner: "ceo"
      },
      {
        boardId: "cto-board",
        title: "CTO Board",
        createdAt: "2026-02-10T00:00:00.000Z",
        owner: "cto"
      }
    ]);
    const listTasks = vi
      .fn()
      .mockResolvedValueOnce([
        {
          taskId: "task-a",
          boardId: "ceo-board",
          createdAt: "2026-02-10T00:00:00.000Z",
          project: "~",
          owner: "ceo",
          assignedTo: "ceo",
          title: "CEO task",
          description: "A",
          status: "todo",
          blockers: [],
          artifacts: [],
          worklog: []
        }
      ])
      .mockResolvedValueOnce([
        {
          taskId: "task-b",
          boardId: "cto-board",
          createdAt: "2026-02-10T00:00:00.000Z",
          project: "~",
          owner: "cto",
          assignedTo: "cto",
          title: "CTO task",
          description: "B",
          status: "todo",
          blockers: [],
          artifacts: [],
          worklog: []
        }
      ]);

    const { context, stdout } = createContext({ initialize, listBoards, listTasks });
    const code = await taskCommand.run(["list", "--as", "ceo"], context);

    expect(code).toBe(0);
    expect(listBoards).toHaveBeenCalledOnce();
    expect(listTasks).toHaveBeenCalledTimes(2);
    expect(listTasks).toHaveBeenNthCalledWith(1, "ceo-board");
    expect(listTasks).toHaveBeenNthCalledWith(2, "cto-board");
    expect(stdout.output()).toContain("task-a");
    expect(stdout.output()).not.toContain("task-b");
    expect(stdout.output()).toContain("board=ceo-board");
  });
});
