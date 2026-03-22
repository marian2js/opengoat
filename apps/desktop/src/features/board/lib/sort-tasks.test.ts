import assert from "node:assert/strict";
import test from "node:test";
import { sortTasksByStatus } from "./sort-tasks.js";
import type { TaskRecord } from "@opengoat/contracts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTask(overrides: Partial<TaskRecord> & { taskId: string; status: string }): TaskRecord {
  return {
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    owner: "agent",
    assignedTo: "user",
    title: "Test task",
    description: "",
    statusReason: undefined,
    blockers: [],
    artifacts: [],
    worklog: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// sortTasksByStatus – status priority ordering
// ---------------------------------------------------------------------------

void test("sortTasksByStatus: sorts by status priority (doing > todo > blocked > pending > done)", () => {
  const tasks = [
    makeTask({ taskId: "1", status: "done" }),
    makeTask({ taskId: "2", status: "todo" }),
    makeTask({ taskId: "3", status: "doing" }),
    makeTask({ taskId: "4", status: "pending" }),
    makeTask({ taskId: "5", status: "blocked" }),
  ];

  const sorted = sortTasksByStatus(tasks);
  const statuses = sorted.map((t) => t.status);
  assert.deepEqual(statuses, ["doing", "todo", "blocked", "pending", "done"]);
});

void test("sortTasksByStatus: sorts by updatedAt descending within same status group", () => {
  const tasks = [
    makeTask({ taskId: "1", status: "todo", updatedAt: "2024-01-01T00:00:00Z" }),
    makeTask({ taskId: "2", status: "todo", updatedAt: "2024-01-03T00:00:00Z" }),
    makeTask({ taskId: "3", status: "todo", updatedAt: "2024-01-02T00:00:00Z" }),
  ];

  const sorted = sortTasksByStatus(tasks);
  const ids = sorted.map((t) => t.taskId);
  assert.deepEqual(ids, ["2", "3", "1"]);
});

void test("sortTasksByStatus: returns empty array for empty input", () => {
  const sorted = sortTasksByStatus([]);
  assert.deepEqual(sorted, []);
});

void test("sortTasksByStatus: returns single-item array unchanged", () => {
  const tasks = [makeTask({ taskId: "1", status: "doing" })];
  const sorted = sortTasksByStatus(tasks);
  assert.equal(sorted.length, 1);
  assert.equal(sorted[0]!.taskId, "1");
});

void test("sortTasksByStatus: does not mutate the original array", () => {
  const tasks = [
    makeTask({ taskId: "1", status: "done" }),
    makeTask({ taskId: "2", status: "doing" }),
  ];
  const original = [...tasks];
  sortTasksByStatus(tasks);
  assert.deepEqual(tasks.map((t) => t.taskId), original.map((t) => t.taskId));
});

void test("sortTasksByStatus: unknown statuses sort after done", () => {
  const tasks = [
    makeTask({ taskId: "1", status: "unknown" }),
    makeTask({ taskId: "2", status: "doing" }),
    makeTask({ taskId: "3", status: "done" }),
  ];

  const sorted = sortTasksByStatus(tasks);
  const statuses = sorted.map((t) => t.status);
  assert.deepEqual(statuses, ["doing", "done", "unknown"]);
});
