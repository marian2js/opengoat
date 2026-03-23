import assert from "node:assert/strict";
import test from "node:test";
import {
  groupTasks,
  GROUPING_OPTIONS,
  type BoardGrouping,
  type TaskGroup,
} from "./board-grouping.js";
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
// "none" grouping
// ---------------------------------------------------------------------------

void test('groupTasks: "none" returns single group with all tasks', () => {
  const tasks = [
    makeTask({ taskId: "1", status: "todo" }),
    makeTask({ taskId: "2", status: "doing" }),
  ];
  const result = groupTasks(tasks, "none", new Map(), new Map());
  assert.equal(result.length, 1);
  assert.equal(result[0]!.key, "__all__");
  assert.equal(result[0]!.label, "All Tasks");
  assert.equal(result[0]!.tasks.length, 2);
});

void test('groupTasks: "none" with empty array returns single empty group', () => {
  const result = groupTasks([], "none", new Map(), new Map());
  assert.equal(result.length, 1);
  assert.equal(result[0]!.tasks.length, 0);
});

// ---------------------------------------------------------------------------
// "status" grouping
// ---------------------------------------------------------------------------

void test('groupTasks: "status" groups by task status', () => {
  const tasks = [
    makeTask({ taskId: "1", status: "todo" }),
    makeTask({ taskId: "2", status: "doing" }),
    makeTask({ taskId: "3", status: "blocked" }),
    makeTask({ taskId: "4", status: "todo" }),
    makeTask({ taskId: "5", status: "done" }),
  ];
  const result = groupTasks(tasks, "status", new Map(), new Map());

  // Should have groups ordered by STATUS_PRIORITY: doing, todo, blocked, pending, done
  const labels = result.map((g) => g.key);
  assert.ok(labels.includes("doing"));
  assert.ok(labels.includes("todo"));
  assert.ok(labels.includes("blocked"));
  assert.ok(labels.includes("done"));

  const doingGroup = result.find((g) => g.key === "doing");
  assert.equal(doingGroup!.tasks.length, 1);

  const todoGroup = result.find((g) => g.key === "todo");
  assert.equal(todoGroup!.tasks.length, 2);
});

void test('groupTasks: "status" omits empty groups', () => {
  const tasks = [
    makeTask({ taskId: "1", status: "todo" }),
    makeTask({ taskId: "2", status: "todo" }),
  ];
  const result = groupTasks(tasks, "status", new Map(), new Map());
  assert.equal(result.length, 1);
  assert.equal(result[0]!.key, "todo");
});

// ---------------------------------------------------------------------------
// "objective" grouping
// ---------------------------------------------------------------------------

void test('groupTasks: "objective" groups by objectiveId with lookup', () => {
  const tasks = [
    makeTask({ taskId: "1", status: "todo", objectiveId: "obj-1" }),
    makeTask({ taskId: "2", status: "doing", objectiveId: "obj-1" }),
    makeTask({ taskId: "3", status: "todo", objectiveId: "obj-2" }),
    makeTask({ taskId: "4", status: "todo" }), // no objective
  ];
  const objectiveMap = new Map([
    ["obj-1", { title: "Launch on Product Hunt", status: "active" }],
    ["obj-2", { title: "Improve SEO", status: "draft" }],
  ]);
  const result = groupTasks(tasks, "objective", objectiveMap, new Map());

  assert.equal(result.length, 3);

  const obj1Group = result.find((g) => g.key === "obj-1");
  assert.equal(obj1Group!.label, "Launch on Product Hunt");
  assert.equal(obj1Group!.tasks.length, 2);

  const obj2Group = result.find((g) => g.key === "obj-2");
  assert.equal(obj2Group!.label, "Improve SEO");
  assert.equal(obj2Group!.tasks.length, 1);

  const noObjGroup = result.find((g) => g.key === "__none__");
  assert.equal(noObjGroup!.label, "No Objective");
  assert.equal(noObjGroup!.tasks.length, 1);
});

void test('groupTasks: "objective" puts unknown objectiveId tasks under "No Objective"', () => {
  const tasks = [
    makeTask({ taskId: "1", status: "todo", objectiveId: "unknown-id" }),
  ];
  const result = groupTasks(tasks, "objective", new Map(), new Map());
  // Unknown objectiveId should still create its own group with fallback label
  assert.equal(result.length, 1);
  assert.equal(result[0]!.key, "unknown-id");
  assert.equal(result[0]!.label, "Unknown Objective");
});

