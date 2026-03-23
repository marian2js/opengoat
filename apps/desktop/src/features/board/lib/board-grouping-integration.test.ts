import assert from "node:assert/strict";
import test from "node:test";
import { applyBoardFilters, type BoardFilterState } from "./board-filters.js";
import { groupTasks, type BoardGrouping } from "./board-grouping.js";
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

const DEFAULT_FILTER: BoardFilterState = {
  status: "all",
  objectiveId: null,
  runId: null,
  sourceType: null,
  stale: false,
  readyForReview: false,
};

// ---------------------------------------------------------------------------
// Integration: filter by objective, then group by status
// ---------------------------------------------------------------------------

void test("filter by objective + group by status shows only filtered task groups", () => {
  const tasks = [
    makeTask({ taskId: "1", status: "todo", objectiveId: "obj-1", title: "Task A" }),
    makeTask({ taskId: "2", status: "doing", objectiveId: "obj-1", title: "Task B" }),
    makeTask({ taskId: "3", status: "todo", objectiveId: "obj-2", title: "Task C" }),
    makeTask({ taskId: "4", status: "done", objectiveId: "obj-1", title: "Task D" }),
    makeTask({ taskId: "5", status: "blocked", title: "Task E" }), // no objective
  ];

  const objectiveMap = new Map([
    ["obj-1", { title: "Launch PH", status: "active" }],
    ["obj-2", { title: "SEO Wedge", status: "draft" }],
  ]);

  // Step 1: filter by objective obj-1
  const filterState: BoardFilterState = {
    ...DEFAULT_FILTER,
    objectiveId: "obj-1",
  };
  const filtered = applyBoardFilters(tasks, filterState, "status", "");
  assert.equal(filtered.length, 3); // 3 tasks belong to obj-1

  // Step 2: group by status
  const groups = groupTasks(filtered, "status", objectiveMap, new Map());

  // Verify groups are only for statuses present in the filtered set
  const groupKeys = groups.map((g) => g.key);
  assert.ok(groupKeys.includes("todo"));
  assert.ok(groupKeys.includes("doing"));
  assert.ok(groupKeys.includes("done"));
  assert.ok(!groupKeys.includes("blocked")); // task E was filtered out

  const todoGroup = groups.find((g) => g.key === "todo");
  assert.equal(todoGroup!.tasks.length, 1); // only task 1
});

// ---------------------------------------------------------------------------
// Integration: filter by status, then group by objective
// ---------------------------------------------------------------------------

void test("filter by status 'open' + group by objective shows only open task groups", () => {
  const tasks = [
    makeTask({ taskId: "1", status: "todo", objectiveId: "obj-1" }),
    makeTask({ taskId: "2", status: "doing", objectiveId: "obj-1" }),
    makeTask({ taskId: "3", status: "done", objectiveId: "obj-1" }),
    makeTask({ taskId: "4", status: "todo", objectiveId: "obj-2" }),
    makeTask({ taskId: "5", status: "done" }),
  ];

  const objectiveMap = new Map([
    ["obj-1", { title: "Launch PH", status: "active" }],
    ["obj-2", { title: "SEO Wedge", status: "draft" }],
  ]);

  // Step 1: filter by status "open" (todo + doing)
  const filterState: BoardFilterState = {
    ...DEFAULT_FILTER,
    status: "open",
  };
  const filtered = applyBoardFilters(tasks, filterState, "status", "");
  assert.equal(filtered.length, 3); // tasks 1, 2, 4

  // Step 2: group by objective
  const groups = groupTasks(filtered, "objective", objectiveMap, new Map());

  const obj1Group = groups.find((g) => g.key === "obj-1");
  assert.ok(obj1Group);
  assert.equal(obj1Group!.tasks.length, 2); // tasks 1 and 2 (not 3, which is done)

  const obj2Group = groups.find((g) => g.key === "obj-2");
  assert.ok(obj2Group);
  assert.equal(obj2Group!.tasks.length, 1); // task 4
});

// ---------------------------------------------------------------------------
// Integration: search + group by playbook
// ---------------------------------------------------------------------------

void test("search + group by playbook composes correctly", () => {
  const tasks = [
    makeTask({ taskId: "1", status: "todo", runId: "run-1", title: "Launch copy draft" }),
    makeTask({ taskId: "2", status: "doing", runId: "run-1", title: "Launch checklist" }),
    makeTask({ taskId: "3", status: "todo", runId: "run-2", title: "SEO audit" }),
    makeTask({ taskId: "4", status: "todo", title: "Launch prep meeting" }),
  ];

  const runMap = new Map([
    ["run-1", { title: "PH Launch Run", playbookId: "pb-1", playbookTitle: "Launch Pack" }],
    ["run-2", { title: "SEO Analysis", playbookId: "pb-2", playbookTitle: "SEO Wedge Sprint" }],
  ]);

  // Step 1: search "launch"
  const filtered = applyBoardFilters(tasks, DEFAULT_FILTER, "status", "launch");
  assert.equal(filtered.length, 3); // tasks 1, 2, 4

  // Step 2: group by playbook
  const groups = groupTasks(filtered, "playbook", new Map(), runMap);

  const launchGroup = groups.find((g) => g.key === "pb-1");
  assert.ok(launchGroup);
  assert.equal(launchGroup!.label, "Launch Pack");
  assert.equal(launchGroup!.tasks.length, 2); // tasks 1, 2

  const noPlaybookGroup = groups.find((g) => g.key === "__none__");
  assert.ok(noPlaybookGroup);
  assert.equal(noPlaybookGroup!.tasks.length, 1); // task 4

  // SEO group should NOT be present since "SEO audit" doesn't match "launch"
  const seoGroup = groups.find((g) => g.key === "pb-2");
  assert.equal(seoGroup, undefined);
});
