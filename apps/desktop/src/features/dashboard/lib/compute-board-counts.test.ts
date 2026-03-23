import assert from "node:assert/strict";
import test from "node:test";
import { computeBoardCounts } from "./compute-board-counts.js";
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
// computeBoardCounts – reduce tasks to summary counts
// ---------------------------------------------------------------------------

void test("computeBoardCounts: returns zero counts for empty array", () => {
  const counts = computeBoardCounts([]);
  assert.deepEqual(counts, { open: 0, doing: 0, blocked: 0, pending: 0, done: 0, total: 0 });
});

void test("computeBoardCounts: counts todo tasks as open", () => {
  const tasks = [makeTask({ taskId: "1", status: "todo" })];
  const counts = computeBoardCounts(tasks);
  assert.equal(counts.open, 1);
  assert.equal(counts.total, 1);
});

void test("computeBoardCounts: counts doing tasks as both open and doing", () => {
  const tasks = [makeTask({ taskId: "1", status: "doing" })];
  const counts = computeBoardCounts(tasks);
  assert.equal(counts.open, 1);
  assert.equal(counts.doing, 1);
  assert.equal(counts.total, 1);
});

void test("computeBoardCounts: counts blocked tasks", () => {
  const tasks = [makeTask({ taskId: "1", status: "blocked" })];
  const counts = computeBoardCounts(tasks);
  assert.equal(counts.blocked, 1);
  assert.equal(counts.total, 1);
});

void test("computeBoardCounts: counts done tasks", () => {
  const tasks = [makeTask({ taskId: "1", status: "done" })];
  const counts = computeBoardCounts(tasks);
  assert.equal(counts.done, 1);
  assert.equal(counts.total, 1);
});

void test("computeBoardCounts: handles mixed statuses correctly", () => {
  const tasks = [
    makeTask({ taskId: "1", status: "todo" }),
    makeTask({ taskId: "2", status: "doing" }),
    makeTask({ taskId: "3", status: "doing" }),
    makeTask({ taskId: "4", status: "blocked" }),
    makeTask({ taskId: "5", status: "done" }),
    makeTask({ taskId: "6", status: "done" }),
    makeTask({ taskId: "7", status: "done" }),
    makeTask({ taskId: "8", status: "pending" }),
  ];
  const counts = computeBoardCounts(tasks);
  assert.equal(counts.open, 3); // 1 todo + 2 doing
  assert.equal(counts.doing, 2);
  assert.equal(counts.blocked, 1);
  assert.equal(counts.done, 3);
  assert.equal(counts.total, 8);
});

void test("computeBoardCounts: pending tasks tracked in pending count", () => {
  const tasks = [makeTask({ taskId: "1", status: "pending" })];
  const counts = computeBoardCounts(tasks);
  assert.equal(counts.open, 0);
  assert.equal(counts.doing, 0);
  assert.equal(counts.blocked, 0);
  assert.equal(counts.pending, 1);
  assert.equal(counts.done, 0);
  assert.equal(counts.total, 1);
});

void test("computeBoardCounts: mixed statuses include pending count", () => {
  const tasks = [
    makeTask({ taskId: "1", status: "todo" }),
    makeTask({ taskId: "2", status: "pending" }),
    makeTask({ taskId: "3", status: "pending" }),
    makeTask({ taskId: "4", status: "done" }),
  ];
  const counts = computeBoardCounts(tasks);
  assert.equal(counts.open, 1);
  assert.equal(counts.pending, 2);
  assert.equal(counts.done, 1);
  assert.equal(counts.total, 4);
});

void test("computeBoardCounts: unknown statuses count toward total only", () => {
  const tasks = [makeTask({ taskId: "1", status: "cancelled" })];
  const counts = computeBoardCounts(tasks);
  assert.equal(counts.open, 0);
  assert.equal(counts.doing, 0);
  assert.equal(counts.blocked, 0);
  assert.equal(counts.done, 0);
  assert.equal(counts.total, 1);
});