void test('groupTasks: "objective" — "No Objective" group is last', () => {
  const tasks = [
    makeTask({ taskId: "1", status: "todo" }),
    makeTask({ taskId: "2", status: "todo", objectiveId: "obj-1" }),
  ];
  const objectiveMap = new Map([
    ["obj-1", { title: "Launch", status: "active" }],
  ]);
  const result = groupTasks(tasks, "objective", objectiveMap, new Map());
  assert.equal(result[result.length - 1]!.key, "__none__");
});

// ---------------------------------------------------------------------------
// "playbook" grouping
// ---------------------------------------------------------------------------

void test('groupTasks: "playbook" groups by run playbookId', () => {
  const tasks = [
    makeTask({ taskId: "1", status: "todo", runId: "run-1" }),
    makeTask({ taskId: "2", status: "doing", runId: "run-2" }),
    makeTask({ taskId: "3", status: "todo", runId: "run-1" }),
    makeTask({ taskId: "4", status: "todo" }), // no run
  ];
  const runMap = new Map([
    ["run-1", { title: "Homepage Audit", playbookId: "pb-1", playbookTitle: "Homepage Conversion Sprint" }],
    ["run-2", { title: "SEO Analysis", playbookId: "pb-2", playbookTitle: "SEO Wedge Sprint" }],
  ]);
  const result = groupTasks(tasks, "playbook", new Map(), runMap);

  assert.equal(result.length, 3);

  const pb1Group = result.find((g) => g.key === "pb-1");
  assert.equal(pb1Group!.label, "Homepage Conversion Sprint");
  assert.equal(pb1Group!.tasks.length, 2);

  const pb2Group = result.find((g) => g.key === "pb-2");
  assert.equal(pb2Group!.label, "SEO Wedge Sprint");
  assert.equal(pb2Group!.tasks.length, 1);

  const noPlaybookGroup = result.find((g) => g.key === "__none__");
  assert.equal(noPlaybookGroup!.label, "No Playbook");
  assert.equal(noPlaybookGroup!.tasks.length, 1);
});

void test('groupTasks: "playbook" uses run title when no playbookTitle', () => {
  const tasks = [
    makeTask({ taskId: "1", status: "todo", runId: "run-1" }),
  ];
  const runMap = new Map([
    ["run-1", { title: "Ad-hoc Run", playbookId: undefined, playbookTitle: undefined }],
  ]);
  const result = groupTasks(tasks, "playbook", new Map(), runMap);
  // Should fall back to run title
  assert.equal(result.length, 1);
  assert.equal(result[0]!.label, "Ad-hoc Run");
});

// ---------------------------------------------------------------------------
// GROUPING_OPTIONS constant
// ---------------------------------------------------------------------------

void test("GROUPING_OPTIONS has expected values", () => {
  assert.ok(GROUPING_OPTIONS.length >= 4);
  const values = GROUPING_OPTIONS.map((o) => o.value);
  assert.ok(values.includes("none"));
  assert.ok(values.includes("status"));
  assert.ok(values.includes("objective"));
  assert.ok(values.includes("playbook"));
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

void test("groupTasks: all tasks have no linkage under objective grouping", () => {
  const tasks = [
    makeTask({ taskId: "1", status: "todo" }),
    makeTask({ taskId: "2", status: "doing" }),
  ];
  const result = groupTasks(tasks, "objective", new Map(), new Map());
  assert.equal(result.length, 1);
  assert.equal(result[0]!.key, "__none__");
  assert.equal(result[0]!.tasks.length, 2);
});

void test("groupTasks: empty tasks with any grouping returns no groups (or single empty)", () => {
  const result = groupTasks([], "status", new Map(), new Map());
  assert.equal(result.length, 0);
});

void test("groupTasks: metadata fallback for objectiveId", () => {
  const tasks = [
    makeTask({
      taskId: "1",
      status: "todo",
      metadata: { objectiveId: "obj-from-meta" },
    }),
  ];
  const objectiveMap = new Map([
    ["obj-from-meta", { title: "From Metadata", status: "active" }],
  ]);
  const result = groupTasks(tasks, "objective", objectiveMap, new Map());
  const group = result.find((g) => g.key === "obj-from-meta");
  assert.ok(group);
  assert.equal(group!.label, "From Metadata");
  assert.equal(group!.tasks.length, 1);
});
