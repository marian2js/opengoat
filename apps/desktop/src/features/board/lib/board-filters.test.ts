import assert from "node:assert/strict";
import test from "node:test";
import { applyBoardFilters } from "./board-filters.js";
import type { TaskRecord } from "@opengoat/contracts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTask(
  overrides: Partial<TaskRecord> & { taskId: string; status: string },
): TaskRecord {
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
// Filter tests
// ---------------------------------------------------------------------------

void test("applyBoardFilters: 'all' filter includes every status", () => {
  const tasks = [
    makeTask({ taskId: "1", status: "todo" }),
    makeTask({ taskId: "2", status: "doing" }),
    makeTask({ taskId: "3", status: "blocked" }),
    makeTask({ taskId: "4", status: "pending" }),
    makeTask({ taskId: "5", status: "done" }),
  ];
  const result = applyBoardFilters(tasks, "all", "updated", "");
  assert.equal(result.length, 5);
});

void test("applyBoardFilters: 'open' filter includes only todo and doing", () => {
  const tasks = [
    makeTask({ taskId: "1", status: "todo" }),
    makeTask({ taskId: "2", status: "doing" }),
    makeTask({ taskId: "3", status: "blocked" }),
    makeTask({ taskId: "4", status: "pending" }),
    makeTask({ taskId: "5", status: "done" }),
  ];
  const result = applyBoardFilters(tasks, "open", "updated", "");
  const statuses = result.map((t) => t.status);
  assert.deepEqual(statuses.sort(), ["doing", "todo"]);
});

void test("applyBoardFilters: 'blocked' filter includes only blocked", () => {
  const tasks = [
    makeTask({ taskId: "1", status: "todo" }),
    makeTask({ taskId: "2", status: "blocked" }),
    makeTask({ taskId: "3", status: "done" }),
  ];
  const result = applyBoardFilters(tasks, "blocked", "updated", "");
  assert.equal(result.length, 1);
  assert.equal(result[0]!.status, "blocked");
});

void test("applyBoardFilters: 'pending' filter includes only pending", () => {
  const tasks = [
    makeTask({ taskId: "1", status: "pending" }),
    makeTask({ taskId: "2", status: "doing" }),
  ];
  const result = applyBoardFilters(tasks, "pending", "updated", "");
  assert.equal(result.length, 1);
  assert.equal(result[0]!.status, "pending");
});

void test("applyBoardFilters: 'done' filter includes only done", () => {
  const tasks = [
    makeTask({ taskId: "1", status: "done" }),
    makeTask({ taskId: "2", status: "todo" }),
    makeTask({ taskId: "3", status: "done" }),
  ];
  const result = applyBoardFilters(tasks, "done", "updated", "");
  assert.equal(result.length, 2);
  assert.ok(result.every((t) => t.status === "done"));
});

// ---------------------------------------------------------------------------
// Search tests
// ---------------------------------------------------------------------------

void test("applyBoardFilters: search filters by case-insensitive substring match on title", () => {
  const tasks = [
    makeTask({ taskId: "1", status: "todo", title: "Launch homepage" }),
    makeTask({ taskId: "2", status: "todo", title: "Write blog post" }),
    makeTask({ taskId: "3", status: "todo", title: "LAUNCH email campaign" }),
  ];
  const result = applyBoardFilters(tasks, "all", "updated", "launch");
  assert.equal(result.length, 2);
  const ids = result.map((t) => t.taskId).sort();
  assert.deepEqual(ids, ["1", "3"]);
});

void test("applyBoardFilters: empty search returns all (within filter)", () => {
  const tasks = [
    makeTask({ taskId: "1", status: "todo", title: "Task A" }),
    makeTask({ taskId: "2", status: "todo", title: "Task B" }),
  ];
  const result = applyBoardFilters(tasks, "all", "updated", "");
  assert.equal(result.length, 2);
});

void test("applyBoardFilters: whitespace-only search returns all", () => {
  const tasks = [
    makeTask({ taskId: "1", status: "todo", title: "Task A" }),
  ];
  const result = applyBoardFilters(tasks, "all", "updated", "   ");
  assert.equal(result.length, 1);
});

// ---------------------------------------------------------------------------
// Sort tests
// ---------------------------------------------------------------------------

void test("applyBoardFilters: sort 'updated' orders by updatedAt descending", () => {
  const tasks = [
    makeTask({ taskId: "1", status: "todo", updatedAt: "2024-01-01T00:00:00Z" }),
    makeTask({ taskId: "2", status: "todo", updatedAt: "2024-01-03T00:00:00Z" }),
    makeTask({ taskId: "3", status: "todo", updatedAt: "2024-01-02T00:00:00Z" }),
  ];
  const result = applyBoardFilters(tasks, "all", "updated", "");
  const ids = result.map((t) => t.taskId);
  assert.deepEqual(ids, ["2", "3", "1"]);
});

void test("applyBoardFilters: sort 'status' orders by status priority then updatedAt desc", () => {
  const tasks = [
    makeTask({ taskId: "1", status: "done", updatedAt: "2024-01-05T00:00:00Z" }),
    makeTask({ taskId: "2", status: "doing", updatedAt: "2024-01-01T00:00:00Z" }),
    makeTask({ taskId: "3", status: "todo", updatedAt: "2024-01-03T00:00:00Z" }),
    makeTask({ taskId: "4", status: "todo", updatedAt: "2024-01-04T00:00:00Z" }),
  ];
  const result = applyBoardFilters(tasks, "all", "status", "");
  const ids = result.map((t) => t.taskId);
  assert.deepEqual(ids, ["2", "4", "3", "1"]);
});

void test("applyBoardFilters: sort 'newest' orders by createdAt descending", () => {
  const tasks = [
    makeTask({ taskId: "1", status: "todo", createdAt: "2024-01-01T00:00:00Z" }),
    makeTask({ taskId: "2", status: "todo", createdAt: "2024-01-03T00:00:00Z" }),
    makeTask({ taskId: "3", status: "todo", createdAt: "2024-01-02T00:00:00Z" }),
  ];
  const result = applyBoardFilters(tasks, "all", "newest", "");
  const ids = result.map((t) => t.taskId);
  assert.deepEqual(ids, ["2", "3", "1"]);
});

void test("applyBoardFilters: sort 'oldest' orders by createdAt ascending", () => {
  const tasks = [
    makeTask({ taskId: "1", status: "todo", createdAt: "2024-01-03T00:00:00Z" }),
    makeTask({ taskId: "2", status: "todo", createdAt: "2024-01-01T00:00:00Z" }),
    makeTask({ taskId: "3", status: "todo", createdAt: "2024-01-02T00:00:00Z" }),
  ];
  const result = applyBoardFilters(tasks, "all", "oldest", "");
  const ids = result.map((t) => t.taskId);
  assert.deepEqual(ids, ["2", "3", "1"]);
});

// ---------------------------------------------------------------------------
// Composition tests
// ---------------------------------------------------------------------------

void test("applyBoardFilters: filter + search + sort compose together", () => {
  const tasks = [
    makeTask({ taskId: "1", status: "todo", title: "Launch homepage", updatedAt: "2024-01-01T00:00:00Z" }),
    makeTask({ taskId: "2", status: "doing", title: "Launch email", updatedAt: "2024-01-03T00:00:00Z" }),
    makeTask({ taskId: "3", status: "done", title: "Launch blog", updatedAt: "2024-01-02T00:00:00Z" }),
    makeTask({ taskId: "4", status: "todo", title: "Write docs", updatedAt: "2024-01-04T00:00:00Z" }),
  ];
  // Filter "open" (todo + doing), search "launch", sort by "updated" desc
  const result = applyBoardFilters(tasks, "open", "updated", "launch");
  assert.equal(result.length, 2);
  const ids = result.map((t) => t.taskId);
  assert.deepEqual(ids, ["2", "1"]); // doing:Jan3, todo:Jan1
});

void test("applyBoardFilters: empty tasks array returns empty array", () => {
  const result = applyBoardFilters([], "all", "updated", "");
  assert.deepEqual(result, []);
});

void test("applyBoardFilters: search with no matches returns empty array", () => {
  const tasks = [
    makeTask({ taskId: "1", status: "todo", title: "Write blog post" }),
  ];
  const result = applyBoardFilters(tasks, "all", "updated", "nonexistent");
  assert.deepEqual(result, []);
});
