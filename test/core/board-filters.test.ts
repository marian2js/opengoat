import { describe, expect, it } from "vitest";

/**
 * Tests for the multi-dimensional board filter pipeline.
 * Written BEFORE implementation (TDD).
 */

// We'll import from board-filters once the types exist
import {
  applyBoardFilters,
  isStale,
  isReadyForReview,
  type BoardFilterState,
  type StatusFilter,
} from "../../apps/desktop/src/features/board/lib/board-filters";
import type { TaskRecord } from "@opengoat/contracts";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    taskId: "task-1",
    createdAt: "2026-03-20T10:00:00.000Z",
    updatedAt: "2026-03-20T10:00:00.000Z",
    owner: "goat",
    assignedTo: "goat",
    title: "Test task",
    description: "A test task",
    status: "todo",
    blockers: [],
    artifacts: [],
    worklog: [],
    ...overrides,
  };
}

const DEFAULT_FILTER_STATE: BoardFilterState = {
  status: "all",
  objectiveId: null,
  runId: null,
  sourceType: null,
  stale: false,
  readyForReview: false,
};

// ---------------------------------------------------------------------------
// applyBoardFilters — multi-dimensional
// ---------------------------------------------------------------------------

describe("applyBoardFilters multi-dimensional pipeline", () => {
  const tasks: TaskRecord[] = [
    makeTask({
      taskId: "t1",
      title: "Task one",
      status: "todo",
      updatedAt: "2026-03-20T10:00:00.000Z",
      metadata: { objectiveId: "obj-1", runId: "run-1", sourceType: "chat" },
    }),
    makeTask({
      taskId: "t2",
      title: "Task two",
      status: "doing",
      updatedAt: "2026-03-19T10:00:00.000Z",
      metadata: { objectiveId: "obj-1", runId: "run-2", sourceType: "playbook" },
    }),
    makeTask({
      taskId: "t3",
      title: "Task three",
      status: "blocked",
      updatedAt: "2026-03-01T10:00:00.000Z",
      metadata: { objectiveId: "obj-2", sourceType: "action" },
    }),
    makeTask({
      taskId: "t4",
      title: "Task four",
      status: "pending",
      updatedAt: "2026-03-18T10:00:00.000Z",
      metadata: { sourceType: "manual" },
    }),
    makeTask({
      taskId: "t5",
      title: "Task five",
      status: "done",
      updatedAt: "2026-03-15T10:00:00.000Z",
    }),
  ];

  it("returns all tasks with default filter state", () => {
    const result = applyBoardFilters(tasks, DEFAULT_FILTER_STATE, "updated", "");
    expect(result).toHaveLength(5);
  });

  it("filters by status dimension", () => {
    const state: BoardFilterState = { ...DEFAULT_FILTER_STATE, status: "open" };
    const result = applyBoardFilters(tasks, state, "updated", "");
    expect(result.every((t) => ["todo", "doing"].includes(t.status))).toBe(true);
    expect(result).toHaveLength(2);
  });

  it("filters by objectiveId dimension", () => {
    const state: BoardFilterState = { ...DEFAULT_FILTER_STATE, objectiveId: "obj-1" };
    const result = applyBoardFilters(tasks, state, "updated", "");
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.taskId)).toEqual(expect.arrayContaining(["t1", "t2"]));
  });

  it("filters by runId dimension", () => {
    const state: BoardFilterState = { ...DEFAULT_FILTER_STATE, runId: "run-1" };
    const result = applyBoardFilters(tasks, state, "updated", "");
    expect(result).toHaveLength(1);
    expect(result[0].taskId).toBe("t1");
  });

  it("filters by sourceType dimension", () => {
    const state: BoardFilterState = { ...DEFAULT_FILTER_STATE, sourceType: "chat" };
    const result = applyBoardFilters(tasks, state, "updated", "");
    expect(result).toHaveLength(1);
    expect(result[0].taskId).toBe("t1");
  });

  it("filters by stale flag (tasks not updated in 7+ days)", () => {
    // Freeze "now" by using tasks with known updatedAt
    // t3 updatedAt = 2026-03-01, t5 updatedAt = 2026-03-15
    // If now = 2026-03-22, stale = updatedAt older than 7 days:
    //   t3 (2026-03-01) = stale, t5 (2026-03-15) = stale
    const state: BoardFilterState = { ...DEFAULT_FILTER_STATE, stale: true };
    const result = applyBoardFilters(tasks, state, "updated", "", new Date("2026-03-22T00:00:00.000Z"));
    // t3 is 21 days old, t5 is 7 days old (stale threshold is > 7 days)
    expect(result.some((t) => t.taskId === "t3")).toBe(true);
  });

  it("filters by readyForReview flag (pending status)", () => {
    const state: BoardFilterState = { ...DEFAULT_FILTER_STATE, readyForReview: true };
    const result = applyBoardFilters(tasks, state, "updated", "");
    expect(result).toHaveLength(1);
    expect(result[0].taskId).toBe("t4");
  });

  it("combines multiple filter dimensions", () => {
    const state: BoardFilterState = {
      ...DEFAULT_FILTER_STATE,
      objectiveId: "obj-1",
      sourceType: "chat",
    };
    const result = applyBoardFilters(tasks, state, "updated", "");
    expect(result).toHaveLength(1);
    expect(result[0].taskId).toBe("t1");
  });

  it("applies search filter on top of other dimensions", () => {
    const state: BoardFilterState = { ...DEFAULT_FILTER_STATE, objectiveId: "obj-1" };
    const result = applyBoardFilters(tasks, state, "updated", "one");
    expect(result).toHaveLength(1);
    expect(result[0].taskId).toBe("t1");
  });

  it("preserves sort order", () => {
    const result = applyBoardFilters(tasks, DEFAULT_FILTER_STATE, "newest", "");
    expect(result[0].taskId).toBe("t1"); // newest createdAt
  });
});

// ---------------------------------------------------------------------------
// isStale helper
// ---------------------------------------------------------------------------

describe("isStale", () => {
  it("returns true when task updatedAt is older than threshold", () => {
    const task = makeTask({ updatedAt: "2026-03-01T10:00:00.000Z" });
    expect(isStale(task, 7, new Date("2026-03-22T00:00:00.000Z"))).toBe(true);
  });

  it("returns false when task updatedAt is within threshold", () => {
    const task = makeTask({ updatedAt: "2026-03-20T10:00:00.000Z" });
    expect(isStale(task, 7, new Date("2026-03-22T00:00:00.000Z"))).toBe(false);
  });

  it("uses default threshold of 7 days", () => {
    const task = makeTask({ updatedAt: "2026-03-10T10:00:00.000Z" });
    expect(isStale(task, undefined, new Date("2026-03-22T00:00:00.000Z"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isReadyForReview helper
// ---------------------------------------------------------------------------

describe("isReadyForReview", () => {
  it("returns true for pending tasks", () => {
    const task = makeTask({ status: "pending" });
    expect(isReadyForReview(task)).toBe(true);
  });

  it("returns false for non-pending tasks", () => {
    expect(isReadyForReview(makeTask({ status: "todo" }))).toBe(false);
    expect(isReadyForReview(makeTask({ status: "doing" }))).toBe(false);
    expect(isReadyForReview(makeTask({ status: "done" }))).toBe(false);
    expect(isReadyForReview(makeTask({ status: "blocked" }))).toBe(false);
  });
});
