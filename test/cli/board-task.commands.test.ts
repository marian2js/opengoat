import { describe, expect, it, vi } from "vitest";
import { taskCommand } from "../../packages/cli/src/cli/commands/task.command.js";
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

describe("task CLI command", () => {
  it("task create forwards actor assignment and metadata", async () => {
    const initialize = vi.fn(async () => ({ defaultAgent: "goat" }));
    const createTask = vi.fn(async () => ({
      taskId: "task-1234abcd",
      createdAt: "2026-02-10T00:00:00.000Z",
      owner: "goat",
      assignedTo: "cto",
      title: "Define API",
      description: "Draft API contract",
      status: "doing",
      blockers: [],
      artifacts: [],
      worklog: [],
    }));

    const { context, stdout } = createContext({ initialize, createTask });

    const code = await taskCommand.run(
      [
        "create",
        "--owner",
        "goat",
        "--assign",
        "cto",
        "--title",
        "Define API",
        "--description",
        "Draft API contract",
        "--status",
        "doing",
      ],
      context,
    );

    expect(code).toBe(0);
    expect(createTask).toHaveBeenCalledWith("goat", {
      title: "Define API",
      description: "Draft API contract",
      assignedTo: "cto",
      status: "doing",
    });
    expect(stdout.output()).toContain("Task created: Define API (task-1234abcd)");
  });

  it("task status forwards actor and new status", async () => {
    const initialize = vi.fn(async () => ({ defaultAgent: "goat" }));
    const updateTaskStatus = vi.fn(async () => ({
      taskId: "task-1234abcd",
      createdAt: "2026-02-10T00:00:00.000Z",
      owner: "goat",
      assignedTo: "cto",
      title: "Define API",
      description: "Draft API contract",
      status: "Doing",
      blockers: [],
      artifacts: [],
      worklog: [],
    }));

    const { context, stdout } = createContext({ initialize, updateTaskStatus });

    const code = await taskCommand.run(
      ["status", "task-1234abcd", "Doing", "--as", "cto"],
      context,
    );

    expect(code).toBe(0);
    expect(updateTaskStatus).toHaveBeenCalledWith("cto", "task-1234abcd", "Doing", undefined);
    expect(stdout.output()).toContain("Status: Doing");
  });

  it("task status forwards reason for blocked statuses", async () => {
    const initialize = vi.fn(async () => ({ defaultAgent: "goat" }));
    const updateTaskStatus = vi.fn(async () => ({
      taskId: "task-1234abcd",
      createdAt: "2026-02-10T00:00:00.000Z",
      owner: "goat",
      assignedTo: "cto",
      title: "Define API",
      description: "Draft API contract",
      status: "blocked",
      statusReason: "Waiting for DB migration",
      blockers: [],
      artifacts: [],
      worklog: [],
    }));

    const { context, stdout } = createContext({ initialize, updateTaskStatus });
    const code = await taskCommand.run(
      [
        "status",
        "task-1234abcd",
        "blocked",
        "--reason",
        "Waiting for DB migration",
        "--as",
        "cto",
      ],
      context,
    );

    expect(code).toBe(0);
    expect(updateTaskStatus).toHaveBeenCalledWith(
      "cto",
      "task-1234abcd",
      "blocked",
      "Waiting for DB migration",
    );
    expect(stdout.output()).toContain("Reason: Waiting for DB migration");
  });

  it("task status requires reason when status is pending or blocked", async () => {
    const initialize = vi.fn(async () => ({ defaultAgent: "goat" }));
    const updateTaskStatus = vi.fn();
    const { context, stderr } = createContext({ initialize, updateTaskStatus });

    const code = await taskCommand.run(
      ["status", "task-1234abcd", "pending", "--as", "cto"],
      context,
    );

    expect(code).toBe(1);
    expect(updateTaskStatus).not.toHaveBeenCalled();
    expect(stderr.output()).toContain("--reason is required when status is pending.");
  });

  it("task blocker add forwards content", async () => {
    const initialize = vi.fn(async () => ({ defaultAgent: "goat" }));
    const addTaskBlocker = vi.fn(async () => ({
      taskId: "task-1234abcd",
      createdAt: "2026-02-10T00:00:00.000Z",
      owner: "goat",
      assignedTo: "cto",
      title: "Define API",
      description: "Draft API contract",
      status: "Doing",
      blockers: ["Waiting for auth token"],
      artifacts: [],
      worklog: [],
    }));

    const { context, stdout } = createContext({ initialize, addTaskBlocker });

    const code = await taskCommand.run(
      ["blocker", "add", "task-1234abcd", "Waiting", "for", "auth", "token", "--as", "cto"],
      context,
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
      dispatches: [],
    }));

    const { context, stdout } = createContext({ initialize, runTaskCronCycle });
    const code = await taskCommand.run(
      ["cron", "--once", "--inactive-minutes", "45"],
      context,
    );

    expect(code).toBe(0);
    expect(runTaskCronCycle).toHaveBeenCalledWith({ inactiveMinutes: 45 });
    expect(stdout.output()).toContain("[task-cron] ran=2026-02-10T00:00:00.000Z");
  });

  it("task list filters by assignee across all tasks", async () => {
    const initialize = vi.fn(async () => ({ defaultAgent: "goat" }));
    const listTasks = vi.fn(async () => [
      {
        taskId: "task-a",
        createdAt: "2026-02-10T00:00:00.000Z",
        owner: "goat",
        assignedTo: "goat",
        title: "Goat task",
        description: "A",
        status: "todo",
        blockers: [],
        artifacts: [],
        worklog: [],
      },
    ]);

    const { context, stdout } = createContext({ initialize, listTasks });
    const code = await taskCommand.run(["list", "--as", "goat"], context);

    expect(code).toBe(0);
    expect(listTasks).toHaveBeenCalledWith({ assignee: "goat", limit: 100 });
    expect(stdout.output()).toContain("task-a");
    expect(stdout.output()).not.toContain("board=");
  });

  it("task list without arguments returns latest tasks sorted descending", async () => {
    const initialize = vi.fn(async () => ({ defaultAgent: "goat" }));
    const listTasks = vi.fn(async () => [
      {
        taskId: "task-old",
        createdAt: "2026-02-09T00:00:00.000Z",
        owner: "goat",
        assignedTo: "goat",
        title: "Old task",
        description: "A",
        status: "todo",
        blockers: [],
        artifacts: [],
        worklog: [],
      },
      {
        taskId: "task-new",
        createdAt: "2026-02-10T00:00:00.000Z",
        owner: "cto",
        assignedTo: "cto",
        title: "New task",
        description: "B",
        status: "doing",
        blockers: [],
        artifacts: [],
        worklog: [],
      },
    ]);

    const { context, stdout } = createContext({ initialize, listTasks });
    const code = await taskCommand.run(["list"], context);

    expect(code).toBe(0);
    expect(listTasks).toHaveBeenCalledWith({ assignee: undefined, limit: 100 });
    const output = stdout.output();
    expect(output.indexOf("task-new")).toBeLessThan(output.indexOf("task-old"));
  });
});
