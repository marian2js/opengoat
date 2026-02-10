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
      assignedTo: "cto",
      status: "doing"
    });
    expect(stdout.output()).toContain("Task created: Define API (task-1234abcd)");
  });

  it("task status forwards actor and new status", async () => {
    const initialize = vi.fn(async () => ({ defaultAgent: "goat" }));
    const updateTaskStatus = vi.fn(async () => ({
      taskId: "task-1234abcd",
      boardId: "delivery-board",
      createdAt: "2026-02-10T00:00:00.000Z",
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
});
