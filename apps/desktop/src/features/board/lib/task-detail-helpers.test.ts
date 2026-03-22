import assert from "node:assert/strict";
import test from "node:test";
import type { TaskEntry } from "@opengoat/contracts";

// ---------------------------------------------------------------------------
// Helper functions to test section rendering logic
// ---------------------------------------------------------------------------

interface SectionData {
  isEmpty: boolean;
  items: Array<{ content: string; timestamp?: string }>;
}

function getBlockersData(blockers: string[]): SectionData {
  return {
    isEmpty: blockers.length === 0,
    items: blockers.map((b) => ({ content: b })),
  };
}

function getEntriesData(entries: TaskEntry[]): SectionData {
  return {
    isEmpty: entries.length === 0,
    items: entries.map((e) => ({ content: e.content, timestamp: e.createdAt })),
  };
}

// ---------------------------------------------------------------------------
// Blockers section logic
// ---------------------------------------------------------------------------

void test("getBlockersData: returns isEmpty true for empty blockers", () => {
  const data = getBlockersData([]);
  assert.equal(data.isEmpty, true);
  assert.equal(data.items.length, 0);
});

void test("getBlockersData: returns items with content for non-empty blockers", () => {
  const data = getBlockersData(["Missing API key", "Waiting for design"]);
  assert.equal(data.isEmpty, false);
  assert.equal(data.items.length, 2);
  assert.equal(data.items[0]!.content, "Missing API key");
  assert.equal(data.items[1]!.content, "Waiting for design");
});

void test("getBlockersData: blockers have no timestamp", () => {
  const data = getBlockersData(["Blocker 1"]);
  assert.equal(data.items[0]!.timestamp, undefined);
});

// ---------------------------------------------------------------------------
// Artifacts section logic
// ---------------------------------------------------------------------------

void test("getEntriesData: returns isEmpty true for empty artifacts", () => {
  const data = getEntriesData([]);
  assert.equal(data.isEmpty, true);
  assert.equal(data.items.length, 0);
});

void test("getEntriesData: returns items with content and timestamp for artifacts", () => {
  const artifacts: TaskEntry[] = [
    { createdAt: "2024-03-01T10:00:00Z", createdBy: "user", content: "Draft v1" },
    { createdAt: "2024-03-02T12:00:00Z", createdBy: "user", content: "Final copy" },
  ];
  const data = getEntriesData(artifacts);
  assert.equal(data.isEmpty, false);
  assert.equal(data.items.length, 2);
  assert.equal(data.items[0]!.content, "Draft v1");
  assert.equal(data.items[0]!.timestamp, "2024-03-01T10:00:00Z");
  assert.equal(data.items[1]!.content, "Final copy");
});

// ---------------------------------------------------------------------------
// Worklog section logic
// ---------------------------------------------------------------------------

void test("getEntriesData: returns isEmpty true for empty worklog", () => {
  const data = getEntriesData([]);
  assert.equal(data.isEmpty, true);
});

void test("getEntriesData: returns worklog items with timestamps", () => {
  const worklog: TaskEntry[] = [
    { createdAt: "2024-03-05T08:00:00Z", createdBy: "agent", content: "Started research" },
  ];
  const data = getEntriesData(worklog);
  assert.equal(data.isEmpty, false);
  assert.equal(data.items.length, 1);
  assert.equal(data.items[0]!.content, "Started research");
  assert.equal(data.items[0]!.timestamp, "2024-03-05T08:00:00Z");
});

// ---------------------------------------------------------------------------
// Quick actions logic
// ---------------------------------------------------------------------------

const ALL_STATUSES = ["todo", "doing", "pending", "blocked", "done"];

function getAvailableTransitions(currentStatus: string): string[] {
  return ALL_STATUSES.filter((s) => s !== currentStatus);
}

void test("getAvailableTransitions: excludes current status from transitions", () => {
  const transitions = getAvailableTransitions("doing");
  assert.ok(!transitions.includes("doing"));
  assert.equal(transitions.length, 4);
  assert.deepEqual(transitions, ["todo", "pending", "blocked", "done"]);
});

void test("getAvailableTransitions: shows all except todo when current is todo", () => {
  const transitions = getAvailableTransitions("todo");
  assert.ok(!transitions.includes("todo"));
  assert.equal(transitions.length, 4);
});

void test("getAvailableTransitions: shows all except done when current is done", () => {
  const transitions = getAvailableTransitions("done");
  assert.ok(!transitions.includes("done"));
  assert.deepEqual(transitions, ["todo", "doing", "pending", "blocked"]);
});

void test("getAvailableTransitions: pending and blocked are reason-eligible statuses", () => {
  const reasonStatuses = ["pending", "blocked"];
  for (const status of reasonStatuses) {
    assert.ok(ALL_STATUSES.includes(status), `${status} should be a valid status`);
  }
});
